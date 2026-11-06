import test from 'node:test';
import assert from 'node:assert/strict';
import {createRunEngine} from '../../../backend/roas/engine/index.mjs';

const scope={caseId:'S16',snapshot:'initial',dataHash:'data-sha',filters:{channel:'all',source:'all',campaignId:'all',device:'all'}};
const ids=['EV-baseline','EV-current'];
const overview={status:'ready',dataHash:'data-sha',sourceVersion:'v1',reportingBasis:{asOf:'2026-09-01'},scope:{scopeRole:'primary'},periods:[
  {id:'baseline',evidenceId:ids[0],totals:{revenue:200,spend:100,orders:2,clicks:20,rates:{roas:2,cvr:.1}}},
  {id:'current',evidenceId:ids[1],totals:{revenue:300,spend:100,orders:3,clicks:30,rates:{roas:3,cvr:.1}}}
]};
const goodFinish=()=> '현재 ROAS는 300%입니다. [EV-current]\n직전 ROAS는 200%입니다. [EV-baseline]';
const candidate=(provider,model,transport=provider)=>({provider,model,transport,billingBucket:provider});
const poolCandidates={quick_answer:[candidate('gemini','g'),candidate('vercel','v'),candidate('sail','s')],
 first_tool_classifier:[candidate('jev','jev-choice'),candidate('gemini','flash-lite'),candidate('sail','s-class')],
 deep_reasoning:[candidate('gemini','g-deep'),candidate('vercel','v-deep'),candidate('sail','s-deep')],
 deep_final:[candidate('gemini','g-final'),candidate('vercel','v-final'),candidate('sail','s-final')]};
function harness({pick=poolCandidates,invoke=()=>goodFinish(),tool=(job)=>job.name==='overview'?overview:
  job.name==='review_summary'?{status:'not_provided',evidenceIds:[]}:
  job.name==='metric_detail'?{status:'ready',metric:'roas',periods:[{id:'current',value:3,numerator:300,denominator:100,evidenceId:'metric:current'}]}:
  job.name==='evidence'?{status:'ready',items:job.args.evidenceIds,evidenceIds:job.args.evidenceIds}:
  {status:'empty',rows:[]},clock=Date.now}={}) {
 const invoked=[],tools=[],factories=[],disposed=[];
 const providerPool={eligibleCandidates:({role})=>pick[role]||[],invokeOnce:async args=>{
   invoked.push(args);return {output:await invoke(args,invoked.length),actualModel:args.candidate.model,usage:{inputTokens:10,outputTokens:12}};
 }};
 const toolRuntimeFactory=async args=>{
   factories.push(args);
   return {metricCatalog:()=>({metrics:['roas']}),toolSchemas:()=>[{name:'metric_detail'}],
     execute:async job=>{tools.push(job);return tool(job);},
     dispose:async()=>{disposed.push(args.runId);}};
 };
 const engine=createRunEngine({providerPool,toolRuntimeFactory,clock});
 return {engine,invoked,tools,factories,disposed};
}
let seq=0;
function start(engine,question='ROAS 알려줘',extra={}) {
 return engine.start({question,scope,threadId:'thread-'+(++seq),clientRequestId:'req-'+seq,...extra});
}
async function done(engine,runId) {
 for(let i=0;i<150;i++) {
   const state=await engine.getRun({runId});
   if(['completed','partial','withheld','blocked','cancelled','interrupted'].includes(state?.runStatus))return state;
   await new Promise(resolve=>setTimeout(resolve,1));
 }
 throw Error('engine never reached terminal state');
}

test('quick: prefetches overview AND review summary, one normal model, persists only metadata',async()=>{
 const h=harness();
 const begun=await start(h.engine);
 assert.equal(begun.runStatus,'queued');
 const end=await done(h.engine,begun.runId);
 assert.equal(end.route,'quick');assert.equal(end.runStatus,'completed');
 assert.equal(end.executionStatus,'completed');
 assert.deepEqual(h.tools.map(t=>t.name),['overview','review_summary']);
 assert.equal(h.invoked.length,1);assert.equal(end.usage.modelAttempts,1);
 assert.equal(h.invoked[0].format,'markdown');
 assert.equal(h.invoked[0].responseSchema,undefined);
 assert.equal(end.usage.normalAttempts,1);assert.equal(end.usage.exceptionAttempts,0);
 assert.equal(h.factories.length,1);assert.equal(h.disposed.length,1);
 assert(end.events.some(e=>e.kind==='tool_result'&&e.tool==='review_summary'&&e.status==='not_provided'));
 assert(!end.events.some(e=>e.kind==='verification'));
 assert.equal(end.result.answer,goodFinish());
 assert.deepEqual(end.events.map(x=>x.seq),end.events.map((_x,i)=>i+1));
 assert(!JSON.stringify(end.events).includes('instruction'));
 assert(!JSON.stringify(end).includes('apiKey'));
});

