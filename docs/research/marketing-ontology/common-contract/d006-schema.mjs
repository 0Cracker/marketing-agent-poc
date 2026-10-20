// D006 is a registered source profile. D005 schemas and manifests stay immutable.
import fs from 'node:fs';
import {ajvInstance} from '../batches/D005/contract.mjs';
const s={type:'string',minLength:1}, n={type:'integer',minimum:0}, dt={type:'string',format:'date-time'};
const text=(...v)=>({enum:v}), nullable=x=>({anyOf:[x,{type:'null'}]});
const object=(properties,optional=[])=>({type:'object',properties,required:Object.keys(properties).filter(x=>!optional.includes(x)),additionalProperties:false});
const metrics={impressions:nullable(n),clicks:nullable(n),conversions:nullable(n),spend:nullable(s),attributed_revenue:nullable(s),currency:text('JPY','USD')};
const period={period_start:s,period_end_exclusive:s};
const rating={review_id:s,product_id:s,written_at:dt,language:text('ko'),body_text:s,rating_value:nullable({type:'integer',minimum:1,maximum:5}),rating_scale_max:{const:5},verified_purchase:{type:'null'}};
const price={case_kind:text('scale'),product_id:s,seller_id:s,observed_at:dt,volume_ml:{const:300},amount_raw:s,amount_scale:text('micros','decimal'),currency:text('JPY'),tax_included:{const:true},shipping_included:{const:false}};
const ads={campaign_id:s,...period,grain:text('day','month'),series_role:s,...metrics};
const payloads={
 T24:{oneOf:[object(rating),object({...rating,seller_id:s,collection_run_id:s})]},
 T25:object({record_kind:{const:'annotation'},review_ref:s,product_ref:s,aspect:text('향','거품','건조감'),sentiment:text('positive','negative'),evidence_span:object({quote:s,start:n,end:n}),assessment_status:{const:'provided'}}),
 T08:{oneOf:[object(price),object({...price,case_kind:{const:'shipping'},shipping_fee:s,destination:s,quantity:{const:1},shipping_rule:{const:'flat_per_order'}})]},
 T22:object({product_id:s,location_id:s,observed_at:dt,available_quantity:n,boundary_day:{type:'string',format:'date'}}),
 T12:object({campaign_id:s,target_product_id:s,conversion_name:s,attribution_model:s,attribution_window_days:n,valid_from:dt,valid_to_exclusive:dt,boundary_day:{type:'string',format:'date'}}),
 T13:{oneOf:[object({...ads,case_kind:{const:'time'},account_id:s,boundary_day:{type:'string',format:'date'}}),object({...ads,case_kind:{const:'revision'},logical_key:s,revision:{type:'integer',minimum:1},supersedes_record_id:s})]},
 T03:object({product_id:s,...period,boundary_day:{type:'string',format:'date'},sales_raw:{type:'string',pattern:'^-?\\d+$'},amount_scale:{const:'minor'},currency:text('USD','JPY'),units_sold:n}),
 T36:object({run_id:s,target_dataset:{const:'T24'},product_id:s,seller_id:s,expected_start:{type:'string',format:'date'},expected_end_exclusive:{type:'string',format:'date'},expected_count:n,received_count:n,missing_count:n,status:{const:'success'},sampling_method:{const:'synthetic_fixed_seller_quota'},coverage_kind:{const:'sample'}})
};
const metadata=object({record_id:{type:'string',pattern:'^D006B?-T[0-9]{2}-[0-9]{4}$'},dataset_type:text(...Object.keys(payloads)),country_code:text('JP','US'),scenario_id:text('D006-CQ-A','D006-CQ-B'),scope_id:s,is_synthetic:{const:true},value_origin:text('simulation','annotation'),available_at:dt,reporting_timezone:text('Asia/Tokyo','America/New_York','UTC'),source_file:s,parent_record_ids:{type:'array',items:s},quality:{const:'synthetic_sample'}});
const schema={$schema:'https://json-schema.org/draft/2020-12/schema',oneOf:Object.entries(payloads).map(([t,p])=>object({source_profile:{const:'A'},metadata:{...metadata,properties:{...metadata.properties,dataset_type:{const:t}}},payload:p}))};
const ajv=ajvInstance();
if(!ajv.validateSchema(schema))throw new Error(JSON.stringify(ajv.errors));
const validate=ajv.compile(schema);
const commonSchema={$schema:schema.$schema,oneOf:Object.entries(payloads).flatMap(([t,p])=>(p.oneOf??[p]).map(part=>object({...metadata.properties,dataset_type:{const:t},...part.properties},[])))};
if(!ajv.validateSchema(commonSchema))throw new Error(JSON.stringify(ajv.errors));
const commonValidate=ajv.compile(commonSchema);
const rows=JSON.parse(fs.readFileSync(0,'utf8'));
const errors=[];
for(const r of rows){
 if(!validate(r))errors.push({record_id:r.metadata?.record_id,stage:'source',errors:validate.errors});
 else if(!commonValidate({...r.metadata,...r.payload}))errors.push({record_id:r.metadata.record_id,stage:'common',errors:commonValidate.errors});
}
console.log(JSON.stringify({status:errors.length?'fail':'pass',rows:rows.length,common_rows:rows.length,meta_schema:'pass',compile:'pass',coercion:false,defaults:false,unknown_fields:'rejected',errors}));
process.exitCode=errors.length?1:0;
