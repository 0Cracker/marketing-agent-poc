import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {makeFlow,planner,analyzed,proposed,approved,adapter,principal,scope,tools,rawRows} from './support.mjs';

test('A12 zero stock is observed zero, never missing or proof of full-day outage',()=>{
  const row=rawRows('T22').find(r=>r.available_quantity===0);
  const r=tools.call('observations',{type:'T22',offset:0,limit:80},{...scope,country:row.scope_id.split('-')[1],scopeId:row.scope_id});
  assert.ok(r.facts.some(f=>f.value===0&&f.availability==='present'));
  assert.ok(r.limitations.includes('snapshot_not_duration'));
});
test('A13 missing ad metric stays null and partial, never zero-filled',()=>{
  const row=rawRows('T13').find(r=>r.metrics.spend===null||r.metrics.spend.amount===null);
  assert.ok(row);
  const s={...scope,country:row.scope_id.split('-')[1],scopeId:row.scope_id,productIds:['P1A','P2A']};
  const rows=tools.call('observations',{type:'T13',offset:0,limit:80},s);
  assert.ok(rows.facts.some(f=>f.recordId===row.record_id&&f.value===null&&f.availability==='missing'));
  assert.equal(rows.completeness,'partial');
});
test('A14 listed prices retain unknown tax/shipping, never all-in purchase price',()=>{
  const r=tools.call('observations',{type:'T08',offset:0,limit:24},scope);
  assert.ok(r.limitations.includes('tax_shipping_not_assumed'));assert.ok(r.facts.every(f=>f.field==='listed_price'));
});
test('A15 boundary periods and invalid pagination fail before retrieval',()=>{
  assert.throws(()=>tools.call('market_compare',{}, {...scope,start:'2026-08-03'}),e=>e.code==='period_incomparable');
  for(const args of [{type:'T13',offset:-1},{type:'T13',limit:10000},{type:'T99'},{type:'T13',limit:0},{type:'T13',offset:'0'}])assert.throws(()=>tools.call('observations',args,scope),e=>e.code==='tool_arguments');
});
test('A16 ontology paths preserve SourceRecord/Artifact and Variant/Product types',()=>{
  const r=tools.call('relations',{candidate:'price'},scope);
  assert.equal(r.ontology.kind,'typed_projection');assert.ok(r.ontology.sha256);
  assert.ok(r.edges.some(e=>e.predicate==='sourceRecord'&&e.to===e.evidenceId));
  assert.ok(r.edges.some(e=>e.predicate==='artifact'&&e.from===e.evidenceId));
  assert.ok(r.edges.some(e=>e.predicate==='variantOf'&&scope.productIds.includes(e.to)));
  assert.ok(r.edges.every(e=>r.ontology.predicates.includes(e.predicate)));
});
test('F21 final output preserves missing facts and partial completeness',async()=>{
  const f=makeFlow(c=>!c.history.length?{tool:'observations',args:{type:'T13',limit:80}}:{finish:{facts:c.history[0].result.facts.filter(f=>f.value===null).map(f=>f.id),hypotheses:[],recommendation:'repair_measurement'}});
  try{const r=await f.analyze({question:'미수집 지표 확인',scope:{...scope,country:'JP',scopeId:'D007-JP-sample'}});assert.equal(r.status,'analyzed');assert.equal(r.output.completeness,'partial');assert.ok(r.output.facts.every(f=>f.value===null));}finally{f.close();}
});
test('F22 tool-call ceiling is enforced independently of model-call ceiling',async()=>{
  const f=makeFlow(planner,':memory:',{maxToolCalls:1});
  try{const r=await analyzed(f);assert.equal(r.status,'held');assert.equal(r.reason,'call_limit');assert.equal(r.toolCalls,1);assert.equal(r.modelCalls,2);}finally{f.close();}
});
test('F23 support/counter conflict is visible as mixed proposed interpretation',async()=>{
  const f=makeFlow(planner);try{const r=await analyzed(f);assert.equal(r.output.hypotheses[0].assessment,'mixed');assert.equal(r.output.hypotheses[0].kind,'proposed_interpretation');assert.equal(r.output.causalEffect,null);}finally{f.close();}
});
test('F13 counterevidence cannot be bypassed by omitting the entire hypothesis',async()=>{
  const f=makeFlow(c=>{const r=planner(c);if(r.finish)r.finish.hypotheses=[];return r;});
  try{const r=await analyzed(f);assert.equal(r.status,'held');assert.equal(r.reason,'counterevidence_omitted');}finally{f.close();}
});
test('F14 hypothesis cannot relabel arbitrary retrieved rows as supporting evidence',async()=>{
  const f=makeFlow(c=>{const r=planner(c);if(r.finish)r.finish.hypotheses[0].supports=[c.history[0].result.recordIds[0]];return r;});
  try{const r=await analyzed(f);assert.equal(r.status,'held');assert.equal(r.reason,'unsupported_evidence');}finally{f.close();}
});
test('F15 explicit price focus cannot silently become a media analysis',async()=>{
  const f=makeFlow(c=>{const r=planner(c);if(c.focus==='price'&&r.tool==='relations')r.args.candidate='media';return r;});
  try{const a=await analyzed(f);const r=await f.analyze({parentId:a.id,focus:'price',question:'가격만 다시'});assert.equal(r.status,'held');assert.equal(r.reason,'focus_not_investigated');}finally{f.close();}
});
test('F16 quota interruption resumes saved history after SQLite reopen',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'agent-resume-')),db=path.join(dir,'flow.db');
  let f=makeFlow(c=>{if(c.history.length===1){const e=Error('quota');e.code='quota_exhausted';throw e;}return planner(c);},db);
  try{const paused=await analyzed(f);assert.equal(paused.status,'paused');assert.equal(paused.toolCalls,1);f.close();f=makeFlow(planner,db);const r=await f.resume(paused.id);assert.equal(r.status,'analyzed');assert.equal(r.toolCalls,2);assert.equal(r.modelCalls,4);}finally{f.close();fs.rmSync(dir,{recursive:true});}
});
test('F17 resume cannot reset cumulative model-call budget',async()=>{
  const f=makeFlow(()=>{const e=Error();e.code='model_timeout';throw e;},':memory:',{maxModelCalls:2});
  try{let r=await analyzed(f);assert.equal(r.status,'paused');r=await f.resume(r.id);assert.equal(r.status,'paused');r=await f.resume(r.id);assert.equal(r.status,'held');assert.equal(r.reason,'call_limit');assert.equal(r.modelCalls,2);}finally{f.close();}
});
test('F18 cancellation while model awaits prevents further tool execution',async()=>{
  let release;const f=makeFlow(()=>new Promise(resolve=>{release=resolve;}));
  try{const pending=analyzed(f);await new Promise(resolve=>setImmediate(resolve));const running=f.store.list()[0];f.cancel(running.id);release({tool:'market_compare',args:{}});const r=await pending;assert.equal(r.status,'cancelled');assert.equal(r.toolCalls,0);}finally{f.close();}
});
test('F19 source prompt injection cannot expand role tools or mutate scope',async()=>{
  const f=makeFlow(c=>{c.scope.country='JP';return {tool:'execute_sql',args:{sql:'write'}};});
  try{const r=await analyzed(f);assert.equal(r.reason,'tool_forbidden');assert.equal(r.scope.country,'KR');}finally{f.close();}
});
test('F20 stale or superseded followup reference does not fork unnoticed',async()=>{
  const f=makeFlow(planner);try{const a=await analyzed(f);await f.analyze({parentId:a.id,question:'가격',focus:'price'});const r=await f.analyze({parentId:a.id,question:'그중 가격'});assert.equal(r.status,'needs_scope');}finally{f.close();}
});
test('P07 rejected proposals never submit and cannot be approved afterwards',async()=>{
  const f=makeFlow(planner);try{const p=await proposed(f);const r=f.reject(p.id,{version:p.version,principal});assert.equal(r.status,'rejected');await assert.rejects(f.submit(r.id,{version:r.version,adapter:adapter(r)}));assert.throws(()=>f.approve(r.id,{version:r.version,principal,expiresAt:'2026-10-19T00:00:00Z'}));}finally{f.close();}
});
test('P08 corrupted proposal content cannot keep an old approval hash',async()=>{
  const f=makeFlow(planner);try{const p=await approved(f);const changed=f.store.update(p.id,p.version,d=>{d.output.action='hold';});await assert.rejects(f.submit(p.id,{version:changed.version,adapter:adapter(p)}),e=>e.code==='approval_stale');}finally{f.close();}
});
test('P09 failed revision leaves previous proposal and approval unchanged',async()=>{
  const f=makeFlow(planner);try{const p=await approved(f);assert.throws(()=>f.revise(p.id,{version:p.version,candidateId:'missing'}));assert.deepEqual(f.get(p.id),p);}finally{f.close();}
});
test('X08 two separate store connections still permit only one submission',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'agent-concurrent-')),db=path.join(dir,'flow.db');
  const a=makeFlow(planner,db),b=makeFlow(planner,db);
  try{const p=await approved(a),ad=adapter(p);const r=await Promise.allSettled([a.submit(p.id,{version:p.version,adapter:ad}),b.submit(p.id,{version:p.version,adapter:ad})]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal(ad.calls,1);}finally{a.close();b.close();fs.rmSync(dir,{recursive:true});}
});
test('X09 loss of process after persisted submit intent resumes by reconciliation only',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'agent-crash-')),db=path.join(dir,'flow.db');let f=makeFlow(planner,db);
  try{const p=await approved(f);const crashed=f.store.update(p.id,p.version,d=>{d.status='submitting';d.intentId='persisted-test-intent';});f.close();f=makeFlow(planner,db);const ad=adapter(p);await assert.rejects(f.submit(p.id,{version:crashed.version,adapter:ad}));assert.equal(ad.calls,0);assert.equal((await f.reconcile(p.id,{adapter:ad})).status,'executed');}finally{f.close();fs.rmSync(dir,{recursive:true});}
});
test('X10 expired approval during preflight is cleared before writing',async()=>{
  const f=makeFlow(planner);try{const p=await approved(f),ad=adapter(p,{async preflight(){f.now=()=> '2026-10-20T00:00:00Z';return {allocations:p.simulation.baseline.allocations};}});const r=await f.submit(p.id,{version:p.version,adapter:ad});assert.equal(r.status,'invalidated');assert.equal(r.approval,null);assert.equal(ad.calls,0);}finally{f.close();}
});
test('X11 preflight and status read failures have distinct safe states',async()=>{
  const f=makeFlow(planner);try{
    const p=await approved(f);const ad=adapter(p,{async preflight(){throw Error('read failure');}});assert.equal((await f.submit(p.id,{version:p.version,adapter:ad})).status,'invalidated');assert.equal(ad.calls,0);
    const p2=await approved(f),ad2=adapter(p2,{async status(){throw Error('read failure');}});await f.submit(p2.id,{version:p2.version,adapter:ad2});assert.equal((await f.reconcile(p2.id,{adapter:ad2})).status,'execution_unknown');
  }finally{f.close();}
});
test('X12 new analysis during preflight invalidates execution without submission',async()=>{
  const f=makeFlow(planner);try{const p=await approved(f),ad=adapter(p,{async preflight(){await f.analyze({parentId:p.analysisId,question:'가격 재검토',focus:'price'});return {allocations:p.simulation.baseline.allocations};}});const r=await f.submit(p.id,{version:p.version,adapter:ad});assert.equal(r.status,'invalidated');assert.equal(ad.calls,0);}finally{f.close();}
});
