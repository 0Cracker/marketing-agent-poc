# 업무 의미 확인표 — D006 및 기존30종

최신 범위: 실제 공급자 필드 확인·실제 자료 적합성 검증은 사용자 지시로 프로젝트 범위 밖이다. 아래 표에서 확인할 업무 의미는 승인된 가상 데이터의 필드·집계·해석에 한정한다. 기존 공급자 미검증 기록을 확인 대기나 완료 조건으로 집계하지 않는다.

2026-10-16 후속. 사용자 ②③ A안으로 T10/T11 구분과 리뷰 측면·원문·별점·판매처·표본/수집창의 업무 정의를 확인했다. ④는 가상 반올림 적용으로 확정했다. [결정 원문](meaning-decisions-20261016.json)과 [구조 비교·처리 상태](structure-decision-20261016.md)를 따른다. 정의 동의를 개별 주석의 사람 검토나 기존30종 전체 필드 확인 완료로 확대하지 않는다. 별도 외부 전문가 검토는 수행하지 않았다.

## 우선 확인할 의미

| 항목 | 제안 해석 | 금지할 해석 | 확인 상태 |
| --- | --- | --- | --- |
| CQ17-3 T10/T11 | T10은 공개 경쟁 광고, T11은 기사·공식 발표·사건. 신제품은 T11의 대상 연결·발행/사건 근거가 있을 때만 설명 | T10을 신제품 자료로 지칭하거나 기사 존재만으로 실제 출시·효과 확정 | ②A 정의 확인 완료 |
| 리뷰 측면 | 향/거품/건조감 등 명시한 측면의 원문 발췌와 provided 주석 | 별점으로 본문 감성 확정, 측면 하나를 전체 품질 판단으로 확대 | ③A 정의 확인 완료·개별 주석 검토 별도 |
| 원문 span | 부모 리뷰·제품·국가·확보시각이 맞는 Unicode 코드포인트 [start,end)의 exact quote | 다른 리뷰 원문 연결, UTF-16 offset 혼용, 사람이 검토했다는 자동 표시 | ③A 정의 확인 완료 |
| CQ15 지표 | 5점 중1~2점/유효 별점 고유 리뷰. 3점 제외, null 분모 제외·제외수 표시 | 부정 감성 비율·시장 불만율·품질 악화와 동일시 | 지표 선택 완료·③A 정의 확인 완료 |
| 판매처/표본 | 명시적 seller ID, 제품·국가·작성창·선정방식·수집실행이 맞는 표본 | 플랫폼명과 판매자 혼동, 기존 미상 판매처 소급 추정 | ③A 정의 확인 완료 |
| 수집창/작성창 | 리뷰 작성 대상 기간과 실제 수집·확보 시각은 별도. 계획8건 모두 수신해도 시장 전수는 아님 | 광고 수집로그를 리뷰 완전성에 사용, 계획 충족을 시장 완전성으로 표시 | ③A 정의 확인 완료 |
| 구성 변화 | 판매처별 낮은 별점 비율0%/100% 유지, 표본 비중 변경으로 전체20%→80%; 동일가중50% 유지 | 제품 품질 악화의 인과 증명 | ③A 정의 확인 완료 |
| DST 개정 | CQ06-2/CQ23-2만 실제2025-11-02/2026-03-08 경계 허용, 기본asOf 유지 | 8월 가짜 DST 생성, 다른 질문의 기간 무제한 확대 | 기간 선택 완료·업무 해석 확인 대기 |
| 금액/할인 | micros/decimal 원값·정확 계산·종료 경계 보존. 가상 HALF_UP 최소단위 규칙으로1110.6JPY→1111JPY | 가상 규칙을 실제 판매처 결제 정책이라고 표시 | ④ 가상 정책 적용 승인 완료 |

## 기존30종의 설계·코드 대조와 현업 확인

[기계 대조표](design-code-audit-20261016.json)는 유형별 required/optional/분기 스키마·행 단위·명시 codec·독립 검산 코드의 연결과 hash를 보존한다. 아래 표는 현업 확인용이다. 모의 스키마/코드 검사 통과를 공급자 실제 필드 의미 확정으로 올리지 않는다. 실제 공급자 매핑·실제 데이터 적합성은 전 유형 미검증이다.

