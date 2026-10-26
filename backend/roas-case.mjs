import assert from 'node:assert/strict';
import {cents} from './agent-tools.mjs';
import {selectScenario} from '../shared/scenario-selection.mjs';

const money = value => `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
const ratio = (numerator, denominator) => {
  assert(Number.isFinite(numerator) && Number.isFinite(denominator), 'nonfinite_metric');
  return denominator === 0 ? null : numerator / denominator;
};
const inPeriod = (time, period) => time.slice(0, 10) >= period.start && time.slice(0, 10) < period.end;
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value).toISOString().slice(0, 10) === value;
const amount = (value, currency) => {
  assert(value && value.currency === currency, 'currency_or_amount_missing');
  const result = cents(value.amount);
  assert(result <= BigInt(Number.MAX_SAFE_INTEGER), 'amount_outside_supported_precision');
  return result;
};

// This is a calculation and review workflow, independent of agents and the UI.
// The profile must declare the source's revenue and financial-event semantics.
export function analyzeRoasCase(records, profile, {asOf} = {}) {
  assert(profile && profile.scenario_id && profile.product_id && profile.scope_ids, 'case_profile_required');
  assert.deepEqual(Object.keys(profile.scope_ids), ['KR'], 'first_case_is_kr_only');
  assert(typeof asOf === 'string' && /T.*(?:Z|[+-]\d\d:\d\d)$/.test(asOf) && Number.isFinite(Date.parse(asOf)), 'as_of_required');
  const periods = [profile.baseline, profile.observed];
  for (const period of periods) assert(date(period.start) && date(period.end) && period.start < period.end, 'period_invalid');
  assert.equal(Date.parse(periods[0].end) - Date.parse(periods[0].start), Date.parse(periods[1].end) - Date.parse(periods[1].start), 'period_length_mismatch');
  assert(Date.parse(periods[0].end) <= Date.parse(periods[1].start), 'comparison_periods_overlap');
  assert(Date.parse(asOf) >= Date.parse(periods[1].end + 'T00:00:00+09:00'), 'comparison_not_finished');
  const selected = selectScenario(records, profile.scope_ids, profile.scenario_id);
  const rows = selected.filter(row => row.dataset_type !== 'T01');
  assert(rows.length && rows.every(row => row.is_synthetic === true), 'synthetic_case_required');
  assert.equal(new Set(rows.map(row => row.record_id)).size, rows.length, 'duplicate_record');
  const byId = new Map(selected.map(row => [row.record_id, row]));
  for (const row of rows) for (const ref of row.related_record_ids || []) assert(byId.has(ref), 'reference_outside_case');
  const ofType = type => rows.filter(row => row.dataset_type === type);
  const sameDay = profile.purchase_timing === 'same_day';
  const withinWindow = profile.purchase_timing === 'within_window';
  const complete = sameDay || withinWindow;
  if (complete) assert(profile.attribution_date_basis === 'paid_touch_date' && profile.attribution_model === 'last_click' && profile.attribution_window === '7_days', 'case_attribution_unsupported');
  const variants = new Set(selected.filter(row => row.dataset_type === 'T01' && row.product_id === profile.product_id).map(row => row.variant_id));
  assert(variants.size, 'product_missing');
  const campaigns = ofType('T12').filter(row => row.product_refs.length === 1 && row.product_refs[0] === profile.product_id);
  assert(campaigns.length, 'campaign_missing');
  const campaignIds = new Set(campaigns.map(row => row.campaign_id));
  const web = ofType('T17').filter(row => Date.parse(row.event_time) <= Date.parse(asOf));
  const commerce = ofType('T18').filter(row => variants.has(row.variant_ref) && Date.parse(row.event_time) <= Date.parse(asOf));
  const orders = ofType('T19').filter(row => variants.has(row.variant_ref) && Date.parse(row.ordered_at) <= Date.parse(asOf));
  const adjustments = ofType('T20');
  const gaps = new Set();
  if (!complete) gaps.add('purchase_timing_unconfirmed');
  if (withinWindow && Date.parse(asOf) < Date.parse(periods[1].end + 'T00:00:00+09:00') + 7 * 86400000) gaps.add('attribution_window_not_mature');
  if (profile.revenue_basis !== 'discounted_product_ex_tax_shipping') gaps.add('product_revenue_definition_unconfirmed');
  if (profile.adjustment_links !== 'financial_representative') gaps.add('financial_event_deduplication_unconfirmed');
  const acquisition = new Map();
  for (const order of orders) {
    const visit = byId.get(order.acquisition_ref);
    if (!visit || visit.dataset_type !== 'T17' || !visit.session_ref || !campaignIds.has(visit.utm_campaign)) {
      gaps.add('order_acquisition_missing');
      continue;
    }
    assert(visit.traffic_medium === 'paid' && Date.parse(visit.event_time) <= Date.parse(order.ordered_at), 'acquisition_invalid');
    assert(Date.parse(order.ordered_at) - Date.parse(visit.event_time) <= 7 * 86400000, 'attribution_window_exceeded');
    if (complete) {
      if (sameDay) assert.equal(order.ordered_at.slice(0, 10), visit.event_time.slice(0, 10), 'same_day_case_required');
      const matches = commerce.filter(event => event.event_name === 'purchase' && event.transaction_ref === order.transaction_ref && event.variant_ref === order.variant_ref);
      assert.equal(matches.length, 1, 'order_purchase_relation_invalid');
      const event = matches[0];
      if (sameDay) assert.equal(event.session_ref, visit.session_ref, 'purchase_session_mismatch');
      if (withinWindow) {
        if (visit.user_pseudo_ref) {
          const lastPaid = web.filter(row => row.traffic_medium === 'paid' && row.user_pseudo_ref === visit.user_pseudo_ref &&
            Date.parse(row.event_time) <= Date.parse(order.ordered_at)).toSorted((a, b) => Date.parse(b.event_time) - Date.parse(a.event_time))[0];
          assert.equal(lastPaid?.record_id, visit.record_id, 'last_paid_touch_mismatch');
        }
        const purchaseVisit = web.find(row => row.session_ref === event.session_ref);
        assert(purchaseVisit && purchaseVisit.user_pseudo_ref === visit.user_pseudo_ref &&
          Date.parse(purchaseVisit.event_time) <= Date.parse(event.event_time), 'purchase_return_visit_missing');
        if (event.session_ref !== visit.session_ref) {
          assert(visit.user_pseudo_ref && order.customer_pseudo_ref === visit.user_pseudo_ref && visit.consent_state === 'granted' && purchaseVisit.consent_state === 'granted', 'order_visitor_mismatch');
          assert(purchaseVisit.traffic_medium === 'direct' && purchaseVisit.related_record_ids.includes(visit.record_id), 'purchase_return_chain_invalid');
          assert(event.related_record_ids.includes(purchaseVisit.record_id), 'purchase_return_reference_missing');
        }
        assert(Date.parse(event.event_time) - Date.parse(purchaseVisit.event_time) <= 4 * 3600000, 'purchase_session_too_long');
      }
      assert.equal(event.quantity, order.quantity, 'purchase_quantity_mismatch');
      assert.equal(event.event_time, order.ordered_at, 'purchase_time_mismatch');
      assert.equal(event.campaign_ref, visit.utm_campaign, 'purchase_campaign_mismatch');
      assert(event.related_record_ids.includes(order.record_id), 'purchase_order_reference_missing');
    }
    acquisition.set(order.record_id, visit.utm_campaign);
  }
  const purchases = commerce.filter(row => row.event_name === 'purchase');
  if (purchases.some(row => !row.session_ref)) gaps.add('purchase_session_missing');
  if (complete) {
    assert.equal(purchases.length, orders.length, 'orphan_purchase_event');
    assert.equal(new Set(orders.map(row => row.transaction_ref)).size, orders.length, 'first_case_one_line_per_order');
    assert.equal(new Set(web.map(row => row.session_ref)).size, web.length, 'first_case_one_landing_per_session');
    const visits = new Map(web.map(row => [row.session_ref, row]));
    const steps = ['view_item', 'add_to_cart', 'begin_checkout', 'purchase'];
    for (const visit of web) {
      let previous = Date.parse(visit.event_time), missingStep = false;
      for (const name of steps) {
        const events = commerce.filter(row => row.session_ref === visit.session_ref && row.event_name === name);
        assert(events.length <= 1, 'duplicate_session_step');
        if (!events.length) {missingStep = true; continue;}
        assert((!missingStep || withinWindow && visit.traffic_medium !== 'paid') && Date.parse(events[0].event_time) >= previous, 'funnel_sequence_invalid');
        assert.equal(events[0].campaign_ref, visit.utm_campaign, 'funnel_campaign_mismatch');
        if (withinWindow) assert(Date.parse(events[0].event_time) - Date.parse(visit.event_time) <= 4 * 3600000, 'commerce_session_too_long');
        previous = Date.parse(events[0].event_time);
      }
    }
    assert(commerce.filter(row => row.event_name !== 'refund').every(row => visits.has(row.session_ref)), 'funnel_visit_missing');
  }
  const daily = ofType('T13').filter(row => row.period.grain === 'day' && campaignIds.has(row.campaign_ref));
  const definitions = new Set(daily.map(row => JSON.stringify([row.conversion_definition_ref, row.attribution_model, row.attribution_window])));
  assert.equal(definitions.size, 1, 'ad_definitions_incomparable');
  assert(daily.every(row => row.entity_level === 'campaign' && row.report_state === 'final' && row.attribution_model === 'last_click' && row.attribution_window === '7_days'), 'ad_report_incomparable');
  assert.equal(new Set(daily.map(row => row.campaign_ref + '/' + row.period.start)).size, daily.length, 'duplicate_daily_report');
  const subtotal = order => {
    assert(Number.isSafeInteger(order.quantity) && order.quantity > 0, 'quantity_invalid');
    const result = amount(order.unit_price, profile.currency) * BigInt(order.quantity) - amount(order.line_discount, profile.currency);
    assert.equal(result + amount(order.line_tax, profile.currency), amount(order.line_gross_total, profile.currency), 'order_money_mismatch');
    assert(result >= 0n, 'negative_product_subtotal');
    return result;
  };
  function reversal(order) {
    if (profile.adjustment_links !== 'financial_representative') return null;
    const related = adjustments.filter(row => row.order_line_ref === order.line_id);
    let total = 0n;
    for (const row of related) {
      assert.equal(row.order_ref, order.order_id, 'adjustment_order_mismatch');
      const references = (row.related_record_ids || []).map(id => byId.get(id)).filter(ref => ref?.dataset_type === 'T20');
      assert(references.length <= 1, 'ambiguous_financial_representative');
      if (references.length) {
        const representative = references[0];
        assert.equal(representative.order_line_ref, row.order_line_ref, 'financial_representative_wrong_line');
        assert.equal(representative.order_ref, row.order_ref, 'financial_representative_wrong_order');
        assert(!(representative.related_record_ids || []).some(id => byId.get(id)?.dataset_type === 'T20'), 'financial_representative_cycle');
        assert(['cancel', 'refund'].includes(representative.adjustment_kind), 'financial_representative_not_monetary');
        assert.equal(representative.status, 'completed', 'financial_representative_not_completed');
        assert(Date.parse(row.processed_at) >= Date.parse(representative.processed_at), 'financial_representative_time_conflict');
        if (row.refund_amount) assert.equal(amount(row.refund_amount, profile.currency), amount(representative.refund_amount, profile.currency), 'financial_alias_amount_mismatch');
        continue;
      }
      if (row.status !== 'completed' || row.adjustment_kind === 'return') continue;
      assert(row.processed_at && Date.parse(row.processed_at) >= Date.parse(order.ordered_at), 'adjustment_time_invalid');
      if (Date.parse(row.processed_at) > Date.parse(asOf)) continue;
      assert(['cancel', 'refund'].includes(row.adjustment_kind), 'adjustment_kind_invalid');
      total += amount(row.refund_amount, profile.currency);
    }
    assert(total <= subtotal(order), 'reversal_exceeds_product_subtotal');
    return total;
  }
  const results = periods.map(period => {
    const channels = campaigns.map(campaign => {
      const ads = daily.filter(row => row.campaign_ref === campaign.campaign_id && inPeriod(row.period.start, period));
      const expectedDays = (Date.parse(period.end) - Date.parse(period.start)) / 86400000;
      assert.equal(ads.length, expectedDays, 'daily_report_gap');
      assert(ads.every(row => row.period.end_exclusive === new Date(Date.parse(row.period.start) + 86400000).toISOString().slice(0, 10)), 'not_one_day');
      const spend = ads.reduce((sum, row) => sum + amount(row.metrics.spend, profile.currency), 0n);
      const attributedRevenue = ads.reduce((sum, row) => sum + amount(row.metrics.attributed_value, profile.currency), 0n);
      const clicks = ads.reduce((sum, row) => sum + row.metrics.clicks, 0);
      const reportedPurchases = ads.reduce((sum, row) => sum + row.metrics.attributed_conversions, 0);
      assert(Number.isSafeInteger(clicks) && clicks >= 0 && Number.isSafeInteger(reportedPurchases) && reportedPurchases >= 0, 'ad_counts_invalid');
      const visits = web.filter(row => row.utm_campaign === campaign.campaign_id && row.traffic_medium === 'paid' && inPeriod(row.event_time, period));
      const sessions = new Set(visits.map(row => row.session_ref).filter(Boolean));
      const cohortOrders = orders.filter(row => acquisition.get(row.record_id) === campaign.campaign_id && inPeriod(byId.get(row.acquisition_ref).event_time, period));
      if (complete) for (const ad of ads) {
        if (withinWindow && Date.parse(asOf) < Date.parse(ad.period.end_exclusive + 'T00:00:00+09:00') + 7 * 86400000) continue;
        const sameDay = cohortOrders.filter(order => byId.get(order.acquisition_ref).event_time.startsWith(ad.period.start));
        assert.equal(sameDay.length, ad.metrics.attributed_conversions, 'daily_ad_purchase_mismatch');
        assert.equal(sameDay.reduce((sum, order) => sum + subtotal(order), 0n), amount(ad.metrics.attributed_value, profile.currency), 'daily_ad_revenue_mismatch');
      }
      const gross = cohortOrders.reduce((sum, row) => sum + subtotal(row), 0n);
      const losses = cohortOrders.map(reversal);
      const net = gaps.size || losses.some(value => value === null) ? null : gross - losses.reduce((sum, value) => sum + value, 0n);
      const orderTransactions = new Set(cohortOrders.map(row => row.transaction_ref));
      const convertedSessions = new Set(cohortOrders.map(row => byId.get(row.acquisition_ref).session_ref));
      const returnPurchases = cohortOrders.filter(order => purchases.find(event => event.transaction_ref === order.transaction_ref)?.session_ref !== byId.get(order.acquisition_ref).session_ref).length;
      const funnel = {};
      for (const event of ['view_item', 'add_to_cart', 'begin_checkout', 'purchase']) {
        const matching = commerce.filter(row => row.event_name === event && sessions.has(row.session_ref));
        funnel[event] = event === 'purchase' && gaps.has('purchase_session_missing') ? null : new Set(matching.map(row => row.session_ref)).size;
      }
      return {channel: campaign.channel, campaignId: campaign.campaign_id,
        reported: {spend: money(spend), attributedRevenue: money(attributedRevenue), purchases: reportedPurchases, clicks,
          roas: ratio(Number(attributedRevenue), Number(spend)), cpc: ratio(Number(spend) / 100, clicks),
          clickPurchaseRate: ratio(reportedPurchases, clicks), revenuePerPurchase: ratio(Number(attributedRevenue) / 100, reportedPurchases)},
        purchaseCohort: {paidSessions: sessions.size, orders: gaps.has('order_acquisition_missing') ? null : orderTransactions.size,
          returnPurchases: complete ? returnPurchases : null,
          discountedProductRevenue: gaps.has('order_acquisition_missing') ? null : money(gross),
          confirmedReversals: net === null ? null : money(gross - net), netProductRevenue: net === null ? null : money(net),
          netRoas: net === null ? null : ratio(Number(net), Number(spend)),
          sessionPurchaseRate: gaps.has('order_acquisition_missing') ? null : ratio(convertedSessions.size, sessions.size), funnel},
        evidence: {adRecordIds: ads.map(row => row.record_id), orderRecordIds: cohortOrders.map(row => row.record_id),
          adjustmentRecordIds: adjustments.filter(row => cohortOrders.some(order => order.line_id === row.order_line_ref)).map(row => row.record_id)}};
    });
    const spend = channels.reduce((sum, row) => sum + cents(row.reported.spend), 0n);
    const revenue = channels.reduce((sum, row) => sum + cents(row.reported.attributedRevenue), 0n);
    const net = channels.every(row => row.purchaseCohort.netProductRevenue !== null)
      ? channels.reduce((sum, row) => sum + cents(row.purchaseCohort.netProductRevenue), 0n) : null;
    return {period, channels, total: {spend: money(spend), reportedRevenue: money(revenue), reportedRoas: ratio(Number(revenue), Number(spend)),
      netProductRevenue: net === null ? null : money(net), netRoas: net === null ? null : ratio(Number(net), Number(spend))}};
  });
  const evidence = [...ofType('T24').filter(row => row.subject_ref === profile.product_id), ...ofType('T26').filter(row => row.product_ref === profile.product_id)]
    .filter(row => inPeriod(row.written_at || row.created_at, {start: profile.baseline.start, end: profile.observed.end}))
    .map(row => ({recordId: row.record_id, text: row.body_text || row.message_text, at: row.written_at || row.created_at,
      orderRef: row.order_ref || null, relatedRecordIds: row.related_record_ids || [], classification: 'explanation_candidate_evidence'}));
  const shipping = evidence.filter(row => /배송|출고/.test(row.text));
  const checkout = evidence.filter(row => /결제|배송비|추가 비용/.test(row.text));
  const changes = results[1].channels.map(channel => {
    const before = results[0].channels.find(item => item.campaignId === channel.campaignId);
    const factor = key => before.reported[key] === null || channel.reported[key] === null ? null : ratio(channel.reported[key], before.reported[key]);
    return {campaignId: channel.campaignId, channel: channel.channel, classification: 'calculated_change_not_cause',
      reportedRoasChange: channel.reported.roas === null || before.reported.roas === null ? null : channel.reported.roas - before.reported.roas,
      cpcFactor: factor('cpc'), clickPurchaseRateFactor: factor('clickPurchaseRate'), revenuePerPurchaseFactor: factor('revenuePerPurchase'),
      spendShareBefore: ratio(Number(cents(before.reported.spend)), Number(cents(results[0].total.spend))),
      spendShareAfter: ratio(Number(cents(channel.reported.spend)), Number(cents(results[1].total.spend)))};
  });
  function bridge(net) {
    const metric = channel => net ? channel.purchaseCohort.netRoas : channel.reported.roas;
    if (results.some(period => period.channels.some(channel => metric(channel) === null)) || results.some(period => cents(period.total.spend) === 0n)) return null;
    let withinChannelChange = 0, spendMixChange = 0;
    for (const change of changes) {
      const before = results[0].channels.find(row => row.campaignId === change.campaignId);
      const after = results[1].channels.find(row => row.campaignId === change.campaignId);
      withinChannelChange += change.spendShareBefore * (metric(after) - metric(before));
      spendMixChange += (change.spendShareAfter - change.spendShareBefore) * metric(after);
    }
    return {withinChannelChange, spendMixChange, convention: 'baseline_spend_weights_then_current_channel_roas', classification: 'arithmetic_not_causal'};
  }
  const reviewPriority = changes.map(change => {
    const before = results[0].channels.find(row => row.campaignId === change.campaignId);
    const after = results[1].channels.find(row => row.campaignId === change.campaignId);
    const netAvailable = before.purchaseCohort.netRoas !== null && after.purchaseCohort.netRoas !== null;
    return {campaignId: change.campaignId, channel: change.channel, basis: netAvailable ? 'net_roas_change' : 'reported_roas_change',
      change: netAvailable ? after.purchaseCohort.netRoas - before.purchaseCohort.netRoas : change.reportedRoasChange};
  }).sort((a, b) => (a.change ?? Infinity) - (b.change ?? Infinity));
  // Keep daily trends on the same original-order cohort and refund cutoff as the cards.
  const dailyTrend = daily.filter(ad => periods.some(period => inPeriod(ad.period.start, period))).map(ad => {
    const cohort = orders.filter(order => acquisition.get(order.record_id) === ad.campaign_ref &&
      byId.get(order.acquisition_ref).event_time.startsWith(ad.period.start));
    const losses = cohort.map(reversal);
    const net = gaps.size || losses.some(value => value === null) ? null :
      cohort.reduce((sum, order) => sum + subtotal(order), 0n) - losses.reduce((sum, value) => sum + value, 0n);
    const spend = amount(ad.metrics.spend, profile.currency);
    return {date: ad.period.start, channel: campaigns.find(campaign => campaign.campaign_id === ad.campaign_ref).channel,
      recordId: ad.record_id, roas: ratio(Number(amount(ad.metrics.attributed_value, profile.currency)), Number(spend)),
      netRoas: net === null ? null : ratio(Number(net), Number(spend))};
  });
  return {scenarioId: profile.scenario_id, productId: profile.product_id, currency: profile.currency, asOf,
    purchaseTiming: profile.purchase_timing || 'unconfirmed',
    funnelBasis: withinWindow ? 'paid_session_steps_with_return_purchases_separate' : sameDay ? 'same_day_paid_session' : 'unconfirmed',
    mode: 'synthetic_workflow', status: gaps.size ? 'partial' : 'review_ready', periods: results, changes, gaps: [...gaps], evidence, dailyTrend,
    roasBridge: {reported: bridge(false), net: bridge(true)}, reviewPriority,
    // Diverse cases test alternative problems; incidental product feedback does not select guidance fixes.
    actionDrafts: withinWindow ? [] : [
      ...(shipping.length ? [{target: '광고와 상품 페이지의 배송 안내', change: '배송 약속 문구와 실제 안내를 대조하고 출고 예정일, 배송 소요 조건을 일치시키는 수정안 작성', evidenceIds: shipping.map(row => row.recordId), status: 'candidate_requires_content_review'}] : []),
      ...(checkout.length ? [{target: '상품 페이지와 결제 시작 화면', change: '최종 결제 전 상품금액, 배송비, 할인 적용 조건을 확인할 수 있는 안내 수정안 작성', evidenceIds: checkout.map(row => row.recordId), status: 'candidate_requires_content_review'}] : [])],
    budgetReview: campaigns.map(row => ({campaignId: row.campaign_id, channel: row.channel, decision: 'hold_for_review', amount: null, changeRatio: null,
      required: ['target_roas', 'budget_limit', 'operating_constraints'], reason: '목표와 운영 제약 확인 전 예산 변경을 확정하지 않음'})),
    limitations: ['synthetic_not_marketing_effect', 'arithmetic_decomposition_not_causality', 'feedback_not_causal_proof',
      'paid_session_sample_not_all_site_traffic', 'customer_mix_unmeasured', 'refunds_as_of_cutoff_not_final_forever', 'workflow_usefulness_not_yet_user_validated',
      ...(withinWindow ? ['seven_day_paid_touch_cohort_not_same_session_conversion', 'anonymous_same_session_attribution_cannot_verify_cross_session_identity', 'visit_device_not_purchase_device', 'diverse_case_guidance_actions_require_separate_content_review'] : [])]};
}
