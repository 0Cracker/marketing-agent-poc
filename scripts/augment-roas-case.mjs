import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {loadCurrentData, dataDirectory, sha256} from './current-data.mjs';
import {businessKey} from './data-business-keys.mjs';
import {validRecord} from '../docs/research/marketing-ontology/batches/D007/catalog.mjs';

export const spec = {scenario_id: 'R001-roas-decline', scope_id: 'R001-KR-paid-p1a', seed: 'approved-roas-20261021-1',
  counts: {T12: 2, T13: 56, T14: 112, T16: 2, T17: 1120, T18: 1980, T19: 126, T20: 16, T24: 28, T26: 28},
  start: '2026-08-03', end: '2026-08-31', product: 'P1A', currency: 'KRW',
  revenue_basis: 'discounted_product_ex_tax_shipping', adjustment_links: 'financial_representative'};
export const specHash = sha256(JSON.stringify(spec));
const evidenceDirectory = path.resolve(import.meta.dirname, '../evidence/roas-decision-flow-20261021');
const jsonl = rows => rows.map(row => JSON.stringify(row)).join('\n') + '\n';
const readLines = file => fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const cash = value => ({amount: Number(value).toFixed(2), currency: 'KRW'});
const plusDays = (day, n) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const stamp = (day, minute = 0, hour = 9) => `${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+09:00`;
const period = (start, end = plusDays(start, 1), grain = 'day') => ({start, end_exclusive: end, timezone: 'Asia/Seoul', grain});
export function registerDefinitions(metadata, records, withinWindow = false) {
  const fields = {campaign_id: 'Campaign', creative_id: 'Creative', session_ref: 'Session', transaction_ref: 'Transaction',
    event_id: 'Event', site_ref: 'Site', page_ref: 'LandingPage', landing_ref: 'LandingPage', seller_ref: 'Seller',
    order_id: 'Order', conversion_definition_ref: 'ConversionDefinition', report_definition_ref: 'ReportDefinition'};
  const existing = new Set(metadata.definitions.map(item => item.id));
  for (const record of records) for (const [field, kind] of Object.entries(fields)) {
    const id = record[field];
    if (!id || existing.has(id)) continue;
    const definition = kind === 'ConversionDefinition'
      ? (withinWindow ? 'Original paid purchase count and discounted product revenue before reversals, excluding tax and shipping; last paid click, seven days, paid-touch date; direct-return purchases stay linked to their original paid touch.' : 'Original paid purchase count and discounted product revenue before reversals, excluding tax and shipping; last paid click, seven days, paid-touch date; this sample has same-day purchases.')
      : kind === 'ReportDefinition' ? (withinWindow ? 'Disjoint mobile and desktop partitions of one declared daily paid-touch campaign report.' : 'Disjoint mobile and desktop partitions of one R001 daily campaign report.')
      : `${kind} identifier in the approved independent ${withinWindow ? record.scenario_id : 'R001'} workflow sample.`;
    metadata.definitions.push({id, kind, definition, version: withinWindow ? record.scenario_id+'-1' : 'R001-1', is_synthetic: true, available_at: withinWindow ? '2026-10-22T00:00:00+09:00' : '2026-10-21T00:00:00+09:00'});
    existing.add(id);
  }
}
function refreshManifestHash(manifest) {
  manifest.data_sha256 = sha256(JSON.stringify({contract: manifest.contract, screen_contract: manifest.screen_contract, schema_sha256: manifest.schema_sha256,
    source_created_at: manifest.source_created_at, scope_ids: manifest.scope_ids, period: manifest.period, files: manifest.files.map(({file, sha256}) => ({file, sha256})), metadata: manifest.metadata}));
}

