export const trainingCaseIds = Array.from({length: 18}, (_, index) => `S${String(index + 1).padStart(2, '0')}`);
export const trainingViews = [['overview', '성과 현황']];
export const trainingCostDefinition = '유료 마케팅 집행비는 매체 광고비와 콘텐츠 제휴 수수료의 합계입니다. 콘텐츠는 추적 링크 클릭에 따라 정산하며 클릭 발생일에 비용을 집계합니다. 고정 협업비, 제작비와 제품 제공 원가는 포함하지 않습니다. 고정비 협찬의 비용 구조와 구분해야 합니다.';
const campaignNames = {'EDU-C1':'8월 구매 캠페인 | 검색 A','EDU-C2':'8월 구매 캠페인 | 검색 B','EDU-C3':'8월 구매 캠페인 | Facebook 피드','EDU-C4':'8월 구매 캠페인 | Instagram 피드','EDU-C5':'8월 콘텐츠 제휴 | 네이버 블로그','EDU-C6':'8월 콘텐츠 제휴 | Instagram'};
const campaignCodes = {'EDU-C1':'GGL-SA-202608-001','EDU-C2':'GGL-SA-202608-002','EDU-C3':'META-FB-202608-001','EDU-C4':'META-IG-202608-001','EDU-C5':'NAVER-BLOG-202608-001','EDU-C6':'IG-COLLAB-202608-001'};
export function campaignDisplayName(data, id) {return campaignNames[id] || data.campaigns.find(c => c.id === id)?.label || id;}
export function displayTrainingText(value) {
  let text = String(value).replace(/EDU-C[1-6]\b/g, id => campaignCodes[id]).replace(/\bcore\b/g, '기존 타깃').replace(/\bextended\b/g, '확장 타깃').replaceAll('핵심 집단', '기존 타깃').replaceAll('확장 집단', '확장 타깃');
  ['구글 검색 A','구글 검색 B','페이스북 피드','인스타그램 피드','네이버 블로그 제휴','인스타그램 제휴'].forEach((label,index) => {text = text.replaceAll(label,campaignNames['EDU-C'+(index+1)]);});
  return text;
}
export function trainingMediaOptions(data) {
  const options = [{key:'all',channel:'all',source:'all'}];
  for (const channel of [...new Set(data.campaigns.map(c => c.channel))]) {
    const sources = [...new Set(data.campaigns.filter(c => c.channel === channel).map(c => c.source))];
    if (sources.length > 1) options.push({key:channel+'|all',channel,source:'all'});
    for (const source of sources) options.push({key:channel+'|'+source,channel,source});
  }
  return options;
}
export function changeTrainingMedia(data, filters, key) {
  const option = trainingMediaOptions(data).find(item => item.key === key);
  if (!option) throw new Error('Unknown media option');
  const next = {...filters,channel:option.channel,source:option.source};
  if (!data.campaigns.some(c => c.id === next.campaignId && (next.channel === 'all' || c.channel === next.channel) && (next.source === 'all' || c.source === next.source))) next.campaignId = 'all';
  return next;
}
export const trainingMeasures = ['impressions', 'clicks', 'spend', 'sessions', 'view', 'cart', 'checkout', 'purchases', 'returnPurchases', 'orders', 'units', 'listRevenue', 'discount', 'revenue', 'ledgerOrders', 'ledgerRevenue', 'paymentAttempts', 'paymentFailures', 'redirectErrors', 'loadTotalMs', 'loadSamples', 'trackingExpected', 'trackingReceived', 'duplicateEvents'];
const divide = (a, b) => b ? a / b : null;

export function summarize(rows) {
  const sums = Object.fromEntries(trainingMeasures.map(key => [key, rows.reduce((total, row) => total + (row[key] || 0), 0)]));
  const adRows = rows.filter(row => row.exposureBasis === 'ad_impression');
  const contentRows = rows.filter(row => row.exposureBasis === 'content_view');
  const sum = (items, key) => items.reduce((total, row) => total + (row[key] || 0), 0);
  const rates = {roas: divide(sums.revenue, sums.spend), ctr: divide(sums.clicks, sums.impressions), cpm: divide(sums.spend * 1000, sums.impressions), cpc: divide(sums.spend, sums.clicks), cvr: divide(sums.orders, sums.clicks), cpa: divide(sums.spend, sums.orders), aov: divide(sums.revenue, sums.orders), sessionCvr: divide(sums.purchases, sums.sessions), checkoutRate: divide(sums.purchases, sums.checkout), paymentFailureRate: divide(sums.paymentFailures, sums.paymentAttempts), loadMs: divide(sums.loadTotalMs, sums.loadSamples), adCtr: divide(sum(adRows, 'clicks'), sum(adRows, 'impressions')), contentClickRate: divide(sum(contentRows, 'clicks'), sum(contentRows, 'impressions')), adCpm: divide(sum(adRows, 'spend') * 1000, sum(adRows, 'impressions')), contentCpm: divide(sum(contentRows, 'spend') * 1000, sum(contentRows, 'impressions'))};
  return {...sums, ...rates, rates};
}

