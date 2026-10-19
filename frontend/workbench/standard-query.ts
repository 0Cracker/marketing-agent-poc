import type {Model,Raw,Row,Column,QueryOptions} from './contract';
import typeMap from '../../docs/design/marketing-workbench-type-map.json';
import {createLegacyQuery} from './legacy-query';
import {str} from './values';
import {countries,currencies,brandColors} from './presentation';
import {connectVisuals} from './connected-views';

export type StandardCatalog={batch:string;scenario:string;records:Raw[];products:Raw[];definitions:Raw};
export type CatalogLock={sha256:string;source_created_at:string;rows:number;screen_contract:string};
const obj=(value:unknown):Raw=>value&&typeof value==='object'&&!Array.isArray(value)?value as Raw:{};
const cash=(value:unknown)=>obj(value).amount??null;
const fields:Record<string,string[]>={
 T02:['mapping_kind','entity_ref','external_system','external_value','match_status','valid_from','valid_to_exclusive'],
 T04:['subject_ref','panel_id','cohort_id','sample_size','weighting_method','measures'],
 T05:['term_ref','index_value','normalization_scope','index_definition','search_surface','period'],
 T06:['keyword','estimated_searches','competition_level','competition_index','low_bid','high_bid','network_scope'],
 T07:['page_ref','device','query','clicks','impressions','average_position','aggregation_scope'],
 T08:['variant_ref','seller_ref','observed_at','listed_price','regular_price','availability','tax_included','shipping_included'],
 T09:['promotion_id','product_refs','seller_ref','period','promotion_type','discount_ratio','eligibility_text'],
 T10:['public_ad_id','advertiser_ref','observed_at','format','creative_text'],
 T11:['document_id','publisher','published_at','event_time','body_text','subject_refs'],
 T12:['campaign_id','channel','product_refs','status','budget_amount','budget_period','target_definition'],
 T14:['campaign_ref','parent_report_ref','breakdown_dimensions','metrics','report_definition_ref','audience_basis'],
 T15:['campaign_ref','competitor_domain','impression_share','overlap_rate','period'],
 T16:['creative_id','product_refs','version','format','message_text','valid_from','valid_to_exclusive'],
 T17:['event_id','event_time','event_name','session_ref','page_ref','device','consent_state'],
 T18:['event_id','event_name','event_time','transaction_ref','variant_ref','quantity','unit_price','measurement_basis'],
 T19:['order_id','line_id','ordered_at','variant_ref','quantity','unit_price','line_gross_total','financial_status'],
 T20:['adjustment_id','adjustment_kind','order_ref','processed_at','quantity','refund_amount','status'],
 T21:['variant_ref','period','unit_cost','margin_definition'],
 T22:['variant_ref','location_ref','observed_at','available_quantity','committed_quantity','on_hand_quantity','sellable_status'],
 T23:['record_kind','order_ref','shipment_id','variant_ref','status','period','measures'],
 T25:['subject_ref','review_ref','aspect_ref','sentiment','evidence_span','definition_version','extractor_version'],
 T26:['case_id','opened_at','subject_ref','category','status','body_text'],
 T27:['content_id','published_at','platform','body_text','measures'],
 T28:['comment_id','content_ref','published_at','body_text','parent_ref'],
 T29:['collaboration_id','creator_ref','content_refs','period','measures'],
 T30:['record_kind','cohort_ref','period','sample_size','acquisition_channel','net_revenue','repeat_purchase_rate'],
 T31:['campaign_id','period','channel','sent','delivered','unique_clicks','measures'],
 T32:['study_id','subject_ref','period','sample_size','question_text','response_scale','measures'],
 T33:['series_id','period','value','unit','seasonal_adjustment','statistics_table_id'],
 T34:['event_id','event_time','region_ref','event_type','description'],
 T35:['entity_ref','changed_at','changed_field','before_value','after_value','reason_text'],
 T36:['run_id','target_dataset','expected_period','status','expected_count','received_count','missing_count','duplicate_count','error_code'],
 T37:['site_ref','period','status','measures'],
 T38:['experiment_id','arm_id','period','sample_size','assignment_method','outcome_measures','uncertainty_text'],
 T39:['record_kind','model_ref','model_version','scenario_id_ref','formula','parameters','allocations','expected_measures','assumptions'],
 T40:['policy_id','period','objective','budget_limit','policy_status','allowed_channels','change_constraints'],
};
const labels:Record<string,string>={subject_ref:'제품·대상',product_refs:'대상 제품',variant_ref:'제품 변형',period:'대상 기간 (종료 제외)',expected_period:'수집 대상 기간 (종료 제외)',observed_at:'관측 시각',seller_ref:'판매처',location_ref:'위치',listed_price:'관측 가격',regular_price:'기준 가격',availability:'관측 상태',tax_included:'세금 포함',shipping_included:'배송 포함',sample_size:'표본 수',measures:'지표·정의·단위',index_value:'상대 관심지수',normalization_scope:'정규화 범위',index_definition:'지수 정의',keyword:'키워드',estimated_searches:'예상 검색수',competition_level:'경쟁 수준',competition_index:'경쟁 지수',low_bid:'낮은 입찰가',high_bid:'높은 입찰가',clicks:'클릭수',impressions:'노출수',average_position:'평균 순위',device:'기기',page_ref:'페이지',aggregation_scope:'집계 범위',campaign_ref:'캠페인',campaign_id:'캠페인 ID',channel:'채널',budget_amount:'설정 예산',budget_period:'예산 단위',status:'자료 상태',target_definition:'대상 정의',metrics:'광고 지표·통화',parent_report_ref:'부모 보고',breakdown_dimensions:'세그먼트 조건',report_definition_ref:'보고 정의',public_ad_id:'공개 광고 ID',advertiser_ref:'광고주',format:'형식',creative_text:'소재 내용',document_id:'문서 ID',publisher:'발행처',published_at:'발행 시각',body_text:'본문',event_time:'사건 시각',message_text:'메시지',version:'버전',valid_from:'유효 시작',valid_to_exclusive:'유효 종료 (제외)',quantity:'수량',unit_price:'단가',line_gross_total:'주문행 금액',financial_status:'결제 상태',order_id:'주문 ID',line_id:'주문행 ID',ordered_at:'주문 시각',processed_at:'처리 시각',refund_amount:'환불 금액',adjustment_kind:'조정 종류',unit_cost:'원가',margin_definition:'마진 정의',available_quantity:'판매 가능 수량',committed_quantity:'예약 수량',on_hand_quantity:'보유 수량',sellable_status:'판매 상태',review_ref:'원문 리뷰',aspect_ref:'측면',sentiment:'가상 규칙 감성',evidence_span:'근거 발췌·위치',definition_version:'정의 버전',extractor_version:'주석 규칙 버전',cohort_ref:'코호트',net_revenue:'코호트 순액',repeat_purchase_rate:'재구매율',arm_id:'실험군',experiment_id:'실험 ID',outcome_measures:'실험군 관측값',uncertainty_text:'불확실성',record_kind:'자료 종류',model_ref:'모형',model_version:'모형 버전',formula:'모형 수식',parameters:'가상 모형 계수',allocations:'후보 배분',expected_measures:'모형 예상값',assumptions:'모형 가정',policy_id:'정책 ID',objective:'목표',budget_limit:'예산 한도',policy_status:'모의 정책 상태',allowed_channels:'허용 채널',change_constraints:'변경 제약',run_id:'수집 실행',target_dataset:'수집 대상',expected_count:'기대 건수',received_count:'수신 건수',missing_count:'누락 건수',duplicate_count:'중복 건수',error_code:'수집 오류',changed_field:'변경 필드',before_value:'이전 값',after_value:'이후 값',reason_text:'변경 사유'};

