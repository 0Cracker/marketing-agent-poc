import type {AgentRun,Fact} from './agent-client';

export const candidateNames:Record<string,string>={price:'가격',stock:'재고',media:'광고',measurement:'계측'};
export const fieldNames:Record<string,string>={sales_value:'시장 판매액',market_total_value:'시장 분모',share:'금액 점유율',listed_price:'표시 가격',available_quantity:'관측 재고',spend:'광고비',impressions:'노출수',clicks:'클릭수',conversions:'전환수',attributed_value:'귀속 매출'};
export function formatFact(f:Fact){
  if(f.value===null||!Number.isFinite(Number(f.value)))return '미확보';
  const value=Number(f.value);
  return f.unit==='ratio'?`${(value*100).toFixed(2)}%`:`${value.toLocaleString('ko-KR',{maximumFractionDigits:2})} ${f.unit}`;
}
export function hypothesisRows(run:Pick<AgentRun,'output'>){
  return Object.entries(candidateNames).map(([candidate,label])=>{
    const h=run.output?.hypotheses?.find(x=>x.candidate===candidate);
    const classified=!!h&&(h.supports.length>0||h.counters.length>0);
    return {candidate,label,supports:h?.supports||[],counters:h?.counters||[],assessment:!h?'미검토':!classified?'원인 평가 미분류':h.assessment==='mixed'?'근거 혼재':h.supports.length?'지지 근거 조회':'반대 근거 조회',classified};
  });
}
export function shareSeries(run:Pick<AgentRun,'output'>){
  const facts=(run.output?.facts||[]).filter(f=>f.field==='share'&&f.value!==null&&Number.isFinite(Number(f.value)));
  // Multiple observations per product need an explicit time axis, not duplicate bars.
  if(new Set(facts.map(f=>f.product)).size!==facts.length)return [];
  return facts.map(f=>({product:f.product||f.recordId,share:Number(f.value)*100,recordId:f.recordId}));
}
