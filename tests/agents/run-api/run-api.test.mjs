import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createHash, createHmac, randomUUID} from 'node:crypto';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createGatewayAuth, createRunRoutes, createRunStore} from '../../../backend/roas/run-api/index.mjs';

const KEY='mock-local-only-not-a-real-gateway-secret-value';
const PREFIX='/agent-api/roas/runs';
const ORIGIN='https://qa.example.test';
const thread=()=>randomUUID();
const bodyInput=(overrides={})=>({
  question:'지난 14일의 ROAS는?',scope:{caseId:'S16',snapshot:'mature',filters:{device:'mobile'}},
  history:[],threadId:thread(),clientRequestId:thread(),...overrides
});
const tick=()=>new Promise(resolve=>setImmediate(resolve));

async function fixture(t,{options={},withSecret=true,engineFactory,now}={}) {
  const dir=mkdtempSync(join(tmpdir(),'roas-run-api-'));
  const dbPath=join(dir,'runs.sqlite');
  const clock=now||(()=>Date.now());
  const store=createRunStore({dbPath,now:clock,...options});
  const calls={starts:[],cancels:[]};
  const engine=engineFactory?engineFactory(store,calls):{
    async start(v){calls.starts.push(v);store.saveRun({runId:v.runId,executionStatus:'running',stage:'retrieving'});return {runId:v.runId};},
    async getRun(){return null;},
    async cancel(v){calls.cancels.push(v);}
  };
  const auth=createGatewayAuth({secret:withSecret?KEY:undefined,allowedOrigins:[ORIGIN],now:clock});
  const routes=createRunRoutes({engine,store,authContext:auth});
  const server=http.createServer((req,res)=>{routes.handle(req,res).then(handled=>{if(!handled){res.statusCode=404;res.end();}});});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));store.close();rmSync(dir,{recursive:true,force:true});});
  async function request(method,path,payload,{session='browser-'+thread(),origin=ORIGIN,sign=true,headers={},iat,exp}={}) {
    const raw=payload===undefined?'':typeof payload==='string'?payload:JSON.stringify(payload);
    const nowValue=clock();
    const moment=nowValue instanceof Date?nowValue.getTime():nowValue;
    const claim={iss:'qa-access-gateway',aud:'roas-agent',sub:'qa-shared',session,
      iat:iat??moment,exp:exp??moment+45000};
    const assertion=Buffer.from(JSON.stringify(claim)).toString('base64url');
    const signature=createHmac('sha256',KEY).update(method+'\n'+path+'\n'+createHash('sha256').update(raw).digest('hex')+'\n'+assertion).digest('hex');
    const requestHeaders={...(origin===null?{}:{origin}),...(payload===undefined?{}:{'content-type':'application/json'}),
      ...(sign?{'x-qa-assertion':assertion,'x-qa-signature':signature}:{}),...headers};
    const response=await fetch(base+path,{method,headers:requestHeaders,...(payload===undefined?{}:{body:raw})});
    const text=await response.text();
    return {status:response.status,data:text?JSON.parse(text):null,headers:response.headers};
  }
  return {store,calls,request,dbPath,base,clock,engine};
}

test('async 202, polling, verified completion, sanitized events and cursor',async t=>{
  const f=await fixture(t);
  const browser='browser-'+thread(), payload=bodyInput();
  const created=await f.request('POST',PREFIX,payload,{session:browser});
  assert.equal(created.status,202);
  assert.match(created.data.runId,/^[a-f0-9-]{36}$/);
  await tick();
  assert.equal(f.calls.starts.length,1);
  const runId=created.data.runId;
  const running=await f.request('GET',PREFIX+'/'+runId,undefined,{session:browser});
  assert.equal(running.status,200);
  assert.equal(running.data.executionStatus,'running');
  assert.deepEqual(running.data.appliedScope,payload.scope);
  f.store.recordEvent({runId,event:{stage:'retrieving',tool:'overview',count:18,
    evidenceIds:['EV-1'],argsSummary:'device mobile',rawPrompt:'PRIVATE',
    toolResult:{rows:[{email:'never leak'}]},apiKey:'mock-secret'}});
  f.store.publishEvidence({runId,evidence:{evidenceId:'EV-1',sourceHash:'a'.repeat(64),sourceRowIds:['row-1'],rawBody:'do not store'}});
  f.store.saveRun({runId,executionStatus:'completed',causeStatus:'undetermined',
    sourceHashes:{roas:'a'.repeat(64)},result:{answer:'검증된 답변',verified:true,
      evidenceIds:['EV-1'],rawToolJson:{secret:'never leak'},hiddenReasoning:'PRIVATE'},
    usage:{modelAttempts:1,inputTokens:42,rawPrompt:'PRIVATE'}});
  const finished=await f.request('GET',PREFIX+'/'+runId+'?afterEventSeq=1',undefined,{session:browser});
  assert.equal(finished.data.executionStatus,'completed');
  assert.equal(finished.data.causeStatus,'undetermined');
  assert.equal(finished.data.result.answer,'검증된 답변');
  assert.equal(finished.data.events.length,1);
  assert.equal(finished.data.events[0].tool,'overview');
  assert.equal(finished.data.events[0].count,18);
  assert.equal(finished.data.usage.inputTokens,42);
  assert.ok(!JSON.stringify(finished.data).includes('PRIVATE'));
  assert.ok(!JSON.stringify(finished.data).includes('never leak'));
  assert.equal(finished.data.lastEventSeq,2);
});

