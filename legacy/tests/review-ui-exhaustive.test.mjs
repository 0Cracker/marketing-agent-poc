import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {reviewQuery} from '../scripts/review-data.mjs';
import {readReviewProjection} from '../frontend/workbench/review-projection.ts';
import {eligibleReviewRows,categoryCounts,experienceCounts,reviewSummary,filterReviewTable,sortReviewRows} from '../frontend/workbench/review-analysis.ts';

const data=JSON.parse(fs.readFileSync(new URL('../data/roas-reviews.json',import.meta.url),'utf8'));
const classification=JSON.parse(fs.readFileSync(new URL('../data/roas-review-classification.json',import.meta.url),'utf8'));
const byId=new Map(classification.reviewClassifications.map(r=>[r.reviewId,r]));
const periods=[{id:'baseline',start:'2026-08-03',end:'2026-08-17'},{id:'current',start:'2026-08-17',end:'2026-08-31'}];
const sourceSets=[[],['own_store'],['virtual_external_1'],['own_store','virtual_external_1']];
const choices=['baseline','current','both'];
const allCategories=[...classification.categories.map(c=>c.id),'__unclassified__'];
const sorted=rows=>rows.map(r=>r.id).sort();

test('exhaustive independent review rollup oracle across both cases and snapshots, 3 periods, 4 sources, all 64 category combinations',()=>{
 let examined=0;
 for(const caseId of ['S16','S17'])for(const snapshotId of ['initial','mature']){
  const dto=reviewQuery({caseId,snapshotId});
  const view=readReviewProjection(dto,caseId,dto.asOf);
  assert.equal(view.status,'ready');
  for(const choice of choices)for(const sourceIds of sourceSets){
   const selectedSources=new Set(sourceIds);
   const expected=data.reviews.filter(r=>r.caseId===caseId&&
    (!selectedSources.size||selectedSources.has(r.sourceId))&&
    (choice==='both'||(choice==='baseline'?r.writtenAt.slice(0,10)<'2026-08-17':r.writtenAt.slice(0,10)>='2026-08-17')));
   const rows=eligibleReviewRows(view.reviews,caseId,dto.asOf,periods,choice,selectedSources);
   assert.deepEqual(sorted(rows),sorted(expected),'ROAS-free case/source/date population');
   assert.equal(reviewSummary(rows).average,expected.length?expected.reduce((n,r)=>n+r.rating,0)/expected.length:null);
   const parent=categoryCounts(rows),details=experienceCounts(rows);
   for(const cat of classification.categories){
    const count=expected.filter(r=>new Set(byId.get(r.id).assignments.map(a=>a.categoryId)).has(cat.id)).length;
    assert.equal(parent.find(c=>c.id===cat.id).count,count);
    assert.equal(parent.find(c=>c.id===cat.id).percent,expected.length?100*count/expected.length:null);
   }
   for(const exp of classification.experiences){
    const count=expected.filter(r=>byId.get(r.id).assignments.some(a=>a.experienceId===exp.id)).length;
    assert.equal(details.find(x=>x.id===exp.id).count,count);
   }
   for(let mask=0;mask<64;mask++){
    const requested=new Set(allCategories.filter((_,i)=>mask&(1<<i)));
    const truth=expected.filter(r=>!requested.size||[...requested].some(cat=>cat==='__unclassified__'
     ? byId.get(r.id).status==='unclassified'
     : byId.get(r.id).assignments.some(a=>a.categoryId===cat)));
    for(const term of ['', '펌프', '샴푸', '없는임의구절']){
     const matches=truth.filter(r=>r.text.toLocaleLowerCase().includes(term.toLocaleLowerCase()));
     assert.deepEqual(sorted(filterReviewTable(rows,requested,term)),sorted(matches));
     examined++;
    }
   }
   for(const field of ['writtenAt','sourceName','rating'])for(const direction of ['asc','desc']){
    const ordered=sortReviewRows(rows,{field,direction});
    assert.deepEqual(sorted(ordered),sorted(rows),'sorting cannot drop or duplicate reviews');
    assert.deepEqual(sortReviewRows(ordered,{field,direction}).map(r=>r.id),ordered.map(r=>r.id),'sorting is deterministic');
   }
  }
 }
 assert.equal(examined,2*2*3*4*64*4);
});
