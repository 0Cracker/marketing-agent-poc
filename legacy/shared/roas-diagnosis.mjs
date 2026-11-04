const inPeriod = (time, period) => typeof time === 'string' && time.slice(0, 10) >= period.start && time.slice(0, 10) < period.end;
const available = (time, asOf) => typeof time === 'string' && Date.parse(time) <= Date.parse(asOf);

// Keep the same baseline-weight convention as the report's arithmetic bridge.
export function channelContributions(periods) {
  const [before, after] = periods;
  const delta = before.total.netRoas === null || after.total.netRoas === null ? null : after.total.netRoas - before.total.netRoas;
  return after.channels.map(current => {
    const prior = before.channels.find(row => row.campaignId === current.campaignId);
    const valid = prior && prior.purchaseCohort.netRoas !== null && current.purchaseCohort.netRoas !== null && Number(before.total.spend) > 0 && Number(after.total.spend) > 0;
    const priorWeight = valid ? Number(prior.reported.spend) / Number(before.total.spend) : null;
    const currentWeight = valid ? Number(current.reported.spend) / Number(after.total.spend) : null;
    const withinChange = valid ? priorWeight * (current.purchaseCohort.netRoas - prior.purchaseCohort.netRoas) : null;
    const mixChange = valid ? (currentWeight - priorWeight) * current.purchaseCohort.netRoas : null;
    return {channel: current.channel, withinChange, mixChange,
      shareOfDecline: withinChange === null || delta === null || delta >= 0 ? null : withinChange / delta};
  });
}

export function deviceFunnels(records, report, channel = 'all') {
  const byId = new Map(records.map(row => [row.record_id, row]));
  const campaigns = new Set(report.periods.flatMap(period => period.channels.filter(row => channel === 'all' || row.channel === channel).map(row => row.campaignId)));
  const visits = records.filter(row => row.dataset_type === 'T17' && campaigns.has(row.utm_campaign) && row.traffic_medium === 'paid' && available(row.event_time, report.asOf));
  const events = records.filter(row => row.dataset_type === 'T18' && campaigns.has(row.campaign_ref) && available(row.event_time, report.asOf));
  return ['mobile', 'desktop'].map(device => {
    const counts = report.periods.map(({period, channels: periodChannels}) => {
      const sessions = new Set(visits.filter(row => row.device === device && inPeriod(row.event_time, period)).map(row => row.session_ref).filter(Boolean));
      const orderIds = new Set(periodChannels.filter(row => channel === 'all' || row.channel === channel).flatMap(row => row.evidence.orderRecordIds));
      const returnPurchases = records.filter(row => row.dataset_type === 'T19' && orderIds.has(row.record_id) &&
        sessions.has(byId.get(row.acquisition_ref)?.session_ref) && available(row.ordered_at, report.asOf) &&
        events.some(event => event.event_name === 'purchase' && event.transaction_ref === row.transaction_ref && event.session_ref !== byId.get(row.acquisition_ref)?.session_ref)).length;
      return {paidSessions: sessions.size, returnPurchases, ...Object.fromEntries(['view_item', 'add_to_cart', 'begin_checkout', 'purchase'].map(name =>
        [name, new Set(events.filter(row => row.event_name === name && sessions.has(row.session_ref)).map(row => row.session_ref)).size]))};
    });
    return {device, before: counts[0], after: counts[1]};
  });
}

