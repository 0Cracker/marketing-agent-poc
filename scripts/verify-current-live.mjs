import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fork,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import net from 'node:net';
import {createInterface} from 'node:readline/promises';
import {DatabaseSync} from 'node:sqlite';
// Prefer this checkout after integration; retain the original split-worktree layout.
const {loadCurrentData,publicFiles,sha256}=await import(fs.existsSync(new URL('./current-data.mjs',import.meta.url))?'./current-data.mjs':'../../marketing-dashboard-drafts/scripts/current-data.mjs');

const root=path.resolve(import.meta.dirname,'..'),dashboard=fs.existsSync(path.join(root,'data/manifest.json'))?root:path.resolve(root,'../marketing-dashboard-drafts');
const outputIndex=process.argv.indexOf('--output');
const observe=process.argv.includes('--observe');
const resume=process.argv.includes('--resume');
const priorCalls=Number(process.env.VERIFY_PRIOR_CALLS||0);
assert(outputIndex>=0&&process.argv[outputIndex+1],'--output NEW_DIRECTORY required');
const output=path.resolve(process.argv[outputIndex+1]);
assert(resume?fs.existsSync(path.join(output,'state.json')):!fs.existsSync(output),'Use a new Evidence directory, or --resume with saved state');
const baseline=resume?JSON.parse(fs.readFileSync(path.join(output,'baseline.json'),'utf8')):null;
const port=Number(process.env.AGENT_PORT||8794),uiPort=Number(process.env.VERIFY_UI_PORT||5177);
const base=`http://127.0.0.1:${port}/agent-api`,origin=`http://127.0.0.1:${uiPort}`;
const dataDir=path.join(dashboard,'data'),db=path.join(output,'flow.sqlite');
const {manifest,catalog}=loadCurrentData(dataDir);
const scope={batch:'CURRENT',country:'JP',scopeId:'CURRENT-JP',productIds:['P1A','P1B','P2A','P2B','P3A','P3B'],start:'2026-08-01',end:'2026-09-01',asOf:manifest.source_created_at,dataHash:manifest.data_sha256};
const fileHash=p=>sha256(fs.readFileSync(p));
const trackedFiles=[...['agent-flow.mjs','agent-http.mjs','agent-model.mjs','agent-runtime.mjs','agent-tools.mjs'].map(f=>path.join(root,'backend',f)),path.join(root,'scripts/agent-server.mjs'),...['agent-client.ts','agent-conversation.tsx','agent-result.tsx','current-service.ts'].map(f=>path.join(dashboard,'frontend/workbench',f))];
const git=(dir,args)=>{const p=spawnSync('git',args,{cwd:dir,encoding:'utf8'});assert.equal(p.status,0,'Git baseline unavailable');return p.stdout.trim();};
const dataHashes=baseline?.dataHashes||Object.fromEntries(publicFiles(manifest).map(f=>[f,fileHash(path.join(dataDir,f))]));
const codeHashes=baseline?.codeHashes||Object.fromEntries(trackedFiles.map(f=>[path.relative(path.dirname(root),f),fileHash(f)]));
const gitBefore=baseline?.gitBefore||[root,dashboard].map(dir=>({directory:dir,head:git(dir,['rev-parse','HEAD']),status:git(dir,['status','--short','--branch'])}));
const existingDBs=['agent-flow.sqlite','agent-flow-live.sqlite'].map(f=>path.join(root,'work',f)).filter(fs.existsSync);
const dbBefore=baseline?.existingDBHashes||Object.fromEntries(existingDBs.map(f=>[f,fileHash(f)]));
fs.mkdirSync(output,{recursive:true});
const save=(name,value)=>fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2)+'\n');
const state=resume?JSON.parse(fs.readFileSync(path.join(output,'state.json'),'utf8')):{startedAt:new Date().toISOString(),scope,base,origin,db,steps:[],runs:{},priorCalls,modelCallCeiling:24};
assert.deepEqual(state.scope,scope);assert.equal(state.priorCalls,priorCalls);
if(!resume)save('baseline.json',{...state,node:process.version,gitBefore,dataHashes,codeHashes,existingDBHashes:dbBefore});
const rawRecords=new Map(catalog.records.map(r=>[r.record_id,r]));
let child,token,session,restartNumber=state.steps.filter(s=>s.command==='restart'&&s.status==='pass').length;
let launchNumber=fs.readdirSync(output).filter(f=>/^session-\d+\.json$/.test(f)).length;
function readRuns(){const database=new DatabaseSync(db,{readOnly:true});try{return database.prepare('SELECT body FROM agent_documents').all().map(r=>JSON.parse(r.body));}finally{database.close();}}
function calls(){const runs=readRuns().filter(r=>!r.revises);const current=runs.reduce((n,r)=>n+r.modelCalls,0);return {total:current+priorCalls,current,prior:priorCalls,analysis:runs.filter(r=>r.role==='analysis').reduce((n,r)=>n+r.modelCalls,0),budget:runs.filter(r=>r.role==='budget').reduce((n,r)=>n+r.modelCalls,0)};}
function fixed(){for(const [f,h] of Object.entries(dataHashes))assert.equal(fileHash(path.join(dataDir,f)),h,'Data changed: '+f);for(const [f,h] of Object.entries(codeHashes))assert.equal(fileHash(path.join(path.dirname(root),f)),h,'Code changed: '+f);assert.equal(session.dataHash,scope.dataHash);}
async function request(route,body){const r=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{origin,'content-type':'application/json','x-agent-token':token},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(420000)});const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data;}
async function launch(){
  child=fork(path.join(root,'scripts/agent-server.mjs'),['--live'],{cwd:root,env:{...process.env,AGENT_DB_PATH:db,MARKETING_DATA_DIR:dataDir,AGENT_PORT:String(port),AGENT_UI_ORIGINS:origin},stdio:['ignore','pipe','pipe','ipc'],windowsHide:true});
  let log='';child.stdout.on('data',x=>{log+=x;});child.stderr.on('data',x=>{log+=x;});
  child.on('message',message=>{if(message.type==='model_diagnostic')fs.appendFileSync(path.join(output,'provider.jsonl'),JSON.stringify({at:new Date().toISOString(),...message.detail})+'\n');});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timeout')),20000);child.once('exit',code=>{clearTimeout(timer);reject(Error('Server exited '+code));});child.stdout.on('data',()=>{if(log.includes('Agent API')){clearTimeout(timer);resolve();}});});
  const r=await fetch(base+'/session',{headers:{origin}});session=await r.json();token=session.token;
  assert.equal(session.mode,'remote_model');assert.equal(session.externalModelEnabled,true);assert.equal(session.realAdsEnabled,false);
  assert.deepEqual(session.models,{analysis:'gemini-3.5-flash-lite',budget:'gemini-3.8-flash'});
  fixed();save(`session-${launchNumber}.json`,{...session,token:undefined});
  fs.writeFileSync(path.join(output,`server-${launchNumber++}.txt`),log);
}
async function stop(){if(child&&child.exitCode===null){const exited=once(child,'exit');child.send('shutdown');await exited;}child=null;}
async function modelRun(route,body,name){
  fixed();let run;
  if(observe){
    const known=new Set(Object.values(state.runs));
    const available=readRuns().filter(r=>!known.has(r.id)&&!r.revises&&r.role===(route==='/budget'?'budget':'analysis')&&(body.parentId?r.parentId===body.parentId:!r.parentId));
    const candidates=available.filter(r=>route==='/budget'?['retained','pending_approval'].includes(r.status):r.status==='analyzed');
    for(const failed of available.filter(r=>['held','paused'].includes(r.status)))save(`stopped-${failed.id}.json`,failed);
    assert.equal(candidates.length,1,'Expected exactly one new UI run');run=candidates[0];
    if(route!=='/budget'){assert.equal(run.question,body.question);assert.equal(run.focus,body.focus);}else{assert.equal(run.analysisId,body.analysisId);assert.equal(run.analysisVersion,body.analysisVersion);}
    assert.deepEqual(run.scope,scope);
  }else{assert(calls().total+6<=24,'Not enough remaining call budget for a new run');run=(await request(route,body)).run;}
  state.runs[name]=run.id;save(`${name}.json`,run);assert.equal(run.status,route==='/budget'?(['retained','pending_approval'].includes(run.status)?run.status:'pending_approval'):'analyzed',run.reason);assert(calls().total<=24);return run;
}
async function evidence(run){const ids=[...new Set([...(run.output.facts||[]).map(f=>f.recordId),...(run.output.hypotheses||[]).flatMap(h=>[...h.supports,...h.counters])])];const records=[];for(let i=0;i<ids.length;i+=24){const result=await request(`/runs/${run.id}/evidence`,{ids:ids.slice(i,i+24)});for(const record of result.records){assert.deepEqual(record,rawRecords.get(record.record_id));if(record.evidence_span){const s=record.evidence_span,parent=rawRecords.get(record.review_ref);assert.equal([...parent.body_text].slice(s.start_offset,s.end_offset).join(''),s.quote);}records.push(record);}}save(`evidence-${run.id}.json`,{pass:true,runId:run.id,recordCount:records.length,records});return records.length;}
function snapshot(){save('state.json',{...state,modelCalls:calls()});}
async function perform(command){
  fixed();let detail;
  if(command==='analysis'){
    assert(!state.runs.initial,'Initial analysis already exists');
    const r=await modelRun('/analysis',{scope,focus:'price',question:'일본 2026년 8월 6제품의 금액 점유율을 비교하고 P1A의 경쟁 열위와 가격 관련 지지·반대 근거를 확인해줘.'},'initial');
    detail={runId:r.id,facts:r.output.facts.length,evidence:await evidence(r)};
  }else if(command==='followup'){
    assert(state.runs.initial&&!state.runs.followup);
    const r=await modelRun('/analysis',{parentId:state.runs.initial,focus:'price',question:'그중 가격 관련 지지·반대 근거만 다시 확인해줘.'},'followup');assert.equal(r.parentId,state.runs.initial);assert.deepEqual(r.scope,scope);detail={runId:r.id,evidence:await evidence(r)};
  }else if(command==='budget'){
    assert(state.runs.followup&&!state.runs.budget);const a=(await request('/runs/'+state.runs.followup)).run;
    const r=await modelRun('/budget',{analysisId:a.id,analysisVersion:a.version,userSelected:true},'budget');assert(r.simulation);save('simulation.json',r.simulation);
    const oracle=spawnSync(process.env.PYTHON||'python',[path.join(root,'scripts/check-current-live-budget.py'),path.join(output,'simulation.json'),path.join(dataDir,'budget-models.jsonl')],{encoding:'utf8'});
    fs.writeFileSync(path.join(output,'decimal-check.txt'),oracle.stdout+oracle.stderr);assert.equal(oracle.status,0,'Independent Decimal check failed');detail={runId:r.id,status:r.status,simulationId:r.simulation.id};
  }else if(command==='approve'){
    assert(state.runs.budget&&!state.runs.approved);let p=(await request('/runs/'+state.runs.budget)).run;let userSelectedRevision=false;
    if(observe){
      const candidates=readRuns().filter(r=>r.role==='budget'&&r.status==='approved'&&r.analysisId===state.runs.followup);assert.equal(candidates.length,1,'Expected one UI-approved proposal');p=candidates[0];userSelectedRevision=!!p.revises;
    }else if(p.status==='retained'){
      const inputs=await request(`/runs/${p.id}/budget-inputs`);
      const allocationKey=x=>JSON.stringify([...x].sort((a,b)=>a.campaign_ref.localeCompare(b.campaign_ref)));
      const candidate=inputs.scenarios.filter(s=>s.model_ref===rawRecords.get(p.simulation.candidate.recordId).model_ref&&JSON.stringify(s.period)===JSON.stringify(p.simulation.period)&&allocationKey(s.allocations)!==allocationKey(p.simulation.baseline.allocations)).sort((a,b)=>a.record_id.localeCompare(b.record_id))[0];
      assert(candidate,'No existing distinct candidate; approval remains not_run');
      p=(await request(`/runs/${p.id}/revise`,{version:p.version,candidateId:candidate.record_id,modelId:p.simulation.modelId})).run;userSelectedRevision=true;
    }
    if(!observe){assert.equal(p.status,'pending_approval');p=(await request(`/runs/${p.id}/approve`,{version:p.version})).run;}assert.equal(p.status,'approved');assert.equal(p.approval.inputFingerprint,p.inputFingerprint);assert.equal(p.approval.proposalHash,p.proposalHash);assert.equal(p.realExecutionAllowed,false);
    state.runs.approved=p.id;save('approved.json',{...p,userSelectedRevision});detail={runId:p.id,userSelectedRevision};
  }else if(command==='restart'){
    assert(state.runs.approved);const before=readRuns(),count=calls(),oldToken=token;await stop();restartNumber++;await launch();assert.notEqual(token,oldToken);
    const stale=await fetch(base+'/runs/'+state.runs.approved,{headers:{origin,'x-agent-token':oldToken}});assert.equal(stale.status,403);assert.equal((await stale.json()).error,'csrf_denied');
    for(const previous of before){const restored=(await request('/runs/'+previous.id)).run;for(const field of ['id','version','status','scope','approval','output','simulation','parentId','analysisId','supersededBy','reason','inputFingerprint','proposalHash'])assert.deepEqual(restored[field],previous[field],`${previous.id}: ${field}`);}
    assert.deepEqual(calls(),count);detail={restart:restartNumber,runs:before.length,status:(await request('/runs/'+state.runs.approved)).run.status,zeroNewModelCalls:true,newToken:true};save(`restore-${restartNumber}.json`,{pass:true,...detail});
  }else if(command==='invalidate'){
    assert(restartNumber>=1&&!state.runs.final);const r=await modelRun('/analysis',{parentId:state.runs.followup,focus:'stock',question:'가격 외 재고 관련 근거를 다시 확인해줘.'},'final');const p=(await request('/runs/'+state.runs.approved)).run;assert.equal(p.status,'invalidated');assert.equal(p.approval,null);assert.equal(p.reason,'analysis_changed');save('invalidated.json',p);detail={runId:r.id,proposalId:p.id,status:p.status};
  }else if(command==='finish'){
    assert(state.runs.final&&restartNumber>=2);assert.equal((await request('/runs/'+state.runs.approved)).run.status,'invalidated');for(const [p,h] of Object.entries(dbBefore))assert.equal(fileHash(p),h,'Existing DB changed during check');
    for(const item of gitBefore)assert.equal(git(item.directory,['rev-parse','HEAD']),item.head);
    const commands=state.steps.filter(s=>s.status==='pass').map(s=>s.command);assert.deepEqual(commands,['analysis','followup','budget','approve','restart','invalidate','restart']);
    detail={status:'pass',scope,modelCalls:calls(),restarts:restartNumber,changedDataFiles:0,existingDBsUnchanged:true,realAdsCalls:0,limitations:['API and database checks; Windows UI acceptance recorded separately','Only JP August 2026 representative flow; not all question quality','Model-call counts conservatively include attempts before provider HTTP requests; revision copies excluded']};save('result.json',{...detail,startedAt:state.startedAt,finishedAt:new Date().toISOString()});
  }else throw Error('Commands: analysis, followup, budget, approve, restart, invalidate, finish, quit');
  state.steps.push({command,status:'pass',at:new Date().toISOString(),detail});snapshot();console.log(JSON.stringify({command,pass:true,...detail,modelCalls:calls()}));
}

const probe=net.createServer();await new Promise((resolve,reject)=>probe.once('error',reject).listen(port,'127.0.0.1',resolve));await new Promise(resolve=>probe.close(resolve));
try{
  await launch();save('ready.json',{base,origin,scope});console.log(JSON.stringify({ready:true,output,base,origin,scope}));
  const input=createInterface({input:process.stdin,output:process.stdout,terminal:false});
  const commandFile=path.join(output,'command.txt');fs.writeFileSync(commandFile,'');
  let previousCommand='';
  fs.watchFile(commandFile,{interval:250},()=>{const next=fs.readFileSync(commandFile,'utf8').trim();if(next&&next!==previousCommand){previousCommand=next;input.emit('line',next.split(/\s+/).at(-1));}});
  for await(const line of input){const command=line.trim();if(!command)continue;if(command==='quit')break;try{await perform(command);}catch(e){state.steps.push({command,status:'fail',at:new Date().toISOString(),error:e.message});snapshot();console.log(JSON.stringify({command,pass:false,error:e.message,modelCalls:calls()}));}}
  fs.unwatchFile(commandFile);
  input.close();
}finally{await stop();}
