// Creates schema definitions and field documentation only. Never creates marketing records.
// Run: node docs/research/marketing-ontology/schemas/build-catalog.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {policies, horizon, detailWindow, historicalReportBudget} from './temporal-policy.mjs';

const out = path.dirname(fileURLToPath(import.meta.url));
const ref = name => ({$ref: `#/$defs/${name}`});
const str = {type: 'string', minLength: 1};
const count = {type: 'integer', minimum: 0};
const num = {type: 'number'};
const nonnegative = {type: 'number', minimum: 0};
const ratio = {type: 'number', minimum: 0, maximum: 1};
const date = {type: 'string', format: 'date'};
const time = {type: 'string', format: 'date-time'};
const boolean = {type: 'boolean'};
const ids = {type: 'array', items: str, uniqueItems: true};
const enumeration = (...values) => ({type: 'string', enum: values});
const nullable = schema => ({anyOf: [schema, {type: 'null'}]});
const object = (properties, required = Object.keys(properties)) => ({type: 'object', properties, required, additionalProperties: false});
const array = items => ({type: 'array', items});
const field = (name, schema, priority, description, target = '') => [name, {...schema, description, 'x-priority': priority, ...(target ? {'x-reference-target': target} : {})}];
const R = (name, schema, description, target) => field(name, schema, '필수', description, target);
const C = (name, schema, description, target) => field(name, schema, '조건부', description, target);
const O = (name, schema, description, target) => field(name, schema, '선택', description, target);
const records = [];
function add(id, group, title, grain, sources, fields, rules, branches = []) {
  assert.equal(new Set(fields.map(f => f[0])).size, fields.length, `${id}: duplicate field`);
  records.push({id, group, title, grain, sources, fields, rules, branches});
}

const defs = {
  Money: object({amount: {type: 'string', pattern: '^-?[0-9]+(?:\\.[0-9]{1,6})?$'}, currency: {type: 'string', pattern: '^[A-Z]{3}$'}}),
  Quantity: object({amount: nonnegative, unit: str}),
  Period: object({start: date, end_exclusive: date, timezone: str, grain: enumeration('day', 'week', 'month', 'quarter', 'year', 'custom')}),
  TemporalContext: object({time_kind:enumeration('instant','interval','validity','rolling','model'),source_grain:enumeration('instant','day','week','month','quarter','year','custom'),series_role:enumeration('baseline','detail'),calendar_id:str,reporting_timezone:str,coverage_kind:enumeration('aggregate_report','full_population','sample','partial','unknown'),available_at:time,revision:count,timestamp_field:str,period_field:str,supersedes_record_id:str},['time_kind','source_grain','series_role','calendar_id','reporting_timezone','coverage_kind','available_at','revision']),
  EvidenceSpan: {...object({record_ref: str, field_path: str, quote: str, language: str, start_offset: count, end_offset: count}, ['record_ref', 'field_path', 'language']), anyOf:[{required:['quote']},{required:['start_offset','end_offset']}]},
  Provenance: object({system: str, collection_method: enumeration('api', 'export', 'manual', 'internal_log', 'synthetic_generation'), source_record_key: str, artifact_ref: str, field_path: str, collected_at: time, access_class: enumeration('public', 'owned', 'licensed', 'internal'), documentation_refs: ids}, ['system', 'collection_method', 'source_record_key', 'artifact_ref', 'access_class', 'documentation_refs']),
  Quality: object({availability: enumeration('available', 'missing', 'suppressed', 'not_applicable', 'not_collected'), reason: str, coverage: str, is_partial: boolean, revised_at: time}, ['availability', 'coverage', 'is_partial']),
  Dimension: object({name: str, value: str}),
  MetricValue: object({metric_id: str, value: nullable({anyOf:[num,ref('Money')]}), unit: str, availability: enumeration('available', 'missing', 'suppressed', 'not_applicable'), definition_version: str}, ['metric_id', 'value', 'unit', 'availability', 'definition_version']),
  AdMetrics: object({spend: nullable(ref('Money')), impressions: nullable(count), clicks: nullable(count), reach: nullable(count), attributed_conversions: nullable(nonnegative), attributed_value: nullable(ref('Money')), frequency: nullable(nonnegative)}, ['spend', 'impressions', 'clicks']),
  Allocation: object({campaign_ref: str, amount: ref('Money'), lower: ref('Money'), upper: ref('Money')}, ['campaign_ref', 'amount', 'lower', 'upper']),
};

const common = Object.fromEntries([
  R('record_id', str, '레코드 전역 식별자. 소스·유형·범위를 포함해 중복 방지'),
  R('dataset_type', str, 'T01–T40 유형 식별자'),
  R('scope_id', str, '국가·카테고리·비교 집합을 정의하는 범위 참조', 'Scope'),
  R('scenario_id', str, '서로 다른 가상 상황을 섞지 않는 격리 키', 'Scenario'),
  R('is_synthetic', boolean, '가상 자료 여부. 모의 값과 실제 출처 문서를 구별'),
  R('value_origin', enumeration('direct_observation', 'platform_attributed', 'provider_estimate', 'derived_calculation', 'manual_annotation', 'llm_extraction', 'simulation'), '값이 만들어진 방식. is_synthetic과 별개'),
  R('provenance', ref('Provenance'), '실제형 원천 시스템·파일 위치·수집 방식·문서 근거'),
  R('quality', ref('Quality'), '결측·억제·수집 범위·부분자료 표시'),
  R('temporal', ref('TemporalContext'), '시간 의미·원천 간격·달력·표본 범위·자료 확보 시점'),
  O('related_record_ids', ids, '근거/변경/승인 자료 추가 참조'),
]);

