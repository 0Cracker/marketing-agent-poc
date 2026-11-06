import test, {after, before} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createToolRuntime} from '../../../backend/roas/tools/index.mjs';
import {dataDirectory} from '../../../scripts/roas/data.mjs';
import {trainingScreenData} from '../../../scripts/roas/training-data.mjs';
import {reviewQuery} from '../../../scripts/roas/review-data.mjs';
import {comparePeriods,selectFacts,selectBreakdowns,summarize} from '../../../shared/roas/training-dashboard.mjs';

const filters = {channel:'all',source:'all',campaignId:'all',device:'all'};
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const scopeFor = (caseId='S16',snapshot='initial',extra={}) => ({
  caseId,snapshot,filters:{...filters},dataHash:sha(trainingScreenData(undefined,caseId,snapshot)),...extra,
});
let tools;
before(async () => {
  tools=await createToolRuntime({scope:scopeFor(),runId:'test-run-20261104',
    issuedAt:'2026-11-04T10:00:00.000Z'});
});
after(async () => {await tools?.dispose();});
const execute=(name,args={})=>tools.execute({name,args:name==='evidence'?args:{scopeRole:'primary',...args}});

test('7 tool schemas, locked metric catalog and unsupported metrics',async()=>{
  const catalog=tools.metricCatalog();
  const names=tools.toolSchemas().map(tool=>tool.name);
  assert.deepEqual(names,['overview','metric_detail','trend','records','review_summary','review_records','evidence']);
  assert.equal(names.includes('breakdown'),false);
  assert.equal(catalog.metricCapabilities.find(m=>m.id==='cvr').formula,'orders / clicks');
  assert.equal(catalog.metricCapabilities.find(m=>m.id==='aov').formula,'revenue / orders');
  assert.equal(catalog.metricCapabilities.find(m=>m.id==='adCtr').numeratorField,'clicks');
  assert.deepEqual(catalog.metricCapabilities.find(m=>m.id==='cvr').components,['orders','clicks']);
  assert(catalog.metricCapabilities.find(m=>m.id==='cvr').availableDimensions.includes('campaign'));
  assert.equal(catalog.metricCapabilities.some(m=>m.id==='cac'),false);
  assert.equal((await execute('metric_detail',{metric:'cac'})).errorCode,'unsupported_metric');
  assert.equal((await execute('breakdown',{dimension:'campaign'})).errorCode,'tool_unknown');
  assert.equal((await execute('metric_detail',{metric:'cvr',dimension:'rogue'})).errorCode,'unsupported_scope');
  assert.equal((await execute('overview',{caseId:'S17'})).errorCode,'request_invalid');
  assert.equal((await execute('records',{query:'SELECT * FROM secrets'})).errorCode,'request_invalid');
  assert.equal((await execute('records',{query:'https://example.com'})).errorCode,'request_invalid');
  assert.equal((await execute('records',{query:'x'.repeat(121)})).errorCode,'request_invalid');
  assert.equal((await execute('trend',{granularity:'month'})).errorCode,'unsupported_scope');
  assert.equal((await execute('trend',{limit:25})).errorCode,'request_invalid');
  assert.equal((await execute('review_records',{reviewIds:['REV-S17-001']})).errorCode,'unsupported_scope');
});

test('overview preserves existing summarize and original case/snapshot filters',async()=>{
  const result=await execute('overview');
  assert.equal(result.status,'ready');
  assert.equal(result.periods.length,2);
  assert.equal(result.evidenceIds.length,2);
  const data=trainingScreenData(undefined,'S16','initial');
  for(const [index, expected] of comparePeriods(data,filters).entries()){
    assert.deepEqual(result.periods[index].totals,summarize(expected.rows));
    assert.equal(result.periods[index].rowCount,expected.rows.length);
    assert.equal(result.periods[index].totals.roas,expected.total.revenue/expected.total.spend);
    assert.equal(result.periods[index].components.cvr.numerator,expected.total.orders);
    assert.equal(result.periods[index].components.cvr.denominator,expected.total.clicks);
  }
  assert.equal(result.scope.dataHash,sha(data));
  assert.equal(result.sourceVersion.manifestHash,data.dataHash);
  assert.equal(result.reportingBasis.periodEndExclusive,true);
});

