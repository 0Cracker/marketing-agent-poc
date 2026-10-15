# 데이터 유형별 필드·스키마 사전

2026-10-13. 상태: 설계 초안. 데이터 레코드·예시값을 생성하지 않았다. [공통 규격](schema-contract.md), [원천 근거](data-source-register.md), [JSON Schema](schemas/marketing-records.schema.json)를 함께 읽는다.

필수는 현재 분석 계약의 핵심, 조건부는 목적·하위 유형·원천 가용성에 따라 필요, 선택은 있으면 해석에 도움을 주는 값이다. 형식 스키마의 required와 조건부 규칙으로 강제한 항목을 구분한다. 설명에만 적은 조건부·정합성 규칙은 후속 의미 검증기에서 구현해야 한다.

## 모든 유형의 공통 필드

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| record_id | string | 필수 | 레코드 전역 식별자. 소스·유형·범위를 포함해 중복 방지 | — |
| dataset_type | string | 필수 | T01–T40 유형 식별자 | — |
| scope_id | string | 필수 | 국가·카테고리·비교 집합을 정의하는 범위 참조 | Scope |
| scenario_id | string | 필수 | 서로 다른 가상 상황을 섞지 않는 격리 키 | Scenario |
| is_synthetic | boolean | 필수 | 가상 자료 여부. 모의 값과 실제 출처 문서를 구별 | — |
| value_origin | enum(direct_observation, platform_attributed, provider_estimate, derived_calculation, manual_annotation, llm_extraction, simulation) | 필수 | 값이 만들어진 방식. is_synthetic과 별개 | — |
| provenance | Provenance | 필수 | 실제형 원천 시스템·파일 위치·수집 방식·문서 근거 | — |
| quality | Quality | 필수 | 결측·억제·수집 범위·부분자료 표시 | — |
| temporal | TemporalContext | 필수 | 시간 의미·원천 간격·달력·표본 범위·자료 확보 시점 | — |
| related_record_ids | string[] | 선택 | 근거/변경/승인 자료 추가 참조 | — |

## 공통 구조 Money

| 필드 | 자료형 | 필수 여부 |
| --- | --- | --- |
| amount | string | 필수 |
| currency | string | 필수 |

## 공통 구조 Quantity

| 필드 | 자료형 | 필수 여부 |
| --- | --- | --- |
| amount | number | 필수 |
| unit | string | 필수 |

## 공통 구조 Period

| 필드 | 자료형 | 필수 여부 |
| --- | --- | --- |
| start | string(date) | 필수 |
| end_exclusive | string(date) | 필수 |
| timezone | string | 필수 |
| grain | enum(day, week, month, quarter, year, custom) | 필수 |

## 공통 구조 TemporalContext

| 필드 | 자료형 | 필수 여부 |
| --- | --- | --- |
| time_kind | enum(instant, interval, validity, rolling, model) | 필수 |
| source_grain | enum(instant, day, week, month, quarter, year, custom) | 필수 |
| series_role | enum(baseline, detail) | 필수 |
| calendar_id | string | 필수 |
| reporting_timezone | string | 필수 |
| coverage_kind | enum(aggregate_report, full_population, sample, partial, unknown) | 필수 |
| available_at | string(date-time) | 필수 |
| revision | integer | 필수 |
| timestamp_field | string | 선택 |
| period_field | string | 선택 |
| supersedes_record_id | string | 선택 |

## 공통 구조 EvidenceSpan

| 필드 | 자료형 | 필수 여부 |
| --- | --- | --- |
| record_ref | string | 필수 |
| field_path | string | 필수 |
| quote | string | 선택 |
| language | string | 필수 |
| start_offset | integer | 선택 |
| end_offset | integer | 선택 |

## 공통 구조 Provenance

| 필드 | 자료형 | 필수 여부 |
| --- | --- | --- |
| system | string | 필수 |
| collection_method | enum(api, export, manual, internal_log, synthetic_generation) | 필수 |
| source_record_key | string | 필수 |
| artifact_ref | string | 필수 |
| field_path | string | 선택 |
| collected_at | string(date-time) | 선택 |
| access_class | enum(public, owned, licensed, internal) | 필수 |
| documentation_refs | string[] | 필수 |

## 공통 구조 Quality

| 필드 | 자료형 | 필수 여부 |
| --- | --- | --- |
| availability | enum(available, missing, suppressed, not_applicable, not_collected) | 필수 |
| reason | string | 선택 |
| coverage | string | 필수 |
| is_partial | boolean | 필수 |
| revised_at | string(date-time) | 선택 |

## 공통 구조 Dimension

| 필드 | 자료형 | 필수 여부 |
| --- | --- | --- |
| name | string | 필수 |
| value | string | 필수 |

## 공통 구조 MetricValue

| 필드 | 자료형 | 필수 여부 |
| --- | --- | --- |
| metric_id | string | 필수 |
| value | number 또는 Money 또는 null | 필수 |
| unit | string | 필수 |
| availability | enum(available, missing, suppressed, not_applicable) | 필수 |
| definition_version | string | 필수 |

## 공통 구조 AdMetrics

| 필드 | 자료형 | 필수 여부 |
| --- | --- | --- |
| spend | Money 또는 null | 필수 |
| impressions | integer 또는 null | 필수 |
| clicks | integer 또는 null | 필수 |
| reach | integer 또는 null | 선택 |
| attributed_conversions | number 또는 null | 선택 |
| attributed_value | Money 또는 null | 선택 |
| frequency | number 또는 null | 선택 |

## 공통 구조 Allocation

| 필드 | 자료형 | 필수 여부 |
| --- | --- | --- |
| campaign_ref | string | 필수 |
| amount | Money | 필수 |
| lower | Money | 필수 |
| upper | Money | 필수 |

## 공통 구조 HistoricalReport

| 필드 | 자료형 | 필수 여부 |
| --- | --- | --- |
| record_id | string | 필수 |
| dataset_type | string | 필수 |
| scope_id | string | 필수 |
| scenario_id | string | 필수 |
| is_synthetic | boolean | 필수 |
| value_origin | enum(direct_observation, platform_attributed, provider_estimate, derived_calculation, manual_annotation, llm_extraction, simulation) | 필수 |
| provenance | Provenance | 필수 |
| quality | Quality | 필수 |
| temporal | TemporalContext | 필수 |
| related_record_ids | string[] | 선택 |
| report_kind | enum(web_funnel, sales) | 필수 |
| subject_ref | string | 필수 |
| period | Period | 필수 |
| measures | MetricValue[] | 필수 |
| metric_definition_refs | string[] | 필수 |
| reconciliation | enum(no_detail, partial_detail, fully_reconciled) | 필수 |
| detail_record_refs | string[] | 선택 |

## T01 제품·변형 마스터

영역: 1. 한 레코드의 단위: 제품의 한 변형·유효기간. 근거: M11, M15, M42.

시간 설계: 과거 유효기간/변경 시 / 상세 동일. 6변형의 초기 상태; 속성 변경 버전 추가는 재제안. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| product_id | string | 필수 | 국가 간 공통 제품 정체성 | Product |
| variant_id | string | 필수 | 용량·향 등 판매 변형 | Variant |
| brand_id | string | 필수 | 브랜드 연결 | Brand |
| category_id | string | 필수 | 카테고리 정의 연결 | Category |
| sku | string | 필수 | 내부 판매 식별자 | — |
| name | string | 필수 | 상품명 | — |
| valid_from | string(date) | 필수 | 속성 적용 시작일 | — |
| valid_to_exclusive | string(date) | 선택 | 속성 적용 종료일 | — |
| pack_quantity | Quantity | 조건부 | 용량 가격 비교 시 필수 | — |
| ingredients | string[] | 선택 | 원천에서 확인한 성분명; 효능으로 추정하지 않음 | — |
| declared_claims | string[] | 선택 | 상품에 표시된 설명; 실제 효과 검증과 구별 | — |
| intended_audience | string[] | 선택 | 제품 설명상의 대상 | — |
| options | Dimension[] | 선택 | 향·패키지 등 실제 제공 옵션 | — |
| status | enum(planned, active, discontinued, unknown) | 필수 | 유효한 상품 상태 | — |

