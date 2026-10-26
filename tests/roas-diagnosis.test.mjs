import test from 'node:test';
import assert from 'node:assert/strict';
import {roasScreenData, loadCurrentData} from '../scripts/current-data.mjs';
import {channelContributions, deviceFunnels, deviceEvidence, feedbackComparison, stageDiagnosis} from '../shared/roas-diagnosis.mjs';

const report = roasScreenData();
const close = (actual, expected) => assert(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);

test('channel contributions reconcile to the existing net bridge and full change', () => {
  const rows = channelContributions(report.periods);
  close(rows.reduce((sum, row) => sum + row.withinChange, 0), report.roasBridge.net.withinChannelChange);
  close(rows.reduce((sum, row) => sum + row.mixChange, 0), report.roasBridge.net.spendMixChange);
  const delta = report.periods[1].total.netRoas - report.periods[0].total.netRoas;
  close(rows.reduce((sum, row) => sum + row.withinChange + row.mixChange, 0), delta);
  close(rows.find(row => row.channel === 'social').withinChange, -1.1618036088642631);
  close(rows.find(row => row.channel === 'social').shareOfDecline, -1.1618036088642631 / delta);
});

test('device session funnels reconcile to campaign totals and approved T14 purchase partitions', () => {
  for (const channel of ['search', 'social']) {
    const devices = deviceFunnels(report.records, report, channel);
    for (const [index, key] of ['before', 'after'].entries()) {
      const period = report.periods[index];
      const campaign = period.channels.find(row => row.channel === channel);
      const ads = report.records.filter(row => row.dataset_type === 'T14' && row.campaign_ref === campaign.campaignId && row.period.start >= period.period.start && row.period.start < period.period.end);
      assert.equal(ads.length, 28);
      for (const row of devices) {
        assert.equal(row[key].paidSessions, 140);
        const partition = ads.filter(ad => ad.breakdown_dimensions.some(dimension => dimension.name === 'device' && dimension.value === row.device));
        assert.equal(partition.length, 14);
        assert.equal(row[key].purchase, partition.reduce((sum, ad) => sum + ad.metrics.attributed_conversions, 0));
      }
      assert.equal(devices.reduce((sum, row) => sum + row[key].paidSessions, 0), campaign.purchaseCohort.paidSessions);
      for (const stage of ['view_item', 'add_to_cart', 'begin_checkout', 'purchase']) {
        assert.equal(devices.reduce((sum, row) => sum + row[key][stage], 0), campaign.purchaseCohort.funnel[stage]);
      }
      for (const field of ['spend', 'attributed_value', 'attributed_conversions']) {
        const total = ads.reduce((sum, ad) => sum + Number(ad.metrics[field]?.amount ?? ad.metrics[field]), 0);
        assert.equal(total, Number(campaign.reported[{spend: 'spend', attributed_value: 'attributedRevenue', attributed_conversions: 'purchases'}[field]]));
      }
    }
  }
});

test('social checkout narrowing retains both denominators and equal purchase-count losses', () => {
  const [mobile, desktop] = deviceFunnels(report.records, report, 'social');
  assert.equal(mobile.device, 'mobile');
  assert.equal(desktop.device, 'desktop');
  assert.deepEqual([mobile.before.begin_checkout, mobile.before.purchase, mobile.after.begin_checkout, mobile.after.purchase], [42, 24, 42, 10]);
  assert.deepEqual([desktop.before.begin_checkout, desktop.before.purchase, desktop.after.begin_checkout, desktop.after.purchase], [28, 18, 28, 4]);
  assert.equal(mobile.before.purchase - mobile.after.purchase, desktop.before.purchase - desktop.after.purchase);
  const all = deviceFunnels(report.records, report);
  const search = deviceFunnels(report.records, report, 'search');
  for (const [index, row] of all.entries()) for (const period of ['before', 'after']) for (const stage of Object.keys(row[period])) {
    assert.equal(row[period][stage], search[index][period][stage] + [mobile, desktop][index][period][stage]);
  }
});

test('feedback compares periods, preserves overlapping topics and distinguishes actual order links', () => {
  const rows = feedbackComparison(report.records, report);
  const shipping = rows.find(row => row.topic === 'shipping');
  const checkout = rows.find(row => row.topic === 'checkout');
  for (const row of rows) {
    assert.equal(row.before.total, 28);
    assert.equal(row.after.total, 28);
    assert.equal(row.before.count, 0);
    assert.equal(row.before.orderLinked, 0);
    assert.equal(row.before.recordIds.length, row.before.count);
    assert.equal(row.after.recordIds.length, row.after.count);
  }
  assert.equal(shipping.after.count, 23);
  assert.equal(shipping.after.orderLinked, 16);
  assert.equal(checkout.after.count, 18);
  assert.equal(checkout.after.orderLinked, 12);
  assert(shipping.after.recordIds.some(id => checkout.after.recordIds.includes(id)));
  assert(shipping.after.orderLinked < shipping.after.count);
  const {catalog} = loadCurrentData();
  assert.deepEqual(feedbackComparison(catalog.records, report), rows);
});