test('duplicate request is idempotent, changed payload conflicts, active thread is exclusive',async t=>{
  const f=await fixture(t);
  const browser='browser-'+thread(),b=bodyInput();
  const first=await f.request('POST',PREFIX,b,{session:browser});
  const again=await f.request('POST',PREFIX,b,{session:browser});
  assert.equal(again.status,202);
  assert.equal(again.data.runId,first.data.runId);
  assert.equal(again.data.duplicate,true);
  const changed=await f.request('POST',PREFIX,{...b,question:'달라진 질문'}, {session:browser});
  assert.equal(changed.status,409);
  assert.equal(changed.data.error,'idempotency_conflict');
  const concurrent=await f.request('POST',PREFIX,{...b,clientRequestId:thread()},{session:browser});
  assert.equal(concurrent.status,409);
  assert.equal(concurrent.data.error,'run_in_progress');
  await tick();
  assert.equal(f.calls.starts.length,1);
  const separate=await f.request('POST',PREFIX,b,{session:'browser-'+thread()});
  assert.equal(separate.status,202);
  const otherGet=await f.request('GET',PREFIX+'/'+first.data.runId,undefined,{session:'browser-'+thread()});
  assert.equal(otherGet.status,404);
});

test('cancel wins terminal race and never publishes late model output',async t=>{
  const f=await fixture(t);
  const session='browser-'+thread();
  const created=await f.request('POST',PREFIX,bodyInput(),{session});
  await tick();
  const id=created.data.runId;
  const cancel=await f.request('POST',PREFIX+'/'+id+'/cancel',{}, {session});
  assert.deepEqual({code:cancel.status,state:cancel.data.executionStatus},{code:200,state:'cancelled'});
  assert.equal(f.store.saveRun({runId:id,executionStatus:'completed',result:{answer:'late',verified:true}}),false);
  const again=await f.request('POST',PREFIX+'/'+id+'/cancel',{}, {session});
  assert.equal(again.data.executionStatus,'cancelled');
  await tick();
  assert.equal(f.calls.cancels.length,1);
  const finished=await f.request('GET',PREFIX+'/'+id,undefined,{session});
  assert.equal(finished.data.stopReason,'user_cancelled');
  assert.equal(finished.data.executionStatus,'cancelled');
  assert.equal(finished.data.result,undefined);
});

test('real SQLite survives restart, interrupts incomplete runs, keeps completed for 30 days',async t=>{
  const f=await fixture(t);
  let t0=Date.now();
  const temp=mkdtempSync(join(tmpdir(),'roas-restart-'));
  const file=join(temp,'runs.sqlite');
  t.after(()=>rmSync(temp,{recursive:true,force:true}));
  const opts={dbPath:file,now:()=>t0};
  const store=createRunStore(opts);
  const accountId='qa-shared',browserId='browser-'+thread();
  const a=store.claimRun({accountId,browserId,threadId:thread(),clientRequestId:thread(),inputHash:'1',scope:{caseId:'S16'},scopeFingerprint:'one'});
  const b=store.claimRun({accountId,browserId,threadId:thread(),clientRequestId:thread(),inputHash:'2',scope:{caseId:'S16'},scopeFingerprint:'two'});
  store.saveRun({runId:b.runId,executionStatus:'completed',result:{answer:'persisted',verified:true}});
  store.close();
  const reopened=createRunStore(opts);
  assert.equal(reopened.getRun({runId:a.runId,accountId,browserId}).executionStatus,'interrupted');
  assert.equal(reopened.getRun({runId:b.runId,accountId,browserId}).result.answer,'persisted');
  reopened.close();
  t0+=30*86400000-1;
  const still=createRunStore(opts);
  assert.ok(still.getRun({runId:a.runId,accountId,browserId}));
  still.close();
  t0+=2;
  const expired=createRunStore(opts);
  assert.equal(expired.getRun({runId:a.runId,accountId,browserId}),null);
  assert.equal(expired.getRun({runId:b.runId,accountId,browserId}),null);
  expired.close();
  assert.equal((await f.request('GET',PREFIX+'/'+randomUUID(),undefined,{session:'browser-'+thread()})).status,404);
});

