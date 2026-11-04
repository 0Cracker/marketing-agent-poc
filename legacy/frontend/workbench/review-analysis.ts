// Read-only view model. This is not a persisted classification or API contract.
export type ReviewPeriod={id:'baseline'|'current';start:string;end:string};
export type ReviewPeriodChoice='baseline'|'current'|'both';
export type ReviewSortField='writtenAt'|'sourceName'|'rating';
export type ReviewSort={field:ReviewSortField;direction:'asc'|'desc'};
export type ReviewCategory={id:string;label:string};
export type ReviewAssignment={categoryId:string;experienceId:string;sentiment:'positive'|'negative'|'neutral'|'mixed';evidenceQuote:string};
export const reviewCategoryLabels:Record<string,string>={scent:'향',cleansing_feel:'세정 및 사용감',container_packaging:'용기와 포장',volume_usage:'용량 및 사용량',delivery:'배송'};
export const reviewExperienceLabels:Record<string,string>={scent_preference:'향 취향',scent_intensity:'향 강도',scent_longevity:'향 지속',foam:'거품 생성 및 유지력',residue:'잔여감',after_feel:'세정 후 감촉',tangling:'모발 엉킴',texture_application:'제형 및 도포',pump_operation:'펌프 작동',leakage_residue:'누액 및 잔액',container_usability:'용기 편의성',product_packaging:'제품 포장',volume_label:'용량 표기',consumption_rate:'소진 속도',usage_guidance:'사용량 안내',remaining_check:'잔량 확인',delivery_timing:'배송 시점',delivery_condition:'배송 상태'};
export const reviewExperienceCategoryIds:Record<string,string>={scent_preference:'scent',scent_intensity:'scent',scent_longevity:'scent',foam:'cleansing_feel',residue:'cleansing_feel',after_feel:'cleansing_feel',tangling:'cleansing_feel',texture_application:'cleansing_feel',pump_operation:'container_packaging',leakage_residue:'container_packaging',container_usability:'container_packaging',product_packaging:'container_packaging',volume_label:'volume_usage',consumption_rate:'volume_usage',usage_guidance:'volume_usage',remaining_check:'volume_usage',delivery_timing:'delivery',delivery_condition:'delivery'};
export const reviewSentimentLabels={positive:'긍정',negative:'부정',neutral:'중립',mixed:'혼합'};
export type ReviewRecord={
 id:string;caseId:string;productId:string;sourceId:string;sourceName:string;
 writtenAt:string|null;collectedAt:string|null;rating:number|null;text:string|null;
 url?:string|null;categories:ReviewCategory[];assignments?:ReviewAssignment[];classification:'classified'|'unclassified'|'pending'|'error';
};
export type ReviewView={
 caseId:string;status:'ready'|'loading'|'awaiting_source'|'not_provided'|'error'|'partial';
 reviews:ReviewRecord[];productName?:string;message?:string;invalidCount?:number;classificationStatus?:'ready'|'pending'|'error';
};
export type CategoryCount=ReviewCategory&{count:number;percent:number|null};
export const defaultReviewSort:ReviewSort={field:'writtenAt',direction:'desc'};
export const categorySortOptions=['many','few','name'] as const;
export type CategorySort=(typeof categorySortOptions)[number];
const collator=new Intl.Collator('ko-KR');
const dateTime=(value:string|null|undefined)=>value?Date.parse(value):NaN;
const dayStart=(value:string)=>Date.parse(value+'T00:00:00+09:00');

