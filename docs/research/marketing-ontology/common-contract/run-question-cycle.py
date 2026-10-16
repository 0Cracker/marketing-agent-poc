"""Inventory without instances; execute original 52 contracts only with scoped approval."""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sys

from question_contract import (HERE, ROOT, ROUTES, GAPS, POLICIES, DOMAIN_TYPES, VERSION, load_module,
                               answer, rdf_records, request_supported, support_counts)
from question_oracle import REQUIRED_DOMAINS

SCOPE_ID = 'CQ52-READONLY-1'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def specifications():
    payload = json.loads((HERE / 'tests.json').read_text(encoding='utf-8'))
    tests = payload['tests']
    ids = [t['id'] for t in tests]
    if len(ids) != 52 or len(set(ids)) != 52 or set(ids) != set(ROUTES) | set(GAPS) or set(ROUTES) & set(GAPS):
        raise ValueError('52-test inventory missing/duplicate/unknown IDs')
    if set(ROUTES) != set(POLICIES) or set(ROUTES) != set(REQUIRED_DOMAINS):
        raise ValueError('query/oracle/policy routes disagree')
    return tests


def scope():
    """Only manifest metadata; never parses source rows before authorization."""
    batches = {}
    for name in ('D003B', 'D005'):
        manifest_path = HERE.parent / 'batches' / name / 'manifest.json'
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
        files = manifest['files']
        if isinstance(files, dict):
            files = [{'path': str((manifest_path.parent / 'source' / k).relative_to(ROOT)).replace('\\', '/'),
                      'rows': v['records'], 'sha256': v['sha256']} for k, v in files.items()]
        batches[name] = {'manifest_sha256': digest(manifest_path), 'rows': sum(f['rows'] for f in files),
                         'files': sorted(files, key=lambda f: f['path'])}
    return {'scope_id': SCOPE_ID, 'tests_sha256': digest(HERE / 'tests.json'),
            'batches': batches, 'question_input': 'D003B 1652 rows only; existing field values; memory-only RDF/context',
            'D005_use': 'existing approved 534-row regression and existing 60 in-memory fault cases only; no substitution for question conditions',
            'implemented_ids': sorted(ROUTES), 'unavailable_condition_ids': sorted(GAPS),
            'new_source_rows': 0, 'new_annotations': 0, 'new_fault_cases': 0, 'source_rewrites': 0,
            'permanent_RDF_or_DB': False,
            'checks': ['independent Decimal values', 'status', 'file/hash/record/field/asOf/version evidence',
                       'completeness', 'scope and forbidden inferences', 'same-input replay', 'input order stability'],
            'not_authorized_by_plan_execution': True}


def authorization(record_path, spec):
    if record_path is None:
        return False, 'CQ52-READONLY-1 개별 데이터 재사용 승인 기록 없음; 계획 실행 지시는 개별 승인이 아님'
    record = json.loads(record_path.read_text(encoding='utf-8'))
    expected_hash = hashlib.sha256(json.dumps(spec, ensure_ascii=False, sort_keys=True).encode('utf-8')).hexdigest()
    if (record.get('scope_id') != SCOPE_ID or record.get('scope_sha256') != expected_hash
            or record.get('approved') is not True or not record.get('user_message')
            or not record.get('recorded_at') or record.get('source') != 'explicit_human_response'):
        return False, '승인 대상·범위 hash·사용자 명시 응답·기록시각 불일치'
    return True, 'scoped explicit approval recorded'


