import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createServer} from 'vite';
import {loadCurrentData,sha256} from './current-data.mjs';
import {applyDemoOrderFlow} from './demo-order-flow.mjs';
const {catalog,manifest,lock}=loadCurrentData(),byId=new Map(catalog.records.map(r=>[r.record_id,r]));
const events=catalog.records.filter(r=>r.dataset_type==='T18'&&['purchase','refund'].includes(r.event_name));
const orders=new Set();
for(const r of events){
 const parent=r.related_record_ids.map(id=>byId.get(id)).find(p=>p?.dataset_type===(r.event_name==='purchase'?'T19':'T20'));
 assert(parent,r.record_id);assert.equal(r.quantity,parent.quantity,r.record_id+' quantity');
 assert.equal(r.event_time,r.event_name==='purchase'?parent.ordered_at:parent.processed_at||parent.requested_at,r.record_id+' timestamp');
 if(r.event_name==='purchase'){assert(!orders.has(parent.record_id));orders.add(parent.record_id);assert.equal(r.variant_ref,parent.variant_ref);}
}
assert.equal(orders.size,catalog.records.filter(r=>r.dataset_type==='T19').length);
const provenance=fs.readFileSync('data/provenance.jsonl','utf8').trim().split(/\r?\n/).map(JSON.parse),byProvenance=new Map(provenance.map(p=>[p.active_id,p])),archives=new Map();
const baseline=catalog.records.map(r=>{if(!['T18','T19','T20','T23','T30'].includes(r.dataset_type))return r;const p=byProvenance.get(r.record_id);if(!archives.has(p.archive))archives.set(p.archive,new Map(fs.readFileSync('data/'+p.archive,'utf8').trim().split(/\r?\n/).map(JSON.parse).map(r=>[r.record_id,r])));return archives.get(p.archive).get(r.record_id);});
assert.deepEqual(applyDemoOrderFlow(baseline),catalog.records);
for(const r of catalog.records)assert.equal(sha256(JSON.stringify(r)),byProvenance.get(r.record_id).record_sha256);
const vite=await createServer({configFile:false,root:process.cwd()+'/frontend',server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true},appType:'custom'});
try{
 const {createCurrentServices}=await vite.ssrLoadModule('/workbench/current-service.ts'),{service}=createCurrentServices(catalog,lock,manifest),cases=[];
 for(const country of ['KR','JP','US'])for(const product of ['', 'P1A','P1B']){
  const purchase=service.query('T18',country,'2026-08',{product}),sale=service.query('T19',country,'2026-08',{product});
  const a=purchase.charts.find(c=>c.title==='일별 상품 구매 수량'),b=sale.charts.find(c=>c.title==='일별 상품 판매 수량');
  assert.deepEqual(a.series,b.series);assert.deepEqual(a.data.map(r=>r.values),b.data.map(r=>r.values));
  assert.equal(purchase.metrics[0].value,sale.metrics[1].value);cases.push({country,product:product||'ALL',quantity:purchase.metrics[0].value,days:a.data.length});
 }
 const result={pass:true,dataHash:manifest.data_sha256,purchaseEvents:orders.size,refundEvents:events.length-orders.size,cases,checks:['all linked event quantities and timestamps','one purchase event per order line','daily chart parity across three countries and two products','preserved-source reproduction','current provenance hashes']};
 fs.mkdirSync('evidence/purchase-event-sync-20261020',{recursive:true});fs.writeFileSync('evidence/purchase-event-sync-20261020/checks.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await vite.close();}
