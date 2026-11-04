import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {dataDirectory} from './current-data.mjs';
import {trainingScreenData} from './training-data.mjs';
import {trainingCaseIds} from '../shared/training-dashboard.mjs';
import {validateClassification} from './validate-roas-review-classification.mjs';

// Approved source bytes, independent of the mandatory ROAS manifest.
const approvedHashes={
 'roas-reviews.json':'f40aeb577c550ee3928cd044b45fa83253bee751b234de5c3ca4a874700de4e0',
 'roas-review-classification.json':'b1febf7a996ff039600c75957af99f3633d6f836e41a3ce5c08df20d660172de',
 'roas-product-metadata.json':'7349c2c37f1c7238d1ae1973aacafd501a595c4c56f31a8e44310de1be6491cd',
};
const sources=['own_store','virtual_external_1'];
const snapshots=['initial','mature'];
const periodIds=['baseline','current'];
const stamp=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+09:00$/;
const fail=code=>{throw new Error(code);};
const validKeys=(row,keys)=>row&&typeof row==='object'&&!Array.isArray(row)&&Object.keys(row).length===keys.length&&keys.every(key=>Object.hasOwn(row,key));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

function verifiedJson(directory,name){
 const bytes=fs.readFileSync(path.join(directory,name));
 if(sha256(bytes)!==approvedHashes[name])fail('REVIEW_HASH_MISMATCH');
 return JSON.parse(bytes.toString('utf8'));
}

export function validateReviewBundle(bundle,metadata,periods){
 if(!validKeys(metadata,['contract','products'])||metadata.contract!=='roas-product-metadata/1'||!Array.isArray(metadata.products)||metadata.products.length!==1)fail('PRODUCT_METADATA_INVALID');
 const product=metadata.products[0];
 if(!validKeys(product,['productId','productName','categoryId','categoryName','containerType'])||
   product.productId!=='EDU-P1'||product.productName!=='쓱쓱샴푸'||product.categoryId!=='shampoo'||product.categoryName!=='샴푸'||product.containerType!=='pump_bottle')fail('PRODUCT_METADATA_INVALID');
 if(!validKeys(bundle,['contract','subjectCategory','coverage','reviews'])||bundle.contract!=='roas-reviews/1'||
   bundle.subjectCategory!==product.categoryId||!Array.isArray(bundle.coverage)||!Array.isArray(bundle.reviews))fail('REVIEW_CONTRACT_INVALID');
 if(periods.length!==2||periods.some((p,i)=>p.id!==periodIds[i]||!/^\d{4}-\d\d-\d\d$/.test(p.start)||!/^\d{4}-\d\d-\d\d$/.test(p.end))||
   periods[0].end!==periods[1].start)fail('REVIEW_PERIOD_INVALID');
 const coverage=new Set();
 for(const row of bundle.coverage){
  if(!validKeys(row,['caseId','productId','sourceId','periodIds'])||!['S16','S17'].includes(row.caseId)||
    row.productId!=='EDU-P1'||!sources.includes(row.sourceId)||!Array.isArray(row.periodIds)||
    row.periodIds.length!==2||new Set(row.periodIds).size!==2||!periodIds.every(id=>row.periodIds.includes(id)))fail('REVIEW_COVERAGE_INVALID');
  const key=row.caseId+':'+row.sourceId;
  if(coverage.has(key))fail('REVIEW_COVERAGE_INVALID');
  coverage.add(key);
 }
 if(coverage.size!==4||bundle.reviews.length!==50)fail('REVIEW_COVERAGE_INVALID');
 const ids=new Set(),counts=new Map();
 for(const row of bundle.reviews){
  if(!validKeys(row,['id','caseId','productId','sourceId','sourceName','writtenAt','collectedAt','rating','ratingScale','text'])||
    !/^REV-S(16|17)-\d{3}$/.test(row.id)||ids.has(row.id)||!['S16','S17'].includes(row.caseId)||
    !row.id.startsWith('REV-'+row.caseId+'-')||row.productId!=='EDU-P1'||!sources.includes(row.sourceId)||
    !coverage.has(row.caseId+':'+row.sourceId)||typeof row.sourceName!=='string'||!row.sourceName.trim()||
    !stamp.test(row.writtenAt)||!stamp.test(row.collectedAt)||!Number.isFinite(Date.parse(row.writtenAt))||
    !Number.isFinite(Date.parse(row.collectedAt))||Date.parse(row.writtenAt)>Date.parse(row.collectedAt)||
    Date.parse(row.collectedAt)>=Date.parse(periods[1].end+'T00:00:00+09:00')||
    !Number.isInteger(row.rating)||row.rating<1||row.rating>5||row.ratingScale!==5||
    typeof row.text!=='string'||!row.text.trim())fail('REVIEW_ROW_INVALID');
  const period=periods.find(p=>Date.parse(row.writtenAt)>=Date.parse(p.start+'T00:00:00+09:00')&&Date.parse(row.writtenAt)<Date.parse(p.end+'T00:00:00+09:00'));
  if(!period)fail('REVIEW_PERIOD_INVALID');
  const key=[row.caseId,row.sourceId,period.id].join(':');
  counts.set(key,(counts.get(key)||0)+1);ids.add(row.id);
 }
 for(const caseId of ['S16','S17'])for(const periodId of periodIds)for(const sourceId of sources){
  const own=sourceId==='own_store',before=periodId==='baseline';
  const expected=(caseId==='S16')===(before===own)?4:8;
  const expectedCount=expected+(!before&&((caseId==='S16'&&!own)||(caseId==='S17'&&own))?1:0);
  if(counts.get([caseId,sourceId,periodId].join(':'))!==expectedCount)fail('REVIEW_DISTRIBUTION_INVALID');
 }
 return product;
}

