import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {loadSupplement,selfCheck} from './canonical-supplement.mjs';
import {validateReview,availableCompletion} from './completion-review.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const read=n=>JSON.parse(fs.readFileSync(path.join(here,n)));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const values=read('completion-values.json'),review=read('completion-field-review.json');
const schema=read('../schemas/marketing-records.schema.json');
let checks=selfCheck().checks;
const loaded=loadSupplement(path.join(here,'completion-values.json'),path.join(here,'completion-values-authorization.json'),
 Object.fromEntries(Object.keys(values.input_sha256).map(p=>[p,sha(p)])));
assert.equal(loaded.rows,330);assert.equal(loaded.fields,816);checks+=2;
const fields=[],common=[];
for(const entry of review.entries){
 const [type,field]=entry.key.split('.');
 const definition=schema.$defs[type==='common'?'T02':type].properties[field];assert.ok(definition);
 assert.equal(entry.meaning,definition.description);
 const item={type,field,meaning:definition.description,rules:entry.rules,sources:entry.sources,
  status:entry.decision==='optional_not_supplied'?'not_provided_no_schema_requirement':'mapped_with_evidence'};
 (type==='common'?common:fields).push(item);
}
assert.equal(fields.length,335);assert.equal(common.length,10);checks+=2;
const schemaHash=sha(path.join(here,'../schemas/marketing-records.schema.json')),mappingHash=sha(path.join(here,'d005-canonical.mjs'));
validateReview(review,fields,common,schemaHash,mappingHash);checks++;
for(const kind of ['missing','duplicate','human-forgery','stale']){
 const bad=structuredClone(review);
 if(kind==='missing')bad.entries.pop();if(kind==='duplicate')bad.entries[1]=bad.entries[0];
 if(kind==='human-forgery')bad.human_confirmed=true;if(kind==='stale')bad.mapping_sha256='stale';
 assert.throws(()=>validateReview(bad,fields,common,schemaHash,mappingHash));checks++;
}
for(const row of values.records)for(const pointer of Object.keys(row.fields)){
 const meta=row.field_metadata[pointer];assert.equal(meta.available_at,values.created_at);
 const field={[pointer]:row.fields[pointer]},metadata={[pointer]:meta};
 assert.deepEqual(availableCompletion(field,metadata,new Date(Date.parse(values.created_at)-1).toISOString()),{});
 assert.equal(Object.keys(availableCompletion(field,metadata,values.created_at)).length,1);checks+=2;
}
console.log(JSON.stringify({status:'pass',checks,field_review:345,source_rows_created:0,source_values_changed:0}));
