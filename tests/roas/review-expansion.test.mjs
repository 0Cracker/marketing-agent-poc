import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {reviewQuery} from '../../scripts/roas/review-data.mjs';
import {readReviewProjection} from '../../frontend/roas/review-projection.ts';

const read=file=>JSON.parse(fs.readFileSync(new URL('../../'+file,import.meta.url),'utf8'));
const raw=read('data/roas/roas-reviews.json');
const classification=read('data/roas/roas-review-classification.json');
const baseline=read('evidence/review-expansion-20261105/baseline.json');
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const additions=raw.reviews.filter(r=>!baseline.originals.some(o=>o.id===r.id));
const annotations=new Map(classification.reviewClassifications.map(r=>[r.reviewId,r]));
const period=r=>r.writtenAt<'2026-08-17'?'baseline':'current';

test('approved S16 expansion adds 35 reviews, preserves original 50 except the approved source label',()=>{
 assert.equal(raw.reviews.length,85);
 assert.equal(additions.length,35);
 assert.deepEqual(additions.map(r=>r.id).sort(),Array.from({length:35},(_,i)=>`REV-S16-${String(i+26).padStart(3,'0')}`));
 for(const old of baseline.originals){
  const row=raw.reviews.find(r=>r.id===old.id);
  assert(row,old.id);
  const {sourceName,...record}=row;
  assert.equal(hash(record),old.recordSha256,old.id+' original fields');
  assert.equal(hash(annotations.get(old.id)),old.classificationSha256,old.id+' original classification');
  assert.equal(sourceName,row.sourceId==='own_store'?'자사몰':'쿠팡');
 }
 assert(raw.reviews.every(r=>r.sourceName===(r.sourceId==='own_store'?'자사몰':'쿠팡')));
 assert.deepEqual(raw.coverage,baseline.coverage);
 const manifest=read('data/roas/manifest.json');
 assert.equal(manifest.contract,baseline.manifest.contract);
 assert.deepEqual(manifest.files.map(f=>f.file),baseline.manifest.files.map(f=>f.file));
 for(const entry of baseline.manifest.files.filter(f=>!['roas-reviews.json','roas-review-classification.json'].includes(f.file)))assert.deepEqual(manifest.files.find(f=>f.file===entry.file),entry);
 for(const entry of manifest.files){const bytes=fs.readFileSync(new URL('../../data/roas/'+entry.file,import.meta.url));assert.equal(entry.bytes,bytes.length);assert.equal(entry.sha256,createHash('sha256').update(bytes).digest('hex'));}
 assert.equal(manifest.data_sha256,hash({contract:manifest.contract,files:manifest.files}));
 assert.equal(hash(Object.fromEntries(Object.entries(classification).filter(([k])=>!['reviewClassifications','sourceReviewSha256'].includes(k)))),baseline.taxonomySha256);
 for(const [name,expected]of Object.entries(baseline.files).filter(([name])=>name!=='manifest.json')){
  assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../../data/roas/'+name,import.meta.url))).digest('hex'),expected,name);
 }
});

test('approved new rating cells produce exactly 4.00 own-store current mean and retain the source-mix contrast',()=>{
 const cells=[['baseline','own_store',[0,0,0,3,2],9,40],['baseline','virtual_external_1',[1,4,4,1,0],18,45],
  ['current','own_store',[0,1,2,5,4],20,80],['current','virtual_external_1',[1,2,3,2,0],13,35]];
 for(const [p,s,ratings,n,sum]of cells){
  const added=additions.filter(r=>period(r)===p&&r.sourceId===s);
  assert.deepEqual([1,2,3,4,5].map(rating=>added.filter(r=>r.rating===rating).length),ratings,p+'/'+s);
  const all=raw.reviews.filter(r=>r.caseId==='S16'&&period(r)===p&&r.sourceId===s);
  assert.equal(all.length,n);assert.equal(all.reduce((a,r)=>a+r.rating,0),sum);
 }
 const mean=(p,s)=>{const rows=raw.reviews.filter(r=>r.caseId==='S16'&&period(r)===p&&(!s||r.sourceId===s));return rows.reduce((n,r)=>n+r.rating,0)/rows.length;};
 assert.equal(mean('current','own_store'),4);
 assert(mean('current')>mean('baseline'));
 assert(mean('current','own_store')<mean('baseline','own_store'));
});

