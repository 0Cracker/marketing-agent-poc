import {Fragment,useId} from 'react';
import type {ReactNode} from 'react';
import {metricChange,selectBreakdowns,selectFacts,summarize} from '../../shared/training-dashboard.mjs';
import type {Filters,Total,TrainingData} from '../../shared/training-dashboard.mjs';
import {analysisColumns,analysisDimensions,analysisMetric,analysisMissingReason,analysisRows,analysisValue,analyzeGroups,dimensionNames,factorEffects,sortAnalysisGroups} from './training-analysis';
import type {AnalysisDimension,AnalysisGroup,AnalysisMetric,AnalysisSettings} from './training-analysis';
import {deltaTone} from './training-presentation';

const format=(value:number|null,metric:AnalysisMetric,maximumFractionDigits=1)=>value===null?'계산 불가':(metric.rate?value*100:value).toLocaleString('ko-KR',{maximumFractionDigits})+(metric.rate?'%':metric.unit||'');
function signed(value:number|null,metric:AnalysisMetric){
 if(value===null)return '계산 불가';
 const rounded=Number((value*(metric.rate?100:1)).toFixed(1))||0;
 return (rounded>0?'+':'')+rounded.toLocaleString('ko-KR',{maximumFractionDigits:1})+(metric.rate?'%p':metric.unit||'');
}
function impactTone(metric:AnalysisMetric,value:number|null){
 if(value===null||Number((value*(metric.rate?100:1)).toFixed(1))===0)return 'neutral';
 return (['cpc','cpa'].includes(metric.key)?value<0:value>0)?'positive':'negative';
}
const delta=(before:number|null,after:number|null,metric:AnalysisMetric)=>{
 const value=metricChange(before,after,metric.rate);
 return value===null?(before===0&&after!==null?'기준값 0':'비교 불가'):metric.rate?signed(value,metric):signed(value,{...metric,rate:true}).replace('%p','%');
};
const formulas:Record<string,string>={roas:'귀속 구매 매출 / 집행비',cpc:'집행비 / 클릭수',cvr:'귀속 구매 주문수 / 클릭수',cpa:'집행비 / 귀속 구매 주문수',aov:'귀속 구매 매출 / 귀속 구매 주문수',adCtr:'광고 클릭수 / 광고 노출수',adCpm:'광고 집행비 × 1,000 / 광고 노출수',contentClickRate:'추적 링크 클릭수 / 콘텐츠 조회수',contentCpm:'콘텐츠 제휴 비용 × 1,000 / 콘텐츠 조회수',sessionCvr:'같은 세션 구매 / 랜딩 세션',viewRate:'상품 조회 세션 / 랜딩 세션',cartRate:'장바구니 세션 / 상품 조회 세션',beginRate:'결제 시작 세션 / 장바구니 세션',checkoutRate:'같은 세션 구매 / 결제 시작 세션',paymentFailureRate:'결제 실패 / 결제 시도',loadMs:'로드 시간 합계 / 측정 횟수',unitPrice:'할인 전 금액 / 판매 수량',realizedPrice:'귀속 구매 매출 / 판매 수량',unitsPerOrder:'판매 수량 / 귀속 구매 주문수',discountRate:'할인액 / 할인 전 금액',orderShare:'상품 주문수 / 선택 그룹 주문수',impressionShare:'행의 노출수 / 선택 범위 전체 광고 노출수',spendShare:'행의 집행비 / 선택 범위 전체 집행비',clickShare:'행의 클릭수 / 선택 범위 전체 클릭수'};

