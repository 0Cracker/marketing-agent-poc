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

function decisions(questions,{choices={},scores={}}={}) {
  return {answers:Object.fromEntries(Object.entries(questions).map(([id,question])=>{
    if(question.type==='noul')return [id,{type:'noul',noul:scores[id]??0}];
    const choice=choices[id]??(id==='route'?'quick':id==='metric_scope'?'catalog':'not_needed');
    return [id,{type:'choice',choice,confidence:1,
      probabilities:Object.fromEntries(Object.keys(question.criteria).map(key=>[key,Number(key===choice)]))}];
  }))};
}

async function runToEnd(engine,question,id,history=[]) {
  const {runId}=await engine.start({question,scope,history,threadId:id,clientRequestId:id});
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
        return {output:decisions(input.questions,{scores:{need_metric_breakdown:1,metric_roas:1,metric_cvr:1,
          breakdown_roas_campaign:1,breakdown_cvr_device:1}})};
      }
      return {output:'**캠페인별 ROAS와 기기별 CVR**'};
    }
  }});
  const run=await runToEnd(engine,question,'compare');
  assert.equal(run.executionStatus,'completed',JSON.stringify({stage:run.stage,reason:run.stopReason,events:run.events}));
  assert.deepEqual(invocations.map(call=>call.format),['jev','jev','markdown']);
  assert(invocations.every(call=>call.timeoutMs===null));
  assert.equal(invocations[0].input.state.user_question,question);
  assert.equal(invocations[1].input.state.user_question,question);
  assert.equal(Object.keys(invocations[0].input.questions).length,24);
  assert.equal(Object.keys(invocations[1].input.questions).length,6);
  assert(invocations[2].input.results.every(result=>result.name==='metric_breakdown'));
  assert.deepEqual(invocations[2].input.results.map(({args})=>[args.metric,args.dimension]),[
    ['roas','campaign'],['cvr','device'],
  ]);
  const detail=invocations[2].input.results[0].result;
  assert.equal(detail.metricDefinition.unit,'%');
  assert.equal(typeof detail.groups[0].current.value,'number');
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
  assert.deepEqual(formats.splice(0),['jev','jev','markdown']);
  assert.match(deep.result.answer,/\| 분석 단위 \| 현재 ROAS \|/);
  const components=await runToEnd(engine,'ROAS 산식과 분모를 알려줘','components');
  assert.equal(components.executionStatus,'completed');
  assert.deepEqual(formats,['jev','jev','markdown']);
  assert.match(components.result.answer,/구매 매출 \d+원 ÷ 집행비 \d+원/);
});

test('records use confident filters or retrieve the full scope',()=>{
  const request={state:{option_candidates:{
    change:{tool:'records',args:{category:'change'}},
    campaign:{tool:'records',args:{category:'campaign'}},
    incident:{tool:'records',args:{category:'incident'}},
  }}};
  for(const [scores,expected] of [
    [[.72,.69,.33],[{category:'change'}]],
    [[.72,.70,.33],[{category:'change'},{category:'campaign'}]],
    [[.69,.67,.33],[{}]],
    [[.49,.48,.33],[{}]],
  ]) {
    const answers=Object.fromEntries(Object.keys(request.state.option_candidates)
      .map((id,index)=>[id,{type:'noul',noul:scores[index]}]));
    const {calls,missing}=optionCalls(request,answers,['records']);
    assert.deepEqual(calls.map(call=>call.args),expected);
    assert.deepEqual(missing,[]);
  }
});

test('S16 uses 24 and 11 decisions and preserves all six groups, 28 dates and 33 records',async t=>{
  const formats=[],jevInputs=[];
  let modelInput;
  const engine=createRunEngine({workflow:'jev',toolRuntimeFactory:createToolRuntime,providerPool:{
    eligibleCandidates:({role})=>[{id:role,provider:role==='first_tool_classifier'?'jev':'gemini',eligible:true}],
    async invokeOnce({input,format}) {
      formats.push(format);
      if(format==='markdown'){modelInput=input;return {output:'운영 기록 분석 결과'};}
      jevInputs.push(input);
      const scores={need_overview:.9,need_metric_breakdown:.95,need_trend:.86,need_records:.84,metric_roas:.91,metric_cvr:.68,
        breakdown_roas_campaign:.9,records_change:.69,records_campaign:.67,records_incident:.33};
      return {output:decisions(input.questions,{scores,choices:{route:'deep',trend_roas_period:'both'}})};
    }
  }});
  const run=await runToEnd(engine,'캠페인별 ROAS가 왜 떨어졌고 어떤 캠페인부터 개선해야 해?','borderline-records');
  assert.equal(run.executionStatus,'completed');
  assert.deepEqual(formats,['jev','jev','markdown']);
  assert.deepEqual(jevInputs.map(input=>Object.keys(input.questions).length),[24,11]);
  assert.equal(jevInputs[0].state.tools.metric_detail,undefined);
  assert(!Object.keys(jevInputs[1].questions).some(id=>id.includes('cvr')||id==='metric_specified'));
  assert.deepEqual(run.events.filter(event=>event.kind==='stage'&&['classifying','choosing_options'].includes(event.stage))
    .map(event=>event.count),[24,11]);
  assert(run.events.some(event=>event.status==='uncertain'&&event.argsSummary.includes('일부 지표')));
  const inputBytes=jevInputs.map(input=>Buffer.byteLength(JSON.stringify(input)));
  t.diagnostic(`S16 Jev input bytes by stage: ${inputBytes.join(', ')}`);
  assert(inputBytes[1]<47090/2);
  assert(inputBytes[0]+inputBytes[1]<54431);
  const queries=run.events.filter(event=>event.kind==='tool_start'&&event.tool==='records');
  assert.equal(queries.length,2);
  assert(queries.every(event=>event.argsSummary==='scopeRole=primary'));
  assert.deepEqual(modelInput.results.filter(item=>item.name!=='overview').map(({result})=>
    result.groups?.length??result.days?.length??result.records?.length),[6,28,33]);
  assert.equal(modelInput.results.find(item=>item.name==='trend').args.periodId,'both');
  const sent=JSON.stringify(modelInput);
  assert.match(sent,/PAYMENT_CALLBACK_TIMEOUT/);
  assert.match(sent,/일예산 420000/);
  assert.match(sent,/입찰방식/);
  assert.match(sent,/배송약속/);
  assert.match(sent,/정산단가/);
});