test('device evidence isolates approved ad partitions and their visit, event and order chains', () => {
  const {catalog} = loadCurrentData();
  for (const channel of ['search', 'social']) for (const device of ['mobile', 'desktop']) {
    const rows = deviceEvidence(catalog.records, report, channel, device);
    assert.deepEqual(rows, deviceEvidence(report.records, report, channel, device));
    const visits = rows.filter(row => row.dataset_type === 'T17');
    assert.equal(visits.length, 280);
    assert(visits.every(row => row.traffic_medium === 'paid' && row.traffic_source === channel && row.device === device));
    const sessionIds = new Set(visits.map(row => row.session_ref));
    const visitIds = new Set(visits.map(row => row.record_id));
    const ads = rows.filter(row => row.dataset_type === 'T14');
    assert.equal(ads.length, 28);
    const adIds = new Set(report.periods.flatMap(period => period.channels.find(row => row.channel === channel).evidence.adRecordIds));
    assert(ads.every(row => adIds.has(row.parent_report_ref) && row.campaign_ref === visits[0].utm_campaign && row.breakdown_dimensions.some(dimension => dimension.name === 'device' && dimension.value === device)));
    const events = rows.filter(row => row.dataset_type === 'T18');
    assert(events.every(row => row.event_name !== 'refund' && sessionIds.has(row.session_ref) && row.campaign_ref === visits[0].utm_campaign));
    const orders = rows.filter(row => row.dataset_type === 'T19');
    assert(orders.every(row => visitIds.has(row.acquisition_ref)));
    assert.equal(events.filter(row => row.event_name === 'purchase').length, orders.length);
    assert.equal(ads.reduce((sum, row) => sum + row.metrics.attributed_conversions, 0), orders.length);
    const funnels = deviceFunnels(report.records, report, channel).find(row => row.device === device);
    for (const [index, periodKey] of ['before', 'after'].entries()) {
      const period = report.periods[index].period;
      const inPeriod = time => time.slice(0, 10) >= period.start && time.slice(0, 10) < period.end;
      for (const stage of ['view_item', 'add_to_cart', 'begin_checkout', 'purchase']) {
        assert.equal(events.filter(row => row.event_name === stage && inPeriod(row.event_time)).length, funnels[periodKey][stage]);
      }
    }
    for (const row of rows) {
      const time = row.event_time || row.ordered_at || row.period.start;
      assert(report.periods.some(({period}) => time.slice(0, 10) >= period.start && time.slice(0, 10) < period.end));
      assert(Date.parse(time) <= Date.parse(report.asOf));
      assert(report.records.includes(row) || report.records.some(source => source.record_id === row.record_id));
    }
    const early = {...report, asOf: report.periods[1].period.start + 'T00:00:00+09:00'};
    const earlyRows = deviceEvidence(report.records, early, channel, device);
    assert(earlyRows.filter(row => ['T17', 'T18', 'T19'].includes(row.dataset_type)).every(row => Date.parse(row.event_time || row.ordered_at) <= Date.parse(early.asOf)));
  }
  assert.deepEqual(deviceEvidence(report.records, report, 'unknown', 'mobile'), []);
});

test('all-channel device evidence reconciles to both campaigns and device funnel counts', () => {
  const funnels = deviceFunnels(report.records, report);
  for (const device of ['mobile', 'desktop']) {
    const rows = deviceEvidence(report.records, report, 'all', device);
    const parts = ['search', 'social'].flatMap(channel => deviceEvidence(report.records, report, channel, device));
    assert.deepEqual(new Set(rows.map(row => row.record_id)), new Set(parts.map(row => row.record_id)));
    assert.equal(rows.length, parts.length);
    assert.equal(rows.filter(row => row.dataset_type === 'T14').length, 56);
    assert.equal(rows.filter(row => row.dataset_type === 'T17').length, 560);
    const funnel = funnels.find(row => row.device === device);
    for (const [index, key] of ['before', 'after'].entries()) {
      const period = report.periods[index].period;
      const inPeriod = time => time.slice(0, 10) >= period.start && time.slice(0, 10) < period.end;
      assert.equal(rows.filter(row => row.dataset_type === 'T17' && inPeriod(row.event_time)).length, funnel[key].paidSessions);
      for (const stage of ['view_item', 'add_to_cart', 'begin_checkout', 'purchase']) {
        assert.equal(rows.filter(row => row.dataset_type === 'T18' && row.event_name === stage && inPeriod(row.event_time)).length, funnel[key][stage]);
      }
      const orders = rows.filter(row => row.dataset_type === 'T19' && inPeriod(row.ordered_at));
      assert.equal(orders.length, funnel[key].purchase);
      assert.equal(rows.filter(row => row.dataset_type === 'T14' && inPeriod(row.period.start)).reduce((sum, row) => sum + row.metrics.attributed_conversions, 0), orders.length);
    }
  }
});

