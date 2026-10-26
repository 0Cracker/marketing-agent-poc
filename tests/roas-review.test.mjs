import test from 'node:test';
import assert from 'node:assert/strict';
import {roasScreenData} from '../scripts/current-data.mjs';
import {renderRoasReview} from '../backend/roas-review.mjs';
import {applyReviewDraft, validateReviewDraft, validateSelectedAction} from '../shared/roas-review.mjs';
import {renderInvestigationSummary} from '../shared/roas-investigation-report.mjs';
import {deviceEvidence, stageDiagnosis} from '../shared/roas-diagnosis.mjs';

const report = roasScreenData();
// Reuse the installed, approved scenario; these edits contain no new observations.
const content = () => ({
  actions: report.actionDrafts.map((action, index) => ({target: action.target, selected: index === 0, text: action.change, evidenceIds: action.evidenceIds})),
  budgets: report.budgetReview.map(budget => ({channel: budget.channel, direction: '판단 보류'})),
  note: '',
});

test('export replaces default proposals with exactly the selected reviewer draft', () => {
  const draft = content();
  draft.budgets.find(budget => budget.channel === 'social').direction = '감액 검토';
  draft.note = `근거: ${report.actionDrafts[0].evidenceIds.join(', ')}\n재검토 조건: ${report.budgetReview[0].reason || report.actionDrafts[0].change}`;
  const markdown = applyReviewDraft(report.markdown, draft);
  const section = markdown.split('## 4. 담당자 검토 초안')[1].split('## 근거와 남은 확인')[0];
  assert.equal((markdown.match(/## 4\./g) || []).length, 1);
  assert(section.includes('소셜: 감액 검토'));
  assert(section.includes(draft.actions[0].text));
  assert(!section.includes(report.actionDrafts[1].change));
  assert(!section.includes('수정 문구 초안:'));
  assert(!section.includes('증액, 감액, 유지의 판단을 보류한다'));
  assert.equal(markdown, renderRoasReview(report, draft));
  assert.equal(applyReviewDraft(markdown, draft), markdown);
  assert.equal(markdown.split('## 4.')[0], report.markdown.split('## 4.')[0]);
  assert.equal(markdown.split('## 근거와 남은 확인')[1], report.markdown.split('## 근거와 남은 확인')[1]);
});

test('blank selected edits are blocked while unselected edits stay out of the output', () => {
  const draft = content();
  draft.actions[0].text = ' \n ';
  assert.equal(validateReviewDraft(draft).length, 1);
  assert.throws(() => applyReviewDraft(report.markdown, draft), /수정안의 내용을 입력/);
  draft.actions[0].selected = false;
  assert.deepEqual(validateReviewDraft(draft), []);
  assert(applyReviewDraft(report.markdown, draft).includes('선택한 수정안 없음.'));
});

test('budget direction needs both substantive reason and reconsideration condition', () => {
  for (const direction of ['유지 검토', '감액 검토', '증액 검토']) {
    const draft = content();
    draft.budgets[0].direction = direction;
    for (const note of ['', '근거: \n재검토 조건: ', `근거: ${report.actionDrafts[0].change}`, `재검토 조건: ${report.actionDrafts[0].change}`]) {
      draft.note = note;
      assert.equal(validateReviewDraft(draft).length, 1);
    }
    draft.note = `근거: ${report.actionDrafts[0].evidenceIds[0]}\n재검토 조건: ${report.actionDrafts[0].change}`;
    assert.deepEqual(validateReviewDraft(draft), []);
  }
});

test('export preserves literal replacement tokens and fails closed on unknown templates', () => {
  const draft = content();
  draft.note = '$& $$ $` $\'';
  assert(applyReviewDraft(report.markdown, draft).includes(draft.note));
  assert.throws(() => applyReviewDraft('', draft), /수정안 구간/);
  assert.equal(renderRoasReview(report), report.markdown);
});

test('strict action review requires problem, reason and condition while old drafts stay compatible', () => {
  const draft = content();
  const original = draft.actions[0].text;
  const fields = ['대상 문제', '선택 이유', '적용 조건'];
  const values = [report.actionDrafts[0].target, report.actionDrafts[0].evidenceIds.join(', '), original];
  assert.deepEqual(validateReviewDraft(draft), []);
  assert.deepEqual(validateSelectedAction(original), fields);
  assert.equal(validateReviewDraft(draft, {strictActions: true}).length, 1);
  for (const empty of fields) {
    draft.actions[0].text = original + '\n' + fields.map((field, index) => `${field}: ${field === empty ? ' ' : values[index]}`).join('\n');
    assert.deepEqual(validateSelectedAction(draft.actions[0].text), [empty]);
    assert.equal(validateReviewDraft(draft, {strictActions: true}).length, 1);
  }
  draft.actions[0].text = original + '\r\n' + fields.map((field, index) => ` ${field}： ${values[index]}`).join('\r\n');
  assert.deepEqual(validateReviewDraft(draft, {strictActions: true}), []);
  assert(applyReviewDraft(report.markdown, draft).includes(draft.actions[0].text));
  draft.actions[0].text = original;
  draft.actions[0].selected = false;
  assert.deepEqual(validateReviewDraft(draft, {strictActions: true}), []);
});

test('investigation conditions cannot substitute for budget conditions and notes remain unchanged', () => {
  const draft = content();
  draft.budgets[0].direction = '유지 검토';
  const reason = `근거: ${report.actionDrafts[0].evidenceIds.join(', ')}`;
  const condition = `재검토 조건: ${report.actionDrafts[0].change}`;
  for (const newline of ['\n', '\r\n']) {
    const investigation = ['[조사 범위와 판단]', reason, condition, '[/조사 범위와 판단]'].join(newline);
    for (const userNote of ['', reason, condition, reason + newline + '재검토 조건: ']) {
      draft.note = userNote + newline + investigation;
      assert.equal(validateReviewDraft(draft).length, 1);
      assert.throws(() => applyReviewDraft(report.markdown, draft), /예산 방향/);
    }
    for (const note of [reason + newline + condition + newline + investigation, investigation + newline + reason + newline + condition]) {
      draft.note = note;
      assert.deepEqual(validateReviewDraft(draft), []);
      assert(applyReviewDraft(report.markdown, draft).includes(note));
      assert.equal(draft.note, note);
    }
  }
});

test('recovered investigation and archived judgments cannot lend budget fields', () => {
  const draft = content();
  draft.budgets[0].direction = '유지 검토';
  const reason = `근거: ${report.actionDrafts[0].evidenceIds.join(', ')}`;
  const condition = `재검토 조건: ${report.actionDrafts[0].change}`;
  const literal = '$& $$ $` $\'';
  for (const newline of ['\n', '\r\n']) {
    for (const [start, end] of [
      ['\\[조사 범위와 판단]', '\\[/조사 범위와 판단]'],
      ['[이전 조사 판단]', '[/이전 조사 판단]'],
    ]) {
      const preserved = [start, reason, condition, literal, end].join(newline);
      for (const free of [reason, condition, reason + newline + '재검토 조건: ']) {
        draft.note = free + newline + preserved;
        assert.equal(validateReviewDraft(draft).length, 1);
        assert.throws(() => applyReviewDraft(report.markdown, draft), /예산 방향/);
      }
      for (const note of [reason + newline + condition + newline + preserved, preserved + newline + reason + newline + condition]) {
        draft.note = note;
        assert.deepEqual(validateReviewDraft(draft), []);
        assert(applyReviewDraft(report.markdown, draft).includes(note));
        assert.equal(draft.note, note);
      }
      draft.note = reason + newline + start + newline + condition;
      assert.equal(validateReviewDraft(draft).length, 1);
      draft.note = reason + newline + condition + newline + end;
      assert.equal(validateReviewDraft(draft).length, 1);
    }
  }
});

const investigation = () => ({channel: 'social', device: 'desktop', stage: 'checkout', hypothesis: 'payment', rationale: '', condition: ''});

test('investigation export carries the selected PC funnel and only its source records', () => {
  const selected = investigation();
  const markdown = renderInvestigationSummary(report, selected);
  assert(markdown.includes('소셜 / PC / 결제 시작 이후 구매'));
  assert(markdown.includes('| PC 구매, 세션 | 18 | 4 |'));
  assert(markdown.includes('| PC 결제 완료율 | 64.29% | 14.29% |'));
  assert(!markdown.includes('| 모바일'));
  const ids = markdown.split('수치 근거 ID: ')[1].split('\n')[0].split(', ');
  const allowed = new Set(deviceEvidence(report.records, report, selected.channel, selected.device).map(row => row.record_id));
  assert(ids.length > 0);
  assert(ids.every(id => allowed.has(id)));
  assert(!markdown.includes('R001-Campaign-search'));
  assert(markdown.includes('단일 가상 시나리오'));
});

test('cost, revenue and refund export use the selected scope and existing diagnosis', () => {
  const selected = {...investigation(), channel: 'search', device: 'all'};
  const diagnosis = stageDiagnosis(report.records, report, selected.channel, selected.device);
  for (const stage of ['cost', 'revenue', 'refund']) {
    const markdown = renderInvestigationSummary(report, {...selected, stage});
    const ids = markdown.split('수치 근거 ID: ')[1].split('\n')[0].split(', ');
    assert.deepEqual(ids, [...new Set([...diagnosis.before.evidenceIds[stage], ...diagnosis.after.evidenceIds[stage]])]);
    if (stage === 'cost') assert(markdown.includes('| CTR | 4.00% | 4.00% |'));
    if (stage === 'revenue') assert(markdown.includes('| 평균 상품 단가, 원 | 20,000 | 20,000 |'));
    if (stage === 'refund') assert(markdown.includes('| 차감액 / 차감 전 상품금액 | 9.53% | 14.19% |'));
  }
});

test('unconfirmed additional-check export needs no shipping action and preserves literal notes', () => {
  const draft = content();
  draft.actions.forEach(action => {action.selected = false;});
  draft.note = '$& $$ $` $\'';
  const selected = {...investigation(), hypothesis: 'none', rationale: draft.note, condition: draft.note};
  const summary = renderInvestigationSummary(report, selected);
  const body = applyReviewDraft(report.markdown, draft);
  const markdown = summary + '\n' + body;
  assert(markdown.includes('설명 후보: 원인 미확인'));
  assert(markdown.includes('선택한 수정안 없음.'));
  assert(summary.includes('판단 근거: ' + draft.note));
  assert(summary.includes('다음 확인과 적용 조건: ' + draft.note));
  assert(markdown.endsWith(body));
  assert(body.includes(draft.note));
  assert.equal(draft.note, '$& $$ $` $\'');
});