function Value({value,metric,rows}:{value:number|null;metric:AnalysisMetric;rows:AnalysisGroup['rows']}){
 if(value!==null)return <>{format(value,metric)}</>;
 const missing=analysisMissingReason(rows,metric.key);
 return <span className="training-missing-value" tabIndex={0} title={missing.reason}>{missing.label}</span>;
}
function CurrentCell({group,metric,totals}:{group:AnalysisGroup;metric:AnalysisMetric;totals:Total[]}){
 const values=[group.before,group.after].map((t,i)=>group.periodRows[i].length?analysisValue(t,metric.key,totals[i]):null);
 const tone=deltaTone(metric.key,values[0],values[1],metric.rate);
 return <td className="numeric"><strong className={`training-delta-${tone}`}><Value value={values[1]} metric={metric} rows={group.periodRows[1]}/></strong><small className={`training-cell-change training-delta-${tone}`}>{delta(values[0],values[1],metric)}</small></td>;
}
function EvidenceTable({group,keys,totals,content=false}:{group:AnalysisGroup;keys:string[];totals:Total[];content?:boolean}){
 return <div className="wb-table-scroll"><table className="training-calculation-table"><thead><tr><th>지표와 계산 기준</th><th className="numeric">직전 14일</th><th className="numeric">분석 기간</th><th className="numeric">증감</th></tr></thead><tbody>{[...new Set(keys)].map(key=>{
  const metric=content&&key==='impressions'?{key,label:'콘텐츠 조회수',unit:'회'}:analysisMetric(key);
  const values=[group.before,group.after].map((t,i)=>group.periodRows[i].length?analysisValue(t,key,totals[i]):null);
  return <tr key={key}><th scope="row">{metric.label}{formulas[key]&&<small>{formulas[key]}</small>}</th>{values.map((v,i)=><td className="numeric" key={i}><Value value={v} metric={metric} rows={group.periodRows[i]}/></td>)}<td className={`numeric training-delta-${deltaTone(key,values[0],values[1],metric.rate)}`}>{delta(values[0],values[1],metric)}</td></tr>;
 })}</tbody></table></div>;
}

export function KpiFactors({data,filters,metricKey,onSelect}:{data:TrainingData;filters:Filters;metricKey:string;onSelect?:(key:string)=>void}){
 const facts=selectFacts(data,filters);
 const sections=metricKey==='cpc'?['ad_impression','content_view']:['all'];
 const explanations:Record<string,string>={adCtr:'CTR은 클릭수 ÷ 광고 노출수입니다. 소재 안에서 클릭 반응이 달라졌는지, 소재별 노출 비중이 바뀌었는지 나누어 확인하세요.',cvr:'클릭 기준 CVR은 귀속 구매 주문수 ÷ 클릭수입니다. 아래 같은 세션 구매 퍼널은 재방문 구매를 제외한 별도 분석입니다.',aov:'AOV는 귀속 구매 매출 ÷ 귀속 구매 주문수입니다. 상품별 주문 비중과 할인 조건을 확인하세요. 현재 Mock은 모든 주문이 상품 1개여서 주문당 수량은 1, 평균 실현 판매가는 AOV와 같습니다.'};
 if(!['roas','cpa','cpc'].includes(metricKey))return <section className="roas-card training-factor-summary"><h3>수치 변화를 확인할 기준</h3><p>{explanations[metricKey]}</p></section>;
 return <section className="roas-card training-factor-summary"><h3>수식상 변화 설명</h3>{sections.map(section=>{
  const rows=section==='all'?facts:facts.filter(r=>r.exposureBasis===section);if(!rows.length)return null;
  const pair=['baseline','current'].map(p=>summarize(rows.filter(r=>r.periodId===p)));
  const kind=metricKey as 'roas'|'cpa'|'cpc',content=section==='content_view';
  const effects=factorEffects(kind,pair[0].rates,pair[1].rates,content);
  const target=analysisMetric(metricKey);
  return <div key={section} className="training-factor-section">{section!=='all'&&<h4>{content?'콘텐츠 제휴':'광고 집행'} 범위의 CPC 분해</h4>}<p>{kind==='roas'?'ROAS = AOV × CVR ÷ CPC':kind==='cpa'?'CPA = CPC ÷ CVR':content?'CPC = 조회 1,000회당 비용 ÷ (1,000 × 콘텐츠 링크 클릭률)':'CPC = 광고 CPM ÷ (1,000 × 광고 CTR)'}</p>{effects?<div className="training-factor-grid">{effects.map(effect=>{
   const m=analysisMetric(effect.key),tone=impactTone(target,effect.impact);
   return <article key={effect.key}><div>{onSelect&&['cpc','cvr','aov'].includes(m.key)?<button onClick={()=>onSelect(m.key)}>{m.label} 상세 분석</button>:<strong>{m.label}</strong>}</div><p>{format(effect.before,m,m.rate?3:1)} → {format(effect.after,m,m.rate?3:1)}</p><span className={`training-delta-${tone}`}>{target.label} 변화 기여 {signed(effect.impact,target)}</span></article>;
  })}</div>:<p className="roas-data-note">클릭, 주문 또는 비용이 0이거나 비교할 자료가 없어 구성 지표의 기여를 분해할 수 없습니다.</p>}</div>;
 })}<p className="roas-data-note">구성 지표를 바꾸는 모든 순서의 평균입니다. 수식상 변화 분해이며 실제 인과관계나 개선 시 회복 효과를 뜻하지 않습니다.{metricKey==='cpc'&&' 광고와 콘텐츠 분해는 각 구역의 집계 범위에만 해당합니다. 콘텐츠는 클릭당 정산이므로 조회 단가 변화가 광고 경매 경쟁을 뜻하지 않습니다.'}</p></section>;
}

