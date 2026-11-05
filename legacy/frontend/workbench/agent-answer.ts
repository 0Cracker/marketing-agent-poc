import type {AgentRun} from './agent-client';

const names:Record<string,string>={price:'가격',stock:'재고',media:'광고',measurement:'계측'};
const nextSteps:Record<string,string>={investigate:'같은 제품·기간의 관련 자료를 추가로 확인하세요.',retain:'현행을 유지하고 새 근거가 생기면 다시 검토하세요.',maintain:'현행을 유지하고 새 근거가 생기면 다시 검토하세요.',repair_measurement:'계측 상태를 복구한 뒤 같은 기준으로 다시 비교하세요.',limited_experiment:'목표·기간·중단 조건을 정한 제한 실험을 검토하세요.',budget_review:'가정·제약을 확인하려면 예산 검토로 넘기세요.'};

// Presentation of validated output only. Missing or conflicting evidence never
// becomes a causal claim, a recommendation to spend, or an inferred success.
export function analysisAnswer(run:Pick<AgentRun,'status'|'supersededBy'|'output'>){
  if(run.supersededBy)return {conclusion:'후속 분석으로 대체된 결과입니다.',next:'최신 분석을 확인한 뒤 예산을 검토하세요.'};
  if(run.status!=='analyzed')return {
    conclusion:({needs_scope:'분석할 범위를 먼저 확인해 주세요.',held:'현재 자료로는 판단을 보류합니다.',paused:'분석이 중단돼 아직 결론이 없습니다.',running:'자료를 조회하고 검증하는 중입니다.',cancelled:'분석이 취소돼 결론을 제시하지 않습니다.'} as Record<string,string>)[run.status]||'분석 상태를 확인해 주세요.',
    next:run.status==='needs_scope'?'국가·제품·기간·자료 기준시각을 지정하세요.':'보류 사유와 저장된 실행 상태를 확인하세요.'};
  const hypotheses=run.output?.hypotheses||[];
  const mixed=hypotheses.find(h=>h.assessment==='mixed');
  const conclusion=mixed?`${names[mixed.candidate]||'원인 후보'} 근거가 엇갈려 영향을 확정할 수 없습니다.`
    :hypotheses.some(h=>h.assessment==='support_only')?'원인 후보를 지지하는 근거가 있지만, 인과는 확인되지 않았습니다.'
    :hypotheses.some(h=>h.assessment==='counter_only')?'검토한 원인 후보에 반대되는 근거를 확인했습니다.'
    :'현재 근거로는 원인 후보를 판단하기 어렵습니다.';
  return {conclusion,next:nextSteps[run.output?.recommendation||'']||'근거와 한계를 확인한 뒤 다음 조치를 정하세요.'};
}

export function budgetConclusion(run:Pick<AgentRun,'status'|'simulation'>){
  if(run.status==='invalidated')return '기존 제안은 무효입니다. 최신 분석으로 다시 검토하세요.';
  if(run.status==='approved')return '가상 변경안이 승인됐습니다. 실제 광고 집행은 연결되지 않았습니다.';
  if(run.status==='rejected')return '제안을 거절했습니다. 이 제안의 승인은 사용할 수 없습니다.';
  if(run.status==='retained')return '이번 검토 결과는 현행 유지·추가 조사입니다.';
  if(run.status!=='pending_approval')return '아직 승인할 수 있는 제안이 없습니다.';
  if(!run.simulation)return '비교 결과가 없어 제안을 판단할 수 없습니다.';
  const baseline=Number(run.simulation.baseline.expected),candidate=Number(run.simulation.candidate.expected);
  if(!Number.isFinite(baseline)||!Number.isFinite(candidate))return '비교 수치를 확인할 수 없어 판단을 보류합니다.';
  return candidate>baseline?'현재 가정에서 후보안의 모의 전환수가 더 높습니다.':candidate<baseline?'현재 가정에서 후보안의 모의 전환수가 더 낮습니다.':'현재 가정에서 두 안의 모의 전환수가 같습니다.';
}
