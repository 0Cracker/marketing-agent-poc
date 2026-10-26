'use client';
import type {Raw} from './contract';
import type {Investigation} from './roas-investigation-note';
import {investigationScope} from './roas-investigation-note';
export {investigationScope} from './roas-investigation-note';
import {roasEvidenceTime} from '../../shared/roas-view.mjs';
import {deviceFunnels,feedbackComparison} from '../../shared/roas-diagnosis.mjs';

export const investigationLabels={
 channel:{all:'전체 매체',search:'검색',social:'소셜'},
 device:{all:'양 기기',mobile:'모바일',desktop:'PC'},
 stage:{all:'문제 단계 미선택',cost:'클릭 비용',checkout:'결제 시작 이후 구매',revenue:'구매당 금액',refund:'취소와 환불'},
 hypothesis:{none:'원인 미확인, 추가 자료 확인',guidance:'배송과 금액 안내',payment:'결제 기능',audience:'유입 고객 구성',tracking:'측정과 집계'},
} as const;
export const hypothesisChecks={
 none:'설명 후보를 선택하고 구분에 필요한 확인 내용을 남기세요.',
 guidance:'실제 상품 페이지와 결제 화면에서 배송 일정, 배송비, 할인 조건의 노출 시점을 대조합니다. 안내 불일치가 확인되면 수정안을 확정합니다.',
 payment:'선택한 기기에서 결제를 재현하고 결제수단별 실패 내역을 확인합니다. 오류가 확인되면 해당 기능의 수정 요청을 작성합니다.',
 audience:'캠페인 타기팅, 게재위치, 소재 변경과 구매 의도 차이를 확인합니다. 현재 표본에는 고객 구성 변화 자료가 없습니다.',
 tracking:'결제 성공 원장과 구매 이벤트, 귀속 설정과 전환 지연을 대조합니다. 현재 표본의 대사 일치는 실제 사이트의 계측 정상 여부를 입증하지 않습니다.',
} as const;
export function hypothesisCheck(value:Investigation){
 if(value.hypothesis!=='none')return hypothesisChecks[value.hypothesis];
 return ({all:'조사할 문제를 먼저 선택하세요.',cost:'노출단가와 클릭 반응을 나눠 확인한 뒤 입찰 설정, 경매 환경과 게재위치 변경 자료를 요청하세요.',checkout:'어느 기기와 구매 단계에서 감소했는지 확인하고 결제 실패 로그와 실제 화면을 대조하세요.',revenue:'단가, 주문당 수량과 할인 변화에 맞춰 가격과 프로모션 변경 이력을 대조하세요.',refund:'확정 차감률과 원주문을 확인하고 취소와 환불 사유, 배송과 처리 내역을 요청하세요.'})[value.stage];
}
function candidates(stage:Investigation['stage']):Investigation['hypothesis'][] {
 return stage==='cost'?['none','audience','tracking']:stage==='revenue'?['none','guidance','audience','tracking']:['none','guidance','payment','audience','tracking'];
}
const percent=(value:number|null)=>value===null?'미확인':`${(value*100).toFixed(1)}%`;
type Report=Parameters<typeof feedbackComparison>[1]&{records:Raw[];purchaseTiming?:string};
type Change=(patch:Partial<Investigation>)=>void;

