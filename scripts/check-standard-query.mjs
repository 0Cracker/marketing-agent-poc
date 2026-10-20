import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
const base='frontend/public/workbench-data/D007/';
const bytes=fs.readFileSync(base+'catalog.json'),lock=JSON.parse(fs.readFileSync(base+'lock.json'));
assert.equal(createHash('sha256').update(bytes).digest('hex'),lock.sha256);
const catalog=JSON.parse(bytes);
const server=await createServer({configFile:false,root:process.cwd()+'/frontend',server:{middlewareMode:true},optimizeDeps:{noDiscovery:true},appType:'custom'});
try{
 const {createStandardQuery}=await server.ssrLoadModule('/workbench/standard-query.ts');
 const {csv}=await server.ssrLoadModule('/workbench/presentation.ts');
 const before=createHash('sha256').update(JSON.stringify(catalog)).digest('hex');
 const service=createStandardQuery(catalog,lock),{typeMap}=await server.ssrLoadModule('/workbench/adapter.ts');
 const results=[];
 const get=(type,country)=>catalog.records.filter(r=>r.dataset_type===type&&r.scope_id===`D007-${country}-sample`);
 for(const country of ['JP','KR','US']){
  for(const type of [...typeMap.types.map(t=>t.id),'H01']){
   const model=service.query(type,country,'2026-08');
   assert.equal(model.status,'ready',`${type} ${country}`);
   assert(model.columns.length>1,`${type} has no mapped fields`);
   assert(model.rows.length>0);
   assert(model.source.every(r=>type==='T01'||r.scope_id===`D007-${country}-sample`),'Scope leak');
   assert(!JSON.stringify(model).includes('NaN'));
   results.push({country,type,rows:model.rows.length,columns:model.columns.length,charts:model.charts.length});
  }
  const market=service.query('T03',country,'2026-08'),ms=get('T03',country).filter(r=>r.period.start==='2026-08-01');
  assert.equal(market.metrics[0].value,Number(ms[0].market_total_value.amount));
  assert.equal(market.metrics[2].value,ms.filter(r=>r.subject_ref.startsWith('P1')).reduce((n,r)=>n+Number(r.sales_value.amount),0));
  assert(Math.abs(market.rows.filter(r=>!r.child).reduce((n,r)=>n+r.values.share,0)-100)<1e-10);
  const review=service.query('T24',country,'2026-08');assert.equal(review.rows.length,600);assert.equal(review.charts[0].data.length,6);
  for(const product of review.charts[0].data){assert.equal(product.values.count,100);assert.equal([1,2,3,4,5].reduce((n,s)=>n+product.values['star'+s],0),100);}
  assert.equal(review.charts[1].data.reduce((n,r)=>n+r.values.count,0),200);
  const ad=service.query('T13',country,'2026-08');const monthly=get('T13',country).filter(r=>r.period.grain==='month'&&r.period.start==='2026-08-01');
  assert.equal(ad.metrics[0].value,monthly.reduce((n,r)=>n+Number(r.metrics.spend?.amount||0),0));
  for(const row of ad.rows.filter(r=>!r.child)){
   const v=row.values;assert.equal(v.ctr,v.clicks/v.impressions*100);assert.equal(v.cvr,v.conversions/v.clicks*100);assert.equal(v.roas,v.revenue/v.spend);
   assert(!String(v.name).startsWith('D007-Campaign-'),'Campaign identity must have a display label');
  }
  const price=service.query('T08',country,'2026-08',{observed:'2026-08-10',group:'A'});assert.equal(price.rows.length,9);assert.equal(new Set(price.source.map(r=>r.seller_ref)).size,3);
  const experiments=service.query('T38',country,'2026-08');assert(experiments.charts.length>0);assert.equal(new Set(experiments.charts[0].data.flatMap(r=>r.source.map(s=>s.experiment_id))).size,1,'Independent experiments must remain separate');
  const indexes=service.query('T05',country,'2026-08');assert(indexes.charts.length>0);assert.equal(new Set(indexes.charts[0].data.flatMap(r=>r.source.map(s=>s.normalization_scope))).size,1,'Independent normalization scopes must remain separate');
  const sentiment=service.query('T25',country,'2026-08');assert.equal(sentiment.charts.find(c=>c.title==='문장에 표시된 의견 방향').data.reduce((n,r)=>n+r.values.v,0),sentiment.rows.length);
  assert(sentiment.rows.every(r=>!String(r.values.evidence_span).startsWith('{')),'Quotes are displayed as text, positions remain in evidence');
  const matched=sentiment.rows.filter(r=>Object.values(r.values).some(v=>String(v??'').includes('가격')));
  const exported=csv(sentiment,matched);assert.equal(exported.split('\r\n').length,matched.length+1);assert(exported.includes('D007-T24-'));
  assert.equal(service.query('T24',country,'2026-08',{asOf:'2026-10-16T00:00:00Z'}).status,'empty');
  assert.equal(service.query('T24',country,'2026-07').status,'empty');
 }
 assert.throws(()=>service.query('T24','JP','2026-08',{asOf:'invalid'}));
 assert.equal(createHash('sha256').update(JSON.stringify(catalog)).digest('hex'),before,'Query mutated canonical input');
 const sales=service.query('H01','JP','2026-08');assert.equal(sales.metrics[0].value-sales.metrics[1].value,sales.metrics[2].value);
 const report={pass:true,selectedBatch:'D007',sourceRows:catalog.records.length,cases:results.length,results,checks:['pinned hash','3 countries / all 40 types + H01','canonical evidence retained','market denominator once / brand shares 100','600 reviews per country / 100 per product / own 200','monthly advertising isolated from daily','price sellers remain distinct','search normalization scopes and experiment arms never averaged','annotations counted separately from reviews','as-of excludes future / empty month / invalid time rejected','sales reconciliation']};
 fs.writeFileSync(process.env.WORKBENCH_CHECK_OUTPUT||'docs/design/data-separation-validation/standard-query-checks.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({pass:true,cases:results.length,rows:catalog.records.length}));
}finally{await server.close();}
