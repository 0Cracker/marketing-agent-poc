"""Pinned local OOPS invocation. No HTTP client and no remote fallback."""
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
EXPECTED_RULES = {f'P{n:02}' for n in [2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 19, 20, 21, 22, *range(24, 42)]}
COMMIT = '11572ea6b31cba29dd3f8a443e24311652f059de'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_result(result):
    rules = result.get('rules', [])
    codes = [r.get('code') for r in rules]
    if len(codes) != len(set(codes)) or set(codes) != EXPECTED_RULES:
        raise ValueError('missing, duplicate or unexpected pinned OOPS checker')
    for rule in rules:
        expected = 'not_applicable' if 36 <= int(rule['code'][1:]) <= 41 else 'pass'
        if rule.get('status') != expected:
            raise ValueError('required checker incomplete: ' + str(rule))
        if expected == 'pass' and rule.get('warnings'):
            raise ValueError('required checker has unresolved execution warnings: ' + str(rule))
        if expected == 'not_applicable' and not rule.get('reason'):
            raise ValueError('unexplained checker exclusion')
    if (result.get('scan_executed') is not True or result.get('network_policy_self_check') != 'pass'
            or result.get('blocked_network_attempts') != 0):
        raise ValueError('scan incomplete or unexpected blocked network access')
    if not isinstance(result.get('findings'), list):
        raise ValueError('scanner findings list missing')
    return result


