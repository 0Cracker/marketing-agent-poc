import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
 categoryCounts,collectionRange,defaultReviewSort,eligibleReviewRows,filterReviewTable,
 highlightParts,isReviewInPeriod,readApprovedReviewRows,reviewPreview,reviewSummary,
 sortCategories,sortReviewRows
} from '../../frontend/roas/review-analysis.ts';

// No synthetic review fixtures: these tests only use time boundaries, text utilities,
// and, when provided, the already approved raw review source.
const periods=[
 {id:'baseline',start:'2026-08-03',end:'2026-08-17'},
 {id:'current',start:'2026-08-17',end:'2026-08-31'}
];
const asOf='2026-08-31T00:00:00+09:00';
test('fixed 14-day review periods are start-inclusive and end-exclusive',()=>{
 assert(isReviewInPeriod('2026-08-03T00:00:00+09:00',periods[0]));
 assert(isReviewInPeriod('2026-08-16T23:59:59+09:00',periods[0]));
 assert(!isReviewInPeriod('2026-08-17T00:00:00+09:00',periods[0]));
 assert(isReviewInPeriod('2026-08-17T00:00:00+09:00',periods[1]));
 assert(isReviewInPeriod('2026-08-30T23:59:59+09:00',periods[1]));
 assert(!isReviewInPeriod('2026-08-31T00:00:00+09:00',periods[1]));
 assert(!isReviewInPeriod(null,periods[0]));
 assert(!isReviewInPeriod('not-a-date',periods[1]));
});
test('text search matches a contiguous phrase without HTML interpolation',()=>{
 const text='샴푸 향이 좋아요. 샴푸 향이 오래 남아요.';
 const parts=highlightParts(text,' 샴푸 향이 ');
 assert.equal(parts.filter(part=>part.match).length,2);
 assert.equal(parts.map(part=>part.text).join(''),text);
 assert.deepEqual(highlightParts('ABC abc','abc').filter(part=>part.match).map(part=>part.text),['ABC','abc']);
 assert.equal(highlightParts('hello world','hello  world').some(part=>part.match),false);
 assert.equal(reviewPreview('가'.repeat(160)+'샴푸 향이'+'나'.repeat(60),'샴푸 향이').includes('샴푸 향이'),true);
 assert.equal(highlightParts('<script>alert(1)</script>','script').map(x=>x.text).join(''),'<script>alert(1)</script>');
});
test('empty approved selection never invents ratings, percentages, categories or collection dates',()=>{
 const rows=eligibleReviewRows([],'S16',asOf,periods,'current',new Set());
 assert.deepEqual(rows,[]);
 assert.deepEqual(filterReviewTable(rows,new Set(['__unclassified__']),'abc'),[]);
 assert.deepEqual(sortReviewRows(rows,defaultReviewSort),[]);
 assert.equal(categoryCounts(rows).length,5);
 assert(categoryCounts(rows).every(c=>c.count===0&&c.percent===null));
 assert.deepEqual(sortCategories([], 'few'),[]);
 assert.deepEqual(reviewSummary(rows),{count:0,average:null,top:[]});
 assert.equal(collectionRange(rows,'S16',asOf),null);
});
test('malformed and unapproved data cannot masquerade as not-provided or zero records',()=>{
 assert.equal(readApprovedReviewRows(null,'S16').status,'error');
 assert.equal(readApprovedReviewRows({contract:'wrong',coverage:[],reviews:[]},'S16').status,'error');
 assert.equal(readApprovedReviewRows({contract:'roas-reviews/1',subjectCategory:'shampoo',coverage:[],reviews:[]},'S16').status,'error');
});
// Run the approved source contract unconditionally with the 50-review integration.
const rawFile=path.resolve(import.meta.dirname,'../../data/roas/roas-reviews.json');
test('approved 50-review source: periods, source OR and deduplicated counts', {},()=>{
 const bundle=JSON.parse(fs.readFileSync(rawFile,'utf8'));
 const both=readApprovedReviewRows(bundle,'S16');
 assert.equal(both.status,'ready');
 assert.equal(both.classificationStatus,'pending');
 assert.equal(both.reviews.length,25);
 for(const caseId of ['S16','S17']){
  const view=readApprovedReviewRows(bundle,caseId);
  const allCurrent=eligibleReviewRows(view.reviews,caseId,asOf,periods,'current',new Set());
  const allBaseline=eligibleReviewRows(view.reviews,caseId,asOf,periods,'baseline',new Set());
  const whole=eligibleReviewRows(view.reviews,caseId,asOf,periods,'both',new Set());
  assert.equal(allCurrent.length,13);
  assert.equal(allBaseline.length,12);
  assert.equal(whole.length,25);
  assert.equal(reviewSummary(allCurrent).count,13);
  assert.equal(new Set(whole.map(r=>r.id)).size,25);
  const ownBaseline=eligibleReviewRows(view.reviews,caseId,asOf,periods,'baseline',new Set(['own_store']));
  const ownCurrent=eligibleReviewRows(view.reviews,caseId,asOf,periods,'current',new Set(['own_store']));
  assert.deepEqual([ownBaseline.length,ownCurrent.length],caseId==='S16'?[4,8]:[8,5]);
  const external=eligibleReviewRows(view.reviews,caseId,asOf,periods,'both',new Set(['virtual_external_1']));
  assert.equal(external.length,caseId==='S16'?13:12);
  assert.equal(collectionRange(view.reviews,caseId,asOf)?.first,'2026-08-04');
  const c=reviewSummary(whole);
  assert(c.average!==null&&c.average>=1&&c.average<=5);
  assert.equal(c.top.length,0); // Raw-only parsing intentionally leaves classification pending.
 }
 assert.equal(readApprovedReviewRows(bundle,'S01').status,'not_provided');
});
