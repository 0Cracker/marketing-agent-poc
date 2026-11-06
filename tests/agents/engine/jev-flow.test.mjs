import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {setTimeout as wait} from 'node:timers/promises';
import {createRunEngine} from '../../../backend/roas/engine/index.mjs';
import {createMockProviderPool} from '../../../backend/roas/mock-provider.mjs';
import {createProviderPool} from '../../../backend/roas/providers/index.mjs';
import {optionCalls,optionJevRequest,readJevAnswers} from '../../../backend/roas/engine/jev-plan.mjs';
import {createToolRuntime} from '../../../backend/roas/tools/index.mjs';
import {trainingScreenData} from '../../../scripts/roas/training-data.mjs';

const data=trainingScreenData(undefined,'S16','initial');
const scope={caseId:'S16',snapshot:'initial',dataHash:createHash('sha256').update(JSON.stringify(data)).digest('hex'),
  filters:{channel:'all',source:'all',campaignId:'all',device:'all'}};

async function runToEnd(engine,question,id) {
  const {runId}=await engine.start({question,scope,threadId:id,clientRequestId:id});
  let run;
  for(let i=0;i<300;i++){run=await engine.getRun({runId});if(run.terminalAt)break;await wait(10);}
  return run;
}

test('two-stage Jev retains metric and dimension pairs and sends one Markdown generation request',async()=>{
  const question='캠페인별 ROAS와 기기별 CVR을 비교해줘';
  const invocations=[];
  const engine=createRunEngine({workflow:'jev',toolRuntimeFactory:createToolRuntime,providerPool:{
    eligibleCandidates:({role})=>[{id:role,provider:role==='first_tool_classifier'?'jev':'gemini',eligible:true}],
    async invokeOnce({input,format,timeoutMs}){
      invocations.push({input,format,timeoutMs});
      if(input.questions) {
        const matches=new Set(input.questions.route?['need_metric_detail']:['detail_roas_campaign','detail_cvr_device']);
        return {output:{answers:Object.fromEntries(Object.entries(input.questions).map(([id,q])=>[id,q.type==='choice'
          ?{type:'choice',choice:'quick',probabilities:{quick:1,deep:0},confidence:1}
          :{type:'noul',noul:matches.has(id)?1:0}]))}};
      }
      const ids=input.results.map(row=>row.result.groups[0].current.evidenceId);
      return {output:'**캠페인별 ROAS와 기기별 CVR** '+ids.map(id=>'['+id+']').join(' ')};
    }
  }});
  const run=await runToEnd(engine,question,'compare');
  assert.equal(run.executionStatus,'completed',JSON.stringify({stage:run.stage,reason:run.stopReason,events:run.events}));
  assert.deepEqual(invocations.map(call=>call.format),['jev','jev','markdown']);
  assert(invocations.every(call=>call.timeoutMs===null));
  assert.equal(invocations[0].input.state.user_question,question);
  assert.equal(invocations[1].input.state.user_question,question);
  assert.equal(Object.keys(invocations[0].input.questions).length,8);
  assert.deepEqual(invocations[2].input.results.map(({args})=>[args.metric,args.dimension]),[
    ['roas','campaign'],['cvr','device'],
  ]);
  assert.match(invocations[2].input.results[0].result.groups[0].current.display,/%$/);
  assert.match(run.result.answer,/\*\*캠페인별 ROAS/);
});

test('a direct ROAS lookup skips the options request, while an unspecified campaign question defaults to ROAS',async()=>{
  const pool=createMockProviderPool(),formats=[];
  const engine=createRunEngine({workflow:'jev',toolRuntimeFactory:createToolRuntime,providerPool:{
    ...pool,invokeOnce:params=>{formats.push(params.format);return pool.invokeOnce(params);}
  }});
  const quick=await runToEnd(engine,'현재 ROAS 알려줘','quick');
  assert.equal(quick.executionStatus,'completed');
  assert.deepEqual(formats.splice(0),['jev','markdown']);
  const deep=await runToEnd(engine,'캠페인별로 성과를 분석해줘','deep');
  assert.equal(deep.executionStatus,'completed');
  assert.deepEqual(formats,['jev','jev','markdown']);
  assert.match(deep.result.answer,/\| 분석 단위 \| 현재 ROAS \|/);
});

test('provider quota responses switch Gemini to Gateway and Sail without billing proof or duplicate Gemini attempts',async()=>{
  const called=[];
  const response=(status,body)=>({status,ok:status===200,text:async()=>JSON.stringify(body)});
  const pool=createProviderPool({
    env:{JEV_API_KEY:'test-jev',GEMINI_API_KEY:'test-google',AI_GATEWAY_API_KEY:'test-gateway',SAIL_API_KEY:'test-sail'},
    fetchImpl:async(url,request)=>{
      const body=JSON.parse(request.body);
      if(url.includes('systemone')){
        called.push('jev');
        return response(200,{answers:Object.fromEntries(Object.entries(body.questions).map(([id,q])=>[id,q.type==='choice'
          ?{type:'choice',choice:'deep',probabilities:{quick:0,deep:1},confidence:1}
          :{type:'noul',noul:id==='need_overview'?1:0}]))});
      }
      if(url.includes('googleapis')){
        called.push('gemini');
        return response(429,{error:{status:'RESOURCE_EXHAUSTED',message:'Quota exceeded'}});
      }
      if(url.includes('vercel')){
        called.push('gateway');
        return response(402,{error:{code:'insufficient_balance'}});
      }
      called.push('sail');
      const context=JSON.parse(body.messages.find(message=>message.role==='user').content);
      const current=context.results[0].result.periods.find(period=>period.id==='current');
      return response(200,{choices:[{message:{content:'현재 ROAS는 '+current.display.roas+'입니다. ['+current.evidenceId+']'}}]});
    }
  });
  const engine=createRunEngine({workflow:'jev',toolRuntimeFactory:createToolRuntime,providerPool:pool});
  const run=await runToEnd(engine,'ROAS를 분석해줘','quota-fallback');
  assert.equal(run.executionStatus,'completed',JSON.stringify(run.result));
  assert.deepEqual(called,['jev','gemini','gateway','sail']);
  assert.equal(run.usage.modelAttempts,4);
  assert.equal(run.usage.exceptionAttempts,2);
  assert.equal(pool.providerStatus({role:'deep_final'}).find(candidate=>candidate.id==='gemini-lite').reason,'quota_exhausted');
  assert(run.events.some(event=>event.kind==='model_fallback'&&event.provider==='sail'));
});

