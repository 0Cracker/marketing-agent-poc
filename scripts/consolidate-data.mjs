// Reuse existing observations without changing any business field or source ID.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {businessKey,businessKeys} from './data-business-keys.mjs';
const root=path.resolve(import.meta.dirname,'..'),sibling=path.resolve(root,'../marketing-agent-poc');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const jsonl=rs=>rs.map(r=>JSON.stringify(r)).join('\n')+'\n';
const output=path.join(root,'data');
const names=['products','identity-mappings','market-sales','purchase-surveys','search-interest','keyword-demand','organic-search','prices','promotions','public-ads','publications','campaigns','ad-performance','ad-breakdowns','auction-insights','creatives','web-events','commerce-events','order-lines','refunds','costs','inventory','distribution-fulfilment','reviews','review-annotations','customer-inquiries','owned-content','social-comments','creator-collaborations','customer-cohorts','crm-performance','brand-surveys','public-statistics','weather-calendar','change-events','collection-runs','site-events','experiments','budget-models','budget-policies'];
const mapping=Object.fromEntries(names.map((name,i)=>['T'+String(i+1).padStart(2,'0'),name+'.jsonl']));mapping.H01='sales-reports.jsonl';
const {loadCatalog,validRecord}=await import(pathToFileURL(path.join(sibling,'docs/research/marketing-ontology/batches/D007/catalog.mjs')));
const entries=loadCatalog();
const publicRoot=path.join(root,'frontend/public/workbench-data');
const demo=read(path.join(publicRoot,'D008/catalog.json')),lock=read(path.join(publicRoot,'D008/lock.json'));
assert.equal(hash(fs.readFileSync(path.join(publicRoot,'D008/catalog.json'))),lock.sha256);
const old=read(path.join(publicRoot,'D007/catalog.json'));
assert.equal(hash(fs.readFileSync(path.join(publicRoot,'D007/catalog.json'))),lock.source_sha256);
assert.deepEqual(entries.filter(e=>e.batch==='D007').map(e=>e.record),old.records);
fs.mkdirSync(path.join(output,'archive'),{recursive:true});
const inputs=[],locations=new Map();
function preserve(base,relative,kind){
 const source=path.join(base,relative),bytes=fs.readFileSync(source),sha256=hash(bytes),target='archive/files/'+sha256+path.extname(source);
 const destination=path.join(output,target);fs.mkdirSync(path.dirname(destination),{recursive:true});
 if(fs.existsSync(destination))assert.equal(hash(fs.readFileSync(destination)),sha256);else fs.writeFileSync(destination,bytes,{flag:'wx'});
 const rows=relative.endsWith('.jsonl')?bytes.toString().trim().split(/\r?\n/).filter(Boolean).map(JSON.parse):[];
 inputs.push({repository:base===sibling?'marketing-agent-poc':'marketing-dashboard-drafts',path:relative.replaceAll('\\','/'),sha256,bytes:bytes.length,rows:rows.length,kind,archive:target});
 return {rows,input:inputs.at(-1)};
}
const batchesDir='docs/research/marketing-ontology/batches';
for(const batch of [...new Set(entries.map(e=>e.batch))]){
 const dir=path.join(sibling,batchesDir,batch,'source');
 for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.jsonl')).sort()){
  const {rows,input}=preserve(sibling,`${batchesDir}/${batch}/source/${file}`,'original');
  rows.forEach((r,i)=>locations.set(batch+'/'+(r.record_id||r.metadata?.record_id),{...input,line:i+1,raw_sha256:hash(JSON.stringify(r))}));
 }
}
for(const file of fs.readdirSync(path.join(publicRoot,'D008/source')).filter(f=>f.endsWith('.jsonl')).sort()){
 const {rows,input}=preserve(root,'frontend/public/workbench-data/D008/source/'+file,'original');
 rows.forEach((r,i)=>locations.set('D008/'+r.record_id,{...input,line:i+1,raw_sha256:hash(JSON.stringify(r))}));
}
// Catalogs, local baseline copies and TS demos are physical projections, never new observations.
function inventory(base,dir,kind){for(const file of fs.readdirSync(path.join(base,dir),{withFileTypes:true})){const rel=dir+'/'+file.name;if(file.isDirectory())inventory(base,rel,kind);else preserve(base,rel,kind);}}
inventory(root,'frontend/public/workbench-data','projection');
inventory(root,'docs/research/marketing-ontology/batches/D003B/source','baseline-copy');
for(const file of ['frontend/lib/demo-scenarios.ts','frontend/lib/marketing.ts','scripts/build-comparison-demo.mjs'])preserve(root,file,'legacy-code-or-generator');
const originals=inputs.filter(x=>x.kind==='original');assert.equal(originals.reduce((n,x)=>n+x.rows,0),entries.length+demo.records.length);
const active=[],migration=[],provenance=[],issues=[],pending=[];
const demoIds=new Set(demo.records.map(r=>r.record_id));
const reset=new Set(['T10','T11','T24','T25','T26','T27','T28','T29','T37']);
// Keep all declared business dimensions, including sample/normalization/metric definitions.
function decide(e,decision,reason,target){
 const r=e.record,origin=locations.get(e.batch+'/'+r.record_id);assert(origin,'Missing physical source '+r.record_id);
 assert.equal(hash(JSON.stringify(e.source||r)),origin.raw_sha256,'Physical row must match canonical loader source');
 const m={source_key:e.batch+'/'+r.record_id,record_id:r.record_id,type:r.dataset_type,decision,reason,active_id:decision==='active'?r.record_id:null,replacement_id:target||null,source_path:origin.path,line:origin.line,source_sha256:origin.sha256,record_sha256:hash(JSON.stringify(r)),business_key_sha256:hash(businessKey(r))};migration.push(m);
 if(decision==='active'){active.push(r);provenance.push({...m,file:mapping[r.dataset_type],archive:origin.archive,source_record_sha256:origin.raw_sha256,transformation:'business fields and ID unchanged; canonical legacy projection only for product definitions'});}
 if(decision==='nonconforming')issues.push({...m,source:e.source,record:r,diagnostics:e.contract_gaps});
 if(decision==='pending')pending.push(m);
}
for(const e of entries){
 const r=e.record;
 if(!e.schema_conforming){decide(e,'nonconforming','Existing canonical schema/semantic diagnostics; raw source retained');continue;}
 if(e.batch==='D005'&&r.dataset_type==='T01'){decide(e,'active','Valid product/variant definitions reused by current scenario');continue;}
 if(e.batch==='D007'){
  const candidate=r.record_id.replace('D007','D008');
  if(!reset.has(r.dataset_type)&&demoIds.has(candidate))decide(e,'replaced','Generator retains ordinal lineage for this type; comparison scenario replaces the previous scenario, not an additional observation',candidate);
  else decide(e,'replaced','Generator resets this type and rebuilds the whole current scenario; no one-to-one observation identity claimed');
 }else decide(e,'independent_archive','Historical independent sample/validation case with different scope; retain without combining denominators with the current comparison scenario');
}
const candidates=new Map();for(const r of demo.records){const key=businessKey(r);candidates.set(key,[...(candidates.get(key)||[]),r.record_id]);}
for(const r of demo.records){const v=validRecord(r);assert(v.conforming,JSON.stringify({id:r.record_id,errors:v.errors}));const conflicts=candidates.get(businessKey(r));decide({batch:'D008',record:r,source:r},conflicts.length>1?'pending':'active',conflicts.length>1?'Ambiguous same-scope business key without sample/measurement discriminator; all conflicting rows withheld: '+conflicts.join(', '):'Existing current comparison scenario; no generated/changed observation');}
assert.equal(migration.length,originals.reduce((n,x)=>n+x.rows,0));
const ids=new Set(active.map(r=>r.record_id));assert.equal(ids.size,active.length);
const byId=new Map(active.map(r=>[r.record_id,r]));
const keys=new Map();for(const r of active){const key=businessKey(r);assert(!keys.has(key),'Conflicting business key: '+keys.get(key)+' / '+r.record_id);keys.set(key,r.record_id);}
writeBusinessKeys();
function writeBusinessKeys(){fs.writeFileSync(path.join(output,'archive/business-keys.json'),JSON.stringify({common:['dataset_type','scope_id','scenario_id'],fields:businessKeys,policy:'Missing dimensions are null; keys never equate independent scopes/scenarios. Replacements are generator-lineage decisions, not identity equivalence.'},null,2)+'\n');}
for(const r of active){for(const id of r.related_record_ids||[])assert(ids.has(id),'Unresolved record reference '+r.record_id+' -> '+id);if(r.review_ref){const p=byId.get(r.review_ref);assert(p);const s=r.evidence_span;if(s)assert.equal([...p.body_text].slice(s.start_offset,s.end_offset).join(''),s.quote);}}
const write=(file,bytes)=>fs.writeFileSync(path.join(output,file),bytes);
const files=Object.entries(mapping).map(([type,file])=>{const rows=active.filter(r=>r.dataset_type===type);assert(rows.length,'Missing type '+type);const bytes=jsonl(rows);write(file,bytes);return {type,file,rows:rows.length,bytes:Buffer.byteLength(bytes),sha256:hash(bytes)};});
for(const [file,value]of Object.entries({'definitions.json':demo.definitions,'product-presentation.json':demo.products,'archive/source-inventory.json':inputs,'archive/nonconforming.json':issues,'archive/pending.json':pending}))write(file,JSON.stringify(value,null,2)+'\n');
write('provenance.jsonl',jsonl(provenance));write('migration-map.jsonl',jsonl(migration));
const metadata=['definitions.json','product-presentation.json'].map(file=>({file,sha256:hash(fs.readFileSync(path.join(output,file)))}));
const decisions=Object.fromEntries([...new Set(migration.map(m=>m.decision))].map(d=>[d,migration.filter(m=>m.decision===d).length]));
const manifest={contract:'marketing-current/1',screen_contract:lock.screen_contract,schema_sha256:lock.schema_sha256,source_created_at:lock.source_created_at,rows:active.length,preserved_rows:migration.length,source_files:originals.length,files,metadata,decisions,scope_ids:Object.fromEntries(['KR','JP','US'].map(c=>[c,[...new Set(active.filter(r=>r.scope_id.split('-')[1]===c).map(r=>r.scope_id))]])),policy:'One current comparison scenario plus valid shared product definitions. Independent historical samples and invalid records are excluded from KPI totals; all physical inputs and per-row decisions remain archived.'};
const periods=active.filter(r=>r.dataset_type==='T03').map(r=>r.period);
manifest.period={start:periods.map(p=>p.start).sort()[0],end:periods.map(p=>p.end_exclusive).sort().at(-1)};
manifest.pending_by_type=Object.fromEntries([...new Set(pending.map(m=>m.type))].map(t=>[t,pending.filter(m=>m.type===t).length]));
manifest.data_sha256=hash(JSON.stringify({contract:manifest.contract,screen_contract:manifest.screen_contract,schema_sha256:manifest.schema_sha256,source_created_at:manifest.source_created_at,scope_ids:manifest.scope_ids,period:manifest.period,files:files.map(({file,sha256})=>({file,sha256})),metadata}));
write('manifest.json',JSON.stringify(manifest,null,2)+'\n');
for(const input of inputs){const base=input.repository==='marketing-agent-poc'?sibling:root;assert.equal(hash(fs.readFileSync(path.join(base,input.path))),input.sha256,'Source changed during migration');}
console.log(JSON.stringify({pass:true,rows:manifest.rows,preserved_rows:manifest.preserved_rows,source_files:manifest.source_files,decisions,data_sha256:manifest.data_sha256}));
