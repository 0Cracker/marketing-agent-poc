import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowUp,Sparkles} from 'lucide-react';
import {createAgentClient,errorText,scopeFromScreen,snapshotKey} from './agent-client';
import {analysisAnswer,budgetConclusion} from './agent-answer';
import {hypothesisRows} from './agent-presentation';
import {AgentResult,EvidenceCards} from './agent-result';
import type {AgentRun,AgentScope,BudgetInputs,ScreenSelection} from './agent-client';
import './agent-conversation.css';
import './agent-chat.css';

const states:Record<string,string>={analyzed:'분석 완료',needs_scope:'범위 확인 필요',held:'자료·판단 보류',paused:'재개 대기',running:'분석 중',pending_approval:'승인 검토 대기',approved:'가상 변경 승인됨',invalidated:'기존 제안 무효',rejected:'제안 거절됨',retained:'현행 유지·추가 조사',cancelled:'취소됨'};
const candidates:Record<string,string>={price:'가격',stock:'재고',media:'광고',measurement:'계측'};
const eventNames:Record<string,string>={scope_validated:'범위 확인',quality:'자료 적합성 확인',tool:'근거 조회',output_validated:'결과 검증',handoff:'분석 인계',proposal_created:'제안 생성',approved:'승인 기록',rejected:'거절 기록',revised:'제안 수정',stopped:'보류'};
const toolNames:Record<string,string>={market_compare:'시장 지표 비교',relations:'관계·반대 근거 조회',evidence:'원천 확인',budget_inputs:'예산 입력 확인',simulate:'현행·대안 계산'};

