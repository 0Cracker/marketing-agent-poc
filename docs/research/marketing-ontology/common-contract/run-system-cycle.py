"""Fresh D004 + D005/60 + logic + original-52 report in one reproducible cycle."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git_state():
    def read(*args):
        result = subprocess.run(['git', *args], cwd=ROOT, text=True, capture_output=True, encoding='utf-8', check=True)
        return result.stdout.strip()
    index = Path(read('rev-parse', '--git-path', 'index'))
    if not index.is_absolute():
        index = ROOT / index
    # Other worktrees legitimately advance unrelated branches during a long regression.
    return {'head': read('rev-parse', 'HEAD'), 'refs': read('symbolic-ref', 'HEAD'), 'index_sha256': sha(index)}


def invoke(name, command, report_path=None, timeout=900):
    try:
        process = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace',
                                 timeout=timeout, env={**os.environ, 'PYTHONIOENCODING': 'utf-8', 'PYTHONDONTWRITEBYTECODE': '1'})
        if report_path:
            result = json.loads(report_path.read_text(encoding='utf-8'))
        else:
            result = json.loads(process.stdout)
        d004_names = {'spec', 'D004_small', 'D004_full', 'independent_calculation',
                      'calculation_replay', 'calculation_replay_equality', 'input_immutability'}
        d004_checks = result.get('checks', []) if name == 'D004' else []
        d004_pass = (isinstance(d004_checks, list) and len(d004_checks) == 7 and {c.get('name') for c in d004_checks} == d004_names
                     and all(c['status'] == 'pass' for c in d004_checks))
        declared = result.get('status', 'pass' if name == 'D004' and d004_pass else 'not_run')
        if name == 'D005' and declared == 'pass':
            required = {'schema_preflight', 'normal_source_common_and_semantics', 'independent_oracle_and_RDF',
                        'reverse_order_RDF', 'validation_replay', 'expected_error_detection', 'boundary_checks', 'preservation'}
            found = result.get('checks', [])
            errors = result.get('error_cases', [])
            if ({c.get('name') for c in found} != required or len(found) != len(required)
                    or not all(c.get('status') == 'pass' for c in found)
                    or len(errors) != 60 or not all(c.get('status') == 'pass' for c in errors)):
                declared = 'fail'
        if name == 'questions' and declared == 'pass':
            cases = result.get('test_cases', [])
            assertions = [a for case in cases for a in case.get('assertions', [])]
            if (len(cases) != 52 or len({c.get('id') for c in cases}) != 52
                    or any(c.get('end_to_end_status') != 'pass' for c in cases)
                    or len(assertions) < 682 or any(a.get('status') != 'pass' for a in assertions)):
                declared = 'fail'
        status = 'fail' if process.returncode not in (0, 2) else declared
        if declared == 'pass' and process.returncode != 0:
            status = 'fail'
        return {'name': name, 'status': status, 'command': command, 'exit_code': process.returncode,
                'report': str(report_path.relative_to(ROOT)).replace('\\', '/') if report_path else None,
                'report_sha256': sha(report_path) if report_path else None,
                'result': result, 'stderr': process.stderr}
    except FileNotFoundError as exc:
        return {'name': name, 'status': 'not_run', 'command': command, 'reason': str(exc)}
    except subprocess.TimeoutExpired as exc:
        return {'name': name, 'status': 'not_run', 'command': command, 'reason': f'timeout after {exc.timeout}s'}
    except (ValueError, OSError) as exc:
        return {'name': name, 'status': 'fail', 'command': command, 'reason': 'missing/invalid execution report: ' + str(exc)}


REQUIRED_GATES = {'protocol', 'completion_protocol', 'D004', 'D005', 'dictionary', 'logic', 'questions'}


def completion(checks, inputs_preserved, git_preserved):
    """A missing gate is incomplete; successful subprocess exits alone never complete a cycle."""
    names = [c['name'] for c in checks]
    if len(names) != len(set(names)) or not inputs_preserved or not git_preserved or any(c['status'] == 'fail' for c in checks):
        return 'fail'
    if set(names) != REQUIRED_GATES or any(c['status'] != 'pass' for c in checks):
        return 'not_run'
    by_name = {c['name']: c.get('result', {}) for c in checks}
    dictionary, questions, logic = by_name['dictionary'], by_name['questions'], by_name['logic']
    if dictionary.get('rows') != 528 or dictionary.get('conforming_rows') != 528 or dictionary.get('field_review', {}).get('status') != 'pass':
        return 'not_run'
    independent = dictionary.get('independent_readback', {})
    if (independent.get('status') != 'pass' or independent.get('completion_semantics', {}).get('status') != 'pass'
            or independent.get('canonical_domain', {}).get('status') != 'pass'):
        return 'not_run'
    if questions.get('test_status_counts') != {'pass': 52, 'fail': 0, 'not_run': 0}:
        return 'not_run'
    if any(logic.get('checks', {}).get(name, {}).get('status') != 'pass' for name in ('HermiT', 'OOPS')):
        return 'not_run'
    oops = logic['checks']['OOPS']
    if oops.get('scan_executed') is not True or oops.get('unresolved_finding_count') != 0:
        return 'not_run'
    return 'pass'


def self_check():
    good = [{'name': name, 'status': 'pass', 'result': {}} for name in sorted(REQUIRED_GATES)]
    for c in good:
        if c['name'] == 'dictionary':
            c['result'] = {'rows': 528, 'conforming_rows': 528, 'field_review': {'status': 'pass'},
                           'independent_readback': {'status': 'pass', 'completion_semantics': {'status': 'pass'}, 'canonical_domain': {'status': 'pass'}}}
        if c['name'] == 'questions':
            c['result'] = {'test_status_counts': {'pass': 52, 'fail': 0, 'not_run': 0}}
        if c['name'] == 'logic':
            c['result'] = {'checks': {'HermiT': {'status': 'pass'}, 'OOPS': {'status': 'pass', 'scan_executed': True, 'unresolved_finding_count': 0}}}
    assert completion(good, True, True) == 'pass'
    assert completion(good[:-1], True, True) == 'not_run'
    assert completion(good + [good[0]], True, True) == 'fail'
    assert completion(good, False, True) == 'fail'
    assert completion(good, True, False) == 'fail'
    assert completion([{**c, 'status': 'fail'} if c['name'] == 'dictionary' else c for c in good], True, True) == 'fail'
    assert completion([{**c, 'result': {}} if c['name'] == 'dictionary' else c for c in good], True, True) == 'not_run'
    assert completion([{**c, 'result': {}} if c['name'] == 'logic' else c for c in good], True, True) == 'not_run'
    assert completion([{**c, 'result': {}} if c['name'] == 'questions' else c for c in good], True, True) == 'not_run'
    assert invoke('completion_protocol', [sys.executable, '-c', 'print(\'{"status":"pass","checks":1648}\')'])['status'] == 'pass'
    assert invoke('D004', [sys.executable, '-c', 'print(\'{"checks":7}\')'])['status'] == 'not_run'
    return {'status': 'pass', 'checks': 11}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tools', type=Path)
    parser.add_argument('--java')
    parser.add_argument('--hermit-jar', type=Path)
    parser.add_argument('--question-approval-record', type=Path)
    parser.add_argument('--additional-approval-record', type=Path, action='append', default=[])
    parser.add_argument('--oops-local', action='store_true')
    parser.add_argument('--oops-artifact-lock', type=Path)
    parser.add_argument('--oops-review-record', type=Path)
    parser.add_argument('--supplement', type=Path)
    parser.add_argument('--supplement-approval-record', type=Path)
    parser.add_argument('--field-review-record', type=Path)
    parser.add_argument('--completion', action='store_true', help='Use the delegated completion, field review and local OOPS disposition records')
    parser.add_argument('--self-check', action='store_true')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if sys.flags.optimize:
        parser.error('do not use -O/PYTHONOPTIMIZE')
    if args.self_check:
        print(json.dumps(self_check()))
        return 0
    if not args.tools or not args.output:
        parser.error('--tools and --output required')
    if args.completion:
        args.supplement = args.supplement or HERE / 'completion-values.json'
        args.supplement_approval_record = args.supplement_approval_record or HERE / 'completion-values-authorization.json'
        args.field_review_record = args.field_review_record or HERE / 'completion-field-review.json'
        args.oops_review_record = args.oops_review_record or HERE / 'completion-oops-review.json'
        args.question_approval_record = args.question_approval_record or HERE / 'question-approval-20261015.json'
        if not args.additional_approval_record:
            args.additional_approval_record = [HERE / 'd006-approval-20261016.json']
        args.oops_local = True
    output = args.output.resolve()
    outputs = {n: output.with_name(output.stem + '-' + n.lower() + '.json') for n in ('D004', 'D005', 'dictionary', 'logic', 'questions')}
    if any(p.exists() for p in [output, *outputs.values()]):
        parser.error('all report paths must be new; previous evidence is preserved')
    tools = args.tools.resolve()
    py = sys.executable
    paths = [p for p in HERE.iterdir() if p.is_file() and p.suffix in {'.py', '.json', '.ttl', '.mjs', '.md'}
             and p.name not in {'validation-results.json', 'preservation-results.json'}]
    for name in ('D003B', 'D005'):
        folder = HERE.parent / 'batches' / name
        paths += [p for p in folder.iterdir() if p.is_file() and p.suffix in {'.py', '.json', '.mjs', '.md'}]
        paths += list((folder / 'source').glob('*.jsonl'))
    paths += [HERE.parent / n for n in ('data-proposal.md', 'field-dictionary.md', 'schema-contract.md')]
    paths += list((HERE.parent / 'schemas').glob('*.*'))
    paths += [p.resolve() for p in (args.question_approval_record, args.oops_artifact_lock, args.hermit_jar,
                                  args.supplement, args.supplement_approval_record, args.field_review_record, args.oops_review_record) if p]
    default_lock = tools / 'logic/oops/install-lock.json'
    if args.oops_local and not args.oops_artifact_lock and default_lock.is_file():
        paths.append(default_lock)
    if args.additional_approval_record:
        from d006_data import authorized, COUNTS
        for approval in args.additional_approval_record:
            authorized(approval)
            paths.append(approval.resolve())
        for batch in COUNTS:
            paths += list((HERE.parent / 'batches' / batch).rglob('*.json'))
            paths += list((HERE.parent / 'batches' / batch).rglob('*.jsonl'))
    snapshot = {str(p.resolve()): sha(p) for p in paths}
    before_git = git_state()
    before_refs = subprocess.check_output(['git', 'show-ref'], cwd=ROOT, text=True, encoding='utf-8').strip()
    report = {'cycle': 'CQ52-integrated-v1', 'started_at': datetime.now(timezone.utc).isoformat(),
              'git_before': before_git, 'input_sha256': snapshot, 'python': sys.version,
              'checks': [], 'system_validation': 'incomplete', 'new_source_rows': 0,
              'original_tests_sha256': sha(HERE / 'tests.json')}
    commands = [
        ('protocol', [py, str(HERE / 'run-question-cycle.py'), '--self-check'], None),
        ('completion_protocol', [shutil.which('node') or 'node', str(HERE / 'check-completion-protocol.mjs')], None),
        ('D004', [py, str(HERE / 'run-validation-cycle.py'), '--approved-d004', '--tools', str(tools), '--output', str(outputs['D004'])], outputs['D004']),
        ('D005', [shutil.which('node') or 'node', str(HERE.parent / 'batches/D005/run.mjs'), 'validate', '--python', py, '--tools', str(tools), '--output', str(outputs['D005'])], outputs['D005']),
        ('dictionary', [shutil.which('node') or 'node', str(HERE / 'check-d005-dictionary.mjs'), '--python', py, '--tools', str(tools), '--output', str(outputs['dictionary'])], outputs['dictionary']),
    ]
    if args.supplement or args.supplement_approval_record:
        if not args.supplement or not args.supplement_approval_record:
            parser.error('--supplement and --supplement-approval-record required together')
        commands[-1][1].extend(['--supplement', str(args.supplement.resolve()), '--supplement-approval-record', str(args.supplement_approval_record.resolve())])
    if args.field_review_record:
        commands[-1][1].extend(['--field-review-record', str(args.field_review_record.resolve())])
    logic = [py, str(HERE / 'check-logic.py'), '--tools', str(tools), '--output', str(outputs['logic'])]
    if args.java:
        logic += ['--java', args.java]
    if args.hermit_jar:
        logic += ['--hermit-jar', str(args.hermit_jar.resolve())]
    if args.oops_local:
        logic += ['--oops-local']
    if args.oops_artifact_lock:
        logic += ['--oops-artifact-lock', str(args.oops_artifact_lock.resolve())]
    if args.oops_review_record:
        logic += ['--oops-review-record', str(args.oops_review_record.resolve())]
    question = [py, str(HERE / 'run-question-cycle.py'), '--tools', str(tools), '--output', str(outputs['questions'])]
    if args.question_approval_record:
        question += ['--approval-record', str(args.question_approval_record.resolve())]
    for approval in args.additional_approval_record:
        question += ['--additional-approval-record', str(approval.resolve())]
    commands += [('logic', logic, outputs['logic']), ('questions', question, outputs['questions'])]
    for name, command, path in commands:
        result = invoke(name, command, path)
        report['checks'].append(result)
        print(json.dumps({'gate': name, 'status': result['status'], 'exit_code': result.get('exit_code')}, ensure_ascii=False), flush=True)
    report['changed_inputs'] = [p for p, value in snapshot.items() if sha(Path(p)) != value]
    report['git_preserved'] = git_state() == before_git
    after_refs = subprocess.check_output(['git', 'show-ref'], cwd=ROOT, text=True, encoding='utf-8').strip()
    report['other_worktree_ref_changes'] = sorted(set(before_refs.splitlines()) ^ set(after_refs.splitlines()))
    questions = next(c.get('result', {}) for c in report['checks'] if c['name'] == 'questions')
    report['52_tests'] = questions.get('test_status_counts', {'pass': 0, 'fail': 0, 'not_run': 52})
    dictionary = next(c.get('result', {}) for c in report['checks'] if c['name'] == 'dictionary')
    model = next(c.get('result', {}) for c in report['checks'] if c['name'] == 'logic')
    report['meaning_review'] = {'design_review': 'see question-execution.md', 'field_review_status': dictionary.get('field_review', {}).get('status', 'not_run'),
                                'field_review_kind': dictionary.get('field_review', {}).get('review_kind'),
                                'human_direct_field_review': False if args.completion else dictionary.get('field_review', {}).get('human_confirmed'),
                                'business_definition_review': 'delegated_ai_review' if args.completion else 'confirmed_by_user_decisions_2A_3A',
                                'decision_record': 'completion-delegation-20261016.json' if args.completion else 'meaning-decisions-20261016.json',
                                'actual_provider_mapping': 'out_of_scope', 'actual_data_fit': 'out_of_scope',
                                'open_issues': dictionary.get('gap_groups', []),
                                'OOPS': {'status': model.get('checks', {}).get('OOPS', {}).get('status', 'not_run'),
                                         'raw_findings': model.get('checks', {}).get('OOPS', {}).get('finding_count'),
                                         'unresolved_findings': model.get('checks', {}).get('OOPS', {}).get('unresolved_finding_count')}}
    report['status'] = completion(report['checks'], not report['changed_inputs'], report['git_preserved'])
    report['system_validation'] = 'complete' if report['status'] == 'pass' else 'incomplete'
    report['exit_code'] = {'pass': 0, 'fail': 1, 'not_run': 2}[report['status']]
    report['finished_at'] = datetime.now(timezone.utc).isoformat()
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('x', encoding='utf-8') as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2)
        stream.write('\n')
    print(json.dumps({'report': str(output), 'status': report['status'], '52_tests': report['52_tests'],
                      'system_validation': report['system_validation']}, ensure_ascii=False))
    return report['exit_code']


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    raise SystemExit(main())
