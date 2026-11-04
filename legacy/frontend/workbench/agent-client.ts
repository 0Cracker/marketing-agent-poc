export type AgentScope={batch:string;country:string;scopeId:string;productIds:string[];start:string;end:string;asOf:string;dataHash?:string};
export type ScreenSelection={dataset:string;country:string;month:string;productIds:string[];asOf:string;dataHash?:string;period?:{start:string;end:string}};
export type Fact={id:string;recordId:string;field:string;value:string|number|null;unit:string;product?:string;availability?:string};
export type Allocation={campaign_ref:string;amount:{amount:string;currency:string}};
export type Simulation={id:string;kind:string;modelId:string;modelVersion:string;assumptions:string[];formula?:string;parameters?:{name:string;value:string}[];responseAggregation?:'channel';period?:{start:string;end_exclusive:string};baseline:{recordId:string;allocations:Allocation[];expected:string};candidate:{recordId:string;allocations:Allocation[];expected:string};realExecutionAllowed:false};
export type AgentRun={id:string;version:number;role:'analysis'|'budget';status:string;stage:string;reason?:string;question?:string;scope:AgentScope;parentId?:string;analysisId?:string;supersededBy?:string;
  screenContext?:{screenVersion:string;metricLabels:string[];evidenceIds:string[];excludedEvidenceIds?:string[]};
  output?:{facts?:Fact[];hypotheses?:{candidate:string;supports:string[];counters:string[];assessment:string}[];recommendation?:string;action?:string;completeness?:string};
  simulation?:Simulation;approval?:{expiresAt:string;principal:{id:string;role:string}}|null;events:{type:string;name?:string;reason?:string;at:string}[]};
export type BudgetInputs={scenarios:{record_id:string;model_ref:string;total_budget:{amount:string;currency:string}}[];models:{record_id:string;model_ref:string;model_version:string}[]};
type Envelope={run?:AgentRun;error?:string;token?:string;mode?:string;realAdsEnabled?:boolean;externalModelEnabled?:boolean;dataHash?:string;models?:{analysis:string;budget:string}};
export type RoasAnswer={answer:string;sections?:{conclusion:string;summary:string[];reasoning:string[];actions:string[];limitations:string[]};comparison?:import('../../shared/roas-chat.mjs').ChatComparison|null;sources:import('../../shared/roas-chat.mjs').ChatSource[];events:{tool:string;count:number}[];mode:string};

export function scopeFromScreen(s:ScreenSelection):AgentScope{
  if(!['CURRENT','D007'].includes(s.dataset))throw Error('unsupported_dataset');
  if(s.dataset==='CURRENT'&&!/^[a-f0-9]{64}$/.test(s.dataHash||''))throw Error('inputs_changed');
  if(!['KR','JP','US'].includes(s.country))throw Error('scope_country');
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(s.month)&&!(s.dataset==='CURRENT'&&s.month==='ALL'&&s.period&&/^\d{4}-\d{2}-01$/.test(s.period.start)&&/^\d{4}-\d{2}-01$/.test(s.period.end)&&s.period.start<s.period.end))throw Error('scope_month');
  if(!s.asOf||!Number.isFinite(Date.parse(s.asOf)))throw Error('scope_asof');
  if(!s.productIds.length||s.productIds.length>6||s.productIds.some(id=>!id))throw Error('scope_products');
  const start=s.month==='ALL'?s.period!.start:s.month+'-01',d=new Date(start+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);
  return {batch:s.dataset,country:s.country,scopeId:s.dataset==='CURRENT'?'CURRENT-'+s.country:'D007-'+s.country+'-sample',productIds:[...new Set(s.productIds)].sort(),start,end:s.month==='ALL'?s.period!.end:d.toISOString().slice(0,10),asOf:s.asOf,...(s.dataset==='CURRENT'?{dataHash:s.dataHash}:{})};
}
export const snapshotKey=(scope:AgentScope,evidenceIds:string[])=>'marketing-agent/1:'+JSON.stringify([scope,[...evidenceIds].sort()]);

