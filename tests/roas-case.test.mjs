import test from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {loadCurrentData, sha256} from '../scripts/current-data.mjs';
import {analyzeRoasCase} from '../backend/roas-case.mjs';
import {selectScenario} from '../shared/scenario-selection.mjs';
import {generateRoasRecords, spec} from '../scripts/augment-roas-case.mjs';
import {applyDemoOrderFlow} from '../scripts/demo-order-flow.mjs';

const {catalog, manifest} = loadCurrentData();
const profile = {scenario_id: 'D008-comparison-demo', product_id: 'P1A', currency: 'KRW', scope_ids: {KR: manifest.scope_ids.KR},
  baseline: {start: '2026-08-03', end: '2026-08-17'}, observed: {start: '2026-08-17', end: '2026-08-31'}};
const asOf = '2026-10-21T00:00:00+09:00';

test('existing evidence exposes gaps instead of inventing net ROAS or purchase paths', () => {
  const before = sha256(JSON.stringify(catalog.records));
  const report = analyzeRoasCase(catalog.records, profile, {asOf});
  assert.equal(report.status, 'partial');
  assert(report.gaps.includes('order_acquisition_missing'));
  assert(report.gaps.includes('purchase_session_missing'));
  assert(report.gaps.includes('financial_event_deduplication_unconfirmed'));
  assert.deepEqual(report.periods.map(period => [period.total.spend, period.total.reportedRevenue]),
    [['976052.00', '1444800.00'], ['860952.00', '1199700.00']]);
  assert(report.periods.every(period => period.total.netRoas === null));
  assert(report.periods.every(period => period.channels.every(channel => channel.purchaseCohort.funnel.purchase === null)));
  assert(report.budgetReview.every(item => item.amount === null && item.changeRatio === null));
  assert.equal(sha256(JSON.stringify(catalog.records)), before);
});

test('source selection isolates existing scopes and preserves shared product definitions', () => {
  const selected = selectScenario(catalog.records, profile.scope_ids, profile.scenario_id);
  assert(selected.length < catalog.records.length);
  assert.equal(selected.filter(row => row.dataset_type === 'T01').length, 6);
  assert(selected.every(row => row.dataset_type === 'T01' || row.scope_id === 'D008-KR-sample'));
  assert.throws(() => selectScenario(catalog.records, {}), /scenario_scope_required/);
});

test('comparison dates and cutoff are required rather than silently defaulted', () => {
  assert.throws(() => analyzeRoasCase(catalog.records, profile), /as_of_required/);
  assert.throws(() => analyzeRoasCase(catalog.records, profile, {asOf: '2026-08-20T00:00:00+09:00'}), /comparison_not_finished/);
  assert.throws(() => analyzeRoasCase(catalog.records, {...profile, observed: {start: '2026-08-17', end: '2026-08-30'}}, {asOf}), /period_length_mismatch/);
});

const linkedProfile = catalog.definitions.scenario_profiles.find(item => item.scenario_id === spec.scenario_id);
const linkedRecords = selectScenario(catalog.records, linkedProfile.scope_ids, linkedProfile.scenario_id);
const analyze = records => analyzeRoasCase(records, linkedProfile, {asOf: linkedProfile.default_as_of});

test('approved scenario regenerates exactly, without modifying the installed dataset', () => {
  const generated = generateRoasRecords();
  assert.equal(generated.length, 3470);
  assert.deepEqual(generated.toSorted((a, b) => a.record_id.localeCompare(b.record_id)),
    linkedRecords.filter(row => row.dataset_type !== 'T01').toSorted((a, b) => a.record_id.localeCompare(b.record_id)));
  const converted = applyDemoOrderFlow(catalog.records);
  assert.deepEqual(converted.filter(row => row.scenario_id === spec.scenario_id), linkedRecords.filter(row => row.dataset_type !== 'T01'));
  const provenance = new Map(fs.readFileSync(new URL('../data/provenance.jsonl', import.meta.url), 'utf8').trim().split(/\r?\n/).map(line => {const row = JSON.parse(line); return [row.active_id, row];}));
  const archived = new Map();
  const original = catalog.records.map(row => {
    if (!['T18', 'T19', 'T20', 'T23', 'T30'].includes(row.dataset_type)) return row;
    const source = provenance.get(row.record_id);
    if (!archived.has(source.archive)) archived.set(source.archive, new Map(fs.readFileSync(new URL('../data/' + source.archive, import.meta.url), 'utf8').trim().split(/\r?\n/).map(line => {const item = JSON.parse(line); return [item.record_id, item];})));
    return archived.get(source.archive).get(row.record_id);
  });
  assert.deepEqual(applyDemoOrderFlow(original), catalog.records);
});