export function InvestigationSummary({value,onChange,error}:{value:Investigation;onChange:Change;error?:string}){
 return <section className="roas-investigation-summary" aria-label="현재 조사 중인 문제"><div><h3>현재 조사</h3><strong>{error?'저장된 조사 구간 확인 필요':investigationScope(value)}</strong><span>{error?'원문 보존 중':investigationLabels.hypothesis[value.hypothesis]}</span></div>
  {!error&&<details><summary>조사 범위와 판단 편집</summary><div className="roas-investigation-fields">
   {(['channel','device','stage'] as const).map(key=><label key={key}>{({channel:'조사 매체',device:'조사 기기',stage:'조사할 문제'})[key]}<select aria-label={({'channel':'조사 매체','device':'조사 기기','stage':'조사할 문제'})[key]} value={value[key]} onChange={event=>onChange({[key]:event.target.value})}>{Object.entries(investigationLabels[key]).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>)}
   <label className="roas-wide-field">판단 근거<input aria-label="조사 판단 근거" maxLength={1000} value={value.rationale} placeholder="확인한 수치와 이 후보를 조사할 이유" onChange={event=>onChange({rationale:event.target.value})}/></label>
   <label className="roas-wide-field">다음 확인과 적용 조건<input aria-label="조사 다음 확인과 적용 조건" maxLength={1000} value={value.condition} placeholder="무엇을 확인한 뒤 어떤 행동을 할지" onChange={event=>onChange({condition:event.target.value})}/></label>
  </div><p className="roas-form-help">범위나 후보를 바꾸면 이전 판단을 메모에 보존하고 새 판단을 작성합니다. 검토안을 저장하면 조사 내용도 함께 복원됩니다.</p></details>}{error&&<p role="alert">{error}</p>}
 </section>;
}

export function DeviceInvestigation({report,value,onChange,onNext,onSources}:{report:Report;value:Investigation;onChange:Change;onNext:()=>void;onSources:(device:'mobile'|'desktop')=>void}){
 const delayed=report.purchaseTiming==='within_window';
 const devices=deviceFunnels(report.records,report,value.channel).filter(row=>value.device==='all'||row.device===value.device);
 const steps=[['paidSessions','유료 방문'],['view_item','상품 조회'],['add_to_cart','장바구니'],['begin_checkout','결제 시작'],['purchase','같은 세션 구매']] as const;
 return <section className="roas-card"><div className="roas-card-heading"><h3>기기별로 어느 단계에서 줄었나요?</h3><span className="roas-tag">{investigationLabels.channel[value.channel]}</span></div>
  <div className="roas-segment" aria-label="구매 흐름 기기 선택">{(['all','mobile','desktop'] as const).map(device=><button key={device} aria-pressed={value.device===device} onClick={()=>onChange({device})}>{investigationLabels.device[device]}</button>)}</div>
  <div className="wb-table-scroll"><table className="roas-comparison-table"><thead><tr><th>기기</th><th>구매 단계</th><th className="numeric">비교 전</th><th className="numeric">비교 후</th><th className="numeric">증감</th><th className="numeric">단계 전환율, 전</th><th className="numeric">단계 전환율, 후</th></tr></thead><tbody>{devices.flatMap(row=>steps.map(([key,label],i)=>{const previous=steps[Math.max(i-1,0)][0];return <tr key={row.device+key}><td>{i===0?investigationLabels.device[row.device]:''}</td><td>{label}</td><td className="numeric">{row.before[key]}건</td><td className="numeric">{row.after[key]}건</td><td className="numeric">{row.after[key]-row.before[key]}건</td><td className="numeric">{i?percent(row.before[previous]?row.before[key]/row.before[previous]:null):'—'}</td><td className="numeric">{i?percent(row.after[previous]?row.after[key]/row.after[previous]:null):'—'}</td></tr>;}))}</tbody></table></div>
  <p className="roas-form-help">전환율과 감소 건수를 함께 보세요. 각 전환율의 분모는 직전 단계이며 첫 유료 세션 안의 구매 흐름입니다. {delayed?'다른 날이나 기기로 돌아온 구매는 아래에 별도로 표시합니다. 매체 매출과 기기별 귀속은 최초 유료 방문 기준이며 실제 구매 기기 기준과 다릅니다.':'기본 사례는 당일 같은 세션의 구매만 포함합니다.'}</p>
  {delayed&&<div className="roas-return-summary">{devices.map(row=><p key={row.device}><b>{investigationLabels.device[row.device]} 유입 뒤 후속 직접 재방문 구매</b>: 비교 전 {row.before.returnPurchases??'미확인'}건, 비교 후 {row.after.returnPurchases??'미확인'}건. 첫 세션의 완료율 분자에는 더하지 않습니다.</p>)}</div>}
  <div className="roas-evidence-devices">{devices.map(row=><button key={row.device} onClick={()=>onSources(row.device)}>{investigationLabels.device[row.device]} 구매 흐름 근거</button>)}</div>
  <button className="roas-next-link" onClick={onNext}>이 범위의 설명 후보 비교</button>
 </section>;
}

export function HypothesisInvestigation({report,value,onChange,onNext,onSources}:{report:Report;value:Investigation;onChange:Change;onNext:()=>void;onSources:(title:string,ids:string[])=>void}){
 const comparisons=feedbackComparison(report.records,report);
 return <><section className="roas-card"><div className="roas-card-heading"><h3>선택한 문제의 설명과 추가 확인</h3><span className="roas-tag">원인 확정 아님</span></div><p className="roas-form-help">{investigationScope(value)}. {hypothesisCheck({...value,hypothesis:'none'})}</p>
 <div className="roas-hypothesis-options">{candidates(value.stage).map(key=><article key={key}><label><input type="radio" name="roas-hypothesis" checked={value.hypothesis===key} onChange={()=>onChange({hypothesis:key})}/><b>{investigationLabels.hypothesis[key]}</b></label><p>{key==='none'?'현재 자료만으로 원인을 구분하지 못하면 필요한 자료와 확인 계획을 남깁니다.':key==='guidance'?'제품 의견은 참고 자료입니다. 현재 범위의 이탈이나 환불 원인, 실제 안내 불일치는 미확인입니다.':key==='payment'?'결제 오류와 실패 사유 로그가 없어 이 후보를 확정하거나 기각할 수 없습니다.':key==='audience'?'타기팅, 게재위치와 고객 구성의 변화 자료가 없습니다.':'표본의 원장은 일치하지만 실제 계측 변경과 전환 지연 여부는 미확인입니다.'}</p><small>{hypothesisCheck({...value,hypothesis:key})}</small></article>)}</div>
 <button className="roas-next-link" onClick={onNext}>판단 근거와 다음 행동 작성</button></section>
 {value.stage!=='cost'&&<details className="roas-card roas-reference"><summary>제품 공통 의견 참고, 매체별 원인으로 귀속하지 않음</summary><div className="wb-table-scroll"><table className="roas-comparison-table"><thead><tr><th>의견 주제</th><th className="numeric">비교 전</th><th className="numeric">비교 후</th><th className="numeric">비교 후 주문 연결</th><th>원문</th></tr></thead><tbody>{comparisons.map(row=><tr key={row.topic}><td>{row.label}</td><td className="numeric">{row.before.count} / {row.before.total}건</td><td className="numeric">{row.after.count} / {row.after.total}건</td><td className="numeric">{row.after.orderLinked}건</td><td><button onClick={()=>onSources(row.label,[...row.before.recordIds,...row.after.recordIds])}>근거 보기</button></td></tr>)}</tbody></table></div><p className="roas-form-help">주제는 중복됩니다. 구매 포기자의 이탈 이유를 관측한 자료가 아니며 매체와 기기별로 귀속할 수 없습니다. {report.purchaseTiming==='within_window'?'여러 주제의 조합형 문구로 생성된 가상 의견이며 실제 고객의 표현을 관측한 자료가 아닙니다.':'56건이 문구 8개의 반복으로 생성된 시연 자료입니다.'} 언급 비중을 실제 고객 추정치로 쓸 수 없습니다.</p></details>}</>;
}

export function evidenceHeadline(row:Raw){
 const date=roasEvidenceTime(row);
 const kind:Record<string,string>={T01:'제품',T12:'캠페인',T16:'광고 소재',T13:'매체 성과',T14:'기기별 광고 성과',T17:'방문',T18:'구매 행동',T19:'주문',T20:'취소와 환불',T24:'리뷰',T26:'문의'};
 const events:Record<string,string>={page_view:'페이지 방문',view_item:'상품 조회',add_to_cart:'장바구니',begin_checkout:'결제 시작',purchase:'구매 완료',refund:'환불'};
 const status:Record<string,string>={completed:'확정',pending:'대기',paid:'결제 완료',refunded:'전액 환불',partially_refunded:'부분 환불'};
 const amount=(row.refund_amount||row.line_gross_total||(row.metrics as Raw|undefined)?.spend) as Raw|undefined;
 const summary=String(row.body_text||row.message_text||events[String(row.event_name)]||status[String(row.status||row.financial_status)]||'성과 집계');
 return {date,kind:kind[String(row.dataset_type)]||'참고 자료',summary,amount:amount?Number(amount.amount).toLocaleString('ko-KR')+' '+String(amount.currency):''};
}
export function EvidenceFacts({row,records}:{row:Raw;records:Raw[]}){
 const visit=records.find(item=>item.record_id===row.acquisition_ref);
 const campaign=String(row.campaign_ref||row.utm_campaign||visit?.utm_campaign||'');
 const fact=evidenceHeadline(row);
 return <dl className="roas-evidence-facts"><dt>원천 ID</dt><dd>{String(row.record_id)}</dd><dt>시점</dt><dd>{fact.date||'미확인'}</dd><dt>매체</dt><dd>{campaign.endsWith('social')?'소셜':campaign.endsWith('search')?'검색':'공통 또는 미확인'}</dd><dt>원천 기기</dt><dd>{String(row.device||visit?.device||'미확인')}</dd><dt>상태와 행동</dt><dd>{fact.summary}</dd>{fact.amount&&<><dt>원천 금액</dt><dd>{fact.amount}{row.line_gross_total?' (원천 주문 합계, 환불 반영 상품 매출과 다름)':''}</dd></>}<dt>직접 연결</dt><dd>{((row.related_record_ids as string[]|undefined)||[]).join(', ')||'미연결'}</dd></dl>;
}