add('T01', 1, '제품·변형 마스터', '제품의 한 변형·유효기간', ['M11','M15','M42'], [
  R('product_id', str, '국가 간 공통 제품 정체성', 'Product'), R('variant_id', str, '용량·향 등 판매 변형', 'Variant'),
  R('brand_id', str, '브랜드 연결', 'Brand'), R('category_id', str, '카테고리 정의 연결', 'Category'), R('sku', str, '내부 판매 식별자'),
  R('name', str, '상품명'), R('valid_from', date, '속성 적용 시작일'), O('valid_to_exclusive', date, '속성 적용 종료일'),
  C('pack_quantity', ref('Quantity'), '용량 가격 비교 시 필수'), O('ingredients', ids, '원천에서 확인한 성분명; 효능으로 추정하지 않음'),
  O('declared_claims', ids, '상품에 표시된 설명; 실제 효과 검증과 구별'), O('intended_audience', ids, '제품 설명상의 대상'),
  O('options', array(ref('Dimension')), '향·패키지 등 실제 제공 옵션'), R('status', enumeration('planned','active','discontinued','unknown'), '유효한 상품 상태'),
], ['변형→제품→브랜드가 존재해야 함','용량·성분은 국가별 표시/변형 차이를 보존','상품 효능 문구를 입증된 인과로 저장하지 않음']);
add('T02', 1, '외부 ID·별칭 매핑', '한 외부 식별자/별칭의 매핑', ['M15','M18','M19','M40'], [
  R('mapping_kind', enumeration('external_id','alias','url'), '매핑 종류'), R('entity_type', enumeration('brand','product','variant','seller'), '매핑 대상 유형'),
  R('entity_ref', str, '내부 개체 참조', 'Brand/Product/Variant/Seller'), R('external_system', str, '외부 명명 체계'), R('external_value', str, '원천의 코드·별칭·URL'),
  R('country_code', {type:'string',pattern:'^[A-Z]{2}$'}, 'ISO 국가 코드'), C('language', str, '별칭/상품명 매핑에 필수'),
  R('match_status', enumeration('confirmed','candidate','ambiguous','unmatched'), '매핑 확정 수준'), R('valid_from', date, '유효 시작'), O('valid_to_exclusive', date, '유효 종료'),
  C('evidence', ref('EvidenceSpan'), '후보·확정 매핑 근거'),
], ['제목 유사성만으로 confirmed 금지','하나의 외부 식별자에 충돌하는 확정 매핑이 없어야 함']);
add('T03', 2, '소매·시장 측정', '상품/브랜드×지역/채널×기간', ['M27'], [
  R('subject_ref', str, '제품 또는 브랜드', 'Product/Brand'), R('period', ref('Period'), '측정 기간'), R('region_ref', str, '지역 정의', 'Region'),
  R('retail_channel', str, '유통 채널'), R('coverage_id', str, '점포·시장 커버리지 정의', 'Coverage'), R('measurement_method', enumeration('pos_observed','panel_projected','provider_estimated'), '실측/투영/추정 구분'),
  R('units_sold', nullable(nonnegative), '단위 판매량; 표본 추정은 소수 가능'), R('sales_value', nullable(ref('Money')), '같은 범위의 판매액'),
  C('market_total_value', ref('Money'), '금액 점유율 산출 시 필요'), O('distribution_metrics', array(ref('MetricValue')), '수치·가중 유통 지표와 정의'),
  O('promotion_flag', nullable(boolean), '측정 범위에서 프로모션 적용 여부'), O('projection_version', str, '공급자 추정 버전'),
], ['시장 분모와 분자가 같은 국가·기간·채널·커버리지','추정값은 직접 주문 매출로 대체하지 않음']);
add('T04', 2, '구매·사용 패널', '패널 집단×대상×기간의 집계', ['M28'], [
  R('panel_id', str, '조사 패널 정의'), R('cohort_id', str, '표본 집단 정의'), R('subject_ref', str, '브랜드/제품', 'Brand/Product'),
  R('period', ref('Period'), '측정 기간'), R('sample_size', count, '관측 표본 수'), R('weighting_method', str, '가중·투영 기준'),
  R('measures', array(ref('MetricValue')), '침투·구매·재구매 등 정의된 집계'), O('purchase_channel', str, '판매처 범위'),
  O('usage_context', str, '사용 조사 맥락'), O('linked_survey_ref', str, '조사 연결', 'T32'),
], ['패널 고객을 자사 전체 고객으로 간주하지 않음','개인 기록/집계 스키마를 섞지 않음']);
add('T05', 3, '검색 관심 시계열', '검색 요청×검색어/주제×기간', ['M10','M41'], [
  R('query_id', str, '정규화 요청/비교 집합 식별자'), R('term_ref', str, '검색어 또는 주제 정의', 'SearchTerm'), R('term_kind', enumeration('keyword','topic','shopping_category'), '분석 대상 종류'),
  R('period', ref('Period'), '원천의 기간 해상도'), R('index_value', nullable({type:'number',minimum:0,maximum:100}), '상대 관심/클릭 지수'),
  R('index_definition', str, '검색 관심인지 쇼핑 클릭인지'), R('normalization_scope', str, '요청별 최대/비교 기준'),
  R('search_surface', str, '검색/쇼핑 등 표면'), O('filters', array(ref('Dimension')), '지역·기기·카테고리 등 요청조건'),
], ['서로 다른 정규화 요청을 절대 건수처럼 합산하지 않음','네이버 쇼핑 클릭 지수와 Google 검색 관심 지수를 같은 지표로 합치지 않음']);
add('T06', 3, '키워드 수요·비용 범위', '키워드×타깃 지역/언어×월', ['M02'], [
  R('keyword', str, '원천 키워드'), R('language', str, '검색 언어'), R('geo_target_ref', str, '타깃 지역 정의'), R('period', ref('Period'), '원천 월 범위'),
  R('estimated_searches', nullable(nonnegative), '근사 검색량'), R('competition_level', nullable(str), '공급자 경쟁 분류'), O('competition_index', nullable({type:'number',minimum:0,maximum:100}), '광고 슬롯 경쟁 지수'),
  O('low_bid', ref('Money'), '원천 입찰 범위 하단'), O('high_bid', ref('Money'), '원천 입찰 범위 상단'), R('network_scope', str, '검색 네트워크 조건'),
], ['검색량 근사·입찰 범위를 실제 클릭·낙찰 단가로 쓰지 않음']);
add('T07', 3, '자사 자연 검색 유입', '사이트×검색 차원×일/집계기간', ['M09'], [
  R('site_ref', str, '권한 있는 사이트', 'Site'), R('period', ref('Period'), '원천 보고 시간대와 기간'), R('query', nullable(str), '검색어; 숨겨지면 null'),
  R('page_ref', str, '페이지', 'LandingPage'), R('device', str, '원천 기기 분류'), R('search_type', str, '검색 유형'),
  R('clicks', nullable(count), '보고 클릭'), R('impressions', nullable(count), '보고 노출'), O('average_position', nullable(nonnegative), '평균 순위'),
  R('aggregation_scope', str, '속성/페이지 등 집계 기준'),
], ['CTR은 클릭/노출에서 계산','조회 제한·검색어 누락을 0으로 대체하지 않음']);
add('T08', 4, '판매 제안·가격 스냅샷', 'offer×판매처×관측 시점', ['M15','M16','M40'], [
  R('offer_id', str, '판매 제안 ID'), R('variant_ref', str, '판매 변형', 'Variant'), R('seller_ref', str, '판매처', 'Seller'), R('observed_at', time, '가격 관측 시각'),
  R('listed_price', nullable(ref('Money')), '표시 가격 또는 미제공'), O('regular_price', ref('Money'), '원천에서 확인한 기준 가격'), O('sale_price', ref('Money'), '실제 표시된 할인가'),
  R('availability', enumeration('in_stock','out_of_stock','preorder','unknown'), '원천 판매 상태'), R('tax_included', nullable(boolean), '세금 포함 여부; 미확인 null'), R('shipping_included', nullable(boolean), '배송비 포함 여부'),
  C('pack_quantity', ref('Quantity'), '용량별 가격 비교에 필수'), O('listing_ref', str, '원천 상품 페이지/가상 문서 참조'),
], ['API의 0 sentinel을 무료 상품으로 보지 않음','현재 가격을 과거 가격으로 복제하지 않음']);
add('T09', 4, '할인·프로모션', '한 행사·대상·유효기간', ['M12','M27'], [
  R('promotion_id', str, '행사 ID'), R('product_refs', ids, '행사 대상', 'Product/Variant'), R('seller_ref', str, '적용 판매처', 'Seller'),
  R('period', ref('Period'), '행사 유효기간'), R('promotion_type', enumeration('percent_discount','amount_discount','bundle','coupon','shipping','other'), '할인 종류'), R('eligibility_text', str, '적용 조건'),
  C('discount_ratio', ratio, '비율 할인에 필수'), C('discount_amount', ref('Money'), '금액 할인에 필수'), O('coupon_ref', str, '쿠폰 식별자'),
  O('change_event_refs', ids, '변경/종료 근거', 'T35'),
], ['행사 범위 안의 주문 할인과 대사','경쟁 행사 집행비는 공개되지 않으면 생성하지 않음'], [
  ['promotion_type','percent_discount',['discount_ratio']], ['promotion_type','amount_discount',['discount_amount']]
]);
add('T10', 5, '공개 경쟁 광고 관측', '공개 광고×관측', ['M34'], [
  R('advertiser_ref', str, '공개 광고주', 'Brand/Advertiser'), R('public_ad_id', str, '공개 관측 광고 ID'), R('observed_at', time, '조사 시각'),
  R('format', str, '광고 형식'), R('creative_text', str, '공개된 문구'), C('media_ref', str, '이미지/영상 광고의 근거 파일'),
  R('served_regions', ids, '공개된 지역 범위'), O('first_seen', date, '공개/관측에서 확인한 최초 시점'), O('last_seen', date, '공개/관측 마지막 시점'),
  O('destination_ref', str, '공개 목적지'), R('coverage_text', str, '공개 광고 조사 범위'),
], ['경쟁사의 비공개 지출·전환·매출 필드 없음','소재 수를 노출량으로 대체하지 않음']);
add('T11', 5, '기사·공식 발표·사건', '원문 문서와 명시된 사건', ['M31'], [
  R('document_id', str, '문서 ID'), R('publisher', str, '발행 주체'), R('published_at', time, '게시 시각'), R('language', str, '원문 언어'),
  R('title', str, '문서 제목'), R('body_text', str, '허용된 원문/가상 원문'), R('subject_refs', ids, '언급된 대상', 'Brand/Product'),
  O('event_time', time, '본문이 명시한 발생 시각; 게시일과 구별'), O('duplicate_cluster', str, '전재/중복 문서군'), O('claims', array(ref('EvidenceSpan')), '본문 주장과 위치'),
], ['가상 원문을 실재 기관 발행 URL로 위장하지 않음','기사의 주장을 제품 성능 사실로 자동 확정하지 않음']);
add('T12', 6, '광고 운영 설정 버전', '플랫폼 리소스의 설정·유효기간', ['M01','M04','M06'], [
  R('platform', str, '원천 광고 플랫폼'), R('account_id', str, '계정 식별자'), R('campaign_id', str, '캠페인 식별자', 'Campaign'), O('adgroup_id', str, '그룹 계층'), O('ad_id', str, '광고 계층'),
  R('objective', str, '캠페인 목표'), R('status', str, '운영 상태'), R('period', ref('Period'), '설정 유효기간'), R('product_refs', ids, '홍보 대상', 'Product'),
  R('channel', str, '검색/소셜/영상 등 채널 정의'), R('budget_amount', ref('Money'), '설정 예산'), R('budget_period', enumeration('daily','lifetime','custom'), '예산 단위'),
  R('bidding_strategy', str, '원천 입찰 방식'), R('target_definition', str, '지역/오디언스 등 설정'), C('creative_refs', ids, '소재 분석 대상이면 필요', 'T16'), C('landing_ref', str, '웹 전환 분석이면 필요', 'LandingPage'),
], ['플랫폼별 계층·예산 의미 보존','예산 설정과 실제 지출을 구별']);
add('T13', 6, '광고 성과', '리소스×기간×귀속 기준', ['M01','M04','M06'], [
  R('platform', str, '원천 플랫폼'), R('account_id', str, '보고 계정'), R('campaign_ref', str, '설정과 연결', 'T12/Campaign'),
  R('entity_level', enumeration('campaign','adgroup','ad'), '보고 레벨'), R('entity_id', str, '실제 보고 리소스'), R('period', ref('Period'), '계정 시간대 보고기간'),
  R('metrics', ref('AdMetrics'), '원천 지출/노출/클릭 및 조건부 전환'), R('report_state', enumeration('provisional','final','revised'), '지연·정정 상태'),
  C('conversion_definition_ref', str, '전환이 존재하면 필수', 'ConversionDefinition'), C('attribution_model', str, '귀속 성과에 필수'), C('attribution_window', str, '클릭/조회 귀속 기간'),
  O('reported_at', time, '보고 갱신 시각'),
], ['CPM/CPC/CTR/CPA/ROAS는 원천에서 계산','조회 전환/분수 전환 때문에 전환<=클릭을 무조건 강제하지 않음','여러 플랫폼 귀속 매출 합계를 실제 주문 총액으로 보지 않음']);
add('T14', 6, '광고 성과 세그먼트', '원천이 허용하는 차원 조합×기간', ['M04','M06'], [
  R('campaign_ref', str, '캠페인', 'Campaign'), R('period', ref('Period'), '보고 기간'), R('breakdown_dimensions', array(ref('Dimension')), '기기·배치 등 지원 차원'),
  R('report_definition_ref', str, '허용된 원천 조합 정의'), R('metrics', ref('AdMetrics'), '동일 귀속 기준의 부분 집계'),
  R('audience_basis', enumeration('target_setting','observed_aggregate','unknown'), '설정/실제 관측 구별'), O('parent_report_ref', str, '대사 가능한 상위 집계', 'T13'), O('suppression_rule', str, '억제·반올림 기준'),
], ['서로 겹치는 breakdown을 합산하지 않음','상위와 대사 가능한 차원만 합계 검사']);
add('T15', 6, '경매 경쟁 보고', '보고 캠페인×경쟁 광고주×기간', ['M03'], [
  R('campaign_ref', str, '보고 대상 캠페인', 'Campaign'), R('competitor_domain', str, '원천 광고주 표시'), R('period', ref('Period'), '공유 경매 범위'),
  R('report_surface', str, '검색/쇼핑 등 지원 표면'), R('impression_share', nullable(ratio), '원천 정의 노출 점유'), O('overlap_rate', nullable(ratio), '원천 중복 비율'),
  O('outranking_share', nullable(ratio), '원천 우위 비율'), O('position_above_rate', nullable(ratio), '지원 시 상위 게재 비율'), O('device', str, '보고 세그먼트'), R('threshold_status', str, '활동 임계·누락 상태'),
], ['전체 시장 점유율이 아닌 공유 경매 비교','플랫폼/캠페인에서 지원하지 않는 지표는 만들지 않음']);
add('T16', 7, '소재·메시지 버전', '하나의 소재 버전', ['M01','M21','M34'], [
  R('creative_id', str, '소재 식별자'), R('version', str, '내용 버전'), R('product_refs', ids, '제품 연결', 'Product'), R('format', str, '텍스트/이미지/영상'),
  R('language', str, '문구 언어'), R('message_text', str, '실제형 소재 문구'), R('valid_from', time, '사용 시작'), O('valid_to_exclusive', time, '사용 종료'),
  C('media_ref', str, '비텍스트 소재의 파일 근거'), O('duration_seconds', nonnegative, '영상 길이'), O('cta', str, '행동 문구'), O('message_tags', ids, '추출/수작업 주제'), C('annotation_evidence', ref('EvidenceSpan'), '메시지 태그를 판단한 근거'),
], ['소재 교체와 성과 동시 변화만으로 효과 확정하지 않음']);
add('T17', 8, '웹·앱 일반 이벤트', '한 비커머스 이벤트', ['M07'], [
  R('event_id', str, '중복 제거 키'), R('event_time', time, '발생 시각'), R('event_name', str, '이벤트명'), R('site_ref', str, '사이트/앱'),
  R('session_ref', nullable(str), '수집 가능한 세션 키', 'Session'), O('user_pseudo_ref', nullable(str), '수집 가능한 가명 키'), R('page_ref', nullable(str), '페이지; 미제공 null'),
  R('device', str, '관측 기기'), O('traffic_source', str, '관측 유입 출처'), O('traffic_medium', str, '관측 유입 매체'), O('utm_campaign', str, '전달된 캠페인 파라미터'), O('click_id', str, '권한·계측이 있는 클릭 ID'),
  R('consent_state', str, '동의/저장 상태'), O('event_parameters', array(ref('Dimension')), '추가 속성'),
], ['T18 커머스 이벤트와 같은 event_id를 두 번 집계하지 않음','동의 없는 전역 사람 ID를 만들어내지 않음']);
add('T18', 8, '커머스 퍼널 이벤트', '한 이벤트의 상품 행', ['M08'], [
  R('event_id', str, '이벤트 식별자'), R('item_index', count, '상품 배열 내 행 식별'), R('event_time', time, '발생 시각'), R('event_name', enumeration('view_item','add_to_cart','begin_checkout','purchase','refund'), '재현할 계측 이벤트'),
  R('variant_ref', str, '원천 상품 매핑', 'Variant'), R('quantity', nonnegative, '상품 수량'), C('unit_price', ref('Money'), '원천에 가격이 있는 경우'), R('session_ref', nullable(str), '세션 연결'),
  C('transaction_ref', str, 'purchase/refund에 필수', 'Order'), O('campaign_ref', str, '귀속 가능할 때만 캠페인 연결', 'Campaign'), R('measurement_basis', str, '이벤트 구현·중복 처리 기준'),
], ['구매/환불은 거래와 연결','방문→장바구니→결제→구매를 모든 고객이 완벽하게 밟는 것으로 만들지 않음'], [
  ['event_name','purchase',['transaction_ref']], ['event_name','refund',['transaction_ref']]
]);
add('T19', 9, '주문 상품 행', '한 주문의 한 상품 행', ['M12','M37'], [
  R('order_id', str, '주문 식별자', 'Order'), R('line_id', str, '주문 내 상품 행 식별자'), R('variant_ref', str, '판매 제품 변형', 'Variant'),
  R('seller_ref', str, '자사 판매처', 'Seller'), R('ordered_at', time, '주문 시각'), R('customer_pseudo_ref', str, '자사 범위 가명 고객', 'Customer'),
  R('quantity', nonnegative, '판매 수량'), R('unit_price', ref('Money'), '판매 단가'), R('line_discount', ref('Money'), '상품 행 할인'), R('line_tax', ref('Money'), '상품 행 세금'),
  R('line_gross_total', ref('Money'), '정의된 세금 포함/제외 행 합계'), R('financial_status', str, '결제 상태'), R('fulfilment_status', str, '이행 상태'), O('transaction_ref', str, '웹 대사 키'), O('acquisition_ref', str, '확인 가능한 유입 연결'),
], ['order_id와 line_id 조합 유일','주문 합계를 상품 행마다 반복 합산하지 않음','경쟁사 개별 주문은 자사 권한 자료로 꾸미지 않음']);
add('T20', 9, '취소·반품·환불', '한 원주문 행의 처리 사건', ['M12','M19'], [
  R('adjustment_id', str, '처리 사건 ID'), R('adjustment_kind', enumeration('cancel','return','refund'), '처리 종류'), R('order_ref', str, '원주문', 'Order'),
  R('order_line_ref', str, '원상품 행', 'T19'), R('requested_at', time, '요청 시각'), O('processed_at', time, '완료 시각'), R('quantity', nonnegative, '대상 수량'),
  C('refund_amount', ref('Money'), '금전 환불이면 필수'), R('reason_code', str, '확인된 사유 또는 unknown'), O('reason_text', str, '원천 설명'), R('status', str, '처리 상태'), O('restocked', nullable(boolean), '재입고 확인 여부'),
], ['환불 수량·누계는 원주문과 대사','취소/반품/환불 하나를 여러 차례 순매출에서 차감하지 않음'], [
  ['adjustment_kind','refund',['refund_amount']]
]);
add('T21', 9, '원가·마진 조건', 'SKU×기간의 비용 정의', ['M14'], [
  R('variant_ref', str, '품목 변형', 'Variant'), R('period', ref('Period'), '원가 적용기간'), R('unit_cost', nullable(ref('Money')), '알려진 단위원가'),
  R('margin_definition', str, '매출총이익/기여이익 기준'), O('fulfilment_unit_cost', ref('Money'), '출고당 비용'), O('payment_fee_ratio', ratio, '결제 수수료 비율'),
  O('channel_fee_ratio', ratio, '판매처 수수료 비율'), O('promotion_cost', ref('Money'), '기간 프로모션 비용'), R('accounting_basis', str, '회계·원가 정의'),
], ['원가 미확인일 때 이익 최적화 보류','비용 원천의 통화·기간·정의를 보존']);
add('T22', 10, '재고·판매 가능성', '품목×위치×관측', ['M13','M11'], [
  R('variant_ref', str, '품목', 'Variant'), R('location_ref', str, '창고/판매 위치', 'Location'), R('observed_at', time, '스냅샷 시각'),
  R('available_quantity', nullable(nonnegative), '판매 가능 재고'), O('on_hand_quantity', nullable(nonnegative), '보유 재고'), O('committed_quantity', nullable(nonnegative), '확정 출고 재고'),
  R('sellable_status', enumeration('sellable','out_of_stock','blocked','unknown'), '판매 가능 상태'), O('restock_expected_at', time, '예정 입고'), O('restock_is_confirmed', boolean, '예정 확정 수준'),
], ['현재 재고 조회로 과거 이력을 발명하지 않음','창고와 판매 지역이 맞는지 확인']);
add('T23', 10, '유통·배송', '유통 집계 또는 주문 이행', ['M27','M12'], [
  R('record_kind', enumeration('distribution','fulfilment'), '서로 다른 단위를 구분'), C('product_ref', str, '유통 자료 대상', 'Product'), C('period', ref('Period'), '유통 집계기간'),
  C('retail_channel', str, '유통 채널'), O('distribution_measures', array(ref('MetricValue')), '정의된 유통 지표'), C('order_ref', str, '배송 대상 주문', 'Order'),
  C('promised_at', time, '배송 약속 시각'), O('shipped_at', time, '출고 시각'), O('delivered_at', time, '도착 확인 시각'), C('status', str, '배송 상태'), O('location_ref', str, '유통/배송 위치'),
], ['유통 집계와 주문 배송을 같은 grain으로 합치지 않음'], [
  ['record_kind','distribution',['product_ref','period','retail_channel','distribution_measures']], ['record_kind','fulfilment',['order_ref','promised_at','status']]
]);
add('T24', 11, '개별 리뷰', '한 제품/사업체/장소 리뷰', ['M17','M18','M20'], [
  R('review_id', str, '리뷰 ID'), R('review_subject_type', enumeration('product','business','location'), '후기 대상 종류'), R('subject_ref', str, '실제 대상', 'Product/Business/Location'),
  R('written_at', time, '작성 시각'), O('updated_at', time, '수정 시각'), R('language', str, '원문 언어'), R('body_text', str, '분석 근거 원문'), O('title', str, '제목'),
  R('rating_value', nullable(nonnegative), '별점 또는 미제공'), R('rating_scale_max', {type:'number',exclusiveMinimum:0}, '별점 척도'), R('verified_purchase', nullable(boolean), '제공되지 않으면 null'), O('invited_review', nullable(boolean), '초대 여부'),
], ['별점은 척도 이내','사업체/장소 리뷰를 제품 만족도로 합치지 않음','가상 원문 표시와 파일 근거 유지']);
add('T25', 11, '리뷰 측면·감성·집계', '발췌 주석 또는 주제 집계', ['M19','M15'], [
  R('record_kind', enumeration('annotation','aggregate'), '원문 추출/공급자 집계 구분'), R('subject_ref', str, '제품/사업체 대상'), R('aspect_ref', str, '평가 측면 정의', 'Aspect'),
  R('sentiment', enumeration('positive','neutral','negative','mixed','unknown'), '측면별 분류'), R('definition_version', str, '분류/집계 기준'), C('review_ref', str, '개별 주석이면 원리뷰', 'T24'),
  C('evidence_span', ref('EvidenceSpan'), '주석이면 원문 위치'), C('period', ref('Period'), '집계기간'), C('mention_count', count, '원천 언급 수'), C('sample_size', count, '비교 표본'),
  O('extractor_version', str, 'LLM/수작업 버전'), R('assessment_status', enumeration('provided','reviewed','unreviewed','uncertain'), '검토 수준'),
], ['발췌는 실제 원문 범위에 존재','한 리뷰는 여러 측면을 가질 수 있어 측면합=리뷰수 강제 금지','공급자 주제 집계에서 개별 리뷰를 역생성하지 않음'], [
  ['record_kind','annotation',['review_ref','evidence_span','extractor_version']], ['record_kind','aggregate',['period','mention_count','sample_size']]
]);
add('T26', 11, '고객 문의·CS', '한 문의 ticket', ['M25'], [
  R('ticket_id', str, '문의 식별자'), R('created_at', time, '문의 생성'), O('resolved_at', time, '처리 완료'), R('channel', str, '문의 경로'),
  R('subject', str, '문의 제목'), R('message_text', str, '근거 대화/문의'), R('status', str, '처리 상태'), O('priority', str, '업무 우선순위'),
  O('product_ref', str, '확인 가능한 제품 연결', 'Product'), O('order_ref', str, '확인 가능한 주문 연결', 'Order'), R('link_status', enumeration('confirmed','candidate','unlinked'), '대상 연결 수준'),
  O('tags', ids, '원천/주석 분류'), O('resolution_type', str, '해결 유형'), O('satisfaction', ref('MetricValue'), '확인된 만족도'),
], ['연결이 없으면 제품/고객을 임의 추정하지 않음']);
add('T27', 12, '공개 콘텐츠·반응', '콘텐츠×통계 관측 시점', ['M21'], [
  R('content_id', str, '공개 콘텐츠 식별자'), R('platform', str, '플랫폼'), R('channel_ref', str, '게시 채널'), R('published_at', time, '게시일'),
  R('observed_at', time, '통계 수집일'), R('title', str, '제목'), R('description_text', str, '설명'), R('language', str, '언어'),
  R('view_count', nullable(count), '누적 조회'), O('like_count', nullable(count), '누적 좋아요'), O('comment_count', nullable(count), '누적 댓글'), O('product_refs', ids, '확인한 제품 언급'),
], ['누적 통계 차이에는 삭제·정정·간격 고려','타 플랫폼 전체 반응으로 외삽하지 않음']);
add('T28', 12, '댓글·언급', '한 공개 댓글', ['M22','M31'], [
  R('comment_id', str, '댓글 ID'), R('content_ref', str, '게시 콘텐츠', 'T27'), O('parent_comment_ref', str, '답글 부모', 'T28'),
  R('written_at', time, '작성일'), R('body_text', str, '원문'), R('language', str, '언어'), O('like_count', count, '공개 반응'),
  O('mentioned_entity_refs', ids, '확인된 대상'), O('annotation_spans', array(ref('EvidenceSpan')), '주제/대상 해석 근거'),
], ['상품 후기와 공개 댓글은 다른 표본','reply 조회 누락을 무반응으로 해석하지 않음']);
add('T29', 12, '크리에이터 협업', '한 협업·콘텐츠 계약 범위', ['M21'], [
  R('collaboration_id', str, '협업 식별자'), R('creator_ref', str, '크리에이터'), R('product_refs', ids, '홍보 제품'), R('planned_period', ref('Period'), '약속 게시기간'),
  R('message_brief', str, '계약 메시지'), O('content_refs', ids, '실제 게시물', 'T27'), R('agreement_status', str, '합의/게시 상태'),
  C('fee', ref('Money'), '자사 계약으로 확인한 비용만'), O('tracking_ref', str, '유효한 추적 링크'), O('rights_text', str, '사용 권리 범위'),
], ['경쟁 공개 콘텐츠에서 비공개 계약금·매출을 만들지 않음']);
add('T30', 13, 'CRM 코호트·영업 기회', '고객 코호트 집계 또는 B2B 기회', ['M12','M24'], [
  R('record_kind', enumeration('cohort','deal'), '소비재 코호트/B2B 기회 구분'), C('cohort_ref', str, '집단 정의'), C('period', ref('Period'), '측정 기간'), C('sample_size', count, '집단 인원'),
  O('acquisition_channel', str, '확인한 획득 출처'), O('net_revenue', ref('Money'), '기간 순매출'), O('repeat_purchase_rate', ratio, '동일 집단 반복구매 비율'),
  C('deal_id', str, 'B2B 기회 ID'), C('stage', str, '영업 단계'), C('deal_amount', ref('Money'), '기회 금액'), O('closed_at', time, '확인한 종료'),
], ['미래 LTV는 실측 코호트 금액과 분리','샴푸 B2C 첫 배치에 B2B 기회를 임의 추가하지 않음'], [
  ['record_kind','cohort',['cohort_ref','period','sample_size']], ['record_kind','deal',['deal_id','stage','deal_amount']]
]);
add('T31', 13, '이메일·CRM 캠페인', '캠페인×보고기간', ['M23'], [
  R('crm_campaign_id', str, '발송 캠페인'), R('segment_ref', str, '대상 집단'), R('sent_at', time, '발송 시각'), R('period', ref('Period'), '반응 관측기간'),
  R('emails_sent', count, '발송 건수'), R('bounces', count, '반송'), O('unique_opens', nullable(count), '관측 고유 오픈'), R('unique_clickers', count, '고유 클릭 수신자'),
  R('unsubscribes', count, '해지 수신자'), O('linked_orders', ids, '확인된 주문'), O('message_ref', str, '발송 문구'), R('open_measurement_basis', str, '프록시/계측 기준'),
], ['오픈을 직접 관심/구매로 대체하지 않음','발송·반송·고유 반응의 범위를 대사']);
add('T32', 14, '설문·브랜드 리프트', '조사×질문×집단의 집계', ['M26','M28'], [
  R('study_id', str, '조사 식별자'), R('subject_ref', str, '브랜드/제품'), R('period', ref('Period'), '조사기간'), R('question_text', str, '질문 원문'),
  R('measure_definition', str, '인지·회상·고려 등 정의'), R('cohort_ref', str, '조사 집단'), R('sample_size', count, '응답 표본'), R('response_scale', str, '응답 척도'),
  R('measures', array(ref('MetricValue')), '응답/집계 지표'), R('sampling_method', str, '모집·가중 기준'), O('experiment_ref', str, '리프트 비교 실험', 'T38'), O('uncertainty_text', str, '자료가 제공한 불확실성'),
], ['광고 노출/검색 지수를 조사 인지도라고 부르지 않음']);
add('T33', 15, '공표 시장·인구·소비 통계', '통계표 항목×지역×기간', ['M29','M43','M44'], [
  R('statistics_table_id', str, '통계표 식별'), R('item_code', str, '원천 항목 분류'), R('region_ref', str, '공표 지역'), R('period', ref('Period'), '공표기간'),
  R('value', nullable(num), '통계 값'), R('unit', str, '원천 단위'), R('definition', str, '통계 항목 의미'), R('published_at', date, '발표일'), O('revised_at', date, '개정일'),
  O('base_year', {type:'integer'}, '기준년'), R('seasonal_adjustment', str, '조정 여부'), O('sampling_text', str, '표본·추정 방식'),
], ['국가 총계는 특정 브랜드 판매량이 아님']);
add('T34', 15, '기상·휴일·시즌', '기상 관측 또는 일정', ['M30'], [
  R('record_kind', enumeration('weather','calendar'), '기상/일정 구분'), R('region_ref', str, '관측/적용 지역'), R('period', ref('Period'), '시간 범위'),
  C('station_ref', str, '기상 관측소'), C('measures', array(ref('MetricValue')), '기온·강수 등 측정'), C('event_name', str, '휴일/시즌 이름'), C('calendar_kind', str, '일정 종류'),
  O('observation_quality', str, '원천 기상 품질'),
], ['날씨와 판매의 인과는 별도 가설'], [
  ['record_kind','weather',['station_ref','measures']], ['record_kind','calendar',['event_name','calendar_kind']]
]);
add('T35', 16, '운영 변경 이력', '한 리소스 변경 사건', ['M33'], [
  R('change_id', str, '변경 식별'), R('entity_ref', str, '변경 리소스'), R('changed_at', time, '변경 시각'), R('operation', enumeration('create','update','remove'), '변경 유형'),
  R('changed_field', str, '변경 필드 경로'), R('before_value', {type:['string','number','boolean','object','array','null']}, '이전 값; 신규면 null'), R('after_value', {type:['string','number','boolean','object','array','null']}, '이후 값; 삭제면 null'),
  R('client_type', str, 'API/화면/운영 시스템'), O('actor_role', str, '확인한 수행 역할'), O('approval_ref', str, '승인 기록'), O('reason_text', str, '확인된 변경 사유'),
], ['조회한 변경 범위와 누락 한계 보존','권한 주체 이름을 임의 실명으로 만들지 않음']);
add('T36', 16, '수집·계측 상태', '한 수집 실행/자료 범위', ['M07'], [
  R('run_id', str, '수집 실행 식별'), R('target_dataset', str, '수집 대상'), R('expected_period', ref('Period'), '기대 범위'), O('actual_period', ref('Period'), '수집된 범위'),
  R('started_at', time, '시작'), O('completed_at', time, '완료'), R('status', enumeration('success','partial','failed','running'), '수집 상태'),
  R('expected_count', nullable(count), '알려진 기대 개수'), R('received_count', count, '실제 수신'), R('duplicate_count', count, '중복'), R('missing_count', nullable(count), '확인 가능한 결측'),
  R('schema_version', str, '원천/변환 버전'), O('error_code', str, '확인된 오류'), O('consent_change_ref', str, '동의/태그 변경'),
], ['실패를 성과 0으로 대체하지 않음','로그 기대값을 실제로 확인한 범위에서만 채움']);
add('T37', 16, '사이트 성능·장애', 'rolling 측정 또는 장애 사건', ['M32'], [
  R('record_kind', enumeration('performance','incident'), '집계/사건 구분'), R('page_ref', str, 'URL/origin'), R('device', str, '기기'),
  C('period', ref('Period'), '성능 집계기간'), C('measures', array(ref('MetricValue')), '성능 분포/백분위'), C('incident_start', time, '장애 시작'), O('incident_end', time, '복구 시각'),
  C('status', str, '장애 상태'), O('release_ref', str, '확인된 배포 변경'), O('error_text', str, '확인된 오류'),
], ['28일 rolling 측정을 당일 장애 로그로 바꾸지 않음'], [
  ['record_kind','performance',['period','measures']], ['record_kind','incident',['incident_start','status']]
]);
add('T38', 17, '실험 설계·집계 결과', '실험의 한 arm/결과 버전', ['M35','M26'], [
  R('experiment_id', str, '실험 식별'), R('arm_id', str, '대조/처리 집단'), R('hypothesis_text', str, '검증할 주장'), R('period', ref('Period'), '실험기간'),
  R('assignment_method', str, '분할/무작위 방법'), R('assignment_unit', str, '고객/지역/캠페인 등 단위'), R('treatment_description', str, '집단 조건'), R('sample_size', count, '표본'),
  R('status', str, '계획/진행/종료'), O('outcome_measures', array(ref('MetricValue')), '실제형 측정 결과'), O('uncertainty_text', str, '추정 범위·방법'), O('contamination_text', str, '오염·중단 상태'),
], ['광고 A/B와 무광고 증분 실험의 질문 차이 명시','실험 효과는 단순 전후 차이와 구별']);
add('T39', 17, '반응 모형·예산 후보', '모형 정의 또는 후보 배분', ['M38','M39'], [
  R('record_kind', enumeration('response_model','budget_scenario'), '모형/후보 구분'), R('model_ref', str, '사용 모형 식별'), R('model_version', str, '모형 버전'),
  R('objective', str, '최적화/비교 목표'), R('assumptions', ids, '계산 가정'), R('validity_scope', str, '모형 적용 대상·범위'), C('training_period', ref('Period'), '추정 모형의 자료 범위'),
  C('formula', str, '가정 모의 함수 또는 검증 모형 설명'), C('parameters', array(ref('Dimension')), '파라미터 명세'), C('scenario_id_ref', str, '예산안 식별'),
  C('period', ref('Period'), '집행 제안기간'), C('total_budget', ref('Money'), '고정/상한 총액'), C('allocations', array(ref('Allocation')), '캠페인별 현행/후보 배분'),
  C('expected_measures', array(ref('MetricValue')), '모의 성과'), O('validation_evidence_refs', ids, '실험/검증 근거'),
], ['모의 함수는 실제 학습 모델과 구별','배분 합계·하한·상한·통화·목표 대사'], [
  ['record_kind','response_model',['formula','parameters']], ['record_kind','budget_scenario',['scenario_id_ref','period','total_budget','allocations','expected_measures']]
]);
add('T40', 18, '업무 목표·집행 정책', '한 브리프/정책 유효 버전', ['S01','S02','U01'], [
  R('policy_id', str, '업무/정책 식별'), R('version', str, '유효 버전'), R('period', ref('Period'), '적용기간'), R('objective', str, '사업/캠페인 목표'),
  R('kpi_definition_refs', ids, '판단 KPI', 'MetricDefinition'), R('product_refs', ids, '대상 제품'), R('budget_limit', ref('Money'), '허용 총액'),
  R('allowed_channels', ids, '사용 채널'), R('approval_role', str, '승인 역할'), R('change_constraints', ids, '변경 제한'), O('brand_guidelines', ids, '허용/금지 표현'), R('policy_status', enumeration('proposed','approved','superseded'), '실제/가상 승인 의미'),
], ['가상 회사 정책은 실제 사용자 데이터 생성 승인과 별도','자동 승인 역할을 사용자 동의로 대체하지 않음']);

