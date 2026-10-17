"""Independent Decimal/ZoneInfo checks and existing-SHACL domain readback for D007."""
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from decimal import Decimal as D, ROUND_FLOOR
import hashlib
import json
from pathlib import Path
import sys
from urllib.parse import quote
from zoneinfo import ZoneInfo


def read(file):
    return [json.loads(line) for line in file.read_text(encoding='utf-8').splitlines() if line]


def amount(value):
    return D(value['amount'])


def field_unit(field, value, record):
    # Missing money remains money; inferring units from a null value changes the metric.
    if field in ('spend', 'attributed_value', 'sales_value', 'line_gross_total', 'refund_amount') or isinstance(value, dict):
        return 'money'
    return 'score' if field == 'rating_value' else record.get('unit', 'count')


def verify(rows, registry, ledger):
    by_id = {r['record_id']: r for r in rows}
    by_type = defaultdict(list)
    for r in rows:
        by_type[r['dataset_type']].append(r)
    checks = []
    def done(name):
        checks.append({'name': name, 'status': 'pass'})
    assert len(rows) == len(by_id) == 20000
    for r in rows:
        available = datetime.fromisoformat(r['temporal']['available_at'].replace('Z', '+00:00'))
        zone = ZoneInfo(r['temporal']['reporting_timezone'])
        for field in ('observed_at', 'ordered_at', 'event_time', 'requested_at', 'processed_at', 'written_at', 'sent_at', 'delivered_at'):
            if field in r:
                instant = datetime.fromisoformat(r[field].replace('Z', '+00:00'))
                assert instant <= available
                assert instant.utcoffset() == instant.astimezone(zone).utcoffset(), (r['record_id'], field)
        for field in ('period', 'planned_period', 'expected_period', 'training_period'):
            if field in r:
                assert r[field]['start'] < r[field]['end_exclusive']
    done('actual_timezone_offsets_half_open_windows_and_availability')
    for line in by_type['T19']:
        assert amount(line['line_gross_total']) == amount(line['unit_price']) * D(line['quantity']) - amount(line['line_discount']) + amount(line['line_tax'])
        refunds = [a for a in by_type['T20'] if a['order_line_ref'] == line['line_id'] and a['adjustment_kind'] == 'refund' and a['status'] == 'completed']
        refunded = sum((amount(a['refund_amount']) for a in refunds), D(0))
        assert refunded <= amount(line['line_gross_total'])
        assert all(a['order_ref'] == line['order_id'] and a['quantity'] <= line['quantity'] for a in refunds)
        expected = 'paid' if refunded == 0 else 'refunded' if refunded == amount(line['line_gross_total']) else 'partially_refunded'
        assert line['financial_status'] == expected
    done('decimal_order_refund_and_financial_status')
    for cohort in by_type['T30']:
        parents = [by_id[x] for x in cohort['related_record_ids']]
        lines = [r for r in parents if r['dataset_type'] == 'T19']
        refunds = [r for r in parents if r['dataset_type'] == 'T20']
        orders = {r['order_id']: r['customer_pseudo_ref'] for r in lines}
        frequencies = Counter(orders.values())
        expected = sum((amount(r['line_gross_total']) for r in lines), D(0)) - sum((amount(r['refund_amount']) for r in refunds), D(0))
        assert expected == amount(cohort['net_revenue'])
        assert len(frequencies) == cohort['sample_size']
        rate = sum(1 for n in frequencies.values() if n > 1) / len(frequencies) if frequencies else 0
        assert rate == cohort['repeat_purchase_rate']
        assert all(cohort['period']['start'] <= r['ordered_at'][:10] < cohort['period']['end_exclusive'] for r in lines)
    done('cohort_denominators_repeat_customers_and_net_revenue')
    for price in by_type['T08']:
        parents = [by_id[x] for x in price.get('related_record_ids', [])]
        promotion = next((x for x in parents if x['dataset_type'] == 'T09'), None)
        if promotion:
            quantum = D('.01') if price['listed_price']['currency'] == 'USD' else D(1)
            expected = (amount(price['regular_price']) * (D(1) - D(str(promotion['discount_ratio'])))).quantize(quantum, rounding=ROUND_FLOOR)
            assert amount(price['listed_price']) == expected, price['record_id']
        else:
            assert price['listed_price'] == price['regular_price']
    done('decimal_currency_quantum_discounts')
    children = defaultdict(list)
    for r in by_type['T14']:
        children[r['parent_report_ref']].append(r)
    for parent in by_type['T13']:
        if parent['temporal']['series_role'] != 'detail':
            continue
        assert len(children[parent['record_id']]) == 2
        for key, value in parent['metrics'].items():
            parts = [x['metrics'][key] for x in children[parent['record_id']]]
            if value is None:
                assert parts == [None, None]
            elif isinstance(value, dict):
                assert sum((amount(x) for x in parts), D(0)) == amount(value)
            else:
                assert sum(D(str(x)) for x in parts) == D(str(value))
    done('independent_decimal_ad_partition_and_null_preservation')
    for entry in ledger:
        if 'aggregation' not in entry:
            continue
        a = entry['aggregation']
        known = [by_id[x] for x in a['known_detail_ids']]
        monthly = by_id[entry['record_id']]
        assert len(known) + a['residual_days'] == 31
        for key, value in monthly['metrics'].items():
            if isinstance(value, dict):
                assert amount(value) == sum((amount(r['metrics'][key]) for r in known), D(0)) + amount(a['residual_per_day'][key]) * a['residual_days']
            else:
                assert D(str(value)) == sum((D(str(r['metrics'][key])) for r in known), D(0)) + D(str(a['residual_per_day'][key])) * a['residual_days']
    done('monthly_detail_residual_reconciliation_without_hidden_rows')
    for annotation in by_type['T25']:
        review = by_id[annotation['review_ref']]
        span = annotation['evidence_span']
        assert review['body_text'][span['start_offset']:span['end_offset']] == span['quote']
        assert review['subject_ref'] == annotation['subject_ref']
    done('unicode_review_quote_offsets_and_subjects')
    for r in by_type['H01']:
        values = {x['metric_id'].removeprefix('D007.'): x['value'] for x in r['measures']}
        assert values['gross_units'] - values['returned_units'] == values['net_units']
        assert amount(values['gross_sales']) - amount(values['returns_value']) == amount(values['net_sales'])
    for r in by_type['T39']:
        if r['record_kind'] != 'budget_scenario':
            continue
        assert sum((amount(x['amount']) for x in r['allocations']), D(0)) == amount(r['total_budget'])
        assert all(amount(x['lower']) <= amount(x['amount']) <= amount(x['upper']) for x in r['allocations'])
        model = by_id[r['related_record_ids'][0]]
        params = {x['name']: D(x['value']) for x in model['parameters']}
        factor = D(100) if r['total_budget']['currency'] == 'USD' else D(1)
        predicted = sum((params['scale'] * amount(a['amount']) * factor / (params['saturation'] + amount(a['amount']) * factor) for a in r['allocations']), D(0))
        assert abs(predicted - D(str(r['expected_measures'][0]['value']))) < D('1e-10')
    done('historical_sales_and_budget_response_independent_decimal')
    missing = [r for r in by_type['T13'] if r['metrics']['spend'] is None]
    assert missing
    for r in missing:
        assert field_unit('spend', r['metrics']['spend'], r) == 'money'
        assert field_unit('attributed_value', r['metrics']['attributed_value'], r) == 'money'
    done('missing_monetary_metric_units_remain_money')
    return {'status': 'pass', 'checks': checks, 'rows': len(rows)}


