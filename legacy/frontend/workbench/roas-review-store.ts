export const reviewKey='marketing.roas.reviews.v1';
export const fileLimit=1024*1024;
export type ReviewContext={scenarioId:string;scopeId:string;productId:string;dataHash:string;before:{start:string;end:string};after:{start:string;end:string};asOf:string};
export type ReviewContent={actions:{target:string;selected:boolean;text:string;evidenceIds:string[]}[];budgets:{channel:string;direction:string}[];note:string};
export type Review=ReviewContent&{schemaVersion:1;id:string;revision:number;title:string;createdAt:string;updatedAt:string;context:ReviewContext};
type StorageLike=Pick<Storage,'getItem'|'setItem'>;
const directions=['판단 보류','유지 검토','감액 검토','증액 검토'];
function ensure(value:unknown,message='검토안 파일 형식이 올바르지 않습니다.'):asserts value{if(!value)throw Error(message);}
function object(value:unknown):Record<string,unknown>{ensure(value&&typeof value==='object'&&!Array.isArray(value));return value as Record<string,unknown>;}
function fields(value:unknown,keys:string[]){const row=object(value);ensure(Object.keys(row).length===keys.length&&keys.every(k=>Object.hasOwn(row,k)));return row;}
const text=(v:unknown,max:number,min=0)=>typeof v==='string'&&v.length>=min&&v.length<=max;
const date=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const stamp=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d\d:\d\d)$/.test(v)&&Number.isFinite(Date.parse(v));
const unique=(values:unknown[])=>new Set(values).size===values.length;
export function validateReview(value:unknown):Review{
 const r=fields(value,['schemaVersion','id','revision','title','createdAt','updatedAt','context','actions','budgets','note']);
 ensure(r.schemaVersion===1,'지원하지 않는 검토안 형식입니다.');
 ensure(typeof r.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(r.id));
 ensure(Number.isSafeInteger(r.revision)&&Number(r.revision)>0&&text(r.title,100,1)&&String(r.title).trim().length>0&&stamp(r.createdAt)&&stamp(r.updatedAt)&&Date.parse(String(r.updatedAt))>=Date.parse(String(r.createdAt))&&text(r.note,5000));
 const c=fields(r.context,['scenarioId','scopeId','productId','dataHash','before','after','asOf']);
 ensure(['scenarioId','scopeId','productId'].every(k=>text(c[k],160,1))&&typeof c.dataHash==='string'&&/^[a-f0-9]{64}$/.test(c.dataHash)&&stamp(c.asOf));
 for(const key of ['before','after']){const p=fields(c[key],['start','end']);ensure(date(p.start)&&date(p.end)&&String(p.start)<String(p.end));}
 const before=object(c.before),after=object(c.after);ensure(String(before.end)<=String(after.start)&&Date.parse(String(c.asOf))>=Date.parse(String(after.end)));
 ensure(Array.isArray(r.actions)&&r.actions.length<=20&&Array.isArray(r.budgets)&&r.budgets.length<=20);
 for(const item of r.actions){const a=fields(item,['target','selected','text','evidenceIds']);ensure(text(a.target,200,1)&&typeof a.selected==='boolean'&&text(a.text,5000)&&Array.isArray(a.evidenceIds)&&a.evidenceIds.length<=500&&a.evidenceIds.every(id=>text(id,160,1))&&unique(a.evidenceIds));}
 for(const item of r.budgets){const b=fields(item,['channel','direction']);ensure(text(b.channel,160,1)&&directions.includes(String(b.direction)));}
 ensure(unique(r.actions.map(a=>object(a).target))&&unique(r.budgets.map(b=>object(b).channel)));
 return value as Review;
}
export function parseReview(raw:string){ensure(new TextEncoder().encode(raw).length<=fileLimit,'파일은 1MiB 이하만 불러올 수 있습니다.');let value;try{value=JSON.parse(raw);}catch{throw Error('JSON 파일을 읽지 못했습니다.');}return validateReview(value);}
export function sameContext(a:ReviewContext,b:ReviewContext){return a.scenarioId===b.scenarioId&&a.scopeId===b.scopeId&&a.productId===b.productId&&a.dataHash===b.dataHash&&a.asOf===b.asOf&&a.before.start===b.before.start&&a.before.end===b.before.end&&a.after.start===b.after.start&&a.after.end===b.after.end;}
export function assertCurrent(review:Review,context:ReviewContext,content:ReviewContent){
 ensure(sameContext(review.context,context),'현재 자료와 다른 과거 초안입니다.');
 ensure(review.actions.length===content.actions.length&&review.budgets.length===content.budgets.length,'수정 대상이나 매체가 달라졌습니다.');
 for(const a of review.actions){const current=content.actions.find(row=>row.target===a.target);ensure(current&&a.evidenceIds.length===current.evidenceIds.length&&a.evidenceIds.every(id=>current.evidenceIds.includes(id)),'수정안의 근거 연결을 확인하지 못했습니다.');}
 ensure(review.budgets.every(b=>content.budgets.some(row=>row.channel===b.channel)),'매체 연결을 확인하지 못했습니다.');
}
export function readReviews(storage:StorageLike){
 const raw=storage.getItem(reviewKey);if(raw===null)return {raw,items:[] as Review[]};
 let value;try{value=JSON.parse(raw);}catch{throw Error('저장 목록이 손상되어 덮어쓰기를 중단했습니다.');}
 ensure(Array.isArray(value)&&value.length<=20,'저장 목록을 확인할 수 없습니다.');const items=value.map(validateReview);ensure(unique(items.map(row=>row.id)),'저장 목록에 중복 ID가 있습니다.');
 return {raw,items};
}
// The caller holds a Web Lock; compare the whole snapshot to detect older tabs.
export function saveReview(storage:StorageLike,review:Review,expectedRaw:string|null,importing=false){
 validateReview(review);const {raw,items}=readReviews(storage);ensure(raw===expectedRaw,'다른 탭에서 목록이 바뀌었습니다. 목록을 새로고침하세요.');
 const prior=items.find(row=>row.id===review.id);
 if(prior){ensure(!importing,'같은 ID의 검토안이 이미 있습니다. 기존 안을 유지했습니다.');ensure(review.revision===prior.revision+1&&review.createdAt===prior.createdAt&&sameContext(review.context,prior.context),'저장된 검토안이 바뀌었습니다. 최신 안을 다시 열어 주세요.');}
 else ensure(items.length<20&&review.revision>=1,'검토안은 최대 20개까지 저장할 수 있습니다.');
 const next=[review,...items.filter(row=>row.id!==review.id)].toSorted((a,b)=>b.updatedAt.localeCompare(a.updatedAt));const nextRaw=JSON.stringify(next);
 try{storage.setItem(reviewKey,nextRaw);}catch{throw Error('브라우저에 저장하지 못했습니다. 검토안 파일로 보관해 주세요.');}
 return {raw:nextRaw,items:next};
}
