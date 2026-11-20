// 운영 기록을 분석 기간 추이 그래프의 표시로 바꾼다. 원천 기록은 바꾸지 않는다.
import {selectRecords} from '../../shared/roas/training-dashboard.mjs';
import type {DetailRecord,Filters,TrainingData} from '../../shared/roas/training-dashboard.mjs';
import {groupRelatedRecords,recordHeadline} from './operational-records-model.ts';

export type ChartEvent={
 id:string;
 /** 분석 기간 첫날을 1로 두는 일차. 그래프의 가로축 값과 같다. */
 day:number;
 /** 기간형 기록(장애, 품절)의 마지막 일차. 단일 시점 기록은 day와 같다. */
 endDay:number;
 date:string;
 label:string;
 category:string;
 records:DetailRecord[];
};

const dayMs=86400000;
const dateOnly=(value:string)=>value.slice(0,10);
const dayIndex=(start:string,date:string)=>Math.round((Date.parse(dateOnly(date)+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/dayMs)+1;

/** 종료 시각이 자정이면 그 날은 영향 기간에 넣지 않는다. */
function lastAffectedDate(end:string){
 if(!end.includes('T')||end.slice(11,16)!=='00:00')return dateOnly(end);
 return new Date(Date.parse(dateOnly(end)+'T00:00:00Z')-dayMs).toISOString().slice(0,10);
}

export function chartEvents(data:TrainingData,filters:Filters):ChartEvent[]{
 const current=data.periods.find(period=>period.id==='current');
 if(!current)return [];
 const length=dayIndex(current.start,current.end)-1;
 const groups=new Map<string,ChartEvent>();
 for(const record of selectRecords(data,filters)){
  const start=typeof record.values['시작']==='string'?String(record.values['시작']):record.date;
  const end=typeof record.values['종료']==='string'?lastAffectedDate(String(record.values['종료'])):dateOnly(start);
  const day=dayIndex(current.start,start),endDay=Math.max(day,dayIndex(current.start,end));
  // 분석 기간과 겹치는 기록만 표시한다. 직전 기간의 기록은 점선과 섞이므로 제외한다.
  if(endDay<1||day>length)continue;
  const ranged=endDay>day;
  const key=ranged?record.id:'day:'+day;
  const clipped={day:Math.max(1,day),endDay:Math.min(length,endDay)};
  const existing=groups.get(key);
  if(existing){existing.records.push(record);continue;}
  groups.set(key,{id:key,...clipped,date:dateOnly(start),label:'',category:record.category,records:[record]});
 }
 return [...groups.values()].sort((a,b)=>a.day-b.day||a.endDay-b.endDay).map(event=>{
  // 운영 기록 화면과 같은 묶음 제목을 써서 같은 날의 관련 변경을 한 이름으로 보여 준다.
  const headlines=[...new Set(groupRelatedRecords(event.records,data.caseId).map(activity=>activity.title||recordHeadline(activity.records[0],data)))];
  const shown=headlines.slice(0,2).join(' · ');
  return {...event,label:headlines.length>2?`${shown} 외 ${headlines.length-2}건`:shown};
 });
}

export function eventDateText(event:ChartEvent,data:TrainingData){
 const current=data.periods.find(period=>period.id==='current');
 if(!current)return event.date;
 const text=(day:number)=>new Date(Date.parse(current.start+'T00:00:00Z')+(day-1)*dayMs).toISOString().slice(5,10).replace('-','/');
 return event.endDay>event.day?`${text(event.day)}~${text(event.endDay)}`:text(event.day);
}