assert.equal(records.length, 40);
assert.equal(new Set(records.map(r=>r.group)).size, 18);
for (const r of records) {
  const policy = policies.find(p=>p[0]===r.id);
  assert.ok(policy,`missing temporal policy ${r.id}`);
  const properties = {...common, dataset_type: {...common.dataset_type, const:r.id}, ...Object.fromEntries(r.fields)};
  defs[r.id] = {
    type: 'object', title:r.title, description:r.grain,
    'x-group':r.group, 'x-source-refs':r.sources, 'x-semantic-rules':r.rules,
    'x-temporal-policy':{historical_cadence:policy[1],detail_cadence:policy[2],time_kind:policy[3],record_budget:policy[4],constraint:policy[5]},
    properties, required:Object.entries(properties).filter(([,p])=>p['x-priority']==='필수').map(([name])=>name),
    additionalProperties:false,
    ...(r.branches.length ? {allOf:r.branches.map(([key,value,required])=>({if:{properties:{[key]:{const:value}},required:[key]},then:{required}}))}:{}),
  };
}
const schema = {
  $schema:'https://json-schema.org/draft/2020-12/schema',
  title:'마케팅 통합 원천 레코드 스키마 — 설계 초안',
  description:'승인 전 데이터 생성 금지. 통합 규격이며 공급자 API 원문 스키마와 다름. format 및 의미/관계 검사를 별도 시행해야 함.',
  oneOf:records.map(r=>ref(r.id)), $defs:defs,
};

