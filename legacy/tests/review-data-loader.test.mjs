import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {reviewAsset,reviewAssetNames,reviewDataPlugin,reviewQuery,validateReviewBundle} from '../scripts/review-data.mjs';
import {trainingScreenData} from '../scripts/training-data.mjs';
import {currentManifest,loadCurrentData,publicFiles} from '../scripts/current-data.mjs';

const root=path.resolve(import.meta.dirname,'..');
const load=file=>JSON.parse(fs.readFileSync(path.join(root,'data',file),'utf8'));
const cases=Array.from({length:18},(_,i)=>'S'+String(i+1).padStart(2,'0'));

test('all 18 cases and both snapshots return verified status without altering ROAS identity',()=>{
 assert.equal(reviewAssetNames.length,36);
 const hash=currentManifest().data_sha256;
 for(const caseId of cases)for(const snapshot of ['initial','mature']){
  const view=reviewAsset(`review-${caseId}-${snapshot}.json`);
  assert.equal(view.caseId,caseId);
  assert.equal(view.productId,'EDU-P1');
  assert.equal(view.productName,'쓱쓱샴푸');
  assert.equal(view.dataHash,hash);
  assert.equal(view.periods.length,2);
  assert.deepEqual(view.periods.map(p=>p.id),['baseline','current']);
  if(['S16','S17'].includes(caseId)){
   assert.equal(view.status,'ready');
   assert.equal(view.selectionStatus,'provided');
   assert.equal(view.classificationStatus,'ready');
   assert.equal(view.classificationVersion,'1.0.0');
   assert.equal(view.reviews.length,25);
   assert.deepEqual(view.periods.map(p=>p.count),[12,13]);
   assert.equal(view.reviews.filter(r=>r.classification==='unclassified').length,1);
   assert(view.reviews.filter(r=>r.classification==='unclassified').every(r=>r.categories.length===0&&r.experiences.length===0));
   assert(view.reviews.filter(r=>r.classification==='classified').every(r=>r.experiences.length>0));
   assert.deepEqual(view.periods.map(p=>p.unclassifiedCount),[0,1]);
   assert.deepEqual(view.reviews.map(r=>r.writtenAt),view.reviews.map(r=>r.writtenAt).toSorted().reverse());
  }else{
   assert.equal(view.status,'not_provided');
   assert.equal(view.caseAvailability,'not_provided');
   assert.equal(view.selectionStatus,'not_provided');
   assert.deepEqual(view.periods.map(p=>p.count),[null,null],'unavailable reviews have no fabricated zero counts');
   assert.deepEqual(view.reviews,[]);
  }
 }
 assert.equal(currentManifest().data_sha256,hash);
});

test('source and written-period filters are independent and preserve both period totals',()=>{
 for(const id of ['S16','S17']){
  const all=reviewQuery({caseId:id});
  const byOwn=reviewQuery({caseId:id,sourceId:'own_store'});
  const byExternal=reviewQuery({caseId:id,sourceId:'virtual_external_1'});
  assert.equal(all.reviews.length,25);
  assert.equal(byOwn.reviews.length,id==='S16'?12:13);
  assert.equal(byExternal.reviews.length,id==='S16'?13:12);
  for(const period of ['baseline','current']){
   const before=reviewQuery({caseId:id,sourceId:'own_store',listPeriod:period});
   const other=reviewQuery({caseId:id,sourceId:'virtual_external_1',listPeriod:period});
   assert(before.reviews.every(r=>r.sourceId==='own_store'));
   assert(other.reviews.every(r=>r.sourceId==='virtual_external_1'));
   assert.equal(before.reviews.length+other.reviews.length,period==='baseline'?12:13);
   assert.deepEqual(before.periods.map(p=>p.count),byOwn.periods.map(p=>p.count),'listPeriod does not shrink comparison totals');
   assert.deepEqual(other.periods.map(p=>p.count),byExternal.periods.map(p=>p.count));
  }
 }
 assert.deepEqual(reviewQuery({caseId:'S16',sourceId:'own_store'}).periods.map(p=>p.count),[4,8]);
 assert.deepEqual(reviewQuery({caseId:'S17',sourceId:'own_store'}).periods.map(p=>p.count),[8,5]);
 assert.equal(reviewQuery({caseId:'S17',listPeriod:'current'}).reviews.length,13);
 assert.equal(reviewQuery({caseId:'S16',snapshotId:'mature'}).asOf,'2026-09-07T00:00:00+09:00');
});

test('invalid inputs and missing review sources are error, never not_provided',()=>{
 for(const args of [{caseId:'S99'},{caseId:'S16',sourceId:'third_store'},{caseId:'S16',snapshotId:'unknown'},{caseId:'S16',listPeriod:'2026-09'}]){
  const view=reviewQuery(args);
  assert.equal(view.status,'error');
  assert.equal(view.errorCode,'REVIEW_QUERY_INVALID');
 }
 const before=trainingScreenData(undefined,'S16','initial');
 const broken=reviewQuery({caseId:'S16'},path.join(root,'docs'));
 assert.equal(broken.status,'error');
 assert.equal(broken.errorCode,'REVIEW_DATA_UNAVAILABLE');
 assert.deepEqual(broken.reviews,[]);
 const after=trainingScreenData(undefined,'S16','initial');
 assert.deepEqual(after,before,'an optional review failure cannot modify ROAS data');
});

