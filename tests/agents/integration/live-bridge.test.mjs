import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRunStore,createRunRoutes,RunApiError} from '../../../backend/roas/run-api/index.mjs';
import {createRunEngine} from '../../../backend/roas/engine/index.mjs';
import {createRunPersistence,createHttpRunEngine} from '../../../backend/roas/run-integration.mjs';
import {createToolRuntime} from '../../../backend/roas/tools/index.mjs';
import {trainingScreenData} from '../../../scripts/roas/training-data.mjs';

const ORIGIN='http://127.0.0.1:5173';
const ids=()=>randomUUID();
const scope=()=>({caseId:'S16',snapshot:'initial',
  filters:{channel:'all',source:'all',campaignId:'all',device:'all'},
  dataHash:createHash('sha256').update(JSON.stringify(trainingScreenData(undefined,'S16','initial'))).digest('hex'),
  metric:'roas',screenTitle:'성과 현황'});
const sample=(overrides={})=>({question:'ROAS 조회',scope:scope(),history:[],
  threadId:ids(),clientRequestId:ids(),...overrides});
const terminal=new Set(['completed','partial','blocked','withheld','cancelled','interrupted']);
const makeCandidate=(provider,model)=>({provider,model,billingBucket:provider,transport:provider});
const candidates=[makeCandidate('gemini','mock-gemini'),makeCandidate('gateway','mock-gateway'),makeCandidate('sail','mock-sail')];

function finishFromData(input) {
  const data=input.results.find(item=>item.name==='overview')?.result;
  assert(data,'real overview must be available');
  const period=data.periods.find(item=>item.id==='current');
  const evidenceId=period.evidenceId;
  const value=period.totals.roas*100;
  return '현재 ROAS '+value.toFixed(1)+'% ['+evidenceId+']';
}
async function fixture(t,{invoke,maxModelAttemptsPerDay=60}={}) {
  const dir=mkdtempSync(join(tmpdir(),'agent-real-bridge-'));
  const store=createRunStore({dbPath:join(dir,'runs.sqlite'),maxModelAttemptsPerDay});
  const invocations=[];
  const providerPool={eligibleCandidates:({role})=>role==='quick_answer'?candidates:[],
    invokeOnce:async input=>{invocations.push(input.candidate.provider);
      return {output:await (invoke?invoke(input):finishFromData(input.input)),
        provider:input.candidate.provider,actualModel:input.candidate.model,usage:{inputTokens:15,outputTokens:23}};
    }};
  const engine=createRunEngine({providerPool,store:createRunPersistence(store),
    toolRuntimeFactory:args=>createToolRuntime(args)});
  const routes=createRunRoutes({engine:createHttpRunEngine(engine),store,
    authContext:{allowedOrigins:new Set([ORIGIN]),
      verify({req}) {
        if(req.headers['x-test-session']!=='mock-authenticated')
          throw new RunApiError('authentication_required');
        return {accountId:'qa-shared',browserId:'browser-integration'};
      }}});
  const server=http.createServer((req,res)=>{void routes.handle(req,res).then(handled=>{
    if(!handled){res.writeHead(404);res.end();}
  });});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  t.after(async()=>{
    await new Promise(resolve=>server.close(resolve));
    store.close();rmSync(dir,{recursive:true,force:true});
  });
  async function request(method,path,payload,{authenticated=true}={}) {
    const response=await fetch(base+'/agent-api/roas/runs'+path,{method,
      headers:{origin:ORIGIN,...(authenticated?{'x-test-session':'mock-authenticated'}:{}),
        ...(payload===undefined?{}:{'content-type':'application/json'})},
      ...(payload===undefined?{}:{body:JSON.stringify(payload)})});
    return {status:response.status,body:await response.json()};
  }
  async function getTerminal(runId) {
    for(let i=0;i<150;i++) {
      const reply=await request('GET','/'+runId);
      assert.equal(reply.status,200);
      if(terminal.has(reply.body.executionStatus))return reply.body;
      await new Promise(resolve=>setTimeout(resolve,12));
    }
    throw Error('run failed to reach terminal state');
  }
  return {request,getTerminal,invocations,store,engine};
}

