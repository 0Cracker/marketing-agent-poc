import fs from 'node:fs';
import assert from 'node:assert/strict';
import {loadCurrentData,sha256} from './current-data.mjs';
import {applyDemoOrderFlow} from './demo-order-flow.mjs';
const {catalog,manifest}=loadCurrentData();
const read=file=>fs.readFileSync('data/'+file,'utf8').trim().split(/\r?\n/).map(JSON.parse);
const provenance=read('provenance.jsonl'),migration=read('migration-map.jsonl'),archives=new Map();
const baseline=catalog.records.map(r=>{
 if(!['T19','T20','T23','T30'].includes(r.dataset_type))return r;
 const p=provenance.find(p=>p.active_id===r.record_id);
 if(!archives.has(p.archive))archives.set(p.archive,new Map(read(p.archive).map(r=>[r.record_id,r])));
 const original=archives.get(p.archive).get(r.record_id);assert(original);return original;
});
const projected=applyDemoOrderFlow(baseline),updates=new Map(projected.filter((r,i)=>JSON.stringify(r)!==JSON.stringify(baseline[i])).map(r=>[r.record_id,r]));
const write=(file,rows)=>fs.writeFileSync('data/'+file,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
for(const f of manifest.files.filter(f=>['T19','T20','T23','T30'].includes(f.type))){
 const rows=projected.filter(r=>r.dataset_type===f.type);write(f.file,rows);
 const bytes=fs.readFileSync('data/'+f.file);Object.assign(f,{rows:rows.length,bytes:bytes.length,sha256:sha256(bytes)});
}
for(const rows of [provenance,migration])for(const p of rows){const r=updates.get(p.active_id);if(r){p.record_sha256=sha256(JSON.stringify(r));p.transformation='2026-10-20 user-requested country/product daily order variation; Japan collapsed dates restored with dependent refund/fulfilment dates shifted; cohort net revenue reconciled; archived original preserved; scripts/demo-order-flow.mjs';}}
write('provenance.jsonl',provenance);write('migration-map.jsonl',migration);
manifest.data_sha256=sha256(JSON.stringify({contract:manifest.contract,screen_contract:manifest.screen_contract,schema_sha256:manifest.schema_sha256,source_created_at:manifest.source_created_at,scope_ids:manifest.scope_ids,period:manifest.period,files:manifest.files.map(({file,sha256})=>({file,sha256})),metadata:manifest.metadata}));
fs.writeFileSync('data/manifest.json',JSON.stringify(manifest,null,2)+'\n');
loadCurrentData();console.log(JSON.stringify({pass:true,changedByType:Object.fromEntries(['T19','T20','T23','T30'].map(t=>[t,[...updates.values()].filter(r=>r.dataset_type===t).length])),hash:manifest.data_sha256}));
