'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {BarChart3,ChevronDown,FolderOpen,Info,Layers,Menu,PanelLeftClose,PanelLeftOpen,Search,Sparkles,X} from 'lucide-react';
import {Tooltip as InfoTooltip,TooltipContent,TooltipProvider,TooltipTrigger} from '../components/ui/tooltip';
import {RoasConversation} from './roas-conversation';
import type {RoasAnswer} from './agent-client';
import {CartesianGrid,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import {campaignDisplayName,displayTrainingText,changeTrainingMedia,comparePeriods,metricPeriodSeries,metricValue,metricMissingReason,selectFacts,trainingCostDefinition} from '../../shared/training-dashboard.mjs';
import type {Fact,Filters,Total,TrainingData} from '../../shared/training-dashboard.mjs';
import './roas-workbench.css';
import './training-dashboard.css';
import TrainingScopePicker from './training-scope-picker';
import {deltaTone,displayedChange,miniPlotDomain,plotUpper} from './training-presentation';
import {formatMetricValue,formatComparedMetricDelta,metricDigits} from './training-format';
import {KpiAnalysisPanel,TermInfo} from './training-analysis-panel';
import {scopeTrainingData} from './training-analysis';
import type {AnalysisSettings,AnalysisScope,AnalysisGroup,AnalysisDimension} from './training-analysis';

type Index={contract:string;cases:{id:string;label:string}[];snapshots:{id:string;label:string;asOf:string}[]};
type Evidence={title:string;rows:object[]};
type Metric={key:string;label:string;rate?:boolean;unit?:string};
type TableSettings=AnalysisSettings;
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
const metrics:Metric[]=[{key:'roas',label:'ROAS',rate:true},{key:'revenue',label:'구매 전환 매출',unit:'원'},{key:'spend',label:'유료 마케팅 집행비',unit:'원'},{key:'orders',label:'구매 주문',unit:'건'},{key:'cpc',label:'CPC',unit:'원'},{key:'cvr',label:'클릭 기준 구매 CVR',rate:true},{key:'aov',label:'AOV',unit:'원'},{key:'cpa',label:'구매 CPA',unit:'원'},{key:'adCtr',label:'광고 CTR',rate:true},{key:'contentClickRate',label:'콘텐츠 링크 클릭률',rate:true},{key:'adCpm',label:'광고 CPM',unit:'원'},{key:'contentCpm',label:'조회 1,000회당 비용',unit:'원'}];
const get=(total:Total,key:string):number|null=>{const pairs:Record<string,[number,number]>={viewRate:[total.view,total.sessions],cartRate:[total.cart,total.view],beginRate:[total.checkout,total.cart],unitPrice:[total.listRevenue,total.units],discountRate:[total.discount,total.listRevenue]};if(key in pairs){const [a,b]=pairs[key];return b?a/b:null;}return key in total.rates?total.rates[key as keyof Total['rates']]:total[key as keyof typeof total] as number;};
const fmt=(value:number|null|undefined,rate=false,unit='',key='')=>formatMetricValue(value,key,rate,unit);
const chartTick=(value:number,metric:Metric)=>metric.rate?(value*100).toLocaleString('ko-KR',{maximumFractionDigits:metricDigits(metric.key,true)})+'%':fmt(value,false,metric.unit,metric.key);
const change=(a:number|null,b:number|null,rate=false,key='')=>formatComparedMetricDelta(a,b,key,rate);
const periodLabel=(start:string,end:string)=>`${start.replaceAll('-','.')} ~ ${new Date(Date.parse(end+'T00:00:00Z')-86400000).toISOString().slice(0,10).replaceAll('-','.')}`;
const ratio=(a:number,b:number|null)=>b?a/b:null;
function MetricCell({value,metric,rows,before=null}:{value:number|null|undefined;metric:Metric;rows:Fact[];before?:number|null}){
 if(value!=null)return <span className={`training-delta-${deltaTone(metric.key,before,value,metric.rate)}`}>{fmt(value,metric.rate,metric.unit,metric.key)}</span>;
 const missing=metricMissingReason(rows,metric.key);
 return <span className="training-missing-value" tabIndex={0} title={missing.reason} aria-label={`${missing.label}: ${missing.reason}`}>{missing.label}</span>;
}
function Delta({before,after,rate=false,metricKey}:{before:number|null;after:number|null;rate?:boolean;metricKey:string}){
 return <span className={`training-delta training-delta-${deltaTone(metricKey,before,after,rate)}`}>{change(before,after,rate,metricKey)}</span>;
}

function MetricSummary({before,after,metric={key:'roas',label:'ROAS',rate:true},rows=[]}:{before:number|null;after:number|null;metric?:Metric;rows?:Fact[]}){
 const tone=deltaTone(metric.key,before,after,metric.rate),visibleDelta=displayedChange(before,after,metric.rate,metricDigits(metric.key,metric.rate)),direction=Math.sign(visibleDelta??0);
 const path=direction===0?'M5 24H49':'M5 8L19 23L29 15L48 38M35 38H48V25';
 return <section className={`roas-primary-kpi training-roas-summary training-delta-${tone}`} aria-labelledby={`training-${metric.key}-title`}>
  <h3 id={`training-${metric.key}-title`} className="training-roas-heading">{metric.key==='cvr'?'클릭 기준 구매 CVR':metric.label} <TermInfo label={metric.label} description={metricDescriptions[metric.key]}/></h3>
  <div className="training-roas-direction">{before!==null&&after!==null&&<svg viewBox="0 0 56 48" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} transform={direction>0?'translate(0 48) scale(1 -1)':undefined}/></svg>}<p className="training-roas-reference">{before!==null&&after!==null&&direction===0?`직전 14일과 동일 (${fmt(before,metric.rate,metric.unit,metric.key)})`:`직전 14일: ${fmt(before,metric.rate,metric.unit,metric.key)}`}</p></div>
  <div className="training-roas-value-row"><strong className="training-roas-current">{after===null?<MetricCell value={after} metric={metric} rows={rows}/>:fmt(after,metric.rate,metric.unit,metric.key)}</strong><span className="training-roas-change" title={metric.rate?'%p는 퍼센트포인트로, 두 비율의 차이입니다.':'직전 14일 대비 상대 증감률입니다.'}>{tone!=='neutral'&&direction!==0&&<svg viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M1 2H9L5 9Z" transform={direction>0?'translate(0 10) scale(1 -1)':undefined}/></svg>}<Delta metricKey={metric.key} before={before} after={after} rate={metric.rate}/></span></div>
 </section>;
}

const recordCategories:Record<string,string>={campaign:'캠페인 설정',change:'운영 변경',creative:'소재 변경',incident:'장애와 점검',inventory:'상품과 재고',landing:'랜딩 페이지',tracking:'계측 설정'};
const evidenceFieldNames:Record<string,string>={id:'기록 ID',date:'일자',category:'기록 종류',campaignId:'캠페인',device:'기기',productId:'상품',title:'내용',values:'상세 항목',periodId:'기간',exposureBasis:'노출 집계 기준',source:'출처',creativeId:'소재 ID',audienceId:'타깃 ID',placement:'게재 위치',keyword:'검색어',browser:'브라우저',paymentMethod:'결제 수단',impressions:'노출 또는 조회',clicks:'클릭 수',spend:'유료 마케팅 집행비, 원',orders:'구매 주문 수',revenue:'매출, 원',sessions:'랜딩 세션 수',view:'상품 조회 수',cart:'장바구니 수',checkout:'결제 시작 수',purchases:'동일 세션 구매 건수',returnPurchases:'재방문 구매 수',units:'판매 수량',listRevenue:'할인 전 상품금액, 원',discount:'할인액, 원',ledgerOrders:'주문 원장 주문 수',ledgerRevenue:'주문 원장 매출, 원',paymentAttempts:'결제 시도 수',paymentFailures:'결제 실패 수',redirectErrors:'리디렉션 오류 수',loadTotalMs:'로드 시간 합계, ms',loadSamples:'로드 측정 수',trackingExpected:'수집 대상 이벤트 수',trackingReceived:'수집 이벤트 수',duplicateEvents:'중복 이벤트 수'};
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
const metricDescriptions:Record<string,string>={roas:'구매 전환 매출 / 유료 마케팅 집행비',adCtr:'광고 클릭 / 광고 노출, 콘텐츠 조회 제외',cpc:'유료 마케팅 집행비 / 클릭',cvr:'광고 귀속 구매 주문수 / 클릭수',cpa:'유료 마케팅 집행비 / 구매 주문',cac:'신규 고객 획득 비용, 신규 고객 수 미집계',aov:'구매 전환 매출 / 구매 주문'};
function PeriodPlot({data,filters,metric,mini=false}:{data:TrainingData;filters:Filters;metric:Metric;mini?:boolean}){
 const series=metricPeriodSeries(data,filters,metric.key);
 const present=series.some(row=>row.baseline!==null||row.current!==null);
 if(!present){const missing=metricMissingReason(selectFacts(data,filters),metric.key);return <div className={mini?'training-mini-empty':'training-chart-empty'} title={missing.reason} tabIndex={0} aria-label={`${missing.label}: ${missing.reason}`}>{mini?(metric.key==='cac'?'신규 고객 수 미집계':missing.label):missing.reason}</div>;}
 const values=series.flatMap(row=>[row.baseline,row.current]);
 const [lower,upper]=mini?miniPlotDomain(values):[0,plotUpper(values)];
 return <><div className={mini?'training-sparkline':'training-period-chart'} role="img" aria-label={`${metric.label}, 직전 14일과 분석 기간의 일별 추이, 공통 축 ${fmt(lower,metric.rate,metric.unit,metric.key)}~${fmt(upper,metric.rate,metric.unit,metric.key)}`}>
  <ResponsiveContainer width="100%" height={mini?176:'100%'}><LineChart data={series} margin={mini?{top:12,right:6,bottom:12,left:0}:{top:14,right:18,bottom:6,left:0}}>
   {!mini&&<>
    <CartesianGrid stroke="#EDF0F5" vertical={false} strokeDasharray="3 5"/>
    <XAxis dataKey="day" ticks={[1,5,10,14]} tickFormatter={day=>series.find(row=>row.day===Number(day))?.currentDate.slice(5).replace('-','/')||''} axisLine={false} tickLine={false} tick={{fill:'#8791A2',fontSize:11}} tickMargin={12}/>
   </>}
   <YAxis domain={[lower,upper]} ticks={mini?[lower,upper]:[0,upper/2,upper]} interval={0} tickFormatter={value=>chartTick(Number(value),metric)} width={mini?62:66} axisLine={false} tickLine={false} tick={{fill:mini?'#929BA8':'#8791A2',fontSize:mini?10:11}} tickMargin={mini?6:12}/>
   {mini&&<XAxis dataKey="day" hide/>}
   <Tooltip labelFormatter={day=>{const point=series.find(row=>row.day===Number(day));return point?`${metric.label}, 분석 ${point.currentDate.slice(5)}, 직전 ${point.baselineDate.slice(5)}`:'';}} formatter={(value,name)=>[fmt(Number(value),metric.rate,metric.unit,metric.key),name]} contentStyle={{border:'1px solid #E8E4F0',borderRadius:8,fontSize:12,boxShadow:'0 4px 16px #27354B0A'}} wrapperStyle={{zIndex:100,pointerEvents:'none'}} cursor={{stroke:'#D9D2E7',strokeDasharray:'3 4'}}/>
   <Line name="직전 14일" dataKey="baseline" stroke="#9BA8B9" strokeWidth={mini?1.5:1.8} strokeDasharray="4 4" dot={false} activeDot={{r:3,stroke:'#FFF',strokeWidth:2}} isAnimationActive={false}/>
   <Line name="분석 기간" dataKey="current" stroke="#7357BA" strokeWidth={mini?2:2.8} dot={false} activeDot={{r:4,stroke:'#FFF',strokeWidth:2}} isAnimationActive={false}/>
  </LineChart></ResponsiveContainer>
 </div></>;
}
function PlotLegend({daily=false}:{daily?:boolean}){return <div className={`training-chart-legend ${daily?'':'training-bar-legend'}`}><span><i/>직전 14일</span><span><i/>분석 기간</span><TermInfo label="기간 비교" description={daily?'가로축은 분석 날짜이며 직전 14일의 같은 요일과 비교합니다.':'각 기간의 전체 집계값을 비교합니다.'}/></div>;}
function FunnelComparison({before,after}:{before:Total;after:Total}){
 const stages=[['sessions','랜딩 세션'],['view','상품 조회'],['cart','장바구니'],['checkout','결제 시작'],['purchases','동일 세션 구매 건수']];
 const maximum=Math.max(before.sessions,after.sessions);
 return <section className="roas-card training-funnel"><h3>랜딩 세션 기준 구매 퍼널<TermInfo label="구매 퍼널" description="같은 세션에서 순차 도달한 집계이며 재방문 구매는 제외합니다. 두 기간은 같은 눈금을 사용합니다. 이탈이 결제 오류를 뜻하지는 않습니다."/></h3><div className="training-funnel-head"><span>단계</span><span>직전 14일</span><span>분석 기간</span></div>{stages.map(([key,label],index)=><div className="training-funnel-step" key={key}><strong>{label}</strong>{[before,after].map((total,i)=>{const count=get(total,key)||0,previous=index?get(total,stages[index-1][0])||0:null;const lost=previous===null?null:previous-count;return <div key={i}><div className="training-bar-track"><i className={i?'current':''} style={{width:`${maximum?count/maximum*100:0}%`}}/></div><b>{fmt(count)}</b>{lost!==null&&<small>이전 단계에서 {fmt(lost)} 이탈 ({fmt(ratio(lost,previous),true)})</small>}</div>;})}</div>)}</section>;
}
const detailMetrics=focusMetrics.filter(metric=>metric.key!=='roas'&&metric.key!=='cac');

function MetricCards({data,filters,before,after,onSelect}:{data:TrainingData;filters:Filters;before:Total;after:Total;onSelect:(key:string)=>void}){
 return <div className="training-indicator-grid">{focusMetrics.slice(1).map(metric=><article className="training-indicator" key={metric.key} aria-label={metric.label}><div className="training-indicator-title"><span>{metric.label}</span>{metric.key!=='cac'&&<button onClick={()=>onSelect(metric.key)} aria-label={`${metric.label} 상세 분석`}>상세 분석 ↗</button>}</div><div className="training-indicator-value"><strong><MetricCell value={metricValue(after,metric.key)} metric={metric} rows={selectFacts(data,filters).filter(r=>r.periodId==='current')}/></strong><Delta metricKey={metric.key} before={metricValue(before,metric.key)} after={metricValue(after,metric.key)} rate={metric.rate}/></div><PeriodPlot data={data} filters={filters} metric={metric} mini/></article>)}</div>;
}
function CpaRelatedMetrics({before,after,onSelect}:{before:Total;after:Total;onSelect:(key:string)=>void}){
 const related=[{key:'cpc',label:'CPC',unit:'원',rate:false},{key:'cvr',label:'클릭 기준 구매 CVR',unit:'',rate:true}];
 return <section className="roas-card training-cpa-related">
  <h3>CPA 관련 지표</h3>
  <div className="wb-table-scroll"><table><thead><tr><th scope="col">지표</th><th scope="col" className="numeric">직전 14일</th><th scope="col" className="numeric">분석 기간</th><th scope="col" className="numeric">증감</th></tr></thead>
   <tbody>{related.map(item=>{const prior=metricValue(before,item.key),current=metricValue(after,item.key);
    return <tr key={item.key}><th scope="row">{item.label}</th><td className="numeric">{fmt(prior,item.rate,item.unit,item.key)}</td><td className="numeric">{fmt(current,item.rate,item.unit,item.key)}</td><td className={`numeric training-delta-${deltaTone(item.key,prior,current,item.rate)}`}>{change(prior,current,item.rate,item.key)}</td></tr>;
   })}</tbody>
  </table></div>
  <button className="training-cpa-funnel-link" onClick={()=>onSelect('cvr')}>CVR 상세에서 구매 퍼널 보기 ↗</button>
 </section>;
}
function MetricDetails({metric,data,filters,onSelect}:{metric:Metric;data:TrainingData;filters:Filters;onSelect:(key:string)=>void}){
 const [before,after]=comparePeriods(data,filters);
 return <div className="training-metric-detail">
   <div className="training-detail-heading"><h1><span tabIndex={0} title={metricDescriptions[metric.key]}>{metric.label}</span> 상세 분석</h1></div>
   <div className="training-metric-hero">
    <MetricSummary metric={metric} before={metricValue(before.total,metric.key)} after={metricValue(after.total,metric.key)} rows={after.rows}/>
    <section className="roas-card training-metric-hero-chart"><h3>{metric.label} 기간별 추이</h3><PlotLegend daily/><PeriodPlot data={data} filters={filters} metric={metric}/></section>
   </div>
   {metric.key==='cvr'&&<FunnelComparison before={before.total} after={after.total}/>}
   {metric.key==='cpa'&&<CpaRelatedMetrics before={before.total} after={after.total} onSelect={onSelect}/>}
 </div>;
}
function Comparison({before,after,items=metrics,beforeRows=[],afterRows=[]}:{before:Total;after:Total;items?:Metric[];beforeRows?:Fact[];afterRows?:Fact[]}){
 return <div className="wb-table-scroll"><table><thead><tr><th>지표</th><th className="numeric">직전 14일</th><th className="numeric">분석 기간</th><th className="numeric">증감</th></tr></thead><tbody>{items.map(m=><tr key={m.key}><td>{m.label}</td><td className="numeric"><MetricCell value={get(before,m.key)} metric={m} rows={beforeRows}/></td><td className="numeric"><MetricCell value={get(after,m.key)} before={get(before,m.key)} metric={m} rows={afterRows}/></td><td className="numeric"><Delta metricKey={m.key} before={get(before,m.key)} after={get(after,m.key)} rate={m.rate}/></td></tr>)}</tbody></table></div>;
}

export default function TrainingDashboard({onExplore,active=true}:{onExplore:()=>void;active?:boolean}){
 const [index,setIndex]=useState<Index|null>(null),[sourceData,setData]=useState<TrainingData|null>(null);
 const [analysisScope,setAnalysisScope]=useState<AnalysisScope|null>(null);
 const data=useMemo(()=>sourceData?scopeTrainingData(sourceData,analysisScope):null,[sourceData,analysisScope]);
 const [caseId,setCaseId]=useState('S16'),[snapshot,setSnapshot]=useState('initial');
 const caseContext=useRef({caseId,snapshot});
 useEffect(()=>{caseContext.current={caseId,snapshot};},[caseId,snapshot]);
 const [selectedMetric,setSelectedMetric]=useState<string|null>(null);
 const [sidebarCollapsed,setSidebarCollapsed]=useState(false),[metricsOpen,setMetricsOpen]=useState(true);
 const sidebarCollapse=useRef<HTMLButtonElement>(null),sidebarExpand=useRef<HTMLButtonElement>(null);
 const [tableSettings,setTableSettings]=useState<Record<string,TableSettings>>({});
 const updateTableSettings=useCallback((key:string,patch:TableSettings)=>setTableSettings(current=>({...current,[key]:{...current[key],...patch}})),[]);
 const [filters,setFilters]=useState<Filters>({channel:'all',source:'all',campaignId:'all',device:'all'});
 const [scopeNotice,setScopeNotice]=useState('');
 const [chatOpen,setChatOpen]=useState(false);
 const [conversations,setConversations]=useState<Record<string,{question:string;result:RoasAnswer}[]>>({});
 const chatKey=JSON.stringify([caseId,snapshot,filters.channel,filters.source||'all',filters.campaignId,filters.device,selectedMetric,analysisScope]);
 const closeChat=useCallback(()=>setChatOpen(false),[]);
 const [error,setError]=useState(''),[retry,setRetry]=useState(0),[navOpen,setNavOpen]=useState(false);
 const [evidence,setEvidenceState]=useState<Evidence|null>(null),[query,setQuery]=useState(''),[limit,setLimit]=useState(30);
 const dialog=useRef<HTMLDialogElement>(null);
 const content=useRef<HTMLElement>(null);
 const overviewScroll=useRef(0),pendingScroll=useRef<number|null>(null);
 const overviewDisclosures=useRef<boolean[]>([]);
 const evidenceHistory=useRef(new Map<number,Evidence>()),nextEvidenceId=useRef(0);
 function setEvidence(value:Evidence|null){
  if(!value&&!evidence)return;
  setQuery('');setLimit(30);
  if(value){
   const id=++nextEvidenceId.current;evidenceHistory.current.set(id,value);
   // 큰 집계 행을 브라우저 이력에 복사하지 않고 이 화면의 참조만 보관한다.
   const route={caseId,snapshot,metric:selectedMetric,device:filters.device,scroll:window.scrollY,tableSettings,filters,analysisScope};
   window.history.replaceState({...window.history.state,trainingNavigation:route},'');
   window.history.pushState({...window.history.state,trainingNavigation:{...route,evidenceId:id}},'');
  }else if(window.history.state?.trainingNavigation?.evidenceId){window.history.back();}
  setEvidenceState(value);
 }
 function resetRequest(){setAnalysisScope(null);setData(null);setError('');setEvidence(null);setScopeNotice('');}
 useEffect(()=>{
  if(!active)return;
  const previousRestoration=window.history.scrollRestoration;
  window.history.scrollRestoration='manual';
  window.history.replaceState({...window.history.state,trainingNavigation:{metric:null,view:'overview',scroll:0}},'');
  function restore(event:PopStateEvent){
   const route=event.state?.trainingNavigation;
   if(!route||(route.metric!==null&&!focusMetrics.some(item=>item.key===route.metric)))return;
   setScopeNotice('');
   pendingScroll.current=typeof route.scroll==='number'?route.scroll:0;
   const restoredMetric=detailMetrics.some(item=>item.key===route.metric)?route.metric:null;
   setSelectedMetric(restoredMetric);if(restoredMetric)setMetricsOpen(true);setEvidenceState(evidenceHistory.current.get(route.evidenceId)||null);
   if(route.tableSettings)setTableSettings(route.tableSettings);
   // Row IDs from another case or reporting snapshot cannot define the current traffic slice.
   const sameContext=(!route.caseId||route.caseId===caseContext.current.caseId)&&(!route.snapshot||route.snapshot===caseContext.current.snapshot);
   setAnalysisScope(sameContext?route.analysisScope||null:null);
   if(!sameContext)setScopeNotice('사례 또는 보고 시점이 달라 세부 범위를 해제했습니다.');
   if(route.filters)setFilters(route.filters);
   if(!route.filters&&['all','mobile','desktop'].includes(route.device))setFilters(current=>({...current,device:restoredMetric===null?'all':route.device}));
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
 },[selectedMetric,evidence,analysisScope,filters]);
 function navigate(metric:string|null){
  setScopeNotice('');
  if(!evidence&&metric===selectedMetric){window.scrollTo({top:0});return;}
  if(!selectedMetric){overviewScroll.current=window.scrollY;overviewDisclosures.current=Array.from(content.current?.querySelectorAll('details')||[],node=>node.open);}
  const top=metric===null?overviewScroll.current:0;
  const nextDevice=filters.device;
  window.history.replaceState({...window.history.state,trainingNavigation:{...window.history.state?.trainingNavigation,caseId,snapshot,metric:selectedMetric,device:filters.device,scroll:window.scrollY,tableSettings,filters,analysisScope}},'');
  window.history.pushState({...window.history.state,trainingNavigation:{caseId,snapshot,metric,device:nextDevice,scroll:top,tableSettings,filters,analysisScope}},'');
  pendingScroll.current=top;setFilters(current=>({...current,device:nextDevice}));setSelectedMetric(metric);if(metric)setMetricsOpen(true);setNavOpen(false);setEvidenceState(null);
 }
 useEffect(()=>{if(active)document.title='마케팅 성과 | '+(selectedMetric?focusMetrics.find(m=>m.key===selectedMetric)?.label+' 상세 분석':'성과 현황');},[active,selectedMetric]);
 useEffect(()=>{const controller=new AbortController();fetch('/workbench-data/current/training-index.json',{signal:controller.signal,cache:'no-cache'}).then(async response=>{if(!response.ok)throw Error('사례 목록을 불러오지 못했습니다.');return response.json();}).then((raw:unknown)=>{const value=raw as Index;if(value.contract!=='roas-training/1'||!Array.isArray(value.cases)||!Array.isArray(value.snapshots))throw Error('사례 목록의 규약을 확인하지 못했습니다.');if(!controller.signal.aborted)setIndex(value);}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'목록 요청에 실패했습니다.');});return()=>controller.abort();},[retry]);
 useEffect(()=>{if(!index)return;const controller=new AbortController();fetch(`/workbench-data/current/training-${caseId}-${snapshot}.json`,{signal:controller.signal,cache:'no-cache'}).then(async response=>{if(!response.ok)throw Error('성과 데이터를 불러오지 못했습니다.');return response.json();}).then((raw:unknown)=>{const value=raw as TrainingData;if(value.contract!=='roas-training/1'||value.caseId!==caseId||!value.periods.some(p=>p.id==='baseline')||!value.periods.some(p=>p.id==='current'))throw Error('성과 데이터의 규약을 확인하지 못했습니다.');if(!controller.signal.aborted)setData(value);}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'데이터 요청에 실패했습니다.');});return()=>controller.abort();},[index,caseId,snapshot,retry]);
 useEffect(()=>{if(evidence){dialog.current?.showModal();dialog.current?.querySelector<HTMLButtonElement>('[aria-label="근거 닫기"]')?.focus();}else dialog.current?.close();},[evidence]);
 const periods=useMemo(()=>data?comparePeriods(data,filters):[],[data,filters]);
 const evidenceRows=useMemo(()=>evidence?.rows.filter(row=>(JSON.stringify(row)+' '+displayTrainingText(JSON.stringify(row))).toLocaleLowerCase().includes(query.toLocaleLowerCase()))||[],[evidence,query]);
 const before=periods.find(p=>p.period.id==='baseline'),after=periods.find(p=>p.period.id==='current');
 function filter(key:keyof Filters,value:string){setAnalysisScope(null);setScopeNotice('');setFilters(current=>{const next={...current,[key]:value};if(data&&!data.campaigns.some(c=>c.id===next.campaignId&&(next.channel==='all'||c.channel===next.channel)&&(!next.source||next.source==='all'||c.source===next.source)))next.campaignId='all';return next;});}
 function changeMedia(key:string){
  if(!data)return;
  setAnalysisScope(null);
  const next=changeTrainingMedia(data,{...filters,campaignId:'all'},key);
  setScopeNotice(filters.campaignId!=='all'?'선택한 집행처의 전체 캠페인을 조회합니다.':'');
  setFilters(next);
 }
 function narrow(group:AnalysisGroup,dimension:AnalysisDimension){
  const first=group.rows[0];
  const nextFilters={...filters,...(dimension==='device'?{device:first.device}:{campaignId:first.campaignId})};
  const nextScope=['campaign','device'].includes(dimension)?analysisScope:{dimension,key:group.key,label:group.label,rowIds:group.rows.map(r=>r.id)};
  const route={caseId,snapshot,metric:selectedMetric,filters,device:filters.device,analysisScope,tableSettings,scroll:window.scrollY};
  window.history.replaceState({...window.history.state,trainingNavigation:route},'');
  window.history.pushState({...window.history.state,trainingNavigation:{...route,filters:nextFilters,analysisScope:nextScope,device:nextFilters.device,scroll:0}},'');
  setFilters(nextFilters);setAnalysisScope(nextScope);setScopeNotice('');
  window.scrollTo({top:0});
 }
 const analysisPanel=data?<KpiAnalysisPanel data={data} filters={filters} metricKey={selectedMetric||'roas'} settings={tableSettings[selectedMetric||'roas']||{}} onSettings={patch=>updateTableSettings(selectedMetric||'roas',patch)} onNarrow={narrow} onEvidence={setEvidence}
  renderTrend={(scoped,metric)=><><PlotLegend daily/><PeriodPlot data={scoped} filters={filters} metric={metric}/></>}
  renderFunnel={(before,after)=><FunnelComparison before={before} after={after}/>}/>:null;
 return <div className={`wb roas-workbench roas-data-dashboard training-dashboard ${sidebarCollapsed?'training-sidebar-collapsed':''} ${navOpen?'wb-nav-open':''} ${chatOpen&&active&&data&&!error?'wb-with-panel':''}`}>
  <a className="wb-skip" href="#training-content">본문 바로가기</a>
  <aside id="training-sidebar" className="wb-sidebar"><div className="wb-logo"><span><Layers size={19}/></span><div>Marketing<span>데이터 대시보드</span></div><button ref={sidebarCollapse} className="training-sidebar-collapse" aria-label="사이드바 접기" title="사이드바 접기" aria-controls="training-sidebar" aria-expanded="true" onClick={()=>{setSidebarCollapsed(true);requestAnimationFrame(()=>sidebarExpand.current?.focus());}}><PanelLeftClose size={18}/></button><button className="wb-mobile" aria-label="메뉴 닫기" onClick={()=>setNavOpen(false)}><X size={18}/></button></div><nav aria-label="성과 메뉴"><button className={!selectedMetric?'active':undefined} aria-current={!selectedMetric?'page':undefined} onClick={()=>navigate(null)}><BarChart3 size={17}/>성과 현황</button><div className="training-sidebar-detail"><button id="training-detail-label" className="training-sidebar-group" aria-expanded={metricsOpen} aria-controls="training-metric-list" onClick={()=>setMetricsOpen(open=>!open)}><FolderOpen size={16} aria-hidden="true"/>지표 상세<ChevronDown size={14} aria-hidden="true"/></button><ul id="training-metric-list" hidden={!metricsOpen} aria-labelledby="training-detail-label">{detailMetrics.map(metric=><li key={metric.key}><button className={selectedMetric===metric.key?'active':undefined} aria-current={selectedMetric===metric.key?'page':undefined} aria-label={metric.label+' 상세 분석'} onClick={()=>navigate(metric.key)}>{metric.label}</button></li>)}</ul></div></nav><div className="roas-side-bottom"><details className="training-test-cases"><summary>테스트 케이스{caseId!=='S16'&&<small>{index?.cases.find(item=>item.id===caseId)?.label}</small>}</summary><label>테스트 데이터<select aria-label="데이터 사례" value={caseId} onChange={e=>{if(e.target.value!==caseId){resetRequest();setCaseId(e.target.value);}}}><option value="S16">기본 대시보드</option>{index?.cases.filter(item=>item.id!=='S16').map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>보고 기준시점<select aria-label="보고 기준시점" value={snapshot} onChange={e=>{if(e.target.value!==snapshot){resetRequest();setSnapshot(e.target.value);}}}>{index?.snapshots.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label><p className="training-case-description">{caseDescriptions[caseId]}</p></details><button onClick={onExplore}><Layers size={17}/>(구) 대시보드 확인</button></div></aside>
  {navOpen&&<button className="wb-nav-shade" aria-label="메뉴 닫기" onClick={()=>setNavOpen(false)}/>}
  <div className="wb-main"><div className="training-query-context"><header className="wb-header training-navigation-header"><button ref={sidebarExpand} className="training-sidebar-expand" aria-label="사이드바 펼치기" title="사이드바 펼치기" aria-controls="training-sidebar" aria-expanded="false" onClick={()=>{setSidebarCollapsed(false);requestAnimationFrame(()=>sidebarCollapse.current?.focus());}}><PanelLeftOpen size={18}/></button><button className="wb-mobile" aria-label="메뉴 열기" aria-controls="training-sidebar" aria-expanded={navOpen} onClick={()=>setNavOpen(true)}><Menu size={18}/></button><nav className="training-breadcrumb" aria-label="탐색 경로"><button onClick={()=>navigate(null)} aria-current={!selectedMetric?'page':undefined}>성과 현황</button>{selectedMetric&&<><span aria-hidden="true">/</span><span aria-current="page">{focusMetrics.find(item=>item.key===selectedMetric)?.label} 상세</span></>}</nav><div className="training-color-legend" aria-label="증감 색상 의미"><span className="training-delta-positive">빨강: 개선</span><span className="training-delta-negative">파랑: 악화</span><span>회색: 중립</span></div><span className="wb-synthetic">가상 데이터</span></header>
   {before&&after&&<div className="training-analysis-context"><div><span>분석 기간</span><strong>{periodLabel(after.period.start,after.period.end)}</strong></div><div><span>비교</span><strong>직전 14일</strong><small>{periodLabel(before.period.start,before.period.end)}</small></div><div><span>사례</span><strong>{data?.caseId}</strong><span>보고 기준</span><strong>{data&&new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(data.asOf))}</strong></div></div>}
   <div className="roas-dashboard-filters"><TrainingScopePicker data={data} filters={filters} onCampaign={id=>{setAnalysisScope(null);setFilters(current=>({...current,channel:'all',source:'all',campaignId:id}));setScopeNotice('');}} onMedia={changeMedia}/>{filters.device!=='all'&&<span className="training-device-context">조회 기기: {names[filters.device]}<button onClick={()=>filter('device','all')}>전체 기기로 보기</button></span>}<TooltipProvider delayDuration={150}><InfoTooltip><TooltipTrigger className="training-measure-info" aria-label="집계 기준 안내">집계 기준<Info size={13} aria-hidden="true"/></TooltipTrigger><TooltipContent side="bottom" align="end" sideOffset={8} className="training-measure-tooltip">매출은 7일 내 마지막 유료 클릭에 기록한 구매 전환 매출입니다. 광고 접점일 기준이며 환불, 세금과 배송비는 제외합니다.<br/>{trainingCostDefinition}</TooltipContent></InfoTooltip></TooltipProvider></div>
   <div className="training-scope-notice" role="status">{scopeNotice}</div>{analysisScope&&<div className="training-analysis-scope"><span>세부 분석 범위: {analysisScope.label}</span><button onClick={()=>{setAnalysisScope(null);setScopeNotice('세부 범위를 해제했습니다.');}}>세부 범위 해제</button></div>}</div>
   <main ref={content} id="training-content" aria-busy={!data&&!error}>{error?<section className="wb-empty" role="alert"><h2>{error}</h2><button onClick={()=>{resetRequest();setRetry(v=>v+1);}}>다시 불러오기</button></section>:!data||!before||!after?<section className="wb-empty" role="status">성과 데이터 불러오는 중</section>:<>
    {!selectedMetric&&<div className="roas-dashboard-heading"><h1>성과 현황</h1></div>}
    {!selectedMetric&&<div className="training-metric-hero training-overview-hero"><MetricSummary before={before.total.rates.roas} after={after.total.rates.roas}/><section className="roas-card training-roas-overview training-metric-hero-chart"><div className="roas-card-heading"><h3>ROAS 기간별 추이</h3><button onClick={()=>document.getElementById('training-campaign-roas')?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}>ROAS 원인 분석 표</button></div><PlotLegend daily/><PeriodPlot data={data} filters={filters} metric={focusMetrics[0]}/></section></div>}
    {(selectedMetric?<MetricDetails metric={focusMetrics.find(m=>m.key===selectedMetric)!} data={data} filters={filters} onSelect={navigate}/>:<>
     <section className="training-secondary-metrics"><div className="training-section-heading"><h3>보조 지표와 추이</h3></div>
      <MetricCards data={data} filters={filters} before={before.total} after={after.total} onSelect={key=>navigate(key)}/>
     </section>
     {analysisPanel}
     <details className="roas-card training-table-disclosure"><summary>전체 성과 지표와 기간별 수치</summary><Comparison before={before.total} after={after.total}/></details>
    </>)}
    {selectedMetric&&analysisPanel}

   </>}</main>
  </div>
  {active&&!chatOpen&&<button id="wb-chat-launcher" className="wb-chat-launcher" aria-label="AI와 대화" title="AI와 대화" aria-haspopup="dialog" aria-expanded={false} aria-controls="wb-agent-panel" disabled={!data||!!error} onClick={()=>setChatOpen(true)}><Sparkles size={25} aria-hidden="true"/></button>}
  {active&&chatOpen&&data&&!error&&<RoasConversation key={chatKey} data={data} snapshot={snapshot} filters={filters} metric={selectedMetric||''} screenTitle={selectedMetric?`${focusMetrics.find(m=>m.key===selectedMetric)?.label} 상세 분석`:'성과 현황'} localScopeLabel={analysisScope?.label} onClearScope={()=>setAnalysisScope(null)} onClose={closeChat} exchanges={conversations[chatKey]||[]} onExchange={exchange=>setConversations(current=>({...current,[chatKey]:[...(current[chatKey]||[]),exchange].slice(-12)}))}/>}
  <dialog ref={dialog} className="roas-evidence" aria-labelledby="training-evidence-title" onClose={()=>setEvidence(null)}><header><h2 id="training-evidence-title">{evidence?.title}</h2><div className="training-evidence-actions"><button onClick={()=>navigate(null)}>성과 현황</button><button aria-label="근거 닫기" onClick={()=>setEvidence(null)}><X size={18}/></button></div></header><div className="roas-evidence-body"><label className="roas-evidence-search"><Search size={15}/><input aria-label="근거 검색" value={query} onChange={e=>{setQuery(e.target.value);setLimit(30);}} placeholder="내용, 날짜, ID 검색"/></label><p>{evidenceRows.length.toLocaleString('ko-KR')}개 집계 행 또는 상세 기록</p>{evidenceRows.slice(0,limit).map((row,i)=><details key={i}><summary>{displayTrainingText((row as {title?:string}).title||(row as {id?:string}).id||`집계 ${i+1}`)}</summary><EvidenceFields row={row} data={data}/></details>)}{evidenceRows.length>limit&&<button onClick={()=>setLimit(v=>v+30)}>30개 더 보기</button>}</div></dialog>
 </div>;
}
