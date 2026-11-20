import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {trainingScreenData} from '../../scripts/roas/training-data.mjs';
import {trainingCaseIds} from '../../shared/roas/training-dashboard.mjs';
import {chartEvents,eventDateText} from '../../frontend/roas/training-events.ts';
import {miniPlotDomain,miniPlotMinimumSpan,scopeTargetRoas} from '../../frontend/roas/training-presentation.ts';
import {comparisonCsv,csvChange,toCsv} from '../../frontend/roas/training-export.ts';

const filters={channel:'all',source:'all',campaignId:'all',device:'all'};

test('S16 analysis-period events are listed with dates and the payment incident range',()=>{
 const data=trainingScreenData(undefined,'S16','initial');
 const events=chartEvents(data,filters);
 assert.deepEqual(events.map(event=>eventDateText(event,data)),['08/17','08/21~08/24','08/24']);
 assert.equal(events[0].label,'광고 유입 확대 설정 · 상품 할인 동시 종료');
 assert.match(events[1].label,/간편결제 처리 오류/);
 // 자정 종료(08/25 00:00)는 영향 기간에 넣지 않는다.
 assert.equal(events[1].endDay-events[1].day,3);
 assert(events.every(event=>event.day>=1&&event.endDay<=14));
});

test('events follow the campaign scope and never include baseline-only or setup records',()=>{
 for(const caseId of trainingCaseIds){
  const data=trainingScreenData(undefined,caseId,'initial');
  const current=data.periods.find((period:{id:string})=>period.id==='current')!;
  for(const event of chartEvents(data,filters))for(const record of event.records){
   const end=typeof record.values['종료']==='string'?String(record.values['종료']):record.date;
   assert(end.slice(0,10)>=current.start,caseId+' '+record.id);
   assert(record.date<current.end,caseId+' '+record.id);
  }
 }
 const data=trainingScreenData(undefined,'S16','initial');
 const content=chartEvents(data,{...filters,campaignId:'EDU-C5'});
 assert(content.every(event=>event.records.every(record=>!record.campaignId||record.campaignId==='EDU-C5')));
});

test('target ROAS is shown only when every campaign in scope shares one target',()=>{
 const campaigns=[{id:'A',targetRoas:3.5},{id:'B',targetRoas:3.5},{id:'C',targetRoas:2}];
 assert.equal(scopeTargetRoas(campaigns,['A','B']),3.5);
 assert.equal(scopeTargetRoas(campaigns,['A','C']),null);
 assert.equal(scopeTargetRoas(campaigns,[]),null);
 assert.equal(scopeTargetRoas([{id:'A',targetRoas:null}],['A']),null);
 for(const caseId of trainingCaseIds){
  const data=trainingScreenData(undefined,caseId,'initial');
  assert.equal(scopeTargetRoas(data.campaigns,data.campaigns.map((c:{id:string})=>c.id)),3.5,caseId);
 }
});

test('small charts keep a minimum span so tiny changes do not look like spikes',()=>{
 const [low,high]=miniPlotDomain([0.0195,0.0201,0.022]);
 assert(high-low>=0.022*miniPlotMinimumSpan-1e-12);
 assert(low<=0.0195&&high>=0.022);
 // 이미 변화가 큰 범위는 그대로 둔다.
 assert.deepEqual(miniPlotDomain([10000,17000,19000]),[10000,20000]);
 assert(miniPlotDomain([0.001,0.0012])[0]>=0);
});

test('CSV export keeps raw precision, quotes text and neutralizes formulas',()=>{
 assert.equal(toCsv([['a,b','x"y','=SUM(A1)',-1.5,null]]),'"a,b","x""y",\'=SUM(A1),-1.5,');
 assert.equal(csvChange(0.0489,0.0416,true)?.toFixed(2),'-0.73');
 assert.equal(csvChange(100,129.3)?.toFixed(1),'29.3');
 assert.equal(csvChange(0,5),null);
 const csv=comparisonCsv([{label:'ROAS',rate:true,before:3.558,after:2.847},{label:'귀속 구매 매출',unit:'원',before:37280000,after:48200000}]);
 assert.equal(csv.split('\r\n')[0],'지표,단위,직전 14일,분석 기간,증감,증감 단위');
 assert.match(csv,/ROAS,%,355\.8,284\.7,-71\.1,%p/);
 assert.match(csv,/귀속 구매 매출,원,37280000,48200000,29\.2918454936,%/);
});

test('dashboard surfaces scale, target, events and export without changing chart shape',()=>{
 const ui=fs.readFileSync(new URL('../../frontend/roas/training-dashboard.tsx',import.meta.url),'utf8');
 assert.match(ui,/<ScaleKpis before=\{before\.total\} after=\{after\.total\}\/>/);
 assert.match(ui,/target=\{roasTarget\}/);
 assert.match(ui,/<ChartEvents data=\{data\} filters=\{filters\}/);
 assert.match(ui,/CSV 내려받기/);
 assert.doesNotMatch(ui,/key:'cac',label:'CAC'/,'the unavailable CAC card is replaced');
 assert.match(ui,/CAC\(신규 고객 획득 비용\)는 신규 고객 수가 집계되지 않아/);
});