test('quick and deep forward Markdown unchanged, without numeric or citation gates',async()=>{
  const answer='ROAS는 999%입니다. [EV-invalid, EV-range-1~16]\n\n인용 없는 복합 문장도 그대로 전달합니다.';
  for(const route of ['quick','deep']) {
    const pool=createMockProviderPool();
    const engine=createRunEngine({workflow:'jev',toolRuntimeFactory:createToolRuntime,providerPool:{
      ...pool,invokeOnce:async params=>{
        if(params.format==='markdown')return {output:answer};
        const response=await pool.invokeOnce(params);
        if(params.input.questions.route)response.output.answers.route={type:'choice',choice:route,
          probabilities:{quick:route==='quick'?1:0,deep:route==='deep'?1:0},confidence:1};
        return response;
      }
    }});
    const run=await runToEnd(engine,'현재 ROAS 알려줘','raw-'+route);
    assert.equal(run.executionStatus,'completed');
    assert.equal(run.result.answer,answer);
    assert.equal(run.result.verification,undefined);
    assert(!run.events.some(e=>e.stage==='verifying'||e.kind==='verification'||e.kind.startsWith('check_final_')));
  }
});

test('Jev selecting no tools still sends the question to the answer model',async()=>{
  const pool=createMockProviderPool(),formats=[];
  const engine=createRunEngine({workflow:'jev',toolRuntimeFactory:createToolRuntime,providerPool:{
    ...pool,invokeOnce:async params=>{
      formats.push(params.format);
      if(params.format==='markdown') {
        assert.deepEqual(params.input.results,[]);
        return {output:'현재 조회한 데이터가 없습니다.'};
      }
      const response=await pool.invokeOnce(params);
      for(const answer of Object.values(response.output.answers))if(answer.type==='noul')answer.noul=0;
      return response;
    }
  }});
  const run=await runToEnd(engine,'현재 ROAS 알려줘','no-tools');
  assert.equal(run.executionStatus,'completed');
  assert.equal(run.result.answer,'현재 조회한 데이터가 없습니다.');
  assert.deepEqual(formats,['jev','markdown']);
});

test('cancel stops a pending Jev request without an execution deadline',async()=>{
  let onStart,signal;
  const started=new Promise(resolve=>{onStart=resolve;});
  const engine=createRunEngine({workflow:'jev',toolRuntimeFactory:createToolRuntime,providerPool:{
    eligibleCandidates:()=>[{id:'jev',provider:'jev'}],
    invokeOnce:request=>{signal=request.signal;onStart();return new Promise(()=>{});}
  }});
  const {runId}=await engine.start({question:'현재 ROAS',scope,threadId:'cancel',clientRequestId:'cancel'});
  await started;
  await engine.cancel({runId});
  assert.equal(signal.aborted,true);
  for(let i=0;i<300;i++){
    const state=await engine.getRun({runId});
    if(state.terminalAt){assert.equal(state.runStatus,'cancelled');return;}
    await wait(10);
  }
  assert.fail('Cancellation did not reach the terminal state');
});

test('review options keep experience and sentiment linked and reject an extra decision',async()=>{
  const runtime=await createToolRuntime({scope,runId:'review-options'});
  try {
    const question='쿠팡의 향 강도에 대한 부정 리뷰 원문 보여줘';
    const request=optionJevRequest({user_question:question},['review_records'],
      runtime.metricCatalog(),runtime.optionCatalog(),[]);
    const selected=new Set(['review_records_source_virtual_external_1','review_records_experienceId_scent_intensity_negative']);
    const answers=Object.fromEntries(Object.keys(request.questions).map(id=>[id,{type:'noul',noul:selected.has(id)?1:0}]));
    assert.throws(()=>readJevAnswers(request,{answers:{...answers,unissued:{type:'noul',noul:1}}}),/model_protocol/);
    const plan=optionCalls(request,readJevAnswers(request,{answers}),['review_records']);
    assert.deepEqual(plan.calls,[{name:'review_records',args:{sourceId:'virtual_external_1',experienceId:'scent_intensity',sentiment:'negative'}}]);
    const result=await runtime.execute({...plan.calls[0],args:{scopeRole:'primary',...plan.calls[0].args}});
    assert.equal(result.status,'ready');
    assert(result.reviews.every(review=>review.sourceId==='virtual_external_1'&&review.assignments.some(
      assignment=>assignment.experienceId==='scent_intensity'&&assignment.sentiment==='negative')));
  } finally {
    await runtime.dispose();
  }
});
