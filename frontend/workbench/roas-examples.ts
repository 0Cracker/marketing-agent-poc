import {campaignDisplayName,comparePeriods,summarize} from '../../shared/training-dashboard.mjs';
import type {Filters,TrainingData} from '../../shared/training-dashboard.mjs';
import {chatComparison,chatHighlights,chatValue} from '../../shared/roas-chat.mjs';
import type {ChatSource} from '../../shared/roas-chat.mjs';
import type {RoasAnswer} from './agent-client';

export const roasExamples=[
 {id:'overview',label:'ROAS가 직전 기간보다 달라진 이유를 분석해줘',question:'ROAS가 직전 기간보다 달라진 이유를 분석해줘'},
 {id:'drivers',label:'AOV, CVR, CPC가 함께 변했는데 ROAS는 왜 떨어졌을까?',question:'ROAS가 떨어졌는데 AOV, CVR, CPC가 모두 변해서 원인을 모르겠어. 각 지표가 ROAS 변화에 얼마나 기여했는지 나눠 보고, 무엇부터 확인해야 할지 알려줘.'},
 {id:'funnel',label:'구매 과정에서 이탈이 늘어난 구간을 찾아줘',question:'구매 과정에서 이탈이 늘어난 구간을 찾아줘'},
] as const;

const signed=(value:number,unit:string)=>(value>0?'+':'')+value.toLocaleString('ko-KR',{maximumFractionDigits:1})+unit;
const citations='[summary:baseline] [summary:current]';
const names=['AOV','CVR','CPC'];

