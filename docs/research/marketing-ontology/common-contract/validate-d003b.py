"""Approved D004: validate existing D003B rows with a transient RDF graph."""
import argparse
from collections import Counter, defaultdict
from decimal import Decimal
from datetime import date, timedelta
import hashlib
import importlib.metadata
import json
from pathlib import Path
import sys
from urllib.parse import quote

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / 'batches/D003B/source'
MANIFEST = json.loads((SOURCE.parent / 'manifest.json').read_text(encoding='utf-8'))
MAPPING = json.loads((HERE / 'd003b-mapping.json').read_text(encoding='utf-8'))
SELECTION = json.loads((HERE / 'batch-selection.json').read_text(encoding='utf-8'))
EXPECTED_ROWS = {name: item['records'] for name, item in MANIFEST['files'].items()}
EXPECTED_OBSERVATIONS = {'small': 547, 'full': 4105}


def load_rows(stage):
    selected = {item['type']: set(item['record_ids']) for item in SELECTION['sources']}
    result = {}
    all_ids = set()
    for name, meta in MANIFEST['files'].items():
        raw = (SOURCE / name).read_bytes()
        if hashlib.sha256(raw).hexdigest() != meta['sha256']:
            raise ValueError('source SHA mismatch: ' + name)
        lines = raw.decode('utf-8').splitlines()
        if len(lines) != EXPECTED_ROWS[name]:
            raise ValueError('source count mismatch: ' + name)
        typ = name.removesuffix('.jsonl')
        rows = []
        for line_no, line in enumerate(lines, 1):
            row = json.loads(line)
            if row['record_id'] in all_ids:
                raise ValueError('duplicate record_id: ' + row['record_id'])
            all_ids.add(row['record_id'])
            if stage == 'full' or row['record_id'] in selected[typ]:
                rows.append((line_no, row))
        result[typ] = rows
        if stage == 'small' and {r['record_id'] for _, r in rows} != selected[typ]:
            raise ValueError('selection ID mismatch: ' + typ)
    expected = 214 if stage == 'small' else 1652
    if sum(map(len, result.values())) != expected:
        raise ValueError('selected row count mismatch')
    return result


def ledger(rows):
    """Independent source-field oracle; never imports projection functions."""
    fields = {t['type']: {m['path'][2:]: m['metric_id'] for m in t['mappings'] if m['metric_id']}
              for t in MAPPING['types']}
    values = {}
    denominators = defaultdict(list)
    for typ, items in rows.items():
        for line_no, row in items:
            for field, metric in fields[typ].items():
                key = (row['record_id'], '$.' + field)
                value = row[field]
                if metric == 'market_total':
                    bucket = (row['country_code'], row['period_start'], row['period_end_exclusive'],
                              row['coverage_text'], row['currency'])
                    denominators[bucket].append((key, value))
                else:
                    values[key] = (None if value is None else Decimal(str(value)),
                                   'missing' if value is None else 'present', metric)
    for bucket, entries in denominators.items():
        if len({str(v) for _, v in entries}) != 1:
            raise ValueError('conflicting repeated market denominator: ' + str(bucket))
        key, value = entries[0]
        values[key] = (Decimal(str(value)), 'present', 'market_total')
    return values, {str(key): len(items) for key, items in denominators.items()}


