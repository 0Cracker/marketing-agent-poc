import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {FlowError,requireThat,digest} from './agent-tools.mjs';

const stamp=s=>typeof s==='string'&&/T.*(?:Z|[+-]\d\d:\d\d)$/.test(s)&&Number.isFinite(Date.parse(s));
const keys=(o,allowed)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).every(k=>allowed.includes(k));
const allocationKey=allocations=>{
  if(!Array.isArray(allocations)||!allocations.length)return null;
  try{
    const values=allocations.map(a=>[a.campaign_ref,a.amount.amount,a.amount.currency]);
    if(values.some(v=>v.some(x=>typeof x!=='string'))||new Set(values.map(v=>v[0])).size!==values.length)return null;
    return JSON.stringify(values.sort((a,b)=>a[0].localeCompare(b[0])));
  }catch{return null;}
};
const proposalDigest=p=>digest({scope:p.scope,analysisId:p.analysisId,analysisVersion:p.analysisVersion,simulation:p.simulation,action:p.output.action});

export class FlowStore {
  constructor(filename=':memory:'){
    this.db=new DatabaseSync(filename);
    this.db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS agent_documents (id TEXT PRIMARY KEY, kind TEXT NOT NULL, version INTEGER NOT NULL, body TEXT NOT NULL)');
  }
  create(body){
    const doc={...body,id:randomUUID(),version:1};
    this.db.prepare('INSERT INTO agent_documents VALUES (?,?,?,?)').run(doc.id,doc.role,doc.version,JSON.stringify(doc));return doc;
  }
  get(id){const row=this.db.prepare('SELECT body FROM agent_documents WHERE id=?').get(id);requireThat(row,'not_found');return JSON.parse(row.body);}
  list(){return this.db.prepare('SELECT body FROM agent_documents').all().map(r=>JSON.parse(r.body));}
  update(id,version,change){
    this.db.exec('BEGIN IMMEDIATE');
    try{
      const doc=this.get(id);requireThat(doc.version===version,'version_conflict');
      change(doc);doc.version++;
      const result=this.db.prepare('UPDATE agent_documents SET version=?,body=? WHERE id=? AND version=?').run(doc.version,JSON.stringify(doc),id,version);
      requireThat(result.changes===1,'version_conflict');this.db.exec('COMMIT');return doc;
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  close(){this.db.close();}
}

export const toolDefinitions={
  market_compare:{description:'Compare complete monthly market sales and share for the fixed scope. No arguments.',parameters:{type:'object',properties:{},additionalProperties:false}},
  observations:{description:'Read paginated price, stock or ad metric observations; preserve missing values and snapshot semantics.',parameters:{type:'object',properties:{type:{type:'string',enum:['T08','T13','T22']},offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:24}},required:['type'],additionalProperties:false}},
  relations:{description:'Retrieve bounded explicit product/campaign/source relations and both positive and negative evidence. Association is not causation.',parameters:{type:'object',properties:{candidate:{type:'string',enum:['price','stock','media','measurement']}},required:['candidate'],additionalProperties:false}},
  evidence:{description:'Read in-scope source evidence. IDs must be from tool results.',parameters:{type:'object',properties:{ids:{type:'array',items:{type:'string'},minItems:1,maxItems:24}},required:['ids'],additionalProperties:false}},
  budget_inputs:{description:'List approved synthetic budget scenarios, response models and applicable policies.',parameters:{type:'object',properties:{},additionalProperties:false}},
  simulate:{description:'Recalculate existing baseline and candidate using one selected approved synthetic model and policy.',parameters:{type:'object',properties:Object.fromEntries(['baselineId','candidateId','modelId','policyId'].map(k=>[k,{type:'string'}])),required:['baselineId','candidateId','modelId','policyId'],additionalProperties:false}}
};
const allowed={analysis:['market_compare','observations','relations','evidence'],budget:['budget_inputs','simulate']};

export class AgentFlow {
  #active=new Set();
  constructor({tools,model,store=new FlowStore(),now=()=>new Date().toISOString(),maxModelCalls=6,maxToolCalls=8}){
    this.tools=tools;this.model=model;this.store=store;this.now=now;
    requireThat(Number.isInteger(maxModelCalls)&&maxModelCalls>0&&maxModelCalls<=20&&Number.isInteger(maxToolCalls)&&maxToolCalls>0&&maxToolCalls<=30,'limits_invalid');
    this.maxModelCalls=maxModelCalls;this.maxToolCalls=maxToolCalls;
  }
  close(){this.store.close();}
  get(id){return this.store.get(id);}
  #change(doc,change){return this.store.update(doc.id,doc.version,change);}
  #event(doc,type,detail={}){return this.#change(doc,d=>d.events.push({type,at:this.now(),...detail}));}
  #held(doc,reason,status='held'){
    return this.#change(doc,d=>{d.status=status;d.reason=reason;if(status==='invalidated')d.approval=null;d.resumeConditions=[reason==='scope_required'?'Provide explicit country, product IDs, period and asOf':'Resolve '+reason+' before continuing'];d.events.push({type:'stopped',stage:d.stage,reason,at:this.now()});});
  }
  async analyze({question,scope,parentId,focus}={}){
    let parent;
    if(parentId){try{parent=this.get(parentId);}catch{parent=null;}}
    let doc=this.store.create({role:'analysis',question,scope:scope||parent?.scope,parentId:parentId||null,focus:focus||null,
      status:'running',stage:'scope',events:[],history:[],modelCalls:0,toolCalls:0,issuedFacts:{},issuedRecords:[],requiredCounters:{},inputFingerprint:this.tools.fingerprint});
    if(parentId&&(!parent||parent.role!=='analysis'||parent.status!=='analyzed'||parent.supersededBy))return this.#held(doc,'followup_reference_required','needs_scope');
    try{
      requireThat(typeof question==='string'&&question.trim().length&&question.length<=4000,'scope_required');
      this.tools.validateScope(doc.scope);
      requireThat(!focus||['price','stock','media','measurement'].includes(focus),'scope_invalid');
    }catch(e){return this.#held(doc,e.code||'scope_invalid','needs_scope');}
    if(parent){
      const old=this.#change(parent,d=>{d.supersededBy=doc.id;});
      this.#invalidate(old.id,'analysis_changed');
    }
    doc=this.#event(doc,'scope_validated');doc=this.#change(doc,d=>{d.stage='quality';});
    let quality;try{quality=this.tools.quality(doc.scope);}catch(e){return this.#held(doc,e.code||'quality_failed');}
    doc=this.#event(doc,'quality',quality);
    if(!quality.available)return this.#held(doc,'data_unavailable');
    doc=this.#change(doc,d=>{d.stage='exploration';});
    return this.#run(doc);
  }
  async budget({analysisId,analysisVersion,userSelected}={}){
    requireThat(userSelected===true,'user_choice_required');let analysis;
    try{analysis=this.get(analysisId);}catch{throw new FlowError('analysis_stale');}
    requireThat(analysis.role==='analysis'&&analysis.status==='analyzed'&&analysis.version===analysisVersion&&!analysis.supersededBy&&analysis.inputFingerprint===this.tools.fingerprint,'analysis_stale');
    const doc=this.store.create({role:'budget',question:'Compare current and alternative synthetic budget allocations',scope:analysis.scope,analysisId,analysisVersion,
      status:'running',stage:'budget_exploration',events:[{type:'handoff',at:this.now(),analysisId,analysisVersion,userSelected}],history:[],
      modelCalls:0,toolCalls:0,issuedFacts:{},issuedRecords:[],requiredCounters:{},inputFingerprint:this.tools.fingerprint,approval:null,realExecutionAllowed:false});
    return this.#run(doc);
  }
  async #run(doc){
    requireThat(!this.#active.has(doc.id),'run_busy');this.#active.add(doc.id);
    try{
      while(doc.modelCalls<this.maxModelCalls){
        doc=this.#change(doc,d=>{d.status='running';delete d.reason;delete d.resumeConditions;d.modelCalls++;});
        let response;
        try{
          response=await this.model({role:doc.role,question:doc.question,focus:doc.focus,scope:structuredClone(doc.scope),history:structuredClone(doc.history),
            tools:Object.fromEntries(allowed[doc.role].map(k=>[k,toolDefinitions[k]])),analysis:doc.analysisId?this.get(doc.analysisId).output:doc.parentId?this.get(doc.parentId).output:null});
        }catch(e){
          return this.#held(this.get(doc.id),['quota_exhausted','model_timeout','model_unavailable','model_context_limit','model_protocol','provider_configuration'].includes(e.code)?e.code:'model_failed',['quota_exhausted','model_timeout','model_unavailable'].includes(e.code)?'paused':'held');
        }
        doc=this.get(doc.id);if(doc.status!=='running')return doc;
        requireThat(keys(response,['tool','args','finish'])&&((typeof response.tool==='string'&&!response.finish)||(response.finish&&!response.tool)),'model_protocol');
        if(response.finish)return this.#finish(doc,response.finish);
        requireThat(allowed[doc.role].includes(response.tool),'tool_forbidden');
        requireThat(doc.toolCalls<this.maxToolCalls,'call_limit');
        if(response.tool==='evidence')requireThat(Array.isArray(response.args?.ids)&&response.args.ids.every(id=>doc.issuedRecords.includes(id)),'evidence_not_retrieved');
        let result;
        try{result=this.tools.call(response.tool,response.args,doc.scope);}catch(e){throw e instanceof FlowError?e:new FlowError('tool_failed');}
        doc=this.#change(doc,d=>{
          d.toolCalls++;d.history.push({tool:response.tool,args:response.args,result});
          for(const fact of result.facts||[])d.issuedFacts[fact.id]=fact;
          d.issuedRecords=[...new Set([...d.issuedRecords,...result.recordIds||[]])];
          if(result.counterIds)d.requiredCounters[result.candidate]=result.counterIds;
          d.events.push({type:'tool',name:response.tool,args:response.args,recordIds:result.recordIds,at:this.now()});
        });
      }
      return this.#held(doc,'call_limit');
    }catch(e){return this.#held(this.get(doc.id),e.code||'execution_failed');}
    finally{this.#active.delete(doc.id);}
  }
  #finish(doc,finish){
    if(doc.role==='analysis'){
      requireThat(keys(finish,['facts','hypotheses','recommendation'])&&Array.isArray(finish.facts)&&Array.isArray(finish.hypotheses)&&['investigate','retain','repair_measurement','budget_review','limited_experiment'].includes(finish.recommendation),'model_protocol');
      requireThat(finish.facts.length>0&&finish.facts.length<=100&&new Set(finish.facts).size===finish.facts.length&&finish.facts.every(id=>Object.hasOwn(doc.issuedFacts,id)),'unsupported_fact');
      requireThat(finish.hypotheses.length<=4,'model_protocol');
      if(doc.focus)requireThat(doc.history.some(x=>x.tool==='relations'&&x.args.candidate===doc.focus),'focus_not_investigated');
      requireThat(Object.entries(doc.requiredCounters).every(([candidate,counters])=>!counters.length||finish.hypotheses.some(h=>h.candidate===candidate)),'counterevidence_omitted');
      for(const h of finish.hypotheses){
        requireThat(keys(h,['candidate','supports','counters','causal'])&&['price','stock','media','measurement'].includes(h.candidate)&&Array.isArray(h.supports)&&Array.isArray(h.counters),'model_protocol');
        requireThat(h.causal===false,'causal_claim_forbidden');
        requireThat([...h.supports,...h.counters].every(id=>doc.issuedRecords.includes(id)),'unsupported_evidence');
        const relationResults=doc.history.filter(x=>x.tool==='relations'&&x.result.candidate===h.candidate).map(x=>x.result);
        requireThat(relationResults.length&&h.supports.every(id=>relationResults.some(r=>r.supportIds.includes(id)))&&h.counters.every(id=>relationResults.some(r=>r.counterIds.includes(id))),'unsupported_evidence');
        requireThat((doc.requiredCounters[h.candidate]||[]).every(id=>h.counters.includes(id)),'counterevidence_omitted');
      }
      return this.#change(doc,d=>{d.status='analyzed';d.stage='analysis_complete';d.output={facts:finish.facts.map(id=>d.issuedFacts[id]),hypotheses:finish.hypotheses.map(h=>({...h,kind:'proposed_interpretation',assessment:h.supports.length&&h.counters.length?'mixed':h.supports.length?'support_only':h.counters.length?'counter_only':'unresolved'})),
        recommendation:finish.recommendation,completeness:finish.facts.some(id=>d.issuedFacts[id].value===null)?'partial':'complete_within_selected_facts',causalEffect:null,coverage:'sample',limitations:['synthetic_sample','association_not_causation','bounded_evidence_search']};d.events.push({type:'output_validated',at:this.now()});});
    }
    requireThat(keys(finish,['simulationId','action'])&&['hold','investigate','repair_measurement','limited_experiment','reallocate'].includes(finish.action),'model_protocol');
    const simulation=doc.history.find(x=>x.tool==='simulate'&&x.result.id===finish.simulationId)?.result;
    requireThat(simulation,'simulation_required');
    this.#checkAnalysis(doc);
    return this.#change(doc,d=>{d.output=finish;d.simulation=simulation;d.status=finish.action==='reallocate'?'pending_approval':'retained';d.stage='proposal';d.proposalHash=digest({scope:d.scope,analysisId:d.analysisId,analysisVersion:d.analysisVersion,simulation,action:finish.action});d.events.push({type:'proposal_created',at:this.now()});});
  }
  #invalidate(analysisId,reason){
    for(const p of this.store.list().filter(p=>p.role==='budget'&&p.analysisId===analysisId&&['running','paused','pending_approval','approved'].includes(p.status)))this.#change(p,d=>{d.status='invalidated';d.reason=reason;d.approval=null;});
  }
  resume(id){
    const doc=this.get(id);requireThat(doc.status==='paused'||(doc.status==='running'&&!this.#active.has(id)),'not_resumable');
    requireThat(doc.inputFingerprint===this.tools.fingerprint,'inputs_changed');
    return this.#run(doc);
  }
  cancel(id){const doc=this.get(id);requireThat(['running','paused'].includes(doc.status),'not_cancellable');return this.#change(doc,d=>{d.status='cancelled';d.events.push({type:'cancelled',at:this.now()});});}
  approve(id,{version,principal,expiresAt}){
    return this.store.update(id,version,d=>{
      requireThat(d.role==='budget'&&d.status==='pending_approval','approval_required');
      requireThat(proposalDigest(d)===d.proposalHash,'approval_stale');
      this.#checkAnalysis(d);requireThat(principal?.id&&principal.role===d.simulation.approvalRole,'approval_forbidden');
      requireThat(stamp(expiresAt)&&Date.parse(expiresAt)>Date.parse(this.now()),'approval_expired');
      d.approval={principal,expiresAt,proposalHash:d.proposalHash,inputFingerprint:this.tools.fingerprint,at:this.now()};d.status='approved';d.events.push({type:'approved',at:this.now(),principalId:principal.id});
    });
  }
  reject(id,{version,principal}){
    return this.store.update(id,version,d=>{requireThat(['pending_approval','approved'].includes(d.status),'approval_required');requireThat(principal?.id&&principal.role===d.simulation.approvalRole,'approval_forbidden');d.status='rejected';d.approval=null;d.events.push({type:'rejected',at:this.now()});});
  }
  revise(id,{version,candidateId,modelId}){
    const p=this.get(id);requireThat(p.version===version,'version_conflict');requireThat(['pending_approval','approved','retained'].includes(p.status),'proposal_not_editable');this.#checkAnalysis(p);
    const simulation=this.tools.call('simulate',{baselineId:p.simulation.baseline.recordId,candidateId:candidateId||p.simulation.candidate.recordId,modelId:modelId||p.simulation.modelId,policyId:p.simulation.policyId},p.scope);
    this.#change(p,d=>{d.status='invalidated';d.approval=null;d.reason='proposal_revised';});
    return this.store.create({...p,id:undefined,version:undefined,status:'pending_approval',approval:null,simulation,
      output:{simulationId:simulation.id,action:'reallocate'},revises:id,
      proposalHash:digest({scope:p.scope,analysisId:p.analysisId,analysisVersion:p.analysisVersion,simulation,action:'reallocate'}),events:[...p.events,{type:'revised',at:this.now()}]});
  }
  #checkAnalysis(p){
    const a=this.get(p.analysisId);requireThat(a.status==='analyzed'&&a.version===p.analysisVersion&&!a.supersededBy,'analysis_stale');
    requireThat(p.inputFingerprint===this.tools.fingerprint,'inputs_changed');
  }
  async submit(id,{version,adapter}){
    requireThat(adapter?.mode==='synthetic','real_execution_forbidden');
    let p=this.store.update(id,version,d=>{
      requireThat(d.status==='approved'&&d.approval,'approval_required');this.#checkAnalysis(d);
      requireThat(proposalDigest(d)===d.proposalHash,'approval_stale');
      requireThat(d.approval.proposalHash===d.proposalHash,'approval_stale');requireThat(Date.parse(d.approval.expiresAt)>Date.parse(this.now()),'approval_expired');
      d.status='preflighting';d.intentId=randomUUID();d.events.push({type:'preflight_started',at:this.now()});
    });
    let current;
    try{current=await adapter.preflight(structuredClone(p));}catch{return this.#held(p,'preflight_failed','invalidated');}
    if(allocationKey(current?.allocations)!==allocationKey(p.simulation.baseline.allocations))return this.#held(p,'baseline_drift','invalidated');
    try{this.#checkAnalysis(p);}catch(e){return this.#held(p,e.code,'invalidated');}
    if(Date.parse(p.approval.expiresAt)<=Date.parse(this.now()))return this.#held(p,'approval_expired','invalidated');
    // Persist intent before the external boundary. A lost response is UNKNOWN,
    // never safe-to-retry; the same intent must be reconciled after a restart.
    p=this.#change(p,d=>{d.status='submitting';d.events.push({type:'submit_started',intentId:d.intentId,at:this.now()});});
    try{
      const result=await adapter.submit(structuredClone(p),{idempotencyKey:p.intentId});
      return this.#change(p,d=>{d.status='submitted';d.execution={operationId:result?.operationId||null,intentId:d.intentId};d.events.push({type:'submitted',at:this.now()});});
    }catch{return this.#held(this.get(id),'submit_response_unknown','execution_unknown');}
  }
  async reconcile(id,{adapter}){
    requireThat(adapter?.mode==='synthetic','real_execution_forbidden');let p=this.get(id);
    requireThat(['submitting','submitted','execution_unknown','partial_execution'].includes(p.status),'not_reconcilable');
    let result;try{result=await adapter.status(structuredClone(p));}catch{return this.#held(p,'status_unavailable','execution_unknown');}
    const matched=allocationKey(result?.allocations)===allocationKey(p.simulation.candidate.allocations);
    return this.#change(p,d=>{
      d.status=result?.status==='applied'&&matched?'executed':result?.status==='partial'?'partial_execution':result?.status==='failed'?'execution_failed':result?.status==='pending'?'submitted':'execution_unknown';
      d.execution={...d.execution,intentId:d.intentId,reportedStatus:result?.status||'unknown',verifiedAllocations:matched?result.allocations:null,checkedAt:this.now()};
      d.events.push({type:'reconciled',status:d.status,at:this.now()});
    });
  }
}
