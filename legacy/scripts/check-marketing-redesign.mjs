import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const demo=read('frontend/public/workbench-data/D008/catalog.json'),lock=read('frontend/public/workbench-data/D008/lock.json');
assert.equal(createHash('sha256').update(fs.readFileSync('frontend/public/workbench-data/D008/catalog.json')).digest('hex'),lock.sha256);
assert.equal(createHash('sha256').update(fs.readFileSync('frontend/public/workbench-data/D007/catalog.json')).digest('hex'),lock.source_sha256);
const index=read('frontend/public/workbench-data/connected/index.json'),old=read('frontend/public/workbench-data/D007/catalog.json'),oldLock=read('frontend/public/workbench-data/D007/lock.json');
const entries=index.batches.flatMap(b=>b.id==='D007'?old.records.map(record=>({batch:'D007',country:record.scope_id.split('-')[1],record,source:record,payload:record,schema_conforming:true,contract_gaps:[]})):read('frontend/public'+b.url));
const extra=demo.records.map(record=>({batch:'D008',country:record.scope_id.split('-')[1],record,source:record,payload:record,schema_conforming:true,contract_gaps:[]}));
const server=await createServer({configFile:false,root:process.cwd()+'/frontend',server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true},appType:'custom'});
try{
 const {createConnectedServices}=await server.ssrLoadModule('/workbench/historical-connected-service.ts');
 const {services}=createConnectedServices([...entries,...extra],old,oldLock,{...index,rows:entries.length+extra.length,batches:[...index.batches,{id:'D008',rows:extra.length,conforming:extra.length}]},{catalog:demo,lock});
 const types=[...new Set(demo.records.map(r=>r.dataset_type)),'T01'];
 const results=[];
 for(const country of ['KR','JP','US','ALL'])for(const month of ['2026-08','ALL'])for(const type of types){
  const m=services.D008.query(type,country,month,{observed:'ALL',group:'ALL'});
  if(type==='T01'&&(month==='ALL'||country==='ALL'))continue;
  assert.equal(m.status,'ready',type+'/'+country+'/'+month);
  assert(m.charts.length||type==='T01',type+' missing dashboard');
  assert(!JSON.stringify(m).includes('NaN'),type+' non-finite result');
  results.push({type,country,month,rows:m.rows.length,charts:m.charts.map(c=>({title:c.title,kind:c.kind,points:c.data.length}))});
 }
 const counts={KR:560,JP:730,US:1120},distributions=[];
 for(const c of Object.keys(counts)){
  const reviews=services.D008.query('T24',c,'ALL');assert.equal(reviews.metrics[0].value,counts[c]);
  const expected=demo.records.filter(r=>r.dataset_type==='T24'&&r.scope_id===`D008-${c}-sample`);
  assert.equal(reviews.charts[0].data.reduce((n,r)=>n+r.values.count,0),counts[c]);
  assert(new Set(reviews.charts[0].data.map(r=>r.values.count)).size>=5);
  const mean=expected.reduce((n,r)=>n+r.rating_value,0)/expected.length;assert(Math.abs(reviews.metrics[1].value-mean)<1e-12);
  const ads=services.D008.query('T10',c,'ALL');const byFormat=ads.charts[1];assert.equal(byFormat.kind,'donut');assert.equal(byFormat.data.reduce((n,r)=>n+r.values.v,0),ads.source.length);assert(new Set(byFormat.data.map(r=>r.values.v)).size>1);
  const tickets=services.D008.query('T26',c,'ALL');const statuses=tickets.charts.find(c=>c.title==='문의 처리 상태');assert.deepEqual(statuses.data.map(r=>r.id),['open','resolved']);
  const events=services.D008.query('T18',c,'ALL');assert.equal(events.charts[0].kind,'stages');assert.deepEqual(events.charts[0].data.map(r=>r.id),['view_item','add_to_cart','begin_checkout','purchase']);
  for(const row of events.charts[0].data)assert.equal(row.values.quantity,events.source.filter(r=>r.event_name===row.id).reduce((n,r)=>n+r.quantity,0));
  const incidents=services.D008.query('T37',c,'ALL');assert(incidents.charts.some(c=>c.kind==='calendar'));assert(!incidents.charts.some(c=>c.kind==='bar'));
  const price=services.D008.query('T08',c,'ALL',{observed:'ALL',group:'ALL'});assert.deepEqual(price.charts.map(c=>c.kind),['line','range']);
  const stock=services.D008.query('T22',c,'ALL',{observed:'ALL',group:'ALL'});assert.deepEqual(stock.charts.map(c=>c.kind),['line','calendar']);
  const all=services.ALL.query('T26',c,'ALL');assert(!JSON.stringify(all.charts).includes('배치별'));assert(all.source.every(r=>r.record_id.startsWith('D008-')));
  distributions.push({country:c,reviews:counts[c],mean,tickets:tickets.source.length,ads:ads.source.length,formats:byFormat.data.map(r=>({format:r.id,count:r.values.v}))});
 }
 let rawTotal=0;for(const t of types)rawTotal+=services.ALL.query(t,'ALL','ALL',{detailOnly:true}).rows.length;assert.equal(rawTotal,index.rows+demo.records.length);
 for(const batch of ['D003B-source','D005','D006-CQ-A','D006-CQ-B'])for(const t of types){const m=services[batch].query(t,'ALL','ALL');assert(!JSON.stringify(m).includes('NaN'),batch+'/'+t+' must preserve unavailable values');}
 const currency={KR:'KRW',JP:'JPY',US:'USD'};for(const r of demo.records){const c=r.scope_id.split('-')[1];const walk=v=>{if(!v||typeof v!=='object')return;if(v.amount!==undefined&&v.currency)assert.equal(v.currency,currency[c],r.record_id+' money currency');for(const n of Object.values(v))walk(n);};walk(r);}
 const cents=value=>BigInt(Math.round(Number(value.amount)*100));
 for(const r of demo.records.filter(r=>r.dataset_type==='T19'))assert.equal(cents(r.line_gross_total),cents(r.unit_price)*BigInt(r.quantity)-cents(r.line_discount)+cents(r.line_tax),r.record_id+' line arithmetic');
 const byId=new Map(demo.records.map(r=>[r.record_id,r]));
 for(const r of demo.records.filter(r=>r.dataset_type==='T30')){const parents=r.related_record_ids.map(id=>byId.get(id));assert(parents.every(Boolean));const gross=parents.filter(p=>p.dataset_type==='T19').reduce((n,r)=>n+cents(r.line_gross_total),0n),refunds=parents.filter(p=>p.dataset_type==='T20'&&p.status==='completed'&&p.refund_amount).reduce((n,r)=>n+cents(r.refund_amount),0n);assert.equal(cents(r.net_revenue),gross-refunds,r.record_id+' cohort reconciliation');}
 const report={pass:true,demoRows:demo.records.length,allVersionRows:rawTotal,cases:results.length,distributions,results,checks:['old D007 hash unchanged','country/product sample counts differ','review and text annotation source spans validated by generator','fixed status ordering in all countries','stage counts reconcile with item quantities','price line/range and stock line/calendar','incident calendar has no inferred uptime','ALL shows latest compatible business categories, original rows remain reachable','currency follows country']};
 fs.writeFileSync(process.env.WORKBENCH_CHECK_OUTPUT||'docs/design/marketing-redesign-20261019/query-checks.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:true,cases:results.length,distributions,allVersionRows:rawTotal}));
}finally{await server.close();}