test('coverage, exact row shape and timestamp checks reject invalid in-memory mutations',()=>{
 const bundle=load('roas-reviews.json'),meta=load('roas-product-metadata.json');
 const periods=trainingScreenData(undefined,'S16','initial').periods;
 const clone=()=>structuredClone(bundle);
 assert.equal(validateReviewBundle(bundle,meta,periods).productName,'쓱쓱샴푸');
 const edits=[
  b=>b.coverage.pop(),
  b=>b.coverage[0].periodIds=['current','current'],
  b=>b.coverage[0].periodIds=['current'],
  b=>b.coverage[0].sourceId='unknown',
  b=>b.reviews[1].id=b.reviews[0].id,
  b=>b.reviews[0].sourceId='unknown',
  b=>b.reviews[0].productId='EDU-P2',
  b=>b.reviews[0].collectedAt='2026-09-02T00:00:00+09:00',
  b=>b.reviews[0].writtenAt='2026-08-31T00:00:00+09:00',
  b=>b.reviews[0].rating=0,
  b=>b.reviews[0].text='',
 ];
 for(const edit of edits){const b=clone();edit(b);assert.throws(()=>validateReviewBundle(b,meta,periods));}
 const m=structuredClone(meta);m.products[0].containerType='hinged_cap';assert.throws(()=>validateReviewBundle(bundle,m,periods));
});

test('review assets are projected; the raw packs remain private and plugin is isolated',()=>{
 const {manifest}=loadCurrentData();
 for(const file of ['roas-reviews.json','roas-product-metadata.json','roas-review-classification.json'])assert(!publicFiles(manifest).includes(file));
 assert(!Object.keys(load('manifest.json').metadata).some(x=>x.includes('roas-reviews.json')));
 let middleware;reviewDataPlugin().configureServer({middlewares:{use:fn=>middleware=fn}});
 const request=url=>{const res={headers:{},setHeader(name,value){this.headers[name]=value;},end(body){this.body=body;}};let passed=false;middleware({url},res,()=>passed=true);return {res,passed};};
 const hit=request('/workbench-data/current/review-S16-initial.json');
 assert.equal(hit.passed,false);
 const payload=JSON.parse(hit.res.body);
 assert.equal(payload.reviews.length,25);assert.equal(payload.productName,'쓱쓱샴푸');
 assert(!('coverage' in payload)&&!('subjectCategory' in payload)&&!('matureOverrides' in payload));
 assert(!hit.res.body.includes('campaignId')&&!hit.res.body.includes('orderId'));
 assert.equal(request('/workbench-data/current/roas-reviews.json').passed,true);
 assert.equal(request('/workbench-data/current/review-S99-initial.json').passed,true);
 const emitted=[];reviewDataPlugin().generateBundle.call({emitFile:file=>emitted.push(file)});
 assert.equal(emitted.length,36);
 assert(emitted.every(e=>e.type==='asset'&&e.fileName.startsWith('workbench-data/current/review-')));
});

test('optional review build still emits error states when review inputs are unavailable',()=>{
 const missing=reviewDataPlugin(path.join(root,'docs'));
 const emitted=[];missing.generateBundle.call({emitFile:file=>emitted.push(file)});
 assert.equal(emitted.length,36);
 for(const asset of emitted){
  const view=JSON.parse(asset.source);
  assert.equal(view.status,'error');
  assert.equal(view.errorCode,'REVIEW_DATA_UNAVAILABLE');
  assert.deepEqual(view.reviews,[]);
 }
 assert.equal(trainingScreenData(undefined,'S16','initial').caseId,'S16','ROAS still loads after optional failure');
});

test('approved unclassified reviews remain in rating denominators but never in theme counts',()=>{
 for(const [caseId,id,sourceId] of [
  ['S16','REV-S16-025','virtual_external_1'],['S17','REV-S17-025','own_store']
 ]){
  const all=reviewQuery({caseId});
  assert.equal(all.status,'ready');
  const current=all.periods.find(p=>p.id==='current');
  assert.equal(current.count,13);
  assert.equal(current.unclassifiedCount,1);
  assert.deepEqual(current.unclassifiedReviewIds,[id]);
  assert.equal(all.reviews.find(r=>r.id===id).classification,'unclassified');
  assert.deepEqual(all.reviews.find(r=>r.id===id).categories,[]);
  assert.deepEqual(all.reviews.find(r=>r.id===id).experiences,[]);
  assert.equal(current.meanRating,all.reviews.filter(r=>r.writtenAt.slice(0,10)>='2026-08-17')
    .reduce((sum,r)=>sum+r.rating,0)/13);
  for(const category of current.categories){
   assert(!category.reviewIds.includes(id));
   assert.equal(category.count,category.reviewIds.length);
   assert.equal(category.percent,category.count/13*100);
  }
  for(const experience of current.experiences){
   assert(!experience.reviewIds.includes(id));
   assert.equal(experience.count,experience.reviewIds.length);
  }
  const oneSource=reviewQuery({caseId,sourceId,listPeriod:'current'});
  assert(oneSource.reviews.some(r=>r.id===id&&r.classification==='unclassified'));
  for(const period of ['baseline','current']){
   const total=all.periods.find(p=>p.id===period);
   const own=reviewQuery({caseId,sourceId:'own_store'}).periods.find(p=>p.id===period);
   const ext=reviewQuery({caseId,sourceId:'virtual_external_1'}).periods.find(p=>p.id===period);
   assert.equal(total.count,own.count+ext.count);
   assert.equal(total.unclassifiedCount,own.unclassifiedCount+ext.unclassifiedCount);
   for(const category of total.categories){
    const n=own.categories.find(x=>x.categoryId===category.categoryId).count+
      ext.categories.find(x=>x.categoryId===category.categoryId).count;
    assert.equal(category.count,n);
   }
  }
 }
});