def project(rows, tools_path, *, include_graph=False):
    if tools_path:
        sys.path.insert(0, str(tools_path.resolve()))
    from rdflib import Graph, Literal, Namespace, RDF, URIRef, XSD
    import pyshacl

    m = Namespace('https://example.org/marketing/')
    g = Graph()
    g.bind('m', m)
    mapping_fields = {t['type']: {f['path'][2:]: f['metric_id'] for f in t['mappings'] if f['metric_id']}
                      for t in MAPPING['types']}
    denominator = {}
    record_nodes = {}
    products = {}
    product_brand = {}
    campaigns = {}
    category = {}
    market_owner = {}
    for _, row in rows['T01']:
        products[row['product_id']] = row
        product_brand[row['product_id']] = row['brand_id']
        category[row['product_id']] = row['category_name']
    for _, row in rows['T12']:
        campaigns[row['campaign_id']] = row
    if len(products) != 6:
        raise ValueError('product reference closure incomplete')
    for _, row in rows['T03']:
        bucket = (row['country_code'], row['period_start'], row['period_end_exclusive'],
                  row['coverage_text'], row['currency'])
        market_owner[bucket] = min(market_owner.get(bucket, row['record_id']), row['record_id'])

    def iri(*parts):
        return m['/'.join(quote(str(p), safe='') for p in parts)]

    def lit(value, datatype=None):
        return Literal(value, datatype=datatype) if datatype else Literal(value)

    def add(node, predicate, value, datatype=None):
        g.add((node, m[predicate], lit(value, datatype)))

    def entity(kind, key, source, **attributes):
        node = iri(kind, key)
        g.add((node, m.sourceRecord, source))
        if (node, RDF.type, m[kind]) not in g:
            g.add((node, RDF.type, m[kind]))
            if kind in {'Product', 'Brand', 'Campaign', 'Seller', 'Location'}:
                g.add((node, RDF.type, m.Subject))
            if kind == 'Promotion':
                g.add((node, RDF.type, m.Event))
            g.add((node, m.generatedBy, transformation))
            add(node, 'sourceId', key)
            if kind in {'Product', 'Brand', 'Campaign', 'Seller', 'Location'}:
                add(node, 'identifierNamespace', 'D003B')
            for predicate, value in attributes.items():
                if value is not None:
                    add(node, predicate, value)
        return node

    transformation = iri('Transformation', 'D004-memory-v1')
    g.add((transformation, RDF.type, m.Transformation))
    add(transformation, 'mappingVersion', MAPPING['version'])
    add(transformation, 'codeVersion', 'D004-memory-v1')
    for typ, items in rows.items():
        artifact = iri('SourceArtifact', typ)
        g.add((artifact, RDF.type, m.SourceArtifact))
        add(artifact, 'path', typ + '.jsonl')
        add(artifact, 'sha256', MANIFEST['files'][typ + '.jsonl']['sha256'])
        for line_no, row in items:
            node = iri('SourceRecord', row['record_id'])
            record_nodes[row['record_id']] = node
            g.add((node, RDF.type, m.SourceRecord))
            g.add((node, m.artifact, artifact))
            add(node, 'recordId', row['record_id'])
            add(node, 'identifierNamespace', 'D003B')
            add(node, 'availableAt', row['available_at'], XSD.dateTime)
            add(node, 'revision', 0, XSD.integer)
            add(node, 'sourceLine', line_no, XSD.integer)

    def scope(row, source):
        country = row.get('country_code')
        product_id = row.get('product_id') or row.get('target_product_id')
        group = category.get(product_id, 'D003B')
        coverage = row.get('coverage_text') or ('D003B:' + row['record_id'].split('-')[1])
        start = row.get('period_start') or row.get('valid_from') or row.get('expected_start') or \
                row.get('start_at') or row.get('observed_at') or row.get('written_at') or row.get('changed_at')
        end = row.get('period_end_exclusive') or row.get('valid_to_exclusive') or \
              row.get('expected_end_exclusive') or row.get('end_at_exclusive')
        if not start:
            raise ValueError('scope time missing: ' + row['record_id'])
        start_day = start[:10]
        end_day = end[:10] if end else (date.fromisoformat(start_day) + timedelta(days=1)).isoformat()
        key = (country, group, coverage, start_day, end_day)
        node = iri('MarketScope', *key)
        g.add((node, m.sourceRecord, source))
        if (node, RDF.type, m.MarketScope) not in g:
            g.add((node, RDF.type, m.MarketScope))
            g.add((node, RDF.type, m.Subject))
            g.add((node, m.generatedBy, transformation))
            add(node, 'country', country)
            add(node, 'category', group)
            add(node, 'coverageText', coverage)
            # Scope validity and measurement intervals have different grain roles.
            interval = iri('TimeInterval', start_day, end_day, row['reporting_timezone'], 'scope')
            if (interval, RDF.type, m.TimeInterval) not in g:
                g.add((interval, RDF.type, m.TimeInterval))
                add(interval, 'startDate', start_day, XSD.date)
                add(interval, 'endDateExclusive', end_day, XSD.date)
                add(interval, 'timezone', row['reporting_timezone'])
                add(interval, 'calendar', 'gregorian')
                add(interval, 'grain', 'scope')
            g.add((node, m.validInterval, interval))
        return node

    def temporal(row, source):
        if 'period_start' in row:
            key = (row['period_start'], row['period_end_exclusive'], row['reporting_timezone'])
            node = iri('TimeInterval', *key)
            if (node, RDF.type, m.TimeInterval) not in g:
                g.add((node, RDF.type, m.TimeInterval))
                add(node, 'startDate', key[0], XSD.date)
                add(node, 'endDateExclusive', key[1], XSD.date)
                add(node, 'timezone', key[2])
                add(node, 'calendar', 'gregorian')
                add(node, 'grain', row.get('grain', 'month'))
            return 'interval', node
        field = 'observed_at' if 'observed_at' in row else 'written_at' if 'written_at' in row else None
        if field:
            key = (row[field], row['reporting_timezone'])
            node = iri('TimeInstant', *key)
            if (node, RDF.type, m.TimeInstant) not in g:
                g.add((node, RDF.type, m.TimeInstant))
                add(node, 'timestamp', key[0], XSD.dateTime)
                add(node, 'timezone', key[1])
            return 'instant', node
        if 'start_at' in row:
            key = (row['start_at'], row['end_at_exclusive'], row['reporting_timezone'])
            node = iri('TimeInterval', *key)
            if (node, RDF.type, m.TimeInterval) not in g:
                g.add((node, RDF.type, m.TimeInterval))
                add(node, 'startDate', key[0][:10], XSD.date)
                add(node, 'endDateExclusive', key[1][:10], XSD.date)
                add(node, 'timezone', key[2])
                add(node, 'calendar', 'gregorian')
                add(node, 'grain', 'event')
            return 'interval', node
        raise ValueError('observation without temporal context: ' + row['record_id'])

    for typ, items in rows.items():
        for line_no, row in items:
            source = record_nodes[row['record_id']]
            product = None
            if 'product_id' in row or 'target_product_id' in row:
                product_id = row.get('product_id') or row['target_product_id']
                if product_id not in products:
                    raise ValueError('unknown product reference: ' + product_id)
                product_row = products[product_id]
                product_source = record_nodes[product_row['record_id']]
                brand = entity('Brand', product_row['brand_id'], product_source)
                product = entity('Product', product_id, product_source)
                g.add((product, m.brand, brand))
            current_scope = scope(row, source) if row.get('country_code') else None
            campaign = None
            if 'campaign_id' in row:
                cid = row['campaign_id']
                if cid not in campaigns:
                    raise ValueError('unknown campaign reference: ' + cid)
                config = campaigns[cid]
                campaign_source = record_nodes[config['record_id']]
                campaign = entity('Campaign', cid, campaign_source)
                config_product = iri('Product', config['target_product_id'])
                g.add((campaign, m.promotes, config_product))
                campaign_scope = scope(config, campaign_source)
                g.add((campaign, m.scope, campaign_scope))
                interval = iri('TimeInterval', config['valid_from'], config['valid_to_exclusive'], config['reporting_timezone'])
                if (interval, RDF.type, m.TimeInterval) not in g:
                    g.add((interval, RDF.type, m.TimeInterval))
                    add(interval, 'startDate', config['valid_from'][:10], XSD.date)
                    add(interval, 'endDateExclusive', config['valid_to_exclusive'][:10], XSD.date)
                    add(interval, 'timezone', config['reporting_timezone'])
                    add(interval, 'calendar', 'gregorian')
                    add(interval, 'grain', 'configuration')
                g.add((campaign, m.validInterval, interval))
                for field, predicate in [('channel','channel'),('platform','platform'),('conversion_name','conversionName'),
                                         ('attribution_model','attributionModel')]:
                    add(campaign, predicate, config[field])
                add(campaign, 'attributionWindowDays', config['attribution_window_days'], XSD.integer)
            if typ == 'T08':
                entity('Seller', row['seller_id'], source)
            if typ in {'T22', 'T35'}:
                entity('Location', row['location_id'], source)
            if typ == 'T24':
                review = iri('Review', row['review_id'])
                g.add((review, RDF.type, m.Review))
                g.add((review, m.sourceRecord, source))
                g.add((review, m.generatedBy, transformation))
                g.add((review, m.subject, product))
                g.add((review, m.scope, current_scope))
                g.add((review, m.instant, temporal(row, source)[1]))
                add(review, 'bodyText', row['body_text'])
                add(review, 'language', row['language'])
            if typ == 'T09':
                promotion = entity('Promotion', row['promotion_id'], source)
                g.add((promotion, m.subject, product))
                g.add((promotion, m.scope, current_scope))
                add(promotion, 'eventKind', 'promotion')
                add(promotion, 'promotionType', 'percent_discount')
                add(promotion, 'startAt', row['start_at'], XSD.dateTime)
                add(promotion, 'endAtExclusive', row['end_at_exclusive'], XSD.dateTime)
            if typ == 'T35':
                event = entity('Event', row['change_id'], source)
                g.add((event, m.subject, product))
                g.add((event, m.scope, current_scope))
                add(event, 'eventKind', 'inventory_change')
                moment = iri('TimeInstant', row['changed_at'], row['reporting_timezone'])
                g.add((moment, RDF.type, m.TimeInstant))
                add(moment, 'timestamp', row['changed_at'], XSD.dateTime)
                add(moment, 'timezone', row['reporting_timezone'])
                g.add((event, m.instant, moment))
            if typ == 'T36':
                run = iri('CollectionRun', row['run_id'])
                g.add((run, RDF.type, m.CollectionRun))
                for key, predicate in [('expected_count','expectedCount'),('received_count','receivedCount'),('missing_count','missingCount')]:
                    add(run, predicate, row[key], XSD.integer)
            for field, metric_id in mapping_fields[typ].items():
                value = row[field]
                key = (row['record_id'], '$.' + field)
                if metric_id == 'market_total':
                    bucket = (row['country_code'], row['period_start'], row['period_end_exclusive'],
                              row['coverage_text'], row['currency'])
                    if row['record_id'] != market_owner[bucket]:
                        obs = iri('Observation', market_owner[bucket], '$.' + field)
                        g.add((obs, m.sourceRecord, source))
                        add(obs, 'fieldPath', '$.' + field)
                        continue
                obs = iri('Observation', *key)
                g.add((obs, RDF.type, m.Observation))
                g.add((obs, m.sourceRecord, source))
                g.add((obs, m.generatedBy, transformation))
                g.add((obs, m.subject, campaign if typ == 'T13' else current_scope if metric_id == 'market_total' else product))
                g.add((obs, m.scope, current_scope))
                definition = MAPPING['metrics'][metric_id]
                # D003B has no account ID: keep its synthetic campaign profile isolated.
                config_key = json.dumps(campaigns.get(row.get('campaign_id'), {}), sort_keys=True,
                                        ensure_ascii=False, separators=(',', ':'))
                definition_key = (metric_id, typ, row.get('country_code'), row.get('currency'),
                                  row.get('coverage_text'), row.get('campaign_id'), row.get('grain'),
                                  definition['version'], config_key)
                metric = iri('MetricDefinition', *definition_key)
                if (metric, RDF.type, m.MetricDefinition) not in g:
                    g.add((metric, RDF.type, m.MetricDefinition))
                    add(metric, 'metricId', metric_id)
                    add(metric, 'definition', definition['definition'])
                    add(metric, 'definitionVersion', definition['version'])
                    add(metric, 'unit', definition['unit'])
                    add(metric, 'aggregation', definition['aggregation'])
                g.add((obs, m.metric, metric))
                add(obs, 'availability', 'missing' if value is None else 'present')
                add(obs, 'originKind', 'simulated')
                add(obs, 'isSynthetic', True, XSD.boolean)
                if value is None:
                    add(obs, 'reason', row.get('availability', 'source_null'))
                else:
                    g.add((obs, m.value, Literal(str(value), datatype=XSD.decimal, normalize=False)))
                if 'currency' in row:
                    add(obs, 'currency', row['currency'])
                add(obs, 'fieldPath', '$.' + field)
                add(obs, 'seriesRole', row.get('series_role', 'source'))
                relation, when = temporal(row, source)
                g.add((obs, m[relation], when))
                if metric_id == 'market_total':
                    denominator[bucket] = (key, value, obs)
    ontology = Graph().parse(HERE / 'ontology.ttl', format='turtle')
    declared = set(ontology.subjects())
    used = {predicate for _, predicate, _ in g if str(predicate).startswith(str(m))}
    used |= {obj for _, predicate, obj in g if predicate == RDF.type and str(obj).startswith(str(m))}
    if used - declared:
        raise ValueError('undeclared ontology terms: ' + ', '.join(sorted(map(str, used - declared))))
    shapes = Graph().parse(HERE / 'shapes.ttl', format='turtle')
    conforms, report, _ = pyshacl.validate(g, shacl_graph=shapes, inference='none', advanced=False)
    problems = Counter(str(x) for x in report.objects(None, URIRef('http://www.w3.org/ns/shacl#resultMessage')))
    graph_digest = hashlib.sha256('\n'.join(sorted(' '.join(term.n3() for term in triple) for triple in g)).encode('utf-8')).hexdigest()
    result = {'conforms': bool(conforms), 'shape_errors': dict(problems.most_common(12)),
            'graph_triples': len(g), 'graph_sha256': graph_digest,
            'node_counts': {str(cls).removeprefix(str(m)): len(set(g.subjects(RDF.type, cls)))
                                                for cls in set(g.objects(None, RDF.type)) if str(cls).startswith(str(m))},
            'entries': read_rdf(g, rows), 'factual_components': factual_components(g, rows),
            'versions': {p: importlib.metadata.version(p) for p in ('rdflib','pyshacl')}}
    # The question runner consumes the same transient graph, never a saved RDF copy.
    if include_graph:
        result['graph'] = g
    return result


