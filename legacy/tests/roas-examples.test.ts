import test from 'node:test';
import assert from 'node:assert/strict';
import {trainingIndex,trainingScreenData} from '../scripts/training-data.mjs';
import {comparePeriods,summarize} from '../shared/training-dashboard.mjs';
import type {Filters,TrainingData} from '../shared/training-dashboard.mjs';
import {chatSourceRows} from '../shared/roas-chat.mjs';
import {roasExamples,roasExampleAnswer} from '../frontend/workbench/roas-examples.ts';

const all:Filters={channel:'all',source:'all',campaignId:'all',device:'all'};
test('overview compares campaign outcomes while drivers explains the metric interactions',()=>{
 const data=trainingScreenData(undefined,'S16','initial');
 const overview=roasExampleAnswer(data,all,'overview'),drivers=roasExampleAnswer(data,all,'drivers');
 assert.match(overview.answer,/29\.3%.*61\.6%/);
 assert.match(overview.sections!.summary.join(' '),/하락 4개, 상승 2개/);
 assert.match(overview.sections!.summary.join(' '),/검색 A.*-218%p/);
 assert.match(overview.sections!.summary.join(' '),/네이버 블로그.*84\.9%p/);
 assert.match(overview.sections!.summary.join(' '),/Instagram 피드.*120\.7%/);
 assert.equal(overview.comparison!.rows.length,6);
 assert.equal(drivers.comparison!.rows.length,1);
 assert.equal(overview.sources.length,14);
 assert.equal(drivers.sources.length,2);
 assert(overview.comparison!.rows.every(row=>row.sourceIds.every(id=>overview.sources.some(source=>source.id===id))));
 assert(!overview.sections!.summary.some(text=>text.includes('ROAS 변화 기여')));
 assert(drivers.sections!.summary.some(text=>text.includes('ROAS 변화 기여')));
 for(const key of ['conclusion','summary','reasoning','actions'] as const)assert.notDeepEqual(overview.sections![key],drivers.sections![key],key+' must answer a different question');
 const scoped=roasExampleAnswer(data,{...all,campaignId:'EDU-C5',device:'mobile'},'overview');
 assert.equal(scoped.comparison!.rows.length,1);assert.equal(scoped.comparison!.rows[0].key,'EDU-C5');
 assert(scoped.sources.filter(source=>source.kind==='breakdown').every(source=>source.key==='EDU-C5'));
});
test('examples preserve the first and third questions and split the actual S16 ROAS change',()=>{
 assert.equal(roasExamples[0].question,'ROAS가 직전 기간보다 달라진 이유를 분석해줘');
 assert.equal(roasExamples[2].question,'구매 과정에서 이탈이 늘어난 구간을 찾아줘');
 assert.match(roasExamples[1].question,/AOV, CVR, CPC.*기여.*무엇부터/);
 const data=trainingScreenData(undefined,'S16','initial');
 const answer=roasExampleAnswer(data,all,'drivers');
 assert.equal(answer.mode,'example');
 assert.match(answer.sections!.conclusion,/355\.8% → 284\.7%.*CVR/);
 // Independently calculated, six-order attribution for the existing S16 totals.
 for(const [i,value] of ['+17.2%p','-51.8%p','-36.5%p'].entries())assert(answer.sections!.summary[i].includes(value));
 assert.match(answer.sections!.reasoning.join(' '),/AOV의 개선이 하락을 일부 상쇄/);
 assert.match(answer.sections!.actions[0],/^CVR부터/);
 assert.match(answer.sections!.limitations.join(' '),/수식상 변화 분해.*실제 원인/);
});

test('all existing cases and snapshots keep source rows, scoped totals and contribution sums consistent',()=>{
 let checked=0,unavailable=0;
 for(const item of trainingIndex().cases)for(const snapshot of ['initial','mature']){
  const data:TrainingData=trainingScreenData(undefined,item.id,snapshot),original=JSON.stringify(data);
  const scopes=[all,...data.campaigns.flatMap(c=>['all','mobile','desktop'].map(device=>({...all,channel:c.channel,source:c.source,campaignId:c.id,device})))];
  for(const filters of scopes){
   const periods=comparePeriods(data,filters),a=periods.find(row=>row.period.id==='baseline')!.total,b=periods.find(row=>row.period.id==='current')!.total;
   for(const example of roasExamples){
    const result=roasExampleAnswer(data,filters,example.id);
    assert(!/NaN|Infinity|undefined/.test(JSON.stringify(result)));
    assert.equal(result.mode,'example');assert(result.sections!.actions.length);
    for(const source of result.sources)assert.deepEqual(source.total,summarize(chatSourceRows(data,filters,source).filter(row=>'spend' in row)));
   }
   const result=roasExampleAnswer(data,filters,'drivers');
   const impacts=result.sections!.summary.flatMap(text=>{const match=text.match(/ROAS 변화 기여 ([+-]?[\d,]+(?:\.\d+)?)%p/);return match?[Number(match[1].replaceAll(',',''))]:[];});
   if(impacts.length){
    assert.equal(impacts.length,3);
    assert(Math.abs(impacts.reduce((sum,value)=>sum+value,0)-(b.rates.roas!-a.rates.roas!)*100)<0.151);
    if(b.rates.roas!>=a.rates.roas!)assert.match(result.sections!.summary.join(' '),/하락하지 않았습니다/);
    checked++;
   }else{assert.match(result.sections!.reasoning.join(' '),/0/);unavailable++;}
  }
  assert.equal(JSON.stringify(data),original);
 }
 assert(checked>0);assert(unavailable>0,'existing zero-order scopes are covered');
});

test('funnel answers use stage abandonment rates and handle an empty selection',()=>{
 const data=trainingScreenData(undefined,'S16','initial');
 const result=roasExampleAnswer(data,all,'funnel');
 const [a,b]=comparePeriods(data,all).map(row=>row.total);
 const stages=[['sessions','view'],['view','cart'],['cart','checkout'],['checkout','purchases']] as const;
 stages.forEach(([from,to],i)=>{
  const expected=(((1-b[to]/b[from])-(1-a[to]/a[from]))*100).toLocaleString('ko-KR',{maximumFractionDigits:1});
  assert(result.sections!.summary[i].includes(expected+'%p'));
 });
 assert.match(result.sections!.reasoning.join(' '),/재방문 구매/);
 const empty=roasExampleAnswer(data,{...all,campaignId:'missing'},'drivers');
 assert.match(empty.answer,/비교할 수 없습니다/);assert.equal(empty.comparison?.rows[0].after,null);
});
