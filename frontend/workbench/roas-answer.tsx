import {useEffect,useRef,useState} from 'react';
import {Sparkles,X,ArrowRight,ArrowUpRight,ArrowDownRight} from 'lucide-react';
import {displayTrainingText} from '../../shared/training-dashboard.mjs';
import type {TrainingData,Filters} from '../../shared/training-dashboard.mjs';
import {chatComparison,chatSourceRows,chatValue} from '../../shared/roas-chat.mjs';
import type {ChatSource,ChatComparison} from '../../shared/roas-chat.mjs';
import type {RoasAnswer} from './agent-client';
import {deltaTone} from './training-presentation';

const toolLabels:Record<string,string>={overview:'기간과 캠페인 비교',breakdown:'상세 항목 비교',trend:'일별 추이 조회',records:'운영 기록 조회'};
export function sourceTitle(source:ChatSource){return displayTrainingText((source.label||source.title||(source.kind==='summary'?'전체 성과':source.id))+(source.period?', '+(source.period.id==='current'?'분석 기간':'직전 14일'):''));}

export function RoasAnswerView({result,data,filters}:{result:RoasAnswer;data:TrainingData;filters:Filters}){
 const [selected,setSelected]=useState<string|null>(null);
 const source=result.sources.find(row=>row.id===selected),sourceRef=useRef<HTMLElement>(null);
 useEffect(()=>{if(selected)sourceRef.current?.scrollIntoView({block:'nearest',behavior:'instant'});},[selected]);
 function reference(text:string){return text.split(/(\[[^\]\n]+\])/g).map((part,index)=>{const id=part.slice(1,-1),number=result.sources.findIndex(row=>row.id===id);return number<0?displayTrainingText(part):<button key={index} className="wb-answer-citation" aria-label={`근거 ${number+1} 보기`} aria-expanded={selected===id} onClick={()=>setSelected(current=>current===id?null:id)}>{number+1}</button>;});}
 const sections=result.sections;
 const conclusions=(sections?.conclusion||result.answer).split(/\n+/).filter(text=>text.trim());
 const comparison=result.comparison??(!sections?chatComparison(result.sources.filter(s=>s.kind==='summary'),'roas'):null);
 return <section className="wb-agent-result wb-structured-answer">
  <h2><Sparkles size={15}/>마케팅 AI<span>{result.mode==='remote_model'?'분석 완료':'오프라인 연결 확인'}</span></h2>
  <div className="wb-answer-conclusion"><h3>핵심 결론</h3><ul>{conclusions.map((text,i)=><li key={i}>{reference(text)}</li>)}</ul></div>
  {(sections?.summary.length||comparison)&&<section className="wb-answer-section"><h3>결과 정리</h3>{sections?.summary.length&&<ul>{sections.summary.map((text,i)=><li key={i}>{reference(text)}</li>)}</ul>}{comparison&&<Comparison values={comparison} onSource={setSelected}/>}</section>}
  <section className="wb-answer-section"><h3>판단 근거</h3>{sections?.reasoning.length?<ul>{sections.reasoning.map((text,i)=><li key={i}>{reference(text)}</li>)}</ul>:<p>답변에 연결된 집계와 운영 기록을 확인하세요.</p>}<details className="wb-answer-references"><summary>참고한 자료 {result.sources.length}개</summary><div>{result.sources.map((row,i)=><button key={row.id} onClick={()=>setSelected(row.id)}><span>{i+1}</span>{sourceTitle(row)}</button>)}</div></details>
   {source&&<section ref={sourceRef} className="wb-answer-source" aria-label="인용한 상세 데이터"><header><div><span>근거 {result.sources.indexOf(source)+1}</span><h4>{sourceTitle(source)}</h4></div><button aria-label="상세 근거 닫기" onClick={()=>setSelected(null)}><X size={16}/></button></header><SourceDetails key={source.id} source={source} data={data} filters={filters}/></section>}
  </section>
  {sections&&<section className="wb-answer-section wb-answer-actions"><h3>최종 추천 액션</h3><ol>{sections.actions.map((text,i)=><li key={i}>{reference(text)}</li>)}</ol></section>}
  <div className="wb-answer-limits">{sections?.limitations.map((text,i)=><p key={i}>{reference(text)}</p>)}<p>가상 집계 기반 분석이며, 운영 기록만으로 인과관계를 확정할 수 없습니다.</p></div>
  <details className="wb-answer-process"><summary>조회 과정 보기</summary><ol>{result.events.map((event,i)=><li key={i}>{toolLabels[event.tool]||event.tool}, {event.count}개</li>)}</ol></details>
 </section>;
}

const comparisonLabel=(label:string)=>displayTrainingText(label).replace(/^8월 구매 캠페인 \| /,"").replace(/^8월 콘텐츠 제휴 \| /,"제휴, ");


