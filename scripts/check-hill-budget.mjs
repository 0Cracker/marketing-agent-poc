import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {loadCurrentData} from '../../marketing-dashboard-drafts/scripts/current-data.mjs';
import {CatalogTools} from '../backend/agent-tools.mjs';
const oi=process.argv.indexOf('--output');assert(oi>=0&&process.argv[oi+1],'--output NEW_DIRECTORY required');
const output=path.resolve(process.argv[oi+1]);assert(!fs.existsSync(output),'Evidence must not be overwritten');fs.mkdirSync(output,{recursive:true});
const {manifest,catalog}=loadCurrentData(),tools=new CatalogTools(catalog.records.map(record=>({batch:'CURRENT',country:record.dataset_type==='T01'?'GLOBAL':record.scope_id.split('-')[1],record,payload:record,schema_conforming:true})),{manifest});
const results=[];
for(const country of ['KR','JP','US']){
 const scope={batch:'CURRENT',country,scopeId:'CURRENT-'+country,productIds:['P1A','P1B','P2A','P2B','P3A','P3B'],start:'2026-08-01',end:'2026-09-01',asOf:manifest.source_created_at,dataHash:manifest.data_sha256};
 const inputs=tools.call('budget_inputs',{},scope);
 for(const candidate of inputs.scenarios){
  const simulation=tools.call('simulate',{baselineId:inputs.scenarios[0].record_id,candidateId:candidate.record_id,modelId:inputs.models[0].record_id,policyId:inputs.policies[0].record_id},scope);
  const file=path.join(output,candidate.record_id+'.json');fs.writeFileSync(file,JSON.stringify(simulation,null,2)+'\n');
  const checked=spawnSync(process.env.PYTHON||'python',[path.join(import.meta.dirname,'check-current-live-budget.py'),file,path.resolve(import.meta.dirname,'../../marketing-dashboard-drafts/data/budget-models.jsonl')],{encoding:'utf8'});
  assert.equal(checked.status,0,checked.stdout+checked.stderr);assert.equal(Number(simulation.candidate.expected),candidate.expected_measures.find(m=>m.metric_id.endsWith('.expected_conversions')).value);
  results.push({country,candidate:candidate.record_id,...JSON.parse(checked.stdout)});
 }
}
const report={pass:true,dataHash:manifest.data_sha256,at:new Date().toISOString(),independentOracle:'Python Decimal precision=60 ROUND_HALF_UP',cases:results.length,results};
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:true,cases:results.length,dataHash:manifest.data_sha256}));