export function deviceEvidence(records, report, channel, device) {
  const channels = report.periods.flatMap(period => period.channels.filter(row => channel === 'all' || row.channel === channel));
  const campaigns = new Set(channels.map(row => row.campaignId));
  const ads = new Set(channels.flatMap(row => row.evidence.adRecordIds));
  const orders = new Set(channels.flatMap(row => row.evidence.orderRecordIds));
  const compared = time => report.periods.some(({period}) => inPeriod(time, period));
  const visits = records.filter(row => row.dataset_type === 'T17' && campaigns.has(row.utm_campaign) && row.traffic_medium === 'paid' &&
    row.device === device && compared(row.event_time) && available(row.event_time, report.asOf));
  const visitIds = new Set(visits.map(row => row.record_id));
  const sessions = new Map(visits.filter(row => row.session_ref).map(row => [row.session_ref, row.utm_campaign]));
  const returns = records.filter(row => row.dataset_type === 'T17' && row.traffic_medium === 'direct' && available(row.event_time, report.asOf) &&
    visits.some(visit => (row.related_record_ids || []).includes(visit.record_id) && row.user_pseudo_ref === visit.user_pseudo_ref &&
      Date.parse(row.event_time) >= Date.parse(visit.event_time) && Date.parse(row.event_time) - Date.parse(visit.event_time) <= 7 * 86400000));
  const returnIds = new Set(returns.map(row => row.record_id));
  const returnSessions = new Map(returns.map(row => [row.session_ref, row.utm_campaign]));
  return records.filter(row => {
    switch (row.dataset_type) {
      case 'T14': return ads.has(row.parent_report_ref) && campaigns.has(row.campaign_ref) && compared(row.period?.start) &&
        row.breakdown_dimensions?.some(dimension => dimension.name === 'device' && dimension.value === device);
      case 'T17': return visitIds.has(row.record_id) || returnIds.has(row.record_id);
      case 'T18': return row.event_name !== 'refund' && available(row.event_time, report.asOf) &&
        (sessions.has(row.session_ref) && sessions.get(row.session_ref) === row.campaign_ref ||
          returnSessions.has(row.session_ref) && returnSessions.get(row.session_ref) === row.campaign_ref);
      case 'T19': return orders.has(row.record_id) && visitIds.has(row.acquisition_ref) && available(row.ordered_at, report.asOf);
      default: return false;
    }
  });
}

export function feedbackComparison(records, report) {
  const evidenceIds = new Set(report.evidence.map(row => row.recordId));
  const orderIds = new Set(report.periods.flatMap(period => period.channels.flatMap(row => row.evidence.orderRecordIds)));
  const orders = records.filter(row => row.dataset_type === 'T19' && orderIds.has(row.record_id));
  const orderRefs = new Set(orders.map(row => row.order_id));
  const feedback = records.filter(row => ['T24', 'T26'].includes(row.dataset_type) && evidenceIds.has(row.record_id) && available(row.written_at || row.created_at, report.asOf));
  const topics = [{topic: 'shipping', label: '배송과 출고', pattern: /배송|출고/}, {topic: 'checkout', label: '결제 금액과 조건', pattern: /결제|배송비|추가 비용/}];
  return topics.map(({topic, label, pattern}) => {
    const counts = report.periods.map(({period}) => {
      const all = feedback.filter(row => inPeriod(row.written_at || row.created_at, period));
      const matching = all.filter(row => pattern.test(row.body_text || row.message_text || ''));
      return {count: matching.length, total: all.length,
        orderLinked: matching.filter(row => orderRefs.has(row.order_ref) || (row.related_record_ids || []).some(id => orderIds.has(id))).length,
        recordIds: matching.map(row => row.record_id)};
    });
    return {topic, label, before: counts[0], after: counts[1]};
  });
}