type PanelProps={data:TrainingData;filters:Filters;metricKey:string;settings:AnalysisSettings;onSettings:(patch:AnalysisSettings)=>void;onNarrow:(group:AnalysisGroup,dimension:AnalysisDimension)=>void;onEvidence:(e:{title:string;rows:object[]})=>void;renderTrend:(data:TrainingData,metric:AnalysisMetric)=>ReactNode;renderRecords:(data:TrainingData)=>ReactNode;renderFunnel:(before:Total,after:Total)=>ReactNode};

function groupData(data:TrainingData,group:AnalysisGroup):TrainingData{
 const campaigns=new Set(group.rows.map(r=>r.campaignId)),devices=new Set(group.rows.map(r=>r.device));
 const matches=(r:{campaignId:string;device:string})=>campaigns.has(r.campaignId)&&devices.has(r.device);
 const traffic=group.rows.some(r=>'dimension' in r&&r.dimension==='traffic');
 return {...data,facts:group.rows,breakdowns:traffic?group.rows as TrainingData['breakdowns']:data.breakdowns.filter(matches),reach:data.reach.filter(matches),records:data.records.filter(r=>(!r.campaignId||campaigns.has(r.campaignId))&&(r.device==='all'||devices.has(r.device)))};
}

function ProductEvidence({data,filters}:{data:TrainingData;filters:Filters}){
 const rows=selectBreakdowns(data,filters,'product'),analysis=analyzeGroups(data,rows,'aov','product');
 const columns=['orders','orderShare','revenue','unitPrice','realizedPrice','discountRate'];
 if(!rows.length)return <p className="roas-data-note">선택한 유입 분할에는 상품별 교차 집계가 없습니다. 상품 구성 분석은 세부 범위를 해제한 뒤 확인하세요.</p>;
 return <section className="training-product-evidence"><h4>상품 구성과 할인</h4><p className="roas-data-note">현재 한 주문은 한 상품에만 속합니다. 주문 비중의 분모는 이 그룹의 전체 주문수입니다. 할인 전 단가와 실현 판매가를 구분합니다.</p><div className="wb-table-scroll"><table className="training-analysis-table"><thead><tr><th>상품</th>{columns.map(k=><th key={k} className="numeric">{analysisMetric(k).label}</th>)}</tr></thead><tbody>{analysis.groups.map(g=><Fragment key={g.key}><tr><th scope="row">{g.label}</th>{columns.map(k=><CurrentCell key={k} group={g} metric={analysisMetric(k)} totals={analysis.totals}/>)}</tr><tr><td colSpan={columns.length+1}><details><summary>{g.label}, 직전값과 계산 근거</summary><EvidenceTable group={g} totals={analysis.totals} keys={[...columns,'units','listRevenue','discount']}/></details></td></tr></Fragment>)}</tbody></table></div></section>;
}

