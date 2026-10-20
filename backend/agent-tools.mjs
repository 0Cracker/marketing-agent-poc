import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

export class FlowError extends Error {
  constructor(code){super(code);this.code=code;}
}
export const requireThat=(condition,code)=>{if(!condition)throw new FlowError(code);};
export const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const ontologyText=readFileSync(new URL('../docs/research/marketing-ontology/common-contract/ontology.ttl',import.meta.url),'utf8');
const ontologyPredicates=[...ontologyText.matchAll(/m:(\w+) rdf:type owl:ObjectProperty/g)].map(m=>m[1]);
const ontologyView={kind:'typed_projection',version:ontologyText.match(/owl:versionInfo "([^"]+)"/)?.[1],sha256:digest(ontologyText),predicates:ontologyPredicates};
const ruleHash=digest(readFileSync(new URL(import.meta.url),'utf8'));
const zones={KR:'Asia/Seoul',JP:'Asia/Tokyo',US:'America/New_York'};
const currencies={KR:'KRW',JP:'JPY',US:'USD'};
const dateOnly=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const stamp=s=>typeof s==='string'&&/T.*(?:Z|[+-]\d\d:\d\d)$/.test(s)&&Number.isFinite(Date.parse(s));
const contains=(s,p)=>p&&s.start<=p.start&&p.end_exclusive<=s.end;
const covers=(s,p)=>p&&p.start<=s.start&&s.end<=p.end_exclusive;
const overlaps=(s,p)=>p&&p.start<s.end&&s.start<p.end_exclusive;
const exactKeys=(args,keys)=>args&&typeof args==='object'&&!Array.isArray(args)&&Object.keys(args).every(k=>keys.includes(k));

// Money never passes through binary floating point. Source precision is retained
// as cents internally; unsupported precision is rejected instead of rounded in.
export function cents(s){
  requireThat(typeof s==='string'&&/^\d+(?:\.\d{1,2})?$/.test(s),'money_invalid');
  const [whole,fraction='']=s.split('.');return BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
}
const gcd=(a,b)=>b?gcd(b,a%b):a;
function add([a,b],[c,d]){const n=a*d+c*b,q=b*d,g=gcd(n,q);return [n/g,q/g];}
function decimal([n,d],places=6){
  requireThat(d>0n,'denominator_zero');const scale=10n**BigInt(places),v=(n*scale*2n+d)/(2n*d);
  return `${v/scale}.${(v%scale).toString().padStart(places,'0')}`;
}
const copy=x=>structuredClone(x);

// Existing global parameters retain historical per-allocation semantics.
// Channel parameters are complete pairs and cannot silently mix with defaults.
export function budgetResponseParameters(parameters){
  requireThat(Array.isArray(parameters)&&parameters.length>0,'model_unsupported');
  const names=new Set(),values={};
  for(const p of parameters){
    requireThat(p&&typeof p.name==='string'&&!names.has(p.name)&&/^(?:(?:search|social)\.)?(?:scale|saturation)$/.test(p.name)&&typeof p.value==='string'&&/^\d+$/.test(p.value),'model_unsupported');
    names.add(p.name);values[p.name]=p.value;
  }
  const valid=p=>p.scale!==undefined&&p.saturation!==undefined&&BigInt(p.scale)>0n&&BigInt(p.saturation)>0n;
  const global={scale:values.scale,saturation:values.saturation},channels={};
  if(names.has('scale')||names.has('saturation'))requireThat(valid(global),'model_unsupported');
  for(const channel of ['search','social'])if(names.has(channel+'.scale')||names.has(channel+'.saturation')){
    const p={scale:values[channel+'.scale'],saturation:values[channel+'.saturation']};requireThat(valid(p),'model_unsupported');channels[channel]=p;
  }
  const channelSpecific=Object.keys(channels).length>0;
  requireThat(channelSpecific||valid(global),'model_unsupported');
  return {global,channels,channelSpecific};
}

