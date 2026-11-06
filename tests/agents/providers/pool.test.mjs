import test from 'node:test';
import assert from 'node:assert/strict';
import {createProviderPool,ProviderError} from '../../../backend/roas/providers/index.mjs';

const future = Date.now() + 3600000;
const proof = {
  gemini:{verifiedFreeOnly:true,enforcedNoPaidUsage:true,remainingUsd:5,validUntil:future},
  gateway:{verifiedFreeOnly:true,enforcedNoPaidUsage:true,remainingUsd:5,validUntil:future},
  sail:{verifiedFreeOnly:true,enforcedNoPaidUsage:true,remainingUsd:5,validUntil:future},
  jev:{verifiedFreeOnly:true,enforcedNoPaidUsage:true,remainingUsd:5,validUntil:future}
};
const allKeys = {GEMINI_API_KEY_2:'key-two',GEMINI_API_KEY_1:'key-one',AI_GATEWAY_API_KEY:'gateway-secret',
  SAIL_API_KEY:'sail-secret',JEV_API_KEY:'jev-secret'};
const ok = data => ({ok:true,status:200,text:async()=>JSON.stringify(data)});
const bad = (status,data={}) => ({ok:false,status,text:async()=>JSON.stringify(data)});
const gemini = data => ok({model:'gemini-3.5-flash-lite',candidates:[{content:{parts:[{text:JSON.stringify(data)}]}}],
  usageMetadata:{promptTokenCount:41,candidatesTokenCount:15}});
const chat = data => ok({model:'returned-chat-model',choices:[{message:{content:JSON.stringify(data)}}],
  usage:{prompt_tokens:31,completion_tokens:9}});
const choice = ok({model:'jev-1.13.0',answers:{first_tool:{type:'choice',choice:'overview',
  confidence:0.87,probabilities:{overview:0.87,trend:0.13}}},usage:{input_tokens:30,output_tokens:5}});
const opts = {instruction:'Reply with only JSON.',input:{question:'Why did ROAS change?'}};
const pool = (overrides={}) => createProviderPool({env:allKeys,billingSafety:proof,...overrides});
const selected = (p,id) => p.eligibleCandidates({role:'first_tool_classifier'}).find(c=>c.id===id) ||
  p.eligibleCandidates({role:'deep_reasoning'}).find(c=>c.id===id);
async function rejection(fn,code) {
  await assert.rejects(fn,e=>e instanceof ProviderError && e.code===code && e.message===code);
}

test('Jev forwards typed questions and Gemini Markdown uses a plain-text response',async()=>{
  const requests=[];
  const p=pool({fetchImpl:async(url,request)=>{
    requests.push(JSON.parse(request.body));
    return url.includes('systemone')?ok({answers:{need_overview:{type:'noul',noul:1}}}):
      ok({candidates:[{content:{parts:[{text:'**ROAS**'}]}}]});
  }});
  const instruction='Evaluate supplied questions.';
  const input={state:{user_question:'현재 ROAS'},questions:{need_overview:{type:'noul',instructions:'KPI가 필요한가요?'}}};
  const jev=await p.invokeOnce({candidate:selected(p,'jev-choice'),instruction,input,format:'jev',timeoutMs:null});
  assert.deepEqual(requests[0],{model:'jev-latest',...input});
  assert.equal(jev.output.answers.need_overview.noul,1);
  const gemini=await p.invokeOnce({candidate:selected(p,'gemini-lite'),instruction,input:{question:'현재 ROAS'},format:'markdown',timeoutMs:null});
  assert.equal(requests[1].generationConfig.responseMimeType,'text/plain');
  assert.equal(requests[1].generationConfig.responseJsonSchema,undefined);
  assert.equal(gemini.output,'**ROAS**');
});