test('new primary topics, multi-experience counts, dates and delayed collection match the plan',()=>{
 const topics={scent_preference:[1,1],scent_intensity:[1,1],scent_longevity:[1,1],foam:[1,1],residue:[1,2],
  after_feel:[1,1],tangling:[1,1],texture_application:[1,1],pump_operation:[1,1],leakage_residue:[1,1],
  container_usability:[0,1],product_packaging:[1,1],volume_label:[0,1],consumption_rate:[1,1],
  usage_guidance:[1,1],remaining_check:[0,1],delivery_timing:[1,1],delivery_condition:[0,1],unclassified:[1,1]};
 for(const [topic,counts]of Object.entries(topics)){
  assert.deepEqual(['baseline','current'].map(p=>additions.filter(r=>period(r)===p&&
   (annotations.get(r.id)?.assignments[0]?.experienceId??'unclassified')===topic).length),counts,topic);
 }
 assert.deepEqual([0,1,2].map(n=>additions.filter(r=>annotations.get(r.id)?.assignments.length===n).length),[2,23,10]);
 assert.equal(classification.reviewClassifications.flatMap(r=>r.assignments).length,106);
 const buckets=[['03','06',4],['07','10',4],['11','13',4],['14','16',3],['17','20',5],['21','24',6],['25','27',4],['28','30',5]];
 for(const [start,end,n]of buckets)assert.equal(additions.filter(r=>r.writtenAt.slice(8,10)>=start&&r.writtenAt.slice(8,10)<=end).length,n,start);
 assert.equal(additions.filter(r=>period(r)==='baseline'&&r.collectedAt>='2026-08-17').length,3);
 assert(additions.every(r=>r.writtenAt<=r.collectedAt&&r.collectedAt<'2026-08-31'));
 const contexts=read('evidence/review-expansion-20261105/contexts.json');
 assert.deepEqual(Object.values(contexts).map(g=>Object.keys(g.prefixes).length),[12,13,6,4]);
 const contextIds=[];
 for(const group of Object.values(contexts))for(const [suffix,prefix]of Object.entries(group.prefixes)){
  const id=`REV-S16-${suffix.padStart(3,'0')}`;
  const row=additions.find(r=>r.id===id);
  assert(row,id);
  assert(prefix?row.text.startsWith(prefix):row.text.includes('며칠 쓰고 나니'),id+' explicit context');
  contextIds.push(id);
 }
 assert.equal(new Set(contextIds).size,35);
 const normalized=raw.reviews.map(r=>r.text.normalize('NFKC').replace(/[\p{P}\p{S}\s]/gu,'').toLowerCase());
 assert.equal(new Set(normalized).size,85,'no exact normalized duplicates');
});

test('both snapshots reach UI projection with 60/25 reviews and 27/33 S16 period counts',()=>{
 for(const snapshotId of ['initial','mature'])for(const caseId of ['S16','S17']){
  const dto=reviewQuery({caseId,snapshotId});
  assert.equal(dto.status,'ready',caseId+'/'+snapshotId);
  const view=readReviewProjection(dto,caseId,dto.asOf);
  assert.equal(view.status,'ready');
  assert.equal(view.reviews.length,caseId==='S16'?60:25);
  assert.deepEqual(dto.periods.map(p=>p.count),caseId==='S16'?[27,33]:[12,13]);
  const own=reviewQuery({caseId,snapshotId,sourceId:'own_store'});
  if(caseId==='S16')assert.equal(own.periods[1].meanRating,4);
  const coupang=reviewQuery({caseId,snapshotId,sourceId:'virtual_external_1'});
  assert(coupang.reviews.every(r=>r.sourceName==='쿠팡'));
 }
});