test('quick: 429 Google -> Gateway out of credits -> Sail, never retries exhausted candidates',async()=>{
 const h=harness({invoke:({candidate})=>{
   if(candidate.provider==='gemini')throw Object.assign(Error('quota'),{code:'rate_limited'});
   if(candidate.provider==='vercel')throw Object.assign(Error('credits'),{code:'credits_exhausted'});
   return goodFinish();
 }});
 const end=await done(h.engine,(await start(h.engine)).runId);
 assert.equal(end.runStatus,'completed');
 assert.deepEqual(h.invoked.map(x=>x.candidate.provider),['gemini','vercel','sail']);
 assert.equal(end.usage.modelAttempts,3);assert.equal(end.usage.exceptionAttempts,2);
 assert.equal(h.tools.filter(x=>x.name==='overview').length,1);
 assert.equal(end.events.filter(e=>e.kind==='model_error').length,2);
});

test('quick: 3 calls maximum, paid-risk/unsupported candidate skipped with zero invocation',async()=>{
 const pick={quick_answer:[{...candidate('gemini','disabled'),eligible:false},
   {...candidate('vercel','paid'),paidRisk:true},candidate('sail','ok')]};
 const h=harness({pick});const end=await done(h.engine,(await start(h.engine)).runId);
 assert.equal(end.runStatus,'completed');assert.equal(h.invoked.length,1);
 assert.equal(h.invoked[0].candidate.provider,'sail');
 const blocked=harness({pick:{quick_answer:[]}});
 const terminal=await done(blocked.engine,(await start(blocked.engine)).runId);
 assert.equal(terminal.runStatus,'blocked');assert.equal(terminal.stopReason,'models_unavailable');
 assert.equal(blocked.invoked.length,0);
});

test('deep: Jev first tool, independent retrievals, two reasoning calls, one reserved final',async()=>{
 let reasoning=0;
 const h=harness({invoke:({candidate})=>{
   if(candidate.provider==='jev')return {choice:'metric_detail',confidence:.9};
   if(candidate.model==='g-deep')return reasoning++===0?
     {decision:'continue',toolCalls:[{name:'trend',args:{}},{name:'records',args:{limit:2}},{name:'metric_detail',args:{metric:'roas'}},
       {name:'evidence',args:{evidenceIds:ids}}]}:
     {decision:'gemini_sufficient'};
   return goodFinish();
 }});
 const end=await done(h.engine,(await start(h.engine,'왜 ROAS 변했나?')).runId);
 assert.equal(end.route,'deep');assert.equal(end.runStatus,'completed');assert.equal(end.causeStatus,'undetermined');
 assert.deepEqual(h.invoked.map(x=>x.candidate.model),['jev-choice','g-deep','g-deep','g-final']);
 assert.deepEqual(h.tools.map(t=>t.name),['overview','metric_detail','trend','records','evidence']);
 assert(end.events.some(e=>e.kind==='model_plan'&&e.argsSummary==='trend, records, metric_detail, evidence'));
 assert.equal(end.events.find(e=>e.kind==='tool_result'&&e.tool==='evidence').count,ids.length);
 assert.equal(end.usage.normalAttempts,4);assert.equal(end.usage.exceptionAttempts,0);
 assert(end.events.some(e=>e.kind==='tool_rejected'&&e.errorCode==='duplicate_call'));
});

test('deep: absent Jev causes zero Jev calls, Jev failure consumes fallback exception',async()=>{
 const noJev={...poolCandidates,first_tool_classifier:[candidate('gemini','flash-lite')]};
 const h=harness({pick:noJev,invoke:({candidate})=>candidate.model==='flash-lite'?{toolCalls:[]}:
   candidate.model==='g-deep'?{decision:'insufficient_evidence'}:goodFinish()});
 const end=await done(h.engine,(await start(h.engine,'왜 변화했지?')).runId);
 assert.equal(end.runStatus,'completed');
 assert.deepEqual(h.invoked.map(x=>x.candidate.model),['flash-lite','g-deep','g-final']);
 assert.equal(end.stopReason,'insufficient_evidence');
 const fallback=harness({invoke:({candidate})=>{
   if(candidate.provider==='jev')throw Object.assign(Error('unavailable'),{code:'model_unavailable'});
   if(candidate.model==='flash-lite')return {toolCalls:[{name:'metric_detail',args:{metric:'roas'}}]};
   if(candidate.model==='g-deep')return {decision:'gemini_sufficient'};
   return goodFinish();
 }});
 const other=await done(fallback.engine,(await start(fallback.engine,'왜 변했나')).runId);
 assert.equal(other.runStatus,'completed');
 assert.deepEqual(fallback.invoked.map(x=>x.candidate.model),['jev-choice','flash-lite','g-deep','g-final']);
 assert.equal(other.usage.exceptionAttempts,1);
});

