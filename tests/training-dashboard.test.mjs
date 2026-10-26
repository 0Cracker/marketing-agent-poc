import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {trainingIndex, trainingScreenData} from '../scripts/training-data.mjs';
import {trainingCaseIds, trainingViews, summarize, selectFacts, selectBreakdowns, selectRecords, comparePeriods, trendRows, metricValue, metricPeriodSeries, metricMissingReason, trainingMediaOptions, changeTrainingMedia, campaignDisplayName, displayTrainingText} from '../shared/training-dashboard.mjs';
import {currentDataPlugin, loadCurrentData, publicFiles, sha256} from '../scripts/current-data.mjs';
import {buildTrainingData} from '../scripts/generate-training-dashboard.mjs';

const ids=Array.from({length:15},(_,i)=>`S${String(i+1).padStart(2,'0')}`);
const allIds=Array.from({length:18},(_,i)=>`S${String(i+1).padStart(2,'0')}`);
const screens=new Map(allIds.map(id=>[id,trainingScreenData(undefined,id,'initial')]));
const sum=(rows,key)=>rows.reduce((total,row)=>total+(row[key]??0),0);
const current=pack=>pack.facts.filter(row=>row.periodId==='current');
const baseline=pack=>pack.facts.filter(row=>row.periodId==='baseline');
const totals=rows=>Object.fromEntries(['impressions','clicks','spend','orders','revenue','ledgerOrders','ledgerRevenue','purchases','returnPurchases','paymentFailures'].map(key=>[key,sum(rows,key)]));
const near=(actual,expected,label)=>assert(Math.abs(actual-expected)<1e-8,`${label}: ${actual} != ${expected}`);

test('media choices contain real channel/source pairs and discard incompatible campaign selections',()=>{
 for(const pack of screens.values()){
  const options=trainingMediaOptions(pack);
  assert(!options.some(o=>o.channel==='social'&&o.source==='naver_blog'));
  assert(options.some(o=>o.channel==='social'&&o.source==='instagram'),'Instagram feed ads remain social');
  assert(options.some(o=>o.channel==='content'&&o.source==='instagram'),'Instagram collaborations remain content');
  assert.deepEqual(options.filter(o=>o.channel==='search').map(o=>o.source),['google']);
  for(const option of options)for(const campaign of pack.campaigns){
   const next=changeTrainingMedia(pack,{channel:'all',source:'all',campaignId:campaign.id,device:'mobile'},option.key);
   const compatible=(option.channel==='all'||campaign.channel===option.channel)&&(option.source==='all'||campaign.source===option.source);
   assert.equal(next.campaignId,compatible?campaign.id:'all');assert.equal(next.device,'mobile');
   assert(selectFacts(pack,next).length>0,'valid choices never create an impossible empty intersection');
  }
  assert.throws(()=>changeTrainingMedia(pack,{channel:'all',source:'all',campaignId:'all',device:'all'},'social|naver_blog'));
 }
});

test('campaign and audience labels are realistic presentation aliases while source references remain intact',()=>{
 const pack=screens.get('S16');
 assert.equal(campaignDisplayName(pack,'EDU-C2'),'8월_구글검색_구매전환_02');
 assert.equal(displayTrainingText('EDU-C2-v1'),'GGL-SA-202608-002-v1');
 assert.equal(displayTrainingText('core, PC 피드'),'기존 타깃, PC 피드');
 assert.equal(displayTrainingText('extended'),'확장 타깃');
 assert.equal(displayTrainingText('score'),'score');
 assert(pack.campaigns.some(c=>c.id==='EDU-C2'),'canonical references preserved');
});

test('unavailable metrics distinguish incompatible exposure, zero denominator and missing customer counts',()=>{
 const pack=screens.get('S16'),ads=pack.facts.filter(r=>r.exposureBasis==='ad_impression'),content=pack.facts.filter(r=>r.exposureBasis==='content_view');
 for(const key of ['adCtr','adCpm']){assert.equal(metricValue(summarize(content),key),null);assert.equal(metricMissingReason(content,key).label,'해당 없음');}
 for(const key of ['contentClickRate','contentCpm']){assert.equal(metricValue(summarize(ads),key),null);assert.equal(metricMissingReason(ads,key).label,'해당 없음');}
 const unavailableSku=screens.get('S11').products[1].id;
 const noPurchases=screens.get('S11').breakdowns.filter(r=>r.dimension==='product'&&r.key===unavailableSku&&r.periodId==='current');
 assert.equal(metricValue(summarize(noPurchases),'aov'),null);
 assert.deepEqual(metricMissingReason(noPurchases,'aov'),{label:'계산 불가',reason:'구매 주문 수가 0이어서 비율이나 평균을 계산할 수 없습니다.'});
 assert.equal(metricMissingReason(ads,'cac').label,'미집계');
 assert.equal(metricMissingReason([],'aov').label,'데이터 없음');
});

