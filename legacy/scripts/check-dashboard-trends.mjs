import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createServer} from 'vite';
import {loadCurrentData,sha256} from './current-data.mjs';
import {applyDemoOrderFlow} from './demo-order-flow.mjs';
const {catalog,manifest,lock}=loadCurrentData(),records=catalog.records;
const lines=new Map(records.filter(r=>r.dataset_type==='T19').map(r=>[r.line_id,r]));
const orders=new Map(records.filter(r=>r.dataset_type==='T19').map(r=>[r.order_id,r]));
for(const r of records.filter(r=>r.dataset_type==='T20')){const order=lines.get(r.order_line_ref);assert(order);assert(r.quantity<=order.quantity);assert(Date.parse(r.requested_at)>=Date.parse(order.ordered_at));}
for(const r of records.filter(r=>r.dataset_type==='T23'&&r.order_ref)){const order=orders.get(r.order_ref);assert(order);if(r.shipped_at)assert(Date.parse(r.shipped_at)>=Date.parse(order.ordered_at));}
// Rerunning the projection from the preserved original must reproduce current rows.
const provenance=fs.readFileSync('data/provenance.jsonl','utf8').trim().split(/\r?\n/).map(JSON.parse),archives=new Map();
const provenanceById=new Map(provenance.map(p=>[p.active_id,p])),recordsById=new Map(records.map(r=>[r.record_id,r]));
const baseline=records.map(r=>{if(!['T18','T19','T20','T23','T30'].includes(r.dataset_type))return r;const p=provenanceById.get(r.record_id);if(!archives.has(p.archive))archives.set(p.archive,new Map(fs.readFileSync('data/'+p.archive,'utf8').trim().split(/\r?\n/).map(JSON.parse).map(r=>[r.record_id,r])));return archives.get(p.archive).get(r.record_id);});
assert.deepEqual(applyDemoOrderFlow(baseline),records);
for(const p of provenance)assert.equal(sha256(JSON.stringify(recordsById.get(p.active_id))),p.record_sha256);
const vite=await createServer({configFile:false,root:process.cwd()+'/frontend',server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true},appType:'custom'});
try{
 const {createCurrentServices}=await vite.ssrLoadModule('/workbench/current-service.ts');const {service}=createCurrentServices(catalog,lock,manifest);
 const profiles=[];
 for(const country of ['KR','JP','US']){
  const m=service.query('T19',country,'2026-08'),qty=m.charts.find(c=>c.title==='일별 상품 판매 수량');assert(qty);assert.equal(qty.data.length,28);
  assert.equal(qty.data.reduce((n,r)=>n+qty.series.reduce((n,s)=>n+Number(r.values[s.key]),0),0),m.metrics[1].value);
  for(const s of qty.series){const values=qty.data.map(r=>Number(r.values[s.key]));assert(new Set(values).size>=8);assert(Math.max(...values)<Math.min(...values)*4);profiles.push({country,product:s.name,total:values.reduce((a,b)=>a+b,0),values});}
  const tickets=service.query('T26',country,'2026-08'),daily=tickets.charts[0];assert.equal(daily.kind,'line');assert.equal(daily.series.length,1);const topics=tickets.charts.find(c=>c.title==='문의 주제별 접수');assert(topics.pageSize>=topics.data.length);assert.equal(topics.data.length,5);assert.equal(daily.data.reduce((n,r)=>n+daily.series.reduce((n,s)=>n+Number(r.values[s.key]),0),0),tickets.source.length);
 }
 assert.equal(new Set(profiles.map(p=>JSON.stringify(p.values))).size,6);
 for(const type of ['T19','T26','T24','T18','T22','T03','H01']){const m=service.query(type,'ALL','2026-08');assert(m.charts.some(c=>c.kind==='bar'));for(const c of m.charts.filter(c=>c.kind==='bar'))assert(c.data.every(r=>typeof r.values.v==='number'&&Number.isFinite(r.values.v)));}
 assert.equal(service.query('T19','JP','2026-07').status,'empty');assert.equal(service.query('H01','JP','2026-07').status,'ready');
 const report={pass:true,dataHash:manifest.data_sha256,profiles,checks:['six distinct quantity series','28 dates per country','quantity and ticket totals reconcile','refund and shipment chronology','preserved-source reproduction','provenance hashes','single-unit country charts','period availability']};
 fs.mkdirSync('evidence/dashboard-trends-20261020',{recursive:true});fs.writeFileSync('evidence/dashboard-trends-20261020/trends.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await vite.close();}