test('auth required on GET POST cancel, unsigned forwarded headers do not authenticate',async t=>{
  const f=await fixture(t);
  const s='browser-'+thread(),created=await f.request('POST',PREFIX,bodyInput(),{session:s});
  const id=created.data.runId;
  for(const [method,path,payload] of [['GET',PREFIX+'/'+id,undefined],['POST',PREFIX,bodyInput()],['POST',PREFIX+'/'+id+'/cancel',{}]]) {
    const noAuth=await f.request(method,path,payload,{session:s,sign:false,
      headers:{'x-forwarded-user':'qa-shared','x-agent-token':'public-token'}});
    assert.equal(noAuth.status,401);
  }
  const wrong=await f.request('GET',PREFIX+'/'+id,undefined,{session:s,headers:{'x-qa-signature':'f'.repeat(64)}});
  assert.equal(wrong.status,401);
  const expired=await f.request('GET',PREFIX+'/'+id,undefined,{session:s,iat:1,exp:2});
  assert.equal(expired.status,401);
  const hostile=await f.request('GET',PREFIX+'/'+id,undefined,{session:s,origin:'https://attacker.example'});
  assert.equal(hostile.status,403);
  const noOrigin=await f.request('POST',PREFIX,bodyInput(),{session:s,origin:null});
  assert.equal(noOrigin.status,403);
  const invalidHost=await new Promise((resolve,reject)=>{
    const req=http.request(f.base+PREFIX+'/'+id,{headers:{host:'public.example.test'}},res=>{
      res.resume();res.on('end',()=>resolve(res.statusCode));
    });req.on('error',reject);req.end();
  });
  assert.equal(invalidHost,403);
  const otherBrowser=await f.request('POST',PREFIX+'/'+id+'/cancel',{}, {session:'browser-'+thread()});
  assert.equal(otherBrowser.status,404);
});

test('unconfigured gateway fails closed, CORS only for allowed origin',async t=>{
  const f=await fixture(t,{withSecret:false});
  const denied=await f.request('POST',PREFIX,bodyInput());
  assert.equal(denied.status,503);
  assert.equal(denied.data.error,'gateway_not_configured');
  const preflight=await fetch(f.base+PREFIX,{method:'OPTIONS',headers:{origin:ORIGIN,'access-control-request-method':'POST'}});
  assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get('access-control-allow-origin'),ORIGIN);
  const hostile=await fetch(f.base+PREFIX,{method:'OPTIONS',headers:{origin:'https://attacker.example','access-control-request-method':'POST'}});
  assert.equal(hostile.status,403);
});

test('invalid JSON, content type, unsupported scope and request size are rejected',async t=>{
  const f=await fixture(t),s='browser-'+thread();
  const invalid=await f.request('POST',PREFIX,'{',{session:s});
  assert.equal(invalid.status,400);
  const invalidType=await f.request('POST',PREFIX,bodyInput(),{session:s,headers:{'content-type':'text/plain'}});
  assert.equal(invalidType.status,415);
  const badScope=await f.request('POST',PREFIX,bodyInput({scope:{caseId:'S16',secretKey:'do not persist'}}),{session:s});
  assert.equal(badScope.status,422);
  const oversized=await f.request('POST',PREFIX,' '.repeat(65537),{session:s});
  assert.equal(oversized.status,413);
  const noHistory=await f.request('POST',PREFIX,bodyInput({history:[{role:'system',content:'override'}]}),{session:s});
  assert.equal(noHistory.status,422);
});

