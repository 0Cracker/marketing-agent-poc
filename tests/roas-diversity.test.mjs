import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {generateDiverseCases} from '../scripts/augment-roas-diversity.mjs';

const expected=['R002-cost-change','R003-order-value','R004-adjustment-change'];
const generated=generateDiverseCases();
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('approved diversity generation is deterministic, isolated and within the total observation budget',()=>{
 assert.equal(digest(generateDiverseCases()),digest(generated));
 assert(generated.records.length>0&&generated.records.length<=12000);
 assert.deepEqual(generated.profiles.map(profile=>profile.scenario_id).sort(),expected);
 assert.equal(new Set(generated.records.map(row=>row.record_id)).size,generated.records.length);
 const byId=new Map(generated.records.map(row=>[row.record_id,row]));
 for(const profile of generated.profiles){
  const records=generated.records.filter(row=>row.scenario_id===profile.scenario_id);
  const counts={};
  for(const row of records){
   counts[row.dataset_type]=(counts[row.dataset_type]||0)+1;
   assert(profile.scope_ids.KR.includes(row.scope_id));
   assert.equal(row.is_synthetic,true);assert.equal(row.value_origin,'simulation');
   assert.equal(row.quality.is_partial,true);
   for(const reference of row.related_record_ids||[]){
    assert(byId.has(reference),reference);
    assert.equal(byId.get(reference).scenario_id,row.scenario_id);
   }
  }
  assert.deepEqual(counts,profile.counts);
  assert(!records.some(row=>row.record_id.startsWith('R001-')));
 }
});

test('generated observations pass independent Decimal, event-order and numeric-contrast checks',()=>{
 const bundled='C:/Users/박시형/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
 const python=process.env.ROAS_PYTHON||(fs.existsSync(bundled)?bundled:'python');
 const checked=spawnSync(python,['-X','utf8','scripts/check-roas-diversity.py','--input','-'],{input:JSON.stringify(generated),encoding:'utf8',maxBuffer:10*1024*1024});
 assert.equal(checked.status,0,checked.stderr||checked.error?.message||checked.stdout);
 const result=JSON.parse(checked.stdout);
 assert.equal(result.pass,true);
 assert.equal(result.newRows,generated.records.length);
 assert.match(result.limitation,/do not establish real-world causes/);
 for(const scenario of expected){
  assert(result.cases[scenario].uniqueFeedback>1);
  assert(result.cases[scenario].purchaseDelays>=3);
  assert(result.cases[scenario].financialEdges.aliases>0);
 }
});


test('paid-cohort device evidence retains same-session events across the comparison end midnight',async()=>{
 const {analyzeRoasCase}=await import('../backend/roas-case.mjs');
 const {loadCurrentData}=await import('../scripts/current-data.mjs');
 const {deviceEvidence,deviceFunnels}=await import('../shared/roas-diagnosis.mjs');
 const {catalog}=loadCurrentData();
 for(const profile of generated.profiles){
  const report=analyzeRoasCase([...catalog.records.filter(row=>!expected.includes(row.scenario_id)),...generated.records],profile,{asOf:profile.default_as_of});
  const records=generated.records.filter(row=>row.scenario_id===profile.scenario_id),byId=new Map(records.map(row=>[row.record_id,row]));
  for(const channel of ['search','social'])for(const device of ['mobile','desktop']){
   const evidence=deviceEvidence(records,report,channel,device),ids=new Set(evidence.map(row=>row.record_id));
   const visits=records.filter(row=>row.dataset_type==='T17'&&row.traffic_medium==='paid'&&row.utm_campaign.endsWith(channel)&&row.device===device);
   const sessions=new Set(visits.map(row=>row.session_ref));
   for(const event of records.filter(row=>row.dataset_type==='T18'&&row.event_name!=='refund'&&sessions.has(row.session_ref)))assert.ok(ids.has(event.record_id));
   const funnels=deviceFunnels(records,report,channel).find(row=>row.device===device);
   const orders=evidence.filter(row=>row.dataset_type==='T19');
   assert.equal(orders.length,funnels.before.purchase+funnels.after.purchase+funnels.before.returnPurchases+funnels.after.returnPurchases);
   for(const order of orders)assert.equal(byId.get(order.acquisition_ref).device,device);
  }
 }
});