function GroupDetails({group,dimension,analysis,columns,...props}:{group:AnalysisGroup;dimension:AnalysisDimension;analysis:ReturnType<typeof analyzeGroups>;columns:string[]}&PanelProps){
 const {data,metricKey,filters,onNarrow,onEvidence,renderTrend,renderRecords,renderFunnel}=props;
 const metric=analysisMetric(metricKey),scoped=groupData(data,group),content=group.rows.every(r=>r.exposureBasis==='content_view');
 const extras:Record<string,string[]>={roas:['clicks','orders','spendShare'],cpc:['impressions','clickShare'],adCtr:['spend','adCpm'],cvr:['returnPurchases','sessionCvr'],cpa:['clicks','aov'],aov:['units','listRevenue','discount','unitPrice','realizedPrice','unitsPerOrder']};
 const funnelKeys=['sessions','view','viewRate','cart','cartRate','checkout','beginRate','purchases','checkoutRate','sessionCvr','returnPurchases'];
 return <div className="training-analysis-detail">
  <div className="training-analysis-detail-heading"><h4>{group.label}, 상세</h4><div><button onClick={()=>onNarrow(group,dimension)}>이 대상으로 좁혀 보기</button><button onClick={()=>onEvidence({title:group.label+', 집계 근거',rows:group.rows})}>원천 집계 보기</button></div></div>
  <section><h4>전체 변화 기여의 계산</h4><dl className="training-impact-breakdown"><div><dt>그룹 자체 지표 변화</dt><dd>{signed(group.efficiency,metric)}</dd></div><div><dt>구성 비중 변화</dt><dd>{signed(group.mix,metric)}</dd></div><div><dt>전체 변화 기여</dt><dd>{signed(group.impact,metric)}</dd></div></dl>
   <p className="roas-data-note">구성 비중의 기준은 {analysisMetric(analysis.denominator).label}입니다. 직전 {format(group.weights[0],{key:'weight',label:'비중',rate:true})}, 현재 {format(group.weights[1],{key:'weight',label:'비중',rate:true})}. 구성 변화의 비교 기준은 전체 {metric.label}의 두 기간 평균입니다. 전체 기여는 각 행의 합이 전체 변화와 일치하도록 계산한 값입니다.</p>
   {group.efficiency===null&&<p className="roas-data-note">한 기간의 자료가 없거나 그룹 분모가 0이어서 자체 변화와 구성 변화를 분리하지 않았습니다. 전체 분모가 유효하면 전체 기여만 계산합니다.</p>}
  </section>
  <section><h4>직전값과 계산 근거</h4><EvidenceTable group={group} totals={analysis.totals} content={content} keys={[...columns,...extras[metricKey]]}/></section>
  <section><h4>{metric.label} 일별 추이</h4>{renderTrend(scoped,metric)}</section>
  {['cvr','cpa'].includes(metricKey)&&<section>{renderFunnel(group.before,group.after)}<EvidenceTable group={group} totals={analysis.totals} keys={funnelKeys}/><h4>결제, 페이지 도달 환경과 계측 대조</h4><EvidenceTable group={group} totals={analysis.totals} keys={['paymentAttempts','paymentFailures','paymentFailureRate','loadMs','loadTotalMs','loadSamples','redirectErrors','orders','ledgerOrders','revenue','ledgerRevenue','trackingExpected','trackingReceived','duplicateEvents']}/><p className="roas-data-note">클릭 기준 CVR과 같은 세션의 순차 퍼널은 집계 범위가 다릅니다. 결제 실패는 결제 시도 기준이며 퍼널 이탈과 동일하지 않습니다. 최근 귀속 주문과 매출은 보고 시점에 따라 추가 반영될 수 있습니다.</p></section>}
  {metricKey==='aov'&&<ProductEvidence data={scoped} filters={filters}/>}
  {metricKey==='adCtr'&&<ReachEvidence data={scoped}/>}
  <details className="training-reference-records"><summary>기준 설정과 소재 원문</summary><p className="roas-data-note">캠페인 범위의 초기 설정, 소재, 랜딩, 판매 상태와 수집 기준입니다. 이후 변경은 아래 운영 이력과 함께 확인하세요.</p>{scoped.records.filter(r=>['campaign','creative','landing','inventory','tracking'].includes(r.category)).map(r=><div key={r.id}><span>{r.date}, {r.title}</span><button onClick={()=>onEvidence({title:r.title,rows:[r]})}>기록 원문 보기</button></div>)}</details>
  <section><h4>원인 확인용 근거</h4><p className="roas-data-note">운영 기록은 해당 캠페인과 기기 범위입니다. 소재, 타깃, 검색어별 효과를 입증하는 자료는 아닙니다.{['audienceId','creativeId','placement','keyword'].includes(dimension)&&' 유입별 비용은 교육용 가상 배분입니다.'}</p>{renderRecords(scoped)}</section>
 </div>;
}

