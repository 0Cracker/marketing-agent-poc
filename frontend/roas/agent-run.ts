import type {RoasAnswer} from './agent-client';

export type RunExecutionStatus='queued'|'running'|'completed'|'partial'|'withheld'|'blocked'|'cancelled'|'interrupted';
export type RunEvent={
 seq?:number;at?:string|number;kind?:string;stage?:string;tool?:string;model?:string;
 provider?:string;transport?:string;billingBucket?:string;status?:string;
 errorCode?:string;count?:number;rowCount?:number;elapsed?:number;elapsedMs?:number;
 evidenceIds?:string[];argsSummary?:string;
};
export type RunState={
 runId:string;executionStatus:RunExecutionStatus;stage?:string;route?:'quick'|'deep';
 runStatus?:string;causeStatus?:'confirmed'|'undetermined'|'not_assessed';
 scopeFingerprint?:string;appliedScope?:RunScope;sourceHashes?:Record<string,string>;
 stopReason?:string;startedAt?:number|string;terminalAt?:number|string;
 events?:RunEvent[];lastEventSeq?:number;usage?:{modelAttempts?:number;toolCalls?:number;reportedCostUsd?:number};
 result?:{answer?:string;sections?:{conclusion?:string;summary?:string[];reasoning?:string[];actions?:string[];limitations?:string[]};evidenceIds?:string[];limitations?:string[];verification?:{passed?:boolean};verified?:boolean}|null;
};
export type RunScope={caseId:string;snapshot:string;filters:Record<string,string>;dataHash:string;metric:string;screenTitle:string};
export type RunRequest={question:string;scope:RunScope;history:{role:'user'|'assistant';content:string}[];threadId:string;clientRequestId:string};
export type RunEntry={kind:'run';question:string;clientRequestId:string;request:RunRequest;runId?:string;state?:RunState;hydrated?:boolean;error?:string};
export type ExampleEntry={kind:'example';question:string;result:RoasAnswer};
export type ConversationEntry=RunEntry|ExampleEntry;
export type SavedConversation={version:1;dataHash:string;threadId:string;updatedAt:number;entries:ConversationEntry[]};
export const terminalStatuses=new Set<RunExecutionStatus>(['completed','partial','withheld','blocked','cancelled','interrupted']);
export const isTerminal=(state?:RunState)=>!!state&&terminalStatuses.has(state.executionStatus);
export const runStatusLabel=(state:RunState)=>{
 switch(state.executionStatus){
  case 'completed':return state.causeStatus==='undetermined'?'분석 완료, 원인 미확정':'분석 완료';
  case 'partial':return '일부 분석 완료';
  case 'withheld':return '결과 보류';
  case 'blocked':return '분석 차단';
  case 'cancelled':return '분석 취소';
  case 'interrupted':return '분석 중단';
  case 'queued':return '분석 대기';
  default:return '분석 진행 중';
 }
};
export const stageLabel=(stage?:string)=>({
 queued:'분석 대기',scope_locked:'조회 범위 확인',routed:'분석 경로 선택',
 overview:'자료 조회',retrieving:'자료 조회',classifying:'분석 경로와 도구 선택',choosing_options:'조회 조건 선택',
 reasoning:'분석',final_answer:'답변 작성',verifying:'근거 검증',
 terminal:'결과 정리'
} as Record<string,string>)[stage||'']||'분석 진행 중';
export const toolLabel=(tool?:string)=>({
 overview:'성과 요약',metric_detail:'지표 세부 데이터 조회',trend:'추이 조회',
 records:'운영 기록 조회',review_summary:'리뷰 요약',review_records:'리뷰 원문 조회',
 evidence:'근거 재조회'
} as Record<string,string>)[tool||'']||tool||'';
export const wasModelFallback=(events:RunEvent[],index:number)=>{
 const current=events[index];
 if(current?.kind!=='model_attempt')return false;
 const earlier=events.slice(0,index).reverse().find(e=>e.kind==='model_error'||e.kind==='model_success');
 if(earlier?.kind!=='model_error')return false;
 return !!(current.model||current.provider)&&
  (current.model!==earlier.model||current.provider!==earlier.provider||current.transport!==earlier.transport);
};
export function entryAnswer(entry:ConversationEntry):string|null{
 if(entry.kind==='example')return entry.result.answer;
 const s=entry.state;
 if(!s||!['completed','partial'].includes(s.executionStatus)||!s.result)return null;
 if(s.result.verified!==true&&s.result.verification?.passed!==true)return null;
 return s.result.answer||s.result.sections?.conclusion||null;
}
export function recentRunHistory(entries:ConversationEntry[]):RunRequest['history']{
 const history:RunRequest['history']=[];
 for(const entry of entries.slice(-6)){
  const answer=entryAnswer(entry);
  if(!answer)continue;
  history.push({role:'user',content:entry.question.slice(0,3000)});
  history.push({role:'assistant',content:answer.slice(0,3000)});
 }
 return history.slice(-12);
}
export function sameRunScope(expected:RunScope,received?:RunScope):boolean {
 if(!received)return true;
 return received.caseId===expected.caseId&&received.snapshot===expected.snapshot&&
 received.dataHash===expected.dataHash&&received.metric===expected.metric&&
 received.screenTitle===expected.screenTitle&&
 Object.keys(received.filters||{}).length===Object.keys(expected.filters).length&&
 Object.entries(expected.filters).every(([key,value])=>received.filters[key]===value);
}
export function loadConversation(storage:Pick<Storage,'getItem'>|undefined,key:string,dataHash:string,now=Date.now(),expectedScope?:RunScope):SavedConversation|null{
 if(!storage)return null;
 try{
  const parsed=JSON.parse(storage.getItem(key)||'null') as SavedConversation|null;
  if(!parsed||parsed.version!==1||parsed.dataHash!==dataHash||
    typeof parsed.threadId!=='string'||!Array.isArray(parsed.entries)||
    !Number.isFinite(parsed.updatedAt)||parsed.updatedAt>now+60_000||now-parsed.updatedAt>30*86400000)return null;
  const entries=parsed.entries.filter(entry=>
   entry&&typeof entry.question==='string'&&
   (entry.kind==='example'?!!entry.result:
    entry.kind==='run'&&!!entry.request&&entry.request.scope?.dataHash===dataHash&&
     (!expectedScope||sameRunScope(expectedScope,entry.request.scope))&&
     entry.clientRequestId===entry.request.clientRequestId&&
     (!entry.runId||/^[\da-f-]{36}$/i.test(entry.runId))
   )).slice(-12);
  return {...parsed,entries};
 }catch{return null;}
}
export function saveConversation(storage:Pick<Storage,'setItem'>|undefined,key:string,saved:SavedConversation):boolean{
 if(!storage)return false;
 try{
  // Preserve run IDs even when browser storage is small. No raw tools or credentials are stored.
  const compact={...saved,entries:saved.entries.slice(-12)};
  storage.setItem(key,JSON.stringify(compact));return true;
 }catch{return false;}
}
