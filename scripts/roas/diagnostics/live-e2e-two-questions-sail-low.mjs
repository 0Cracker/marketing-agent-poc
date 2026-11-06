import fs from 'node:fs';
import path from 'node:path';
import {parseEnv} from 'node:util';
import {randomUUID,createHash} from 'node:crypto';
import {createAgentServer} from '../../../backend/roas/agent-http.mjs';
import {createProviderPool} from '../../../backend/roas/providers/index.mjs';
import {createToolRuntime} from '../../../backend/roas/tools/index.mjs';
import {createRunEngine} from '../../../backend/roas/engine/index.mjs';
import {createRunStore,createRunRoutes,RunApiError} from '../../../backend/roas/run-api/index.mjs';
import {createRunPersistence,createHttpRunEngine} from '../../../backend/roas/run-integration.mjs';
import {trainingScreenData} from '../training-data.mjs';
if(!process.argv.includes('--live'))throw Error('This diagnostic makes real model calls. Pass --live to run it.');
const root=path.resolve(import.meta.dirname,'../../..');
const keyFile=path.join(root,'.env.local');
const env={...(fs.existsSync(keyFile)?parseEnv(fs.readFileSync(keyFile,'utf8')):{}),...process.env};
const question1="ROAS\uac00 \ub5a8\uc5b4\uc9c4 \uc774\uc720\uc5d0 \ub300\ud574\uc11c \uac01 \uc9c0\ud45c\ubcc4\ub85c \uc5f0\uad00\uc2dc\ucf1c\uc11c \uc2ec\uce35\ubd84\uc11d\ud574\uc918. \uadf8\ub9ac\uace0 \uc774\ub97c \ubcf4\uc644\ud558\ub824\uba74 \uc5b4\ub5a4 \ucea0\ud398\uc778\uc5d0\uc11c \uc5b4\ub5a4 \ud6c4\uc18d \uc561\uc158\uc744\ucde8\ud558\ub294\uac8c \uc88b\uc544?";
const question2="\uac01 \ucea0\ud398\uc778\ubcc4 ROAS \ucd94\uc774 \uc5b4\ub5bb\uac8c \ub418\ub294\uc9c0 \uc815\ub9ac\ud574\uc918.";
const origin='http://127.0.0.1:5173';
const data=trainingScreenData(undefined,'S16','initial');
const scope={caseId:'S16',snapshot:'initial',metric:'roas',screenTitle:'Performance Overview',
 filters:{channel:'all',source:'all',campaignId:'all',device:'all'},
 dataHash:createHash('sha256').update(JSON.stringify(data)).digest('hex')};