def project(rows, registry, batch, progress):
    from rdflib import Graph, Literal, Namespace, RDF, URIRef, XSD
    from pyshacl import validate
    contract = batch.parent.parent / 'common-contract'
    m = Namespace('https://example.org/marketing/')
    g = Graph()
    shapes = Graph().parse(contract / 'shapes.ttl', format='turtle')
    shapes.parse(contract / 'property-use-shapes.ttl', format='turtle')
    def node(kind, value):
        return URIRef('urn:D007:' + kind + ':' + quote(str(value), safe=''))
    def add(subject, predicate, value, datatype=None):
        g.add((subject, m[predicate], Literal(value, datatype=datatype)))
    transformation = node('transformation', 'canonical')
    g.add((transformation, RDF.type, m.Transformation))
    add(transformation, 'mappingVersion', 'D007-1')
    add(transformation, 'codeVersion', hashlib.sha256((batch / 'generate.mjs').read_bytes()).hexdigest())
    def provenance(subject, source):
        g.add((subject, m.sourceRecord, source))
        g.add((subject, m.generatedBy, transformation))
    def interval(window):
        key = json.dumps(window, sort_keys=True)
        when = node('interval', key)
        g.add((when, RDF.type, m.TimeInterval))
        for p, value, dt in [('startDate', window['start'], XSD.date), ('endDateExclusive', window['end_exclusive'], XSD.date),
                             ('timezone', window['timezone'], None), ('calendar', 'Gregorian', None), ('grain', window['grain'], None)]:
            add(when, p, value, dt)
        return when
    hashes = {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in (batch / 'source').glob('*.jsonl')}
    definitions = {d['id']: d for d in registry['definitions']}
    expected, metric_units = {}, {}
    for row_number, r in enumerate(rows, 1):
        source = node('source', r['record_id'])
        artifact = node('artifact', r['provenance']['artifact_ref'])
        g.add((source, RDF.type, m.SourceRecord));g.add((artifact, RDF.type, m.SourceArtifact))
        g.add((source, m.artifact, artifact))
        add(artifact, 'path', r['provenance']['artifact_ref'])
        add(artifact, 'sha256', hashes[str(batch / 'source' / (r['dataset_type'] + '.jsonl'))])
        for p, value, dt in [('recordId', r['record_id'], None), ('identifierNamespace', 'D007', None), ('sourceLine', int(r['record_id'].rsplit('-', 1)[1]), XSD.integer),
                             ('availableAt', r['temporal']['available_at'], XSD.dateTime), ('revision', 0, XSD.integer)]:
            add(source, p, value, dt)
        timestamp = r.get(r['temporal'].get('timestamp_field', ''), r['temporal']['available_at'])
        if 'T' not in timestamp:
            # A date-only validity boundary is not an instant. Use creation context,
            # while the original validity date remains in the canonical source.
            timestamp = r['temporal']['available_at']
        local_date = datetime.fromisoformat(timestamp.replace('Z', '+00:00')).astimezone(ZoneInfo(r['temporal']['reporting_timezone'])).date()
        window = r.get('period', {'start': local_date.isoformat(), 'end_exclusive': (local_date + timedelta(days=1)).isoformat(), 'timezone': r['temporal']['reporting_timezone'], 'grain': 'day'})
        when = interval(window)
        scope = node('scope', r['scope_id'] + '/' + json.dumps(window, sort_keys=True))
        g.add((scope, RDF.type, m.MarketScope));g.add((scope, m.validInterval, when));provenance(scope, source)
        for p, value in [('country', r['scope_id'].split('-')[1]), ('category', 'synthetic shampoo'), ('coverageText', r['quality']['coverage'])]:
            add(scope, p, value)
        subject = node('subject', r.get('subject_ref', r.get('variant_ref', r.get('campaign_ref', r['scope_id']))))
        g.add((subject, RDF.type, m.Subject))
        measures = []
        for collection in ('measures', 'outcome_measures', 'expected_measures', 'distribution_measures'):
            measures.extend((collection + '/' + str(i), item) for i, item in enumerate(r.get(collection, [])))
        if 'metrics' in r:
            measures.extend(('metrics/' + key, {'metric_id': 'D007.' + r['dataset_type'] + '.' + key, 'value': value, 'unit': field_unit(key, value, r), 'availability': 'missing' if value is None else 'available', 'definition_version': 'D007-1'}) for key, value in r['metrics'].items())
        for field in ('units_sold', 'sales_value', 'available_quantity', 'rating_value', 'line_gross_total', 'refund_amount', 'value'):
            if field in r:
                value = r[field]
                measures.append((field, {'metric_id': 'D007.' + r['dataset_type'] + '.' + field, 'value': value, 'unit': field_unit(field, value, r), 'availability': 'missing' if value is None else 'available', 'definition_version': 'D007-1'}))
        for field, measure in measures:
            unit_key = measure['metric_id'] + '/' + measure['definition_version']
            if unit_key in metric_units:
                assert metric_units[unit_key] == measure['unit'], unit_key
            metric_units[unit_key] = measure['unit']
            obs = node('observation', r['record_id'] + '/' + field)
            metric = node('metric', measure['metric_id'] + '/' + measure['definition_version'] + '/' + measure['unit'])
            g.add((obs, RDF.type, m.Observation));g.add((metric, RDF.type, m.MetricDefinition));provenance(obs, source)
            for p, value in [('subject', subject), ('scope', scope), ('metric', metric)]:
                g.add((obs, m[p], value))
            if 'period' in r:
                g.add((obs, m.interval, when))
            else:
                instant = node('instant', timestamp + '/' + r['temporal']['reporting_timezone'])
                g.add((instant, RDF.type, m.TimeInstant));g.add((obs, m.instant, instant))
                add(instant, 'timestamp', timestamp, XSD.dateTime);add(instant, 'timezone', r['temporal']['reporting_timezone'])
            definition = definitions.get(measure['metric_id'], {}).get('definition', 'Explicit canonical ' + field + '; compare only matching definition, scope and window')
            for p, value in [('metricId', measure['metric_id']), ('definitionVersion', measure['definition_version']), ('definition', definition), ('unit', measure['unit']), ('aggregation', 'same_scope_definition_currency_disjoint_window_only')]:
                add(metric, p, value)
            origin = 'calculated' if r['value_origin'] == 'derived_calculation' else 'simulated'
            for p, value in [('availability', 'missing' if measure['value'] is None else 'present'), ('originKind', origin), ('fieldPath', '/' + field), ('seriesRole', r['temporal']['series_role'])]:
                add(obs, p, value)
            add(obs, 'isSynthetic', True, XSD.boolean);add(obs, 'availableAt', r['temporal']['available_at'], XSD.dateTime)
            if measure['value'] is None:
                add(obs, 'reason', 'preserved source absence, never zero-filled')
            else:
                value = measure['value']
                if isinstance(value, dict):
                    add(obs, 'currency', value['currency']);value = value['amount']
                decimal = D(str(value));add(obs, 'value', decimal, XSD.decimal);expected[str(obs)] = decimal
        if row_number % 5000 == 0:
            progress('RDF_build', rows=row_number, triples=len(g))
    progress('SHACL_start', rows=len(rows), triples=len(g), observations=len(expected))
    conforms, _, report = validate(g, shacl_graph=shapes, inference='none')
    assert conforms, report[:6000]
    actual = {str(s): D(str(value)) for s, _, value in g.triples((None, m.value, None))}
    assert actual == expected
    # Focused negative validation uses one existing observation; no synthetic error rows are stored.
    target = URIRef(next(iter(expected)))
    original = g.value(target, m.value);g.set((target, m.value, Literal('invalid-number')))
    rejected, _, _ = validate(g, shacl_graph=shapes, inference='none', focus_nodes=[str(target)])
    assert not rejected
    g.set((target, m.value, original))
    digest = hashlib.sha256('\n'.join(sorted(' '.join(x.n3() for x in t) for t in g)).encode()).hexdigest()
    return {'status': 'pass', 'source_records': len(rows), 'domain_values_requeried': len(actual), 'triples': len(g), 'graph_sha256': digest, 'metric_units': metric_units,
            'existing_SHACL': 'pass', 'wrong_numeric_value_rejected': True,
            'scope': 'All source/artifact lineage; metric observations with subject/scope/window. Other fields: canonical schema and independent business checks. No full OWL instance consistency claim.'}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--batch', type=Path, required=True)
    parser.add_argument('--tools', type=Path, required=True)
    parser.add_argument('--progress-file', type=Path)
    args = parser.parse_args()
    if sys.flags.optimize:
        parser.error('Assertions must not be disabled')
    sys.path.insert(0, str(args.tools.resolve()))
    rows = [r for p in sorted((args.batch / 'source').glob('*.jsonl')) for r in read(p)]
    registry = json.loads((args.batch / 'definitions.json').read_text(encoding='utf-8'))
    if args.progress_file and args.progress_file.exists():
        parser.error('progress file must be new')
    def progress(stage, **details):
        if args.progress_file:
            with args.progress_file.open('a', encoding='utf-8') as stream:
                stream.write(json.dumps({'stage': stage, **details}) + '\n')
    result = verify(rows, registry, read(args.batch / 'lineage.jsonl'))
    progress('independent_semantics', status=result['status'], checks=len(result['checks']), rows=len(rows))
    result['RDF'] = project(rows, registry, args.batch, progress)
    progress('RDF_complete', status=result['RDF']['status'])
    result['python_version'] = sys.version
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