정합성·해석 규칙:

- 변형→제품→브랜드가 존재해야 함
- 용량·성분은 국가별 표시/변형 차이를 보존
- 상품 효능 문구를 입증된 인과로 저장하지 않음

## T02 외부 ID·별칭 매핑

영역: 1. 한 레코드의 단위: 한 외부 식별자/별칭의 매핑. 근거: M15, M18, M19, M40.

시간 설계: 과거 유효기간/변경 시 / 상세 동일. 국가별 코드·별칭; 시점 유효한 매핑만 사용. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| mapping_kind | enum(external_id, alias, url) | 필수 | 매핑 종류 | — |
| entity_type | enum(brand, product, variant, seller) | 필수 | 매핑 대상 유형 | — |
| entity_ref | string | 필수 | 내부 개체 참조 | Brand/Product/Variant/Seller |
| external_system | string | 필수 | 외부 명명 체계 | — |
| external_value | string | 필수 | 원천의 코드·별칭·URL | — |
| country_code | string | 필수 | ISO 국가 코드 | — |
| language | string | 조건부 | 별칭/상품명 매핑에 필수 | — |
| match_status | enum(confirmed, candidate, ambiguous, unmatched) | 필수 | 매핑 확정 수준 | — |
| valid_from | string(date) | 필수 | 유효 시작 | — |
| valid_to_exclusive | string(date) | 선택 | 유효 종료 | — |
| evidence | EvidenceSpan | 조건부 | 후보·확정 매핑 근거 | — |

정합성·해석 규칙:

- 제목 유사성만으로 confirmed 금지
- 하나의 외부 식별자에 충돌하는 확정 매핑이 없어야 함

## T03 소매·시장 측정

영역: 2. 한 레코드의 단위: 상품/브랜드×지역/채널×기간. 근거: M27.

시간 설계: 과거 월별24회 / 상세 추가 없음. 6제품×3국가×24개월; 동일 커버리지의 시장 분모. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| subject_ref | string | 필수 | 제품 또는 브랜드 | Product/Brand |
| period | Period | 필수 | 측정 기간 | — |
| region_ref | string | 필수 | 지역 정의 | Region |
| retail_channel | string | 필수 | 유통 채널 | — |
| coverage_id | string | 필수 | 점포·시장 커버리지 정의 | Coverage |
| measurement_method | enum(pos_observed, panel_projected, provider_estimated) | 필수 | 실측/투영/추정 구분 | — |
| units_sold | number 또는 null | 필수 | 단위 판매량; 표본 추정은 소수 가능 | — |
| sales_value | Money 또는 null | 필수 | 같은 범위의 판매액 | — |
| market_total_value | Money | 조건부 | 금액 점유율 산출 시 필요 | — |
| distribution_metrics | MetricValue[] | 선택 | 수치·가중 유통 지표와 정의 | — |
| promotion_flag | boolean 또는 null | 선택 | 측정 범위에서 프로모션 적용 여부 | — |
| projection_version | string | 선택 | 공급자 추정 버전 | — |

정합성·해석 규칙:

- 시장 분모와 분자가 같은 국가·기간·채널·커버리지
- 추정값은 직접 주문 매출로 대체하지 않음

## T04 구매·사용 패널

영역: 2. 한 레코드의 단위: 패널 집단×대상×기간의 집계. 근거: M28.

시간 설계: 과거 분기별8회 / 상세 추가 없음. 3브랜드×3국가×8분기; 월별로 분해 금지. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| panel_id | string | 필수 | 조사 패널 정의 | — |
| cohort_id | string | 필수 | 표본 집단 정의 | — |
| subject_ref | string | 필수 | 브랜드/제품 | Brand/Product |
| period | Period | 필수 | 측정 기간 | — |
| sample_size | integer | 필수 | 관측 표본 수 | — |
| weighting_method | string | 필수 | 가중·투영 기준 | — |
| measures | MetricValue[] | 필수 | 침투·구매·재구매 등 정의된 집계 | — |
| purchase_channel | string | 선택 | 판매처 범위 | — |
| usage_context | string | 선택 | 사용 조사 맥락 | — |
| linked_survey_ref | string | 선택 | 조사 연결 | T32 |

정합성·해석 규칙:

- 패널 고객을 자사 전체 고객으로 간주하지 않음
- 개인 기록/집계 스키마를 섞지 않음

## T05 검색 관심 시계열

영역: 3. 한 레코드의 단위: 검색 요청×검색어/주제×기간. 근거: M10, M41.

시간 설계: 과거 월별24회 / 상세 주별4회. 4검색 대상×3국가×24=288, 한국 별도 클릭지수24, 상세 검색48; 요청별 정규화 분리. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| query_id | string | 필수 | 정규화 요청/비교 집합 식별자 | — |
| term_ref | string | 필수 | 검색어 또는 주제 정의 | SearchTerm |
| term_kind | enum(keyword, topic, shopping_category) | 필수 | 분석 대상 종류 | — |
| period | Period | 필수 | 원천의 기간 해상도 | — |
| index_value | number 또는 null | 필수 | 상대 관심/클릭 지수 | — |
| index_definition | string | 필수 | 검색 관심인지 쇼핑 클릭인지 | — |
| normalization_scope | string | 필수 | 요청별 최대/비교 기준 | — |
| search_surface | string | 필수 | 검색/쇼핑 등 표면 | — |
| filters | Dimension[] | 선택 | 지역·기기·카테고리 등 요청조건 | — |

정합성·해석 규칙:

- 서로 다른 정규화 요청을 절대 건수처럼 합산하지 않음
- 네이버 쇼핑 클릭 지수와 Google 검색 관심 지수를 같은 지표로 합치지 않음

## T06 키워드 수요·비용 범위

영역: 3. 한 레코드의 단위: 키워드×타깃 지역/언어×월. 근거: M02.

시간 설계: 과거 월별24회 / 상세 추가 없음. 국가별10키워드×24개월; 근사량. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| keyword | string | 필수 | 원천 키워드 | — |
| language | string | 필수 | 검색 언어 | — |
| geo_target_ref | string | 필수 | 타깃 지역 정의 | — |
| period | Period | 필수 | 원천 월 범위 | — |
| estimated_searches | number 또는 null | 필수 | 근사 검색량 | — |
| competition_level | string 또는 null | 필수 | 공급자 경쟁 분류 | — |
| competition_index | number 또는 null | 선택 | 광고 슬롯 경쟁 지수 | — |
| low_bid | Money | 선택 | 원천 입찰 범위 하단 | — |
| high_bid | Money | 선택 | 원천 입찰 범위 상단 | — |
| network_scope | string | 필수 | 검색 네트워크 조건 | — |

정합성·해석 규칙:

- 검색량 근사·입찰 범위를 실제 클릭·낙찰 단가로 쓰지 않음

## T07 자사 자연 검색 유입

영역: 3. 한 레코드의 단위: 사이트×검색 차원×일/집계기간. 근거: M09.

