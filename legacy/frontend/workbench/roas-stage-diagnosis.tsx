'use client';
import {stageDiagnosis,type StagePeriodDiagnosis} from '../../shared/roas-diagnosis.mjs';
import type {Investigation} from './roas-investigation-note';
import type {Raw} from './contract';

type Stage='cost'|'revenue'|'refund';
const questions={cost:'노출과 클릭의 어느 변화가 클릭 비용 상승과 함께 나타났나요?',revenue:'구매당 상품금액의 변화가 수량, 단가, 할인 중 어디에 나타났나요?',refund:'원주문의 취소와 환불 차감액, 차감률이 어떻게 변했나요?'};
const missing={cost:'경매 경쟁, 타기팅과 게재위치 변경, 소재별 반응과 변경 이력이 필요합니다. CPM과 CTR 변화만으로 원인을 확정할 수 없습니다.',revenue:'상품 구성, 가격과 할인 정책 변경, 고객 구성 자료가 필요합니다. 선택 표본의 수량 가중 단가와 할인 구성은 관찰값이며 운영 정책 변경 이유를 뜻하지 않습니다.',refund:'실제 취소와 환불 사유, 배송과 반품 경험, 동일 경과일 기준의 성숙한 주문 비교가 필요합니다. 현재 사유는 가상 처리 예제입니다.'};
const rows:{[K in Stage]:{key:keyof StagePeriodDiagnosis[K];label:string;rate?:boolean;unit?:string}[]}={
 cost:[{key:'impressions',label:'노출',unit:'회'},{key:'clicks',label:'클릭',unit:'회'},{key:'spend',label:'광고비',unit:'원'},{key:'ctr',label:'클릭률, CTR',rate:true},{key:'cpm',label:'1,000회 노출당 비용, CPM',unit:'원'},{key:'cpc',label:'클릭당 비용, CPC',unit:'원'}],
 revenue:[{key:'orders',label:'주문',unit:'건'},{key:'units',label:'구매 수량',unit:'개'},{key:'unitPrice',label:'수량 가중 정가 단가',unit:'원'},{key:'discountPerOrder',label:'주문당 할인',unit:'원'},{key:'revenuePerOrder',label:'주문당 상품금액, 조정 전',unit:'원'}],
 refund:[{key:'revenueBeforeAdjustments',label:'조정 전 상품금액',unit:'원'},{key:'adjustments',label:'확정 취소와 환불 차감액',unit:'원'},{key:'adjustmentRate',label:'상품금액 대비 차감률',rate:true}],
};
const format=(value:number|null,rate=false,unit='')=>value===null?'미확인':`${(rate?value*100:value).toLocaleString('ko-KR',{maximumFractionDigits:rate?2:1})}${rate?'%':unit}`;
export function StageDiagnosis({report,value,onSources}:{report:Parameters<typeof stageDiagnosis>[1]&{records:Raw[]};value:Investigation;onSources:(title:string,ids:string[])=>void}){
 if(!['cost','revenue','refund'].includes(value.stage))return null;
 const stage=value.stage as Stage, diagnosis=stageDiagnosis(report.records,report,value.channel,value.device);
 const before=diagnosis.before[stage],after=diagnosis.after[stage];
 const errors=[...new Set([...diagnosis.before.unavailable,...diagnosis.after.unavailable])];
 const headline=stage==='cost'?['cpc','클릭당 비용']:stage==='revenue'?['revenuePerOrder','주문당 상품금액']:['adjustmentRate','차감률'];
 const a=before[headline[0] as keyof typeof before] as number|null,b=after[headline[0] as keyof typeof after] as number|null;
 return <section className="roas-card" aria-label="선택한 문제의 수치 분해"><h3>{questions[stage]}</h3>
  <p>{headline[1]}: {format(a,stage==='refund',stage==='refund'?'':'원')} → {format(b,stage==='refund',stage==='refund'?'':'원')}. 이 변화는 관찰값이며 원인 확정이 아닙니다.</p>
  <div className="wb-table-scroll"><table><thead><tr><th>지표</th><th style={{textAlign:'right'}}>비교 전</th><th style={{textAlign:'right'}}>비교 후</th><th style={{textAlign:'right'}}>차이</th></tr></thead><tbody>{rows[stage].map(row=>{
   const prior=before[row.key as keyof typeof before] as number|null,current=after[row.key as keyof typeof after] as number|null;
   return <tr key={row.key}><td>{row.label}</td><td style={{textAlign:'right'}}>{format(prior,row.rate,row.unit)}</td><td style={{textAlign:'right'}}>{format(current,row.rate,row.unit)}</td><td style={{textAlign:'right'}}>{prior===null||current===null?'미확인':`${current-prior>0?'+':''}${row.rate?`${((current-prior)*100).toFixed(2)}%p`:format(current-prior,false,row.unit)}`}</td></tr>;
  })}</tbody></table></div><button onClick={()=>onSources(questions[stage],[...new Set([...diagnosis.before.evidenceIds[stage],...diagnosis.after.evidenceIds[stage]])])}>선택 범위 원천 근거</button>
  {errors.map(error=><p key={error} role="status">{error}</p>)}<p className="roas-form-help">구분에 필요한 자료: {missing[stage]}</p>{diagnosis.limitations.map(text=><p key={text} className="roas-form-help">{text}</p>)}
 </section>;
}
