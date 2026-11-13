import {campaignDisplayName,displayTrainingText,metricChange,metricMissingReason,metricValue,selectBreakdowns,selectFacts,summarize} from '../../shared/roas/training-dashboard.mjs';
import {roasImpactPp} from '../../shared/roas/roas-impact.mjs';
import type {Breakdown,Fact,Filters,Total,TrainingData} from '../../shared/roas/training-dashboard.mjs';

export type AnalysisMetric={key:string;label:string;rate?:boolean;unit?:string};
export type AnalysisDimension='campaign'|'campaignUnit'|'device'|'creativeId'|'audienceId'|'placement'|'keyword'|'product';
export type AnalysisScope={dimension:AnalysisDimension;key:string;label:string;rowIds?:string[]};
export type AnalysisSettings={dimension?:AnalysisDimension;sortBasis?:'impact'|'value'|'change';sortKey?:string;descending?:boolean;expanded?:string[]};
export type AnalysisRow=Fact|Breakdown;
export const dimensionNames:Record<AnalysisDimension,string>={campaign:'캠페인',campaignUnit:'집행 항목',device:'기기',creativeId:'소재',audienceId:'타깃',placement:'게재 위치',keyword:'검색어',product:'상품'};
// EDU-C1~C6 are execution units. The parent identity is explicit, never inferred from a matching display name.
const campaignParents:Record<string,{id:string;label:string}>={
 'EDU-C1':{id:'EDU-G1',label:'8월 구매 캠페인'},'EDU-C2':{id:'EDU-G1',label:'8월 구매 캠페인'},
 'EDU-C3':{id:'EDU-G1',label:'8월 구매 캠페인'},'EDU-C4':{id:'EDU-G1',label:'8월 구매 캠페인'},
 'EDU-C5':{id:'EDU-G2',label:'8월 콘텐츠 제휴'},'EDU-C6':{id:'EDU-G2',label:'8월 콘텐츠 제휴'},
};
export function campaignUnitLabel(data:TrainingData,id:string){
 const name=campaignDisplayName(data,id),parent=campaignParents[id]?.label;
 return parent&&name.startsWith(parent+' | ')?name.slice(parent.length+3):name;
}
const pairDefinitions:Record<string,[string,string]>={roas:['revenue','spend'],cpc:['spend','clicks'],adCtr:['clicks','impressions'],cvr:['orders','clicks'],cpa:['spend','orders'],aov:['revenue','orders']};
export const analysisMetrics:AnalysisMetric[]=[
 {key:'roas',label:'ROAS',rate:true},{key:'cpc',label:'CPC',unit:'원'},{key:'adCtr',label:'광고 CTR',rate:true},{key:'cvr',label:'클릭 기준 구매 CVR',rate:true},{key:'cpa',label:'CPA',unit:'원'},{key:'aov',label:'AOV',unit:'원'},
 {key:'revenue',label:'귀속 구매 매출',unit:'원'},{key:'spend',label:'유료 마케팅 집행비',unit:'원'},{key:'clicks',label:'클릭수',unit:'회'},{key:'impressions',label:'광고 노출수',unit:'회'},{key:'orders',label:'귀속 구매 주문수',unit:'건'},
 {key:'adCpm',label:'광고 CPM',unit:'원'},{key:'contentClickRate',label:'콘텐츠 링크 클릭률',rate:true},{key:'contentCpm',label:'조회 1,000회당 비용',unit:'원'},
 {key:'impressionShare',label:'노출 비중',rate:true},{key:'orderShare',label:'주문 비중',rate:true},{key:'spendShare',label:'집행비 비중',rate:true},{key:'clickShare',label:'클릭 비중',rate:true},
 {key:'sessions',label:'랜딩 세션',unit:'회'},{key:'view',label:'상품 조회 세션',unit:'회'},{key:'cart',label:'장바구니 세션',unit:'회'},{key:'checkout',label:'결제 시작 세션',unit:'회'},
 {key:'purchases',label:'동일 세션 구매 건수',unit:'건'},{key:'returnPurchases',label:'재방문 구매',unit:'건'},{key:'sessionCvr',label:'동일 세션 구매율',rate:true},
 {key:'viewRate',label:'상품 조회율',rate:true},{key:'cartRate',label:'장바구니율',rate:true},{key:'beginRate',label:'결제 시작률',rate:true},{key:'checkoutRate',label:'결제 완료율',rate:true},
 {key:'paymentAttempts',label:'결제 시도',unit:'회'},{key:'paymentFailures',label:'결제 실패',unit:'회'},{key:'paymentFailureRate',label:'결제 실패율',rate:true},
 {key:'loadMs',label:'평균 로드 시간',unit:'ms'},{key:'loadTotalMs',label:'로드 시간 합계',unit:'ms'},{key:'loadSamples',label:'로드 측정 횟수',unit:'회'},{key:'redirectErrors',label:'리디렉션 오류',unit:'회'},{key:'units',label:'판매 수량',unit:'개'},
 {key:'unitPrice',label:'할인 전 단가',unit:'원'},{key:'realizedPrice',label:'평균 실현 판매가',unit:'원'},{key:'unitsPerOrder',label:'주문당 수량',unit:'개'},
 {key:'listRevenue',label:'할인 전 금액',unit:'원'},{key:'discount',label:'할인액',unit:'원'},{key:'discountRate',label:'금액 할인율',rate:true},
 {key:'ledgerOrders',label:'주문 원장 주문',unit:'건'},{key:'ledgerRevenue',label:'주문 원장 매출',unit:'원'},{key:'trackingExpected',label:'수집 대상 이벤트',unit:'회'},{key:'trackingReceived',label:'수집 이벤트',unit:'회'},{key:'duplicateEvents',label:'중복 이벤트',unit:'회'},
];
export const analysisColumns:Record<string,string[]>={roas:['roas','cpc','cvr','aov','revenue','spend'],cpc:['cpc','adCpm','adCtr','spend','clicks'],adCtr:['adCtr','impressionShare','clicks','impressions'],cvr:['cvr','sessionCvr','orders','clicks'],cpa:['cpa','cpc','cvr','spend','orders'],aov:['aov','discountRate','revenue','orders']};
export const analysisDisplayKeys=(metricKey:string,keys:string[])=>metricKey==='roas'?['impact',...keys]:[keys[0],'impact',...keys.slice(1)];
export const analysisMetric=(key:string)=>analysisMetrics.find(metric=>metric.key===key)!;
export function analysisMissingReason(rows:AnalysisRow[],key:string){
 const denominators:Record<string,string>={impressionShare:'선택 범위 전체 광고 노출수',orderShare:'선택 그룹 전체 주문수',clickShare:'선택 범위 전체 클릭수',realizedPrice:'판매 수량',unitsPerOrder:'귀속 구매 주문수'};
 return rows.length&&denominators[key]?{label:'계산 불가',reason:`${denominators[key]} 값이 0이어서 계산할 수 없습니다.`}:metricMissingReason(rows,key);
}
const divide=(a:number,b:number)=>b?a/b:null;
export function analysisValue(total:Total,key:string,overall:Total=total):number|null{
 const ratios:Record<string,[number,number]>={impressionShare:[total.impressions,overall.impressions],orderShare:[total.orders,overall.orders],spendShare:[total.spend,overall.spend],clickShare:[total.clicks,overall.clicks],viewRate:[total.view,total.sessions],cartRate:[total.cart,total.view],beginRate:[total.checkout,total.cart],unitPrice:[total.listRevenue,total.units],realizedPrice:[total.revenue,total.units],unitsPerOrder:[total.units,total.orders],discountRate:[total.discount,total.listRevenue]};
 return key in ratios?divide(...ratios[key]):metricValue(total,key);
}
export function groupKey(row:AnalysisRow,dimension:AnalysisDimension):string{
 if(dimension==='campaign')return campaignParents[row.campaignId]?.id||row.campaignId;
 if(dimension==='campaignUnit')return row.campaignId;
 if(dimension==='device')return row.device;
 if(dimension==='product')return (row as Breakdown).key;
 return JSON.stringify([row.campaignId,(row as Breakdown)[dimension]]);
}
export function groupLabel(data:TrainingData,row:AnalysisRow,dimension:AnalysisDimension):string{
 if(dimension==='campaign')return campaignParents[row.campaignId]?.label||campaignDisplayName(data,row.campaignId);
 if(dimension==='campaignUnit')return campaignUnitLabel(data,row.campaignId);
 if(dimension==='device')return row.device==='mobile'?'모바일':'PC';
 if(dimension==='product')return data.products.find(p=>p.id===(row as Breakdown).key)?.label||(row as Breakdown).key;
 return displayTrainingText(campaignDisplayName(data,row.campaignId)+', '+(row as Breakdown)[dimension]);
}
export function analysisRows(data:TrainingData,filters:Filters,metric:string,dimension:AnalysisDimension):AnalysisRow[]{
 const rows=dimension==='product'?selectBreakdowns(data,filters,'product'):['campaign','campaignUnit','device'].includes(dimension)?selectFacts(data,filters):selectBreakdowns(data,filters,'traffic');
 return rows.filter(row=>(metric!=='adCtr'||row.exposureBasis==='ad_impression')&&(dimension!=='keyword'||Boolean((row as Breakdown).keyword)));
}
export function analysisDimensions(data:TrainingData,filters:Filters,metric:string):AnalysisDimension[]{
 const facts=selectFacts(data,filters).filter(r=>metric!=='adCtr'||r.exposureBasis==='ad_impression');
 const candidates:AnalysisDimension[]=metric==='adCtr'?['creativeId','placement','audienceId']:metric==='cpc'?['campaign','placement','audienceId']:['campaign','device','audienceId'];
 if(['cpc','adCtr'].includes(metric)&&facts.length&&facts.every(r=>data.campaigns.find(c=>c.id===r.campaignId)?.channel==='search'))candidates.push('keyword');
 return candidates.filter(d=>['campaign','device'].includes(d)||analysisRows(data,filters,metric,d).length>0);
}

