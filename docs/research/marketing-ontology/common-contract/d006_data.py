"""Scoped D006 sources, validation and deterministic memory-only input branches.

Generation is an explicit command; importing this module never generates records.
Existing source files and the original 52-test contract are immutable.
"""
import argparse
from collections import Counter
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from decimal import Decimal as D
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
BATCHES = HERE.parent / 'batches'
VERSION = 'D006-1.0.0'
ASOF = '2026-10-06T00:00:00+09:00'
COUNTS = {'D006-CQ-A': {'T24': 1, 'T25': 2},
          'D006-CQ-B': {'T08': 4, 'T22': 6, 'T12': 4, 'T13': 11, 'T03': 4, 'T24': 20, 'T36': 4}}
A_CASES = {'CQ01-2': ['collision'], 'CQ01-3': ['missing_month'], 'CQ02-2': ['zero_baseline'],
           'CQ06-4': ['recovery_counter'], 'CQ07-3': ['missing_clicks'], 'CQ07-4': ['half_spend'],
           'CQ11-2': ['bad_counts'], 'CQ12-2': ['different_definition'],
           'CQ14-1': ['aspects'], 'CQ14-2': ['wrong_product', 'wrong_span'],
           'CQ14-4': ['mixed_aspects'], 'CQ17-2': ['foreign_price', 'future_promotion'],
           'CQ28-2': ['remove_evidence', 'early_asof', 'replay', 'unrelated']}
B_CASES = {'CQ04-2': ['money_boundary'], 'CQ04-4': ['shipping_reverse'],
           'CQ06-2': ['time_boundaries'], 'CQ07-2': ['revision'],
           'CQ15-1': ['review_sample'], 'CQ15-4': ['review_composition'],
           'CQ23-2': ['country_time_money']}
FAULTS = ['ambiguous_fall', 'nonexistent_spring', 'overlapping_config', 'snapshot_gap',
          'unknown_scale', 'fractional_minor', 'missing_seller', 'null_rating',
          'duplicate_review', 'review_count_mismatch']


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def stable(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), default=str)


def fingerprint(value):
    return hashlib.sha256(stable(value).encode()).hexdigest()