Object.assign(labels,{"mapping_kind":"연결 종류","entity_ref":"연결 대상","external_system":"외부 시스템","external_value":"외부 식별자","match_status":"연결 상태","country_code":"국가 코드","entity_type":"대상 종류","evidence":"연결 근거","language":"언어","query":"검색어","query_id":"검색 요청","term_ref":"검색어 기준","term_kind":"검색어 종류","search_surface":"검색 범위","search_type":"검색 종류","network_scope":"네트워크 범위","geo_target_ref":"타깃 국가","competition_level":"경쟁 수준","competition_index":"경쟁 지수","competitor_domain":"경쟁 도메인","impression_share":"노출 점유율","overlap_rate":"중복률","threshold_status":"분모 제공 상태","panel_id":"패널","cohort_id":"코호트","weighting_method":"가중 방식","event_id":"이벤트 ID","event_name":"이벤트 종류","session_ref":"세션","transaction_ref":"거래","consent_state":"동의 상태","traffic_source":"유입 경로","user_pseudo_ref":"가명 사용자","customer_pseudo_ref":"가명 고객","account_id":"광고 계정","platform":"플랫폼","entity_level":"집계 수준","entity_id":"집계 대상","report_state":"보고 상태","conversion_definition_ref":"전환 정의","attribution_model":"귀속 모형","attribution_window":"귀속 창","audience_basis":"잠재고객 집계 기준","report_surface":"보고 범위","bidding_strategy":"입찰 전략","landing_ref":"랜딩 페이지","coverage_id":"커버리지 ID","measurement_method":"측정 방식","projection_version":"추정 버전","retail_channel":"유통 범위","offer_id":"판매 제안","pack_quantity":"포장 수량","promotion_id":"행사 ID","promotion_type":"행사 종류","eligibility_text":"적용 조건","creative_id":"소재 ID","document_id":"문서 ID","subject_refs":"대상 목록","served_regions":"노출 국가","coverage_text":"표본 범위","order_ref":"원주문","order_line_ref":"원주문행","requested_at":"요청 시각","adjustment_id":"조정 ID","reason_code":"처리 사유","restocked":"재입고 확인","accounting_basis":"원가 기준","fulfilment_status":"배송 상태","line_discount":"주문행 할인","line_tax":"주문행 세금","location_ref":"위치","item_index":"상품행 번호","sale_price":"판매 가격","review_id":"리뷰 ID","written_at":"작성 시각","review_subject_type":"리뷰 대상 종류","rating_value":"별점","rating_scale_max":"별점 만점","verified_purchase":"구매 확인","invited_review":"요청 리뷰 여부","assessment_status":"주석 제공 상태","case_id":"문의 ID","category":"문의 분류","content_id":"콘텐츠 ID","comment_id":"댓글 ID","content_ref":"원콘텐츠","channel_ref":"채널","parent_ref":"상위 댓글","creator_ref":"크리에이터","collaboration_id":"협업 ID","planned_period":"예정 기간 (종료 제외)","message_brief":"협업 요청 내용","agreement_status":"가상 계약 상태","fee":"협업 비용","rights_text":"권리 조건","content_refs":"콘텐츠 목록","acquisition_channel":"획득 채널","segment_ref":"고객 세그먼트","open_measurement_basis":"열람 측정 기준","linked_orders":"연결 주문","study_id":"조사 ID","question_text":"조사 질문","measure_definition":"응답 지표 정의","response_scale":"응답 척도","sampling_method":"표본 추출 방식","series_id":"시계열 ID","statistics_table_id":"통계표","item_code":"통계 항목","value":"관측값","unit":"단위","definition":"정의","seasonal_adjustment":"계절 조정","region_ref":"지역","station_ref":"관측 지점","observation_quality":"관측 품질","calendar_kind":"달력 종류","change_id":"변경 ID","changed_at":"변경 시각","operation":"변경 동작","client_type":"기록 주체","started_at":"수집 시작","completed_at":"수집 종료","schema_version":"스키마 버전","assignment_method":"배정 방식","assignment_unit":"배정 단위","hypothesis_text":"실험 가설","treatment_description":"실험 조건","validity_scope":"모형 유효 범위","kpi_definition_refs":"목표 지표 정의","approval_role":"검토 역할","metric_definition_refs":"지표 정의 목록","report_kind":"보고 종류","reconciliation":"원장 대사 상태","units_sold":"판매량","sales_value":"판매액","market_total_value":"시장 분모","distribution_measures":"분포 관측값","resolved_at":"해결 시각"});

