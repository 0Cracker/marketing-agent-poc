// D005 profile decoding remains in contract.mjs. This module owns the next boundary.
import {version,fieldName} from '../batches/D005/contract.mjs';

export const mappingVersion='D005-CANONICAL-1';
const identityFields={
 T02:'mapping_kind entity_ref external_system external_value match_status',
 T04:'panel_id subject_ref sample_size weighting_method',
 T05:'query_id index_value normalization_scope search_surface',
 T06:'keyword language estimated_searches competition_level competition_index',
 T07:'site_ref page_ref query device impressions clicks average_position',
 T10:'public_ad_id advertiser_ref observed_at format creative_text',
 T11:'document_id publisher published_at event_time body_text subject_refs',
 T14:'campaign_ref', T15:'campaign_ref competitor_domain impression_share overlap_rate',
 T16:'creative_id campaign_ref product_refs format message_text',
 T17:'event_id event_time event_name site_ref session_ref page_ref device consent_state',
 T18:'event_id event_time event_name item_index session_ref variant_ref quantity measurement_basis transaction_ref unit_price refund_amount',
 T19:'order_id line_id transaction_ref ordered_at variant_ref quantity unit_price line_discount line_tax line_gross_total fulfilment_status',
 T20:'adjustment_id adjustment_kind order_ref order_line_ref requested_at processed_at quantity refund_amount status reason_code restocked',
 T21:'variant_ref unit_cost margin_definition accounting_basis',
 T23:'record_kind product_ref order_ref promised_at shipped_at delivered_at status',
 T25:'record_kind sentiment review_ref assessment_status mention_count sample_size',
 T26:'ticket_id created_at message_text order_ref link_status',
 T27:'content_id published_at observed_at title description_text view_count',
 T28:'comment_id content_ref written_at body_text parent_comment_ref',
 T29:'collaboration_id agreement_status content_refs',
 T30:'record_kind cohort_ref sample_size repeat_purchase_rate net_revenue stage',
 T31:'crm_campaign_id emails_sent bounces unsubscribes open_measurement_basis linked_orders',
 T32:'study_id subject_ref question_text sample_size sampling_method',
 T33:'statistics_table_id region_ref value unit revision supersedes_record_id',
 T34:'record_kind station_ref', T37:'record_kind page_ref device incident_start incident_end status error_text',
 T38:'experiment_id arm_id sample_size conversions',
 T39:'record_kind model_ref formula total_budget',
 T40:'policy_id approval_role',
};
export {identityFields};