test('metric trends align weekdays, retain dates and use the selected population and proper denominator',()=>{
 const pack=screens.get('S16'),filters={channel:'all',campaignId:'all',device:'mobile'};
 for(const metric of ['roas','adCtr','cpc','cvr','cpa','aov']){
  const series=metricPeriodSeries(pack,filters,metric);assert.equal(series.length,14);
  for(const point of series){
   assert.equal((Date.parse(point.currentDate)-Date.parse(point.baselineDate))/86400000,14);
   for(const period of ['baseline','current']){
    const date=point[period+'Date'];const rows=pack.facts.filter(r=>r.device==='mobile'&&r.date===date);
    const value=point[period];const raw=summarize(rows);
    const expected=metric==='adCtr'?sum(rows.filter(r=>r.exposureBasis==='ad_impression'),'clicks')/sum(rows.filter(r=>r.exposureBasis==='ad_impression'),'impressions'):metric==='roas'?raw.revenue/raw.spend:metric==='cpc'?raw.spend/raw.clicks:metric==='cvr'?raw.orders/raw.clicks:metric==='cpa'?raw.spend/raw.orders:raw.revenue/raw.orders;
    near(value,expected,metric+' '+date);
   }
  }
 }
 const content=metricPeriodSeries(pack,{...filters,channel:'content'},'adCtr');assert(content.every(r=>r.baseline===null&&r.current===null),'content views are never ad CTR');
 assert(metricPeriodSeries(pack,filters,'cac').every(r=>r.baseline===null&&r.current===null),'CAC is unknown, not CPA or zero');
 assert.equal(metricValue(summarize([]),'cac'),null);
});

test('all eighteen cases expose the same dashboard contract and complete common data',()=>{
 assert.deepEqual(trainingCaseIds,allIds);assert.deepEqual(trainingViews,[['overview','성과 추이'],['data','상세 데이터']]);
 const reference=screens.get('S01');
 const categories=pack=>[...new Set(pack.records.map(row=>row.category))].sort();
 const dimensions=pack=>[...new Set(pack.breakdowns.map(row=>row.dimension))].sort();
 for(const [id,pack] of screens){
  assert.equal(pack.caseId,id);assert.equal(pack.contract,'roas-training/1');
  assert.deepEqual(Object.keys(pack).sort(),Object.keys(reference).sort(),id);
  assert.equal(pack.campaigns.length,6);assert.equal(pack.products.length,3);
  assert.equal(new Set(pack.facts.map(row=>row.date)).size,28);
  assert.equal(pack.facts.length,28*6*2);
  assert.equal(new Set(pack.facts.map(row=>row.id)).size,pack.facts.length);
  assert.deepEqual(dimensions(pack),dimensions(reference),id+' dimensions');
  assert.deepEqual(categories(pack),categories(reference),id+' records');
  assert(pack.reach.length>0);assert(pack.records.length>0);
  for(const row of pack.reach){const campaign=pack.campaigns.find(c=>c.id===row.campaignId);if(campaign.exposureBasis==='ad_impression')assert(row.reach>0);else assert.equal(row.reach,null,'unmeasured content reach is not invented');}
  for(const key of ['answer','groundTruth','ground_truth_cause','expectedAction','expectedConclusion']) assert(!(key in pack),key);
  if(ids.includes(id))for(const key of ['impressions','clicks','spend','orders','revenue','ledgerOrders','ledgerRevenue'])assert.equal(sum(baseline(pack),key),sum(baseline(reference),key),id+' common baseline '+key);
 }
});

