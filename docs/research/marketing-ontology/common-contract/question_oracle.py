"""Independent source oracle. Never imports question queries or RDF projection.

Expected facts are derived from immutable source bytes with Decimal; fixture
records and new source/annotation values are never constructed.
"""
from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal as D
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
SOURCE = HERE.parent / 'batches/D003B'
REQUIRED_DOMAINS = {
    'CQ01-1': 'market', 'CQ01-4': 'market monthly_ads', 'CQ02-1': 'market own',
    'CQ02-3': 'early', 'CQ02-4': 'market own', 'CQ04-1': 'prices promotion',
    'CQ04-3': 'prices', 'CQ05-1': 'promotion market own', 'CQ05-2': 'promotion prices boundary_decision',
    'CQ05-3': 'gaps own', 'CQ05-4': 'promotion stock reviews daily_ads logs',
    'CQ06-1': 'stock daily_ads definitions', 'CQ06-3': 'daily_ads logs',
    'CQ07-1': 'monthly_ads daily_ads definitions', 'CQ11-1': 'daily_ads logs',
    'CQ11-3': 'gaps logs', 'CQ11-4': 'monthly_ads daily_ads logs',
    'CQ12-1': 'definitions monthly_ads own', 'CQ12-3': 'gaps own', 'CQ12-4': 'monthly_ads own',
    'CQ14-3': 'reviews gaps', 'CQ15-2': 'reviews', 'CQ15-3': 'reviews gaps',
    'CQ17-1': 'prices promotion', 'CQ17-3': 'gaps', 'CQ17-4': 'promotion market gaps',
    'CQ23-1': 'countries', 'CQ23-3': 'countries gaps', 'CQ23-4': 'definitions market own',
    'CQ28-1': 'gaps logs reviews', 'CQ28-3': 'unsupported', 'CQ28-4': 'coverage',
}


def sources():
    manifest = json.loads((SOURCE / 'manifest.json').read_text(encoding='utf-8'))
    records = []
    for name, spec in manifest['files'].items():
        raw = (SOURCE / 'source' / name).read_bytes()
        if hashlib.sha256(raw).hexdigest() != spec['sha256']:
            raise ValueError('oracle manifest mismatch: ' + name)
        lines = raw.decode('utf-8').splitlines()
        if len(lines) != spec['records']:
            raise ValueError('oracle source count mismatch: ' + name)
        records += [json.loads(line) for line in lines]
    return records


def plain(value):
    if isinstance(value, D):
        return str(value)
    if isinstance(value, dict):
        return {k: plain(v) for k, v in value.items()}
    if isinstance(value, list):
        return [plain(v) for v in value]
    return value