시간 설계: 과거 월별24회 / 상세 일별28회. 2자사 페이지/검색차원×3국가×(24+28); 원천 집계 범위 고정. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| site_ref | string | 필수 | 권한 있는 사이트 | Site |
| period | Period | 필수 | 원천 보고 시간대와 기간 | — |
| query | string 또는 null | 필수 | 검색어; 숨겨지면 null | — |
| page_ref | string | 필수 | 페이지 | LandingPage |
| device | string | 필수 | 원천 기기 분류 | — |
| search_type | string | 필수 | 검색 유형 | — |
| clicks | integer 또는 null | 필수 | 보고 클릭 | — |
| impressions | integer 또는 null | 필수 | 보고 노출 | — |
| average_position | number 또는 null | 선택 | 평균 순위 | — |
| aggregation_scope | string | 필수 | 속성/페이지 등 집계 기준 | — |

정합성·해석 규칙:

- CTR은 클릭/노출에서 계산
- 조회 제한·검색어 누락을 0으로 대체하지 않음

## T08 판매 제안·가격 스냅샷

영역: 4. 한 레코드의 단위: offer×판매처×관측 시점. 근거: M15, M16, M40.

시간 설계: 과거 월초 스냅샷24회 / 상세 일별28회. 6제품×3국가×1판매처×(24+28); 상세 첫날도 월초와 다른 시점. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| offer_id | string | 필수 | 판매 제안 ID | — |
| variant_ref | string | 필수 | 판매 변형 | Variant |
| seller_ref | string | 필수 | 판매처 | Seller |
| observed_at | string(date-time) | 필수 | 가격 관측 시각 | — |
| listed_price | Money 또는 null | 필수 | 표시 가격 또는 미제공 | — |
| regular_price | Money | 선택 | 원천에서 확인한 기준 가격 | — |
| sale_price | Money | 선택 | 실제 표시된 할인가 | — |
| availability | enum(in_stock, out_of_stock, preorder, unknown) | 필수 | 원천 판매 상태 | — |
| tax_included | boolean 또는 null | 필수 | 세금 포함 여부; 미확인 null | — |
| shipping_included | boolean 또는 null | 필수 | 배송비 포함 여부 | — |
| pack_quantity | Quantity | 조건부 | 용량별 가격 비교에 필수 | — |
| listing_ref | string | 선택 | 원천 상품 페이지/가상 문서 참조 | — |

정합성·해석 규칙:

- API의 0 sentinel을 무료 상품으로 보지 않음
- 현재 가격을 과거 가격으로 복제하지 않음

## T09 할인·프로모션

영역: 4. 한 레코드의 단위: 한 행사·대상·유효기간. 근거: M12, M27.

시간 설계: 과거 사건별/유효기간 / 상세 사건별. 실제형 행사 기간; 월·일로 복제 금지. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| promotion_id | string | 필수 | 행사 ID | — |
| product_refs | string[] | 필수 | 행사 대상 | Product/Variant |
| seller_ref | string | 필수 | 적용 판매처 | Seller |
| period | Period | 필수 | 행사 유효기간 | — |
| promotion_type | enum(percent_discount, amount_discount, bundle, coupon, shipping, other) | 필수 | 할인 종류 | — |
| eligibility_text | string | 필수 | 적용 조건 | — |
| discount_ratio | number | 조건부 | 비율 할인에 필수 | — |
| discount_amount | Money | 조건부 | 금액 할인에 필수 | — |
| coupon_ref | string | 선택 | 쿠폰 식별자 | — |
| change_event_refs | string[] | 선택 | 변경/종료 근거 | T35 |

스키마 조건: promotion_type=percent_discount이면 discount_ratio 필수; promotion_type=amount_discount이면 discount_amount 필수.

정합성·해석 규칙:

- 행사 범위 안의 주문 할인과 대사
- 경쟁 행사 집행비는 공개되지 않으면 생성하지 않음

## T10 공개 경쟁 광고 관측

영역: 5. 한 레코드의 단위: 공개 광고×관측. 근거: M34.

시간 설계: 과거 관측 표본 / 상세 관측 표본. 공개 경쟁 광고 조사 시각; 집행 기간 미확인은 unknown. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| advertiser_ref | string | 필수 | 공개 광고주 | Brand/Advertiser |
| public_ad_id | string | 필수 | 공개 관측 광고 ID | — |
| observed_at | string(date-time) | 필수 | 조사 시각 | — |
| format | string | 필수 | 광고 형식 | — |
| creative_text | string | 필수 | 공개된 문구 | — |
| media_ref | string | 조건부 | 이미지/영상 광고의 근거 파일 | — |
| served_regions | string[] | 필수 | 공개된 지역 범위 | — |
| first_seen | string(date) | 선택 | 공개/관측에서 확인한 최초 시점 | — |
| last_seen | string(date) | 선택 | 공개/관측 마지막 시점 | — |
| destination_ref | string | 선택 | 공개 목적지 | — |
| coverage_text | string | 필수 | 공개 광고 조사 범위 | — |

정합성·해석 규칙:

- 경쟁사의 비공개 지출·전환·매출 필드 없음
- 소재 수를 노출량으로 대체하지 않음

## T11 기사·공식 발표·사건

영역: 5. 한 레코드의 단위: 원문 문서와 명시된 사건. 근거: M31.

시간 설계: 과거 게시/발생 사건별 / 상세 사건별. 게시·발생·확보 시각 분리. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| document_id | string | 필수 | 문서 ID | — |
| publisher | string | 필수 | 발행 주체 | — |
| published_at | string(date-time) | 필수 | 게시 시각 | — |
| language | string | 필수 | 원문 언어 | — |
| title | string | 필수 | 문서 제목 | — |
| body_text | string | 필수 | 허용된 원문/가상 원문 | — |
| subject_refs | string[] | 필수 | 언급된 대상 | Brand/Product |
| event_time | string(date-time) | 선택 | 본문이 명시한 발생 시각; 게시일과 구별 | — |
| duplicate_cluster | string | 선택 | 전재/중복 문서군 | — |
| claims | EvidenceSpan[] | 선택 | 본문 주장과 위치 | — |

정합성·해석 규칙:

- 가상 원문을 실재 기관 발행 URL로 위장하지 않음
- 기사의 주장을 제품 성능 사실로 자동 확정하지 않음

## T12 광고 운영 설정 버전

영역: 6. 한 레코드의 단위: 플랫폼 리소스의 설정·유효기간. 근거: M01, M04, M06.

시간 설계: 과거 설정 유효기간 / 상세 변경 시. 18캠페인×3버전; 실제 운영 시작·종료는 생성 제안에서 확정. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| platform | string | 필수 | 원천 광고 플랫폼 | — |
| account_id | string | 필수 | 계정 식별자 | — |
| campaign_id | string | 필수 | 캠페인 식별자 | Campaign |
| adgroup_id | string | 선택 | 그룹 계층 | — |
| ad_id | string | 선택 | 광고 계층 | — |
| objective | string | 필수 | 캠페인 목표 | — |
| status | string | 필수 | 운영 상태 | — |
| period | Period | 필수 | 설정 유효기간 | — |
| product_refs | string[] | 필수 | 홍보 대상 | Product |
| channel | string | 필수 | 검색/소셜/영상 등 채널 정의 | — |
| budget_amount | Money | 필수 | 설정 예산 | — |
| budget_period | enum(daily, lifetime, custom) | 필수 | 예산 단위 | — |
| bidding_strategy | string | 필수 | 원천 입찰 방식 | — |
| target_definition | string | 필수 | 지역/오디언스 등 설정 | — |
| creative_refs | string[] | 조건부 | 소재 분석 대상이면 필요 | T16 |
| landing_ref | string | 조건부 | 웹 전환 분석이면 필요 | LandingPage |

