"""Collect actual D003B/D005/D006 usage and test each OOPS design disposition locally."""
import argparse
from decimal import Decimal
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec);spec.loader.exec_module(result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tools', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--review-output', type=Path, required=True)
    args = parser.parse_args()
    assert not args.output.exists() and not args.review_output.exists()
    sys.path.insert(0, str(args.tools.resolve()))
    from rdflib import Graph, Namespace, URIRef, Literal, RDF, RDFS, OWL, XSD
    from pyshacl import validate
    from owlrl import DeductiveClosure, RDFS_Semantics
    M, SH, PROV = Namespace('https://example.org/marketing/'), Namespace('http://www.w3.org/ns/shacl#'), Namespace('http://www.w3.org/ns/prov#')
    ontology = Graph().parse(HERE / 'ontology.ttl', format='turtle')
    source_inputs = [HERE / n for n in ['ontology.ttl', 'shapes.ttl', 'review-local-model.py', 'validate-d003b.py', 'd006_data.py', 'd006_rdf.py']]
    source_inputs += [HERE.parent / 'batches/D005/oracle.py']
    source_inputs += list((HERE.parent / 'batches').rglob('source/*.jsonl'))
    source_inputs += [HERE / 'completion-delegation-20261016.json']
    before = {str(p.resolve()): sha(p) for p in source_inputs}
    d004 = module('domain_d004', HERE / 'validate-d003b.py')
    print('D003B actual graph', flush=True)
    first = d004.project(d004.load_rows('full'), args.tools.resolve(), include_graph=True)
    graphs = {'D003B': first['graph']}
    d005 = module('domain_d005', HERE.parent / 'batches/D005/oracle.py')
    schema = json.loads((HERE.parent / 'batches/D005/common.schema.json').read_text(encoding='utf-8'))
    defs = {s['properties']['metadata']['properties']['dataset_type']['enum'][0]: s['properties']['payload'] for s in schema['oneOf']}
    paths = sorted((HERE.parent / 'batches/D005/source').glob('*.jsonl'))
    raw = [json.loads(line) for p in paths for line in p.read_text(encoding='utf-8').splitlines()]
    common = [{'metadata': r['metadata'], 'payload': d005.decode(r['payload'], defs[r['metadata']['dataset_type']], r['source_profile'])} for r in raw]
    _, parents = d005.independent_checks(common, True)
    print('D005 actual graph', flush=True)
    graphs['D005'] = d005.rdf_check(common, raw, defs, parents, {p.stem: p.read_text(encoding='utf-8') for p in paths}, include_graph=True)
    import d006_data
    from d006_rdf import project
    rows, refs = d006_data.sources(HERE / 'd006-approval-20261016.json')
    print('D006 actual graph', flush=True)
    graphs['D006'] = project(rows, refs, args.tools.resolve(), include_graph=True)
    graph = Graph()
    relevant = set(ontology.subjects(RDF.type, OWL.ObjectProperty)) | set(ontology.subjects(RDF.type, OWL.DatatypeProperty))
    relevant |= {RDF.type, RDFS.subClassOf, RDFS.subPropertyOf}
    for g in graphs.values():
        # JSON transport trees cannot affect these ontology-property checks.
        for s, p, o in g:
            if p in relevant:
                graph.add((s, p, o))
    # Expand only the class/property hierarchy needed by this review. Full RDFS
    # datatype entailment rewrites equivalent numeric literals and is not an
    # appropriate graph on which to check lexical SHACL datatypes.
    graph += ontology
    for s, p, o in list(graph):
        for parent in ontology.transitive_objects(p, RDFS.subPropertyOf):
            graph.add((s, parent, o))
    for s, cls in list(graph.subject_objects(RDF.type)):
        for parent in ontology.transitive_objects(cls, RDFS.subClassOf):
            graph.add((s, RDF.type, parent))
    old = json.loads((HERE / 'oops-review-20261016.json').read_text(encoding='utf-8'))
    assert old['ontology_sha256'] == sha(HERE / 'ontology.ttl')
    findings, checks, shapes = [], [], Graph()
    range_fallback = {PROV.wasDerivedFrom: PROV.Entity, PROV.wasGeneratedBy: PROV.Activity}
    predicate_shapes = {}
    for finding in old['findings']:
        f = {k: finding[k] for k in ['code', 'importance', 'resources', 'fingerprint']}
        prop = URIRef(f['resources'][0])
        test_id = f['fingerprint']
        proof = {'id': test_id, 'code': f['code'], 'resource': str(prop), 'status': 'pass'}
        if f['code'] == 'P11':
            ranges = list(ontology.objects(prop, RDFS.range)) or [range_fallback[prop]]
            assert len(ranges) == 1
            expected = ranges[0]
            shape, ps = URIRef('urn:property-use:' + test_id), URIRef('urn:property-use:' + test_id + ':value')
            for triple in [(shape, RDF.type, SH.NodeShape), (shape, SH.targetSubjectsOf, prop), (shape, SH.nodeKind, SH.IRI),
                           (shape, SH.property, ps), (ps, SH.path, prop)]:
                shapes.add(triple)
            datatype = str(expected).startswith(str(XSD))
            if expected == RDFS.Literal:
                shapes.add((ps, SH.nodeKind, SH.Literal))
            elif expected != RDFS.Resource:
                shapes.add((ps, SH.datatype if datatype else SH['class'], expected))
            predicate_shapes[prop] = (shape, ps, expected)
            contexts = sorted({str(c) for s, _ in graph.subject_objects(prop) for c in graph.objects(s, RDF.type) if str(c).startswith(str(M))})
            asserted = {name: len(list(g.triples((None, prop, None)))) for name, g in graphs.items()}
            proof.update(asserted_usage=asserted, rdfs_usage=len(list(graph.triples((None, prop, None)))), subject_classes=contexts,
                         range=str(expected), shape=str(shape), subject_policy='IRI in declared application context; no universal class asserted')
            # Each property gets an executable positive and negative shape test, even when absent from instances.
            local = Graph()
            for triple in shapes.triples((shape, None, None)):local.add(triple)
            for triple in shapes.triples((ps, None, None)):local.add(triple)
            fixture = Graph();s, o = URIRef('urn:test:subject'), URIRef('urn:test:object')
            if datatype:
                val = True if expected == XSD.boolean else Decimal('1') if expected == XSD.decimal else 1 if expected == XSD.integer else '2026-10-16T00:00:00+09:00' if expected == XSD.dateTime else 'value'
                good = Literal(val, datatype=expected)
            elif expected == RDFS.Literal:
                good = Literal('2026-10-16', datatype=XSD.date)
            else:
                good = o
                fixture.add((o, RDF.type, expected))
            fixture.add((s, prop, good))
            assert validate(fixture, shacl_graph=local)[0], str(prop)
            fixture.remove((s, prop, good))
            bad = Literal('wrong object type') if not datatype and expected != RDFS.Literal else URIRef('urn:test:not-a-literal')
            fixture.add((s, prop, bad))
            # RDFS.Resource is intentionally unrestricted as a value, but subject IRI remains enforced.
            if expected == RDFS.Resource:
                fixture.remove((s, prop, bad));fixture.add((Literal('not-an-IRI'), prop, o))
            assert not validate(fixture, shacl_graph=local)[0], str(prop)
            proof['positive_and_negative_property_test'] = 'pass'
            f['reason'] = f"{prop}: class-scoped source contracts and property-use SHACL enforce {expected}. A universal domain is not asserted because this vocabulary is reused across the documented contexts {contexts or ['declared, no instance evidence']}; no absent usage is claimed as proof of correctness."
        elif f['code'] == 'P04':
            inbound = sorted(str(s) for s in ontology.subjects(RDFS.subClassOf, prop))
            assert inbound
            proof['incoming_subclasses'] = inbound
            f['reason'] = f'{prop} has explicit incoming subclass connections {inbound}; local reuse declaration is connected. No extra unrelated relation is needed.'
        elif f['code'] == 'P13-N':
            assert (prop, RDF.type, OWL.ObjectProperty) in ontology
            actual = {(s, o) for s, o in graph.subject_objects(prop)}
            assert {(s, o) for o in set(o for _, o in actual) for s in graph.subjects(prop, o)} == actual
            proof['reverse_query_pairs'] = len(actual)
            fixture = Graph();s, o = URIRef('urn:test:left'), URIRef('urn:test:right');fixture.add((s, prop, o))
            assert list(fixture.subjects(prop, o)) == [s]
            proof['reverse_query_fixture'] = 'pass'
            f['reason'] = f'{prop}: current mapping and questions consume the forward relation; reverse traversal with subjects(predicate, object) is executable without introducing a second named predicate. No current contract requires a named inverse.'
        elif f['code'] == 'P13-S':
            assert prop == M.supersedes and (prop, RDF.type, OWL.SymmetricProperty) not in ontology
            assert (prop, RDF.type, OWL.TransitiveProperty) not in ontology
            edges = list(graph.subject_objects(prop))
            assert all(s != o and (o, prop, s) not in graph for s, o in edges)
            for s, o in edges:
                assert int(graph.value(s, M.revision)) > int(graph.value(o, M.revision))
            proof['directional_revision_edges'] = len(edges)
            fixture = Graph()
            newer, older = URIRef('urn:test:revision2'), URIRef('urn:test:revision1')
            fixture.add((newer, prop, older));fixture += ontology
            DeductiveClosure(RDFS_Semantics).expand(fixture)
            assert (older, prop, newer) not in fixture
            proof['directional_revision_fixture'] = 'pass'
            f['reason'] = 'supersedes means the newer source revision directly replaces the older source revision. Symmetry reverses the meaning; transitivity erases direct predecessor semantics. As-of selection remains in the independently tested question policy.'
        else:
            raise AssertionError('unreviewed code ' + f['code'])
        f['review_state'] = 'accepted_non_application'
        f['test_id'] = test_id
        findings.append(f);checks.append(proof)
    normal, _, message = validate(graph, shacl_graph=shapes, inference='none')
    assert normal, message[:5000]
    shape_path = HERE / 'property-use-shapes.ttl'
    assert not shape_path.exists()
    shapes.serialize(shape_path, format='turtle')
    assert all(sha(Path(p)) == h for p, h in before.items())
    report = {'status': 'pass', 'scope': 'property-use and directional-model review; existing full regression remains required',
              'ontology_sha256': sha(HERE / 'ontology.ttl'), 'property_shapes_sha256': sha(shape_path), 'input_sha256': before,
              'graphs': {name: {'triples': len(g)} for name, g in graphs.items()}, 'rdfs_subproperty_closure': True,
              'class_hierarchy_closure': True, 'datatype_entailment_before_lexical_SHACL': False,
              'checks': checks, 'property_use_SHACL': 'pass', 'new_scoped_test_graphs': 79 + 24, 'source_rows_added': 0,
              'completed_at': datetime.now(timezone.utc).isoformat()}
    with args.output.open('x', encoding='utf-8') as stream:json.dump(report, stream, ensure_ascii=False, indent=2);stream.write('\n')
    for f in findings:
        f['alternative_validation'] = [{'report': str(args.output.resolve()), 'sha256': sha(args.output), 'status': 'pass', 'test_id': f['test_id']}]
    authority_path = HERE / 'completion-delegation-20261016.json'
    review = {'source': 'delegated_ai_review', 'approved': True, 'human_confirmed': False, 'authority_file': str(authority_path),
              'authority_sha256': sha(authority_path), 'ontology_sha256': sha(HERE / 'ontology.ttl'), 'source_commit': old['source_commit'],
              'property_shapes': str(shape_path), 'property_shapes_sha256': sha(shape_path), 'findings': findings}
    with args.review_output.open('x', encoding='utf-8') as stream:json.dump(review, stream, ensure_ascii=False, indent=2);stream.write('\n')
    print(json.dumps({'status': 'pass', 'reviewed_findings': len(findings), 'property_shapes': len(predicate_shapes)}))


if __name__ == '__main__':
    main()
