import {stageDiagnosis} from './roas-diagnosis.mjs';

// Daily device values use the same paid-touch order cohort and cutoff as the KPI cards.
export function dashboardSeries(records, report, channel='all', device='all') {
 const byId=new Map(records.map(row=>[row.record_id,row]));
 const selected=['search','social'].filter(id=>channel==='all'||id===channel);
 return [...new Set(report.daily.map(row=>row.date))].sort().map(date=>{
  const point={date};
  for(const id of selected){
   const day=report.daily.find(row=>row.date===date&&row.channel===id);
   if(device==='all'){point[id]=day?.netRoas===null||!day?null:day.netRoas*100;continue;}
   const period=report.periods.find(({period})=>date>=period.start&&date<period.end);
   const end=new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10);
   const channels=(period?.channels||[]).filter(row=>row.channel===id).map(row=>({...row,evidence:{...row.evidence,
    adRecordIds:row.evidence.adRecordIds.filter(ref=>ref===day?.recordId),
    orderRecordIds:row.evidence.orderRecordIds.filter(ref=>String(byId.get(byId.get(ref)?.acquisition_ref)?.event_time||'').startsWith(date)),
   }}));
   const dailyPeriod={period:{start:date,end},channels};
   const value=stageDiagnosis(records,{...report,periods:[dailyPeriod,dailyPeriod]},id,device).before;
   const {revenueBeforeAdjustments:gross,adjustments:loss}=value.refund;
   point[id]=gross===null||loss===null||!value.cost.spend?null:(gross-loss)/value.cost.spend*100;
  }
  return point;
 });
}
