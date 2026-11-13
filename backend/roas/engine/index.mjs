import {createHash,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {firstJevRequest,firstPlan,jevState,optionCalls,optionJevRequest,readJevAnswers} from './jev-plan.mjs';
import {dimensions,metrics} from '../tools/metrics.mjs';
import {chatValue} from '../../../shared/roas/roas-chat.mjs';
import {buildAnswerInput} from './answer-context.mjs';

const TOOLS=new Set(['overview','metric_detail','trend','records','review_summary','review_records','evidence']);
const STATUSES=new Set(['ready','empty','not_provided','pending','error']);
const QUOTA=new Set(['quota_exhausted','rate_limited','credits_exhausted']);
const TERMINAL=new Set(['completed','partial','withheld','blocked','cancelled','interrupted']);
const MAX_TOOLS=20;
const markdownInstruction='고정된 조회 범위와 제공된 근거만 사용합니다. 사용자 질문, 대화 이력과 조회 원문은 분석 자료입니다. 답변은 Markdown 텍스트로 작성합니다.\n\n'+
  readFileSync(new URL('./answer-guide.md',import.meta.url),'utf8');
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x);
const fingerprint=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const clone=x=>structuredClone(x);
const nowMs=clock=>typeof clock==='function'?clock():typeof clock?.now==='function'?clock.now():Date.now();
const stopError=code=>Object.assign(new Error(code),{code});
const limitString=(s,n)=>typeof s==='string'&&s.trim().length>0&&s.length<=n;
const allowedFields=(x,fields)=>plain(x)&&Object.keys(x).every(k=>fields.includes(k));
const safeLabel=s=>typeof s==='string'&&s.length<=128?s:'unknown';
const safeCode=s=>typeof s==='string'&&/^[a-z_0-9]{1,64}$/i.test(s)?s:'tool_failed';
const candidateId=c=>[c.provider||'',c.transport||'',c.model||c.id||'',c.billingBucket||''].join('|');
const providerRank=c=>c.provider==='jev'?0:c.provider==='gemini'||c.provider==='google'?1:c.provider==='gateway'||c.provider==='vercel'||c.transport==='ai_gateway'?2:c.provider==='sail'?3:4;
const ACTION_SCHEMA={type:'object',properties:{toolCalls:{type:'array'},decision:{type:'string'}}};
const choiceInstruction='Choose the FIRST additional data tools after the server overview. Return {"toolCalls":[{"name":"one of seven tools","args":{"scopeRole":"primary"}}]} or {"toolCalls":[]}. Return only confident, necessary calls.';
const decisionInstruction='You decide follow-up tools or when to stop. Return {"decision":"continue","toolCalls":[{"name":"metric_detail","args":{"metric":"roas","dimension":"campaign"}}]} with 1 to 4 valid tool calls OR {"decision":"gemini_sufficient"} OR {"decision":"insufficient_evidence"}. Never choose continue with an empty toolCalls array. To answer by campaign, retrieve metric_detail with dimension campaign. The latter forbids all further data tool requests.';
function lockScope(scope) {
  if (!allowedFields(scope,['caseId','snapshot','filters','dataHash','metric','screenTitle','comparisonScope'])||
      !limitString(scope.caseId,64)||!limitString(scope.snapshot,32)||!limitString(scope.dataHash,256)||
      !allowedFields(scope.filters,['channel','source','campaignId','device']))throw stopError('request_invalid');
  for(const value of Object.values(scope.filters))if(!limitString(value,100)||/[\\\/]/.test(value))throw stopError('request_invalid');
  if (scope.comparisonScope) {
    const other=scope.comparisonScope;
    if(!allowedFields(other,['caseId','snapshot','filters','dataHash'])||
        other.caseId!==scope.caseId||other.snapshot!==scope.snapshot||other.dataHash!==scope.dataHash||
        !allowedFields(other.filters,['channel','source','campaignId','device']))throw stopError('unsupported_scope');
    for(const value of Object.values(other.filters))if(!limitString(value,100)||/[\\\/]/.test(value))throw stopError('unsupported_scope');
  }
  return clone(scope);
}
function selectRoute(question) {
  return /(왜|원인|이유|영향|가설|분석|근거|증거|패턴|상관|개선|전략|리뷰.*(매출|광고)|비교.*원인)/iu.test(question) || /\uCD94\uC774|\uCEA0\uD398\uC778\uBCC4/u.test(question)?'deep':'quick';
}
function toolResultSummary(tool,result) {
  if(result.status!=='ready')return undefined;
  if(tool==='trend'&&Array.isArray(result.days)&&result.days.length) {
    const first=result.days[0]?.date,last=result.days.at(-1)?.date;
    if([first,last].every(date=>typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)))
      return first+' ~ '+last+' 일별 자료 '+result.days.length+'일';
  }
  if(tool==='metric_breakdown'&&Array.isArray(result.groups))return result.groups.length+'개 그룹 반환';
  if(!Array.isArray(result.periods))return undefined;
  const values=[];
  const metric=typeof result.metric==='string'&&Object.hasOwn(metrics,result.metric)?result.metric:null;
  for(const period of result.periods) {
    const label=period?.id==='baseline'?'직전':period?.id==='current'?'현재':null;
    if(!label)continue;
    const roas=period.totals?.rates?.roas;
    if(tool==='overview'&&Number.isFinite(roas))values.push(label+' ROAS '+(roas*100).toFixed(2)+'%');
    if((tool==='metric_detail'||tool==='metric_components')&&metric&&Number.isFinite(period.value))
      values.push(label+' '+metric+' '+chatValue(period.value,metric));
    if(tool==='review_summary'&&Number.isFinite(period.count)) {
      const rating=Number.isFinite(period.meanRating)?', 평균 '+period.meanRating.toFixed(2)+'점':'';
      values.push(label+' 리뷰 '+period.count+'건'+rating);
    }
  }
  if(tool==='metric_detail'&&Array.isArray(result.groups))values.push(result.groups.length+'개 그룹 반환');
  return values.join(' / ')||undefined;
}