export function convert(row, schema, context){
 const {metadata:m,payload:p}=row, type=m.dataset_type, def=schema.$defs[type];
 const record={},lineage=[];
 const put=(target,value,sources,rule='declared-field-copy')=>{
  if(value===undefined)return;
  record[target]=structuredClone(value);
  const previous=lineage.findIndex(entry=>entry.target==='/'+target);
  if(previous!==-1)lineage.splice(previous,1);
  lineage.push({target:'/'+target,sources:Array.isArray(sources)?sources:[sources],rule});
 };
 for(const key of ['record_id','dataset_type','scope_id','scenario_id','is_synthetic'])put(key,m[key],'metadata.'+key);
 // These are descriptions of the existing generated artifact, never provider claims.
 const origins={simulation:'simulation',derived:'derived_calculation',assumption:'simulation',policy:'simulation',annotation:'simulation'};
 put('value_origin',origins[m.value_origin],['metadata.value_origin','D005/generate.mjs'],'synthetic-generation-origin; original retained in source ledger');
 put('provenance',{system:version,collection_method:'synthetic_generation',source_record_key:m.record_id,
  artifact_ref:m.source_file,access_class:'internal',documentation_refs:[
   'docs/research/marketing-ontology/data-proposal.md','docs/research/marketing-ontology/batches/D005/README.md']},
  ['metadata.source_file','metadata.record_id','D005/manifest.json','D005/README.md'],'existing-approved-artifact-provenance');
 const eventField=['event_time','ordered_at','requested_at','created_at','written_at','observed_at','published_at','incident_start','promised_at'].find(k=>p[k]!==undefined);
 const validity=['T02','T16','T21','T40'].includes(type);
 const temporal={time_kind:p.period?(validity?'validity':'interval'):type==='T39'?'model':'instant',
  source_grain:p.period?'custom':'instant',series_role:'detail',calendar_id:'Gregorian',
  reporting_timezone:m.reporting_timezone,coverage_kind:'sample',available_at:m.available_at,
  revision:p.revision??0};
 if(p.period)temporal.period_field=type==='T02'?'valid_from':type==='T16'?'valid_from':'period';
 else if(eventField)temporal.timestamp_field=eventField;
 if(p.supersedes_record_id)temporal.supersedes_record_id=p.supersedes_record_id;
 put('temporal',temporal,['metadata.available_at','metadata.reporting_timezone','payload.period','payload.revision','D005/README.md','temporal-design.md'],
  'D005-independent-detail-sample; original artifact revision zero unless explicitly revised');
 put('quality',{availability:'available',coverage:m.quality,is_partial:true},['metadata.quality','D005/README.md'],'provided-synthetic-sample; not market-complete');
 if(m.parent_record_ids.length)put('related_record_ids',m.parent_record_ids,'metadata.parent_record_ids');
 for(const k of identityFields[type].split(' '))if(k in def.properties)put(k,p[k],'payload.'+k);
 if(p.period && 'period' in def.properties)put('period',{start:p.period.start,end_exclusive:p.period.end,
  timezone:m.reporting_timezone,grain:'custom'},['payload.period.start','payload.period.end','metadata.reporting_timezone'],'declared-half-open-period; do not infer aggregation cadence');
 if(type==='T02'){
  put('country_code',m.country_code,'metadata.country_code');
  if(p.mapping_kind==='name_alias')put('mapping_kind','alias','payload.mapping_kind','registered-enum-alias');
  put('valid_from',p.period.start,'payload.period.start');put('valid_to_exclusive',p.period.end,'payload.period.end');
  const kinds=context.entityKinds.get(p.entity_ref);
  if(kinds?.size===1)put('entity_type',[...kinds][0],['payload.entity_ref','existing-product-brand-variant-identities'],'resolve-explicit-entity-type');
  const product=context.productsByRecord.get(p.evidence[0]);
  if(product && p.mapping_kind==='name_alias' && p.external_value===product.product_name){
   put('language','ko',['payload.external_value','parent-product.description_ko','D005/generate.mjs'],'declared-Korean-product-name');
   put('evidence',{record_ref:product.record_id,field_path:'$.product_name',quote:product.product_name,language:'ko'},
    ['payload.evidence','parent-product.product_name'],'candidate-alias-exact-parent-name; not confirmed identity');
  }else if(p.evidence.length===1&&p.evidence[0]==='D005-2.0.0 승인 코드표'){
   put('evidence',{record_ref:m.record_id,field_path:'$.payload.'+fieldName('evidence',context.profiles.get(m.record_id))+'[0]',quote:p.evidence[0],language:'ko'},
    'payload.evidence','exact-approved-mock-code-assertion; not provider evidence');
  }
 }
 if(type==='T06'){put('low_bid',p.bid_lower,'payload.bid_lower');put('high_bid',p.bid_upper,'payload.bid_upper');}
 if(type==='T10')for(const k of ['first_seen','last_seen'])put(k,localDate(p[k],m.reporting_timezone),['payload.'+k,'metadata.reporting_timezone'],'instant-to-local-calendar-date; original timestamp preserved');
 if(type==='T11')put('duplicate_cluster',p.duplicate_group,'payload.duplicate_group');
 // These exact literals are declared as fixed Korean generation text in D005 README.
 const koreanLiterals=new Set(['가상 경쟁 제품 P2A 안내입니다.','가상 경쟁 제품 P2B 안내입니다.',
  '가상 자사 샴푸 안내','샴푸 사용 문의','문의에 대한 답글','제품 안내 확인',
  '가상 샴푸 콘텐츠','가상 사용 안내']);
 const text=p.body_text??p.message_text??p.title;
 if('language' in def.properties && koreanLiterals.has(text))put('language','ko',
  ['payload.'+(p.body_text!==undefined?'body_text':p.message_text!==undefined?'message_text':'title'),'D005/README.md fixed Korean constants'],'declared-generation-text-language');
 if(type==='T14'){
  put('parent_report_ref',p.parent_record_id,'payload.parent_record_id');
  put('breakdown_dimensions',[{name:'device',value:p.device}],'payload.device','explicit-dimension');
  const metricDef=schema.$defs.AdMetrics.properties;
  put('metrics',{...Object.fromEntries(Object.entries(p.metrics).filter(([k])=>k in metricDef)),
   attributed_conversions:p.metrics.conversions,attributed_value:p.metrics.attributed_revenue},
   ['payload.metrics','payload.parent_record_id'],'registered-attributed-metric-names; D005 split preserves parent attribution');
 }
 if(type==='T16')put('version',String(p.version),'payload.version','integer-version-to-string; no date-time invented');
 if(type==='T19')put('customer_pseudo_ref',context.customers.get(p.order_id),['payload.order_id','T30.order_refs/customer_set','D005/generate.mjs'],
  'declared-parallel-cohort-order-customer-membership');
 if(type==='T23'&&p.record_kind==='shipment')put('record_kind','fulfilment','payload.record_kind','registered-shipment-subtype');
 if(type==='T25'){
  put('subject_ref',p.product_ref,'payload.product_ref','product-subject-only');
  if(p.evidence_span){
   const parent=context.reviews.get(p.review_ref);
   const span={record_ref:p.review_ref,field_path:'$.body_text',quote:p.evidence_span.quote,
    start_offset:p.evidence_span.start,end_offset:p.evidence_span.end};
   if(parent?.language)span.language=parent.language;
   put('evidence_span',span,['payload.review_ref','payload.evidence_span','parent-review.language'],'Unicode-codepoint-exact-span');
  }
 }
 if(type==='T29')put('fee',p.cost,'payload.cost','declared-collaboration-cost');
 if(type==='T30'&&p.record_kind==='opportunity'){
  put('record_kind','deal','payload.record_kind','registered-B2B-subtype');put('deal_id',p.opportunity_id,'payload.opportunity_id');
 }
 if(type==='T31')put('segment_ref',p.cohort_ref,'payload.cohort_ref','explicit-CRM-target-cohort; no clicker-equivalence-assumed');
 if(type==='T32')put('response_scale',p.response_scale.join(' / '),'payload.response_scale','ordered-response-labels-to-description');
 if(type==='T33')put('published_at',localDate(p.published_at,m.reporting_timezone),['payload.published_at','metadata.reporting_timezone'],'instant-to-local-publication-date; availability kept separately');
 if(type==='T34'&&p.record_kind==='schedule'){
  put('record_kind','calendar','payload.record_kind','registered-calendar-subtype');put('event_name',p.title,'payload.title');
 }
 if(type==='T34')put('region_ref',m.country_code,['metadata.country_code','metadata.scope_id'],'sample-country-region; not whole-country coverage');
 if(type==='T37'&&p.measures)put('measures',p.measures.map(m=>({...m,availability:'available'})),
  'payload.measures','provided-metric-values; definition version still required');
 if(type==='T38'){
  put('outcome_measures',[{metric_id:'T38.conversions',value:p.conversions,unit:'count',availability:'available',definition_version:'CANONICAL-SYNTHETIC-1'}],
   ['payload.conversions','completion-definitions.json:T38.conversions'],'existing-experiment-conversions; not causal-lift');
  if(context.definitionAvailableAt)lineage.at(-1).available_at=context.definitionAvailableAt;
 }
 if(type==='T39'){
  put('record_kind',p.record_kind==='model'?'response_model':'budget_scenario','payload.record_kind','registered-model-subtype');
  if(p.model_id)put('model_ref',p.model_id,'payload.model_id','model-own-identity');
  put('validity_scope',m.scope_id,'metadata.scope_id','declared-independent-sample-model-scope');
  if(p.record_kind==='budget_candidate')put('scenario_id_ref',m.record_id,'metadata.record_id','existing-candidate-record-identity');
  const definition=p.record_kind==='model'?p:context.models.get(p.model_ref);
  if(definition){
   put('assumptions',['trained='+definition.trained,'formula='+definition.formula,'unit_budget='+JSON.stringify(definition.unit_budget)],
    ['referenced-model.trained','referenced-model.formula','referenced-model.unit_budget'],'verbatim-declared-model-assumptions');
   if(p.record_kind==='model')put('parameters',[
    {name:'unit_budget',value:JSON.stringify(p.unit_budget)},
    ...Object.entries(p.bounds).flatMap(([channel,bounds])=>Object.entries(bounds).map(([bound,value])=>({name:channel+'.'+bound,value:JSON.stringify(value)})))],
    ['payload.unit_budget','payload.bounds'],'lossless-declared-model-parameter-encoding');
  }
  if(p.allocations){
   const campaigns=context.campaigns.get(m.country_code);
   const model=context.models.get(p.model_ref);
   if(campaigns&&model)put('allocations',Object.entries(p.allocations).map(([channel,amount])=>({campaign_ref:campaigns[channel],amount,...model.bounds[channel]})),
    ['payload.allocations','existing-campaign.channel','referenced-model.bounds'],'resolve-channel-and-model-bounds');
  }
 }
 if(type==='T40'){
  put('budget_limit',p.budget,'payload.budget');put('policy_status',p.status,'payload.status','synthetic-approval-only');
  put('kpi_definition_refs',[p.kpi_definition_ref],'payload.kpi_definition_ref','scalar-reference-to-array');
 }
 const used=new Set(lineage.flatMap(x=>x.sources).filter(x=>x.startsWith('payload.')).map(x=>x.split('.')[1]));
 const retained_source_fields=Object.keys(p).filter(k=>!used.has(k));
 return {record,lineage,retained_source_fields,original_value_origin:m.value_origin};
}

export function localDate(instant,zone){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(instant));
 const get=key=>parts.find(p=>p.type===key).value;
 return `${get('year')}-${get('month')}-${get('day')}`;
}
