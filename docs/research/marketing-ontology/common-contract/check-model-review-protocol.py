"""Replay a real scanner report to exercise review rejection; never invoke Java here."""
from copy import deepcopy
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from unittest.mock import patch

CC = Path(__file__).resolve().parent
ROOT = CC.parents[3]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--tools', type=Path, required=True)
parser.add_argument('--scan-report', type=Path, required=True)
parser.add_argument('--review-record', type=Path, default=CC / 'completion-oops-review.json')
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
if args.output.exists(): parser.error('report overwrite refused')
TOOLS = args.tools.resolve()
sys.path[:0] = [str(CC), str(TOOLS)]
import oops_local
from rdflib import Graph

sys.stdout.reconfigure(encoding='utf-8')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
scan_report = json.loads(args.scan_report.read_text(encoding='utf-8'))
assert scan_report['status'] == 'pass' and scan_report['ontology_sha256'] == sha(CC / 'ontology.ttl')
actual = scan_report['checks']['OOPS']
review = json.loads(args.review_record.read_text(encoding='utf-8'))
graph = Graph().parse(CC / 'ontology.ttl', format='turtle')
checks = []


def replay(command, **kwargs):
    Path(command[-1]).write_text(json.dumps(actual), encoding='utf-8')
    return subprocess.CompletedProcess(command, 0, stdout='', stderr='')


with tempfile.TemporaryDirectory(prefix='review-protocol-', dir=CC / 'runs') as folder:
    folder = Path(folder)
    for case in ['valid', 'human-forgery', 'stale-model', 'missing-finding', 'changed-proof-hash', 'wrong-proof-target', 'stale-proof-input']:
        value = deepcopy(review)
        if case == 'human-forgery': value['human_confirmed'] = True
        if case == 'stale-model': value['ontology_sha256'] = 'stale'
        if case == 'missing-finding': value['findings'].pop()
        if case == 'changed-proof-hash': value['findings'][0]['alternative_validation'][0]['sha256'] = 'changed'
        if case in ('wrong-proof-target', 'stale-proof-input'):
            check = value['findings'][0]['alternative_validation'][0]
            proof = json.loads(Path(check['report']).read_text(encoding='utf-8'))
            if case == 'wrong-proof-target':
                next(x for x in proof['checks'] if x['id'] == check['test_id'])['resource'] = 'urn:wrong-target'
            else:
                proof['input_sha256'][str(folder / 'absent-input')] = 'stale'
            path = folder / (case + '-proof.json')
            path.write_text(json.dumps(proof), encoding='utf-8')
            check.update(report=str(path), sha256=sha(path))
        path = folder / (case + '.json')
        path.write_text(json.dumps(value), encoding='utf-8')
        try:
            with patch.object(oops_local.subprocess, 'run', replay):
                result = oops_local.scan(graph, TOOLS, review_record=path)
        except ValueError as exc:
            assert case != 'valid', str(exc)
            checks.append({'case': case, 'status': 'pass', 'invalid_review': 'rejected', 'reason': str(exc)})
        else:
            assert case == 'valid' and result['status'] == 'pass' and result['unresolved_finding_count'] == 0, case
            checks.append({'case': case, 'status': 'pass', 'valid_review': 'accepted'})
result = {'status': 'pass', 'scope': 'review protocol replay of real scanner result; Java scanner NOT executed in this check',
          'actual_scan_report': str(args.scan_report.resolve()),
          'script_sha256': sha(Path(__file__)),
          'actual_scan_report_sha256': sha(args.scan_report),
          'source_rows_created': 0, 'checks': checks, 'scanner_protocol': oops_local.self_check()}
args.output.parent.mkdir(parents=True, exist_ok=True)
with args.output.open('x', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2); f.write('\n')
print(json.dumps(result, ensure_ascii=False))
