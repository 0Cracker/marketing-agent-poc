// Source, schema, semantic and RDF statuses are deliberately separate.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {normalize,schemas,ajvInstance,here as batch,root} from '../batches/D005/contract.mjs';
import {convert,mappingVersion} from './d005-canonical.mjs';
import {loadSupplement,applySupplement} from './canonical-supplement.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const option=k=>process.argv.includes(k)?process.argv[process.argv.indexOf(k)+1]:undefined;
const output=option('--output');
if(!output)throw Error('--output required');
if(fs.existsSync(output))throw Error('report overwrite refused');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const schemaPath=path.join(here,'../schemas/marketing-records.schema.json');
const canonical=JSON.parse(fs.readFileSync(schemaPath));
const sourcePaths=fs.readdirSync(path.join(batch,'source')).filter(x=>x.endsWith('.jsonl')).sort().map(x=>path.join(batch,'source',x));
const parentPaths=['T01','T12','T24'].map(t=>path.join(batch,'../D003B/source',t+'.jsonl'));
const inputs=[schemaPath,fileURLToPath(import.meta.url),path.join(here,'d005-canonical.mjs'),path.join(here,'check-canonical-readback.py'),
 path.join(batch,'contract.mjs'),path.join(batch,'common.schema.json'),path.join(batch,'manifest.json'),
 path.join(batch,'oracle.py'),path.join(batch,'generate.mjs'),path.join(batch,'README.md'),path.join(here,'../temporal-design.md'),
 path.join(here,'../data-proposal.md'),path.join(here,'meaning-decisions-20261016.json'),...sourcePaths,...parentPaths];
inputs.push(path.join(here,'canonical-supplement.mjs'));
const hashes=Object.fromEntries(inputs.map(p=>[p,sha(p)]));
const reviewPath=option('--field-review-record');
let reviewRecord=null;
if(reviewPath){
 reviewRecord=JSON.parse(fs.readFileSync(reviewPath));
 assert.equal(reviewRecord.source,'explicit_human_response');assert.equal(reviewRecord.approved,true);assert.ok(reviewRecord.user_message);
 assert.equal(reviewRecord.schema_sha256,hashes[schemaPath]);assert.equal(reviewRecord.mapping_sha256,hashes[path.join(here,'d005-canonical.mjs')]);
 assert.equal(reviewRecord.type_fields,335);assert.equal(reviewRecord.common_fields,10);assert.equal(reviewRecord.unresolved_meaning_issues,0);
 inputs.push(reviewPath);hashes[reviewPath]=sha(reviewPath);
}
const supplement=loadSupplement(option('--supplement'),option('--supplement-approval-record'),hashes);
for(const file of supplement.files){inputs.push(file);hashes[file]=sha(file);}
const approval=JSON.parse(fs.readFileSync(path.join(here,'meaning-decisions-20261016.json')));
assert.equal(approval.source,'explicit_human_response');
assert.ok(approval.decisions['1'].startsWith('Retain the common dictionary;'));
const read=p=>fs.readFileSync(p,'utf8').trim().split('\n').map(JSON.parse);
const ajv=ajvInstance(),sourceValid=ajv.compile(schemas().source);
ajv.addSchema(canonical,'canonical');
const originals=sourcePaths.flatMap(read);
const decoded=originals.map(raw=>{assert.ok(sourceValid(raw),JSON.stringify(sourceValid.errors));return normalize(raw);});
const products=read(parentPaths[0]),campaigns=read(parentPaths[1]),reviews=read(parentPaths[2]);
const context={entityKinds:new Map(),reviews:new Map(reviews.map(r=>[r.record_id,r])),campaigns:new Map(),models:new Map(),
 productsByRecord:new Map(products.map(r=>[r.record_id,r])),profiles:new Map(originals.map(r=>[r.metadata.record_id,r.source_profile])),customers:new Map()};
