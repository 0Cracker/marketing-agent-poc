import assert from 'node:assert/strict';
import {schemas,ajvInstance,normalize,counts,countries,currencies,zones,toMinor,fromMinor,fieldName,codec,payloads,loadParents} from './contract.mjs';
export function compile(){
 const definitions=schemas(),ajv=ajvInstance(),validators={source:new Map(),common:new Map()};
 for(const [kind,schema] of Object.entries(definitions)){
  assert.ok(ajv.validateSchema(schema),JSON.stringify(ajv.errors));
  for(const branch of schema.oneOf){const t=branch.properties.metadata.properties.dataset_type.enum[0],p=branch.properties.source_profile?.enum[0]??'';validators[kind].set(t+p,ajv.compile(branch));}
 }
 return {definitions,validators};
}
export function schemaErrors(rows,compiled){
 const errors=[],common=[];
 for(const row of rows){
  const t=row.metadata.dataset_type,source=compiled.validators.source.get(t+row.source_profile);
  if(!source||!source(row)){errors.push({record_id:row.metadata.record_id,stage:'source_schema',code:'STRUCTURE',path:source?.errors?.[0]?.instancePath??'$',detail:source?.errors?.slice(0,2)});continue;}
  const n=normalize(row),valid=compiled.validators.common.get(t);
  if(!valid(n))errors.push({record_id:n.metadata.record_id,stage:'common_schema',code:'COMMON_STRUCTURE',path:valid.errors[0].instancePath});
  else common.push(n);
 }
 return {errors,common};
}
const total=m=>toMinor(m);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function semanticErrors(rows){
 const errors=[],parent=loadParents(),all=Object.values(parent).flat(),byId=new Map(rows.map(r=>[r.metadata.record_id,r]));
 const type=t=>rows.filter(r=>r.metadata.dataset_type===t),p=t=>type(t).map(r=>r.payload);
 const variants=new Set(p('T01').map(x=>x.variant_id)),products=new Set(parent.T01.map(x=>x.product_id)),brands=new Set(parent.T01.map(x=>x.brand_id));
 const campaigns=new Set(parent.T12.map(x=>x.campaign_id));
 const orders=new Map(p('T19').map(x=>[x.order_id,x])),lines=new Map(p('T19').map(x=>[x.order_id+'/'+x.line_id,x]));
 const transactions=new Map(p('T19').map(x=>[x.transaction_ref,x.order_id]));
 const sessions=new Set(p('T17').map(x=>x.session_ref));
 const contents=new Map(p('T27').map(x=>[x.content_id,x]));
 const comments=new Map(p('T28').map(x=>[x.comment_id,x]));
 const cohorts=new Map(p('T30').filter(x=>x.record_kind==='cohort').map(x=>[x.cohort_ref,x]));
 const policies=new Map(p('T40').map(x=>[x.policy_id,x])),models=new Map(p('T39').filter(x=>x.record_kind==='model').map(x=>[x.model_id,x]));
 const events=new Map();
 function emit(r,code,field){errors.push({record_id:r.metadata.record_id,stage:'semantic',code,path:'/payload/'+field});}
 function check(r,ok,code,field){if(!ok)emit(r,code,field);}
 for(const r of rows){
  const x=r.payload,m=r.metadata,t=m.dataset_type,c=countries.indexOf(m.country_code);
  check(r,m.country_code==='GLOBAL'||m.reporting_timezone===zones[c],'TIMEZONE','metadata/reporting_timezone');
  if(x.period)check(r,x.period.start<x.period.end,'PERIOD','period');
  const walk=(v,key='')=>{
   if(v&&typeof v==='object'){
    if(Object.hasOwn(v,'amount'))check(r,v.currency===currencies[c]&&/^-?\d+\.\d{2}$/.test(v.amount),'CURRENCY',key);
    for(const [k,z] of Object.entries(v))walk(z,key?key+'/'+k:k);
   }
  };walk(x);
  for(const id of m.parent_record_ids){const par=all.find(z=>z.record_id===id)??byId.get(id);check(r,Boolean(par)&&Date.parse(m.available_at)>=Date.parse(par.available_at??par.metadata.available_at),'PARENT_AVAILABILITY','metadata/parent_record_ids');}
  for(const key of ['event_time','ordered_at','requested_at','processed_at','observed_at','published_at','written_at','created_at','incident_end','status_available_at','delivered_at'])if(x[key])check(r,Date.parse(m.available_at)>=Date.parse(x[key]),'AVAILABILITY',key);
  if(x.variant_ref)check(r,variants.has(x.variant_ref),'VARIANT_REF','variant_ref');
  if(x.product_ref)check(r,products.has(x.product_ref),'PRODUCT_REF','product_ref');
  if(x.campaign_ref)check(r,campaigns.has(x.campaign_ref),'CAMPAIGN_REF','campaign_ref');
  if(x.order_ref)check(r,orders.has(x.order_ref),'ORDER_REF','order_ref');
  if(x.subject_ref)check(r,brands.has(x.subject_ref),'SUBJECT_REF','subject_ref');
  if(t==='T02')check(r,variants.has(x.entity_ref),'ENTITY_REF','entity_ref');
  if(['T04','T32'].includes(t))check(r,x.positive_responses<=x.sample_size,'SAMPLE_EXCEEDED','positive_responses');
  if(t==='T04')check(r,x.positive_rate===x.positive_responses/x.sample_size,'PANEL_RATE','positive_rate');
  if(t==='T05')check(r,['A','B'].some(s=>x.normalization_scope===`D005-${m.country_code}-NORM${s}`),'NORMALIZATION_SCOPE','normalization_scope');
  if(t==='T06')check(r,total(x.bid_lower)<=total(x.bid_upper),'BID_BOUNDS','bid_lower');
  if(t==='T07')check(r,x.clicks<=x.impressions,'CLICKS_EXCEEDED','clicks');
  if(t==='T10')check(r,Date.parse(x.first_seen)<=Date.parse(x.observed_at)&&Date.parse(x.last_seen)<=Date.parse(x.observed_at),'AD_TIME','first_seen');
  if(t==='T11')check(r,x.subject_refs.every(z=>products.has(z)),'DOCUMENT_SUBJECT','subject_refs');
  if(t==='T14'){
   const par=parent.T13.find(z=>z.record_id===x.parent_record_id),siblings=p('T14').filter(z=>z.parent_record_id===x.parent_record_id);
   check(r,Boolean(par)&&siblings.length===2,'SEGMENT_PARENT','parent_record_id');
   if(par)for(const k of Object.keys(x.metrics)){const sum=siblings.reduce((n,z)=>n+(typeof z.metrics[k]==='number'?BigInt(z.metrics[k]):total(z.metrics[k])),0n);check(r,sum===(typeof par[k]==='number'?BigInt(par[k]):total({amount:par[k],currency:par.currency})),'SEGMENT_TOTAL','metrics/'+k);}
  }
  if(t==='T17'){
   check(r,!events.has(x.event_id),'EVENT_COLLISION','event_id');events.set(x.event_id,t);
   if(/S[46]$/.test(x.session_ref))check(r,x.consent_state==='denied','CONSENT','consent_state');
  }
  if(t==='T18'){
   if(x.transaction_ref)check(r,transactions.has(x.transaction_ref),'TRANSACTION_REF','transaction_ref');
   if(x.session_ref!==null)check(r,sessions.has(x.session_ref),'SESSION_REF','session_ref');
   if(x.event_name==='purchase'&&transactions.has(x.transaction_ref)){
    const order=transactions.get(x.transaction_ref),line=p('T19').find(z=>z.order_id===order&&z.variant_ref===x.variant_ref);
    check(r,Boolean(line)&&line.quantity===x.quantity&&total(x.unit_price)*BigInt(x.quantity)===total(line.line_gross_total),'PURCHASE_RECONCILIATION','unit_price');
   }
   if(x.event_name==='refund'){const a=p('T20').find(z=>z.adjustment_id===x.adjustment_ref);check(r,Boolean(a)&&a.status==='completed'&&same(a.refund_amount,x.refund_amount)&&a.quantity===x.quantity,'REFUND_RECONCILIATION','refund_amount');}
  }
  if(t==='T19')check(r,total(x.unit_price)*BigInt(x.quantity)-total(x.line_discount)+total(x.line_tax)===total(x.line_gross_total),'LINE_TOTAL','line_gross_total');
  if(t==='T20'){
   const line=lines.get(x.order_line_ref);check(r,Boolean(line)&&line.order_id===x.order_ref,'ORDER_LINE_REF','order_line_ref');
   if(x.status==='completed'){
    check(r,Boolean(line)&&x.quantity<=line.quantity,'REFUND_QUANTITY','quantity');
    check(r,Date.parse(x.requested_at)<=Date.parse(x.processed_at),'REFUND_TIME','processed_at');
   }else check(r,!Object.hasOwn(x,'processed_at')&&!Object.hasOwn(x,'refund_amount'),'PENDING_FIELDS','status');
  }
  if(t==='T21')for(const other of type('T21'))if(other!==r&&other.metadata.country_code===m.country_code&&other.payload.variant_ref===x.variant_ref)check(r,!(x.period.start<other.payload.period.end&&other.payload.period.start<x.period.end),'COST_OVERLAP','period');
  if(t==='T23'&&x.record_kind==='shipment'){
   if(x.delivered_at)check(r,Boolean(x.shipped_at)&&Date.parse(x.shipped_at)<=Date.parse(x.delivered_at),'SHIPMENT_TIME','delivered_at');
   check(r,x.status!=='unshipped'||!x.shipped_at,'SHIPMENT_STATE','status');
   check(r,(x.status==='delivered')===Boolean(x.delivered_at),'SHIPMENT_STATE','delivered_at');
  }
  if(t==='T25'){
   if(x.record_kind==='annotation'){
    const review=parent.T24.find(z=>z.record_id===x.review_ref),s=x.evidence_span;
    check(r,Boolean(review)&&review.product_id===x.product_ref&&review.country_code===m.country_code&&Array.from(review.body_text).slice(s.start,s.end).join('')===s.quote,'EVIDENCE_SPAN','evidence_span');
   }else check(r,x.sample_size===2&&x.mention_count===1&&x.review_refs.length===2&&new Set(x.review_refs).size===2,'REVIEW_DENOMINATOR','sample_size');
  }
  if(t==='T27'){
   const previous=type('T27').filter(z=>z.payload.content_id===x.content_id&&z.payload.observed_at<x.observed_at);check(r,previous.every(z=>z.payload.view_count<=x.view_count),'CUMULATIVE_DECREASE','view_count');
  }
  if(t==='T28'){
   check(r,contents.has(x.content_ref),'CONTENT_REF','content_ref');
   if(x.parent_comment_ref)check(r,comments.get(x.parent_comment_ref)?.content_ref===x.content_ref,'COMMENT_PARENT','parent_comment_ref');
  }
  if(t==='T29')check(r,x.content_refs.every(z=>contents.has(z)),'COLLAB_CONTENT','content_refs');
  if(t==='T30'&&x.record_kind==='cohort'){
   check(r,x.sample_size===new Set(x.customer_set).size&&x.sample_size===x.order_refs.length,'COHORT_SAMPLE','sample_size');
   const sum=p('T19').filter(z=>x.order_refs.includes(z.order_id)).reduce((n,z)=>n+total(z.line_gross_total),0n)-p('T20').filter(z=>z.status==='completed'&&x.order_refs.includes(z.order_ref)).reduce((n,z)=>n+total(z.refund_amount),0n);
   check(r,sum===total(x.net_revenue),'COHORT_NET','net_revenue');
  }
  if(t==='T31'){check(r,cohorts.has(x.cohort_ref),'COHORT_REF','cohort_ref');check(r,x.unique_clicks<=x.emails_sent-x.bounces,'CRM_REACH','unique_clicks');}
  if(t==='T33'&&x.supersedes_record_id){const prev=byId.get(x.supersedes_record_id);check(r,Boolean(prev)&&prev.metadata.country_code===m.country_code&&prev.payload.statistics_table_id===x.statistics_table_id&&same(prev.payload.period,x.period)&&prev.payload.revision<x.revision,'REVISION_SCOPE','supersedes_record_id');}
  if(t==='T37'&&x.record_kind==='incident')check(r,Date.parse(x.incident_start)<Date.parse(x.incident_end),'INCIDENT_TIME','incident_end');
  if(t==='T38')check(r,x.conversions<=x.sample_size,'EXPERIMENT_SAMPLE','conversions');
  if(t==='T39'&&x.record_kind==='budget_candidate'){
   const model=models.get(x.model_ref),policy=policies.get(x.policy_ref);
   check(r,total(x.allocations.search)+total(x.allocations.social)===total(x.total_budget),'BUDGET_TOTAL','allocations');
   check(r,Boolean(policy)&&policy.status==='approved'&&policy.period.start<=x.period.start&&x.period.end<=policy.period.end&&same(policy.budget,x.total_budget),'POLICY_PERIOD','policy_ref');
   check(r,Boolean(model),'MODEL_REF','model_ref');
   if(model){for(const channel of ['search','social'])check(r,total(x.allocations[channel])>=total(model.bounds[channel].lower)&&total(x.allocations[channel])<=total(model.bounds[channel].upper),'BUDGET_BOUNDS','allocations/'+channel);const s=total(model.unit_budget);check(r,Number(total(x.allocations.search)*2n+total(x.allocations.social))/Number(20n*s)===x.predicted_conversions,'PREDICTION','predicted_conversions');}
  }
  if(t==='T40')check(r,x.kpi_definition_ref==='D005-KPI-conversions','KPI_REF','kpi_definition_ref');
 }
 return errors;
}
export function validate(rows,compiled){const result=schemaErrors(rows,compiled);return {...result,errors:[...result.errors,...(result.errors.length?[]:semanticErrors(result.common))]};}
export const errorSpecs=[
 ['T02','external_value','ENTITY_REF',x=>x.entity_ref='D005-MISSING'],
 ['T04','sample_size','SAMPLE_EXCEEDED',x=>x.positive_responses=x.sample_size+1],
 ['T05','query_id','NORMALIZATION_SCOPE',x=>x.normalization_scope='D005-MISSING'],
 ['T06','keyword','BID_BOUNDS',x=>x.bid_lower=fromMinor(total(x.bid_upper)+1n,x.bid_upper.currency)],
 ['T07','site_ref','CLICKS_EXCEEDED',x=>x.clicks=x.impressions+1],
 ['T10','public_ad_id','AD_TIME',x=>x.first_seen='2026-09-01T12:00:00+09:00'],
 ['T11','document_id','DOCUMENT_SUBJECT',x=>x.subject_refs=['D005-MISSING']],
 ['T14','campaign_ref','SEGMENT_TOTAL',x=>x.metrics.spend=fromMinor(total(x.metrics.spend)+1n,x.metrics.spend.currency)],
 ['T15','campaign_ref','CAMPAIGN_REF',x=>x.campaign_ref='D005-MISSING'],
 ['T16','creative_id','PERIOD',x=>x.period.end='2026-06-01'],
 ['T17','event_id','EVENT_COLLISION',(x,all,r)=>{x.event_id=all.find(z=>z.metadata.dataset_type==='T17'&&z.metadata.record_id!==r.metadata.record_id).payload.event_id;}],
 ['T18','transaction_ref','TRANSACTION_REF',x=>x.transaction_ref='D005-MISSING',x=>x.event_name==='purchase'],
 ['T19','line_id','LINE_TOTAL',x=>x.line_gross_total=fromMinor(total(x.line_gross_total)+1n,x.line_gross_total.currency)],
 ['T20','refund_amount','REFUND_QUANTITY',x=>x.quantity=999,x=>x.status==='completed'],
 ['T21','accounting_basis','COST_OVERLAP',x=>x.period.end='2026-08-08'],
 ['T23','order_ref','SHIPMENT_TIME',x=>x.delivered_at='2026-08-01T12:00:00+09:00',x=>x.status==='delivered'],
 ['T25','evidence_span','EVIDENCE_SPAN',x=>x.evidence_span.start+=1,x=>x.record_kind==='annotation'],
 ['T26','link_status','ORDER_REF',x=>x.order_ref='D005-MISSING',x=>x.link_status==='confirmed'],
 ['T27','content_id','CUMULATIVE_DECREASE',x=>x.view_count=0,x=>x.view_count===150],
 ['T28','content_ref','COMMENT_PARENT',(x,all,r)=>{x.parent_comment_ref=all.find(z=>z.metadata.dataset_type==='T28'&&z.payload.content_ref!==r.payload.content_ref).payload.comment_id;},x=>Object.hasOwn(x,'parent_comment_ref')],
 ['T29','collaboration_id','COLLAB_CONTENT',x=>x.content_refs=['D005-MISSING']],
 ['T30','cohort_ref','COHORT_SAMPLE',x=>x.sample_size=1,x=>x.record_kind==='cohort'],
 ['T31','emails_sent','CRM_REACH',x=>x.unique_clicks=3],
 ['T32','sampling_method','SAMPLE_EXCEEDED',x=>x.positive_responses=51],
 ['T33','statistics_table_id','REVISION_SCOPE',(x,all,r)=>{x.supersedes_record_id=all.find(z=>z.metadata.dataset_type==='T33'&&z.metadata.country_code!==r.metadata.country_code).metadata.record_id;},x=>x.revision===1],
 ['T34','station_ref','PERIOD',x=>x.period.end='2026-08-01',x=>x.record_kind==='weather'],
 ['T37','measures','INCIDENT_TIME',x=>x.incident_end='2026-08-01T12:00:00+09:00',x=>x.record_kind==='incident',x=>x.record_kind==='performance'],
 ['T38','arm_id','EXPERIMENT_SAMPLE',x=>x.conversions=101],
 ['T39','allocations','BUDGET_TOTAL',x=>x.allocations.search=fromMinor(total(x.total_budget)+1n,x.total_budget.currency),x=>x.record_kind==='budget_candidate'],
 ['T40','approval_role','KPI_REF',x=>x.kpi_definition_ref='D005-MISSING']
];
export function runErrors(raw,compiled){
 const common=raw.map(normalize),results=[];
 for(const [type,field,expected,mutate,selector=()=>true,structSelector=x=>Object.hasOwn(x,field)] of errorSpecs)for(const kind of ['structure','semantic']){
  const index=common.findIndex(r=>r.metadata.dataset_type===type&&(kind==='structure'?structSelector:selector)(r.payload));assert.ok(index>=0,type);
  const source=structuredClone(raw),target=structuredClone(common[index]);
  let rule;
  if(kind==='structure'){delete source[index].payload[fieldName(field,source[index].source_profile)];rule='delete '+field;}
  else{mutate(target.payload,common,target);source[index].payload=codec(target.payload,payloads[type],source[index].source_profile);rule=mutate.toString();}
  const actual=validate(source,compiled).errors,code=kind==='structure'?'STRUCTURE':expected,stage=kind==='structure'?'source_schema':'semantic';
  const found=actual.find(e=>e.code===code&&e.stage===stage);
  results.push({case_id:type+'-'+kind,target_record_id:target.metadata.record_id,source_json_path:'$.payload.'+fieldName(kind==='structure'?field:((found?.path??'').split('/')[2]??field),source[index].source_profile),mutation_rule:rule,expected_code:code,expected_stage:stage,detected:found??null,status:found?'pass':'fail'});
 }
 return results;
}
