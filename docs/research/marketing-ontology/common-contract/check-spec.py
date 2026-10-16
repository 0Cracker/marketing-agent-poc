"""Read definition files only. Never reads source/*.jsonl or creates record fixtures."""
import argparse
import hashlib
import importlib.metadata
import json
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')

args = argparse.ArgumentParser()
args.add_argument('--tools', type=Path, help='Optional isolated rdflib/pySHACL package directory')
options = args.parse_args()
if options.tools:
    sys.path.insert(0, str(options.tools.resolve()))
here = Path(__file__).resolve().parent
checks = []
def check(name, fn):
    try:
        detail = fn()
        checks.append({'name': name, 'status': 'pass', 'detail': detail})
    except Exception as exc:
        checks.append({'name': name, 'status': 'fail', 'detail': str(exc)})

def read(name):
    return json.loads((here / name).read_text(encoding='utf-8-sig'))
mapping = read('d003b-mapping.json')
tests = read('tests.json')
selection = read('batch-selection.json')
contracts = read('source-contracts.json')
source_schema = json.loads((here.parent / 'batches/D003B/batch.schema.json').read_text(encoding='utf-8-sig'))

def field_semantics_check():
    result = subprocess.run([sys.executable, str(here / 'build-field-semantics.py'), '--check'],
                            capture_output=True, text=True, encoding='utf-8', timeout=30)
    assert result.returncode == 0, result.stderr or result.stdout
    inventory = read('field-semantics.json')
    assert inventory['totals'] == {'types': 40, 'common_fields': 10,
                                   'type_field_occurrences': 457, 'historical_specific_fields': 7}
    fields = inventory['common'] + [f for t in inventory['types'] for f in t['fields']] + inventory['historical_report']['fields']
    assert len(fields) == 474
    assert all(f['meaning'] and f['concept'] and f['role'] and f['status'] and f['source_validation'] for f in fields)
    assert all(f['source_validation'] == '원천 확인 대기' for f in fields)
    assert inventory['review_summary']['individually_reviewed_fields'] == 0
    assert all(f['review_status'] == 'pending_field_review' and len(f['required_review']) == 7 for f in fields)
    assert all(t['row_grain_contract'] != '원천 확인 대기' and t['schema_required_fields'] for t in inventory['types'])
    ontology_text = (here / 'ontology.ttl').read_text(encoding='utf-8')
    classes = set(re.findall(r'^m:([A-Za-z]+) rdf:type owl:Class', ontology_text, re.M))
    assert all(f['concept'][2:] in classes for f in fields)
    return {'type_fields': 457, 'common_fields': 10, 'H01_specific_fields': 7,
            'design_entries': len(fields), 'source_validated_fields': 0}
check('40-type field semantics coverage and declared concept references', field_semantics_check)

def mapping_check():
    types = {d['type']: d for d in mapping['types']}
    assert len(types) == len(mapping['types']) == 11
    assert set(types) == set(source_schema['$defs'])
    assert sum(d['rows'] for d in types.values()) == mapping['record_total'] == 1652
    count = 0
    for typ, spec in source_schema['$defs'].items():
        fields = types[typ]['mappings']
        paths = {m['path'] for m in fields}
        assert len(paths) == len(fields)
        assert paths == {'$.' + k for k in spec['properties']}, typ
        for entry in fields:
            field = entry['path'][2:]
            assert entry['source_schema'] == spec['properties'][field], (typ, field)
            assert entry['required'] == (field in spec['required']), (typ, field)
            assert entry['target'] and entry['rule'] and entry['loss'] and entry['evidence']
            if entry['metric_id']:
                metric = mapping['metrics'][entry['metric_id']]
                assert metric['source_type'] == typ and metric['source_path'] == entry['path']
        count += len(fields)
    return {'types': 11, 'mapped_field_occurrences': count, 'metrics': len(mapping['metrics'])}
check('D003B 11-type schema/field coverage and metric references', mapping_check)

