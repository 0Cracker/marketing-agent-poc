import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateOnDisk, validateClassification} from '../../scripts/roas/validate-roas-review-classification.mjs';

const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rawBytes = fs.readFileSync(path.join(base, 'data/roas/roas-reviews.json'));
const reviews = JSON.parse(rawBytes);
const pack = JSON.parse(fs.readFileSync(path.join(base, 'data/roas/roas-review-classification.json'), 'utf8'));
const product = JSON.parse(fs.readFileSync(path.join(base, 'data/roas/roas-product-metadata.json'), 'utf8'));
const validate = patch => validateClassification({
  rawBytes, reviews, product, pack: Object.assign(structuredClone(pack), patch),
});
const modified = fn => {
  const cloned = structuredClone(pack);
  fn(cloned);
  return validateClassification({rawBytes, reviews, pack: cloned, product});
};

test('50 reviews including 2 unclassified, 5 categories, 18 experiences, 4 sentiment values, and exact evidence', () => {
  const result = validateOnDisk();
  assert.equal(result.reviews, 50);
  assert.equal(result.unclassifiedCount, 2);
  assert.deepEqual(result.unclassifiedReviewIds, ['REV-S16-025', 'REV-S17-025']);
  assert.equal(result.categories, 5);
  assert.equal(result.experiences, 18);
  assert.equal(result.assignments, 63);
  assert.equal(Object.values(result.experienceCounts).reduce((a,b) => a+b,0), result.assignments);
  assert.equal(Object.values(result.cells).reduce((a,b) => a+b,0), 50);
  assert.equal(result.experienceCounts.pump_operation, 8);
  assert.equal(result.experienceCounts.usage_guidance, 1);
});

test('one review has multiple sentiments but counts only once within a parent theme', () => {
  const result = validateOnDisk();
  const example = pack.reviewClassifications.find(r => r.reviewId === 'REV-S17-001');
  assert.deepEqual(example.assignments.map(x => [x.experienceId,x.sentiment]),
    [['foam','positive'], ['pump_operation','negative']]);
  const volume = pack.reviewClassifications.find(r => r.reviewId === 'REV-S16-022');
  assert.equal(volume.assignments.length, 2);
  assert.equal(volume.assignments[0].categoryId, volume.assignments[1].categoryId);
  const ids = pack.reviewClassifications.filter(r =>
    r.assignments.some(a => a.categoryId === 'volume_usage')).map(r => r.reviewId);
  assert.equal(new Set(ids).size, result.categoryCounts.volume_usage);
});

test('a changed raw source, missing IDs, duplicate annotations and bad quotes fail closed', () => {
  assert.throws(() => validate({sourceReviewSha256: '0'.repeat(64)}), /hash/);
  assert.throws(() => modified(p => p.reviewClassifications.pop()), /coverage/);
  assert.throws(() => modified(p => p.reviewClassifications[0].assignments.push(
    {...p.reviewClassifications[0].assignments[0]})), /duplicate experience/);
  assert.throws(() => modified(p => {
    p.reviewClassifications[0].assignments[0].evidenceQuote = 'not in the source';
  }), /exact source substring/);
});

test('wrong parent, unknown sentiment, pending status and changed taxonomy are errors', () => {
  assert.throws(() => modified(p => {
    p.reviewClassifications[0].assignments[0].categoryId = 'scent';
  }), /mismatch/);
  assert.throws(() => modified(p => {
    p.reviewClassifications[0].assignments[0].sentiment = 'unknown';
  }), /sentiment/);
  assert.throws(() => modified(p => {
    p.reviewClassifications[0].status = 'pending';
  }), /pending/);
  assert.throws(() => modified(p => {
    p.experiences[0].label = '향기';
  }), /bad experience/);
});

test('S16/S17 A opposite experience, B source-mix reversal and C time split survive', () => {
  const result = validateOnDisk();
  assert.equal(result.cells['S16|baseline|own_store'], 4);
  assert.equal(result.cells['S17|current|virtual_external_1'], 8);
  assert.equal(result.cells['S16|current|virtual_external_1'], 5);
  assert.equal(result.cells['S17|current|own_store'], 5);
  assert.ok(result.checks.some(x => x.includes('A/B/C')));
  assert.throws(() => modified(p => {
    const a = p.reviewClassifications.find(r => r.reviewId === 'REV-S17-011').assignments;
    a[0].sentiment = 'negative';
  }), /A S17/);
});


test('approved unclassified reviews have no categories or evidence and cannot become pending or fake classified', () => {
 const ids=['REV-S16-025','REV-S17-025'];
 for(const id of ids){
  const record=pack.reviewClassifications.find(x=>x.reviewId===id);
  assert.equal(record.status,'unclassified');
  assert.deepEqual(record.assignments,[]);
 }
 assert.throws(() => modified(p => {
  p.reviewClassifications.find(x => x.reviewId===ids[0]).status='pending';
 }), /pending/);
 assert.throws(() => modified(p => {
  p.reviewClassifications.find(x => x.reviewId===ids[0]).status='classified';
 }), /pending|invalid/);
 assert.throws(() => modified(p => {
  p.reviewClassifications.find(x => x.reviewId===ids[1]).assignments=[p.reviewClassifications[0].assignments[0]];
 }), /pending|invalid/);
 assert.throws(() => modified(p => {
  p.reviewClassifications.find(x => x.reviewId===ids[1]).status='classified';
  p.reviewClassifications.find(x => x.reviewId===ids[0]).status='unclassified';
 }), /pending|invalid/);
});
