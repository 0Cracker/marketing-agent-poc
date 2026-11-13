import test from 'node:test';
import assert from 'node:assert/strict';
import {trainingScreenData} from '../../scripts/roas/training-data.mjs';
import {metricChange,summarize,trainingCaseIds} from '../../shared/roas/training-dashboard.mjs';
import type {TrainingData} from '../../shared/roas/training-dashboard.mjs';
import {analysisColumns,analysisDimensions,analysisDisplayKeys,analysisMetric,analysisMissingReason,analysisRows,analysisValue,analyzeGroups,factorEffects,scopeTrainingData,sortAnalysisGroups} from '../../frontend/roas/training-analysis.ts';
import type {AnalysisDimension} from '../../frontend/roas/training-analysis.ts';

const all={channel:'all',source:'all',campaignId:'all',device:'all'};
const near=(actual:number,expected:number,label='')=>assert(Math.abs(actual-expected)<1e-8,`${label}: ${actual} != ${expected}`);
const definitions={roas:['revenue','spend'],cpc:['spend','clicks'],adCtr:['clicks','impressions'],cvr:['orders','clicks'],cpa:['spend','orders'],aov:['revenue','orders']} as const;

test('existing cases and snapshots reconcile the centered contributions and ratio totals in every supported partition',()=>{
 let checks=0,zeroGroups=0;
 for(const id of trainingCaseIds)for(const snapshot of ['initial','mature']){
  const data:TrainingData=trainingScreenData(undefined,id,snapshot),original=JSON.stringify(data);
  for(const metric of Object.keys(definitions) as (keyof typeof definitions)[]){
   const [numerator,denominator]=definitions[metric];
   for(const dimension of ['campaign','device','product','audienceId','creativeId'] as AnalysisDimension[]){
    const rows=analysisRows(data,all,metric,dimension),analysis=analyzeGroups(data,rows,metric,dimension);
    const pairs=['baseline','current'].map(p=>rows.filter(r=>r.periodId===p));
    for(let i=0;i<2;i++){
     const N=pairs[i].reduce((s,r)=>s+r[numerator],0),D=pairs[i].reduce((s,r)=>s+r[denominator],0);
     near(analysis.overall[i]!,N/D,metric+' total');
     near(analysis.groups.reduce((s,g)=>s+g.weights[i]!,0),1,metric+' weights');
    }
    near(analysis.groups.reduce((s,g)=>s+g.impact!,0),analysis.overall[1]!-analysis.overall[0]!,id+' '+metric+' '+dimension);
    for(const g of analysis.groups){
     if(g.efficiency===null){zeroGroups++;assert(g.mix===null);assert(Number.isFinite(g.impact));}
     else near(g.efficiency+g.mix!,g.impact!,id+' group split');
    }
    checks++;
   }
  }
  assert.equal(JSON.stringify(data),original,'the installed data is never modified');
 }
 assert.equal(checks,1080);assert(zeroGroups>0,'actual zero-denominator and new/ended groups are covered');
});

test('S07 isolates the complete 100 percentage-point ROAS decline as budget mix change at execution-unit level',()=>{
 const data:TrainingData=trainingScreenData(undefined,'S07'),analysis=analyzeGroups(data,data.facts,'roas','campaignUnit');
 near(analysis.overall[0]!,4);near(analysis.overall[1]!,3);
 for(const g of analysis.groups){near(g.efficiency!,0);assert(g.mix!<0);assert(g.impact!<0);}
 near(analysis.groups.reduce((s,g)=>s+g.mix!,0),-1);
 const high=analysis.groups.filter(g=>g.values[0]===6),low=analysis.groups.filter(g=>g.values[0]===2);
 near(high.reduce((s,g)=>s+g.weights[0]!,0),.5);near(high.reduce((s,g)=>s+g.weights[1]!,0),.25);
 near(low.reduce((s,g)=>s+g.weights[1]!,0),.75);
});

test('S16 ROAS contributions preserve the AOV offset, CVR and CPC deterioration and the full change',()=>{
 const data:TrainingData=trainingScreenData(undefined,'S16'),[before,after]=['baseline','current'].map(p=>summarize(data.facts.filter(r=>r.periodId===p)));
 const effects=factorEffects('roas',before.rates,after.rates)!;
 assert(effects.find(e=>e.key==='aov')!.impact>0);assert(effects.find(e=>e.key==='cvr')!.impact<0);assert(effects.find(e=>e.key==='cpc')!.impact<0);
 near(effects.reduce((s,e)=>s+e.impact,0),after.rates.roas!-before.rates.roas!);
});