// The report has already validated money and financial-representative contracts.
// Keep money in cents until the final display values, including device-scoped reversals.
const cashCents = value => value?.currency === 'KRW' && /^\d+\.\d{2}$/.test(value.amount) ? BigInt(value.amount.replace('.', '')) : null;
const divide = (a, b) => a === null || b === null || b === 0 ? null : a / b;
export function stageDiagnosis(records, report, channel = 'all', device = 'all') {
  const byId = new Map(records.map(row => [row.record_id, row]));
  const periods = report.periods.map(({period, channels}) => {
    const chosen = channels.filter(row => channel === 'all' || row.channel === channel);
    const campaigns = new Set(chosen.map(row => row.campaignId));
    const adIds = new Set(chosen.flatMap(row => row.evidence.adRecordIds));
    const parentAds = [...adIds].map(id => byId.get(id)).filter(Boolean);
    const ads = device === 'all' ? parentAds : records.filter(row => row.dataset_type === 'T14' && adIds.has(row.parent_report_ref) &&
      row.breakdown_dimensions?.length === 1 && row.breakdown_dimensions[0].name === 'device' && row.breakdown_dimensions[0].value === device);
    const unavailable = [];
    const costReady = chosen.length > 0 && parentAds.length === adIds.size && ads.length === adIds.size &&
      new Set(ads.map(row => device === 'all' ? row.record_id : row.parent_report_ref)).size === adIds.size &&
      ads.every(row => inPeriod(row.period?.start, period) && available(row.period.end_exclusive + 'T00:00:00+09:00', report.asOf) &&
        campaigns.has(row.campaign_ref) && Number.isFinite(row.metrics?.impressions) && Number.isFinite(row.metrics?.clicks) && cashCents(row.metrics?.spend) !== null);
    if (!costReady) unavailable.push('선택 범위의 완결된 광고 보고 또는 기기별 분할 자료가 부족해 비용 지표를 계산하지 않았습니다.');
    const impressions = costReady ? ads.reduce((sum, row) => sum + row.metrics.impressions, 0) : null;
    const clicks = costReady ? ads.reduce((sum, row) => sum + row.metrics.clicks, 0) : null;
    const spend = costReady ? Number(ads.reduce((sum, row) => sum + cashCents(row.metrics.spend), 0n)) / 100 : null;
    const orderIds = new Set(chosen.flatMap(row => row.evidence.orderRecordIds));
    const scopedOrders = [...orderIds].map(id => byId.get(id)).filter(order => {
      const visit = byId.get(order?.acquisition_ref);
      return order?.dataset_type === 'T19' && visit?.dataset_type === 'T17' && campaigns.has(visit.utm_campaign) &&
        inPeriod(visit.event_time, period) && available(visit.event_time, report.asOf) && available(order.ordered_at, report.asOf) &&
        (device === 'all' || visit.device === device);
    });
    const orderReady = chosen.length > 0 && ['all', 'mobile', 'desktop'].includes(device) && [...orderIds].every(id => {
      const order = byId.get(id), visit = byId.get(order?.acquisition_ref);
      return order && visit && campaigns.has(visit.utm_campaign) && (device === 'all' || ['mobile', 'desktop'].includes(visit.device));
    }) && scopedOrders.every(row => Number.isSafeInteger(row.quantity) && row.quantity > 0 && cashCents(row.unit_price) !== null && cashCents(row.line_discount) !== null);
    if (!orderReady) unavailable.push('선택 범위의 주문, 유입 연결 또는 금액이 부족해 구매금액과 조정을 계산하지 않았습니다.');
    const orders = orderReady ? new Set(scopedOrders.map(row => row.order_id)).size : null;
    const units = orderReady ? scopedOrders.reduce((sum, row) => sum + row.quantity, 0) : null;
    const list = orderReady ? scopedOrders.reduce((sum, row) => sum + cashCents(row.unit_price) * BigInt(row.quantity), 0n) : null;
    const discount = orderReady ? scopedOrders.reduce((sum, row) => sum + cashCents(row.line_discount), 0n) : null;
    const gross = orderReady ? Number(list - discount) / 100 : null;
    const lines = new Set(scopedOrders.map(row => row.line_id));
    const adjustments = records.filter(row => row.dataset_type === 'T20' && lines.has(row.order_line_ref) && available(row.requested_at, report.asOf));
    const monetary = adjustments.filter(row => row.status === 'completed' && ['cancel', 'refund'].includes(row.adjustment_kind) &&
      available(row.processed_at, report.asOf) && !(row.related_record_ids || []).some(id => byId.get(id)?.dataset_type === 'T20'));
    const adjustmentReady = orderReady && chosen.every(row => (row.evidence.adjustmentRecordIds || []).every(id => byId.has(id))) && monetary.every(row => cashCents(row.refund_amount) !== null);
    if (!adjustmentReady && orderReady) unavailable.push('확정 조정 자료 또는 금액이 부족해 차감액을 계산하지 않았습니다.');
    const loss = adjustmentReady ? Number(monetary.reduce((sum, row) => sum + cashCents(row.refund_amount), 0n)) / 100 : null;
    return {cost: {impressions, clicks, spend, ctr: divide(clicks, impressions), cpm: divide(spend === null ? null : spend * 1000, impressions), cpc: divide(spend, clicks)},
      revenue: {orders, units, unitPrice: divide(list === null ? null : Number(list) / 100, units), discountPerOrder: divide(discount === null ? null : Number(discount) / 100, orders), revenuePerOrder: divide(gross, orders)},
      refund: {revenueBeforeAdjustments: gross, adjustments: loss, adjustmentRate: divide(loss, gross)},
      evidenceIds: {cost: ads.map(row => row.record_id), revenue: scopedOrders.map(row => row.record_id), refund: [...scopedOrders, ...adjustments].map(row => row.record_id)}, unavailable};
  });
  return {before: periods[0], after: periods[1], limitations: ['수치는 선택한 매체, 방문 기기와 원주문 유입 기간 기준입니다. 원인과 수정 효과를 확정하지 않습니다.', '구매금액은 세금과 배송비를 제외한 할인 후 상품금액입니다. 대기 조정은 차감하지 않으며, 같은 금융 사건의 대표 처리행만 차감합니다.']};
}
