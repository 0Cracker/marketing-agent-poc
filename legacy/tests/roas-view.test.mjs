import test from 'node:test';
import assert from 'node:assert/strict';
import {roasScreenData, loadCurrentData} from '../scripts/current-data.mjs';
import {analyzeRoasCase} from '../backend/roas-case.mjs';
import {selectRoasEvidence} from '../shared/roas-view.mjs';

const report = roasScreenData();
const types = ['T13', 'T17', 'T18', 'T19', 'T20'];

test('source selection isolates each channel across both comparison periods', () => {
  const selections = ['search', 'social'].map(channel => selectRoasEvidence(report.records, report, {channel, types}));
  for (const [index, rows] of selections.entries()) {
    const channel = ['search', 'social'][index];
    const campaignId = report.periods[0].channels.find(row => row.channel === channel).campaignId;
    const byId = new Map(report.records.map(row => [row.record_id, row]));
    for (const row of rows) {
      if (row.dataset_type === 'T13' || row.dataset_type === 'T18') assert.equal(row.campaign_ref, campaignId);
      if (row.dataset_type === 'T17') assert.equal(row.utm_campaign, campaignId);
      if (row.dataset_type === 'T19') assert.equal(byId.get(row.acquisition_ref).utm_campaign, campaignId);
      if (row.dataset_type === 'T20') {
        const order = byId.get(row.related_record_ids.find(id => byId.get(id)?.dataset_type === 'T19'));
        assert.equal(byId.get(order.acquisition_ref).utm_campaign, campaignId);
      }
    }
    assert.equal(rows.filter(row => row.dataset_type === 'T13').length, 28);
    assert.equal(rows.filter(row => row.dataset_type === 'T19').length, channel === 'search' ? 70 : 56);
  }
  const all = selectRoasEvidence(report.records, report, {types});
  assert.equal(all.length, selections[0].length + selections[1].length);
  assert.deepEqual(new Set(all.map(row => row.record_id)), new Set(selections.flat().map(row => row.record_id)));
  assert.equal(selectRoasEvidence(report.records, report, {channel: 'unknown', types}).length, 0);
});

test('refund evidence uses the original order cohort and the analysis cutoff', () => {
  const {catalog} = loadCurrentData();
  const profile = catalog.definitions.scenario_profiles.find(row => row.scenario_id === report.scenarioId);
  const early = analyzeRoasCase(report.records, profile, {asOf: '2026-08-31T00:00:00+09:00'});
  const finalRows = selectRoasEvidence(report.records, report, {channel: 'search', types: ['T20']});
  const earlyRows = selectRoasEvidence(report.records, early, {channel: 'search', types: ['T20']});
  assert(finalRows.some(row => row.processed_at?.slice(0, 10) >= profile.observed.end));
  assert(earlyRows.length < finalRows.length);
  assert(earlyRows.every(row => Date.parse(row.processed_at || row.requested_at) <= Date.parse(early.asOf)));
  const originalOrders = new Set(report.periods.flatMap(period => period.channels.find(row => row.channel === 'search').evidence.orderRecordIds));
  assert(finalRows.every(row => row.related_record_ids.some(id => originalOrders.has(id))));
});

test('all-channel evidence still follows only the two selected periods', () => {
  const {catalog} = loadCurrentData();
  const profile = catalog.definitions.scenario_profiles.find(row => row.scenario_id === report.scenarioId);
  const narrowed = analyzeRoasCase(report.records, {...profile,
    baseline: {start: '2026-08-03', end: '2026-08-10'},
    observed: {start: '2026-08-17', end: '2026-08-24'}
  }, {asOf: report.asOf});
  const rows = selectRoasEvidence(report.records, narrowed, {types});
  assert(rows.length < selectRoasEvidence(report.records, report, {types}).length);
  const inPeriod = time => narrowed.periods.some(({period}) => time.slice(0, 10) >= period.start && time.slice(0, 10) < period.end);
  for (const row of rows) {
    if (row.dataset_type === 'T13') assert(inPeriod(row.period.start));
    if (['T17', 'T18'].includes(row.dataset_type)) assert(inPeriod(row.event_time));
    if (row.dataset_type === 'T19') assert(inPeriod(row.ordered_at));
  }
  assert.equal(rows.filter(row => row.dataset_type === 'T13').length, 28);
  assert.equal(new Set(rows.filter(row => row.dataset_type === 'T13').map(row => row.campaign_ref)).size, 2);
});

test('explicit feedback evidence preserves its links without inheriting a performance filter', () => {
  const item = report.evidence.find(row => row.relatedRecordIds.length > 0);
  const source = report.records.find(row => row.record_id === item.recordId);
  const rows = selectRoasEvidence(report.records, report, {channel: 'unknown', ids: [item.recordId]});
  assert.deepEqual(new Set(rows.map(row => row.record_id)), new Set([source.record_id, ...source.related_record_ids]));
  assert.deepEqual(selectRoasEvidence(report.records, report), []);
});


test('human source browsing filters event periods and kinds, keeps late adjustments and sorts without mutating source',async()=>{
 const {filterRoasEvidence,roasEvidenceTime}=await import('../shared/roas-view.mjs');
 const {roasScreenData}=await import('../scripts/current-data.mjs');
 const report=roasScreenData();const original=report.records.map(row=>row.record_id);
 const all=filterRoasEvidence(report.records,report.periods);
 assert.deepEqual(report.records.map(row=>row.record_id),original);
 assert.ok(all.every((row,i)=>i===0||roasEvidenceTime(all[i-1])>=roasEvidenceTime(row)));
 const before=filterRoasEvidence(report.records,report.periods,{period:'0',type:'T19'});
 assert.equal(before.length,84);assert.ok(before.every(row=>row.dataset_type==='T19'));
 const after=filterRoasEvidence(report.records,report.periods,{period:'1',type:'T19',sort:'asc'});
 assert.equal(after.length,42);assert.ok(after.every((row,i)=>i===0||roasEvidenceTime(after[i-1])<=roasEvidenceTime(row)));
 assert.equal(filterRoasEvidence(report.records,report.periods,{query:after[0].record_id,type:'T19'}).length,1);
 const outside=filterRoasEvidence(report.records,report.periods,{period:'-1',type:'T20'});
 assert.ok(outside.every(row=>roasEvidenceTime(row).slice(0,10)>=report.periods[1].period.end||roasEvidenceTime(row).slice(0,10)<report.periods[0].period.start));
});