test('zero keys blocks every role and makes no network call',async()=>{
  let calls=0;
  const p=createProviderPool({env:{},fetchImpl:async()=>{calls++;return gemini({ok:true});}});
  for(const role of ['quick_answer','deep_reasoning','deep_final','first_tool_classifier']) {
    assert.deepEqual(p.eligibleCandidates({role}),[]);
    assert.ok(p.providerStatus({role}).every(c=>!c.configured && c.reason==='missing_key'));
  }
  await rejection(()=>p.invokeOnce({candidate:{id:'gemini-lite'},...opts}),'provider_configuration');
  assert.equal(calls,0);
});

test('configured keys are eligible without billing proof and provider limits decide availability',async()=>{
  let calls=0;
  const p=createProviderPool({env:allKeys,fetchImpl:async(url)=>{calls++;return url.includes('systemone')?choice:chat({answer:'ok'});}});
  assert.ok(p.providerStatus({}).every(c=>c.configured && c.eligible));
  await p.invokeOnce({candidate:{id:'gateway-lite'},...opts});
  await p.invokeOnce({candidate:{id:'jev-choice'},instruction:'Choose',input:{state:'test',choices:{overview:'전체 KPI'}}});
  assert.equal(calls,2);
  const diagnostic=JSON.stringify(p.providerStatus({}));
  for(const key of Object.values(allKeys)) assert.ok(!diagnostic.includes(key));
});

test('numbered Gateway, Sail and Jev API keys are recognized and forwarded',async()=>{
  const env={AI_GATEWAY_API_KEY_2:'gateway-two',AI_GATEWAY_API_KEY_1:'gateway-one',
    SAIL_API_KEY_1:'sail-one',JEV_API_KEY_1:'jev-one'};
  const called=[];
  const p=createProviderPool({env,billingSafety:proof,fetchImpl:async(url,options)=>{
    called.push(options.headers.authorization);
    return url.includes('systemone')?choice:chat({answer:'ok'});
  }});
  for(const id of ['gateway-lite','sail-open','jev-choice']) {
    const candidate=selected(p,id);
    assert(candidate?.eligible,id+' not eligible');
    await p.invokeOnce({candidate,instruction:'Reply with JSON.',
      input:id==='jev-choice'?{state:'test',choices:{overview:'Overview',trend:'Trend'}}:{question:'test'}});
  }
  assert.deepEqual(called,['Bearer gateway-one','Bearer sail-one','Bearer jev-one']);
  assert.equal(p.providerStatus({role:'quick_answer'}).find(x=>x.id==='gemini-lite').reason,'missing_key');
});

test('normal and diagnostic paths both use configured credentials',()=>{
  const p=createProviderPool({env:allKeys,allowLiveDiagnostic:true});
  assert.equal(p.eligibleCandidates({role:'first_tool_classifier'})[0].provider,'jev');
  assert(p.eligibleCandidates({role:'deep_final'}).length>0);
  const normal=createProviderPool({env:allKeys});
  assert.equal(normal.eligibleCandidates({role:'deep_final'}).length,p.eligibleCandidates({role:'deep_final'}).length);
});

test('Vercel-prefixed numbered key is supported with exact spelling',()=>{
  const p=createProviderPool({env:{Vercel_AI_GATEWAY_API_KEY_1:'gateway-one'},allowLiveDiagnostic:true});
  const gateway=p.providerStatus({role:'quick_answer'}).find(x=>x.provider==='gateway');
  assert.equal(gateway.configured,true);
  assert.equal(gateway.eligible,true);
});

