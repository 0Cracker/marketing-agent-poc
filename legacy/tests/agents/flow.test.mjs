import test from 'node:test';
import assert from 'node:assert/strict';
import {makeFlow,planner,analyzed,proposed,scope,tools} from './support.mjs';

test('F01 real tools run inside bounded analysis loop, before validated finish',async()=>{
  const f=makeFlow(planner);try{
    const r=await analyzed(f);assert.equal(r.status,'analyzed');assert.equal(r.role,'analysis');
    assert.ok(r.output.facts.length&&r.output.hypotheses[0].counters.length);
    assert.deepEqual(r.events.filter(e=>e.type==='tool').map(e=>e.name),['market_compare','relations']);
    assert.equal(r.output.causalEffect,null);assert.equal(r.modelCalls,3);
  }finally{f.close();}
});
test('F02 ambiguous question/scope asks for scope before model or tools',async()=>{
  const f=makeFlow(()=>{throw Error('must not run');});try{
    const r=await f.analyze({question:'왜 밀리지?'});assert.equal(r.status,'needs_scope');assert.equal(r.modelCalls,0);
  }finally{f.close();}
});
test('F03 unavailable-asOf data blocks model and returns restart conditions',async()=>{
  const f=makeFlow(()=>{throw Error('must not run');});try{
    const r=await f.analyze({question:'원인 확인',scope:{...scope,asOf:'2026-10-16T00:00:00Z'}});
    assert.equal(r.status,'held');assert.equal(r.reason,'data_unavailable');assert.ok(r.resumeConditions.length);
  }finally{f.close();}
});
for(const [id,response,reason] of [
  ['F04',()=>({tool:'submit',args:{}}),'tool_forbidden'],
  ['F05',()=>({finish:{facts:['invented'],hypotheses:[],recommendation:'investigate'}}),'unsupported_fact'],
  ['F06',()=>({text:'가격이 원인이다'}),'model_protocol'],
  ['F07',()=>({tool:'market_compare',args:{country:'JP'}}),'tool_arguments'],
  ['F08',()=>({tool:'market_compare',args:{}}),'call_limit']]){
  test(`${id} invalid/looping model is held at ${reason}`,async()=>{
    const f=makeFlow(response);try{const r=await analyzed(f);assert.equal(r.status,'held');assert.equal(r.reason,reason);assert.ok(r.modelCalls<=6);}finally{f.close();}
  });
}
test('F09 causal assertion and omitted counterevidence fail output gate',async()=>{
  for(const mode of ['causal','omit']){
    const f=makeFlow(c=>{const r=planner(c);if(r.finish){if(mode==='causal')r.finish.hypotheses[0].causal=true;else r.finish.hypotheses[0].counters=[];}return r;});
    try{const r=await analyzed(f);assert.equal(r.status,'held');assert.equal(r.reason,mode==='causal'?'causal_claim_forbidden':'counterevidence_omitted');}finally{f.close();}
  }
});
test('F10 tool failure is recorded and cannot become a successful report',async()=>{
  const f=makeFlow(planner,':memory:',{tools:{validateScope:s=>tools.validateScope(s),quality:s=>tools.quality(s),fingerprint:tools.fingerprint,call(){throw Error('injected read failure');}}});
  try{const r=await analyzed(f);assert.equal(r.status,'held');assert.equal(r.reason,'tool_failed');assert.ok(!r.output);}finally{f.close();}
});
test('F11 followup preserves scope, makes new analysis, invalidates dependent proposal',async()=>{
  const f=makeFlow(planner);try{
    const p=await proposed(f);const a=await f.analyze({question:'그중 가격 영향만 다시 봐줘',parentId:p.analysisId,focus:'price'});
    assert.equal(a.status,'analyzed');assert.deepEqual(a.scope,scope);assert.notEqual(a.id,p.analysisId);
    assert.equal(f.get(p.id).status,'invalidated');
  }finally{f.close();}
});
test('F12 missing followup reference asks for clarification',async()=>{
  const f=makeFlow(planner);try{const r=await f.analyze({question:'그중 가격',parentId:'missing'});assert.equal(r.status,'needs_scope');}finally{f.close();}
});
test('B04 budget handoff needs user choice, valid analysis and exact analysis version',async()=>{
  const f=makeFlow(planner);try{
    const a=await analyzed(f);
    for(const req of [{analysisId:a.id,analysisVersion:a.version,userSelected:false},{analysisId:a.id,analysisVersion:0,userSelected:true},{analysisId:'missing',analysisVersion:1,userSelected:true}]){
      await assert.rejects(f.budget(req),e=>['user_choice_required','analysis_stale'].includes(e.code));
    }
  }finally{f.close();}
});
test('B05 valid budget loop proposes versioned simulation, never automatic execution',async()=>{
  const f=makeFlow(planner);try{const p=await proposed(f);assert.equal(p.status,'pending_approval');assert.ok(p.simulation.id);assert.equal(p.approval,null);assert.equal(p.realExecutionAllowed,false);}finally{f.close();}
});
test('B06 budget role cannot call analysis tools or silently switch roles',async()=>{
  const f=makeFlow(c=>c.role==='budget'?{tool:'relations',args:{candidate:'price'}}:planner(c));
  try{const p=await proposed(f);assert.equal(p.status,'held');assert.equal(p.reason,'tool_forbidden');}finally{f.close();}
});
test('B07 missing simulation and invented final metrics are rejected',async()=>{
  const f=makeFlow(c=>c.role==='budget'?{finish:{simulationId:'invented',action:'reallocate',expected:999}}:planner(c));
  try{const p=await proposed(f);assert.equal(p.status,'held');assert.ok(['simulation_required','model_protocol'].includes(p.reason));}finally{f.close();}
});
test('B08 hold is a valid budget outcome and cannot enter approval',async()=>{
  const f=makeFlow(c=>{const r=planner(c);if(c.role==='budget'&&r.finish)r.finish.action='hold';return r;});
  try{const p=await proposed(f);assert.equal(p.status,'retained');assert.equal(p.output.action,'hold');}finally{f.close();}
});