test('dashboard exposure metrics calculate from matching source rows',async()=>{
  const definitions=[
    ['contentClickRate','content_view','clicks',1],
    ['adCpm','ad_impression','spend',1000],
    ['contentCpm','content_view','spend',1000],
  ];
  const catalog=tools.metricCatalog().metricCapabilities;
  const allMetrics=catalog.map(metric=>metric.id);
  assert(definitions.every(([metric])=>allMetrics.includes(metric)));
  for(const schema of tools.toolSchemas().filter(tool=>['overview','trend'].includes(tool.name)))
    assert.equal(schema.parameters.properties.metrics.maxItems,allMetrics.length);
  const overview=await execute('overview',{metrics:allMetrics});
  const trend=await execute('trend',{metrics:allMetrics,periodId:'current',limit:1});
  assert.equal(overview.status,'ready');
  assert.equal(trend.status,'ready');
  const overviewCurrent=overview.periods.find(period=>period.id==='current');
  const trendDay=trend.days[0];
  const currentRows=selectFacts(trainingScreenData(undefined,'S16','initial'),filters)
    .filter(row=>row.periodId==='current');
  for(const [metric,basis,field,multiplier] of definitions){
    const detail=await execute('metric_detail',{metric,dimension:'campaign'});
    assert.equal(detail.status,'ready');
    const detailCurrent=detail.periods.find(period=>period.id==='current');
    for(const [component,rows] of [
      [overviewCurrent.components[metric],currentRows],
      [detailCurrent,currentRows],
      [trendDay.components[metric],currentRows.filter(row=>row.date===trendDay.date)],
    ]){
      const eligible=rows.filter(row=>row.exposureBasis===basis);
      const numerator=eligible.reduce((total,row)=>total+row[field],0);
      const denominator=eligible.reduce((total,row)=>total+row.impressions,0);
      assert(denominator>0);
      const raw=numerator*multiplier/denominator;
      assert.equal(component.numerator,numerator);
      assert.equal(component.denominator,denominator);
      assert.equal(component.value,raw);
      assert.equal(component.rowCount,eligible.length);
    }
  }
});

test('metric_detail recalculates raw ratios, group pairs and pagination',async()=>{
  const data=trainingScreenData(undefined,'S16','initial');
  for(const [metric,num,den] of [['cvr','orders','clicks'],['aov','revenue','orders'],['roas','revenue','spend']]){
    const result=await execute('metric_detail',{metric,dimension:'campaign',limit:2});
    assert.equal(result.status,'ready');
    assert.equal(result.total,6);
    assert.equal(result.nextOffset,2);
    assert.equal(result.groups.length,2);
    assert.equal(result.truncated,true);
    for(const period of result.periods){
      const rows=selectFacts(data,filters).filter(row=>row.periodId===period.id);
      const totals=summarize(rows);
      assert.equal(period.numerator,totals[num]);
      assert.equal(period.denominator,totals[den]);
      assert.equal(period.value,totals[den] ? totals[num]/totals[den] : null);
    }
    for(const group of result.groups)for(const periodId of ['baseline','current']){
      const rows=selectFacts(data,filters).filter(row=>row.periodId===periodId&&row.campaignId===group.key);
      const total=summarize(rows);
      assert.equal(group[periodId].numerator,total[num]);
      assert.equal(group[periodId].denominator,total[den]);
      assert.equal(group[periodId].value,total[den]?total[num]/total[den]:null);
    }
    const later=await execute('metric_detail',{metric,dimension:'campaign',offset:2,limit:24});
    assert.equal(later.groups.length,4);assert.equal(later.nextOffset,null);
    assert.equal(later.truncated,false);
  }
  const source=await execute('metric_detail',{metric:'cvr',dimension:'product'});
  assert(source.limitations.some(line=>line.includes('합성')));
  const raw=selectBreakdowns(data,filters,'product');
  for(const group of source.groups)for(const periodId of ['baseline','current']){
    const expected=summarize(raw.filter(row=>row.key===group.key&&row.periodId===periodId));
    assert.equal(group[periodId].numerator,expected.orders);
    assert.equal(group[periodId].denominator,expected.clicks);
  }
  const keyword=await execute('metric_detail',{metric:'cvr',dimension:'keyword'});
  assert.equal(keyword.status,'ready');
  assert(keyword.groups.some(group=>group.key==='__unspecified__'));
  assert.equal((await execute('metric_detail',{metric:'cvr',dimension:'campaign',offset:7})).errorCode,'request_invalid');
});

