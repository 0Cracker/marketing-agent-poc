import {useCallback,useEffect,useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {ArrowUp,Sparkles,Monitor,AlertCircle,RefreshCw} from 'lucide-react';
import {campaignDisplayName} from '../../shared/roas/training-dashboard.mjs';
import type {Filters,TrainingData} from '../../shared/roas/training-dashboard.mjs';
import {createAgentClient,errorText} from './agent-client';
import type {RoasAnswer} from './agent-client';
import type {ConversationEntry,RunEntry,RunRequest,RunScope,SavedConversation} from './agent-run';
import {isTerminal,loadConversation,recentRunHistory,runStatusLabel,sameRunScope,saveConversation} from './agent-run';
import {AgentPanelShell} from './panel';
import {RoasAnswerView,RoasRunView} from './roas-answer';
import {roasExamples,roasExampleAnswer} from './roas-examples';
import './agent-conversation.css';
import './agent-chat.css';
import './roas-conversation.css';

type Exchange={question:string;result:RoasAnswer};
type Props={data:TrainingData;snapshot:string;filters:Filters;metric:string;screenTitle:string;localScopeLabel?:string;onClearScope?:()=>void;onClose?:()=>void;apiBase?:string;onRunSelected?:(runId:string)=>void;exchanges:Exchange[];onExchange:(exchange:Exchange)=>void};
const transportErrors=['server_unavailable','request_outcome_unknown','not_found'];
const connectionError=(code:string)=>({server_unavailable:'AI 서버가 꺼져 있거나 응답하지 않습니다. 서버 실행 후 다시 연결해 주세요.',roas_query_limit:'조회 횟수 제한에 도달했습니다.',model_timeout:'모델 응답 시간이 초과됐습니다.',request_outcome_unknown:'응답을 받지 못했습니다. 새 요청을 만들지 않고 기존 요청 ID를 확인해 주세요.',inputs_changed:'화면과 서버의 데이터가 다릅니다. 화면을 새로고침해 주세요.',not_found:'서버에 해당 실행 정보가 없습니다. 보관 기간 또는 인증 상태를 확인해 주세요.'} as Record<string,string>)[code]||errorText(code);
const periodLabel=(start:string,end:string)=>start.slice(5).replace('-','.')+' ~ '+new Date(Date.parse(end+'T00:00:00Z')-86400000).toISOString().slice(5,10).replace('-','.');
const storage=()=>{try{return typeof window==='undefined'?undefined:window.localStorage;}catch{return undefined;}};
const hashData=async(data:TrainingData)=>{
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(data)));
 return Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
};
const updateRun=(entries:ConversationEntry[],requestId:string,change:(entry:RunEntry)=>RunEntry):ConversationEntry[]=>entries.map(entry=>entry.kind==='run'&&entry.clientRequestId===requestId?change(entry):entry);
function activeRun(entries:ConversationEntry[]):RunEntry|undefined{
 return entries.findLast((entry):entry is RunEntry=>entry.kind==='run'&&
  (!entry.runId?(!entry.error||entry.error==='request_outcome_unknown'):!entry.hydrated||!isTerminal(entry.state)));
}
function startScope(data:TrainingData,snapshot:string,filters:Filters,dataHash:string,metric:string,screenTitle:string):RunScope{
 return {caseId:data.caseId,snapshot,filters:{channel:filters.channel,source:filters.source||'all',campaignId:filters.campaignId,device:filters.device},dataHash,metric,screenTitle};
}
export function RoasConversation({data,snapshot,filters,metric,screenTitle,localScopeLabel,onClearScope,onClose,exchanges,onExchange,apiBase,onRunSelected}:Props){
 const gatewayBase=apiBase??(import.meta.env.PROD?'/api/qa':(import.meta.env.VITE_AGENT_API_URL||'/agent-api'));
 const [client]=useState(()=>createAgentClient(fetch,gatewayBase));
 const [loginPassword,setLoginPassword]=useState(''),[loginBusy,setLoginBusy]=useState(false);
 const [question,setQuestion]=useState(''),[conversation,setConversation]=useState<SavedConversation|null>(null);
 const [connected,setConnected]=useState(false),[connecting,setConnecting]=useState(true),[mode,setMode]=useState('');
 const [busy,setBusy]=useState(false),[errorCode,setError]=useState(''),[pollError,setPollError]=useState(''),[cancelling,setCancelling]=useState(false),[storageError,setStorageError]=useState(false);
 const input=useRef<HTMLTextAreaElement>(null),thread=useRef<HTMLDivElement>(null),alive=useRef(true),sending=useRef(false),connectionAttempt=useRef({value:0});
 const contextKey='roas-agent-runs/1:'+JSON.stringify([data.caseId,snapshot,filters.channel,filters.source||'all',filters.campaignId,filters.device,metric,screenTitle,localScopeLabel||'']);
 async function loginQa(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(loginBusy||!loginPassword)return;
  setLoginBusy(true);setError('');
  try{const session=await client.login(loginPassword);setMode(session.mode||'');setConnected(true);}
  catch(e){setError((e as Error).message||'authentication_required');setConnected(false);}
  finally{setLoginPassword('');setLoginBusy(false);setConnecting(false);}
 }
 const reconnect=useCallback(async()=>{
  if(localScopeLabel){setConnecting(false);setConnected(false);return;}
  const attempt=++connectionAttempt.current.value;setConnecting(true);setError('');
  try{const session=await client.session();if(alive.current&&attempt===connectionAttempt.current.value){setMode(session.mode||'');setConnected(true);}}
  catch(e){if(alive.current&&attempt===connectionAttempt.current.value){setConnected(false);setError((e as Error).message);}}
  finally{if(alive.current&&attempt===connectionAttempt.current.value)setConnecting(false);}
 },[client,localScopeLabel]);
 useEffect(()=>{alive.current=true;const attemptState=connectionAttempt.current;let active=true;queueMicrotask(()=>{if(active)void reconnect();});return()=>{active=false;alive.current=false;attemptState.value++;};},[reconnect]);
 useEffect(()=>{
  let active=true;
  void hashData(data).then(dataHash=>{
   if(!active)return;
   const saved=loadConversation(storage(),contextKey,dataHash,Date.now(),startScope(data,snapshot,filters,dataHash,metric,screenTitle));
   setConversation(saved||{version:1,dataHash,threadId:crypto.randomUUID(),updatedAt:Date.now(),entries:exchanges.map(item=>({kind:'example',...item}))});
  }).catch(()=>{if(active)setError('response_invalid');});
  return()=>{active=false;};
 // The dashboard remounts this component when any screen scope changes.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 useEffect(()=>{
  if(conversation&&!saveConversation(storage(),contextKey,{...conversation,updatedAt:Date.now()}))queueMicrotask(()=>{if(alive.current)setStorageError(true);});
 },[conversation,contextKey]);
 const entries=conversation?.entries||[];
 const latestRunId=entries.findLast(entry=>entry.kind==='run'&&entry.runId);
 const selectedRunId=latestRunId?.kind==='run'?latestRunId.runId:undefined;
 useEffect(()=>{if(selectedRunId)onRunSelected?.(selectedRunId);},[selectedRunId,onRunSelected]);
 const active=activeRun(entries);
 const activeId=active?.runId;
 useEffect(()=>{
  if(!activeId)return;
  let closed=false,timer:ReturnType<typeof setTimeout>|undefined,delay=1300;
  async function poll(){
   try{
    const state=await client.getRoasRun(activeId!);
    if(closed)return;
    const entry=entries.find(item=>item.kind==='run'&&item.runId===activeId) as RunEntry|undefined;
    if(entry&&!sameRunScope(entry.request.scope,state.appliedScope)){setPollError('inputs_changed');return;}
    setPollError('');delay=1300;
    setConversation(current=>current?{...current,updatedAt:Date.now(),entries:current.entries.map(item=>
     item.kind==='run'&&item.runId===activeId&&(!isTerminal(item.state)||isTerminal(state))?{...item,state,hydrated:true,error:undefined}:item)}:current);
    if(isTerminal(state))return;
   }catch(e){
    if(closed)return;
    const code=(e as Error).message||'server_unavailable';setPollError(code);if(code==='authentication_required'){setConnected(false);setError(code);}delay=Math.min(delay*2,8000);
   }
   if(!closed)timer=setTimeout(()=>{void poll();},delay);
  }
  void poll();
  return()=>{closed=true;if(timer)clearTimeout(timer);};
 // Keep one poller per runId; it must not restart or create a run for each event.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[client,activeId]);
 useEffect(()=>{const node=thread.current;if(node&&entries.length)node.scrollTop=node.scrollHeight;},[entries.length,activeId]);
 useEffect(()=>{const node=input.current;if(node){node.style.height='auto';node.style.height=Math.min(node.scrollHeight,144)+'px';}},[question]);
 const changeEntries=(transform:(entries:ConversationEntry[])=>ConversationEntry[])=>{
  setConversation(current=>current?{...current,updatedAt:Date.now(),entries:transform(current.entries).slice(-12)}:current);
 };
 async function submitRun(entry:RunEntry){
  if(sending.current)return;
  sending.current=true;setBusy(true);setError('');
  try{
   const started=await client.startRoasRun(entry.request);
   if(!alive.current)return;
   changeEntries(items=>updateRun(items,entry.clientRequestId,item=>({...item,runId:started.runId,state:{runId:started.runId,executionStatus:started.executionStatus},hydrated:false,error:undefined})));
   setPollError('');
  }catch(e){
   const code=(e as Error).message||'server_error';
   if(alive.current){
    changeEntries(items=>updateRun(items,entry.clientRequestId,item=>({...item,error:code})));
    if(transportErrors.includes(code)||code==='authentication_required'){setConnected(false);setError(code);}
   }
  }finally{sending.current=false;if(alive.current){setBusy(false);input.current?.focus();}}
 }
 function ask(){
  if(localScopeLabel||!connected||!conversation||active||sending.current||!question.trim())return;
  const text=question.trim().slice(0,2000),clientRequestId=crypto.randomUUID();
  const request:RunRequest={question:text,scope:startScope(data,snapshot,filters,conversation.dataHash,metric,screenTitle),history:recentRunHistory(entries),threadId:conversation.threadId,clientRequestId};
  const entry:RunEntry={kind:'run',question:text,clientRequestId,request};
  changeEntries(items=>[...items,entry]);setQuestion('');
  void submitRun(entry);
 }
 async function cancel(){
  if(!active?.runId||cancelling)return;
  const id=active.runId;setCancelling(true);setPollError('');
  try{
   const reply=await client.cancelRoasRun(id);
   if(alive.current)changeEntries(items=>items.map(item=>item.kind==='run'&&item.runId===id?{...item,state:{...item.state,...reply,events:reply.events||item.state?.events},hydrated:false}:item));
  }catch(e){if(alive.current)setPollError((e as Error).message||'server_unavailable');}
  finally{if(alive.current)setCancelling(false);}
 }
 const campaign=filters.campaignId==='all'?'전체 캠페인':campaignDisplayName(data,filters.campaignId);
 const media:Record<string,string>={google:'Google Ads',facebook:'Facebook',instagram:'Instagram',naver_blog:'네이버 블로그',search:'검색 광고',social:'소셜 광고',content:'콘텐츠 제휴'};
 const target=[localScopeLabel||campaign,filters.campaignId==='all'&&filters.source&&filters.source!=='all'?media[filters.source]||filters.source:filters.campaignId==='all'&&filters.channel!=='all'?media[filters.channel]||filters.channel:'',filters.device==='mobile'?'모바일':filters.device==='desktop'?'PC':''].filter(Boolean).join(', ');
 const current=data.periods.find(p=>p.id==='current')!,baseline=data.periods.find(p=>p.id==='baseline')!;
 function showExample(example:typeof roasExamples[number]){
  if(active||sending.current||!conversation)return;
  const exchange={question:example.question,result:roasExampleAnswer(data,filters,example.id)};
  changeEntries(items=>[...items,{kind:'example',...exchange}]);onExchange(exchange);setQuestion('');
 }
 const starters=<div className="wb-chat-starters"><small>{entries.length?'다른 예시 답변 보기':'예시 대화, 클릭하면 답변을 볼 수 있어요'}</small>{roasExamples.map(example=><button key={example.id} type="button" disabled={!!active||busy} onClick={()=>showExample(example)}>{example.label}</button>)}</div>;
 return <AgentPanelShell onClose={onClose}>
  <section className="wb-conversation wb-roas-conversation" aria-label="ROAS 분석 대화">
   <div className="wb-answer-screen-context"><span><Monitor size={13}/>보고 있는 화면</span><strong>{screenTitle}</strong><p>{target}</p><details><summary>{periodLabel(current.start,current.end)} 분석</summary><p>비교 {periodLabel(baseline.start,baseline.end)}<br/>보고 기준 {new Date(data.asOf).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})}</p></details></div>
   <div ref={thread} className="wb-chat-thread" role="region" aria-label="대화 내역" aria-busy={!!active}>
    {!entries.length&&<div className="wb-chat-welcome"><span className="wb-chat-welcome-icon"><Sparkles size={25}/></span><h2>궁금한 성과를<br/>함께 살펴볼까요?</h2><p>지금 보고 있는 데이터에서 변화를 비교하고,<br/>판단에 필요한 근거를 찾아드려요.</p>{starters}</div>}
    {entries.map((item,index)=><div className="wb-chat-exchange" key={item.kind==='run'?item.clientRequestId:index}>
     <div className="wb-chat-user" data-current-question={index===entries.length-1||undefined} aria-label="내 질문"><p>{item.question}</p></div>
     {item.kind==='example'?<RoasAnswerView result={item.result} data={data} filters={filters}/>:
      item.state?<RoasRunView state={item.state} onCancel={item.clientRequestId===active?.clientRequestId?()=>void cancel():undefined} cancelling={cancelling}/>:
      <div className="wb-chat-working" role="status"><Sparkles size={15}/>{item.error?connectionError(item.error):'분석 요청을 접수하고 있어요…'}
       {(!item.runId||item.error==='request_outcome_unknown')&&<button type="button" disabled={busy||!connected} onClick={()=>void submitRun(item)}>같은 요청 ID로 상태 확인</button>}
      </div>}
    </div>)}
    {!!entries.length&&!active&&starters}
   </div>
   <div className="wb-chat-compose-area wb-roas-compose-area">
    {pollError&&<div className="wb-chat-connection is-error" role="alert"><AlertCircle size={16}/><div><strong>실행 상태 조회에 문제가 있습니다</strong><p>{connectionError(pollError)} 기존 runId는 유지되며 새 분석을 시작하지 않습니다.</p></div></div>}
    {storageError&&<p className="wb-run-storage-warning" role="status">이 브라우저에서는 대화 자동 저장을 사용할 수 없습니다. 창을 닫기 전에 결과를 확인하세요.</p>}
    {localScopeLabel?<div className="wb-chat-connection" role="status"><Monitor size={16}/><div><strong>세부 범위는 예시 답변으로 확인하세요</strong><p>현재 AI 조회는 캠페인과 기기 범위를 지원합니다. 예시 답변은 선택한 세부 집계로 계산합니다.</p></div><button type="button" onClick={onClearScope}>세부 범위 해제</button></div>:(connecting||errorCode||!connected)&&<div className={'wb-chat-connection '+(connecting?'is-connecting':'is-error')} role={connecting?'status':'alert'}>{connecting?<RefreshCw size={16}/>:<AlertCircle size={16}/>}<div><strong>{connecting?'AI 서버 연결 확인 중':!connected?'AI 서버에 연결할 수 없습니다':'요청을 확인하지 못했습니다'}</strong>{!connecting&&<p>{connectionError(errorCode||'server_unavailable')}{!connected&&' 예시 답변은 연결 없이 볼 수 있습니다.'}</p>}</div>{!connecting&&gatewayBase!=='/api/qa'&&<button type="button" onClick={()=>void reconnect()}>{!connected?'다시 연결':'연결 확인'}</button>}{!connecting&&gatewayBase==='/api/qa'&&!connected&&!['authentication_required','rate_limited'].includes(errorCode)&&<button type="button" onClick={()=>void reconnect()}>다시 연결</button>}{!connecting&&gatewayBase==='/api/qa'&&!connected&&['authentication_required','rate_limited'].includes(errorCode)&&<form onSubmit={e=>void loginQa(e)} style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}><input type="password" aria-label="QA 접속 비밀번호" autoComplete="current-password" placeholder="QA 비밀번호" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} disabled={loginBusy} required style={{minWidth:140,maxWidth:220,padding:'8px 10px',border:'1px solid var(--border,#d0d5dd)',borderRadius:8}}/><button type="submit" disabled={loginBusy}>{loginBusy?'확인 중':'로그인'}</button></form>}</div>}
    <form className="wb-chat-compose wb-roas-composer" onSubmit={e=>{e.preventDefault();ask();}}><textarea ref={input} aria-label="분석 질문" rows={2} maxLength={2000} value={question} disabled={busy||!!active||!!localScopeLabel} placeholder={active?'분석이 끝난 뒤 질문할 수 있습니다':entries.length?'이어서 궁금한 점을 물어보세요':'데이터에 대해 무엇이 궁금하세요?'} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();ask();}}}/><div className="wb-chat-compose-tools"><button type="submit" className="wb-chat-send" aria-label="질문 보내기" disabled={busy||!!active||!conversation||!connected||connecting||!question.trim()}><ArrowUp size={17}/></button></div></form><p className="wb-chat-footnote">{active?.state?runStatusLabel(active.state):mode==='offline_model_substitute'?'오프라인 연결 확인':'AI 답변의 수치와 근거를 확인하세요.'}<span>Enter 전송, Shift+Enter 줄바꿈{gatewayBase==='/api/qa'&&connected&&<button type="button" style={{marginLeft:10,textDecoration:'underline'}} onClick={()=>{void client.logout().then(()=>{setConnected(false);setError('authentication_required');}).catch(()=>setError('server_unavailable'));}}>로그아웃</button>}</span></p>
   </div>
  </section>
 </AgentPanelShell>;
}
