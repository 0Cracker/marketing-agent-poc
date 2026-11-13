import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {trainingScreenData} from '../../../scripts/roas/training-data.mjs';
import {createAgentClient} from '../../../frontend/roas/agent-client.ts';

const root=new URL('../../../',import.meta.url);
const origin='http://127.0.0.1:5173';
async function freePort() {
  const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');
  const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));return port;
}
async function serve(port,dbPath,tracePort) {
  const env={...process.env,AGENT_PORT:String(port),AGENT_DB_PATH:dbPath,
    AGENT_UI_ORIGINS:origin,AGENT_TRACE_PORT:String(tracePort),AGENT_ENV_DIR:dirname(dbPath)};
  const child=spawn(process.execPath,['scripts/roas/agent-server.mjs','--mock'],
    {cwd:root,env,stdio:['ignore','pipe','pipe']});
  let errors='';
  child.stderr.on('data',chunk=>{errors+=chunk.toString();});
  await Promise.race([
    new Promise(resolve=>{
      child.stdout.on('data',chunk=>{
        if(chunk.toString().includes('/agent-trace'))resolve();
      });
    }),
    once(child,'exit').then(([code])=>{throw Error('mock exited '+code+': '+errors);}),
    new Promise((_,reject)=>setTimeout(()=>reject(Error('mock startup timeout '+errors)),8000).unref())
  ]);
  return child;
}
async function stop(child) {
  if(child.exitCode!==null)return;
  const exit=once(child,'exit');child.kill('SIGTERM');await exit;
}
test('actual local server: no-Origin GET, mocked completion, restart recovery, and no external API',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'roas-agent-local-'));
  const dbPath=join(directory,'runs.sqlite');
  const port=await freePort(),base='http://127.0.0.1:'+port+'/agent-api';
  const tracePort=await freePort(),traceBase='http://127.0.0.1:'+tracePort;
  let child=await serve(port,dbPath,tracePort);
  t.after(async()=>{await stop(child);rmSync(directory,{recursive:true,force:true});});
  const session1=await (await fetch(base+'/session')).json();
  assert.equal(session1.mode,'offline_model_substitute');
  const traceSessionPath=traceBase+'/agent-api/session';
  const traceOrigin=traceBase;
  assert.equal((await fetch(traceSessionPath,{headers:{origin}})).status,403);
  assert.equal((await fetch(traceSessionPath,{headers:{'sec-fetch-site':'same-site'}})).status,403);
  const traceClient=createAgentClient(fetch,traceBase+'/agent-api');
  const traceSession=await traceClient.session();
  assert.equal(traceSession.mode,session1.mode);
  assert.equal(traceSession.realAdsEnabled,false);
  assert.notEqual(traceSession.token,session1.token);
  const data=trainingScreenData(undefined,'S16','initial');
  assert.deepEqual(await (await fetch(traceBase+'/agent-trace/data')).json(),data);
  const scope={caseId:'S16',snapshot:'initial',metric:'roas',screenTitle:'성과 현황',
    filters:{channel:'all',source:'all',campaignId:'all',device:'all'},
    dataHash:createHash('sha256').update(JSON.stringify(data)).digest('hex')};
  const request={question:'현재 ROAS 알려줘',scope,history:[],
    threadId:randomUUID(),clientRequestId:randomUUID()};
  const traceRuns=traceBase+'/agent-api/roas/runs';
  const post=(token,requestOrigin)=>fetch(traceRuns,{method:'POST',headers:{
    origin:requestOrigin,'content-type':'application/json','x-agent-token':token},body:JSON.stringify(request)});
  assert.equal((await post(traceSession.token,origin)).status,403);
  assert.equal((await post(session1.token,traceOrigin)).status,401);
  const begin=await post(traceSession.token,traceOrigin);
  assert.equal(begin.status,202,await begin.clone().text());
  const {runId}=await begin.json();
  assert.equal((await traceClient.getRoasRun(runId)).runId,runId);
  let completed;
  for(let i=0;i<80;i++) {
    const poll=await fetch(base+'/roas/runs/'+runId,{headers:{'x-agent-token':session1.token}});
    assert.equal(poll.status,200,'GET does not require Origin');
    completed=await poll.json();
    if(completed.executionStatus==='completed')break;
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  assert.equal(completed.executionStatus,'completed',completed.stopReason);
  assert(completed.events.some(e=>e.kind==='model_success'&&e.provider==='mock'));
  assert.match(completed.result.answer,/ROAS/);
  assert.equal(completed.result.verification,undefined);
  const page=await fetch(traceBase+'/agent-trace');
  assert.equal(page.status,200);
  const markup=await page.text();
  assert.match(markup,/원본 보기/);
  assert.match(markup,/aria-label="최근 실행 목록"/);
  assert.doesNotMatch(markup,/실행 ID로 찾기|run-lookup/);
  assert.match(markup,/<iframe[^>]+src="\/agent-trace\/chat"/);
  const navigation={'sec-fetch-site':'cross-site'};
  assert.equal((await fetch(traceBase+'/agent-trace',{headers:navigation})).status,200);
  assert.equal((await fetch(traceBase+'/agent-trace/runs',{headers:navigation})).status,403);
  assert.equal((await fetch(traceBase+'/agent-trace/runs',{headers:{origin}})).status,403);
  assert.equal((await fetch(traceBase+'/agent-trace/runs',{headers:{'sec-fetch-site':'same-site'}})).status,403);
  assert.equal((await fetch(base+'/../agent-trace/runs')).status,403);
  const recent=await (await fetch(traceBase+'/agent-trace/runs')).json();
  assert.equal(recent[0].runId,runId);
  assert.equal(recent[0].caseId,'S16');
  assert.equal(recent[0].route,'quick');
  assert.equal(recent[0].startedAt,completed.startedAt);
  const trace=await (await fetch(traceBase+'/agent-trace/runs/'+runId+'?afterEventSeq=1')).json();
  assert.deepEqual(trace.events,completed.events.slice(1));
  assert(!trace.events.some(e=>e.kind.startsWith('check_final_')||e.kind==='verification'));
  assert.equal(trace.route,'quick');
  assert.equal(trace.scope.caseId,'S16');
  assert.match(trace.publishedAnswer,/ROAS/);
  assert.match(trace.events.find(e=>e.kind==='tool_result'&&e.tool==='overview').argsSummary,/직전 ROAS .*현재 ROAS/);
  assert.equal(completed.usage.modelAttempts,2);
  assert.equal(completed.result.sections,undefined);
  assert(!trace.events.some(e=>e.kind==='tool_result'&&e.tool==='review_summary'));
  const original=await (await fetch(traceBase+'/agent-trace/runs/'+runId+'/original')).json();
  assert.equal(JSON.parse(original[0]).kind,'accepted');
  const denied=await fetch(base+'/roas/runs/'+runId);
  assert.equal(denied.status,401);
  await stop(child);
  child=await serve(port,dbPath,tracePort);
  const session2=await (await fetch(base+'/session')).json();
  assert.notEqual(session2.token,session1.token);
  const restored=await fetch(base+'/roas/runs/'+runId,{headers:{'x-agent-token':session2.token}});
  assert.equal(restored.status,200);
  const state=await restored.json();
  assert.equal(state.executionStatus,'completed');
  assert.equal(state.result.answer,completed.result.answer);
  assert.equal(state.events.length,completed.events.length);
});
