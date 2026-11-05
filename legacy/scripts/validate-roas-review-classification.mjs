import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const startCurrent = Date.parse('2026-08-17T00:00:00+09:00');
const endCurrent = Date.parse('2026-08-31T00:00:00+09:00');
const labels = {
  scent: '향',
  cleansing_feel: '세정 및 사용감',
  container_packaging: '용기와 포장',
  volume_usage: '용량 및 사용량',
  delivery: '배송',
};
const expected = {
  scent_preference: '향 취향', scent_intensity: '향 강도', scent_longevity: '향 지속',
  foam: '거품 생성 및 유지력', residue: '잔여감', after_feel: '세정 후 감촉',
  tangling: '모발 엉킴', texture_application: '제형 및 도포',
  pump_operation: '펌프 작동', leakage_residue: '누액 및 잔액',
  container_usability: '용기 편의성', product_packaging: '제품 포장',
  volume_label: '용량 표기', consumption_rate: '소진 속도',
  usage_guidance: '사용량 안내', remaining_check: '잔량 확인',
  delivery_timing: '배송 시점', delivery_condition: '배송 상태',
};
const sentiments = ['positive', 'negative', 'neutral', 'mixed'];
const fail = (ok, message) => { if (!ok) throw new Error(message); };
const unique = xs => new Set(xs).size === xs.length;

