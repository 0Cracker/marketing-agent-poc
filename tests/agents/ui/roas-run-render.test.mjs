import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

const server=await createServer({server:{middlewareMode:true},appType:'custom'});
after(async()=>await server.close());
const {RoasRunView}=await server.ssrLoadModule('/roas/roas-answer.tsx');
const runId='11111111-1111-4111-8111-111111111111';
const render=props=>renderToStaticMarkup(createElement(RoasRunView,props));

test('run component shows only actual tool/model events, fallback, and cancel button',()=>{
 const html=render({onCancel:()=>{},state:{runId,executionStatus:'running',stage:'retrieving',route:'deep',events:[
  {seq:1,kind:'model_error',model:'gemini-A',provider:'gemini',errorCode:'quota_exhausted',
   failurePhase:'http_status',causeCode:'RESOURCE_EXHAUSTED',httpStatus:429,at:1700000000000},
  {seq:2,kind:'model_attempt',model:'sail-B',provider:'sail',transport:'api',billingBucket:'free',at:1700000001000},
  {seq:3,kind:'tool_result',tool:'metric_detail',status:'not_provided',count:0,elapsedMs:5,evidenceIds:['ev:1']}
 ]}});
 assert.match(html,/분석 진행 중/);
 assert.match(html,/심층 조사/);
 assert.match(html,/다른 모델로 전환 중/);
 assert.match(html,/실패 구간 http_status, 원래 코드 RESOURCE_EXHAUSTED, HTTP 429/);
 assert.match(html,/자료 미제공/);
 assert.match(html,/지표 세부 데이터 조회/);
 assert.match(html,/근거 ID.*ev:1/);
 assert.match(html,/분석 취소/);
 assert.doesNotMatch(html,/인과관계 확정/);
});
test('completed with undetermined cause displays the answer',()=>{
 const html=render({state:{runId,executionStatus:'completed',causeStatus:'undetermined',
  result:{answer:'검증된 분석 내용',evidenceIds:['ev:verified']},events:[]}});
 assert.match(html,/분석 완료, 원인 미확정/);
 assert.match(html,/검증된 분석 내용/);
 assert.match(html,/ev:verified/);
 assert.doesNotMatch(html,/분석 취소/);
});
test('answer displays without approval flags or citation requirements',()=>{
 const html=render({state:{runId,executionStatus:'completed',
  result:{answer:'검증되지 않은 숫자 999%',verification:{passed:false},evidenceIds:[]},events:[]}});
 assert.match(html,/999%/);
 assert.doesNotMatch(html,/답변을 받지 못했습니다/);
});
test('Markdown renders a table and escapes embedded HTML',()=>{
 const html=render({state:{runId,executionStatus:'completed',events:[],
  result:{answer:'**결론**\n\n| 지표 | 값 |\n| --- | --- |\n| 캠페인 \\| ROAS | [EV-sample] |\n\n<img src=x onerror=alert(1)>'}}});
 assert.match(html,/<strong>결론<\/strong>/);
 assert.match(html,/<th scope="col">지표<\/th>/);
 assert.match(html,/<td>캠페인 \| ROAS<\/td>/);
 assert.match(html,/<code>\[EV-sample\]<\/code>/);
 assert.match(html,/&lt;img/);
 assert.doesNotMatch(html,/<img src=x/);
});
test('partial, withheld, blocked statuses remain distinct',()=>{
 for(const [status,label] of [['partial','일부 분석 완료'],['withheld','결과 보류'],['blocked','분석 차단']]){
  assert.match(render({state:{runId,executionStatus:status,events:[]}}),new RegExp(label));
 }
});
