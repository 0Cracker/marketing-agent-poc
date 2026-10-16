"""Independent D005 decoding and canonical field/typed-relation RDF readback; stdin only."""
import argparse
import hashlib
from datetime import datetime
import importlib.util
import json
from pathlib import Path
import sys
from urllib.parse import quote
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
BATCH = HERE.parent / 'batches/D005'


def leaves(value, pointer=''):
    if isinstance(value, dict):
        for key, child in value.items():
            yield from leaves(child, pointer + '/' + key.replace('~', '~0').replace('/', '~1'))
    elif isinstance(value, list):
        if not value:
            yield pointer, value
        for index, child in enumerate(value):
            yield from leaves(child, pointer + '/' + str(index))
    else:
        yield pointer, value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tools', type=Path, required=True)
    parser.add_argument('--supplement', type=Path)
    parser.add_argument('--supplement-approval-record', type=Path)
    args = parser.parse_args()
    if sys.flags.optimize:
        parser.error('assertions must remain enabled')
    sys.path.insert(0, str(args.tools.resolve()))
    from rdflib import Graph, Namespace, URIRef, Literal, RDF, XSD
    from pyshacl import validate
    spec = importlib.util.spec_from_file_location('d005_independent', BATCH / 'oracle.py')
    oracle = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(oracle)
    schema = json.loads((BATCH / 'common.schema.json').read_text(encoding='utf-8'))
    defs = {s['properties']['metadata']['properties']['dataset_type']['enum'][0]: s['properties']['payload'] for s in schema['oneOf']}
    raw = {r['metadata']['record_id']: r for p in (BATCH / 'source').glob('*.jsonl')
           for r in map(json.loads, p.read_text(encoding='utf-8').splitlines())}
    rows = json.load(sys.stdin)
    supplements = {}
    if args.supplement:
        approval = json.loads(args.supplement_approval_record.read_text(encoding='utf-8'))
        assert approval['approved'] is True
        if approval['source'] == 'delegated_execution':
            authority_path = Path(approval['authority_file'])
            assert hashlib.sha256(authority_path.read_bytes()).hexdigest() == approval['authority_sha256']
            authority = json.loads(authority_path.read_text(encoding='utf-8'))
            assert authority['source'] == 'explicit_human_response' and authority['approved'] and authority['user_message']
            assert 'synthetic_supplement' in authority['actions']
        else:
            assert approval['source'] == 'explicit_human_response' and approval['user_message']
        assert approval['supplement_sha256'] == hashlib.sha256(args.supplement.read_bytes()).hexdigest()
        supplement = json.loads(args.supplement.read_text(encoding='utf-8'))
        supplements = {r['record_id']: r['fields'] for r in supplement['records']}
        assert approval['record_count'] == len(supplements)
        assert approval['field_count'] == sum(len(x) for x in supplements.values())
        for path, expected_hash in supplement['input_sha256'].items():
            assert hashlib.sha256(Path(path).read_bytes()).hexdigest() == expected_hash
    assert len(rows) == 528 and len({r['record']['record_id'] for r in rows}) == 528
    graph, shapes = Graph(), Graph()
    M, C, SH = Namespace('https://example.org/marketing/'), Namespace('urn:canonical-audit:'), Namespace('http://www.w3.org/ns/shacl#')
    # This is a transport/readback shape, not a substitute for the existing domain SHACL.
    shape = C.FieldShape
    shapes.add((shape, RDF.type, SH.NodeShape))
    shapes.add((shape, SH.targetClass, C.Field))
    for index, predicate in enumerate((C.path, C.jsonValue)):
        prop = C['property' + str(index)]
        for triple in [(shape, SH.property, prop), (prop, SH.path, predicate), (prop, SH.minCount, Literal(1)),
                       (prop, SH.maxCount, Literal(1)), (prop, SH.datatype, XSD.string)]:
            shapes.add(triple)
    expected, counters, relations = {}, {'source_rows': 0, 'field_values': 0, 'canonical_rows': 0}, 0
    reference_sets = {}
    for item in raw.values():
        payload = oracle.decode(item['payload'], defs[item['metadata']['dataset_type']], item['source_profile'])
        for key, value in payload.items():
            if key.endswith('_id') and isinstance(value, str):
                reference_sets.setdefault(key, set()).add(value)
    parents = HERE.parent / 'batches/D003B/source'
    for name in ('T01', 'T12', 'T24'):
        for r in map(json.loads, (parents / (name + '.jsonl')).read_text(encoding='utf-8').splitlines()):
            for key, value in r.items():
                if key.endswith('_id') and isinstance(value, str):
                    reference_sets.setdefault(key, set()).add(value)
    parent_reviews = {r['record_id']: r for r in map(json.loads, (parents / 'T24.jsonl').read_text(encoding='utf-8').splitlines())}
    parent_products = {r['record_id']: r for r in map(json.loads, (parents / 'T01.jsonl').read_text(encoding='utf-8').splitlines())}
    completion_result = {'status': 'not_run'}
    domain_result = {'status': 'not_run'}
    if args.supplement:
        from completion_semantics import verify
        decoded_sources = [r['source'] for r in rows]
        decoded_sources += [{'metadata': x['metadata'], 'payload': oracle.decode(x['payload'], defs[x['metadata']['dataset_type']], x['source_profile'])}
                            for x in raw.values() if x['metadata']['dataset_type'] == 'T01']
        decoded_sources += [{'metadata': {'dataset_type': 'PARENT_T24', 'record_id': r['record_id']}, 'payload': r} for r in parent_reviews.values()]
        registry = json.loads((HERE / 'completion-definitions.json').read_text(encoding='utf-8'))
        completion_result = verify(rows, decoded_sources, supplement, registry, hashlib.sha256((BATCH / 'generate.mjs').read_bytes()).hexdigest())
        from canonical_domain import project
        domain_result, domain_graph = project(rows, registry)
    customers, model_definitions = {}, {}
    for x in raw.values():
        typ = x['metadata']['dataset_type']
        p = oracle.decode(x['payload'], defs[typ], x['source_profile'])
        if typ == 'T30' and p['record_kind'] == 'cohort':
            assert len(p['order_refs']) == len(p['customer_set'])
            customers.update(zip(p['order_refs'], p['customer_set']))
        if typ == 'T39' and p['record_kind'] == 'model':
            model_definitions[p['model_id']] = p
    ref_keys = {'campaign_ref': 'campaign_id', 'variant_ref': 'variant_id', 'product_ref': 'product_id',
                'order_ref': 'order_id', 'order_line_ref': 'line_id', 'session_ref': 'session_ref',
                'content_ref': 'content_id', 'parent_comment_ref': 'comment_id', 'model_ref': 'model_id'}
    # Session identities are declared on source events rather than separate master rows.
    reference_sets['session_ref'] = {oracle.decode(x['payload'], defs[x['metadata']['dataset_type']], x['source_profile']).get('session_ref')
                                     for x in raw.values() if x['metadata']['dataset_type'] in ('T17', 'T18')}
    for x in raw.values():
        if x['metadata']['dataset_type'] == 'T19':
            order = oracle.decode(x['payload'], defs['T19'], x['source_profile'])
            reference_sets['line_id'].add(order['order_id'] + '/' + order['line_id'])
    for row in rows:
        source, record = row['source'], row['record']
        original = raw[record['record_id']]
        decoded = oracle.decode(original['payload'], defs[record['dataset_type']], original['source_profile'])
        assert source == {'metadata': original['metadata'], 'payload': decoded}, record['record_id']
        metadata = original['metadata']
        for name in ('record_id', 'dataset_type', 'scope_id', 'scenario_id', 'is_synthetic'):
            assert record[name] == metadata[name]
        assert record['temporal']['available_at'] == metadata['available_at']
        assert record['temporal']['reporting_timezone'] == metadata['reporting_timezone']
        assert record['provenance']['artifact_ref'] == metadata['source_file']
        assert record['provenance']['source_record_key'] == record['record_id']
        assert row['original_value_origin'] == metadata['value_origin']
        assert record['is_synthetic'] is True and record['quality']['is_partial'] is True
        assert set(record) == {entry['target'].split('/')[1] for entry in row['lineage']}
        approved = supplements.get(record['record_id'], {})
        for pointer, expected_value in approved.items():
            current = record
            for part in pointer[1:].split('/'):
                part = part.replace('~1', '/').replace('~0', '~')
                current = current[int(part)] if isinstance(current, list) else current[part]
            assert current == expected_value
        for entry in row['lineage']:
            field = entry['target'][1:]
            if entry['rule'] == 'declared-field-copy' and len(entry['sources']) == 1:
                origin, key = entry['sources'][0].split('.', 1)
                value = metadata if origin == 'metadata' else decoded
                for part in key.split('.'):
                    value = value[part]
                assert record[field] == value, (record['record_id'], field)
        if 'period' in record:
            if 'period' in decoded:
                assert record['period']['start'] == decoded['period']['start']
                assert record['period']['end_exclusive'] == decoded['period']['end']
            assert record['period']['start'] < record['period']['end_exclusive']
        if record['dataset_type'] in ('T10', 'T33'):
            for field in (('first_seen', 'last_seen') if record['dataset_type'] == 'T10' else ('published_at',)):
                expected_date = datetime.fromisoformat(decoded[field].replace('Z', '+00:00')).astimezone(ZoneInfo(metadata['reporting_timezone'])).date().isoformat()
                assert record[field] == expected_date
        if record['dataset_type'] == 'T02':
            assert record['mapping_kind'] == ('alias' if decoded['mapping_kind'] == 'name_alias' else decoded['mapping_kind'])
            evidence = record['evidence']
            if evidence['record_ref'] == record['record_id']:
                assert evidence['quote'] == decoded['evidence'][0]
                assert evidence['field_path'] == '$.payload.' + oracle.key('evidence', original['source_profile']) + '[0]'
            else:
                parent = parent_products[evidence['record_ref']]
                assert decoded['match_status'] == 'candidate'
                assert evidence['quote'] == parent['product_name'] == decoded['external_value']
        if record['dataset_type'] == 'T25' and decoded['record_kind'] == 'annotation':
            evidence = record['evidence_span']
            review = parent_reviews[decoded['review_ref']]
            assert review['body_text'][evidence['start_offset']:evidence['end_offset']] == evidence['quote']
            assert evidence['language'] == review['language']
        if record['dataset_type'] == 'T16':
            assert record['version'] == str(decoded['version'])
            assert ('valid_from' in record) == ('/valid_from' in approved), 'date-only validity needs an approved time rule'
        if record['dataset_type'] == 'T19':
            assert record['customer_pseudo_ref'] == customers[decoded['order_id']]
        if record['dataset_type'] == 'T14':
            assert record['metrics']['attributed_conversions'] == decoded['metrics']['conversions']
            assert record['metrics']['attributed_value'] == decoded['metrics']['attributed_revenue']
            assert record['breakdown_dimensions'] == [{'name': 'device', 'value': decoded['device']}]
        if record['dataset_type'] == 'T31':
            assert ('unique_clickers' in record) == ('/unique_clickers' in approved), 'recipient deduplication needs an approved meaning'
        if record['dataset_type'] == 'T39' and decoded['record_kind'] == 'budget_candidate':
            assert sum(oracle.amt(x['amount']) for x in record['allocations']) == oracle.amt(record['total_budget'])
            for allocation in record['allocations']:
                assert oracle.amt(allocation['lower']) <= oracle.amt(allocation['amount']) <= oracle.amt(allocation['upper'])
                assert allocation['amount']['currency'] == record['total_budget']['currency']
        if record['dataset_type'] == 'T39':
            model = decoded if decoded['record_kind'] == 'model' else model_definitions[decoded['model_ref']]
            assert record['validity_scope'] == metadata['scope_id']
            assert record['assumptions'] == ['trained=' + str(model['trained']).lower(), 'formula=' + model['formula'],
                                               'unit_budget=' + json.dumps(model['unit_budget'], separators=(',', ':'), ensure_ascii=False)]
        counters['source_rows'] += 1
        if not row['schema_conforming']:
            continue  # Incomplete candidates never enter the canonical graph.
        counters['canonical_rows'] += 1
        subject = URIRef('urn:canonical:record:' + quote(record['record_id']))
        graph.add((subject, RDF.type, M.SourceRecord))
        graph.add((subject, M.availableAt, Literal(record['temporal']['available_at'], datatype=XSD.dateTime)))
        for field, key in ref_keys.items():
            if record.get(field) is None:
                continue
            assert record[field] in reference_sets.get(key, set()), (record['record_id'], field, record[field])
            target = URIRef('urn:canonical:entity:' + quote(record[field]))
            graph.add((subject, C[field], target))
            graph.add((target, RDF.type, C[key]))
            relations += 1
        for pointer, value in leaves(record):
            node = URIRef(str(subject) + ':field:' + quote(pointer, safe=''))
            lexical = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
            graph.add((subject, C.field, node))
            graph.add((node, RDF.type, C.Field))
            graph.add((node, C.path, Literal(pointer)))
            graph.add((node, C.jsonValue, Literal(lexical)))
            expected[(subject, pointer)] = lexical
    actual = {}
    for subject, _, node in graph.triples((None, C.field, None)):
        pointer, value = list(graph.objects(node, C.path)), list(graph.objects(node, C.jsonValue))
        assert len(pointer) == len(value) == 1
        actual[(subject, str(pointer[0]))] = str(value[0])
    assert actual == expected
    counters['field_values'] = len(actual)
    conforms, _, text = validate(graph, shacl_graph=shapes, inference='none', allow_infos=False, allow_warnings=False)
    assert conforms, text
    print(json.dumps({'status': 'pass', **counters, 'typed_relations': relations, 'triples': len(graph),
                      'shacl': 'pass', 'domain_shacl': 'existing D005 domain regression remains separately required',
                      'source_decoding': 'independent Python decoder', 'completion_semantics': completion_result,
                      'canonical_domain': domain_result,
                      'persistent_RDF_files': 0}, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        import traceback
        print(json.dumps({'status': 'fail', 'reason': type(exc).__name__ + ': ' + str(exc), 'traceback': traceback.format_exc()}, ensure_ascii=False))
        raise SystemExit(1)