test('raw aggregate totals and displayed metrics agree without averaging ratios',()=>{
 for(const [id,pack] of screens) for(const periodId of ['baseline','current']){
  const rows=pack.facts.filter(row=>row.periodId===periodId),total=summarize(rows),s=totals(rows);
  for(const key of ['impressions','clicks','spend','orders','revenue']) assert.equal(total[key],s[key],id+' '+key);
  near(total.roas,s.revenue/s.spend,id+' roas');
  near(total.cpc,s.spend/s.clicks,id+' cpc');
  near(total.cvr,s.orders/s.clicks,id+' cvr');
  near(total.aov,s.revenue/s.orders,id+' aov');
  near(total.cpa,s.spend/s.orders,id+' cpa');
  near(total.cvr*total.aov/total.cpc,total.roas,id+' identity');
  if(periodId==='baseline'){
   const daily=[...new Set(rows.map(row=>row.date))].map(date=>sum(rows.filter(row=>row.date===date),'orders'));
   assert(daily.every(value=>value>0),id+' ordinary baseline does not create synchronized empty sales days');
   assert(Math.max(...daily)<=2*total.orders/daily.length,id+' baseline daily purchases are not synchronized across campaigns');
  }
  for(const row of rows){
   for(const [key,value] of Object.entries(row)) if(typeof value==='number') assert(Number.isFinite(value)&&value>=0,id+' '+key);
   assert(row.sessions>=row.view&&row.view>=row.cart&&row.cart>=row.checkout&&row.checkout>=row.purchases,id+' funnel '+row.id);
   assert.equal(row.orders,row.purchases+row.returnPurchases,id+' return purchase');
   assert.equal(row.revenue,row.listRevenue-row.discount,id+' revenue bridge');
   assert(row.paymentAttempts>=row.paymentFailures,id+' payment');
  }
 }
});

test('each breakdown reconciles to its own parent without cross-joining dimensions',()=>{
 const keys=['impressions','clicks','spend','sessions','view','cart','checkout','purchases','returnPurchases','orders','units','listRevenue','discount','revenue','ledgerOrders','ledgerRevenue','paymentAttempts','paymentFailures','trackingExpected','trackingReceived'];
 for(const [id,pack] of screens){
  for(const dimension of new Set(pack.breakdowns.map(row=>row.dimension))){
   const groups=new Map();
   for(const row of pack.breakdowns.filter(row=>row.dimension===dimension)){
    const key=[row.date,row.campaignId,row.device].join('|');
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);
   }
   for(const parent of pack.facts){
    const rows=groups.get([parent.date,parent.campaignId,parent.device].join('|'));
    assert(rows?.length,id+' '+dimension+' missing '+parent.id);
    for(const key of keys) assert.equal(sum(rows,key),parent[key],id+' '+dimension+' '+key+' '+parent.id);
   }
  }
 }
});

test('campaign, channel and device filters keep every view on the same population',()=>{
 for(const pack of screens.values())for(const source of ['google','facebook','instagram','naver_blog']){
  const wanted=new Set(pack.campaigns.filter(c=>c.source===source).map(c=>c.id));
  const filters={source};
  assert.deepEqual(selectFacts(pack,filters),pack.facts.filter(row=>wanted.has(row.campaignId)));
  assert(selectBreakdowns(pack,filters).every(row=>wanted.has(row.campaignId)));
  assert(selectRecords(pack,filters).every(row=>!row.campaignId||wanted.has(row.campaignId)));
 }
 for(const [id,pack] of screens)for(const campaign of pack.campaigns)for(const device of ['mobile','desktop']){
  const filters={channel:campaign.channel,campaignId:campaign.id,device};
  const expected=pack.facts.filter(row=>row.campaignId===campaign.id&&row.device===device);
  assert(expected.length>0,id+' known device grain');assert.deepEqual(selectFacts(pack,filters),expected);
  const periods=comparePeriods(pack,filters);
  assert.equal(periods.length,2);
  for(const result of periods)assert.deepEqual(result.total,summarize(expected.filter(row=>row.periodId===result.period.id)));
  assert.equal(trendRows(pack,filters).length,28);
  for(const dimension of new Set(pack.breakdowns.map(row=>row.dimension))){
   const rows=selectBreakdowns(pack,filters,dimension);
   assert(rows.length>0,id+' filtered breakdown');
   assert(rows.every(row=>row.campaignId===campaign.id&&row.device===device&&row.dimension===dimension));
  }
  assert(selectRecords(pack,filters).every(row=>(!row.campaignId||row.campaignId===campaign.id)&&(!row.device||row.device==='all'||row.device===device)));
 }
});

