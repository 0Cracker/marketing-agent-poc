'use client';
import {useEffect,useRef,useState} from 'react';
import {Download,FolderOpen,Plus,Save,Upload,X} from 'lucide-react';
import {assertCurrent,fileLimit,parseReview,readReviews,reviewKey,sameContext,saveReview,validateReview} from './roas-review-store';
import type {Review,ReviewContent,ReviewContext} from './roas-review-store';

type Props={context:ReviewContext;content:ReviewContent;visible:boolean;onLoad:(review:Review)=>void;onDirtyChange:(dirty:boolean)=>void};
function exportFile(review:Review){const url=URL.createObjectURL(new Blob([JSON.stringify(review,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`ROAS-검토안-${review.id}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function initial(context:ReviewContext,content:ReviewContent){
 try{const list=readReviews(localStorage);const selected=list.items.find(row=>{try{assertCurrent(row,context,content);return true;}catch{return false;}});return {...list,selected,error:'',template:content};}
 catch(error){return {raw:null,items:[] as Review[],selected:undefined,error:(error as Error).message,template:content};}
}
const signature=(title:string,content:ReviewContent)=>JSON.stringify([title,content.actions.map(a=>({...a,evidenceIds:[...a.evidenceIds].sort()})).toSorted((a,b)=>a.target.localeCompare(b.target)),content.budgets.toSorted((a,b)=>a.channel.localeCompare(b.channel)),content.note]);

export default function RoasReviews({context,content,visible,onLoad,onDirtyChange}:Props){
 const [start]=useState(()=>initial(context,content));
 const [list,setList]=useState(start.items),[active,setActive]=useState<Review|undefined>(start.selected),[title,setTitle]=useState(start.selected?.title||'P1A ROAS 검토');
 const [baseline,setBaseline]=useState(signature(start.selected?.title||'P1A ROAS 검토',start.selected||content));
 const [message,setMessage]=useState(start.error),[failed,setFailed]=useState(!!start.error),[conflict,setConflict]=useState(false),[busy,setBusy]=useState(false);
 const [storageFailed,setStorageFailed]=useState(!!start.error);
 const [view,setView]=useState<'list'|'history'|'replace'|null>(null),[history,setHistory]=useState<Review|null>(null);
 const pending=useRef<(()=>void|Promise<void>)|null>(null);
 const snapshot=useRef(start.raw),dialog=useRef<HTMLDialogElement>(null),file=useRef<HTMLInputElement>(null);
 const dirty=signature(title,content)!==baseline;
 useEffect(()=>{if(start.selected)onLoad(start.selected);},[start,onLoad]);
 useEffect(()=>{onDirtyChange(dirty);const leave=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};if(dirty)window.addEventListener('beforeunload',leave);return()=>window.removeEventListener('beforeunload',leave);},[dirty,onDirtyChange]);
 useEffect(()=>{const changed=(event:StorageEvent)=>{if(event.key===reviewKey||event.key===null){setConflict(true);setMessage('다른 탭에서 목록이 바뀌었습니다. 목록을 새로고침하세요.');setFailed(true);}};window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);},[]);
 useEffect(()=>{if(view)dialog.current?.showModal();else dialog.current?.close();},[view]);
 function tell(error:unknown){setMessage(error instanceof Error?error.message:'검토안을 처리하지 못했습니다.');setFailed(true);}
 function refresh(){try{const next=readReviews(localStorage);snapshot.current=next.raw;setList(next.items);setConflict(false);setStorageFailed(false);setMessage('저장 목록을 새로고침했습니다.');setFailed(false);}catch(error){setStorageFailed(true);tell(error);}}
 function replace(action:()=>void|Promise<void>){if(dirty){pending.current=action;setView('replace');}else void action();}
 function open(review:Review){
  if(!sameContext(review.context,context)){setHistory(review);setView('history');return;}
  try{assertCurrent(review,context,content);replace(()=>{onLoad(review);setTitle(review.title);setActive(review);setBaseline(signature(review.title,review));setMessage('검토안을 열었습니다.');setFailed(false);setView(null);});}catch(error){tell(error);}
 }
 function current(){
  const now=new Date().toISOString();return validateReview({schemaVersion:1,id:active?.id||crypto.randomUUID(),revision:(active?.revision||0)+1,title:title.trim(),createdAt:active?.createdAt||now,updatedAt:now,context,actions:content.actions,budgets:content.budgets,note:content.note});
 }
 async function write(review:Review,importing=false){
  if(!navigator.locks)throw Error('이 브라우저에서는 안전한 저장을 지원하지 않습니다. 파일로 보관해 주세요.');
  return navigator.locks.request(reviewKey,()=>saveReview(localStorage,review,snapshot.current,importing));
 }
 async function save(){setBusy(true);try{const review=current();assertCurrent(review,context,content);const next=await write(review);snapshot.current=next.raw;setList(next.items);setActive(review);setTitle(review.title);setBaseline(signature(review.title,content));setMessage('저장했습니다.');setFailed(false);}catch(error){tell(error);}finally{setBusy(false);}}
 function backup(){try{exportFile(current());setMessage('검토안 파일 내려받기를 시작했습니다.');setFailed(false);}catch(error){tell(error);}}
 function fresh(){replace(()=>{const blank={...start.template,actions:start.template.actions.map(a=>({...a,selected:false})),budgets:start.template.budgets.map(b=>({...b,direction:'판단 보류'})),note:''};const now=new Date().toISOString();const review:Review={...blank,schemaVersion:1,id:crypto.randomUUID(),revision:1,title:'P1A ROAS 검토',createdAt:now,updatedAt:now,context};onLoad(review);setActive(undefined);setTitle(review.title);setBaseline(signature(review.title,blank));setMessage('새 검토안을 시작했습니다.');setFailed(false);setView(null);});}
 async function importFile(input:File){
  setBusy(true);try{
   if(input.size>fileLimit)throw Error('파일은 1MiB 이하만 불러올 수 있습니다.');
   const review=parseReview(await input.text());
   if(sameContext(review.context,context))assertCurrent(review,context,content);
   if(list.some(row=>row.id===review.id))throw Error('같은 ID의 검토안이 이미 있습니다. 기존 안을 유지했습니다.');
   replace(async()=>{setBusy(true);try{const next=await write(review,true);snapshot.current=next.raw;setList(next.items);
    if(sameContext(review.context,context)){openAfterImport(review);setView(null);}else{setHistory(review);setView('history');}
    setMessage('검토안 파일을 저장 목록에 추가했습니다.');setFailed(false);
   }catch(error){tell(error);}finally{setBusy(false);}});
  }catch(error){tell(error);}finally{setBusy(false);if(file.current)file.current.value='';}
 }
 function openAfterImport(review:Review){onLoad(review);setTitle(review.title);setActive(review);setBaseline(signature(review.title,review));}
 const when=(value:string)=>new Date(value).toLocaleString('ko-KR');
 return <>
  <section className="roas-review-tools" hidden={!visible} aria-label="검토안 저장">
   <div className="roas-review-title"><input aria-label="검토안 이름" value={title} maxLength={100} onChange={e=>setTitle(e.target.value)} disabled={busy}/><span>{dirty?'저장 전 변경 있음':active?'저장됨':'새 검토안'}</span>{active&&<time dateTime={active.updatedAt}>{when(active.updatedAt)}</time>}</div>
   <div className="roas-review-buttons"><button onClick={save} disabled={busy||conflict||storageFailed} className="roas-primary"><Save size={14}/>저장</button><button onClick={()=>{refresh();setView('list');}} disabled={busy}><FolderOpen size={14}/>저장 목록</button><button onClick={fresh} disabled={busy}><Plus size={14}/>새 검토안</button><button onClick={backup} disabled={busy}><Download size={14}/>파일 내보내기</button><button onClick={()=>file.current?.click()} disabled={busy||conflict||storageFailed}><Upload size={14}/>파일 불러오기</button><input ref={file} type="file" accept=".json,application/json" aria-label="검토안 파일" hidden onChange={e=>{const input=e.target.files?.[0];if(input)void importFile(input);}}/>{conflict&&<button onClick={refresh}>목록 새로고침</button>}</div>
   {message&&<div className="roas-review-message" role={failed?'alert':'status'}>{message}</div>}
  </section>
  <dialog ref={dialog} className="roas-saved-dialog" aria-labelledby="roas-saved-title" onClose={()=>setView(null)}><header><h2 id="roas-saved-title">{view==='replace'?'검토안 교체':view==='history'?'과거 검토안':'저장한 검토안'}</h2><button aria-label="검토안 목록 닫기" onClick={()=>setView(null)}><X size={18}/></button></header>
   {view==='replace'?<div><p>저장하지 않은 내용을 바꾸고 계속할까요?</p><div className="roas-confirm-actions"><button onClick={()=>{pending.current=null;setView(null);}}>취소</button><button onClick={()=>{const action=pending.current;pending.current=null;setView(null);void action?.();}}>계속</button></div></div>:view==='list'?<div>{list.length?list.map(row=><article key={row.id}><div><b>{row.title}</b><time>{when(row.updatedAt)}</time><span>{sameContext(row.context,context)?'현재 자료':'과거 자료'}</span></div><button onClick={()=>open(row)}>열기</button></article>):<p>저장한 검토안이 없습니다.</p>}</div>:history&&<div className="roas-history"><p role="status">현재 자료와 다른 초안입니다. 현재 분석과 연결하지 않습니다.</p><h3>{history.title}</h3><dl><dt>제품</dt><dd>{history.context.productId}</dd><dt>비교기간, 종료일 미포함</dt><dd>{history.context.before.start} ~ {history.context.before.end}<br/>{history.context.after.start} ~ {history.context.after.end}</dd><dt>환불 확인 기준일</dt><dd>{history.context.asOf}</dd><dt>자료 해시</dt><dd>{history.context.dataHash}</dd></dl>{history.actions.map(a=><article key={a.target}><h4>{a.selected?'선택, ':''}{a.target}</h4><p>{a.text||'미작성'}</p><details><summary>저장 당시 근거 ID</summary><p>{a.evidenceIds.join(', ')}</p></details></article>)}{history.budgets.map(b=><p key={b.channel}>{b.channel}: {b.direction}</p>)}<p>{history.note||'추가 메모 없음'}</p><button onClick={()=>exportFile(history)}><Download size={14}/>과거 검토안 내보내기</button></div>}
  </dialog>
 </>;
}
