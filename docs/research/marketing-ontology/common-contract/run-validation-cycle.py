"""Run approved D004 evidence gates; write a compact, reproducible report."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
DATA = HERE.parent / 'batches/D003B'


def run(name, command, timeout):
    try:
        process = subprocess.run(command, cwd=ROOT, capture_output=True, text=True,
                                 encoding='utf-8', errors='replace', timeout=timeout,
                                 env={**os.environ, 'PYTHONIOENCODING': 'utf-8'})
        try:
            payload = json.loads(process.stdout)
            status = payload.get('status', payload.get('specification_status', 'not_run'))
            if process.returncode not in (0, 2):
                status = 'fail'
        except json.JSONDecodeError:
            payload = {'reason': 'invalid JSON report', 'stdout_tail': process.stdout[-2000:]}
            status = 'fail'
        return {'name': name, 'status': status, 'exit_code': process.returncode,
                'result': payload, 'stderr_tail': process.stderr[-2000:]}
    except subprocess.TimeoutExpired:
        return {'name': name, 'status': 'fail', 'exit_code': None,
                'reason': f'timeout after {timeout}s'}


def test_statuses(results):
    tests = json.loads((HERE / 'tests.json').read_text(encoding='utf-8'))['tests']
    existing = {'CQ01-1', 'CQ02-1', 'CQ02-3', 'CQ04-1', 'CQ04-3', 'CQ05-1', 'CQ05-3',
                'CQ06-1', 'CQ06-3', 'CQ07-1', 'CQ11-1', 'CQ11-3', 'CQ11-4', 'CQ12-1',
                'CQ12-3', 'CQ12-4', 'CQ14-3', 'CQ15-3', 'CQ17-1', 'CQ17-3', 'CQ17-4',
                'CQ23-1', 'CQ23-3', 'CQ28-1', 'CQ28-4'}
    components = next((r['result'].get('factual_components', {}) for r in results
                       if r['name'] == 'D004_full' and r['status'] == 'pass'), {})
    return [{'id': t['id'], 'category': t['category'], 'expected_status': t['expected']['status'],
             'factual_component': components.get(t['id'], {'status': 'not_run',
                 'reason': 'deterministic query not connected or separately approved input required'}),
             'ontology_fact_scope': 'existing_D003B' if t['id'] in existing else 'separate_fixture_or_source_required',
             'execution_route': 'deterministic_query_or_policy' if t['id'] in existing else 'approval_or_source_then_query',
             'future_AI_judgment': 'separate_from_deterministic_contract',
             'end_to_end_status': 'not_run',
             'reason': 'Full assertions/evidence/completeness contract not implemented; factual checks are partial components'
                       if t['id'] in existing else
                       'condition needs a separately approved isolated fixture or unavailable source'} for t in tests]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--approved-d004', action='store_true', help='required acknowledgment of separate data approval')
    parser.add_argument('--tools', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if not args.approved_d004:
        parser.error('D004 data reuse requires its separate recorded approval')
    output = args.output.resolve()
    if output.exists():
        parser.error('Refusing to overwrite prior evidence')
    tools_path = str(args.tools.resolve())
    py = sys.executable
    commands = [('spec', [py, str(HERE / 'run-spec-cycle.py'), '--tools', tools_path], 90),
                ('D004_small', [py, str(HERE / 'validate-d003b.py'), '--stage', 'small',
                                '--order-check', '--tools', tools_path], 180),
                ('D004_full', [py, str(HERE / 'validate-d003b.py'), '--stage', 'full', '--tools', tools_path], 600),
                ('independent_calculation', [py, str(HERE / 'calculate-d003b.py')], 30),
                ('calculation_replay', [py, str(HERE / 'calculate-d003b.py')], 30)]
    inputs = [HERE / name for name in ('ontology.ttl','shapes.ttl','field-semantics.json',
              'd003b-mapping.json','batch-selection.json','tests.json','run-validation-cycle.py',
              'validate-d003b.py','calculate-d003b.py','check-spec.py')]
    inputs += [DATA / 'manifest.json'] + sorted((DATA / 'source').glob('*.jsonl'))
    hashes = {str(path.relative_to(ROOT)).replace('\\','/'): hashlib.sha256(path.read_bytes()).hexdigest()
              for path in inputs}
    results = []
    for name, command, timeout in commands:
        result = run(name, command, timeout)
        results.append(result)
        if result['status'] != 'pass':
            break
    if len(results) == len(commands) and results[-1]['result'] != results[-2]['result']:
        results.append({'name': 'calculation_replay_equality', 'status': 'fail', 'exit_code': None})
    elif len(results) == len(commands):
        results.append({'name': 'calculation_replay_equality', 'status': 'pass', 'exit_code': 0})
    changed_inputs = [name for name, digest in hashes.items()
                      if hashlib.sha256((ROOT / name).read_bytes()).hexdigest() != digest]
    if changed_inputs:
        results.append({'name': 'input_immutability', 'status': 'fail', 'exit_code': None,
                        'reason': 'inputs changed during cycle', 'paths': changed_inputs})
    else:
        results.append({'name': 'input_immutability', 'status': 'pass', 'exit_code': 0})
    tests = test_statuses(results)
    report = {'cycle': 'D004-memory-v1', 'started_at': datetime.now(timezone.utc).isoformat(),
              'git_head': subprocess.run(['git','rev-parse','HEAD'], cwd=ROOT, capture_output=True, text=True).stdout.strip(),
              'python': sys.version.split()[0], 'input_sha256': hashes,
              'checks': results, 'test_cases': tests,
              'test_status_counts': {'pass': 0, 'fail': 0, 'not_run': len(tests)},
              'factual_component_counts': {s: sum(t['factual_component']['status'] == s for t in tests)
                                           for s in ('pass','fail','not_run')},
              'HermiT': 'not_run', 'OOPS': 'not_run',
              'actual_external_source_fit': 'not_run', 'future_AI_answer_evaluation': 'not_run',
              'system_validation': 'incomplete'}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'report': str(output), 'checks': [(r['name'], r['status'], r['exit_code']) for r in results],
                      '52_tests': report['test_status_counts'], 'system_validation': 'incomplete'}, ensure_ascii=False))
    return 0 if len(results) == len(commands) + 2 and all(r['status'] == 'pass' for r in results) else 1


if __name__ == '__main__':
    raise SystemExit(main())