export class CatalogTools {
  #entries;#byId;#variants=new Map();#campaigns=new Map();#manifest;
  constructor(catalog,{manifest}={}){
    this.#manifest=manifest;
    this.#entries=catalog.map(x=>({batch:x.batch,country:x.country,record:copy(x.record),schema_conforming:x.schema_conforming}));
    this.#byId=new Map(this.#entries.map(x=>[x.record.record_id,x]));
    for(const x of catalog){const r=x.record,p=x.payload;
      if(r.dataset_type==='T01'){
        const id=r.product_id||p.product_id,variant=r.variant_id||p.variant_id;
        if(id&&variant)this.#variants.set(variant,id);
      }
      if(r.dataset_type==='T12')this.#campaigns.set(r.campaign_id,r);
    }
    this.fingerprint=digest({records:this.#entries,ontology:ontologyView.sha256,ruleHash,...(manifest?{dataHash:manifest.data_sha256}:{})});
  }
  validateScope(s){
    requireThat(s&&s.batch&&s.country&&s.scopeId&&s.start&&s.end&&s.asOf&&Array.isArray(s.productIds)&&s.productIds.length,'scope_required');
    requireThat(exactKeys(s,['batch','country','scopeId','productIds','start','end','asOf','dataHash'])&&zones[s.country]&&dateOnly(s.start)&&dateOnly(s.end)&&s.start<s.end&&stamp(s.asOf)&&s.productIds.length<=6&&new Set(s.productIds).size===s.productIds.length,'scope_invalid');
    if(this.#manifest){requireThat(s.batch==='CURRENT'&&s.scopeId==='CURRENT-'+s.country,'scope_invalid');requireThat(s.dataHash===this.#manifest.data_sha256,'inputs_changed');}
    requireThat(this.#entries.some(x=>x.batch===s.batch&&x.country===s.country&&this.#scopeMatches(x.record.scope_id,s)),'scope_invalid');
    const products=new Set(this.#variants.values());
    requireThat(s.productIds.every(id=>typeof id==='string'&&products.has(id)),'product_unknown');
    return copy(s);
  }
  #products(r){
    if(r.subject_ref)return [r.subject_ref];
    if(r.variant_ref)return [this.#variants.get(r.variant_ref)];
    if(r.product_refs)return r.product_refs;
    if(r.campaign_ref)return this.#campaigns.get(r.campaign_ref)?.product_refs||[];
    if(r.record_kind==='budget_scenario')return r.allocations.flatMap(a=>this.#campaigns.get(a.campaign_ref)?.product_refs||[]);
    return [];
  }
  #scopeMatches(id,s){return this.#manifest&&s.batch==='CURRENT'?this.#manifest.scope_ids[s.country]?.includes(id):id===s.scopeId;}
  #inScope(x,s,{includeGaps=false}={}){
    const r=x.record;
    // CURRENT dummy acquisition times are metadata, not point-in-time eligibility.
    const ignoreAvailableAt=this.#manifest&&s.batch==='CURRENT'&&r.is_synthetic;
    if(x.batch!==s.batch||x.country!==s.country||!this.#scopeMatches(r.scope_id,s)||!r.is_synthetic||(!includeGaps&&!x.schema_conforming)||(!ignoreAvailableAt&&(!stamp(r.temporal?.available_at)||Date.parse(r.temporal.available_at)>Date.parse(s.asOf))))return false;
    const products=this.#products(r);if(products.length&&!products.some(p=>s.productIds.includes(p)))return false;
    if(r.temporal.reporting_timezone!==zones[s.country])return false;
    if(r.period){
      if(r.period.timezone!==zones[s.country])return false;
      if(['T12','T40'].includes(r.dataset_type)){if(!overlaps(s,r.period))return false;}
      else if(!contains(s,r.period))return false;
    }
    const parent=r.review_ref&&this.#byId.get(r.review_ref)?.record;
    const instant=r.observed_at||r.written_at||r.changed_at||parent?.written_at;
    if(instant&&(instant.slice(0,10)<s.start||instant.slice(0,10)>=s.end))return false;
    return true;
  }
  #rows(s,type){return this.#entries.filter(x=>x.record.dataset_type===type&&this.#inScope(x,s)).map(x=>x.record);}
  quality(scope){
    this.validateScope(scope);
    const all=this.#entries.filter(x=>this.#inScope(x,scope,{includeGaps:true}));
    return {available:all.filter(x=>x.schema_conforming).length,excluded:all.filter(x=>!x.schema_conforming).length,rawFallback:false,coverage:'sample'};
  }
  call(name,args,scope){
    this.validateScope(scope);
    const signatures={market_compare:[],observations:['type','offset','limit'],relations:['candidate'],evidence:['ids'],budget_inputs:[],simulate:['baselineId','candidateId','modelId','policyId']};
    requireThat(Object.hasOwn(signatures,name),'tool_forbidden');
    requireThat(exactKeys(args,signatures[name]),'tool_arguments');
    let result;
    if(name==='market_compare')result=this.#market(scope);
    if(name==='observations')result=this.#observations(scope,args);
    if(name==='relations')result=this.#relations(scope,args);
    if(name==='evidence')result=this.#evidence(scope,args);
    if(name==='budget_inputs')result=this.#budgetInputs(scope);
    if(name==='simulate')result=this.#simulate(scope,args);
    return copy(result);
  }
  #observations(s,{type,offset=0,limit=24}){
    requireThat(['T08','T13','T22'].includes(type)&&Number.isInteger(offset)&&offset>=0&&Number.isInteger(limit)&&limit>=1&&limit<=80,'tool_arguments');
    const rows=this.#rows(s,type);requireThat(rows.length,'data_unavailable');
    const chosen=rows.slice(offset,offset+limit),facts=[];
    for(const r of chosen){
      const entries=type==='T22'?[['available_quantity',r.available_quantity,'count']]:type==='T08'?[['listed_price',r.listed_price?.amount??null,r.listed_price?.currency||currencies[s.country]]]:
        Object.entries(r.metrics).map(([key,value])=>[key,value&&typeof value==='object'?value.amount:value,['spend','attributed_value'].includes(key)?currencies[s.country]:'count']);
      for(const [field,value,unit] of entries)facts.push({id:r.record_id+'.'+field,recordId:r.record_id,field,value:value??null,unit,availability:value===null||value===undefined?'missing':'present',
        period:r.period||null,observedAt:r.observed_at||null,source:r.provenance.artifact_ref,isSynthetic:true});
    }
    return {facts,recordIds:chosen.map(r=>r.record_id),total:rows.length,nextOffset:offset+limit<rows.length?offset+limit:null,
      completeness:facts.some(f=>f.availability==='missing')?'partial':'complete_within_page',coverage:'sample',
      limitations:[...(type==='T22'?['snapshot_not_duration']:[]),...(type==='T08'?['tax_shipping_not_assumed']:[]),'bounded_sample'],causalEffect:null};
  }
  #market(s){
    requireThat(s.start.endsWith('-01')&&s.end.endsWith('-01'),'period_incomparable');
    const rows=this.#rows(s,'T03');requireThat(rows.length,'data_unavailable');
    const months=[];for(let d=new Date(s.start+'T00:00:00Z');d.toISOString().slice(0,10)<s.end;d.setUTCMonth(d.getUTCMonth()+1))months.push(d.toISOString().slice(0,10));
    requireThat(months.length<=36,'scope_too_large');
    const facts=[];
    for(const month of months){
      const part=rows.filter(r=>r.period.start===month);
      const denominators=new Set(part.map(r=>JSON.stringify(r.market_total_value)));
      requireThat(denominators.size===1,'denominator_conflict');
      for(const product of s.productIds){
        const same=part.filter(r=>r.subject_ref===product);
        requireThat(same.length===1,'period_incomplete');const r=same[0];
        requireThat(r.period.grain==='month'&&r.period.end_exclusive===new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),1)).toISOString().slice(0,10),'period_incomparable');
        requireThat(r.sales_value&&r.market_total_value&&r.sales_value.currency===currencies[s.country]&&r.market_total_value.currency===r.sales_value.currency,'currency_mismatch');
        const numerator=cents(r.sales_value.amount),denominator=cents(r.market_total_value.amount);
        requireThat(denominator>0n,'denominator_zero');
        for(const [field,value,unit] of [['sales_value',r.sales_value.amount,r.sales_value.currency],['market_total_value',r.market_total_value.amount,r.market_total_value.currency],['share',decimal([numerator,denominator]),'ratio']]){
          facts.push({id:r.record_id+'.'+field,recordId:r.record_id,field,value,unit,product,period:r.period,
            source:r.provenance.artifact_ref,classification:'observed_or_calculated',isSynthetic:true});
        }
      }
    }
    return {facts,recordIds:[...new Set(facts.map(f=>f.recordId))],coverage:'sample',causalEffect:null};
  }
  #relations(s,{candidate}){
    requireThat(['price','stock','media','measurement'].includes(candidate),'tool_arguments');
    let selected=[],supportIds=[],counterIds=[],total=0;
    if(candidate==='price'){
      const annotations=this.#rows(s,'T25').filter(r=>r.aspect_ref==='가격');
      const negative=annotations.filter(r=>r.sentiment==='negative').slice(0,8),positive=annotations.filter(r=>r.sentiment==='positive').slice(0,8);
      supportIds=negative.map(r=>r.record_id);counterIds=positive.map(r=>r.record_id);
      const prices=this.#rows(s,'T08');total=annotations.length+prices.length;
      selected=[...negative,...positive,...prices.slice(0,8)];
    }else {const available=this.#rows(s,candidate==='stock'?'T22':candidate==='media'?'T12':'T36');total=available.length;selected=available.slice(0,24);}
    requireThat(selected.length,'data_unavailable');
    const edges=[];
    for(const r of selected){
      if(r.dataset_type==='T12')for(const id of r.product_refs.filter(id=>s.productIds.includes(id)))edges.push({from:r.campaign_id,predicate:'promotes',to:id,evidenceId:r.record_id});
      if(r.subject_ref)edges.push({from:'entity:'+r.record_id,predicate:'subject',to:r.subject_ref,evidenceId:r.record_id});
      if(r.variant_ref){
        edges.push({from:'entity:'+r.record_id,predicate:'subject',to:r.variant_ref,evidenceId:r.record_id});
        edges.push({from:r.variant_ref,predicate:'variantOf',to:this.#variants.get(r.variant_ref),evidenceId:r.record_id});
      }
      if(r.review_ref){
        edges.push({from:'entity:'+r.record_id,predicate:'evidenceSpan',to:'span:'+r.record_id,evidenceId:r.record_id});
        edges.push({from:'span:'+r.record_id,predicate:'sourceRecord',to:r.review_ref,evidenceId:r.record_id});
      }
      edges.push({from:'entity:'+r.record_id,predicate:'sourceRecord',to:r.record_id,evidenceId:r.record_id});
      edges.push({from:r.record_id,predicate:'artifact',to:r.provenance.artifact_ref,evidenceId:r.record_id});
    }
    requireThat(edges.every(e=>ontologyPredicates.includes(e.predicate)),'ontology_contract_changed');
    for(const r of selected.filter(r=>r.evidence_span))this.#validateSpan(r,s);
    return {edges,records:selected,recordIds:selected.map(r=>r.record_id),supportIds,counterIds,candidate,
      ontology:ontologyView,total,truncated:selected.length<total,coverage:'sample',causalEffect:null,limitations:['association_not_causation','bounded_sample','hypothesis_links_not_asserted_to_ontology',...(candidate==='price'?['tax_shipping_not_assumed']:[])]};
  }
  #validateSpan(r,s){
    const parent=this.#byId.get(r.review_ref),span=r.evidence_span;
    requireThat(parent&&this.#inScope(parent,s),'evidence_out_of_scope');
    requireThat(span.record_ref===parent.record.record_id&&span.field_path==='$.body_text'&&Number.isInteger(span.start_offset)&&Number.isInteger(span.end_offset)&&span.start_offset>=0&&span.end_offset>span.start_offset&&[...parent.record.body_text].slice(span.start_offset,span.end_offset).join('')===span.quote,'evidence_span_mismatch');
  }
  #evidence(s,{ids}){
    requireThat(Array.isArray(ids)&&ids.length>0&&ids.length<=24&&ids.every(id=>typeof id==='string')&&new Set(ids).size===ids.length,'tool_arguments');
    const records=ids.map(id=>{const x=this.#byId.get(id);requireThat(x&&this.#inScope(x,s),'evidence_out_of_scope');if(x.record.evidence_span)this.#validateSpan(x.record,s);return x.record;});
    return {records,recordIds:ids};
  }
  #budgetInputs(s){
    const scenarios=this.#rows(s,'T39').filter(r=>r.record_kind==='budget_scenario');
    const models=this.#rows(s,'T39').filter(r=>r.record_kind==='response_model'&&this.#scopeMatches(r.validity_scope,s));
    const policies=this.#rows(s,'T40').filter(r=>covers(s,r.period)&&r.product_refs.some(p=>s.productIds.includes(p)));
    requireThat(scenarios.length&&models.length&&policies.length,'budget_inputs_missing');
    return {scenarios,models,policies,recordIds:[...scenarios,...models,...policies].map(r=>r.record_id),realExecutionAllowed:false};
  }
  #simulate(s,args){
    requireThat(Object.values(args).length===4&&Object.values(args).every(v=>typeof v==='string'),'tool_arguments');
    const {scenarios,models,policies}=this.#budgetInputs(s);
    const baseline=scenarios.find(r=>r.record_id===args.baselineId),candidate=scenarios.find(r=>r.record_id===args.candidateId),model=models.find(r=>r.record_id===args.modelId),policy=policies.find(r=>r.record_id===args.policyId);
    requireThat(baseline&&candidate&&model&&policy,'budget_incompatible');
    requireThat(JSON.stringify(baseline.period)===JSON.stringify(candidate.period)&&baseline.total_budget.currency===candidate.total_budget.currency&&baseline.total_budget.currency===policy.budget_limit.currency&&baseline.total_budget.amount===candidate.total_budget.amount,'budget_incompatible');
    requireThat(model.formula==='scale * budget / (saturation + budget)'&&model.assumptions?.length&&model.is_synthetic&&policy.is_synthetic,'model_unsupported');
    const params=budgetResponseParameters(model.parameters);
    const evaluate=r=>{
      const channels=new Set(),ids=new Set(),byChannel=new Map(),campaignChannels={};let sum=0n,value=[0n,1n];
      for(const a of r.allocations){
        const campaign=this.#campaigns.get(a.campaign_ref);
        requireThat(campaign&&this.#inScope(this.#byId.get(campaign.record_id),s)&&covers({start:r.period.start,end:r.period.end_exclusive},campaign.period)&&campaign.product_refs.every(p=>s.productIds.includes(p)&&policy.product_refs.includes(p))&&policy.allowed_channels.includes(campaign.channel)&&!ids.has(a.campaign_ref),'budget_incompatible');
        ids.add(a.campaign_ref);channels.add(campaign.channel);campaignChannels[a.campaign_ref]=campaign.channel;
        requireThat([a.amount,a.lower,a.upper].every(v=>v.currency===r.total_budget.currency),'currency_mismatch');
        const amount=cents(a.amount.amount);requireThat(cents(a.lower.amount)<=amount&&amount<=cents(a.upper.amount),'budget_bounds');
        sum+=amount;
        if(params.channelSpecific){requireThat(params.channels[campaign.channel],'model_unsupported');byChannel.set(campaign.channel,(byChannel.get(campaign.channel)||0n)+amount);}
        else value=add(value,[BigInt(params.global.scale)*amount,BigInt(params.global.saturation)*100n+amount]);
      }
      // Channel maxima apply once per channel, never once per campaign.
      for(const [channel,amount] of byChannel){const p=params.channels[channel];value=add(value,[BigInt(p.scale)*amount,BigInt(p.saturation)*100n+amount]);}
      requireThat(ids.size>0&&sum===cents(r.total_budget.amount)&&sum<=cents(policy.budget_limit.amount),'budget_total');
      return {recordId:r.record_id,allocations:r.allocations,total:r.total_budget,expected:decimal(value),channels:[...channels],...(params.channelSpecific?{campaignChannels}:{})};
    };
    const result={kind:'assumption_simulation',baseline:evaluate(baseline),candidate:evaluate(candidate),modelId:model.record_id,modelVersion:model.model_version,assumptions:model.assumptions,
      ...(params.channelSpecific?{formula:model.formula,parameters:model.parameters,responseAggregation:'channel'}:{}),
      policyId:policy.record_id,approvalRole:policy.approval_role,period:candidate.period,realExecutionAllowed:false,
      recordIds:[baseline.record_id,candidate.record_id,model.record_id,policy.record_id],inputFingerprint:this.fingerprint};
    requireThat(JSON.stringify(result.baseline.allocations.map(a=>a.campaign_ref).sort())===JSON.stringify(result.candidate.allocations.map(a=>a.campaign_ref).sort()),'budget_incompatible');
    return {id:digest(result),...result};
  }
}
