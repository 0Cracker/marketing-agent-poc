import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const here=path.dirname(fileURLToPath(import.meta.url));
export const root=path.resolve(here,'../../../../..');
export const version='D007-1';
export const seed='D007-20000-20261017';
export const counts={T02:108,T03:432,T04:108,T05:216,T06:216,T07:432,T08:1512,T09:54,T10:108,T11:54,
 T12:12,T13:624,T14:672,T15:144,T16:72,T17:2800,T18:3280,T19:1200,T20:120,T21:144,T22:336,T23:900,
 T24:1800,T25:2400,T26:180,T27:108,T28:540,T29:36,T30:144,T31:144,T32:108,T33:72,T34:168,T35:108,
 T36:216,T37:108,T38:72,T39:72,T40:36,H01:144};
export const countries=['KR','JP','US'];
export const currencies={KR:'KRW',JP:'JPY',US:'USD'};
export const zones={KR:'Asia/Seoul',JP:'Asia/Tokyo',US:'America/New_York'};
export const products=['P1A','P1B','P2A','P2B','P3A','P3B'];
export const months=Array.from({length:24},(_,i)=>new Date(Date.UTC(2024,9+i,1)).toISOString().slice(0,10));
export const days=Array.from({length:28},(_,i)=>`2026-08-${String(i+3).padStart(2,'0')}`);
export const nextDay=d=>new Date(Date.parse(d)+86400000).toISOString().slice(0,10);
export const nextMonth=d=>new Date(Date.UTC(Number(d.slice(0,4)),Number(d.slice(5,7)),1)).toISOString().slice(0,10);
export const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
export const fileSha=file=>sha(fs.readFileSync(file));
export const readLines=file=>fs.readFileSync(file,'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
export const baselineBatches=['D003B','D005','D006-CQ-A','D006-CQ-B'];
export function baselineFiles(){
 return baselineBatches.flatMap(b=>{
  const dir=path.join(here,'..',b);
  return [...fs.readdirSync(path.join(dir,'source')).filter(f=>f.endsWith('.jsonl')).map(f=>path.join(dir,'source',f)),
   ...['manifest.json'].filter(f=>fs.existsSync(path.join(dir,f))).map(f=>path.join(dir,f))];
 }).sort();
}
export const relative=p=>path.relative(root,p).split(path.sep).join('/');
export const inputHashes=()=>Object.fromEntries(baselineFiles().map(p=>[relative(p),fileSha(p)]));
export const unitBase={KR:15000,JP:1500,US:1500}; // minor units; KRW/JPY have no fractional unit.
export const money=(n,c)=>({amount:c==='US'?`${Math.floor(n/100)}.${String(n%100).padStart(2,'0')}`:`${n}.00`,currency:currencies[c]});
export const minor=m=>{const [a,b='00']=m.amount.split('.');return BigInt(a)*(m.currency==='USD'?100n:1n)+(m.currency==='USD'?BigInt(b.padEnd(2,'0')):0n);};
export const random=key=>parseInt(sha(seed+'/'+key).slice(0,8),16)/0x100000000;
// Stratify input quantiles, then transform into each profile's distribution.
// This is not a claim that the resulting market observations are uniformly distributed.
const permutations=new Map();
export function stratified(key,i,n){
 const cache=key+'/'+n;
 if(!permutations.has(cache)){
  const a=Array.from({length:n},(_,j)=>j);
  for(let j=n-1;j>0;j--){const k=Math.floor(random(cache+'/'+j)*(j+1));[a[j],a[k]]=[a[k],a[j]];}
  permutations.set(cache,a);
 }
 return (permutations.get(cache)[i]+random(cache+'/jitter/'+i))/n;
}
export const profiles={
 P1A:{price:.86,ctr:.032,cvr:.046,growth:.10,ratings:[8,12,20,35,25],strength:'가격',weakness:'건조감'},
 P1B:{price:1.12,ctr:.023,cvr:.031,growth:.14,ratings:[8,12,20,30,30],strength:'보습감',weakness:'가격'},
 P2A:{price:.94,ctr:.035,cvr:.039,growth:.04,ratings:[5,10,15,30,40],strength:'가격',weakness:'향'},
 P2B:{price:1.32,ctr:.020,cvr:.027,growth:.08,ratings:[5,8,17,30,40],strength:'거품',weakness:'향'},
 P3A:{price:1.06,ctr:.039,cvr:.023,growth:.28,ratings:[15,15,20,25,25],strength:'세정감',weakness:'용기'},
 P3B:{price:1.02,ctr:.026,cvr:.037,growth:-.06,ratings:[10,15,25,30,20],strength:'용기',weakness:'가격'},
};
export const aspects=['세정감','보습감','향','거품','용기','가격','건조감'];
export function checkSpec(){
 assert.equal(Object.values(counts).reduce((a,b)=>a+b,0),20000);
 assert.equal(Object.keys(counts).length,40); // T01 is reused; H01 is a separate historical type.
 for(const p of Object.values(profiles))assert.equal(p.ratings.reduce((a,b)=>a+b,0),100);
 return {status:'pass',planned_new_rows:20000,new_types:40,reused_product_rows:6};
}
export function requireApproval(file){
 assert.ok(file,'Explicit D007 approval file required; a generic execute-plan message is insufficient under AGENTS.md');
 const a=JSON.parse(fs.readFileSync(file,'utf8'));
 assert.equal(a.approved,true);assert.equal(a.source,'explicit_human_response');assert.ok(a.user_message?.trim());
 assert.equal(a.new_rows,20000);assert.deepEqual(a.counts,counts);
 assert.equal(a.spec_sha256,fileSha(path.join(here,'spec.mjs')));
 assert.equal(a.preserve_existing,true);assert.equal(a.preserve_sample_scopes,true);
 return a;
}