test('stage figures reconcile to validated report amounts and original order cohorts', () => {
  for (const channel of ['all', 'search', 'social']) {
    const diagnosis = stageDiagnosis(report.records, report, channel);
    for (const [index, key] of ['before', 'after'].entries()) {
      const actual = diagnosis[key], expected = report.periods[index].channels.filter(row => channel === 'all' || row.channel === channel);
      const sum = field => expected.reduce((n, row) => n + Number(row.reported[field]), 0);
      const gross = expected.reduce((n, row) => n + Number(row.purchaseCohort.discountedProductRevenue), 0);
      const reversals = expected.reduce((n, row) => n + Number(row.purchaseCohort.confirmedReversals), 0);
      assert.deepEqual(actual.unavailable, []);
      assert.equal(actual.cost.spend, sum('spend'));
      assert.equal(actual.cost.clicks, sum('clicks'));
      close(actual.cost.ctr, 0.04);
      close(actual.cost.cpc, sum('spend') / sum('clicks'));
      assert.equal(actual.revenue.orders, sum('purchases'));
      assert.equal(actual.revenue.units, actual.revenue.orders);
      assert.equal(actual.revenue.unitPrice, 20000);
      close(actual.revenue.revenuePerOrder, gross / actual.revenue.orders);
      assert(Math.abs(actual.revenue.discountPerOrder - (20000 - actual.revenue.revenuePerOrder)) < 1e-8);
      assert.equal(actual.refund.revenueBeforeAdjustments, gross);
      assert.equal(actual.refund.adjustments, reversals);
      close(actual.refund.adjustmentRate, reversals / gross);
      assert(actual.evidenceIds.cost.every(id => report.records.find(row => row.record_id === id).dataset_type === 'T13'));
    }
  }
});

test('device figures use disjoint partitions and reconcile monetary adjustments without double counting', () => {
  for (const channel of ['all', 'search', 'social']) {
    const all = stageDiagnosis(report.records, report, channel), mobile = stageDiagnosis(report.records, report, channel, 'mobile'), desktop = stageDiagnosis(report.records, report, channel, 'desktop');
    for (const key of ['before', 'after']) {
      for (const [section, fields] of Object.entries({cost:['impressions', 'clicks', 'spend'], revenue:['orders', 'units'], refund:['revenueBeforeAdjustments', 'adjustments']})) {
        for (const field of fields) close(mobile[key][section][field] + desktop[key][section][field], all[key][section][field]);
      }
      for (const [device, result] of [['mobile', mobile], ['desktop', desktop]]) {
        assert.deepEqual(result[key].unavailable, []);
        const source = result[key].evidenceIds.cost.map(id => report.records.find(row => row.record_id === id));
        assert(source.every(row => row.dataset_type === 'T14' && row.breakdown_dimensions[0].value === device));
        assert.equal(result[key].revenue.orders, result[key].evidenceIds.revenue.length);
      }
    }
  }
  assert.equal(stageDiagnosis(report.records, report, 'social').after.refund.adjustments, 0);
  // Existing fixture has two partial refunds on one order, plus nonmonetary return aliases and pending cases.
  assert.equal(stageDiagnosis(report.records, report).before.refund.adjustments, 83000);
  assert.equal(stageDiagnosis(report.records, report).after.refund.adjustments, 71500);
  const early = {...report, asOf:'2026-08-31T00:00:00+09:00'};
  assert(stageDiagnosis(report.records, early).after.refund.adjustments < 71500);
});

test('missing device partition or order sources are explicit instead of borrowing campaign totals', () => {
  const absent = report.records.find(row => row.dataset_type === 'T14' && row.breakdown_dimensions[0].value === 'mobile');
  const partial = stageDiagnosis(report.records.filter(row => row !== absent), report, 'all', 'mobile');
  assert.equal(partial.before.cost.spend, null);
  assert(partial.before.unavailable.length);
  const order = report.records.find(row => row.dataset_type === 'T19');
  const missingOrder = stageDiagnosis(report.records.filter(row => row !== order), report);
  assert.equal(missingOrder.before.revenue.orders, null);
  assert.equal(missingOrder.before.refund.adjustments, null);
  const unknown = stageDiagnosis(report.records, report, 'unknown');
  assert.equal(unknown.before.cost.spend, null);
  assert.equal(unknown.before.revenue.orders, null);
  const {catalog} = loadCurrentData();
  assert.deepEqual(stageDiagnosis(catalog.records, report), stageDiagnosis(report.records, report));
});
