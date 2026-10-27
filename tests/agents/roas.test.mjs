import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoasChat,roasDataHash,roasProtocol} from '../../backend/roas-agent.mjs';
import {trainingIndex,trainingScreenData} from '../../scripts/training-data.mjs';
import {selectFacts,selectRecords,summarize} from '../../shared/training-dashboard.mjs';
import {createAgentServer} from '../../backend/agent-http.mjs';
import {createRemoteModel} from '../../backend/agent-model.mjs';
import {createLiveRuntime} from '../../backend/agent-runtime.mjs';
import {chatComparison,chatHighlights,chatSourceRows,chatValue} from '../../shared/roas-chat.mjs';

function request(caseId='S16',snapshot='initial',filters={channel:'all',source:'all',campaignId:'all',device:'all'}){
 const data=trainingScreenData(undefined,caseId,snapshot);
 return {question:'ROAS 변화와 운영 근거를 설명해줘',scope:{caseId,snapshot,filters,dataHash:roasDataHash(data),metric:''},history:[]};
}
const finish=ids=>({finish:{conclusion:'조회한 근거를 확인했습니다. ['+ids[0]+']',summary:['조회한 수치를 비교했습니다.'],reasoning:['집계에 포함된 실제 자료를 사용했습니다.'],actions:['기간과 적용 범위를 확인하세요.'],limitations:['관측 기록만으로 원인을 확정할 수 없습니다.'],evidenceIds:ids,comparison:{metric:'none',sourceIds:[]}}});

test('ROAS all eighteen cases and both snapshots reuse screen sums, with no mutations',async()=>{
 const chat=createRoasChat();
 for(const item of trainingIndex().cases)for(const snapshot of ['initial','mature']){
  const input=request(item.id,snapshot),pack=trainingScreenData(undefined,item.id,snapshot),before=roasDataHash(pack);
  const result=await chat(input);
  assert.equal(result.mode,'offline_model_substitute');assert.match(result.answer,/오프라인/);
  for(const source of result.sources){
   const rows=selectFacts(pack,input.scope.filters).filter(row=>row.periodId===source.period.id);
   assert.deepEqual(source.total,summarize(rows));assert.equal(source.rowCount,rows.length);
  }
  assert.equal(roasDataHash(trainingScreenData(undefined,item.id,snapshot)),before);
 }
});

test('ROAS rejects stale data, invalid cases/snapshots, forged filters and raw records before model calls',async()=>{
 let calls=0;const chat=createRoasChat({model:async()=>{calls++;return finish(['summary:current']);}});
 const input=request();
 for(const scope of [{...input.scope,caseId:'../secret'},{...input.scope,snapshot:'future'},{...input.scope,dataHash:'stale'},{...input.scope,filters:{...input.scope.filters,device:'tablet'}},{...input.scope,filters:{...input.scope.filters,campaignId:'missing'}},{...input.scope,filters:{...input.scope.filters,source:'secret'}}])await assert.rejects(chat({...input,scope}));
 await assert.rejects(chat({...input,rawRecords:[]}));await assert.rejects(chat({...input,question:''}));
 assert.equal(calls,0);
});

test('ROAS scoped model tools return only chosen campaign/device, use existing records, and retain followups',async()=>{
 const filters={channel:'search',source:'google',campaignId:'EDU-C1',device:'mobile'},input=request('S16','initial',filters),pack=trainingScreenData(undefined,'S16','initial');
 input.history=[{role:'user',text:'비용을 봐줘'},{role:'assistant',text:'기존 답변'}];
 let calls=0;
 const chat=createRoasChat({model:async context=>{
  assert.deepEqual(context.conversation,input.history);assert.equal(context.scope.filters.campaignId,'EDU-C1');
  assert.equal(context.overview.find(r=>r.period.id==='current').total.spend,summarize(selectFacts(pack,filters).filter(r=>r.periodId==='current')).spend);
  assert(context.campaigns.every(row=>row.key==='EDU-C1'));
  if(calls++===0)return {tool:'breakdown',args:{dimension:'product'}};
  if(calls===2)return {tool:'trend',args:{}};
  if(calls===3)return {tool:'records',args:{limit:24}};
  const recordRows=context.history.find(h=>h.tool==='records').result.rows;
  const validIds=new Set(selectRecords(pack,filters).map(r=>r.id));assert(recordRows.every(r=>validIds.has(r.id)));assert(recordRows.every(r=>!r.campaignId||r.campaignId==='EDU-C1'));
  return finish([context.history[0].result.rows[0].id,context.history[1].result.rows[0].id,...recordRows.slice(0,1).map(r=>r.id)]);
 }});
 const result=await chat(input);assert.equal(calls,4);assert.equal(result.mode,'remote_model');assert.equal(result.events.length,4);assert(result.sources.some(s=>s.kind==='daily'));
});

