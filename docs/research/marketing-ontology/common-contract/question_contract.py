"""Deterministic question contracts over the approved transient D004 graph.

Importing this module reads no instances. Tests needing new records, annotations,
or altered source values deliberately have no route.
"""
from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal
import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
AS_OF = '2026-10-06T00:00:00+09:00'
EARLY = '2026-09-30T00:00:00+09:00'
VERSION = 'CQ-runtime-3-D006'

# A route is a complete structured answer, not an LLM/narrative evaluation.
ROUTES = {
    'CQ01-1': ('market',), 'CQ01-4': ('market', 'monthly_ads'),
    'CQ02-1': ('market', 'own'), 'CQ02-3': ('early',), 'CQ02-4': ('market', 'own'),
    'CQ04-1': ('prices', 'promotion'), 'CQ04-3': ('prices',),
    'CQ05-1': ('promotion', 'market', 'own'), 'CQ05-2': ('promotion', 'prices'),
    'CQ05-3': ('gaps', 'own'), 'CQ05-4': ('promotion', 'stock', 'reviews', 'daily_ads', 'logs'),
    'CQ06-1': ('stock', 'daily_ads', 'definitions'), 'CQ06-3': ('daily_ads', 'logs'),
    'CQ07-1': ('monthly_ads', 'daily_ads', 'definitions'),
    'CQ11-1': ('daily_ads', 'logs'), 'CQ11-3': ('gaps', 'logs'),
    'CQ11-4': ('monthly_ads', 'daily_ads', 'logs'),
    'CQ12-1': ('definitions', 'monthly_ads', 'own'), 'CQ12-3': ('gaps', 'own'),
    'CQ12-4': ('monthly_ads', 'own'), 'CQ14-3': ('reviews', 'gaps'),
    'CQ15-2': ('reviews',), 'CQ15-3': ('reviews', 'gaps'),
    'CQ17-1': ('prices', 'promotion'), 'CQ17-3': ('gaps',),
    'CQ17-4': ('promotion', 'market', 'gaps'), 'CQ23-1': ('countries',),
    'CQ23-3': ('countries', 'gaps'), 'CQ23-4': ('definitions', 'market', 'own'),
    'CQ28-1': ('gaps', 'logs', 'reviews'), 'CQ28-3': ('unsupported',),
    'CQ28-4': ('coverage',),
}
GAPS = {
    'CQ01-2': '동일 이름·다른 원천 ID 충돌 입력 필요',
    'CQ01-3': '기본 기준일의 시장분모/비교 월 누락 조건 없음. 원천 삭제·null 변형은 별도 승인 필요',
    'CQ02-2': '전년 기준값0 조건 없음. 원천 값 변경 금지',
    'CQ04-2': 'T09 종료시각은 있으나 같은 시험의 micros 배율 예외 원천 없음',
    'CQ04-4': '배송 포함 실제 지불가격 근거 없음. T08 배송 여부는 null',
    'CQ06-2': 'snapshot 공백·DST 전환·설정 유효기간 중간변경을 함께 만족하는 입력 없음',
    'CQ06-4': '회복 뒤 전환 감소 지속이라는 반대 조건이 D003B 생성 규칙에 없음',
    'CQ07-2': '월/일 중복은 있으나 원천 정정판 조건 없음. revision0을 정정판으로 세지 않음',
    'CQ07-3': '광고 clicks/전환 정의 미확보 조건 없음. 소셜 일별 결측은 별도 CQ06-3',
    'CQ07-4': 'Q3 지출 감소·ROAS 상승 조건 없음. D004 독립 계산에서 두 캠페인 지출 증가',
    'CQ11-2': 'T36 기대=수신+누락 불일치 조건 없음. 오류60케이스는 이 T36 시험을 대체하지 않음',
    'CQ12-2': '원 시험의 상이 귀속창/반품범위 예외를 검증할 확정 입력 없음',
    'CQ14-1': '향/건조감의 승인된 발췌·offset 없음. D005 T25는 거품/용기/건조감의 별도 표본',
    'CQ14-2': '다른 대상 원문·잘못된 offset 조건 없음. 신규 주석·오류 주입 필요',
    'CQ14-4': '같은 원문에서 향 부정/거품 긍정을 보존하는 승인된 span 쌍 없음',
    'CQ15-1': '리뷰 판매처·기대수집량·동일 표본 범위 확정 근거 없음',
    'CQ15-4': '판매처 구성 변경을 확인할 리뷰 표본 메타데이터 없음',
    'CQ17-2': '동일이름 경쟁 제품 충돌·다른 국가/미래 행사 예외 입력 없음',
    'CQ23-2': 'D005 USD minor는 있으나 미국 DST 전환·다른 계정시각/부분기간 조건 없음',
    'CQ28-2': '필수근거 삭제·무관자료 추가를 포함하는 격리 입력 승인이 없음',
}
MISSING = {
    'CQ05-3': ['T19.order_id/ordered_at/quantity: JP P1A/P2A 2026-08-03..31 daily'],
    'CQ11-3': ['T17 campaign-linked consent history', 'T35 campaign setting-change history'],
    'CQ12-3': ['T18 transaction_ref', 'T19 order/line', 'T20 completed refund: original JP detail scope'],
    'CQ14-3': ['T25 aspect annotation + comparable historical review sample'],
    'CQ15-3': ['T24 seller_id', 'T36 review expected/received collection window'],
    'CQ17-3': ['T10 public competitor ad in original scenario', 'T11 launch/event evidence in original scenario'],
    'CQ17-4': ['daily sales effect evidence', 'competitor internal ad spend'],
    'CQ23-3': ['FX rate/date/basis', 'T02 regional comparable SKU mapping', 'T08 tax/shipping basis'],
    'CQ28-1': ['daily orders/refunds', 'review seller/collection history', 'FX and comparison scope'],
}
MISSING_IMPACT = {
    'CQ05-3': '할인 종료의 일별 판매 효과 계산 불가',
    'CQ11-3': '수집 누락의 동의/설정 변경 원인 확인 불가',
    'CQ12-3': '광고·웹·주문·개별환불 대사 불가',
    'CQ14-3': '동일 표본의 측면 악화 추이 계산 불가',
    'CQ15-3': '리뷰 판매처별 구성·수집 완전성 판정 불가',
    'CQ17-3': '경쟁 활동 전체 탐색 지원 불가',
    'CQ17-4': '행사 효과·경쟁 내부 집행 규모 추정 불가',
    'CQ23-3': '국가 통합 매출·가격 순위 계산 불가',
}
POLICIES = {
    'CQ01-1': ['scope_denominator_once', 'no_global_rank'],
    'CQ01-4': ['market_and_attribution_separate', 'no_causal_claim'],
    'CQ02-1': ['no_customer_migration_claim', 'separate_market_and_own'],
    'CQ02-3': ['no_future_available_records', 'withhold_complete_quarter'],
    'CQ02-4': ['separate_market_and_own', 'no_reconciliation_claim'],
    'CQ04-1': ['display_price_only', 'tax_shipping_unknown'],
    'CQ04-3': ['no_total_paid_price_comparison', 'unknown_is_not_false'],
    'CQ05-1': ['monthly_resolution_only', 'no_daily_effect', 'no_causal_claim'],
    'CQ05-2': ['end_exclusive', 'snapshot_sum_rejected'],
    'CQ05-3': ['no_monthly_disaggregation', 'no_order_reconstruction'],
    'CQ05-4': ['alternative_evidence_preserved', 'no_causal_claim'],
    'CQ06-1': ['snapshot_not_duration', 'no_causal_claim'],
    'CQ06-3': ['missing_is_not_zero', 'withhold_complete_daily_comparison'],
    'CQ07-1': ['ratios_of_sums', 'campaign_definitions_separate'],
    'CQ11-1': ['received_not_normalized', 'known_subtotal_partial'],
    'CQ11-3': ['no_consent_cause_claim'],
    'CQ11-4': ['monthly_does_not_fill_daily_missing'],
    'CQ12-1': ['no_GA_order_reconciliation', 'separate_market_and_own'],
    'CQ12-3': ['no_order_reconstruction', 'no_individual_refund_reconstruction'],
    'CQ12-4': ['opposing_directions_preserved', 'no_causal_claim'],
    'CQ14-3': ['no_aspect_trend_claim', 'rating_is_not_sentiment'],
    'CQ15-2': ['no_population_extrapolation', 'unique_not_summed'],
    'CQ15-3': ['ad_logs_not_review_completeness'],
    'CQ17-1': ['observed_activity_only', 'no_causal_claim'],
    'CQ17-3': ['no_full_competitor_coverage'],
    'CQ17-4': ['no_promotion_effect_claim', 'no_internal_spend_estimate'],
    'CQ23-1': ['no_cross_currency_sum', 'comparison_conditions_explicit'],
    'CQ23-3': ['no_global_sales_rank', 'no_cross_currency_sum'],
    'CQ23-4': ['country_alone_not_comparable'],
    'CQ28-1': ['missing_requirements_explicit'],
    'CQ28-3': ['unsupported_not_data_shortage'],
    'CQ28-4': ['guard_not_substantive_support'],
}
DOMAIN_TYPES = {
    'market': ['T01', 'T03'], 'own': ['H01'], 'early': ['T03', 'H01'],
    'monthly_ads': ['T12', 'T13'], 'daily_ads': ['T12', 'T13'],
    'stock': ['T22', 'T35'], 'promotion': ['T09'], 'prices': ['T01', 'T08'],
    'logs': ['T13', 'T36'], 'reviews': ['T24'], 'definitions': ['T12', 'T03', 'H01'],
    'countries': ['T01', 'T03', 'T12', 'H01'], 'gaps': ['T01', 'T36'],
    'unsupported': [], 'coverage': [],
}


