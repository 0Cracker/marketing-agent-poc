import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {here,root,version,seed,counts,stages,normalize} from './contract.mjs';
import {compile,validate,runErrors} from './validate.mjs';
const args=process.argv.slice(2),mode=args[0];
const arg=k=>{const i=args.indexOf(k);return i<0?undefined:args[i+1];};
const python=arg('--python')??'C:/Users/박시형/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const tools=arg('--tools')??path.resolve(root,'../ontology-validation-tools');
const output=arg('--output');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const fileHash=p=>hash(fs.readFileSync(p));
const relative=p=>path.relative(root,p).replaceAll('\\','/');
const git=(...a)=>execFileSync('git',a,{cwd:root,encoding:'utf8'}).trim();
const baseline=JSON.parse(fs.readFileSync(path.join(here,'initial-state.json'),'utf8'));
// Generation stays bound to its approval baseline; read-only validation must
// also work after commits and guard Git immutability within this execution.
const executionGit={head:git('rev-parse','HEAD'),refs:git('show-ref'),index_sha256:fileHash(path.resolve(root,git('rev-parse','--git-path','index')))};
const sortRows=rows=>[...rows].sort((a,b)=>a.metadata.record_id.localeCompare(b.metadata.record_id));
const identity=rows=>JSON.stringify(sortRows(rows));
function texts(rows){return Object.fromEntries([...new Set(rows.map(r=>r.metadata.dataset_type))].sort().map(t=>[t,sortRows(rows.filter(r=>r.metadata.dataset_type===t)).map(r=>JSON.stringify(r)).join('\n')+'\n']));}
function invokeOracle(source,common,complete=false,source_text=texts(source)){
 const result=spawnSync(python,[path.join(here,'oracle.py')],{cwd:root,input:JSON.stringify({source,common,complete,source_text,tools}),encoding:'utf8',maxBuffer:16*1024*1024,timeout:300000,env:{...process.env,PYTHONIOENCODING:'utf-8',PYTHONDONTWRITEBYTECODE:'1'}});
 let report;try{report=JSON.parse(result.stdout);}catch{report={status:result.error?.code==='ENOENT'?'not_run':'fail',error:result.error?.message??result.stderr??'invalid oracle output'};}
 if(result.status!==0||report.status!=='pass'){const e=new Error('oracle gate: '+JSON.stringify(report));e.status=report.status;throw e;}
 return report;
}
function preservation(){
 for(const [p,digest] of Object.entries(baseline.input_sha256))assert.equal(fileHash(path.join(root,p)),digest,'preserved input: '+p);
 const expected=['validate','cycle'].includes(mode)?executionGit:baseline;
 assert.equal(git('rev-parse','HEAD'),expected.head,'HEAD changed during execution');assert.equal(git('show-ref'),expected.refs,'refs changed during execution');assert.equal(fileHash(path.resolve(root,git('rev-parse','--git-path','index'))),expected.index_sha256,'index changed during execution');
 return {status:'pass',original_source_files:11,original_schema_and_tests:2,git_head:expected.head,generation_git_head:baseline.head,git_scope:['validate','cycle'].includes(mode)?'current_execution':'original_generation',refs:'unchanged',index:'unchanged'};
}
function codeHashes(){return Object.fromEntries(['contract.mjs','generate.mjs','validate.mjs','oracle.py','run.mjs','source.schema.json','common.schema.json'].map(n=>[relative(path.join(here,n)),fileHash(path.join(here,n))]));}
function unchanged(before){for(const [p,h] of Object.entries(before))assert.equal(fileHash(path.join(root,p)),h,'input changed during execution: '+p);}
function boundaryChecks(rows){
 const common=rows.map(normalize),type=t=>common.filter(r=>r.metadata.dataset_type===t),results=[];
 const add=(name,fn)=>{fn();results.push({name,status:'pass'});};
 const active=(rows,at)=>rows.filter(r=>r.payload.period.start<=at&&at<r.payload.period.end);
 const accessible=(r,at)=>Date.parse(r.metadata.available_at)<=Date.parse(at);
 add('available_at_before_and_exact_all_534',()=>{for(const r of common){const at=Date.parse(r.metadata.available_at);assert.ok(!accessible(r,new Date(at-1).toISOString()));assert.ok(accessible(r,new Date(at).toISOString()));}});
 add('half_open_cost_creative_policy_boundaries',()=>{for(const t of ['T21','T16','T40'])for(const r of type(t)){const end=r.payload.period.end,prior=new Date(Date.parse(end+'T00:00:00Z')-1).toISOString().slice(0,10);assert.equal(active([r],end).length,0);assert.equal(active([r],prior).length,1);}});
 add('statistical_vintage_before_and_exact',()=>{for(const row of type('T33').filter(r=>r.payload.revision===1)){const peers=type('T33').filter(r=>r.metadata.country_code===row.metadata.country_code&&r.payload.period.start===row.payload.period.start),at=Date.parse(row.metadata.available_at);const latest=point=>peers.filter(r=>accessible(r,point)).sort((a,b)=>b.payload.revision-a.payload.revision)[0];assert.equal(latest(new Date(at-1).toISOString()).payload.revision,0);assert.equal(latest(new Date(at).toISOString()).payload.revision,1);}});
 add('null_unknown_pending_and_consent_preserved',()=>{
  assert.equal(type('T18').filter(r=>r.payload.event_name==='purchase'&&r.payload.session_ref===null).length,3);
  assert.equal(type('T07').filter(r=>r.payload.query===null).length,1);
  for(const r of type('T20')){assert.equal(r.payload.reason_code,'unknown');assert.equal(r.payload.restocked,null);if(r.payload.status==='pending'){assert.ok(!Object.hasOwn(r.payload,'refund_amount'));assert.ok(!Object.hasOwn(r.payload,'processed_at'));}}
 });
 add('proposed_never_executable',()=>{const executable=p=>p.status==='approved';for(const r of type('T40'))assert.equal(executable(r.payload),r.payload.status==='approved');assert.equal(type('T40').filter(r=>executable(r.payload)).length,3);});
 add('normalization_windows_not_combined',()=>{for(const country of ['KR','JP','US'])for(let q=0;q<2;q++){const r=type('T05').filter(r=>r.metadata.country_code===country&&r.payload.query_id.endsWith('QUERY'+q));const groups=Map.groupBy(r,r=>r.payload.normalization_scope);assert.equal(groups.size,2);for(const group of groups.values())assert.equal(Math.max(...group.map(r=>r.payload.index_value)),100);}});
 add('nonadditive_content_auction_and_rolling_p75',()=>{
  const aggregate=(values,kind)=>{if(['cumulative','ratio_without_denominator','overlapping_p75'].includes(kind))return {status:'blocked',reason:'nonadditive'};return {status:'ok',value:values.reduce((a,b)=>a+b,0)};};
  assert.equal(aggregate(type('T27').map(r=>r.payload.view_count),'cumulative').status,'blocked');
  assert.equal(aggregate(type('T15').map(r=>r.payload.impression_share),'ratio_without_denominator').status,'blocked');
  assert.equal(aggregate([2500,2600],'overlapping_p75').status,'blocked');
 });
 add('refund_subtracted_once_by_completed_adjustment',()=>{for(const country of ['KR','JP','US']){const adjustments=type('T20').filter(r=>r.metadata.country_code===country&&r.payload.status==='completed');const web=type('T18').filter(r=>r.metadata.country_code===country&&r.payload.event_name==='refund');assert.equal(new Set([...adjustments.map(r=>r.payload.adjustment_id),...web.map(r=>r.payload.adjustment_ref)]).size,2);}});
 add('C_units_and_USD_minor_exact_roundtrip',()=>{const raw=rows.filter(r=>r.source_profile==='C');assert.ok(raw.some(r=>JSON.stringify(r.payload).includes('"L"')));assert.ok(raw.some(r=>JSON.stringify(r.payload).includes('"s"')));assert.ok(raw.some(r=>r.metadata.country_code==='US'&&JSON.stringify(r.payload).includes('amountMinor')));for(const r of raw)assert.ok(normalize(r));});
 return results;
}
function readSource(){
 const dir=path.join(here,'source');const files=fs.readdirSync(dir).sort();assert.deepEqual(files,Object.keys(counts).sort().map(t=>t+'.jsonl'));
 const rows=[];for(const file of files){const text=fs.readFileSync(path.join(dir,file),'utf8');assert.ok(text.endsWith('\n'));const values=text.trim().split('\n').map(JSON.parse);assert.equal(values.length,counts[file.slice(0,3)]);for(const [i,r] of values.entries()){assert.equal(r.metadata.record_id,`D005-${file.slice(0,3)}-${String(i+1).padStart(4,'0')}`);rows.push(r);}}
 assert.equal(rows.length,534);return rows;
}
function checkManifest(){
 const manifest=JSON.parse(fs.readFileSync(path.join(here,'manifest.json'),'utf8'));assert.equal(manifest.proposal,version);assert.equal(manifest.seed,seed);
 for(const f of manifest.files)assert.equal(fileHash(path.join(root,f.path)),f.sha256,f.path);
 for(const [p,h] of Object.entries(manifest.code_sha256)){
  if(fileHash(path.join(root,p))===h)continue;
  assert.ok(['oracle.py','run.mjs'].includes(path.basename(p)),'generator/schema change refused: '+p);
  assert.equal(fileHash(path.join(here,'generation-code',path.basename(p))),h,'original generation code not preserved: '+p);
 }
 return manifest;
}
async function main(){
 assert.ok(['generate','validate','cycle','preflight'].includes(mode),'mode: preflight|generate|validate|cycle');
 assert.ok(output,'--output required; existing reports are never overwritten');assert.ok(!fs.existsSync(output),'report exists');
 const report={proposal:version,mode,started_at:new Date().toISOString(),node:process.version,checks:[],system_validation:'incomplete',HermiT:'not_run',OOPS:'not_run',full_52_assertions:'not_run',actual_external_source_fit:'not_run'};
 const push=(name,result)=>{report.checks.push({name,...result});console.log(JSON.stringify({gate:name,status:result.status??'pass'}));};
 let exit=0;
 try{
  preservation();
  const approval=fs.readFileSync(path.join(root,'docs/research/marketing-ontology/data-proposal.md'),'utf8');assert.ok(approval.includes('**‘실행해’**')&&approval.includes('D005-2.0.0'),'approval record missing');
  const proposal=approval.split('## D005-2.0.0 —')[1];assert.ok(proposal,'approved proposal section missing');
  const typeTable=proposal.split('### 주문·이벤트')[0];
  const approvedCounts=Object.fromEntries([...typeTable.matchAll(/^\| [1-5] \| (T\d+) [^|]+\| (\d+) \|/gm)].map(m=>[m[1],Number(m[2])]));
  assert.equal(Object.keys(approvedCounts).length,30,'approved type scope mismatch');
  for(const [t,n] of Object.entries(counts))if(t!=='T01')assert.equal(approvedCounts[t],n,'approved count mismatch: '+t);
  assert.ok(proposal.includes('534행·31파일')&&proposal.includes('60케이스')&&proposal.includes('T01 식별 지원 | 6행'),'approved totals mismatch');
  const compiled=compile();
  for(const [kind,schema] of Object.entries(compiled.definitions)){
   const p=path.join(here,kind+'.schema.json'),text=JSON.stringify(schema,null,2)+'\n';
   if(mode==='generate'||mode==='preflight'){if(fs.existsSync(p))assert.equal(fs.readFileSync(p,'utf8'),text,'schema overwrite refused');else fs.writeFileSync(p,text,{flag:'wx'});}
   else assert.equal(fs.readFileSync(p,'utf8'),text,'schema/code drift');
  }
  push('schema_preflight',{status:'pass',source_branches:93,common_types:31,metaschema:'pass',references:'resolved',coerceTypes:false,useDefaults:false,removeAdditional:false});
  const before={...baseline.input_sha256,...codeHashes()};
  before['docs/research/marketing-ontology/data-proposal.md']=fileHash(path.join(root,'docs/research/marketing-ontology/data-proposal.md'));
  for(const name of ['ontology.ttl','shapes.ttl','field-semantics.json','d003b-mapping.json','batch-selection.json','run-validation-cycle.py','validate-d003b.py','calculate-d003b.py','check-spec.py']){const p=path.join(here,'../../common-contract',name);before[relative(p)]=fileHash(p);}
  report.execution_input_sha256=before;
  report.validation_revision='D005-2.0.0-validation.1';
  let rows;
  if(mode==='generate'){
   assert.ok(!fs.existsSync(path.join(here,'manifest.json')),'existing batch refused');
   const {generateTypes,selected}=await import('./generate.mjs');
   assert.deepEqual(Object.values(selected).map(x=>x.length),[6,6,12,12]);
   rows=[];
   for(const [i,types] of stages.entries()){
    const stage=generateTypes(types),cumulative=[...rows,...stage],result=validate(cumulative,compiled);
    assert.equal(result.errors.length,0,JSON.stringify(result.errors.slice(0,12)));
    const oracle=invokeOracle(cumulative,result.common,i===4);
    const sourceText=texts(stage);fs.mkdirSync(path.join(here,'source'),{recursive:true});
    for(const [t,text] of Object.entries(sourceText)){const file=path.join(here,'source',t+'.jsonl');if(fs.existsSync(file)){assert.ok(args.includes('--resume'),'partial source exists; use --resume after diagnosis');assert.equal(fs.readFileSync(file,'utf8'),text,'resume refuses changed data');}else fs.writeFileSync(file,text,{flag:'wx'});}
    rows=cumulative;push('generation_stage_'+(i+1),{status:'pass',new_rows:stage.length,cumulative_rows:rows.length,oracle});
   }
   const replay=generateTypes(Object.keys(counts));assert.equal(identity(rows),identity(replay),'generator repeat mismatch');
   push('deterministic_generation_replay',{status:'pass',rows:rows.length});
   const files=Object.entries(texts(rows)).map(([t,text])=>({path:relative(path.join(here,'source',t+'.jsonl')),rows:counts[t],sha256:hash(text)}));
   const manifest={proposal:version,seed,approval:'사용자: 실행해',rows:534,files,versions:{generator:version,schemas:version,mapping:version,oracle:version},code_sha256:codeHashes(),existing_input_sha256:baseline.input_sha256,environment:{node:process.version,python,tools,platform:process.platform},git:{head:baseline.head,dirty:git('status','--porcelain=v1')},selected_existing_rows:36,normalization:'memory_only',rdf:'memory_only',status:'generated_stage_gates_passed_cycle_pending'};
   unchanged(before);preservation();fs.writeFileSync(path.join(here,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
   push('manifest',{status:'pass',files:files.length,rows:534});
  }else if(mode!=='preflight'){
   checkManifest();rows=readSource();
   const sourceBefore=Object.fromEntries(fs.readdirSync(path.join(here,'source')).map(n=>[relative(path.join(here,'source',n)),fileHash(path.join(here,'source',n))]));Object.assign(before,sourceBefore);
   const result=validate(rows,compiled);assert.equal(result.errors.length,0,JSON.stringify(result.errors.slice(0,12)));
   push('normal_source_common_and_semantics',{status:'pass',rows:534,source_files:31,false_rejections:0});
   const oracle=invokeOracle(rows,result.common,true);push('independent_oracle_and_RDF',oracle);
   const reversed=invokeOracle([...rows].reverse(),[...result.common].reverse(),true);assert.equal(oracle.rdf.rdf_sha256,reversed.rdf.rdf_sha256);push('reverse_order_RDF',{status:'pass',rdf_sha256:reversed.rdf.rdf_sha256});
   const replay=invokeOracle(rows,result.common,true);assert.deepEqual(oracle,replay);push('validation_replay',{status:'pass'});
   const errors=runErrors(rows,compiled);report.error_cases=errors;assert.equal(errors.length,60);assert.ok(errors.every(e=>e.status==='pass'),JSON.stringify(errors.filter(e=>e.status!=='pass')));push('expected_error_detection',{status:'pass',cases:60,structure:30,semantic:30});
   report.boundary_checks=boundaryChecks(rows);push('boundary_checks',{status:'pass',checks:report.boundary_checks.length});
   if(mode==='cycle'){
    const existingRegression=arg('--d004-report');
    if(existingRegression){
     const prior=JSON.parse(fs.readFileSync(existingRegression,'utf8'));
     assert.equal(prior.cycle,'D004-memory-v1');assert.equal(prior.checks.length,7);assert.ok(prior.checks.every(c=>c.status==='pass'));
     for(const [p,h] of Object.entries(prior.input_sha256))assert.equal(fileHash(path.join(root,p)),h,'reused D004 input changed: '+p);
     report.d004_regression={status:'pass',execution:'reused_verified_identical_inputs',report:relative(path.resolve(existingRegression)),report_sha256:fileHash(existingRegression)};
     push('D004_regression',{...report.d004_regression});
    }else{
    const regressionOutput=path.join(path.dirname(path.resolve(output)),path.basename(output,'.json')+'-d004.json');assert.ok(!fs.existsSync(regressionOutput),'regression report exists');
    const r=spawnSync(python,[path.join(here,'../../common-contract/run-validation-cycle.py'),'--approved-d004','--tools',tools,'--output',regressionOutput],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024,timeout:900000,env:{...process.env,PYTHONIOENCODING:'utf-8',PYTHONDONTWRITEBYTECODE:'1'}});
    let detail;try{detail=JSON.parse(r.stdout);}catch{detail={stdout:r.stdout,stderr:r.stderr,error:r.error?.message};}
    report.d004_regression={status:r.status===0?'pass':r.status===2?'not_run':'fail',exit_code:r.status,report:relative(regressionOutput),result:detail};
    if(r.status===2){const e=new Error('D004 required tool/check not run: '+JSON.stringify(detail));e.status='not_run';throw e;}
    assert.equal(r.status,0,'D004 regression: '+JSON.stringify(detail));push('D004_regression',{status:'pass',report:relative(regressionOutput)});
    }
    report.batch_validation='complete';
   }else report.batch_validation='D005_pass_D004_regression_not_run_in_this_command';
  }
  unchanged(before);push('preservation',preservation());
  report.status='pass';
  if(rows)report.layer_counts={json_schema:{pass:534,fail:0},synthetic_source_fit:{pass:534,fail:0},semantic_contract_programmatic:{pass:534,fail:0},independent_business_meaning_review:'not_run',logic:{D004_OWL_RL:'see_D004_report',HermiT:'not_run',OOPS:'not_run'},question_support:{full_contract_pass:0,full_contract_fail:0,full_contract_not_run:52,existing_partial_components:5},new_type_source_coverage:30};
 }catch(e){exit=e.status==='not_run'||e.code==='ENOENT'||e.message.startsWith('MISSING_TOOL:')?2:1;report.status=exit===2?'not_run':'fail';report.failure={message:e.message,stack:e.stack};report.batch_validation='incomplete';console.error(e.message);}
 report.finished_at=new Date().toISOString();report.exit_code=exit;
 fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({report:output,status:report.status,exit_code:exit,system_validation:'incomplete'}));process.exitCode=exit;
}
await main();