test('fifteen scenarios preserve the specified numerical changes',()=>{
 const expected={S01:[1800000,120,40000],S02:[1200000,72,40000],S03:[1200000,120,28000],S04:[1200000,168,40000],S05:[1200000,72,40000],S06:[600000,84,40000],S07:[1200000,90,40000],S08:[2400000,180,40000],S09:[1200000,80,40000],S10:[2400000,144,40000],S11:[1200000,72,40000],S12:[1200000,84,50000],S13:[1200000,72,40000],S14:[1200000,72,40000],S15:[1200000,72,40000]};
 for(const [id,[spend,orders,aov]] of Object.entries(expected)){
  const b=totals(baseline(screens.get(id))),c=totals(current(screens.get(id)));
  assert.equal(b.spend,1200000,id);assert.equal(b.orders,120,id);assert.equal(b.revenue,4800000,id);
  assert.equal(c.spend,spend,id);assert.equal(c.orders,orders,id);assert.equal(c.revenue,orders*aov,id);
 }
 assert.equal(sum(current(screens.get('S05')),'clicks'),4800);
 assert.equal(sum(current(screens.get('S09')),'clicks'),1600);
 assert.equal(sum(current(screens.get('S10')),'clicks'),4800);
 const mix=screens.get('S07');for(const campaign of mix.campaigns){
  const b=summarize(baseline(mix).filter(row=>row.campaignId===campaign.id)),c=summarize(current(mix).filter(row=>row.campaignId===campaign.id));
  near(c.roas,b.roas,campaign.id+' stable campaign ROAS');
 }
 assert(sum(current(screens.get('S13')),'paymentFailures')>sum(baseline(screens.get('S13')),'paymentFailures'));
 const tracking=totals(current(screens.get('S14')));assert.equal(tracking.ledgerOrders,120);assert.equal(tracking.ledgerRevenue,4800000);assert.equal(tracking.orders,72);
});

test('mature snapshot reveals delayed purchases only when the reporting cutoff permits it',()=>{
 for(const id of allIds){
  const initial=screens.get(id),mature=trainingScreenData(undefined,id,'mature');
  if(id==='S15'){
   assert.equal(sum(current(initial),'orders'),72);assert.equal(sum(current(mature),'orders'),120);
   assert.equal(sum(current(initial),'returnPurchases'),0);assert.equal(sum(current(mature),'returnPurchases'),48);
   assert.equal(sum(current(initial),'ledgerOrders'),72);
  }else assert.deepEqual(mature.facts,initial.facts,id+' unexpected future revision');
 }
});

test('scenario evidence supports the intended investigation rather than only headline numbers',()=>{
 const periodTotal=(id,period,filter=()=>true)=>summarize(screens.get(id).facts.filter(row=>row.periodId===period&&filter(row)));
 const before=periodTotal('S01','baseline'),cost=periodTotal('S01','current');
 near(cost.ctr,before.ctr,'S01 CTR stable');assert(cost.cpm>before.cpm);
 const mobile=row=>row.device==='mobile',desktop=row=>row.device==='desktop';
 const bMobile=periodTotal('S02','baseline',mobile),cMobile=periodTotal('S02','current',mobile);
 assert(cMobile.cart/cMobile.view<bMobile.cart/bMobile.view,'S02 mobile product-to-cart decline');
 near(periodTotal('S02','baseline',desktop).cvr,periodTotal('S02','current',desktop).cvr,'S02 desktop stable');
 const creativeBefore=periodTotal('S09','baseline'),creativeAfter=periodTotal('S09','current');
 near(creativeAfter.cpm,creativeBefore.cpm,'S09 CPM stable');assert(creativeAfter.ctr<creativeBefore.ctr);
 const traffic=screens.get('S10').breakdowns.filter(row=>row.dimension==='traffic'&&row.periodId==='current');
 const core=summarize(traffic.filter(row=>row.audienceId==='core')),extended=summarize(traffic.filter(row=>row.audienceId==='extended'));
 assert(extended.cvr<core.cvr,'S10 inefficient extension identifiable');
 near(core.cvr,.05,'S10 core purchase rate stable');near(extended.cvr,.01,'S10 extended purchase rate decline');
 const stock=screens.get('S11'),soldOut=stock.products[1].id;
 const stockRows=stock.breakdowns.filter(row=>row.dimension==='product'&&row.key===soldOut&&row.periodId==='current');
 assert.equal(sum(stockRows,'orders'),0,'S11 out of stock orders');assert(sum(stockRows,'clicks')>0,'S11 out of stock paid traffic remains');assert(sum(stockRows,'view')>0,'S11 out of stock product views remain');assert.equal(sum(stockRows,'paymentAttempts'),0,'S11 unavailable product has no payment attempts');
 const paymentBefore=periodTotal('S13','baseline',mobile),paymentAfter=periodTotal('S13','current',mobile);
 assert.equal(paymentAfter.checkout,paymentBefore.checkout,'S13 checkout initiation stable');assert(paymentAfter.purchases/paymentAfter.checkout<paymentBefore.purchases/paymentBefore.checkout);
 for(const id of ['S01','S02','S03','S04','S05','S06','S07','S08','S09','S10','S11','S12','S13']){
  const total=periodTotal(id,'current');assert.equal(total.orders,total.ledgerOrders,id+' no tracking discrepancy');assert.equal(total.revenue,total.ledgerRevenue,id+' no revenue discrepancy');
  for(const dimension of new Set(screens.get(id).breakdowns.map(row=>row.dimension))){
   for(const key of new Set(screens.get(id).breakdowns.filter(row=>row.dimension===dimension).map(row=>row.key))){
    const detailed=summarize(screens.get(id).breakdowns.filter(row=>row.dimension===dimension&&row.key===key&&row.periodId==='current'));
    assert.equal(detailed.orders,detailed.ledgerOrders,id+' '+dimension+' '+key+' no false tracking discrepancy');assert.equal(detailed.revenue,detailed.ledgerRevenue,id+' '+dimension+' '+key+' no false revenue discrepancy');
   }
  }
 }
});