def write_new(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('x', encoding='utf-8', newline='\n') as stream:
        stream.write(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def load(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def authorized(path):
    scope = load(HERE / 'd006-scope.json')
    approval = load(path) if path else {}
    if not (approval.get('approved') is True and approval.get('scope_id') == scope['scope_id']
            and approval.get('scope_sha256') == fingerprint(scope)
            and approval.get('source') == 'explicit_human_response'
            and approval.get('user_message') and approval.get('recorded_at')):
        raise PermissionError('D006 approval missing or does not match the explicit scope')
    for p, digest in scope['immutable_inputs'].items():
        if sha(ROOT / p) != digest:
            raise ValueError('approved input changed: ' + p)
    return scope


def base_sources():
    rows, refs = {}, {}
    manifest = load(BATCHES / 'D003B/manifest.json')
    for name, spec in manifest['files'].items():
        path = BATCHES / 'D003B/source' / name
        if sha(path) != spec['sha256']:
            raise ValueError('D003B manifest mismatch: ' + name)
        lines = path.read_text(encoding='utf-8').splitlines()
        if len(lines) != spec['records']:
            raise ValueError('D003B row count mismatch')
        for i, line in enumerate(lines, 1):
            row = json.loads(line)
            rows[row['record_id']] = row
            refs[row['record_id']] = {'file': row['source_file'], 'sha256': sha(path), 'line': i, 'record_id': row['record_id']}
    return rows, refs


def wrapper(batch, typ, n, payload, country='JP', zone='Asia/Tokyo', available='2026-09-02T12:00:00+09:00', parents=()):
    prefix = 'D006' if batch.endswith('-A') else 'D006B'
    return {'source_profile': 'A', 'metadata': {
        'record_id': f'{prefix}-{typ}-{n:04}', 'dataset_type': typ, 'country_code': country,
        'scenario_id': batch, 'scope_id': batch + '-' + country, 'is_synthetic': True,
        'value_origin': 'annotation' if typ == 'T25' else 'simulation', 'available_at': available,
        'reporting_timezone': zone, 'source_file': f'docs/research/marketing-ontology/batches/{batch}/source/{typ}.jsonl',
        'parent_record_ids': list(parents), 'quality': 'synthetic_sample'}, 'payload': payload}


def proposed_rows(original):
    """The approved deterministic generation rules; no random or inferred values."""
    a, b = [], []
    review = '향은 마음에 들지 않았지만 거품은 잘 났습니다.'
    a.append(wrapper('D006-CQ-A', 'T24', 1, {
        'review_id': 'D006-R-P1A-JP-1', 'product_id': 'P1A', 'written_at': '2026-08-20T12:00:00+09:00',
        'language': 'ko', 'body_text': review, 'rating_value': 3, 'rating_scale_max': 5, 'verified_purchase': None},
        available='2026-08-20T13:00:00+09:00', parents=['D003B-T01-0001']))
    for i, (aspect, sentiment, quote, start, end) in enumerate([
            ('향', 'negative', '향은 마음에 들지 않았지만', 0, 14),
            ('거품', 'positive', '거품은 잘 났습니다', 15, 25)], 1):
        a.append(wrapper('D006-CQ-A', 'T25', i, {'record_kind': 'annotation', 'review_ref': 'D006-T24-0001',
            'product_ref': 'P1A', 'aspect': aspect, 'sentiment': sentiment,
            'evidence_span': {'quote': quote, 'start': start, 'end': end}, 'assessment_status': 'provided'},
            available='2026-08-20T14:00:00+09:00', parents=['D006-T24-0001']))
    for i, (raw, scale) in enumerate([('1234000000', 'micros'), ('1234.00', 'decimal')], 1):
        b.append(wrapper('D006-CQ-B', 'T08', i, {'case_kind': 'scale', 'product_id': 'P2A', 'seller_id': 'S-JP',
            'observed_at': '2026-08-24T08:59:59+09:00', 'volume_ml': 300, 'amount_raw': raw,
            'amount_scale': scale, 'currency': 'JPY', 'tax_included': True, 'shipping_included': False}))
    for i, (product, price, shipping) in enumerate([('P1A', '1000.00', '300.00'), ('P2A', '1100.00', '100.00')], 3):
        b.append(wrapper('D006-CQ-B', 'T08', i, {'case_kind': 'shipping', 'product_id': product, 'seller_id': 'S-JP',
            'observed_at': '2026-08-20T09:00:00+09:00', 'volume_ml': 300, 'amount_raw': price,
            'amount_scale': 'decimal', 'currency': 'JPY', 'tax_included': True, 'shipping_included': False,
            'shipping_fee': shipping, 'destination': 'JP-test-destination', 'quantity': 1, 'shipping_rule': 'flat_per_order'}))
    for j, (day, endday, hours, before, after) in enumerate([
            ('2025-11-02', '2025-11-03', 25, '-04:00', '-05:00'),
            ('2026-03-08', '2026-03-09', 23, '-05:00', '-04:00')]):
        start, end = day + 'T00:00:00' + before, endday + 'T00:00:00' + after
        boundary = day + ('T01:00:00-05:00' if j == 0 else 'T03:00:00-04:00')
        available = endday + 'T12:00:00' + after
        for k, (clock, offset, amount) in enumerate([('00:30:00', before, 0), ('03:30:00', after, 1), ('04:30:00', after, 1)]):
            b.append(wrapper('D006-CQ-B', 'T22', j * 3 + k + 1, {'product_id': 'P1A', 'location_id': 'L-US',
                'observed_at': day + 'T' + clock + offset, 'available_quantity': amount, 'boundary_day': day},
                'US', 'America/New_York', available))
        for k, (left, right, window) in enumerate([(start, boundary, 7), (boundary, end, 1)]):
            b.append(wrapper('D006-CQ-B', 'T12', j * 2 + k + 1, {'campaign_id': 'D006B-C-US', 'target_product_id': 'P1A',
                'conversion_name': 'purchase', 'attribution_model': 'last_click', 'attribution_window_days': window,
                'valid_from': left, 'valid_to_exclusive': right, 'boundary_day': day}, 'US', 'America/New_York', available))
        # Full and partial series are alternatives, never additive observations.
        for k, (account, left, right, role) in enumerate([
                ('NY', start, end, 'full'), ('UTC', start, end, 'full'),
                ('NY', boundary, end, 'partial'), ('UTC', boundary, end, 'partial')]):
            b.append(wrapper('D006-CQ-B', 'T13', j * 4 + k + 1, {'case_kind': 'time', 'campaign_id': 'D006B-C-US',
                'account_id': 'D006B-' + account, 'period_start': left, 'period_end_exclusive': right,
                'series_role': role, 'boundary_day': day, 'grain': 'day', 'impressions': 100, 'clicks': 10,
                'conversions': 1, 'spend': '1.23', 'attributed_revenue': '2.46', 'currency': 'USD'},
                'US', 'America/New_York' if account == 'NY' else 'UTC', available))
        for k, (country, currency, raw, zone) in enumerate([
                ('US', 'USD', '123', 'America/New_York'), ('JP', 'JPY', '1234', 'Asia/Tokyo')]):
            b.append(wrapper('D006-CQ-B', 'T03', j * 2 + k + 1, {'product_id': 'P1A',
                'period_start': start, 'period_end_exclusive': end, 'boundary_day': day,
                'sales_raw': raw, 'amount_scale': 'minor', 'currency': currency, 'units_sold': 1}, country, zone, available))
    for n, (parent, revision, available, increment) in enumerate([
            ('D003B-T13-0179', 1, '2026-09-06T12:00:00+09:00', '100.00'),
            ('D003B-T13-0129', 1, '2026-09-06T12:00:00+09:00', '100.00'),
            ('D003B-T13-0179', 2, '2026-10-07T12:00:00+09:00', '200.00')], 9):
        source = original[parent]
        payload = {k: source[k] for k in ['campaign_id', 'period_start', 'period_end_exclusive', 'grain', 'series_role',
                   'impressions', 'clicks', 'conversions', 'spend', 'attributed_revenue', 'currency']}
        payload.update(case_kind='revision', logical_key=parent, revision=revision,
                       supersedes_record_id='D006B-T13-0009' if revision == 2 else parent,
                       spend=f'{D(source["spend"]) + D(increment):.2f}')
        b.append(wrapper('D006-CQ-B', 'T13', n, payload, available=available,
                         parents=[payload['supersedes_record_id']]))
    for period_index, (start, end, na, nb) in enumerate([('2026-08-03', '2026-08-17', 8, 2), ('2026-08-17', '2026-08-31', 2, 8)]):
        for seller_index, (seller, count) in enumerate([('D006B-S-A', na), ('D006B-S-B', nb)]):
            run_id = f'D006B-RUN-{period_index}-{seller_index}'
            available = (datetime.fromisoformat(end) + timedelta(days=1)).date().isoformat() + 'T12:00:00+09:00'
            b.append(wrapper('D006-CQ-B', 'T36', period_index * 2 + seller_index + 1, {
                'run_id': run_id, 'target_dataset': 'T24', 'product_id': 'P1A', 'seller_id': seller,
                'expected_start': start, 'expected_end_exclusive': end, 'expected_count': count,
                'received_count': count, 'missing_count': 0, 'status': 'success',
                'sampling_method': 'synthetic_fixed_seller_quota', 'coverage_kind': 'sample'}, available=available))
            for k in range(count):
                n = sum(r['metadata']['dataset_type'] == 'T24' for r in b) + 1
                written = (datetime.fromisoformat(start) + timedelta(days=k)).date().isoformat() + 'T12:00:00+09:00'
                b.append(wrapper('D006-CQ-B', 'T24', n, {'review_id': f'D006B-R-{n:04}', 'product_id': 'P1A',
                    'seller_id': seller, 'collection_run_id': run_id, 'written_at': written, 'language': 'ko',
                    'body_text': '승인된 별점 표본 검증용 가상 리뷰입니다.',
                    'rating_value': [3, 4, 5][k % 3] if seller_index == 0 else [1, 2][k % 2],
                    'rating_scale_max': 5, 'verified_purchase': None}, available=available))
    return {'D006-CQ-A': a, 'D006-CQ-B': b}


def generate(approval):
    scope = authorized(approval)
    for name in COUNTS:
        if (BATCHES / name).exists():
            raise FileExistsError('existing D006 batch refused: ' + name)
    original, _ = base_sources()
    groups = proposed_rows(original)
    schema = subprocess.run(['node', str(HERE / 'd006-schema.mjs')], input=json.dumps([r for part in groups.values() for r in part], ensure_ascii=False),
                            text=True, encoding='utf-8', capture_output=True)
    if schema.returncode != 0:
        raise ValueError('D006 source schema preflight failed: ' + schema.stdout[:2500] + schema.stderr[:500])
    candidate = {**original, **{r['metadata']['record_id']: {**r['metadata'], **r['payload']} for part in groups.values() for r in part}}
    if semantic_errors(candidate):
        raise ValueError('D006 semantic preflight failed: ' + str(semantic_errors(candidate)))
    for name, rows in groups.items():
        if Counter(r['metadata']['dataset_type'] for r in rows) != COUNTS[name]:
            raise ValueError('generation count mismatch')
        files = []
        for typ, count in COUNTS[name].items():
            path = BATCHES / name / 'source' / (typ + '.jsonl')
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open('x', encoding='utf-8', newline='\n') as f:
                for row in rows:
                    if row['metadata']['dataset_type'] == typ:
                        f.write(json.dumps(row, ensure_ascii=False, separators=(',', ':')) + '\n')
            files.append({'path': path.relative_to(ROOT).as_posix(), 'rows': count, 'sha256': sha(path)})
        write_new(BATCHES / name / 'manifest.json', {'version': VERSION, 'scope_id': name, 'rows': len(rows),
            'files': files, 'scope_sha256': fingerprint(scope), 'approval_sha256': sha(approval),
            'generator_sha256': sha(Path(__file__)), 'source_rewrites': 0, 'permanent_RDF_or_DB': False})
    write_new(BATCHES / 'D006-CQ-B/sellers.json', [{'seller_id': 'D006B-S-' + x,
        'country_code': 'JP', 'is_synthetic': True, 'scope_id': 'D006-CQ-B'} for x in ['A', 'B']])
    return {'rows': 56, 'files': 9, 'seller_declarations': 2}


def sources(approval):
    authorized(approval)
    lock = load(HERE / 'd006-input-lock.json')
    if lock['scope_id'] != 'D006-CQ-AB-1' or sha(ROOT / lock['generation_evidence']) != lock['generation_evidence_sha256']:
        raise ValueError('D006 generation evidence lock mismatch')
    for path, digest in lock['files'].items():
        if sha(ROOT / path) != digest:
            raise ValueError('immutable generated D006 file changed: ' + path)
    rows, refs = base_sources()
    for name, counts in COUNTS.items():
        manifest = load(BATCHES / name / 'manifest.json')
        if manifest['scope_sha256'] != fingerprint(load(HERE / 'd006-scope.json')):
            raise ValueError('D006 manifest scope mismatch')
        if {Path(f['path']).stem: f['rows'] for f in manifest['files']} != counts:
            raise ValueError('D006 manifest count mismatch')
        for spec in manifest['files']:
            path = ROOT / spec['path']
            if sha(path) != spec['sha256']:
                raise ValueError('D006 source hash mismatch')
            lines = path.read_text(encoding='utf-8').splitlines()
            if len(lines) != spec['rows']:
                raise ValueError('D006 source count mismatch')
            for i, line in enumerate(lines, 1):
                raw = json.loads(line)
                row = {**raw['metadata'], **raw['payload']}
                rid = row['record_id']
                if rid in rows:
                    raise ValueError('duplicate record identity')
                rows[rid] = row
                refs[rid] = {'file': spec['path'], 'sha256': spec['sha256'], 'line': i, 'record_id': rid}
    # Only the two explicitly approved D005 annotations are added to question input.
    path = BATCHES / 'D005/source/T25.jsonl'
    for i, line in enumerate(path.read_text(encoding='utf-8').splitlines(), 1):
        raw = json.loads(line)
        if raw['metadata']['record_id'] not in {'D005-T25-0009', 'D005-T25-0011'}:
            continue
        p = raw['payload']
        if raw['source_profile'] == 'B':
            p = {re.sub(r'(?<!^)(?=[A-Z])', '_', k).lower(): v for k, v in p.items()}
        row = {**raw['metadata'], **p}
        rows[row['record_id']] = row
        refs[row['record_id']] = {'file': path.relative_to(ROOT).as_posix(), 'sha256': sha(path), 'line': i, 'record_id': row['record_id']}
    return rows, refs


def amount(raw, scale, currency):
    if scale not in {'decimal', 'minor', 'micros'}:
        raise ValueError('unknown_scale')
    if scale != 'decimal' and not re.fullmatch(r'-?\d+', raw):
        raise ValueError('fractional_minor')
    value = D(raw) / (D(1000000) if scale == 'micros' else D(100) if scale == 'minor' and currency == 'USD' else D(1))
    if value * (100 if currency == 'USD' else 1) != (value * (100 if currency == 'USD' else 1)).to_integral_value():
        raise ValueError('fractional_minor')
    return value


def semantic_errors(rows):
    errors = []
    by_review = {r['record_id']: r for r in rows.values() if 'body_text' in r}
    configs = []
    for rid, r in rows.items():
        if 'received_count' in r and r['expected_count'] != r['received_count'] + r['missing_count']:
            errors.append((rid, 'count_mismatch'))
        if 'evidence_span' in r:
            parent = by_review.get(r['review_ref'])
            span = r['evidence_span']
            if not parent or parent['product_id'] != r['product_ref']:
                errors.append((rid, 'review_product_mismatch'))
            elif not (0 <= span['start'] < span['end'] <= len(parent['body_text'])) or parent['body_text'][span['start']:span['end']] != span['quote']:
                errors.append((rid, 'span_mismatch'))
            elif datetime.fromisoformat(r['available_at']) < datetime.fromisoformat(parent['available_at']):
                errors.append((rid, 'parent_not_available'))
        if rid.startswith('D006B-'):
            if 'currency' in r and r['currency'] != {'JP':'JPY','US':'USD'}[r['country_code']]:
                errors.append((rid, 'currency_country_mismatch'))
            for parent_id in r.get('parent_record_ids', []):
                if parent_id not in rows or datetime.fromisoformat(rows[parent_id]['available_at']) > datetime.fromisoformat(r['available_at']):
                    errors.append((rid, 'invalid_parent_or_availability'))
            for field in ['product_id', 'target_product_id', 'product_ref']:
                if field in r and r[field] not in {'P1A','P2A'}:
                    errors.append((rid, 'product_reference'))
            if 'written_at' in r and datetime.fromisoformat(r['written_at']) > datetime.fromisoformat(r['available_at']):
                errors.append((rid, 'written_after_available'))
            for event_field in ['observed_at','period_end_exclusive']:
                if event_field in r:
                    event_time=datetime.fromisoformat(r[event_field])
                    if event_time.tzinfo is not None and datetime.fromisoformat(r['available_at'])<event_time:
                        errors.append((rid, 'event_after_available'))
            if 'valid_from' in r and datetime.fromisoformat(r['valid_from'])>=datetime.fromisoformat(r['valid_to_exclusive']):
                errors.append((rid, 'invalid_configuration_interval'))
            for field in ('observed_at', 'valid_from', 'valid_to_exclusive'):
                if field in r:
                    text = r[field]
                    dt = datetime.fromisoformat(text)
                    zone = ZoneInfo(r['reporting_timezone'])
                    if dt.tzinfo is None:
                        errors.append((rid, 'ambiguous_local_time'))
                    elif dt.astimezone(timezone.utc).astimezone(zone).replace(tzinfo=None) != dt.replace(tzinfo=None):
                        errors.append((rid, 'nonexistent_local_time'))
            if r.get('dataset_type') == 'T12':
                configs.append(r)
            if 'amount_scale' in r:
                try:
                    amount(r.get('amount_raw', r.get('sales_raw')), r['amount_scale'], r['currency'])
                except ValueError as e:
                    errors.append((rid, str(e)))
            if r.get('dataset_type') == 'T24' and r.get('seller_id') not in {'D006B-S-A', 'D006B-S-B'}:
                errors.append((rid, 'seller_missing'))
    for i, left in enumerate(configs):
        for right in configs[i + 1:]:
            if left['boundary_day'] == right['boundary_day'] and max(datetime.fromisoformat(left['valid_from']), datetime.fromisoformat(right['valid_from'])) < min(datetime.fromisoformat(left['valid_to_exclusive']), datetime.fromisoformat(right['valid_to_exclusive'])):
                errors.append((left['record_id'], 'config_overlap'))
    for r in rows.values():
        if r.get('target_dataset') == 'T24':
            actual = [x for x in rows.values() if x.get('collection_run_id') == r['run_id']]
            if len(actual) != r['received_count']:
                errors.append((r['record_id'], 'review_collection_mismatch'))
            if any(x.get('seller_id') != r['seller_id'] or x['product_id'] != r['product_id'] or not r['expected_start'] <= x['written_at'][:10] < r['expected_end_exclusive'] for x in actual):
                errors.append((r['record_id'], 'review_collection_scope'))
    return sorted(errors)


def branch(test, name, original):
    rows = deepcopy(original)
    cutoff = ASOF
    def edit(rid, **changes):
        rows[rid].update(changes)
    if name in {'collision', 'foreign_price', 'future_promotion'}:
        edit('D003B-T01-0003', product_name=rows['D003B-T01-0001']['product_name'])
    if name == 'missing_month':
        del rows['D003B-T03-0279']
    elif name == 'zero_baseline':
        for n in [199, 205, 211]:
            edit(f'D003B-T03-{n:04}', units_sold=0, sales_value='0.00')
    elif name == 'recovery_counter':
        for r in rows.values():
            if r['record_id'].startswith('D003B-T13-') and r['country_code'] == 'JP' and r['grain'] == 'day' and '2026-08-19' <= r['period_start'] < '2026-08-31' and r['conversions'] is not None:
                r.update(conversions=0, attributed_revenue='0.00')
    elif name == 'missing_clicks':
        edit('D003B-T13-0129', **{f: None for f in ['impressions', 'clicks', 'conversions', 'spend', 'attributed_revenue']}, availability='missing')
    elif name == 'half_spend':
        for n in [178, 179, 180]:
            rid = f'D003B-T13-{n:04}'
            edit(rid, spend=f'{D(rows[rid]["spend"]) / 2:.2f}')
    elif name == 'bad_counts':
        edit('D003B-T36-0004', received_count=25)
    elif name == 'different_definition':
        edit('D003B-T12-0004', attribution_model='first_click', attribution_window_days=1)
    elif name == 'wrong_product':
        edit('D006-T25-0001', product_ref='P2A')
    elif name == 'wrong_span':
        rows['D006-T25-0001']['evidence_span']['start'] += 1
    elif name == 'future_promotion':
        edit('D003B-T09-0001', available_at='2026-10-06T00:00:01+09:00')
    elif name == 'remove_evidence':
        del rows['D003B-T03-0283']
    elif name == 'early_asof':
        cutoff = '2026-09-30T00:00:00+09:00'
    elif name == 'replay':
        rows = dict(reversed(list(rows.items())))
    # In the unrelated branch the KR row is added to the 214-row D004 small input
    # by the runner, not invented or duplicated in the full source dictionary.
    return rows, cutoff


def fault(name, original):
    rows = deepcopy(original)
    if name == 'ambiguous_fall':
        rows['D006B-T22-0002']['observed_at'] = '2025-11-02T01:30:00'
    elif name == 'nonexistent_spring':
        rows['D006B-T22-0005']['observed_at'] = '2026-03-08T02:30:00-05:00'
    elif name == 'overlapping_config':
        rows['D006B-T12-0002']['valid_from'] = '2025-11-02T00:45:00-04:00'
    elif name == 'snapshot_gap':
        del rows['D006B-T22-0002']
    elif name == 'unknown_scale':
        rows['D006B-T08-0001']['amount_scale'] = 'unregistered'
    elif name == 'fractional_minor':
        rows['D006B-T03-0001']['sales_raw'] = '123.5'
    elif name == 'missing_seller':
        del rows['D006B-T24-0001']['seller_id']
    elif name == 'null_rating':
        rows['D006B-T24-0001']['rating_value'] = None
    elif name == 'duplicate_review':
        # Same source identity is replayed as a list entry by the runner.
        pass
    elif name == 'review_count_mismatch':
        rows['D006B-T36-0001']['received_count'] = 7
    else:
        raise ValueError('unregistered fault')
    return rows


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('command', choices=['generate'])
    p.add_argument('--approval-record', type=Path, required=True)
    args = p.parse_args()
    print(json.dumps(generate(args.approval_record), ensure_ascii=False))
