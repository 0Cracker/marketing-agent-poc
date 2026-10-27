import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowUp,Sparkles,Monitor,AlertCircle,RefreshCw} from 'lucide-react';
import {campaignDisplayName} from '../../shared/training-dashboard.mjs';
import type {Filters,TrainingData} from '../../shared/training-dashboard.mjs';
import {createAgentClient,errorText} from './agent-client';
import type {RoasAnswer} from './agent-client';
import {AgentPanelShell} from './panel';
import {RoasAnswerView} from './roas-answer';
import './agent-conversation.css';
import './agent-chat.css';
import './roas-conversation.css';

type Exchange={question:string;result:RoasAnswer};
type Props={data:TrainingData;snapshot:string;filters:Filters;metric:string;screenTitle:string;onClose:()=>void;exchanges:Exchange[];onExchange:(exchange:Exchange)=>void};
const transportErrors=['server_unavailable','request_outcome_unknown','not_found'];
const connectionError=(code:string)=>({server_unavailable:'AI 서버가 꺼져 있거나 응답하지 않습니다. 서버 실행 후 다시 연결해 주세요.',roas_query_limit:'조회 횟수 제한에 도달했습니다. 질문을 나눠 다시 보내 주세요.',model_timeout:'모델 응답 시간이 초과됐습니다. 잠시 뒤 질문을 다시 보내 주세요.',model_unavailable:'모델 공급자가 일시적으로 응답하지 못했습니다. 잠시 뒤 다시 보내 주세요.',quota_exhausted:'모델 호출 한도에 도달했습니다. 한도 회복 후 다시 보내 주세요.',model_context_limit:'조회 자료가 모델의 처리 범위를 넘었습니다. 캠페인이나 기기를 좁혀 주세요.',model_protocol:'답변 형식이나 근거를 확인하지 못했습니다. 질문을 다시 보내 주세요.',request_outcome_unknown:'응답을 받지 못했습니다. 연결 상태를 확인한 뒤 다시 보내 주세요.',inputs_changed:'화면과 서버의 데이터가 다릅니다. 화면을 새로고침하고 같은 데이터의 서버로 연결해 주세요.',not_found:'업데이트된 AI 서버를 다시 실행한 후 연결해 주세요.'} as Record<string,string>)[code]||errorText(code);
const periodLabel=(start:string,end:string)=>start.slice(5).replace('-','.')+' ~ '+new Date(Date.parse(end+'T00:00:00Z')-86400000).toISOString().slice(5,10).replace('-','.');