export function isReviewInPeriod(writtenAt:string|null,period:ReviewPeriod){
 const time=dateTime(writtenAt),start=dayStart(period.start),end=dayStart(period.end);
 return Number.isFinite(time)&&Number.isFinite(start)&&Number.isFinite(end)&&time>=start&&time<end;
}
export function eligibleReviewRows(rows:ReviewRecord[],caseId:string,asOf:string,periods:ReviewPeriod[],choice:ReviewPeriodChoice,sources:ReadonlySet<string>){
 const reportingAt=Date.parse(asOf),allowed=periods.filter(p=>choice==='both'||p.id===choice);
 if(!Number.isFinite(reportingAt)||!allowed.length)return [];
 const ids=new Set<string>();
 return rows.filter(row=>{
  if(row.caseId!==caseId||row.productId!=='EDU-P1'||ids.has(row.id))return false;
  const written=dateTime(row.writtenAt),collected=dateTime(row.collectedAt);
  if(!Number.isFinite(written)||!Number.isFinite(collected)||written>collected||collected>=reportingAt)return false;
  if(sources.size&&!sources.has(row.sourceId))return false;
  if(!allowed.some(p=>isReviewInPeriod(row.writtenAt,p)))return false;
  ids.add(row.id);return true;
 });
}
export function categoryCounts(rows:ReviewRecord[]):CategoryCount[]{
 const map=new Map<string,CategoryCount>(Object.entries(reviewCategoryLabels).map(([id,label])=>[id,{id,label,count:0,percent:null}])),seen=new Map<string,Set<string>>();
 for(const row of rows){
  if(row.classification!=='classified')continue;
  for(const category of row.categories){
   if(!seen.has(category.id))seen.set(category.id,new Set());
   if(seen.get(category.id)!.has(row.id))continue;
   seen.get(category.id)!.add(row.id);
   if(!map.has(category.id))map.set(category.id,{...category,count:0,percent:null});
   map.get(category.id)!.count++;
  }
 }
 return [...map.values()].map(item=>({...item,percent:rows.length?100*item.count/rows.length:null}));
}
export function experienceCounts(rows:ReviewRecord[]){
 const counts=new Map(Object.entries(reviewExperienceLabels).map(([id,label])=>[id,{id,label,categoryId:reviewExperienceCategoryIds[id],count:0}]));
 const seen=new Map<string,Set<string>>();
 for(const row of rows){
  if(row.classification!=='classified')continue;
  for(const item of row.assignments||[]){
   const entry=counts.get(item.experienceId);
   if(!entry)continue;
   if(!seen.has(item.experienceId))seen.set(item.experienceId,new Set());
   if(seen.get(item.experienceId)!.has(row.id))continue;
   seen.get(item.experienceId)!.add(row.id);
   entry.count++;entry.categoryId=item.categoryId;
  }
 }
 const order=Object.keys(reviewCategoryLabels);
 return [...counts.values()].sort((a,b)=>order.indexOf(a.categoryId)-order.indexOf(b.categoryId)||a.label.localeCompare(b.label,'ko-KR'));
}
export function sortCategories(rows:CategoryCount[],sort:CategorySort){
 return [...rows].sort((a,b)=>sort==='name'?collator.compare(a.label,b.label)||collator.compare(a.id,b.id):
  (sort==='few'?a.count-b.count:b.count-a.count)||collator.compare(a.label,b.label)||collator.compare(a.id,b.id));
}
export function reviewSummary(rows:ReviewRecord[]){
 const rated=rows.filter(r=>typeof r.rating==='number'&&Number.isFinite(r.rating)&&r.rating>=1&&r.rating<=5);
 const category=sortCategories(categoryCounts(rows),'many');
 const top=category.filter(c=>c.count>0&&c.count===category[0]?.count);
 return {count:rows.length,average:rated.length?rated.reduce((n,r)=>n+r.rating!,0)/rated.length:null,top};
}
export function filterReviewTable(rows:ReviewRecord[],categoryIds:ReadonlySet<string>,search:string){
 const term=search.trim().toLocaleLowerCase();
 return rows.filter(row=>(!categoryIds.size||[...categoryIds].some(id=>id==='__unclassified__'?row.classification==='unclassified':row.classification==='classified'&&row.categories.some(c=>c.id===id)))&&(!term||(row.text||'').toLocaleLowerCase().includes(term)));
}
export function sortReviewRows(rows:ReviewRecord[],sort:ReviewSort){
 return [...rows].sort((a,b)=>{
  const av=a[sort.field],bv=b[sort.field];
  const missing=(v:unknown)=>v===null||v===undefined||v===''||(typeof v==='number'&&!Number.isFinite(v));
  if(missing(av)!==missing(bv))return missing(av)?1:-1;
  let delta=0;
  if(!missing(av)&&!missing(bv))delta=sort.field==='rating'?(Number(av)-Number(bv)):
   sort.field==='writtenAt'?(dateTime(String(av))-dateTime(String(bv))):collator.compare(String(av),String(bv));
  return (sort.direction==='desc'?-delta:delta)||collator.compare(a.id,b.id);
 });
}
export function highlightParts(text:string,query:string):{text:string;match:boolean}[]{
 const term=query.trim().toLocaleLowerCase();if(!term)return [{text,match:false}];
 const lower=text.toLocaleLowerCase(),parts:{text:string;match:boolean}[]=[];
 let from=0,at=lower.indexOf(term);
 while(at!==-1){if(at>from)parts.push({text:text.slice(from,at),match:false});parts.push({text:text.slice(at,at+term.length),match:true});from=at+term.length;at=lower.indexOf(term,from);}
 if(from<text.length)parts.push({text:text.slice(from),match:false});
 return parts.length?parts:[{text,match:false}];
}
export function reviewPreview(text:string,search:string,maxLength=140){
 const term=search.trim().toLocaleLowerCase(),hit=term?text.toLocaleLowerCase().indexOf(term):-1;
 if(hit<0||hit<maxLength-30)return text;
 const from=Math.max(0,hit-45),to=Math.min(text.length,Math.max(from+maxLength,hit+term.length+45));
 return (from?'…':'')+text.slice(from,to)+(to<text.length?'…':'');
}
export function collectionRange(rows:ReviewRecord[],caseId:string,asOf:string){
 const reportAt=Date.parse(asOf);
 const dates=rows.filter(r=>r.caseId===caseId&&r.productId==='EDU-P1'&&Number.isFinite(dateTime(r.collectedAt))&&dateTime(r.collectedAt)<reportAt&&Number.isFinite(dateTime(r.writtenAt))&&dateTime(r.writtenAt)<=dateTime(r.collectedAt))
  .map(r=>r.collectedAt!.slice(0,10)).sort();
 return dates.length?{first:dates[0],last:dates[dates.length-1]}:null;
}

