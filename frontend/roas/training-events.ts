import {selectRecords} from '../../shared/roas/training-dashboard.mjs';
import type {DetailRecord,Filters,TrainingData} from '../../shared/roas/training-dashboard.mjs';

// These are views of existing records, never inferred explanations of performance.
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
 return [...days].sort(([a],[b])=>a.localeCompare(b)).map(([date,records],index)=>({
  date,records,number:index+1,day:Math.round((Date.parse(date)-Date.parse(period.start))/86400000)+1,
 }));
}
