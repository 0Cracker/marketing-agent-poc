import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCurrentData, roasScreenData} from '../scripts/current-data.mjs';
import {analyzeRoasCase} from '../backend/roas-case.mjs';

const {catalog, manifest} = loadCurrentData();
const profile = catalog.definitions.scenario_profiles.find(row => row.scenario_id === 'R001-roas-decline');
const screen = roasScreenData();
const byId = new Map(screen.records.map(row => [row.record_id, row]));
const close = (actual, expected) => assert(Math.abs(actual - expected) < 1e-7, `${actual} differs from ${expected}`);

test('daily net revenue reconciles with every period and channel, with original reported ROAS preserved', () => {
  const report = analyzeRoasCase(screen.records, profile, {asOf: profile.default_as_of});
  assert.deepEqual(screen.daily, report.dailyTrend);
  assert.equal(screen.daily.length, 56);
  for (const day of screen.daily) {
    const source = byId.get(day.recordId);
    assert.equal(day.date, source.period.start);
    assert.equal(day.roas, Number(source.metrics.attributed_value.amount) / Number(source.metrics.spend.amount));
    assert(Number.isFinite(day.netRoas));
  }
  for (const {period, channels} of report.periods) for (const channel of channels) {
    const days = screen.daily.filter(day => day.channel === channel.channel && day.date >= period.start && day.date < period.end);
    assert.equal(days.length, 14);
    close(days.reduce((sum, day) => sum + day.netRoas * Number(byId.get(day.recordId).metrics.spend.amount), 0),
      Number(channel.purchaseCohort.netProductRevenue));
    close(days.reduce((sum, day) => sum + day.roas * Number(byId.get(day.recordId).metrics.spend.amount), 0),
      Number(channel.reported.attributedRevenue));
  }
});

test('refund cutoff changes only the original acquisition days, by the confirmed financial amounts', () => {
  const earlyAsOf = '2026-08-31T00:00:00+09:00';
  const early = analyzeRoasCase(screen.records, profile, {asOf: earlyAsOf});
  const expected = new Map();
  const lateRefunds = screen.records.filter(row => row.dataset_type === 'T20' && row.status === 'completed' &&
    ['cancel', 'refund'].includes(row.adjustment_kind) && Date.parse(row.processed_at) > Date.parse(earlyAsOf) &&
    Date.parse(row.processed_at) <= Date.parse(screen.asOf) &&
    !row.related_record_ids.some(id => byId.get(id)?.dataset_type === 'T20'));
  assert(lateRefunds.length > 0);
  for (const refund of lateRefunds) {
    const order = screen.records.find(row => row.dataset_type === 'T19' && row.line_id === refund.order_line_ref);
    const visit = byId.get(order.acquisition_ref);
    const ad = screen.records.find(row => row.dataset_type === 'T13' && row.campaign_ref === visit.utm_campaign && row.period.start === visit.event_time.slice(0, 10));
    expected.set(ad.record_id, (expected.get(ad.record_id) || 0) + Number(refund.refund_amount.amount));
    assert.notEqual(ad.period.start, refund.processed_at.slice(0, 10));
  }
  const changed = new Set();
  for (const day of screen.daily) {
    const prior = early.dailyTrend.find(row => row.recordId === day.recordId);
    assert.equal(prior.roas, day.roas);
    const revenueDifference = (prior.netRoas - day.netRoas) * Number(byId.get(day.recordId).metrics.spend.amount);
    close(revenueDifference, expected.get(day.recordId) || 0);
    if (Math.abs(revenueDifference) > 1e-7) changed.add(day.recordId);
  }
  assert.deepEqual(changed, new Set(expected.keys()));
});

test('incomplete existing scenario leaves daily net ROAS unavailable', () => {
  const report = analyzeRoasCase(catalog.records, {
    scenario_id: 'D008-comparison-demo', product_id: 'P1A', currency: 'KRW', scope_ids: {KR: manifest.scope_ids.KR},
    baseline: {start: '2026-08-03', end: '2026-08-17'}, observed: {start: '2026-08-17', end: '2026-08-31'}
  }, {asOf: '2026-10-21T00:00:00+09:00'});
  assert.equal(report.status, 'partial');
  assert(report.dailyTrend.length > 0);
  assert(report.dailyTrend.every(day => day.netRoas === null));
});
