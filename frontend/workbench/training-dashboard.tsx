'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,BarChart3,Layers,Menu,Search,Sparkles,X} from 'lucide-react';
import {RoasConversation} from './roas-conversation';
import type {RoasAnswer} from './agent-client';
import {CartesianGrid,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import {campaignDisplayName,displayTrainingText,changeTrainingMedia,comparePeriods,metricPeriodSeries,metricValue,metricChange,metricMissingReason,selectBreakdowns,selectFacts,selectRecords,summarize,trainingViews,trainingCostDefinition} from '../../shared/training-dashboard.mjs';
import type {Breakdown,Fact,Filters,Total,TrainingData} from '../../shared/training-dashboard.mjs';
import './roas-workbench.css';
import './training-dashboard.css';
import TrainingScopePicker from './training-scope-picker';
import {deltaTone,miniPlotDomain,plotUpper,prioritizeColumns} from './training-presentation';

type Index={contract:string;cases:{id:string;label:string}[];snapshots:{id:string;label:string;asOf:string}[]};
type Evidence={title:string;rows:object[]};
type Metric={key:string;label:string;rate?:boolean;unit?:string};
type TableSettings={dimension?:string;sortKey?:string;sortBasis?:'current'|'change';descending?:boolean;recordCategory?:string};
type TableControls={settings:TableSettings;onSettings:(patch:TableSettings)=>void};
type TableControlFor=(key:string)=>TableControls;
const dimensions=[['campaign','캠페인'],['channel','채널'],['source','출처'],['device','기기'],['creativeId','소재'],['audienceId','타깃'],['placement','지면'],['keyword','검색어'],['product','상품'],['paymentMethod','결제 수단'],['browser','브라우저']];
const metricPresets:Record<string,string[]>={roas:['performance','measurement'],adCtr:['traffic'],cpc:['traffic'],cvr:['funnel','payment','measurement'],cpa:['performance','funnel','payment'],aov:['commerce'],cac:['performance']};
const caseDescriptions:Record<string,string>={
 S01:'클릭 한 번에 드는 비용이 늘어난 사례입니다. 비용 상승 구간을 찾아봅니다.',
 S02:'방문 후 구매로 이어지는 비율이 낮아진 사례입니다. 구매 과정에서 막히는 단계를 찾아봅니다.',
 S03:'주문당 구매금액이 줄어든 사례입니다. 어떤 상품이 더 많이 팔렸는지 비교합니다.',
 S04:'구매로 이어지는 비율이 높아진 사례입니다. 성과 유지와 광고 확대의 조건을 살펴봅니다.',
 S05:'클릭은 늘었지만 구매 성과는 나빠진 사례입니다. 광고 내용과 실제 판매 조건을 비교합니다.',
 S06:'유료 마케팅 집행비 대비 매출은 좋아졌지만 매출 규모는 줄어든 사례입니다. 효율과 매출 목표를 함께 봅니다.',
 S07:'각 캠페인의 효율은 그대로인데 전체 성과가 달라진 사례입니다. 유료 마케팅 집행비 배분을 비교합니다.',
 S08:'유료 마케팅 집행비를 늘린 뒤 매출보다 비용이 더 빠르게 증가한 사례입니다. 추가 확대 여부를 판단합니다.',
 S09:'같은 광고의 반복 노출과 클릭 반응을 살펴보는 사례입니다. 소재 교체가 필요한지 조사합니다.',
 S10:'광고를 보여주는 대상을 넓힌 사례입니다. 기존 대상과 새로 확대한 대상의 성과를 비교합니다.',
 S11:'품절 상품에도 광고 유입이 이어지는 사례입니다. 판매 가능 상태와 광고 연결을 확인합니다.',
 S12:'할인 종료 후 주문당 금액과 구매율이 함께 바뀐 사례입니다. 매출과 효율을 함께 비교합니다.',
 S13:'결제 오류로 구매가 줄어든 사례입니다. 기기와 결제 수단별로 문제 범위를 좁힙니다.',
 S14:'실제 주문보다 대시보드에 적게 기록된 사례입니다. 주문 기록과 수집 상태를 대조합니다.',
 S15:'광고를 본 뒤 며칠 지나 구매하는 사례입니다. 보고 기준시점을 바꿔 뒤늦게 반영된 구매를 확인합니다.',
 S16:'예산 확대, 모바일 결제 오류, 소재 개선이 겹친 기본 사례입니다. 여러 변화의 영향을 나눠 조사합니다.',
 S17:'광고 축소와 할인 종료가 겹쳐 효율은 좋아지고 매출은 줄어든 사례입니다. 유지와 확대 조건을 구분합니다.',
 S18:'품절, 소개 상품 변경, 모바일 로딩 지연이 겹친 사례입니다. 정상 상품과 경로를 함께 비교합니다.',
};
const names:Record<string,string>={all:'전체',search:'검색',social:'소셜',content:'콘텐츠',mobile:'모바일',desktop:'PC',google:'구글',facebook:'페이스북',instagram:'인스타그램',naver_blog:'네이버 블로그',search_ads:'검색광고',feed_ads:'피드광고',blog_affiliate:'블로그 클릭 제휴',creator_affiliate:'크리에이터 클릭 제휴',core:'기존 타깃',extended:'확장 타깃',baseline:'직전 14일',current:'분석 기간'};
const metrics:Metric[]=[{key:'roas',label:'ROAS',rate:true},{key:'revenue',label:'구매 전환 매출',unit:'원'},{key:'spend',label:'유료 마케팅 집행비',unit:'원'},{key:'orders',label:'구매 주문',unit:'건'},{key:'cpc',label:'CPC',unit:'원'},{key:'cvr',label:'클릭 기준 구매율',rate:true},{key:'aov',label:'AOV',unit:'원'},{key:'cpa',label:'구매 CPA',unit:'원'},{key:'adCtr',label:'광고 CTR',rate:true},{key:'contentClickRate',label:'콘텐츠 링크 클릭률',rate:true},{key:'adCpm',label:'광고 CPM',unit:'원'},{key:'contentCpm',label:'조회 1,000회당 비용',unit:'원'}];
const get=(total:Total,key:string):number|null=>{const pairs:Record<string,[number,number]>={viewRate:[total.view,total.sessions],cartRate:[total.cart,total.view],beginRate:[total.checkout,total.cart],unitPrice:[total.listRevenue,total.units],discountRate:[total.discount,total.listRevenue]};if(key in pairs){const [a,b]=pairs[key];return b?a/b:null;}return key in total.rates?total.rates[key as keyof Total['rates']]:total[key as keyof typeof total] as number;};
const fmt=(value:number|null|undefined,rate=false,unit='')=>value==null?'—':Number(rate?value*100:value).toLocaleString('ko-KR',{maximumFractionDigits:1})+(rate?'%':unit);
const change=(a:number|null,b:number|null,rate=false)=>a==null||b==null?'비교 불가':rate?`${b-a>0?'+':''}${fmt((b-a)*100)}%p`:a===0?(b===0?'0%':'기준값 0'):`${b>a?'+':''}${fmt((b/a-1)*100)}%`;
const periodLabel=(start:string,end:string)=>`${start.replaceAll('-','.')} ~ ${new Date(Date.parse(end+'T00:00:00Z')-86400000).toISOString().slice(0,10).replaceAll('-','.')}`;
const ratio=(a:number,b:number|null)=>b?a/b:null;
function MetricCell({value,metric,rows,before=null}:{value:number|null|undefined;metric:Metric;rows:Fact[];before?:number|null}){
 if(value!=null)return <span className={`training-delta-${deltaTone(metric.key,before,value,metric.rate)}`}>{fmt(value,metric.rate,metric.unit)}</span>;
 const missing=metricMissingReason(rows,metric.key);
 return <span className="training-missing-value" tabIndex={0} title={missing.reason} aria-label={`${missing.label}: ${missing.reason}`}>{missing.label}</span>;
}
function Delta({before,after,rate=false,metricKey}:{before:number|null;after:number|null;rate?:boolean;metricKey:string}){
 return <span className={`training-delta training-delta-${deltaTone(metricKey,before,after,rate)}`}>{change(before,after,rate)}</span>;
}

function RoasSummary({before,after}:{before:number|null;after:number|null}){
 const tone=deltaTone('roas',before,after,true);
 const path=tone==='neutral'?'M5 24H49M37 12L49 24L37 36':'M5 8L19 23L29 15L48 38M35 38H48V25';
 return <section className={`roas-primary-kpi training-roas-summary training-delta-${tone}`} aria-labelledby="training-roas-title">
  <h3 id="training-roas-title" className="training-roas-heading">ROAS <span>구매 전환 매출 기준</span></h3>
  <div className="training-roas-direction"><svg viewBox="0 0 56 48" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} transform={tone==='positive'?'translate(0 48) scale(1 -1)':undefined}/></svg><p className="training-roas-reference">직전 14일: {fmt(before,true)}</p></div>
  <div className="training-roas-value-row"><strong className="training-roas-current">{fmt(after,true)}</strong><span className="training-roas-change" title="%p는 퍼센트포인트로, 두 ROAS 비율의 차이입니다.">{tone!=='neutral'&&<svg viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M1 2H9L5 9Z" transform={tone==='positive'?'translate(0 10) scale(1 -1)':undefined}/></svg>}<Delta metricKey="roas" before={before} after={after} rate/></span></div>
 </section>;
}

const recordCategories:Record<string,string>={campaign:'캠페인 설정',change:'운영 변경',creative:'소재 변경',incident:'장애와 점검',inventory:'상품과 재고',landing:'랜딩 페이지',tracking:'계측 설정'};
const evidenceFieldNames:Record<string,string>={id:'기록 ID',date:'일자',category:'기록 종류',campaignId:'캠페인',device:'기기',productId:'상품',title:'내용',values:'상세 항목',periodId:'기간',exposureBasis:'노출 집계 기준',source:'출처',creativeId:'소재 ID',audienceId:'타깃 ID',placement:'게재 위치',keyword:'검색어',browser:'브라우저',paymentMethod:'결제 수단',impressions:'노출 또는 조회',clicks:'클릭 수',spend:'유료 마케팅 집행비, 원',orders:'구매 주문 수',revenue:'매출, 원',sessions:'랜딩 세션 수',view:'상품 조회 수',cart:'장바구니 수',checkout:'결제 시작 수',purchases:'같은 세션 구매 수',returnPurchases:'재방문 구매 수',units:'판매 수량',listRevenue:'할인 전 상품금액, 원',discount:'할인액, 원',ledgerOrders:'주문 원장 주문 수',ledgerRevenue:'주문 원장 매출, 원',paymentAttempts:'결제 시도 수',paymentFailures:'결제 실패 수',redirectErrors:'리디렉션 오류 수',loadTotalMs:'로드 시간 합계, ms',loadSamples:'로드 측정 수',trackingExpected:'수집 대상 이벤트 수',trackingReceived:'수집 이벤트 수',duplicateEvents:'중복 이벤트 수'};
function EvidenceFields({row,data}:{row:object;data:TrainingData|null}){
 function display(key:string,value:unknown){
  if(value===null||value===undefined)return key==='campaignId'?'공통':key==='productId'?'특정 상품 미지정':'값 없음';
  if(key==='category')return recordCategories[String(value)]||String(value);
  if(key==='device'||key==='periodId')return names[String(value)]||String(value);
  if(key==='campaignId'&&data)return `${campaignDisplayName(data,String(value))} (${displayTrainingText(value)})`;
  if(key==='productId'&&data)return data.products.find(product=>product.id===value)?.label||String(value);
  return displayTrainingText(typeof value==='number'?value.toLocaleString('ko-KR'):value);
 }
 return <dl className="roas-evidence-facts">{Object.entries(row).map(([key,value])=><div className="training-detail-field" key={key}><dt>{evidenceFieldNames[key]||key}</dt><dd>{value!==null&&typeof value==='object'?<EvidenceFields row={value} data={data}/>:display(key,value)}</dd></div>)}</dl>;
}

const focusMetrics:Metric[]=[{key:'roas',label:'ROAS',rate:true},{key:'adCtr',label:'CTR',rate:true},{key:'cpc',label:'CPC',unit:'원'},{key:'cvr',label:'CVR',rate:true},{key:'cpa',label:'CPA',unit:'원'},{key:'cac',label:'CAC',unit:'원'},{key:'aov',label:'AOV',unit:'원'}];
const metricDescriptions:Record<string,string>={roas:'구매 전환 매출 / 유료 마케팅 집행비',adCtr:'광고 클릭 / 광고 노출, 콘텐츠 조회 제외',cpc:'유료 마케팅 집행비 / 클릭',cvr:'귀속 구매 주문 / 클릭',cpa:'유료 마케팅 집행비 / 구매 주문',cac:'신규 고객 획득 비용, 신규 고객 수 미집계',aov:'구매 전환 매출 / 구매 주문'};
function PeriodPlot({data,filters,metric,mini=false}:{data:TrainingData;filters:Filters;metric:Metric;mini?:boolean}){
 const series=metricPeriodSeries(data,filters,metric.key);
 const present=series.some(row=>row.baseline!==null||row.current!==null);
 if(!present){const missing=metricMissingReason(selectFacts(data,filters),metric.key);return <div className={mini?'training-mini-empty':'training-chart-empty'} title={missing.reason} tabIndex={0} aria-label={`${missing.label}: ${missing.reason}`}>{mini?(metric.key==='cac'?'신규 고객 수 미집계':missing.label):missing.reason}</div>;}
 const values=series.flatMap(row=>[row.baseline,row.current]);
 const [lower,upper]=mini?miniPlotDomain(values):[0,plotUpper(values)];
 return <><div className={mini?'training-sparkline':'training-period-chart'} role="img" aria-label={`${metric.label}, 직전 14일과 분석 기간의 일별 추이, 공통 축 ${fmt(lower,metric.rate,metric.unit)}~${fmt(upper,metric.rate,metric.unit)}`}>
  <ResponsiveContainer width="100%" height={mini?176:'100%'}><LineChart data={series} margin={mini?{top:12,right:6,bottom:12,left:0}:{top:14,right:18,bottom:6,left:0}}>
   {!mini&&<>
    <CartesianGrid stroke="#EDF0F5" vertical={false} strokeDasharray="3 5"/>
    <XAxis dataKey="day" ticks={[1,5,10,14]} tickFormatter={day=>series.find(row=>row.day===Number(day))?.currentDate.slice(5).replace('-','/')||''} axisLine={false} tickLine={false} tick={{fill:'#8791A2',fontSize:11}} tickMargin={12}/>
   </>}
   <YAxis domain={[lower,upper]} ticks={mini?[lower,upper]:[0,upper/2,upper]} interval={0} tickFormatter={value=>fmt(Number(value),metric.rate,metric.unit)} width={mini?62:66} axisLine={false} tickLine={false} tick={{fill:mini?'#929BA8':'#8791A2',fontSize:mini?10:11}} tickMargin={mini?6:12}/>
   {mini&&<XAxis dataKey="day" hide/>}
   <Tooltip labelFormatter={day=>{const point=series.find(row=>row.day===Number(day));return point?`${metric.label}, 분석 ${point.currentDate.slice(5)}, 직전 ${point.baselineDate.slice(5)}`:'';}} formatter={(value,name)=>[fmt(Number(value),metric.rate,metric.unit),name]} contentStyle={{border:'1px solid #E8E4F0',borderRadius:8,fontSize:12,boxShadow:'0 4px 16px #27354B0A'}} wrapperStyle={{zIndex:100,pointerEvents:'none'}} cursor={{stroke:'#D9D2E7',strokeDasharray:'3 4'}}/>
   <Line name="직전 14일" dataKey="baseline" stroke="#9BA8B9" strokeWidth={mini?1.5:1.8} strokeDasharray="4 4" dot={false} activeDot={{r:3,stroke:'#FFF',strokeWidth:2}} isAnimationActive={false}/>
   <Line name="분석 기간" dataKey="current" stroke="#7357BA" strokeWidth={mini?2:2.8} dot={false} activeDot={{r:4,stroke:'#FFF',strokeWidth:2}} isAnimationActive={false}/>
  </LineChart></ResponsiveContainer>
 </div></>;
}
function PlotLegend({daily=false}:{daily?:boolean}){return <div className={`training-chart-legend ${daily?'':'training-bar-legend'}`}><span><i/>직전 14일</span><span><i/>분석 기간</span><small>{daily?'가로축은 분석 날짜, 직전 14일의 같은 요일과 비교':'각 기간의 집계값 비교'}</small></div>;}
function FunnelComparison({before,after}:{before:Total;after:Total}){
 const stages=[['sessions','랜딩 세션'],['view','상품 조회'],['cart','장바구니'],['checkout','결제 시작'],['purchases','같은 세션 구매']];
 const maximum=Math.max(before.sessions,after.sessions);
 return <section className="roas-card training-funnel"><h3>구매 과정, 어디서 빠져나갔나요?</h3><div className="training-funnel-head"><span>단계</span><span>직전 14일</span><span>분석 기간</span></div>{stages.map(([key,label],index)=><div className="training-funnel-step" key={key}><strong>{label}</strong>{[before,after].map((total,i)=>{const count=get(total,key)||0,previous=index?get(total,stages[index-1][0])||0:null;const lost=previous===null?null:previous-count;return <div key={i}><div className="training-bar-track"><i className={i?'current':''} style={{width:`${maximum?count/maximum*100:0}%`}}/></div><b>{fmt(count)}</b>{lost!==null&&<small>이전 단계에서 {fmt(lost)} 이탈 ({fmt(ratio(lost,previous),true)})</small>}</div>;})}</div>)}<p className="roas-data-note">같은 인원 눈금으로 비교합니다. 같은 세션에서 순차 도달한 수이며 재방문 구매는 제외합니다. 이탈이 곧 결제 오류를 뜻하지는 않습니다.</p></section>;
}
function MetricCards({data,filters,before,after,onSelect}:{data:TrainingData;filters:Filters;before:Total;after:Total;onSelect:(key:string)=>void}){
 return <div className="training-indicator-grid">{focusMetrics.slice(1).map(metric=><article className="training-indicator" key={metric.key} aria-label={metric.label}><div className="training-indicator-title"><span>{metric.label}</span><button onClick={()=>onSelect(metric.key)} aria-label={`${metric.label} 상세 분석`}>상세 분석 ↗</button></div><div className="training-indicator-value"><strong><MetricCell value={metricValue(after,metric.key)} metric={metric} rows={selectFacts(data,filters).filter(r=>r.periodId==='current')}/></strong><Delta metricKey={metric.key} before={metricValue(before,metric.key)} after={metricValue(after,metric.key)} rate={metric.rate}/></div><PeriodPlot data={data} filters={filters} metric={metric} mini/></article>)}</div>;
}
function ComparisonBars({rows,metric,group,label,onSelect}:{rows:(Fact|Breakdown)[];metric:Metric;group:(row:Fact|Breakdown)=>string;label:(key:string)=>string;onSelect?:(key:string)=>void}){
 const groups=[...new Set(rows.map(group))].map(key=>({key,before:metricValue(summarize(rows.filter(r=>group(r)===key&&r.periodId==='baseline')),metric.key),after:metricValue(summarize(rows.filter(r=>group(r)===key&&r.periodId==='current')),metric.key)})).sort((a,b)=>(b.after??-Infinity)-(a.after??-Infinity)||a.key.localeCompare(b.key));
 const maximum=Math.max(0,...groups.flatMap(row=>[row.before||0,row.after||0]));
 const step=10**Math.floor(Math.log10(maximum||1)),upper=maximum?Math.ceil(maximum/step)*step:1;
 return <div className="training-comparison-bars"><div className="training-comparison-axis"><span>{metric.label}</span><div><span>{fmt(0,metric.rate,metric.unit)}</span><span>{fmt(upper/2,metric.rate,metric.unit)}</span><span>{fmt(upper,metric.rate,metric.unit)}</span></div><span>직전 / 현재</span><span>증감{metric.rate?' (%p)':''}</span></div>{groups.map(row=><div className="training-paired-row" key={row.key}><div>{onSelect?<button onClick={()=>onSelect(row.key)} title="이 캠페인으로 필터">{label(row.key)}</button>:<span>{label(row.key)}</span>}</div><div className="training-paired-plot">{(['before','after'] as const).map((period,index)=><div className="training-bar-track" key={period}><i className={index?'current':''} style={{width:`${(row[period]||0)/upper*100}%`}}/></div>)}</div><div className="training-paired-values">{(['before','after'] as const).map((period,index)=><span key={period} className={index?'current':''}><MetricCell value={row[period]} before={period==='after'?row.before:null} metric={metric} rows={rows.filter(r=>group(r)===row.key&&r.periodId===(period==='before'?'baseline':'current'))}/></span>)}</div><div className="training-paired-delta"><Delta metricKey={metric.key} before={row.before} after={row.after} rate={metric.rate}/></div></div>)}{!groups.length&&<p className="roas-data-note">선택 범위의 데이터가 없습니다.</p>}</div>;
}

function DeviceSelection({device,onDevice}:{device:string;onDevice:(device:string)=>void}){
 return <label className="training-local-device">상세 조회 기기<select aria-label="상세 조회 기기" value={device} onChange={event=>onDevice(event.target.value)}>{['all','mobile','desktop'].map(key=><option key={key} value={key}>{key==='all'?'전체 기기':names[key]}</option>)}</select></label>;
}

function DeviceComparison({metric,data,filters,onEvidence,tableControlFor,onDevice}:{metric:Metric;data:TrainingData;filters:Filters;onEvidence:(e:Evidence)=>void;tableControlFor:TableControlFor;onDevice:(device:string)=>void}){
 const rows=selectFacts(data,{...filters,device:'all'}).filter(row=>metric.key!=='adCtr'||row.exposureBasis==='ad_impression');
 const keys=[...new Set([metric.key,'roas','cvr','cpc','adCtr','revenue','spend','orders'])];
 const items=keys.flatMap(key=>metrics.filter(item=>item.key===key));
 return <div className="training-device-comparison">
  <GroupTable title="기기별 성과 비교" rows={rows} group={row=>row.device} label={key=>names[key]||key} items={items} onEvidence={onEvidence} {...tableControlFor('devices:'+metric.key)} expanded/>
  <div className="training-device-followup"><p>위 표는 선택한 캠페인의 모바일과 PC를 함께 비교합니다.</p><DeviceSelection device={filters.device} onDevice={onDevice}/></div>
 </div>;
}

function MetricDetails({metric,data,filters,onEvidence,tableControlFor,onDevice}:{metric:Metric;data:TrainingData;filters:Filters;onEvidence:(e:Evidence)=>void;tableControlFor:TableControlFor;onDevice:(device:string)=>void}){
 const [before,after]=comparePeriods(data,filters),rows=selectFacts(data,filters);
 const related:Record<string,string[]>={roas:['revenue','spend','cpc','cvr','aov'],adCtr:['impressions','clicks','adCpm','cpc'],cpc:['spend','clicks','adCpm','adCtr'],cvr:['clicks','orders','sessionCvr','checkoutRate'],cpa:['spend','orders','cpc','cvr'],aov:['revenue','orders','unitPrice','discountRate'],cac:['spend']};
 const definitions:Metric[]=[...metrics,{key:'impressions',label:'광고 노출'},{key:'clicks',label:'클릭'},{key:'sessionCvr',label:'세션 구매율',rate:true},{key:'checkoutRate',label:'결제 완료율',rate:true},{key:'unitPrice',label:'할인 전 상품 단가',unit:'원'},{key:'discountRate',label:'금액 할인율',rate:true}];
 const items=(related[metric.key]||[]).map(key=>definitions.find(m=>m.key===key)!).filter(Boolean);
 const comparedRows=metric.key==='adCtr'?rows.filter(r=>r.exposureBasis==='ad_impression'):rows;
 const comparedBefore=summarize(comparedRows.filter(r=>r.periodId==='baseline')),comparedAfter=summarize(comparedRows.filter(r=>r.periodId==='current'));
 const sku=selectBreakdowns(data,filters,'product');
 return <div className="training-metric-detail">
  <div className="training-detail-heading"><h1><span tabIndex={0} title={metricDescriptions[metric.key]}>{metric.label}</span> 상세 분석</h1><div className="training-detail-values"><div><span>분석 기간</span><strong><MetricCell value={metricValue(after.total,metric.key)} before={metricValue(before.total,metric.key)} metric={metric} rows={after.rows}/></strong></div><div><span>직전 14일</span><b><MetricCell value={metricValue(before.total,metric.key)} metric={metric} rows={before.rows}/></b></div><div><span>직전 대비</span><b><Delta metricKey={metric.key} before={metricValue(before.total,metric.key)} after={metricValue(after.total,metric.key)} rate={metric.rate}/></b></div></div></div>
  {metric.key==='cac'?<section className="roas-card"><h3>CAC 계산에 필요한 정보</h3><p className="roas-data-note">신규 고객 수가 없어 계산할 수 없습니다. 기존 고객의 재구매가 포함될 수 있는 구매 주문 수와 구분합니다.</p><Comparison before={before.total} after={after.total} beforeRows={before.rows} afterRows={after.rows} items={items}/></section>:<>
   <section className="roas-card"><h3>{metric.label} 기간별 추이</h3><PlotLegend daily/><PeriodPlot data={data} filters={filters} metric={metric}/></section>
   <section className="roas-card"><h3>계산에 연결된 지표</h3><Comparison before={comparedBefore} after={comparedAfter} beforeRows={comparedRows.filter(r=>r.periodId==='baseline')} afterRows={comparedRows.filter(r=>r.periodId==='current')} items={items}/></section>
   <DeviceComparison metric={metric} data={data} filters={filters} onEvidence={onEvidence} tableControlFor={tableControlFor} onDevice={onDevice}/><div className="training-detail-comparisons"><section className="roas-card"><h3>{metric.key==='aov'?'상품별':'캠페인별'} {metric.label}</h3><PlotLegend/><ComparisonBars rows={metric.key==='aov'?sku:comparedRows} metric={metric} group={r=>metric.key==='aov'?(r as Breakdown).key:r.campaignId} label={key=>metric.key==='aov'?data.products.find(p=>p.id===key)?.label||key:campaignDisplayName(data,key)}/></section></div>
   <GroupTable title={metric.label+' 캠페인별 수치'} rows={comparedRows} group={r=>r.campaignId} label={key=>campaignDisplayName(data,key)} items={[metric,...items.filter(item=>item.key!==metric.key)].slice(0,5)} onEvidence={onEvidence} {...tableControlFor("detail:"+metric.key)} expanded/>
   {['cvr','cpa'].includes(metric.key)&&<FunnelComparison before={before.total} after={after.total}/>}
  </>}
 </div>;
}

function Comparison({before,after,items=metrics,beforeRows=[],afterRows=[]}:{before:Total;after:Total;items?:Metric[];beforeRows?:Fact[];afterRows?:Fact[]}){
 return <div className="wb-table-scroll"><table><thead><tr><th>지표</th><th className="numeric">직전 14일</th><th className="numeric">분석 기간</th><th className="numeric">증감</th></tr></thead><tbody>{items.map(m=><tr key={m.key}><td>{m.label}</td><td className="numeric"><MetricCell value={get(before,m.key)} metric={m} rows={beforeRows}/></td><td className="numeric"><MetricCell value={get(after,m.key)} before={get(before,m.key)} metric={m} rows={afterRows}/></td><td className="numeric"><Delta metricKey={m.key} before={get(before,m.key)} after={get(after,m.key)} rate={m.rate}/></td></tr>)}</tbody></table></div>;
}

function DataWorkspace({data,filters,metricKey,preset:requestedPreset,setPreset,onEvidence,tableControlFor,onNotice,onDevice}:{data:TrainingData;filters:Filters;metricKey:string;preset:string;setPreset:(value:string)=>void;onEvidence:(value:Evidence)=>void;tableControlFor:TableControlFor;onNotice:(message:string)=>void;onDevice:(device:string)=>void}){
 const availablePresets=metricPresets[metricKey]||['performance'];
 const preset=availablePresets.includes(requestedPreset)?requestedPreset:availablePresets[0];
 const controls=tableControlFor('compare:'+metricKey+':'+preset);
 const chosenDimension=controls.settings.dimension;
 const allowedDimensions:Record<string,string[]>={performance:['campaign','device'],traffic:['creativeId','audienceId','placement','keyword'],funnel:['device','campaign'],commerce:['product'],payment:['paymentMethod','browser','device'],measurement:['campaign','device']};
 const supported=(allowedDimensions[preset]||allowedDimensions.performance).filter(key=>key!=='keyword'||selectFacts(data,filters).some(r=>data.campaigns.some(c=>c.id===r.campaignId&&c.channel==='search')));
 const dimension=chosenDimension&&supported.includes(chosenDimension)?chosenDimension:supported[0];
 useEffect(()=>{
  if(chosenDimension&&chosenDimension!==dimension){
   controls.onSettings({dimension});
   onNotice(`선택한 범위에는 ${dimensions.find(([key])=>key===chosenDimension)?.[1]} 자료가 없어 ${dimensions.find(([key])=>key===dimension)?.[1]}별 비교로 변경했습니다.`);
  }
  if(dimension==='device'&&filters.device!=='all'){
   onDevice('all');
   onNotice('모바일과 PC를 비교하도록 상세 조회 범위를 전체 기기로 변경했습니다.');
  }
 },[chosenDimension,dimension,controls,onNotice,filters.device,onDevice]);
 const presetNames:Record<string,string>={performance:'성과 비교',traffic:'유입과 클릭',funnel:'구매 퍼널',commerce:'상품과 매출',payment:'결제 실패',measurement:'계측 대조'};
 const metricSets:Record<string,Metric[]>={performance:metrics,traffic:[{key:'impressions',label:'노출/조회'},{key:'clicks',label:'클릭'},...metrics.filter(m=>['adCtr','contentClickRate','adCpm','contentCpm','cpc'].includes(m.key)),{key:'sessions',label:'랜딩 세션'},{key:'redirectErrors',label:'리디렉션 오류'},{key:'loadMs',label:'평균 로드 시간',unit:'ms'}],funnel:[{key:'sessions',label:'랜딩 세션'},{key:'view',label:'상품 조회'},{key:'viewRate',label:'상품 조회율',rate:true},{key:'cart',label:'장바구니'},{key:'cartRate',label:'장바구니율',rate:true},{key:'checkout',label:'결제 시작'},{key:'beginRate',label:'결제 시작률',rate:true},{key:'purchases',label:'같은 세션 구매'},{key:'sessionCvr',label:'세션 구매율',rate:true},{key:'checkoutRate',label:'결제 완료율',rate:true},{key:'returnPurchases',label:'재방문 구매'}],commerce:[{key:'orders',label:'주문'},{key:'units',label:'수량'},{key:'unitPrice',label:'할인 전 단가',unit:'원'},{key:'listRevenue',label:'할인 전 금액',unit:'원'},{key:'discount',label:'할인액',unit:'원'},{key:'discountRate',label:'금액 할인율',rate:true},{key:'revenue',label:'구매 전환 매출',unit:'원'},{key:'aov',label:'AOV',unit:'원'}],payment:[{key:'checkout',label:'결제 시작'},{key:'paymentAttempts',label:'결제 시도'},{key:'paymentFailures',label:'결제 실패'},{key:'paymentFailureRate',label:'실패율',rate:true}],measurement:[{key:'orders',label:'계측 주문'},{key:'ledgerOrders',label:'주문 원장 주문'},{key:'revenue',label:'계측 구매 전환 매출',unit:'원'},{key:'ledgerRevenue',label:'주문 원장 구매 전환 매출',unit:'원'},{key:'trackingExpected',label:'수집 대상 이벤트'},{key:'trackingReceived',label:'수집 이벤트'},{key:'duplicateEvents',label:'중복 이벤트'}]};
 const availableItems=metricSets[preset]||metrics;
 const extraKeys=metricKey==='cpc'&&preset==='traffic'?['spend']:metricKey==='cvr'&&preset==='funnel'?['cvr','orders']:[];
 const extraItems=[...metrics.filter(item=>extraKeys.includes(item.key)),...(metricKey==='cvr'&&preset==='funnel'?[{key:'clicks',label:'클릭'}]:[])];
 const items=prioritizeColumns([...availableItems,...extraItems],metricKey);
 const facts=selectFacts(data,filters).filter(row=>metricKey!=='adCtr'||row.exposureBasis==='ad_impression');
 const isTraffic=['creativeId','audienceId','placement','keyword','paymentMethod','browser'].includes(dimension);
 let rows:(Fact|Breakdown)[]=dimension==='product'?selectBreakdowns(data,filters,'product'):isTraffic?selectBreakdowns(data,filters,'traffic'):facts;
 if(dimension==='keyword')rows=rows.filter(r=>Boolean((r as Breakdown).keyword));
 if(metricKey==='adCtr')rows=rows.filter(r=>r.exposureBasis==='ad_impression');
 const group=(row:Fact|Breakdown)=>dimension==='campaign'?row.campaignId:dimension==='product'?(row as Breakdown).key:dimension==='source'||dimension==='channel'?data.campaigns.find(c=>c.id===row.campaignId)?.[dimension]||'':String(row[dimension as keyof Fact]??(row as Breakdown)[dimension as keyof Breakdown]??'미적용');
 const label=(key:string)=>dimension==='campaign'?campaignDisplayName(data,key):dimension==='product'?data.products.find(p=>p.id===key)?.label||key:names[key]||key;
 const campaignIds=new Set(facts.map(r=>r.campaignId));
 const reach=data.reach.filter(r=>campaignIds.has(r.campaignId)&&(filters.device==='all'||r.device===filters.device));
 return <div className="training-data-workspace"><div className="training-comparison-tabs" aria-label="비교 자료">{availablePresets.map(key=><button key={key} aria-pressed={preset===key} onClick={()=>setPreset(key)}>{presetNames[key]}</button>)}</div><div className="training-breakdown-controls">{dimension!=='device'&&<DeviceSelection device={filters.device} onDevice={onDevice}/ >}{supported.length>1&&<label>행 구분<select aria-label="비교 기준" value={dimension} onChange={e=>{controls.onSettings({dimension:e.target.value});if(e.target.value==='device'&&filters.device!=='all'){onDevice('all');onNotice('모바일과 PC를 비교하도록 상세 조회 범위를 전체 기기로 변경했습니다.');}}}>{dimensions.filter(([key])=>supported.includes(key)).map(([key,title])=><option key={key} value={key}>{title}별 비교</option>)}</select></label>}<span>조회한 데이터를 {dimensions.find(([key])=>key===dimension)?.[1]}별로 비교합니다.</span></div>{preset==='funnel'&&<FunnelComparison before={summarize(facts.filter(r=>r.periodId==='baseline'))} after={summarize(facts.filter(r=>r.periodId==='current'))}/>}{metricKey==='cac'?<section className="roas-card"><h3>CAC 비교 자료 미제공</h3><p className="roas-data-note">신규 고객 수가 없어 캠페인별 CAC와 순위를 계산할 수 없습니다.</p><h3>확인 가능한 집행비</h3><Comparison before={summarize(facts.filter(r=>r.periodId==='baseline'))} after={summarize(facts.filter(r=>r.periodId==='current'))} items={metrics.filter(m=>m.key==='spend')}/></section>:<GroupTable {...controls} title={`${dimensions.find(([key])=>key===dimension)?.[1]}별 기간 비교`} rows={rows} group={group} label={label} items={items} onEvidence={onEvidence} expanded/>}<RecordTable title="운영 근거" records={selectRecords(data,filters).filter(record=>!record.campaignId||campaignIds.has(record.campaignId))} onEvidence={onEvidence} category={controls.settings.recordCategory||'all'} onCategory={recordCategory=>controls.onSettings({recordCategory})} onNotice={onNotice}/><details className="roas-card training-table-disclosure"><summary>캠페인 설정과 상품 기준 정보</summary><div className="training-reference-actions"><button onClick={()=>onEvidence({title:'캠페인 운영 설정',rows:data.campaigns.filter(c=>campaignIds.has(c.id))})}>캠페인 설정 보기</button><button onClick={()=>onEvidence({title:'상품 기준 정보',rows:data.products})}>상품 기준 정보 보기</button></div></details><details className="roas-card training-table-disclosure"><summary>캠페인과 기기별 도달, 빈도</summary><div className="wb-table-scroll"><table><thead><tr><th>캠페인</th><th>기기</th><th>기간</th><th>노출/조회</th><th>도달</th><th>빈도</th></tr></thead><tbody>{reach.map(r=><tr key={`${r.campaignId}-${r.device}-${r.periodId}`}><td>{campaignDisplayName(data,r.campaignId)}</td><td>{names[r.device]}</td><td>{names[r.periodId]}</td><td className="training-delta-neutral">{fmt(r.impressions)}</td><td className="training-delta-neutral">{r.reach===null?<span className="training-missing-value" title="콘텐츠 고유 도달 데이터가 제공되지 않았습니다.">미집계</span>:fmt(r.reach)}</td><td>{r.reach===null?<span className="training-missing-value" title="도달 데이터가 없어 빈도를 계산할 수 없습니다.">미집계</span>:r.reach===0?<span className="training-missing-value" title="도달이 0이어서 빈도를 계산할 수 없습니다.">계산 불가</span>:fmt(ratio(r.impressions,r.reach))}</td></tr>)}</tbody></table></div><p className="roas-data-note">도달은 캠페인과 기기별 14일 집계이며 합산하지 않습니다. 콘텐츠 고유 도달은 미제공입니다.</p></details></div>;
}

function trendPoints(rows:(Fact|Breakdown)[],dates:string[][],metric:Metric){
 return dates.map(periodDates=>periodDates.map(date=>{const daily=rows.filter(r=>r.date===date);return daily.length?get(summarize(daily),metric.key)??null:null;}));
}
function GroupTrend({points,maximum,metric}:{points:(number|null)[][];maximum:number;metric:Metric}){
 return <svg className="training-row-trend" viewBox="0 0 112 34" role="img" aria-label={metric.label+' 일별 추이, 공통 눈금 0~'+fmt(maximum,metric.rate,metric.unit)}><title>{metric.label}, 공통 눈금 0~{fmt(maximum,metric.rate,metric.unit)}</title>{points.map((values,index)=><g key={index}>{values.slice(1).map((value,i)=>value===null||values[i]===null?null:<line key={i} x1={2+i*108/13} x2={2+(i+1)*108/13} y1={30-(maximum?(values[i]||0)/maximum*26:0)} y2={30-(maximum?value/maximum*26:0)} stroke={index?'#7357BA':'#9BA8B9'} strokeWidth="1.8" strokeDasharray={index?undefined:'3 3'}/>)}</g>)}</svg>;
}
function GroupTable({title,rows,group,label,items,onEvidence,settings,onSettings,expanded=false}:{title:string;rows:(Fact|Breakdown)[];group:(row:Fact|Breakdown)=>string;label?:(key:string)=>string;items:Metric[];onEvidence:(e:Evidence)=>void;expanded?:boolean}&TableControls){
 const sort={key:settings.sortKey&&(settings.sortKey==='label'||items.some(item=>item.key===settings.sortKey))?settings.sortKey:(items.find(item=>item.key!=='spendShare')||items[0]).key,descending:settings.descending??true};
 const sortBasis=settings.sortBasis||'current';
 function value(key:string,period:string,metric:Metric){
  const total=summarize(rows.filter(row=>group(row)===key&&row.periodId===period));
  return metric.key==='spendShare'?ratio(total.spend,summarize(rows.filter(row=>row.periodId===period)).spend):get(total,metric.key);
 }
 const groups=[...new Set(rows.map(group))].sort((a,b)=>{
  if(sort.key==='label')return (sort.descending?-1:1)*a.localeCompare(b);
  const metric=items.find(item=>item.key===sort.key)!;
  const compared=(key:string)=>sortBasis==='current'?value(key,'current',metric):metricChange(value(key,'baseline',metric),value(key,'current',metric),metric.rate);
  const av=compared(a),bv=compared(b);
  if(av==null)return bv==null?a.localeCompare(b):1;
  if(bv==null)return -1;
  return (sort.descending?-1:1)*(av-bv)||a.localeCompare(b);
 });
 const trendMetric=items.find(m=>m.key===sort.key&&m.key!=='spendShare')||items.find(m=>m.key!=='spendShare')||items[0];
 const trendDates=['baseline','current'].map(period=>[...new Set(rows.filter(r=>r.periodId===period).map(r=>r.date))].sort());
 const trendMaximum=Math.max(0,...groups.flatMap(key=>trendPoints(rows.filter(r=>group(r)===key),trendDates,trendMetric).flat().map(v=>v??0)));
 function order(key:string){onSettings({sortKey:key,descending:sort.key===key?!sort.descending:true});}
 function heading(m:Metric){return <th className="numeric" key={m.key}><button title={`${sortBasis==='current'?'현재 수치':'변화량'}으로 정렬`} onClick={()=>order(m.key)}>{m.label} {sort.key===m.key?(sort.descending?'↓':'↑'):''}</button><small>현재 / 직전 / 증감</small></th>;}
 function cell(key:string,m:Metric){
  const groupRows=rows.filter(row=>group(row)===key);
  return <td className="numeric" key={m.key}><strong><MetricCell value={value(key,'current',m)} before={value(key,'baseline',m)} metric={m} rows={groupRows.filter(r=>r.periodId==='current')}/></strong><span className="training-cell-before">직전 <MetricCell value={value(key,'baseline',m)} metric={m} rows={groupRows.filter(r=>r.periodId==='baseline')}/></span><small className="training-cell-change"><Delta metricKey={m.key} before={value(key,'baseline',m)} after={value(key,'current',m)} rate={m.rate}/></small></td>;
 }
 return <section className="roas-card"><div className="roas-card-heading"><h3>{title}</h3><button onClick={()=>onEvidence({title:`${title}, 집계 근거`,rows})}>집계 근거</button></div><details className="training-table-disclosure" open={expanded||undefined}><summary>{groups.length}개 그룹, 세부 수치 보기</summary>
  <div className="training-table-sort"><label>순위 기준 <select aria-label={`${title} 정렬 값`} value={sortBasis} onChange={event=>onSettings({sortBasis:event.target.value as 'current'|'change',...(sort.key==='label'?{sortKey:items[0].key,descending:false}:{})})}><option value="current">현재 수치로 순위</option><option value="change">변화량으로 순위</option></select></label><span>현재 정렬: {sort.key==='label'?'구분':`${items.find(item=>item.key===sort.key)?.label}, ${sortBasis==='current'?'분석 기간 값':'증감'}`} {sort.descending?'내림차순':'오름차순'}</span></div>
  <p className="training-sort-help">{sortBasis==='current'?'선택 지표의 현재 수치로 비교합니다.':'직전 기간보다 늘거나 줄어든 폭으로 비교합니다. 비율 지표는 %p, 금액과 건수는 증감률(%)입니다.'} 추이는 정렬한 지표를 표시합니다.</p>
  <div className="wb-table-scroll"><table className="training-one-row-table"><thead><tr><th><button onClick={()=>order('label')}>구분 {sort.key==='label'?(sort.descending?'↓':'↑'):''}</button></th>{items.slice(0,3).map(heading)}<th>14일 추이, {trendMetric.label}<small>공통 눈금, 점선 직전 / 실선 현재</small></th>{items.slice(3).map(heading)}</tr></thead><tbody>{groups.map(key=><tr key={key}><th scope="row">{displayTrainingText(label?.(key)||names[key]||key||'미적용')}</th>{items.slice(0,3).map(m=>cell(key,m))}<td><GroupTrend points={trendPoints(rows.filter(row=>group(row)===key),trendDates,trendMetric)} maximum={trendMaximum} metric={trendMetric}/></td>{items.slice(3).map(m=>cell(key,m))}</tr>)}</tbody></table></div>{!groups.length&&<p className="roas-data-note">선택한 범위에 적용되는 집계가 없습니다.</p>}</details></section>;

}

export default function TrainingDashboard({onExplore,active=true}:{onExplore:()=>void;active?:boolean}){
 const [index,setIndex]=useState<Index|null>(null),[data,setData]=useState<TrainingData|null>(null);
 const [caseId,setCaseId]=useState('S16'),[snapshot,setSnapshot]=useState('initial'),[view,setView]=useState('overview');
 const [selectedMetric,setSelectedMetric]=useState<string|null>(null);
 const [dataPresets,setDataPresets]=useState<Record<string,string>>({});
 const dataPreset=selectedMetric?(dataPresets[selectedMetric]||metricPresets[selectedMetric]?.[0]||'performance'):'performance';
 const [tableSettings,setTableSettings]=useState<Record<string,TableSettings>>({});
 function setDataPreset(preset:string){if(selectedMetric)setDataPresets(current=>({...current,[selectedMetric]:preset}));}
 const updateTableSettings=useCallback((key:string,patch:TableSettings)=>setTableSettings(current=>({...current,[key]:{...current[key],...patch}})),[]);
 const tableControlFor:TableControlFor=key=>({settings:tableSettings[key]||{},onSettings:patch=>updateTableSettings(key,patch)});
 const [filters,setFilters]=useState<Filters>({channel:'all',source:'all',campaignId:'all',device:'all'});
 const [scopeNotice,setScopeNotice]=useState('');
 const [chatOpen,setChatOpen]=useState(false);
 const [conversations,setConversations]=useState<Record<string,{question:string;result:RoasAnswer}[]>>({});
 const chatKey=JSON.stringify([caseId,snapshot,filters.channel,filters.source||'all',filters.campaignId,filters.device,selectedMetric,view]);
 const closeChat=useCallback(()=>setChatOpen(false),[]);
 const [error,setError]=useState(''),[retry,setRetry]=useState(0),[navOpen,setNavOpen]=useState(false);
 const [evidence,setEvidenceState]=useState<Evidence|null>(null),[query,setQuery]=useState(''),[limit,setLimit]=useState(30);
 const dialog=useRef<HTMLDialogElement>(null);
 const content=useRef<HTMLElement>(null);
 const overviewScroll=useRef(0),detailScroll=useRef(0),pendingScroll=useRef<number|null>(null);
 const overviewDisclosures=useRef<boolean[]>([]);
 const evidenceHistory=useRef(new Map<number,Evidence>()),nextEvidenceId=useRef(0);
 function setEvidence(value:Evidence|null){
  if(!value&&!evidence)return;
  setQuery('');setLimit(30);
  if(value){
   const id=++nextEvidenceId.current;evidenceHistory.current.set(id,value);
   // 큰 집계 행을 브라우저 이력에 복사하지 않고 이 화면의 참조만 보관한다.
   const route={metric:selectedMetric,view,device:filters.device,scroll:window.scrollY,tableSettings,dataPresets};
   window.history.replaceState({...window.history.state,trainingNavigation:route},'');
   window.history.pushState({...window.history.state,trainingNavigation:{...route,evidenceId:id}},'');
  }else if(window.history.state?.trainingNavigation?.evidenceId){window.history.back();}
  setEvidenceState(value);
 }
 function resetRequest(){setData(null);setError('');setEvidence(null);setScopeNotice('');}
 useEffect(()=>{
  if(!active)return;
  const previousRestoration=window.history.scrollRestoration;
  window.history.scrollRestoration='manual';
  window.history.replaceState({...window.history.state,trainingNavigation:{metric:null,view:'overview',scroll:0}},'');
  function restore(event:PopStateEvent){
   const route=event.state?.trainingNavigation;
   if(!route||(route.metric!==null&&!focusMetrics.some(item=>item.key===route.metric)))return;
   pendingScroll.current=typeof route.scroll==='number'?route.scroll:0;
   setSelectedMetric(route.metric);setView(route.view==='data'?'data':'overview');setEvidenceState(evidenceHistory.current.get(route.evidenceId)||null);
   if(route.tableSettings)setTableSettings(route.tableSettings);
   if(route.dataPresets)setDataPresets(route.dataPresets);
   if(['all','mobile','desktop'].includes(route.device))setFilters(current=>({...current,device:route.metric===null?'all':route.device}));
  }
  window.addEventListener('popstate',restore);
  return()=>{window.removeEventListener('popstate',restore);window.history.scrollRestoration=previousRestoration;};
 },[active]);
 useEffect(()=>{
  if(pendingScroll.current===null)return;
  const top=pendingScroll.current;pendingScroll.current=null;
  const frame=requestAnimationFrame(()=>{
   // Restore expanded sections before scrolling, otherwise the shorter page clamps the saved position.
   if(selectedMetric===null)content.current?.querySelectorAll('details').forEach((node,index)=>{if(index<overviewDisclosures.current.length)node.open=overviewDisclosures.current[index];});
   const heading=content.current?.querySelector('h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}window.scrollTo({top});
  });
  return()=>cancelAnimationFrame(frame);
 },[view,selectedMetric,evidence]);
 function navigate(metric:string|null,comparison=false){
  if(!evidence&&metric===selectedMetric&&(comparison?'data':'overview')===view){window.scrollTo({top:0});return;}
  if(!selectedMetric){overviewScroll.current=window.scrollY;overviewDisclosures.current=Array.from(content.current?.querySelectorAll('details')||[],node=>node.open);}
  else if(view==='overview')detailScroll.current=window.scrollY;
  const top=metric===null?overviewScroll.current:metric===selectedMetric&&!comparison?detailScroll.current:0;
  const nextDevice=metric===null||metric!==selectedMetric?'all':filters.device;
  window.history.replaceState({...window.history.state,trainingNavigation:{...window.history.state?.trainingNavigation,metric:selectedMetric,view,device:filters.device,scroll:window.scrollY,tableSettings,dataPresets}},'');
  window.history.pushState({...window.history.state,trainingNavigation:{metric,view:comparison?'data':'overview',device:nextDevice,scroll:top,tableSettings,dataPresets}},'');
  pendingScroll.current=top;setFilters(current=>({...current,device:nextDevice}));setSelectedMetric(metric);setView(comparison?'data':'overview');setNavOpen(false);setEvidenceState(null);
 }
 function openComparison(){
  if(!selectedMetric)return;
  navigate(selectedMetric,true);
 }
 useEffect(()=>{if(active)document.title='마케팅 성과 | '+(selectedMetric?focusMetrics.find(m=>m.key===selectedMetric)?.label+(view==='data'?' 비교 표':' 상세 분석'):'성과 현황');},[active,view,selectedMetric]);
 useEffect(()=>{const controller=new AbortController();fetch('/workbench-data/current/training-index.json',{signal:controller.signal,cache:'no-cache'}).then(async response=>{if(!response.ok)throw Error('사례 목록을 불러오지 못했습니다.');return response.json();}).then((raw:unknown)=>{const value=raw as Index;if(value.contract!=='roas-training/1'||!Array.isArray(value.cases)||!Array.isArray(value.snapshots))throw Error('사례 목록의 규약을 확인하지 못했습니다.');if(!controller.signal.aborted)setIndex(value);}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'목록 요청에 실패했습니다.');});return()=>controller.abort();},[retry]);
 useEffect(()=>{if(!index)return;const controller=new AbortController();fetch(`/workbench-data/current/training-${caseId}-${snapshot}.json`,{signal:controller.signal,cache:'no-cache'}).then(async response=>{if(!response.ok)throw Error('성과 데이터를 불러오지 못했습니다.');return response.json();}).then((raw:unknown)=>{const value=raw as TrainingData;if(value.contract!=='roas-training/1'||value.caseId!==caseId||!value.periods.some(p=>p.id==='baseline')||!value.periods.some(p=>p.id==='current'))throw Error('성과 데이터의 규약을 확인하지 못했습니다.');if(!controller.signal.aborted)setData(value);}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'데이터 요청에 실패했습니다.');});return()=>controller.abort();},[index,caseId,snapshot,retry]);
 useEffect(()=>{if(evidence){dialog.current?.showModal();dialog.current?.querySelector<HTMLButtonElement>('[aria-label="근거 닫기"]')?.focus();}else dialog.current?.close();},[evidence]);
 const facts=useMemo(()=>data?selectFacts(data,filters):[],[data,filters]);
 const periods=useMemo(()=>data?comparePeriods(data,filters):[],[data,filters]);
 const evidenceRows=useMemo(()=>evidence?.rows.filter(row=>(JSON.stringify(row)+' '+displayTrainingText(JSON.stringify(row))).toLocaleLowerCase().includes(query.toLocaleLowerCase()))||[],[evidence,query]);
 const before=periods.find(p=>p.period.id==='baseline'),after=periods.find(p=>p.period.id==='current');
 const campaignLabel=(id:string)=>data?campaignDisplayName(data,id):id;
 const groupProps={onEvidence:setEvidence,...tableControlFor("overview")};
 const campaignMetrics=[{key:'spendShare',label:'유료 마케팅 집행비 비중',rate:true},...metrics.filter(m=>['spend','revenue','roas','orders','cpc','cvr','aov'].includes(m.key))];
 function filter(key:keyof Filters,value:string){setScopeNotice('');setFilters(current=>{const next={...current,[key]:value};if(data&&!data.campaigns.some(c=>c.id===next.campaignId&&(next.channel==='all'||c.channel===next.channel)&&(!next.source||next.source==='all'||c.source===next.source)))next.campaignId='all';return next;});}
 function changeMedia(key:string){
  if(!data)return;
  const next=changeTrainingMedia(data,{...filters,campaignId:'all'},key);
  setScopeNotice(filters.campaignId!=='all'?'선택한 집행처의 전체 캠페인을 조회합니다.':'');
  setFilters(next);
 }
 return <div className={`wb roas-workbench roas-data-dashboard training-dashboard ${navOpen?'wb-nav-open':''} ${chatOpen&&active&&data&&!error?'wb-with-panel':''}`}>
  <a className="wb-skip" href="#training-content">본문 바로가기</a>
  <aside className="wb-sidebar"><div className="wb-logo"><span><Layers size={19}/></span><div>Marketing<span>데이터 대시보드</span></div><button className="wb-mobile" aria-label="메뉴 닫기" onClick={()=>setNavOpen(false)}><X size={18}/></button></div><nav aria-label="성과 메뉴">{trainingViews.map(([id,label])=><button key={id} className="active" aria-current={!selectedMetric?'page':undefined} onClick={()=>navigate(null)}><BarChart3 size={17}/>{label}</button>)}</nav><div className="roas-side-bottom"><details className="training-test-cases"><summary>테스트 케이스{caseId!=='S16'&&<small>{index?.cases.find(item=>item.id===caseId)?.label}</small>}</summary><label>테스트 데이터<select aria-label="데이터 사례" value={caseId} onChange={e=>{if(e.target.value!==caseId){resetRequest();setCaseId(e.target.value);}}}><option value="S16">기본 대시보드</option>{index?.cases.filter(item=>item.id!=='S16').map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>보고 기준시점<select aria-label="보고 기준시점" value={snapshot} onChange={e=>{if(e.target.value!==snapshot){resetRequest();setSnapshot(e.target.value);}}}>{index?.snapshots.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label><p className="training-case-description">{caseDescriptions[caseId]}</p></details><button onClick={onExplore}><Layers size={17}/>(구) 대시보드 확인</button></div></aside>
  {navOpen&&<button className="wb-nav-shade" aria-label="메뉴 닫기" onClick={()=>setNavOpen(false)}/>}
  <div className="wb-main"><div className="training-query-context"><header className="wb-header training-navigation-header"><button className="wb-mobile" aria-label="메뉴 열기" onClick={()=>setNavOpen(true)}><Menu size={18}/></button><nav className="training-breadcrumb" aria-label="탐색 경로"><button onClick={()=>navigate(null)} aria-current={!selectedMetric?'page':undefined}>{selectedMetric&&<ArrowLeft size={16}/>}성과 현황</button>{selectedMetric&&<><span aria-hidden="true">/</span>{view==='data'?<><button onClick={()=>navigate(selectedMetric)}>{focusMetrics.find(item=>item.key===selectedMetric)?.label} 상세</button><span aria-hidden="true">/</span><span aria-current="page">비교 표</span></>:<span aria-current="page">{focusMetrics.find(item=>item.key===selectedMetric)?.label} 상세</span>}</>}</nav><div className="training-color-legend" aria-label="증감 색상 의미"><span className="training-delta-positive">빨강: 개선</span><span className="training-delta-negative">파랑: 악화</span><span>회색: 중립</span></div><span className="wb-synthetic">가상 데이터</span></header>
   {before&&after&&<div className="training-analysis-context"><div><span>분석 기간</span><strong>{periodLabel(after.period.start,after.period.end)}</strong></div><div><span>비교</span><strong>직전 14일</strong><small>{periodLabel(before.period.start,before.period.end)}</small></div><div><span>사례</span><strong>{data?.caseId}</strong><span>보고 기준</span><strong>{data&&new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(data.asOf))}</strong></div></div>}
   <div className="roas-dashboard-filters"><TrainingScopePicker data={data} filters={filters} onCampaign={id=>{setFilters(current=>({...current,channel:'all',source:'all',campaignId:id}));setScopeNotice('');}} onMedia={changeMedia}/>{selectedMetric&&filters.device!=='all'&&<span className="training-device-context">상세 조회: {names[filters.device]}<button onClick={()=>filter('device','all')}>전체 기기로 보기</button></span>}<details className="training-measure-info"><summary>집계 기준</summary><p>매출은 7일 내 마지막 유료 클릭에 기록한 구매 전환 매출입니다. 광고 접점일 기준, 환불과 세금, 배송비 제외.</p></details></div>
   <nav className="training-page-navigation" aria-label="성과 화면 탐색">
    <button className="training-overview-link" aria-current={!selectedMetric?'page':undefined} onClick={()=>navigate(null)}>{selectedMetric?<ArrowLeft size={17} aria-hidden="true"/>:<BarChart3 size={17} aria-hidden="true"/>}{selectedMetric?'성과 현황으로 돌아가기':'성과 현황'}</button>
    <div className="training-metric-links"><span>지표 상세</span>{focusMetrics.map(item=><button key={item.key} aria-label={`${item.label} 상세로 이동`} aria-current={selectedMetric===item.key?'page':undefined} onClick={()=>navigate(item.key)}>{item.label}</button>)}</div>
    {selectedMetric&&<div className="training-view-links" role="group" aria-label="상세 화면 보기"><button aria-pressed={view==='overview'} onClick={()=>navigate(selectedMetric)}>상세 분석</button><button aria-pressed={view==='data'} onClick={openComparison}>비교 표와 운영 기록</button></div>}
   </nav>
   <div className="training-scope-notice" role="status">{scopeNotice}</div></div>
   <main ref={content} id="training-content" aria-busy={!data&&!error}>{error?<section className="wb-empty" role="alert"><h2>{error}</h2><button onClick={()=>{resetRequest();setRetry(v=>v+1);}}>다시 불러오기</button></section>:!data||!before||!after?<section className="wb-empty" role="status">성과 데이터 불러오는 중</section>:<>
    {(!selectedMetric||view==='data')&&<div className="roas-dashboard-heading"><h1>{selectedMetric?focusMetrics.find(item=>item.key===selectedMetric)?.label+' 비교 표':'성과 현황'}</h1></div>}
    {view==='overview'&&!selectedMetric&&<RoasSummary before={before.total.rates.roas} after={after.total.rates.roas}/>}
    {view==='overview'&&(selectedMetric?<MetricDetails metric={focusMetrics.find(m=>m.key===selectedMetric)!} data={data} filters={filters} onEvidence={setEvidence} tableControlFor={tableControlFor} onDevice={device=>filter('device',device)}/>:<>
     <section className="roas-card training-roas-overview"><div className="roas-card-heading"><h3>ROAS 기간별 추이</h3><button onClick={()=>navigate('roas')}>캠페인별 ROAS 분석</button></div><PlotLegend daily/><PeriodPlot data={data} filters={filters} metric={focusMetrics[0]}/></section>
     <div className="training-section-heading"><h3>주요 지표 비교</h3><span>지표를 선택하면 상세 분석으로 이동합니다.</span></div>
     <MetricCards data={data} filters={filters} before={before.total} after={after.total} onSelect={key=>navigate(key)}/>
     <section className="roas-card"><div className="roas-card-heading"><h3>캠페인별 ROAS</h3><button onClick={()=>setEvidence({title:'캠페인별 성과, 집계 근거',rows:facts})}>집계 근거</button></div><PlotLegend/><ComparisonBars rows={facts} metric={focusMetrics[0]} group={row=>row.campaignId} label={campaignLabel} onSelect={key=>filter('campaignId',key)}/></section>
     <details className="roas-card training-table-disclosure"><summary>전체 성과 지표와 기간별 수치</summary><Comparison before={before.total} after={after.total}/></details>
     <GroupTable title="캠페인별 전체 성과" rows={facts} group={row=>row.campaignId} label={campaignLabel} items={campaignMetrics} {...groupProps}/>
    </>)}
    {view==='data'&&selectedMetric&&<DataWorkspace data={data} filters={filters} metricKey={selectedMetric} preset={dataPreset} setPreset={setDataPreset} onEvidence={setEvidence} tableControlFor={tableControlFor} onNotice={setScopeNotice} onDevice={device=>filter('device',device)}/>}
    <details className="roas-dashboard-definitions"><summary>집계 기준과 데이터 범위</summary><p>교육용 자사 상품 3종을 판매하는 쇼핑몰의 가상 집계입니다. 기존 원천의 자사와 경쟁사 상품과는 별도이며 외부 경쟁사 매출은 포함하지 않습니다. 주문 원본과 개인별 행동 원본은 제공하지 않습니다. 할인 후 상품금액에서 세금과 배송비를 제외하며 환불은 이번 분석 범위에서 제외합니다. 구매 전환 매출은 광고를 클릭한 뒤 7일 안에 구매한 금액을 마지막으로 클릭한 유료 광고의 성과로 기록한 매출입니다. 쇼핑몰 전체 매출과 구분하며, 광고 때문에 추가로 발생한 매출을 입증하는 값은 아닙니다. 광고 접점일로 집계합니다. ROAS는 구매 전환 매출/유료 마케팅 집행비, 클릭 기준 구매율은 귀속 주문/클릭, AOV는 구매 전환 매출/주문입니다. 한 주문은 한 분석 대상 상품에 속합니다. 소재, 검색어, 지면 등은 제공된 분할 내에서만 합산합니다. 가격과 재고, 운영 변경 기록은 관련 대상과 적용 시각을 확인하세요.</p><p>{trainingCostDefinition} 상품별과 유입별 비용은 교육용 가상 배분이며 실제 정산 명세가 아닙니다.</p></details>
   </>}</main>
  </div>
  {active&&!chatOpen&&<button id="wb-chat-launcher" className="wb-chat-launcher" aria-label="AI와 대화" title="AI와 대화" aria-haspopup="dialog" aria-expanded={false} aria-controls="wb-agent-panel" disabled={!data||!!error} onClick={()=>setChatOpen(true)}><Sparkles size={25} aria-hidden="true"/></button>}
  {active&&chatOpen&&data&&!error&&<RoasConversation key={chatKey} data={data} snapshot={snapshot} filters={filters} metric={selectedMetric||''} screenTitle={selectedMetric?`${focusMetrics.find(m=>m.key===selectedMetric)?.label} ${view==='data'?'비교 표':'상세 분석'}`:'성과 현황'} onClose={closeChat} exchanges={conversations[chatKey]||[]} onExchange={exchange=>setConversations(current=>({...current,[chatKey]:[...(current[chatKey]||[]),exchange].slice(-12)}))}/>}
  <dialog ref={dialog} className="roas-evidence" aria-labelledby="training-evidence-title" onClose={()=>setEvidence(null)}><header><h2 id="training-evidence-title">{evidence?.title}</h2><div className="training-evidence-actions"><button onClick={()=>navigate(null)}>성과 현황</button><button aria-label="근거 닫기" onClick={()=>setEvidence(null)}><X size={18}/></button></div></header><div className="roas-evidence-body"><label className="roas-evidence-search"><Search size={15}/><input aria-label="근거 검색" value={query} onChange={e=>{setQuery(e.target.value);setLimit(30);}} placeholder="내용, 날짜, ID 검색"/></label><p>{evidenceRows.length.toLocaleString('ko-KR')}개 집계 행 또는 상세 기록</p>{evidenceRows.slice(0,limit).map((row,i)=><details key={i}><summary>{displayTrainingText((row as {title?:string}).title||(row as {id?:string}).id||`집계 ${i+1}`)}</summary><EvidenceFields row={row} data={data}/></details>)}{evidenceRows.length>limit&&<button onClick={()=>setLimit(v=>v+30)}>30개 더 보기</button>}</div></dialog>
 </div>;
}