| 유형 | 행 단위·의미 및 집계 제한 | 원래 질문 연결 시 제한 | 현업 확인 |
| --- | --- | --- | --- |
| T02 | 원천코드→Variant, confirmed/candidate와 유효구간 구분; 명칭 유사성 확정 금지 | 확정 코드표가 국가 간 상품·가격 비교 가능성까지 보장하지 않음 | 사용자 확인 대기 |
| T04 | 기간·패널·대상별 표본/응답수, 분모 동일 범위에서 비율 | 표본을 시장 전체로 확대하지 않음 | 사용자 확인 대기 |
| T05 | query/정규화창별 0–100 지수 | 서로 다른 창 합산·비교 금지 | 사용자 확인 대기 |
| T06 | 키워드·언어·기간별 추정 검색수, 입찰 금액·통화/상하한 | 실제 캠페인 비용이나 확정 수요 아님 | 사용자 확인 대기 |
| T07 | site/page/query/device/기간별 노출·클릭·평균순위; null query 보존 | 평균순위 단순합/평균·비공개 query 추정 금지 | 사용자 확인 대기 |
| T10 | 공개 광고별 advertiser와 관측/최초/최종 발견 시각 | 원래 CQ17-3 문구의 뒤바뀐 유형을 개정 sidecar로 정정 | 유형 구분 확정·개별 필드 확인 대기 |
| T11 | 문서·발행·사건 시각·대상·중복 그룹 | 원래 CQ17-3 문구의 뒤바뀐 유형을 개정 sidecar로 정정 | 유형 구분 확정·개별 필드 확인 대기 |
| T14 | campaign/부모행/기간/device별 분할 지표; 부모 합계와 대사 | 부모 baseline과 다시 합산하지 않음 | 사용자 확인 대기 |
| T15 | 캠페인·경쟁 도메인·기간별 경매 비율, 분모 미제공 | 비율 단순평균·합산 금지 | 사용자 확인 대기 |
| T16 | creative/version·campaign·product·유효기간 | 콘텐츠 버전과 집행 성과 인과를 구분 | 사용자 확인 대기 |
| T17 | event/session/site/page·동의 상태 | D005 동의 사건을 원래 캠페인의 수집누락 원인으로 연결하지 않음 | 사용자 확인 대기 |
| T18 | event+item_index 상품행, 거래·환불·Variant·Session 연결 | event수/행수/수량 구분; null 세션 추정 연결 금지 | 사용자 확인 대기 |
| T19 | order+line별 수량×단가−할인+세금, 거래·Variant·상태확보시각 | D005 주문으로 D003B H01의 주문을 복원하지 않음 | 사용자 확인 대기 |
| T20 | 주문행별 완료환불/보류취소, 완료시각·금액·수량 | 완료만 차감, 웹 refund와 이중차감 금지, 재입고 null 유지 | 사용자 확인 대기 |
| T21 | Variant·유효구간별 단위원가/통화·회계기준 | 원가기간 중첩 거부, 재입고 미확인 범위 유지 | 사용자 확인 대기 |
| T23 | 유통 대상/보유처 수 또는 주문 배송 상태/시각 | 유통 표본과 shipment를 합산하지 않음 | 사용자 확인 대기 |
| T25 | Review/Product·측면·감성·exact span 또는 표본 집계 | 현재 거품/용기/건조감 주석으로 CQ14-1/4의 향 조건을 대체하지 않음 | 사용자 확인 대기 |
| T26 | 티켓·작성시각·메시지·confirmed/unlinked 주문 | 미연결 주문 추정 금지, 사유는 주장으로 유지 | 사용자 확인 대기 |
| T27 | 콘텐츠·발행/관측시각별 누적조회수 | 누적 snapshot 합산 금지 | 사용자 확인 대기 |
| T28 | 댓글·콘텐츠·부모댓글 관계·작성시각 | 다른 콘텐츠 부모 연결 거부, 원문=인구 전체 의견 아님 | 사용자 확인 대기 |
| T29 | 협업·계약상태·관련 콘텐츠·비용/통화 | 계약 비용과 성과/인과 구분 | 사용자 확인 대기 |
| T30 | 명시 고객집합/주문 기반 cohort 표본·재구매율/순액, B2B 기회 별도 | cohort 중복 unique 합산·B2B 혼합 금지 | 사용자 확인 대기 |
| T31 | CRM cohort·발송/반송/유일클릭/수신거부·명시 주문 | 도달 분모 확인, open 미수집 보존 | 사용자 확인 대기 |
| T32 | 연구·대상·문항/응답척도·기간·표본수/긍정수 | 편의표본, 문항/분모 다른 비율 비교 금지 | 사용자 확인 대기 |
| T33 | 통계표·지역·기간·단위·revision/발행·supersedes | asOf 접근 가능한 최신판 하나, 타국 정정 연결 거부 | 사용자 확인 대기 |
| T34 | 기상 관측소·기간·℃/mm 또는 일정 | 일정과 기상 분리, 겹치는 기간 강제 합산 금지 | 사용자 확인 대기 |
| T37 | page/device·28일 창 p75 LCP(ms) 또는 장애 시작/종료 | 겹치는 p75 합산·평균 금지, 장애와 성과 인과 구분 | 사용자 확인 대기 |
| T38 | 별도 실험/arm별 표본·전환·기간 | 모의 실험의 별도 모집단이며 실제 광고 효과 입증 아님 | 사용자 확인 대기 |
| T39 | 미학습 모형 가정·예산 후보·상하한·정책·예측 | 통화·기간·예산합 검산, 예측과 관측을 분리 | 사용자 확인 대기 |
| T40 | 정책·proposed/approved·예산·기간·KPI/승인역할 | proposed 실행 불가, 모의 승인과 실제 집행 승인 구분 | 사용자 확인 대기 |

