import {selectRecords} from '../../shared/roas/training-dashboard.mjs';
import type {DetailRecord,Filters,TrainingData} from '../../shared/roas/training-dashboard.mjs';

// These are views of existing records, never inferred explanations of performance.
const dayMs=86400000;
const addDays=(date:string,days:number)=>new Date(Date.parse(date)+days*dayMs).toISOString().slice(0,10);
// A record's 시작/종료 values describe how long it lasted. 종료 at midnight is exclusive.
function lastDate(end:string){return /T00:00(:00)?/.test(end)?addDays(end.slice(0,10),-1):end.slice(0,10);}

export function trainingEvents(data:TrainingData,filters:Filters){
 const period=data.periods.find(item=>item.id==='current');
 if(!period)return [];
 const days=new Map<string,DetailRecord[]>();
 for(const record of selectRecords(data,filters)){
  if(record.date<period.start||record.date>=period.end||record.date>data.asOf.slice(0,10))continue;
  const records=days.get(record.date)||[];
  records.push(record);
  days.set(record.date,records);
 }
 const periodLast=addDays(period.end,-1),reportLast=lastDate(data.asOf);
 const toDay=(date:string)=>Math.round((Date.parse(date)-Date.parse(period.start))/dayMs)+1;
 return [...days].sort(([a],[b])=>a.localeCompare(b)).map(([date,records],index)=>{
  const spans=records.flatMap(record=>{
   const values=(record.values||{}) as Record<string,unknown>,start=values['시작'],end=values['종료'];
   if(typeof start!=='string'||typeof end!=='string')return [];
   const first=start.slice(0,10)<period.start?period.start:start.slice(0,10);
   const last=[lastDate(end),periodLast,reportLast].sort()[0];
   if(last<first)return [];
   return [{recordId:record.id,start:first,end:last,startDay:toDay(first),endDay:toDay(last)}];
  });
  return {date,records,number:index+1,day:toDay(date),spans};
 });
}
