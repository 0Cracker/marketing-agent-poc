import test from 'node:test';
import assert from 'node:assert/strict';
import {trainingScreenData} from '../scripts/training-data.mjs';
import {comparePeriods,metricPeriodSeries,trainingCaseIds} from '../shared/training-dashboard.mjs';
import {deltaTone,miniPlotDomain,plotUpper,prioritizeColumns} from '../frontend/workbench/training-presentation.ts';

const filters={channel:'all',source:'all',campaignId:'all',device:'all'};

test('the same numerical direction means opposite performance for ROAS and purchase costs',()=>{
 const [before,after]=comparePeriods(trainingScreenData(undefined,'S16','initial'),filters);
 assert(after.total.rates.cpc!>before.total.rates.cpc!);
 assert.equal(deltaTone('cpc',before.total.rates.cpc,after.total.rates.cpc),'negative');
 assert.equal(deltaTone('cpc',after.total.rates.cpc,before.total.rates.cpc),'positive');
 assert.equal(deltaTone('roas',before.total.rates.roas,after.total.rates.roas),'negative');
 assert.equal(deltaTone('roas',after.total.rates.roas,before.total.rates.roas),'positive');
 assert.equal(deltaTone('spend',before.total.spend,after.total.spend),'neutral');
 assert.equal(deltaTone('discountRate',before.total.discount,after.total.discount),'neutral');
 assert.equal(deltaTone('cac',null,null),'neutral');
 assert.equal(deltaTone('aov',after.total.rates.aov,after.total.rates.aov),'neutral');
});

test('one visible axis encloses both periods for all existing cases and KPI trends',()=>{
 for(const caseId of trainingCaseIds)for(const metricKey of ['roas','adCtr','cpc','cvr','cpa','aov','cac']){
  const series=metricPeriodSeries(trainingScreenData(undefined,caseId,'initial'),filters,metricKey);
  const values=series.flatMap(row=>[row.baseline,row.current]);
  const upper=plotUpper(values);
  assert(Number.isFinite(upper)&&upper>0);
  assert(values.every(value=>value===null||(value>=0&&value<=upper)),caseId+' '+metricKey);
  assert.equal(upper,plotUpper(series.flatMap(row=>[row.current,row.baseline])));
 }
});

test('the entry metric and its numerator and denominator precede other columns without changing source order',()=>{
 const items=['orders','units','revenue','aov','discountRate'].map(key=>({key}));
 assert.deepEqual(prioritizeColumns(items,'aov').map(item=>item.key),['aov','revenue','orders','units','discountRate']);
 assert.deepEqual(items.map(item=>item.key),['orders','units','revenue','aov','discountRate']);
 assert.deepEqual(prioritizeColumns(items,'cac'),items);
 const traffic=['impressions','clicks','cpc','spend'].map(key=>({key}));
 assert.deepEqual(prioritizeColumns(traffic,'cpc').map(item=>item.key),['cpc','spend','clicks','impressions']);
});

test('displayed zero changes, zero percentage points and unavailable comparisons are neutral',()=>{
 assert.equal(deltaTone('cpc',500,500),'neutral');
 assert.equal(deltaTone('cpc',500,500.1),'neutral');
 assert.equal(deltaTone('cpc',500,499.9),'neutral');
 assert.equal(deltaTone('cvr',0.02,0.0201,true),'neutral');
 assert.equal(deltaTone('cvr',0.02,0.0199,true),'neutral');
 assert.equal(deltaTone('revenue',0,100),'neutral');
 assert.equal(deltaTone('cvr',0,0.01,true),'positive');
 assert.equal(deltaTone('cpc',500,501),'negative');
 assert.equal(deltaTone('cvr',0.02,0.021,true),'positive');
});

test('headline ROAS compares each full period aggregate rather than daily mean or last-day ROAS',()=>{
 const pack=trainingScreenData(undefined,'S16','initial');
 const periods=comparePeriods(pack,filters);
 const series=metricPeriodSeries(pack,filters,'roas');
 for(const period of periods){
  const revenue=period.rows.reduce((sum,row)=>sum+row.revenue,0);
  const spend=period.rows.reduce((sum,row)=>sum+row.spend,0);
  assert.equal(period.total.rates.roas,revenue/spend);
  const values=series.map(point=>point[period.period.id]).filter((value):value is number=>value!==null);
  assert.notEqual(period.total.rates.roas,values.at(-1));
  assert(Math.abs(period.total.rates.roas-values.reduce((sum,value)=>sum+value,0)/values.length)>1e-6);
 }
 assert.equal(Number((periods[0].total.rates.roas!*100).toFixed(1)),355.8);
 assert.equal(Number((periods[1].total.rates.roas!*100).toFixed(1)),284.7);
});

test('mini trends use two shared bounds around actual values while large trends retain zero',()=>{
 assert.deepEqual(miniPlotDomain([10000,17000,19000,null]),[10000,20000]);
 const [lower,upper]=miniPlotDomain([0.028,0.049]);
 assert(Math.abs(lower-0.025)<1e-10);
 assert(Math.abs(upper-0.05)<1e-10);
 for(const caseId of trainingCaseIds)for(const metricKey of ['adCtr','cpc','cvr','cpa','aov']){
  const series=metricPeriodSeries(trainingScreenData(undefined,caseId,'initial'),filters,metricKey);
  const values=series.flatMap(row=>[row.baseline,row.current]);
  const [low,high]=miniPlotDomain(values);
  assert(high>low);
  assert(values.every(value=>value===null||(value>=low-1e-10&&value<=high+1e-10)),caseId+' '+metricKey);
  assert.deepEqual(miniPlotDomain(series.flatMap(row=>[row.current,row.baseline])),[low,high]);
  assert(plotUpper(values)>=Math.max(...values.filter((value):value is number=>value!==null)));
 }
});

test('mini bounds stay readable for flat, zero and unavailable series',()=>{
 assert.deepEqual(miniPlotDomain([null,null]),[0,1]);
 assert.deepEqual(miniPlotDomain([0,0]),[0,1]);
 const [low,high]=miniPlotDomain([500,500]);
 assert(low<500&&high>500);
});

// Reuse approved S16 observations; no new marketing fixtures.
test('all directional table metrics share improvement, deterioration and neutral semantics',()=>{
 const [before,after]=comparePeriods(trainingScreenData(undefined,'S16','initial'),filters);
 const low=before.total.rates.cpc!,high=after.total.rates.cpc!;
 for(const key of ['roas','revenue','orders','ledgerOrders','ledgerRevenue','units','returnPurchases','purchases','cvr','adCtr','contentClickRate','aov','sessionCvr','checkoutRate','viewRate','cartRate','beginRate']){
  assert.equal(deltaTone(key,low,high),'positive',key);
  assert.equal(deltaTone(key,high,low),'negative',key);
 }
 for(const key of ['cpc','cpa','cac','adCpm','contentCpm','paymentFailureRate','paymentFailures','redirectErrors','loadMs','duplicateEvents']){
  assert.equal(deltaTone(key,low,high),'negative',key);
  assert.equal(deltaTone(key,high,low),'positive',key);
 }
 for(const key of ['spend','spendShare','impressions','clicks','sessions','view','cart','checkout','paymentAttempts','unitPrice','listRevenue','discount','discountRate','trackingExpected','trackingReceived','reach','frequency','unknown']){
  assert.equal(deltaTone(key,low,high),'neutral',key);
  assert.equal(deltaTone(key,high,low),'neutral',key);
 }
});
