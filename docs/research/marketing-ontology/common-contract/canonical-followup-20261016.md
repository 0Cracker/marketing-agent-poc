# 공통 데이터 명세 보완안 — 최초 제안 이력

현재는 [구체 실행·의미 위임](completion-delegation-20261016.json)에 따라 별도 보완 파일을 구현했다. T31 종료일은8월12일 미포함으로 수정했다. 아래 승인 대기·생성0 설명과8월13일 제안은 최초 작성 당시 이력이며 현재 상태는 [실행 기록](completion-execution.md)을 따른다.

# 최초 보완 제안

원천 528행 중 보완 대상은 **330행**, 필수 필드 설정은 **804건·63그룹**이다. T16 종료시각 12건을 포함하면 **816건**이다. 객체·배열 필드 하나를 설정 1건으로 세며 내부 값 수나 독립 오류 수가 아니다. 이번 작업에서는 새 가상값을 생성하지 않았다.

정확한 기존 대상 ID·필드·건수는 [기계 보완안](canonical-gap-proposal-20261016.json)에 기록한다. 아래는 승인 후 생성·변환할 규칙 제안이다. 과거 원천에 존재했던 정보로 소급 표시하지 않는다. 원천·manifest·공통 스키마·원래 시험은 보존하고 별도 보완 파일에 기록한다. 실제 공급자 자료는 필요하지 않다.

## 유형별 보완 규칙

