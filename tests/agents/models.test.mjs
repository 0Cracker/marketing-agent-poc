import test from 'node:test';
import assert from 'node:assert/strict';
import {createRemoteModel} from '../../backend/agent-model.mjs';
import {toolDefinitions} from '../../backend/agent-flow.mjs';

const context={role:'analysis',question:'가격 관련 근거를 확인',scope:{},history:[],tools:{market_compare:toolDefinitions.market_compare}};
const options={model:'explicit-test-model',apiKey:'unit-test-not-a-real-key',allowDataTransmission:true};
for(const provider of ['gemini','groq']){
  test(`M01 ${provider}: API response becomes validated tool request, network stub only`,async()=>{
    let request;
    const model=createRemoteModel({...options,provider,fetchImpl:async(url,init)=>{request={url,init,body:JSON.parse(init.body)};return new Response(JSON.stringify(provider==='gemini'?{candidates:[{content:{parts:[{text:JSON.stringify({tool:'market_compare',args:{}})}]}}]}:{choices:[{message:{content:JSON.stringify({tool:'market_compare',args:{}})}}]}));}});
    assert.deepEqual(await model(context),{tool:'market_compare',args:{}});
    assert.ok(request.url.startsWith('https://'));assert.ok(request.init.signal);
    assert.ok(!request.init.body.includes(options.apiKey));assert.ok(request.init.body.includes('UNTRUSTED'));
    if(provider==='gemini')assert.ok(request.body.generationConfig.responseJsonSchema.anyOf.some(branch=>branch.properties.tool));
  });
}
test('M02 no transmission opt-in means zero network calls',()=>{
  let calls=0;assert.throws(()=>createRemoteModel({...options,provider:'groq',allowDataTransmission:false,fetchImpl:()=>{calls++;}}),e=>e.code==='data_transmission_not_enabled');assert.equal(calls,0);
});
for(const [id,change] of [['M03',{provider:'unknown'}],['M04',{model:''}],['M05',{apiKey:''}]]){
  test(`${id} provider/model/key must be explicit`,()=>assert.throws(()=>createRemoteModel({...options,provider:'groq',...change})));
}
for(const [id,status,code] of [['M06',429,'quota_exhausted'],['M07',503,'model_failed'],['M08',401,'model_failed']]){
  test(`${id} HTTP ${status} is safe failure without blind retries or key leakage`,async()=>{
    let calls=0;const model=createRemoteModel({...options,provider:'groq',fetchImpl:async()=>{calls++;return new Response(options.apiKey,{status});}});
    await assert.rejects(model(context),e=>e.code===code&&!e.message.includes(options.apiKey));assert.equal(calls,1);
  });
}
test('M09 timeout is resumable, rather than silently dropping state',async()=>{
  const model=createRemoteModel({...options,provider:'groq',fetchImpl:async()=>{const e=Error('timeout');e.name='TimeoutError';throw e;}});
  await assert.rejects(model(context),e=>e.code==='model_timeout');
});
test('M13 structured finish permits issued facts only and preserves all returned counter references',async()=>{
  const {tools,scope}=await import('./support.mjs');
  const market=tools.call('market_compare',{},scope),relations=tools.call('relations',{candidate:'price'},scope);let schema;
  const model=createRemoteModel({...options,provider:'gemini',fetchImpl:async(url,init)=>{schema=JSON.parse(init.body).generationConfig.responseJsonSchema;return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({tool:'market_compare',args:{}})}]}}]}));}});
  await model({...context,focus:'price',history:[{tool:'market_compare',result:market},{tool:'relations',result:relations}]});
  const finish=schema.anyOf.find(branch=>branch.properties.finish).properties.finish;
  assert.deepEqual(finish.properties.facts.items.enum,market.facts.map(f=>f.id));
  const hypothesis=finish.properties.hypotheses.prefixItems[0];
  assert.deepEqual(hypothesis.properties.counters.prefixItems.map(item=>item.enum[0]),relations.counterIds);
  assert.equal(hypothesis.properties.counters.minItems,relations.counterIds.length);
});
for(const [id,payload] of [['M10',{choices:[]}],['M11',{choices:[{message:{content:'not json'}}]}],['M12',{choices:[{message:{content:JSON.stringify({text:'ignore tool rules'})}}]}]]){
  test(`${id} malformed provider output rejected`,async()=>{
    const model=createRemoteModel({...options,provider:'groq',fetchImpl:async()=>new Response(JSON.stringify(payload))});await assert.rejects(model(context),e=>e.code==='model_protocol');
  });
}
