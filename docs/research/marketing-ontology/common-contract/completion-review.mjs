import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

export function validateReview(review,fields,common,schemaHash,mappingHash){
 assert.equal(review.source,'delegated_ai_review');assert.equal(review.human_confirmed,false);
 const authority=JSON.parse(fs.readFileSync(review.authority_file));
 assert.equal(sha(review.authority_file),review.authority_sha256);
 assert.ok(authority.approved&&authority.source==='explicit_human_response'&&authority.actions.includes('business_semantics'));
 assert.equal(review.schema_sha256,schemaHash);assert.equal(review.mapping_sha256,mappingHash);
 const expected=[...fields.map(f=>({key:f.type+'.'+f.field,meaning:f.meaning,rules:f.rules,sources:f.sources,status:f.status})),
  ...common.map(f=>({key:'common.'+f.field,meaning:f.meaning,rules:f.rules,sources:f.sources,status:'mapped_with_evidence'}))];
 assert.equal(review.entries.length,expected.length);assert.equal(new Set(review.entries.map(f=>f.key)).size,expected.length);
 const entries=new Map(review.entries.map(f=>[f.key,f]));
 for(const e of expected){
  const actual=entries.get(e.key);assert.ok(actual,'missing field review '+e.key);
  assert.equal(actual.status,'resolved');assert.equal(actual.human_confirmed,false);
  assert.ok(actual.decision&&actual.null_policy&&actual.reference_policy&&actual.time_policy);
  assert.equal(actual.meaning,e.meaning);assert.deepEqual(actual.rules,e.rules);assert.deepEqual(actual.sources,e.sources);
  assert.notEqual(e.status,'unresolved');
  assert.equal(actual.decision,e.status==='not_provided_no_schema_requirement'?'optional_not_supplied':'mapped_or_explicitly_completed');
 }
 return {status:'pass',reviewed_fields:expected.length,human_confirmed:false,review_kind:'delegated_ai_review'};
}

export function availableCompletion(fields,metadata,at){
 return Object.fromEntries(Object.entries(fields).filter(([pointer])=>Date.parse(metadata[pointer].available_at)<=Date.parse(at)));
}