test('Gemini numbered keys are a single shared billing bucket',async()=>{
  let captured;
  const p=pool({fetchImpl:async(url,options)=>{captured={url,options};return gemini({answer:'ok'});}});
  const c=selected(p,'gemini-lite');
  assert.equal(c.billingBucket,'google_project');
  assert.equal(c.transport,'gemini_direct');
  const response=await p.invokeOnce({candidate:c,...opts,responseSchema:{type:'object',properties:{answer:{type:'string'}}}});
  assert.equal(response.actualModel,'gemini-3.5-flash-lite');
  assert.deepEqual(response.output,{answer:'ok'});
  assert.deepEqual(response.usage,{inputTokens:41,outputTokens:15});
  assert.equal(captured.options.headers['x-goog-api-key'],'key-one');
  assert.ok(!captured.url.includes('key-one'));
  assert.equal(JSON.parse(captured.options.body).generationConfig.responseMimeType,'application/json');
  assert.equal(JSON.parse(captured.options.body).generationConfig.maxOutputTokens,4096);
  assert.equal(captured.options.redirect,'error');
});

test('Gateway uses the fixed OpenAI-compatible endpoint with one model and no fallback',async()=>{
  let captured;
  const p=pool({fetchImpl:async(url,options)=>{captured={url,options};return chat({answer:'gateway'});}});
  const c=selected(p,'gateway-lite');
  const response=await p.invokeOnce({candidate:c,...opts,responseSchema:{type:'object',properties:{answer:{type:'string'}}}});
  assert.equal(captured.url,'https://ai-gateway.vercel.sh/v1/chat/completions');
  assert.equal(captured.options.headers.authorization,'Bearer gateway-secret');
  const body=JSON.parse(captured.options.body);
  assert.equal(body.model,'zai/glm-5.3-flash');
  assert.equal(body.response_format.type,'json_schema');
  assert.equal(body.providerOptions,undefined);
  assert.equal(body.models,undefined);
  assert.deepEqual(response.output,{answer:'gateway'});
  assert.equal(response.transport,'openai_compatible');
  assert.equal(response.billingBucket,'gateway');
});

test('Sail uses a verified model ID but is not eligible for unknown structured-output features',async()=>{
  const p=pool({fetchImpl:async(url,options)=>{
    assert.equal(url,'https://api.sailresearch.com/v1/chat/completions');
    assert.equal(JSON.parse(options.body).model,'zai-org/GLM-5.3-Flash');
    assert.equal(JSON.parse(options.body).response_format.type,'json_object');
    assert.equal(JSON.parse(options.body).reasoning_effort,'low');
    return chat({ok:'sail'});
  }});
  assert.equal(p.providerStatus({role:'quick_answer',features:{jsonSchema:true}}).find(c=>c.id==='sail-open').reason,'unsupported_features');
  const c=selected(p,'sail-open');
  assert.deepEqual((await p.invokeOnce({candidate:c,...opts})).output,{ok:'sail'});
});

test('Jev is restricted to typed Choice and verifies the returned option',async()=>{
  let body;
  const p=pool({fetchImpl:async(url,options)=>{
    assert.equal(url,'https://api.typesafe.ai/v1/systemone');
    body=JSON.parse(options.body);
    return choice;
  }});
  const c=selected(p,'jev-choice');
  assert.equal(c.id,'jev-choice');
  const result=await p.invokeOnce({candidate:c,instruction:'Choose a first tool',input:{
    state:'Campaign performance changed',choices:{overview:'Summary of KPIs',trend:'Daily trend'}
  }});
  assert.equal(body.model,'jev-latest');
  assert.equal(body.questions.first_tool.type,'choice');
  assert.equal(result.output.choice,'overview');
  assert.equal(result.output.confidence,0.87);
  assert.deepEqual(result.usage,{inputTokens:30,outputTokens:5});
  assert.equal(p.providerStatus({role:'deep_final'}).some(x=>x.id==='jev-choice'),false);
});

test('Jev malformed request is rejected before sending',async()=>{
  let calls=0;
  const p=pool({fetchImpl:async()=>{calls++;return choice;}});
  await rejection(()=>p.invokeOnce({candidate:selected(p,'jev-choice'),instruction:'Choose',input:'free text'}),'model_protocol');
  assert.equal(calls,0);
});

