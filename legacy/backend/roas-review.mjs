import {applyReviewDraft} from '../shared/roas-review.mjs';

const percent = value => value === null ? '미확인' : (value * 100).toFixed(1) + '%';
const number = value => value === null ? '미확인' : Number(value).toLocaleString('ko-KR', {maximumFractionDigits: 2});
const escape = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');

export function renderRoasReview(report, review) {
  const [before, after] = report.periods;
  const delayed = report.purchaseTiming === 'within_window';
  const rows = after.channels.map(channel => {
    const prior = before.channels.find(item => item.campaignId === channel.campaignId);
    return `| ${channel.channel} | ${percent(prior.reported.roas)} → ${percent(channel.reported.roas)} | ${percent(prior.purchaseCohort.netRoas)} → ${percent(channel.purchaseCohort.netRoas)} | ${number(prior.reported.cpc)} → ${number(channel.reported.cpc)} | ${percent(prior.reported.clickPurchaseRate)} → ${percent(channel.reported.clickPurchaseRate)} | ${number(prior.reported.revenuePerPurchase)} → ${number(channel.reported.revenuePerPurchase)} |`;
  });
  const candidates = report.evidence.filter(item => /배송|결제|추가 비용/.test(item.text));
  const counters = report.evidence.filter(item => /만족|도움/.test(item.text));
  const bridge = report.roasBridge.net || report.roasBridge.reported;
  const markdown = `# ${report.productId} ROAS 하락 검토서

가상 업무 검증용 시나리오: ${report.scenarioId}. 실제 마케팅 효과와 원인 입증 자료가 아니다.
기준일: ${report.asOf}. 비교: ${before.period.start}부터 ${before.period.end} 직전까지, ${after.period.start}부터 ${after.period.end} 직전까지.

## 1. 현황

할인 후 상품 구매금액에서 기준일까지 확정된 취소, 환불을 한 번만 차감하고 세금과 배송비를 제외했다.
환불은 원주문의 유입 코호트에 반영했다. 매체 보고 ROAS는 환불 차감 전 보고값으로 분리했다.

| 지표 | 비교 전 | 비교 후 |
| --- | ---: | ---: |
| 광고비, KRW | ${number(before.total.spend)} | ${number(after.total.spend)} |
| 매체 보고 구매 매출, KRW | ${number(before.total.reportedRevenue)} | ${number(after.total.reportedRevenue)} |
| 확정 취소와 환불 반영 상품 매출, KRW | ${number(before.total.netProductRevenue)} | ${number(after.total.netProductRevenue)} |
| 매체 보고 ROAS | ${percent(before.total.reportedRoas)} | ${percent(after.total.reportedRoas)} |
| 환불 반영 상품 매출 ROAS | ${percent(before.total.netRoas)} | ${percent(after.total.netRoas)} |

## 2. 수치 분해와 구매 흐름

| 매체 | 매체 보고 ROAS | 환불 반영 ROAS | CPC, KRW | 클릭 기준 구매 전환율 | 구매당 귀속매출, KRW |
| --- | --- | --- | --- | --- | --- |
${rows.join('\n')}

보고 ROAS의 산술 관계는 클릭 기준 구매 전환율 × 구매당 귀속매출 ÷ CPC다. 구매 전환 감소, 비용 상승과 구매당 매출 변화는 확인된 수치 변화이며 원인 확정이 아니다.

| 기간, 매체 | 유료 방문 세션 | 상품 조회 세션 | 장바구니 세션 | 결제 시작 세션 | ${delayed ? '최초 유료 세션 내 구매' : '구매 세션'} | 후속 직접 재방문 구매 | ${delayed ? '유료 유입 코호트 주문전환율' : '세션 기준 구매 전환율'} |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${report.periods.flatMap((period, i) => period.channels.map(channel => `| ${i ? '비교 후' : '비교 전'}, ${channel.channel} | ${channel.purchaseCohort.paidSessions} | ${channel.purchaseCohort.funnel.view_item} | ${channel.purchaseCohort.funnel.add_to_cart} | ${channel.purchaseCohort.funnel.begin_checkout} | ${channel.purchaseCohort.funnel.purchase ?? '미확인'} | ${channel.purchaseCohort.returnPurchases ?? '미확인'} | ${percent(channel.purchaseCohort.sessionPurchaseRate)} |`)).join('\n')}

${delayed ? '구매 단계 표는 최초 유료 방문 세션 안에서 발생한 단계만 센다. 7일 이내 후속 직접 재방문 세션의 구매는 별도 열이며 최초 세션의 결제 완료율에 합치지 않는다. 주문과 매출은 마지막 유료 접점 날짜의 코호트에 귀속하고, 후속 방문은 동일 고객과 직접 연결을 검증했다. 최초 방문 기기가 기기별 귀속 기준이며 실제 구매 기기와 구분한다.' : '구매 단계는 같은 세션의 시간순서를 확인했다. 이 시나리오는 유료 방문 표본과 당일 구매만 포함하며 전체 사이트의 전환율을 뜻하지 않는다.'} 제품 구성은 ${report.productId}로 고정했고 신규 고객과 기존 고객의 구성 변화는 미측정이다.

${bridge ? `전체 ${report.roasBridge.net ? '환불 반영' : '매체 보고'} ROAS 변화는 기존 광고비 비중으로 계산한 매체 내 변화 ${(bridge.withinChannelChange * 100).toFixed(1)}%p와 매체 광고비 비중 변화 ${(bridge.spendMixChange * 100).toFixed(1)}%p로 나눌 수 있다. 이는 산술 분해이며 원인의 인과 기여가 아니다.` : '매체 내 변화와 광고비 구성 변화를 분해할 수 있는 수치가 부족하다.'}

## 3. 제품 공통 의견, 확인할 설명 후보의 참고 자료

이 구간은 선택한 설명 후보의 결론이 아니라 제품 공통 참고 자료다. ${report.scenarioId === 'R001-roas-decline' ? 'R001은 결제 시작 이후 구매 감소를 주입한 단일 가상 시나리오이며, 다른 문제 유형의 원인 식별을 검증하지 않았다.' : '이 사례는 승인된 독립 가상 시나리오이며, 관측 수치의 차이는 실제 원인의 확정이나 일반적인 식별 성능을 입증하지 않는다.'} 실제 마케터의 과업 성공은 미검증이다.

매체 내 ROAS 하락폭 기준 확인 우선순위: ${report.reviewPriority.map(item => item.channel).join(' → ')}. 이 순서는 예산 감액 순위가 아니다. 아래 리뷰와 문의는 P1A 공통 근거이며 특정 매체 유입 고객의 의견으로 확인된 것은 아니다.

${candidates.slice(0, 4).map(item => `- ${item.recordId}: “${escape(item.text)}”`).join('\n') || '- 관련 원문 근거 없음.'}

다른 측면의 의견, 배송과 결제 안내 문제의 직접 반증은 아님:

${counters.slice(-2).map(item => `- ${item.recordId}: “${escape(item.text)}”`).join('\n') || '- 반대 근거 미확인, 추가 확인 필요.'}

${candidates.length ? '배송과 결제 안내를 확인할 근거는 있으나 이 원문이 전환 하락을 일으켰다고 단정할 수 없다. 실제 상품 페이지 내용, 결제 화면과 운영 정책을 대조한 뒤 수정안을 확정한다.' : '배송과 결제 안내에 관한 연결 의견이 없다. 이 자료만으로 안내 문제나 수정 필요성을 주장하지 않는다.'}

## 4. Action 검토안

${report.actionDrafts.map((item, i) => `${i + 1}. **${item.target}**: ${item.change}. 근거: ${item.evidenceIds.slice(0, 3).join(', ')}.`).join('\n') || '연결 근거 보완을 먼저 수행한다.'}

${report.actionDrafts.length ? '수정 문구 초안: “출고 예정일, 배송 소요 조건, 최종 배송비와 할인 적용 조건을 결제 전에 확인하세요.” 실제 조건 확인 후 담당자가 적용 위치와 문구를 확정한다.' : '안내 수정 후보 없음. 선택한 문제의 원인을 구분할 자료와 다음 확인을 먼저 검토한다.'}

${report.budgetReview.map(item => `- ${item.channel}: 증액, 감액, 유지의 판단을 보류한다. 목표 ROAS, 예산 한도와 운영 제약을 확인한 뒤 검토하며 변경 금액과 비율은 임의로 정하지 않는다.`).join('\n')}

## 근거와 남은 확인

수치의 원천 레코드는 scenario-analysis-final.json의 periods[].channels[].evidence, 원문은 evidence에서 확인할 수 있다.
현재 계산 상태: ${report.status}. 자료 공백: ${report.gaps.join(', ') || '선언한 표본 내 계산과 연결 공백 없음'}.
가상 규칙으로 만든 사례이며 실제 담당자의 검토 시간, 누락, 재수정 부담 감소와 매출 개선은 미검증이다.
`;
  return review ? applyReviewDraft(markdown, review) : markdown;
}