export function createStandardQuery(catalog:StandardCatalog,lock:CatalogLock){
 const batch=catalog.batch;
 const records=catalog.records;
 const byId=new Map(records.map(r=>[str(r,'record_id'),r]));
 const products=catalog.products.map(p=>{const record=records.find(r=>r.dataset_type==='T01'&&r.product_id===p.product_id);return record?{...p,record_id:record.record_id,product_name:record.name,valid_from:record.valid_from,available_at:obj(record.temporal).available_at,source_file:obj(record.provenance).artifact_ref,_canonical:record}:p;});
 const product=(id:string)=>products.find(p=>p.product_id===id);
 const identity=(r:Raw)=>String(r.subject_ref||r.product_ref||r.product_id||r.variant_ref||(r.product_refs as string[]||[])[0]||r.term_ref||r.keyword||r.campaign_ref||r.page_ref||'').match(/P[123][AB]/)?.[0]||'';
 const base=(r:Raw)=>({record_id:r.record_id,is_synthetic:r.is_synthetic,source_file:obj(r.provenance).artifact_ref,available_at:obj(r.temporal).available_at,reporting_timezone:obj(r.temporal).reporting_timezone,country_code:str(r,'scope_id').split('-')[1],product_id:identity(r),period_start:obj(r.period).start,period_end_exclusive:obj(r.period).end_exclusive,_canonical:r});
 // Only these reviewed projections reuse the existing calculations. Other types retain
 // their declared dimensions in a detail view instead of inventing cross-sample totals.
 const projected:Record<string,Raw[]>={T01:products,T03:[],T24:[],T13:[],T12:[],H01:[]};
 for(const r of records){
  const b=base(r),type=str(r,'dataset_type');
  if(type==='T03')projected.T03.push({...b,units_sold:r.units_sold,sales_value:cash(r.sales_value),market_total_value:cash(r.market_total_value),coverage_text:obj(r.quality).coverage,measurement_method:r.measurement_method});
  if(type==='T24')projected.T24.push({...b,review_id:r.review_id,written_at:r.written_at,body_text:r.body_text,rating_value:r.rating_value,rating_scale_max:r.rating_scale_max,verified_purchase:r.verified_purchase,language:r.language});
  if(type==='T12'){const target=(r.product_refs as string[])?.[0],channel=r.channel==='search'?'모의 검색':r.channel==='social'?'모의 소셜':str(r,'channel');projected.T12.push({...b,campaign_id:r.campaign_id,campaign_name:(str(product(target)||{},'product_name')||target)+' · '+channel,platform:channel,channel:r.channel,target_product_id:target});}
  if(type==='T13'){const m=obj(r.metrics);projected.T13.push({...b,campaign_id:r.campaign_ref,grain:obj(r.period).grain,impressions:m.impressions,clicks:m.clicks,spend:cash(m.spend),conversions:m.attributed_conversions,attributed_revenue:cash(m.attributed_value),availability:obj(r.quality).availability});}
  if(type==='H01'){const measures=r.measures as Raw[];const values=Object.fromEntries(measures.map(m=>[String(m.metric_id).replace(/^[^.]+\./,''),obj(m.value).amount??m.value]));projected.H01.push({...b,...values});}
 }
 const legacy=createLegacyQuery(projected);
 const productEvidence=new Map(records.filter(r=>r.dataset_type==='T01').map(r=>[r.product_id,r]));
 const evidence=(rs:Raw[])=>rs.map(r=>obj(r._canonical).record_id?obj(r._canonical):products.some(p=>p.record_id===r.record_id)?productEvidence.get(r.product_id)||r:r);
 function restore(model:Model){
  model.source=evidence(model.source);for(const m of model.metrics)m.source=evidence(m.source);
  for(const row of model.rows)row.source=evidence(row.source);
  for(const chart of model.charts){for(const row of chart.data)row.source=evidence(row.source);chart.subtitle=chart.subtitle.replace('제품·국가별 4개 표본','현재 선택한 수집 표본');chart.note=chart.note.replace('감성 주석 미생성','감성 주석은 별도 T25 표본');}
  model.products=products;model.dataset=batch;model.asOf=lock.source_created_at;if(model.type==='T13')model.detailTitle='캠페인별 광고 성과';
  model.coverage='통합 현재 자료 · 독립 가상 표본 · 국가·통화·범위 분리 · 원천의 부분 표본';
  return model;
 }
 const scopeCountry=(r:Raw)=>str(r,'scope_id').split('-')[1];
 function inPeriod(r:Raw,month:string):boolean{
  if(month==='ALL')return true;
  const period=obj(r.period||r.planned_period||r.expected_period),end=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),1)).toISOString().slice(0,10);
  if(period.start&&period.end_exclusive)return String(period.start)<end&&String(period.end_exclusive)>month+'-01';
  const declared=str(obj(r.temporal),'timestamp_field');
  if(declared&&r[declared]&&declared!=='valid_from')return String(r[declared]).startsWith(month);
  for(const key of ['written_at','observed_at','ordered_at','event_time','published_at','created_at','opened_at','requested_at','processed_at','changed_at','incident_start','promised_at','sent_at'])if(r[key])return String(r[key]).startsWith(month);
  if(r.valid_from)return String(r.valid_from)<end&&(!r.valid_to_exclusive||String(r.valid_to_exclusive)>month+'-01');
  if(r.review_ref){const parent=byId.get(String(r.review_ref));return !!parent&&inPeriod(parent,month);}
  // Models and identity definitions without a measurement window remain definitions.
  return true;
 }
 const ratios=new Set(['discount_ratio','impression_share','overlap_rate','repeat_purchase_rate']);
 const measureText=(m:Raw)=>{
  const v=m.value;
  const display=v==null?'—':obj(v).amount!==undefined?`${obj(v).amount} ${obj(v).currency}`:m.unit==='ratio'?`${(Number(v)*100).toFixed(1)}%`:String(v);
  return `${labels[String(m.metric_id)]||String(m.metric_id).replace(/^[^.]+\./,'')} ${display}${m.unit==='count'?'건':''}`;
 };
 const value=(r:Raw,key:string)=>{
  const v=r[key];if(v==null)return null;if(typeof v==='number'||typeof v==='string')return v;
  if(typeof v==='boolean')return v?'예':'아니오';
  if(obj(v).amount!==undefined)return Number(obj(v).amount);
  if(obj(v).start)return `${obj(v).start} → ${obj(v).end_exclusive} (종료 제외)`;
  if(key==='evidence_span')return String(obj(v).quote??'—');
  if(key==='product_refs')return (v as string[]).map(id=>str(product(id)||{},'product_name')||id).join(' · ');
  if(Array.isArray(v))return v.map(item=>typeof item==='string'?item:obj(item).metric_id?measureText(obj(item)):obj(item).name?`${obj(item).name}: ${obj(item).value}`:JSON.stringify(item)).join(' · ');
  if(key==='metrics')return Object.entries(obj(v)).map(([k,n])=>`${({spend:'광고비',clicks:'클릭수',impressions:'노출수',attributed_conversions:'매체 전환수',attributed_value:'귀속 매출'} as Record<string,string>)[k]||k}: ${obj(n).amount!==undefined?`${obj(n).amount} ${obj(n).currency}`:n??'—'}`).join(' · ');
  return JSON.stringify(v);
 };
 function query(type:string,country:string,month:string,options:QueryOptions={}):Model{
  const asOf=options.asOf||lock.source_created_at;
  if(!Number.isFinite(Date.parse(asOf)))throw Error('조회 기준 시각이 올바르지 않습니다');
  const all=records.filter(r=>str(r,'dataset_type')===type&&(country==='ALL'||type==='T01'||(str(r,'_country')||scopeCountry(r))===country||str(r,'_country')==='GLOBAL')&&((options.detailOnly&&!options.asOf)||Date.parse(String(obj(r.temporal).available_at))<=Date.parse(asOf)));
  if(lock.screen_contract==='workbench-model/1'&&!options.detailOnly&&country!=='ALL'&&month!=='ALL'&&['T03','T13','T24','H01','T01'].includes(type)&&!(type==='T24'&&(options.brand||options.product))&&Date.parse(asOf)>=Date.parse(lock.source_created_at)){
   const result=restore(legacy(type,country,month,options));
   result.asOf=asOf;
   if(type==='T13')for(const row of result.rows){if(!row.child)row.values.name=str(projected.T12.find(c=>c.campaign_id===row.id)||{},'campaign_name')||String(row.id);row.values.window=String(obj(row.source.find(s=>s.attribution_window)).attribution_window??'—');}
   return result;
  }
  let selected=all.filter(r=>inPeriod(r,month));
  if(options.brand)selected=selected.filter(r=>product(identity(r))?.brand_id===options.brand);
  if(options.product)selected=selected.filter(r=>identity(r)===options.product||(r.product_refs as string[]||[]).includes(options.product!));
  if((type==='T08'||type==='T22')&&!options.detailOnly)selected=selected.filter(r=>(options.observed==='ALL'||str(r,'observed_at').startsWith(options.observed||month+'-30'))&&(options.group==='ALL'||product(identity(r))?.comparison_group===(options.group||'A')));
  const contextKey=type==='T05'?'normalization_scope':type==='T38'?'experiment_id':type==='T39'?'model_ref':'';
  if(contextKey&&country!=='ALL'&&lock.screen_contract==='workbench-model/1'&&!options.detailOnly&&selected.length){const chosen=selected.some(r=>r[contextKey]===options.context)?options.context:selected[0][contextKey];selected=selected.filter(r=>r[contextKey]===chosen);}
  const name=typeMap.types.find(t=>t.id===type)?.name||type;
  const metadata=new Set(['dataset_type','record_id','is_synthetic','value_origin','provenance','quality','temporal','related_record_ids','_source','_payload','_contract_gaps']);
  const keys=[...new Set([...(fields[type]||[]).filter(k=>selected.some(r=>k in r)),...selected.flatMap(r=>Object.keys(r).filter(k=>!metadata.has(k)))])];
  const extraLabels:Record<string,string>={_batch:'배치',_country:'국가',_conforming:'명세 적합',scope_id:'데이터 범위',scenario_id:'시나리오',created_at:'접수 시각',ticket_id:'문의 ID',subject:'문의 주제',product_ref:'제품',description_text:'콘텐츠 설명',view_count:'조회수',emails_sent:'발송수',bounces:'반송수',unique_clickers:'유일 클릭자 수',unsubscribes:'구독 해지수',crm_campaign_id:'CRM 캠페인',sent_at:'발송 시각',unique_opens:'유일 열람자 수',incident_start:'장애 시작',incident_end:'장애 종료',error_text:'장애 내용',shipped_at:'출고 시각',promised_at:'약속 시각',delivered_at:'배송 시각',total_budget:'후보 총예산',name:'이름',title:'제목',quantity:'수량'};
  const columns:Column[]=[{key:'name',label:'대상 / 근거 ID'},...keys.map(key=>({key:key==='name'?'source_name':key,label:labels[key]||extraLabels[key]||key,kind:(ratios.has(key)?'percent':selected.some(r=>obj(r[key]).amount!==undefined)?country==='ALL'?'text':'money':selected.some(r=>typeof r[key]==='number'&&!Number.isInteger(r[key]))?'decimal':selected.some(r=>typeof r[key]==='number')?'number':'text') as Column['kind']}))];
  const rows:Row[]=selected.map(r=>({id:(str(r,'_batch')||batch)+'/'+str(r,'record_id'),values:{name:str(product(identity(r))||{},'product_name')||str(r,'record_id'),...Object.fromEntries(keys.map(key=>[key==='name'?'source_name':key,country==='ALL'&&obj(r[key]).amount!==undefined?`${obj(r[key]).amount} ${obj(r[key]).currency}`:ratios.has(key)&&typeof r[key]==='number'?Number(r[key])*100:value(r,key)]))},source:[r],formula:'표준화 레코드 표시 · 비율은 ×100해 %로 표현 · 다른 표본·정의·집계 수준을 합산하지 않음'}));
  const model:Model={dataset:batch,asOf,type,title:name,status:rows.length?'ready':'empty',reason:rows.length?'':'선택 국가·기간·관측 조건에 해당하는 자료 없음',country,currency:currencies[country],period:(type==='T08'||type==='T22')&&options.observed&&options.observed!=='ALL'?options.observed:month,timezone:country==='US'?'America/New_York':country==='JP'?'Asia/Tokyo':'Asia/Seoul',coverage:'독립 가상 표본 · 정의·모형·주석은 관측·실제 승인과 구분',metrics:[{label:'선택 범위 레코드',value:rows.length,kind:'number',unit:'건',source:selected,note:'기간이 겹치는 표본·정의의 개수이며 시장 전체 수량이 아님'}],charts:[],columns,rows,sort:'name',direction:'asc',source:selected};
  if(type==='T25'&&selected.length){
   model.charts=[{title:'가상 규칙 주석 분포',subtitle:`${countries[country]} · ${month}`,unit:'주석 건',kind:'bar',data:['positive','neutral','negative'].map((s,i)=>{const rs=selected.filter(r=>r.sentiment===s);return {id:s,values:{name:['긍정','중립','부정'][i],count:rs.length},source:rs};}),series:[{key:'count',name:'주석 수 (리뷰 수 아님)',color:brandColors.B1}],note:'규칙으로 생성한 가상 주석 · 사람 검토·LLM 분석·시장 감성으로 확대하지 않음'}];
  }
  model.dataset=batch;model.detailTitle='전체 필드 · 원천 레코드';model.currency=currencies[country]||'';if(country==='ALL')model.timezone='원천 레코드별 시간대';
  model.reason=rows.length?'':`선택 조건에 해당하는 ${batch} 자료가 없습니다`;
  model.period=month==='ALL'?'전체 기간':model.period;
  model.coverage='통합 현재 자료 · 가상 표본 · 범위·통화 분리 · 출처 ID는 원문 유지';
  if(!options.detailOnly)connectVisuals(model,selected,options.context,all);
  return model;
 }
 return {query,products,observationDates:(type:string,country:string,month:string)=>[...new Set(records.filter(r=>r.dataset_type===type&&(country==='ALL'||scopeCountry(r)===country)&&r.observed_at&&(month==='ALL'||String(r.observed_at).startsWith(month))).map(r=>String(r.observed_at).slice(0,10)))].sort(),campaigns:projected.T12.map(r=>({id:str(r,'campaign_id'),country:str(r,'country_code'),label:str(r,'campaign_name')})),months:[...new Set(projected.T03.map(r=>str(r,'period_start').slice(0,7)))].sort(),contexts:(type:string,country:string,month:string)=>{
  const key=type==='T05'?'normalization_scope':type==='T38'?'experiment_id':type==='T39'?'model_ref':'';
  return key?[...new Set(records.filter(r=>r.dataset_type===type&&(country==='ALL'||scopeCountry(r)===country)&&inPeriod(r,month)).map(r=>str(r,key)))].filter(Boolean):[];
 }};
}