// Historical aggregate reports are not fabricated event/order records.
// Validate this definition separately using #/$defs/HistoricalReport.
defs.HistoricalReport = object({...common,dataset_type:{const:'H01',type:'string'},report_kind:enumeration('web_funnel','sales'),subject_ref:str,period:ref('Period'),measures:array(ref('MetricValue')),metric_definition_refs:ids,reconciliation:enumeration('no_detail','partial_detail','fully_reconciled'),detail_record_refs:ids},[...Object.entries(common).filter(([,p])=>p['x-priority']==='필수').map(([k])=>k),'report_kind','subject_ref','period','measures','metric_definition_refs','reconciliation']);

// A reported conversion/value needs its attribution definition even when other metrics are null.
defs.T13.allOf = ['attributed_conversions','attributed_value'].map(key=>({
  if:{properties:{metrics:{properties:{[key]:{not:{type:'null'}}},required:[key]}},required:['metrics']},
  then:{required:['conversion_definition_ref','attribution_model','attribution_window']},
}));

let doc = '# 데이터 유형별 필드·스키마 사전\n\n2026-10-13. 상태: 설계 초안. 데이터 레코드·예시값을 생성하지 않았다. [공통 규격](schema-contract.md), [원천 근거](data-source-register.md), [JSON Schema](schemas/marketing-records.schema.json)를 함께 읽는다.\n\n';
doc += '필수는 현재 분석 계약의 핵심, 조건부는 목적·하위 유형·원천 가용성에 따라 필요, 선택은 있으면 해석에 도움을 주는 값이다. 형식 스키마의 required와 조건부 규칙으로 강제한 항목을 구분한다. 설명에만 적은 조건부·정합성 규칙은 후속 의미 검증기에서 구현해야 한다.\n\n';
function describe(s) {
  if(s.$ref)return s.$ref.split('/').at(-1);
  if(s.anyOf)return s.anyOf.map(describe).join(' 또는 ');
  if(s.enum)return `enum(${s.enum.join(', ')})`;
  if(s.type==='array')return `${describe(s.items)}[]`;
  if(s.format)return `${s.type}(${s.format})`;
  if(Array.isArray(s.type))return s.type.join('/');
  return s.type;
}
function table(fields) {
  return '| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |\n| --- | --- | --- | --- | --- |\n'+fields.map(([name,s])=>`| ${name} | ${describe(s)} | ${s['x-priority']||'구조'} | ${s.description||'공통 구조 정의 참조'} | ${s['x-reference-target']||'—'} |`).join('\n')+'\n\n';
}
doc += '## 모든 유형의 공통 필드\n\n'+table(Object.entries(common));
for(const [name, d] of Object.entries(defs).filter(([name])=>!/^T\d+$/.test(name))) {
  doc += `## 공통 구조 ${name}\n\n`;
  doc += '| 필드 | 자료형 | 필수 여부 |\n| --- | --- | --- |\n'+Object.entries(d.properties).map(([k,s])=>`| ${k} | ${describe(s)} | ${d.required.includes(k)?'필수':'선택'} |`).join('\n')+'\n\n';
}
for(const r of records) {
  const p=policies.find(p=>p[0]===r.id);
  doc += `## ${r.id} ${r.title}\n\n영역: ${r.group}. 한 레코드의 단위: ${r.grain}. 근거: ${r.sources.join(', ')}.\n\n시간 설계: 과거 ${p[1]} / 상세 ${p[2]}. ${p[5]}. [시간·집계·온톨로지 계약](temporal-design.md) 참조.\n\n`+table(r.fields);
  if(r.branches.length)doc += '스키마 조건: '+r.branches.map(([k,v,rs])=>`${k}=${v}이면 ${rs.join(', ')} 필수`).join('; ')+'.\n\n';
  if(r.id==='T13')doc += '스키마 조건: metrics의 귀속 전환 또는 귀속 금액이 null이 아니면 conversion_definition_ref, attribution_model, attribution_window 필수.\n\n';
  doc += '정합성·해석 규칙:\n\n'+r.rules.map(x=>`- ${x}`).join('\n')+'\n\n';
}