export function analyzeGroups(data:TrainingData,rows:AnalysisRow[],metric:string,dimension:AnalysisDimension){
 const [numerator,denominator]=pairDefinitions[metric];
 const periods=['baseline','current'];
 const totals=periods.map(period=>summarize(rows.filter(r=>r.periodId===period)));
 const overall=totals.map(t=>divide(t[numerator as keyof Total] as number,t[denominator as keyof Total] as number));
 const center=overall.every(v=>v!==null)?(overall[0]!+overall[1]!)/2:null;
 const grouped=new Map<string,AnalysisRow[]>();
 for(const row of rows){const key=groupKey(row,dimension);if(!grouped.has(key))grouped.set(key,[]);grouped.get(key)!.push(row);}
 const groups=[...grouped].map(([key,sourceRows])=>{
  const periodRows=periods.map(period=>sourceRows.filter(r=>r.periodId===period));
  const pair=periodRows.map(summarize);
  const n=pair.map(t=>t[numerator as keyof Total] as number),d=pair.map(t=>t[denominator as keyof Total] as number);
  const D=totals.map(t=>t[denominator as keyof Total] as number),weights=d.map((v,i)=>divide(v,D[i]));
  const values=n.map((v,i)=>periodRows[i].length?divide(v,d[i]):null);
  // Center the mix effect so moving spend to below-average efficiency has a negative ROAS effect.
  const roasContribution=metric==='roas'?roasImpactPp(totals[0],totals[1],pair[0],pair[1]):null;
  const impact=metric==='roas'?(roasContribution===null?null:roasContribution/100)
   :center===null?null:n[1]/D[1]-n[0]/D[0]-center*(weights[1]!-weights[0]!);
  const separable=impact!==null&&values.every(v=>v!==null);
  const efficiency=separable?(weights[0]!+weights[1]!)/2*(values[1]!-values[0]!):null;
  const mix=separable?(weights[1]!-weights[0]!)*((values[0]!+values[1]!)/2-center!):null;
  return {key,label:groupLabel(data,sourceRows[0],dimension),rows:sourceRows,periodRows,before:pair[0],after:pair[1],values,weights,impact,efficiency,mix};
 });
 return {groups,totals,overall,change:overall.every(v=>v!==null)?overall[1]!-overall[0]!:null,denominator};
}
export type GroupAnalysis=ReturnType<typeof analyzeGroups>;
export type AnalysisGroup=GroupAnalysis['groups'][number];
export function sortAnalysisGroups(analysis:GroupAnalysis,metric:string,settings:AnalysisSettings){
 const basis=settings.sortBasis==='change'&&metric==='roas'?'change':settings.sortBasis==='value'||settings.sortBasis==='change'?'value':'impact',key=settings.sortKey||metric;
 return [...analysis.groups].sort((a,b)=>{
  const value=(g:AnalysisGroup)=>{if(basis==='impact')return g.impact;const after=g.periodRows[1].length?analysisValue(g.after,key,analysis.totals[1]):null;if(basis==='value')return after;const before=g.periodRows[0].length?analysisValue(g.before,key,analysis.totals[0]):null;return metricChange(before,after,analysisMetric(key).rate);};
  const av=value(a),bv=value(b);if(av===null)return bv===null?a.key.localeCompare(b.key):1;if(bv===null)return -1;
  if(basis==='impact'&&settings.descending===undefined){return (analysis.change===0?Math.abs(bv)-Math.abs(av):Math.sign(analysis.change||1)*(bv-av))||a.key.localeCompare(b.key);}
  return (settings.descending===false?1:-1)*(av-bv)||a.key.localeCompare(b.key);
 });
}

