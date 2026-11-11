import {campaignDisplayName,displayTrainingText} from '../../shared/roas/training-dashboard.mjs';
import type {DetailRecord,TrainingData} from '../../shared/roas/training-dashboard.mjs';

export const recordCategories:Record<string,string>={
 campaign:'캠페인 설정',change:'운영 변경',creative:'소재 변경',incident:'장애와 점검',
 inventory:'상품과 재고',landing:'랜딩 페이지',tracking:'계측 설정',
};

const asText=(value:unknown)=>value===null||value===undefined?'':String(value);
const dateText=(value:string)=>value.slice(0,10).replaceAll('-','.');
const dateTimeText=(value:string)=>dateText(value)+(value.includes('T')?' '+value.slice(11,16):'');
const money=(value:number)=>value.toLocaleString('ko-KR')+'원';

export function recordSubject(record:DetailRecord,data:TrainingData){
 if(record.productId){
  if(record.productId==='EDU-P1')return '쓱쓱샴푸';
  return data.products.find(item=>item.id===record.productId)?.label||record.productId;
 }
 if(record.campaignId)return campaignDisplayName(data,record.campaignId);
 return record.device==='mobile'?'모바일 공통':'공통';
}

export function recordFieldValue(key:string,value:string|number|boolean,item=''){
 if(typeof value==='boolean')return value?'가능':'불가';
 if(typeof value==='number'){
  if(key==='할인율'||item==='할인율'||key==='목표ROAS')return value.toLocaleString('ko-KR')+'%';
  if(['일예산','정가','배송비'].includes(key)||item.includes('예산'))return money(value);
  if(key==='재고수량')return value.toLocaleString('ko-KR')+'개';
  if(key==='일판매가능시간')return value.toLocaleString('ko-KR')+'시간';
  return value.toLocaleString('ko-KR');
 }
 return displayTrainingText(value.replace(/일예산\s+(\d{4,})/g,(_,amount:string)=>'일예산 '+money(Number(amount))));
}

export function recordHeadline(record:DetailRecord,data:TrainingData){
 const subject=recordSubject(record,data),values=record.values;
 if(record.category==='change'&&values['항목']==='할인율'){
  return typeof values['변경전']==='number'&&values['변경전']>0&&values['변경후']===0
   ?subject+' 할인 종료':subject+' 할인율 변경';
 }
 if(record.category==='change'&&record.campaignId){
  if(asText(values['변경전']).includes('일예산')&&asText(values['변경후']).includes('확장'))
   return subject+' 예산 및 타깃 변경';
  return subject+' '+(asText(values['항목'])||'운영 조건')+' 변경';
 }
 if(record.category==='creative'&&values['집행시작'])return subject+' 소재 '+asText(values['소재버전']||'')+' 집행 시작';
 if(record.category==='incident'&&values['오류코드']&&values['오류코드']!=='없음')
  return values['결제수단']?asText(values['결제수단'])+' 처리 오류 기록':subject+' 장애 기록';
 if(record.category==='inventory'&&values['구매가능']===false)return subject+' 구매 불가 기록';
 return displayTrainingText(record.title).replace(/교육용 자사 상품 1/g,'쓱쓱샴푸');
}

export type RecordPreview=
 |{kind:'change';label:string;before:string;after:string}
 |{kind:'info';text:string;secondary?:string};

export function recordPreview(record:DetailRecord):RecordPreview{
 const v=record.values,item=asText(v['항목']);
 if(v['변경전']!==undefined&&v['변경후']!==undefined){
  return {kind:'change',label:item||'변경 내용',
   before:recordFieldValue('변경전',v['변경전'],item),
   after:recordFieldValue('변경후',v['변경후'],item)};
 }
 if(record.category==='incident'&&v['오류코드']&&v['오류코드']!=='없음'){
  const period=v['시작']?'시작 '+dateTimeText(asText(v['시작']))+(v['종료']?' / 종료 '+dateTimeText(asText(v['종료'])):''):'';
  return {kind:'info',text:'오류 코드 '+asText(v['오류코드']),secondary:period};
 }
 if(record.category==='creative'&&v['소재버전']){
  return {kind:'info',text:'소재 '+asText(v['소재버전'])+' 집행'+(v['집행시작']?' · '+dateText(asText(v['집행시작'])):''),
   secondary:v['문구']?asText(v['문구']):undefined};
 }
 if(record.category==='inventory'){
  const parts=[v['구매가능']===undefined?'':v['구매가능']?'구매 가능':'구매 불가',
   typeof v['재고수량']==='number'?'재고 '+recordFieldValue('재고수량',v['재고수량']):''].filter(Boolean);
  return {kind:'info',text:parts.join(' · ')||'상품 상태 기록'};
 }
 if(record.category==='campaign'){
  const parts=[typeof v['일예산']==='number'?'일예산 '+recordFieldValue('일예산',v['일예산']):'',
   typeof v['목표ROAS']==='number'?'목표 ROAS '+recordFieldValue('목표ROAS',v['목표ROAS']):''].filter(Boolean);
  if(parts.length)return {kind:'info',text:parts.join(' · ')};
 }
 const fields=Object.entries(v).filter(([key])=>!['항목','적용시각','시작','종료','점검시각'].includes(key)).slice(0,2);
 return {kind:'info',text:fields.map(([key,value])=>key+' '+recordFieldValue(key,value)).join(' · ')||'운영 기록'};
}

export function groupRecordsByDate(records:DetailRecord[]){
 const groups:{date:string;records:DetailRecord[]}[]=[];
 for(const record of records){
  if(groups.at(-1)?.date!==record.date)groups.push({date:record.date,records:[]});
  groups[groups.length-1].records.push(record);
 }
 return groups;
}

export type TimelineActivity={key:string;records:DetailRecord[];title?:string;summary?:string};

/** Presentation-only grouping. The underlying record IDs and values remain unchanged. */
export function groupRelatedRecords(records:DetailRecord[],caseId:string):TimelineActivity[]{
 if(caseId!=='S16')return records.map(record=>({key:record.id,records:[record]}));
 const result:TimelineActivity[]=[];
 const grouped=new Map<string,DetailRecord[]>();
 for(const record of records){
  const v=record.values;
  const promotion=record.date==='2026-08-17'&&record.category==='change'&&Boolean(record.productId)&&
   v['항목']==='할인율'&&v['변경전']===20&&v['변경후']===0;
  const acquisition=record.date==='2026-08-17'&&record.category==='change'&&Boolean(record.campaignId)&&
   String(v['변경전']||'').includes('일예산 240000')&&String(v['변경후']||'').includes('일예산 420000')&&
   String(v['변경후']||'').includes('확장');
  const key=promotion?'s16-discount':acquisition?'s16-audience':record.id;
  if(!grouped.has(key))grouped.set(key,[]);
  grouped.get(key)!.push(record);
 }
 for(const [key,items] of grouped){
  if(items.length<2){result.push({key:items[0].id,records:items});continue;}
  const isDiscount=key==='s16-discount';
  result.push({
   key,records:items,
   title:isDiscount?'상품 할인 동시 종료':'광고 유입 확대 설정',
   summary:isDiscount?'할인율 20% → 0%':'일예산 240,000원 → 420,000원, 타깃 범위 확대',
  });
 }
 return result;
}