test('CPA and CPC factor replacement sums agree across ads and content without mixing exposure bases',()=>{
 for(const id of trainingCaseIds)for(const snapshot of ['initial','mature']){
  const data:TrainingData=trainingScreenData(undefined,id,snapshot);
  for(const basis of ['all','ad_impression','content_view']){
   const rows=data.facts.filter(r=>basis==='all'||r.exposureBasis===basis);
   const [before,after]=['baseline','current'].map(p=>summarize(rows.filter(r=>r.periodId===p)));
   for(const kind of basis==='all'?['cpa'] as const:['cpc'] as const){
    const effects=factorEffects(kind,before.rates,after.rates,basis==='content_view');
    if(effects)near(effects.reduce((s,e)=>s+e.impact,0),after.rates[kind]!-before.rates[kind]!,id+' '+basis);
   }
   if(basis==='content_view'){assert.equal(before.rates.adCtr,null);assert.equal(after.rates.adCpm,null);}
  }
 }
});

test('dimensions use actual campaign-qualified traffic, restrict keywords to search and exclude content from CTR',()=>{
 const data:TrainingData=trainingScreenData(undefined,'S16');
 assert.equal(analysisDimensions(data,all,'adCtr')[0],'creativeId');
 assert(!analysisDimensions(data,all,'cpc').includes('keyword'));
 assert(analysisDimensions(data,{...all,channel:'search'},'cpc').includes('keyword'));
 assert.equal(analysisRows(data,{...all,channel:'content'},'adCtr','creativeId').length,0);
 const rows=analysisRows(data,{...all,channel:'search'},'adCtr','keyword'),analysis=analyzeGroups(data,rows,'adCtr','keyword');
 assert(analysis.groups.length>new Set(rows.map(r=>'keyword' in r?r.keyword:'')).size);
 assert(analysis.groups.every(g=>new Set(g.rows.map(r=>r.campaignId)).size===1));
 for(const [k,[n,d]] of Object.entries(definitions)){assert(analysisColumns[k].includes(n));assert(analysisColumns[k].includes(d));}
});

test('zero orders and new creatives retain finite contribution while unavailable ratios are not fabricated',()=>{
 const data:TrainingData=trainingScreenData(undefined,'S11'),analysis=analyzeGroups(data,analysisRows(data,all,'aov','product'),'aov','product');
 const stockout=analysis.groups.find(g=>g.after.orders===0)!;
 assert(stockout);assert.equal(stockout.values[1],null);assert.equal(stockout.efficiency,null);assert.equal(stockout.mix,null);assert(Number.isFinite(stockout.impact));
 assert.equal(analysisValue(stockout.after,'realizedPrice'),null);
 assert.deepEqual(analysisMissingReason(stockout.periodRows[1],'realizedPrice'),{label:'계산 불가',reason:'판매 수량 값이 0이어서 계산할 수 없습니다.'});
 assert.equal(analysisMissingReason([],'realizedPrice').label,'데이터 없음');
 const mixed:TrainingData=trainingScreenData(undefined,'S16'),creatives=analyzeGroups(mixed,analysisRows(mixed,all,'adCtr','creativeId'),'adCtr','creativeId');
 assert(creatives.groups.some(g=>!g.periodRows[0].length&&g.impact!==null&&g.efficiency===null));
 const noData=analyzeGroups(data,analysisRows(data,{...all,campaignId:'unavailable'},'roas','campaign'),'roas','campaign');
 assert.equal(noData.change,null);assert.equal(noData.groups.length,0);
});

test('traffic narrowing updates the complete selected totals and never invents a product cross-tab',()=>{
 const data:TrainingData=trainingScreenData(undefined,'S16');
 const rows=analysisRows(data,all,'cvr','audienceId'),analysis=analyzeGroups(data,rows,'cvr','audienceId'),g=analysis.groups[0];
 const scope={dimension:'audienceId' as const,key:g.key,label:g.label,rowIds:g.rows.map(r=>r.id)};
 const narrowed=scopeTrainingData(data,scope);
 assert.deepEqual(narrowed.facts,g.rows);assert(narrowed.breakdowns.every(r=>r.dimension==='traffic'));assert.equal(narrowed.reach.length,0);
 near(summarize(narrowed.facts).spend,summarize(g.rows).spend);
 assert.equal(analysisRows(narrowed,all,'aov','product').length,0);
 const devices=analyzeGroups(narrowed,analysisRows(narrowed,all,'cvr','device'),'cvr','device'),mobile=devices.groups.find(r=>r.rows[0].device==='mobile')!;
 const subset=scopeTrainingData(data,{...scope,rowIds:mobile.rows.map(r=>r.id)});
 assert(subset.facts.every(r=>r.device==='mobile'&&g.rows.includes(r)));assert.equal(scopeTrainingData(data,null),data);
});

test('AOV exposes product mix and discounts as distinct observations on the installed single-item orders',()=>{
 for(const id of ['S03','S12','S17']){
  const data:TrainingData=trainingScreenData(undefined,id),a=analyzeGroups(data,analysisRows(data,all,'aov','product'),'aov','product');
  for(let i=0;i<2;i++){
   near(a.groups.reduce((s,g)=>s+analysisValue(i?g.after:g.before,'orderShare',a.totals[i])!,0),1);
   const t=a.totals[i];near(analysisValue(t,'realizedPrice')!,analysisValue(t,'aov')!);near(analysisValue(t,'unitsPerOrder')!,1);
  }
  if(id==='S03'){assert(a.groups.some(g=>analysisValue(g.before,'orderShare',a.totals[0])!==analysisValue(g.after,'orderShare',a.totals[1])));near(analysisValue(a.totals[0],'discountRate')!,analysisValue(a.totals[1],'discountRate')!);}
  else assert(analysisValue(a.totals[1],'discountRate')!<analysisValue(a.totals[0],'discountRate')!);
 }
});