정합성·해석 규칙:

- 플랫폼별 계층·예산 의미 보존
- 예산 설정과 실제 지출을 구별

## T13 광고 성과

영역: 6. 한 레코드의 단위: 리소스×기간×귀속 기준. 근거: M01, M04, M06.

시간 설계: 과거 월별24회 / 상세 일별28회. 18캠페인×(24+28); 동일 기간의 월·일 중복 합산 금지. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| platform | string | 필수 | 원천 플랫폼 | — |
| account_id | string | 필수 | 보고 계정 | — |
| campaign_ref | string | 필수 | 설정과 연결 | T12/Campaign |
| entity_level | enum(campaign, adgroup, ad) | 필수 | 보고 레벨 | — |
| entity_id | string | 필수 | 실제 보고 리소스 | — |
| period | Period | 필수 | 계정 시간대 보고기간 | — |
| metrics | AdMetrics | 필수 | 원천 지출/노출/클릭 및 조건부 전환 | — |
| report_state | enum(provisional, final, revised) | 필수 | 지연·정정 상태 | — |
| conversion_definition_ref | string | 조건부 | 전환이 존재하면 필수 | ConversionDefinition |
| attribution_model | string | 조건부 | 귀속 성과에 필수 | — |
| attribution_window | string | 조건부 | 클릭/조회 귀속 기간 | — |
| reported_at | string(date-time) | 선택 | 보고 갱신 시각 | — |

스키마 조건: metrics의 귀속 전환 또는 귀속 금액이 null이 아니면 conversion_definition_ref, attribution_model, attribution_window 필수.

정합성·해석 규칙:

- CPM/CPC/CTR/CPA/ROAS는 원천에서 계산
- 조회 전환/분수 전환 때문에 전환<=클릭을 무조건 강제하지 않음
- 여러 플랫폼 귀속 매출 합계를 실제 주문 총액으로 보지 않음

## T14 광고 성과 세그먼트

영역: 6. 한 레코드의 단위: 원천이 허용하는 차원 조합×기간. 근거: M04, M06.

시간 설계: 과거 월별24회 / 상세 추가 없음. 18캠페인×24개월×2세그먼트; 전체와 세그먼트 중복 합산 금지. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| campaign_ref | string | 필수 | 캠페인 | Campaign |
| period | Period | 필수 | 보고 기간 | — |
| breakdown_dimensions | Dimension[] | 필수 | 기기·배치 등 지원 차원 | — |
| report_definition_ref | string | 필수 | 허용된 원천 조합 정의 | — |
| metrics | AdMetrics | 필수 | 동일 귀속 기준의 부분 집계 | — |
| audience_basis | enum(target_setting, observed_aggregate, unknown) | 필수 | 설정/실제 관측 구별 | — |
| parent_report_ref | string | 선택 | 대사 가능한 상위 집계 | T13 |
| suppression_rule | string | 선택 | 억제·반올림 기준 | — |

정합성·해석 규칙:

- 서로 겹치는 breakdown을 합산하지 않음
- 상위와 대사 가능한 차원만 합계 검사

## T15 경매 경쟁 보고

영역: 6. 한 레코드의 단위: 보고 캠페인×경쟁 광고주×기간. 근거: M03.

시간 설계: 과거 월별24회 / 상세 주별4회. 6검색 캠페인×2광고주×(24+4); 경매 비율 재집계에 분모 필요. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| campaign_ref | string | 필수 | 보고 대상 캠페인 | Campaign |
| competitor_domain | string | 필수 | 원천 광고주 표시 | — |
| period | Period | 필수 | 공유 경매 범위 | — |
| report_surface | string | 필수 | 검색/쇼핑 등 지원 표면 | — |
| impression_share | number 또는 null | 필수 | 원천 정의 노출 점유 | — |
| overlap_rate | number 또는 null | 선택 | 원천 중복 비율 | — |
| outranking_share | number 또는 null | 선택 | 원천 우위 비율 | — |
| position_above_rate | number 또는 null | 선택 | 지원 시 상위 게재 비율 | — |
| device | string | 선택 | 보고 세그먼트 | — |
| threshold_status | string | 필수 | 활동 임계·누락 상태 | — |

정합성·해석 규칙:

- 전체 시장 점유율이 아닌 공유 경매 비교
- 플랫폼/캠페인에서 지원하지 않는 지표는 만들지 않음

## T16 소재·메시지 버전

영역: 7. 한 레코드의 단위: 하나의 소재 버전. 근거: M01, M21, M34.

시간 설계: 과거 소재 유효기간 / 상세 변경 시. 캠페인 소재 버전; 날짜별 복제 금지. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| creative_id | string | 필수 | 소재 식별자 | — |
| version | string | 필수 | 내용 버전 | — |
| product_refs | string[] | 필수 | 제품 연결 | Product |
| format | string | 필수 | 텍스트/이미지/영상 | — |
| language | string | 필수 | 문구 언어 | — |
| message_text | string | 필수 | 실제형 소재 문구 | — |
| valid_from | string(date-time) | 필수 | 사용 시작 | — |
| valid_to_exclusive | string(date-time) | 선택 | 사용 종료 | — |
| media_ref | string | 조건부 | 비텍스트 소재의 파일 근거 | — |
| duration_seconds | number | 선택 | 영상 길이 | — |
| cta | string | 선택 | 행동 문구 | — |
| message_tags | string[] | 선택 | 추출/수작업 주제 | — |
| annotation_evidence | EvidenceSpan | 조건부 | 메시지 태그를 판단한 근거 | — |

정합성·해석 규칙:

- 소재 교체와 성과 동시 변화만으로 효과 확정하지 않음

## T17 웹·앱 일반 이벤트

영역: 8. 한 레코드의 단위: 한 비커머스 이벤트. 근거: M07.

시간 설계: 과거 H01 월별 보고서 / 상세 개별 사건, 상세28일만. 과거 일반 이벤트 원문 없음; 표본 이벤트로 과거 전체 트래픽 추정 금지. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| event_id | string | 필수 | 중복 제거 키 | — |
| event_time | string(date-time) | 필수 | 발생 시각 | — |
| event_name | string | 필수 | 이벤트명 | — |
| site_ref | string | 필수 | 사이트/앱 | — |
| session_ref | string 또는 null | 필수 | 수집 가능한 세션 키 | Session |
| user_pseudo_ref | string 또는 null | 선택 | 수집 가능한 가명 키 | — |
| page_ref | string 또는 null | 필수 | 페이지; 미제공 null | — |
| device | string | 필수 | 관측 기기 | — |
| traffic_source | string | 선택 | 관측 유입 출처 | — |
| traffic_medium | string | 선택 | 관측 유입 매체 | — |
| utm_campaign | string | 선택 | 전달된 캠페인 파라미터 | — |
| click_id | string | 선택 | 권한·계측이 있는 클릭 ID | — |
| consent_state | string | 필수 | 동의/저장 상태 | — |
| event_parameters | Dimension[] | 선택 | 추가 속성 | — |

정합성·해석 규칙:

- T18 커머스 이벤트와 같은 event_id를 두 번 집계하지 않음
- 동의 없는 전역 사람 ID를 만들어내지 않음

## T18 커머스 퍼널 이벤트

영역: 8. 한 레코드의 단위: 한 이벤트의 상품 행. 근거: M08.

