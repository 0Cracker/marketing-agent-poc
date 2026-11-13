"""Independent stdlib audit; run from the project root with Python 3."""
import hashlib
import itertools
import json
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

root = Path.cwd()
out = root / 'evidence/review-expansion-20261105'
read = lambda path: json.loads((root / path).read_text(encoding='utf-8'))
digest = lambda value: hashlib.sha256(json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
source = read('data/roas/roas-reviews.json')
pack = read('data/roas/roas-review-classification.json')
before = read('evidence/review-expansion-20261105/baseline.json')
rows = {r['id']: r for r in source['reviews']}
annotations = {r['reviewId']: r for r in pack['reviewClassifications']}
original_ids = {r['id'] for r in before['originals']}
added = [r for r in source['reviews'] if r['id'] not in original_ids]
assert len(rows) == len(source['reviews']) == len(annotations) == 85
assert len(added) == 35 and all(r['caseId'] == 'S16' for r in added)
for old in before['originals']:
    assert digest({k: v for k, v in rows[old['id']].items() if k != 'sourceName'}) == old['recordSha256']
    assert digest(annotations[old['id']]) == old['classificationSha256']
for name, expected in before['files'].items():
    if name != 'manifest.json':
        assert hashlib.sha256((root / 'data/roas' / name).read_bytes()).hexdigest() == expected

experiences = {e['id']: e['categoryId'] for e in pack['experiences']}
cells = defaultdict(list)
parents, details, sentiments = defaultdict(set), defaultdict(set), Counter()
for r in rows.values():
    assert r['sourceName'] == ('자사몰' if r['sourceId'] == 'own_store' else '쿠팡')
    written, collected = (datetime.fromisoformat(r[k]) for k in ('writtenAt', 'collectedAt'))
    assert written <= collected < datetime.fromisoformat('2026-08-31T00:00:00+09:00')
    assert datetime.fromisoformat('2026-08-03T00:00:00+09:00') <= written
    period = 'baseline' if written.day < 17 else 'current'
    cells[(r['caseId'], period, r['sourceId'])].append(r['rating'])
    a = annotations[r['id']]
    assert (a['status'] == 'classified') == bool(a['assignments'])
    assert len({e['experienceId'] for e in a['assignments']}) == len(a['assignments'])
    for e in a['assignments']:
        assert experiences[e['experienceId']] == e['categoryId']
        assert e['sentiment'] in {'positive', 'negative', 'neutral', 'mixed'}
        assert e['evidenceQuote'] and e['evidenceQuote'] in r['text']
        parents[e['categoryId']].add(r['id'])
        details[e['experienceId']].add(r['id'])
        sentiments[e['sentiment']] += 1

expected_cells = {('S16', 'baseline', 'own_store'): (9, 40), ('S16', 'baseline', 'virtual_external_1'): (18, 45),
                  ('S16', 'current', 'own_store'): (20, 80), ('S16', 'current', 'virtual_external_1'): (13, 35),
                  ('S17', 'baseline', 'own_store'): (8, 20), ('S17', 'baseline', 'virtual_external_1'): (4, 18),
                  ('S17', 'current', 'own_store'): (5, 15), ('S17', 'current', 'virtual_external_1'): (8, 32)}
assert {k: (len(v), sum(v)) for k, v in cells.items()} == expected_cells
assert cells[('S16', 'current', 'own_store')].count(5) == 5
assert Counter(len(annotations[r['id']]['assignments']) for r in added) == {0: 2, 1: 23, 2: 10}
assert sum(sentiments.values()) == 106
assert len([r for r in added if r['writtenAt'] < '2026-08-17' <= r['collectedAt']]) == 3

def normalize(text):
    return ''.join(c for c in unicodedata.normalize('NFKC', text).lower()
                   if not c.isspace() and unicodedata.category(c)[0] not in {'P', 'S'})

normalized = {r['id']: normalize(r['text']) for r in rows.values()}
assert len(set(normalized.values())) == 85
similarity = []
for (aid, a), (bid, b) in itertools.combinations(normalized.items(), 2):
    at = {a[i:i+3] for i in range(len(a)-2)}
    bt = {b[i:i+3] for i in range(len(b)-2)}
    if aid not in original_ids or bid not in original_ids:
        similarity.append({'ids': [aid, bid], 'trigramJaccard': len(at & bt) / len(at | bt)})
report = {'ok': True, 'reviews': 85, 'newReviews': 35, 'originalRowsPreservedExceptSourceName': 50,
          'casePeriodSource': {'/'.join(k): {'count': len(v), 'sum': sum(v), 'mean': sum(v)/len(v)} for k, v in cells.items()},
          'assignments': 106, 'sentiments': dict(sentiments), 'categoryCounts': {k: len(v) for k, v in parents.items()},
          'experienceCounts': {k: len(v) for k, v in details.items()}, 'normalizedPairsChecked': 3570,
          'newRelatedPairs': len(similarity), 'exactDuplicates': 0,
          'topSimilarityCandidatesForSemanticReview': sorted(similarity, key=lambda p: -p['trigramJaccard'])[:12]}
(out / 'independent-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