test('ROAS pagination, empty searches and all breakdown dimensions remain complete and non-overlapping',async()=>{
 const pack=trainingScreenData(undefined,'S16','initial'),input=request();
 for(const dimension of ['campaign','device','product','creativeId','audienceId','placement','keyword','browser','paymentMethod']){
  let called=false;
  await createRoasChat({model:async context=>{
   if(!called){called=true;return {tool:'breakdown',args:{dimension}};}
   const rows=context.history[0].result.rows;
   for(const period of pack.periods){
    const grouped=rows.filter(r=>r.period.id===period.id);
    if(dimension!=='keyword')assert.equal(grouped.reduce((sum,row)=>sum+row.total.spend,0),summarize(pack.facts.filter(r=>r.periodId===period.id)).spend,dimension);
   }
   return finish(['summary:current']);
  }})(input);
 }
 let step=0;
 await createRoasChat({model:async context=>{
  if(step++===0)return {tool:'records',args:{limit:1}};
  const first=context.history[0].result;assert.equal(first.rows.length,1);assert.equal(first.total,pack.records.length);assert.equal(first.nextOffset,1);
  if(step===2)return {tool:'records',args:{offset:1,limit:24}};
  assert(!context.history[1].result.rows.some(row=>row.id===first.rows[0].id));
  if(step===3)return {tool:'records',args:{query:'no such record'}};
  assert.deepEqual(context.history[2].result.rows,[]);return finish(['summary:current']);
 }})(input);
});

test('ROAS refuses invented citations, duplicate calls, invalid arguments and excess turns',async()=>{
 const input=request();
 const badCitation=finish(['summary:current']);badCitation.finish.reasoning=['보고 [invented]'];
 for(const model of [async()=>finish(['invented']),async()=>badCitation,async()=>({tool:'trend',args:{}}),async()=>({tool:'records',args:{limit:25}}),async()=>({tool:'records',args:{path:'../private'}}),async()=>({finish:{answer:'',evidenceIds:[]}})])await assert.rejects(createRoasChat({model})(input));
 let offset=0;await assert.rejects(createRoasChat({model:async()=>({tool:'records',args:{offset:offset++,limit:1}})})(input),/roas_query_limit/);
});

test('ROAS grouped and numbered references normalize to retrieved source IDs',async()=>{
 const action=finish(['summary:current']);action.finish.conclusion='확인 [1] [summary:baseline, summary:current]';
 const result=await createRoasChat({model:async()=>action})(request());
 assert.equal(result.sections.conclusion,'확인 [summary:current] [summary:baseline] [summary:current]');
 assert.deepEqual(result.sources.map(row=>row.id),['summary:current','summary:baseline']);
});

test('ROAS structured sections and comparison use actual source values, with reconstructable raw rows',async()=>{
 const input=request(),data=trainingScreenData(undefined,'S16','initial');
 const action=finish(['summary:baseline','summary:current']);action.finish.comparison={metric:'roas',sourceIds:action.finish.evidenceIds};
 const result=await createRoasChat({model:async()=>action})(input);
 assert(result.sections.conclusion);assert.equal(result.sections.actions.length,1);
 const before=summarize(data.facts.filter(row=>row.periodId==='baseline')),after=summarize(data.facts.filter(row=>row.periodId==='current'));
 assert.equal(result.comparison.rows[0].before,before.rates.roas);assert.equal(result.comparison.rows[0].after,after.rates.roas);
 for(const source of result.sources)assert.deepEqual(summarize(chatSourceRows(data,input.scope.filters,source)),source.total);
 const mixed=[...result.sources,{...result.sources[0],id:'campaign:EDU-C1:baseline',kind:'breakdown',dimension:'campaign',key:'EDU-C1'}];assert.equal(chatComparison(mixed,'roas'),null);
 assert.equal(chatComparison(result.sources.slice(0,1),'roas'),null);
 for(const comparison of [{metric:'roas',sourceIds:['summary:current']},{metric:'none',sourceIds:['summary:current']},{metric:'none',sourceIds:[],highlights:['lowest_current']},{metric:'roas',sourceIds:['summary:baseline','summary:current'],values:[10,20]}]){
  await assert.rejects(createRoasChat({model:async()=>({finish:{...action.finish,comparison}})})(input));
 }
 await assert.rejects(createRoasChat({model:async()=>({finish:{...action.finish,actions:[]}})})(input),/model_protocol/);
});

