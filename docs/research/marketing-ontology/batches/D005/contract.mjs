import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
export const here=path.dirname(fileURLToPath(import.meta.url));
export const root=path.resolve(here,'../../../../..');
export const version='D005-2.0.0';
export const seed='500520261015';
export const countries=['KR','JP','US'];
export const currencies=['KRW','JPY','USD'];
export const zones=['Asia/Seoul','Asia/Tokyo','America/New_York'];
export const counts={T01:6,T02:60,T04:18,T05:36,T06:18,T07:24,T10:12,T11:6,T14:24,T15:12,T16:12,T17:24,T18:60,T19:18,T20:9,T21:12,T23:18,T25:24,T26:9,T27:12,T28:18,T29:3,T30:9,T31:6,T32:18,T33:12,T34:18,T37:9,T38:12,T39:9,T40:6};
export const stages=[['T01','T02','T17','T18','T19','T20','T37'],['T21','T23','T25','T26'],['T04','T05','T06','T07','T10','T11','T32','T33','T34'],['T14','T15','T16','T27','T28','T29','T30','T31'],['T40','T38','T39']];
const str={type:'string',minLength:1}, num={type:'number'}, int={type:'integer',minimum:0};
const en=(...v)=>({enum:v}), dt={type:'string',format:'date-time'}, date={type:'string',format:'date'};
const arr=x=>({type:'array',items:x,minItems:1});
const nullable=x=>({anyOf:[x,{type:'null'}]});
const obj=(properties,optional=[])=>({type:'object',properties,required:Object.keys(properties).filter(k=>!optional.includes(k)),additionalProperties:false});
const money=obj({amount:{type:'string',pattern:'^-?\\d+\\.\\d{2}$'},currency:en(...currencies)});
const period=obj({start:date,end:date});
const span=obj({quote:str,start:int,end:int});
const quantity=(unit)=>obj({value:num,unit:en(unit)});
const metrics=obj({impressions:int,clicks:int,conversions:int,spend:money,attributed_revenue:money});
const measures=arr(obj({metric_id:en('lcp_p75'),value:num,unit:en('ms')}));
const allocations=obj({search:money,social:money});
const bounds=obj({search:obj({lower:money,upper:money}),social:obj({lower:money,upper:money})});
const event={event_id:str,event_time:dt,session_ref:nullable(str),variant_ref:str,item_index:int,quantity:int,consent_state:en('granted','denied'),measurement_basis:en('web_item_event')};
export const payloads={
 T01:obj({product_id:str,product_name:str,brand_id:str,brand_name:str,variant_id:str,sku:str,category_id:str,volume:quantity('ml'),valid_from:date}),
 T02:obj({mapping_kind:en('external_id','name_alias'),external_system:str,external_value:str,entity_ref:str,match_status:en('confirmed','candidate'),period,evidence:arr(str)}),
 T04:obj({panel_id:str,subject_ref:str,period,sample_size:int,positive_responses:int,positive_rate:num,weighting_method:en('unweighted')}),
 T05:obj({query_id:str,term:str,normalization_scope:str,period,index_value:int,search_surface:en('모의 검색')}),
 T06:obj({keyword:str,language:en('ko'),period,estimated_searches:int,competition_level:en('medium'),competition_index:int,bid_lower:money,bid_upper:money}),
 T07:obj({site_ref:str,page_ref:str,query:nullable(str),device:en('mobile'),period,impressions:int,clicks:int,average_position:num}),
 T10:obj({public_ad_id:str,advertiser_ref:str,observed_at:dt,first_seen:dt,last_seen:dt,format:en('text'),creative_text:str}),
 T11:obj({document_id:str,publisher:str,published_at:dt,event_time:dt,body_text:str,subject_refs:arr(str),duplicate_group:str}),
 T14:obj({campaign_ref:str,parent_record_id:str,period,device:en('mobile','desktop'),metrics,split_basis:en('synthetic_partition')}),
 T15:obj({campaign_ref:str,competitor_domain:str,period,impression_share:num,overlap_rate:num,denominator_status:en('not_provided')}),
 T16:obj({creative_id:str,version:int,campaign_ref:str,product_refs:arr(str),format:en('text'),message_text:str,period}),
 T17:obj({event_id:str,event_time:dt,event_name:en('page_view','consent_update'),site_ref:str,session_ref:str,page_ref:str,device:en('mobile'),consent_state:en('granted','denied')}),
 T18:{oneOf:[obj({...event,event_name:en('view_item','add_to_cart','begin_checkout')}),obj({...event,event_name:en('purchase'),transaction_ref:str,unit_price:money}),obj({...event,event_name:en('refund'),transaction_ref:str,adjustment_ref:str,unit_price:money,refund_amount:money})]},
 T19:obj({order_id:str,line_id:str,transaction_ref:str,ordered_at:dt,variant_ref:str,quantity:int,unit_price:money,line_discount:money,line_tax:money,line_gross_total:money,fulfilment_status:en('fulfilled','shipped','unfulfilled'),status_available_at:dt}),
 T20:{oneOf:[obj({adjustment_id:str,adjustment_kind:en('refund'),order_ref:str,order_line_ref:str,requested_at:dt,processed_at:dt,quantity:int,refund_amount:money,status:en('completed'),reason_code:en('unknown'),restocked:en(null)}),obj({adjustment_id:str,adjustment_kind:en('cancel'),order_ref:str,order_line_ref:str,requested_at:dt,quantity:int,status:en('pending'),reason_code:en('unknown'),restocked:en(null)})]},
 T21:obj({variant_ref:str,period,unit_cost:money,margin_definition:en('세전 상품원가'),accounting_basis:en('재입고 미확인')}),
 T23:{oneOf:[obj({record_kind:en('distribution'),product_ref:str,period,stockists:int,target_stockists:int}),obj({record_kind:en('shipment'),order_ref:str,promised_at:dt,status:en('delivered','in_transit','unshipped'),shipped_at:dt,delivered_at:dt},['shipped_at','delivered_at'])]},
 T25:{oneOf:[obj({record_kind:en('annotation'),review_ref:str,product_ref:str,aspect:en('거품','용기','건조감'),sentiment:en('positive','negative'),evidence_span:span,assessment_status:en('provided')}),obj({record_kind:en('aggregate'),product_ref:str,aspect:en('거품','용기','건조감'),sample_size:int,mention_count:int,review_refs:arr(str)})]},
 T26:{oneOf:[obj({ticket_id:str,created_at:dt,message_text:str,link_status:en('confirmed'),order_ref:str}),obj({ticket_id:str,created_at:dt,message_text:str,link_status:en('unlinked')})]},
 T27:obj({content_id:str,published_at:dt,observed_at:dt,title:str,description_text:str,view_count:int}),
 T28:obj({comment_id:str,content_ref:str,written_at:dt,body_text:str,parent_comment_ref:str},['parent_comment_ref']),
 T29:obj({collaboration_id:str,content_refs:arr(str),agreement_status:en('signed'),cost:money}),
 T30:{oneOf:[obj({record_kind:en('cohort'),cohort_ref:str,order_refs:arr(str),customer_set:arr(str),sample_size:int,repeat_purchase_rate:num,net_revenue:money}),obj({record_kind:en('opportunity'),opportunity_id:str,stage:en('open'),population:en('separate_B2B')})]},
 T31:obj({crm_campaign_id:str,cohort_ref:str,emails_sent:int,bounces:int,unique_clicks:int,unsubscribes:int,open_measurement_basis:en('not_collected'),linked_orders:arr(str)}),
 T32:obj({study_id:str,subject_ref:str,period,question_text:str,response_scale:arr(str),sample_size:int,positive_responses:int,sampling_method:en('convenience')}),
 T33:obj({statistics_table_id:str,region_ref:str,period,value:num,unit:en('index'),revision:int,published_at:dt,supersedes_record_id:str},['supersedes_record_id']),
 T34:{oneOf:[obj({record_kind:en('weather'),station_ref:str,period,temperature:quantity('℃'),precipitation:quantity('mm')}),obj({record_kind:en('schedule'),period,title:str,is_public_holiday:en(false)})]},
 T37:{oneOf:[obj({record_kind:en('performance'),page_ref:str,device:en('mobile'),period,measures}),obj({record_kind:en('incident'),page_ref:str,device:en('mobile'),incident_start:dt,incident_end:dt,status:en('resolved'),error_text:str})]},
 T38:obj({experiment_id:str,arm_id:en('control','treatment'),period,sample_size:int,conversions:int,population:en('separate_experiment')}),
 T39:{oneOf:[obj({record_kind:en('model'),model_id:str,formula:en('search/(10s)+social/(20s)'),trained:en(false),unit_budget:money,bounds}),obj({record_kind:en('budget_candidate'),model_ref:str,policy_ref:str,period,total_budget:money,allocations,predicted_conversions:num})]},
 T40:obj({policy_id:str,status:en('proposed','approved'),budget:money,period,approval_role:en('모의 업무 승인자'),kpi_definition_ref:str})
};
export const metadataSchema=obj({record_id:{type:'string',pattern:'^D005-T[0-9]{2}-[0-9]{4}$'},dataset_type:en(...Object.keys(counts)),country_code:en(...countries,'GLOBAL'),scenario_id:en('D005-independent-sample'),scope_id:str,is_synthetic:en(true),value_origin:en('simulation','annotation','derived','assumption','policy'),available_at:dt,reporting_timezone:en(...zones),source_file:str,parent_record_ids:{type:'array',items:str},quality:en('synthetic_sample')});
// Mapping is registered from the declared schema keys, never inferred from an input key.
export function fieldName(k,profile){return profile==='A'?k:profile==='B'?k.replace(/_([a-z])/g,(_,x)=>x.toUpperCase()):k.toUpperCase();}
function transformSchema(s,profile){
 if(s===money){return obj(profile==='A'?money.properties:profile==='B'?{value:money.properties.amount,currencyCode:money.properties.currency}:{amountMinor:{type:'string',pattern:'^-?\\d+$'},currencyCode:money.properties.currency});}
 if(s.oneOf)return {oneOf:s.oneOf.map(x=>transformSchema(x,profile))};
 if(s.anyOf)return {anyOf:s.anyOf.map(x=>transformSchema(x,profile))};
 if(s.type==='array')return {...s,items:transformSchema(s.items,profile)};
 if(s.type==='object'){
  const p=Object.fromEntries(Object.entries(s.properties).map(([k,v])=>[fieldName(k,profile),transformSchema(v,profile)]));
  if(profile==='C'&&s.properties.unit?.enum?.[0]==='ml')p.UNIT=en('L');
  if(profile==='C'&&s.properties.unit?.enum?.[0]==='ms')p.UNIT=en('s');
  return {...s,properties:p,required:s.required.map(k=>fieldName(k,profile))};
 }
 return s;
}
export function schemas(){
 const common={$schema:'https://json-schema.org/draft/2020-12/schema',oneOf:[]};
 const source={$schema:common.$schema,oneOf:[]};
 for(const [t,p] of Object.entries(payloads)){
  const meta={...metadataSchema,properties:{...metadataSchema.properties,dataset_type:en(t)}};
  common.oneOf.push(obj({metadata:meta,payload:p}));
  for(const profile of ['A','B','C'])source.oneOf.push(obj({source_profile:en(profile),metadata:meta,payload:transformSchema(p,profile)}));
 }
 return {source,common};
}
export function ajvInstance(){
 const store=path.join(root,'node_modules/.pnpm'),dirs=fs.readdirSync(store),require=createRequire(import.meta.url);
 const Module=require('node:module');
 process.env.NODE_PATH=dirs.filter(d=>/^(ajv@8\.|ajv-formats@|fast-deep-equal@|fast-uri@|json-schema-traverse@1\.|require-from-string@)/.test(d)).map(d=>path.join(store,d,'node_modules')).join(path.delimiter); Module._initPaths();
 const ajvDir=dirs.find(d=>/^ajv@8\./.test(d)),formatsDir=dirs.find(d=>/^ajv-formats@/.test(d));
 if(!ajvDir||!formatsDir)throw new Error('MISSING_TOOL: Ajv8/ajv-formats');
 const Ajv=require(path.join(store,ajvDir,'node_modules/ajv/dist/2020.js')).default;
 const ajv=new Ajv({strict:false,allErrors:true,coerceTypes:false,useDefaults:false,removeAdditional:false});
 require(path.join(store,formatsDir,'node_modules/ajv-formats')).default(ajv);return ajv;
}
// A union is selected only by explicit schema discriminators, not by coercion or defaults.
function branch(s,v,profile='A'){
 if(s.oneOf)return s.oneOf.find(x=>Object.entries(x.properties).every(([k,d])=>!d.enum||d.enum.includes(v[fieldName(k,profile)])));
 if(s.anyOf)return v===null?s.anyOf.find(x=>x.type==='null'):s.anyOf.find(x=>x.type!=='null');
 return s;
}
export function codec(v,s,profile,decode=false){
 s=branch(s,v,decode?profile:'A'); if(!s)throw new Error('UNKNOWN_VARIANT');
 if(v===null)return null;
 if(s===money){
  if(!decode){const {amount,currency}=v;return profile==='A'?v:profile==='B'?{value:amount,currencyCode:currency}:{amountMinor:String(toMinor(v)),currencyCode:currency};}
  if(profile==='A')return v;
  return profile==='B'?{amount:v.value,currency:v.currencyCode}:fromMinor(BigInt(v.amountMinor),v.currencyCode);
 }
 if(s.type==='array')return v.map(x=>codec(x,s.items,profile,decode));
 if(s.type==='object'){
  const pairs=Object.entries(v).map(([k,x])=>{
   const canonical=decode?Object.keys(s.properties).find(n=>fieldName(n,profile)===k):k;
   if(!canonical)throw new Error('UNKNOWN_FIELD:'+k);
   return [decode?canonical:fieldName(k,profile),codec(x,s.properties[canonical],profile,decode)];
  });
  const out=Object.fromEntries(pairs),unit=decode?out.unit:v.unit;
  if(profile==='C'&&((decode&&['L','s'].includes(unit))||(!decode&&['ml','ms'].includes(unit)))){
   const vk=decode?'value':'VALUE',uk=decode?'unit':'UNIT';out[vk]=decode?out[vk]*1000:out[vk]/1000;out[uk]=decode?(unit==='L'?'ml':'ms'):(unit==='ml'?'L':'s');
  }
  return out;
 }
 return v;
}
export function toMinor(m){const [a,b]=m.amount.split('.');if(m.currency!=='USD'&&b!=='00')throw new Error('FRACTIONAL_MINOR');return m.currency==='USD'?BigInt(a)*100n+BigInt(b):BigInt(a);}
export function fromMinor(n,currency){return {amount:currency==='USD'?`${n/100n}.${String(n%100n).padStart(2,'0')}`:`${n}.00`,currency};}
export function loadParents(){const dir=path.join(here,'../D003B/source');return Object.fromEntries(['T01','T12','T13','T24'].map(t=>[t,fs.readFileSync(path.join(dir,t+'.jsonl'),'utf8').trim().split('\n').map(JSON.parse)]));}
export function normalize(row){return {metadata:row.metadata,payload:codec(row.payload,payloads[row.metadata.dataset_type],row.source_profile,true)};}
