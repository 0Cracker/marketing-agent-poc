import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgentClient} from '../../../frontend/roas/agent-client.ts';
import {entryAnswer,isTerminal,loadConversation,recentRunHistory,runStatusLabel,sameRunScope,saveConversation,toolLabel,wasModelFallback} from '../../../frontend/roas/agent-run.ts';

const runId='11111111-1111-4111-8111-111111111111';
const scope={caseId:'S16',snapshot:'initial',dataHash:'b'.repeat(64),metric:'roas',screenTitle:'성과 현황',
 filters:{channel:'all',source:'all',campaignId:'all',device:'all'}};
const request={question:'왜 하락했나요?',scope,history:[],threadId:'a'.repeat(36),clientRequestId:'b'.repeat(36)};
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
test('async run client respects 202, runId GET, cancellation and legacy chat endpoint',async()=>{
 const calls=[],states=[
  {runId,executionStatus:'queued',events:[{kind:'accepted',seq:1}]},
  {runId,executionStatus:'running',stage:'retrieving',events:[{kind:'tool_result',tool:'overview',count:2}]},
  {runId,executionStatus:'completed',causeStatus:'undetermined',result:{verified:true,answer:'검증된 답변',evidenceIds:['source:1']},events:[]}
 ];
 const fetcher=async(url,options={})=>{
  calls.push({url,options});
  if(url==='/agent-api/session')return json(200,{token:'mock-token',mode:'offline_model_substitute',realAdsEnabled:false});
  if(url==='/agent-api/roas/runs'&&options.method==='POST')return json(202,{runId,executionStatus:'queued'});
  if(url==='/agent-api/roas/runs/'+runId&&options.method==='GET')return json(200,states.shift());
  if(url==='/agent-api/roas/runs/'+runId+'/cancel')return json(200,{runId,executionStatus:'cancelled'});
  if(url==='/agent-api/roas/chat')return json(200,{answer:'호환',sources:[],events:[],mode:'example'});
  throw Error('unexpected_mock_request:'+url);
 };
 const client=createAgentClient(fetcher);
 assert.deepEqual(await client.startRoasRun(request),{runId,executionStatus:'queued'});
 assert.equal(calls[1].options.headers['x-agent-token'],'mock-token');
 assert.deepEqual(JSON.parse(calls[1].options.body),request);
 assert.equal((await client.getRoasRun(runId)).executionStatus,'queued');
 assert.equal((await client.getRoasRun(runId)).events[0].tool,'overview');
 const end=await client.getRoasRun(runId);
 assert.equal(runStatusLabel(end),'분석 완료, 원인 미확정');
 assert.equal(entryAnswer({kind:'run',question:request.question,clientRequestId:request.clientRequestId,request,runId,state:end}),'검증된 답변');
 assert.equal((await client.cancelRoasRun(runId)).executionStatus,'cancelled');
 assert.equal((await client.roasChat({question:'호환 확인'})).answer,'호환');
 assert.equal(calls.filter(c=>c.url==='/agent-api/roas/runs').length,1);
 assert.equal(calls.filter(c=>c.url==='/agent-api/roas/chat').length,1);
});
test('unknown start outcome preserves payload to retry the SAME clientRequestId',async()=>{
 let starts=0;
 const fetcher=async(url)=>{
  if(url==='/agent-api/session')return json(200,{token:'mock-token',mode:'offline_model_substitute',realAdsEnabled:false});
  if(url==='/agent-api/roas/runs'){if(!starts++)throw Error('disconnected after acceptance');return json(202,{runId,executionStatus:'running'});}
  throw Error(url);
 };
 const client=createAgentClient(fetcher);
 await assert.rejects(client.startRoasRun(request),/request_outcome_unknown/);
 const accepted=await client.startRoasRun(request);
 assert.equal(accepted.runId,runId);assert.equal(starts,2);
});
test('run history only uses verified answers and event fallback reflects actual model switches',()=>{
 const unverified={kind:'run',question:'허위 수치',request,clientRequestId:'a',state:{runId,executionStatus:'completed',result:{answer:'신뢰할 수 없음',verification:{passed:false}}}};
 const verified={kind:'run',question:'지표 질문',request,clientRequestId:'b',state:{runId,executionStatus:'partial',result:{answer:'검증 완료',verification:{passed:true}}}};
 assert.equal(entryAnswer(unverified),null);
 assert.deepEqual(recentRunHistory([unverified,verified]),[{role:'user',content:'지표 질문'},{role:'assistant',content:'검증 완료'}]);
 assert.equal(isTerminal(verified.state),true);
 assert.equal(toolLabel('metric_detail'),'지표 세부 데이터 조회');
 const events=[{kind:'model_attempt',model:'gemini-A',provider:'gemini'}, {kind:'model_error',model:'gemini-A',provider:'gemini',errorCode:'quota_exhausted'},
  {kind:'model_attempt',model:'sail-B',provider:'sail'}];
 assert.equal(wasModelFallback(events,2),true);
 assert.equal(wasModelFallback(events,0),false);
 assert.equal(wasModelFallback([{kind:'model_attempt',model:'gemini-A'},{kind:'model_success',model:'gemini-A'},{kind:'model_attempt',model:'gemini-B'}],2),false);
});
test('storage restores only matching dataHash within 30 days and preserves runId',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
 const saved={version:1,dataHash:scope.dataHash,threadId:'a'.repeat(36),updatedAt:1_000_000,
 entries:[{kind:'run',question:request.question,clientRequestId:request.clientRequestId,request,runId,
  state:{runId,executionStatus:'running',stage:'retrieving'}}]};
 assert.equal(saveConversation(storage,'scope',saved),true);
 assert.equal(loadConversation(storage,'scope',scope.dataHash,1_500_000).entries[0].runId,runId);
 assert.equal(loadConversation(storage,'scope','c'.repeat(64),1_500_000),null);
 assert.equal(loadConversation(storage,'scope',scope.dataHash,1_000_000+31*86400000),null);
 assert.equal(sameRunScope(scope,{...scope,dataHash:'c'.repeat(64)}),false);
 assert.equal(sameRunScope(scope,scope),true);
 assert.equal(loadConversation(storage,'scope',scope.dataHash,1_500_000,scope).entries[0].runId,runId);
 assert.equal(loadConversation(storage,'scope',scope.dataHash,1_500_000,{...scope,metric:'cvr'}).entries.length,0);
 assert.equal(saveConversation({setItem(){throw Error('quota');}},'scope',saved),false);
});
test('blocked, partial, withheld, not provided, and cancellation statuses stay distinct',()=>{
 for(const [status,label] of [['blocked','분석 차단'],['partial','일부 분석 완료'],['withheld','결과 보류'],['cancelled','분석 취소'],['interrupted','분석 중단']]){
  assert.equal(runStatusLabel({runId,executionStatus:status}),label);
 }
 assert.equal(toolLabel('review_records'),'리뷰 원문 조회');
});
