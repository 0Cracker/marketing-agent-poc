import {Fragment,useId} from 'react';
import type {ReactNode} from 'react';
import {selectBreakdowns} from '../../shared/roas/training-dashboard.mjs';
import type {Filters,Total,TrainingData} from '../../shared/roas/training-dashboard.mjs';
import {analysisColumns,analysisDimensions,analysisDisplayKeys,analysisMetric,analysisMissingReason,analysisRows,analysisValue,analyzeGroups,dimensionNames,sortAnalysisGroups} from './training-analysis';
import type {AnalysisDimension,AnalysisGroup,AnalysisMetric,AnalysisSettings} from './training-analysis';
import {deltaTone} from './training-presentation';
import {formatMetricValue,formatMetricAbsoluteDelta,formatComparedMetricDelta} from './training-format';
import {Info} from 'lucide-react';
import {Tooltip as InfoTooltip,TooltipContent,TooltipProvider,TooltipTrigger} from './components/ui/tooltip';

export function TermInfo({label,description}:{label:string;description?:string}){
 if(!description)return null;
 return <TooltipProvider delayDuration={150}><InfoTooltip><TooltipTrigger className="training-term-info" aria-label={label+' 설명'}><Info size={13} aria-hidden="true"/></TooltipTrigger><TooltipContent className="training-measure-tooltip" side="top" sideOffset={7}>{description}</TooltipContent></InfoTooltip></TooltipProvider>;
}


const format=(value:number|null,metric:AnalysisMetric)=>value===null?'계산 불가':formatMetricValue(value,metric.key,metric.rate,metric.unit);
function signed(value:number|null,metric:AnalysisMetric){return formatMetricAbsoluteDelta(value,metric.key,metric.rate,metric.unit);}
function impactTone(metric:AnalysisMetric,value:number|null){
 if(value===null||value===0||formatMetricAbsoluteDelta(value,metric.key,metric.rate,metric.unit).startsWith('≈0'))return 'neutral';
 return (['cpc','cpa'].includes(metric.key)?value<0:value>0)?'positive':'negative';
}
const delta=(before:number|null,after:number|null,metric:AnalysisMetric)=>formatComparedMetricDelta(before,after,metric.key,metric.rate);

function Value({value,metric,rows}:{value:number|null;metric:AnalysisMetric;rows:AnalysisGroup['rows']}){
 if(value!==null)return <>{format(value,metric)}</>;
 const missing=analysisMissingReason(rows,metric.key);
 return <span className="training-missing-value" title={missing.reason}>{missing.label}</span>;
}
function CurrentCell({group,metric,totals,changeFirst=false}:{group:AnalysisGroup;metric:AnalysisMetric;totals:Total[];changeFirst?:boolean}){
 const values=[group.before,group.after].map((t,i)=>group.periodRows[i].length?analysisValue(t,metric.key,totals[i]):null);
 const tone=deltaTone(metric.key,values[0],values[1],metric.rate);
 return <td className="numeric">{changeFirst?<><strong className={`training-delta-${tone}`}>{delta(values[0],values[1],metric)}</strong><small className="training-cell-change">{metric.key==='roas'&&<span className="training-current-label">현재 </span>}<Value value={values[1]} metric={metric} rows={group.periodRows[1]}/></small></>:<><strong className={`training-delta-${tone}`}><Value value={values[1]} metric={metric} rows={group.periodRows[1]}/></strong><small className={`training-cell-change training-delta-${tone}`}>{delta(values[0],values[1],metric)}</small></>}</td>;
}
function EvidenceTable({group,keys,totals,content=false}:{group:AnalysisGroup;keys:string[];totals:Total[];content?:boolean}){
 return <div className="wb-table-scroll"><table className="training-calculation-table"><thead><tr><th>지표</th><th className="numeric">직전 14일</th><th className="numeric">분석 기간</th><th className="numeric">증감</th></tr></thead><tbody>{[...new Set(keys)].map(key=>{
  const metric=content&&key==='impressions'?{key,label:'콘텐츠 조회수',unit:'회'}:analysisMetric(key);
  const values=[group.before,group.after].map((t,i)=>group.periodRows[i].length?analysisValue(t,key,totals[i]):null);
  return <tr key={key}><th scope="row"><span className="training-term-label">{metric.label}</span></th>{values.map((v,i)=><td className="numeric" key={i}><Value value={v} metric={metric} rows={group.periodRows[i]}/></td>)}<td className={`numeric training-delta-${deltaTone(key,values[0],values[1],metric.rate)}`}>{delta(values[0],values[1],metric)}</td></tr>;
 })}</tbody></table></div>;
}

