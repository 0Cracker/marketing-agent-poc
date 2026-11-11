import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {parseEnv} from 'node:util';
import {setTimeout as delay} from 'node:timers/promises';
import {createRunEngine} from '../../../backend/roas/engine/index.mjs';
import {createProviderPool} from '../../../backend/roas/providers/index.mjs';
import {firstPlan,optionCalls} from '../../../backend/roas/engine/jev-plan.mjs';
import {createToolRuntime} from '../../../backend/roas/tools/index.mjs';
import {trainingScreenData} from '../training-data.mjs';

export const CASES=[
  {id:'quick',question:'현재 ROAS 알려줘',route:'quick',first:['overview'],metrics:[],
    calls:[['overview',{}]],jevCalls:1},
  {id:'deep',question:'캠페인별 ROAS가 왜 떨어졌고 어떤 캠페인부터 개선해야 해?',route:'deep',
    first:['overview','metric_breakdown','trend','records'],metrics:['roas'],
    calls:[['overview',{}],['metric_breakdown',{metric:'roas',dimension:'campaign'}],
      ['trend',{metrics:['roas'],granularity:'day',periodId:'both'}],['records',{}]],
    totals:{metric_breakdown:6,trend:28,records:33},jevCalls:2},
  {id:'paired',question:'캠페인별 ROAS와 기기별 CVR',route:'quick',first:['metric_breakdown'],metrics:['roas','cvr'],
    calls:[['metric_breakdown',{metric:'roas',dimension:'campaign'}],
      ['metric_breakdown',{metric:'cvr',dimension:'device'}]],jevCalls:2},
  {id:'history',question:'그 지표를 휴대폰이랑 PC로 나눠 봐',route:'quick',first:['metric_breakdown'],metrics:['roas'],
    history:[{role:'user',text:'ROAS를 알려줘'},{role:'assistant',text:'현재 ROAS 값입니다.'}],
    calls:[['metric_breakdown',{metric:'roas',dimension:'device'}]],jevCalls:2},
  {id:'formula',question:'ROAS 산식과 직전 CVR 일별 추이',route:'quick',first:['metric_components','trend'],metrics:['roas','cvr'],
    calls:[['metric_components',{metric:'roas'}],['trend',{metrics:['cvr'],granularity:'day',periodId:'baseline'}]],jevCalls:2},
  {id:'unsupported',question:'CAC 알려줘',route:'quick',first:[],metrics:[],scope:'unresolved',calls:[],jevCalls:1},
];

const expectedByQuestion=new Map(CASES.map(item=>[item.question,item]));
const sorted=items=>[...items].sort();
const eq=(a,b)=>JSON.stringify(sorted(a))===JSON.stringify(sorted(b));
const stripPage=args=>Object.fromEntries(Object.entries(args||{}).filter(([key])=>!['offset','limit','sort','order','orderBy'].includes(key)));
export function normalizedJob({name,args}) {
  const normalized=stripPage(args);
  if(Array.isArray(normalized.metrics))normalized.metrics=[...normalized.metrics].sort();
  return JSON.stringify({name,args:Object.fromEntries(Object.entries(normalized).sort(([a],[b])=>a.localeCompare(b)))});
}

export function mockAnswers(input) {
  const scenario=expectedByQuestion.get(input.state.user_question);
  if(!scenario)throw Error('unknown_diagnostic_question');
  const first=!input.state.option_candidates;
  const selected=new Set(scenario.first),metrics=new Set(scenario.metrics);
  const selectedOptions=new Set(scenario.calls.filter(([tool])=>tool!=='overview')
    .map(([name,args])=>name==='metric_breakdown'?'breakdown_'+args.metric+'_'+args.dimension:
      name==='metric_components'?'components_'+args.metric:null).filter(Boolean));
  const answers=Object.fromEntries(Object.entries(input.questions).map(([id,question])=>{
    if(question.type==='noul') {
      const yes=first ? id.startsWith('need_')?selected.has(id.slice(5)):
        id.startsWith('metric_')?metrics.has(id.slice(7)):false
        :selectedOptions.has(id);
      return [id,{type:'noul',noul:Number(yes)}];
    }
    const choice=id==='route'?scenario.route:
      id==='metric_scope'?(scenario.scope||'catalog'):
      id==='trend_roas_period'&&scenario.id==='deep'?'both':
      id==='trend_cvr_period'&&scenario.id==='formula'?'baseline':'not_needed';
    return [id,{type:'choice',choice,confidence:1,
      probabilities:Object.fromEntries(Object.keys(question.criteria).map(key=>[key,Number(key===choice)]))}];
  }));
  return {answers};
}