def scan(graph, tools, artifact_lock=None, review_record=None):
    lock_path = artifact_lock or tools / 'logic/oops/install-lock.json'
    if not lock_path.is_file():
        return {'status': 'not_run', 'scan_executed': False, 'mode': 'local',
                'reason': 'Run setup-oops-local.py explicitly; local install lock missing', 'lock': str(lock_path)}
    lock = json.loads(lock_path.read_text(encoding='utf-8'))
    if lock.get('source_commit') != COMMIT:
        return {'status': 'fail', 'scan_executed': False, 'reason': 'unexpected OOPS source commit'}
    changed = [p for p, expected in lock['files'].items() if not Path(p).is_file() or sha(Path(p)) != expected]
    # A wildcard classpath must not silently load extra jars/classes outside the lock.
    import os
    for entry in lock['classpath'].split(os.pathsep):
        path = Path(entry)
        files = path.parent.glob('*.jar') if path.name == '*' else path.rglob('*')
        changed += [str(p) for p in files if p.is_file() and str(p) not in lock['files']]
    if str(HERE / 'OopsLocal.java') not in lock['files'] or changed:
        return {'status': 'fail', 'scan_executed': False, 'reason': 'OOPS install integrity mismatch', 'changed_files': changed}
    (HERE / 'runs').mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='oops-local-', dir=HERE / 'runs') as folder:
        folder = Path(folder)
        model, result_path = folder / 'definitions.rdf', folder / 'result.json'
        graph.serialize(model, format='xml')
        command = [lock['java'], '-Dfile.encoding=UTF-8', '-Xmx1g', '-cp', lock['classpath'],
                   'OopsLocal', str(model), str(result_path)]
        try:
            process = subprocess.run(command, cwd=folder, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=180)
        except (OSError, subprocess.TimeoutExpired) as exc:
            return {'status': 'not_run', 'scan_executed': False, 'mode': 'local', 'reason': str(exc)}
        if process.returncode or not result_path.is_file():
            return {'status': 'fail', 'scan_executed': False, 'mode': 'local', 'exit_code': process.returncode,
                    'reason': 'local OOPS did not produce a valid execution report', 'stderr': process.stderr[-12000:]}
        raw_text = result_path.read_text(encoding='utf-8')
        try:
            result = validate_result(json.loads(raw_text))
        except (ValueError, TypeError, KeyError) as exc:
            return {'status': 'fail', 'scan_executed': False, 'mode': 'local', 'reason': str(exc), 'raw_response': raw_text}
    for finding in result['findings']:
        basis = json.dumps({k: finding[k] for k in ('code', 'importance', 'resources')}, sort_keys=True, ensure_ascii=False)
        finding['fingerprint'] = hashlib.sha256(basis.encode('utf-8')).hexdigest()
        finding['review_state'] = 'pending'
    from rdflib import URIRef
    license_predicates = [URIRef(x) for x in ('http://purl.org/dc/terms/license', 'http://purl.org/dc/elements/1.1/license', 'http://creativecommons.org/ns#license')]
    result.update(status='fail' if result['findings'] else 'pass', mode='local', endpoint=None,
                  source_commit=COMMIT, install_lock_sha256=sha(lock_path), finding_count=len(result['findings']),
                  local_license_metadata={'present': any(any(graph.triples((None, p, None))) for p in license_predicates),
                                          'scope': 'local metadata inspection only; P41 external service was not executed'},
                  instance_records_read=0, integrity_checked_files=len(lock['files']))
    if review_record:
        review = json.loads(review_record.read_text(encoding='utf-8'))
        if review.get('source') == 'delegated_ai_review':
            authority_path = Path(review['authority_file'])
            authority = json.loads(authority_path.read_text(encoding='utf-8'))
            if (sha(authority_path) != review['authority_sha256'] or authority.get('source') != 'explicit_human_response'
                    or not authority.get('approved') or not authority.get('user_message')
                    or 'evidence_based_oops_review' not in authority.get('actions', []) or review.get('human_confirmed') is not False):
                raise ValueError('OOPS delegated review authority missing')
            shapes = Path(review['property_shapes'])
            if sha(shapes) != review['property_shapes_sha256']:
                raise ValueError('property-use constraints changed since review')
        elif review.get('source') != 'explicit_human_response' or not review.get('user_message'):
            raise ValueError('OOPS review authority missing')
        if (review.get('approved') is not True or review.get('source_commit') != COMMIT
                or review.get('ontology_sha256') != sha(HERE / 'ontology.ttl')):
            raise ValueError('OOPS review must explicitly identify the current model and scanner')
        entries = review.get('findings', [])
        by_id = {e['fingerprint']: e for e in entries}
        if len(by_id) != len(entries) or set(by_id) != {f['fingerprint'] for f in result['findings']}:
            raise ValueError('OOPS review must match every current finding exactly')
        for finding in result['findings']:
            entry = by_id[finding['fingerprint']]
            if (entry.get('review_state') != 'accepted_non_application' or not entry.get('reason')
                    or not entry.get('alternative_validation')):
                raise ValueError('unresolved OOPS finding: ' + finding['fingerprint'])
            for check in entry['alternative_validation']:
                path = Path(check['report'])
                if not path.is_file() or sha(path) != check['sha256'] or check.get('status') != 'pass':
                    raise ValueError('missing or changed alternative validation evidence')
                proof = json.loads(path.read_text(encoding='utf-8'))
                tests = {x['id']: x for x in proof.get('checks', [])}
                test = tests.get(check.get('test_id'))
                if (proof.get('status') != 'pass' or proof.get('ontology_sha256') != sha(HERE / 'ontology.ttl')
                        or test is None or test.get('status') != 'pass' or test.get('code') != finding['code']
                        or test.get('resource') not in finding['resources']):
                    raise ValueError('alternative evidence does not test this model finding')
                if any(not Path(p).is_file() or sha(Path(p)) != h for p, h in proof.get('input_sha256', {}).items()):
                    raise ValueError('alternative evidence inputs changed')
            finding['review_state'] = 'accepted_non_application'
        result['status'] = 'pass'
        result['review_record_sha256'] = sha(review_record)
        result['review_kind'] = review['source']
        result['human_confirmed'] = review.get('human_confirmed', True)
    result['raw_finding_count'] = len(result['findings'])
    result['unresolved_finding_count'] = sum(f['review_state'] == 'pending' for f in result['findings'])
    return result


def self_check():
    # Protocol-only cases; these are not synthetic marketing records or model fixtures.
    good = {'rules': [{'code': code, 'status': 'not_applicable' if int(code[1:]) >= 36 else 'pass',
                       'reason': 'unpublished URL / external service excluded'} for code in sorted(EXPECTED_RULES)],
            'scan_executed': True, 'network_policy_self_check': 'pass', 'blocked_network_attempts': 0, 'findings': []}
    validate_result(good)
    cases = []
    for field, value in [('rules', good['rules'][:-1]), ('scan_executed', False), ('blocked_network_attempts', 1), ('findings', None)]:
        try:
            validate_result({**good, field: value})
        except ValueError:
            cases.append(field)
        else:
            raise AssertionError('false scanner success: ' + field)
    for replacement in [good['rules'] + [good['rules'][0]],
                        [{**rule, 'status': 'not_run'} if rule['code'] == 'P06' else rule for rule in good['rules']],
                        [{**rule, 'warnings': ['unresolved execution prerequisite']} if rule['code'] == 'P06' else rule for rule in good['rules']]]:
        try:
            validate_result({**good, 'rules': replacement})
        except ValueError:
            cases.append('incomplete-rule')
        else:
            raise AssertionError('false scanner rule success')
    return {'status': 'pass', 'checks': 1 + len(cases)}