export function validateClassification({rawBytes, reviews, pack, product}) {
  const sha = crypto.createHash('sha256').update(rawBytes).digest('hex');
  fail(pack.contract === 'roas-review-classification/1' && pack.taxonomyVersion === '1.0.0', 'classification contract');
  fail(pack.productId === 'EDU-P1' && pack.sourceReviewSha256 === sha, 'review source hash mismatch');
  fail(product.contract === 'roas-product-metadata/1' &&
    product.products.some(p => p.productId === 'EDU-P1' && p.containerType === 'pump_bottle'), 'product metadata');
  fail(reviews.contract === 'roas-reviews/1' && reviews.reviews.length === 50 &&
    reviews.coverage.length === 4, 'source reviews contract/count');
  fail(Object.keys(labels).length === pack.categories.length && unique(pack.categories.map(c => c.id)),
    'category count/duplicate');
  for (const c of pack.categories) fail(labels[c.id] === c.label, 'unexpected category: ' + c.id);
  fail(Object.keys(expected).length === pack.experiences.length &&
    unique(pack.experiences.map(e => e.id)), 'experience count/duplicate');
  const ec = new Map(pack.experiences.map(e => [e.id, e]));
  for (const e of pack.experiences) fail(expected[e.id] === e.label &&
    Object.hasOwn(labels, e.categoryId) && typeof e.definition === 'string' &&
    e.definition.trim().length >= 8, 'bad experience: ' + e.id);
  fail(pack.sentiments.length === 4 && unique(pack.sentiments.map(s => s.id)) &&
    sentiments.every(s => pack.sentiments.some(x => x.id === s && typeof x.label === 'string')), 'sentiment contract');
  fail(pack.reviewClassifications.length === 50 && unique(pack.reviewClassifications.map(x => x.reviewId)),
    'classification coverage');
  const originalById = new Map(reviews.reviews.map(r => [r.id, r]));
  fail(originalById.size === 50, 'source IDs');
  const cells = new Map();
  const byCategory = new Map(pack.categories.map(c => [c.id, new Set()]));
  const byExperience = new Map(pack.experiences.map(e => [e.id, new Set()]));
  const polarities = new Map(sentiments.map(s => [s, 0]));
  let mentions = 0;
  const unclassified = [];
  for (const row of pack.reviewClassifications) {
    const r = originalById.get(row.reviewId);
    fail(Boolean(r), 'unknown review ID: ' + row.reviewId);
    fail(Array.isArray(row.assignments) &&
      (row.status === 'classified' && row.assignments.length > 0 ||
       row.status === 'unclassified' && row.assignments.length === 0),
      'pending, empty or invalid classification: ' + row.reviewId);
    if (row.status === 'unclassified') unclassified.push(row.reviewId);
    const seen = new Set();
    for (const a of row.assignments) {
      const e = ec.get(a.experienceId);
      fail(Boolean(e) && a.categoryId === e.categoryId, 'experience/category mismatch: ' + row.reviewId);
      fail(!seen.has(a.experienceId), 'duplicate experience in same review: ' + row.reviewId);
      seen.add(a.experienceId);
      fail(sentiments.includes(a.sentiment), 'invalid sentiment: ' + row.reviewId);
      fail(typeof a.evidenceQuote === 'string' && a.evidenceQuote.trim().length > 0 &&
        r.text.includes(a.evidenceQuote), 'evidence is not an exact source substring: ' + row.reviewId);
      byCategory.get(a.categoryId).add(row.reviewId);
      byExperience.get(a.experienceId).add(row.reviewId);
      polarities.set(a.sentiment, polarities.get(a.sentiment) + 1);
      mentions++;
    }
    const written = Date.parse(r.writtenAt), collected = Date.parse(r.collectedAt);
    fail(Number.isFinite(written) && Number.isFinite(collected) && written <= collected &&
      collected < endCurrent, 'written/collected time invalid: ' + row.reviewId);
    const period = written < startCurrent ? 'baseline' : 'current';
    const k = [r.caseId, period, r.sourceId].join('|');
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(r.rating);
  }
  fail(unclassified.length === 2 &&
    ['REV-S16-025', 'REV-S17-025'].every(id => unclassified.includes(id)),
    'approved unclassified IDs');
  const cellsExpected = {
    'S16|baseline|own_store':4, 'S16|baseline|virtual_external_1':8,
    'S16|current|own_store':8, 'S16|current|virtual_external_1':5,
    'S17|baseline|own_store':8, 'S17|baseline|virtual_external_1':4,
    'S17|current|own_store':5, 'S17|current|virtual_external_1':8,
  };
  fail(cells.size === 8 && Object.entries(cellsExpected).every(([k, n]) => cells.get(k)?.length === n),
    'case/period/source cells');
  const mean = (c, p, s) => {
    const ids = s ? [s] : ['own_store', 'virtual_external_1'];
    const vals = ids.flatMap(id => cells.get([c,p,id].join('|')) || []);
    return vals.reduce((a,b) => a+b, 0)/vals.length;
  };
  fail(mean('S16','current') > mean('S16','baseline') &&
    mean('S16','current','own_store') < mean('S16','baseline','own_store'), 'B S16');
  fail(mean('S17','current') > mean('S17','baseline') &&
    mean('S17','current','virtual_external_1') < mean('S17','baseline','virtual_external_1'), 'B S17');
  const forId = id => pack.reviewClassifications.find(x => x.reviewId === 'REV-' + id)?.assignments;
  const has = (id, exp, sentiment) =>
    forId(id)?.some(x => x.experienceId === exp && x.sentiment === sentiment);
  fail(has('S16-004','residue','positive') && has('S16-009','residue','negative'), 'A S16');
  fail(has('S17-001','pump_operation','negative') && has('S17-011','pump_operation','positive'), 'A S17');
  for (const id of ['S16-004','S16-012','S17-008','S17-012']) {
    const r = originalById.get('REV-' + id);
    fail(Date.parse(r.writtenAt) < startCurrent && Date.parse(r.collectedAt) >= startCurrent, 'C ' + id);
  }
  fail([...byExperience.values()].every(ids => ids.size > 0), 'approved experience has no source evidence');
  for (const [cid, ids] of byCategory) {
    fail(ids.size <= 50, 'parent count > 50');
    for (const e of pack.experiences.filter(x => x.categoryId === cid))
      fail(byExperience.get(e.id).size <= ids.size, 'sub-theme count > parent');
  }
  return {
    sourceSha256: sha, reviews: pack.reviewClassifications.length,
    unclassifiedCount: unclassified.length, unclassifiedReviewIds: unclassified,
    assignments: mentions, categories: pack.categories.length, experiences: pack.experiences.length,
    sentimentCounts: Object.fromEntries(polarities),
    categoryCounts: Object.fromEntries([...byCategory].map(([c, ids]) => [c, ids.size])),
    experienceCounts: Object.fromEntries([...byExperience].map(([e, ids]) => [e, ids.size])),
    cells: Object.fromEntries([...cells].map(([c, ids]) => [c, ids.length])),
    checks: ['schema', 'source sha256', 'pump metadata', '50 IDs', '2 approved unclassified', '5/18 dictionary',
      'exact evidence', 'no duplicate experience', '4 sentiment values', '8 cells',
      'category distinct rollup', 'A/B/C S16+S17'],
  };
}
export function validateOnDisk(root = base) {
  const rawBytes = fs.readFileSync(path.join(root, 'data', 'roas-reviews.json'));
  return validateClassification({
    rawBytes,
    reviews: JSON.parse(rawBytes),
    pack: JSON.parse(fs.readFileSync(path.join(root, 'data', 'roas-review-classification.json'), 'utf8')),
    product: JSON.parse(fs.readFileSync(path.join(root, 'data', 'roas-product-metadata.json'), 'utf8')),
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify({ok:true, ...validateOnDisk()}, null, 2)); }
  catch (error) { console.error('Review classification validation failed:', error.message); process.exitCode = 1; }
}