const addKind=(id,kind)=>{if(!context.entityKinds.has(id))context.entityKinds.set(id,new Set());context.entityKinds.get(id).add(kind);};
for(const p of products){addKind(p.product_id,'product');addKind(p.brand_id,'brand');}
for(const r of decoded.filter(r=>r.metadata.dataset_type==='T01'))addKind(r.payload.variant_id,'variant');
for(const c of campaigns){if(!context.campaigns.has(c.country_code))context.campaigns.set(c.country_code,{});context.campaigns.get(c.country_code)[c.channel]=c.campaign_id;}
for(const r of decoded.filter(r=>r.metadata.dataset_type==='T39'&&r.payload.record_kind==='model'))context.models.set(r.payload.model_id,r.payload);
// The generator declares parallel order_refs/customer_set arrays; never infer from similar IDs.
for(const r of decoded.filter(r=>r.metadata.dataset_type==='T30'&&r.payload.record_kind==='cohort')){
 assert.equal(r.payload.order_refs.length,r.payload.customer_set.length);
 r.payload.order_refs.forEach((order,i)=>{const customer=r.payload.customer_set[i];assert.ok(!context.customers.has(order)||context.customers.get(order)===customer);context.customers.set(order,customer);});
}
const summaries=new Map(),rows=[],gaps=new Map();
for(const source of decoded.filter(r=>r.metadata.dataset_type!=='T01')){
 const type=source.metadata.dataset_type,{record,lineage,retained_source_fields,original_value_origin}=convert(source,canonical,context);
 applySupplement(record,lineage,supplement.patches.get(record.record_id));
 const validate=ajv.compile({$ref:`canonical#/$defs/${type}`}),ok=validate(record),errors=structuredClone(validate.errors||[]);
 if(!summaries.has(type))summaries.set(type,{type,rows:0,canonical_conforming:0,mappings:{},missing:{},incompatible:{},rows_with_gaps:[]});
 const s=summaries.get(type);s.rows++;if(ok)s.canonical_conforming++;
 const missing=errors.filter(e=>e.keyword==='required').map(e=>`${e.instancePath}/${e.params.missingProperty}`);
 for(const e of errors){
  const field=e.keyword==='required'?`${e.instancePath}/${e.params.missingProperty}`:e.instancePath;
  const key=e.keyword==='required'?field:field+':'+e.keyword;
  const group=e.keyword==='required'?s.missing:s.incompatible;group[key]=(group[key]||0)+1;
  if(['if','oneOf','anyOf'].includes(e.keyword))continue;
  const category=type==='T31'&&field==='/unique_clickers'?'needs_meaning':e.keyword==='required'?'needs_data':'contract_issue';
  const id=`${type}|${field}|${e.keyword}`;
  if(!gaps.has(id))gaps.set(id,{type,field,keyword:e.keyword,category,record_ids:[],subtypes:[]});
  const g=gaps.get(id);g.record_ids.push(record.record_id);if(!g.subtypes.includes(source.payload.record_kind||'default'))g.subtypes.push(source.payload.record_kind||'default');
 }
 for(const m of lineage){const key=m.rule+' -> '+m.target;s.mappings[key]=(s.mappings[key]||0)+1;}
 if(errors.length)s.rows_with_gaps.push({record_id:record.record_id,subtype:source.payload.record_kind||null,missing,
  incompatible:errors.filter(e=>e.keyword!=='required').map(e=>({path:e.instancePath,keyword:e.keyword,params:e.params}))});
 rows.push({source,record,lineage,retained_source_fields,original_value_origin,schema_conforming:ok});
}
assert.equal(rows.length,528);assert.equal(summaries.size,30);
assert.equal(new Set(rows.map(r=>r.record.record_id)).size,528);
assert.ok([...supplement.patches.keys()].every(id=>rows.some(r=>r.record.record_id===id)),'supplement refers to an unaudited row');
const readbackCommand=[path.join(here,'check-canonical-readback.py'),'--tools',option('--tools')||path.join(root,'../ontology-validation-tools')];
if(supplement.files.length)readbackCommand.push('--supplement',supplement.files[0],'--supplement-approval-record',supplement.files[1]);
const independent=spawnSync(option('--python')||'python',readbackCommand,{input:JSON.stringify(rows),encoding:'utf8',maxBuffer:10*1024*1024,
 env:{...process.env,PYTHONDONTWRITEBYTECODE:'1',PYTHONIOENCODING:'utf-8'}});
