import assert from 'node:assert/strict';
import {demoCases,componentWeights,levels} from '../frontend/lib/demo-scenarios.ts';
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const shares=(r:(number|null)[])=>[0,2,4,6].map(i=>r[i]===null||r[i+1]===null?null:100*r[i]!/(r[i]!+r[i+1]!));
const cti=(s:(number|null)[])=>s.some(v=>v===null)?null:s.reduce<number>((t,v,i)=>t+v!*componentWeights[i],0);
assert.equal(demoCases.length,6);
assert.equal(new Set(demoCases.map(c=>c.focus)).size,6);
let pairs=0;
for(const c of demoCases){
 assert.ok(c.decision.title&&c.decision.risk&&c.decision.rule&&c.decision.alternative&&c.decision.success&&c.decision.stop&&c.decision.followup);
 assert.ok(c.decision.tasks.length>=2);for(const task of c.decision.tasks)assert.ok(task.owner&&task.due&&task.inputs&&task.done);
 assert.equal(c.process.length,5);assert.equal(c.proof.length,4);c.proof.forEach((p,i)=>{assert.equal(p.currentA,c.raw[i*2]);assert.equal(p.currentB,c.raw[i*2+1]);assert.equal(p.contribution,c.contributions[i]);assert.ok(p.source.includes(c.id+'-202609'));});
 for(const l of levels){assert.equal(c.responses[l.id].question,l.question);assert.ok(c.responses[l.id].conclusion);pairs++;}
 const now=shares(c.raw),before=shares(c.baseline);
 now.forEach((s,i)=>{if(s===null){assert.equal(c.shares[i],null);assert.equal(c.contributions[i],null);}else{near(s,c.shares[i]!);near(componentWeights[i]*(s-before[i]!),c.contributions[i]!);}});
 const current=cti(now);assert.equal(c.current,current);
 if(current!==null)near(c.contributions.reduce<number>((a,v)=>a+v!,0),current-60.25);
 for(const r of c.history){const s=shares(r.raw);s.forEach((v,i)=>v===null?assert.equal(r.shares[i],null):near(v,r.shares[i]!));assert.equal(r.cti,cti(s));}
 assert.deepEqual(c.history[0].raw,c.baseline);assert.deepEqual(c.history[5].raw,c.raw);
 assert.equal(c.review[0],c.review[1]+c.review[2]+c.review[3]);assert.equal(c.review[1],c.raw[2]);assert.ok(c.raw[3]!<=c.peerReviews);
 for(const t of c.topics){assert.ok(Number(t[1])<=150);assert.ok(Number(t[2])<=c.review[3]);}
 near(c.channels.reduce((a,r)=>a+r.spend,0),c.spend);
 if(c.raw[6]===null){assert.equal(c.budget,null);assert.ok(c.channels.every(r=>r.impressions===null));continue;}
 near(c.channels.reduce((a,r)=>a+r.impressions!,0),c.raw[6]);
 const b=c.budget!;assert.ok(b);near(b.total,c.spend);near(b.rows.reduce((a,r)=>a+r.current,0),b.total);near(b.rows.reduce((a,r)=>a+r.recommended,0),b.total);
 let expected=0;
 for(const r of b.rows){assert.ok(r.recommended>=r.min&&r.recommended<=r.max);near(r.q*Math.log(1+r.current/r.k),r.currentImpressions);near(r.q*Math.log(1+r.recommended/r.k),r.expectedImpressions);expected+=r.expectedImpressions;
  b.curves.forEach(p=>near(p[r.name],r.q*Math.log(1+p.budget/r.k)));
  const gains=b.curves.slice(1).map((p,i)=>p[r.name]-b.curves[i][r.name]);gains.slice(1).forEach((g,i)=>assert.ok(g<=gains[i]));
 }
 near(expected,b.expectedImpressions);near(b.expectedM,100*expected/(expected+b.competitorImpressions));near(b.currentM,now[3]!);near(b.currentCti,current!);near(b.expectedCti,current!+.2*(b.expectedM-now[3]!));if(c.decision.kind==='experiment')assert.ok(b.expectedCti>b.currentCti);else{near(b.expectedCti,b.currentCti);assert.ok(b.rows.every(r=>r.recommended===r.current));}
}
assert.equal(pairs,18);
const [a,b,c,d,e,f]=demoCases;
near(a.current!,50.10);assert.deepEqual(a.contributions,[-1.75,-5,-.4,-3]);
for(const i of [0,2,4,6])near(b.raw[i]!,b.baseline[i]);assert.ok(b.current!<60.25);near(b.review[1]/b.review[0],.65);
assert.ok(c.spend>10000000&&c.raw[6]!<600000);near(c.spend/c.raw[6]!*1000/(10000000/600000*1000),1.6);
assert.ok(d.contributions[1]!<0&&d.contributions[3]!>0);near(d.current!,57);
assert.equal(e.current,null);assert.equal(e.contributions[3],null);assert.equal(e.budget,null);
near(f.current!,65.25);
assert.deepEqual(a.history.slice(0,4).map(r=>r.raw[2]),[650,650,650,650]);
assert.deepEqual(b.history.slice(0,3).map(r=>r.raw),[b.baseline,b.baseline,b.baseline]);
assert.deepEqual(c.history.slice(0,4).map(r=>r.raw[6]),[600000,600000,600000,600000]);
assert.deepEqual(d.history.slice(0,5).map(r=>r.raw),Array(5).fill(d.baseline));
assert.equal(c.decision.kind,'experiment');assert.equal(e.decision.kind,'hold');assert.equal(f.decision.kind,'maintain');assert.equal(a.decision.kind,'investigation');
assert.equal(demoCases.filter(x=>x.budget&&x.budget.rows.some(r=>r.current!==r.recommended)).length,1);
console.log('PASS: 6 distinct cases, 18 fixed Q&A pairs, 36 monthly records, CTI/contributions/reviews/media evidence/decision contracts, chronology, one experiment and four held budgets with diminishing-return curves');