function availableCandidates(pool,role,remainingBudget,excluded) {
  let list;
  try{list=pool.eligibleCandidates({role,features:{jsonSchema:false,korean:true,toolActions:false,maxOutputTokens:role==='first_tool_classifier'?256:2048},remainingBudget});}
  catch{return [];}
  if(!Array.isArray(list))return [];
  return list.filter(c=>plain(c)&&c.eligible!==false&&!c.paidRisk&&!c.paid_risk&&!c.disabled&&!excluded.has(candidateId(c)))
    .sort((a,b)=>role==='first_tool_classifier'
      ?(a.provider==='jev'?0:1)-(b.provider==='jev'?0:1)||providerRank(a)-providerRank(b)
      :providerRank(a)-providerRank(b));
}
function parseResponse(result) {
  const output=result?.output??result;
  if(typeof output==='string'){try{return JSON.parse(output);}catch{throw stopError('model_protocol');}}
  if(!plain(output))throw stopError('model_protocol');
  return output;
}
function normalizeCalls(output,run) {
  const choice=typeof output?.choice==='string'?output.choice:output?.choice?.tool;
  const chosen=choice&&TOOLS.has(choice)?[{name:choice,args:choice==='metric_detail'?{metric:(run?.question.match(/ROAS|CVR|AOV|CPC|CPA|CTR/i)?.[0]||'roas').toLowerCase(),...(/\uCEA0\uD398\uC778/u.test(run?.question||'')?{dimension:'campaign'}:{})}:choice==='evidence'?{evidenceIds:[...run.issued].slice(0,2)}:{}}]:[];
  const raw=chosen.length?chosen:Array.isArray(output?.toolCalls)?output.toolCalls:output?.tool?
    [{name:output.tool,args:output.args||{}}]:output?.choice?.tool?
    [{name:output.choice.tool,args:output.choice.args||{}}]:[];
  if(output?.confidence!==undefined && output.confidence<0.5)return [];
  if(raw.length>4)throw stopError('model_protocol');
  return raw.map(call=>({name:call.name||call.tool,args:call.args||{}}));
}
function validateTool(name,args,run,issued,useJev) {
  if(!plain(args)||(!useJev&&!TOOLS.has(name)))throw stopError('tool_request_invalid');
  const permitted={
    overview:['scopeRole','metrics'],metric_detail:['scopeRole','metric','dimension','limit','offset'],
    metric_components:['scopeRole','metric'],metric_breakdown:['scopeRole','metric','dimension','limit','offset'],
    trend:['scopeRole','metrics','granularity','periodId','limit','offset'],
    records:['scopeRole','category','query','limit','offset'],
    review_summary:['scopeRole','productId','sourceId','periodId','categoryId'],
    review_records:['scopeRole','productId','sourceId','periodId','categoryId','experienceId','sentiment','reviewIds','query','limit','offset'],
    evidence:['evidenceIds']
  };
  if(!Object.hasOwn(permitted,name)||Object.keys(args).some(k=>!permitted[name].includes(k)))throw stopError('tool_request_invalid');
  if(name==='evidence') {
    if(!Array.isArray(args.evidenceIds)||!args.evidenceIds.length||args.evidenceIds.length>24||
       args.evidenceIds.some(id=>!issued.has(id)))throw stopError('evidence_not_issued');
  } else {
    const role=args.scopeRole||'primary';
    if(!['primary','comparison'].includes(role)||(role==='comparison'&&!run.scope.comparisonScope))throw stopError('unsupported_scope');
  }
  if(args.limit!==undefined&&(!Number.isInteger(args.limit)||args.limit<1||args.limit>24))throw stopError('tool_request_invalid');
  if(args.offset!==undefined&&(!Number.isSafeInteger(args.offset)||args.offset<0||args.offset>10000))throw stopError('tool_request_invalid');
  if(args.query!==undefined&&(typeof args.query!=='string'||args.query.length>120))throw stopError('tool_request_invalid');
  if(name==='metric_detail'&&!limitString(args.metric,50))throw stopError('tool_request_invalid');
  if((name==='metric_components'||name==='metric_breakdown')&&!Object.hasOwn(metrics,args.metric))throw stopError('tool_request_invalid');
  if(name==='metric_breakdown'&&!dimensions.includes(args.dimension))throw stopError('tool_request_invalid');
  if(args.reviewIds&&(!Array.isArray(args.reviewIds)||args.reviewIds.length>24||
      args.reviewIds.some(id=>!limitString(id,128))))throw stopError('tool_request_invalid');
  if(args.periodId&&!['baseline','current','both'].includes(args.periodId))throw stopError('tool_request_invalid');
  if(args.evidenceIds&&new Set(args.evidenceIds).size!==args.evidenceIds.length)throw stopError('tool_request_invalid');
  return {...args,...(name==='evidence'?{}:{scopeRole:args.scopeRole||'primary'})};
}
async function bounded(run,fn) {
  let cleanup=()=>{};
  const interrupted=new Promise((_resolve,reject)=>{
    const onAbort=()=>reject(stopError(run.cancelled?'user_cancelled':'time_limit'));
    if(run.controller.signal.aborted){onAbort();return;}
    run.controller.signal.addEventListener('abort',onAbort,{once:true});
    cleanup=()=>run.controller.signal.removeEventListener('abort',onAbort);
  });
  try{return await Promise.race([Promise.resolve().then(fn),interrupted]);}
  finally{cleanup();}
}
function collectIds(node,ids=new Set(),depth=0) {
  if(depth>10||!node||typeof node!=='object')return ids;
  if(Array.isArray(node)){for(const x of node)collectIds(x,ids,depth+1);return ids;}
  if(typeof node.evidenceId==='string')ids.add(node.evidenceId);
  if(Array.isArray(node.evidenceIds))for(const id of node.evidenceIds)if(typeof id==='string')ids.add(id);
  for(const [k,v] of Object.entries(node))if(!['rawRecord','text','raw','classification'].includes(k))collectIds(v,ids,depth+1);
  return ids;
}
const publicState=run=>clone({
  runId:run.runId,threadId:run.threadId,clientRequestId:run.clientRequestId,
  scopeFingerprint:run.scopeFingerprint,appliedScope:run.scope,runStatus:run.runStatus,
  executionStatus:run.executionStatus,stage:run.stage,route:run.route,causeStatus:run.causeStatus,
  stopReason:run.stopReason,startedAt:run.startedAt,terminalAt:run.terminalAt,
  usage:run.usage,events:run.events,result:run.result
});