function Comparison({values,onSource}:{values:ChatComparison;onSource:(id:string)=>void}){
 const [display,setDisplay]=useState(()=>values.rows.length>3?'table':'chart');
 const maximum=Math.max(0,...values.rows.flatMap(row=>[row.before||0,row.after||0]));
 function change(before:number|null,after:number|null){if(before===null||after===null)return '비교 불가';const value=values.rate?(after-before)*100:before?(after/before-1)*100:after===0?0:null;return value===null?'비교 불가':(value>0?'+':'')+value.toLocaleString('ko-KR',{maximumFractionDigits:1})+(values.rate?'%p':'%');}
 return <div className="wb-answer-comparison"><header><strong>{values.label} 비교</strong><div role="group" aria-label="비교 표시 방식"><button type="button" aria-pressed={display==='chart'} onClick={()=>setDisplay('chart')}>그래프</button><button type="button" aria-pressed={display==='table'} onClick={()=>setDisplay('table')}>표</button></div></header>
  {display==='chart'?<figure><figcaption><span>직전 14일</span><span>분석 기간</span><small>모든 행에 같은 눈금 적용</small></figcaption>{values.rows.map(row=><div key={row.key} className="wb-answer-bar-row"><strong>{comparisonLabel(row.label)}</strong>{(['before','after'] as const).map((period,i)=><button key={period} className={'wb-answer-bar '+period+' wb-answer-change is-'+deltaTone(values.metric,period==='after'?row.before:null,row[period],values.rate)} onClick={()=>onSource(row.sourceIds[i])} aria-label={`${row.label}, ${i?'분석 기간':'직전 14일'}, ${chatValue(row[period],values.metric)}, 근거 보기`}><span><i style={{width:(row[period]===null||!maximum?0:row[period]!/maximum*100)+'%'}}/></span><b>{chatValue(row[period],values.metric)}</b></button>)}<small className={"wb-answer-change is-"+deltaTone(values.metric,row.before,row.after,values.rate)}>{row.before!==null&&row.after!==null&&row.after!==row.before&&(row.after>row.before?<ArrowUpRight size={13}/>:<ArrowDownRight size={13}/>)}직전 대비 {change(row.before,row.after)}</small></div>)}</figure>:<div className="wb-answer-table"><table><caption>{values.label}, 기간별 집계</caption><thead><tr><th>구분</th><th><div className="wb-answer-flow-heading"><span>직전</span><span>현재</span></div></th></tr></thead><tbody>{values.rows.map(row=><tr key={row.key}><th scope="row">{comparisonLabel(row.label)}</th><td><div className="wb-answer-value-flow"><button className="wb-answer-before wb-answer-change is-neutral" onClick={()=>onSource(row.sourceIds[0])}>{chatValue(row.before,values.metric)}</button><span className={"wb-answer-flow-change wb-answer-change is-"+deltaTone(values.metric,row.before,row.after,values.rate)} aria-label={"직전 대비 "+change(row.before,row.after)}><ArrowRight size={38} strokeWidth={1.4} aria-hidden="true"/><small>{change(row.before,row.after)}</small></span><button className={'wb-answer-current wb-answer-change is-'+deltaTone(values.metric,row.before,row.after,values.rate)} onClick={()=>onSource(row.sourceIds[1])}>{chatValue(row.after,values.metric)}</button></div></td></tr>)}</tbody></table></div>}
 </div>;
}

function SourceDetails({source,data,filters}:{source:ChatSource;data:TrainingData;filters:Filters}){
 const [limit,setLimit]=useState(12);
 const rows=chatSourceRows(data,filters,source);
 const total=source.total;
 return <><p className="wb-answer-source-period">{source.period?`${source.period.start} ~ ${new Date(Date.parse(source.period.end+'T00:00:00Z')-86400000).toISOString().slice(0,10)}`:String(source.date||'운영 기록')}<br/>보고 기준 {new Date(data.asOf).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})}</p>
  {total&&<><dl className="wb-answer-source-totals">{['roas','spend','revenue','orders'].map(key=><div key={key}><dt>{({roas:'ROAS',spend:'집행비',revenue:'구매 전환 매출',orders:'주문'} as Record<string,string>)[key]}</dt><dd>{chatValue((total.rates as Record<string,number|null>)[key]??total[key as keyof typeof total] as number,key)}</dd></div>)}</dl><p className="wb-answer-formula">ROAS = 구매 전환 매출 ÷ 유료 마케팅 집행비<br/>{total.revenue.toLocaleString('ko-KR')}원 ÷ {total.spend.toLocaleString('ko-KR')}원 = {chatValue(total.rates.roas,'roas')}</p></>}
  <h4>원천 데이터 {rows.length}행</h4><p className="wb-answer-source-note">인용한 집계에 실제로 포함된 행입니다. 각 행에서 전체 필드를 펼칠 수 있습니다.</p>
  <div className="wb-answer-raw-rows">{rows.slice(0,limit).map(row=><details key={row.id}><summary><span>{'title' in row?displayTrainingText(row.title):`${row.date}, ${displayTrainingText(row.campaignId||'공통')}, ${row.device==='mobile'?'모바일':row.device==='desktop'?'PC':'공통'}`}</span><small>{row.id}</small></summary>{'values' in row?<dl>{Object.entries(row.values).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{displayTrainingText(value)}</dd></div>)}</dl>:<dl>{(['spend','revenue','orders'] as const).map(key=><div key={key}><dt>{({spend:'집행비',revenue:'구매 전환 매출',orders:'주문'})[key]}</dt><dd>{chatValue(row[key],key)}</dd></div>)}</dl>}<details><summary>전체 필드 JSON</summary><pre>{JSON.stringify(row,null,2)}</pre></details></details>)}</div>{rows.length>limit&&<button className="wb-answer-more" onClick={()=>setLimit(n=>n+12)}>12행 더 보기</button>}
 </>;
}