// One read-only projection shared by static production assets and dev/preview.
export function reviewQuery({caseId='S01',snapshotId='initial',sourceId='all',listPeriod='both'}={},directory=dataDirectory){
 if(!trainingCaseIds.includes(caseId)||!snapshots.includes(snapshotId)||!['all',...sources].includes(sourceId)||!['both',...periodIds].includes(listPeriod))
  return {caseId,status:'error',reviews:[],errorCode:'REVIEW_QUERY_INVALID',message:'리뷰 조회 조건을 확인할 수 없습니다.'};
 try{
  const pack=trainingScreenData(directory,caseId,snapshotId);
  const bundle=verifiedJson(directory,'roas-reviews.json');
  const metadata=verifiedJson(directory,'roas-product-metadata.json');
  const product=validateReviewBundle(bundle,metadata,pack.periods);
  const classificationPack=verifiedJson(directory,'roas-review-classification.json');
  validateClassification({rawBytes:fs.readFileSync(path.join(directory,'roas-reviews.json')),
   reviews:bundle,pack:classificationPack,product:metadata});
  const classifications=new Map(classificationPack.reviewClassifications.map(row=>[row.reviewId,row]));
  if(pack.products.filter(p=>p.id===product.productId&&p.listPrice===25000).length!==1)fail('PRODUCT_REFERENCE_INVALID');
  const covered=['S16','S17'].includes(caseId);
  const eligible=covered?bundle.reviews.filter(r=>r.caseId===caseId&&Date.parse(r.collectedAt)<Date.parse(pack.asOf)): [];
  const bySource=eligible.filter(r=>sourceId==='all'||r.sourceId===sourceId);
  const periods=pack.periods.map(p=>{
   const rows=bySource.filter(r=>r.writtenAt>=p.start+'T00:00:00+09:00'&&r.writtenAt<p.end+'T00:00:00+09:00');
   const categorized=covered?{
    categories:classificationPack.categories.map(c=>{
     const reviewIds=rows.filter(r=>classifications.get(r.id).assignments.some(a=>a.categoryId===c.id)).map(r=>r.id);
     return {categoryId:c.id,count:reviewIds.length,percent:rows.length?reviewIds.length/rows.length*100:null,reviewIds};
    }),
    experiences:classificationPack.experiences.map(e=>{
     const reviewIds=rows.filter(r=>classifications.get(r.id).assignments.some(a=>a.experienceId===e.id)).map(r=>r.id);
     return {experienceId:e.id,categoryId:e.categoryId,count:reviewIds.length,reviewIds};
    }),
    unclassifiedReviewIds:rows.filter(r=>classifications.get(r.id).status==='unclassified').map(r=>r.id),
   }:{};
   return {...p,count:covered?rows.length:null,meanRating:rows.length?rows.reduce((sum,r)=>sum+r.rating,0)/rows.length:null,
    ...categorized,...(covered?{unclassifiedCount:categorized.unclassifiedReviewIds.length}:{})};
  });
  const selected=bySource.filter(r=>listPeriod==='both'||periods.some(p=>p.id===listPeriod&&r.writtenAt>=p.start+'T00:00:00+09:00'&&r.writtenAt<p.end+'T00:00:00+09:00'))
   .toSorted((a,b)=>b.writtenAt.localeCompare(a.writtenAt)||a.id.localeCompare(b.id));
  return {caseId,productId:product.productId,productName:product.productName,asOf:pack.asOf,dataHash:pack.dataHash,
   caseAvailability:covered?'provided':'not_provided',selectionStatus:!covered?'not_provided':selected.length?'provided':'provided_empty',
   status:covered?'ready':'not_provided',classificationStatus:covered?'ready':undefined,
   classificationVersion:covered?classificationPack.taxonomyVersion:undefined,periods,
   reviews:selected.map(r=>{
    const row=classifications.get(r.id);
    return {id:r.id,caseId:r.caseId,productId:r.productId,sourceId:r.sourceId,sourceName:r.sourceName,
     writtenAt:r.writtenAt,collectedAt:r.collectedAt,rating:r.rating,text:r.text,
     categories:[...new Set(row.assignments.map(a=>a.categoryId))],experiences:row.assignments,
     classification:row.status};
   })};
 }catch{
  return {caseId,status:'error',reviews:[],errorCode:'REVIEW_DATA_UNAVAILABLE',message:'리뷰 자료의 무결성을 확인하지 못했습니다.'};
 }
}
export const reviewAssetNames=trainingCaseIds.flatMap(id=>snapshots.map(snapshot=>`review-${id}-${snapshot}.json`));
export function reviewAsset(file,directory=dataDirectory){
 if(!reviewAssetNames.includes(file))fail('REVIEW_ASSET_INVALID');
 const [,caseId,snapshotId]=/^review-(S\d{2})-(initial|mature)\.json$/.exec(file);
 return reviewQuery({caseId,snapshotId},directory);
}

// No review file is added to the mandatory ROAS manifest or public source list.
export function reviewDataPlugin(directory=dataDirectory){
 const middleware=(req,res,next)=>{
  const requested=(req.url||'').split('?')[0];
  const file=reviewAssetNames.find(name=>requested==='/workbench-data/current/'+name);
  if(!file)return next();
  res.setHeader('content-type','application/json; charset=utf-8');
  res.setHeader('cache-control','no-cache');
  res.end(JSON.stringify(reviewAsset(file,directory)));
 };
 return {name:'optional-review-data',
  configureServer(server){server.middlewares.use(middleware);},
  configurePreviewServer(server){server.middlewares.use(middleware);},
  generateBundle(){for(const file of reviewAssetNames)this.emitFile({type:'asset',fileName:'workbench-data/current/'+file,source:JSON.stringify(reviewAsset(file,directory))});}
 };
}
