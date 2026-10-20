// A lossless common query view does not turn absent legacy fields into invented facts.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {normalize,ajvInstance} from '../D005/contract.mjs';
import {convert} from '../../common-contract/d005-canonical.mjs';
import {applySupplement} from '../../common-contract/canonical-supplement.mjs';
import {here,readLines,baselineBatches,zones,relative} from './spec.mjs';

const contractDir=path.join(here,'../../common-contract');
const schema=JSON.parse(fs.readFileSync(path.join(here,'../../schemas/marketing-records.schema.json')));
const ajv=ajvInstance();ajv.addSchema(schema,'D007-canonical');
const validators=new Map(Object.keys(schema.$defs).filter(t=>/^T\d\d$/.test(t)||t==='HistoricalReport').map(t=>[t,ajv.compile({$ref:'D007-canonical#/$defs/'+t})]));
export const validRecord=record=>{
 const v=validators.get(record.dataset_type==='H01'?'HistoricalReport':record.dataset_type);
 const conforming=!!v?.(record),errors=structuredClone(v?.errors||(!v?[{message:'unknown dataset type'}]:[]));
 for(const field of ['period','planned_period','expected_period','training_period'])if(record[field]&&record[field].start>=record[field].end_exclusive)errors.push({keyword:'semantic-period-order',instancePath:'/'+field,message:'start must precede exclusive end; preserve original timestamp precision in payload'});
 return {conforming:conforming&&errors.length===0,errors};
};
function common(batch,t,p,m,file){
 const c=m.country_code||p.country_code||'KR',window=p.period||p.period_start&&{start:p.period_start,end:p.period_end_exclusive};
 const r={record_id:m.record_id||p.record_id,dataset_type:t,scope_id:m.scope_id||batch+'-'+c,scenario_id:m.scenario_id||batch,is_synthetic:true,
  value_origin:'simulation',provenance:{system:batch,collection_method:'synthetic_generation',source_record_key:m.record_id||p.record_id,artifact_ref:relative(file),access_class:'internal',documentation_refs:['docs/research/marketing-ontology/data-proposal.md']},
  temporal:{time_kind:window?'interval':'instant',source_grain:p.grain||'instant',series_role:p.series_role==='baseline'?'baseline':'detail',calendar_id:'Gregorian',reporting_timezone:m.reporting_timezone||p.reporting_timezone||zones[c],coverage_kind:'sample',available_at:m.available_at||p.available_at,revision:0},
  quality:{availability:p.availability==='missing'?'missing':'available',coverage:'Preserved '+batch+' independent synthetic sample',is_partial:true}};
 if(window){r.period={start:window.start.slice(0,10),end_exclusive:window.end.slice(0,10),timezone:r.temporal.reporting_timezone,grain:p.grain||'custom'};r.temporal.period_field='period';r.temporal.source_grain=r.period.grain;}
 return r;
}
function legacy(batch,t,p,m,file,products){
 const r=common(batch,t,p,m,file),c=m.country_code||p.country_code||'KR';
 const cash=value=>value===null?null:{amount:value,currency:p.currency};
 const variant=id=>'D005-V-'+id;
 const mappings={
  T03:()=>({subject_ref:p.product_id,region_ref:c,retail_channel:'synthetic_retail_sample',coverage_id:batch+'-'+c+'-market',measurement_method:p.measurement_method,units_sold:p.units_sold,sales_value:cash(p.sales_value),market_total_value:p.market_total_value===undefined?undefined:cash(p.market_total_value)}),
  T08:()=>({offer_id:batch+'-'+c+'-'+p.product_id+'-'+(p.seller_id||'undeclared'),variant_ref:variant(p.product_id),seller_ref:p.seller_id,observed_at:p.observed_at,listed_price:cash(p.price),availability:p.availability,tax_included:p.tax_included,shipping_included:p.shipping_included}),
  T12:()=>({campaign_id:p.campaign_id,platform:p.platform,account_id:p.account_id,channel:p.channel,product_refs:[p.target_product_id],status:undefined}),
  T13:()=>({platform:p.platform,account_id:p.account_id,campaign_ref:p.campaign_id,entity_level:'campaign',entity_id:p.campaign_id,metrics:{impressions:p.impressions,clicks:p.clicks,spend:cash(p.spend),attributed_conversions:p.conversions,attributed_value:cash(p.attributed_revenue)},report_state:p.report_state,conversion_definition_ref:batch+'-purchase',attribution_model:p.attribution_model,attribution_window:p.attribution_window_days===undefined?undefined:String(p.attribution_window_days)+'_days'}),
  T22:()=>({variant_ref:variant(p.product_id),location_ref:p.location_id,observed_at:p.observed_at,available_quantity:p.available_quantity,sellable_status:p.sellable_status==='in_stock'?'sellable':p.sellable_status}),
  T24:()=>({review_id:p.review_id,review_subject_type:'product',subject_ref:p.product_id,written_at:p.written_at,language:p.language,body_text:p.body_text,rating_value:p.rating_value,rating_scale_max:p.rating_scale_max,verified_purchase:p.verified_purchase}),
  T25:()=>({record_kind:p.record_kind,subject_ref:p.product_ref,aspect_ref:p.aspect,sentiment:p.sentiment,definition_version:'D006-approved-annotation',assessment_status:p.assessment_status,review_ref:p.review_ref,
   evidence_span:{record_ref:p.review_ref,field_path:'$.body_text',quote:p.evidence_span?.quote,language:'ko',start_offset:p.evidence_span?.start,end_offset:p.evidence_span?.end},extractor_version:'D006-synthetic-rule'}),
  T35:()=>({change_id:p.change_id,entity_ref:p.location_id,changed_at:p.changed_at,operation:'update',changed_field:p.changed_field,before_value:p.before_value,after_value:p.after_value,client_type:'synthetic_internal_log',reason_text:p.reason_ko}),
  T36:()=>({run_id:p.run_id,target_dataset:p.target_dataset||'T13',expected_period:{start:p.expected_start,end_exclusive:p.expected_end_exclusive,timezone:r.temporal.reporting_timezone,grain:'custom'},status:p.status,expected_count:p.expected_count,received_count:p.received_count,missing_count:p.missing_count}),
 };
 if(mappings[t])Object.assign(r,mappings[t]());
 if(t==='H01'){
  const names=['gross_units','returned_units','net_units','gross_sales','returns_value','net_sales'];
  Object.assign(r,{report_kind:'sales',subject_ref:p.product_id,measures:names.map(k=>({metric_id:'D003B.'+k,value:k.endsWith('sales')||k==='returns_value'?cash(p[k]):p[k],unit:k.endsWith('sales')||k==='returns_value'?'money':'count',availability:'available',definition_version:'D003B-1.0.0'})),metric_definition_refs:names.map(k=>'D003B.'+k),reconciliation:'no_detail'});
 }
 if(t==='T01'){
  const d=products.find(x=>x.payload.product_id===p.product_id)?.payload;
  Object.assign(r,{product_id:p.product_id,variant_id:d?.variant_id,brand_id:p.brand_id,category_id:d?.category_id,sku:d?.sku,name:p.product_name,valid_from:p.valid_from,status:'unknown'});
  // Identity enrichment uses an actual existing catalog row and its availability, never backdated.
  if(d){const source=products.find(x=>x.payload===d);r.temporal.available_at=[r.temporal.available_at,source.metadata.available_at].sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1);r.related_record_ids=[source.metadata.record_id];}
 }
 // No defaults for missing budget, timestamps or reporting policy. Expose contract gaps.
 return JSON.parse(JSON.stringify(r));
}
export function loadCatalog({includeNew=true}={}){
 const source=baselineBatches.flatMap(batch=>{
  const dir=path.join(here,'..',batch,'source');return fs.readdirSync(dir).filter(f=>f.endsWith('.jsonl')).sort().flatMap(f=>readLines(path.join(dir,f)).map(raw=>({batch,t:f.slice(0,-6),raw,file:path.join(dir,f)})));
 });
 const d005=source.filter(x=>x.batch==='D005').map(x=>normalize(x.raw));
 const products=d005.filter(x=>x.metadata.dataset_type==='T01'),parentProducts=source.filter(x=>x.batch==='D003B'&&x.t==='T01').map(x=>x.raw),parentCampaigns=source.filter(x=>x.batch==='D003B'&&x.t==='T12').map(x=>x.raw),parentReviews=source.filter(x=>x.batch==='D003B'&&x.t==='T24').map(x=>x.raw);
 const context={entityKinds:new Map(),reviews:new Map(parentReviews.map(r=>[r.record_id,r])),campaigns:new Map(),models:new Map(),productsByRecord:new Map(parentProducts.map(r=>[r.record_id,r])),profiles:new Map(source.filter(x=>x.batch==='D005').map(x=>[x.raw.metadata.record_id,x.raw.source_profile])),customers:new Map()};
 const kind=(id,k)=>{if(!context.entityKinds.has(id))context.entityKinds.set(id,new Set());context.entityKinds.get(id).add(k);};
 for(const p of parentProducts){kind(p.product_id,'product');kind(p.brand_id,'brand');}
 for(const p of products)kind(p.payload.variant_id,'variant');
 for(const ca of parentCampaigns){if(!context.campaigns.has(ca.country_code))context.campaigns.set(ca.country_code,{});context.campaigns.get(ca.country_code)[ca.channel]=ca.campaign_id;}
 for(const r of d005.filter(r=>r.metadata.dataset_type==='T39'&&r.payload.record_kind==='model'))context.models.set(r.payload.model_id,r.payload);
 for(const r of d005.filter(r=>r.metadata.dataset_type==='T30'&&r.payload.record_kind==='cohort'))r.payload.order_refs.forEach((id,i)=>context.customers.set(id,r.payload.customer_set[i]));
 const supplement=JSON.parse(fs.readFileSync(path.join(contractDir,'completion-values.json'))),patches=new Map(supplement.records.map(r=>[r.record_id,r]));context.definitionAvailableAt=supplement.created_at;
 const catalog=[];
 for(const x of source){
  let record,lineage=[],payload=x.raw.payload||x.raw,m=x.raw.metadata||{};
  if(x.batch==='D005'&&x.t!=='T01'){
   const decoded=normalize(x.raw),converted=convert(decoded,schema,context);record=converted.record;lineage=converted.lineage;payload=decoded.payload;
   const patch=patches.get(record.record_id);if(patch){
    applySupplement(record,lineage,patch.fields,patch.field_metadata);
    // A complete canonical projection is conservatively available only after its supplement.
    // Historical source values remain intact in payload/source; never backdate new definitions.
    record.temporal.available_at=[record.temporal.available_at,supplement.created_at].sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1);
   }
  }else{
   if(x.batch==='D005'){const d=normalize(x.raw);payload=d.payload;m=d.metadata;}
   record=legacy(x.batch,x.t,payload,m,x.file,products);
  }
  const status=validRecord(record);
  catalog.push({batch:x.batch,country:m.country_code||payload.country_code||'GLOBAL',record,payload,source:x.raw,lineage,schema_conforming:status.conforming,contract_gaps:status.errors});
 }
 if(includeNew&&fs.existsSync(path.join(here,'source')))for(const t of fs.readdirSync(path.join(here,'source')).filter(x=>x.endsWith('.jsonl')).sort())for(const record of readLines(path.join(here,'source',t))){
  const status=validRecord(record);catalog.push({batch:'D007',country:record.scope_id.split('-')[1],record,payload:record,source:record,lineage:[],schema_conforming:status.conforming,contract_gaps:status.errors});
 }
 return catalog;
}