export function createRunEngine({toolRuntimeFactory,providerPool,store,clock=Date.now,quickDeadlineMs=15000,deepDeadlineMs=180000,modelTimeoutMs=60000,workflow}={}) {
  const useJev=workflow==='jev';
  if(typeof toolRuntimeFactory!=='function'||!providerPool||
     typeof providerPool.eligibleCandidates!=='function'||typeof providerPool.invokeOnce!=='function')throw stopError('engine_configuration');
  const runs=new Map(),requests=new Map(),threads=new Map();
  async function persist(run) {await store?.updateRun?.(publicState(run));}
  function emit(run,kind,info={}) {
    const event={seq:run.events.length+1,at:new Date(nowMs(clock)).toISOString(),stage:run.stage,kind,...info};
    run.events.push(event);
    // Persistence remains ordered even when the provider resolves immediately.
    run.writes=run.writes.then(()=>store?.appendEvent?.(run.runId,event)).catch(()=>{run.storeError=true;});
    return event;
  }
  function stage(run,next,info) {run.stage=next;emit(run,'stage',info);}
  function stopped(run) {
    if(run.cancelled)throw stopError('user_cancelled');
    if(nowMs(clock)>=run.deadline||run.controller.signal.aborted)throw stopError('time_limit');
  }
  function candidates(run,role) {
    return availableCandidates(providerPool,role,{
      attemptsRemaining:run.usage.maxCalls-run.usage.modelAttempts,
      normalRemaining:run.usage.maxNormal-run.usage.normalAttempts,
      exceptionRemaining:2-run.usage.exceptionAttempts,
      deadlineMs:Math.max(0,run.deadline-nowMs(clock))
    },run.quotaBlocked);
  }
  async function requestModel(run,role,input,{final=false,exceptionOnly=false,format}={}) {
    let attempted=false,last='models_unavailable',previous=null;
    const available=candidates(run,role).filter(candidate=>format!=='jev'||['jev','mock'].includes(candidate.provider));
    const attempts=format==='jev'&&available.length?[...available,available[0]]:available;
    for(const candidate of attempts) {
      stopped(run);
      if(run.quotaBlocked.has(candidateId(candidate)))continue;
      const isException=exceptionOnly||attempted;
      const remainingNormal=run.usage.maxNormal-run.usage.normalAttempts;
      if(run.usage.modelAttempts>=run.usage.maxCalls ||
         (isException?run.usage.exceptionAttempts>=2:
          remainingNormal<1 || (run.route==='deep'&&!final&&remainingNormal<=1))) {
        last='call_limit';break;
      }
      // Reserve the shared QA account budget before any model transport call.
       if (typeof store?.claimModelAttempt === 'function') {
         try { await store.claimModelAttempt({runId:run.runId,accountId:run.accountId}); }
         catch (error) { throw stopError(error?.code==='model_budget_exhausted'?'model_budget_exhausted':'run_not_active'); }
       }
       const attemptIndex=++run.usage.modelAttempts;
      if(isException)run.usage.exceptionAttempts++;
      else run.usage.normalAttempts++;
      attempted=true;
      const started=nowMs(clock),model=safeLabel(candidate.model||candidate.id);
      const provider=safeLabel(candidate.provider),transport=safeLabel(candidate.transport),
        billingBucket=safeLabel(candidate.billingBucket);
      if(previous)emit(run,'model_fallback',{model,provider,errorCode:previous});
      emit(run,'model_attempt',{role,model,provider,transport,billingBucket,attemptIndex,argsSummary:role,
        slot:isException?'exception':'normal',...(previous?{fallbackReason:previous}:{})});
      let failurePhase='model_invoke';
      try {
        const modelInput=!format&&role==='first_tool_classifier'&&candidate.provider==='jev'?
          {state:JSON.stringify({question:input.question,scope:input.scope,catalog:input.catalog}).slice(0,12000),
            choices:Object.fromEntries([...TOOLS,'none'].map(name=>[name,name==='none'?'No further tool needed':name]))}:input;
        const response=await bounded(run,()=>providerPool.invokeOnce({candidate,
          instruction:format==='jev'?'Evaluate each typed question against the supplied state.':
            format==='markdown'?markdownInstruction:
            role==='first_tool_classifier'?choiceInstruction:role==='deep_reasoning'?decisionInstruction:
            markdownInstruction,
          input:modelInput,format, responseSchema:format||candidate.jsonSchema===false||candidate.provider==='jev'?undefined:
            ACTION_SCHEMA,
          signal:run.controller.signal,timeoutMs:useJev?null:Math.min(modelTimeoutMs,Math.max(1,run.deadline-nowMs(clock)))}));
        stopped(run);
        failurePhase='model_output';
        let output;
        try {
          output=format==='jev'?readJevAnswers(input,response?.output):
            format==='markdown'?response?.output:parseResponse(response);
          if(format==='markdown'&&typeof output!=='string')throw stopError('model_protocol');
          if(format!=='markdown')emit(run,'check_model_response',{status:'passed',model,provider});
        } catch(error) {
          emit(run,'check_model_response',{status:'failed',model,provider,attemptIndex,failurePhase,errorCode:safeCode(error?.code)});
          throw error;
        }
        if(!format&&role==='first_tool_classifier'&&candidate.provider==='jev'&&
          (typeof output.choice!=='string'||output.confidence<0.5))throw stopError('model_uncertain');
        const usage=response?.usage;
        if(usage&&plain(usage)) {
          if(Number.isFinite(usage.inputTokens))run.usage.inputTokens=(run.usage.inputTokens||0)+usage.inputTokens;
          if(Number.isFinite(usage.outputTokens))run.usage.outputTokens=(run.usage.outputTokens||0)+usage.outputTokens;
          if(Number.isFinite(usage.reportedCostUsd))run.usage.reportedCostUsd=(run.usage.reportedCostUsd||0)+usage.reportedCostUsd;
        }
        emit(run,'model_success',{role,model:safeLabel(response?.actualModel||model),provider,
          transport,billingBucket,attemptIndex,elapsedMs:Math.max(0,nowMs(clock)-started),
          ...(usage?{usage:Object.fromEntries(['inputTokens','outputTokens','reportedCostUsd'].filter(k=>Number.isFinite(usage[k])).map(k=>[k,usage[k]]))}:{})});
        return {output,model,provider};
      } catch(error) {
        const code=error?.code||'model_failed';
        if(code==='user_cancelled'||code==='time_limit')throw error;
        if(run.controller.signal.aborted)stopped(run);
        if(QUOTA.has(code)||code==='model_unavailable')run.quotaBlocked.add(candidateId(candidate));
        if(code==='quota_exhausted'||code==='credits_exhausted') {
          for(const other of attempts)if(other.provider===candidate.provider)run.quotaBlocked.add(candidateId(other));
        }
        emit(run,'model_error',{role,model,provider,transport,billingBucket,attemptIndex,
          errorCode:safeLabel(code),failurePhase:error?.failurePhase||failurePhase,
          causeCode:error?.causeCode,httpStatus:error?.httpStatus,
          elapsedMs:Math.max(0,nowMs(clock)-started)});
        last=code;previous=code;
        if(format==='jev'&&!['model_failed','model_timeout','rate_limited'].includes(code))break;
      }
    }
    run.lastModelError=last;
    return null;
  }
  async function retrieve(run,toolRuntime,calls) {
    stopped(run);
    const jobs=[];
    for(const call of calls) {
      let args;
      try{args=validateTool(call.name,call.args,run,run.issued,useJev);}
      catch(e){emit(run,'tool_rejected',{tool:safeLabel(call.name),errorCode:e.code});continue;}
      const key=fingerprint([call.name,args]);
      if(run.seen.has(key)){emit(run,'tool_rejected',{tool:call.name,errorCode:'duplicate_call'});continue;}
      if(run.usage.toolCalls>=MAX_TOOLS){emit(run,'tool_rejected',{tool:call.name,errorCode:'tool_limit'});break;}
      run.seen.add(key);run.usage.toolCalls++;
      jobs.push({name:call.name,args});
    }
    if(!jobs.length)return [];
    stage(run,'retrieving');
    // Independent requests share one immutable tool runtime, without retry.
    const outcomes=await Promise.all(jobs.map(async job=>{
      const started=nowMs(clock);
      const {metric,metrics:requestedMetrics,dimension,scopeRole,granularity,periodId,category}=job.args;
      const argsSummary=[
        typeof metric==='string'&&Object.hasOwn(metrics,metric)&&'metric='+metric,
        dimensions.includes(dimension)&&'dimension='+dimension,
        scopeRole&&'scopeRole='+scopeRole,
        granularity==='day'&&'granularity=day',
        periodId&&'periodId='+periodId,
        job.name==='trend'&&Array.isArray(requestedMetrics)&&requestedMetrics.length>0&&
          requestedMetrics.every(id=>Object.hasOwn(metrics,id))&&'metrics='+requestedMetrics.join('|'),
        typeof category==='string'&&'category='+category
      ].filter(Boolean).join(', ');
      emit(run,'tool_start',{tool:job.name,status:'running',argsSummary});
      try{
        const result=await bounded(run,()=>toolRuntime.execute(job));
        stopped(run);
        if(!plain(result)||!STATUSES.has(result.status))throw stopError('tool_protocol');
        run.usage.resultBytes+=Buffer.byteLength(JSON.stringify(result));
        return {job,result,elapsedMs:nowMs(clock)-started};
      }catch(e){return {job,result:{status:'error',errorCode:e?.code||'tool_failed'},elapsedMs:nowMs(clock)-started};}
    }));
    for(const {job,result,elapsedMs} of outcomes) {
      if(run.cancelled)break;
      const ids=[...collectIds(result)];
      // Persist lookup metadata, never raw tool records.
      if (typeof store?.publishEvidence === 'function') {
        for (const item of toolRuntime.evidenceItems?.(ids)||[]) {
          await store.publishEvidence({runId:run.runId,evidence:{
            evidenceId:item.evidenceId,sourceHash:item.sourceHash,
            sourceVersion:item.sourceVersion,periodId:item.periodId,
            tool:job.name,sourceRowIds:item.sourceRecordIds
          }});
        }
      }
      for(const id of ids)run.issued.add(id);
      const entry={name:job.name,args:job.args,scopeRole:job.args.scopeRole||'primary',result};
      run.retrieved.push(entry);
      emit(run,'tool_result',{tool:job.name,status:result.status,count:result.rows?.length??result.records?.length??
        result.reviews?.length??result.groups?.length??result.days?.length??result.periods?.length??result.items?.length??0,
        elapsedMs:Math.max(0,elapsedMs),evidenceIds:ids.slice(0,24),argsSummary:toolResultSummary(job.name,result),
        ...(result.errorCode?{errorCode:safeCode(result.errorCode)}:{})});
    }
    return outcomes.map(x=>x.result);
  }
  function modelContext(run,toolRuntime) {
    const catalog=toolRuntime.metricCatalog?.()||{};
    // Bound the intermediate planning context separately from final generation.
    const context={runId:run.runId,question:run.question,scope:run.scope,history:run.history,
      catalog,toolSchemas:toolRuntime.toolSchemas?.(),results:run.retrieved.map(x=>({name:x.name,args:x.args,result:x.result}))};
    let serialized=JSON.stringify(context);
    if(serialized.length>45000) {
      context.results=context.results.map(x=>({name:x.name,args:x.args,status:x.result.status,
        evidenceIds:[...collectIds(x.result)].slice(0,24),truncated:true}));
      serialized=JSON.stringify(context);
    }
    if(serialized.length>55000)throw stopError('model_context_limit');
    return context;
  }
  async function finalStep(run,role) {
    stage(run,'final_answer');
    const response=await requestModel(run,role,buildAnswerInput({
      question:run.question,scope:run.scope,history:run.history,route:run.route,results:run.retrieved
    }),{final:true,format:'markdown'});
    if(!response)return null;
    return {result:{status:'completed',answer:response.output,evidenceIds:[...run.issued],limitations:[]}};
  }
  async function jevWorkflow(run,toolRuntime) {
    const catalog=toolRuntime.metricCatalog();
    const options=toolRuntime.optionCatalog();
    const state=jevState(run,catalog);
    const routeRequest=firstJevRequest(state,toolRuntime,options,catalog);
    stage(run,'classifying',{count:Object.keys(routeRequest.questions).length});
    const decision=await requestModel(run,'first_tool_classifier',routeRequest,{format:'jev'});
    if(!decision)throw stopError(run.lastModelError||'models_unavailable');
    const plan=firstPlan(decision.output,routeRequest.state);
    run.route=plan.route;
    stage(run,'routed',{argsSummary:run.route});
    emit(run,'model_plan',{count:plan.selected.length,argsSummary:plan.selected.join(', ')});
    if(plan.uncertainMetrics)emit(run,'model_plan',{status:'uncertain',count:plan.uncertainMetrics,argsSummary:'일부 지표의 필요 여부가 불확실합니다.'});
    const limitations=plan.uncertain.map(name=>name+': 도구 필요 여부 불확실');
    if(plan.scope==='unresolved')limitations.push('일부 요청 지표, 차원, 필터 또는 기간을 현재 조회 범위에서 확정할 수 없음');
    const direct=plan.selected.filter(name=>name==='overview'||name.startsWith('review_')&&options.reviewStatus!=='ready');
    const pending=plan.selected.filter(name=>!direct.includes(name));
    const firstResults=retrieve(run,toolRuntime,direct.map(name=>({name,args:{}})));
    // Evidence choices depend on IDs issued by the direct tools.
    if(pending.includes('evidence'))await firstResults;
    const optionRequest=optionJevRequest(state,pending,catalog,options,run.issued,plan.metrics);
    const optionCount=Object.keys(optionRequest.questions).length;
    if(optionCount)stage(run,'choosing_options',{count:optionCount});
    const [optionAnswer]=await Promise.all([
      optionCount
        ? requestModel(run,'first_tool_classifier',optionRequest,{format:'jev'})
        : Promise.resolve({output:{}}),
      firstResults
    ]);
    if(!optionAnswer)throw stopError(run.lastModelError||'model_protocol');
    const uncertain=Object.values(optionAnswer.output).filter(answer=>answer.type==='noul'
      ? answer.noul>0.3&&answer.noul<0.7 : answer.probabilities[answer.choice]<0.7).length;
    if(uncertain)emit(run,'model_plan',{status:'uncertain',count:uncertain,argsSummary:'일부 옵션 판단이 불확실합니다.'});
    const {calls,missing}=optionCalls(optionRequest,optionAnswer.output,pending);
    limitations.push(...missing.map(name=>name+': 유효한 조회 조건을 확정하지 못함'));
    let page=calls;
    while(page.length) {
      if(run.usage.toolCalls+page.length>MAX_TOOLS)limitations.push('실행 조회 한도에 도달해 일부 결과가 생략됨');
      const start=run.retrieved.length;
      await retrieve(run,toolRuntime,page);
      page=run.retrieved.slice(start).filter(({result})=>Number.isSafeInteger(result.nextOffset))
        .map(({name,args,result})=>({name,args:{...args,offset:result.nextOffset}}));
      if(run.usage.toolCalls>=MAX_TOOLS&&page.length) {
        limitations.push('실행 조회 한도에 도달해 일부 결과가 생략됨');
        break;
      }
    }
    const results=run.retrieved.map(({name,args,result})=>({name,args,result}));
    limitations.push(...results.filter(({result})=>result.status!=='ready')
      .map(({name,result})=>name+': '+result.status));
    stage(run,'final_answer');
    const response=await requestModel(run,run.route==='quick'?'quick_answer':'deep_final',
      buildAnswerInput({...state,route:run.route,results,limitations}),{format:'markdown',final:true});
    if(!response)throw stopError(run.lastModelError||'models_unavailable');
    run.stopReason='gemini_sufficient';
    return {status:limitations.length?'partial':'completed',answer:response.output,
      evidenceIds:[...run.issued],limitations};
  }
  async function perform(run) {
    let toolRuntime;
    // The timeout is run-scoped; provider-specific timeouts cannot extend the deadline.
    const timer=useJev?undefined:setTimeout(()=>run.controller.abort(),Math.max(0,run.deadline-nowMs(clock)));
    timer?.unref?.();
    try {
      stopped(run);run.runStatus='running';stage(run,'scope_locked');
      const {comparisonScope,...primary}=run.scope;
      toolRuntime=await toolRuntimeFactory({runId:run.runId,
        scope:comparisonScope?{primary,comparison:comparisonScope}:clone(primary),issuedAt:run.startedAt,
        now:()=>nowMs(clock)});
      stopped(run);
      if(!toolRuntime||typeof toolRuntime.execute!=='function')
        throw stopError('data_unavailable');
      if(useJev) {
        run.result=await jevWorkflow(run,toolRuntime);
        stopped(run);
        run.executionStatus=run.runStatus=run.result.status;
        run.causeStatus=run.route==='deep'?'undetermined':'not_assessed';
        return;
      }
      stage(run,'routed',{argsSummary:run.route});
      stage(run,'overview');
      await retrieve(run,toolRuntime,[{name:'overview',args:{scopeRole:'primary'}},
        ...(run.route==='quick'?[{name:'review_summary',args:{scopeRole:'primary'}}]:[])]);
      const overview=run.retrieved.find(x=>x.name==='overview');
      if(!overview||overview.result.status==='error')throw stopError(overview?.result.errorCode||'data_unavailable');
      stopped(run);
      if(run.route==='deep') {
        stage(run,'classifying');
        const choice=await requestModel(run,'first_tool_classifier',modelContext(run,toolRuntime));
        if(choice) {
          const calls=normalizeCalls(choice.output,run);
          emit(run,'model_plan',{count:calls.length,argsSummary:calls.filter(call=>TOOLS.has(call.name)).map(call=>call.name).join(', ')});
          await retrieve(run,toolRuntime,calls);
        }
        if(/\uCEA0\uD398\uC778/u.test(run.question)&&!run.retrieved.some(x=>x.name==='metric_detail'&&x.args.dimension==='campaign')) {
          emit(run,'server_plan',{tool:'metric_detail',argsSummary:'캠페인 질문에 필요한 ROAS 상세 조회를 보완합니다.'});
          await retrieve(run,toolRuntime,[{name:'metric_detail',args:{metric:'roas',dimension:'campaign'}}]);
        }
        let decided=false;
        for(let n=0;n<2;n++) {
          stopped(run);
          stage(run,'reasoning');
          const response=await requestModel(run,'deep_reasoning',modelContext(run,toolRuntime));
          if(!response)break;
          const action=response.output;
          if(action.decision==='gemini_sufficient'||action.decision==='insufficient_evidence') {
            emit(run,'model_plan',{status:action.decision});
            run.stopReason=action.decision;decided=true;break;
          }
          const calls=normalizeCalls(action,run);
          emit(run,'model_plan',{count:calls.length,status:n===1&&calls.length?'skipped':undefined,
            argsSummary:calls.filter(call=>TOOLS.has(call.name)).map(call=>call.name).join(', ')});
          if(action.decision!=='continue'&&calls.length===0)throw stopError('model_protocol');
          if(action.decision==='continue'&&calls.length===0){if(n===1)run.stopReason='call_limit';continue;}
          if(n===1){run.stopReason='call_limit';break;}
          await retrieve(run,toolRuntime,calls);
        }
        if(!decided&&!run.stopReason)run.stopReason='call_limit';
      }
      stopped(run);
      const outcome=await finalStep(run,run.route==='quick'?'quick_answer':'deep_final');
      if(!outcome) {
        run.executionStatus=run.usage.modelAttempts===0?'blocked':'withheld';
        run.stopReason=run.lastModelError==='models_unavailable'?'models_unavailable':run.lastModelError||'call_limit';
      } else {
        run.executionStatus=outcome.result.status;
        run.result=outcome.result;
        run.causeStatus=run.route==='deep'?'undetermined':'not_assessed';
        if(!run.stopReason)run.stopReason='gemini_sufficient';
      }
      run.runStatus=run.executionStatus;
    } catch(e) {
      const code=e?.code||'provider_error';
      if(code==='user_cancelled'){run.runStatus='cancelled';run.stopReason='user_cancelled';run.executionStatus=useJev?'cancelled':run.result?.status==='completed'?'partial':'withheld';}
      else if(code==='time_limit'){run.runStatus=run.result?.status==='partial'?'partial':'withheld';run.executionStatus=run.runStatus;run.stopReason='time_limit';}
      else {run.runStatus=['data_unavailable','models_unavailable','model_budget_exhausted','run_not_active'].includes(code)?'blocked':'withheld';
        run.executionStatus=run.runStatus;run.stopReason=code;}
      emit(run,'failure',{errorCode:run.stopReason});
    } finally {
      clearTimeout(timer);
      try{await toolRuntime?.dispose?.();}catch{emit(run,'tool_dispose_error',{errorCode:'dispose_failed'});}
      run.retrieved.length=0;
      if(!TERMINAL.has(run.runStatus))run.runStatus='withheld';
      run.stage='terminal';run.terminalAt=new Date(nowMs(clock)).toISOString();
      emit(run,'terminal',{status:run.runStatus,errorCode:run.stopReason});
      threads.delete(run.threadId);
      await run.writes;
      await persist(run);
    }
  }
  return {
    async start({runId:reservedRunId,accountId,question,scope,history=[],threadId,clientRequestId}={}) {
       if (reservedRunId!==undefined &&
           (typeof reservedRunId!=='string'||!/^[a-f0-9-]{36}$/i.test(reservedRunId)))throw stopError('request_invalid');
      if(!limitString(question,4000)||!limitString(threadId,128)||!limitString(clientRequestId,128)||
         !Array.isArray(history)||history.length>8||
         history.some(h=>!allowedFields(h,['role','text'])||!['user','assistant'].includes(h.role)||typeof h.text!=='string'||h.text.length>8000))
        throw stopError('request_invalid');
      const locked=lockScope(scope),key=clientRequestId,fp=fingerprint({question,scope:locked,history,threadId});
      if(requests.has(key)) {
        const found=requests.get(key);
        if(found.fp!==fp)throw stopError('idempotency_conflict');
        return publicState(runs.get(found.runId));
      }
      if(threads.has(threadId))throw stopError('run_in_progress');
      const started=nowMs(clock),route=useJev?null:selectRoute(question),runId=reservedRunId||randomUUID();
      const run={runId,accountId,threadId,clientRequestId,question,history:clone(history),scope:locked,
        scopeFingerprint:fingerprint(locked),startedAt:new Date(started).toISOString(),terminalAt:null,
        route,runStatus:'queued',executionStatus:null,causeStatus:'not_assessed',stage:'queued',stopReason:null,result:null,
        deadline:useJev?Infinity:started+(route==='quick'?quickDeadlineMs:deepDeadlineMs),controller:new AbortController(),
        quotaBlocked:new Set(),retrieved:[],issued:new Set(),seen:new Set(),events:[],writes:Promise.resolve(),
        usage:{modelAttempts:0,normalAttempts:0,exceptionAttempts:0,maxCalls:useJev?5:route==='quick'?3:6,
          maxNormal:useJev?3:route==='quick'?1:4,toolCalls:0,resultBytes:0}};
      await store?.createRun?.(publicState(run));
      runs.set(runId,run);requests.set(key,{fp,runId});threads.set(threadId,runId);
      // The HTTP request returns before tool/model work, preserving polling/cancellation.
      queueMicrotask(()=>{run.task=perform(run).catch(()=>{});});
      return publicState(run);
    },
    async getRun({runId}={}) {
      const run=runs.get(runId);
      if(run)return publicState(run);
      return await store?.getRun?.({runId})??null;
    },
    async cancel({runId,reason='user_cancelled'}={}) {
      const run=runs.get(runId);
      if(!run)return await store?.getRun?.({runId})??null;
      if(TERMINAL.has(run.runStatus))return publicState(run);
      if(reason!=='user_cancelled')throw stopError('request_invalid');
      run.cancelled=true;run.controller.abort();
      run.runStatus='cancel_requested';emit(run,'cancel_requested');
      return publicState(run);
    }
  };
}
