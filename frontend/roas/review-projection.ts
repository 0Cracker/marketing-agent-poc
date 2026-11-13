import {reviewCategoryLabels,reviewExperienceCategoryIds,reviewExperienceLabels,reviewSentimentLabels} from './review-analysis.ts';
import type {ReviewAssignment,ReviewRecord,ReviewView} from './review-analysis.ts';

// Maps the independently validated, read-only server projection to UI labels.
export function readReviewProjection(input:unknown,caseId:string,asOf:string):ReviewView {
 const error=(message:string):ReviewView=>({caseId,status:'error',reviews:[],message});
 if(!input||typeof input!=='object')return error('리뷰 조회 결과 형식이 올바르지 않습니다.');
 const dto=input as Record<string,unknown>;
 if(dto.caseId!==caseId||dto.productId!=='EDU-P1'||dto.productName!=='쓱쓱샴푸'||dto.asOf!==asOf||!Array.isArray(dto.reviews))
  return error('사례, 상품 또는 보고 기준과 리뷰 데이터가 일치하지 않습니다.');
 if(dto.status==='error')return error(typeof dto.message==='string'?dto.message:'리뷰 데이터 검증 오류');
 if(dto.status==='not_provided')return dto.reviews.length?error('미제공 사례에서 리뷰가 반환되었습니다.'):{caseId,status:'not_provided',reviews:[],productName:'쓱쓱샴푸'};
 if(dto.status!=='ready')return error('알 수 없는 리뷰 제공 상태입니다.');
 const expectedCount=caseId==='S16'?60:25;
 if(dto.reviews.length>expectedCount)return error('사례별 승인된 원문 수를 초과하는 원문이 반환되었습니다.');
 const validSentiments=reviewSentimentLabels as Record<string,string>;
 const ids=new Set<string>(),valid:ReviewRecord[]=[];
 const firstDay=Date.parse('2026-08-03T00:00:00+09:00'),lastDay=Date.parse('2026-08-31T00:00:00+09:00'),cutoff=Date.parse(asOf);
 let invalidCount=0;
 for(const value of dto.reviews){
  if(!value||typeof value!=='object'){invalidCount++;continue;}
  const row=value as Record<string,unknown>;
  const classification=row.classification;
  const assignments:ReviewAssignment[]=[],seenExperiences=new Set<string>();
  let assignmentValid=Array.isArray(row.experiences);
  if(assignmentValid)for(const item of row.experiences as unknown[]){
   if(!item||typeof item!=='object'){assignmentValid=false;break;}
   const a=item as Record<string,unknown>;
   if(typeof a.categoryId!=='string'||!Object.hasOwn(reviewCategoryLabels,a.categoryId)||
     typeof a.experienceId!=='string'||!Object.hasOwn(reviewExperienceLabels,a.experienceId)||
     reviewExperienceCategoryIds[a.experienceId]!==a.categoryId||seenExperiences.has(a.experienceId)||
     typeof a.sentiment!=='string'||!Object.hasOwn(validSentiments,a.sentiment)||
     typeof a.evidenceQuote!=='string'||!a.evidenceQuote.trim()||typeof row.text!=='string'||!row.text.includes(a.evidenceQuote)){
    assignmentValid=false;break;
   }
   seenExperiences.add(a.experienceId as string);
   assignments.push(a as ReviewAssignment);
  }
  const uniqueCategories=[...new Set(assignments.map(a=>a.categoryId))];
  const validRow=typeof row.id==='string'&&/^REV-S(16|17)-\d{3}$/.test(row.id)&&Number(row.id.slice(-3))>=1&&Number(row.id.slice(-3))<=expectedCount&&
   !ids.has(row.id)&&row.id.startsWith('REV-'+caseId+'-')&&row.caseId===caseId&&row.productId==='EDU-P1'&&
   typeof row.sourceId==='string'&&['own_store','virtual_external_1'].includes(row.sourceId)&&
   typeof row.sourceName==='string'&&!!row.sourceName.trim()&&
   typeof row.writtenAt==='string'&&row.writtenAt.endsWith('+09:00')&&Number.isFinite(Date.parse(row.writtenAt))&&
   Date.parse(row.writtenAt)>=firstDay&&Date.parse(row.writtenAt)<lastDay&&
   typeof row.collectedAt==='string'&&row.collectedAt.endsWith('+09:00')&&Number.isFinite(Date.parse(row.collectedAt))&&
   Date.parse(row.collectedAt)<cutoff&&
   Date.parse(row.writtenAt)<=Date.parse(row.collectedAt)&&
   typeof row.rating==='number'&&Number.isInteger(row.rating)&&row.rating>=1&&row.rating<=5&&
   typeof row.text==='string'&&!!row.text.trim()&&
   Array.isArray(row.categories)&&row.categories.length===uniqueCategories.length&&
   uniqueCategories.every(id=>(row.categories as unknown[]).includes(id))&&assignmentValid&&
   ((classification==='unclassified'&&assignments.length===0)||(classification==='classified'&&assignments.length>0));
  if(!validRow){invalidCount++;continue;}
  ids.add(row.id as string);
  valid.push({id:row.id as string,caseId,productId:'EDU-P1',sourceId:row.sourceId as string,
   sourceName:row.sourceName as string,writtenAt:row.writtenAt as string,collectedAt:row.collectedAt as string,
   rating:row.rating as number,text:row.text as string,
   categories:uniqueCategories.map(id=>({id,label:reviewCategoryLabels[id]})),
   assignments,classification:classification as 'classified'|'unclassified'});
 }
 if(!['S16','S17'].includes(caseId))return error('미제공 사례에 리뷰가 전달되었습니다.');
 if(!valid.length)return error('검증 가능한 리뷰 원문이 없습니다.');
 if(valid.length+invalidCount!==expectedCount)invalidCount+=Math.abs(expectedCount-valid.length-invalidCount);
 const classificationReady=dto.classificationStatus==='ready';
 return {caseId,productName:'쓱쓱샴푸',reviews:classificationReady?valid:valid.map(row=>({...row,categories:[],assignments:[],classification:'pending'})),
  status:invalidCount?'partial':'ready',classificationStatus:classificationReady?'ready':'error',
  ...(invalidCount?{invalidCount,message:'일부 리뷰가 계약 검증에 실패했습니다.'}:{})};
}
