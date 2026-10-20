// D003B direct fields only; build the schema before generating any source values.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
export const here = fileURLToPath(new URL('.', import.meta.url));
export const schemaVersion = 'D003B-1.0.0';
export const counts = {T01:6,T03:432,T12:6,T13:312,H01:144,T08:504,T22:168,T24:72,T09:1,T35:1,T36:6};
export const sourceFile = type => `docs/research/marketing-ontology/batches/D003B/source/${type}.jsonl`;
const str = {type:'string',minLength:1};
const integer = {type:'integer',minimum:0};
const date = {type:'string',format:'date'};
const time = {type:'string',format:'date-time',pattern:'(Z|[+-][0-9]{2}:[0-9]{2})$'};
const money = {type:'string',pattern:'^[0-9]+\\.[0-9]{2}$',description:'비음수 소수 문자열. KRW/JPY는 .00, USD는 센트 단위. HALF_UP 반올림.'};
const country = {enum:['KR','JP','US']};
const currency = {enum:['KRW','JPY','USD']};
const nullable = s => ({anyOf:[s,{type:'null'}]});
const period = {period_start:date,period_end_exclusive:date};
const pc = {product_id:str,country_code:country};
const cc = {campaign_id:str,country_code:country};
const definitions = {
 T01:{product_id:str,product_name:str,brand_id:str,brand_name:str,brand_role:{enum:['own','competitor']},category_name:{const:'샴푸'},comparison_group:{enum:['A','B']},volume_ml:{const:300},description_ko:str,applicable_countries:{type:'array',items:country,minItems:3,maxItems:3,uniqueItems:true},valid_from:date},
 T03:{...pc,...period,units_sold:{...integer,minimum:100,maximum:5000},sales_value:money,market_total_value:money,currency,coverage_text:str},
 T12:{...cc,campaign_name:str,platform:{enum:['모의 검색','모의 소셜']},channel:{enum:['search','social']},target_product_id:str,valid_from:date,valid_to_exclusive:date,conversion_name:{const:'구매'},attribution_model:{const:'마지막 클릭'},attribution_window_days:{const:7}},
 T13:{...cc,...period,grain:{enum:['month','day']},series_role:{enum:['baseline','detail']},impressions:nullable(integer),clicks:nullable(integer),conversions:nullable(integer),spend:nullable(money),attributed_revenue:nullable(money),currency,availability:{enum:['complete','missing']}},
 H01:{...pc,...period,gross_units:{...integer,minimum:50,maximum:800},returned_units:integer,net_units:integer,gross_sales:money,returns_value:money,net_sales:money,currency},
 T08:{...pc,seller_id:str,seller_name:str,observed_at:time,price:money,currency,availability:{enum:['in_stock','out_of_stock','unknown']},tax_included:{type:'null'},shipping_included:{type:'null'}},
 T22:{...pc,location_id:str,location_name:str,observed_at:time,available_quantity:integer,sellable_status:{enum:['in_stock','out_of_stock']}},
 T24:{...pc,review_id:str,written_at:time,language:{const:'ko'},body_text:str,rating_value:{type:'integer',minimum:1,maximum:5},rating_scale_max:{const:5},verified_purchase:{type:'null'}},
 T09:{...pc,promotion_id:str,seller_id:str,start_at:time,end_at_exclusive:time,discount_ratio:{const:0.1},conditions_ko:str},
 T35:{...pc,change_id:str,location_id:str,changed_at:time,changed_field:{const:'available_quantity'},before_value:integer,after_value:integer,reason_ko:str},
 T36:{...cc,run_id:str,expected_start:date,expected_end_exclusive:date,expected_count:{const:28},received_count:integer,missing_count:integer,missing_dates:{type:'array',items:date,uniqueItems:true},status:{enum:['success','partial']}}
};
const defs = {};
for(const [type,fields] of Object.entries(definitions)) {
 const properties={record_id:str,is_synthetic:{const:true},source_file:{const:sourceFile(type)},available_at:time,reporting_timezone:{enum:['Asia/Seoul','Asia/Tokyo','America/New_York']},...fields};
 defs[type]={type:'object',properties,required:Object.keys(properties),additionalProperties:false};
 if(fields.currency)defs[type].allOf=Object.entries({KR:'KRW',JP:'JPY',US:'USD'}).map(([c,value])=>({if:{properties:{country_code:{const:c}}},then:{properties:{currency:{const:value}}}}));
}
const metrics=['impressions','clicks','conversions','spend','attributed_revenue'];
defs.T13.allOf.push(
 {if:{properties:{grain:{const:'month'}}},then:{properties:{series_role:{const:'baseline'},availability:{const:'complete'},impressions:{type:'integer',minimum:10000,maximum:300000}}},else:{properties:{series_role:{const:'detail'},impressions:nullable({type:'integer',minimum:500,maximum:5000})}}},
 {if:{properties:{availability:{const:'missing'}}},then:{properties:{grain:{const:'day'},...Object.fromEntries(metrics.map(k=>[k,{type:'null'}]))}},else:{properties:Object.fromEntries(metrics.map(k=>[k,['spend','attributed_revenue'].includes(k)?money:integer]))}}
);
export const schema = {$schema:'https://json-schema.org/draft/2020-12/schema',$id:'urn:marketing:D003B:1.0.0',title:schemaVersion,$defs:defs,oneOf:Object.keys(defs).map(t=>({$ref:`#/$defs/${t}`}))};
export function writeSchema(){fs.writeFileSync(new URL('batch.schema.json',import.meta.url),JSON.stringify(schema,null,2)+'\n');}
if(process.argv[1]===fileURLToPath(import.meta.url))writeSchema();