export function roasExampleAnswer(data:TrainingData,filters:Filters,id:string):RoasAnswer{
 const periods=comparePeriods(data,filters);
 const before=periods.find(row=>row.period.id==='baseline')!,after=periods.find(row=>row.period.id==='current')!;
 const sources:ChatSource[]=[before,after].map(row=>({id:'summary:'+row.period.id,kind:'summary',period:row.period,total:row.total,rowCount:row.rows.length}));
 let comparison=chatComparison(sources,'roas');
 const a=before.total.rates,b=after.total.rates;
 const sections:NonNullable<RoasAnswer['sections']>={
  conclusion:`ROAS는 ${chatValue(a.roas,'roas')}에서 ${chatValue(b.roas,'roas')}로 변했습니다. ${citations}`,
  summary:[],reasoning:[],actions:[],limitations:['현재 선택한 데이터로 계산한 예시 답변입니다. 실시간 AI가 생성한 답변은 아닙니다.'],
 };
 if(!before.rows.length||!after.rows.length||a.roas===null||b.roas===null){
  sections.conclusion='선택 범위에서 두 기간의 ROAS를 비교할 수 없습니다.';
  sections.reasoning=['비교할 데이터가 없거나 집행비가 0인 기간이 있습니다.'];
  sections.actions=['기간과 캠페인, 기기 필터를 확인하세요.'];
 }else if(id==='overview'){
  const growth=(prior:number,current:number)=>prior?signed((current/prior-1)*100,'%'):'직전 값이 0이라 증감률 계산 불가';
  sections.conclusion=`ROAS는 ${chatValue(a.roas,'roas')} → ${chatValue(b.roas,'roas')}, ${signed((b.roas-a.roas)*100,'%p')}입니다. 매출은 ${growth(before.total.revenue,after.total.revenue)}, 집행비는 ${growth(before.total.spend,after.total.spend)} 변했습니다. ${citations}`;
  const campaignIds=[...new Set([...before.rows,...after.rows].map(row=>row.campaignId))];
  const campaignSources=campaignIds.flatMap(key=>[before,after].map(period=>{
   const rows=period.rows.filter(row=>row.campaignId===key);
   return {id:`campaign:${key}:${period.period.id}`,kind:'breakdown',dimension:'campaign',key,label:campaignDisplayName(data,key),period:period.period,total:summarize(rows),rowCount:rows.length};
  }));
  sources.push(...campaignSources);comparison=chatComparison(campaignSources,'roas');
  const comparable=comparison?.rows.filter(row=>row.before!==null&&row.after!==null)||[];
  const declined=comparable.filter(row=>row.after!<row.before!).sort((x,y)=>(x.after!-x.before!)-(y.after!-y.before!));
  const improved=comparable.filter(row=>row.after!>row.before!).sort((x,y)=>(y.after!-y.before!)-(x.after!-x.before!));
  sections.summary=[
   `구매 전환 매출: ${chatValue(before.total.revenue,'revenue')} → ${chatValue(after.total.revenue,'revenue')}, 집행비: ${chatValue(before.total.spend,'spend')} → ${chatValue(after.total.spend,'spend')}. ${citations}`,
   `비교 가능한 캠페인 ${comparable.length}개 중 ROAS 하락 ${declined.length}개, 상승 ${improved.length}개, 동일 ${comparable.length-declined.length-improved.length}개입니다.`,
   ...chatHighlights(comparison,['largest_decline','largest_increase','lowest_current']),
  ];
  sections.reasoning=[
   b.roas<a.roas?'선택 범위에서는 매출 대비 집행비 부담이 커졌습니다. 매출이 늘었더라도 집행비가 더 빠르게 늘면 ROAS는 하락합니다.':'선택 범위의 ROAS는 하락하지 않았습니다. 매출과 집행비가 변한 비율을 함께 확인하세요.',
   '전체 ROAS는 캠페인별 ROAS의 단순 평균이 아니라 전체 구매 전환 매출 ÷ 전체 집행비입니다. 캠페인 자체의 효율 변화와 집행비 배분 변화를 함께 봐야 합니다.',
   '현재 ROAS가 가장 낮은 캠페인과 하락 폭이 가장 큰 캠페인은 다를 수 있습니다. 위 순위와 그래프는 캠페인 자체의 ROAS 비교이며, 전체 하락에 대한 인과적 기여도 순위는 아닙니다.',
  ];
  sections.actions=[
   declined.length?`${declined[0].label}부터 상세 분석하세요. 집행비 비중과 매출, CPC, 구매율이 언제부터 달라졌는지 기기와 타깃별로 좁혀 확인하세요.`:'하락 캠페인이 없습니다. 개선된 캠페인의 집행비와 매출 규모를 비교해 효율을 유지할 조건을 확인하세요.',
   improved.length?`${improved[0].label}의 상승도 함께 비교하세요. 상품 구성과 할인, 유입 구성이 다른지 확인한 뒤 예산 확대 가능성을 검토하세요.`:'비교 가능한 다른 캠페인이나 정상 기간을 기준으로 운영 변경 기록을 확인하세요.',
   '확인한 변화 시점과 운영 기록을 대조하고, 원인이 확인되기 전에는 전체 예산을 일괄 조정하지 마세요.',
  ];
  sections.limitations.push('캠페인 비교는 조사할 대상을 좁히는 단계입니다. 운영 변경의 실제 효과와 원인은 추가 확인이 필요합니다.');
 }else if(id==='funnel'){
  const stages=[['sessions','view','랜딩 → 상품 조회'],['view','cart','상품 조회 → 장바구니'],['cart','checkout','장바구니 → 결제 시작'],['checkout','purchases','결제 시작 → 같은 세션 구매']] as const;
  const rows=stages.map(([from,to,label])=>({label,before:before.total[from]?1-before.total[to]/before.total[from]:null,after:after.total[from]?1-after.total[to]/after.total[from]:null}));
  const worsened=rows.filter(row=>row.before!==null&&row.after!==null&&row.after>row.before).sort((x,y)=>(y.after!-y.before!)-(x.after!-x.before!));
  sections.conclusion=worsened.length?`이탈률이 가장 크게 늘어난 구간은 ${worsened[0].label}이며, ${signed((worsened[0].after!-worsened[0].before!)*100,'%p')}입니다. ${citations}`:`비교 가능한 구매 단계에서 이탈률이 늘어난 구간은 없습니다. ${citations}`;
  sections.summary=rows.map(row=>`${row.label}: ${chatValue(row.before,'cvr')} → ${chatValue(row.after,'cvr')}${row.before!==null&&row.after!==null?`, 이탈률 ${signed((row.after-row.before)*100,'%p')}`:''}. ${citations}`);
  sections.reasoning=['단계별 이탈률은 1 − 다음 단계 수 ÷ 이전 단계 수로 계산했습니다. 이탈 인원보다 이탈률 변화로 비교해야 유입량 증감의 영향을 구분할 수 있습니다.','클릭 기준 CVR은 주문 ÷ 클릭입니다. 이 퍼널은 같은 세션의 구매만 포함하므로 재방문 구매를 포함한 주문 CVR과 다릅니다.'];
  sections.actions=[worsened.length?`${worsened[0].label} 구간을 캠페인과 기기별로 나눠 확인하세요.`:'이탈률 외에 CPC, AOV와 재방문 구매 변화를 확인하세요.','결제 실패율, 페이지 로딩과 운영 변경 기록을 같은 기간으로 비교해 원인 후보를 좁히세요.'];
 }else{
  const from=[a.aov,a.cvr,a.cpc],to=[b.aov,b.cvr,b.cpc];
  sections.reasoning=['ROAS = AOV × CVR ÷ CPC입니다. 여기서 AOV는 구매 전환 매출 ÷ 주문, CVR은 주문 ÷ 클릭, CPC는 집행비 ÷ 클릭으로, 같은 기간과 범위의 합계를 사용합니다.'];
  sections.summary=names.map((name,i)=>`${name}: ${chatValue(from[i],name.toLowerCase())} → ${chatValue(to[i],name.toLowerCase())}. ${citations}`);
  if(from.every(value=>value!==null&&Number.isFinite(value))&&to.every(value=>value!==null&&Number.isFinite(value))&&(a.cpc??0)>0&&(b.cpc??0)>0){
   const prior=from as number[],current=to as number[],impact=[0,0,0];
   const roas=(values:number[])=>values[0]*values[1]/values[2];
   // Average all replacement orders so interactions do not depend on one chosen order.
   for(const order of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]){
    const values=[...prior];
    for(const index of order){const previous=roas(values);values[index]=current[index];impact[index]+=(roas(values)-previous)/6;}
   }
   const ranked=impact.map((value,index)=>({value,index})).sort((x,y)=>x.value-y.value);
   const worst=ranked.find(row=>row.value<0),best=ranked.toReversed().find(row=>row.value>0);
   sections.conclusion=`ROAS는 ${chatValue(a.roas,'roas')} → ${chatValue(b.roas,'roas')}, ${signed((b.roas-a.roas)*100,'%p')}입니다. ${worst?`가장 큰 하락 기여 지표는 ${names[worst.index]}입니다.`:'세 지표에서 하락 기여는 없습니다.'} ${citations}`;
   sections.summary=sections.summary.map((text,i)=>text+` ROAS 변화 기여 ${signed(impact[i]*100,'%p')}.`);
   sections.reasoning.push(`세 지표를 바꾸는 6가지 순서의 평균으로 복합 변화의 기여도를 나눴습니다. 양수는 ROAS를 올린 효과, 음수는 내린 효과이며, 반올림 전 합계는 전체 변화 ${signed((b.roas-a.roas)*100,'%p')}와 같습니다. 표시값에는 반올림 차이가 있을 수 있습니다.`);
   if(best&&worst)sections.reasoning.push(`${names[best.index]}의 개선이 하락을 일부 상쇄했습니다. 지표의 증감률 크기만 비교하지 말고 ROAS에 미친 %p 기여도를 먼저 보세요.`);
   const checks=['상품 구성, 할인율과 주문당 구매 수량을 확인하세요.','캠페인과 기기별 구매율을 비교한 뒤 결제 이탈, 실패와 추적 누락을 확인하세요.','캠페인별 클릭 단가와 집행비 비중을 나눠 보고 입찰, 타깃과 유입 구성을 확인하세요.'];
   sections.actions=[worst?`${names[worst.index]}부터 확인하세요. ${checks[worst.index]}`:'현재 범위의 ROAS는 하락하지 않았습니다. 질문의 전제가 맞는 기간과 캠페인인지 확인하세요.','같은 캠페인과 기기 안에서도 변화가 나타나는지 비교하세요. 전체 평균 변화에는 캠페인별 집행 비중 변화도 섞일 수 있습니다.'];
   if(id==='drivers'&&b.roas>=a.roas)sections.summary.unshift('현재 선택 범위의 ROAS는 하락하지 않았습니다. 아래는 실제 변화 방향에 따른 분해입니다.');
   sections.limitations.push('기여도는 수식상 변화 분해입니다. 지표들은 서로 영향을 줄 수 있으므로 실제 원인이나 개선 시 회복 효과로 단정할 수 없습니다.');
  }else{
   sections.reasoning.push('주문이나 클릭이 0인 기간에는 AOV, CVR, CPC 일부가 정의되지 않아 세 지표의 기여도를 분해하지 않았습니다.');
   sections.actions=['먼저 클릭, 주문, 집행비의 원천 수치를 확인하고 비교 가능한 캠페인 범위로 좁히세요.'];
  }
 }
 return {answer:sections.conclusion,sections,comparison,sources,events:[{tool:'overview',count:2},...(sources.length>2?[{tool:'breakdown',count:sources.length-2}]:[])],mode:'example'};
}