def expected_domains(all_records, as_of, test_id):
    rows = [r for r in all_records if datetime.fromisoformat(r['available_at']) <= datetime.fromisoformat(as_of)]
    groups = defaultdict(list)
    for row in sorted(rows, key=lambda r: r['record_id']):
        groups[row['record_id'].split('-')[1]].append(row)
    jp = {t: [r for r in part if r.get('country_code') == 'JP'] for t, part in groups.items()}
    def quarter(part, year):
        return [r for r in part if r['period_start'][:4] == str(year) and r['period_start'][5:7] in ('07', '08', '09')]
    def add(part, field):
        if not part or any(r[field] is None for r in part):
            return None
        accumulator = D(0)
        for row in part:
            accumulator += D(str(row[field]))
        return accumulator
    def delta(a, b):
        if a is None or b is None:
            return {'absolute': None, 'relative': None, 'reason': 'missing_period'}
        return {'absolute': b - a, 'relative': (b - a) / a if a != 0 else None,
                'reason': None if a != 0 else 'denominator_zero'}
    out = {}
    market = {}
    for p in ['P1A', 'P2A']:
        data = {}
        for year in [2025, 2026]:
            part = [r for r in quarter(jp['T03'], year) if r['product_id'] == p]
            den_values = {}
            for r in quarter(jp['T03'], year):
                key = (r['period_start'], r['period_end_exclusive'], r['coverage_text'], r['currency'])
                value = D(r['market_total_value'])
                if key in den_values and den_values[key] != value:
                    raise ValueError('independent denominator conflict')
                den_values[key] = value
            den = sum(den_values.values(), D(0)) if len(den_values) == 3 else None
            sales = add(part, 'sales_value') if len(part) == 3 else None
            data[str(year)] = {'units': add(part, 'units_sold') if len(part) == 3 else None,
                               'sales': sales, 'denominator': den, 'share': sales / den if sales is not None and den else None,
                               'period_observations': [{k: D(str(r[k])) if k in ['units_sold', 'sales_value'] else r[k] for k in ['period_start', 'period_end_exclusive', 'units_sold', 'sales_value']} for r in part]}
        data['units_change'] = delta(data['2025']['units'], data['2026']['units'])
        data['sales_change'] = delta(data['2025']['sales'], data['2026']['sales'])
        market[p] = data
    out['market'] = market
    own = {}
    for year in [2025, 2026]:
        part = [r for r in quarter(jp['H01'], year) if r['product_id'] == 'P1A']
        own[str(year)] = {k: add(part, k) if len(part) == 3 else None for k in ['net_units', 'net_sales', 'returns_value']}
    own['net_sales_change'] = delta(own['2025']['net_sales'], own['2026']['net_sales'])
    own['net_units_change'] = delta(own['2025']['net_units'], own['2026']['net_units'])
    out['own'] = own
    for grain, domain in [('month', 'monthly_ads'), ('day', 'daily_ads')]:
        data = {}
        for cid in ['C-JP-search', 'C-JP-social']:
            selected = [r for r in jp['T13'] if r['grain'] == grain and r['campaign_id'] == cid]
            periods = {str(y): quarter(selected, y) for y in [2025, 2026]} if grain == 'month' else {'detail': selected}
            data[cid] = {}
            for label, part in periods.items():
                fields = ['impressions', 'clicks', 'conversions', 'spend', 'attributed_revenue']
                missing = [r['period_start'] for r in part if any(r[k] is None for k in fields)]
                sums = {k: add([r for r in part if r[k] is not None], k) for k in fields}
                divide = lambda numerator, denominator: numerator / denominator if numerator is not None and denominator else None
                ratios = {'CTR': divide(sums['clicks'], sums['impressions']), 'CVR': divide(sums['conversions'], sums['clicks']),
                          'CPA': divide(sums['spend'], sums['conversions']), 'ROAS': divide(sums['attributed_revenue'], sums['spend'])}
                data[cid][label] = {'rows': len(part), 'received': len(part) - len(missing), 'missing_dates': missing,
                                    'known_subtotals': sums, 'complete_totals': None if missing else sums,
                                    'ratios_of_known_sums': ratios, 'completeness': 'partial' if missing else 'complete',
                                    'period_observations': [{k: None if r[k] is None else D(str(r[k])) if k in fields else r[k] for k in ['period_start', 'period_end_exclusive', *fields]} for r in part]}
            if grain == 'day':
                weeks = {}
                for row in selected:
                    day = date.fromisoformat(row['period_start'])
                    key = day.toordinal() - day.weekday()
                    weeks.setdefault(key, []).append(row)
                data[cid]['weeks'] = {}
                for key, part in sorted(weeks.items()):
                    fields = ['impressions', 'clicks', 'conversions', 'spend', 'attributed_revenue']
                    received = sum(all(r[k] is not None for k in fields) for r in part)
                    start = date.fromordinal(key)
                    data[cid]['weeks'][start.isoformat()] = {'end_exclusive': (start + timedelta(days=7)).isoformat(),
                                                             'normalized_rows': len(part), 'received_rows': received,
                                                             'known_subtotals': {k: add([r for r in part if r[k] is not None], k) for k in fields},
                                                             'completeness': 'complete' if len(part) == received == 7 else 'partial'}
        out[domain] = data
    early = {}
    for t, field in [('T03', 'units_sold'), ('H01', 'net_units')]:
        part = [r for r in quarter(jp[t], 2026) if r['product_id'] == 'P1A']
        got = sorted(r['period_start'] for r in part)
        early[t] = {'months': got, 'complete_quarter': add(part, field) if len(part) == 3 else None,
                    'missing_months': [x for x in ['2026-07-01', '2026-08-01', '2026-09-01'] if x not in got]}
    out['early'] = early
    offers = [r for r in jp['T08'] if r['product_id'] in ['P1A', 'P2A']]
    out['prices'] = {'products': {r['product_id']: r['volume_ml'] for r in groups['T01'] if r['product_id'] in ['P1A', 'P2A']},
                     'basis': 'display_price', 'observations': [{k: D(r[k]) if k == 'price' else r[k] for k in ['product_id', 'seller_id', 'observed_at', 'price', 'currency', 'tax_included', 'shipping_included']} for r in offers],
                     'total_paid_comparable': len(offers) > 0 and all(r['tax_included'] is True and r['shipping_included'] is True for r in offers)}
    out['promotion'] = [{k: D(str(r[k])) if k == 'discount_ratio' else r[k] for k in ['product_id', 'seller_id', 'start_at', 'end_at_exclusive', 'discount_ratio']} for r in jp['T09'] if r['product_id'] == 'P2A']
    stock = [r for r in jp['T22'] if r['product_id'] == 'P1A']
    instants = [r['observed_at'] for r in stock if r['available_quantity'] == 0]
    out['stock'] = {'zero_snapshot_count': len(instants), 'zero_instants': instants,
                     'recovery': [{k: r[k] for k in ['changed_at', 'before_value', 'after_value']} for r in jp['T35'] if r['product_id'] == 'P1A'], 'continuous_duration': None}
    out['logs'] = {r['campaign_id']: {k: r[k] for k in ['expected_count', 'received_count', 'missing_count', 'missing_dates', 'expected_start', 'expected_end_exclusive']} for r in jp['T36']}
    review_sample = groups['T24'] if test_id == 'CQ15-2' else [r for r in jp['T24'] if r['product_id'] in ['P1A', 'P2A']]
    out['reviews'] = {'sample_rows': len(review_sample), 'unique_review_ids': len(set(r['review_id'] for r in review_sample)),
                       'seller_metadata_present': bool(review_sample) and all('seller_id' in r for r in review_sample),
                       'population_rate': None, 'aspect_trend': None, 'review_completeness': 'unknown'}
    out['definitions'] = {'campaigns': {r['campaign_id']: {k: r[k] for k in ['platform', 'target_product_id', 'conversion_name', 'attribution_model', 'attribution_window_days', 'valid_from', 'valid_to_exclusive']} for r in jp['T12']},
                           'market_vs_own_vs_attributed_comparable': False, 'account_id_confirmed': False,
                           'own_basis': 'H01 gross minus returns; monthly; no individual order reconstruction'}
    country_data = {}
    for c in ['KR', 'JP', 'US']:
        part = [r for r in quarter(groups['T03'], 2026) if r['country_code'] == c and r['product_id'] == 'P1A']
        own_part = [r for r in quarter(groups['H01'], 2026) if r['country_code'] == c and r['product_id'] == 'P1A']
        country_data[c] = {'currency': sorted(set(r['currency'] for r in part)), 'timezone': sorted(set(r['reporting_timezone'] for r in part)),
                           'sales': add(part, 'sales_value') if len(part) == 3 else None,
                           'own_net_sales': add(own_part, 'net_sales') if len(own_part) == 3 else None,
                           'known_sales_subtotal': add(part, 'sales_value'),
                           'known_own_net_sales_subtotal': add(own_part, 'net_sales'),
                           'available_months': sorted(r['period_start'] for r in part),
                           'missing_months': [day for day in ['2026-07-01', '2026-08-01', '2026-09-01'] if day not in {r['period_start'] for r in part}],
                           'volume_ml': next(r['volume_ml'] for r in groups['T01'] if r['product_id'] == 'P1A'),
                           'market_scope': sorted(set(r['coverage_text'] for r in part)),
                           'campaign_settings': [{k: r[k] for k in ['campaign_id', 'platform', 'target_product_id', 'attribution_model', 'attribution_window_days', 'valid_from', 'valid_to_exclusive']} for r in groups['T12'] if r['country_code'] == c],
                           'completeness': 'complete' if len(part) == len(own_part) == 3 else 'partial', 'cross_country_comparable': False}
    out['countries'] = country_data
    out['boundary_decision'] = {'at_end_active': [False for r in jp['T09'] if r['product_id'] == 'P2A'],
                                'snapshot_aggregation': {'status': 'incomparable', 'value': None, 'reason': 'nonadditive'}}
    out['unsupported'] = {'supported': False, 'reason': 'question_or_period_out_of_scope', 'tool_failure': False}
    out['coverage'] = {'guard_success_adds_substantive_answers': 0, 'substantive_status': 'answered',
                       'guard_statuses': ['insufficient_data', 'incomparable', 'out_of_scope', 'execution_failed']}
    return plain(out), groups