test('deep: quota switch shares one run/snapshot/evidence without reloading, total attempts <=6',async()=>{
 let reasoning=0;
 const h=harness({invoke:({candidate})=>{
   if(candidate.provider==='jev')return {choice:'metric_detail',confidence:.9};
   if(candidate.model==='g-deep')throw Object.assign(Error('quota'),{code:'quota_exhausted'});
   if(candidate.model==='v-deep')return reasoning++===0?{decision:'gemini_sufficient'}:{decision:'continue'};
   if(candidate.model==='g-final')return goodFinish();
   return goodFinish();
 }});
 const end=await done(h.engine,(await start(h.engine,'원인 분석')).runId);
 assert.equal(end.runStatus,'completed');
 assert.deepEqual(h.invoked.map(x=>x.candidate.model),['jev-choice','g-deep','v-deep','g-final']);
 assert.equal(end.usage.modelAttempts,4);
 assert.equal(h.factories.length,1);assert.equal(h.tools.filter(t=>t.name==='overview').length,1);
 assert(end.result.evidenceIds.includes('EV-current'));
});

test('deep: insufficient_evidence forbids subsequent tool reads, including any final answer tool requests',async()=>{
 const h=harness({invoke:({candidate})=>{
   if(candidate.provider==='jev')return {choice:'none',confidence:.9};
   if(candidate.model==='g-deep')return {decision:'insufficient_evidence'};
   return {toolCalls:[{name:'records',args:{}}]};
 }});
 const end=await done(h.engine,(await start(h.engine,'왜?')).runId);
 assert.equal(end.stopReason,'model_protocol');
 assert.deepEqual(h.tools.map(x=>x.name),['overview']);
 assert.equal(end.executionStatus,'withheld');
});

test('model deadline blocks later candidates and user cancel prevents new model/tool calls',async()=>{
 let time=0;
 const h=harness({clock:()=>time,invoke:()=>{time=16000;throw Object.assign(Error('late'),{code:'rate_limited'});}});
 const end=await done(h.engine,(await start(h.engine)).runId);
 assert.equal(end.stopReason,'time_limit');assert.equal(h.invoked.length,1);
 let release;
 const waiting=new Promise(resolve=>{release=resolve;});
 const cancelled=harness({invoke:async()=>{await waiting;return goodFinish();}});
 const startRun=await start(cancelled.engine);
 for(let i=0;i<60&&!cancelled.invoked.length;i++)await new Promise(r=>setTimeout(r,1));
 await cancelled.engine.cancel({runId:startRun.runId});
 release();
 const stopped=await done(cancelled.engine,startRun.runId);
 assert.equal(stopped.runStatus,'cancelled');assert.equal(stopped.stopReason,'user_cancelled');
 assert.equal(cancelled.invoked.length,1);assert.equal(cancelled.tools.length,2);
});

test('idempotent request and active thread lock reject duplicate charging, with immutable scope',async()=>{
 let release;
 const waiting=new Promise(resolve=>release=resolve);
 const h=harness({invoke:async()=>{await waiting;return goodFinish();}});
 const req={question:'ROAS 확인',scope,threadId:'fixed',clientRequestId:'fixed-id',history:[]};
 const a=await h.engine.start(req),b=await h.engine.start(req);
 assert.equal(a.runId,b.runId);
 await assert.rejects(h.engine.start({...req,question:'다른 질문'}),{code:'idempotency_conflict'});
 await assert.rejects(h.engine.start({...req,clientRequestId:'second'}),{code:'run_in_progress'});
 scope.filters.device='all'; // no mutation escapes the copied execution scope
 release();const end=await done(h.engine,a.runId);
 assert.equal(end.scopeFingerprint,a.scopeFingerprint);
});


