import {trainingMeasures} from '../shared/training-dashboard.mjs';

// These cases use the existing aggregate contract. Changes affect input counts,
// not independently invented rates; all views derive from the same daily cells.
export function buildMixedCase(caseId, template, commonRecords, allocate) {
  const pack = {...structuredClone(template), caseId, label: `사례 ${caseId.slice(1)}`, facts: [], breakdowns: [], reach: []};
  // Replace inherited budget settings instead of exposing two initial budgets on the same date.
  pack.recordIds = commonRecords.filter(r => !r.id.startsWith('CASE-') && !(r.category === 'campaign' && '일예산' in r.values)).map(r => r.id);
  const add = (date, category, campaignId, device, productId, title, values) => {
    const record = {id: `CASE-${caseId}-${pack.recordIds.filter(id => id.startsWith('CASE-')).length + 1}`, date, category, campaignId, device, productId, title, values};
    commonRecords.push(record); pack.recordIds.push(record.id);
  };
  for (const [c, campaign] of pack.campaigns.entries()) {
    campaign.dailyBudget = 240000;
    const initial = commonRecords.find(r => !r.id.startsWith('CASE-') && r.category === 'campaign' && r.campaignId === campaign.id);
    add('2026-08-03', 'campaign', campaign.id, 'all', null, `${campaign.label} 집행 설정`, {...initial.values, 일예산: 240000, 적용시각: '2026-08-03T00:00:00+09:00'});
    if (caseId === 'S16' && c < 4) {
      campaign.dailyBudget = 420000;
      add('2026-08-17', 'change', campaign.id, 'all', null, `${campaign.label} 타깃과 예산 설정`, {변경전: '일예산 240000, 기존 관심 집단', 변경후: '일예산 420000, 확장 집단 포함', 적용시각: '2026-08-17T00:00:00+09:00'});
    }
    if (caseId === 'S17' && c % 2) {
      campaign.dailyBudget = 80000;
      add('2026-08-17', 'change', campaign.id, 'all', null, `${campaign.label} 예산 설정`, {변경전: 240000, 변경후: 80000, 항목: '일예산', 적용시각: '2026-08-17T00:00:00+09:00'});
    }
  }
  if (caseId === 'S16') {
    add('2026-08-21', 'incident', null, 'mobile', null, '간편결제 처리 기록', {시작: '2026-08-21T00:00:00+09:00', 종료: '2026-08-25T00:00:00+09:00', 오류코드: 'PAYMENT_CALLBACK_TIMEOUT', 결제수단: '간편결제', 브라우저: '모바일 브라우저'});
    add('2026-08-24', 'creative', 'EDU-C3', 'all', null, '페이스북 피드 소재 v2', {소재버전: 'v2', 집행시작: '2026-08-24', 문구: '상품 용량과 사용 방법을 확인하세요.'});
  }
  if (caseId === 'S17') {
    for (const product of pack.products) add('2026-08-21', 'change', null, 'all', product.id, `${product.label} 판매 조건`, {항목: '할인율', 변경전: 20, 변경후: 0, 정가: product.listPrice, 적용시각: '2026-08-21T00:00:00+09:00'});
    add('2026-08-24', 'change', 'EDU-C1', 'all', null, '구글 검색 A 검색어 설정', {항목: '검색어 구성', 변경전: '제품 구매와 생활용품 추천', 변경후: '제품 구매 중심', 적용시각: '2026-08-24T00:00:00+09:00'});
  }
  if (caseId === 'S18') {
    add('2026-08-20', 'inventory', null, 'all', pack.products[1].id, `${pack.products[1].label} 판매 상태`, {구매가능: false, 재고수량: 0, 일판매가능시간: 0, 시작: '2026-08-20T00:00:00+09:00', 종료: '2026-08-28T00:00:00+09:00'});
    add('2026-08-28', 'inventory', null, 'all', pack.products[1].id, `${pack.products[1].label} 입고 기록`, {구매가능: true, 재고수량: 500, 일판매가능시간: 24, 적용시각: '2026-08-28T00:00:00+09:00'});
    add('2026-08-24', 'incident', null, 'mobile', null, '모바일 페이지 배포 기록', {페이지버전: 'v2', 시작: '2026-08-24T00:00:00+09:00', 종료: '2026-08-31T00:00:00+09:00', 상태: '이미지 응답 지연', 오류코드: 'IMAGE_RESPONSE_SLOW'});
    for (const id of ['EDU-C5', 'EDU-C6']) add('2026-08-17', 'creative', id, 'all', pack.products[0].id, '제휴 콘텐츠 v2', {소재버전: 'v2', 집행시작: '2026-08-17', 소개상품: pack.products[0].id, 문구: '작은 용량의 상품을 소개합니다.'});
    add('2026-08-24', 'creative', 'EDU-C3', 'all', null, '페이스북 피드 소재 v2', {소재버전: 'v2', 집행시작: '2026-08-24', 문구: '상품 용량과 사용 방법을 확인하세요.'});
  }
  const weekday = [.95, 1.03, 1.07, .99, 1.11, .89, .96];
  for (const period of pack.periods) for (let day = 0; day < 14; day++) for (const [c, campaign] of pack.campaigns.entries()) for (const device of ['mobile', 'desktop']) {
    const current = period.id === 'current', mobile = device === 'mobile';
    const date = new Date(Date.parse(period.start + 'T00:00:00Z') + day * 86400000).toISOString().slice(0, 10);
    const seed = ((day * 17 + c * 11 + (mobile ? 3 : 7)) % 13 - 6) / 100;
    let volume = 1, cpc = 470 + c * 23 + (mobile ? 12 : -18), ctr = .018 + c * .001;
    let conversion = (c % 2 ? .027 : .073) * (mobile ? .91 : 1.12), load = mobile ? 1450 : 930;
    let failRate = .02, discount = .2;
    const stockout = current && caseId === 'S18' && day >= 3 && day < 11;
    if (current && caseId === 'S16') {
      if (c < 4) {volume = 1.65; cpc *= 1.19; conversion *= .83;}
      if (mobile && day >= 4 && day < 8) failRate = .42;
      if (c === 2 && day >= 7) {ctr *= 1.22; conversion *= 1.12;}
    }
    if (current && caseId === 'S17') {
      volume = c % 2 ? .18 : .72;
      if (day >= 4) {discount = 0; conversion *= .81;}
      if (c === 0 && day >= 7) {conversion *= 1.28; cpc *= 1.08;}
    }
    if (current && caseId === 'S18') {
      if (c >= 4) {volume = 1.35; ctr *= 1.14;}
      if (mobile && day >= 7) {load = 3250; conversion *= .78;}
      if (c === 2 && day >= 7) {ctr *= 1.25; conversion *= 1.1;}
    }
    const impressions = Math.round(20000 * 8 / 14 * (mobile ? .62 : .38) * weekday[day % 7] * (1 + seed) * volume);
    const clicks = Math.round(impressions * ctr * (1 + seed / 2));
    const sessions = Math.round(clicks * (load > 3000 ? .70 : .87));
    const view = Math.round(sessions * .88);
    const expected = Math.round(clicks * conversion * (1 + seed));
    const shares = current && ((caseId === 'S16' && c < 4) || (caseId === 'S18' && c >= 4)) ? [6, 3, 1] : [3 + c % 2, 4, 3];
    const intended = allocate(expected, shares);
    const completed = intended.map((value, p) => stockout && p === 1 ? 0 : Math.round(value * (1 - failRate)));
    const failures = completed.map((value, p) => stockout && p === 1 ? 0 : intended[p] - value);
    const orders = completed.reduce((a, b) => a + b, 0), paymentFailures = failures.reduce((a, b) => a + b, 0);
    const checkout = Math.max(orders + paymentFailures, Math.round(expected * 1.65));
    const cart = Math.max(checkout, Math.round(expected * 2.6));
    const row = {id: `${caseId}-${period.id}-${c}-${device}-${day}`, date, periodId: period.id, campaignId: campaign.id, device, exposureBasis: campaign.exposureBasis, ...Object.fromEntries(trainingMeasures.map(k => [k, 0]))};
    Object.assign(row, {impressions, clicks, spend: Math.round(clicks * cpc * (1 + seed / 3)), sessions, view, cart, checkout, orders, purchases: orders, units: orders, paymentFailures, paymentAttempts: orders + paymentFailures, ledgerOrders: orders, trackingExpected: orders, trackingReceived: orders, loadSamples: sessions, loadTotalMs: sessions * load});
    const skuRows = pack.products.map((product, p) => ({...row, id: row.id + '-product-' + p, dimension: 'product', key: product.id, label: product.label, source: campaign.source, creativeId: campaign.id + '-v1', audienceId: 'all', placement: 'all', keyword: '', matchType: '', browser: mobile ? '모바일 브라우저' : 'PC 브라우저', paymentMethod: mobile ? '간편결제' : '카드', orders: completed[p], purchases: completed[p], units: completed[p], paymentFailures: failures[p], paymentAttempts: completed[p] + failures[p], ledgerOrders: completed[p], trackingExpected: completed[p], trackingReceived: completed[p], listRevenue: completed[p] * product.listPrice, discount: Math.round(completed[p] * product.listPrice * discount), revenue: Math.round(completed[p] * product.listPrice * (1 - discount))}));
    for (const key of ['checkout', 'cart', 'view', 'sessions', 'clicks', 'impressions']) {
      const child = {checkout: 'paymentAttempts', cart: 'checkout', view: 'cart', sessions: 'view', clicks: 'sessions', impressions: 'clicks'}[key];
      const minima = skuRows.map(r => r[child]), remainder = row[key] - minima.reduce((a, b) => a + b, 0);
      const weights = stockout && ['checkout', 'cart'].includes(key) ? shares.map((v, p) => p === 1 ? 0 : v) : shares;
      const values = allocate(remainder, weights); skuRows.forEach((r, p) => r[key] = minima[p] + values[p]);
    }
    const spendParts = allocate(row.spend, shares);
    skuRows.forEach((r, p) => {r.spend = spendParts[p]; r.ledgerRevenue = r.revenue; r.loadSamples = r.sessions; r.loadTotalMs = r.sessions * load;});
    for (const key of ['listRevenue', 'discount', 'revenue', 'ledgerRevenue']) row[key] = skuRows.reduce((n, r) => n + r[key], 0);
    const coreShare = current && caseId === 'S16' && c < 4 ? .7 : current && caseId === 'S17' && c === 0 && day >= 7 ? .85 : .64;
    const creativeVersion = current && ((c === 2 && day >= 7 && caseId !== 'S17') || (caseId === 'S18' && c >= 4)) ? 2 : 1;
    skuRows.forEach(r => r.creativeId = `${campaign.id}-v${creativeVersion}`);
    const traffic = ['core', 'extended'].map((key, index) => ({...row, id: row.id + '-traffic-' + index, dimension: 'traffic', key, label: index ? '확장 집단' : '핵심 집단', source: campaign.source, creativeId: `${campaign.id}-v${current && ((c === 2 && day >= 7 && caseId !== 'S17') || (caseId === 'S18' && c >= 4)) ? 2 : 1}`, audienceId: key, placement: campaign.channel === 'search' ? '검색 결과' : campaign.channel === 'social' ? (mobile ? '모바일 피드' : 'PC 피드') : '콘텐츠 본문', keyword: campaign.channel === 'search' ? (index ? '생활용품 추천' : '제품 구매') : '', matchType: campaign.channel === 'search' ? (index ? '구문' : '일치') : '', browser: mobile ? '모바일 브라우저' : 'PC 브라우저', paymentMethod: mobile ? '간편결제' : '카드'}));
    for (const key of trainingMeasures) {const values = allocate(row[key], [coreShare, 1 - coreShare]); traffic.forEach((r, i) => r[key] = values[i]);}
    for (const key of ['listRevenue', 'discount']) {
      const values = allocate(row[key], row.orders ? traffic.map(r => r.orders) : [1, 1]);
      traffic.forEach((r, i) => r[key] = values[i]);
    }
    traffic.forEach(r => r.paymentAttempts = r.orders + r.paymentFailures);
    for (const key of ['checkout', 'cart', 'view', 'sessions', 'clicks', 'impressions']) {
      const child = {checkout: 'paymentAttempts', cart: 'checkout', view: 'cart', sessions: 'view', clicks: 'sessions', impressions: 'clicks'}[key];
      const minima = traffic.map(r => r[child]);
      const trafficShares = current && caseId === 'S16' && c < 4 ? [.35, .65] : [.55, .45];
      const values = allocate(row[key] - minima.reduce((a, b) => a + b, 0), trafficShares);
      traffic.forEach((r, i) => r[key] = minima[i] + values[i]);
    }
    traffic.forEach(r => {r.units = r.purchases = r.orders; r.ledgerOrders = r.trackingExpected = r.trackingReceived = r.orders; r.revenue = r.listRevenue - r.discount; r.ledgerRevenue = r.revenue; r.paymentAttempts = r.orders + r.paymentFailures; r.loadSamples = r.sessions; r.loadTotalMs = r.sessions * load;});
    pack.facts.push(row); pack.breakdowns.push(...skuRows, ...traffic);
  }
  for (const period of pack.periods) for (const campaign of pack.campaigns) for (const device of ['mobile', 'desktop']) {
    const impressions = pack.facts.filter(r => r.periodId === period.id && r.campaignId === campaign.id && r.device === device).reduce((n, r) => n + r.impressions, 0);
    pack.reach.push({periodId: period.id, campaignId: campaign.id, device, impressions, reach: campaign.exposureBasis === 'ad_impression' ? Math.round(impressions / (period.id === 'current' && caseId === 'S16' ? 2.8 : 2.2)) : null});
  }
  return pack;
}
