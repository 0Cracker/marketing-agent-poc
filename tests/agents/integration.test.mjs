import test from 'node:test';
import assert from 'node:assert/strict';
import {demo} from '../../scripts/agent-demo.mjs';
import {cents} from '../../backend/agent-tools.mjs';
import {makeFlow,planner,analyzed,scope,tools} from './support.mjs';

test('E01 end-to-end offline demo: actual catalog -> analysis -> budget -> followup invalidation',async()=>{
  const r=await demo();assert.equal(r.mode,'offline_model_substitute');assert.equal(r.externalModelCalls,0);assert.equal(r.realAdsCalls,0);assert.equal(r.newSourceRows,0);
  assert.equal(r.analysis.status,'analyzed');assert.equal(r.proposal.statusAtCreation,'pending_approval');assert.equal(r.proposal.statusAfterFollowup,'invalidated');assert.equal(r.followup.status,'analyzed');
  assert.ok(r.analysis.output.facts.length&&r.followup.output.hypotheses.length);
});
test('E02 exact money avoids binary float rounding and rejects invalid/missing amounts',()=>{
  assert.equal(cents('0.29')+cents('0.01'),30n);assert.equal(cents('9007199254740993.01'),900719925474099301n);
  for(const value of [null,undefined,'-1','1e3','NaN','1.001',0.29,''])assert.throws(()=>cents(value),e=>e.code==='money_invalid');
});
test('E03 month share independently equals raw numerator / denominator',()=>{
  const result=tools.call('market_compare',{},scope);
  for(const f of result.facts.filter(f=>f.field==='share')){
    const numerator=result.facts.find(x=>x.recordId===f.recordId&&x.field==='sales_value');
    const denominator=result.facts.find(x=>x.recordId===f.recordId&&x.field==='market_total_value');
    assert.ok(Math.abs(Number(f.value)-Number(numerator.value)/Number(denominator.value))<=0.0000005);
  }
});
test('Q03 quality reader failure becomes explicit held state, no model call',async()=>{
  const f=makeFlow(()=>{throw Error('must not run');},':memory:',{tools:{fingerprint:tools.fingerprint,validateScope:s=>tools.validateScope(s),quality(){throw Error('quality store unavailable');}}});
  try{const r=await analyzed(f);assert.equal(r.status,'held');assert.equal(r.reason,'quality_failed');assert.equal(r.modelCalls,0);}finally{f.close();}
});
test('B09 budget cannot finish while its referenced analysis is superseded',async()=>{
  let flow;flow=makeFlow(async c=>{
    if(c.role==='budget'&&c.history.length===2){const a=flow.store.list().find(x=>x.role==='analysis');await flow.analyze({parentId:a.id,question:'가격 재검토',focus:'price'});}
    return planner(c);
  });
  try{const a=await analyzed(flow);const r=await flow.budget({analysisId:a.id,analysisVersion:a.version,userSelected:true});assert.equal(r.status,'invalidated');}finally{flow.close();}
});
