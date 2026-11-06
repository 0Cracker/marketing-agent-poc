import fs from 'node:fs';
import path from 'node:path';
import {parseEnv} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
import {setTimeout as wait} from 'node:timers/promises';
import {createAgentServer} from '../../../backend/roas/agent-http.mjs';
import {createProviderPool} from '../../../backend/roas/providers/index.mjs';
import {createRunEngine} from '../../../backend/roas/engine/index.mjs';
import {createToolRuntime} from '../../../backend/roas/tools/index.mjs';
import {createRunStore,createRunRoutes,RunApiError} from '../../../backend/roas/run-api/index.mjs';
import {createRunPersistence,createHttpRunEngine} from '../../../backend/roas/run-integration.mjs';
import {trainingScreenData} from '../training-data.mjs';

if(!process.argv.includes('--live'))throw Error('Pass --live to make real Jev and generation calls.');
const root=path.resolve(import.meta.dirname,'../../..');
const reportDirectory=path.join(root,'evidence','jev-e2e-20261106');
fs.mkdirSync(reportDirectory,{recursive:true});
const reportPath=path.join(reportDirectory,'run-'+Date.now()+'.json');
const env={...process.env};
for(const name of ['.env.local','.env']) {
  const filename=path.join(root,name);
  if(fs.existsSync(filename))for(const [key,value] of Object.entries(parseEnv(fs.readFileSync(filename,'utf8'))))
    if(!env[key])env[key]=value;
}
const report={startedAt:new Date().toISOString(),mode:'real_models_http_sqlite_tools',attempts:[],runs:[]};
const serve=process.argv.includes('--serve');
const save=()=>fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
let active;
const pool=createProviderPool({env});
const providerPool={providerStatus:pool.providerStatus,eligibleCandidates:pool.eligibleCandidates,
  async invokeOnce(params) {
    const attempt={at:new Date().toISOString(),provider:params.candidate.provider,model:params.candidate.model,
      format:params.format,instruction:params.instruction,input:params.input};
    report.attempts.push(attempt);active.attempts.push(report.attempts.length-1);save();
    const start=Date.now();
    try {
      const response=await pool.invokeOnce(params);
      attempt.response=response;
      console.log(JSON.stringify({kind:'model_response',provider:attempt.provider,format:attempt.format,
        output:params.format==='jev'?response.output:response.output?.slice(0,250)}));
      return response;
    } catch(error) {
      attempt.errorCode=error.code||'unknown';
      console.log(JSON.stringify({kind:'model_error',provider:attempt.provider,errorCode:attempt.errorCode}));
      throw error;
    } finally {attempt.elapsedMs=Date.now()-start;save();}
  }};
const store=createRunStore({dbPath:':memory:'});
const persistence=createRunPersistence(store);
const engine=createRunEngine({workflow:'jev',providerPool,store:{...persistence,async updateRun(state) {
  await persistence.updateRun(state);
  if(serve&&active) {
    active.state=store.getRun({runId:state.runId,accountId:'qa-e2e',browserId:'local-e2e'});
    active.elapsedMs=Date.now()-active.started;
    save();
  }
}},
  toolRuntimeFactory:async input=>{
    const runtime=await createToolRuntime(input);
    return {...runtime,async execute(job) {
      const entry={at:new Date().toISOString(),job};active.tools.push(entry);
      const start=Date.now();
      entry.result=await runtime.execute(job);entry.elapsedMs=Date.now()-start;save();
      return entry.result;
    }};
  }});
const origin=env.AGENT_UI_ORIGINS||'http://127.0.0.1:5173';
const server=createAgentServer(null,{origins:[origin],runtimeInfo:{mode:'remote_model',externalModelEnabled:true},
  runRoutes:({token})=>createRunRoutes({engine:{
    ...createHttpRunEngine(engine),
    async start(input) {
      if(serve) {
        active={question:input.question,started:Date.now(),attempts:[],tools:[],
          request:{question:input.question,scope:input.scope,history:input.history,threadId:input.threadId,clientRequestId:input.clientRequestId}};
        report.runs.push(active);save();
      }
      return createHttpRunEngine(engine).start(input);
    }
  },store,
    authContext:{allowedOrigins:new Set([origin]),verify({req}){
      if(req.headers['x-agent-token']!==token)throw new RunApiError('authentication_required');
      return {accountId:'qa-e2e',browserId:'local-e2e'};
    }}})});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(serve?Number(env.AGENT_PORT||8818):0,'127.0.0.1',resolve);});
const base='http://127.0.0.1:'+server.address().port+'/agent-api';
const session=await (await fetch(base+'/session')).json();
const data=trainingScreenData(undefined,'S16','initial');
const scope={caseId:'S16',snapshot:'initial',metric:'roas',screenTitle:'성과 현황',
  filters:{channel:'all',source:'all',campaignId:'all',device:'all'},
  dataHash:createHash('sha256').update(JSON.stringify(data)).digest('hex')};
try {
  if(serve) {
    console.log('E2E_SERVER '+base+' REPORT '+reportPath);
    await new Promise(resolve=>process.once('SIGTERM',resolve));
  } else {
  for(const [expectedRoute,question] of [
    ['quick','현재 ROAS 알려줘'],
    ['deep','캠페인별 ROAS가 왜 떨어졌고 어떤 캠페인부터 개선해야 해?']
  ]) {
    active={question,expectedRoute,attempts:[],tools:[],request:{question,scope,history:[],threadId:randomUUID(),clientRequestId:randomUUID()}};
    report.runs.push(active);save();
    const start=Date.now();
    const accepted=await fetch(base+'/roas/runs',{method:'POST',headers:{origin,'content-type':'application/json','x-agent-token':session.token},
      body:JSON.stringify(active.request)});
    active.httpStatus=accepted.status;active.accepted=await accepted.json();save();
    if(accepted.status!==202)continue;
    let previous=0;
    while(true) {
      const response=await fetch(base+'/roas/runs/'+active.accepted.runId,{headers:{'x-agent-token':session.token}});
      const state=await response.json();
      for(const event of state.events?.slice(previous)||[])if(['stage','model_plan','verification','failure'].includes(event.kind))
        console.log(JSON.stringify({question:expectedRoute,...event}));
      previous=state.events?.length||0;
      active.state=state;save();
      if(state.terminalAt)break;
      await wait(500);
    }
    active.elapsedMs=Date.now()-start;
    active.decisionCalls=active.attempts.filter(index=>report.attempts[index].format==='jev').length;
    active.generationCalls=active.attempts.filter(index=>report.attempts[index].format==='markdown').length;
    console.log(JSON.stringify({question,expectedRoute,route:active.state.route,status:active.state.executionStatus,
      reason:active.state.stopReason,elapsedMs:active.elapsedMs,decisionCalls:active.decisionCalls,generationCalls:active.generationCalls}));
  }
  }
} finally {
  report.finishedAt=new Date().toISOString();save();
  console.log('REPORT '+reportPath);
  await new Promise(resolve=>server.close(resolve));store.close();
}