test('linked case separates reported ROAS, net product ROAS and both conversion denominators', () => {
  const report = analyze(linkedRecords);
  assert.equal(report.status, 'review_ready');
  assert.deepEqual(report.gaps, []);
  assert.deepEqual(report.periods.map(period => [period.total.spend, period.total.reportedRevenue, period.total.netProductRevenue]),
    [['468780.00', '1553000.00', '1470000.00'], ['521040.00', '756000.00', '684500.00']]);
  assert.deepEqual(report.periods.map(period => period.channels.reduce((sum, channel) => sum + channel.purchaseCohort.orders, 0)), [84, 42]);
  for (const period of report.periods) for (const channel of period.channels) {
    assert.notEqual(channel.reported.clickPurchaseRate, channel.purchaseCohort.sessionPurchaseRate);
    assert(channel.purchaseCohort.sessionPurchaseRate <= 1);
    assert.equal(channel.purchaseCohort.funnel.purchase, channel.purchaseCohort.orders);
  }
  assert.equal(report.actionDrafts.length, 2);
  for (const [key, bridge] of Object.entries(report.roasBridge)) {
    const metric = key === 'net' ? 'netRoas' : 'reportedRoas';
    assert(Math.abs(bridge.withinChannelChange + bridge.spendMixChange - (report.periods[1].total[metric] - report.periods[0].total[metric])) < 1e-12);
  }
  assert.equal(report.reviewPriority[0].channel, 'social');
  assert(report.budgetReview.every(row => row.amount === null && row.changeRatio === null));
});

test('return aliases and pending requests cannot reduce net revenue twice', () => {
  const result = analyze(linkedRecords);
  const removed = new Set(linkedRecords.filter(row => row.dataset_type === 'T20' && (row.adjustment_kind === 'return' || row.status === 'pending')).map(row => row.record_id));
  const withoutNonfinancial = linkedRecords.filter(row => !removed.has(row.record_id));
  assert.deepEqual(analyze(withoutNonfinancial).periods.map(period => period.total), result.periods.map(period => period.total));
  const partials = linkedRecords.filter(row => row.dataset_type === 'T20' && row.adjustment_kind === 'refund' && row.order_line_ref === 'R001-Line-3');
  assert.equal(partials.length, 2);
  const omitted = new Set([partials[0].record_id]);
  const withoutOnePartial = linkedRecords.filter(row => !omitted.has(row.record_id) && !(row.related_record_ids || []).some(id => omitted.has(id)));
  const difference = Number(analyze(withoutOnePartial).periods[0].total.netProductRevenue) - Number(result.periods[0].total.netProductRevenue);
  assert.equal(difference, Number(partials[0].refund_amount.amount));
});

test('a refund processed after the comparison period revises its original purchase cohort only after cutoff', () => {
  const early = analyzeRoasCase(linkedRecords, linkedProfile, {asOf: '2026-08-31T00:00:00+09:00'});
  const final = analyze(linkedRecords);
  assert.deepEqual(early.periods[0].total, final.periods[0].total);
  assert(Number(early.periods[1].total.netProductRevenue) > Number(final.periods[1].total.netProductRevenue));
  assert.deepEqual(early.periods.map(period => period.total.reportedRevenue), final.periods.map(period => period.total.reportedRevenue));
});

test('missing purchase and broken financial references fail instead of claiming a complete analysis', () => {
  const purchase = linkedRecords.find(row => row.dataset_type === 'T18' && row.event_name === 'purchase');
  assert.throws(() => analyze(linkedRecords.filter(row => row.record_id !== purchase.record_id)), /order_purchase_relation_invalid/);
  const view = linkedRecords.find(row => row.dataset_type === 'T18' && row.event_name === 'view_item');
  assert.throws(() => analyze(linkedRecords.filter(row => row.record_id !== view.record_id)), /funnel_sequence_invalid/);
  const representative = linkedRecords.find(row => row.dataset_type === 'T20' && row.adjustment_kind === 'return').related_record_ids.at(-1);
  assert.throws(() => analyze(linkedRecords.filter(row => row.record_id !== representative)), /reference_outside_case/);
  assert.throws(() => analyzeRoasCase(linkedRecords, {...linkedProfile, currency: 'USD'}, {asOf}), /currency_or_amount_missing/);
});
