"""Run specification checks only; no marketing instances, fixtures or generators."""
import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
REQUIRED_SPEC = {
    '40-type field semantics coverage and declared concept references',
    'D003B 11-type schema/field coverage and metric references',
    '13 questions × 4 categories; 30-question status; policy traceability',
    'Proposal IDs/counts/observation arithmetic and approval boundary',
    'Search/social/own-sales contract completeness',
    'RDFLib Turtle parsing',
    'RDF declaration/shape/mapping references',
    'pySHACL SHACL specification meta-validation',
    'SHACL-SPARQL constraint syntax',
    'Declared hierarchy/disjointness structure',
    'OWL RL definition entailments and detected contradictions',
    'New-document local links',
}


def classify(kind, result):
    """An exit-0 report that skipped a required tool must not become a pass."""
    if kind == 'spec':
        checks = result['checks']
        names = [c['name'] for c in checks]
        if len(names) != len(set(names)) or any(c['status'] == 'fail' for c in checks):
            return 'fail'
        found = {c['name']: c['status'] for c in checks}
        return 'pass' if all(found.get(n) == 'pass' for n in REQUIRED_SPEC) else 'not_run'
    if kind == 'schemas':
        rows = result['results']
        expected = {'../batches/D003B/batch.schema.json', '../schemas/marketing-records.schema.json'}
        return 'pass' if len(rows) == 2 and {r['schema'] for r in rows} == expected and all(r['metaschema'] == r['compile'] == 'pass' for r in rows) else 'fail'
    if kind == 'catalog':
        return 'pass' if result['types'] == 40 and result['metaschemaValidation'].startswith('passed:') and result['generatedMarketingRecords'] == 0 else 'not_run'
    raise ValueError('Unknown check kind: ' + kind)


def execute(kind, command):
    try:
        process = subprocess.run(command, cwd=ROOT, capture_output=True, text=True,
                                 encoding='utf-8', errors='replace', timeout=60,
                                 env={**os.environ, 'PYTHONIOENCODING': 'utf-8'})
        try:
            result = json.loads(process.stdout)
            status = classify(kind, result) if process.returncode == 0 else 'fail'
            detail = {'result': result}
        except (ValueError, KeyError, TypeError) as exc:
            status, detail = 'fail', {'reason': 'Invalid checker report: ' + str(exc), 'stdout': process.stdout}
        return {'check': kind, 'command': command, 'exit_code': process.returncode,
                'status': status, 'stderr': process.stderr, **detail}
    except FileNotFoundError as exc:
        return {'check': kind, 'command': command, 'exit_code': None, 'status': 'not_run', 'reason': str(exc)}
    except subprocess.TimeoutExpired:
        return {'check': kind, 'command': command, 'exit_code': None, 'status': 'fail', 'reason': 'Checker timed out after 60 seconds'}


def self_check():
    # Protocol metadata only. No marketing record/value/fixture is constructed.
    report = {'checks': [{'name': n, 'status': 'pass'} for n in sorted(REQUIRED_SPEC)]}
    assert classify('spec', report) == 'pass'
    report['checks'][0]['status'] = 'not_run'
    assert classify('spec', report) == 'not_run'
    report['checks'][0]['status'] = 'fail'
    assert classify('spec', report) == 'fail'
    assert classify('spec', {'checks': []}) == 'not_run'
    assert classify('spec', {'checks': report['checks'][1:]}) == 'not_run'
    print(json.dumps({'protocol_checks': 5, 'status': 'pass', 'marketing_records_created': 0}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tools', type=Path, help='Isolated RDFLib/pySHACL directory')
    parser.add_argument('--self-check', action='store_true')
    args = parser.parse_args()
    if sys.flags.optimize:
        parser.error('Run without -O/PYTHONOPTIMIZE; existing checkers use assertions')
    if args.self_check:
        self_check()
        return 0
    python_command = [sys.executable, str(HERE / 'check-spec.py')]
    if args.tools:
        python_command += ['--tools', str(args.tools.resolve())]
    commands = [('spec', python_command),
                ('schemas', ['node', str(HERE / 'check-json-schemas.mjs')]),
                ('catalog', ['node', str(HERE.parent / 'schemas/check-catalog.mjs')])]
    started = datetime.now(timezone(timedelta(hours=9))).isoformat()
    revision = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=ROOT, capture_output=True, text=True)
    dirty = subprocess.run(['git', 'status', '--porcelain=v1'], cwd=ROOT, capture_output=True, text=True)
    paths = [p for p in HERE.iterdir() if p.is_file() and p.suffix in {'.md', '.json', '.ttl', '.py', '.mjs'}
             and p.name not in {'validation-results.json', 'preservation-results.json'}]
    paths += [HERE.parent / 'schemas' / n for n in ['check-catalog.mjs', 'marketing-records.schema.json', 'temporal-policy.mjs']]
    paths += [HERE.parent / 'batches/D003B/batch.schema.json', HERE.parent / 'data-source-register.md']
    paths += [HERE.parent / 'field-dictionary.md']
    snapshot = {str(p.relative_to(ROOT)).replace('\\', '/'): hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
    checks = [execute(kind, command) for kind, command in commands]
    status = 'fail' if any(c['status'] == 'fail' for c in checks) else 'not_run' if any(c['status'] != 'pass' for c in checks) else 'pass'
    print(json.dumps({'scope': 'specification_only', 'started_at': started,
          'git_commit': revision.stdout.strip() if revision.returncode == 0 else None,
          'git_dirty_status': dirty.stdout if dirty.returncode == 0 else None,
          'python': sys.version.split()[0], 'input_sha256': snapshot,
          'specification_status': status, 'checks': checks,
          'system_validation': 'incomplete',
          'remaining_gates': ['G1 independent meaning review', 'G3 OWL logic/design',
                              'G4 approved transformation/data conformance', 'G5 independent calculation/query',
                              'G6 question/evidence/abstention', 'G7 exception/regression/reproducibility'],
          'data_operations_executed': False}, ensure_ascii=False, indent=2))
    return 0 if status == 'pass' else 1 if status == 'fail' else 2


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    raise SystemExit(main())