type PanelProps={data:TrainingData;filters:Filters;metricKey:string;settings:AnalysisSettings;onSettings:(patch:AnalysisSettings)=>void;onNarrow:(group:AnalysisGroup,dimension:AnalysisDimension)=>void;onEvidence:(e:{title:string;rows:object[]})=>void;renderTrend:(data:TrainingData,metric:AnalysisMetric)=>ReactNode;renderFunnel:(before:Total,after:Total)=>ReactNode};

function groupData(data:TrainingData,group:AnalysisGroup):TrainingData{
 const campaigns=new Set(group.rows.map(r=>r.campaignId)),devices=new Set(group.rows.map(r=>r.device));
 const matches=(r:{campaignId:string;device:string})=>campaigns.has(r.campaignId)&&devices.has(r.device);
 const traffic=group.rows.some(r=>'dimension' in r&&r.dimension==='traffic');
 return {...data,facts:group.rows,breakdowns:traffic?group.rows as TrainingData['breakdowns']:data.breakdowns.filter(matches),reach:data.reach.filter(matches),records:data.records.filter(r=>(!r.campaignId||campaigns.has(r.campaignId))&&(r.device==='all'||devices.has(r.device)))};
}

function ProductEvidence({data,filters}:{data:TrainingData;filters:Filters}){
 const rows=selectBreakdowns(data,filters,'product'),analysis=analyzeGroups(data,rows,'aov','product');
 const columns=['orders','orderShare','revenue','unitPrice','realizedPrice','discountRate'];
 if(!rows.length)return <p className="training-empty-state">상품별 교차 집계 없음</p>;
 return <section className="training-product-evidence"><div className="wb-table-scroll"><table className="training-analysis-table"><thead><tr><th><span className="training-term-label">상품</span></th>{columns.map(k=><th key={k} className="numeric"><span className="training-term-label">{analysisMetric(k).label}</span></th>)}</tr></thead><tbody>{analysis.groups.map(g=><Fragment key={g.key}><tr><th scope="row">{g.label}</th>{columns.map(k=><CurrentCell key={k} group={g} metric={analysisMetric(k)} totals={analysis.totals}/>)}</tr><tr><td colSpan={columns.length+1}><details><summary>{g.label}, 직전값과 계산 근거</summary><EvidenceTable group={g} totals={analysis.totals} keys={[...columns,'units','listRevenue','discount']}/></details></td></tr></Fragment>)}</tbody></table></div></section>;
}

function GroupDetails({group,dimension,analysis,columns,allowNarrow=true,...props}:{group:AnalysisGroup;dimension:AnalysisDimension;analysis:ReturnType<typeof analyzeGroups>;columns:string[];allowNarrow?:boolean}&PanelProps){
 const {data,metricKey,filters,onNarrow,onEvidence,renderTrend,renderFunnel}=props;
 const metric=analysisMetric(metricKey),scoped=groupData(data,group),content=group.rows.every(r=>r.exposureBasis==='content_view');
 const extras:Record<string,string[]>={roas:['clicks','orders','spendShare'],cpc:['impressions','clickShare'],adCtr:['spend','adCpm'],cvr:['returnPurchases'],cpa:['clicks','aov'],aov:['units','listRevenue','discount','unitPrice','realizedPrice','unitsPerOrder']};
 const funnelKeys=['sessions','view','viewRate','cart','cartRate','checkout','beginRate','purchases','checkoutRate','sessionCvr','returnPurchases'];
 return <div className="training-analysis-detail">
  <div className="training-analysis-detail-heading"><h4>기간별 데이터</h4><div>{allowNarrow&&<button onClick={()=>onNarrow(group,dimension)}>이 대상으로 좁혀 보기</button>}<button onClick={()=>onEvidence({title:group.label+', 집계 근거',rows:group.rows})}>원천 집계 보기</button></div></div>
  <EvidenceTable group={group} totals={analysis.totals} content={content} keys={[...columns,...extras[metricKey]]}/>
  <details className="training-data-disclosure"><summary>일별 추이</summary>{renderTrend(scoped,metric)}</details>
  {metricKey==='cvr'&&<details className="training-data-disclosure"><summary>구매 퍼널과 결제 데이터</summary>{renderFunnel(group.before,group.after)}<EvidenceTable group={group} totals={analysis.totals} keys={[...funnelKeys,'paymentAttempts','paymentFailures','paymentFailureRate','loadMs','loadTotalMs','loadSamples','redirectErrors','orders','ledgerOrders','revenue','ledgerRevenue','trackingExpected','trackingReceived','duplicateEvents']}/></details>}
  {metricKey==='cpa'&&<details className="training-data-disclosure"><summary>결제 및 계측 데이터</summary><EvidenceTable group={group} totals={analysis.totals} keys={['paymentAttempts','paymentFailures','paymentFailureRate','loadMs','loadTotalMs','loadSamples','redirectErrors','orders','ledgerOrders','revenue','ledgerRevenue','trackingExpected','trackingReceived','duplicateEvents']}/></details>}
  {metricKey==='aov'&&<details className="training-data-disclosure"><summary>상품별 데이터</summary><ProductEvidence data={scoped} filters={filters}/></details>}
  {metricKey==='adCtr'&&<details className="training-data-disclosure"><summary>도달과 빈도</summary><ReachEvidence data={scoped}/></details>}
 </div>;
}

