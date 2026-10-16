// Materialize approved mapping/derivation/definition/assumption separately from immutable sources.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {normalize,toMinor} from '../batches/D005/contract.mjs';
import {localDate} from './d005-canonical.mjs';

const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../../..');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p));
const version='CANONICAL-SYNTHETIC-1';
const authorityPath=path.join(here,'completion-delegation-20261016.json'),authority=read(authorityPath);
assert.equal(authority.approved,true);assert.equal(authority.source,'explicit_human_response');
assert.ok(authority.actions.includes('synthetic_supplement'));
for(const [p,h] of Object.entries(authority.protected_inputs))assert.equal(sha(path.join(root,p)),h,p);
const schemaPath=path.join(here,'../schemas/marketing-records.schema.json'),schema=read(schemaPath);
const sourcePaths=fs.readdirSync(path.join(here,'../batches/D005/source')).sort().map(n=>path.join(here,'../batches/D005/source',n));
const parentPaths=['T01','T12','T24'].map(t=>path.join(here,'../batches/D003B/source',t+'.jsonl'));
const jsonl=p=>fs.readFileSync(p,'utf8').trim().split('\n').map(JSON.parse);
const rows=sourcePaths.flatMap(jsonl).map(normalize),reviews=new Map(jsonl(parentPaths[2]).map(r=>[r.record_id,r]));
const targets=read(path.join(here,'canonical-gap-proposal-20261016.json'));
const allowed=new Map();
for(const g of [...targets.gap_groups,...targets.additional_assignments])for(const id of g.record_ids){if(!allowed.has(id))allowed.set(id,new Set());allowed.get(id).add(g.field);}
const createdAt=new Date().toISOString(),records=[],definitions=new Map(),counts={};
const register=(id,kind,definition)=>{if(!definitions.has(id))definitions.set(id,{id,kind,definition,version,is_synthetic:true});return id;};
const metric=(id,value,unit)=>({metric_id:register(id,'MetricDefinition',`${id}; ${unit}; source value preserved, no population extrapolation`),value,unit,availability:'available',definition_version:version});
const dayAfter=d=>new Date(Date.parse(d+'T00:00:00Z')+86400000).toISOString().slice(0,10);
const period=(start,end,zone)=>({start,end_exclusive:end,timezone:zone,grain:'custom'});
const composite=(...values)=>values.map(v=>encodeURIComponent(typeof v==='string'?v:JSON.stringify(v))).join('/');
function midnight(date,zone){
 const desired=Date.parse(date+'T00:00:00Z');let candidate=desired;
 for(let i=0;i<3;i++){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(candidate));
  const get=t=>parts.find(p=>p.type===t).value;
  const represented=Date.parse(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`);
  candidate+=desired-represented;
 }
 const offset=(desired-candidate)/60000,sign=offset>=0?'+':'-',n=Math.abs(offset);
 return `${date}T00:00:00${sign}${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
}
for(const row of rows){
 const {metadata:m,payload:p}=row,t=m.dataset_type,country=m.country_code,zone=m.reporting_timezone;
 if(!allowed.has(m.record_id))continue;
 const fields={},field_metadata={};
 const put=(name,value,classification,rule,sources)=>{
  const pointer=name.startsWith('/')?name:'/'+name;
  assert.ok(allowed.get(m.record_id).has(pointer),'out of approved target scope: '+pointer);
  assert.notEqual(value,undefined,pointer);fields[pointer]=value;
  const def=schema.$defs[t].properties[pointer.split('/')[1]];
  field_metadata[pointer]={classification,rule,sources,definition:def.description,datatype:def.type||def.$ref||'conditional',
   null_policy:'preserve null; never replace missing with zero',reference_policy:'registered or existing source identity',
   available_at:classification==='mapping'||classification==='derivation'?m.available_at:createdAt,
   original_available_at:m.available_at,rule_version:version,human_confirmed:false};
  counts[classification]=(counts[classification]||0)+1;
 };
 const derive=(n,v,r,s)=>put(n,v,'derivation',r,s);
 const define=(n,v,r,s)=>put(n,v,'definition',r,s);
 const assume=(n,v,r,s)=>put(n,v,'synthetic_assumption',r,s);
 if(t==='T04'){
  derive('cohort_id',register('panel/'+composite(p.panel_id,p.subject_ref,p.period),'Cohort','Panel, subject and period identify this sample only'),'panel-subject-period',['payload.panel_id','payload.subject_ref','payload.period']);
  derive('measures',[metric('positive_responses',p.positive_responses,'count'),metric('positive_rate',p.positive_rate,'ratio')],'source-panel-count-and-rate',['payload.positive_responses','payload.positive_rate']);
 }
 if(t==='T05'){
  derive('term_ref',register('term/'+crypto.createHash('sha256').update(p.term).digest('hex'),'SearchTerm',p.term),'UTF8-term-identity',['payload.term']);
  define('term_kind','keyword','literal-search-term',['payload.term']);
  define('index_definition','가상 검색 관심지수; 같은 normalization_scope 안에서만 최대 100으로 정규화','within-window-index',['payload.normalization_scope','payload.index_value','payload.search_surface']);
 }
 if(t==='T06'){assume('geo_target_ref',register('geo/'+country,'GeoTarget','가상 국가별 검색 타깃'),'synthetic-country-target',['metadata.country_code']);assume('network_scope','synthetic_search_only','synthetic-search-network',['delegation']);}
 if(t==='T07'){assume('search_type','synthetic_web_search','synthetic-search-kind',['delegation']);derive('aggregation_scope','site/page/query/device/period','explicit-source-grain',['payload.site_ref','payload.page_ref','payload.query','payload.device','payload.period']);}
 if(t==='T10'){assume('served_regions',[country],'synthetic-served-region',['metadata.country_code']);define('coverage_text','독립 가상 광고 관측 표본; 실제 송출 지역 또는 시장 전수 확보를 뜻하지 않음','sample-coverage',['metadata.scope_id','metadata.quality']);}
 if(t==='T11')assume('title','가상 경쟁 제품 안내문 '+p.document_id,'supplement-title-not-original',['payload.document_id']);
 if(t==='T14'){derive('report_definition_ref',register('report/'+composite(p.parent_record_id,p.device),'ReportDefinition','D005 parent attribution retained; synthetic device partition'),'parent-device-report',['payload.parent_record_id','payload.device','payload.split_basis']);define('audience_basis','observed_aggregate','synthetic-parent-aggregate-not-target-setting',['payload.split_basis']);}
 if(t==='T15'){assume('report_surface','synthetic_auction','synthetic-auction-surface',['delegation']);define('threshold_status','not_provided','threshold-not-supplied-not-zero',['payload.denominator_status','source-schema']);}
 if(t==='T16'){define('valid_from',midnight(p.period.start,zone),'local-midnight-validity',['payload.period.start','metadata.reporting_timezone']);define('valid_to_exclusive',midnight(p.period.end,zone),'local-midnight-validity',['payload.period.end','metadata.reporting_timezone']);}
 if(t==='T19'){
  assume('seller_ref',register('seller/D005/'+country,'Seller','가상 자사 판매처; 실제 판매처 아님'),'synthetic-country-seller',['metadata.country_code']);
  const gross=rows.filter(r=>r.metadata.dataset_type==='T19'&&r.payload.order_id===p.order_id).reduce((s,r)=>s+toMinor(r.payload.line_gross_total),0n);
  const refunds=rows.filter(r=>r.metadata.dataset_type==='T20'&&r.payload.order_ref===p.order_id&&r.payload.status==='completed'&&Date.parse(r.payload.processed_at)<=Date.parse(p.status_available_at)).reduce((s,r)=>s+toMinor(r.payload.refund_amount),0n);
  assert.ok(refunds<=gross);assume('financial_status',refunds===0n?'paid':refunds===gross?'refunded':'partially_refunded','initially-paid-assumption-and-completed-refunds',['payload.order_id','payload.status_available_at','T19.line_gross_total','T20.completed.refund_amount']);
 }
 if(t==='T23'){assume('retail_channel','synthetic_retail_sample','synthetic-retail-channel',['delegation']);derive('distribution_measures',[metric('stockists',p.stockists,'count'),metric('target_stockists',p.target_stockists,'count')],'source-distribution-counts',['payload.stockists','payload.target_stockists']);}
 if(t==='T25'){
  define('aspect_ref',register('aspect/'+encodeURIComponent(p.aspect),'Aspect',p.aspect),'registered-original-aspect',['payload.aspect']);define('definition_version',version,'new-classification-version-not-retroactive',['payload.aspect','delegation']);
  if(p.record_kind==='annotation')define('extractor_version','D005-generator/'+sha(path.join(here,'../batches/D005/generate.mjs')),'existing-synthetic-generator-not-LLM-or-human',['D005/generate.mjs']);
  else {
   const parents=p.review_refs.map(id=>reviews.get(id));assert.ok(parents.every(Boolean));
   const dates=parents.map(r=>r.written_at.slice(0,10)).sort();derive('period',period(dates[0],dayAfter(dates.at(-1)),zone),'referenced-review-calendar-envelope',['payload.review_refs','D003B.T24.written_at']);
   const annotations=rows.filter(r=>r.metadata.dataset_type==='T25'&&r.payload.record_kind==='annotation'&&r.payload.product_ref===p.product_ref&&r.payload.aspect===p.aspect&&p.review_refs.includes(r.payload.review_ref));
   assert.equal(new Set(annotations.map(r=>r.payload.review_ref)).size,p.mention_count);assert.equal(new Set(annotations.map(r=>r.payload.sentiment)).size,1);
   derive('sentiment',annotations[0].payload.sentiment,'matching-source-annotation-only',annotations.map(r=>r.metadata.record_id));define('assessment_status','provided','provided-synthetic-annotation-not-human-reviewed',['payload.record_kind']);
  }
 }
 if(t==='T26'){assume('channel','synthetic_support','synthetic-support-channel',['delegation']);derive('subject',p.message_text,'existing-message-as-ticket-heading',['payload.message_text']);assume('status','synthetic_open','synthetic-open-not-link-status',['delegation']);}
 if(t==='T27'){assume('platform','모의 동영상','synthetic-video-platform',['delegation']);assume('channel_ref',register('content-channel/'+country,'Channel','가상 콘텐츠 채널'),'synthetic-country-channel',['metadata.country_code']);}
 if(t==='T29'){
  assume('creator_ref',register('creator/'+country,'Creator','가상 협업자'),'synthetic-country-creator',['metadata.country_code']);assume('product_refs',['P1A','P1B'],'synthetic-collaboration-products',['D003B.T01.product_id']);
  const dates=rows.filter(r=>r.metadata.dataset_type==='T27'&&p.content_refs.includes(r.payload.content_id)).map(r=>localDate(r.payload.published_at,zone)).sort();assert.ok(dates.length);
  derive('planned_period',period(dates[0],dayAfter(dates.at(-1)),zone),'linked-content-publication-envelope-not-original-contract',['payload.content_refs','T27.published_at']);assume('message_brief','가상 샴푸 사용 안내 협업','synthetic-message-brief',['delegation']);
 }
 if(t==='T30'){
  if(p.record_kind==='cohort')define('period',period('2026-08-03','2026-08-11',zone),'approved-synthetic-cohort-window',['payload.order_refs','delegation']);
  else assume('deal_amount',{amount:country==='KR'?'100000':country==='JP'?'10000':'100',currency:{KR:'KRW',JP:'JPY',US:'USD'}[country]},'synthetic-B2B-amount-not-B2C',['metadata.country_code','delegation']);
 }
 if(t==='T31'){
  const sent=midnight('2026-08-02',zone).replace('T00:00:00','T12:00:00');assume('sent_at',sent,'synthetic-send-time',['delegation']);
  define('period',period('2026-08-02','2026-08-12',zone),'corrected-observation-window-before-availability',['delegation','metadata.available_at']);
  define('unique_clickers',p.unique_clicks,'distinct-recipients-within-send-synthetic-only',['payload.unique_clicks','delegation']);
 }
 if(t==='T32'){
  define('measure_definition',p.question_text+' / '+p.response_scale.join('·')+'; 표본 긍정 응답 비율','source-question-response-definition',['payload.question_text','payload.response_scale']);
  derive('cohort_ref',register('survey/'+composite(p.study_id,p.subject_ref,p.period),'Cohort','Convenience survey sample'),'study-subject-period',['payload.study_id','payload.subject_ref','payload.period']);
  assert.ok(p.sample_size>0);derive('measures',[metric('positive_responses',p.positive_responses,'count'),metric('sample_size',p.sample_size,'count'),metric('positive_rate',p.positive_responses/p.sample_size,'ratio')],'survey-count-and-denominator',['payload.positive_responses','payload.sample_size']);
 }
 if(t==='T33'){define('item_code','synthetic_index','synthetic-statistical-series',['payload.statistics_table_id']);define('definition','실제 통계가 아닌 가상 지역별 공표 지수','synthetic-index-definition',['payload.statistics_table_id','payload.region_ref']);define('seasonal_adjustment','not_provided','no-seasonal-adjustment-in-source',['source-schema']);}
 if(t==='T34'){
  if(p.record_kind==='weather')derive('measures',['temperature','precipitation'].map(k=>metric(k,p[k].value,p[k].unit)),'source-weather-units',['payload.temperature','payload.precipitation']);
  else define('calendar_kind','operational_schedule','operational-schedule-not-public-holiday',['payload.is_public_holiday','payload.record_kind']);
 }
 if(t==='T37')define('/measures/0/definition_version',version,'LCP-p75-ms-28-day-definition',['payload.measures']);
 if(t==='T38'){
  assume('hypothesis_text','가상 모집단에서 처리 집단의 전환율이 대조 집단보다 높다','testable-hypothesis-not-observed-result',['payload.population']);
  assume('assignment_method','synthetic_random_assignment','synthetic-experiment-assignment',['delegation']);assume('assignment_unit','synthetic_participant','synthetic-assignment-unit',['delegation']);assume('treatment_description','모의 안내문 변경','synthetic-treatment',['delegation']);
  assert.ok(p.period.end<=localDate(m.available_at,zone));derive('status','completed','period-ended-before-availability',['payload.period.end','metadata.available_at']);
 }
 if(t==='T39'){
  define('model_version',version,'new-model-definition-version',['payload.model_id','payload.model_ref']);define('objective','maximize_synthetic_conversions','synthetic-model-objective',['payload.formula','referenced-model.formula']);
  if(p.record_kind==='budget_candidate')derive('expected_measures',[metric('predicted_conversions',p.predicted_conversions,'count')],'existing-prediction-not-outcome',['payload.predicted_conversions']);
 }
 if(t==='T40'){
  define('version',version,'synthetic-policy-version',['payload.policy_id']);assume('objective','가상 전환수 비교','synthetic-policy-objective',['delegation']);assume('product_refs',['P1A'],'synthetic-policy-product',['D003B.T01.product_id']);
  define('allowed_channels',['search','social'],'declared-synthetic-model-channels',['T39.bounds']);define('change_constraints',['총예산 한도 준수','모형의 채널별 상하한 준수','통화·기간 일치','proposed 상태 집행 금지'],'explicit-mock-policy-constraints',['payload.budget','payload.status','T39.bounds']);
 }
 assert.deepEqual(new Set(Object.keys(fields)),allowed.get(m.record_id),m.record_id);
 records.push({record_id:m.record_id,fields,field_metadata});
}
assert.equal(records.length,330);assert.equal(Object.values(counts).reduce((a,b)=>a+b),816);
for(const id of ['P1A','P1B'])register(id,'Product','Existing D003B product identity');
register(version,'DefinitionVersion','New mapping/definition registry, not a historical provider version');
const registry={version,created_at:createdAt,definitions:[...definitions.values()].sort((a,b)=>a.id.localeCompare(b.id))};
const registryPath=path.join(here,'completion-definitions.json');
const supplementPath=path.join(here,'completion-values.json'),approvalPath=path.join(here,'completion-values-authorization.json');
for(const p of [registryPath,supplementPath,approvalPath])assert.ok(!fs.existsSync(p),'overwrite refused: '+p);
fs.writeFileSync(registryPath,JSON.stringify(registry,null,2)+'\n',{flag:'wx'});
const inputPaths=[schemaPath,...sourcePaths,...parentPaths,fileURLToPath(import.meta.url),registryPath];
const supplement={version:'D005-CANONICAL-SUPPLEMENT-1',created_at:createdAt,input_sha256:Object.fromEntries(inputPaths.map(p=>[path.resolve(p),sha(p)])),classification_counts:counts,records};
fs.writeFileSync(supplementPath,JSON.stringify(supplement,null,2)+'\n',{flag:'wx'});
const approval={source:'delegated_execution',approved:true,authority_file:authorityPath,authority_sha256:sha(authorityPath),supplement_sha256:sha(supplementPath),record_count:330,field_count:816,human_reviewed_bytes:false};
fs.writeFileSync(approvalPath,JSON.stringify(approval,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'pass',source_rows_added:0,completion_rows:330,field_assignments:816,classifications:counts,definitions:definitions.size}));
