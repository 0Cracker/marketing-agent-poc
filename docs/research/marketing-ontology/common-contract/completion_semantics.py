"""Independent completion ledger: source decoding is supplied by the existing Python oracle.

Does not import the JS mapping/generator. No source or completion files are written.
"""
from datetime import date, datetime, time, timedelta
from decimal import Decimal
import hashlib
import json
from urllib.parse import quote
from zoneinfo import ZoneInfo

VERSION = 'CANONICAL-SYNTHETIC-1'


def verify(rows, originals, supplement, registry, raw_generator_sha):
    by_id = {r['record']['record_id']: r for r in rows}
    by_type = {}
    for item in originals:
        by_type.setdefault(item['metadata']['dataset_type'], []).append(item)
    definitions = {x['id']: x for x in registry['definitions']}
    assert len(definitions) == len(registry['definitions'])
    assert all(x['is_synthetic'] and x['version'] == VERSION and x['definition'] for x in definitions.values())
    classifications, verified = {}, 0

    def metric(name, value, unit):
        name = t + '.' + name
        assert name in definitions and definitions[name]['kind'] == 'MetricDefinition'
        return {'metric_id': name, 'value': value, 'unit': unit, 'availability': 'available', 'definition_version': VERSION}

    def window(start, end, zone):
        return {'start': start, 'end_exclusive': end, 'timezone': zone, 'grain': 'custom'}

    def midnight(day, zone):
        return datetime.combine(date.fromisoformat(day), time(), ZoneInfo(zone)).isoformat()

    def identifier(prefix, *parts):
        def encode(v):
            text = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False, separators=(',', ':'))
            return quote(text, safe="~!*'()")
        return prefix + '/'.join(map(encode, parts))

    for entry in supplement['records']:
        row = by_id[entry['record_id']]
        p, m = row['source']['payload'], row['source']['metadata']
        t, country, zone = m['dataset_type'], m['country_code'], m['reporting_timezone']
        expected = {}
        def put(key, value):
            expected[key if key.startswith('/') else '/' + key] = value
        if t == 'T04':
            put('cohort_id', identifier('panel/', p['panel_id'], p['subject_ref'], p['period']))
            put('measures', [metric('positive_responses', p['positive_responses'], 'count'), metric('positive_rate', p['positive_rate'], 'ratio')])
            assert Decimal(str(p['positive_rate'])) == Decimal(p['positive_responses']) / Decimal(p['sample_size'])
        if t == 'T05':
            put('term_ref', 'term/' + hashlib.sha256(p['term'].encode()).hexdigest())
            put('term_kind', 'keyword')
            put('index_definition', '가상 검색 관심지수; 같은 normalization_scope 안에서만 최대 100으로 정규화')
        constants = {
            'T06': {'geo_target_ref': 'geo/' + country, 'network_scope': 'synthetic_search_only'},
            'T07': {'search_type': 'synthetic_web_search', 'aggregation_scope': 'site/page/query/device/period'},
            'T10': {'served_regions': [country], 'coverage_text': '독립 가상 광고 관측 표본; 실제 송출 지역 또는 시장 전수 확보를 뜻하지 않음'},
            'T11': {'title': '가상 경쟁 제품 안내문 ' + p.get('document_id', '')},
            'T15': {'report_surface': 'synthetic_auction', 'threshold_status': 'not_provided'},
            'T26': {'channel': 'synthetic_support', 'subject': p.get('message_text'), 'status': 'synthetic_open'},
            'T27': {'platform': '모의 동영상', 'channel_ref': 'content-channel/' + country},
            'T33': {'item_code': 'synthetic_index', 'definition': '실제 통계가 아닌 가상 지역별 공표 지수', 'seasonal_adjustment': 'not_provided'},
            'T38': {'hypothesis_text': '가상 모집단에서 처리 집단의 전환율이 대조 집단보다 높다', 'assignment_method': 'synthetic_random_assignment',
                    'assignment_unit': 'synthetic_participant', 'treatment_description': '모의 안내문 변경', 'status': 'completed'},
            'T40': {'version': VERSION, 'objective': '가상 전환수 비교', 'product_refs': ['P1A'], 'allowed_channels': ['search', 'social'],
                    'change_constraints': ['총예산 한도 준수', '모형의 채널별 상하한 준수', '통화·기간 일치', 'proposed 상태 집행 금지']},
        }
        for key, value in constants.get(t, {}).items():
            put(key, value)
        if t == 'T14':
            put('report_definition_ref', identifier('report/', p['parent_record_id'], p['device']))
            put('audience_basis', 'observed_aggregate')
        if t == 'T16':
            put('valid_from', midnight(p['period']['start'], zone))
            put('valid_to_exclusive', midnight(p['period']['end'], zone))
        if t == 'T19':
            put('seller_ref', 'seller/D005/' + country)
            gross = sum(Decimal(x['payload']['line_gross_total']['amount']) for x in by_type['T19'] if x['payload']['order_id'] == p['order_id'])
            refunded = sum(Decimal(x['payload']['refund_amount']['amount']) for x in by_type['T20']
                           if x['payload']['order_ref'] == p['order_id'] and x['payload']['status'] == 'completed'
                           and datetime.fromisoformat(x['payload']['processed_at']) <= datetime.fromisoformat(p['status_available_at']))
            assert 0 <= refunded <= gross
            put('financial_status', 'paid' if not refunded else 'refunded' if refunded == gross else 'partially_refunded')
        if t == 'T23':
            put('retail_channel', 'synthetic_retail_sample')
            put('distribution_measures', [metric(k, p[k], 'count') for k in ['stockists', 'target_stockists']])
        if t == 'T25':
            put('aspect_ref', 'aspect/' + quote(p['aspect'], safe="~!*'()"))
            put('definition_version', VERSION)
            if p['record_kind'] == 'annotation':
                put('extractor_version', 'D005-generator/' + raw_generator_sha)
            else:
                parent_reviews = [x['payload'] for x in by_type['PARENT_T24'] if x['metadata']['record_id'] in p['review_refs']]
                assert len(parent_reviews) == len(p['review_refs']) == p['sample_size']
                days = sorted(x['written_at'][:10] for x in parent_reviews)
                put('period', window(days[0], (date.fromisoformat(days[-1]) + timedelta(days=1)).isoformat(), zone))
                annotations = [x['payload'] for x in by_type['T25'] if x['payload']['record_kind'] == 'annotation'
                               and x['payload']['product_ref'] == p['product_ref'] and x['payload']['aspect'] == p['aspect']
                               and x['payload']['review_ref'] in p['review_refs']]
                assert len({x['review_ref'] for x in annotations}) == p['mention_count']
                sentiments = {x['sentiment'] for x in annotations}
                assert len(sentiments) == 1
                put('sentiment', next(iter(sentiments)))
                put('assessment_status', 'provided')
        if t == 'T29':
            put('creator_ref', 'creator/' + country)
            put('product_refs', ['P1A', 'P1B'])
            days = sorted(datetime.fromisoformat(x['payload']['published_at']).astimezone(ZoneInfo(zone)).date()
                          for x in by_type['T27'] if x['payload']['content_id'] in p['content_refs'])
            assert {x['payload']['content_id'] for x in by_type['T27'] if x['payload']['content_id'] in p['content_refs']} == set(p['content_refs'])
            put('planned_period', window(days[0].isoformat(), (days[-1] + timedelta(days=1)).isoformat(), zone))
            put('message_brief', '가상 샴푸 사용 안내 협업')
        if t == 'T30':
            if p['record_kind'] == 'cohort':
                put('period', window('2026-08-03', '2026-08-11', zone))
                linked = [x['payload'] for x in by_type['T19'] if x['payload']['order_id'] in p['order_refs']]
                assert set(x['order_id'] for x in linked) == set(p['order_refs'])
                assert all('2026-08-03' <= x['ordered_at'][:10] < '2026-08-11' for x in linked)
                gross = sum(Decimal(x['line_gross_total']['amount']) for x in linked)
                refunded = sum(Decimal(x['payload']['refund_amount']['amount']) for x in by_type['T20']
                               if x['payload']['order_ref'] in p['order_refs'] and x['payload']['status'] == 'completed'
                               and datetime.fromisoformat(x['payload']['processed_at']) <= datetime.fromisoformat(m['available_at']))
                assert gross - refunded == Decimal(p['net_revenue']['amount'])
            else:
                put('deal_amount', {'amount': {'KR': '100000', 'JP': '10000', 'US': '100'}[country], 'currency': {'KR': 'KRW', 'JP': 'JPY', 'US': 'USD'}[country]})
        if t == 'T31':
            put('sent_at', datetime.combine(date(2026, 8, 2), time(12), ZoneInfo(zone)).isoformat())
            put('period', window('2026-08-02', '2026-08-12', zone))
            put('unique_clickers', p['unique_clicks'])
            assert 0 <= p['unique_clicks'] <= p['emails_sent'] - p['bounces']
            assert datetime.fromisoformat(midnight('2026-08-12', zone)) <= datetime.fromisoformat(m['available_at'])
            assert all('2026-08-02' <= x['payload']['ordered_at'][:10] < '2026-08-12' for x in by_type['T19'] if x['payload']['order_id'] in p['linked_orders'])
        if t == 'T32':
            put('measure_definition', p['question_text'] + ' / ' + '·'.join(p['response_scale']) + '; 표본 긍정 응답 비율')
            put('cohort_ref', identifier('survey/', p['study_id'], p['subject_ref'], p['period']))
            assert 0 <= p['positive_responses'] <= p['sample_size'] and p['sample_size'] > 0
            put('measures', [metric('positive_responses', p['positive_responses'], 'count'), metric('sample_size', p['sample_size'], 'count'),
                             metric('positive_rate', p['positive_responses'] / p['sample_size'], 'ratio')])
        if t == 'T34':
            if p['record_kind'] == 'weather':
                put('measures', [metric(k, p[k]['value'], p[k]['unit']) for k in ['temperature', 'precipitation']])
            else:
                assert p['is_public_holiday'] is False
                put('calendar_kind', 'operational_schedule')
        if t == 'T37':
            assert p['measures'][0]['metric_id'] == 'lcp_p75' and p['measures'][0]['unit'] == 'ms'
            put('/measures/0/definition_version', VERSION)
        if t == 'T38':
            assert p['period']['end'] <= datetime.fromisoformat(m['available_at'].replace('Z', '+00:00')).astimezone(ZoneInfo(zone)).date().isoformat()
        if t == 'T39':
            put('model_version', VERSION)
            put('objective', 'maximize_synthetic_conversions')
            if p['record_kind'] == 'budget_candidate':
                put('expected_measures', [metric('predicted_conversions', p['predicted_conversions'], 'count')])
        assert entry['fields'] == expected, (entry['record_id'], entry['fields'], expected)
        assert set(entry['field_metadata']) == set(expected)
        for pointer, value in expected.items():
            if pointer.endswith(('_ref', '_refs', '/cohort_id')):
                references = value if isinstance(value, list) else [value]
                assert all(ref in definitions for ref in references), (entry['record_id'], pointer, references)
            meta = entry['field_metadata'][pointer]
            assert meta['classification'] in ('mapping', 'derivation', 'definition', 'synthetic_assumption')
            assert meta['sources'] and meta['rule'] and meta['human_confirmed'] is False
            assert meta['original_available_at'] == m['available_at']
            assert meta['available_at'] == supplement['created_at']
            classifications[meta['classification']] = classifications.get(meta['classification'], 0) + 1
            verified += 1
    assert verified == 816 and len(supplement['records']) == 330
    assert classifications == supplement['classification_counts']
    return {'status': 'pass', 'independent_assignments': verified, 'rows': 330, 'classification_counts': classifications,
            'availability_policy': 'all completion fields become available at completion creation; original event and record availability remain separate'}