function RecordTable({title,records,onEvidence,category,onCategory,onNotice}:{title:string;records:TrainingData['records'];onEvidence:(e:Evidence)=>void;category:string;onCategory:(category:string)=>void;onNotice:(message:string)=>void}){
 const categories=[...new Set(records.map(row=>row.category))].sort();
 const selected=category==='all'||!categories.includes(category)?records:records.filter(row=>row.category===category);
 useEffect(()=>{if(category!=='all'&&!categories.includes(category)){onCategory('all');onNotice('선택한 범위에 해당 종류의 운영 기록이 없어 전체 종류로 변경했습니다.');}},[category,categories,onCategory,onNotice]);
 return <section className="roas-card"><div className="roas-card-heading"><h3>{title}</h3><label className="training-record-filter">종류<select aria-label={`${title} 종류`} value={categories.includes(category)?category:'all'} onChange={e=>onCategory(e.target.value)}><option value="all">전체</option>{categories.map(c=><option key={c} value={c}>{recordCategories[c]||c}</option>)}</select></label></div><details className="training-table-disclosure"><summary>{selected.length}건의 기록 보기</summary><div className="wb-table-scroll"><table><thead><tr><th>일시</th><th>종류</th><th>대상</th><th>내용</th><th>기록</th></tr></thead><tbody>{selected.toSorted((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)).map(row=><tr key={row.id}><td>{row.date}</td><td>{recordCategories[row.category]||row.category}</td><td>{displayTrainingText(row.campaignId||'공통')}, {names[row.device]||row.device}</td><td>{displayTrainingText(row.title)}</td><td><button onClick={()=>onEvidence({title:'개별 상세 기록',rows:[row]})}>상세</button></td></tr>)}</tbody></table></div>{!selected.length&&<p className="roas-data-note">선택한 범위의 기록 0건</p>}</details></section>;
}