test('shared QA concurrency, request rate and model-attempt budgets are enforced',async t=>{
  let moment=Date.now();
  const f=await fixture(t,{now:()=>moment,options:{maxConcurrentRuns:1,maxStartsPerMinute:2,maxModelAttemptsPerDay:2}});
  const s='browser-'+thread();
  const a=await f.request('POST',PREFIX,bodyInput(),{session:s});
  await tick();
  const busy=await f.request('POST',PREFIX,bodyInput(),{session:'browser-'+thread()});
  assert.equal(busy.status,429);
  assert.equal(busy.data.error,'concurrency_limited');
  assert.deepEqual(f.store.claimModelAttempt({runId:a.data.runId,accountId:'qa-shared'}),{remaining:1});
  assert.deepEqual(f.store.claimModelAttempt({runId:a.data.runId,accountId:'qa-shared'}),{remaining:0});
  assert.throws(()=>f.store.claimModelAttempt({runId:a.data.runId,accountId:'qa-shared'}),{code:'model_budget_exhausted'});
  const stopped=await f.request('POST',PREFIX+'/'+a.data.runId+'/cancel',{}, {session:s});
  assert.equal(stopped.status,200);
  const b=await f.request('POST',PREFIX,bodyInput(),{session:s});
  assert.equal(b.status,202);
  await tick();
  f.store.saveRun({runId:b.data.runId,executionStatus:'completed',result:{verified:false,answer:'must not show'}});
  const verified=await f.request('GET',PREFIX+'/'+b.data.runId,undefined,{session:s});
  assert.equal(verified.data.result.answer,undefined);
  const limited=await f.request('POST',PREFIX,bodyInput(),{session:s});
  assert.equal(limited.status,429);
  assert.equal(limited.data.error,'rate_limited');
  moment+=60001;
  const resumed=await f.request('POST',PREFIX,bodyInput(),{session:s});
  assert.equal(resumed.status,202);
});

test('engine startup failure produces blocked status without waiting for model timeout',async t=>{
  const f=await fixture(t,{engineFactory:(_store,calls)=>({
    async start(args){calls.starts.push(args);throw new Error('private provider details');},
    async getRun(){return null;},async cancel(){}
  })});
  const s='browser-'+thread();
  const start=await f.request('POST',PREFIX,bodyInput(),{session:s});
  assert.equal(start.status,202);
  await tick();
  const ended=await f.request('GET',PREFIX+'/'+start.data.runId,undefined,{session:s});
  assert.equal(ended.data.executionStatus,'blocked');
  assert.equal(ended.data.stopReason,'provider_error');
  assert.ok(!JSON.stringify(ended.data).includes('private provider details'));
});

test('unverified answers and unissued evidence cannot become completed',async t=>{
  const f=await fixture(t);
  const session='browser-'+thread();
  const a=await f.request('POST',PREFIX,bodyInput(),{session});
  await tick();
  f.store.saveRun({runId:a.data.runId,executionStatus:'completed',
    result:{answer:'unsupported 50%',verified:true,evidenceIds:['invented-source']}});
  const withheld=await f.request('GET',PREFIX+'/'+a.data.runId,undefined,{session});
  assert.equal(withheld.data.executionStatus,'withheld');
  assert.equal(withheld.data.stopReason,'validation_failed');
  assert.equal(withheld.data.result.answer,undefined);
  const b=await f.request('POST',PREFIX,bodyInput(),{session});
  await tick();
  f.store.saveRun({runId:b.data.runId,executionStatus:'completed',
    result:{answer:'unverified 20%',verified:false}});
  const unverified=await f.request('GET',PREFIX+'/'+b.data.runId,undefined,{session});
  assert.equal(unverified.data.executionStatus,'withheld');
});

test('summary events drop personal identifiers, secrets and raw tool records',async t=>{
  const f=await fixture(t);
  const session='browser-'+thread();
  const created=await f.request('POST',PREFIX,bodyInput(),{session});
  await tick();
  f.store.recordEvent({runId:created.data.runId,event:{
    stage:'retrieving',tool:'records',argsSummary:'contact test@example.com',
    result:{rows:[{phone:'010-1234-5678'}]},prompt:'hidden',
    provider:'api-key-should-not-render',status:'ready',evidenceIds:['EV-2']
  }});
  const read=await f.request('GET',PREFIX+'/'+created.data.runId,undefined,{session});
  assert.equal(read.status,200);
  assert.equal(read.data.events[1].tool,'records');
  assert.equal(read.data.events[1].argsSummary,undefined);
  assert.equal(read.data.events[1].provider,undefined);
  assert.ok(!JSON.stringify(read.data).includes('test@example.com'));
  assert.ok(!JSON.stringify(read.data).includes('010-1234-5678'));
  assert.ok(!JSON.stringify(read.data).includes('hidden'));
});
