// Reading an approved supplement is separate from generating new synthetic values.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
export function loadSupplement(file,approvalFile,inputHashes){
 if(!file&&!approvalFile)return {patches:new Map(),files:[],rows:0,fields:0};
 assert.ok(file&&approvalFile,'supplement and explicit approval record required together');
 const data=JSON.parse(fs.readFileSync(file)),approval=JSON.parse(fs.readFileSync(approvalFile));
 assert.equal(approval.approved,true);
 if(approval.source==='delegated_execution'){
  const authority=JSON.parse(fs.readFileSync(approval.authority_file));
  assert.equal(sha(approval.authority_file),approval.authority_sha256);
  assert.equal(authority.source,'explicit_human_response');assert.equal(authority.approved,true);
  assert.ok(authority.user_message&&authority.actions.includes('synthetic_supplement'));
 }else {assert.equal(approval.source,'explicit_human_response');assert.ok(approval.user_message);}
 assert.equal(approval.supplement_sha256,sha(file));
 assert.equal(data.version,'D005-CANONICAL-SUPPLEMENT-1');
 assert.ok(Object.keys(data.input_sha256).length,'supplement input lock required');
 for(const [path,hash] of Object.entries(data.input_sha256))assert.equal(inputHashes[path],hash,'supplement input changed: '+path);
 const patches=new Map();let fields=0;
 for(const row of data.records){
  assert.ok(/^D005-T\d{2}-\d{4}$/.test(row.record_id));assert.ok(!patches.has(row.record_id),'duplicate supplement record');
  assert.ok(Object.keys(row.fields).length,'empty supplement record');
  patches.set(row.record_id,row.fields);fields+=Object.keys(row.fields).length;
 }
 assert.equal(approval.record_count,patches.size);assert.equal(approval.field_count,fields);
 const metadata=new Map(data.records.map(r=>[r.record_id,r.field_metadata||{}]));
 return {patches,metadata,files:[file,approvalFile,...(approval.authority_file?[approval.authority_file]:[])],rows:patches.size,fields};
}
export function applySupplement(record,lineage,fields,metadata={}){
 if(!fields)return;
 const protectedRoots=new Set(['record_id','dataset_type','scope_id','scenario_id','is_synthetic','value_origin','provenance','quality','temporal','related_record_ids']);
 for(const [pointer,value] of Object.entries(fields)){
  assert.ok(pointer.startsWith('/')&&!pointer.endsWith('/'),'JSON pointer required');
  const parts=pointer.slice(1).split('/').map(x=>x.replace(/~1/g,'/').replace(/~0/g,'~'));
  assert.ok(!protectedRoots.has(parts[0]),'supplement cannot rewrite provenance or identity');
  assert.ok(parts.every(p=>!['__proto__','constructor','prototype'].includes(p)),'unsafe JSON pointer');
  let parent=record;
  for(const part of parts.slice(0,-1)){assert.ok(Object.hasOwn(parent,part),'supplement parent path missing');parent=parent[part];assert.ok(parent&&typeof parent==='object');}
  const key=parts.at(-1);assert.ok(!Object.hasOwn(parent,key),'supplement cannot overwrite existing values');
  parent[key]=structuredClone(value);
  lineage.push({target:pointer,sources:['approved-supplement:'+record.record_id+pointer,...(metadata[pointer]?.sources||[])],
   rule:metadata[pointer]?.rule||'explicitly-approved-missing-field',...metadata[pointer]});
 }
}
export function selfCheck(){
 // Generic protocol objects only; no marketing records or synthetic business values.
 assert.deepEqual(loadSupplement(undefined,undefined,{}).files,[]);
 assert.throws(()=>loadSupplement('missing-protocol-file',undefined,{}),/required together/);
 assert.throws(()=>applySupplement({},[],{'/record_id':'forbidden'}),/identity/);
 assert.throws(()=>applySupplement({value:1},[],{'/value':2}),/overwrite/);
 assert.throws(()=>applySupplement({},[],{'/__proto__/value':1}),/unsafe/);
 assert.throws(()=>applySupplement({},[],{'/absent/child':1}),/parent path/);
 const value={},lineage=[];applySupplement(value,lineage,{'/value':1});
 assert.deepEqual(value,{value:1});assert.equal(lineage[0].target,'/value');
 return {status:'pass',checks:7};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href&&process.argv.includes('--self-check'))console.log(JSON.stringify(selfCheck()));
