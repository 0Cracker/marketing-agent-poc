import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
const base='docs/research/marketing-ontology/batches/D003B/';
const manifest=JSON.parse(fs.readFileSync(base+'manifest.json','utf8'));
const preservation=[];
for(const [name,info] of Object.entries(manifest.files)){
 const bytes=fs.readFileSync(base+'source/'+name),text=bytes.toString('utf8');
 const hash=createHash('sha256').update(text.replaceAll('\r\n','\n')).digest('hex');
 assert.equal(hash,info.sha256,name);assert.equal(text.trim().split('\n').length,info.records,name);
 preservation.push({file:name,records:info.records,raw_sha256:createHash('sha256').update(bytes).digest('hex'),lf_sha256:hash});
}
const server=await createServer({configFile:false,root:process.cwd()+'/frontend',server:{middlewareMode:true},optimizeDeps:{noDiscovery:true},appType:'custom'});
try{
 const {source,buildModel,typeMap,sortRows,ratio,csv}=await server.ssrLoadModule('/workbench/adapter.ts');
 assert.equal(Object.values(source).reduce((n,r)=>n+r.length,0),1652);assert.equal(source.T24.length,72);assert.equal(typeMap.types.length,40);assert.equal(typeMap.types.filter(t=>t.availability==='D003B').length,10);
 const cases=[];
 for(const country of ['JP','KR','US'])for(const month of ['2025-08','2026-07','2026-08','2026-09']){
  const market=buildModel('T03',country,month),records=source.T03.filter(r=>r.country_code===country&&r.period_start.startsWith(month));
  if(!records.length)continue;
  const denom=Number(records[0].market_total_value),own=records.filter(r=>r.product_id.startsWith('P1'));
  const totalCents=own.reduce((n,r)=>n+BigInt(r.sales_value.replace('.','')),0n);
  assert.equal(market.metrics[0].value,denom);assert.equal(market.metrics[2].value,Number(totalCents)/100);
  assert.equal(market.metrics[1].value,Number(totalCents)/100/denom*100);
  const groups=market.rows.filter(r=>!r.child);assert(Math.abs(groups.reduce((n,r)=>n+r.values.share,0)-100)<1e-10);
  const filtered=buildModel('T03',country,month,{product:records[0].product_id});assert.equal(filtered.metrics[0].value,denom);
  const sales=buildModel('H01',country,month);assert.equal(sales.metrics[0].value-sales.metrics[1].value,sales.metrics[2].value);
  const ad=buildModel('T13',country,month);for(const row of ad.rows.filter(r=>!r.child)){
   const v=row.values;assert.equal(v.ctr,v.clicks/v.impressions*100);assert.equal(v.cvr,v.conversions/v.clicks*100);assert.equal(v.cpc,v.spend/v.clicks);assert.equal(v.cpm,v.spend/v.impressions*1000);assert.equal(v.cpa,v.spend/v.conversions);assert.equal(v.roas,v.revenue/v.spend);
  }
  assert.equal(ad.metrics.length,4);assert(!ad.metrics.some(m=>m.label==='ROAS'));
  cases.push({country,month,currency:market.currency,market:market.metrics.map(m=>({label:m.label,value:m.value})),sales:sales.metrics.map(m=>({label:m.label,value:m.value})),ad:ad.rows.filter(r=>!r.child).map(r=>r.values)});
 }
 const daily=buildModel('T13','JP','2026-08',{grain:'day',media:'C-JP-social'});
 const line=daily.charts[0].data;assert.equal(line.length,28);
 for(const date of ['2026-08-26','2026-08-27']){const r=line.find(r=>r.values.date===date);for(const k of ['spend','ctr','cvr','roas'])assert.equal(r.values[k],null,date+' '+k);}
 assert.equal(line.filter(r=>r.values.spend!==null).length,26);
 const quality=buildModel('T36','JP','2026-08'),social=quality.rows.find(r=>r.source[0].campaign_id==='C-JP-social');assert.equal(social.values.expected,28);assert.equal(social.values.received,26);assert.equal(social.values.rate,26/28*100);
 assert.equal(quality.charts[0].data.filter(r=>r.values.status==='누락').length,2);
 assert.equal(buildModel('T08','JP','2026-07').status,'empty');assert.equal(buildModel('T22','JP','2026-09').status,'empty');assert.equal(buildModel('T24','JP','2026-07').reason,'선택 기간에 수집된 리뷰 표본이 없습니다');
 assert.equal(buildModel('T24','JP','2026-08').rows.length,24);const price=buildModel('T08','JP','2026-08');assert(price.rows.filter(r=>r.source[0].availability==='unknown').every(r=>r.values.status==='미확인'));assert.equal(price.charts[0].events[0].start,'2026-08-10');assert.equal(price.charts[0].events[0].end,'2026-08-24');
 for(const t of typeMap.types){const model=buildModel(t.id,'JP','2026-08');assert.equal(model.status==='ungenerated',t.availability==='미생성',t.id);assert(t.columns.length>0&&t.chart&&t.defaultSort&&t.fields);}
 assert.equal(ratio(1,0),null);
 const actualRows=buildModel('T01','JP','2026-08').rows;const withNull=actualRows.map((r,i)=>({...r,values:{...r.values,sort:i===0?null:i===1?null:i}}));for(const dir of ['asc','desc'])assert(sortRows(withNull,'sort',dir).slice(-2).every(r=>r.values.sort===null));
 assert.equal(csv(buildModel('T24','JP','2026-08'),buildModel('T24','JP','2026-08').rows).split('\r\n').length,25);
 const report={at:new Date().toISOString(),head:'e52cef6bfe54eb6f2a91a5378edda0fb9b686b90 + uncommitted workbench',pass:true,total:1652,preservation,cases,japan_social:{expected:28,received:26,missing:['2026-08-26','2026-08-27'],rate:26/28*100},checks:['40 types / 10 available + H01 / 30 ungenerated','market denominator once and invariant under product filter','other market retained / brand shares sum 100','3 countries / currency separation','H01 gross - returns = net','6 advertising formula checks per medium','monthly and daily isolated','null daily points on Aug 26/27','26 received rows vs 28 state rows','72 review samples / 24 Japan','price/inventory non-August empty','review missing-month message','null-last sort asc/desc / stable ID ties','CSV all matching rows']};
 fs.writeFileSync('docs/design/workbench-validation/numeric-checks.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:true,files:11,total:1652,types:40,cases:cases.length,japan_social:report.japan_social}));
}finally{await server.close();}
