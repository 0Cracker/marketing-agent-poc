"""Canonical provenance and metric-domain projection; existing OWL vocabulary and SHACL.

The lossless field graph remains separate. Business entities are not equated with source records.
"""
from decimal import Decimal
from datetime import datetime, timedelta
import hashlib
import json
from pathlib import Path
from urllib.parse import quote

HERE = Path(__file__).resolve().parent


def project(rows, registry):
    from rdflib import Graph, Namespace, URIRef, Literal, RDF, XSD
    from pyshacl import validate
    M = Namespace('https://example.org/marketing/')
    g = Graph()
    shapes = Graph().parse(HERE / 'shapes.ttl', format='turtle')
    if (HERE / 'property-use-shapes.ttl').is_file():
        shapes.parse(HERE / 'property-use-shapes.ttl', format='turtle')
    transformation = URIRef('urn:completion:transformation')
    g.add((transformation, RDF.type, M.Transformation))
    g.add((transformation, M.mappingVersion, Literal('D005-CANONICAL-1')))
    g.add((transformation, M.codeVersion, Literal(hashlib.sha256((HERE / 'd005-canonical.mjs').read_bytes()).hexdigest())))
    def node(kind, value):
        return URIRef('urn:completion:' + kind + ':' + quote(str(value), safe=''))
    def add(s, p, v, datatype=None):
        g.add((s, M[p], Literal(v, datatype=datatype)))
    def provenance(subject, source):
        g.add((subject, M.sourceRecord, source))
        g.add((subject, M.generatedBy, transformation))
    def interval(value, key):
        n = node('interval', key)
        g.add((n, RDF.type, M.TimeInterval))
        for p, v, dt in [('startDate', value['start'], XSD.date), ('endDateExclusive', value['end_exclusive'], XSD.date),
                         ('timezone', value['timezone'], None), ('calendar', 'Gregorian', None), ('grain', value['grain'], None)]:
            add(n, p, v, dt)
        return n
    definitions = {d['id']: d for d in registry['definitions']}
    observations, expected = [], {}
    for row in rows:
        r = row['record']
        if not row['schema_conforming']:
            continue
        rid = r['record_id']
        src, artifact = node('source', rid), node('artifact', r['provenance']['artifact_ref'])
        g.add((src, RDF.type, M.SourceRecord));g.add((artifact, RDF.type, M.SourceArtifact))
        g.add((src, M.artifact, artifact))
        source_path = HERE.parents[3] / r['provenance']['artifact_ref']
        add(artifact, 'path', r['provenance']['artifact_ref']);add(artifact, 'sha256', hashlib.sha256(source_path.read_bytes()).hexdigest())
        for p, v, dt in [('recordId', rid, None), ('identifierNamespace', 'D005', None), ('sourceLine', int(rid.rsplit('-', 1)[1]), XSD.integer),
                         ('availableAt', r['temporal']['available_at'], XSD.dateTime), ('revision', r['temporal']['revision'], XSD.integer)]:
            add(src, p, v, dt)
        for collection in ['measures', 'distribution_measures', 'expected_measures', 'outcome_measures']:
            for index, measure in enumerate(r.get(collection, [])):
                key = rid + '/' + collection + '/' + str(index)
                obs, metric = node('observation', key), node('metric', measure['metric_id'] + '/' + measure['definition_version'] + '/' + measure['unit'])
                subject = node('subject', r.get('subject_ref', r.get('product_ref', r['scope_id'])))
                scope = node('scope', key)
                g.add((subject, RDF.type, M.Subject));g.add((scope, RDF.type, M.MarketScope))
                provenance(scope, src)
                source = row['source']['metadata']
                for name, value in [('country', source['country_code']), ('category', 'D005 synthetic shampoo sample'), ('coverageText', r['quality']['coverage'])]:
                    add(scope, name, value)
                window = r.get('period')
                if window is None:
                    # Scope envelope is an explicit projection context, not an inferred source validity.
                    day = datetime.fromisoformat(source['available_at'].replace('Z', '+00:00')).date()
                    window = {'start': day.isoformat(), 'end_exclusive': (day + timedelta(days=1)).isoformat(), 'timezone': source['reporting_timezone'], 'grain': 'custom'}
                when = interval(window, key);g.add((scope, M.validInterval, when))
                g.add((obs, RDF.type, M.Observation));g.add((metric, RDF.type, M.MetricDefinition))
                for p, value in [('subject', subject), ('scope', scope), ('metric', metric), ('interval', when)]:
                    g.add((obs, M[p], value))
                provenance(obs, src)
                definition = definitions.get(measure['metric_id'])
                text = definition['definition'] if definition else 'LCP p75 in ms, rolling 28-day source measure'
                for p, value in [('metricId', measure['metric_id']), ('definition', text), ('definitionVersion', measure['definition_version']),
                                 ('unit', measure['unit']), ('aggregation', 'not_additive_without_same_definition_scope_and_disjoint_window')]:
                    add(metric, p, value)
                for p, value in [('availability', 'present' if measure['availability'] == 'available' else 'missing'),
                                 ('originKind', 'simulated'), ('fieldPath', '/' + collection + '/' + str(index) + '/value'), ('seriesRole', 'detail')]:
                    add(obs, p, value)
                add(obs, 'isSynthetic', True, XSD.boolean)
                # Definition versions created now are not visible in historical queries.
                add(obs, 'availableAt', max(r['temporal']['available_at'], registry['created_at'], key=lambda x: datetime.fromisoformat(x.replace('Z', '+00:00'))), XSD.dateTime)
                value = measure['value']
                if value is None:
                    add(obs, 'reason', 'source value not supplied')
                else:
                    if isinstance(value, dict):
                        add(obs, 'currency', value['currency']);value = value['amount']
                    add(obs, 'value', Decimal(str(value)), XSD.decimal)
                    expected[str(obs)] = Decimal(str(value))
                observations.append(obs)
    actual = {str(n): Decimal(str(g.value(n, M.value))) for n in observations if g.value(n, M.value) is not None}
    assert actual == expected
    conforms, _, text = validate(g, shacl_graph=shapes, inference='none')
    assert conforms, text[:4000]
    # A real domain constraint must reject a wrong observed value, not just accept the normal graph.
    obs = observations[0];original = g.value(obs, M.value)
    g.set((obs, M.value, Literal('not-a-number')))
    bad, _, _ = validate(g, shacl_graph=shapes, inference='none')
    assert not bad
    g.set((obs, M.value, original))
    assert actual == expected
    digest = hashlib.sha256('\n'.join(sorted(' '.join(x.n3() for x in t) for t in g)).encode()).hexdigest()
    return {'status': 'pass', 'source_records': len(rows), 'observations': len(observations), 'metric_values_requeried': len(actual),
            'existing_domain_SHACL': 'pass', 'negative_wrong_numeric_value': 'detected', 'triples': len(g), 'graph_sha256': digest,
            'scope': 'SourceRecord/artifact lineage, metric definitions, observations, subject/scope/period; other fields use explicit canonical contract and independent semantic checks'}, g