def read_rdf(graph, rows):
    """Read actual graph edges and compare every observation to source context.

    No projection helper or projection-side ledger is used. Shared mapping is
    still a common specification dependency, not independent business review.
    """
    from rdflib import Namespace, RDF, XSD
    m = Namespace('https://example.org/marketing/')
    source = {r['record_id']: (typ, line, r) for typ, items in rows.items() for line, r in items}
    metrics = {t['type']: {x['path']: x['metric_id'] for x in t['mappings'] if x['metric_id']}
               for t in MAPPING['types']}
    products = {r['product_id']: r for _, r in rows['T01']}

    def one(node, name):
        values = list(graph.objects(node, m[name]))
        if len(values) != 1:
            raise ValueError(f'RDF cardinality {name}: {node}: {len(values)}')
        return values[0]

    def same(node, name, expected):
        actual = str(one(node, name))
        if actual != str(expected):
            raise ValueError(f'RDF source mismatch {name}: {node}: {actual!r} != {expected!r}')

    entries = {}
    for obs in graph.subjects(RDF.type, m.Observation):
        path = str(one(obs, 'fieldPath'))
        records = list(graph.objects(obs, m.sourceRecord))
        ids = sorted(str(one(record, 'recordId')) for record in records)
        if not ids:
            raise ValueError('RDF observation without source')
        # Repeated denominators retain all source links; minimum ID owns the node.
        owner = ids[0]
        typ, _, row = source[owner]
        field = path.removeprefix('$.')
        metric_id = metrics[typ][path]
        definition = MAPPING['metrics'][metric_id]
        metric = one(obs, 'metric')
        for name, value in [('metricId', metric_id), ('unit', definition['unit']),
                            ('definitionVersion', definition['version']),
                            ('definition', definition['definition']), ('aggregation', definition['aggregation'])]:
            same(metric, name, value)
        config = next((r for _, r in rows['T12'] if r['campaign_id'] == row.get('campaign_id')), {})
        expected_key = (metric_id, typ, row.get('country_code'), row.get('currency'),
                        row.get('coverage_text'), row.get('campaign_id'), row.get('grain'), definition['version'],
                        json.dumps(config, sort_keys=True, ensure_ascii=False, separators=(',', ':')))
        expected_metric = str(m) + 'MetricDefinition/' + '/'.join(quote(str(p), safe='') for p in expected_key)
        if str(metric) != expected_metric:
            raise ValueError('RDF metric settings/version key mismatch')
        value = row[field]
        same(obs, 'availability', 'missing' if value is None else 'present')
        values = list(graph.objects(obs, m.value))
        if value is None:
            if values:
                raise ValueError('RDF missing observation has a value')
            same(obs, 'reason', row.get('availability', 'source_null'))
        elif len(values) != 1 or values[0].datatype != XSD.decimal or str(values[0]) != str(value):
            raise ValueError('RDF decimal value/lexical mismatch: ' + owner + path)
        currency = list(graph.objects(obs, m.currency))
        if [str(v) for v in currency] != ([row['currency']] if 'currency' in row else []):
            raise ValueError('RDF currency mismatch')
        scope = one(obs, 'scope')
        product_id = row.get('product_id') or row.get('target_product_id')
        same(scope, 'country', row['country_code'])
        same(scope, 'category', products[product_id]['category_name'] if product_id else 'D003B')
        same(scope, 'coverageText', row.get('coverage_text') or ('D003B:' + owner.split('-')[1]))
        subject = one(obs, 'subject')
        if metric_id == 'market_total':
            if subject != scope:
                raise ValueError('RDF denominator subject is not scope')
        else:
            same(subject, 'sourceId', row['campaign_id'] if typ == 'T13' else product_id)
            if (subject, RDF.type, m.Campaign if typ == 'T13' else m.Product) not in graph:
                raise ValueError('RDF subject class mismatch')
        transformation = one(obs, 'generatedBy')
        same(transformation, 'mappingVersion', MAPPING['version'])
        same(transformation, 'codeVersion', 'D004-memory-v1')
        same(obs, 'seriesRole', row.get('series_role', 'source'))
        same(obs, 'originKind', 'simulated')
        same(obs, 'isSynthetic', 'true')
        if 'period_start' in row or 'start_at' in row:
            when = one(obs, 'interval')
            same(when, 'startDate', (row.get('period_start') or row['start_at'])[:10])
            same(when, 'endDateExclusive', (row.get('period_end_exclusive') or row['end_at_exclusive'])[:10])
            same(when, 'grain', row.get('grain', 'month') if 'period_start' in row else 'event')
        else:
            when = one(obs, 'instant')
            same(when, 'timestamp', row.get('observed_at') or row['written_at'])
        same(when, 'timezone', row['reporting_timezone'])
        scope_when = one(scope, 'validInterval')
        same(scope_when, 'timezone', row['reporting_timezone'])
        start = next(row[k] for k in ('period_start','valid_from','expected_start','start_at','observed_at','written_at','changed_at') if row.get(k))[:10]
        end = next((row[k][:10] for k in ('period_end_exclusive','valid_to_exclusive','expected_end_exclusive','end_at_exclusive') if row.get(k)),
                   (date.fromisoformat(start) + timedelta(days=1)).isoformat())
        same(scope_when, 'startDate', start)
        same(scope_when, 'endDateExclusive', end)
        if metric_id == 'market_total':
            bucket = tuple(row[k] for k in ('country_code','period_start','period_end_exclusive','coverage_text','currency'))
            required_ids = sorted(r['record_id'] for _, r in rows[typ]
                                  if tuple(r[k] for k in ('country_code','period_start','period_end_exclusive','coverage_text','currency')) == bucket)
            if ids != required_ids:
                raise ValueError('RDF repeated denominator provenance mismatch')
        elif ids != [owner]:
            raise ValueError('RDF observation has extra source records')
        for record in records:
            rid = str(one(record, 'recordId'))
            source_type, line, original = source[rid]
            same(record, 'sourceLine', line)
            same(record, 'availableAt', original['available_at'])
            same(record, 'revision', 0)
            same(record, 'identifierNamespace', 'D003B')
            artifact = one(record, 'artifact')
            same(artifact, 'path', source_type + '.jsonl')
            same(artifact, 'sha256', MANIFEST['files'][source_type + '.jsonl']['sha256'])
            if original[field] != value:
                raise ValueError('RDF repeated value differs from source')
        key = (owner, path)
        if key in entries:
            raise ValueError('duplicate RDF observation source key')
        entries[key] = (None if not values else Decimal(str(values[0])),
                        str(one(obs, 'availability')), str(one(metric, 'metricId')))
    return entries