test('explanatory metrics precede calculation inputs in analysis columns',()=>{
 assert.deepEqual(analysisColumns.roas,['roas','cpc','cvr','aov','revenue','spend']);
 assert.deepEqual(analysisColumns.cpc,['cpc','adCpm','adCtr','spend','clicks']);
 assert.deepEqual(analysisDisplayKeys('roas',analysisColumns.roas),['impact','roas','cpc','cvr','aov','revenue','spend']);
 assert.deepEqual(analysisDisplayKeys('cpc',analysisColumns.cpc),['cpc','impact','adCpm','adCtr','spend','clicks']);
});

test('ROAS column changes and other metric raw values sort independently',()=>{
 const data:TrainingData=trainingScreenData(undefined,'S16');
 for(const key of ['roas','cpc']){
  const a=analyzeGroups(data,data.facts,key,'campaign'),sorted=sortAnalysisGroups(a,key,{});
  assert(sorted.every((g,i)=>i===0||Math.sign(a.change!)*(sorted[i-1].impact!-g.impact!)>=0));
  for(const sortKey of analysisColumns[key])for(const descending of [true,false]){
   const sortBasis=key==='roas'?'change':'value';
   const sorted=sortAnalysisGroups(a,key,{sortBasis,sortKey,descending});
   const values=sorted.map(g=>{
    const after=g.periodRows[1].length?analysisValue(g.after,sortKey,a.totals[1]):null;
    if(sortBasis==='value')return after;
    const before=g.periodRows[0].length?analysisValue(g.before,sortKey,a.totals[0]):null;
    return metricChange(before,after,analysisMetric(sortKey).rate);
   }).filter(v=>v!==null);
   assert(values.every((v,i)=>!i||(descending?values[i-1]!>=v!:values[i-1]!<=v!)),sortKey);
  }
 }
});

test('campaign analysis aggregates execution units by explicit parent, preserving ratios, contributions, and filters',()=>{
 const data:TrainingData=trainingScreenData(undefined,'S16'),rows=analysisRows(data,all,'roas','campaign');
 const parents=analyzeGroups(data,rows,'roas','campaign'),units=analyzeGroups(data,rows,'roas','campaignUnit');
 assert.deepEqual(parents.groups.map(g=>g.key).sort(),['EDU-G1','EDU-G2']);
 assert.equal(units.groups.length,6);
 for(const [parentId,childIds,label] of [
  ['EDU-G1',['EDU-C1','EDU-C2','EDU-C3','EDU-C4'],'8월 구매 캠페인'],
  ['EDU-G2',['EDU-C5','EDU-C6'],'8월 콘텐츠 제휴'],
 ] as const){
  const parent=parents.groups.find(g=>g.key===parentId)!;
  assert.equal(parent.label,label);
  assert.deepEqual([...new Set(parent.rows.map(r=>r.campaignId))].sort(),[...childIds].sort());
  for(const period of ['baseline','current'] as const){
   const selected=parent.rows.filter(r=>r.periodId===period),summary=summarize(selected);
   assert.equal(summary.spend,period==='current'?parent.after.spend:parent.before.spend);
   assert.equal(summary.revenue,period==='current'?parent.after.revenue:parent.before.revenue);
   near(summary.rates.roas!,analysisValue(period==='current'?parent.after:parent.before,'roas')!);
   near(summary.rates.cpc!,analysisValue(period==='current'?parent.after:parent.before,'cpc')!);
   near(summary.rates.cvr!,analysisValue(period==='current'?parent.after:parent.before,'cvr')!);
   near(summary.rates.aov!,analysisValue(period==='current'?parent.after:parent.before,'aov')!);
  }
  near(units.groups.filter(g=>childIds.includes(g.key as never)).reduce((sum,g)=>sum+g.impact!,0),parent.impact!);
 }
 const purchase=parents.groups.find(g=>g.key==='EDU-G1')!;
 const single=analyzeGroups(data,analysisRows(data,{...all,campaignId:'EDU-C1'},'roas','campaign'),'roas','campaign');
 assert.equal(single.groups.length,1);
 assert.equal(single.groups[0].label,purchase.label);
 assert(single.groups[0].rows.every(r=>r.campaignId==='EDU-C1'));
 assert(single.groups[0].after.spend<purchase.after.spend,'subunit filter must not silently include sibling spend');
 assert.equal(units.groups.find(g=>g.key==='EDU-C1')!.label,'검색 A');
 assert.equal(units.groups.find(g=>g.key==='EDU-C6')!.label,'Instagram');
});