def test_check():
    rows = tests['tests']
    assert len(rows) == tests['test_count'] == 52
    assert len({r['id'] for r in rows}) == 52
    qids = {r['question_id'] for r in rows}
    assert qids == {'CQ01','CQ02','CQ04','CQ05','CQ06','CQ07','CQ11','CQ12','CQ14','CQ15','CQ17','CQ23','CQ28'}
    policies = set(re.findall(r'\| (P-[A-Z]+) \|', (here/'semantics.md').read_text(encoding='utf-8')))
    for q in qids:
        assert {r['category'] for r in rows if r['question_id']==q} == {'normal','boundary','insufficient','counterevidence'}
    for row in rows:
        assert row['execution_status'] == 'not_run'
        assert set(row['policies']) <= policies, row['id']
        assert row['expected']['status'] in {'answered','insufficient_data','incomparable','out_of_scope','execution_failed'}
        assert all(row[k] for k in ['input_spec','procedure','independent_oracle','fixture_requirement'])
    evaluation=(here/'evaluation.md').read_text(encoding='utf-8')
    assert len(re.findall(r'^\| CQ\d\d ',evaluation,re.M))==30
    return {'core_questions':13,'test_specs':52,'data_tests_executed':0,'all_questions':30}
check('13 questions × 4 categories; 30-question status; policy traceability', test_check)

def batch_check():
    rows=selection['sources']
    assert set(r['type'] for r in rows)==set(source_schema['$defs'])
    assert sum(r['count'] for r in rows)==selection['input_count']==214
    ids=[]
    for row in rows:
        assert len(row['record_ids'])==row['count']
        assert all(re.fullmatch('D003B-'+row['type']+r'-\d{4}',i) for i in row['record_ids'])
        ids+=row['record_ids']
    assert len(set(ids))==214
    assert selection['approval']=='pending'
    assert not selection['source_rewrite'] and not selection['store_load']
    assert selection['new_source_rows']==selection['fault_injection_rows']==0
    assert 36*2+6+6*6+68*5+56+28+8+1==selection['expected_observations']==547
    return {'proposed_input_rows':214,'proposed_observations':547,'actual_transformed_rows':0,'ID_existence':'not run; approval required'}
check('Proposal IDs/counts/observation arithmetic and approval boundary',batch_check)

def contracts_check():
    assert {s['id'] for s in contracts['sources']}=={'SRC-SEARCH','SRC-SOCIAL','SRC-OWN-SALES'}
    for s in contracts['sources']:
        assert s['unknowns'] and s['mandatory_context'] and s['references'] and s['return_policy']
        assert len({f['path'] for f in s['fields']})==len(s['fields'])
        assert all(f['datatype'] and f['target'] and f['rule'] and f['evidence_level'] for f in s['fields'])
    return '3 contracts; pending source semantics explicit; no API connector executed'
check('Search/social/own-sales contract completeness',contracts_check)