test('all role and feature filters exclude incompatible candidates',()=>{
  const p=pool();
  const roles=['quick_answer','deep_reasoning','deep_final','first_tool_classifier'];
  for(const role of roles) assert.ok(p.eligibleCandidates({role}).length>0);
  assert.equal(p.eligibleCandidates({role:'first_tool_classifier'})[0].id,'jev-choice');
  assert.ok(p.eligibleCandidates({role:'deep_reasoning'}).some(c=>c.id==='gemini-deep'));
  assert.equal(p.eligibleCandidates({role:'deep_final'}).some(c=>c.id==='jev-choice'),false);
  const compatible=p.eligibleCandidates({role:'quick_answer',features:{jsonSchema:true,toolActions:true,korean:true,maxOutputTokens:3000}});
  assert.ok(compatible.every(x=>x.jsonSchema && x.toolActions && x.maxOutputTokens>=3000));
  assert.equal(compatible.some(x=>x.id==='sail-open'),false);
  assert.deepEqual(p.eligibleCandidates({role:'deep_final',remainingBudget:0}),[]);
  assert.deepEqual(p.eligibleCandidates({role:'deep_final',remainingBudget:{remainingCalls:0}}),[]);
  assert.deepEqual(p.eligibleCandidates({role:'deep_final',remainingBudget:{remainingMs:0}}),[]);
  assert.deepEqual(p.eligibleCandidates({role:'deep_final',features:{maxOutputTokens:50000}}),[]);
});

test('obsolete credit proof fields do not block configured APIs',async()=>{
  const p=createProviderPool({env:allKeys,billingSafety:{gateway:{verifiedFreeOnly:true,enforcedNoPaidUsage:false,remainingUsd:5,validUntil:future}},
    clock:()=>future-1,fetchImpl:async()=>{throw Error('must not call network');}});
  assert.equal(p.providerStatus({role:'quick_answer'}).find(x=>x.id==='gateway-lite').reason,'ready');
  const stale=pool({clock:()=>future+1});
  assert(stale.eligibleCandidates({role:'quick_answer'}).length>0);
});

test('HTTP errors are typed, sanitized and never retried',async()=>{
  const cases=[
    ['gemini-lite',429,{error:{status:'RESOURCE_EXHAUSTED'}},'quota_exhausted'],
    ['gemini-lite',403,{error:{code:403,status:'RESOURCE_EXHAUSTED'}},'quota_exhausted'],
    ['gemini-lite',403,{error:{message:'Daily quota exceeded'}},'quota_exhausted'],
    ['gateway-lite',429,{error:{code:'rate_limit_exceeded'}},'rate_limited'],
    ['gateway-lite',402,{error:{code:'payment_required'}},'credits_exhausted'],
    ['sail-open',402,{error:{code:'insufficient_balance'}},'credits_exhausted'],
    ['sail-open',401,{error:{message:'bad secret key-one'}},'provider_configuration'],
    ['sail-open',403,{},'provider_configuration'],
    ['sail-open',503,{},'model_unavailable'],
    ['gateway-lite',404,{},'model_unavailable'],
    ['gemini-lite',500,{},'model_failed'],
    ['sail-open',422,{},'model_protocol']
  ];
  for(const [id,status,body,code] of cases) {
    let calls=0;
    const events=[];
    const p=pool({fetchImpl:async()=>{calls++;return bad(status,body);},onEvent:x=>events.push(x)});
    await rejection(()=>p.invokeOnce({candidate:selected(p,id),...opts}),code);
    assert.equal(calls,1,id);
    assert.equal(events.at(-1).errorCode,code,id);
    assert.ok(!JSON.stringify(events).includes('key-one'));
  }
});

test('bad provider JSON, missing output and oversized responses are protocol errors',async()=>{
  for(const response of [
    {ok:true,status:200,text:async()=>'{'},
    ok({choices:[{message:{content:'not-json'}}]}),
    ok({choices:[]}),
    {ok:true,status:200,text:async()=>JSON.stringify({x:'X'.repeat(600000)})}
  ]) {
    const p=pool({fetchImpl:async()=>response});
    await rejection(()=>p.invokeOnce({candidate:selected(p,'sail-open'),...opts}),'model_protocol');
  }
});