// No generator runs on import. --write checks the recorded human approval first.
export function generateRoasRecords() {
  const rows = [], counters = {};
  const add = (type, payload, temporal = {}) => {
    const ordinal = (counters[type] || 0) + 1;
    counters[type] = ordinal;
    const record = {record_id: `R001-${type}-${String(ordinal).padStart(5, '0')}`, dataset_type: type,
      scope_id: spec.scope_id, scenario_id: spec.scenario_id, is_synthetic: true, value_origin: 'simulation',
      provenance: {system: spec.seed, collection_method: 'synthetic_generation', source_record_key: `R001-${type}-${ordinal}`,
        artifact_ref: 'scripts/augment-roas-case.mjs', access_class: 'internal',
        documentation_refs: ['docs/design/roas-decision-flow.md', 'docs/research/marketing-ontology/data-proposal.md']},
      quality: {availability: 'available', coverage: 'Approved independent paid-traffic workflow sample; not observed marketing outcomes', is_partial: true},
      temporal: {time_kind: 'instant', source_grain: 'instant', series_role: 'detail', calendar_id: 'Gregorian',
        reporting_timezone: 'Asia/Seoul', coverage_kind: 'sample', available_at: '2026-10-21T00:00:00+09:00', revision: 0, ...temporal}, ...payload};
    rows.push(record);
    return record;
  };
  const interval = grain => ({time_kind: 'interval', source_grain: grain, period_field: 'period'});
  const campaigns = ['search', 'social'].map(channel => add('T12', {
    platform: 'synthetic_' + channel, account_id: 'R001-Account-KR', campaign_id: 'R001-Campaign-' + channel,
    objective: 'purchases', status: 'active', period: period(spec.start, spec.end, 'custom'), product_refs: ['P1A'], channel,
    budget_amount: cash(30000), budget_period: 'daily', bidding_strategy: 'synthetic_manual',
    target_definition: 'KR P1A paid-traffic sample only; budget is a simulated setting, not a recommended amount', landing_ref: 'R001-Landing-P1A'
  }, interval('custom')));
  campaigns.forEach(campaign => add('T16', {creative_id: 'R001-Creative-' + campaign.channel, version: '1', product_refs: ['P1A'],
    format: 'text', language: 'ko', message_text: '제품의 용량과 사용 방법을 확인하세요. 출고 예정일과 배송 조건은 상품 페이지에서 확인할 수 있습니다.',
    valid_from: stamp(spec.start, 0, 0), valid_to_exclusive: stamp(spec.end, 0, 0), related_record_ids: [campaign.record_id]},
  {time_kind: 'validity', timestamp_field: 'valid_from'}));
  const orders = [];
  const patterns = [[2, 3, 4, 2, 4, 3, 3], [1, 2, 3, 1, 3, 2, 2], [0, 1, 2, 0, 2, 1, 1]];
  for (let dayIndex = 0; dayIndex < 28; dayIndex++) {
    const day = plusDays(spec.start, dayIndex);
    for (const [channelIndex, campaign] of campaigns.entries()) {
      const count = patterns[dayIndex < 14 ? 0 : channelIndex === 0 ? 1 : 2][dayIndex % 7];
      const sold = [];
      for (let j = 0; j < 20; j++) {
        const key = `${dayIndex}-${channelIndex}-${j}`, session = 'R001-Session-' + key, device = j % 2 ? 'desktop' : 'mobile';
        const visit = add('T17', {event_id: 'R001-Visit-' + key, event_time: stamp(day, j * 2), event_name: 'page_view',
          site_ref: 'R001-Site-KR', session_ref: session, user_pseudo_ref: 'R001-Visitor-' + key, page_ref: 'R001-Landing-P1A', device,
          traffic_source: campaign.channel, traffic_medium: 'paid', utm_campaign: campaign.campaign_id, click_id: 'R001-Click-' + key,
          consent_state: 'granted', related_record_ids: [campaign.record_id]}, {timestamp_field: 'event_time'});
        const commerce = (name, minute, extra = {}) => add('T18', {event_id: 'R001-' + name + '-' + key, item_index: 0,
          event_time: stamp(day, j * 2 + minute), event_name: name, variant_ref: 'D005-V-P1A', quantity: 1, unit_price: cash(20000),
          session_ref: session, campaign_ref: campaign.campaign_id, measurement_basis: 'item_list_price_ex_tax; final_discounted_revenue_from_order_ledger',
          related_record_ids: [visit.record_id], ...extra}, {timestamp_field: 'event_time'});
        commerce('view_item', 1);
        if (j < 8) commerce('add_to_cart', 2);
        if (j < 5) commerce('begin_checkout', 3);
        if (j < count) {
          const net = 20000 - (1000 + ((dayIndex + j + channelIndex) % 3) * 500 + (dayIndex >= 14 ? 500 : 0));
          const number = orders.length, transaction = 'R001-Transaction-' + number;
          const order = add('T19', {order_id: 'R001-Order-' + number, line_id: 'R001-Line-' + number, variant_ref: 'D005-V-P1A',
            seller_ref: 'R001-Seller-KR', ordered_at: stamp(day, j * 2 + 4), customer_pseudo_ref: 'R001-Visitor-' + key, quantity: 1,
            unit_price: cash(20000), line_discount: cash(20000 - net), line_tax: cash(net / 10), line_gross_total: cash(net * 1.1),
            financial_status: 'paid', fulfilment_status: 'shipped', transaction_ref: transaction, acquisition_ref: visit.record_id,
            related_record_ids: [visit.record_id]}, {timestamp_field: 'ordered_at'});
          orders.push(order);
          sold.push({order, net, device});
          commerce('purchase', 4, {transaction_ref: transaction, related_record_ids: [visit.record_id, order.record_id]});
        }
      }
      const clicks = 25 + (dayIndex * 7 + channelIndex * 11) % 19;
      const cpc = (channelIndex === 0 ? 550 : 400) + (dayIndex >= 14 ? 50 : 0) + dayIndex % 5 * 10;
      const spend = clicks * cpc, value = sold.reduce((sum, item) => sum + item.net, 0);
      const parent = add('T13', {platform: campaign.platform, account_id: campaign.account_id, campaign_ref: campaign.campaign_id,
        entity_level: 'campaign', entity_id: campaign.campaign_id, period: period(day),
        metrics: {impressions: clicks * 25, clicks, spend: cash(spend), attributed_conversions: count, attributed_value: cash(value)},
        report_state: 'final', conversion_definition_ref: 'R001-PurchaseDefinition', attribution_model: 'last_click', attribution_window: '7_days',
        related_record_ids: [campaign.record_id]}, interval('day'));
      for (const [deviceIndex, device] of ['mobile', 'desktop'].entries()) {
        const fraction = deviceIndex === 0 ? .6 : .4;
        const mobileClicks = Math.floor(clicks * .6), mobileSpend = Math.floor(spend * .6);
        const deviceOrders = sold.filter(item => item.device === device);
        add('T14', {campaign_ref: campaign.campaign_id, period: period(day), breakdown_dimensions: [{name: 'device', value: device}],
          report_definition_ref: 'R001-DevicePartition', audience_basis: 'observed_aggregate', parent_report_ref: parent.record_id,
          metrics: {impressions: Math.round(clicks * 25 * fraction), clicks: deviceIndex === 0 ? mobileClicks : clicks - mobileClicks,
            spend: cash(deviceIndex === 0 ? mobileSpend : spend - mobileSpend), attributed_conversions: deviceOrders.length,
            attributed_value: cash(deviceOrders.reduce((sum, item) => sum + item.net, 0))}, related_record_ids: [parent.record_id]}, interval('day'));
      }
    }
    const sameDay = orders.filter(order => order.ordered_at.startsWith(day));
    const order = sameDay.at(-1);
    const feedback = dayIndex < 14
      ? ['용량 안내를 보고 구매했습니다. 사용 방법 설명이 도움이 됐습니다.', '향의 강도가 예상과 달랐습니다. 다음 구매 전 비교해 보겠습니다.'][dayIndex % 2]
      : ['출고 예정일을 찾기 어려웠고 배송 안내를 더 자세히 보고 싶었습니다.', '결제 단계에서 배송비를 알게 되어 추가 비용 안내가 아쉬웠습니다.', '제품 사용감은 만족했습니다. 안내된 사용 방법대로 사용했습니다.'][dayIndex % 3];
    add('T24', {review_id: 'R001-Review-' + dayIndex, review_subject_type: 'product', subject_ref: 'P1A', written_at: stamp(day, 0, 16),
      language: 'ko', body_text: feedback, rating_value: dayIndex < 14 ? 4 : dayIndex % 3 === 2 ? 4 : 2, rating_scale_max: 5,
      verified_purchase: dayIndex % 4 === 0 ? null : true, invited_review: null,
      related_record_ids: dayIndex % 4 === 0 ? [] : [order.record_id]}, {timestamp_field: 'written_at'});
    const linked = dayIndex % 3 !== 0;
    add('T26', {ticket_id: 'R001-Ticket-' + dayIndex, created_at: stamp(day, 0, 15), channel: 'email',
      subject: dayIndex < 14 ? '사용 방법 문의' : dayIndex % 2 ? '배송 일정 문의' : '결제 금액 문의',
      message_text: dayIndex < 14 ? '상품 페이지의 사용 방법과 1회 권장 사용량을 확인하고 싶습니다.'
        : dayIndex % 2 ? '출고 예정일과 배송 소요 조건을 결제 전에 확인하기 어려웠습니다.' : '배송비와 할인 조건을 결제 전에 한눈에 확인하고 싶습니다.',
      status: 'open', product_ref: 'P1A', link_status: linked ? 'confirmed' : 'unlinked',
      ...(linked ? {order_ref: order.order_id, related_record_ids: [order.record_id]} : {})}, {timestamp_field: 'created_at'});
  }
  const adjust = (index, kind, status, divisor = 1, delay = 1, representative) => {
    const order = orders[index], day = order.ordered_at.slice(0, 10);
    const net = Number(order.unit_price.amount) - Number(order.line_discount.amount);
    const monetary = kind !== 'return';
    const row = add('T20', {adjustment_id: `R001-Adjustment-${(counters.T20 || 0) + 1}`, adjustment_kind: kind,
      order_ref: order.order_id, order_line_ref: order.line_id, requested_at: stamp(plusDays(day, delay), 0, 12),
      ...(status === 'completed' ? {processed_at: stamp(plusDays(day, delay), 0, 13)} : {}), quantity: 1,
      ...(monetary ? {refund_amount: cash(net / divisor)} : {}), reason_code: 'synthetic_workflow_case',
      reason_text: '가상 상품금액 조정; 세금과 배송비 제외. 대기는 요청액이며 확정 차감이 아님.', status, restocked: null,
      related_record_ids: [order.record_id, ...(representative ? [representative.record_id] : [])]}, {timestamp_field: 'requested_at'});
    if (status === 'completed' && monetary) order.financial_status = divisor === 1 ? 'refunded' : 'partially_refunded';
    if (kind === 'refund' && status === 'completed') {
      const purchase = rows.find(item => item.dataset_type === 'T18' && item.event_name === 'purchase' && item.transaction_ref === order.transaction_ref);
      add('T18', {event_id: 'R001-refund-' + row.adjustment_id, item_index: 0, event_time: row.processed_at, event_name: 'refund',
        variant_ref: order.variant_ref, quantity: 1, unit_price: cash(net / divisor), session_ref: null, transaction_ref: order.transaction_ref,
        campaign_ref: purchase.campaign_ref, measurement_basis: 'confirmed_product_refund_ex_tax_shipping', related_record_ids: [order.record_id, row.record_id]},
      {timestamp_field: 'event_time'});
    }
    return row;
  };
  [0, 12, 60, 100].forEach(index => adjust(index, 'cancel', 'completed'));
  [20, 110].forEach(index => adjust(index, 'cancel', 'pending'));
  const refunds = [adjust(3, 'refund', 'completed', 4), adjust(3, 'refund', 'completed', 4, 2),
    ...[61, 90, 115, 120].map((index, i) => adjust(index, 'refund', 'completed', 1, i === 3 ? 8 : 2))];
  adjust(61, 'return', 'completed', 1, 2, refunds[2]);
  adjust(115, 'return', 'completed', 1, 2, refunds[4]);
  [21, 111].forEach(index => adjust(index, 'refund', 'pending', 2));
  assert.deepEqual(counters, Object.fromEntries(Object.keys(counters).map(type => [type, spec.counts[type]])));
  assert.equal(rows.length, 3470);
  for (const row of rows) {const result = validRecord(row); assert(result.conforming, row.record_id + ': ' + JSON.stringify(result.errors));}
  return rows;
}