test('ROAS raw evidence matches every provided breakdown and selected device',async()=>{
 const data=trainingScreenData(undefined,'S16','initial'),filters={channel:'all',source:'all',campaignId:'all',device:'mobile'},input=request('S16','initial',filters);
 for(const dimension of ['campaign','device','product','creativeId','audienceId','placement','keyword','browser','paymentMethod']){
  let called=false;
  const result=await createRoasChat({model:async context=>{
   if(!called){called=true;return {tool:'breakdown',args:{dimension}};}
   return finish(context.history[0].result.rows.slice(0,2).map(row=>row.id));
  }})(input);
  for(const source of result.sources){const rows=chatSourceRows(data,filters,source);assert(rows.every(row=>row.device==='mobile'));assert.deepEqual(summarize(rows),source.total);}
 }
});

test('ROAS comparison leaves zero-purchase AOV unavailable rather than drawing a false zero',async()=>{
 const input=request('S11'),data=trainingScreenData(undefined,'S11','initial'),product=data.products[1].id;
 let queried=false;
 const result=await createRoasChat({model:async()=>{
  if(!queried){queried=true;return {tool:'breakdown',args:{dimension:'product'}};}
  const ids=[`product:${product}:baseline`,`product:${product}:current`],action=finish(ids);action.finish.comparison={metric:'aov',sourceIds:ids};return action;
 }})(input);
 assert.equal(result.comparison.rows[0].after,null);assert.equal(chatValue(result.comparison.rows[0].after,'aov'),'계산 불가');
});

test('ROAS ranking conclusions distinguish current minimum from largest decline and prevent cherry-picking',async()=>{
 const input=request();let saved;
 const chat=createRoasChat({model:async context=>{
  assert(context.rankingFacts.some(text=>text.includes('Instagram 피드')&&text.includes('96.5%')));
  const ids=context.campaigns.map(row=>row.id),action=finish(ids);action.finish.comparison={metric:'roas',sourceIds:ids,highlights:['lowest_current','largest_decline']};saved=action;return action;
 }});
 const result=await chat(input);
 assert.match(result.sections.conclusion,/Instagram 피드.*96\.5%/);assert.match(result.sections.conclusion,/검색 A.*-293\.7%p/);
 assert.equal(chatHighlights(result.comparison,['lowest_current']).length,1);
 const partial={...saved.finish,comparison:{...saved.finish.comparison,sourceIds:saved.finish.comparison.sourceIds.slice(0,4)}};
 await assert.rejects(createRoasChat({model:async()=>({finish:partial})})(input),/model_protocol/);
});

test('ROAS HTTP endpoint keeps session token/origin checks and validates input',async()=>{
 const server=createAgentServer(null,{roasChat:createRoasChat()});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}/agent-api`;
 try{
  const session=await (await fetch(base+'/session')).json();
  const send=(input,headers={})=>fetch(base+'/roas/chat',{method:'POST',headers:{'content-type':'application/json','x-agent-token':session.token,...headers},body:JSON.stringify(input)});
  assert.equal((await send(request(),{'x-agent-token':''})).status,403);
  assert.equal((await send(request(),{origin:'https://untrusted.example'})).status,403);
  assert.equal((await send({...request(),records:[]})).status,400);
  const response=await send(request());assert.equal(response.status,200);assert.equal((await response.json()).mode,'offline_model_substitute');
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('ROAS uses the existing provider transport with its own answer protocol',async()=>{
 let sent;
 const model=createRemoteModel({provider:'gemini',model:'test',apiKey:'unit-test-key',allowDataTransmission:true,protocol:roasProtocol,fetchImpl:async(url,options)=>{
  sent=JSON.parse(options.body);
  return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(finish(['summary:current']))}]}}]}));
 }});
 await createRoasChat({model})(request());
 assert.match(sent.systemInstruction.parts[0].text,/ROAS dashboard/);assert(!sent.systemInstruction.parts[0].text.includes('market_compare'));
 assert(sent.generationConfig.responseJsonSchema.anyOf.some(choice=>choice.properties.finish));
 const references=sent.generationConfig.responseJsonSchema.anyOf.find(choice=>choice.properties.finish).properties.finish.properties.evidenceIds.items.enum;
 assert(references.includes('campaign:EDU-C1:current'));assert(!references.includes('invented'));
});

test('ROAS and catalog share model pacing while selecting their own protocols',async()=>{
 const sent=[];let current=0;
 const runtime=createLiveRuntime({env:{GEMINI_API_KEY:'unit-test-key'},protocol:context=>context.kind==='roas'?roasProtocol:undefined,now:()=>current,wait:async ms=>{current+=ms;},fetchImpl:async(_url,options)=>{
  sent.push(JSON.parse(options.body));return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(finish(['summary:current']))}]}}]}));
 }});
 await createRoasChat({model:runtime.model})(request());
 await runtime.model({role:'analysis',history:[],tools:{}});
 assert.match(sent[0].systemInstruction.parts[0].text,/ROAS dashboard/);
 assert.match(sent[1].systemInstruction.parts[0].text,/market_compare/);assert(current>0,'one pacing queue for both screens');
});