test('signal cancellation, provider abort and timeout are bounded',async()=>{
  const p=pool({fetchImpl:async(_url,{signal})=>new Promise((_resolve,reject)=>{
    signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})),{once:true});
  })});
  const c=selected(p,'gemini-lite');
  const controller=new AbortController();
  controller.abort();
  await rejection(()=>p.invokeOnce({candidate:c,...opts,signal:controller.signal}),'model_timeout');
  await rejection(()=>p.invokeOnce({candidate:c,...opts,timeoutMs:10}),'model_timeout');
});

test('events never disclose keys or input and cannot throw into business logic',async()=>{
  const events=[];
  const p=pool({fetchImpl:async()=>gemini({answer:true}),onEvent:event=>{
    events.push(event);throw Error('broken monitoring');
  }});
  await p.invokeOnce({candidate:selected(p,'gemini-lite'),...opts});
  assert.deepEqual(events.map(x=>x.stage),['attempt','completed']);
  const printable=JSON.stringify(events);
  for(const value of Object.values(allKeys)) assert.ok(!printable.includes(value));
  assert.ok(!printable.includes('Why did ROAS change'));
});

test('unknown candidates and invalid timeout never perform an HTTP request',async()=>{
  let count=0;
  const p=pool({fetchImpl:async()=>{count++;return gemini({ok:true});}});
  await rejection(()=>p.invokeOnce({candidate:{id:'unknown'},...opts}),'provider_configuration');
  await rejection(()=>p.invokeOnce({candidate:selected(p,'gemini-lite'),...opts,timeoutMs:0}),'provider_configuration');
  assert.equal(count,0);
});


test('quota exhaustion blocks the Google bucket while leaving Gateway and Sail as fallback options',async()=>{
  let calls=0;
  const p=pool({fetchImpl:async()=>{calls++;return bad(429,{error:{status:'RESOURCE_EXHAUSTED'}});}});
  const oldCandidate=selected(p,'gemini-lite');
  await rejection(()=>p.invokeOnce({candidate:oldCandidate,...opts}),'quota_exhausted');
  assert.equal(p.providerStatus({role:'deep_reasoning'}).find(c=>c.id==='gemini-deep').reason,'quota_exhausted');
  assert.ok(p.eligibleCandidates({role:'quick_answer'}).some(c=>c.id==='gateway-lite'));
  assert.ok(p.eligibleCandidates({role:'quick_answer'}).some(c=>c.id==='sail-open'));
  await rejection(()=>p.invokeOnce({candidate:oldCandidate,...opts}),'quota_exhausted');
  assert.equal(calls,1);
});

test('large or circular schemas are rejected before the network boundary',async()=>{
  let calls=0;
  const p=pool({fetchImpl:async()=>{calls++;return gemini({ok:true});}});
  const c=selected(p,'gemini-lite');
  await rejection(()=>p.invokeOnce({candidate:c,...opts,responseSchema:{notes:'x'.repeat(20000)}}),'model_protocol');
  const schema={type:'object'};
  schema.self=schema;
  await rejection(()=>p.invokeOnce({candidate:c,...opts,responseSchema:schema}),'model_protocol');
  assert.equal(calls,0);
});

test('Jev refuses a classified option that was not sent in the criteria',async()=>{
  const p=pool({fetchImpl:async()=>ok({model:'jev-latest',answers:{first_tool:{
    type:'choice',choice:'rogue',confidence:0.9,probabilities:{rogue:0.9}
  }}})});
  await rejection(()=>p.invokeOnce({candidate:selected(p,'jev-choice'),instruction:'Choose',input:{
    state:'A marketing question',choices:{overview:'Summary',trend:'Daily history'}
  }}),'model_protocol');
});
