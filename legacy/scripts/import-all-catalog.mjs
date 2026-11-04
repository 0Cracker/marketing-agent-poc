// Preserve every source row, including contract gaps; never run a generator.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..');
const dir='docs/research/marketing-ontology/batches';
const digest=b=>createHash('sha256').update(b).digest('hex');
const hashes={};let physical=0;
for(const batch of fs.readdirSync(path.join(root,dir))){
 const source=path.join(root,dir,batch,'source');if(!fs.existsSync(source))continue;
 for(const file of fs.readdirSync(source).filter(f=>f.endsWith('.jsonl'))){const p=path.join(dir,batch,'source',file).replaceAll('\\','/');const bytes=fs.readFileSync(path.join(root,p));hashes[p]=digest(bytes);physical+=bytes.toString().trim().split(/\r?\n/).filter(Boolean).length;}
}
const {loadCatalog}=await import(pathToFileURL(path.join(root,dir,'D007/catalog.mjs')));
const entries=loadCatalog();assert.equal(entries.length,physical,'Every physical JSONL row must enter the dashboard');
const target='frontend/public/workbench-data/connected';fs.mkdirSync(target,{recursive:true});
const batches=[];
for(const batch of [...new Set(entries.map(e=>e.batch))]){
 const selected=entries.filter(e=>e.batch===batch);
 if(batch==='D007'){
  const pinned=JSON.parse(fs.readFileSync('frontend/public/workbench-data/D007/catalog.json'));
  assert.deepEqual(pinned.records,selected.map(e=>e.record),'Pinned D007 must equal latest source');
  batches.push({id:batch,rows:selected.length,conforming:selected.length,url:'/workbench-data/D007/catalog.json',sha256:digest(fs.readFileSync('frontend/public/workbench-data/D007/catalog.json'))});
 }else{
  const payload=JSON.stringify(selected);fs.writeFileSync(`${target}/${batch}.json`,payload,{flag:'wx'});
  batches.push({id:batch,rows:selected.length,conforming:selected.filter(e=>e.schema_conforming).length,url:`/workbench-data/connected/${batch}.json`,sha256:digest(payload)});
 }
}
for(const [p,hash]of Object.entries(hashes))assert.equal(digest(fs.readFileSync(path.join(root,p))),hash,p);
const manifest={created_at:new Date().toISOString(),rows:entries.length,physical_source_rows:physical,source_files:Object.keys(hashes).length,source_sha256:hashes,batches};
fs.writeFileSync(target+'/index.json',JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pass:true,rows:physical,files:manifest.source_files,batches}));