const canonical=(name,args)=>normalizedJob({name,args:{scopeRole:'primary',...args}});
const countFor=(entry)=>entry.result.groups?.length??entry.result.days?.length??entry.result.records?.length??entry.result.periods?.length??0;

export function checkClassification(scenario,{first,invocations=[],tools=[],state,scope}={}) {
  const failures=[];
  const fail=(kind,details)=>failures.push({kind,details});
  const names=first?.selected||[];
  if((scenario.id!=='unsupported'&&!eq(names,scenario.first))||first?.route!==scenario.route)
    fail('first_tool',{expected:scenario.first,actual:names,expectedRoute:scenario.route,route:first?.route});
  const missingMetrics=scenario.metrics.filter(metric=>!(first?.metrics||[]).includes(metric));
  if(missingMetrics.length)
    fail('first_metric',{expected:scenario.metrics,actual:first?.metrics||[],missingMetrics});
  if(scenario.scope&&first?.scope!==scenario.scope)
    fail('unsupported_scope',{expected:scenario.scope,actual:first?.scope});
  if(scope?.caseId!=='S16'||scope?.snapshot!=='initial'||
    Object.values(scope.filters||{}).some(value=>value!=='all'))
    fail('unsupported_scope',{scope});
  const actual=[...new Set(tools.map(entry=>normalizedJob(entry.job)))].sort();
  const expected=[...new Set(scenario.calls.map(([name,args])=>canonical(name,args)))].sort();
  if(JSON.stringify(actual)!==JSON.stringify(expected))
    fail(scenario.id==='unsupported'?'unsupported_scope':'second_pair_period',{expected,actual});
  if(scenario.id==='unsupported' && tools.length)fail('unsupported_scope',{unexpectedQueries:tools.length});
  if(invocations.length!==scenario.jevCalls)
    fail('first_tool',{expectedJevCalls:scenario.jevCalls,actualJevCalls:invocations.length});
  for(const [name,total] of Object.entries(scenario.totals||{})) {
    const pages=tools.filter(entry=>entry.job.name===name);
    const rows=pages.reduce((sum,entry)=>sum+countFor(entry),0);
    const allPages=pages.length>0&&pages.at(-1)?.result.nextOffset===null &&
      pages.every(entry=>entry.result.total===total&&entry.result.status==='ready');
    if(rows!==total||!allPages)
      fail('pagination',{tool:name,expected:total,received:rows,allPages,
        pageTotals:pages.map(entry=>entry.result.total)});
  }
  if(state && !['completed','partial'].includes(state.executionStatus))
    fail('provider_or_engine',{status:state.executionStatus,reason:state.stopReason});
  return {passed:failures.length===0,failures};
}

function envFor(root) {
  const env={...process.env};
  for(const name of ['.env.local','.env']) {
    const filename=path.join(root,name);
    if(fs.existsSync(filename))for(const [key,value] of Object.entries(parseEnv(fs.readFileSync(filename,'utf8'))))
      if(!env[key])env[key]=value;
  }
  return env;
}
const median=xs=>{if(!xs.length)return null;const ordered=[...xs].sort((a,b)=>a-b);return ordered[Math.floor(ordered.length/2)];};
const oldInputs=(report,question)=>{
  const run=report?.runs?.find(run=>run.question===question);
  if(!run)return [];
  return (run.attempts||[]).map(index=>report.attempts[index]).filter(attempt=>attempt?.format==='jev'&&attempt.input);
};