test('real seven-tool runtime and SQLite: HTTP 202 -> model answer, restored logs, same runId',async t=>{
  const f=await fixture(t,{invoke:({input})=>{
    assert.equal(input.overviewClaims,undefined);
    return finishFromData(input);
  }});
  const request=sample();
  const denied=await f.request('POST','',request,{authenticated:false});
  assert.equal(denied.status,401);
  const accepted=await f.request('POST','',request);
  assert.equal(accepted.status,202);
  const duplicate=await f.request('POST','',request);
  assert.equal(duplicate.body.runId,accepted.body.runId);
  const result=await f.getTerminal(accepted.body.runId);
  assert.equal(result.executionStatus,'completed',JSON.stringify({status:result.executionStatus,reason:result.stopReason,events:result.events}).slice(0,1800));
  assert.equal(result.runId,accepted.body.runId);
  assert.equal(result.route,'quick');
  assert.equal(result.result?.verification,undefined);
  assert.match(result.result?.answer||'',/ROAS/);
  assert.equal(result.usage.modelAttempts,1);
  assert.deepEqual(f.invocations,['gemini']);
  assert(result.events.some(e=>e.tool==='overview'&&e.kind==='tool_result'));
  assert(result.events.some(e=>e.tool==='review_summary'&&e.kind==='tool_result'));
  assert(result.events.some(e=>e.kind==='model_success'));
  assert(!result.events.some(e=>e.kind==='verification'));
  assert(!JSON.stringify(result).includes('rawRecord'));
  assert(!JSON.stringify(result).includes('prompt'));
  const refreshed=await f.request('GET','/'+accepted.body.runId);
  assert.equal(refreshed.body.executionStatus,'completed');
  assert.equal(refreshed.body.result.answer,result.result.answer);
});

test('model text survives HTTP, SQLite and repeated reads without content validation',async t=>{
  const answer='  ROAS 999%입니다. [EV-invalid, EV-1~16]\n\n인용 없는 답변 test@example.com';
  const f=await fixture(t,{invoke:()=>answer});
  const accepted=await f.request('POST','',sample());
  const result=await f.getTerminal(accepted.body.runId);
  assert.equal(result.executionStatus,'completed');
  assert.equal(result.result.answer,answer);
  assert.equal(result.result.verification,undefined);
  assert(!result.events.some(e=>e.kind==='verification'||e.kind.startsWith('check_final_')||e.kind==='check_tool_evidence'));
  const restored=await f.request('GET','/'+accepted.body.runId);
  assert.equal(restored.body.result.answer,answer);
});

test('real SQLite bridge: same-model quota errors move directly to Gateway and Sail',async t=>{
  const f=await fixture(t,{invoke:({candidate,input})=>{
    if(candidate.provider==='gemini')throw Object.assign(Error('rate'),{code:'rate_limited'});
    if(candidate.provider==='gateway')throw Object.assign(Error('credits'),{code:'credits_exhausted'});
    return finishFromData(input);
  }});
  const accepted=await f.request('POST','',sample());
  const result=await f.getTerminal(accepted.body.runId);
  assert.equal(result.executionStatus,'completed',result.stopReason);
  assert.deepEqual(f.invocations,['gemini','gateway','sail']);
  assert.equal(result.usage.modelAttempts,3);
  assert.equal(result.events.filter(e=>e.kind==='model_error').length,2);
  assert(result.events.some(e=>e.kind==='model_attempt'&&e.provider==='sail'));
});

test('account-level model attempt cap rejects further provider calls before transport',async t=>{
  const f=await fixture(t,{maxModelAttemptsPerDay:1,
    invoke:()=>{throw Object.assign(Error('rate'),{code:'quota_exhausted'});}});
  const accepted=await f.request('POST','',sample());
  const result=await f.getTerminal(accepted.body.runId);
  assert.equal(result.executionStatus,'blocked');
  assert.equal(result.stopReason,'model_budget_exhausted');
  assert.deepEqual(f.invocations,['gemini']);
});

test('HTTP cancellation cannot be overwritten by a later model completion',async t=>{
  const f=await fixture(t,{invoke:async({input})=>{
    await new Promise(resolve=>setTimeout(resolve,100));
    return finishFromData(input);
  }});
  const accepted=await f.request('POST','',sample());
  const cancelled=await f.request('POST','/'+accepted.body.runId+'/cancel',{});
  assert.equal(cancelled.status,200);
  const result=await f.getTerminal(accepted.body.runId);
  assert.equal(result.executionStatus,'cancelled');
  assert.equal(result.result,undefined);
  await new Promise(resolve=>setTimeout(resolve,120));
  const restored=await f.request('GET','/'+accepted.body.runId);
  assert.equal(restored.body.executionStatus,'cancelled');
  assert.equal(restored.body.result,undefined);
});