test('mixed scenarios preserve normal measurement and realistic varied daily performance',()=>{
 for(const id of ['S16','S17','S18']){
  const pack=screens.get(id);
  assert(sum(baseline(pack),'orders')>500,id+' enough baseline purchases');
  for(const row of [...pack.facts,...pack.breakdowns]){
   assert.equal(row.ledgerOrders,row.orders,id+' tracked order agreement');
   assert.equal(row.ledgerRevenue,row.revenue,id+' tracked revenue agreement');
   assert.equal(row.trackingExpected,row.trackingReceived,id+' healthy collection');
   assert.equal(row.paymentAttempts,row.ledgerOrders+row.paymentFailures,id+' payment bridge');
   if(!row.checkout)assert.equal(row.paymentAttempts,0,id+' no impossible checkout attempts');
  }
  const daily=trendRows(pack,{}).filter(row=>row.date>='2026-08-17');
  for(const metric of ['cpc','ctr','cvr','aov'])assert(new Set(daily.map(row=>Number(row[metric]?.toFixed(5)))).size>3,id+' varied '+metric);
 }
});

test('S16 combines budget growth, a bounded mobile payment incident and offsetting creative improvement',()=>{
 const pack=screens.get('S16'),b=summarize(baseline(pack)),c=summarize(current(pack));
 assert(c.spend>b.spend,'S16 more spend');
 const incident=current(pack).filter(row=>row.device==='mobile'&&row.date>='2026-08-21'&&row.date<='2026-08-24');
 const outside=current(pack).filter(row=>row.device==='mobile'&&(row.date<'2026-08-21'||row.date>'2026-08-24'));
 assert(summarize(incident).paymentFailureRate>summarize(outside).paymentFailureRate,'S16 localized payment problem');
 const campaign=pack.campaigns[2].id;
 const before=summarize(current(pack).filter(row=>row.campaignId===campaign&&row.date<'2026-08-24'));
 const after=summarize(current(pack).filter(row=>row.campaignId===campaign&&row.date>='2026-08-24'));
 assert(after.ctr>before.ctr,'S16 improved creative response after change');
 assert(pack.records.some(row=>row.category==='incident'),'S16 investigation record');
});

test('S17 combines lower spending, a price-condition change and a later intent improvement',()=>{
 const pack=screens.get('S17'),b=summarize(baseline(pack)),c=summarize(current(pack));
 assert(c.spend<b.spend,'S17 budget reduction');assert(c.revenue<b.revenue,'S17 smaller revenue');assert(c.roas>b.roas,'S17 higher efficiency');
 const early=current(pack).filter(row=>row.date<'2026-08-21'),later=current(pack).filter(row=>row.date>='2026-08-21');
 assert(sum(later,'discount')/sum(later,'listRevenue')<sum(early,'discount')/sum(early,'listRevenue'),'S17 discount ended');
 const campaign=pack.campaigns[0].id;
 const before=summarize(current(pack).filter(row=>row.campaignId===campaign&&row.date<'2026-08-24'));
 const after=summarize(current(pack).filter(row=>row.campaignId===campaign&&row.date>='2026-08-24'));
 assert(after.cvr>before.cvr,'S17 high intent conversion improvement');
});

