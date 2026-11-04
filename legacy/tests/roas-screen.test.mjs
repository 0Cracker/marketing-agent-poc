import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadCurrentData,roasScreenData,currentDataPlugin,sha256} from '../scripts/current-data.mjs';

test('screen projection uses the approved scenario and the same verified calculation',()=>{
 const before=sha256(fs.readFileSync(new URL('../data/manifest.json',import.meta.url)));
 const screen=roasScreenData(),{manifest}=loadCurrentData();
 assert.equal(screen.dataHash,manifest.data_sha256);
 assert.equal(screen.status,'review_ready');
 assert.equal(screen.records.length,3476);
 assert(screen.records.every(row=>row.dataset_type==='T01'||row.scenario_id==='R001-roas-decline'));
 assert.equal(screen.daily.length,56);
 for(const day of screen.daily){const source=screen.records.find(row=>row.record_id===day.recordId);assert.equal(day.roas,Number(source.metrics.attributed_value.amount)/Number(source.metrics.spend.amount));}
 assert(screen.markdown.includes('313.6%'));
 assert(screen.markdown.includes('131.4%'));
 assert.equal(sha256(fs.readFileSync(new URL('../data/manifest.json',import.meta.url))),before);
});

test('development endpoint serves the derived screen without opening archived data',()=>{
 let middleware;currentDataPlugin().configureServer({middlewares:{use:fn=>middleware=fn}});
 const response={setHeader(){},end(bytes){this.body=bytes;}};
 middleware({url:'/workbench-data/current/roas-analysis.json'},response,()=>assert.fail('Missing ROAS endpoint'));
 const payload=JSON.parse(response.body);
 assert.equal(payload.scenarioId,'R001-roas-decline');
 assert.equal(payload.records.filter(row=>row.dataset_type==='T20').length,16);
 const blocked={setHeader(){},end(){}};
 middleware({url:'/workbench-data/current/archive/source-inventory.json'},blocked,()=>assert.fail('Archive path escaped validation'));
 assert.equal(blocked.statusCode,404);
});


test('installed diverse cases serve isolated screen projections and registered production asset names',()=>{
 const {catalog,manifest}=loadCurrentData();
 let middleware;currentDataPlugin().configureServer({middlewares:{use:fn=>middleware=fn}});
 for(const id of ['R002-cost-change','R003-order-value','R004-adjustment-change']){
  const screen=roasScreenData(undefined,id),profile=catalog.definitions.scenario_profiles.find(row=>row.scenario_id===id);
  assert.equal(screen.scenarioId,id);assert.equal(screen.purchaseTiming,'within_window');
  assert.equal(screen.status,'review_ready');assert.equal(screen.dataHash,manifest.data_sha256);
  assert.equal(screen.records.filter(row=>row.dataset_type!=='T01').length,Object.values(profile.counts).reduce((a,b)=>a+b,0));
  assert.ok(screen.records.every(row=>row.dataset_type==='T01'||row.scenario_id===id));
  assert.equal(screen.actionDrafts.length,0);
  assert.ok(screen.periods.some(period=>period.channels.some(row=>row.purchaseCohort.returnPurchases>0)));
  const response={setHeader(){},end(bytes){this.body=bytes;}};
  middleware({url:'/workbench-data/current/roas-analysis-'+id+'.json'},response,()=>assert.fail('Missing diverse case endpoint'));
  assert.equal(JSON.parse(response.body).scenarioId,id);
 }
 const missing={setHeader(){},end(){}};
 middleware({url:'/workbench-data/current/roas-analysis-unapproved.json'},missing,()=>assert.fail('Unexpected escape'));
 assert.equal(missing.statusCode,404);
});
