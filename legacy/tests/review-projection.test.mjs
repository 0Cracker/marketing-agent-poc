import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {reviewQuery} from '../scripts/review-data.mjs';
import {readReviewProjection} from '../frontend/workbench/review-projection.ts';
import {reviewCategoryLabels,reviewExperienceLabels,reviewExperienceCategoryIds,categoryCounts,experienceCounts,eligibleReviewRows,filterReviewTable,reviewSummary} from '../frontend/workbench/review-analysis.ts';

const periods=[{id:'baseline',start:'2026-08-03',end:'2026-08-17'},{id:'current',start:'2026-08-17',end:'2026-08-31'}];
const load=id=>{
 const dto=reviewQuery({caseId:id});
 const view=readReviewProjection(dto,id,dto.asOf);
 assert.equal(view.status,id==='S16'||id==='S17'?'ready':'not_provided');
 return {dto,view};
};

test('read-only UI projection keeps 25 original reviews, one unclassified and exact evidence per case',()=>{
 let all=[];
 for(const id of ['S16','S17']){
  const {dto,view}=load(id);
  assert.equal(view.productName,'쓱쓱샴푸');
  assert.equal(view.reviews.length,25);
  assert.equal(new Set(view.reviews.map(r=>r.id)).size,25);
  const baseline=eligibleReviewRows(view.reviews,id,dto.asOf,periods,'baseline',new Set());
  const current=eligibleReviewRows(view.reviews,id,dto.asOf,periods,'current',new Set());
  assert.equal(baseline.length,12);assert.equal(current.length,13);
  assert.equal(view.reviews.filter(r=>r.classification==='unclassified').length,1);
  assert.equal(filterReviewTable(current,new Set(['__unclassified__']),'').length,1);
  assert.equal(reviewSummary(current).count,13,'unclassified counts in the rating denominator');
  assert.equal(view.reviews.filter(r=>r.classification==='classified').every(r=>r.assignments.length>0),true);
  for(const row of view.reviews)for(const a of row.assignments){
   assert(row.text.includes(a.evidenceQuote));
   assert(Object.hasOwn(reviewExperienceLabels,a.experienceId));
   assert(Object.hasOwn(reviewCategoryLabels,a.categoryId));
  }
  const totals=categoryCounts(current);
  assert.equal(totals.length,5);assert(totals.every(c=>c.count<=13&&Math.abs(c.percent-c.count/13*100)<1e-10));
  assert.equal(totals.reduce((sum,c)=>sum+c.count,0),new Set(current.filter(r=>r.classification==='classified').map(r=>r.id)).size+
   current.filter(r=>r.classification==='classified').reduce((n,r)=>n+Math.max(0,r.categories.length-1),0));
  assert.deepEqual([eligibleReviewRows(view.reviews,id,dto.asOf,periods,'baseline',new Set(['own_store'])).length,
   eligibleReviewRows(view.reviews,id,dto.asOf,periods,'current',new Set(['own_store'])).length],id==='S16'?[4,8]:[8,5]);
  all=all.concat(view.reviews);
 }
 assert.equal(all.length,50);
 assert.equal(new Set(all.map(r=>r.id)).size,50);
 assert.equal(all.filter(r=>r.classification==='unclassified').length,2);
 assert.equal(new Set(all.flatMap(r=>r.assignments.map(a=>a.experienceId))).size,18);
 assert.equal(experienceCounts(all).reduce((sum,e)=>sum+e.count,0),63);
});
test('all 5/18 display dictionaries and parents match the approved taxonomy bytes',()=>{
 const pack=JSON.parse(fs.readFileSync(new URL('../data/roas-review-classification.json',import.meta.url),'utf8'));
 assert.deepEqual(Object.fromEntries(pack.categories.map(c=>[c.id,c.label])),reviewCategoryLabels);
 assert.deepEqual(Object.fromEntries(pack.experiences.map(e=>[e.id,e.label])),reviewExperienceLabels);
 assert.deepEqual(Object.fromEntries(pack.experiences.map(e=>[e.id,e.categoryId])),reviewExperienceCategoryIds);
});
test('classification filter and text search never modify the common population counts',()=>{
 const {dto,view}=load('S16');
 const current=eligibleReviewRows(view.reviews,'S16',dto.asOf,periods,'current',new Set());
 const original=reviewSummary(current),originalCategories=categoryCounts(current);
 const filtered=filterReviewTable(current,new Set(['__unclassified__']),'');
 assert.equal(filtered.length,1);assert.deepEqual(filtered[0].categories,[]);
 const query=filterReviewTable(current,new Set(),'펌프');
 assert(query.every(r=>r.text.toLocaleLowerCase().includes('펌프')));
 assert.deepEqual(reviewSummary(current),original);
 assert.deepEqual(categoryCounts(current),originalCategories);
 assert.equal(reviewSummary(current).average,current.reduce((n,r)=>n+r.rating,0)/13);
});
test('unavailable, tampered and partial payloads do not masquerade as complete data',()=>{
 const unavailable=reviewQuery({caseId:'S01'});
 assert.equal(readReviewProjection(unavailable,'S01',unavailable.asOf).status,'not_provided');
 const {dto}=load('S16');
 assert.equal(readReviewProjection(dto,'S17',dto.asOf).status,'error');
 assert.equal(readReviewProjection(dto,'S16','2026-09-07T00:00:00+09:00').status,'error');
 const malformed=structuredClone(dto);malformed.reviews[0].experiences[0].evidenceQuote='근거가 아닌 텍스트';
 const partially=readReviewProjection(malformed,'S16',dto.asOf);
 assert.equal(partially.status,'partial');
 assert.equal(partially.invalidCount,1);
 assert.equal(partially.reviews.length,24);
 const bad=structuredClone(dto);bad.reviews=bad.reviews.map(r=>({...r,classification:'unclassified'}));
 const invalid=readReviewProjection(bad,'S16',dto.asOf);
 assert.equal(invalid.status,'partial');
 assert.equal(invalid.reviews.length,1,'only the genuinely unclassified row survives');
});
test('review navigation is a sidebar page and ROAS data filters are not passed into it',()=>{
 const file=fs.readFileSync(new URL('../frontend/workbench/training-dashboard.tsx',import.meta.url),'utf8');
 const nav=file.indexOf('성과 현황</button><div className="training-sidebar-detail">');
 const metricGroup=file.indexOf('지표 상세<ChevronDown',nav);
 const review=file.indexOf('</ul></div><button className={reviewPage?',metricGroup);
 assert(nav>0&&metricGroup>nav&&review>metricGroup,'Metric Details must stay under Performance Overview, then Review Analysis is a separate sibling');
 assert(file.includes('<div hidden={!reviewPage}><ReviewAnalysisSection'),'Review UI stays mounted to preserve same-case filters across sidebar and back navigation');
 assert(file.includes('view={reviewView}'));
 assert(!file.includes('<ReviewAnalysisSection key={caseId} caseId={caseId} asOf={data.asOf}'));
 assert(!file.includes('filters={filters} view={reviewView}'));
});