def factual_components(graph, rows):
    """Deterministic parts of named tests; never claim full answer evaluation."""
    from rdflib import Namespace, RDF
    from datetime import datetime
    m = Namespace('https://example.org/marketing/')
    early = datetime.fromisoformat('2026-09-30T00:00:00+09:00')
    facts = defaultdict(dict)
    early_months = set()
    for obs in graph.subjects(RDF.type, m.Observation):
        metric = str(graph.value(graph.value(obs, m.metric), m.metricId))
        for record in graph.objects(obs, m.sourceRecord):
            rid = str(graph.value(record, m.recordId))
            value = graph.value(obs, m.value)
            facts[rid][metric] = None if value is None else Decimal(str(value))
            if metric == 'market_units':
                when = graph.value(obs, m.interval)
                start = str(graph.value(when, m.startDate))
                if datetime.fromisoformat(str(graph.value(record, m.availableAt))) <= early:
                    early_months.add(start)
    checks = {}
    compared = 0
    for year in (2025, 2026):
        selected = [r for _, r in rows['T03'] if r['country_code'] == 'JP'
                    and r['period_start'][:4] == str(year) and r['period_start'][5:7] in {'07','08','09'}]
        for product in ('P1A', 'P2A'):
            part = [r for r in selected if r['product_id'] == product]
            assert len(part) == 3, 'Q3 product coverage incomplete'
            for field, metric in [('units_sold','market_units'), ('sales_value','market_sales')]:
                assert sum(Decimal(str(r[field])) for r in part) == sum(facts[r['record_id']][metric] for r in part)
                compared += 1
        source_denominator = sum({r['period_start']: Decimal(str(r['market_total_value'])) for r in selected}.values())
        rdf_denominator = sum({r['period_start']: facts[r['record_id']]['market_total'] for r in selected}.values())
        assert rdf_denominator == source_denominator and rdf_denominator > 0
        for product in ('P1A','P2A'):
            part = [r for r in selected if r['product_id'] == product]
            assert sum(facts[r['record_id']]['market_sales'] for r in part) / rdf_denominator == sum(Decimal(str(r['sales_value'])) for r in part) / source_denominator
    checks['CQ01-1'] = {'status': 'pass', 'scope': 'RDF Q3 sums and unique-denominator shares', 'aggregate_checks': compared + 4}
    checks['CQ02-1'] = {'status': 'pass', 'scope': 'RDF year-pair inputs; narrative and absolute/relative answer contract pending'}
    assert '2026-09-01' not in early_months and {'2026-07-01','2026-08-01'} <= early_months
    checks['CQ02-3'] = {'status': 'pass', 'scope': 'RDF availableAt excludes September; complete Q3 withheld', 'result_status': 'insufficient_data'}
    missing = [rid for rid, values in facts.items() if 'ad_conversions' in values and values['ad_conversions'] is None]
    assert len(missing) == 2
    checks['CQ06-3'] = {'status': 'pass', 'scope': 'RDF missing conversions stay null; full daily comparison withheld', 'result_status': 'insufficient_data', 'missing_rows': len(missing)}
    social = [r for _, r in rows['T13'] if r['campaign_id'] == 'C-JP-social' and r['grain'] == 'day']
    assert len(social) == 28 and sum(facts[r['record_id']]['ad_conversions'] is not None for r in social) == 26
    logs = [node for node in graph.subjects(RDF.type, m.CollectionRun)
            if int(graph.value(node, m.receivedCount)) == 26]
    assert len(logs) == 1
    assert int(graph.value(logs[0], m.expectedCount)) == 28 and int(graph.value(logs[0], m.missingCount)) == 2
    checks['CQ11-1'] = {'status': 'pass', 'scope': 'RDF received26/normalized28/missing2; subtotal remains partial', 'result_status': 'answered'}
    return checks


