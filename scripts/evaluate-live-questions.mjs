// Four predeclared questions. External attempts are reserved on disk before fetch.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {loadCurrentData,publicFiles} from '../../marketing-dashboard-drafts/scripts/current-data.mjs';
import {CatalogTools} from '../backend/agent-tools.mjs';
import {AgentFlow,FlowStore} from '../backend/agent-flow.mjs';
import {createLiveRuntime} from '../backend/agent-runtime.mjs';

const oi=process.argv.indexOf('--output');
assert(oi>=0&&process.argv[oi+1],'--output DIRECTORY required');
assert(process.argv.includes('--live'),'Explicit --live required');
const output=path.resolve(process.argv[oi+1]),resume=process.argv.includes('--resume');
const pi=process.argv.indexOf('--prior-ledger');
assert(!(resume&&pi>=0),'Resume already contains prior attempts');
const prior=pi>=0?JSON.parse(fs.readFileSync(path.resolve(process.argv[pi+1]),'utf8')):null;
assert(resume?fs.existsSync(path.join(output,'ledger.json')):!fs.existsSync(output),'New directory required; --resume reuses the existing call ledger');
const root=path.resolve(import.meta.dirname,'..'),data=path.resolve(root,'../marketing-dashboard-drafts/data');
const {manifest,catalog}=loadCurrentData(data),records=catalog.records,raw=new Map(records.map(r=>[r.record_id,r]));
if(prior){assert.equal(prior.ceiling,24);assert(Number.isInteger(prior.used)&&prior.used>=0&&prior.used<=24);assert.equal(prior.dataHash,manifest.data_sha256);}
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const inputs=[...publicFiles(manifest).map(f=>path.join(data,f)),...['agent-flow.mjs','agent-tools.mjs','agent-model.mjs','agent-runtime.mjs'].map(f=>path.join(root,'backend',f)),import.meta.filename];
const hashes=Object.fromEntries(inputs.map(f=>[f,hash(f)]));
const definitions=[
  {id:'L01',country:'KR',focus:'price',question:'한국 2026년 8월 6제품의 금액 점유율을 비교하고, 자사 P1A의 가격 관련 지지·반대 근거를 확인해줘. 인과로 단정하지 마.'},
  {id:'L02',country:'US',focus:'price',question:'미국 2026년 8월 자사와 경쟁 6제품을 같은 시장 분모로 비교하고, 가격 의견의 반대 근거도 보여줘.'},
  {id:'L03',country:'JP',focus:'stock',question:'일본 2026년 8월 6제품의 시장 위치와 재고 관측을 확인해줘. 한 시점 재고를 품절 지속기간으로 해석하지 마.'},
  {id:'L04',country:'JP',focus:'price',parent:'L03',question:'같은 일본·8월·6제품 범위에서 이번에는 가격 관련 지지·반대 근거를 다시 확인해줘.'}
];
fs.mkdirSync(output,{recursive:true});
const save=(file,value)=>{const target=path.join(output,file),temp=target+'.tmp';fs.writeFileSync(temp,JSON.stringify(value,null,2)+'\n');fs.renameSync(temp,target);};
const ledger=resume?JSON.parse(fs.readFileSync(path.join(output,'ledger.json'),'utf8')):{startedAt:new Date().toISOString(),ceiling:24,used:prior?.used||0,priorAttempts:prior?.used||0,priorLedger:pi>=0?path.resolve(process.argv[pi+1]):null,dataHash:manifest.data_sha256,hashes,definitions,attempts:prior?.attempts||[],cases:[]};
assert.equal(ledger.ceiling,24);assert.equal(ledger.dataHash,manifest.data_sha256);assert.deepEqual(ledger.hashes,hashes);assert.deepEqual(ledger.definitions,definitions);
const fixed=()=>{for(const [file,expected] of Object.entries(hashes))assert.equal(hash(file),expected,'Input changed: '+file);};
save('ledger.json',ledger);
const envFile=path.join(root,'.env.local');if(fs.existsSync(envFile))process.loadEnvFile(envFile);
const runtime=createLiveRuntime({fetchImpl:async(...args)=>{
  fixed();assert(ledger.used<ledger.ceiling,'External call budget exhausted');
  ledger.used++;ledger.attempts.push({number:ledger.used,case:ledger.activeCase,at:new Date().toISOString()});save('ledger.json',ledger);
  return fetch(...args);
},onDiagnostic:detail=>fs.appendFileSync(path.join(output,'provider.jsonl'),JSON.stringify({at:new Date().toISOString(),...detail})+'\n')});
const store=new FlowStore(path.join(output,'flow.sqlite'));
const tools=new CatalogTools(records.map(record=>({batch:'CURRENT',country:record.dataset_type==='T01'?'GLOBAL':record.scope_id.split('-')[1],record,payload:record,schema_conforming:true})),{manifest});
const flow=new AgentFlow({tools,model:runtime.model,store});
function verify(run,definition){
  assert.equal(run.status,'analyzed',run.reason);assert.equal(run.scope.country,definition.country);assert.equal(run.scope.dataHash,manifest.data_sha256);
  assert.equal(run.output.causalEffect,null);assert.equal(run.output.coverage,'sample');
  const market=run.history.find(h=>h.tool==='market_compare');assert(market);assert.equal(run.output.facts.length,18);
  const money=value=>{const [a,b='']=value.split('.');return BigInt(a)*100n+BigInt(b.padEnd(2,'0'));};
  const sources=records.filter(r=>r.dataset_type==='T03'&&r.scope_id.split('-')[1]===definition.country&&r.period.start==='2026-08-01');
  assert.equal(sources.length,6);assert.equal(new Set(sources.map(r=>JSON.stringify(r.market_total_value))).size,1);
  const expected=[];
  for(const r of sources){const n=money(r.sales_value.amount),d=money(r.market_total_value.amount);let q=n*1000000n/d;if(n*1000000n%d*2n>=d)q++;
    expected.push([r.record_id+'.sales_value',r.sales_value.amount],[r.record_id+'.market_total_value',r.market_total_value.amount],[r.record_id+'.share',`${q/1000000n}.${String(q%1000000n).padStart(6,'0')}`]);}
  assert.deepEqual(run.output.facts.map(f=>[f.id,f.value]).sort(),expected.sort());
  for(const f of run.output.facts){const r=raw.get(f.recordId);assert.equal(f.unit,f.field==='share'?'ratio':r.sales_value.currency);assert.deepEqual(f.period,r.period);}
  const relation=run.history.find(h=>h.tool==='relations'&&h.result.candidate===definition.focus)?.result;assert(relation);
  const hypothesis=run.output.hypotheses.find(h=>h.candidate===definition.focus);assert(hypothesis);assert.deepEqual(hypothesis.counters,relation.counterIds);assert.deepEqual(hypothesis.supports,relation.supportIds);
  if(definition.focus==='price')assert(relation.counterIds.length>0);
  else{assert.equal(hypothesis.assessment,'unresolved');assert.equal(relation.supportIds.length,0);assert(relation.recordIds.length>0);}
  const evidence=tools.call('evidence',{ids:relation.recordIds.slice(0,24)},run.scope);
  for(const r of evidence.records){assert.deepEqual(r,raw.get(r.record_id));if(r.evidence_span){const s=r.evidence_span;assert.equal([...raw.get(r.review_ref).body_text].slice(s.start_offset,s.end_offset).join(''),s.quote);}}
  save(definition.id+'-evidence.json',evidence);
  if(definition.parent){const parent=ledger.cases.find(c=>c.id===definition.parent);assert.equal(run.parentId,parent.runId);assert.deepEqual(run.scope,flow.get(parent.runId).scope);assert.equal(flow.get(parent.runId).supersededBy,run.id);}
  return {facts:run.output.facts.length,evidence:evidence.records.length,counters:relation.counterIds.length,toolSequence:run.history.map(h=>h.tool)};
}
try{
  for(const definition of definitions){
    if(ledger.cases.some(c=>c.id===definition.id))continue;
    fixed();const parent=definition.parent&&ledger.cases.find(c=>c.id===definition.parent);
    if((definition.parent&&parent?.status!=='pass')||ledger.used>=24){ledger.cases.push({id:definition.id,status:'not_run',reason:definition.parent&&parent?.status!=='pass'?'parent_not_analyzed':'call_budget_exhausted'});save('ledger.json',ledger);continue;}
    ledger.activeCase=definition.id;save('ledger.json',ledger);
    // A crashed run is inspected on resume, never silently replayed or auto-resumed.
    let run=store.list().find(r=>r.question===definition.question&&r.scope.country===definition.country);
    if(!run)run=await flow.analyze({question:definition.question,focus:definition.focus,...(parent?{parentId:parent.runId}:{scope:{batch:'CURRENT',country:definition.country,scopeId:'CURRENT-'+definition.country,productIds:['P1A','P1B','P2A','P2B','P3A','P3B'],start:'2026-08-01',end:'2026-09-01',asOf:manifest.source_created_at,dataHash:manifest.data_sha256}})});
    save(definition.id+'-run.json',run);
    let result;try{result={id:definition.id,status:'pass',runId:run.id,detail:verify(run,definition)};}catch(error){result={id:definition.id,status:'fail',runId:run.id,runStatus:run.status,reason:run.reason||error.message};}
    ledger.cases.push(result);save('ledger.json',ledger);console.log(JSON.stringify({...result,calls:ledger.used}));
  }
  fixed();const counts=Object.fromEntries(['pass','fail','not_run'].map(status=>[status,ledger.cases.filter(c=>c.status===status).length]));
  const report={at:new Date().toISOString(),mode:'actual_model_fixed_questions',models:runtime.info.models,dataHash:manifest.data_sha256,counts,externalAttempts:ledger.used,ceiling:24,inputHashes:hashes,inputsUnchanged:true,realAdsCalls:0,cases:ledger.cases,limitations:['Explicit screen scope and focus supplied; free-text scope routing is not evaluated','Structured tool/fact/counterevidence contracts; prose clarity and causal correctness require separate review','Paused calls are retained without automatic retry']};
  save('report.json',report);console.log(JSON.stringify({output,counts,externalAttempts:ledger.used,inputsUnchanged:true}));process.exitCode=counts.fail||counts.not_run?1:0;
}finally{delete ledger.activeCase;save('ledger.json',ledger);flow.close();}
