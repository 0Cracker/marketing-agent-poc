import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveRuntime} from '../../backend/agent-runtime.mjs';

const env={GEMINI_API_KEY_1:'unit-test-first',GEMINI_API_KEY_2:'unit-test-second'};
const answer=()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:'{"tool":"market_compare","args":{}}'}]}}]}));
test('R01 numbered keys use explicit or first numeric slot, with role models and no secret metadata',async()=>{
  const calls=[];const runtime=createLiveRuntime({env:{...env,AGENT_KEY_NAME:'GEMINI_API_KEY_2'},fetchImpl:async(url,init)=>{calls.push({url,key:init.headers['x-goog-api-key']});return answer();}});
  await runtime.model({role:'analysis'});await runtime.model({role:'budget'});
  assert.ok(calls[0].url.includes('gemini-3.5-flash-lite'));assert.ok(calls[1].url.includes('gemini-3.8-flash'));
  assert.ok(calls.every(c=>c.key===env.GEMINI_API_KEY_2));assert.ok(!JSON.stringify(runtime.info).includes('unit-test'));
  assert.throws(()=>createLiveRuntime({env:{}}),e=>e.code==='provider_configuration');
  assert.throws(()=>createLiveRuntime({env:{...env,AGENT_KEY_NAME:'OTHER_KEY'}}),e=>e.code==='provider_configuration');
});
test('R02 pacing is shared by roles on one model; 429 never rotates credentials or retries',async()=>{
  const calls=[],waits=[];let clock=0;
  const runtime=createLiveRuntime({env:{...env,AGENT_BUDGET_MODEL:'gemini-3.5-flash-lite'},now:()=>clock,wait:async ms=>{waits.push(ms);clock+=ms;},fetchImpl:async(url,init)=>{calls.push(init.headers['x-goog-api-key']);return calls.length===1?answer():new Response('{}',{status:429});}});
  await runtime.model({role:'analysis'});await assert.rejects(runtime.model({role:'budget'}),e=>e.code==='quota_exhausted');
  assert.equal(calls.length,2);assert.deepEqual(calls,[env.GEMINI_API_KEY_1,env.GEMINI_API_KEY_1]);assert.ok(waits[0]>=4000);
});
test('R03 Gemma selection is explicit and rejects oversized context before network',async()=>{
  let calls=0;const runtime=createLiveRuntime({env:{...env,AGENT_ANALYSIS_MODEL:'gemma-4-26b-a4b-it'},fetchImpl:async()=>{calls++;return answer();}});
  await assert.rejects(runtime.model({role:'analysis',question:'x'.repeat(13000)}),e=>e.code==='model_context_limit');assert.equal(calls,0);
  assert.throws(()=>createLiveRuntime({env:{...env,AGENT_ANALYSIS_MODEL:'unknown'}}),e=>e.code==='provider_configuration');
});

test('R04 verification diagnostics retain status and usage without credentials or response text',async()=>{
  const diagnostics=[];
  const runtime=createLiveRuntime({env,onDiagnostic:item=>diagnostics.push(item),fetchImpl:async()=>new Response(JSON.stringify({error:{status:'UNAVAILABLE',message:env.GEMINI_API_KEY_1}}),{status:503})});
  await assert.rejects(runtime.model({role:'analysis'}),e=>e.code==='model_failed');
  assert.equal(diagnostics.length,1);assert.equal(diagnostics[0].httpStatus,503);assert.equal(diagnostics[0].errorStatus,'UNAVAILABLE');assert(!JSON.stringify(diagnostics).includes('unit-test'));
});
