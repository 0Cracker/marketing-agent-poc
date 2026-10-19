// Import a pinned, validated read view. Never invoke a generator or edit the source checkout.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const repository=path.resolve(process.argv[2]||(fs.existsSync('docs/research/marketing-ontology/batches/D007/catalog.mjs')?'.':'../marketing-agent-poc'));
const base='docs/research/marketing-ontology/batches/D007';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=file=>fs.readFileSync(path.join(repository,file));
const manifest=JSON.parse(read(base+'/manifest.json'));
const before=new Map();
function pin(file){const bytes=read(file);before.set(file,hash(bytes));return bytes;}
for(const [file,info] of Object.entries(manifest.files)){
 const bytes=pin(file.startsWith('docs/')?file:base+'/source/'+file);
 assert.equal(hash(bytes),typeof info==='string'?info:info.sha256,file);
}
for(const file of [base+'/manifest.json',base+'/catalog.mjs',base+'/result.json',base+'/definitions.json','docs/research/marketing-ontology/schemas/marketing-records.schema.json'])pin(file);
assert.equal(JSON.parse(read(base+'/result.json')).status,'pass');
const {loadCatalog,select}=await import(pathToFileURL(path.join(repository,base,'catalog.mjs')).href);
const catalog=loadCatalog();
const selected=select(catalog,{batch:'D007',scenario:'D007-expansion'});
assert.equal(selected.length,20000);
assert(selected.every(x=>x.schema_conforming&&x.contract_gaps.length===0));
const products=JSON.parse(fs.readFileSync('docs/research/marketing-ontology/batches/D003B/source/T01.jsonl','utf8').trim().split('\n').map(line=>JSON.stringify(JSON.parse(line))).join(',').replace(/^/,'[').replace(/$/,']'));
const inventory=[...new Set(catalog.map(x=>x.batch))].map(batch=>{const rows=catalog.filter(x=>x.batch===batch);return {batch,rows:rows.length,conforming:rows.filter(x=>x.schema_conforming).length,types:[...new Set(rows.map(x=>x.record.dataset_type))].sort()};});
const records=selected.map(x=>x.record);
const payload=JSON.stringify({batch:'D007',scenario:'D007-expansion',records,products,definitions:JSON.parse(read(base+'/definitions.json'))});
const schema=read('docs/research/marketing-ontology/schemas/marketing-records.schema.json');
assert.equal(hash(schema),before.get('docs/research/marketing-ontology/schemas/marketing-records.schema.json'));
for(const [file,sha] of before)assert.equal(hash(read(file)),sha,'Source changed while importing: '+file);
const destination='frontend/public/workbench-data/D007';
fs.mkdirSync(destination,{recursive:true});
fs.writeFileSync(destination+'/catalog.json',payload,{flag:'wx'});
fs.writeFileSync(destination+'/schema.json',schema,{flag:'wx'});
const lock={screen_contract:'workbench-model/1',batch:'D007',scenario:'D007-expansion',source_created_at:manifest.created_at,imported_at:new Date().toISOString(),rows:records.length,counts:manifest.counts,sha256:hash(payload),source_sha256:Object.fromEntries(before),inventory,policy:'Explicit batch and country scope; no legacy sample merging; only schema-conforming D007 records; no invented values'};
fs.writeFileSync(destination+'/lock.json',JSON.stringify(lock,null,2)+'\n',{flag:'wx'});
fs.writeFileSync('docs/design/data-separation-validation/catalog-audit.json',JSON.stringify(lock,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pass:true,inventory,selected:records.length,bytes:Buffer.byteLength(payload)}));