function matches(data, row, filters) {
  const campaign = data.campaigns.find(item => item.id === row.campaignId);
  return (!filters.channel || filters.channel === 'all' || campaign?.channel === filters.channel) &&
    (!filters.source || filters.source === 'all' || campaign?.source === filters.source) &&
    (!filters.campaignId || filters.campaignId === 'all' || row.campaignId === filters.campaignId) &&
    (!filters.device || filters.device === 'all' || row.device === filters.device);
}
export function selectFacts(data, filters = {}) { return data.facts.filter(row => matches(data, row, filters)); }
export function selectBreakdowns(data, filters = {}, dimension) { return data.breakdowns.filter(row => (!dimension || row.dimension === dimension) && matches(data, row, filters)); }
export function selectRecords(data, filters = {}) {
  const campaignIds = new Set(data.campaigns.filter(campaign => (!filters.channel || filters.channel === 'all' || campaign.channel === filters.channel) && (!filters.source || filters.source === 'all' || campaign.source === filters.source) && (!filters.campaignId || filters.campaignId === 'all' || campaign.id === filters.campaignId)).map(campaign => campaign.id));
  return data.records.filter(row => (!row.campaignId || campaignIds.has(row.campaignId)) && (!filters.device || filters.device === 'all' || row.device === 'all' || row.device === filters.device));
}
export function comparePeriods(data, filters = {}) {
  const rows = selectFacts(data, filters);
  return data.periods.map(period => { const chosen = rows.filter(row => row.periodId === period.id); return {period, total: summarize(chosen), rows: chosen}; });
}
export function trendRows(data, filters = {}) {
  const rows = selectFacts(data, filters);
  return [...new Set(rows.map(row => row.date))].sort().map(date => ({date, ...summarize(rows.filter(row => row.date === date))}));
}

export function metricValue(total, key) {
  if (key === 'cac') return null; // New-customer counts are not part of the current measured contract.
  return key in total.rates ? total.rates[key] : total[key] ?? null;
}

export function metricChange(before, after, rate = false) {
  if (before == null || after == null) return null;
  return rate ? after - before : before === 0 ? (after === 0 ? 0 : null) : after / before - 1;
}

export function metricMissingReason(rows, key) {
  if (!rows.length) return {label: '데이터 없음', reason: '선택한 기간과 필터에 해당하는 데이터가 없습니다.'};
  if (key === 'cac') return {label: '미집계', reason: '신규 고객 수가 제공되지 않아 고객 획득 비용을 계산할 수 없습니다.'};
  const ad = ['adCtr', 'adCpm'].includes(key), content = ['contentClickRate', 'contentCpm'].includes(key);
  if (ad && !rows.some(row => row.exposureBasis === 'ad_impression')) return {label: '해당 없음', reason: '광고 노출 기준 지표입니다. 콘텐츠 조회에는 적용되지 않습니다.'};
  if (content && !rows.some(row => row.exposureBasis === 'content_view')) return {label: '해당 없음', reason: '콘텐츠 조회 기준 지표입니다. 검색광고와 피드광고에는 적용되지 않습니다.'};
  const denominators = {roas: '유료 마케팅 집행비', cpc: '클릭 수', cvr: '클릭 수', cpa: '구매 주문 수', aov: '구매 주문 수', ctr: '노출 수', cpm: '노출 수', adCtr: '광고 노출 수', adCpm: '광고 노출 수', contentClickRate: '콘텐츠 조회 수', contentCpm: '콘텐츠 조회 수', sessionCvr: '랜딩 세션 수', checkoutRate: '결제 시작 수', paymentFailureRate: '결제 시도 수', loadMs: '페이지 로드 측정 수', unitPrice: '판매 수량', discountRate: '할인 전 금액', viewRate: '랜딩 세션 수', cartRate: '상품 조회 수', beginRate: '장바구니 수', spendShare: '전체 유료 마케팅 집행비'};
  if (denominators[key]) return {label: '계산 불가', reason: `${denominators[key]}가 0이어서 비율이나 평균을 계산할 수 없습니다.`};
  return {label: '미집계', reason: '계산에 필요한 데이터가 제공되지 않았습니다.'};
}

// Pair the same weekday in adjacent 14-day windows, retaining actual dates for tooltips.
export function metricPeriodSeries(data, filters, key) {
  const facts = selectFacts(data, filters);
  const periods = ['baseline', 'current'].map(id => data.periods.find(p => p.id === id));
  const length = Math.max(...periods.map(p => Math.round((Date.parse(p.end) - Date.parse(p.start)) / 86400000)));
  return Array.from({length}, (_, index) => {
    const item = {day: index + 1};
    periods.forEach(period => {
      const date = new Date(Date.parse(period.start + 'T00:00:00Z') + index * 86400000).toISOString().slice(0, 10);
      const selected = facts.filter(r => r.periodId === period.id && r.date === date);
      item[period.id + 'Date'] = date;
      item[period.id] = selected.length ? metricValue(summarize(selected), key) : null;
    });
    return item;
  });
}
