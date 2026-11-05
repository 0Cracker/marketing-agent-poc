import test from 'node:test';
import assert from 'node:assert/strict';
import {trainingIndex,trainingScreenData} from '../scripts/training-data.mjs';
import type {TrainingData} from '../shared/training-dashboard.mjs';
import {changeRecordValue,metricChangeRecords,recordReadingHint} from '../frontend/workbench/training-investigation.ts';

const all={channel:'all',source:'all',campaignId:'all',device:'all'};
test('CTR changes show current targeting and creative changes, not initial settings or product discounts',()=>{
 const data=trainingScreenData(undefined,'S16'),records=metricChangeRecords(data,all,'adCtr');
 assert.equal(records.length,5);
 assert(records.some(row=>row.category==='creative'&&row.date==='2026-08-24'));
 assert(records.every(row=>!row.productId&&!['campaign','inventory','incident'].includes(row.category)));
 assert(records.every(row=>row.date>='2026-08-17'));
 const timestamp=records.find(row=>typeof row.values.적용시각==='string')!.values.적용시각;
 assert.match(changeRecordValue(timestamp),/2026.*08.*17.*00:00/);assert(!changeRecordValue(timestamp).includes('T00'));
 const cvr=metricChangeRecords(data,all,'cvr');
 assert(cvr.some(row=>row.category==='incident'&&row.device==='mobile'));
 assert(cvr.some(row=>row.values.항목==='할인율'));
 const aov=metricChangeRecords(data,all,'aov');
 assert(aov.some(row=>row.values.항목==='할인율'));assert(!aov.some(row=>row.category==='incident'));
});

test('all existing cases keep change records scoped and unmodified with a concrete reading hint',()=>{
 for(const item of trainingIndex().cases)for(const snapshot of ['initial','mature']){
  const data:TrainingData=trainingScreenData(undefined,item.id,snapshot),original=JSON.stringify(data);
  for(const metric of ['roas','adCtr','cpc','cvr','cpa','aov','cac']){
   for(const filters of [all,{...all,campaignId:'EDU-C1',device:'mobile'}]){
    const records=metricChangeRecords(data,filters,metric),period=data.periods.find(p=>p.id==='current')!;
    for(const row of records){
     assert(data.records.includes(row));assert(row.date<period.end);
     if(filters.campaignId!=='all')assert(!row.campaignId||row.campaignId===filters.campaignId);
     if(filters.device!=='all')assert(['all',filters.device].includes(row.device));
     assert(recordReadingHint(row).length>10);
    }
   }
  }
  assert.equal(JSON.stringify(data),original);
 }
});