let readback;
try{readback=JSON.parse(independent.stdout);}catch{readback={status:'not_run',reason:independent.error?.message||independent.stderr||'invalid independent report'};}
if(independent.status!==0&&readback.status==='pass')readback.status='fail';
const changed=inputs.filter(p=>sha(p)!==hashes[p]);
const conforming=rows.filter(r=>r.schema_conforming).length;
const commonFields=['record_id','dataset_type','scope_id','scenario_id','is_synthetic','value_origin','provenance','quality','temporal','related_record_ids'];
const fieldReview=[...summaries.keys()].flatMap(type=>Object.entries(canonical.$defs[type].properties).filter(([field])=>!commonFields.includes(field)).map(([field,definition])=>{
 const affected=[...gaps.values()].filter(g=>g.type===type&&(g.field==='/'+field||g.field.startsWith('/'+field+'/')));
 const mappings=rows.filter(r=>r.record.dataset_type===type).flatMap(r=>r.lineage.filter(m=>m.target==='/'+field||m.target.startsWith('/'+field+'/')));
 return {type,field,meaning:definition.description,priority:definition['x-priority'],status:affected.length?'unresolved':mappings.length?'mapped_with_evidence':'not_provided_no_schema_requirement',
  rules:[...new Set(mappings.map(m=>m.rule))],sources:[...new Set(mappings.flatMap(m=>m.sources))],mapped_instances:mappings.length,
  gap_categories:[...new Set(affected.map(g=>g.category))],human_confirmed:false};
}));
assert.equal(fieldReview.length,335);
const complete=conforming===528&&readback.status==='pass'&&!changed.length&&reviewRecord;
const status=changed.length||conforming!==528||readback.status==='fail'?'fail':complete?'pass':'not_run';
const report={mapping_version:mappingVersion,status,audit_execution:readback.status,
 canonical_contract_status:conforming===528?'pass':'fail',rows:528,types:30,conforming_rows:conforming,nonconforming_rows:528-conforming,
 supporting_product_rows:6,new_source_rows:0,approved_supplement_rows:supplement.rows,approved_supplement_fields:supplement.fields,
 input_sha256:hashes,changed_inputs:changed,independent_readback:readback,
 checks:[{name:'all_30_types_528_rows_source_validated',status:'pass'},{name:'unique_source_coverage',status:'pass'},
 {name:'unchanged_inputs',status:changed.length?'fail':'pass'},{name:'independent_source_RDF_SHACL_readback',status:readback.status}],
 gap_groups:[...gaps.values()],gap_group_count:gaps.size,
 field_review:{type_field_occurrences:335,common_field_definitions:10,fields:fieldReview,
  common_fields:commonFields.map(field=>({field,rules:[...new Set(rows.flatMap(r=>r.lineage.filter(m=>m.target==='/'+field).map(m=>m.rule)))],
   mapped_instances:rows.filter(r=>field in r.record).length,human_confirmed:Boolean(reviewRecord),
   basis:'explicit D005 metadata, source artifacts, declared sample and temporal design; available_at is never collected_at'})),
  unresolved_fields:fieldReview.filter(f=>f.status==='unresolved').length,unresolved_groups:gaps.size,
  status:gaps.size||!reviewRecord?'pending':'pass',confirmation_record:reviewPath||null,
  actual_provider_mapping:'out_of_scope',actual_data_fit:'out_of_scope'},
 lineage:rows.map(r=>({record_id:r.record.record_id,schema_conforming:r.schema_conforming,fields:r.lineage,
  retained_source_fields:r.retained_source_fields,original_value_origin:r.original_value_origin})),
 method:'Explicit registered mapping, unchanged full canonical schema, separate independent Python source and RDF/SHACL readback.',
 limitation:'Only schema-conforming records enter canonical RDF. Missing times, definitions, business context and clicker semantics are not fabricated. Schema pass is not complete business review.',
 types_detail:[...summaries.values()]};
fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({report:output,status:report.status,rows:528,conforming_rows:conforming,gap_groups:gaps.size,independent:readback.status}));
process.exitCode={pass:0,fail:1,not_run:2}[report.status];