검토자는 항목별 동의/수정사항과 근거를 남긴다. 단순 데이터 생성 승인이나 전체 계획 실행 요청으로 위 확인 상태를 완료로 바꾸지 않는다. field-semantics.json의 미확정 개별 필드/공급자 상태도 일괄 확정하지 않는다.

## 필드 사전과 D005 선언의 미해결 차이

아래는 이름/선언 수준의 대조 결과다. 모두 자료 누락이라고 단정하지 않는다. 명시적 별칭, 하위 유형 적용 여부, 미구현 필드를 확인해야 하며 자동 이름 유추나 임의 기본값으로 해결하지 않는다. 이 표를 남김으로써 대조 작업은 수행했지만 전체 필드 계약 일치가 완료됐다고 표시하지 않는다. 예를 들어 T25의 `aspect`/`product_ref`와 사전의 `aspect_ref`/`subject_ref`는 등록된 의미 매핑이 필요한 차이다. `definition_version`은 D005 payload에 선언되지 않았다. 조건부 설명문(예: annotation의 extractor_version 필수)도 스키마 속성 표와 별도로 확인해야 한다.

| 유형 | 사전 필수 이름 중 D005에 같은 이름이 없는 항목 | 조건부 이름 중 같은 이름이 없는 항목 |
| --- | --- | --- |
| T02 | entity_type, valid_from | language |
| T04 | cohort_id, measures | — |
| T05 | term_ref, term_kind, index_definition | — |
| T06 | geo_target_ref, network_scope | — |
| T07 | search_type, aggregation_scope | — |
| T10 | served_regions, coverage_text | media_ref |
| T11 | language, title | — |
| T14 | breakdown_dimensions, report_definition_ref, audience_basis | — |
| T15 | report_surface, threshold_status | — |
| T16 | language, valid_from | media_ref, annotation_evidence |
| T19 | seller_ref, customer_pseudo_ref, financial_status | — |
| T23 | — | retail_channel |
| T25 | subject_ref, aspect_ref, definition_version | period |
| T26 | channel, subject, status | — |
| T27 | platform, channel_ref, language | — |
| T28 | language | — |
| T29 | creator_ref, product_refs, planned_period, message_brief | fee |
| T30 | — | period, deal_id, deal_amount |
| T31 | segment_ref, sent_at, period, unique_clickers | — |
| T32 | measure_definition, cohort_ref, measures | — |
| T33 | item_code, definition, seasonal_adjustment | — |
| T34 | region_ref | measures, event_name, calendar_kind |
| T38 | hypothesis_text, assignment_method, assignment_unit, treatment_description, status | — |
| T39 | model_version, objective, assumptions, validity_scope | training_period, parameters, scenario_id_ref, expected_measures |
| T40 | version, objective, kpi_definition_refs, product_refs, budget_limit, allowed_channels, change_constraints, policy_status | — |

기존 D005 원천/manifest/승인 스키마를 소급 수정하지 않았다. ①A 선택 후 [원천→사전 검사기](check-d005-dictionary.mjs)를 구현했고 [실제 실행](runs/2026-10-16-cq52-decisions-1-dictionary.json)에서30종528행을 검사했다. T02 별칭/유효기간, T25 제품 대상, T40 예산/모의 승인 상태/단일 KPI 참조를 명시적으로 변환한다. T16 날짜→날짜·시각, T31 유일 클릭→유일 클릭자, T25 문자열→측면 참조는 근거가 부족해 보류한다. 공통 provenance/temporal/quality 구조와 유형별 필수·조건부·형식 차이를 누락/불일치로 기록하며 전체 적합은0행이다. 이는 공통 계약의 미충족 상태이며 기존 원천 규격528행 적합과 구분한다. 현재52시험 통과를 전역 필드 계약 완료로 올리지 않는다.