def wire(value):
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, dict):
        return {str(k): wire(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [wire(v) for v in value]
    return value


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def rdf_records(tools):
    """Read numeric observations and non-observation context back from RDF.

    sourceContext is lossless context transport, not a replacement for typed
    numeric observations or an independent meaning review.
    """
    d004 = load_module('d004_projection', HERE / 'validate-d003b.py')
    original = d004.load_rows('full')
    result = d004.project(original, tools, include_graph=True)
    if not result['conforms']:
        raise ValueError('D004 SHACL failed')
    from rdflib import Literal, Namespace, RDF
    m = Namespace('https://example.org/marketing/')
    graph = result.pop('graph')
    numeric = {t['type']: [x['path'][2:] for x in t['mappings'] if x['metric_id']]
               for t in d004.MAPPING['types']}
    by_id = {r['record_id']: (typ, line, r) for typ, part in original.items() for line, r in part}
    nodes = {str(graph.value(n, m.recordId)): n for n in graph.subjects(RDF.type, m.SourceRecord)}
    for rid, (typ, _, row) in by_id.items():
        context = {k: v for k, v in row.items() if k not in numeric[typ]}
        graph.add((nodes[rid], m.sourceContext, Literal(json.dumps(context, ensure_ascii=False, sort_keys=True))))
    records = {}
    for rid, node in nodes.items():
        records[rid] = json.loads(str(graph.value(node, m.sourceContext)))
        typ, line, source = by_id[rid]
        artifact = graph.value(node, m.artifact)
        if (str(graph.value(node, m.availableAt)) != source['available_at']
                or int(graph.value(node, m.sourceLine)) != line
                or str(graph.value(artifact, m.path)) != typ + '.jsonl'
                or str(graph.value(artifact, m.sha256)) != d004.MANIFEST['files'][typ + '.jsonl']['sha256']):
            raise ValueError('question RDF record/context provenance mismatch: ' + rid)
    for obs in graph.subjects(RDF.type, m.Observation):
        field = str(graph.value(obs, m.fieldPath))[2:]
        value = graph.value(obs, m.value)
        for node in graph.objects(obs, m.sourceRecord):
            rid = str(graph.value(node, m.recordId))
            records[rid][field] = None if value is None else Decimal(str(value))
    # Every original field, including explicit null and metadata, must survive.
    for rid, (typ, _, source) in by_id.items():
        if records[rid] != source:
            # Decimal('0.1') != float(0.1); compare that numeric field exactly as lexical decimal.
            expected = {k: None if v is None else Decimal(str(v)) if k in numeric[typ] else v
                        for k, v in source.items()}
            if records[rid] != expected:
                raise ValueError('question RDF context readback mismatch: ' + rid)
    question_hash = hashlib.sha256('\n'.join(sorted(' '.join(term.n3() for term in triple) for triple in graph)).encode('utf-8')).hexdigest()
    return records, by_id, result['graph_sha256'], question_hash


def choose(records, typ, country='JP', **conditions):
    return sorted((r for r in records.values() if r['record_id'].split('-')[1] == typ
                   and (country is None or r.get('country_code') == country)
                   and all(r.get(k) == v for k, v in conditions.items())), key=lambda r: r['record_id'])


def q3(rows, year):
    return [r for r in rows if r.get('period_start') in [f'{year}-{month:02}-01' for month in (7, 8, 9)]]


def total(rows, field):
    values = [r[field] for r in rows]
    if not values or any(v is None for v in values):
        return None
    return sum((Decimal(str(v)) for v in values), Decimal(0))


def change(old, new):
    if old is None or new is None:
        return {'absolute': None, 'relative': None, 'reason': 'missing_period'}
    return {'absolute': new - old, 'relative': (new - old) / old if old else None,
            'reason': None if old else 'denominator_zero'}


def aggregate(values, kind):
    if kind in {'snapshot', 'unique_without_identity'}:
        return {'status': 'incomparable', 'value': None, 'reason': 'nonadditive'}
    return {'status': 'answered', 'value': sum(values, Decimal(0)), 'reason': None}


def support_counts(outcomes):
    passed = [r for r in outcomes if r['end_to_end_status'] == 'pass']
    return {'substantive_answers': sum(r['answer']['status'] == 'answered' for r in passed),
            'guard_passes': sum(r['answer']['status'] != 'answered' for r in passed)}


def request_supported(question_id, period, registered):
    base_periods = {'Q3_2025_2026', '2026-08-03/2026-08-31'}
    dst_periods = {'2025-11-02/2025-11-03@America/New_York', '2026-03-08/2026-03-09@America/New_York'}
    return question_id in registered and (period in base_periods or question_id in {'CQ06', 'CQ23'} and period in dst_periods)


def null_reasons(facts):
    reasons = {}
    def visit(value, path):
        if value is None:
            if path.endswith('.reason'):
                reason = 'no_error'
            elif '.tax_included' in path or '.shipping_included' in path:
                reason = 'source_unknown'
            elif '.period_observations.' in path:
                reason = 'source_missing'
            elif 'complete_totals' in path:
                reason = 'missing_daily_source_records'
            elif 'continuous_duration' in path:
                reason = 'snapshot_cannot_establish_continuous_duration'
            elif 'population_rate' in path:
                reason = 'sample_not_population'
            elif 'aspect_trend' in path:
                reason = 'missing_comparable_historical_aspect_sample'
            elif 'boundary_decision' in path:
                reason = 'nonadditive_snapshot'
            else:
                reason = 'missing_period_or_denominator'
            reasons[path] = reason
        elif isinstance(value, dict):
            for k, v in value.items():
                visit(v, path + '.' + str(k))
        elif isinstance(value, list):
            for i, v in enumerate(value):
                visit(v, path + '.' + str(i))
    visit(facts, 'facts')
    return reasons


def answer(test_id, records, sources, tests_hash, as_of=None):
    if test_id not in ROUTES:
        return None
    cutoff = as_of or (EARLY if test_id == 'CQ02-3' else AS_OF)
    visible = {rid: r for rid, r in records.items()
               if datetime.fromisoformat(r['available_at']) <= datetime.fromisoformat(cutoff)}
    facts, evidence = {}, {}

    def emit(name, value, rows, fields):
        facts[name] = wire(value)
        refs = []
        for r in rows:
            typ, line, raw = sources[r['record_id']]
            digest = hashlib.sha256((ROOT / raw['source_file']).read_bytes()).hexdigest()
            for field in sorted(set(fields) | {'available_at'}):
                if field in raw:
                    refs.append({'file': raw['source_file'], 'sha256': digest, 'record_id': r['record_id'],
                                 'line': line, 'field': '$.' + field, 'mapping_version': 'MC-1.0.0',
                                 'policy_version': 'MC-1.0.0', 'query_version': VERSION})
        evidence[name] = refs or [{'file': 'docs/research/marketing-ontology/common-contract/tests.json',
                                 'sha256': tests_hash, 'test_id': test_id, 'field': '$.tests', 'kind': 'contract'}]

    metrics = ['impressions', 'clicks', 'conversions', 'spend', 'attributed_revenue']
    for domain in ROUTES[test_id]:
        if domain == 'market':
            rows = choose(visible, 'T03')
            rows = [r for r in rows if r['product_id'] in ('P1A', 'P2A') and r in q3(rows, 2025) + q3(rows, 2026)]
            data = {}
            for product in ('P1A', 'P2A'):
                periods = {}
                for year in (2025, 2026):
                    part = [r for r in q3(rows, year) if r['product_id'] == product]
                    denominator = {r['period_start']: r['market_total_value'] for r in q3(rows, year)}
                    den = sum(denominator.values(), Decimal(0)) if len(denominator) == 3 else None
                    sales = total(part, 'sales_value') if len(part) == 3 else None
                    periods[str(year)] = {'units': total(part, 'units_sold') if len(part) == 3 else None,
                                          'sales': sales, 'denominator': den,
                                          'share': sales / den if sales is not None and den else None,
                                          'period_observations': [{k: r[k] for k in ('period_start', 'period_end_exclusive', 'units_sold', 'sales_value')} for r in part]}
                data[product] = {**periods, 'units_change': change(periods['2025']['units'], periods['2026']['units']),
                                 'sales_change': change(periods['2025']['sales'], periods['2026']['sales'])}
            emit(domain, data, rows, ['product_id', 'units_sold', 'sales_value', 'market_total_value', 'coverage_text', 'currency', 'period_start', 'period_end_exclusive'])
        elif domain == 'own':
            rows = choose(visible, 'H01', product_id='P1A')
            rows = q3(rows, 2025) + q3(rows, 2026)
            periods = {str(y): {f: total(q3(rows, y), f) if len(q3(rows, y)) == 3 else None
                                for f in ('net_units', 'net_sales', 'returns_value')} for y in (2025, 2026)}
            emit(domain, {**periods, 'net_sales_change': change(periods['2025']['net_sales'], periods['2026']['net_sales']),
                          'net_units_change': change(periods['2025']['net_units'], periods['2026']['net_units'])},
                 rows, ['product_id', 'net_units', 'net_sales', 'returns_value', 'currency', 'period_start', 'period_end_exclusive'])
        elif domain in ('monthly_ads', 'daily_ads'):
            rows = choose(visible, 'T13', grain='month' if domain == 'monthly_ads' else 'day')
            result = {}
            for cid in ('C-JP-search', 'C-JP-social'):
                campaign = [r for r in rows if r['campaign_id'] == cid]
                periods = {str(y): q3(campaign, y) for y in (2025, 2026)} if domain == 'monthly_ads' else {'detail': [r for r in campaign if '2026-08-03' <= r['period_start'] < '2026-08-31']}
                result[cid] = {}
                for key, part in periods.items():
                    missing = [r['period_start'] for r in part if any(r[f] is None for f in metrics)]
                    sums = {f: total([r for r in part if r[f] is not None], f) for f in metrics}
                    ratios = {name: sums[a] / sums[b] if sums[a] is not None and sums[b] else None
                              for name, a, b in [('CTR', 'clicks', 'impressions'), ('CVR', 'conversions', 'clicks'),
                                                 ('CPA', 'spend', 'conversions'), ('ROAS', 'attributed_revenue', 'spend')]}
                    result[cid][key] = {'rows': len(part), 'received': len(part) - len(missing), 'missing_dates': missing,
                                        'known_subtotals': sums, 'complete_totals': None if missing else sums,
                                        'ratios_of_known_sums': ratios, 'completeness': 'partial' if missing else 'complete',
                                        'period_observations': [{k: r[k] for k in ('period_start', 'period_end_exclusive', *metrics)} for r in part]}
                if domain == 'daily_ads':
                    weeks = defaultdict(list)
                    for row in campaign:
                        day = date.fromisoformat(row['period_start'])
                        weeks[(day - timedelta(days=day.weekday())).isoformat()].append(row)
                    result[cid]['weeks'] = {}
                    for start, week in sorted(weeks.items()):
                        missing = [r['period_start'] for r in week if any(r[f] is None for f in metrics)]
                        result[cid]['weeks'][start] = {'end_exclusive': (date.fromisoformat(start) + timedelta(days=7)).isoformat(),
                                                       'normalized_rows': len(week), 'received_rows': len(week) - len(missing),
                                                       'known_subtotals': {f: total([r for r in week if r[f] is not None], f) for f in metrics},
                                                       'completeness': 'complete' if len(week) == 7 and not missing else 'partial'}
            emit(domain, result, rows, ['campaign_id', 'period_start', 'period_end_exclusive', 'grain', 'series_role', 'currency', 'availability', *metrics])
        elif domain == 'early':
            data, used = {}, []
            for typ, field in [('T03', 'units_sold'), ('H01', 'net_units')]:
                rows = choose(visible, typ, product_id='P1A')
                part = q3(rows, 2026)
                used += part
                data[typ] = {'months': sorted(r['period_start'] for r in part),
                             'complete_quarter': total(part, field) if len(part) == 3 else None,
                             'missing_months': sorted(set(['2026-07-01', '2026-08-01', '2026-09-01']) - {r['period_start'] for r in part})}
            emit(domain, data, used, ['product_id', 'period_start', 'available_at', 'units_sold', 'net_units'])
        elif domain == 'prices':
            rows = [r for r in choose(visible, 'T08') if r['product_id'] in ('P1A', 'P2A')]
            products = [r for r in choose(visible, 'T01', None) if r['product_id'] in ('P1A', 'P2A')]
            data = {'products': {r['product_id']: r['volume_ml'] for r in products}, 'basis': 'display_price',
                    'observations': [{k: r[k] for k in ('product_id', 'seller_id', 'observed_at', 'price', 'currency', 'tax_included', 'shipping_included')} for r in rows],
                    'total_paid_comparable': bool(rows) and all(r['tax_included'] is True and r['shipping_included'] is True for r in rows)}
            emit(domain, data, rows + products, ['volume_ml', 'product_id', 'seller_id', 'observed_at', 'price', 'currency', 'tax_included', 'shipping_included'])
        elif domain == 'promotion':
            rows = choose(visible, 'T09', product_id='P2A')
            emit(domain, [{k: r[k] for k in ('product_id', 'seller_id', 'start_at', 'end_at_exclusive', 'discount_ratio')} for r in rows],
                 rows, ['product_id', 'seller_id', 'start_at', 'end_at_exclusive', 'discount_ratio'])
            if test_id == 'CQ05-2':
                emit('boundary_decision', {
                    'at_end_active': [datetime.fromisoformat(r['start_at']) <= datetime.fromisoformat(r['end_at_exclusive']) < datetime.fromisoformat(r['end_at_exclusive']) for r in rows],
                    'snapshot_aggregation': aggregate([r['price'] for r in choose(visible, 'T08')], 'snapshot')},
                    rows + choose(visible, 'T08'), ['start_at', 'end_at_exclusive', 'price', 'observed_at'])
        elif domain == 'stock':
            rows = choose(visible, 'T22', product_id='P1A')
            zeros = [r['observed_at'] for r in rows if r['available_quantity'] == 0]
            events = choose(visible, 'T35', product_id='P1A')
            emit(domain, {'zero_snapshot_count': len(zeros), 'zero_instants': zeros,
                          'recovery': [{k: r[k] for k in ('changed_at', 'before_value', 'after_value')} for r in events],
                          'continuous_duration': None}, rows + events, ['observed_at', 'available_quantity', 'changed_at', 'before_value', 'after_value'])
        elif domain == 'logs':
            rows = choose(visible, 'T36')
            emit(domain, {r['campaign_id']: {k: r[k] for k in ('expected_count', 'received_count', 'missing_count', 'missing_dates', 'expected_start', 'expected_end_exclusive')} for r in rows},
                 rows, ['campaign_id', 'expected_count', 'received_count', 'missing_count', 'missing_dates', 'expected_start', 'expected_end_exclusive'])
        elif domain == 'reviews':
            # CQ15-2 explicitly challenges the whole 72-row sample. Other requests
            # must not use reviews from other countries/products as alternatives.
            rows = choose(visible, 'T24', None) if test_id == 'CQ15-2' else [
                r for r in choose(visible, 'T24') if r['product_id'] in ('P1A', 'P2A')]
            emit(domain, {'sample_rows': len(rows), 'unique_review_ids': len({r['review_id'] for r in rows}),
                          'seller_metadata_present': all('seller_id' in r for r in rows),
                          'population_rate': None, 'aspect_trend': None, 'review_completeness': 'unknown'},
                 rows, ['review_id', 'product_id', 'country_code', 'written_at'])
        elif domain == 'definitions':
            rows = choose(visible, 'T12')
            emit(domain, {'campaigns': {r['campaign_id']: {k: r[k] for k in ('platform', 'target_product_id', 'conversion_name', 'attribution_model', 'attribution_window_days', 'valid_from', 'valid_to_exclusive')} for r in rows},
                          'market_vs_own_vs_attributed_comparable': False, 'account_id_confirmed': False,
                          'own_basis': 'H01 gross minus returns; monthly; no individual order reconstruction'},
                 rows, ['campaign_id', 'platform', 'target_product_id', 'conversion_name', 'attribution_model', 'attribution_window_days', 'valid_from', 'valid_to_exclusive'])
        elif domain == 'countries':
            data, used = {}, []
            for country in ('KR', 'JP', 'US'):
                rows = q3(choose(visible, 'T03', country, product_id='P1A'), 2026)
                own = q3(choose(visible, 'H01', country, product_id='P1A'), 2026)
                configs = choose(visible, 'T12', country)
                product = choose(visible, 'T01', None, product_id='P1A')
                used += rows + own + configs + product
                data[country] = {'currency': sorted({r['currency'] for r in rows}),
                                 'timezone': sorted({r['reporting_timezone'] for r in rows}),
                                 'sales': total(rows, 'sales_value') if len(rows) == 3 else None,
                                 'own_net_sales': total(own, 'net_sales') if len(own) == 3 else None,
                                 'known_sales_subtotal': total(rows, 'sales_value'),
                                 'known_own_net_sales_subtotal': total(own, 'net_sales'),
                                 'available_months': sorted(r['period_start'] for r in rows),
                                 'missing_months': sorted({f'2026-{m:02}-01' for m in (7, 8, 9)} - {r['period_start'] for r in rows}),
                                 'volume_ml': product[0]['volume_ml'] if len(product) == 1 else None,
                                 'market_scope': sorted({r['coverage_text'] for r in rows}),
                                 'campaign_settings': [{k: r[k] for k in ('campaign_id', 'platform', 'target_product_id', 'attribution_model', 'attribution_window_days', 'valid_from', 'valid_to_exclusive')} for r in configs],
                                 'completeness': 'complete' if len(rows) == len(own) == 3 else 'partial',
                                 'cross_country_comparable': False}
            emit(domain, data, used, ['product_id', 'currency', 'reporting_timezone', 'sales_value', 'net_sales', 'volume_ml', 'period_start', 'coverage_text', 'campaign_id', 'platform', 'target_product_id', 'attribution_model', 'attribution_window_days', 'valid_from', 'valid_to_exclusive'])
        elif domain == 'gaps':
            # Presence is scoped to the original D003B scenario, never the D005 type inventory.
            present = sorted({r['record_id'].split('-')[1] for r in visible.values()})
            emit(domain, {'original_scenario_types': present, 'requirements': MISSING.get(test_id, []),
                          'required_period': 'JP Q3 2025/2026 or [2026-08-03,2026-08-31)',
                          'question_requirements': {key: {'fields': MISSING[key], 'impact': impact,
                                                         'next_step': '원 시험의 제품·기간·범위에 맞는 원천/주석·수집 조건을 확보하고 검증'} for key, impact in MISSING_IMPACT.items()},
                          'D005_substitution': False}, choose(visible, 'T36'), ['campaign_id', 'expected_start', 'expected_end_exclusive'])
        elif domain == 'unsupported':
            supported = request_supported('unsupported_question', 'unsupported_period', {key.split('-')[0] for key in ROUTES})
            emit(domain, {'supported': supported, 'reason': 'question_or_period_out_of_scope', 'tool_failure': False}, [], [])
        elif domain == 'coverage':
            guard_statuses = ['insufficient_data', 'incomparable', 'out_of_scope', 'execution_failed']
            guard_outcomes = [{'end_to_end_status': 'pass', 'answer': {'status': s}} for s in guard_statuses]
            emit(domain, {'guard_success_adds_substantive_answers': support_counts(guard_outcomes)['substantive_answers'], 'substantive_status': 'answered',
                          'guard_statuses': ['insufficient_data', 'incomparable', 'out_of_scope', 'execution_failed']}, [], [])

    status = 'answered'
    if test_id in {'CQ02-3', 'CQ05-3', 'CQ06-3', 'CQ11-3', 'CQ12-3', 'CQ14-3', 'CQ15-3', 'CQ17-3', 'CQ23-3'}:
        status = 'insufficient_data'
    if test_id in {'CQ04-3', 'CQ05-2', 'CQ15-2', 'CQ23-4'}:
        status = 'incomparable'
    if test_id == 'CQ28-3':
        status = 'out_of_scope'
    if test_id == 'CQ02-3' and all(len(facts['early'][t]['months']) == 3 for t in ('T03', 'H01')):
        status = 'answered'
    completeness = 'sample' if test_id in {'CQ14-3', 'CQ15-2', 'CQ15-3'} else 'partial' if any(x in ROUTES[test_id] for x in ('daily_ads', 'gaps', 'early')) else 'complete'
    if status == 'out_of_scope':
        completeness = 'unknown'
    if test_id == 'CQ04-3':
        completeness = 'unknown'
    if 'countries' in facts and any(c['completeness'] == 'partial' for c in facts['countries'].values()):
        completeness = 'partial'
    return {'status': status, 'as_of': cutoff, 'facts': facts, 'evidence': evidence,
            'null_reasons': null_reasons(facts),
            'completeness': completeness, 'policy_assertions': POLICIES[test_id],
            'substantive_answer': status == 'answered', 'scope': 'D003B synthetic reported scope',
            'unproven_claims': {'causal_effect': None, 'customer_migration': None, 'global_rank': None,
                               'individual_order_reconstruction': None, 'full_population_review_rate': None}}