function ReachEvidence({data}:{data:TrainingData}){
 return <section><h4>캠페인과 기기별 도달, 빈도</h4>{!data.reach.length?<p className="roas-data-note">선택한 세부 범위의 도달 자료가 없습니다.</p>:<div className="wb-table-scroll"><table><thead><tr><th>캠페인</th><th>기기</th><th>기간</th><th>노출수</th><th>도달</th><th>빈도, 노출수 / 도달</th></tr></thead><tbody>{data.reach.map(r=><tr key={[r.campaignId,r.device,r.periodId].join(':')}><td>{data.campaigns.find(c=>c.id===r.campaignId)?.label}</td><td>{r.device==='mobile'?'모바일':'PC'}</td><td>{r.periodId==='baseline'?'직전 14일':'분석 기간'}</td><td>{r.impressions.toLocaleString('ko-KR')}</td><td>{r.reach===null?'미집계':r.reach.toLocaleString('ko-KR')}</td><td>{r.reach?format(r.impressions/r.reach,{key:'frequency',label:'빈도',unit:'회'}):'계산 불가'}</td></tr>)}</tbody></table></div>}<p className="roas-data-note">이 자료는 소재별 도달이 아닙니다. 캠페인과 기기 사이의 도달은 중복될 수 있어 합산하지 않습니다.</p></section>;
}

