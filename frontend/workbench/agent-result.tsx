import {BarChart,Bar,XAxis,YAxis,Tooltip,ResponsiveContainer} from 'recharts';
import {useEffect,useRef} from 'react';
import type {AgentRun} from './agent-client';
import {fieldNames,formatFact,hypothesisRows,shareSeries} from './agent-presentation';

export function AgentResult({run,busy,onEvidence}:{run:AgentRun;busy:boolean;onEvidence:(id:string)=>void}){
  const facts=run.output?.facts||[],shares=shareSeries(run),rows=hypothesisRows(run);
  const keyFacts=facts.filter(f=>f.field==='share').slice(0,3);
  if(!keyFacts.length)keyFacts.push(...facts.filter(f=>f.field!=='market_total_value').slice(0,3));
  return <>
    {!!keyFacts.length&&<div className="wb-agent-key-facts" aria-label="핵심 근거">{keyFacts.map(f=><article key={f.id}><p>{f.product} {fieldNames[f.field]||f.field}</p><strong>{formatFact(f)}</strong><button type="button" disabled={busy} onClick={()=>onEvidence(f.recordId)}>이 수치의 근거</button></article>)}</div>}
    {!!shares.length&&<figure className="wb-agent-chart"><figcaption>선택 제품의 금액 점유율 · 같은 기간 비교</figcaption><div aria-hidden="true"><ResponsiveContainer width="100%" height={Math.max(150,shares.length*34)}><BarChart data={shares} layout="vertical" margin={{top:8,right:20,bottom:8,left:0}}><XAxis type="number" unit="%" tick={{fontSize:11}}/><YAxis type="category" dataKey="product" width={46} tick={{fontSize:11}}/><Tooltip formatter={value=>`${Number(value).toFixed(2)}%`}/><Bar dataKey="share" fill="#6941C6" radius={[0,3,3,0]}/></BarChart></ResponsiveContainer></div><details><summary>그래프 수치·근거 보기</summary><ul>{shares.map(s=><li key={s.recordId}>{s.product}: {s.share.toFixed(2)}% <button type="button" disabled={busy} onClick={()=>onEvidence(s.recordId)}>근거 보기</button></li>)}</ul></details></figure>}
    <div className="wb-agent-comparison"><table><caption>원인 후보 검토 상태</caption><thead><tr><th>후보</th><th>지지 / 반대</th><th>판단</th></tr></thead><tbody>{rows.map(r=><tr key={r.candidate}><th>{r.label}</th><td>{r.classified?`${r.supports.length} / ${r.counters.length}`:'—'}</td><td>{r.assessment}</td></tr>)}</tbody></table></div>
    <p className="wb-agent-help">건수는 제한된 조회 결과이며 전체 의견의 비율이나 원인 확률이 아닙니다. 미검토·미분류는 영향 없음을 뜻하지 않습니다.</p>
    {rows.filter(r=>r.classified).map(r=><details key={r.candidate}><summary>{r.label} 주장별 지지·반대 근거</summary><div className="wb-agent-evidence-links">{r.supports.map(id=><button key={'s'+id} type="button" disabled={busy} onClick={()=>onEvidence(id)}>지지 · {id}</button>)}{r.counters.map(id=><button key={'c'+id} type="button" disabled={busy} onClick={()=>onEvidence(id)}>반대 · {id}</button>)}</div></details>)}
    {!!facts.length&&<details><summary>확인한 사실 전체 · {facts.length}개</summary><ul className="wb-agent-facts">{facts.map(f=><li key={f.id}><div><span>{f.product} {fieldNames[f.field]||f.field}</span><strong>{formatFact(f)}</strong></div><button type="button" disabled={busy} onClick={()=>onEvidence(f.recordId)}>근거 {f.recordId}</button></li>)}</ul></details>}
  </>;
}

export function EvidenceCards({records}:{records:Record<string,unknown>[]}){
  const target=useRef<HTMLElement>(null);
  useEffect(()=>{target.current?.scrollIntoView({block:'nearest'});target.current?.focus({preventScroll:true});},[records]);
  return <section ref={target} tabIndex={-1} className="wb-agent-source" aria-label="선택한 근거 원문"><h3>근거 원문과 출처</h3>{records.map((r,i)=>{
    const span=r.evidence_span as {quote?:string;record_ref?:string;field_path?:string;start_offset?:number;end_offset?:number}|undefined;
    const source=r.provenance as {artifact_ref?:string}|undefined;
    const period=r.period as {start?:string;end_exclusive?:string}|undefined;
    const temporal=r.temporal as {available_at?:string}|undefined;
    return <article key={String(r.record_id||i)}><strong>{String(r.subject_ref||r.variant_ref||'선택 자료')} · {String(r.record_id||'')}</strong>{span?.quote?<blockquote>{span.quote}</blockquote>:typeof r.body_text==='string'?<blockquote>{r.body_text}</blockquote>:<p>선택한 수치의 원천 레코드입니다. 필드와 원값은 상세에서 확인할 수 있습니다.</p>}
      <dl><dt>원천</dt><dd>{source?.artifact_ref||'미확보'}</dd><dt>기간·관측 시점</dt><dd>{period?.start?`${period.start} ~ ${period.end_exclusive} 미포함`:String(r.observed_at||r.written_at||'상세 원문 참조')}</dd><dt>자료 확보 시각</dt><dd>{temporal?.available_at||'미확보'}</dd>{span&&<><dt>원문 위치</dt><dd>{span.record_ref} · {span.field_path} · {span.start_offset}~{span.end_offset}</dd></>}</dl><p className="wb-agent-help">가상 표본 자료 · 원문 의견은 인과 효과의 입증과 구별합니다.</p><details><summary>원값·기술 상세</summary><pre>{JSON.stringify(r,null,2)}</pre></details></article>;
  })}</section>;
}
