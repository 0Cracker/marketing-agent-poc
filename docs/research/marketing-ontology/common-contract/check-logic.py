"""Actual HermiT definition reasoning and pinned offline OOPS; never instance data."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from oops_local import scan as local_oops, self_check as oops_self_check

HERE = Path(__file__).resolve().parent


def hermit(graph, java, jar):
    if not java or not jar or not jar.is_file():
        return {'status': 'not_run', 'reason': 'Java executable or HermiT.jar not configured'}
    from rdflib import OWL, RDF
    classes = sorted(str(x) for x in graph.subjects(RDF.type, OWL.Class))
    concepts = ['http://www.w3.org/2002/07/owl#Thing', *classes]
    version = subprocess.run([java, '-jar', str(jar), '--version'], capture_output=True, text=True, encoding='utf-8', timeout=20)
    # Windows sandbox TEMP may be inaccessible to Java; keep definitions in the writable evidence root.
    (HERE / 'runs').mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='definition-logic-', dir=HERE / 'runs') as tmp:
        path = Path(tmp) / 'definitions.rdf'
        graph.serialize(path, format='xml')
        # Each declared class is checked explicitly: a successful JVM exit alone is insufficient.
        command = [java, '-jar', str(jar), *['--consistency=<' + c + '>' for c in concepts], path.as_uri()]
        result = subprocess.run(command, capture_output=True, text=True, encoding='utf-8', timeout=60)
        lines = set(result.stdout.splitlines())
        unsat = [c for c in concepts if '<' + c + '> is not satisfiable.' in lines]
        missing = [c for c in concepts if '<' + c + '> is satisfiable.' not in lines and c not in unsat]
        hierarchy_checks = []
        for child, parent, forbidden in [('Product', 'Subject', 'Campaign'), ('Promotion', 'Event', 'Product')]:
            uri = 'https://example.org/marketing/'
            query = [java, '-jar', str(jar), '--no-prefixes', '--supers=<' + uri + child + '>', path.as_uri()]
            hierarchy = subprocess.run(query, capture_output=True, text=True, encoding='utf-8', timeout=60)
            found = {s.strip() for s in hierarchy.stdout.splitlines()}
            hierarchy_checks.append({'child': child, 'expected_super': parent, 'forbidden_super': forbidden,
                                     'status': 'pass' if hierarchy.returncode == 0 and uri + parent in found and uri + forbidden not in found else 'fail',
                                     'stdout': hierarchy.stdout, 'stderr': hierarchy.stderr})
    status = 'fail' if result.returncode or unsat or any(c['status'] == 'fail' for c in hierarchy_checks) else 'not_run' if missing else 'pass'
    return {'status': status, 'scope': 'ontology.ttl definitions only; no D003B/D005 instance reasoning',
            'distribution': 'HermiT.jar bundled in Owlready2 0.51 (modified distribution)',
            'version': version.stdout.strip(), 'java': java, 'jar': str(jar),
            'jar_sha256': hashlib.sha256(jar.read_bytes()).hexdigest(), 'class_checks': len(classes),
            'consistency': 'pass' if concepts[0] not in unsat + missing and result.returncode == 0 else 'fail',
            'unsatisfiable_classes': unsat, 'missing_results': missing, 'hierarchy_checks': hierarchy_checks,
            'command': command[:-1] + ['<temporary RDF/XML definition URI>'],
            'exit_code': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tools', type=Path)
    parser.add_argument('--java')
    parser.add_argument('--hermit-jar', type=Path)
    parser.add_argument('--oops-local', action='store_true')
    parser.add_argument('--oops-artifact-lock', type=Path)
    parser.add_argument('--oops-review-record', type=Path)
    parser.add_argument('--self-check', action='store_true')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if args.self_check:
        print(json.dumps(oops_self_check()))
        return 0
    if not args.tools or not args.output:
        parser.error('--tools and --output required')
    if args.output.exists():
        parser.error('existing evidence must not be overwritten')
    sys.path.insert(0, str(args.tools.resolve()))
    from rdflib import Graph
    path = HERE / 'ontology.ttl'
    before = hashlib.sha256(path.read_bytes()).hexdigest()
    graph = Graph().parse(path, format='turtle')
    checks = {}
    installed = args.tools.resolve() / 'logic'
    java = args.java or shutil.which('java') or next((str(p) for p in installed.glob('jdk-*-jre/bin/java.exe')), None)
    jar = args.hermit_jar or installed / 'HermiT.jar'
    for name, operation in [('HermiT', lambda: hermit(graph, java, jar)),
                            ('OOPS', lambda: local_oops(graph, args.tools.resolve(), args.oops_artifact_lock, args.oops_review_record)
                             if args.oops_local else {'status': 'not_run', 'mode': 'local', 'reason': '--oops-local not requested'})]:
        try:
            checks[name] = operation()
        except (OSError, ValueError, subprocess.TimeoutExpired) as exc:
            checks[name] = {'status': 'not_run', 'reason': str(exc)}
        print(json.dumps({'gate': name, 'status': checks[name]['status']}, ensure_ascii=False), flush=True)
    changed = before != hashlib.sha256(path.read_bytes()).hexdigest()
    status = 'fail' if changed or any(c['status'] == 'fail' for c in checks.values()) else 'not_run' if any(c['status'] != 'pass' for c in checks.values()) else 'pass'
    code = {'pass': 0, 'fail': 1, 'not_run': 2}[status]
    report = {'status': status, 'exit_code': code, 'timestamp': datetime.now(timezone.utc).isoformat(),
              'ontology_sha256': before, 'input_changed': changed, 'checks': checks,
              'system_validation': 'incomplete', 'instance_records_read': 0,
              'references': ['https://www.cs.ox.ac.uk/isg/tools/HermiT/command.html',
                             'https://owlready2.readthedocs.io/en/latest/reasoning.html',
                             'https://oops.linkeddata.es/webservice.html']}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('x', encoding='utf-8') as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2)
        stream.write('\n')
    return code


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    raise SystemExit(main())