시간 설계: 과거 H01 월별 보고서 / 상세 개별 사건, 상세28일만. 과거 퍼널 보고서와 상세 사건 분리; 구매와 환불의 시점 구분. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| event_id | string | 필수 | 이벤트 식별자 | — |
| item_index | integer | 필수 | 상품 배열 내 행 식별 | — |
| event_time | string(date-time) | 필수 | 발생 시각 | — |
| event_name | enum(view_item, add_to_cart, begin_checkout, purchase, refund) | 필수 | 재현할 계측 이벤트 | — |
| variant_ref | string | 필수 | 원천 상품 매핑 | Variant |
| quantity | number | 필수 | 상품 수량 | — |
| unit_price | Money | 조건부 | 원천에 가격이 있는 경우 | — |
| session_ref | string 또는 null | 필수 | 세션 연결 | — |
| transaction_ref | string | 조건부 | purchase/refund에 필수 | Order |
| campaign_ref | string | 선택 | 귀속 가능할 때만 캠페인 연결 | Campaign |
| measurement_basis | string | 필수 | 이벤트 구현·중복 처리 기준 | — |

스키마 조건: event_name=purchase이면 transaction_ref 필수; event_name=refund이면 transaction_ref 필수.

정합성·해석 규칙:

- 구매/환불은 거래와 연결
- 방문→장바구니→결제→구매를 모든 고객이 완벽하게 밟는 것으로 만들지 않음

## T19 주문 상품 행

영역: 9. 한 레코드의 단위: 한 주문의 한 상품 행. 근거: M12, M37.

시간 설계: 과거 H01 월별 판매 보고서 / 상세 주문별, 상세28일만. 자사 주문500개의 행; 표본 주문 합계를 전체 매출로 취급 금지. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| order_id | string | 필수 | 주문 식별자 | Order |
| line_id | string | 필수 | 주문 내 상품 행 식별자 | — |
| variant_ref | string | 필수 | 판매 제품 변형 | Variant |
| seller_ref | string | 필수 | 자사 판매처 | Seller |
| ordered_at | string(date-time) | 필수 | 주문 시각 | — |
| customer_pseudo_ref | string | 필수 | 자사 범위 가명 고객 | Customer |
| quantity | number | 필수 | 판매 수량 | — |
| unit_price | Money | 필수 | 판매 단가 | — |
| line_discount | Money | 필수 | 상품 행 할인 | — |
| line_tax | Money | 필수 | 상품 행 세금 | — |
| line_gross_total | Money | 필수 | 정의된 세금 포함/제외 행 합계 | — |
| financial_status | string | 필수 | 결제 상태 | — |
| fulfilment_status | string | 필수 | 이행 상태 | — |
| transaction_ref | string | 선택 | 웹 대사 키 | — |
| acquisition_ref | string | 선택 | 확인 가능한 유입 연결 | — |

정합성·해석 규칙:

- order_id와 line_id 조합 유일
- 주문 합계를 상품 행마다 반복 합산하지 않음
- 경쟁사 개별 주문은 자사 권한 자료로 꾸미지 않음

## T20 취소·반품·환불

영역: 9. 한 레코드의 단위: 한 원주문 행의 처리 사건. 근거: M12, M19.

시간 설계: 과거 상세 주문 범위만 / 상세 처리 사건별. 원주문 이후 처리; 늦은 환불은 후속 데이터 제안 대상. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| adjustment_id | string | 필수 | 처리 사건 ID | — |
| adjustment_kind | enum(cancel, return, refund) | 필수 | 처리 종류 | — |
| order_ref | string | 필수 | 원주문 | Order |
| order_line_ref | string | 필수 | 원상품 행 | T19 |
| requested_at | string(date-time) | 필수 | 요청 시각 | — |
| processed_at | string(date-time) | 선택 | 완료 시각 | — |
| quantity | number | 필수 | 대상 수량 | — |
| refund_amount | Money | 조건부 | 금전 환불이면 필수 | — |
| reason_code | string | 필수 | 확인된 사유 또는 unknown | — |
| reason_text | string | 선택 | 원천 설명 | — |
| status | string | 필수 | 처리 상태 | — |
| restocked | boolean 또는 null | 선택 | 재입고 확인 여부 | — |

스키마 조건: adjustment_kind=refund이면 refund_amount 필수.

정합성·해석 규칙:

- 환불 수량·누계는 원주문과 대사
- 취소/반품/환불 하나를 여러 차례 순매출에서 차감하지 않음

## T21 원가·마진 조건

영역: 9. 한 레코드의 단위: SKU×기간의 비용 정의. 근거: M14.

시간 설계: 과거 월별24회/유효기간 / 상세 추가 없음. 자사2변형×3국가×24; 경쟁사 원가 생성 없음. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| variant_ref | string | 필수 | 품목 변형 | Variant |
| period | Period | 필수 | 원가 적용기간 | — |
| unit_cost | Money 또는 null | 필수 | 알려진 단위원가 | — |
| margin_definition | string | 필수 | 매출총이익/기여이익 기준 | — |
| fulfilment_unit_cost | Money | 선택 | 출고당 비용 | — |
| payment_fee_ratio | number | 선택 | 결제 수수료 비율 | — |
| channel_fee_ratio | number | 선택 | 판매처 수수료 비율 | — |
| promotion_cost | Money | 선택 | 기간 프로모션 비용 | — |
| accounting_basis | string | 필수 | 회계·원가 정의 | — |

정합성·해석 규칙:

- 원가 미확인일 때 이익 최적화 보류
- 비용 원천의 통화·기간·정의를 보존

## T22 재고·판매 가능성

영역: 10. 한 레코드의 단위: 품목×위치×관측. 근거: M13, M11.

시간 설계: 과거 월말 스냅샷24회 / 상세 일별28회. 자사2변형×3국가×(24+28); 재고 합계는 의미 없음. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| variant_ref | string | 필수 | 품목 | Variant |
| location_ref | string | 필수 | 창고/판매 위치 | Location |
| observed_at | string(date-time) | 필수 | 스냅샷 시각 | — |
| available_quantity | number 또는 null | 필수 | 판매 가능 재고 | — |
| on_hand_quantity | number 또는 null | 선택 | 보유 재고 | — |
| committed_quantity | number 또는 null | 선택 | 확정 출고 재고 | — |
| sellable_status | enum(sellable, out_of_stock, blocked, unknown) | 필수 | 판매 가능 상태 | — |
| restock_expected_at | string(date-time) | 선택 | 예정 입고 | — |
| restock_is_confirmed | boolean | 선택 | 예정 확정 수준 | — |

정합성·해석 규칙:

- 현재 재고 조회로 과거 이력을 발명하지 않음
- 창고와 판매 지역이 맞는지 확인

## T23 유통·배송

영역: 10. 한 레코드의 단위: 유통 집계 또는 주문 이행. 근거: M27, M12.

시간 설계: 과거 유통은 월별24회 / 상세 배송은 상세 주문별. 유통144+배송500; 하위 유형에 따라 기간/사건 구분. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| record_kind | enum(distribution, fulfilment) | 필수 | 서로 다른 단위를 구분 | — |
| product_ref | string | 조건부 | 유통 자료 대상 | Product |
| period | Period | 조건부 | 유통 집계기간 | — |
| retail_channel | string | 조건부 | 유통 채널 | — |
| distribution_measures | MetricValue[] | 선택 | 정의된 유통 지표 | — |
| order_ref | string | 조건부 | 배송 대상 주문 | Order |
| promised_at | string(date-time) | 조건부 | 배송 약속 시각 | — |
| shipped_at | string(date-time) | 선택 | 출고 시각 | — |
| delivered_at | string(date-time) | 선택 | 도착 확인 시각 | — |
| status | string | 조건부 | 배송 상태 | — |
| location_ref | string | 선택 | 유통/배송 위치 | — |