def check(test, response, source_rows):
    checks = []
    def verify(name, ok, detail=None):
        checks.append({'name': name, 'status': 'pass' if ok else 'fail', **({'detail': detail} if detail else {})})
    if not response:
        return [{'name': 'response', 'status': 'fail', 'detail': 'no implemented response'}]
    verify('answer_status', response['status'] == test['expected']['status'])
    expected, groups = expected_domains(source_rows, response['as_of'], test['id'])
    verify('all_required_assertion_domains', set(response['facts']) == set(REQUIRED_DOMAINS[test['id']].split()))
    for key, actual in response['facts'].items():
        if key == 'gaps':
            verify('original_scenario_type_inventory', actual['original_scenario_types'] == sorted(groups))
            verify('explicit_missing_requirements', bool(actual['requirements']) and actual['D005_substitution'] is False and bool(actual['required_period']))
            verify('question_missing_impact_and_followup',
                   set(actual['question_requirements']) == {'CQ05-3', 'CQ11-3', 'CQ12-3', 'CQ14-3', 'CQ15-3', 'CQ17-3', 'CQ17-4', 'CQ23-3'}
                   and all(v.get('fields') and v.get('impact') and v.get('next_step') for v in actual['question_requirements'].values()))
        else:
            verify('independent_values:' + key, actual == expected.get(key))
    # A value-equal answer using future records, fabricated paths, or no basis fails.
    original = {r['record_id']: r for r in source_rows}
    evidence_ok = set(response['evidence']) == set(response['facts']) and bool(response['facts'])
    hashes, file_lines = {}, {}
    for refs in response['evidence'].values():
        evidence_ok &= bool(refs)
        for ref in refs:
            path = ROOT / ref['file']
            if ref['file'] not in hashes:
                hashes[ref['file']] = hashlib.sha256(path.read_bytes()).hexdigest()
                file_lines[ref['file']] = path.read_text(encoding='utf-8').splitlines()
            evidence_ok &= hashes[ref['file']] == ref['sha256']
            if ref.get('kind') == 'contract':
                evidence_ok &= ref.get('test_id') == test['id'] and ref['field'] == '$.tests'
            else:
                row = original.get(ref['record_id'])
                evidence_ok &= bool(row) and ref['field'].startswith('$.')
                if row:
                    evidence_ok &= ref['field'][2:] in row and ref['file'] == row['source_file']
                    evidence_ok &= datetime.fromisoformat(row['available_at']) <= datetime.fromisoformat(response['as_of'])
                    evidence_ok &= bool(ref.get('mapping_version')) and bool(ref.get('policy_version')) and bool(ref.get('query_version'))
                    lines = file_lines[ref['file']]
                    evidence_ok &= 1 <= ref['line'] <= len(lines) and json.loads(lines[ref['line'] - 1])['record_id'] == ref['record_id']
    verify('evidence_file_hash_record_field_asof_versions', bool(evidence_ok))
    verify('no_unsupported_inference', set(response['unproven_claims']) == {'causal_effect', 'customer_migration', 'global_rank', 'individual_order_reconstruction', 'full_population_review_rate'}
           and all(v is None for v in response['unproven_claims'].values()))
    null_paths = set()
    def collect_nulls(value, path):
        if value is None:
            null_paths.add(path)
        elif isinstance(value, dict):
            for k, v in value.items():
                collect_nulls(v, path + '.' + k)
        elif isinstance(value, list):
            for i, v in enumerate(value):
                collect_nulls(v, path + '.' + str(i))
    collect_nulls(response['facts'], 'facts')
    verify('every_null_has_reason', set(response['null_reasons']) == null_paths and all(response['null_reasons'].values()))
    verify('synthetic_scope_explicit', response['scope'] == 'D003B synthetic reported scope')
    verify('support_separate_from_guard', response['substantive_answer'] == (response['status'] == 'answered'))
    verify('completeness_enum', response['completeness'] in {'complete', 'partial', 'sample', 'unknown'})
    complete_cases = {'CQ01-1', 'CQ01-4', 'CQ02-1', 'CQ02-4', 'CQ04-1', 'CQ05-1', 'CQ05-2',
                      'CQ12-1', 'CQ12-4', 'CQ17-1', 'CQ23-4', 'CQ28-4'}
    if test['id'] in complete_cases:
        verify('complete_within_reported_scope', response['completeness'] == 'complete')
    if test['id'] == 'CQ04-3':
        verify('unknown_total_paid_conditions', response['completeness'] == 'unknown')
    if test['id'] in {'CQ02-3', 'CQ05-3', 'CQ06-3', 'CQ11-1', 'CQ11-3', 'CQ11-4', 'CQ12-3', 'CQ17-3', 'CQ17-4', 'CQ23-1', 'CQ23-3', 'CQ28-1', 'CQ05-4', 'CQ06-1', 'CQ07-1'}:
        verify('partial_preserved', response['completeness'] == 'partial')
    if test['id'] in {'CQ23-1', 'CQ23-3'}:
        us = response['facts']['countries']['US']
        verify('US_local_release_not_yet_available', us['sales'] is None and us['own_net_sales'] is None
               and us['available_months'] == ['2026-07-01', '2026-08-01']
               and us['missing_months'] == ['2026-09-01'] and us['completeness'] == 'partial')
    if test['id'] in {'CQ14-3', 'CQ15-2', 'CQ15-3'}:
        verify('sample_preserved', response['completeness'] == 'sample')
    if test['id'] == 'CQ28-3':
        verify('unknown_for_unsupported', response['completeness'] == 'unknown')
    if test['id'] in {'CQ01-4', 'CQ12-4'}:
        social = expected['monthly_ads']['C-JP-social']
        verify('countercondition_present', D(social['2026']['known_subtotals']['attributed_revenue']) > D(social['2025']['known_subtotals']['attributed_revenue'])
               and D(expected['own' if test['id'] == 'CQ12-4' else 'market']['net_sales_change']['absolute'] if test['id'] == 'CQ12-4' else expected['market']['P1A']['sales_change']['absolute']) < 0)
    if test['id'] == 'CQ02-1':
        verify('opposing_product_directions', D(expected['market']['P1A']['units_change']['absolute']) < 0 < D(expected['market']['P2A']['units_change']['absolute']))
    if test['id'] == 'CQ06-1':
        verify('seven_zero_snapshots', expected['stock']['zero_snapshot_count'] == 7)
    if test['id'] in {'CQ06-3', 'CQ11-1', 'CQ11-4'}:
        detail = expected['daily_ads']['C-JP-social']['detail']
        log = expected['logs']['C-JP-social']
        verify('collection_reconciliation', detail['rows'] == 28 and detail['received'] == 26
               and detail['missing_dates'] == ['2026-08-26', '2026-08-27'] and detail['complete_totals'] is None
               and log['expected_count'] == log['received_count'] + log['missing_count'] == 28)
    if test['id'] == 'CQ11-1':
        week = response['facts']['daily_ads']['C-JP-social']['weeks']['2026-08-24']
        verify('partial_week_known_subtotal', week['normalized_rows'] == 7 and week['received_rows'] == 5 and week['completeness'] == 'partial')
    return checks