export async function runClassificationDiagnostics({args=process.argv.slice(2),root=path.resolve(import.meta.dirname,'../../..')}={}) {
  const live=args.includes('--live'),verify=args.includes('--verify-only');
  const maxCalls=verify?12:27;
  const directory=path.join(root,'evidence','jev-classification-'+new Date().toISOString().slice(0,10).replaceAll('-',''));
  fs.mkdirSync(directory,{recursive:true});
  const reportPath=path.join(directory,(verify?'verify-':'run-')+Date.now()+'.json');
  const data=trainingScreenData(undefined,'S16','initial');
  const scope={caseId:'S16',snapshot:'initial',metric:'roas',screenTitle:'성과 현황',
    filters:{channel:'all',source:'all',campaignId:'all',device:'all'},
    dataHash:createHash('sha256').update(JSON.stringify(data)).digest('hex')};
  const report={startedAt:new Date().toISOString(),mode:live?'jev_live_fixed_generation':'mock_fixed_generation',
    verifyOnly:verify,scope,maxLiveCalls:maxCalls,jevAttempts:0,realJevAttempts:0,externalGenerationCalls:0,
    runs:[],replays:[],attempts:[],comparison:{},passed:false};
  const save=()=>fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
  const pool=live?createProviderPool({env:envFor(root)}):null;
  const classifier={id:'diagnostic-jev',provider:live?'jev':'mock',model:live?'jev-latest':'synthetic-jev',eligible:true};
  const generator={id:'fixed-answer',provider:'mock',model:'fixed-answer',eligible:true};
  const invokeJev=async(input,kind,metadata={})=>{
    if(report.jevAttempts>=maxCalls)throw Object.assign(Error('diagnostic_call_cap'),{code:'diagnostic_call_cap'});
    // Count failed, timed-out and replayed Jev attempts against the same hard limit.
    report.jevAttempts++;
    if(live)report.realJevAttempts++;
    const entry={kind,...metadata,bytes:Buffer.byteLength(JSON.stringify(input)),startedAt:new Date().toISOString()};
    const started=performance.now();
    try {
      const response=live?await pool.invokeOnce({candidate:pool.eligibleCandidates({role:'first_tool_classifier'})
        .find(item=>item.provider==='jev')||classifier,
        input,format:'jev',instruction:'Evaluate each typed question against the supplied state.',
        timeoutMs:15000}):{output:mockAnswers(input)};
      entry.succeeded=true;
      return response;
    } catch(error) {
      entry.errorCode=error.code||'model_failed';
      entry.errorPhase=error.failurePhase;
      throw error;
    } finally {
      entry.elapsedMs=Math.round(performance.now()-started);
      report[kind==='replay'?'replays':'attempts'].push(entry);
      save();
    }
  };
  let active;
  const engine=createRunEngine({workflow:'jev',toolRuntimeFactory:async input=>{
    const runtime=await createToolRuntime(input);
    return {...runtime,execute:async job=>{
      const result=await runtime.execute(job);
      active.tools.push({job,result:{status:result.status,total:result.total,nextOffset:result.nextOffset,
        groups:result.groups?.map(row=>({key:row.key})),days:result.days?.map(row=>({date:row.date})),
        records:result.records?.map(row=>({recordId:row.recordId})),periods:result.periods?.map(row=>({id:row.id}))}});
      return result;
    }};
  },providerPool:{
    eligibleCandidates:({role})=>role==='first_tool_classifier'?[classifier]:[generator],
    async invokeOnce({input,format}) {
      if(format==='markdown') {active.fixedGenerationCalls++;return {output:'진단 전용 고정 응답입니다.'};}
      const response=await invokeJev(input,'run',{caseId:active.id,stage:active.invocations.length+1});
      active.invocations.push({bytes:Buffer.byteLength(JSON.stringify(input)),
        elapsedMs:report.attempts.at(-1).elapsedMs,
        questionCount:Object.keys(input.questions).length});
      const scores=Object.fromEntries(Object.entries(response.output.answers).map(([id,answer])=>
        [id,answer.type==='noul'?answer.noul:{choice:answer.choice,score:answer.probabilities[answer.choice]}]));
      if(active.invocations.length===1) {
        active.first=firstPlan(response.output.answers,input.state);
        active.firstScores=scores;
      } else {
        active.secondScores=scores;
        const selected=active.first.selected.filter(name=>name!=='overview');
        const decided=optionCalls(input,response.output.answers,selected);
        active.second={calls:decided.calls,missing:decided.missing};
      }
      return response;
    }
  }});
  async function execute(scenario,benchmark=false) {
    active={id:scenario.id,question:scenario.question,invocations:[],tools:[],fixedGenerationCalls:0};
    const run=active;
    try {
      const accepted=await engine.start({question:scenario.question,scope,history:scenario.history||[],
        threadId:randomUUID(),clientRequestId:randomUUID()});
      for(let i=0;i<250;i++) {
        run.state=await engine.getRun({runId:accepted.runId});
        if(run.state.terminalAt)break;
        await delay(80);
      }
      const verdict=checkClassification(scenario,{first:run.first,invocations:run.invocations,
        tools:run.tools,state:run.state,scope});
      Object.assign(run,{passed:verdict.passed,failures:verdict.failures,benchmark,
        jevCalls:run.invocations.length,questionCounts:run.invocations.map(v=>v.questionCount),
        serialBytes:run.invocations.map(v=>v.bytes),latencyMs:run.invocations.map(v=>v.elapsedMs),
        actualJobs:run.tools.map(e=>e.job),queryCounts:run.tools.map(e=>({
          tool:e.job.name,returned:countFor(e),total:e.result.total,nextOffset:e.result.nextOffset}))});
    } catch(error) {run.passed=false;run.failures=[{kind:'provider_or_engine',details:error.code||error.message}];}
    // Keep diagnostic decisions and executed args, not duplicated model payloads or raw data.
    delete run.invocations;
    delete run.tools;
    if(run.state)run.state={executionStatus:run.state.executionStatus,stopReason:run.state.stopReason,route:run.state.route};
    report.runs.push(run);save();
    return run;
  }
  try {
    const savedFile=path.join(root,'evidence','jev-e2e-20261109','run-1794195811884.json');
    const saved=!verify&&fs.existsSync(savedFile)?JSON.parse(fs.readFileSync(savedFile,'utf8')):null;
    if(!verify) {
      for(const id of ['quick','deep']) {
        const scenario=CASES.find(s=>s.id===id);
        const old=oldInputs(saved,scenario.question);
        const pairs=[];
        for(let n=0;n<3;n++) {
          const replayStart=report.replays.length;
          for(const attempt of old) {
            try {await invokeJev(attempt.input,'replay',{caseId:id,pair:n+1,stage:report.replays.length-replayStart+1});}
            catch(error) {if(error.code==='diagnostic_call_cap')throw error;}
          }
          const result=await execute(scenario,true);
          const replay=report.replays.slice(replayStart);
          pairs.push({oldBytes:replay.map(x=>x.bytes),oldLatencyMs:replay.map(x=>x.elapsedMs),
            newBytes:result.serialBytes,newLatencyMs:result.latencyMs,
            valid:replay.length>0&&replay.every(x=>x.succeeded)&&result.passed});
        }
        report.comparison[id]={pairs,
          simulated:!live,
          confirmed:live&&pairs.length===3&&pairs.every(pair=>pair.valid)&&pairs.every(pair=>pair.oldLatencyMs.length===pair.newLatencyMs.length),
          oldMedianMs:live?median(pairs.filter(p=>p.valid).map(p=>p.oldLatencyMs.reduce((a,b)=>a+b,0))):null,
          newMedianMs:live?median(pairs.filter(p=>p.valid).map(p=>p.newLatencyMs.reduce((a,b)=>a+b,0))):null};
        save();
      }
      for(const scenario of CASES.filter(s=>!['quick','deep'].includes(s.id)))await execute(scenario);
    } else for(const scenario of CASES)await execute(scenario);
  } catch(error) {report.error=error.code||error.message;}
  finally {
    report.finishedAt=new Date().toISOString();
    report.passed=CASES.every(scenario=>report.runs.some(run=>run.id===scenario.id&&run.passed))&&
      report.runs.every(run=>run.passed)&&!report.error;
    save();
    console.log(JSON.stringify({mode:report.mode,verifyOnly:verify,passed:report.passed,
      attempts:report.jevAttempts,realAttempts:report.realJevAttempts,cap:maxCalls,caseResults:report.runs.map(run=>({
        id:run.id,passed:run.passed,failures:run.failures,counts:run.queryCounts})),
      comparison:report.comparison,error:report.error,reportPath}));
  }
  return report;
}