test('Jev resolves follow-up context and preserves separate functions, periods and unsupported requests',async()=>{
  const history=[{role:'user',text:'ROAS를 먼저 보여줘.'},{role:'assistant',text:'현재 ROAS는 284.7%입니다.'}];
  const scenarios=[
    {question:'그 지표를 휴대폰이랑 PC로 나눠 봐',history,
      scores:{need_metric_breakdown:1,metric_roas:1,breakdown_roas_device:1},
      expected:[['metric_breakdown',{metric:'roas',dimension:'device'}]]},
    {question:'ROAS 산식이랑 현재 CVR 및 직전 CPC 일별 추이',
      scores:{need_metric_components:1,need_trend:1,metric_roas:1,metric_cvr:1,metric_cpc:1,components_roas:1,components_cvr:.45},
      choices:{trend_cvr_period:'current',trend_cpc_period:'baseline'},
      expected:[['metric_components',{metric:'roas'}],['trend',{metrics:['cpc'],periodId:'baseline',granularity:'day'}],
        ['trend',{metrics:['cvr'],periodId:'current',granularity:'day'}]]},
    {question:'ROAS 산식과 CAC 산식',partial:true,choices:{metric_scope:'unresolved'},
      scores:{need_metric_components:1,metric_roas:1,components_roas:1},expected:[['metric_components',{metric:'roas'}]]},
    {question:'CAC 산식을 알려줘',partial:true,choices:{metric_scope:'unresolved'},
      scores:{need_metric_components:1},expected:[],jevCalls:1},
    {question:'7월 ROAS 일별 추이',partial:true,choices:{metric_scope:'unresolved',trend_roas_period:'unresolved'},
      scores:{need_trend:1,metric_roas:1},expected:[]},
    {question:'7월 ROAS 산식과 캠페인별 비교',partial:true,choices:{metric_scope:'unresolved'},
      scores:{need_metric_components:1,need_metric_breakdown:1,metric_roas:1},expected:[]},
  ];
  for(const [index,scenario] of scenarios.entries()) {
    let jevCalls=0,queries;
    const engine=createRunEngine({workflow:'jev',toolRuntimeFactory:createToolRuntime,providerPool:{
      eligibleCandidates:({role})=>[{id:role,provider:role==='first_tool_classifier'?'jev':'gemini'}],
      async invokeOnce({input,format}) {
        if(format==='markdown') {
          queries=input.results.map(({name,args:{scopeRole,...args}})=>{
            assert.equal(scopeRole,'primary');
            return [name,args];
          });
          return {output:'조회 결과'};
        }
        jevCalls++;
        assert.deepEqual(input.state.recent_history,scenario.history??[]);
        assert.equal(input.state.user_question,scenario.question);
        return {output:decisions(input.questions,scenario)};
      }
    }});
    const run=await runToEnd(engine,scenario.question,'options-'+index,scenario.history);
    assert.equal(run.executionStatus,scenario.partial?'partial':'completed',JSON.stringify(run.result));
    assert.deepEqual(queries,scenario.expected);
    assert.equal(jevCalls,scenario.jevCalls??2);
  }
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
        return response(200,decisions(body.questions,{choices:{route:'deep'},scores:{need_overview:1}}));
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
      return response(200,{choices:[{message:{content:'현재 ROAS는 '+current.display.roas+'입니다.'}}]});
    }
  });
  const engine=createRunEngine({workflow:'jev',toolRuntimeFactory:createToolRuntime,providerPool:pool});
  const run=await runToEnd(engine,'ROAS를 분석해줘','quota-fallback');
  assert.equal(run.executionStatus,'completed',JSON.stringify(run.result));
  assert.deepEqual(called,['jev','gemini','gateway','sail']);
  assert.equal(run.usage.modelAttempts,4);
  assert.equal(run.usage.exceptionAttempts,2);
  assert.equal(pool.providerStatus({role:'deep_final'}).some(candidate=>candidate.id==='gemini-lite'),false);
  assert.equal(pool.providerStatus({role:'deep_final'}).find(candidate=>candidate.id==='gemini-deep').reason,'quota_exhausted');
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
