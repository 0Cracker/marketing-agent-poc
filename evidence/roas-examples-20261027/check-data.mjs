import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {summarize} from '../../shared/training-dashboard.mjs';

const root=path.resolve(import.meta.dirname,'../..'),directory=path.join(root,'data');
const hash=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const payload=JSON.parse(fs.readFileSync(path.join(directory,'training-dashboard.json')));
const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json')));
const pack=payload.cases.find(row=>row.caseId==='S16');
const allowed=['discount','revenue','ledgerRevenue'];
const addedIds=['CASE-S16-13','CASE-S16-14','CASE-S16-15'];
const preserved=p=>({...p,recordIds:p.recordIds.filter(id=>!addedIds.includes(id)),facts:p.facts.map(strip),breakdowns:p.breakdowns.map(strip)});
function strip(row){return Object.fromEntries(Object.entries(row).filter(([key])=>row.periodId!=='current'||!allowed.includes(key)));}
const packs=[...payload.cases,...Object.values(payload.matureOverrides)];
const totals=Object.fromEntries(['baseline','current'].map(id=>[id,summarize(pack.facts.filter(row=>row.periodId===id))]));
const beforePath=path.join(import.meta.dirname,'before.json');
if(process.argv.includes('--capture-before')){
 const before={sourceSha256:hash(fs.readFileSync(path.join(directory,'training-dashboard.json'))),dataHash:manifest.data_sha256,records:payload.records.length,
  s16PreservedHash:hash(preserved(pack)),s16FactsSha256:hash(pack.facts),s16BreakdownsSha256:hash(pack.breakdowns),
  packs:packs.filter(p=>p.caseId!=='S16').map(p=>({caseId:p.caseId,asOf:p.asOf,sha256:hash(p)})),
  recordHashes:payload.records.map(row=>({id:row.id,sha256:hash(row)})),
  files:[...manifest.files,...manifest.metadata].filter(item=>item.file!=='training-dashboard.json').map(item=>({file:item.file,sha256:hash(fs.readFileSync(path.join(directory,item.file)))})),totals};
 fs.writeFileSync(beforePath,JSON.stringify(before,null,2)+'\n',{flag:'wx'});
 console.log('Captured original data hashes and S16 totals.');
}else{
 const before=JSON.parse(fs.readFileSync(beforePath));
 assert.equal(hash(preserved(pack)),before.s16PreservedHash,'only current S16 money fields and three record links may change');
 for(const old of before.packs)assert.equal(hash(packs.find(p=>p.caseId===old.caseId&&p.asOf===old.asOf)),old.sha256,old.caseId);
 for(const old of before.recordHashes)assert.equal(hash(payload.records.find(row=>row.id===old.id)),old.sha256,old.id);
 for(const old of before.files)assert.equal(hash(fs.readFileSync(path.join(directory,old.file))),old.sha256,old.file);
 const additions=payload.records.filter(row=>!before.recordHashes.some(old=>old.id===row.id));
 assert.deepEqual(additions.map(row=>row.id),addedIds);assert.equal(payload.records.length,before.records+3);
 for(const record of additions){assert.equal(record.category,'change');assert.equal(record.date,'2026-08-17');assert.equal(record.values.변경전,20);assert.equal(record.values.변경후,0);assert(pack.products.some(p=>p.id===record.productId));assert(pack.recordIds.includes(record.id));}
 const facts=pack.facts.filter(row=>row.periodId==='current'),breakdowns=pack.breakdowns.filter(row=>row.periodId==='current');
 assert.equal(facts.length,168);assert.equal(breakdowns.length,840);
 for(const row of [...facts,...breakdowns]){assert.equal(row.discount,0);assert.equal(row.revenue,row.listRevenue);assert.equal(row.ledgerRevenue,row.revenue);}
 assert(totals.current.rates.aov>totals.baseline.rates.aov);assert(totals.current.rates.cvr<totals.baseline.rates.cvr);assert(totals.current.rates.cpc>totals.baseline.rates.cpc);assert(totals.current.rates.roas<totals.baseline.rates.roas);
 assert.equal(totals.current.revenue,before.totals.current.listRevenue);
 assert.equal(totals.current.rates.cvr,before.totals.current.rates.cvr);assert.equal(totals.current.rates.cpc,before.totals.current.rates.cpc);
 const result={status:'passed',facts:168,breakdowns:840,addedRecords:additions.length,preservedCases:before.packs.length,preservedSourceFiles:before.files.length,sourceSha256:hash(fs.readFileSync(path.join(directory,'training-dashboard.json'))),dataHash:manifest.data_sha256,totals};
 fs.writeFileSync(path.join(import.meta.dirname,'data-validation.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result));
}