export function select(catalog,{batch,scenario,scope,type,country,asOf}={}){
 if(asOf!==undefined)assert.ok(Number.isFinite(Date.parse(asOf)),'Valid --as-of timestamp required');
 return catalog.filter(x=>(!batch||x.batch===batch)&&(!scenario||x.record.scenario_id===scenario)&&(!scope||x.record.scope_id===scope)&&(!type||x.record.dataset_type===type)&&(!country||x.country===country)&&(!asOf||Date.parse(x.record.temporal.available_at)<=Date.parse(asOf)));
}
export function summarize(catalog,options){
 const {field,...filters}=options,selected=select(catalog,filters),groups=new Map();
 for(const x of selected){
  const r=x.record,window=r.period||r.planned_period||r.expected_period;
  const value=field.split('.').reduce((o,k)=>o?.[k],r),definition=r.conversion_definition_ref||r.report_definition_ref||r.definition_version||r.dataset_type;
  const subject=r.subject_ref||r.variant_ref||r.campaign_ref||r.product_ref||r.cohort_ref||r.content_id||r.content_ref||r.entity_ref||r.term_ref||r.keyword||r.experiment_id||r.model_ref||r.page_ref||'unresolved';
  // Same field name is insufficient: independent normalization windows, experiment
  // arms, attribution definitions and rating scales must never become one mean.
  const dimensions=['normalization_scope','aggregation_scope','coverage_id','measurement_method','retail_channel','cohort_id','study_id','panel_id',
   'device','breakdown_dimensions','query','network_scope','geo_target_ref','measurement_basis','attribution_model','attribution_window',
   'record_kind','event_name','arm_id','model_version','scenario_id_ref','rating_scale_max','review_subject_type','measure_definition',
   'response_scale','statistics_table_id','item_code','unit','seasonal_adjustment','adjustment_kind','channel'];
  const context=Object.fromEntries(dimensions.filter(k=>k in r).map(k=>[k,r[k]]));
  const [collection,index]=field.split('.');
  if(['measures','outcome_measures','expected_measures','distribution_measures'].includes(collection)&&r[collection]?.[index]){
   const measure=r[collection][index];context.metric={metric_id:measure.metric_id,definition_version:measure.definition_version,unit:measure.unit};
  }
  const key=JSON.stringify([r.dataset_type,r.scenario_id,r.scope_id,x.country,subject,r.seller_ref||null,r.aspect_ref||null,definition,r.temporal.series_role,r.temporal.revision,window?.grain,window?.start,window?.end_exclusive,value?.currency||'not_declared',context]);
  if(!groups.has(key))groups.set(key,{key:JSON.parse(key),comparison_context:context,rows:0,available_values:0,missing_values:0,nonconforming_rows:0,records:[],values:[]});
  const g=groups.get(key);g.rows++;g.records.push(r.record_id);if(!x.schema_conforming)g.nonconforming_rows++;
  if(value===null||value===undefined)g.missing_values++;else{g.available_values++;g.values.push(value);}
 }
 return {status:groups.size>1?'separated':'ok',reason:groups.size>1?'Different subjects, samples, definitions, currencies, time windows or grains must be inspected separately':null,groups:[...groups.values()].map(g=>{
  const values=g.values.filter(v=>typeof v==='number'&&Number.isFinite(v));
  return {...g,numeric_summary:values.length?{count:values.length,min:Math.min(...values),max:Math.max(...values),mean:values.reduce((s,v)=>s+v,0)/values.length}:null};
 })};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2),option=k=>args.includes(k)?args[args.indexOf(k)+1]:undefined;
 const catalog=loadCatalog(),filters={batch:option('--batch'),scenario:option('--scenario'),type:option('--type'),country:option('--country'),scope:option('--scope'),asOf:option('--as-of')},selected=select(catalog,filters);
 if(option('--field'))console.log(JSON.stringify(summarize(catalog,{...filters,field:option('--field')})));
 else console.log(JSON.stringify({rows:selected.length,by_batch:Object.fromEntries([...new Set(selected.map(x=>x.batch))].map(b=>[b,selected.filter(x=>x.batch===b).length])),canonical_conforming:selected.filter(x=>x.schema_conforming).length,
  contract_gap_rows:selected.filter(x=>!x.schema_conforming).map(x=>({record_id:x.record.record_id,errors:x.contract_gaps}))}));
}