def inventory(tests, approved=False):
    rows = []
    manifest = scope()['batches']['D003B']['files']
    for test in tests:
        test_id = test['id']
        types = sorted({t for d in ROUTES.get(test_id, ()) for t in DOMAIN_TYPES[d]})
        rows.append({'id': test_id, 'question_id': test['question_id'], 'category': test['category'],
                     'condition': test['input_spec']['condition'], 'required_fields': test['input_spec']['fields'],
                     'expected': test['expected'], 'policies': test['policies'],
                     'readiness': '현재 실행 가능' if test_id in ROUTES else '자료 부족',
                     'query_implemented': test_id in ROUTES, 'data_validation': 'not_run_until_CQ52_approval',
                     'execution_authorized': approved, 'execution_status': 'not_run',
                     'route': list(ROUTES.get(test_id, ())), 'oracle_domains': REQUIRED_DOMAINS.get(test_id, '').split(),
                     'inputs': [f for f in manifest if Path(f['path']).stem in types],
                     'selector': 'original tests.json product/country/period/asOf; all original IDs in the listed immutable files',
                     'reason': '조회·독립 oracle·상태/값/근거/완전성 assertion 연결. 데이터 실행 검증은 개별 승인 후 확인'
                               if test_id in ROUTES else GAPS[test_id],
                     'implementation_gap': None if test_id in ROUTES else '해당 조건용 조회/정책 분기와 독립 oracle는 승인된 입력 확정 후 구현',
                     'D005_substitution': False})
    return rows


def verdict(assertions):
    if not assertions:
        return 'not_run'
    statuses = [a.get('status') for a in assertions]
    if any(s == 'fail' for s in statuses):
        return 'fail'
    return 'pass' if all(s == 'pass' for s in statuses) else 'not_run'


def summary(results):
    counts = Counter(r['end_to_end_status'] for r in results)
    return {s: counts[s] for s in ('pass', 'fail', 'not_run')}


def self_check(tests):
    # Protocol/specification checks only; no source instances or altered fixtures.
    assert len(tests) == 52
    assert verdict([]) == 'not_run'
    assert verdict([{'status': 'pass'}, {'status': 'fail'}]) == 'fail'
    assert verdict([{'status': 'pass'}, {'status': 'not_run'}]) == 'not_run'
    assert verdict([{'status': 'pass'}]) == 'pass'
    assert verdict([{'status': 'unexpected'}]) == 'not_run'
    spec = scope()
    assert not authorization(None, spec)[0]
    assert spec['batches']['D003B']['rows'] == 1652 and spec['batches']['D005']['rows'] == 534
    assert spec['new_source_rows'] == spec['new_annotations'] == spec['new_fault_cases'] == 0
    assert all(set(d.split()) == set(ROUTES[k]) | ({'boundary_decision'} if k == 'CQ05-2' else set()) for k, d in REQUIRED_DOMAINS.items())
    assert len(inventory(tests)) == 52
    assert summary([{'end_to_end_status': 'not_run'} for _ in tests]) == {'pass': 0, 'fail': 0, 'not_run': 52}
    assert not request_supported('unsupported_question', 'unsupported_period', {t['question_id'] for t in tests})
    assert request_supported('CQ01', 'Q3_2025_2026', {t['question_id'] for t in tests})
    assert support_counts([{'end_to_end_status': 'pass', 'answer': {'status': s}} for s in ['insufficient_data', 'incomparable', 'out_of_scope', 'execution_failed']]) == {'substantive_answers': 0, 'guard_passes': 4}
    from d006_data import A_CASES, B_CASES, FAULTS, authorized
    assert set(A_CASES) | set(B_CASES) == set(GAPS) and not set(A_CASES) & set(B_CASES)
    assert sum(map(len, A_CASES.values())) - 2 == 16 and len(FAULTS) == 10
    assert request_supported('CQ06', '2025-11-02/2025-11-03@America/New_York', {t['question_id'] for t in tests})
    assert not request_supported('CQ01', '2025-11-02/2025-11-03@America/New_York', {t['question_id'] for t in tests})
    assert not authorization(HERE / 'd006-approval-20261016.json', spec)[0]
    try:
        authorized(HERE / 'question-approval-20261015.json')
    except PermissionError:
        pass
    else:
        raise AssertionError('base approval expanded into D006 authorization')
    return {'status': 'pass', 'protocol_checks': 21, 'marketing_instances_read_or_created': 0,
            'query_integration': 'not_exercised_by_protocol_self_check'}


