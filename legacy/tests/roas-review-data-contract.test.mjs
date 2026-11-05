import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const file=path.join(root,'data','roas-reviews.json');

test('REV-DATA-01: approved 50 synthetic product reviews and four coverage declarations exist',()=>{
 assert(fs.existsSync(file),'approved roas-reviews/1 dataset is not yet implemented');
 const data=JSON.parse(fs.readFileSync(file,'utf8'));
 assert.equal(data.contract,'roas-reviews/1');
 assert.equal(data.subjectCategory,'shampoo');
 assert.equal(data.reviews.length,50);
 assert.equal(data.coverage.length,4);
 const ids=new Set();
 for(const r of data.reviews){
  assert(!ids.has(r.id),'review IDs must be unique');ids.add(r.id);
  assert(['S16','S17'].includes(r.caseId));
  assert.equal(r.productId,'EDU-P1');
  assert.equal(r.ratingScale,5);
  assert(Number.isInteger(r.rating)&&r.rating>=1&&r.rating<=5);
  assert(typeof r.text==='string'&&r.text.trim());
  assert(Date.parse(r.writtenAt)<=Date.parse(r.collectedAt));
  assert(Date.parse(r.collectedAt)<Date.parse('2026-08-31T00:00:00+09:00'));
  assert(!('campaignId' in r)&&!('device' in r)&&!('orderId' in r));
 }
 for(const caseId of ['S16','S17']){
  const rows=data.reviews.filter(r=>r.caseId===caseId);
  assert.equal(rows.length,25);
  const before=rows.filter(r=>r.writtenAt.slice(0,10)>='2026-08-03'&&r.writtenAt.slice(0,10)<='2026-08-16');
  const after=rows.filter(r=>r.writtenAt.slice(0,10)>='2026-08-17'&&r.writtenAt.slice(0,10)<='2026-08-30');
  assert.equal(before.length,12);assert.equal(after.length,13);
 }
});