def run(stage, tools_path, order_check=False):
    rows = load_rows(stage)
    expected, repeated = ledger(rows)
    result = project(rows, tools_path)
    if len(expected) != EXPECTED_OBSERVATIONS[stage] or len(result['entries']) != EXPECTED_OBSERVATIONS[stage]:
        raise ValueError(f'observation count mismatch: source={len(expected)}, RDF={len(result["entries"])}')
    if result['entries'] != expected:
        raise ValueError('independent source ledger differs from RDF projection')
    if not result['conforms']:
        raise ValueError('SHACL violations: ' + str(result['shape_errors']))
    if order_check:
        reversed_rows = {typ: list(reversed(items)) for typ, items in rows.items()}
        reverse = project(reversed_rows, tools_path)
        if not reverse['conforms'] or reverse['entries'] != result['entries'] or reverse['graph_sha256'] != result['graph_sha256']:
            raise ValueError('input-order projection instability')
    return {'stage': stage, 'status': 'pass', 'rows': sum(map(len, rows.values())),
            'observations': len(expected), 'missing': sum(v[1] == 'missing' for v in expected.values()),
            'rdf_readback': 'pass', 'oracle_dependency': 'shared mapping; independent traversal and source context',
            'factual_components': result['factual_components'],
            'repeated_denominator_groups': len(repeated), 'graph_triples': result['graph_triples'],
            'graph_sha256': result['graph_sha256'], 'input_order_check': 'pass' if order_check else 'not_run',
            'node_counts': result['node_counts'], 'tools': result['versions']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stage', choices=('small','full'), required=True)
    parser.add_argument('--tools', type=Path)
    parser.add_argument('--order-check', action='store_true')
    args = parser.parse_args()
    try:
        print(json.dumps(run(args.stage, args.tools, args.order_check), ensure_ascii=False, indent=2))
    except Exception as exc:
        print(json.dumps({'stage': args.stage, 'status': 'fail', 'error': str(exc)}, ensure_ascii=False))
        sys.exit(1)
