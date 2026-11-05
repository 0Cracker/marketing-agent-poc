import test from 'node:test';
import assert from 'node:assert/strict';
import {roasScreenData} from '../scripts/current-data.mjs';
import {stageDiagnosis} from '../shared/roas-diagnosis.mjs';
import {dashboardSeries} from '../shared/roas-dashboard.mjs';

test('dashboard daily device and channel curves reconcile with filtered KPI revenue for all installed cases',()=>{
 for(const id of ['R001-roas-decline','R002-cost-change','R003-order-value','R004-adjustment-change']){
  const report=roasScreenData(undefined,id);
  for(const channel of ['search','social'])for(const device of ['all','mobile','desktop']){
   const chart=dashboardSeries(report.records,report,channel,device);
   assert.equal(chart.length,28);assert.ok(chart.every(row=>!Object.hasOwn(row,channel==='social'?'search':'social')));
   for(const [index,{period,channels}] of report.periods.entries()){
    const totals=stageDiagnosis(report.records,report,channel,device)[index?'after':'before'];
    const revenue=chart.filter(row=>row.date>=period.start&&row.date<period.end).reduce((sum,row)=>{
     const adId=channels.find(row=>row.channel===channel).evidence.adRecordIds.find(ref=>report.records.find(source=>source.record_id===ref).period.start===row.date);
     const ad=report.records.find(source=>device==='all'?source.record_id===adId:source.dataset_type==='T14'&&source.parent_report_ref===adId&&source.breakdown_dimensions[0].value===device);
     assert.equal(typeof row[channel],'number');
     return sum+row[channel]/100*Number(ad.metrics.spend.amount);
    },0);
    assert.ok(Math.abs(revenue-(totals.refund.revenueBeforeAdjustments-totals.refund.adjustments))<0.00001,id+'/'+channel+'/'+device);
   }
  }
 }
});