스키마 조건: record_kind=distribution이면 product_ref, period, retail_channel, distribution_measures 필수; record_kind=fulfilment이면 order_ref, promised_at, status 필수.

정합성·해석 규칙:

- 유통 집계와 주문 배송을 같은 grain으로 합치지 않음

## T24 개별 리뷰

영역: 11. 한 레코드의 단위: 한 제품/사업체/장소 리뷰. 근거: M17, M18, M20.

시간 설계: 과거 24개월의 개별 리뷰 표본 / 상세 상세 구간 포함 표본. 6제품×3국가×40표본; 월별 전수 리뷰량 아님. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| review_id | string | 필수 | 리뷰 ID | — |
| review_subject_type | enum(product, business, location) | 필수 | 후기 대상 종류 | — |
| subject_ref | string | 필수 | 실제 대상 | Product/Business/Location |
| written_at | string(date-time) | 필수 | 작성 시각 | — |
| updated_at | string(date-time) | 선택 | 수정 시각 | — |
| language | string | 필수 | 원문 언어 | — |
| body_text | string | 필수 | 분석 근거 원문 | — |
| title | string | 선택 | 제목 | — |
| rating_value | number 또는 null | 필수 | 별점 또는 미제공 | — |
| rating_scale_max | number | 필수 | 별점 척도 | — |
| verified_purchase | boolean 또는 null | 필수 | 제공되지 않으면 null | — |
| invited_review | boolean 또는 null | 선택 | 초대 여부 | — |

정합성·해석 규칙:

- 별점은 척도 이내
- 사업체/장소 리뷰를 제품 만족도로 합치지 않음
- 가상 원문 표시와 파일 근거 유지

## T25 리뷰 측면·감성·집계

영역: 11. 한 레코드의 단위: 발췌 주석 또는 주제 집계. 근거: M19, M15.

시간 설계: 과거 리뷰별 파생 주석 / 상세 동일. 주석1440 예산; 월별 주제 집계는 파생 뷰로 우선 처리. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| record_kind | enum(annotation, aggregate) | 필수 | 원문 추출/공급자 집계 구분 | — |
| subject_ref | string | 필수 | 제품/사업체 대상 | — |
| aspect_ref | string | 필수 | 평가 측면 정의 | Aspect |
| sentiment | enum(positive, neutral, negative, mixed, unknown) | 필수 | 측면별 분류 | — |
| definition_version | string | 필수 | 분류/집계 기준 | — |
| review_ref | string | 조건부 | 개별 주석이면 원리뷰 | T24 |
| evidence_span | EvidenceSpan | 조건부 | 주석이면 원문 위치 | — |
| period | Period | 조건부 | 집계기간 | — |
| mention_count | integer | 조건부 | 원천 언급 수 | — |
| sample_size | integer | 조건부 | 비교 표본 | — |
| extractor_version | string | 선택 | LLM/수작업 버전 | — |
| assessment_status | enum(provided, reviewed, unreviewed, uncertain) | 필수 | 검토 수준 | — |

스키마 조건: record_kind=annotation이면 review_ref, evidence_span, extractor_version 필수; record_kind=aggregate이면 period, mention_count, sample_size 필수.

정합성·해석 규칙:

- 발췌는 실제 원문 범위에 존재
- 한 리뷰는 여러 측면을 가질 수 있어 측면합=리뷰수 강제 금지
- 공급자 주제 집계에서 개별 리뷰를 역생성하지 않음

## T26 고객 문의·CS

영역: 11. 한 레코드의 단위: 한 문의 ticket. 근거: M25.

시간 설계: 과거 개별 문의 표본 / 상세 개별 문의 표본. 24개월 내 표본; 생성/해결 시점 분리. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| ticket_id | string | 필수 | 문의 식별자 | — |
| created_at | string(date-time) | 필수 | 문의 생성 | — |
| resolved_at | string(date-time) | 선택 | 처리 완료 | — |
| channel | string | 필수 | 문의 경로 | — |
| subject | string | 필수 | 문의 제목 | — |
| message_text | string | 필수 | 근거 대화/문의 | — |
| status | string | 필수 | 처리 상태 | — |
| priority | string | 선택 | 업무 우선순위 | — |
| product_ref | string | 선택 | 확인 가능한 제품 연결 | Product |
| order_ref | string | 선택 | 확인 가능한 주문 연결 | Order |
| link_status | enum(confirmed, candidate, unlinked) | 필수 | 대상 연결 수준 | — |
| tags | string[] | 선택 | 원천/주석 분류 | — |
| resolution_type | string | 선택 | 해결 유형 | — |
| satisfaction | MetricValue | 선택 | 확인된 만족도 | — |

정합성·해석 규칙:

- 연결이 없으면 제품/고객을 임의 추정하지 않음

## T27 공개 콘텐츠·반응

영역: 12. 한 레코드의 단위: 콘텐츠×통계 관측 시점. 근거: M21.

시간 설계: 과거 콘텐츠 통계 관측 표본 / 상세 추가 관측 표본. 누적 조회수를 기간 증가분과 구별. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| content_id | string | 필수 | 공개 콘텐츠 식별자 | — |
| platform | string | 필수 | 플랫폼 | — |
| channel_ref | string | 필수 | 게시 채널 | — |
| published_at | string(date-time) | 필수 | 게시일 | — |
| observed_at | string(date-time) | 필수 | 통계 수집일 | — |
| title | string | 필수 | 제목 | — |
| description_text | string | 필수 | 설명 | — |
| language | string | 필수 | 언어 | — |
| view_count | integer 또는 null | 필수 | 누적 조회 | — |
| like_count | integer 또는 null | 선택 | 누적 좋아요 | — |
| comment_count | integer 또는 null | 선택 | 누적 댓글 | — |
| product_refs | string[] | 선택 | 확인한 제품 언급 | — |

정합성·해석 규칙:

- 누적 통계 차이에는 삭제·정정·간격 고려
- 타 플랫폼 전체 반응으로 외삽하지 않음

## T28 댓글·언급

영역: 12. 한 레코드의 단위: 한 공개 댓글. 근거: M22, M31.

시간 설계: 과거 게시 사건별 표본 / 상세 게시 사건별 표본. 댓글 게시·수집 시점 보존; 전수 언급량 아님. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| comment_id | string | 필수 | 댓글 ID | — |
| content_ref | string | 필수 | 게시 콘텐츠 | T27 |
| parent_comment_ref | string | 선택 | 답글 부모 | T28 |
| written_at | string(date-time) | 필수 | 작성일 | — |
| body_text | string | 필수 | 원문 | — |
| language | string | 필수 | 언어 | — |
| like_count | integer | 선택 | 공개 반응 | — |
| mentioned_entity_refs | string[] | 선택 | 확인된 대상 | — |
| annotation_spans | EvidenceSpan[] | 선택 | 주제/대상 해석 근거 | — |

정합성·해석 규칙:

- 상품 후기와 공개 댓글은 다른 표본
- reply 조회 누락을 무반응으로 해석하지 않음

## T29 크리에이터 협업

영역: 12. 한 레코드의 단위: 한 협업·콘텐츠 계약 범위. 근거: M21.

