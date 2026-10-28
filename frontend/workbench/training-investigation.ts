import {displayTrainingText,selectRecords} from '../../shared/training-dashboard.mjs';
import type {DetailRecord,Filters,TrainingData} from '../../shared/training-dashboard.mjs';

export function changeRecordValue(value:string|number|boolean){
 if(typeof value==='number')return value.toLocaleString('ko-KR');
 if(typeof value==='boolean')return value?'예':'아니요';
 if(/^\d{4}-\d{2}-\d{2}T/.test(value)&&Number.isFinite(Date.parse(value)))return new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
 return displayTrainingText(value);
}

export function metricChangeRecords(data:TrainingData,filters:Filters,metric:string){
 const period=data.periods.find(row=>row.id==='current')!;
 const categories:Record<string,string[]>={adCtr:['change','creative'],cpc:['change','creative'],aov:['change','inventory'],cac:['tracking']};
 const allowed=categories[metric]||['change','creative','incident','inventory','landing','tracking'];
 return selectRecords(data,filters).filter(row=>{
  if(!allowed.includes(row.category)||(['adCtr','cpc'].includes(metric)&&row.productId))return false;
  const end=typeof row.values.종료==='string'?row.values.종료.slice(0,10):row.date;
  return row.date<period.end&&(row.date>=period.start||end>=period.start);
 }).toSorted((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
}

export function recordReadingHint(row:DetailRecord){
 if(row.category==='change')return row.productId?'판매 조건이 바뀐 전후의 상품별 AOV와 구매율을 비교하세요.':'해당 캠페인의 집행비 비중, 클릭 단가와 구매율이 변경 전후에 달라졌는지 비교하세요.';
 return ({creative:'해당 소재의 클릭률과 구매율을 변경 전후로 비교하세요.',incident:'기록된 기기와 기간에서 구매율, 이탈률과 오류 지표가 함께 달라졌는지 확인하세요.',inventory:'구매 가능 시간과 상품별 주문 수, 매출 구성의 변화를 확인하세요.',landing:'페이지 변경 전후의 이탈률과 구매율을 비교하세요.',tracking:'수집된 구매 수와 주문 원장 수치가 같은 기준인지 확인하세요.'} as Record<string,string>)[row.category]||'변경일 전후의 지표와 적용 대상을 함께 확인하세요.';
}