test('trend keeps real dates and records enforce asOf and query scope',async()=>{
  const first=await execute('trend',{limit:24});
  const next=await execute('trend',{offset:24,limit:24});
  assert.equal(first.total,28);assert.equal(first.days.length,24);
  assert.equal(first.nextOffset,24);assert.equal(next.days.length,4);
  assert.equal(next.nextOffset,null);
  const days=[...first.days,...next.days];
  assert.equal(new Set(days.map(day=>day.date)).size,28);
  const data=trainingScreenData(undefined,'S16','initial');
  for(const day of days){
    const raw=selectFacts(data,filters).filter(row=>row.date===day.date);
    assert.deepEqual(day.totals,summarize(raw));
    assert.equal(day.periodId,data.periods.find(p=>p.start<=day.date&&p.end>day.date)?.id);
  }
  const list=await execute('records',{limit:1});
  assert.equal(list.records.length,1);assert.equal(list.truncated,true);
  const record=list.records[0];
  assert(record.date < data.periods[1].end);
  assert(record.date <= data.asOf.slice(0,10));
  assert.equal((await execute('records',{category:'no_such_category'})).errorCode,'unsupported_scope');
  const query=await execute('records',{query:record.id});
  assert(query.records.some(row=>row.recordId===record.recordId));
  const missed=await execute('records',{query:'impossible_literal_marketing_query'});
  assert.equal(missed.status,'empty');assert.equal(missed.total,0);
});

test('review summary and records: approved S16/S17 counts, quotes, coverage, pagination',async()=>{
  const s16=await execute('review_summary');
  assert.equal(s16.status,'ready');assert.equal(s16.productName,'쓱쓱샴푸');
  assert.equal(s16.taxonomyVersion,'1.0.0');
  assert.deepEqual(s16.periods.map(p=>p.count),[27,33]);
  const page1=await execute('review_records',{limit:24});
  const page2=await execute('review_records',{offset:24,limit:24});
  const page3=await execute('review_records',{offset:48,limit:24});
  assert.equal(page1.total,60);assert.equal(page1.nextOffset,24);
  assert.equal(page2.nextOffset,48);assert.equal(page3.nextOffset,null);
  const rows=[...page1.reviews,...page2.reviews,...page3.reviews];
  assert.equal(rows.length,60);
  assert.equal(new Set(rows.map(r=>r.reviewId)).size,60);
  for(const review of rows){
    assert(review.reviewId.startsWith('REV-S16-'));
    assert(Date.parse(review.collectedAt)<Date.parse(s16.asOf));
    for(const assignment of review.assignments) assert(review.text.includes(assignment.evidenceQuote));
  }
  const unclassified=await execute('review_records',{reviewIds:['REV-S16-025']});
  assert.equal(unclassified.reviews[0]?.classification,'unclassified');
  const countByPeriod=(await execute('review_records',{periodId:'baseline'})).total;
  assert.equal(countByPeriod,27);
  const category=s16.periods[0].categories.find(c=>c.count>0);
  assert(category.percent>=0);
  assert.equal(category.percent,category.count/27*100);
  const filtered=await execute('review_summary',{sourceId:'own_store'});
  assert.equal(filtered.periods[0].count,9);
  assert.equal(filtered.periods[1].count,20);
  const s17=await createToolRuntime({scope:scopeFor('S17'),runId:'s17-run'});
  try{
    const summary=await s17.execute({name:'review_summary',args:{scopeRole:'primary'}});
    const records=await s17.execute({name:'review_records',args:{scopeRole:'primary'}});
    assert.equal(summary.periods.reduce((n,p)=>n+p.count,0),25);
    assert.equal(records.total,25);
  } finally {await s17.dispose();}
  const s01=await createToolRuntime({scope:scopeFor('S01'),runId:'s01-run'});
  try{
    const notProvided=await s01.execute({name:'review_summary',args:{scopeRole:'primary'}});
    assert.equal(notProvided.status,'not_provided');
    assert.notEqual(notProvided.periods?.[0]?.count,0);
    assert.equal((await s01.execute({name:'overview',args:{scopeRole:'primary'}})).status,'ready');
  } finally {await s01.dispose();}
});