| 유형 | 제안 규칙 |
| --- | --- |
| T04 | cohort_id는 panel_id·subject_ref·period 조합으로 해당 가상 표본을 구분한다. measures는 기존 positive_responses(count)·positive_rate(ratio)를 보존하고 공통 정의 버전 CANONICAL-SYNTHETIC-1에 연결한다. |
| T05 | term_ref는 기존 term 문자열의 UTF-8 SHA-256 기반 식별자, term_kind는 keyword로 정의한다. index_definition은 동일 normalization_scope 내 최대 100인 가상 검색 관심지수다. 서로 다른 정규화창은 합치지 않는다. |
| T06 | geo_target_ref는 해당 가상 country_code, network_scope는 synthetic_search_only로 새로 정한다. 실제 공급자 타깃 설정이라고 표시하지 않는다. |
| T07 | search_type은 synthetic_web_search, aggregation_scope는 site/page/query/device/period로 정의한다. null query는 유지한다. |
| T10 | served_regions는 새 가상 가정으로 해당 country_code 한 개만 등록한다. coverage_text는 독립 가상 광고 관측 표본이며 실제 송출 지역·시장 전수 확인이 아님을 명시한다. |
| T11 | title은 ‘가상 경쟁 제품 안내문’과 document_id를 결합한 새 보완 제목이다. 원문에 있었던 제목으로 표시하지 않는다. |
| T14 | report_definition_ref는 parent_record_id·device·D005 분할 규칙을 식별하는 코드 정의다. audience_basis는 observed_aggregate로 두고 simulation·synthetic_partition·부모 귀속 기준을 보존한다. |
| T15 | report_surface는 synthetic_auction, threshold_status는 not_provided로 정의한다. 미제공 분모·임계값을 숫자로 만들지 않는다. |
| T16 | 기존 period의 양 끝을 reporting_timezone의 현지 자정으로 해석하는 새 가상 규칙을 적용한다. valid_from 12건과 valid_to_exclusive 12건을 함께 보완하며 DST는 zoneinfo를 따른다. |
| T19 | seller_ref는 국가별 가상 판매자 하나다. 최초 결제 완료를 새 가정으로 추가하고 status_available_at 이하 완료 환불만 비교해 paid/partially_refunded/refunded를 계산한다. 원천 주문·환불 금액은 유지한다. |
| T23 | retail_channel은 synthetic_retail_sample이다. distribution_measures는 기존 stockists·target_stockists를 count로 옮기고 CANONICAL-SYNTHETIC-1을 연결한다. shipment와 합산하지 않는다. |
| T25 | 기존 거품·용기·건조감 3개를 측면 코드로 등록한다. definition_version은 CANONICAL-SYNTHETIC-1이다. extractor_version은 고정한 D005 가상 주석 생성 코드의 버전·SHA로 정의하며 실제 LLM·사람 검토로 해석하지 않는다. aggregate 기간은 참조 리뷰 작성일의 현지 최소 날짜~최대 날짜 다음날이다. sentiment는 제품·측면·참조 리뷰가 일치하는 기존 annotation의 유일 감성만 재사용한다. 일치 주석 수가 mention_count와 다르면 생성하지 않고 실패한다. assessment_status는 provided다. |
| T26 | channel은 synthetic_support, subject는 기존 message_text, status는 새 가상 상태 synthetic_open으로 정의한다. confirmed/unlinked와 주문 연결은 보존한다. |
| T27 | platform은 ‘모의 동영상’, channel_ref는 국가별 가상 콘텐츠 채널 하나다. 실제 계정으로 표시하거나 누적 조회 snapshot을 합산하지 않는다. |
| T29 | creator_ref는 국가별 가상 협업자 하나, product_refs는 기존 P1A·P1B다. planned_period는 연결 콘텐츠 최소 발행일~최대 발행일 다음날, message_brief는 ‘가상 샴푸 사용 안내 협업’으로 새로 정한다. 비용은 유지한다. |
| T30 | cohort period는 2026-08-03~2026-08-11 미포함의 가상 관측창으로 정하고 기존 연결 주문·완료 환불의 포함 범위를 재검산한다. B2B deal_amount 3건은 새 가정으로 KRW 100000 / JPY 10000 / USD 100을 부여하며 B2C 순액과 분리한다. |
| T31 | unique_clicks를 발송 내 수신자 단위 중복 제거 수로 해석하는 가상 정의를 확인받은 뒤 같은 값을 unique_clickers로 옮긴다. sent_at은 각 시간대 2026-08-02 12시, period는 2026-08-02~2026-08-13 미포함으로 새로 정한다. linked_orders를 인과적 이메일 매출로 해석하지 않는다. |
| T32 | measure_definition은 원문 question_text에 대한 긍정/그 외 응답의 표본 집계다. cohort_ref는 study_id·subject_ref·period 조합이다. measures는 기존 positive_responses와 sample_size의 count·ratio로 구성하며 분모 0은 보류한다. CANONICAL-SYNTHETIC-1에 연결한다. |
| T33 | item_code는 synthetic_index, definition은 실제 통계가 아닌 가상 지역별 공표 지수다. seasonal_adjustment는 not_provided로 두고 보정값은 만들지 않는다. revision·발표일·확보시각은 유지한다. |
| T34 | weather measures는 기존 temperature(℃)·precipitation(mm)를 보존하고 CANONICAL-SYNTHETIC-1에 연결한다. calendar_kind는 operational_schedule로 정의하고 is_public_holiday=false의 의미를 보존한다. |
| T37 | 기존 lcp_p75의 28일 창·p75·ms 정의를 CANONICAL-SYNTHETIC-1에 등록한다. 관측값·단위는 유지한다. |
| T38 | hypothesis_text는 가상 모집단에서 treatment의 전환율이 control보다 높다는 검증 가설이다. assignment_method는 synthetic_random_assignment, assignment_unit은 synthetic_participant, treatment_description은 ‘모의 안내문 변경’으로 정한다. 기간 종료·확보시각을 확인해 status=completed로 기록하며 반례도 보존한다. |
| T39 | model_version은 CANONICAL-SYNTHETIC-1, objective는 maximize_synthetic_conversions다. expected_measures는 기존 predicted_conversions(count)에 같은 정의 버전을 연결한다. 학습 완료나 실제 광고 효과로 표시하지 않는다. |
| T40 | version은 CANONICAL-SYNTHETIC-1, objective는 ‘가상 전환수 비교’, product_refs는 P1A, allowed_channels는 search·social이다. change_constraints에는 총예산 한도·기존 모형의 채널 상하한·통화/기간 일치·proposed 실행 금지를 명시한다. 실제 집행 승인으로 확대하지 않는다. |

## 검산과 승인 범위

신규 식별자는 위 규칙의 코드 정의로 등록하고 참조가 해소되지 않으면 통과시키지 않는다. 개별 고객·리뷰·주문·실험 관측행은 추가 생성하지 않는다. 보완 파일의 실제 바이트 SHA-256·원천 입력 hash·승인된 레코드/필드 수를 고정한 뒤 로드한다. 재검산에서 기존 값과 모순되면 해당 항목은 실패로 남기고 임의로 원천을 고치지 않는다.

승인 대상은 **330행·816개 필드 설정 규칙과 T31 수신자 중복 제거 해석**이다. 이는 일반적인 계획 실행 승인과 구분한다. 대상 유형별로 수정하거나 일부만 승인할 수도 있다.

## OOPS 검토

[개별 검토표](oops-review-20261016.json)는 P04 2개, P11 79개, P13-N 24개, P13-S 1개의 대상 URI와 SHACL 근거를 보존한다. 실제 오류·비적용 후보·설계 판단을 구분하며 예외를 승인 완료로 처리하지 않는다. P11을 없애기 위한 전역 domain/range 일괄 추가와 supersedes 대칭성 추가는 제안하지 않는다.

이 문서는 보완 제안이다. 최종 실행 수치와 보존 여부는 별도 통합 실행 보고서를 기준으로 한다.
