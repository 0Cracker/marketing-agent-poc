import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {loadCurrentData, publicFiles} from './current-data.mjs';
import {CatalogTools} from '../backend/agent-tools.mjs';
import {AgentFlow,FlowStore} from '../backend/agent-flow.mjs';
import {localPlanner} from '../backend/local-planner.mjs';

assert(!process.argv.some(a=>a.startsWith('--live')),'Live evaluation is not enabled; explicit separate approval and durable call budget required');
const oi=process.argv.indexOf('--output');
assert(oi>=0&&process.argv[oi+1],'--output NEW_DIRECTORY required');
const output=path.resolve(process.argv[oi+1]);
assert(!fs.existsSync(output),'Existing Evidence directory cannot be overwritten');
const root=path.resolve(import.meta.dirname,'..'),data=path.resolve(root,'data');
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const {manifest,catalog}=loadCurrentData(data),records=catalog.records,raw=new Map(records.map(r=>[r.record_id,r]));
const files=publicFiles(manifest).map(f=>path.join(data,f));
const before=Object.fromEntries(files.map(f=>[f,hash(f)]));
const code=Object.fromEntries(['backend/agent-tools.mjs','backend/agent-flow.mjs','backend/local-planner.mjs','scripts/evaluate-agent-questions.mjs'].map(f=>[f,hash(path.join(root,f))]));
const screenCode=Object.fromEntries(['agent-conversation.tsx','agent-client.ts'].map(f=>[f,hash(path.resolve(root,'frontend/workbench',f))]));
const git=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(git.status,0,'Git baseline unavailable');
const tools=new CatalogTools(records.map(record=>({batch:'CURRENT',country:record.dataset_type==='T01'?'GLOBAL':record.scope_id.split('-')[1],record,payload:record,schema_conforming:true})),{manifest});
const scope=(country='JP',extra={})=>({batch:'CURRENT',country,scopeId:'CURRENT-'+country,productIds:['P1A','P1B','P2A','P2B','P3A','P3B'],start:'2026-08-01',end:'2026-09-01',asOf:manifest.source_created_at,dataHash:manifest.data_sha256,...extra});
const flow=new AgentFlow({tools,model:localPlanner,store:new FlowStore()});
const results=[],definitions=[];
function add(id,label,expected,run){definitions.push({id,label,expected,run});}
function eligible(r,s){
  if(!manifest.scope_ids[s.country].includes(r.scope_id))return false;
  if(r.period){
    // Campaign validity intervals overlap the query; measured intervals must fit inside it.
    if(['T12','T40'].includes(r.dataset_type)){if(r.period.start>=s.end||r.period.end_exclusive<=s.start)return false;}
    else if(r.period.start<s.start||r.period.end_exclusive>s.end)return false;
  }
  const instant=r.observed_at||r.written_at||r.changed_at||(r.review_ref&&raw.get(r.review_ref)?.written_at);
  return !instant||(instant.slice(0,10)>=s.start&&instant.slice(0,10)<s.end);
}
// Separate source oracle: no CatalogTools calls, shared cents, or returned fact values.
const integerMoney=value=>{assert.match(value,/^\d+(\.\d{1,2})?$/);const [a,b='']=value.split('.');return BigInt(a)*100n+BigInt(b.padEnd(2,'0'));};
function marketCheck(facts,s){
  const source=records.filter(r=>r.dataset_type==='T03'&&eligible(r,s)&&s.productIds.includes(r.subject_ref));
  const expected=[];
  for(const month of new Set(source.map(r=>r.period.start)))assert.equal(new Set(source.filter(r=>r.period.start===month).map(r=>JSON.stringify(r.market_total_value))).size,1,'Country/month denominator mismatch');
  for(const r of source){const n=integerMoney(r.sales_value.amount),d=integerMoney(r.market_total_value.amount);assert(d>0n);let quotient=n*1000000n/d;if((n*1000000n%d)*2n>=d)quotient++;
    expected.push([r.record_id+'.sales_value',r.sales_value.amount],[r.record_id+'.market_total_value',r.market_total_value.amount],[r.record_id+'.share',`${quotient/1000000n}.${String(quotient%1000000n).padStart(6,'0')}`]);}
  assert(source.length>0);assert.deepEqual(facts.map(f=>[f.id,f.value]).sort(),expected.sort());
  for(const f of facts){const r=raw.get(f.recordId);assert.equal(f.product,r.subject_ref);assert.deepEqual(f.period,r.period);assert.equal(f.unit,f.field==='share'?'ratio':r.sales_value.currency);}
}
function verifyRun(r,s,focus){
  assert.equal(r.status,'analyzed');assert.equal(r.reason,undefined);assert.deepEqual(r.scope,s);
  marketCheck(r.output.facts,s);assert.equal(r.output.causalEffect,null);assert.equal(r.output.coverage,'sample');
  const relation=r.history.find(h=>h.tool==='relations').result;
  assert.equal(relation.candidate,focus);assert(relation.limitations.includes('association_not_causation'));assert.equal(relation.causalEffect,null);
  for(const id of relation.recordIds){assert(raw.has(id));assert(eligible(raw.get(id),s),id);}
  if(focus==='price'){
    const annotations=records.filter(x=>x.dataset_type==='T25'&&eligible(x,s)&&x.aspect_ref==='가격'&&s.productIds.includes(x.subject_ref));
    const supports=annotations.filter(x=>x.sentiment==='negative').slice(0,8).map(x=>x.record_id),counters=annotations.filter(x=>x.sentiment==='positive').slice(0,8).map(x=>x.record_id);
    assert.deepEqual(relation.supportIds,supports);assert.deepEqual(relation.counterIds,counters);assert(counters.length>0);
    assert.deepEqual(r.output.hypotheses[0].counters,counters);
  }else{
    const type={stock:'T22',media:'T12',measurement:'T36'}[focus];
    const expected=records.filter(x=>x.dataset_type===type&&eligible(x,s)).slice(0,24).map(x=>x.record_id);
    assert.deepEqual(relation.recordIds,expected);assert.deepEqual(relation.supportIds,[]);assert.deepEqual(relation.counterIds,[]);assert.equal(r.output.hypotheses[0].assessment,'unresolved');
  }
  for(const rec of relation.records.filter(x=>x.evidence_span)){const span=rec.evidence_span,parent=raw.get(rec.review_ref);assert(parent);assert.equal([...parent.body_text].slice(span.start_offset,span.end_offset).join(''),span.quote);}
  return {runId:r.id,status:r.status,reason:r.reason??null,facts:r.output.facts.length,relationRecords:relation.recordIds.length,modelSubstituteCalls:r.modelCalls};
}
let index=0;
for(const country of ['KR','JP','US'])for(const focus of ['price','stock','media','measurement']){
  const id='F'+String(++index).padStart(2,'0');add(id,`${country} ${focus} 명시 범위 계약`,'analyzed',async()=>{const s=scope(country),r=await flow.analyze({question:`${country} 2026년 8월 제품 비교와 ${focus} 근거를 확인해줘`,scope:s,focus});return verifyRun(r,s,focus);});
}
for(const [id,extra] of [['S01',{productIds:['P1A']}],['S02',{productIds:['P1A','P2A']}],['S03',{start:'2026-07-01',end:'2026-08-01'}],['S04',{start:'2026-07-01'}]])add(id,'제품·기간 변경 시장조회','market_success',()=>{const s=scope('JP',extra),r=tools.call('market_compare',{},s);marketCheck(r.facts,s);return {facts:r.facts.length};});
add('P01','명시 가격→재고 후속','analyzed',async()=>{const s=scope(),a=await flow.analyze({question:'가격 근거',scope:s,focus:'price'});verifyRun(a,s,'price');const b=await flow.analyze({question:'그중 재고 근거를 다시 확인해줘',parentId:a.id,focus:'stock'});const detail=verifyRun(b,s,'stock');assert.equal(b.parentId,a.id);assert.equal(flow.get(a.id).supersededBy,b.id);return detail;});
add('G01','CURRENT 더미 확보시각은 조회에서 제외','analyzed',async()=>{const s=scope('JP',{asOf:'2020-01-01T00:00:00Z'}),r=await flow.analyze({question:'선택 범위 확인',scope:s,focus:'price'});return verifyRun(r,s,'price');});
const guards=[['G02',{start:'2020-01-01',end:'2020-02-01'},'held','data_unavailable'],['G03',{start:'2026-08-02'},'held','period_incomparable'],['G04',{country:'DE',scopeId:'CURRENT-DE'},'needs_scope','scope_invalid'],['G05',{productIds:['UNKNOWN']},'needs_scope','product_unknown'],['G06',{dataHash:'0'.repeat(64)},'needs_scope','inputs_changed'],['G07',{},'needs_scope','followup_reference_required']];
for(const [id,extra,status,reason] of guards)add(id,'경계 '+reason,status+'/'+reason,async()=>{const r=await flow.analyze({question:'선택 범위 확인',scope:scope('JP',extra),focus:'price',...(id==='G07'?{parentId:'missing-parent'}:{})});assert.equal(r.status,status);assert.equal(r.reason,reason);if(id!=='G02'&&id!=='G03')assert.equal(r.modelCalls,0);return {status:r.status,reason:r.reason,modelSubstituteCalls:r.modelCalls};});
index=0;
for(const country of ['KR','JP','US'])for(const type of ['T08','T13','T22'])add('O'+String(++index).padStart(2,'0'),`${country} ${type} 전페이지 원천대조`,'raw_equal',()=>{
  const s=scope(country),all=[];let offset=0,pages=0;
  do{const r=tools.call('observations',{type,offset,limit:24},s);pages++;all.push(...r.facts);for(const f of r.facts){const row=raw.get(f.recordId);assert(eligible(row,s));let value=type==='T08'?row.listed_price?.amount:type==='T22'?row.available_quantity:row.metrics[f.field];if(value&&typeof value==='object')value=value.amount;assert.equal(f.value,value??null);assert.equal(f.availability,value==null?'missing':'present');const currency={KR:'KRW',JP:'JPY',US:'USD'}[country];assert.equal(f.unit,type==='T08'?(row.listed_price?.currency||currency):type==='T13'&&['spend','attributed_value'].includes(f.field)?currency:'count');if(value==null){assert.equal(r.completeness,'partial');assert.notEqual(f.value,0);assert.notEqual(f.value,'0');}}if(type==='T22')assert(r.limitations.includes('snapshot_not_duration'));offset=r.nextOffset;}while(offset!==null);
  const expectedRows=records.filter(r=>r.dataset_type===type&&eligible(r,s));assert.deepEqual([...new Set(all.map(f=>f.recordId))].sort(),expectedRows.map(r=>r.record_id).sort());
  const expectedFields=expectedRows.flatMap(r=>(type==='T08'?['listed_price']:type==='T22'?['available_quantity']:Object.keys(r.metrics)).map(field=>[r.record_id,field]));
  assert.deepEqual(all.map(f=>[f.recordId,f.field]).sort(),expectedFields.sort());
  if(country==='JP'&&type==='T13')for(const id of ['D008-T13-00284','D008-T13-00285']){const r=raw.get(id);assert(eligible(r,s));for(const field of ['impressions','clicks','spend','attributed_conversions','attributed_value']){assert.equal(r.metrics[field],null);const f=all.find(f=>f.recordId===id&&f.field===field);assert(f);assert.equal(f.value,null);assert.equal(f.availability,'missing');}}
  return {pages,facts:all.length,missing:all.filter(f=>f.availability==='missing').length};
});
assert.equal(definitions.length,33);assert.equal(new Set(definitions.map(c=>c.id)).size,33);
try{for(const c of definitions){try{results.push({id:c.id,label:c.label,expected:c.expected,status:'pass',detail:await c.run()});}catch(e){results.push({id:c.id,label:c.label,expected:c.expected,status:'fail',error:e.message});}}}finally{flow.close();}
const dataUnchanged=Object.entries(before).every(([f,h])=>hash(f)===h);
const codeUnchanged=Object.entries(code).every(([f,h])=>hash(path.join(root,f))===h)&&Object.entries(screenCode).every(([f,h])=>hash(path.resolve(root,'frontend/workbench',f))===h);
const gaps=[{id:'M01',status:'static_confirmed',kind:'capability_gap',question:'미국으로 바꿔서 비교해줘',fixedScreen:'JP',finding:'ask sends selected screen scope; no natural-language country routing in client or scope validation'},{id:'M02',status:'static_confirmed',kind:'capability_gap',question:'지난달 7월로 바꿔줘',fixedScreen:'2026-08',finding:'ask sends selected screen dates; no natural-language period routing in client or scope validation'}];
const counts=Object.fromEntries(['pass','fail','not_run'].map(s=>[s,results.filter(r=>r.status===s).length]));assert.equal(counts.pass+counts.fail+counts.not_run,33);
const report={at:new Date().toISOString(),stage:process.env.EVALUATION_STAGE||'preliminary',mode:'offline_contract_only',warning:'localPlanner ignores question text: no LLM question-understanding pass rate',head:git.stdout.trim(),codeHashes:code,screenCodeHashes:screenCode,codeUnchanged,dataHash:manifest.data_sha256,dataFileHashes:before,dataUnchanged,externalModelCalls:0,newMarketingRows:0,realAdsCalls:0,counts,pass:counts.fail===0&&counts.not_run===0&&dataUnchanged&&codeUnchanged,capabilityGaps:gaps,semanticQuality:'not_run',liveEvaluation:'not_run',uiUnderstanding:'not_run',cases:results};
fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(output,'report.md'),`# CURRENT 오프라인 계약 평가\n\n**질문 문장 이해와 실제 LLM 품질은 미실행입니다.**\n\n**발견사항: 질문으로 국가·기간을 바꾸는 자동 라우팅이 없습니다(capability_gap 2건). 현재 화면 범위를 직접 바꿔야 합니다.** 이 발견은 실제 모델의 의도 처리 성공/실패 판정이 아닙니다.\n\n단계: ${report.stage}. pass ${counts.pass} / fail ${counts.fail} / not_run ${counts.not_run}; 외부 호출 0, 새 마케팅 자료 0, 자료 보존 ${dataUnchanged}.\n\n| ID | 검사 | 상태 |\n|---|---|---|\n${results.map(r=>`| ${r.id} | ${r.label} | ${r.status}${r.error?' · '+r.error.replaceAll('|','/'):''} |`).join('\n')}\n\n범위 모순 두 건은 static_confirmed capability_gap이며 33개 계약 시험이나 의미 품질 통과율에 합산하지 않습니다.\n`);
console.log(JSON.stringify({output,pass:report.pass,counts,dataUnchanged,externalModelCalls:0,stage:report.stage}));process.exitCode=report.pass?0:1;
