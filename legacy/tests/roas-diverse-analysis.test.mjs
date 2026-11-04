import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCurrentData} from '../scripts/current-data.mjs';
import {generateDiverseCases} from '../scripts/augment-roas-diversity.mjs';
import {analyzeRoasCase} from '../backend/roas-case.mjs';
import {renderRoasReview} from '../backend/roas-review.mjs';
import {deviceFunnels, deviceEvidence, stageDiagnosis} from '../shared/roas-diagnosis.mjs';
import {renderInvestigationSummary} from '../shared/roas-investigation-report.mjs';

// Reuse the approved deterministic cases; no replacement observations are installed.
const generated = generateDiverseCases();
const products = loadCurrentData().catalog.records.filter(row => row.dataset_type === 'T01');
const records = [...products, ...generated.records];
const profiles = generated.profiles;
const analyze = (profile, source = records, asOf = profile.default_as_of) => analyzeRoasCase(source, profile, {asOf});
const reports = profiles.map(profile => ({...analyze(profile), records: records.filter(row => row.dataset_type === 'T01' || row.scenario_id === profile.scenario_id)}));
const near = (a, b) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

test('diverse cases reconcile paid-touch daily money and separate direct-return purchases', () => {
  for (const report of reports) {
    assert.equal(report.status, 'review_ready');
    assert.deepEqual(report.gaps, []);
    assert.equal(report.funnelBasis, 'paid_session_steps_with_return_purchases_separate');
    assert.equal(report.actionDrafts.length, 0);
    assert(report.periods.some(period => period.channels.some(channel => channel.purchaseCohort.returnPurchases > 0)));
    const byId = new Map(report.records.map(row => [row.record_id, row]));
    for (const {period, channels} of report.periods) for (const channel of channels) {
      assert.equal(channel.purchaseCohort.funnel.purchase + channel.purchaseCohort.returnPurchases, channel.purchaseCohort.orders);
      const days = report.dailyTrend.filter(day => day.channel === channel.channel && day.date >= period.start && day.date < period.end);
      near(days.reduce((sum, day) => sum + day.netRoas * Number(byId.get(day.recordId).metrics.spend.amount), 0), Number(channel.purchaseCohort.netProductRevenue));
      const diagnosis = stageDiagnosis(report.records, report, channel.channel);
      const key = report.periods[0].period === period ? 'before' : 'after';
      near(diagnosis[key].refund.revenueBeforeAdjustments, Number(channel.purchaseCohort.discountedProductRevenue));
      near(diagnosis[key].refund.adjustments, Number(channel.purchaseCohort.confirmedReversals));
    }
  }
});

test('device cohorts reconcile original-session steps and later purchase evidence without changing device attribution', () => {
  for (const report of reports) for (const channel of ['search', 'social']) {
    const devices = deviceFunnels(report.records, report, channel);
    for (const [index, key] of ['before', 'after'].entries()) {
      const expected = report.periods[index].channels.find(row => row.channel === channel).purchaseCohort;
      assert.equal(devices.reduce((n, row) => n + row[key].paidSessions, 0), expected.paidSessions);
      assert.equal(devices.reduce((n, row) => n + row[key].purchase, 0), expected.funnel.purchase);
      assert.equal(devices.reduce((n, row) => n + row[key].returnPurchases, 0), expected.returnPurchases);
    }
    for (const device of ['mobile', 'desktop']) {
      const evidence = deviceEvidence(report.records, report, channel, device);
      const byId = new Map(evidence.map(row => [row.record_id, row]));
      const orders = evidence.filter(row => row.dataset_type === 'T19');
      for (const order of orders) {
        const acquisition = byId.get(order.acquisition_ref);
        assert.equal(acquisition.device, device);
        assert.equal(acquisition.traffic_medium, 'paid');
        const purchase = evidence.find(row => row.dataset_type === 'T18' && row.event_name === 'purchase' && row.transaction_ref === order.transaction_ref);
        assert(purchase);
        if (purchase.session_ref !== acquisition.session_ref) {
          const visit = evidence.find(row => row.dataset_type === 'T17' && row.session_ref === purchase.session_ref);
          assert.equal(visit.traffic_medium, 'direct');
          assert(visit.related_record_ids.includes(acquisition.record_id));
          assert.equal(visit.user_pseudo_ref, acquisition.user_pseudo_ref);
        }
      }
    }
  }
});

test('separate return session identity, source references and actual session duration are required', () => {
  const profile = profiles[0], report = reports[0];
  const byId = new Map(report.records.map(row => [row.record_id, row]));
  const order = report.records.find(row => row.dataset_type === 'T19' && report.records.some(event => event.dataset_type === 'T18' && event.event_name === 'purchase' && event.transaction_ref === row.transaction_ref && event.session_ref !== byId.get(row.acquisition_ref).session_ref));
  const purchase = report.records.find(row => row.dataset_type === 'T18' && row.event_name === 'purchase' && row.transaction_ref === order.transaction_ref);
  const returned = report.records.find(row => row.dataset_type === 'T17' && row.session_ref === purchase.session_ref);
  const changed = (id, patch) => records.map(row => row.record_id === id ? {...row, ...patch} : row);
  assert.throws(() => analyze(profile, changed(order.record_id, {customer_pseudo_ref: null})), /order_visitor_mismatch/);
  assert.throws(() => analyze(profile, changed(purchase.record_id, {related_record_ids: purchase.related_record_ids.filter(id => id !== returned.record_id)})), /purchase_return_reference_missing/);
  assert.throws(() => analyze(profile, changed(returned.record_id, {event_time: new Date(Date.parse(purchase.event_time) - 5 * 3600000).toISOString()})), /purchase_session_too_long/);
});

test('immature seven-day attribution windows are explicit and do not claim completed net results', () => {
  for (const profile of profiles) {
    const report = analyze(profile, records, profile.observed.end + 'T00:00:00+09:00');
    assert.equal(report.status, 'partial');
    assert(report.gaps.includes('attribution_window_not_mature'));
    assert(report.periods.every(period => period.total.netRoas === null));
  }
});

test('diverse review output has separate return counts and no automatically selected shipping fix', () => {
  for (const report of reports) {
    const markdown = renderRoasReview(report);
    assert(markdown.includes('최초 유료 세션 내 구매'));
    assert(markdown.includes('후속 직접 재방문 구매'));
    assert(markdown.includes('안내 수정 후보 없음'));
    assert(!markdown.includes('수정 문구 초안:'));
    assert(!markdown.includes('R001은 결제 시작 이후'));
    const summary = renderInvestigationSummary(report, {channel: 'social', device: 'desktop', stage: 'checkout', hypothesis: 'none', rationale: '', condition: ''});
    assert(summary.includes('PC 후속 직접 재방문 구매, 주문'));
    assert(summary.includes('마지막 유료 접점 날짜'));
    assert(!summary.includes('이 R001은'));
  }
});