test('S18 combines stockout, low-price mix, mobile delay and creative response',()=>{
 const pack=screens.get('S18'),sku=pack.products[1].id;
 const unavailable=pack.breakdowns.filter(row=>row.dimension==='product'&&row.key===sku&&row.date>='2026-08-20'&&row.date<='2026-08-27');
 assert.equal(sum(unavailable,'orders'),0,'S18 zero orders while unavailable');assert(sum(unavailable,'clicks')>0,'S18 traffic still arrives');
 const mobile=current(pack).filter(row=>row.device==='mobile');
 assert(summarize(mobile.filter(row=>row.date>='2026-08-24')).loadMs>summarize(mobile.filter(row=>row.date<'2026-08-24')).loadMs,'S18 later mobile loading delay');
 const contentIds=new Set(pack.campaigns.slice(4).map(row=>row.id));
 assert(summarize(current(pack).filter(row=>contentIds.has(row.campaignId))).aov<summarize(baseline(pack).filter(row=>contentIds.has(row.campaignId))).aov,'S18 low-price product mix');
 assert(pack.records.some(row=>row.category==='inventory'),'S18 inventory evidence');
});

test('public endpoints expose projections and keep source packs and review answers private',()=>{
 let middleware;currentDataPlugin().configureServer({middlewares:{use:fn=>middleware=fn}});
 const request=url=>{const response={setHeader(){},end(body){this.body=body;}};middleware({url},response,()=>assert.fail('No endpoint '+url));return response;};
 const index=request('/workbench-data/current/training-index.json');assert.equal(JSON.parse(index.body).cases.length,18);
 for(const id of allIds)for(const snapshot of ['initial','mature'])assert.equal(JSON.parse(request(`/workbench-data/current/training-${id}-${snapshot}.json`).body).caseId,id);
 for(const file of ['training-dashboard.json','training-review.json','training-S00-initial.json','training-S01-future.json','../training-dashboard.json']) assert.equal(request('/workbench-data/current/'+file).statusCode,404,file);
 const {manifest}=loadCurrentData();assert(!publicFiles(manifest).includes('training-dashboard.json'));
 assert.equal(trainingIndex().cases.length,18);
});

test('existing source files retain their exact baseline bytes and row counts',()=>{
 const evidence=JSON.parse(fs.readFileSync(new URL('../evidence/training-dashboard-20261023/baseline.json',import.meta.url)));
 const {manifest}=loadCurrentData();assert.equal(manifest.rows,41341);
 for(const {file,sha256:expected} of evidence.files){
  if(file==='manifest.json')continue;
  const bytes=fs.readFileSync(path.resolve(import.meta.dirname,'../data',file));
  assert.equal(sha256(bytes),expected,file);
 }
});

test('regeneration from the preserved catalog matches the installed source pack exactly',()=>{
 const {catalog}=loadCurrentData();
 const installed=JSON.parse(fs.readFileSync(new URL('../data/training-dashboard.json',import.meta.url)));
 assert.deepEqual(buildTrainingData(catalog).payload,installed);
});

test('mixed extension preserves every previous case, mature override and detail record',()=>{
 const previous=JSON.parse(fs.readFileSync(new URL('../evidence/training-mixed-20261023/preservation.json',import.meta.url)));
 const installed=JSON.parse(fs.readFileSync(new URL('../data/training-dashboard.json',import.meta.url)));
 for(const {id,sha256:expected} of previous.cases)assert.equal(sha256(JSON.stringify(installed.cases.find(c=>c.caseId===id))),expected,id);
 assert.deepEqual(installed.matureOverrides,previous.overrides);
 for(const record of previous.records)assert.deepEqual(installed.records.find(r=>r.id===record.id),record,record.id);
 assert.equal(installed.records.length-previous.records.length,37);
});

test('production projections retain every case but never emit private source or answer assets',()=>{
 const emitted=new Map();
 const plugin=currentDataPlugin();plugin.buildStart();
 plugin.generateBundle.call({emitFile(asset){emitted.set(asset.fileName,asset.source);}});
 const prefix='workbench-data/current/';
 assert(emitted.has(prefix+'training-index.json'));
 for(const id of allIds)for(const snapshot of ['initial','mature']){
  const name=prefix+`training-${id}-${snapshot}.json`;
  assert(emitted.has(name),name);assert.equal(JSON.parse(emitted.get(name)).caseId,id);
 }
 assert(!emitted.has(prefix+'training-dashboard.json'));
 assert(![...emitted.keys()].some(file=>file.includes('training-review')||file.includes('ground-truth')));
});
