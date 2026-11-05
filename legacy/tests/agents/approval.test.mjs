import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {makeFlow,planner,proposed,approved,adapter,principal,tools,clock} from './support.mjs';

test('P01 pending approval and exact simulation survive database close/reopen',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'marketing-agent-'));const db=path.join(dir,'flow.sqlite');
  let f=makeFlow(planner,db);try{
    const p=await proposed(f);f.close();f=makeFlow(planner,db);assert.deepEqual(f.get(p.id),p);
    const a=f.approve(p.id,{version:p.version,principal,expiresAt:'2026-10-19T00:00:00Z'});assert.equal(a.status,'approved');
  }finally{f.close();fs.rmSync(dir,{recursive:true});}
});
for(const [id,options,code] of [
  ['P02',{principal:{id:'wrong',role:'viewer'}},'approval_forbidden'],
  ['P03',{expiresAt:'2026-10-17T00:00:00Z'},'approval_expired'],
  ['P04',{version:0},'version_conflict']]){
  test(`${id} rejects invalid approval: ${code}`,async()=>{
    const f=makeFlow(planner);try{const p=await proposed(f);assert.throws(()=>f.approve(p.id,{version:p.version,principal,expiresAt:'2026-10-19T00:00:00Z',...options}),e=>e.code===code);assert.equal(f.get(p.id).status,'pending_approval');}finally{f.close();}
  });
}
test('P05 changed scenario/assumption invalidates old approval and requires new approval',async()=>{
  const f=makeFlow(planner);try{
    const p=await approved(f);const inputs=tools.call('budget_inputs',{},p.scope);
    const revised=f.revise(p.id,{version:p.version,candidateId:inputs.scenarios[2].record_id,modelId:inputs.models[1].record_id});
    assert.equal(f.get(p.id).status,'invalidated');assert.equal(revised.status,'pending_approval');assert.equal(revised.approval,null);
    assert.notEqual(revised.simulation.id,p.simulation.id);assert.notEqual(revised.simulation.baseline.expected,p.simulation.baseline.expected);
    await assert.rejects(f.submit(p.id,{version:p.version,adapter:adapter(p)}));
  }finally{f.close();}
});
test('P06 cannot submit without approval or through a live adapter',async()=>{
  const f=makeFlow(planner);try{const p=await proposed(f);await assert.rejects(f.submit(p.id,{version:p.version,adapter:adapter(p)}),e=>e.code==='approval_required');const a=await approved(f);await assert.rejects(f.submit(a.id,{version:a.version,adapter:adapter(a,{mode:'live'})}),e=>e.code==='real_execution_forbidden');}finally{f.close();}
});
test('X01 submit once, reconcile exact applied values, then complete',async()=>{
  const f=makeFlow(planner);try{const p=await approved(f),ad=adapter(p);const s=await f.submit(p.id,{version:p.version,adapter:ad});assert.equal(s.status,'submitted');assert.equal(ad.calls,1);const done=await f.reconcile(p.id,{adapter:ad});assert.equal(done.status,'executed');await assert.rejects(f.submit(p.id,{version:done.version,adapter:ad}));assert.equal(ad.calls,1);}finally{f.close();}
});
test('X02 preflight drift invalidates approval without submission',async()=>{
  const f=makeFlow(planner);try{const p=await approved(f),ad=adapter(p,{async preflight(){return {allocations:[]};}});const r=await f.submit(p.id,{version:p.version,adapter:ad});assert.equal(r.status,'invalidated');assert.equal(r.reason,'baseline_drift');assert.equal(ad.calls,0);}finally{f.close();}
});
test('X03 submit timeout is unknown, blocked from retry; later reconcile can recover',async()=>{
  const f=makeFlow(planner);try{const p=await approved(f);let calls=0;const ad=adapter(p,{async submit(){calls++;throw Error('lost response');}});const r=await f.submit(p.id,{version:p.version,adapter:ad});assert.equal(r.status,'execution_unknown');await assert.rejects(f.submit(p.id,{version:r.version,adapter:ad}));assert.equal(calls,1);assert.equal((await f.reconcile(p.id,{adapter:ad})).status,'executed');}finally{f.close();}
});
test('X04 provider success without exact applied values is never completed',async()=>{
  const f=makeFlow(planner);try{const p=await approved(f),ad=adapter(p,{async status(){return {status:'applied',allocations:[]};}});await f.submit(p.id,{version:p.version,adapter:ad});assert.equal((await f.reconcile(p.id,{adapter:ad})).status,'execution_unknown');}finally{f.close();}
});
test('X05 partial and failed results stay distinct from complete',async()=>{
  for(const [status,expected] of [['partial','partial_execution'],['failed','execution_failed'],['pending','submitted']]){
    const f=makeFlow(planner);try{const p=await approved(f),ad=adapter(p,{async status(){return {status};}});await f.submit(p.id,{version:p.version,adapter:ad});assert.equal((await f.reconcile(p.id,{adapter:ad})).status,expected);}finally{f.close();}
  }
});
test('X06 concurrent submissions cannot perform two writes',async()=>{
  const f=makeFlow(planner);try{const p=await approved(f),ad=adapter(p);const results=await Promise.allSettled([f.submit(p.id,{version:p.version,adapter:ad}),f.submit(p.id,{version:p.version,adapter:ad})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(ad.calls,1);}finally{f.close();}
});
test('X07 expired approval and changed data fingerprint block execution',async()=>{
  const f=makeFlow(planner);try{
    const p=await approved(f);f.now=()=> '2026-10-20T00:00:00Z';await assert.rejects(f.submit(p.id,{version:p.version,adapter:adapter(p)}),e=>e.code==='approval_expired');
    f.now=clock;f.tools={...tools,fingerprint:'changed'};await assert.rejects(f.submit(p.id,{version:p.version,adapter:adapter(p)}),e=>e.code==='inputs_changed');
  }finally{f.close();}
});