export function createAgentClient(fetcher:typeof fetch=fetch,base='/agent-api'){
  let token:string|null=null;
  async function session(){
    let response:Response;try{response=await fetcher(base+'/session',{cache:'no-store'});}catch{throw Error('server_unavailable');}
    let data:Envelope;try{data=await response.json() as Envelope;}catch{throw Error('server_unavailable');}
    if(!response.ok||!data.token)throw Error(data.error||'server_unavailable');
    if(!['offline_model_substitute','remote_model'].includes(data.mode||'')||data.realAdsEnabled!==false||(data.mode==='remote_model'&&data.externalModelEnabled!==true))throw Error('unsupported_server_mode');
    token=data.token;return data;
  }
  async function request(path:string,body?:unknown,retry=true):Promise<unknown>{
    if(!token)await session();
    let response:Response;try{response=await fetcher(base+path,{method:body===undefined?'GET':'POST',cache:'no-store',headers:{'content-type':'application/json','x-agent-token':token!},body:body===undefined?undefined:JSON.stringify(body)});}catch{throw Error('request_outcome_unknown');}
    let data:Envelope;try{data=await response.json() as Envelope;}catch{throw Error('response_invalid');}
    // Only this rejection is known to happen before an operation starts.
    if(response.status===403&&data.error==='csrf_denied'&&retry){token=null;return request(path,body,false);}
    if(!response.ok)throw Error(data.error||'server_error');return data;
  }
  async function run(path:string,body?:unknown){const data=await request(path,body) as Envelope;if(!data.run?.id||!data.run.status)throw Error('response_invalid');return data.run;}
  return {session,roasChat:async(body:unknown)=>await request('/roas/chat',body) as RoasAnswer,analyze:(body:unknown)=>run('/analysis',body),budget:(body:unknown)=>run('/budget',body),getRun:(id:string)=>run('/runs/'+encodeURIComponent(id)),
    action:(id:string,action:'approve'|'reject'|'revise'|'resume'|'cancel',body:unknown)=>run(`/runs/${encodeURIComponent(id)}/${action}`,body),
    budgetInputs:async(id:string)=>await request(`/runs/${encodeURIComponent(id)}/budget-inputs`) as BudgetInputs,
    evidence:async(id:string,ids:string[])=>await request(`/runs/${encodeURIComponent(id)}/evidence`,{ids}) as {records:Record<string,unknown>[]}};
}

export const errorText=(code:string)=>({quota_exhausted:'모델 호출 한도에 도달했습니다. 다른 키로 자동 재시도하지 않습니다. 한도 회복 후 저장된 실행을 재개해 주세요.',model_unavailable:'모델 공급자가 일시적으로 응답할 수 없습니다. 저장된 실행은 유지됩니다. 잠시 기다린 뒤 직접 재개해 주세요. 자동 재시도하지 않습니다.',model_timeout:'모델 응답 시간이 초과됐습니다. 저장된 실행을 확인한 뒤 재개할 수 있습니다.',model_protocol:'모델 응답 형식을 검증하지 못해 결과를 보류했습니다.',model_context_limit:'모델에 전달할 자료가 현재 제한을 넘었습니다. 제품·기간 범위를 좁혀 주세요.',model_failed:'모델 호출을 완료하지 못했습니다. 저장된 실행과 연결 상태를 확인해 주세요.',provider_configuration:'서버의 모델·키 선택 설정을 확인해 주세요.',analysis_changed:'후속 분석으로 근거가 바뀌어 기존 제안과 승인이 무효화됐습니다. 최신 분석으로 예산을 다시 검토해 주세요.',proposal_revised:'제안이 수정돼 기존 승인이 무효화됐습니다.',server_unavailable:'분석 서버에 연결할 수 없습니다. 서버 실행 상태를 확인한 뒤 다시 연결해 주세요.',request_outcome_unknown:'응답을 받지 못했습니다. 같은 변경을 반복하기 전에 저장된 실행을 다시 확인해 주세요.',inputs_changed:'자료가 변경되어 이전 실행은 만료됐습니다. 화면과 서버의 통합 자료를 맞춘 뒤 새 분석을 시작해 주세요.',unsupported_dataset:'현재 통합 자료에서 분석을 시작해 주세요.',scope_country:'국가 하나를 선택해 주세요.',scope_month:'분석할 기준월을 선택해 주세요.',scope_products:'분석할 제품을 선택해 주세요.',scope_asof:'화면의 조회 기준시각을 확인할 수 없습니다.',version_conflict:'다른 요청에서 내용이 바뀌었습니다. 저장된 결과를 다시 불러와 주세요.',analysis_stale:'분석이 변경됐습니다. 최신 분석으로 예산을 다시 검토해 주세요.',data_unavailable:'선택한 시점에 사용할 수 있는 자료가 없습니다.',period_incomparable:'선택 기간을 같은 기준으로 비교할 수 없습니다.',budget_inputs_missing:'이 범위에서 사용할 예산 후보·모형·정책이 부족합니다.',approval_expired:'승인 유효기간이 지났습니다.',proposal_not_editable:'이미 처리 중이거나 무효화된 제안은 수정할 수 없습니다.',response_invalid:'서버 응답을 확인할 수 없습니다. 저장된 실행을 다시 확인해 주세요.'} as Record<string,string>)[code]||'요청을 처리하지 못했습니다. 범위와 저장된 결과를 확인해 주세요.';
