import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisAnswer,budgetConclusion} from '../frontend/workbench/agent-answer.ts';
import {str} from '../frontend/workbench/values.ts';

// Control-state tests only: no new marketing observations, amounts or evidence.
test('answer does not promote held, paused or cancelled runs to a conclusion',()=>{
  assert.match(analysisAnswer({status:'held'}).conclusion,/보류/);
  assert.match(analysisAnswer({status:'paused'}).conclusion,/아직 결론이 없/);
  assert.match(analysisAnswer({status:'cancelled'}).conclusion,/결론을 제시하지 않/);
  assert.match(analysisAnswer({status:'needs_scope'}).next,/국가·제품·기간/);
});
test('superseded analysis takes priority over a successful previous status',()=>{
  assert.match(analysisAnswer({status:'analyzed',supersededBy:'next-run'}).conclusion,/대체/);
});
test('absent evidence remains unresolved even when analysis processing finished',()=>{
  assert.match(analysisAnswer({status:'analyzed',output:{}}).conclusion,/판단하기 어렵/);
});
test('conflicting or one-sided evidence never establishes causation',()=>{
  const hypothesis={candidate:'price',supports:[],counters:[],assessment:'mixed'};
  assert.match(analysisAnswer({status:'analyzed',output:{hypotheses:[hypothesis]}}).conclusion,/엇갈려.*확정할 수 없/);
  assert.match(analysisAnswer({status:'analyzed',output:{hypotheses:[{...hypothesis,assessment:'support_only'}]}}).conclusion,/인과는 확인되지 않/);
});
test('approval and invalidation are described as state, never actual execution',()=>{
  assert.match(budgetConclusion({status:'approved'}),/실제 광고 집행은 연결되지 않/);
  assert.match(budgetConclusion({status:'invalidated'}),/무효/);
  assert.match(budgetConclusion({status:'rejected'}),/거절/);
});
test('a missing simulation cannot be presented as a winning budget proposal',()=>{
  assert.match(budgetConclusion({status:'pending_approval'}),/비교 결과가 없/);
  assert.match(budgetConclusion({status:'held'}),/아직 승인할 수/);
});
test('loading without brand reference data does not crash the dashboard',()=>{
  assert.equal(str(undefined,'brand_name'),'');
});
