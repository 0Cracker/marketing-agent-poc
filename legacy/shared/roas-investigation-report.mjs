import {deviceFunnels, deviceEvidence, stageDiagnosis} from './roas-diagnosis.mjs';

const channels = {all: '전체 매체', search: '검색', social: '소셜'};
const devices = {all: '양 기기', mobile: '모바일', desktop: 'PC'};
const stages = {all: '문제 단계 미선택', cost: '클릭 비용', checkout: '결제 시작 이후 구매', revenue: '구매당 금액', refund: '취소와 환불'};
const hypotheses = {none: '원인 미확인', guidance: '배송과 금액 안내', payment: '결제 기능', audience: '유입 고객 구성', tracking: '측정과 집계'};
const checks = {
  cost: '입찰, 게재위치, 소재와 운영 변경 이력을 확인해 노출단가와 클릭 반응 변화의 설명을 구분합니다.',
  checkout: '선택 기기에서 실제 결제를 재현하고 실패 내역, 실제 안내 내용과 구매 이벤트를 대조합니다.',
  revenue: '상품 단가, 주문 수량, 할인 구성과 실제 할인 정책 변경을 대조합니다.',
  refund: '같은 원주문 코호트의 확정 처리, 환불 사유와 처리 지연을 확인합니다.',
  all: '조사할 문제와 확인할 자료를 먼저 선택합니다.',
};
const number = value => value === null || value === undefined ? '미확인' : Number(value).toLocaleString('ko-KR', {maximumFractionDigits: 2});
const percent = value => value === null || value === undefined ? '미확인' : `${(value * 100).toFixed(2)}%`;
const cell = value => String(value).replaceAll('|', '\\|').replaceAll('\r', ' ').replaceAll('\n', ' ');

/** Derived export only: keep the original review text and schema-1 notes untouched. */
export function renderInvestigationSummary(report, investigation) {
  const {channel, device, stage, hypothesis, rationale, condition} = investigation;
  const delayed = report.purchaseTiming === 'within_window';
  const diagnosis = stageDiagnosis(report.records, report, channel, device);
  const rows = [];
  let ids = [];
  if (stage === 'checkout') {
    for (const row of deviceFunnels(report.records, report, channel).filter(row => device === 'all' || row.device === device)) {
      for (const [label, key] of [['유료 방문', 'paidSessions'], ['결제 시작', 'begin_checkout'], [delayed ? '최초 유료 세션 내 구매' : '구매', 'purchase']]) {
        rows.push([`${devices[row.device]} ${label}, 세션`, number(row.before[key]), number(row.after[key])]);
      }
      if (delayed) rows.push([`${devices[row.device]} 후속 직접 재방문 구매, 주문`, number(row.before.returnPurchases), number(row.after.returnPurchases)]);
      const completion = period => period.begin_checkout ? period.purchase / period.begin_checkout : null;
      rows.push([`${devices[row.device]} 결제 완료율`, percent(completion(row.before)), percent(completion(row.after))]);
      ids.push(...deviceEvidence(report.records, report, channel, row.device)
        .filter(row => ['T17', 'T19'].includes(row.dataset_type) || row.dataset_type === 'T18' && ['begin_checkout', 'purchase'].includes(row.event_name))
        .map(row => row.record_id));
    }
  } else if (['cost', 'revenue', 'refund'].includes(stage)) {
    const fields = {
      cost: [['노출', 'impressions'], ['클릭', 'clicks'], ['광고비, 원', 'spend'], ['CTR', 'ctr', true], ['CPM, 원', 'cpm'], ['CPC, 원', 'cpc']],
      revenue: [['주문', 'orders'], ['상품 수량', 'units'], ['평균 상품 단가, 원', 'unitPrice'], ['주문당 할인, 원', 'discountPerOrder'], ['주문당 할인 후 상품금액, 원', 'revenuePerOrder']],
      refund: [['차감 전 할인 후 상품금액, 원', 'revenueBeforeAdjustments'], ['확정 차감액, 원', 'adjustments'], ['차감액 / 차감 전 상품금액', 'adjustmentRate', true]],
    }[stage];
    for (const [label, key, rate] of fields) rows.push([label, (rate ? percent : number)(diagnosis.before[stage][key]), (rate ? percent : number)(diagnosis.after[stage][key])]);
    ids = [...diagnosis.before.evidenceIds[stage], ...diagnosis.after.evidenceIds[stage]];
  }
  const missing = [...new Set([...diagnosis.before.unavailable, ...diagnosis.after.unavailable])];
  return `## 선택한 조사와 다음 확인

조사 범위: ${channels[channel]} / ${devices[device]} / ${stages[stage]}
비교 전: ${report.periods[0].period.start} 이상, ${report.periods[0].period.end} 미만. 비교 후: ${report.periods[1].period.start} 이상, ${report.periods[1].period.end} 미만.
환불 확인 기준일: ${report.asOf}.

| 선택 범위의 지표 | 비교 전 | 비교 후 |
| --- | ---: | ---: |
${rows.map(row => `| ${row.map(cell).join(' | ')} |`).join('\n') || '| 문제 단계 미선택 | 미확인 | 미확인 |'}

수치 근거 ID: ${[...new Set(ids)].join(', ') || '미연결, 추가 확인 필요'}

설명 후보: ${hypotheses[hypothesis]}. 선택은 원인 확정이나 효과 입증이 아닙니다.
판단 근거: ${rationale || '미작성, 검토 미완성'}
다음 확인과 적용 조건: ${condition || '미작성, 추가 확인 계획 필요'}
자료에서 아직 구분하지 못한 사항: ${checks[stage]}
${missing.length ? `선택 범위의 자료 공백: ${missing.join(', ')}\n` : ''}${diagnosis.limitations.map(item => `- ${item}`).join('\n')}

제품 공통 리뷰와 문의는 선택 매체, 기기의 이탈 이유로 귀속할 수 없습니다. ${report.scenarioId === 'R001-roas-decline' ? '이 R001은 결제 시작 이후 구매 감소를 주입한 단일 가상 시나리오입니다.' : '이 사례는 승인된 독립 가상 시나리오입니다.'} 비용, 구매금액과 환불 수치의 재계산은 각 원인의 식별 성능을 입증하지 않습니다. ${delayed ? '구매 흐름은 최초 유료 세션 내 단계이며 7일 이내 후속 직접 재방문 구매는 별도입니다. 매출은 마지막 유료 접점 날짜, 기기는 최초 유료 방문 기기 기준입니다.' : ''} 아래 제품 공통 참고 자료와 매체 전체 표는 선택 범위의 직접 근거와 구분합니다.
`;
}