시간 설계: 과거 협업/계약 유효기간 / 상세 변경 시. 계약·예정 게시·실제 게시 시각 분리. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| collaboration_id | string | 필수 | 협업 식별자 | — |
| creator_ref | string | 필수 | 크리에이터 | — |
| product_refs | string[] | 필수 | 홍보 제품 | — |
| planned_period | Period | 필수 | 약속 게시기간 | — |
| message_brief | string | 필수 | 계약 메시지 | — |
| content_refs | string[] | 선택 | 실제 게시물 | T27 |
| agreement_status | string | 필수 | 합의/게시 상태 | — |
| fee | Money | 조건부 | 자사 계약으로 확인한 비용만 | — |
| tracking_ref | string | 선택 | 유효한 추적 링크 | — |
| rights_text | string | 선택 | 사용 권리 범위 | — |

정합성·해석 규칙:

- 경쟁 공개 콘텐츠에서 비공개 계약금·매출을 만들지 않음

## T30 CRM 코호트·영업 기회

영역: 13. 한 레코드의 단위: 고객 코호트 집계 또는 B2B 기회. 근거: M12, M24.

시간 설계: 과거 월별24회 / 상세 추가 없음. 3국가×24개월 코호트; 재구매 관측 창·모집 시점 필요. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| record_kind | enum(cohort, deal) | 필수 | 소비재 코호트/B2B 기회 구분 | — |
| cohort_ref | string | 조건부 | 집단 정의 | — |
| period | Period | 조건부 | 측정 기간 | — |
| sample_size | integer | 조건부 | 집단 인원 | — |
| acquisition_channel | string | 선택 | 확인한 획득 출처 | — |
| net_revenue | Money | 선택 | 기간 순매출 | — |
| repeat_purchase_rate | number | 선택 | 동일 집단 반복구매 비율 | — |
| deal_id | string | 조건부 | B2B 기회 ID | — |
| stage | string | 조건부 | 영업 단계 | — |
| deal_amount | Money | 조건부 | 기회 금액 | — |
| closed_at | string(date-time) | 선택 | 확인한 종료 | — |

스키마 조건: record_kind=cohort이면 cohort_ref, period, sample_size 필수; record_kind=deal이면 deal_id, stage, deal_amount 필수.

정합성·해석 규칙:

- 미래 LTV는 실측 코호트 금액과 분리
- 샴푸 B2C 첫 배치에 B2B 기회를 임의 추가하지 않음

## T31 이메일·CRM 캠페인

영역: 13. 한 레코드의 단위: 캠페인×보고기간. 근거: M23.

시간 설계: 과거 발송별 반응 관측 창 / 상세 발송별. 국가별 월1회 발송; 월 전체 CRM 성과와 혼동 금지. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| crm_campaign_id | string | 필수 | 발송 캠페인 | — |
| segment_ref | string | 필수 | 대상 집단 | — |
| sent_at | string(date-time) | 필수 | 발송 시각 | — |
| period | Period | 필수 | 반응 관측기간 | — |
| emails_sent | integer | 필수 | 발송 건수 | — |
| bounces | integer | 필수 | 반송 | — |
| unique_opens | integer 또는 null | 선택 | 관측 고유 오픈 | — |
| unique_clickers | integer | 필수 | 고유 클릭 수신자 | — |
| unsubscribes | integer | 필수 | 해지 수신자 | — |
| linked_orders | string[] | 선택 | 확인된 주문 | — |
| message_ref | string | 선택 | 발송 문구 | — |
| open_measurement_basis | string | 필수 | 프록시/계측 기준 | — |

정합성·해석 규칙:

- 오픈을 직접 관심/구매로 대체하지 않음
- 발송·반송·고유 반응의 범위를 대사

## T32 설문·브랜드 리프트

영역: 14. 한 레코드의 단위: 조사×질문×집단의 집계. 근거: M26, M28.

시간 설계: 과거 분기 내 조사8회 / 상세 추가 없음. 3브랜드×3국가×8조사; 조사 기간은 분기 전체가 아님. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| study_id | string | 필수 | 조사 식별자 | — |
| subject_ref | string | 필수 | 브랜드/제품 | — |
| period | Period | 필수 | 조사기간 | — |
| question_text | string | 필수 | 질문 원문 | — |
| measure_definition | string | 필수 | 인지·회상·고려 등 정의 | — |
| cohort_ref | string | 필수 | 조사 집단 | — |
| sample_size | integer | 필수 | 응답 표본 | — |
| response_scale | string | 필수 | 응답 척도 | — |
| measures | MetricValue[] | 필수 | 응답/집계 지표 | — |
| sampling_method | string | 필수 | 모집·가중 기준 | — |
| experiment_ref | string | 선택 | 리프트 비교 실험 | T38 |
| uncertainty_text | string | 선택 | 자료가 제공한 불확실성 | — |

정합성·해석 규칙:

- 광고 노출/검색 지수를 조사 인지도라고 부르지 않음

## T33 공표 시장·인구·소비 통계

영역: 15. 한 레코드의 단위: 통계표 항목×지역×기간. 근거: M29, M43, M44.

시간 설계: 과거 월별24회 또는 분기별8회 / 상세 추가 없음. 국가별1개 월별 통계 선택 시72; series 선택에 따라 재산정. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| statistics_table_id | string | 필수 | 통계표 식별 | — |
| item_code | string | 필수 | 원천 항목 분류 | — |
| region_ref | string | 필수 | 공표 지역 | — |
| period | Period | 필수 | 공표기간 | — |
| value | number 또는 null | 필수 | 통계 값 | — |
| unit | string | 필수 | 원천 단위 | — |
| definition | string | 필수 | 통계 항목 의미 | — |
| published_at | string(date) | 필수 | 발표일 | — |
| revised_at | string(date) | 선택 | 개정일 | — |
| base_year | integer | 선택 | 기준년 | — |
| seasonal_adjustment | string | 필수 | 조정 여부 | — |
| sampling_text | string | 선택 | 표본·추정 방식 | — |

정합성·해석 규칙:

- 국가 총계는 특정 브랜드 판매량이 아님

## T34 기상·휴일·시즌

영역: 15. 한 레코드의 단위: 기상 관측 또는 일정. 근거: M30.

시간 설계: 과거 시즌 일정 사건별 / 상세 기상 일별28회. 가상 일정24+일본 기상형28; 국가별 외부 통계처럼 위장 금지. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| record_kind | enum(weather, calendar) | 필수 | 기상/일정 구분 | — |
| region_ref | string | 필수 | 관측/적용 지역 | — |
| period | Period | 필수 | 시간 범위 | — |
| station_ref | string | 조건부 | 기상 관측소 | — |
| measures | MetricValue[] | 조건부 | 기온·강수 등 측정 | — |
| event_name | string | 조건부 | 휴일/시즌 이름 | — |
| calendar_kind | string | 조건부 | 일정 종류 | — |
| observation_quality | string | 선택 | 원천 기상 품질 | — |

스키마 조건: record_kind=weather이면 station_ref, measures 필수; record_kind=calendar이면 event_name, calendar_kind 필수.

정합성·해석 규칙:

- 날씨와 판매의 인과는 별도 가설

## T35 운영 변경 이력

영역: 16. 한 레코드의 단위: 한 리소스 변경 사건. 근거: M33.

시간 설계: 과거 변경 사건별 / 상세 변경 사건별. 변경 전/후 및 발생·확보 시각; 월별 값으로 변경일 추정 금지. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| change_id | string | 필수 | 변경 식별 | — |
| entity_ref | string | 필수 | 변경 리소스 | — |
| changed_at | string(date-time) | 필수 | 변경 시각 | — |
| operation | enum(create, update, remove) | 필수 | 변경 유형 | — |
| changed_field | string | 필수 | 변경 필드 경로 | — |
| before_value | string/number/boolean/object/array/null | 필수 | 이전 값; 신규면 null | — |
| after_value | string/number/boolean/object/array/null | 필수 | 이후 값; 삭제면 null | — |
| client_type | string | 필수 | API/화면/운영 시스템 | — |
| actor_role | string | 선택 | 확인한 수행 역할 | — |
| approval_ref | string | 선택 | 승인 기록 | — |
| reason_text | string | 선택 | 확인된 변경 사유 | — |