export function RoasConversation({data,snapshot,filters,metric,screenTitle,onClose,exchanges,onExchange}:Props){
 const [client]=useState(()=>createAgentClient(fetch,import.meta.env.VITE_AGENT_API_URL||'/agent-api'));
 const [question,setQuestion]=useState(''),[pending,setPending]=useState('');
 const [connected,setConnected]=useState(false),[connecting,setConnecting]=useState(true),[mode,setMode]=useState(''),[busy,setBusy]=useState(false),[errorCode,setError]=useState('');
 const input=useRef<HTMLTextAreaElement>(null),thread=useRef<HTMLDivElement>(null),alive=useRef(true),sending=useRef(false),connectionAttempt=useRef({value:0});
 const reconnect=useCallback(async()=>{
  const attempt=++connectionAttempt.current.value;setConnecting(true);setError('');
  try{const session=await client.session();if(alive.current&&attempt===connectionAttempt.current.value){setMode(session.mode||'');setConnected(true);}}
  catch(e){if(alive.current&&attempt===connectionAttempt.current.value){setConnected(false);setError((e as Error).message);}}
  finally{if(alive.current&&attempt===connectionAttempt.current.value)setConnecting(false);}
 },[client]);
 useEffect(()=>{alive.current=true;const attemptState=connectionAttempt.current;let active=true;queueMicrotask(()=>{if(active)void reconnect();});return()=>{active=false;alive.current=false;attemptState.value++;};},[reconnect]);
 useEffect(()=>{const node=thread.current,target=node?.querySelector<HTMLElement>('[data-current-question]');if(!node)return;if(pending)node.scrollTop=node.scrollHeight;else if(target)node.scrollTop+=target.getBoundingClientRect().top-node.getBoundingClientRect().top-8;},[exchanges.length,pending]);
 useEffect(()=>{const node=input.current;if(node){node.style.height='auto';node.style.height=Math.min(node.scrollHeight,144)+'px';}},[question]);
 async function ask(){
  if(sending.current||!connected||!question.trim())return;
  sending.current=true;const text=question.trim();setBusy(true);setPending(text);setError('');
  try{
   const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(data)));
   const dataHash=Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
   let history=exchanges.slice(-4).flatMap(item=>[{role:'user',text:item.question},{role:'assistant',text:item.result.answer}]);
   // Keep complete recent exchanges within the API's 64 KiB UTF-8 request limit.
   while(new TextEncoder().encode(JSON.stringify(history)).byteLength>45000)history=history.slice(2);
   const result=await client.roasChat({question:text,scope:{caseId:data.caseId,snapshot,filters:{...filters,source:filters.source||'all'},dataHash,metric,screenTitle},history});
   if(!result.answer||!Array.isArray(result.sources)||!Array.isArray(result.events))throw Error('response_invalid');
   if(alive.current){onExchange({question:text,result});setQuestion('');}
  }catch(e){if(alive.current){const code=(e as Error).message;setError(code);if(transportErrors.includes(code))setConnected(false);}}
  finally{sending.current=false;if(alive.current){setBusy(false);setPending('');requestAnimationFrame(()=>input.current?.focus());}}
 }
 const campaign=filters.campaignId==='all'?'전체 캠페인':campaignDisplayName(data,filters.campaignId);
 const media:Record<string,string>={google:'Google Ads',facebook:'Facebook',instagram:'Instagram',naver_blog:'네이버 블로그',search:'검색 광고',social:'소셜 광고',content:'콘텐츠 제휴'};
 const target=[campaign,filters.campaignId==='all'&&filters.source&&filters.source!=='all'?media[filters.source]||filters.source:filters.campaignId==='all'&&filters.channel!=='all'?media[filters.channel]||filters.channel:'',filters.device==='mobile'?'모바일':filters.device==='desktop'?'PC':''].filter(Boolean).join(', ');
 const current=data.periods.find(p=>p.id==='current')!,baseline=data.periods.find(p=>p.id==='baseline')!;
 return <AgentPanelShell onClose={onClose}>
  <section className="wb-conversation wb-roas-conversation" aria-label="ROAS 분석 대화">
   <div className="wb-answer-screen-context"><span><Monitor size={13}/>보고 있는 화면</span><strong>{screenTitle}</strong><p>{target}</p><details><summary>{periodLabel(current.start,current.end)} 분석</summary><p>비교 {periodLabel(baseline.start,baseline.end)}<br/>보고 기준 {new Date(data.asOf).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})}</p></details></div>
   <div ref={thread} className="wb-chat-thread" role="region" aria-label="대화 내역" aria-busy={busy}>
    {!exchanges.length&&!pending&&<div className="wb-chat-welcome"><span className="wb-chat-welcome-icon"><Sparkles size={25}/></span><h2>궁금한 성과를<br/>함께 살펴볼까요?</h2><p>지금 보고 있는 데이터에서 변화를 비교하고,<br/>판단에 필요한 근거를 찾아드려요.</p><div className="wb-chat-starters">{['ROAS가 직전 기간보다 달라진 이유를 분석해줘','캠페인별 현재 ROAS와 하락 폭을 비교해줘','구매 과정에서 이탈이 늘어난 구간을 찾아줘'].map(text=><button key={text} type="button" onClick={()=>{setQuestion(text);input.current?.focus();}}>{text}</button>)}</div></div>}
    {exchanges.map((item,index)=><div className="wb-chat-exchange" key={index}><div className="wb-chat-user" data-current-question={index===exchanges.length-1||undefined} aria-label="내 질문"><p>{item.question}</p></div><RoasAnswerView result={item.result} data={data} filters={filters}/></div>)}
    {pending&&<><div className="wb-chat-user"><p>{pending}</p></div><p className="wb-chat-working" role="status"><Sparkles size={15}/>선택 범위의 자료를 확인하고 있어요…</p></>}
   </div>
   <div className="wb-chat-compose-area wb-roas-compose-area">
    {(connecting||errorCode||!connected)&&<div className={'wb-chat-connection '+(connecting?'is-connecting':'is-error')} role={connecting?'status':'alert'}>{connecting?<RefreshCw size={16}/>:<AlertCircle size={16}/>}<div><strong>{connecting?'AI 서버 연결 확인 중':!connected?'AI 서버에 연결할 수 없습니다':'답변을 받지 못했습니다'}</strong>{!connecting&&<p>{connectionError(errorCode||'server_unavailable')}</p>}</div>{!connecting&&<button type="button" disabled={busy} onClick={()=>void (!connected?reconnect():ask())}>{!connected?'다시 연결':'다시 보내기'}</button>}</div>}
    <form className="wb-chat-compose wb-roas-composer" onSubmit={e=>{e.preventDefault();void ask();}}><textarea ref={input} aria-label="분석 질문" rows={2} maxLength={4000} value={question} disabled={busy} placeholder={exchanges.length?'이어서 궁금한 점을 물어보세요':'데이터에 대해 무엇이 궁금하세요?'} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void ask();}}}/><div className="wb-chat-compose-tools"><button type="submit" className="wb-chat-send" aria-label="질문 보내기" disabled={busy||!connected||connecting||!question.trim()}><ArrowUp size={17}/></button></div></form><p className="wb-chat-footnote">{mode==='offline_model_substitute'?'오프라인 연결 확인':'AI 답변의 수치와 근거를 확인하세요.'}<span>Enter 전송, Shift+Enter 줄바꿈</span></p>
   </div>
  </section>
 </AgentPanelShell>;
}