versions={}
try:
    import rdflib
    import pyshacl
    from rdflib import Graph, Namespace, RDF, RDFS, OWL
    from rdflib.plugins.sparql.parser import parseQuery
    versions={m:importlib.metadata.version(m) for m in ['rdflib','pyshacl','owlrl']}
    m=Namespace('https://example.org/marketing/')
    sh=Namespace('http://www.w3.org/ns/shacl#')
    ontology=Graph()
    shapes=Graph()
    def parse_check():
        ontology.parse(here/'ontology.ttl',format='turtle')
        shapes.parse(here/'shapes.ttl',format='turtle')
        return {'ontology_triples':len(ontology),'shape_triples':len(shapes)}
    check('RDFLib Turtle parsing',parse_check)
    def reference_check():
        declared=set(ontology.subjects())
        shape_nodes=set(shapes.subjects())
        for s,p,o in shapes:
            if str(o).startswith(str(m)):
                assert o in declared or o in shape_nodes, str(o)
        for typ in mapping['types']:
            for field in typ['mappings']:
                for term in re.findall(r'm:([A-Za-z][A-Za-z0-9]*)',field['target']):
                    assert m[term] in declared,term
        for node in shapes.subjects(RDF.type,sh.NodeShape):
            assert list(shapes.objects(node,sh.targetClass)),str(node)
        assert not list(ontology.triples((None,OWL.sameAs,None)))
        return {'owl_classes':len(set(ontology.subjects(RDF.type,OWL.Class))),'node_shapes':len(set(shapes.subjects(RDF.type,sh.NodeShape))),'undeclared_local_references':0,'explicit_sameAs':0}
    check('RDF declaration/shape/mapping references',reference_check)
    def meta_check():
        # The data is the shapes specification, never a synthetic marketing graph.
        meta=Graph().parse(Path(pyshacl.__file__).parent/'assets/shacl-shacl.ttl',format='turtle')
        conforms,report,text=pyshacl.validate(shapes,shacl_graph=meta,inference='none',advanced=False)
        assert conforms,text
        return {'meta_shacl_conforms':bool(conforms),'target':'shapes.ttl only','marketing_graph_validation':'not run'}
    check('pySHACL SHACL specification meta-validation',meta_check)
    def query_check():
        queries=list(shapes.objects(None,sh.select))
        for q in queries:parseQuery(str(q))
        return {'parsed_constraint_queries':len(queries),'executed_against_marketing_data':0}
    check('SHACL-SPARQL constraint syntax',query_check)
    def logic_structure():
        # Structural cycle/disjointness checks do not constitute an OWL DL reasoner.
        for c in ontology.subjects(RDF.type,OWL.Class):
            parents=set()
            todo=list(ontology.objects(c,RDFS.subClassOf))
            while todo:
                p=todo.pop()
                if p in parents:continue
                parents.add(p);todo.extend(ontology.objects(p,RDFS.subClassOf))
            assert c not in parents, 'subclass cycle '+str(c)
            for ancestor in parents|{c}:
                for other in ontology.objects(ancestor,OWL.disjointWith):
                    assert other not in parents|{c},'explicit disjoint ancestor '+str(c)
        return 'No declared subclass cycles/disjoint ancestors; HermiT satisfiability not run'
    check('Declared hierarchy/disjointness structure',logic_structure)
    def rl_entailment_check():
        # Definition-only OWL RL check; this does not replace an OWL DL reasoner.
        from owlrl import DeductiveClosure, OWLRL_Semantics
        inferred = Graph()
        inferred += ontology
        DeductiveClosure(OWLRL_Semantics).expand(inferred)
        expected = [(m.Product,m.Subject), (m.Variant,m.Subject),
                    (m.Category,m.Entity), (m.Promotion,m.Event), (m.Brand,m.Entity),
                    (m.Observation,m.Entity), (m.SourceRecord,m.Entity),
                    (m.Transformation,Namespace('http://www.w3.org/ns/prov#').Activity)]
        for child, parent in expected:
            assert (child,RDFS.subClassOf,parent) in inferred, (child,parent)
        classes = set(ontology.subjects(RDF.type,OWL.Class))
        for child in classes:
            assert (child,RDFS.subClassOf,OWL.Nothing) not in inferred, str(child)
            if child in [m.Product,m.Campaign,m.Claim,m.Hypothesis]:
                assert (child,RDFS.subClassOf,m.Observation) not in inferred, str(child)
        return {'expected_entailments':len(expected),'unsatisfiable_named_classes':0,
                'scope':'OWL RL TBox only; OWL DL consistency not run'}
    check('OWL RL definition entailments and detected contradictions',rl_entailment_check)
except ImportError as exc:
    checks.append({'name':'RDFLib/pySHACL checks','status':'not_run','detail':str(exc)})

def links_check():
    n=0
    for f in here.glob('*.md'):
        for target in re.findall(r'\]\(([^)]+)\)',f.read_text(encoding='utf-8')):
            if re.match(r'https?://',target):continue
            path=target.split('#')[0]
            if path:assert (f.parent/path).exists(),f'{f.name}: {path}'
            n+=1
    return {'existing_local_links':n}
check('New-document local links',links_check)
for name,why in [
    ('Protégé/HermiT OWL consistency and satisfiability','not installed; no reasoner version recorded'),
    ('OOPS! automated scan','external ontology submission not performed'),
    ('52 data-dependent question tests','data reuse/transformation/fault fixtures not approved'),
    ('Real source compatibility and user usefulness','no real account samples or user business evaluation')]:
    checks.append({'name':name,'status':'not_run','detail':why})
failures=sum(c['status']=='fail' for c in checks)
print(json.dumps({'contract_version':'MC-1.0.0','date':'2026-10-14 Asia/Seoul','environment':{'python':sys.version.split()[0],**versions},'checks':checks,'passed':sum(c['status']=='pass' for c in checks),'failed':failures,'not_run':sum(c['status']=='not_run' for c in checks),'marketing_rows_read':0,'marketing_rows_generated':0,'marketing_rows_transformed':0,'hashes':{f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in here.iterdir() if f.suffix in ['.ttl','.json'] and f.name!='validation-results.json'}},ensure_ascii=False,indent=2))
sys.exit(1 if failures else 0)