test('Evidence registry retrieves issued lookup results and reports absent IDs',async()=>{
  const overview=await execute('overview');
  const result=await execute('evidence',{evidenceIds:overview.evidenceIds});
  assert.equal(result.status,'ready');
  assert.equal(result.items.length,2);
  assert.equal(result.items[0].summary.totals.roas,overview.periods[0].totals.roas);
  assert.equal(result.items[0].verified,undefined);
  const missing=await execute('evidence',{evidenceIds:['EV-other-run-1']});
  assert.equal(missing.status,'empty');
  assert.deepEqual(missing.missing,['EV-other-run-1']);
});

test('immutable run snapshot survives external loader mutation, disposal revokes evidence',async()=>{
  const data=structuredClone(trainingScreenData(undefined,'S16','initial'));
  const review=structuredClone(reviewQuery({caseId:'S16',snapshotId:'initial'}));
  const scoped={caseId:'S16',snapshot:'initial',filters:{...filters},dataHash:sha(data)};
  let count=0;
  const runtime=await createToolRuntime({scope:scoped,runId:'snapshot-run',
    sourceLoader:async()=>{count++;return {data,review};}});
  const before=await runtime.execute({name:'overview',args:{scopeRole:'primary'}});
  data.facts[0].revenue=987654321;
  review.reviews[0].text='changed after the snapshot';
  const afterChange=await runtime.execute({name:'overview',args:{scopeRole:'primary'}});
  const reviews=await runtime.execute({name:'review_records',args:{scopeRole:'primary',reviewIds:['REV-S16-020']}});
  assert.deepEqual(before.periods.map(p=>p.totals),afterChange.periods.map(p=>p.totals));
  assert.equal(count,1);
  assert.equal(runtime.evidenceItems(before.evidenceIds).length,2);
  assert.notEqual(reviews.reviews[0]?.text,'changed after the snapshot');
  await runtime.dispose();
  assert.throws(()=>runtime.evidenceItems(before.evidenceIds),/runtime_disposed/);
  assert.equal((await runtime.execute({name:'overview',args:{scopeRole:'primary'}})).errorCode,'runtime_disposed');
});

