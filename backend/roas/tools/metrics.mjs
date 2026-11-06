import {chatMetrics} from '../../../shared/roas/roas-chat.mjs';
import {metricMissingReason, metricValue, selectBreakdowns, selectFacts, summarize} from '../../../shared/roas/training-dashboard.mjs';

// Field mappings document existing approved summarize() calculations, not a second metric engine.
const sources = {
  roas: ['revenue', 'spend', ['revenue', 'spend', 'cvr', 'aov']],
  spend: ['spend', null, ['revenue', 'roas']],
  revenue: ['revenue', null, ['orders', 'aov', 'roas']],
  orders: ['orders', null, ['clicks', 'cvr', 'aov', 'cpa']],
  clicks: ['clicks', null, ['orders', 'cvr', 'cpc']],
  cpc: ['spend', 'clicks', ['spend', 'clicks', 'cvr']],
  cvr: ['orders', 'clicks', ['orders', 'clicks', 'cpc', 'cpa']],
  cpa: ['spend', 'orders', ['spend', 'orders', 'cvr']],
  aov: ['revenue', 'orders', ['revenue', 'orders', 'roas']],
  adCtr: ['clicks', 'impressions', ['clicks', 'cpc']],
  paymentFailureRate: ['paymentFailures', 'paymentAttempts', ['orders']],
  contentClickRate: ['clicks', 'impressions', ['clicks', 'contentCpm']],
  adCpm: ['spend', 'impressions', ['spend', 'adCtr'], 1000],
  contentCpm: ['spend', 'impressions', ['spend', 'contentClickRate'], 1000],
};
const exposureBases = {
  adCtr: 'ad_impression',
  adCpm: 'ad_impression',
  contentClickRate: 'content_view',
  contentCpm: 'content_view',
};
if (Object.keys(sources).sort().join(',') !== Object.keys(chatMetrics).sort().join(',')) {
  throw new Error('metric_catalog_out_of_sync');
}
export const metrics = Object.freeze(Object.fromEntries(Object.entries(sources).map(([id, [numeratorField, denominatorField, relatedMetrics, multiplier]]) => [
  id, Object.freeze({
    id, label: chatMetrics[id].label, unit: chatMetrics[id].unit,
    formula: denominatorField ? `${numeratorField}${multiplier ? ` * ${multiplier}` : ''} / ${denominatorField}` : 'sum(' + numeratorField + ')',
    numeratorField, denominatorField, components: denominatorField ? [numeratorField, denominatorField] : [numeratorField],
    relatedMetrics, rate: Boolean(chatMetrics[id].rate),
    limitations: id === 'cpa' ? ['CPA는 주문당 광고비이며 CAC(신규 고객 획득 비용)가 아닙니다.'] :
      exposureBases[id] === 'ad_impression' ? ['광고 노출 기준 행만 사용하고 콘텐츠 조회는 제외합니다.'] :
        exposureBases[id] === 'content_view' ? ['콘텐츠 조회 기준 행만 사용합니다.'] : [],
  }),
])));
export const dimensions = Object.freeze(['campaign', 'device', 'product', 'creativeId', 'audienceId', 'placement', 'keyword', 'browser', 'paymentMethod']);
const trafficDimensions = new Set(dimensions.slice(3));
export const keyFor = (row, dimension) => dimension === 'campaign' ? row.campaignId :
  dimension === 'product' ? row.key : row[dimension];
export const groupKey = value => typeof value === 'string' && value.trim() ? value : '__unspecified__';
export const dimensionRows = (data, filters, dimension) => {
  if (dimension === 'campaign' || dimension === 'device') return selectFacts(data, filters);
  if (dimension === 'product') return selectBreakdowns(data, filters, 'product');
  if (trafficDimensions.has(dimension)) return selectBreakdowns(data, filters, 'traffic');
  throw new Error('unsupported_scope');
};
export const metricRows = (rows, metric) => exposureBases[metric]
  ? rows.filter(row => row.exposureBasis === exposureBases[metric]) : rows;

export function metricResult(rows, metric) {
  const eligible = metricRows(rows, metric);
  const totals = summarize(eligible);
  const definition = metrics[metric];
  return {
    numerator: totals[definition.numeratorField],
    denominator: definition.denominatorField ? totals[definition.denominatorField] : null,
    value: metricValue(totals, metric), rowCount: eligible.length,
  };
}

export function metricCapabilities(data, filters) {
  const facts = selectFacts(data, filters);
  const breakdownRows = Object.fromEntries(dimensions.map(dimension => [dimension, dimensionRows(data, filters, dimension)]));
  return Object.values(metrics).map(definition => {
    const applicable = metricRows(facts, definition.id);
    const availability = !facts.length ? 'empty' : !applicable.length ? 'not_provided' : 'ready';
    const availableDimensions = availability !== 'ready' ? [] : dimensions.filter(dimension => {
      const rows = metricRows(breakdownRows[dimension], definition.id);
      return rows.some(row => groupKey(keyFor(row, dimension)) !== '__unspecified__');
    });
    const missing = availability === 'ready' && data.periods.every(period =>
      metricResult(applicable.filter(row => row.periodId === period.id), definition.id).value === null);
    return {
      id: definition.id, label: definition.label, formula: definition.formula,
      components: definition.components, relatedMetrics: definition.relatedMetrics,
      unit: definition.unit, numeratorField: definition.numeratorField,
      denominatorField: definition.denominatorField, availableDimensions,
      availability, limitations: [...definition.limitations, ...(missing
        ? [metricMissingReason(applicable, definition.id).reason] : [])],
    };
  });
}