test('deep six-call ceiling: one Jev, two reasoning stages with two fallback attempts, reserved final',async()=>{
 let reasoning=0;
 const h=harness({invoke:({candidate})=>{
   if(candidate.provider==='jev')return {choice:'none',confidence:1};
   if(candidate.model==='g-deep') {
     if(reasoning++===0)return {decision:'continue',toolCalls:[]};
     throw Object.assign(Error('429'),{code:'rate_limited'});
   }
   if(candidate.model==='v-deep')throw Object.assign(Error('credits'),{code:'credits_exhausted'});
   if(candidate.model==='s-deep')return {decision:'gemini_sufficient'};
   return goodFinish();
 }});
 const end=await done(h.engine,(await start(h.engine,'원인 분석 요청')).runId);
 assert.equal(end.runStatus,'completed');
 assert.deepEqual(h.invoked.map(x=>x.candidate.model),
   ['jev-choice','g-deep','g-deep','v-deep','s-deep','g-final']);
 assert.equal(end.usage.modelAttempts,6);
 assert.equal(end.usage.normalAttempts,4);
 assert.equal(end.usage.exceptionAttempts,2);
 assert.equal(h.invoked.filter(x=>x.candidate.model==='v-deep').length,1);
 assert.deepEqual(h.tools.map(x=>x.name),['overview']);
});

test('Jev typed-choice adapter receives tool criteria, no unsupported JSON schema, no external calls',async()=>{
 const jev={...candidate('jev','jev-choice'),jsonSchema:false,toolActions:false,maxOutputTokens:256};
 const h=harness({pick:{...poolCandidates,first_tool_classifier:[jev]},invoke:({candidate,input,responseSchema,timeoutMs})=>{
   assert(timeoutMs<=60000);
   if(candidate.provider==='jev') {
     assert.equal(typeof input.state,'string');
     assert.deepEqual(Object.keys(input.choices).sort(),
       ['overview','metric_detail','trend','records','review_summary','review_records','evidence','none'].sort());
     assert.equal(responseSchema,undefined);
     return {choice:'none',confidence:.91};
   }
   return candidate.model==='g-deep'?{decision:'insufficient_evidence'}:goodFinish();
 }});
 const end=await done(h.engine,(await start(h.engine,'왜 달라졌는지 분석')).runId);
 assert.equal(end.runStatus,'completed');
 assert.equal(h.invoked[0].candidate.provider,'jev');
});

test('review category evidence IDs from nested evidenceIds remain citable',async()=>{
 const review={status:'ready',dataHash:'data-sha',sourceVersion:'taxonomy1',
   periods:[{id:'baseline',count:2,evidenceId:'review:baseline',
     categories:[{categoryId:'usage',count:2,percent:100,evidenceIds:['EV-review-category']}],
     experiences:[{experienceId:'exp01',count:1,evidenceIds:['review:baseline']}]}],
   evidenceIds:['review:baseline','EV-review-category']};
 const h=harness({tool:job=>job.name==='overview'?overview:review,invoke:()=>{
   return goodFinish()+'\n리뷰 분류 근거를 참고했습니다. [EV-review-category]';
 }});
 const end=await done(h.engine,(await start(h.engine)).runId);
 assert.equal(end.runStatus,'completed',JSON.stringify(end.result));
 assert(end.result.evidenceIds.includes('EV-review-category'));
});

test('source hashes are metadata and do not block answer generation',async()=>{
 const h=harness({tool:job=>job.name==='overview'?{...overview,dataHash:'tampered'}:
   {status:'not_provided'}});
 const end=await done(h.engine,(await start(h.engine)).runId);
 assert.equal(end.runStatus,'completed');
 assert.equal(end.result.answer,goodFinish());
 assert.equal(h.invoked.length,1);
});


test('real user ROAS deep and campaign-trend questions retrieve campaign detail instead of quick route',async()=>{
  const questions=["ROAS가 떨어진 이유에 대해서 각 지표별로 연관시켜서 심층분석해줘. 그리고 이를 보완하려면 어떤 캠페인에서 어떤 후속 액션을취하는게 좋아?","각 캠페인별 ROAS 추이 어떻게 되는지 정리해줘."];
  for(const question of questions){
    const h=harness({pick:{first_tool_classifier:[],deep_reasoning:[candidate('gemini','g-deep')],
      deep_final:[candidate('gemini','g-final')]},
      invoke:({candidate})=>candidate.model==='g-deep'?{decision:'gemini_sufficient'}:goodFinish()});
    const end=await done(h.engine,(await start(h.engine,question)).runId);
    assert.equal(end.route,'deep');
    assert.equal(end.runStatus,'completed');
    assert(h.tools.some(t=>t.name==='metric_detail'&&t.args.metric==='roas'&&t.args.dimension==='campaign'));
  }
});