test('review controls render existing dashboard segments and toggleable category pills, not checkboxes',()=>{
 const ui=fs.readFileSync(new URL('../frontend/workbench/review-analysis-section.tsx',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../frontend/workbench/review-analysis.css',import.meta.url),'utf8');
 assert(ui.includes('className="roas-segment review-segments"'));
 assert(ui.includes('className="review-filter-pill" aria-pressed={categories.has(c.id)}'));
 assert(ui.includes('className="review-filter-pill" aria-pressed={sources.has(id)}'));
 assert(!ui.includes('type="checkbox"'));
 assert(!ui.includes('<select'));
 assert(css.includes('.wb .review-bar-row{display:grid'));
 assert(ui.includes('summary.top[0].count/summary.count*100'));
});

test('damaged projection cannot silently change classifications, dates or review identity',()=>{
 const {dto}=load('S16');
 const run=edit=>{const payload=structuredClone(dto);edit(payload);return readReviewProjection(payload,'S16',dto.asOf);};
 const cases=[
  d=>{d.reviews[0].id='REV-S17-999';},
  d=>{d.reviews[0].id='REV-S16-999';},
  d=>{d.reviews[0].experiences[0].categoryId='delivery';d.reviews[0].categories=[...new Set(d.reviews[0].experiences.map(a=>a.categoryId))];},
  d=>{d.reviews[0].experiences.push({...d.reviews[0].experiences[0]});},
  d=>{d.reviews[0].collectedAt='2026-09-30T00:00:00+09:00';},
  d=>{d.reviews[0].writtenAt='2026-09-01T00:00:00+09:00';d.reviews[0].collectedAt='2026-09-02T00:00:00+09:00';},
 ];
 for(const edit of cases){const view=run(edit);assert.equal(view.status,'partial');assert.equal(view.reviews.length,24);}
 assert.equal(run(d=>{d.reviews=[];}).status,'error','zero verified rows is a whole-query error');
 assert.equal(run(d=>{d.reviews.push({...d.reviews[0],id:'REV-S16-026'});}).status,'error','payloads larger than 25 cannot inflate the approved population');
 assert.equal(run(d=>{d.status='not_provided';}).status,'error','provided reviews cannot be reported as missing');
 const noClass=run(d=>{d.classificationStatus='error';});
 assert.equal(noClass.classificationStatus,'error');
 assert(noClass.reviews.every(r=>r.classification==='pending'&&r.categories.length===0&&r.assignments.length===0),'an unverified classification must never appear in the UI');
});