test('source integrity failures do not convert review errors into zero or stop ROAS',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'roas-agent-snapshot-'));
  try{
    for(const name of ['manifest.json','training-dashboard.json','roas-reviews.json',
      'roas-review-classification.json','roas-product-metadata.json','source-ads.jsonl']){
      fs.copyFileSync(path.join(dataDirectory,name),path.join(directory,name));
    }
    const classification=path.join(directory,'roas-review-classification.json');
    fs.appendFileSync(classification,'\n');
    const runtime=await createToolRuntime({scope:scopeFor(),directory,runId:'corrupt-review-run'});
    try{
      assert.equal((await runtime.execute({name:'overview',args:{scopeRole:'primary'}})).status,'ready');
      const review=await runtime.execute({name:'review_summary',args:{scopeRole:'primary'}});
      assert.equal(review.status,'error');
      assert.notEqual(review.status,'empty');
    }finally{await runtime.dispose();}
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('controlled existing-row selection preserves null denominator and true empty state',async()=>{
  const original=trainingScreenData(undefined,'S17','initial');
  const zeroRows=original.facts.filter(row=>row.orders===0);
  assert(zeroRows.length>0,'approved S17 source should include rows with zero orders');
  const data=structuredClone(original);
  data.facts=zeroRows;
  const r=await createToolRuntime({runId:'zero-denominator',scope:{
    caseId:'S17',snapshot:'initial',filters:{...filters}},
    sourceLoader:async()=>({data,review:{status:'error'}})});
  try{
    const result=await r.execute({name:'metric_detail',args:{scopeRole:'primary',metric:'aov'}});
    assert(result.periods.every(p=>p.denominator===0&&p.value===null));
    const review=await r.execute({name:'review_summary',args:{scopeRole:'primary'}});
    assert.equal(review.status,'error');
    assert.equal((await r.execute({name:'overview',args:{scopeRole:'primary'}})).status,'ready');
  }finally{await r.dispose();}
  const empty=structuredClone(original);
  empty.facts=[];
  const e=await createToolRuntime({runId:'empty-selection',scope:{caseId:'S17',snapshot:'initial',filters:{...filters}},
    sourceLoader:async()=>({data:empty,review:{status:'error'}})});
  try{
    assert.equal((await e.execute({name:'overview',args:{scopeRole:'primary'}})).status,'empty');
    assert.equal((await e.execute({name:'metric_detail',args:{scopeRole:'primary',metric:'cvr'}})).status,'empty');
  }finally{await e.dispose();}
});

test('primary and comparison queries retain their own source metadata',async()=>{
  const runtime=await createToolRuntime({runId:'two-scope-run',
    scope:{primary:scopeFor('S16'),comparison:scopeFor('S17')}});
  try{
    const main=await runtime.execute({name:'overview',args:{scopeRole:'primary'}});
    const compare=await runtime.execute({name:'overview',args:{scopeRole:'comparison'}});
    assert.equal(main.scope.caseId,'S16');
    assert.equal(compare.scope.caseId,'S17');
    assert.equal(main.status,'ready');assert.equal(compare.status,'ready');
    assert.notEqual(main.dataHash,compare.dataHash);
    const items=runtime.evidenceItems([main.evidenceIds[0],compare.evidenceIds[0]]);
    assert.deepEqual(items.map(item=>item.scopeRole),['primary','comparison']);
    assert.equal((await runtime.execute({name:'metric_detail',args:{
      scopeRole:'not-approved',metric:'cvr',
    }})).errorCode,'unsupported_scope');
  }finally{await runtime.dispose();}
  const stale=await createToolRuntime({runId:'stale-scope',scope:scopeFor('S16','initial',{dataHash:'0'.repeat(64)})});
  try {assert.equal((await stale.execute({name:'overview',args:{scopeRole:'primary'}})).status,'ready');}
  finally {await stale.dispose();}
});

test('review category counts retain multi-assignment, and period/source filters remain distinct',async()=>{
  const result=await execute('review_summary');
  assert(result.evidenceIds.length<=24);
  for(const period of result.periods){
    assert(period.categories.every(c=>c.percent===c.count/period.count*100));
    assert(period.categories.reduce((count,c)=>count+c.count,0)>=period.count-period.unclassifiedCount);
  }
  const baseline=await execute('review_summary',{sourceId:'own_store',periodId:'baseline'});
  assert.equal(baseline.periods.length,1);
  assert.equal(baseline.periods[0].count,9);
  assert.equal(baseline.sources.find(s=>s.sourceId==='own_store').count,9);
  assert.equal(baseline.sources.find(s=>s.sourceId==='virtual_external_1').count,0);
  const category=baseline.periods[0].categories[0];
  const reviews=await execute('review_records',{categoryId:category.categoryId,periodId:'baseline'});
  assert(reviews.reviews.every(row=>row.assignments.some(a=>a.categoryId===category.categoryId)));
  assert.equal((await execute('review_records',{experienceId:'fictional_experience'})).errorCode,'unsupported_scope');
});

test('missing metric source and pending review classification stay separate from ROAS errors',async()=>{
  const data=trainingScreenData(undefined,'S16','initial');
  const campaign=data.campaigns.find(item=>item.id==='EDU-C5');
  const runtime=await createToolRuntime({runId:'content-only-run',scope:scopeFor('S16','initial',{
    filters:{channel:campaign.channel,source:campaign.source,campaignId:campaign.id,device:'all'},
  })});
  try{
    const result=await runtime.execute({name:'metric_detail',args:{scopeRole:'primary',metric:'adCtr'}});
    assert.equal(result.status,'not_provided');
    assert.equal(result.periods.length,0);
    assert.equal((await runtime.execute({name:'overview',args:{scopeRole:'primary'}})).status,'ready');
  }finally{await runtime.dispose();}
  const pending=await createToolRuntime({runId:'pending-run',
    scope:{caseId:'S16',snapshot:'initial',filters:{...filters}},
    sourceLoader:async()=>({data:structuredClone(data),review:{status:'pending'}})});
  try{
    assert.equal((await pending.execute({name:'review_summary',args:{scopeRole:'primary'}})).status,'pending');
    assert.equal((await pending.execute({name:'review_records',args:{scopeRole:'primary'}})).status,'pending');
    assert.equal((await pending.execute({name:'overview',args:{scopeRole:'primary'}})).status,'ready');
  }finally{await pending.dispose();}
});