export function factorEffects(kind:'roas'|'cpa'|'cpc',before:Record<string,number|null>,after:Record<string,number|null>,content=false){
 const keys=kind==='roas'?['aov','cvr','cpc']:kind==='cpa'?['cpc','cvr']:content?['contentCpm','contentClickRate']:['adCpm','adCtr'];
 const prior=keys.map(k=>before[k]),current=keys.map(k=>after[k]);
 if([...prior,...current].some(v=>v===null||!Number.isFinite(v))||prior.at(-1)!<=0||current.at(-1)!<=0)return null;
 const start=prior as number[],end=current as number[];
 const evaluate=(v:number[])=>kind==='roas'?v[0]*v[1]/v[2]:kind==='cpa'?v[0]/v[1]:v[0]/(1000*v[1]);
 const orders=keys.length===3?[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]:[[0,1],[1,0]];
 const impact=keys.map(()=>0);
 for(const order of orders){const v=[...start];for(const i of order){const previous=evaluate(v);v[i]=end[i];impact[i]+=(evaluate(v)-previous)/orders.length;}}
 return keys.map((key,i)=>({key,before:start[i],after:end[i],impact:impact[i]}));
}

// Traffic and product are alternative partitions. A traffic slice cannot reconstruct product totals.
export function scopeTrainingData(data:TrainingData,scope:AnalysisScope|null):TrainingData{
 if(!scope)return data;
 const ids=scope.rowIds?new Set(scope.rowIds):null;
 const traffic=data.breakdowns.filter(r=>r.dimension==='traffic'&&(ids?ids.has(r.id):groupKey(r,scope.dimension)===scope.key));
 const campaigns=new Set(traffic.map(r=>r.campaignId));
 return {...data,facts:traffic,breakdowns:traffic,reach:[],records:data.records.filter(r=>!r.campaignId||campaigns.has(r.campaignId))};
}