// Checks only definitions. No record fixtures or fake values are created for tests.
function inspect(node) {
  if(!node||typeof node!=='object')return;
  if(node.$ref)assert.ok(defs[node.$ref.split('/').at(-1)],`missing ref ${node.$ref}`);
  if(node.properties&&node.required)for(const k of node.required)assert.ok(node.properties[k],`unknown required ${k}`);
  if(node.enum)assert.equal(new Set(node.enum).size,node.enum.length);
  for(const v of Object.values(node))if(typeof v==='object')inspect(v);
}
inspect(schema);
for(const r of records)for(const [, , required] of r.branches)for(const k of required)assert.ok(defs[r.id].properties[k]);
assert.ok(!JSON.stringify(schema).includes('"examples"'));
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'marketing-records.schema.json'),JSON.stringify(schema,null,2)+'\n');
fs.writeFileSync(path.join(out,'..','field-dictionary.md'),doc,'utf8');
let temporalDoc='# 40유형별 시간 간격·범위·수량 설정\n\n2026-10-13. 생성 승인 전 설계 설정이다. 실제 자료·날짜 노드·레코드를 생성하지 않았다. [시간 계약](temporal-design.md), [생성 제안 상태](data-volume-proposal.md) 참조.\n\n';
temporalDoc+=`역사 범위: [${horizon.start}, ${horizon.end_exclusive}). 상세 범위: [${detailWindow.start}, ${detailWindow.end_exclusive}), 28일·완전한 월요일 시작4주. 상세 구간은 설계 제안이다. 각 유형의 기록이 이 기간을 전부 커버한다는 뜻은 아니다.\n\n`;
temporalDoc+='| 유형 | 이름 | 역사 자료 | 상세 자료 | 시간 의미 | 수량 예산 | 연결·집계 조건 |\n| --- | --- | --- | --- | --- | ---: | --- |\n';
temporalDoc+=policies.map(p=>`| ${p[0]} | ${records.find(r=>r.id===p[0]).title} | ${p[1]} | ${p[2]} | ${p[3]} | ${p[4]} | ${p[5]} |`).join('\n');
const total=policies.reduce((s,p)=>s+p[4],historicalReportBudget);
temporalDoc+=`\n\nH01 역사 보고서 ${historicalReportBudget}건: 웹/퍼널3국가×24개월=72, 자사2제품×3국가×24개월 판매 보고=144. T17–T19의 과거 개별 원문을 만들어 채우지 않는다. H01은 별도 HistoricalReport 스키마로 검증하며40유형 원천 스키마의 oneOf와 구별한다.\n\n총 ${total.toLocaleString('en-US')}건 + 지원 정의 최대300개. 파생 조회 뷰·달력 개체·그래프 관계 수는 이 레코드 예산에 포함하지 않는다. 여러 지표를 한 보고 행에 묶으므로 건수는 지표값 개수와 다르다. 수치·문장·사건·참조·월간/일간 대사 규칙의 완성 제안과 명시 승인은 아직 필요하다.\n`;
fs.writeFileSync(path.join(out,'..','temporal-catalog.md'),temporalDoc,'utf8');
console.log(JSON.stringify({types:records.length,groups:18,commonFields:Object.keys(common).length,domainFields:records.reduce((n,r)=>n+r.fields.length,0),conditionalBranches:records.reduce((n,r)=>n+r.branches.length,0)+defs.T13.allOf.length,generatedMarketingRecords:0}));
