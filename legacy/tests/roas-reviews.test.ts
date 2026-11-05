import test from 'node:test';
import assert from 'node:assert/strict';
import {roasScreenData} from '../scripts/current-data.mjs';
import {assertCurrent,parseReview,readReviews,reviewKey,sameContext,saveReview,validateReview} from '../frontend/workbench/roas-review-store.ts';
import type {Review} from '../frontend/workbench/roas-review-store.ts';

// Reuse existing approved observations; only two draft identities are test data.
const source=roasScreenData();
const draft:Review={schemaVersion:1,id:'01000000-0000-4000-8000-000000000001',revision:1,title:'저장 검증',createdAt:'2026-10-22T00:00:00Z',updatedAt:'2026-10-22T00:00:00Z',
 context:{scenarioId:source.scenarioId,scopeId:String(source.records.find((r:Record<string,unknown>)=>r.dataset_type==='T13')!.scope_id),productId:source.productId,dataHash:source.dataHash,before:source.periods[0].period,after:source.periods[1].period,asOf:source.asOf},
 actions:source.actionDrafts.map(a=>({target:a.target,text:a.change,selected:true,evidenceIds:a.evidenceIds})),budgets:source.budgetReview.map((b:{channel:string})=>({channel:b.channel,direction:'판단 보류'})),note:'검증용 메모'};
function memory(){const values=new Map<string,string>();return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};}

test('draft JSON round trip and persisted reload retain content without changing source',()=>{
 const storage=memory();assert.deepEqual(parseReview(JSON.stringify(draft)),draft);const saved=saveReview(storage,draft,null);assert.deepEqual(readReviews(storage),saved);assert.deepEqual(readReviews(storage).items[0].actions,draft.actions);assertCurrent(draft,draft.context,draft);
});

test('cleared action text and note stay empty after saving and importing a draft',()=>{
 const cleared=structuredClone(draft);cleared.actions[0].text='';cleared.note='';
 const storage=memory();saveReview(storage,parseReview(JSON.stringify(cleared)),null);
 const loaded=readReviews(storage).items[0];assert.equal(loaded.actions[0].text,'');assert.equal(loaded.note,'');assertCurrent(loaded,draft.context,draft);
});
test('two drafts remain isolated and stale revision cannot overwrite saved content',()=>{
 const storage=memory();let snapshot=saveReview(storage,draft,null);const second={...draft,id:'01000000-0000-4000-8000-000000000002',title:'다른 검토안'};snapshot=saveReview(storage,second,snapshot.raw);
 const updated={...draft,revision:2,note:'수정된 메모'};snapshot=saveReview(storage,updated,snapshot.raw);assert.equal(snapshot.items.length,2);assert.equal(snapshot.items.find(r=>r.id===second.id)!.note,draft.note);
 assert.throws(()=>saveReview(storage,updated,snapshot.raw),/최신 안/);assert.equal(readReviews(storage).items.find(r=>r.id===draft.id)!.note,'수정된 메모');
});
test('duplicate imports, stale tabs, quota failures and corrupt stores preserve prior bytes',()=>{
 const storage=memory();const saved=saveReview(storage,draft,null);
 assert.throws(()=>saveReview(storage,draft,saved.raw,true),/같은 ID/);assert.throws(()=>saveReview(storage,{...draft,revision:2},null),/다른 탭/);
 const blocked={getItem:storage.getItem,setItem(){throw Error('quota');}};assert.throws(()=>saveReview(blocked,{...draft,revision:2},saved.raw),/저장하지 못/);assert.equal(storage.getItem(reviewKey),saved.raw);
 storage.setItem(reviewKey,'broken');assert.throws(()=>saveReview(storage,draft,'broken'));assert.equal(storage.getItem(reviewKey),'broken');
});
test('outdated context remains readable but is never rebound to current evidence',()=>{
 const old=structuredClone(draft);old.context.dataHash='a'.repeat(64);assert.deepEqual(parseReview(JSON.stringify(old)),old);assert.equal(sameContext(old.context,draft.context),false);assert.throws(()=>assertCurrent(old,draft.context,draft),/과거 초안/);
 old.context={...draft.context,after:{...draft.context.after,end:'2026-09-01'}};assert.equal(sameContext(old.context,draft.context),false);
});
test('current-context draft must match targets, media and exact evidence links',()=>{
 const changed=structuredClone(draft);changed.actions[0].evidenceIds[0]='unknown';assert.throws(()=>assertCurrent(changed,draft.context,draft),/근거 연결/);
 changed.actions=structuredClone(draft.actions);changed.actions[0].target='unknown';assert.throws(()=>assertCurrent(changed,draft.context,draft));changed.actions=structuredClone(draft.actions);changed.budgets[0].channel='unknown';assert.throws(()=>assertCurrent(changed,draft.context,draft),/매체 연결/);
});
test('unsupported format, invalid dates, duplicated fields and oversized files fail closed',()=>{
 const changed=structuredClone(draft);changed.schemaVersion=2 as 1;assert.throws(()=>validateReview(changed),/지원하지/);changed.schemaVersion=1;changed.context.before.start='2026-02-30';assert.throws(()=>validateReview(changed));changed.context=structuredClone(draft.context);changed.actions.push(changed.actions[0]);assert.throws(()=>validateReview(changed));
 assert.throws(()=>parseReview(' '.repeat(1024*1024+1)),/1MiB/);assert.throws(()=>parseReview('{oops'),/JSON/);assert.throws(()=>validateReview({...draft,note:'a'.repeat(5001)}));assert.throws(()=>validateReview({...draft,extra:true}));
});


test('investigation scope survives existing save and JSON reload and reaches exported review',async()=>{
 const {readInvestigation,updateInvestigation,validateInvestigationReview}=await import('../frontend/workbench/roas-investigation-note.ts');
 const {applyReviewDraft,validateReviewDraft}=await import('../shared/roas-review.mjs');
 const note=updateInvestigation(draft.note,{channel:'social',device:'desktop',stage:'checkout',hypothesis:'payment',rationale:'결제 이후 구매 감소 범위를 확인',condition:'결제 실패 로그 대조 후 기능 수정 여부 판단'});
 const content={...draft,note,actions:draft.actions.map(action=>({...action,selected:false}))};
 const storage=memory();saveReview(storage,content,null);
 const restored=parseReview(JSON.stringify(readReviews(storage).items[0]));
 assert.equal(restored.note,note);assert.ok(restored.note.startsWith(draft.note));
 assert.equal(readInvestigation(restored.note).device,'desktop');
 assert.deepEqual(validateReviewDraft(restored,{strictActions:true}),[]);
 assert.deepEqual(validateInvestigationReview(restored),[]);
 const markdown=applyReviewDraft(source.markdown,restored);
 assert.ok(markdown.includes(note));assert.ok(markdown.includes('선택한 수정안 없음.'));
 assert.equal(roasScreenData().dataHash,source.dataHash);
});