const providerTrace=[];
const transportTrace=[];
async function diagnosticFetch(url,options){
 const response=await fetch(url,options);
 try {
  const data=await response.clone().json();
  const msg=data?.choices?.[0]?.message;
  const content=msg?.content;
  let jsonValid=false;
  if(typeof content==='string')try{JSON.parse(content);jsonValid=true}catch{}
  const event={provider:new URL(url).hostname,status:response.status,
   actualModel:data.model,finishReason:data?.choices?.[0]?.finish_reason,
   contentType:typeof content,contentLength:typeof content==='string'?content.length:0,
   jsonValid,contentStart:typeof content==='string'?content.slice(0,200):undefined,
   reasoningLength:typeof msg?.reasoning_content==='string'?msg.reasoning_content.length:undefined,
   errorCode:data.error?.code||data.error?.status,
   usage:data.usage};
  transportTrace.push(event);
  console.log('PROVIDER_HTTP',JSON.stringify(event).slice(0,750));
 }catch(e){transportTrace.push({host:new URL(url).hostname,status:response.status,parseError:e.name});}
 return response;
}
const originalPool=createProviderPool({
 env,allowLiveDiagnostic:true,maxTimeoutMs:900000,fetchImpl:diagnosticFetch,
 onEvent:e=>{providerTrace.push({at:new Date().toISOString(),...e});}
});
const pool={
  providerStatus:originalPool.providerStatus,
  eligibleCandidates:options=>originalPool.eligibleCandidates(options)
    .filter(c=>!['deep_reasoning','deep_final'].includes(options.role)||c.provider==='sail'),
  invokeOnce:originalPool.invokeOnce
};
const dbPath=path.join(root,'.agent-state','roas-e2e-'+randomUUID()+'.sqlite');
fs.mkdirSync(path.dirname(dbPath),{recursive:true});
const store=createRunStore({dbPath,maxModelAttemptsPerDay:100});
const engine=createRunEngine({providerPool:pool,
 store:createRunPersistence(store),
 toolRuntimeFactory:args=>createToolRuntime(args),
 deepDeadlineMs:3600000,quickDeadlineMs:3600000,modelTimeoutMs:900000
});
const runEngine=createHttpRunEngine(engine);
const server=createAgentServer(null,{
 origins:[origin],runtimeInfo:{mode:'remote_model',externalModelEnabled:true},
 roasChat:async()=>({error:'not_used'}),
 runRoutes:({token})=>createRunRoutes({engine:runEngine,store,
  authContext:{allowedOrigins:new Set([origin]),
  verify({req}) {
    if(req.headers['x-agent-token']!==token)throw new RunApiError('authentication_required');
    return {accountId:'qa-e2e',browserId:'e2e-test'};
  }} })
});
const errorSafe=x=>JSON.stringify(x).slice(0,700);
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
const base='http://127.0.0.1:'+server.address().port+'/agent-api';
const session=await (await fetch(base+'/session')).json();
const statuses=pool.providerStatus({}).map(x=>({provider:x.provider,model:x.model,configured:x.configured,eligible:x.eligible,reason:x.reason}));
console.log('PROVIDERS',JSON.stringify(statuses));
async function testQuestion(question,index){
 const t=Date.now();
 const request={question,scope,history:[],threadId:randomUUID(),clientRequestId:randomUUID()};
 const created=await fetch(base+'/roas/runs',{method:'POST',headers:{origin,
  'content-type':'application/json','x-agent-token':session.token},body:JSON.stringify(request)});
 const accepted=await created.json();
 if(created.status!==202)throw Error('http start '+created.status+' '+errorSafe(accepted));
 console.log('STARTED',JSON.stringify({index,runId:accepted.runId,status:created.status,question}));
 let result;
 for(let i=0;i<7000;i++){
  const polled=await fetch(base+'/roas/runs/'+accepted.runId,{headers:{'x-agent-token':session.token}});
  result=await polled.json();
  if(!polled.ok)throw Error('poll failed '+polled.status+' '+errorSafe(result));
  if(['completed','partial','withheld','blocked','cancelled','interrupted'].includes(result.executionStatus))break;
  if(i%30===0)console.log('POLL',JSON.stringify({index,runId:accepted.runId,stage:result.stage,
    events:result.events?.length,modelAttempts:result.usage?.modelAttempts,ms:Date.now()-t}));
  await new Promise(resolve=>setTimeout(resolve,350));
 }
 const out={question,index,runId:accepted.runId,route:result.route,status:result.executionStatus,
 stopReason:result.stopReason,causeStatus:result.causeStatus,elapsedMs:Date.now()-t,
 usage:result.usage,events:(result.events||[]).map(e=>Object.fromEntries(['seq','kind','stage','tool','status','model','provider','errorCode','elapsedMs','count'].filter(k=>e[k]!==undefined).map(k=>[k,e[k]]))),
 result:result.result||null};
 console.log('FINISHED',JSON.stringify({index,runId:out.runId,route:out.route,status:out.status,stopReason:out.stopReason,
  elapsedMs:out.elapsedMs,usage:out.usage,toolCalls:out.events.filter(e=>e.kind==='tool_result'),
  modelAttempts:out.events.filter(e=>e.kind==='model_attempt'),
  answer:out.result?.answer||null}).slice(0,18000));
 return out;
}
const report={date:new Date().toISOString(),mode:'actual_http_sqlite_tools_and_live_model_transports',
 note:'Diagnostic-only explicit live authorization bypasses the normal unverified-billing guard. This is NOT a vendor billing proof.',
 providerReadiness:statuses,results:[],providerTrace,transportTrace};
try{
 for(const [i,q] of [question1,question2].entries()){
  try {report.results.push(await testQuestion(q,i+1));}
  catch(e){console.error('QUESTION_ERROR',i+1,String(e.message).slice(0,500));report.results.push({question:q,index:i+1,error:String(e.message).slice(0,300)});}
 }
}finally{
 const target=path.join(root,'.agent-state','diagnostics','live-e2e-two-questions-sail-low-'+randomUUID()+'.json');
 fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');
 console.log('SAVED',target);
 await new Promise(resolve=>server.close(resolve));
 store.close();
 try{fs.unlinkSync(dbPath)}catch{}
}