function ReachEvidence({data}:{data:TrainingData}){
 return <section><h4>캠페인과 기기별 도달, 빈도</h4>{!data.reach.length?<p className="training-empty-state">도달 자료 없음</p>:<div className="wb-table-scroll"><table><thead><tr><th>캠페인</th><th>기기</th><th>기간</th><th>노출수</th><th>도달</th><th>빈도, 노출수 / 도달</th></tr></thead><tbody>{data.reach.map(r=><tr key={[r.campaignId,r.device,r.periodId].join(':')}><td>{data.campaigns.find(c=>c.id===r.campaignId)?.label}</td><td>{r.device==='mobile'?'모바일':'PC'}</td><td>{r.periodId==='baseline'?'직전 14일':'분석 기간'}</td><td>{r.impressions.toLocaleString('ko-KR')}</td><td>{r.reach===null?'미집계':r.reach.toLocaleString('ko-KR')}</td><td>{r.reach?format(r.impressions/r.reach,{key:'frequency',label:'빈도',unit:'회'}):'계산 불가'}</td></tr>)}</tbody></table></div>}</section>;
}

export function KpiAnalysisPanel(props:PanelProps){
 const {data,filters,metricKey,settings,onSettings}=props,id=useId();
 const supported=analysisDimensions(data,filters,metricKey);
 const dimension=settings.dimension&&supported.includes(settings.dimension)?settings.dimension:supported[0]||(metricKey==='adCtr'?'creativeId':'campaign');
 const rows=analysisRows(data,filters,metricKey,dimension),analysis=analyzeGroups(data,rows,metricKey,dimension);
 const effectiveSettings=metricKey==='roas'&&settings.sortBasis==='value'?{...settings,sortBasis:'change' as const}:settings;
 const groups=sortAnalysisGroups(analysis,metricKey,effectiveSettings),metric=analysisMetric(metricKey),expanded=settings.expanded||[];
 // Compute child contributions against the same full selection, so children sum to the parent contribution.
 const childGroups=dimension==='campaign'?sortAnalysisGroups(analyzeGroups(data,rows,metricKey,'campaignUnit'),metricKey,effectiveSettings):[];
 const columns=analysisColumns[metricKey];
 const sections=metricKey==='cpc'?['ad_impression','content_view']:['all'];
 function toggle(key:string){onSettings({expanded:expanded.includes(key)?expanded.filter(k=>k!==key):[...expanded,key]});}
 function sortHeader(key:string){
  const impact=key==='impact',basis=metricKey==='roas'?'change':'value',active=impact?effectiveSettings.sortBasis!=='value'&&effectiveSettings.sortBasis!=='change':effectiveSettings.sortBasis===basis&&effectiveSettings.sortKey===key;
  const descending=settings.descending??(impact?(analysis.change||0)>=0:true);
  const label=impact?'전체 변화 기여':analysisMetric(key).label;
   const headerHelp=metricKey!=='roas'?undefined:impact?'전체 ROAS 변화 중 해당 행에 배분된 기여값입니다. 귀속 매출과 집행비 비중 변화를 반영하며, 인과관계를 뜻하지 않습니다. 같은 분석 범위에서 기여값의 합은 전체 변화와 일치합니다.':key==='roas'?'현재 ROAS는 해당 캠페인의 귀속 구매 매출 ÷ 유료 마케팅 집행비 × 100입니다. 증감은 분석 기간에서 직전 기간 값을 뺀 %p입니다. 이 열은 증감 기준으로 정렬됩니다.':label+'의 현재값과 직전 기간 대비 증감을 표시합니다. 이 열은 현재값이 아니라 증감 기준으로 정렬됩니다.';
  const button=<button className="training-column-sort" data-active={active} aria-label={`${label} ${impact?'기여값':metricKey==='roas'?'증감':'현재값'}, ${active&&descending?'오름차순':'내림차순'} 정렬`} onClick={()=>onSettings({sortKey:key,sortBasis:impact?'impact':basis,descending:active?!descending:true})}>{label}<span className="training-sort-arrow" aria-hidden="true">{active?(descending?'▼':'▲'):null}</span></button>;
  return <th key={key} className="numeric" aria-sort={active?(impact&&settings.descending===undefined&&analysis.change===0?'other':descending?'descending':'ascending'):'none'}><span className="training-term-label">{headerHelp?<TooltipProvider delayDuration={250}><InfoTooltip><TooltipTrigger asChild>{button}</TooltipTrigger><TooltipContent className="training-measure-tooltip" side="top" sideOffset={7}>{headerHelp}</TooltipContent></InfoTooltip></TooltipProvider>:button}</span></th>;
 }
 return <section className="roas-card training-analysis-panel" id={metricKey==='roas'?'training-campaign-roas':undefined} aria-label={`${metric.label} 원인 분석 표`}>
  <div className="roas-card-heading"><h3>{metric.label} 상세 데이터</h3></div>
  <div className="training-analysis-controls"><label>분석 단위<select aria-label={`${metric.label} 분석 단위`} value={dimension} onChange={e=>onSettings({dimension:e.target.value as AnalysisDimension,expanded:[]})}>{supported.map(d=><option key={d} value={d}>{dimensionNames[d]}</option>)}</select></label></div>
  <p className="training-analysis-total">전체 변화 <strong className={`training-delta-${deltaTone(metricKey,analysis.overall[0],analysis.overall[1],metric.rate)}`}>{signed(analysis.change,metric)}</strong></p>
  {sections.map(section=>{
   const chosen=section==='all'?groups:groups.filter(g=>g.rows.every(r=>r.exposureBasis===section));if(!chosen.length)return null;
   const content=section==='content_view',keys=content?columns.map(k=>k==='adCtr'?'contentClickRate':k==='adCpm'?'contentCpm':k):columns;
   const displayKeys=analysisDisplayKeys(metricKey,keys);
   return <div key={section} className="training-analysis-section">{section!=='all'&&<h4>{content?'콘텐츠 제휴':'광고 집행'}</h4>}<div className="wb-table-scroll" role="region" tabIndex={0} aria-label={`${metric.label} ${section==='all'?'':content?'콘텐츠':'광고'} 분석 표, 가로 스크롤`}><table className="training-analysis-table"><thead><tr><th>{dimensionNames[dimension]}</th>{displayKeys.map(sortHeader)}</tr></thead><tbody>{chosen.map(g=>{
    const rowId=id+'-'+encodeURIComponent(dimension+':'+g.key),opened=expanded.includes(dimension+':'+g.key);
    const children=dimension==='campaign'?childGroups.filter(child=>g.rows.some(row=>row.campaignId===child.key)):[];
    const hasChildren=children.length>1;
    const cells=(item:AnalysisGroup)=>displayKeys.map(k=>k==='impact'
     ?<td key={k} className={'numeric training-impact-value training-delta-'+impactTone(metric,item.impact)}>{signed(item.impact,metric)}</td>
     :<CurrentCell key={k} group={item} metric={analysisMetric(k)} totals={analysis.totals} changeFirst={metricKey==='roas'}/>);
    return <Fragment key={g.key}>
     <tr className={hasChildren?'training-campaign-group-row':undefined}><th scope="row"><button className="training-analysis-expand" aria-expanded={opened} aria-controls={rowId} onClick={()=>toggle(dimension+':'+g.key)}><span aria-hidden="true">{opened?'−':'+'}</span><span className="training-analysis-row-label" title={g.label}>{g.label}</span></button></th>{cells(g)}</tr>
     {hasChildren&&opened&&children.map(child=>{
      const childKey='campaignUnit:'+child.key,childId=id+'-unit-'+encodeURIComponent(child.key),childOpen=expanded.includes(childKey);
      return <Fragment key={child.key}>
       <tr className="training-campaign-child-row"><th scope="row"><button className="training-analysis-expand" aria-expanded={childOpen} aria-controls={childId} onClick={()=>toggle(childKey)}><span aria-hidden="true">{childOpen?'−':'+'}</span><span className="training-analysis-row-label" title={child.label}>{child.label}</span></button></th>{cells(child)}</tr>
       <tr id={childId} hidden={!childOpen} className="training-analysis-expanded-row"><td colSpan={keys.length+2}>{childOpen&&<GroupDetails {...props} group={child} dimension="campaign" analysis={analysis} columns={keys}/>}</td></tr>
      </Fragment>;
     })}
     <tr id={rowId} hidden={!opened} className="training-analysis-expanded-row"><td colSpan={keys.length+2}>{opened&&(hasChildren
      ?<details className="training-campaign-parent-details"><summary>캠페인 전체 기간별 데이터 및 근거</summary><GroupDetails {...props} group={g} dimension={dimension} analysis={analysis} columns={keys} allowNarrow={false}/></details>
      :<GroupDetails {...props} group={g} dimension={dimension} analysis={analysis} columns={keys}/>)}</td></tr>
    </Fragment>;
   })}</tbody></table></div></div>;
  })}
  {!groups.length&&<p className="training-empty-state">분석 자료 없음</p>}
 </section>;
}