export function KpiAnalysisPanel(props:PanelProps){
 const {data,filters,metricKey,settings,onSettings}=props,id=useId();
 const supported=analysisDimensions(data,filters,metricKey);
 const dimension=settings.dimension&&supported.includes(settings.dimension)?settings.dimension:supported[0]||(metricKey==='adCtr'?'creativeId':'campaign');
 const rows=analysisRows(data,filters,metricKey,dimension),analysis=analyzeGroups(data,rows,metricKey,dimension);
 const groups=sortAnalysisGroups(analysis,metricKey,settings),metric=analysisMetric(metricKey),expanded=settings.expanded||[];
 const columns=analysisColumns[metricKey];
 const sortColumns=metricKey==='cpc'?[...columns,'contentClickRate','contentCpm']:columns;
 const sections=metricKey==='cpc'?['ad_impression','content_view']:['all'];
 function toggle(key:string){onSettings({expanded:expanded.includes(key)?expanded.filter(k=>k!==key):[...expanded,key]});}
 function order(key:string){onSettings({sortKey:key,sortBasis:'current',descending:settings.sortKey===key?!settings.descending:true});}
 return <section className="roas-card training-analysis-panel" id={metricKey==='roas'?'training-campaign-roas':undefined} aria-label={`${metric.label} 원인 분석 표`}>
  <div className="roas-card-heading"><h3>{metric.label} 변화, 어디부터 확인할까요?</h3></div>
  <p className="roas-data-note">분자와 분모, 관련 지표로 수치 변화를 확인한 뒤 행을 펼쳐 운영 근거를 살펴보세요. 전체 변화 기여는 실제 인과관계가 아닌 수학적 분해입니다.</p>
  <div className="training-analysis-controls"><label>분석 단위<select aria-label={`${metric.label} 분석 단위`} value={dimension} onChange={e=>onSettings({dimension:e.target.value as AnalysisDimension,expanded:[]})}>{supported.map(d=><option key={d} value={d}>{dimensionNames[d]}</option>)}</select></label><label>정렬 기준<select aria-label={`${metric.label} 정렬 기준`} value={settings.sortBasis||'impact'} onChange={e=>onSettings({sortBasis:e.target.value as AnalysisSettings['sortBasis'],sortKey:metricKey,descending:undefined})}><option value="impact">전체 변화 기여</option><option value="current">현재값</option><option value="change">직전 대비 증감</option></select></label>{(settings.sortBasis||'impact')!=='impact'&&<><label>정렬 지표<select aria-label={`${metric.label} 정렬 지표`} value={settings.sortKey&&sortColumns.includes(settings.sortKey)?settings.sortKey:metricKey} onChange={e=>onSettings({sortKey:e.target.value})}>{sortColumns.map(k=><option key={k} value={k}>{analysisMetric(k).label}</option>)}</select></label><label>순서<select aria-label={`${metric.label} 정렬 순서`} value={settings.descending===false?'ascending':'descending'} onChange={e=>onSettings({descending:e.target.value==='descending'})}><option value="descending">내림차순</option><option value="ascending">오름차순</option></select></label></>}</div>
  {metricKey==='adCtr'&&<p className="roas-data-note">광고 노출 기준 자료만 표시합니다. 콘텐츠 조회는 제외하며 노출 비중의 분모는 선택 범위의 전체 광고 노출수입니다.</p>}
  <p className="training-analysis-total">선택 범위 전체 변화 <strong className={`training-delta-${deltaTone(metricKey,analysis.overall[0],analysis.overall[1],metric.rate)}`}>{signed(analysis.change,metric)}</strong><span>구성 비중 기준: {analysisMetric(analysis.denominator).label}</span></p>
  {sections.map(section=>{
   const chosen=section==='all'?groups:groups.filter(g=>g.rows.every(r=>r.exposureBasis===section));if(!chosen.length)return null;
   const content=section==='content_view',keys=content?columns.map(k=>k==='adCtr'?'contentClickRate':k==='adCpm'?'contentCpm':k):columns;
   return <div key={section} className="training-analysis-section">{section!=='all'&&<h4>{content?'콘텐츠 제휴':'광고 집행'}<small>전체 CPC 기여는 두 구역을 합한 클릭수 기준입니다.</small></h4>}<div className="wb-table-scroll" role="region" tabIndex={0} aria-label={`${metric.label} ${section==='all'?'':content?'콘텐츠':'광고'} 분석 표, 가로 스크롤`}><table className="training-analysis-table"><thead><tr><th>{dimensionNames[dimension]}</th>{keys.map(k=><th key={k} className="numeric"><button onClick={()=>order(k)}>{analysisMetric(k).label}</button></th>)}<th className="numeric"><button onClick={()=>onSettings({sortBasis:'impact',descending:undefined})}>전체 변화 기여</button></th></tr></thead><tbody>{chosen.map(g=>{
    const rowId=id+'-'+encodeURIComponent(dimension+':'+g.key),opened=expanded.includes(dimension+':'+g.key);
    return <Fragment key={g.key}><tr><th scope="row"><button className="training-analysis-expand" aria-expanded={opened} aria-controls={rowId} onClick={()=>toggle(dimension+':'+g.key)}><span aria-hidden="true">{opened?'−':'+'}</span>{g.label}</button></th>{keys.map(k=><CurrentCell key={k} group={g} metric={analysisMetric(k)} totals={analysis.totals}/>)}<td className={`numeric training-impact-value training-delta-${impactTone(metric,g.impact)}`}>{signed(g.impact,metric)}</td></tr><tr id={rowId} hidden={!opened} className="training-analysis-expanded-row"><td colSpan={keys.length+2}>{opened&&<GroupDetails {...props} group={g} dimension={dimension} analysis={analysis} columns={keys}/>}</td></tr></Fragment>;
   })}</tbody></table></div></div>;
  })}
  {!groups.length&&<p className="roas-data-note">선택 범위에 적용되는 분석 자료가 없습니다. 집행처와 캠페인 필터를 확인하세요.</p>}
  <p className="roas-data-note">각 셀은 현재값과 직전 대비 증감입니다. 직전값과 세부 계산은 행을 펼쳐 확인하세요. 기여도는 반올림 전 전체 변화와 일치하며 표시값 합계에는 반올림 차이가 있을 수 있습니다.</p>
 </section>;
}