정합성·해석 규칙:

- 조회한 변경 범위와 누락 한계 보존
- 권한 주체 이름을 임의 실명으로 만들지 않음

## T36 수집·계측 상태

영역: 16. 한 레코드의 단위: 한 수집 실행/자료 범위. 근거: M07.

시간 설계: 과거 수집 실행별 요약 표본 / 상세 실행별 상세 표본. expected/actual 범위와 실제 완료 시각; 모든 실행을 재현한 전수 아님. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| run_id | string | 필수 | 수집 실행 식별 | — |
| target_dataset | string | 필수 | 수집 대상 | — |
| expected_period | Period | 필수 | 기대 범위 | — |
| actual_period | Period | 선택 | 수집된 범위 | — |
| started_at | string(date-time) | 필수 | 시작 | — |
| completed_at | string(date-time) | 선택 | 완료 | — |
| status | enum(success, partial, failed, running) | 필수 | 수집 상태 | — |
| expected_count | integer 또는 null | 필수 | 알려진 기대 개수 | — |
| received_count | integer | 필수 | 실제 수신 | — |
| duplicate_count | integer | 필수 | 중복 | — |
| missing_count | integer 또는 null | 필수 | 확인 가능한 결측 | — |
| schema_version | string | 필수 | 원천/변환 버전 | — |
| error_code | string | 선택 | 확인된 오류 | — |
| consent_change_ref | string | 선택 | 동의/태그 변경 | — |

정합성·해석 규칙:

- 실패를 성과 0으로 대체하지 않음
- 로그 기대값을 실제로 확인한 범위에서만 채움

## T37 사이트 성능·장애

영역: 16. 한 레코드의 단위: rolling 측정 또는 장애 사건. 근거: M32.

시간 설계: 과거 rolling 관측 표본 / 상세 장애 사건/rolling 관측. rolling 창28일; 중첩 창 합산 금지; 장애 시작/종료 별도. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| record_kind | enum(performance, incident) | 필수 | 집계/사건 구분 | — |
| page_ref | string | 필수 | URL/origin | — |
| device | string | 필수 | 기기 | — |
| period | Period | 조건부 | 성능 집계기간 | — |
| measures | MetricValue[] | 조건부 | 성능 분포/백분위 | — |
| incident_start | string(date-time) | 조건부 | 장애 시작 | — |
| incident_end | string(date-time) | 선택 | 복구 시각 | — |
| status | string | 조건부 | 장애 상태 | — |
| release_ref | string | 선택 | 확인된 배포 변경 | — |
| error_text | string | 선택 | 확인된 오류 | — |

스키마 조건: record_kind=performance이면 period, measures 필수; record_kind=incident이면 incident_start, status 필수.

정합성·해석 규칙:

- 28일 rolling 측정을 당일 장애 로그로 바꾸지 않음

## T38 실험 설계·집계 결과

영역: 17. 한 레코드의 단위: 실험의 한 arm/결과 버전. 근거: M35, M26.

시간 설계: 과거 실험별 관측 기간 / 상세 실험별. 6실험×2arm; 학습·실험·분석 기준일 구분. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| experiment_id | string | 필수 | 실험 식별 | — |
| arm_id | string | 필수 | 대조/처리 집단 | — |
| hypothesis_text | string | 필수 | 검증할 주장 | — |
| period | Period | 필수 | 실험기간 | — |
| assignment_method | string | 필수 | 분할/무작위 방법 | — |
| assignment_unit | string | 필수 | 고객/지역/캠페인 등 단위 | — |
| treatment_description | string | 필수 | 집단 조건 | — |
| sample_size | integer | 필수 | 표본 | — |
| status | string | 필수 | 계획/진행/종료 | — |
| outcome_measures | MetricValue[] | 선택 | 실제형 측정 결과 | — |
| uncertainty_text | string | 선택 | 추정 범위·방법 | — |
| contamination_text | string | 선택 | 오염·중단 상태 | — |

정합성·해석 규칙:

- 광고 A/B와 무광고 증분 실험의 질문 차이 명시
- 실험 효과는 단순 전후 차이와 구별

## T39 반응 모형·예산 후보

영역: 17. 한 레코드의 단위: 모형 정의 또는 후보 배분. 근거: M38, M39.

시간 설계: 과거 모형 학습 기간 / 상세 후보 예측/집행 기간. 관측값과 예측값 분리; 기준일 이후 자료 학습 금지. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| record_kind | enum(response_model, budget_scenario) | 필수 | 모형/후보 구분 | — |
| model_ref | string | 필수 | 사용 모형 식별 | — |
| model_version | string | 필수 | 모형 버전 | — |
| objective | string | 필수 | 최적화/비교 목표 | — |
| assumptions | string[] | 필수 | 계산 가정 | — |
| validity_scope | string | 필수 | 모형 적용 대상·범위 | — |
| training_period | Period | 조건부 | 추정 모형의 자료 범위 | — |
| formula | string | 조건부 | 가정 모의 함수 또는 검증 모형 설명 | — |
| parameters | Dimension[] | 조건부 | 파라미터 명세 | — |
| scenario_id_ref | string | 조건부 | 예산안 식별 | — |
| period | Period | 조건부 | 집행 제안기간 | — |
| total_budget | Money | 조건부 | 고정/상한 총액 | — |
| allocations | Allocation[] | 조건부 | 캠페인별 현행/후보 배분 | — |
| expected_measures | MetricValue[] | 조건부 | 모의 성과 | — |
| validation_evidence_refs | string[] | 선택 | 실험/검증 근거 | — |

스키마 조건: record_kind=response_model이면 formula, parameters 필수; record_kind=budget_scenario이면 scenario_id_ref, period, total_budget, allocations, expected_measures 필수.

정합성·해석 규칙:

- 모의 함수는 실제 학습 모델과 구별
- 배분 합계·하한·상한·통화·목표 대사

## T40 업무 목표·집행 정책

영역: 18. 한 레코드의 단위: 한 브리프/정책 유효 버전. 근거: S01, S02, U01.

시간 설계: 과거 정책 유효기간 / 상세 개정 시. 승인 당시 정책 버전 연결. [시간·집계·온톨로지 계약](temporal-design.md) 참조.

| 필드 | 자료형 | 중요도 | 의미·필요한 이유 | 참조 대상 |
| --- | --- | --- | --- | --- |
| policy_id | string | 필수 | 업무/정책 식별 | — |
| version | string | 필수 | 유효 버전 | — |
| period | Period | 필수 | 적용기간 | — |
| objective | string | 필수 | 사업/캠페인 목표 | — |
| kpi_definition_refs | string[] | 필수 | 판단 KPI | MetricDefinition |
| product_refs | string[] | 필수 | 대상 제품 | — |
| budget_limit | Money | 필수 | 허용 총액 | — |
| allowed_channels | string[] | 필수 | 사용 채널 | — |
| approval_role | string | 필수 | 승인 역할 | — |
| change_constraints | string[] | 필수 | 변경 제한 | — |
| brand_guidelines | string[] | 선택 | 허용/금지 표현 | — |
| policy_status | enum(proposed, approved, superseded) | 필수 | 실제/가상 승인 의미 | — |

정합성·해석 규칙:

- 가상 회사 정책은 실제 사용자 데이터 생성 승인과 별도
- 자동 승인 역할을 사용자 동의로 대체하지 않음