def write_inventory(tests, result_path=None, approval_path=None):
    approved, _ = authorization(approval_path, scope())
    rows = inventory(tests, approved=approved)
    revisions_path = HERE / 'question-revisions-20261016.json'
    if revisions_path.exists():
        revisions = json.loads(revisions_path.read_text(encoding='utf-8'))
        if revisions['original_tests_sha256'] != digest(HERE / 'tests.json'):
            raise ValueError('contract revision no longer matches original tests')
        for row in rows:
            if row['id'] in revisions['overrides']:
                row['contract_revision'] = revisions['overrides'][row['id']]
                row['revision_version'] = revisions['version']
    result = None
    if result_path:
        result = json.loads(result_path.read_text(encoding='utf-8'))
        by_id = {t['id']: t for t in result['test_cases']}
        if (set(by_id) != {t['id'] for t in tests} or len(result['test_cases']) != 52
                or result.get('data_reuse_authorized') is not True or result.get('changed_inputs')
                or result.get('query_version') != VERSION or result.get('scope_id') != SCOPE_ID):
            raise ValueError('inventory requires a complete, authorized report for the current query version')
        inputs = result['input_sha256']
        required = [HERE / 'tests.json', HERE / 'question_contract.py', HERE / 'question_oracle.py']
        required += [ROOT / f['path'] for batch in scope()['batches'].values() for f in batch['files']]
        if any(inputs.get(str(p.relative_to(ROOT)).replace('\\', '/')) != digest(p) for p in required):
            raise ValueError('inventory result source/test/query hashes differ from current inputs')
        if summary(list(by_id.values())) != result['test_status_counts']:
            raise ValueError('inventory result counts disagree with per-test outcomes')
        additional = result.get('additional_validation')
        if additional:
            from d006_data import authorized, sha, load, A_CASES, B_CASES
            authorized(ROOT / additional['approval_record'])
            for path, expected_hash in additional['input_sha256'].items():
                if sha(ROOT / path) != expected_hash:
                    raise ValueError('additional inventory evidence is stale: ' + path)
            if additional.get('status') != 'pass':
                raise ValueError('cannot publish additional tests from an incomplete validation cycle')
            for row in rows:
                if row['id'] in A_CASES or row['id'] in B_CASES:
                    row.update(query_implemented=True, readiness='현재 실행 가능', implementation_gap=None,
                               route=['D006:' + row['id']], oracle_domains=['independent_D006_source_ledger'],
                               approval_scope_id='D006-CQ-AB-1', branch_count=len(by_id[row['id']]['branches']),
                               selector='approved isolated D006 inputs; original scenario remains separate')
                    row['inputs'] = [f for name in ('D006-CQ-A', 'D006-CQ-B') for f in load(HERE.parent / 'batches' / name / 'manifest.json')['files']]
                    row['reason'] = '승인된 모든 분기·독립 원천 검산·실제 RDF/SHACL·근거/완전성 검증 통과'
        for row in rows:
            outcome = by_id[row['id']]
            row.update({'execution_authorized': True, 'execution_status': outcome['end_to_end_status'],
                        'data_validation': outcome['end_to_end_status'],
                        'answer_status': (outcome.get('answer') or {}).get('status'),
                        'assertion_count': len(outcome['assertions']),
                        'result_report': str(result_path.resolve().relative_to(ROOT)).replace('\\', '/'),
                        'result_sha256': digest(result_path)})
            if row['id'] in ROUTES:
                row['reason'] = '전체 assertion·독립 검산·근거·완전성·재실행/순서 검사 실제 통과' if outcome['end_to_end_status'] == 'pass' else outcome.get('reason') or '실행한 assertion 실패; 상세 결과 참조'
                if outcome['end_to_end_status'] == 'fail':
                    row['readiness'] = '조회 구현 필요'
    spec = scope()
    spec['scope_sha256'] = hashlib.sha256(json.dumps(spec, ensure_ascii=False, sort_keys=True).encode('utf-8')).hexdigest()
    (HERE / 'question-execution-scope.json').write_text(json.dumps(spec, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    counts = result['test_status_counts'] if result else {'pass': 0, 'fail': 0, 'not_run': 52}
    (HERE / 'question-readiness.json').write_text(json.dumps({'tests_sha256': digest(HERE / 'tests.json'),
                                                            'counts': dict(Counter(r['readiness'] for r in rows)),
                                                            'execution_counts': counts, 'tests': rows}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    state = '명시 승인 후 실제 실행 결과를 반영했다. 보류 성공과 실질 답변 지원은 별도 집계한다.' if result else '현재 실행 가능은 코드와 assertion 경로 연결을 뜻하며, 데이터 실행·통과를 뜻하지 않는다.'
    lines = ['# 기존 52시험 실행 대조표', '', '기존 명세를 보존하며 승인된 기간·지표 개정은 question-revisions-20261016.json으로 추적한다. ' + state, '',
             '자료 부족 항목은 해당 조건의 조회·oracle 구현 부족도 함께 기록한다. 기존 테스트 명세의 과거 승인 문구는 수정하지 않고 현재 승인 상태를 별도 관리한다.', '',
             f"전체시험 pass{counts['pass']}/fail{counts['fail']}/not_run{counts['not_run']}. 준비 상태: " + ', '.join(f'{k} {v}건' for k, v in Counter(r['readiness'] for r in rows).items()), '',
             '상세 입력 파일·hash·조건·필드·assertion·구현 공백은 [JSON 대조표](question-readiness.json), 정확한 재사용 범위는 [실행 범위](question-execution-scope.json), 승인 경계와 의미 검토는 [실행 안내](question-execution.md)를 따른다.', '',
             '| 시험 | 기존 조건 | 준비 상태 | 실행 판정 | 구현·자료 공백 및 후속 조치 |', '| --- | --- | --- | --- | --- |']
    for row in rows:
        lines.append('| ' + ' | '.join(str(row[k]).replace('|', '/') for k in ('id', 'condition', 'readiness', 'execution_status', 'reason')) + ' |')
    if result:
        relative = result_path.resolve().relative_to(HERE).as_posix()
        lines[8:8] = [f"실행 근거: [보고서]({relative}), 실질 답변 지원 {result['substantive_answers']}건, 보류/거부 검사 통과 {result['guard_passes']}건.", '']
    (HERE / 'question-readiness.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    return {'status': 'pass', 'scope_id': SCOPE_ID, 'counts': dict(Counter(r['readiness'] for r in rows)), 'test_status_counts': counts, 'source_instances_read': 0}


def run(args, tests):
    spec = scope()
    approved, reason = authorization(args.approval_record, spec)
    results = [{'id': t['id'], 'expected_status': t['expected']['status'], 'end_to_end_status': 'not_run',
                'answer': None, 'assertions': [], 'reason': GAPS.get(t['id'], reason)} for t in tests]
    paths = [p for p in HERE.iterdir() if p.is_file() and p.suffix in {'.py', '.ttl', '.json'}
             and p.name not in {'validation-results.json', 'preservation-results.json', 'question-readiness.json', 'question-execution-scope.json'}]
    for batch in spec['batches'].values():
        paths.extend(ROOT / f['path'] for f in batch['files'])
    if args.approval_record:
        paths.append(args.approval_record.resolve())
    snapshot = {str(p.relative_to(ROOT)).replace('\\', '/'): digest(p) for p in paths if p.is_relative_to(ROOT)}
    report = {'scope_id': SCOPE_ID, 'started_at': datetime.now(timezone.utc).isoformat(),
              'query_version': VERSION, 'data_reuse_authorized': approved, 'authorization_reason': reason,
              'input_sha256': snapshot, 'test_cases': results, 'system_validation': 'incomplete',
              'stability': 'not_run', 'source_records_created': 0, 'RDF_persisted': False}
    if approved:
        from question_oracle import sources, check
        records, source_index, graph_hash, question_hash = rdf_records(args.tools)
        independent_rows = sources()
        for test, result in zip(tests, results):
            if test['id'] not in ROUTES:
                continue
            try:
                response = answer(test['id'], records, source_index, spec['tests_sha256'])
                assertions = check(test, response, independent_rows)
                replay = answer(test['id'], records, source_index, spec['tests_sha256'])
                reverse = answer(test['id'], dict(reversed(list(records.items()))), source_index, spec['tests_sha256'])
                assertions += [{'name': 'same_input_replay', 'status': 'pass' if replay == response else 'fail'},
                               {'name': 'input_order_stability', 'status': 'pass' if reverse == response else 'fail'}]
                result.update({'answer': response, 'assertions': assertions, 'end_to_end_status': verdict(assertions), 'reason': None})
            except Exception as exc:
                result.update({'end_to_end_status': 'fail', 'reason': str(exc),
                               'answer': {'status': 'execution_failed'},
                               'assertions': [{'name': 'query_or_oracle_execution', 'status': 'fail', 'detail': str(exc)}]})
        report.update({'base_RDF_sha256': graph_hash, 'question_RDF_sha256': question_hash,
                       'stability': 'see_per_test_assertions'})
    if args.additional_approval_record:
        if not approved:
            raise PermissionError('additional validation requires the separately approved base source reuse')
        if len(args.additional_approval_record) != 1:
            raise ValueError('exactly one D006-CQ-AB scope is supported; duplicate approvals refused')
        runner = load_module('d006_runner', HERE / 'run-d006-cycle.py')
        extra = runner.run(args.additional_approval_record[0], args.tools)
        by_id = {r['id']: r for r in extra['test_cases']}
        for result in results:
            if result['id'] in by_id:
                result.update(by_id[result['id']])
        report['additional_validation'] = {k: v for k, v in extra.items() if k != 'test_cases'}
        report['additional_validation']['approval_record'] = args.additional_approval_record[0].resolve().relative_to(ROOT).as_posix()
        snapshot.update(extra['input_sha256'])
    report['test_status_counts'] = summary(results)
    report.update(support_counts(results))
    report['changed_inputs'] = [p for p, h in snapshot.items() if digest(ROOT / p) != h]
    extra_status = report.get('additional_validation', {}).get('status', 'pass')
    report['status'] = 'fail' if report['changed_inputs'] or report['test_status_counts']['fail'] or extra_status == 'fail' else 'not_run' if report['test_status_counts']['not_run'] or extra_status == 'not_run' else 'pass'
    report['exit_code'] = {'pass': 0, 'fail': 1, 'not_run': 2}[report['status']]
    report['finished_at'] = datetime.now(timezone.utc).isoformat()
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inventory', action='store_true')
    parser.add_argument('--self-check', action='store_true')
    parser.add_argument('--tools', type=Path)
    parser.add_argument('--approval-record', type=Path)
    parser.add_argument('--additional-approval-record', type=Path, action='append', default=[], help='separately scoped D006 approval; never expands CQ52-READONLY-1')
    parser.add_argument('--results', type=Path, help='with --inventory: actual authorized report to publish in the readiness table')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if sys.flags.optimize:
        parser.error('assertion checks require Python without -O/PYTHONOPTIMIZE')
    tests = specifications()
    if args.self_check:
        print(json.dumps(self_check(tests), ensure_ascii=False))
        return 0
    if args.inventory:
        print(json.dumps(write_inventory(tests, args.results, args.approval_record), ensure_ascii=False))
        return 0
    if not args.output or args.output.exists():
        parser.error('--output must be a new report path')
    try:
        report = run(args, tests)
    except Exception as exc:
        missing_tool = isinstance(exc, ModuleNotFoundError)
        report = {'status': 'not_run' if missing_tool else 'fail', 'exit_code': 2 if missing_tool else 1,
                  'reason': ('required tool unavailable: ' if missing_tool else '') + str(exc), 'system_validation': 'incomplete',
                  'test_status_counts': {'pass': 0, 'fail': 0, 'not_run': 52},
                  'test_cases': [{'id': t['id'], 'end_to_end_status': 'not_run', 'answer': None,
                                  'assertions': [], 'reason': 'bootstrap failed: ' + str(exc)} for t in tests]}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('x', encoding='utf-8') as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2)
        stream.write('\n')
    print(json.dumps({k: report[k] for k in ('status', 'exit_code', 'test_status_counts', 'system_validation')}, ensure_ascii=False))
    return report['exit_code']


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    raise SystemExit(main())
