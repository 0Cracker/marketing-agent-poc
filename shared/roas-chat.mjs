import {selectFacts,selectBreakdowns,selectRecords} from './training-dashboard.mjs';

export const chatMetrics={roas:{label:'ROAS',unit:'%',rate:true},spend:{label:'유료 마케팅 집행비',unit:'원'},revenue:{label:'구매 전환 매출',unit:'원'},orders:{label:'주문',unit:'건'},clicks:{label:'클릭',unit:'회'},cpc:{label:'CPC',unit:'원'},cvr:{label:'클릭 기준 구매율',unit:'%',rate:true},cpa:{label:'주문당 광고비, CPA',unit:'원'},aov:{label:'주문당 구매금액, AOV',unit:'원'},adCtr:{label:'광고 CTR',unit:'%',rate:true},paymentFailureRate:{label:'결제 실패율',unit:'%',rate:true}};
export function chatValue(value,metric){return value==null?'계산 불가':(chatMetrics[metric]?.rate?value*100:value).toLocaleString('ko-KR',{maximumFractionDigits:1})+(chatMetrics[metric]?.unit||'');}

// Only one complete breakdown at a time: never mix aggregate levels or average ratios.
export function chatComparison(sources,metric){
 if(!Object.hasOwn(chatMetrics,metric)||!sources.length||sources.length>24)return null;
 const first=sources[0];
 if(!['summary','breakdown'].includes(first.kind)||sources.some(row=>row.kind!==first.kind||row.dimension!==first.dimension||!['baseline','current'].includes(row.period?.id)))return null;
 const groups=[...new Set(sources.map(row=>row.key||'all'))];
 const rows=[];
 for(const key of groups){
  const pair=sources.filter(row=>(row.key||'all')===key),before=pair.find(row=>row.period.id==='baseline'),after=pair.find(row=>row.period.id==='current');
  if(pair.length!==2||!before||!after)return null;
  const value=row=>row.total.rates[metric]??row.total[metric]??null;
  rows.push({key,label:after.label||'전체 성과',before:value(before),after:value(after),sourceIds:[before.id,after.id]});
 }
 return {metric,...chatMetrics[metric],rows};
}

export function chatHighlights(comparison,kinds){
 if(!comparison)return [];
 const current=comparison.rows.filter(row=>row.after!==null),changes=comparison.rows.filter(row=>row.before!==null&&row.after!==null);
 const selected={lowest_current:current.toSorted((a,b)=>a.after-b.after),highest_current:current.toSorted((a,b)=>b.after-a.after),largest_decline:changes.filter(row=>row.after<row.before).toSorted((a,b)=>(a.after-a.before)-(b.after-b.before)),largest_increase:changes.filter(row=>row.after>row.before).toSorted((a,b)=>(b.after-b.before)-(a.after-a.before))};
 return kinds.map(kind=>{
  const row=selected[kind]?.[0];if(!row)return kind==='largest_decline'?'선택 범위에서 직전 대비 하락한 대상이 없습니다.':kind==='largest_increase'?'선택 범위에서 직전 대비 증가한 대상이 없습니다.':'선택 범위에 순위를 비교할 수 있는 값이 없습니다.';
  const label=row.label.replace(/^8월 구매 캠페인 \| /,'').replace(/^8월 콘텐츠 제휴 \| /,'콘텐츠 제휴, ');
  if(kind==='lowest_current'||kind==='highest_current')return `현재 ${comparison.label}가 가장 ${kind==='lowest_current'?'낮은':'높은'} 대상은 ${label}이며, ${chatValue(row.after,comparison.metric)}입니다. [${row.sourceIds[1]}]`;
  const difference=row.after-row.before,change=comparison.rate?(difference*100).toLocaleString('ko-KR',{maximumFractionDigits:1})+'%p':chatValue(difference,comparison.metric);
  return `${comparison.label} ${kind==='largest_decline'?'하락':'증가'} 폭이 가장 큰 대상은 ${label}이며, 직전 대비 ${change}입니다. [${row.sourceIds[0]}] [${row.sourceIds[1]}]`;
 }).filter(Boolean);
}

export function chatSourceRows(data,filters,source){
 if(source.kind==='record')return selectRecords(data,filters).filter(row=>row.id===source.id);
 let rows=['summary','daily'].includes(source.kind)||['campaign','device'].includes(source.dimension)?selectFacts(data,filters):selectBreakdowns(data,filters,source.dimension==='product'?'product':'traffic');
 if(source.kind==='daily')return rows.filter(row=>row.date===source.date);
 rows=rows.filter(row=>row.periodId===source.period?.id);
 if(source.kind==='summary')return rows;
 return rows.filter(row=>(source.dimension==='product'?row.key:source.dimension==='campaign'?row.campaignId:row[source.dimension])===source.key);
}