export function augmentRoasCase() {
  const approval = JSON.parse(fs.readFileSync(path.join(evidenceDirectory, 'generation-approval.json')));
  assert.equal(approval.status, 'approved');
  assert.equal(approval.spec_sha256, specHash, 'approval_spec_changed');
  const {catalog, manifest} = loadCurrentData();
  const generated = generateRoasRecords();
  const installed = catalog.records.filter(row => row.scenario_id === spec.scenario_id);
  if (installed.length) {
    assert.deepEqual(installed.sort((a, b) => a.record_id.localeCompare(b.record_id)), generated.toSorted((a, b) => a.record_id.localeCompare(b.record_id)), 'installed_scenario_differs');
    const before = sha256(JSON.stringify(catalog.definitions));
    registerDefinitions(catalog.definitions, generated);
    if (sha256(JSON.stringify(catalog.definitions)) !== before) {
      const previousHash = manifest.data_sha256;
      fs.writeFileSync(path.join(dataDirectory, 'definitions.json'), JSON.stringify(catalog.definitions, null, 2) + '\n');
      manifest.metadata.find(file => file.file === 'definitions.json').sha256 = sha256(fs.readFileSync(path.join(dataDirectory, 'definitions.json')));
      refreshManifestHash(manifest);
      fs.writeFileSync(path.join(dataDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
      fs.writeFileSync(path.join(evidenceDirectory, 'metadata-completion.json'), JSON.stringify({previousHash, dataHash: manifest.data_sha256, newMarketingRows: 0,
        reason: 'Register identifiers and revenue definitions for the already approved generated records; original definitions preserved'}, null, 2) + '\n', {flag: 'wx'});
    }
    return {unchanged: true, newRows: 0, scenarioRows: installed.length, dataHash: manifest.data_sha256};
  }
  assert.equal(manifest.data_sha256, approval.baseline_data_sha256, 'baseline_changed');
  const before = Object.fromEntries([...manifest.files, ...manifest.metadata].map(file => [file.file, sha256(fs.readFileSync(path.join(dataDirectory, file.file)))]));
  const existing = new Set(catalog.records.map(row => row.record_id));
  assert(generated.every(row => !existing.has(row.record_id)), 'record_id_conflict');
  assert.equal(new Set([...catalog.records, ...generated].map(businessKey)).size, catalog.records.length + generated.length);
  const byId = new Set([...catalog.records, ...generated].map(row => row.record_id));
  for (const row of generated) for (const ref of row.related_record_ids || []) assert(byId.has(ref), 'missing_reference');
  const inventoryPath = path.join(dataDirectory, 'archive/source-inventory.json');
  const inventory = JSON.parse(fs.readFileSync(inventoryPath));
  const provenance = readLines(path.join(dataDirectory, 'provenance.jsonl'));
  const migration = readLines(path.join(dataDirectory, 'migration-map.jsonl'));
  for (const file of manifest.files) {
    const added = generated.filter(row => row.dataset_type === file.type);
    if (!added.length) continue;
    const bytes = Buffer.from(jsonl(added)), hash = sha256(bytes), archive = 'archive/files/' + hash + '.jsonl';
    const archivePath = path.join(dataDirectory, archive);
    if (fs.existsSync(archivePath)) assert.equal(sha256(fs.readFileSync(archivePath)), hash);
    else fs.writeFileSync(archivePath, bytes, {flag: 'wx'});
    const sourcePath = 'data/' + archive;
    inventory.push({repository: 'marketing-agent-poc', path: sourcePath, sha256: hash, bytes: bytes.length, rows: added.length, kind: 'original', archive});
    added.forEach((row, i) => {
      const entry = {source_key: 'R001/' + row.record_id, record_id: row.record_id, type: row.dataset_type, decision: 'active',
        reason: 'Explicitly approved independent ROAS workflow sample; excluded from default comparison scope', active_id: row.record_id,
        replacement_id: null, source_path: sourcePath, line: i + 1, source_sha256: hash, record_sha256: sha256(JSON.stringify(row)),
        business_key_sha256: sha256(businessKey(row))};
      migration.push(entry);
      provenance.push({...entry, file: file.file, archive, source_record_sha256: entry.record_sha256, transformation: 'Approved synthetic row, unchanged from immutable R001 snapshot'});
    });
    const original = fs.readFileSync(path.join(dataDirectory, file.file));
    const combined = Buffer.concat([original, ...(original.at(-1) === 10 ? [] : [Buffer.from('\n')]), bytes]);
    fs.writeFileSync(path.join(dataDirectory, file.file), combined);
    file.rows += added.length; file.bytes = combined.length; file.sha256 = sha256(combined);
  }
  const profile = {scenario_id: spec.scenario_id, product_id: spec.product, currency: spec.currency, scope_ids: {KR: [spec.scope_id]},
    baseline: {start: spec.start, end: '2026-08-17'}, observed: {start: '2026-08-17', end: spec.end},
    revenue_basis: spec.revenue_basis, adjustment_links: spec.adjustment_links, attribution_date_basis: 'paid_touch_date', purchase_timing: 'same_day',
    attribution_model: 'last_click', attribution_window: '7_days', default_as_of: '2026-09-15T00:00:00+09:00',
    coverage: 'Complete declared paid-session sample, not all site traffic', counts: spec.counts, approval_spec_sha256: specHash};
  catalog.definitions.scenario_profiles = [...(catalog.definitions.scenario_profiles || []), profile];
  registerDefinitions(catalog.definitions, generated);
  fs.writeFileSync(path.join(dataDirectory, 'definitions.json'), JSON.stringify(catalog.definitions, null, 2) + '\n');
  for (const file of manifest.metadata) file.sha256 = sha256(fs.readFileSync(path.join(dataDirectory, file.file)));
  fs.writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2) + '\n');
  fs.writeFileSync(path.join(dataDirectory, 'provenance.jsonl'), jsonl(provenance));
  fs.writeFileSync(path.join(dataDirectory, 'migration-map.jsonl'), jsonl(migration));
  manifest.rows += generated.length; manifest.preserved_rows += generated.length; manifest.source_files += Object.keys(spec.counts).length;
  manifest.decisions.active += generated.length;
  manifest.policy += ' R001 is an independent approved workflow sample; scope_ids remains the default D008 selection. Explicit R001 selection is registered in definitions.json scenario_profiles.';
  refreshManifestHash(manifest);
  fs.writeFileSync(path.join(dataDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  const loaded = loadCurrentData();
  assert.deepEqual(loaded.catalog.records.filter(row => row.scenario_id !== spec.scenario_id), catalog.records, 'existing_rows_changed');
  const report = {approved: true, spec_sha256: specHash, newRows: generated.length, counts: spec.counts, existingRowsUnchanged: catalog.records.length,
    beforeFiles: before, dataHash: manifest.data_sha256, sourceSnapshots: Object.keys(spec.counts).length, generatedAt: '2026-10-21',
    externalModelCalls: 0, realAdsCalls: 0};
  fs.writeFileSync(path.join(evidenceDirectory, 'generation.json'), JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv.includes('--write')) throw Error('Use --write only after the recorded generation approval');
  console.log(JSON.stringify(augmentRoasCase()));
}
