const directions = ['판단 보류', '유지 검토', '감액 검토', '증액 검토'];
const channelNames = {search: '검색', social: '소셜'};
const actionSection = /## 4\. (?:Action 검토안|담당자 검토 초안)\r?\n[\s\S]*?(?=\r?\n## 근거와 남은 확인)/;
const actionFields = ['대상 문제', '선택 이유', '적용 조건'];

// This is a validation view only: exported notes retain every original character.
// A damaged, unclosed preserved section fails closed instead of lending old conditions.
function budgetNote(note) {
  const sections = [];
  let orphanEnd = false;
  const free = note.split(/\r?\n/).filter(line => {
    const marker = line.match(/^\\?\[(\/)?(조사 범위와 판단|이전 조사 판단)\]$/);
    if (marker) {
      if (!marker[1]) sections.push(marker[2]);
      else {
        const index = sections.lastIndexOf(marker[2]);
        if (index >= 0) sections.splice(index, 1);
        else orphanEnd = true;
      }
      return false;
    }
    return sections.length === 0;
  }).join('\n').trim();
  return orphanEnd ? '' : free;
}

/** Check the new screen's decision fields without rewriting saved free text. */
export function validateSelectedAction(text) {
  return actionFields.filter(field => {
    const section = new RegExp(`(?:^|\\n)[ \\t]*${field}[ \\t]*[:：]([\\s\\S]*?)(?=\\r?\\n[ \\t]*(?:${actionFields.join('|')})[ \\t]*[:：]|$)`);
    return !text.match(section)?.[1].trim();
  });
}

/** Keep incomplete work editable, but never silently fill deleted text on export. */
export function validateReviewDraft(content, {strictActions = false} = {}) {
  const errors = content.actions.filter(action => action.selected && !action.text.trim())
    .map(action => `${action.target}: 선택한 수정안의 내용을 입력해 주세요.`);
  if (strictActions) {
    for (const action of content.actions.filter(action => action.selected && action.text.trim())) {
      const missing = validateSelectedAction(action.text);
      if (missing.length) errors.push(`${action.target}: ${missing.join(', ')} 내용을 입력해 주세요.`);
    }
  }
  if (content.budgets.some(budget => !directions.includes(budget.direction))) errors.push('예산 검토 방향을 확인해 주세요.');
  if (content.budgets.some(budget => budget.direction !== '판단 보류')) {
    // Investigation conditions describe a different decision and cannot justify a budget change.
    const note = budgetNote(content.note);
    const reason = note.match(/(?:^|\n)근거\s*[:：]([^]*?)(?=\n재검토 조건\s*[:：]|$)/)?.[1].trim();
    const condition = note.match(/(?:^|\n)재검토 조건\s*[:：]([^]*?)(?=\n근거\s*[:：]|$)/)?.[1].trim();
    if (!reason || !condition) errors.push('예산 방향을 검토하려면 메모에 근거: 내용과 재검토 조건: 내용을 각각 작성해 주세요.');
  }
  return errors;
}

export function applyReviewDraft(markdown, content) {
  const errors = validateReviewDraft(content);
  if (errors.length) throw Error(errors.join('\n'));
  if (!actionSection.test(markdown)) throw Error('검토서의 수정안 구간을 확인하지 못했습니다. 자료를 다시 불러와 주세요.');
  const selected = content.actions.filter(action => action.selected);
  const actions = selected.map((action, index) => `${index + 1}. **${action.target}**: ${action.text}\n   근거: ${action.evidenceIds.join(', ') || '미연결'}.`).join('\n\n');
  const budgets = content.budgets.map(budget => `- ${channelNames[budget.channel] || budget.channel}: ${budget.direction}`).join('\n');
  const section = `## 4. 담당자 검토 초안

선택한 수정안:

${actions || '선택한 수정안 없음.'}

예산 검토 방향:

${budgets || '검토 대상 매체 없음.'}

추가 확인과 판단 근거:

${content.note || '미작성'}

검토 초안이며 승인 또는 광고 집행 결과가 아닙니다. 실제 페이지와 운영 조건을 확인한 뒤 수정안을 확정합니다.
`;
  // A replacement callback preserves literal dollar signs in the user's draft.
  return markdown.replace(actionSection, () => section);
}