// A boundary for a future approved loader, not a new file/schema declaration.
export function readApprovedReviewRows(input:unknown,caseId:string):ReviewView {
 if(!input||typeof input!=='object')return {caseId,status:'error',reviews:[],message:'리뷰 원문 형식을 확인할 수 없습니다.'};
 const bundle=input as Record<string,unknown>;
 if(bundle.contract!=='roas-reviews/1'||bundle.subjectCategory!=='shampoo'||!Array.isArray(bundle.coverage)||!Array.isArray(bundle.reviews))
  return {caseId,status:'error',reviews:[],message:'승인된 원문 계약과 일치하지 않습니다.'};
 const required=[['S16','own_store'],['S16','virtual_external_1'],['S17','own_store'],['S17','virtual_external_1']];
 const coverage=bundle.coverage as Record<string,unknown>[];
 if(coverage.length!==4||required.some(([c,s])=>coverage.filter(x=>x.caseId===c&&x.productId==='EDU-P1'&&x.sourceId===s&&Array.isArray(x.periodIds)&&x.periodIds.length===2&&new Set(x.periodIds).size===2&&x.periodIds.includes('baseline')&&x.periodIds.includes('current')).length!==1))
  return {caseId,status:'error',reviews:[],message:'리뷰 제공 선언의 무결성을 확인할 수 없습니다.'};
 if(!/^S(0[1-9]|1[0-8])$/.test(caseId))return {caseId,status:'error',reviews:[],message:'등록되지 않은 사례입니다.'};
 const all=bundle.reviews as Record<string,unknown>[],ids=new Set<string>(),reviews:ReviewRecord[]=[];
 const counts=new Map<string,number>();
 const fields=['id','caseId','productId','sourceId','sourceName','writtenAt','collectedAt','rating','ratingScale','text'];
 const cutOff=Date.parse('2026-08-31T00:00:00+09:00');
 if(all.length!==50)return {caseId,status:'error',reviews:[],message:'승인된 원문 50건의 수량을 확인할 수 없습니다.'};
 for(const row of all){
  if(!row||typeof row!=='object'||Object.keys(row).length!==fields.length||fields.some(key=>!Object.hasOwn(row,key))||
   typeof row.id!=='string'||ids.has(row.id)||!['S16','S17'].includes(String(row.caseId))||row.productId!=='EDU-P1'||!['own_store','virtual_external_1'].includes(String(row.sourceId))||
   typeof row.sourceName!=='string'||typeof row.writtenAt!=='string'||typeof row.collectedAt!=='string'||typeof row.text!=='string'||!row.text.trim()||
   !Number.isInteger(row.rating)||Number(row.rating)<1||Number(row.rating)>5||row.ratingScale!==5){
   return {caseId,status:'error',reviews:[],message:'원문 필드나 고유 ID 검증에 실패했습니다.'};
  }
  const written=Date.parse(row.writtenAt),collected=Date.parse(row.collectedAt);
  if(!row.writtenAt.endsWith('+09:00')||!row.collectedAt.endsWith('+09:00')||!Number.isFinite(written)||!Number.isFinite(collected)||written>collected||collected>=cutOff)
   return {caseId,status:'error',reviews:[],message:'작성일, 수집일 또는 보고 기준 검증에 실패했습니다.'};
  const period=written>=Date.parse('2026-08-03T00:00:00+09:00')&&written<Date.parse('2026-08-17T00:00:00+09:00')?'baseline':
   written>=Date.parse('2026-08-17T00:00:00+09:00')&&written<cutOff?'current':null;
  if(!period)return {caseId,status:'error',reviews:[],message:'승인된 14일 작성기간을 벗어났습니다.'};
  const group=[row.caseId,row.sourceId,period].join(':');
  counts.set(group,(counts.get(group)||0)+1);
  ids.add(row.id);
  if(row.caseId===caseId)reviews.push({id:row.id,caseId:String(row.caseId),productId:'EDU-P1',sourceId:String(row.sourceId),sourceName:row.sourceName,writtenAt:row.writtenAt,collectedAt:row.collectedAt,rating:Number(row.rating),text:row.text,categories:[],classification:'pending'});
 }
 for(const c of ['S16','S17'])for(const period of ['baseline','current'])for(const source of ['own_store','virtual_external_1']){
  const expected=c==='S16'?(period==='baseline'?(source==='own_store'?4:8):(source==='own_store'?8:5)):
   (period==='baseline'?(source==='own_store'?8:4):(source==='own_store'?5:8));
  if(counts.get([c,source,period].join(':'))!==expected)
   return {caseId,status:'error',reviews:[],message:'사례, 판매처, 기간별 승인된 배분과 다릅니다.'};
 }
 if(!['S16','S17'].includes(caseId))return {caseId,status:'not_provided',reviews:[]};
 // Raw reviews are usable for text inspection; missing classification is never "unclassified".
 return {caseId,status:'ready',reviews,classificationStatus:'pending'};
}