export function AgentConversation({screen,evidenceIds,metricLabels,selectedTitle}:{screen:ScreenSelection;evidenceIds:string[];metricLabels:string[];selectedTitle:string}){
  const [client]=useState(()=>createAgentClient());
  const [question,setQuestion]=useState(''),[focus,setFocus]=useState('price');
  const [pendingQuestion,setPendingQuestion]=useState('');
  const threadRef=useRef<HTMLDivElement>(null),inputRef=useRef<HTMLTextAreaElement>(null);
  const [analysis,setAnalysis]=useState<AgentRun|null>(null),[proposal,setProposal]=useState<AgentRun|null>(null),[inputs,setInputs]=useState<BudgetInputs|null>(null);
  const [previous,setPrevious]=useState<AgentRun[]>([]),[remote,setRemote]=useState(false),[modelLabels,setModelLabels]=useState('');
  const [candidateId,setCandidate]=useState(''),[modelId,setModel]=useState('');
  const [connected,setConnected]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[evidence,setEvidence]=useState<Record<string,unknown>[]|null>(null);
  const generation=useRef({value:0});
  const alive=useRef(true),saveIds=useRef<{analysisId?:string;proposalId?:string}>({}),storageKey=useRef('');
  let scope:AgentScope|null=null,scopeError='';try{scope=scopeFromScreen(screen);}catch(e){scopeError=(e as Error).message;}
  const key=scope?snapshotKey(scope,evidenceIds):'';
  function save(next:typeof saveIds.current){saveIds.current={...saveIds.current,...next};try{localStorage.setItem(storageKey.current||key,JSON.stringify(saveIds.current));}catch{/* Storage is optional; the server is authoritative. */}}
  const reconnect=useCallback(async()=>{
    const epoch=++generation.current.value;const current=()=>alive.current&&epoch===generation.current.value;
    setError('');try{const session=await client.session();if(!current())return;if(screen.dataHash&&session.dataHash!==screen.dataHash)throw Error('inputs_changed');setConnected(true);setRemote(session.mode==='remote_model');setModelLabels(session.models?`분석 ${session.models.analysis} / 예산 ${session.models.budget}`:'');
      storageKey.current=key+':'+session.mode;
      let stored:typeof saveIds.current={};try{stored=JSON.parse(localStorage.getItem(storageKey.current)||'{}') as typeof stored;}catch{/* Empty browser state. */}
      saveIds.current=stored;
      if(stored.analysisId){const r=await client.getRun(stored.analysisId);if(!current())return;setAnalysis(r);const chain:AgentRun[]=[];let parentId=r.parentId;while(parentId&&chain.length<8){const parent=await client.getRun(parentId);if(!current())return;chain.unshift(parent);parentId=parent.parentId;}if(current())setPrevious(chain);}
      if(stored.proposalId){const r=await client.getRun(stored.proposalId);if(current())setProposal(r);}
    }catch(e){if(current()){setConnected(false);setError(errorText((e as Error).message));}}
  },[client,key,screen.dataHash]);
  useEffect(()=>{alive.current=true;const generationState=generation.current;let active=true;if(!scopeError)queueMicrotask(()=>{if(active)void reconnect();});return ()=>{active=false;alive.current=false;generationState.value++;};},[scopeError,reconnect]); // A changed snapshot remounts this component in AgentPanel.
  useEffect(()=>{if(!proposal)return;let active=true;void client.budgetInputs(proposal.id).then(r=>{if(active){setInputs(r);setCandidate(proposal.simulation?.candidate.recordId||'');setModel(proposal.simulation?.modelId||'');}}).catch(()=>{if(active)setInputs(null);});return ()=>{active=false;};},[client,proposal]);
  useEffect(()=>{const node=threadRef.current;if(!node)return;const target=node.querySelector<HTMLElement>('[data-current-question]');if(pendingQuestion)node.scrollTop=node.scrollHeight;else if(target)node.scrollTop+=target.getBoundingClientRect().top-node.getBoundingClientRect().top-8;},[analysis?.id,pendingQuestion]);
  useEffect(()=>{const node=threadRef.current,target=node?.querySelector<HTMLElement>('.wb-chat-budget');if(node&&target)node.scrollTop+=target.getBoundingClientRect().top-node.getBoundingClientRect().top-8;},[proposal?.id]);
  useEffect(()=>{const node=inputRef.current;if(node){node.style.height='auto';node.style.height=Math.min(node.scrollHeight,144)+'px';}},[question]);
  async function perform(action:()=>Promise<void>){setBusy(true);setError('');setEvidence(null);try{await action();}catch(e){if(alive.current)setError(errorText((e as Error).message));}finally{if(alive.current)setBusy(false);}}
  async function ask(text=question,selectedFocus=focus){
    if(!scope||!text.trim()||busy)return;
    setPendingQuestion(text);
    await perform(async()=>{
      const parent=analysis?.status==='analyzed'&&!analysis.supersededBy?analysis.id:undefined;
      const r=await client.analyze({question:text,scope,parentId:parent,focus:selectedFocus,context:{screenVersion:'workbench-model/1',metricLabels,evidenceIds,selectedTitle}});
      if(!alive.current)return;if(parent&&analysis)setPrevious(items=>[...items,{...analysis,supersededBy:r.id}].slice(-8));setAnalysis(r);setQuestion('');save({analysisId:r.id});
      if(proposal)setProposal(await client.getRun(proposal.id));
    });
    if(alive.current){setPendingQuestion('');requestAnimationFrame(()=>inputRef.current?.focus());}
  }
  async function review(){if(!analysis)return;await perform(async()=>{const r=await client.budget({analysisId:analysis.id,analysisVersion:analysis.version,userSelected:true});if(alive.current){setProposal(r);save({proposalId:r.id});}});}
  async function proposalAction(action:'approve'|'reject'|'revise'){
    if(!proposal)return;
    await perform(async()=>{const r=await client.action(proposal.id,action,{version:proposal.version,...(action==='revise'?{candidateId,modelId}:{})});if(alive.current){setProposal(r);save({proposalId:r.id});}});
  }
  async function showEvidence(id:string){if(!analysis)return;await perform(async()=>{const r=await client.evidence(analysis.id,[id]);if(alive.current)setEvidence(r.records);});}
  const answer=analysis?analysisAnswer(analysis):null;
  const summaryRows=analysis?hypothesisRows(analysis):[];
  const referenceIds=[...new Set((analysis?.output?.hypotheses||[]).flatMap(h=>[h.supports[0],h.counters[0]]).filter((id):id is string=>!!id))];
  function draft(text:string){setQuestion(text);inputRef.current?.focus();}
  return <section className="wb-conversation" aria-label="분석·예산 대화">
    <details className="wb-chat-context"><summary>현재 화면 기준 {scope&&<span>{scope.productIds.length}개 제품 · {screen.month}</span>}</summary>{scope?<p className="wb-agent-scope">{screen.country} · {scope.start}–{scope.end} 미포함<br/>제품 {scope.productIds.join(', ')}<br/>자료 기준: {scope.asOf}</p>:<p role="status">{errorText(scopeError)}</p>}{modelLabels&&<p className="wb-agent-help">{modelLabels}</p>}<p className="wb-agent-help">{remote?'모델이 질문과 범위에서 조회 도구를 선택합니다. 실제 광고는 집행하지 않습니다.':'오프라인 절차 데모입니다. 선택한 원인에 따라 조회하며 실제 LLM의 질문 이해는 검증하지 않습니다.'}</p></details>
    <div ref={threadRef} className="wb-chat-thread" role="region" aria-label="대화 내역" aria-busy={busy}>
    {!analysis&&!pendingQuestion&&<div className="wb-chat-welcome"><span className="wb-chat-welcome-icon"><Sparkles size={25}/></span><h2>데이터에서 궁금한 점을<br/>함께 살펴볼까요?</h2><p>선택한 화면을 바탕으로 근거를 찾고,<br/>다음에 할 일을 정리해 드려요.</p><div className="wb-chat-starters"><button type="button" disabled={!scope} onClick={()=>draft('선택한 제품들의 경쟁 현황을 비교해줘')}>선택 제품의 경쟁 현황 비교</button><button type="button" disabled={!scope} onClick={()=>draft('가격 관련 지지·반대 근거를 확인해줘')}>가격 관련 근거 살펴보기</button></div></div>}
    {previous.map(r=><div key={r.id} className="wb-chat-exchange"><div className="wb-chat-user" aria-label="내 질문"><p>{r.question}</p></div><section className="wb-chat-past"><h2><Sparkles size={15}/> 마케팅 AI <span>이전 답변</span></h2><p>{analysisAnswer({...r,supersededBy:undefined}).conclusion}</p><details><summary>이전 답변 상세</summary><p>{analysisAnswer({...r,supersededBy:undefined}).next}</p><p className="wb-agent-help">예산 검토에는 최신 분석을 사용합니다.</p></details></section></div>)}
    {analysis?.question&&<div className="wb-chat-user" data-current-question aria-label="내 질문"><p>{analysis.question}</p></div>}
      {analysis&&<section className="wb-agent-result" aria-live="polite"><h2><Sparkles size={15}/> 마케팅 AI <span>{states[analysis.status]||analysis.status}</span></h2>
        <p className="wb-agent-conclusion">{answer?.conclusion}</p>
        {analysis.reason&&<p>{errorText(analysis.reason)}</p>}
        {(!!analysis.output?.hypotheses?.length||!!analysis.output?.facts?.length)&&<><h3>핵심 근거</h3><ul className="wb-agent-key-points">{analysis.output.hypotheses?.slice(0,2).map(h=><li key={h.candidate}>{candidates[h.candidate]}: {summaryRows.find(r=>r.candidate===h.candidate)?.summary}.{[h.supports[0],h.counters[0]].filter(Boolean).map(id=><button className="wb-agent-reference" key={id} type="button" disabled={busy} onClick={()=>void showEvidence(id)} aria-label={`근거 ${referenceIds.indexOf(id)+1} 원문 보기`}>[{referenceIds.indexOf(id)+1}]</button>)}</li>)}{!!analysis.output.facts?.length&&<li>선택 범위에서 사실 {analysis.output.facts.length}개를 반환했습니다.{analysis.output.completeness==='partial'?' 일부 값은 미확보입니다.':''}</li>}</ul></>}
        {analysis.output&&<p className="wb-agent-limit"><b>한계</b> 가상 표본·제한된 조회 범위의 결과입니다. 근거 건수는 효과의 크기나 신뢰도가 아니며, 인과는 입증되지 않았습니다.</p>}
        <p className="wb-agent-next"><b>다음 행동</b> {answer?.next}</p>
        {!!analysis.screenContext?.excludedEvidenceIds?.length&&<p>선택 근거 중 질문 범위를 벗어난 {analysis.screenContext.excludedEvidenceIds.length}건은 제외했습니다.</p>}
        {analysis.output&&<details><summary>수치·원인 후보 상세</summary><AgentResult run={analysis} busy={busy} onEvidence={id=>void showEvidence(id)}/></details>}
        {evidence&&<EvidenceCards records={evidence}/>}
        <details><summary>조회·판단 과정 보기</summary><p className="wb-agent-help">실제 실행 기록입니다. 모델의 내부 사고 과정을 표시하지 않습니다.</p><ol className="wb-agent-process">{analysis.events.map((e,i)=><li key={i}>{e.type==='tool'?toolNames[e.name||'']||'근거 조회':eventNames[e.type]||e.type}{e.type==='tool'&&e.name==='relations'&&<p>제품·자료·원문의 관계를 따라 근거를 조회합니다. 연결 관계는 인과의 증명이 아닙니다.</p>}</li>)}</ol></details>
        <div className="wb-agent-actions"><button type="button" disabled={busy||analysis.status!=='analyzed'||!!analysis.supersededBy} onClick={()=>{setFocus('price');void ask('그중 가격 영향만 다시 봐줘','price');}}>가격만 다시 보기</button><button type="button" disabled={busy||analysis.status!=='analyzed'||!!analysis.supersededBy} onClick={()=>void review()}>예산 검토로 넘기기</button><button type="button" disabled={busy} onClick={()=>void perform(async()=>{const r=await client.getRun(analysis.id);if(alive.current)setAnalysis(r);if(proposal&&alive.current)setProposal(await client.getRun(proposal.id));})}>저장된 결과 확인</button></div>
        {analysis.status==='paused'&&<button type="button" disabled={busy} onClick={()=>void perform(async()=>{const r=await client.action(analysis.id,'resume',{});if(alive.current)setAnalysis(r);})}>대기 후 분석 재개</button>}
      </section>}
      {proposal&&<section className="wb-agent-result wb-chat-budget"><h2><Sparkles size={15}/> 예산 검토 <span>{states[proposal.status]||proposal.status}</span></h2>
        <p className="wb-agent-conclusion">{budgetConclusion(proposal)}</p>
        {proposal.reason&&<p>{errorText(proposal.reason)}</p>}
        {proposal.status==='paused'&&<button type="button" disabled={busy} onClick={()=>void perform(async()=>{const r=await client.action(proposal.id,'resume',{});if(alive.current)setProposal(r);})}>대기 후 예산 검토 재개</button>}
        {proposal.simulation&&<><p className="wb-agent-limit"><b>한계</b> 기존 가상 시나리오의 가정 기반 계산입니다. 실제 계정의 현행·성과 예측이 아니며, 비교 수치만으로 집행을 권하지 않습니다.</p>
          {proposal.simulation.period&&<p className="wb-agent-help">예산 시나리오 기간: {proposal.simulation.period.start} ~ {proposal.simulation.period.end_exclusive} 미포함. 아래 캠페인만 변경 대상입니다.</p>}
          <table className="wb-agent-budget-table"><caption>캠페인별 배분 비교</caption><thead><tr><th>변경 대상</th><th>기준안</th><th>후보안</th></tr></thead><tbody>{proposal.simulation.candidate.allocations.map(a=>{const baseline=proposal.simulation!.baseline.allocations.find(b=>b.campaign_ref===a.campaign_ref);return <tr key={a.campaign_ref}><th>{a.campaign_ref.replace(/^D007-Campaign-/,'')}</th><td>{baseline?`${Number(baseline.amount.amount).toLocaleString('ko-KR')} ${baseline.amount.currency}`:'미확보'}</td><td>{Number(a.amount.amount).toLocaleString('ko-KR')} {a.amount.currency}</td></tr>;})}</tbody></table>
          <table><caption>같은 가정의 기준안·후보안 비교</caption><thead><tr><th>구분</th><th>예상 전환수 · 가상 모형</th></tr></thead><tbody><tr><th>기준안</th><td>{proposal.simulation.baseline.expected}</td></tr><tr><th>후보안</th><td>{proposal.simulation.candidate.expected}</td></tr></tbody></table>
          <details><summary>승인 대상 배분·가정 보기</summary><p>모형: {proposal.simulation.modelVersion}</p>{proposal.simulation.formula&&<p>수식: {proposal.simulation.formula} · {proposal.simulation.responseAggregation==='channel'?'같은 채널 예산 합산 후 계산':'캠페인별 계산'}</p>}{proposal.simulation.parameters&&<ul>{proposal.simulation.parameters.map(p=><li key={p.name}>{p.name}: {p.value}</li>)}</ul>}<ul>{proposal.simulation.candidate.allocations.map(a=><li key={a.campaign_ref}>{a.campaign_ref}: {a.amount.amount} {a.amount.currency}</li>)}</ul><ul>{proposal.simulation.assumptions.map(a=><li key={a}>{a}</li>)}</ul><p>제안 버전 {proposal.version}</p></details>
          <p className="wb-agent-next"><b>다음 행동</b> {proposal.status==='invalidated'?'최신 분석으로 예산을 다시 검토하세요.':proposal.status==='rejected'?'새 제안이 필요하면 분석에서 예산 검토를 다시 선택하세요.':proposal.status==='approved'?'승인된 배분·가정을 확인하세요. 수정하면 다시 승인해야 합니다.':'배분·가정을 검토하고, 필요하면 가정을 바꿔 다시 계산하세요.'}</p>
          {inputs&&<details><summary>후보·가정 변경</summary><div className="wb-agent-revision"><label>다른 기존 후보<select value={candidateId} onChange={e=>setCandidate(e.target.value)} disabled={busy||!['pending_approval','approved','retained'].includes(proposal.status)}>{inputs.scenarios.map(s=><option key={s.record_id} value={s.record_id}>{s.record_id}</option>)}</select></label><label>가정 모형<select value={modelId} onChange={e=>setModel(e.target.value)} disabled={busy||!['pending_approval','approved','retained'].includes(proposal.status)}>{inputs.models.map(m=><option key={m.record_id} value={m.record_id}>{m.model_ref}</option>)}</select></label><button type="button" disabled={busy||!['pending_approval','approved','retained'].includes(proposal.status)} onClick={()=>void proposalAction('revise')}>수정·재계산</button><p>수정하면 기존 승인은 무효화됩니다.</p></div></details>}
          <div className="wb-agent-actions"><button type="button" disabled={busy||proposal.status!=='pending_approval'} onClick={()=>void proposalAction('approve')}>가상 변경 승인</button><button type="button" disabled={busy||!['pending_approval','approved'].includes(proposal.status)} onClick={()=>void proposalAction('reject')}>제안 거절</button><button type="button" disabled>실제 집행 미연결</button></div>
          {proposal.approval&&<p>승인 유효기한: {proposal.approval.expiresAt}</p>}
        </>}
      </section>}
    {pendingQuestion&&<><div className="wb-chat-user" aria-label="보내는 질문"><p>{pendingQuestion}</p></div><p className="wb-chat-working" role="status"><Sparkles size={15}/> 선택 범위의 자료를 확인하고 있어요…</p></>}
    </div>
    <div className="wb-chat-compose-area">
      {error&&<p role="alert" className="wb-agent-error">{error}</p>}
      {!connected&&scope&&<button type="button" onClick={()=>void reconnect()}>서버 다시 연결</button>}
      {!scope&&<p role="status" className="wb-agent-help">{errorText(scopeError)}</p>}
      <form className="wb-chat-compose" onSubmit={e=>{e.preventDefault();void ask();}}>
        <textarea ref={inputRef} aria-label="분석 질문" value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();if(!busy&&connected&&scope&&question.trim())void ask();}}} placeholder={analysis?'이어서 궁금한 점을 물어보세요':'데이터에 대해 무엇이 궁금하세요?'} maxLength={4000} rows={2} disabled={busy||!scope}/>
        <div className="wb-chat-compose-tools"><details><summary>분석 설정</summary><label>살펴볼 원인<select value={focus} onChange={e=>setFocus(e.target.value)} disabled={busy}>{Object.entries(candidates).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label></details><button type="submit" className="wb-chat-send" aria-label="메시지 보내기" disabled={busy||!connected||!scope||!question.trim()}><ArrowUp size={18}/></button></div>
      </form>
      <p className="wb-chat-footnote">{remote?'AI 답변 · 근거를 함께 확인하세요':'오프라인 데모 · 외부 LLM 미연결'}<span>Shift + Enter 줄바꿈</span></p>
    </div>
  </section>;
}
