# 데이터 제안·승인 기록

## 2026-10-20 · 주문 변경에 따른 구매 이벤트 오류 수정

‘일별 상품 구매 수량’에 이전 패턴이 남았다는 사용자 지적에 따라, 앞서 변경한 주문과 연결 구매·환불 이벤트의 수량·시각 불일치를 수정했다. T18 1,507행을 기존 T19·T20 부모 값에서 그대로 파생했다. 새 분포·행·스키마를 생성하지 않았으며 기존 자료 오류 수정 범위다. 원본·참조를 보존하고 현재 manifest·provenance를 갱신했다. [수량·시각·일별 그래프 검증](../../../evidence/purchase-event-sync-20261020/checks.json)을 수행했다.

## 2026-10-20 · 주문 시연값과 일별 추세 변경

사용자가 한국·미국·일본 제품의 주문 수량과 흐름을 모두 다르게 수정하도록 직접 요청했다. 기존 가상 주문의 수량·일별 분포와 연결 금액·시각을 변경하는 근거로 적용했다. AI가 선택한 구체적 분포를 사용자가 개별 검토했다고 기록하지 않는다. 주문 1,501행, 연결 환불 시각 9행·배송 시각 72행·고객군 순매출 204행을 변경했다. 신규 행·스키마 변경은 0이며 다른 달의 상세는 생성하지 않았다. 보존 원본·재현 규칙·독립 검산·제약은 [결과 기록](../../design/dashboard-trends-20261020.md)을 따른다.

2026-10-16 최신 범위 확정: 사용자 “실제 데이터랑 연결할 필요는 없어. 그렇게까지 안할거야.”에 따라 실제 공급자 연결·샘플·파일럿·실제 자료 적합성 검증을 범위 밖으로 정했다. 아래의 실제 공급자 후속 계획은 철회하며 새 데이터 수집 과제나 완료 조건으로 추가하지 않는다. 기존 가상 데이터 생성/변형의 개별 승인 원칙과 가상 데이터의 사전 적합 검증은 유지한다.
## 2026-10-15 확정 워크벤치용 D003B 재사용

사용자가 확정 상세 명세를 그대로 이어 구현하고 수치 대조·브라우저 검증·보존까지 완료하도록 명시 요청했다. 승인된 기존 D003B 11파일·1,652건을 읽어 화면용 메모리 투영·집계에 재사용했다. 원천 생성·수정·보완, 감성·주제 주석, 예측·예산안·정책·집행 승인 이력은 생성하지 않았다. 없는 유형과 필드는 미생성·원천 미제공으로 표시했다.

원천 관계는 product_id·campaign_id·국가·기간으로 연결하고 통화·grain·커버리지를 분리했다. [수치 검산·원천 보존 근거](../../design/marketing-workbench-acceptance.md)에 해시·건수·결측·시장 분모·광고 계산식·화면 검증 결과를 기록했다. 이번 재사용은 새로운 마케팅 원천 배치나 DB·그래프 적재가 아니다.

## 2026-10-15 대시보드 초안용 기존 데이터 재사용

사용자는 최신 dev의 독립 워크트리에서 기존 가상 데이터를 사용해 도메인별 탭으로 구성한 화면 초안을 여러 개 먼저 보여달라고 요청했다.

이번 범위는 D003B 원천 11종·1,652건을 읽어 세 화면 초안의 표시 필드와 집계에 재사용하는 것이다. 국가·제품·기간·값·리뷰·결측을 원천대로 유지하고 product_id/campaign_id/국가/기간으로 연결한다. 신규 원천·감성 주석·예측·승인 레코드 생성, DB·그래프 적재, D001·D004 구현 승인은 포함하지 않는다. 실제 앱 구현은 시안 선택 후 진행한다.

원본 미수정, LF 기준 해시·건수·가상 표시·결측·분모 검사와 브라우저 표시 검증 결과는 [화면 초안 기록](../../design/dashboard-drafts/README.md)에 남겼다. 화면용 메모리 투영·계산이며 새로운 마케팅 원천 배치가 아니다.

2026-10-14 최신 결정: 사용자 첨부 작업 요청으로 **D003B 원천 11종·1,652건의 생성·검증이 명시 승인**되었다. [실제 배치 보고서](batches/D003B/report.md)에 생성·검증 결과를 기록했다. 모든 국가의 한국어 원문·명칭·설명 규칙을 유지한다. 이전의 언어만 승인/전체 생성 대기 상태는 이번 승인으로 대체되었다.

2026-10-16 데이터 작업 승인 정책 변경: 사용자 지시에 따라 기존 데이터 재사용과 오류 수정은 요청된 작업 범위 내에서 별도 사전 승인 없이 허용한다. 오류 수정은 기존 스키마와 데이터 의미를 유지해야 한다. 스키마 자체의 변경(필드·타입·관계·제약·의미 변경)과 신규 데이터 생성은 사전 제안과 사용자 명시 승인이 필요하다. 예시·테스트·seed용 신규 데이터 및 결측값을 새 값으로 채우는 작업도 신규 데이터 생성에 포함한다. 세부 절차는 [AGENTS.md](../../../AGENTS.md)를 따른다. 아래 과거 승인·보류 기록은 당시 이력으로 보존하며, 기존 데이터 재사용·오류 수정의 사전 승인 요구는 이 정책으로 대체한다.

2026-10-16 후속 선택: [사용자 원문](common-contract/meaning-decisions-20261016.json)으로 ①②③⑤⑥ A안과 ④ 가상 반올림 적용을 확정했다. `SYNTHETIC-HALF-UP-1`은 할인 계산 후 JPY/KRW1·USD0.01 최소단위에서 한 번 사사오입한다. 기존 CQ04-2 자료의1110.6JPY를 가상 결제1111JPY로 계산하며 실제 판매처 정책으로 표시하지 않는다. 추가 원천/보충행/오류JSONL 생성0, 기존 D005/D006 원천·manifest·승인 범위 hash는 보존했다. 정책 산술 경계7개만 별도 검사하고 [통합 회귀](common-contract/runs/2026-10-16-cq52-decisions-1.json)에서 질문52/52를 재확인했다. 전역 사전 부족을 임의 기본값이나 새 원천으로 채우지 않았으며 [구조 결정·남은 차이](common-contract/structure-decision-20261016.md)를 따른다. 실제 공급자 파일럿은 별도 후속이고 OOPS 외부 전송은 특정 payload/목적지 승인 부족이라는 자동 심사 사유로 차단됐다. 아래는 이전 승인 이력이다.

2026-10-15 최신 결정: 사용자의 후속 응답 **‘실행해’**로 D005-2.0.0의 정상534행 생성·오류60케이스 메모리 변형·검증을 승인받았다. **31파일·534행 생성 및 D004를 포함한 배치 검증이 통과**했다([실행 결과](common-contract/runs/2026-10-15-d005-cycle-verified.json), [manifest](batches/D005/manifest.json)). 시스템 전체는 incomplete이며 기존52시험을 pass로 변경하지 않았다.

2026-10-14 당시 결정: 사용자 첨부 작업 요청으로 **D003B 원천 11종·1,652건의 생성·검증이 명시 승인**되었다. [실제 배치 보고서](batches/D003B/report.md)에 생성·검증 결과를 기록했다. 모든 국가의 한국어 원문·명칭·설명 규칙을 유지한다. 이전의 언어만 승인/전체 생성 대기 상태는 이번 승인으로 대체되었다.

2026-10-13 당시 승인된 신규 데이터 묶음은 없었다. 아래 D001과 과거 기록은 당시 미승인 상태를 보존한다. 현재 승인된 신규 묶음은 D003B와 D005-2.0.0이며 D001의 변환·적재 승인으로 확대하지 않는다.

현재 첫 생성 묶음은 [D003B: 원천1,652건](first-batch-proposal.md)이며 승인·생성·검증 완료다. D003A의1,816건+지원 정의102개 제안은 철회했다. 제품·브랜드·홍보 대상은 원천 필드에 정의하고 그래프 적재 시 읽는다. 별도 기준 목록은 생성하지 않았다. 3브랜드·6제품·3국가·한국어·샴푸·기간·수치/사건은 D003B 범위로 승인되었다. D001은 이전 미승인 제안으로 남긴다.

## D001 — 기존 월별 원천만 보존해 첫 그래프 구성

상태: 제안 / 사용자 명시 승인 대기. 목적: Q01–Q03의 비교 범위·상대 변화·산술 기여를 실제 관계 조회로 검증. 새 수치 생성 없이 최소 저장·조회 구조부터 확인한다.

| 항목 | 제안 범위 |
| --- | --- |
| 원천 | 현재 `lib/demo-scenarios.ts`의 A/B/C/E 사례 `history[*].raw`만 읽어 변환. 명칭·맥락은 기존 README/시나리오로 확인 |
| 사례 | A 리뷰 경쟁력 하락, B 경쟁사 급성장, C 광고비 증가·성과 하락, E 측정 문제. 사례는 별개의 가상 상황으로 격리 |
| 국가·카테고리·제품 | 기존 일본·헤어케어·제품 A/B. 제품 A/B를 실제 브랜드로 바꾸지 않음 |
| 기간 | 기존 문서의 2026년 4–9월을 월별 ISO 시작/종료로 변환. 날짜 부여 규칙 자체도 이 제안의 승인 범위 |
| 관측 수 | 4사례 × 6개월 × 2제품 × 4지표 = 192개 후보. 실제 기존 191개 값과 null 1개를 그대로 보존 |
| 지표 | 검색 관심, 긍정 리뷰 건수, 디지털 참여, 광고 노출. raw[0..7]을 순서대로 A/B 쌍으로 매핑 |
| 보조 개체 | Case 4개, Product 8개(사례별 A/B), MarketScope 4개, 원천 지표 정의 4개, 실제 원천 파일 SourceArtifact 1개. 계산 지표 정의는 명세로 관리 |
| 필드 | id·caseId·productId·scopeId·metricId·periodStart/End·value·availability·unit·sourcePath·isSynthetic |
| 관계 | BELONGS_TO_CASE, IN_SCOPE, ABOUT_PRODUCT, MEASURES, SOURCED_FROM. 승인된 원천·맥락만 연결 |
| 식별자 규칙 | 원래 case ID + 제품 위치 + 월 + 지표 위치로 결정적으로 구성. 새로운 브랜드·시장·사건 정보를 추가하지 않음 |
| 출처 | 실제 파일 경로·SHA256·`demoCases[case].history[month].raw[index]` 위치. 가상 뉴스/리뷰 링크를 발명하지 않음 |
| 결측 | E의 기존 null 1개를 결측으로 보존. 계산에 0을 넣거나 보간하지 않음. 사유는 새로 꾸미지 않음 |
| 계산 | 승인 시 동일 원천으로 비중·CTI·기여를 런타임 계산. 기존 가중치 .35/.25/.20/.20 유지, 실제 효과/매출 의미 부여 없음 |
| 활용 | 초기 그래프, 관측 상세, Q01–Q03 답변·검산. 그래프 원천과 화면 수치가 같도록 연결 |
| 생성 방식 | 임의 난수·LLM 데이터 생성 없음. 기존 값 복사와 명시적 구조 변환만 수행 |

월별 날짜는 승인 후 2026년 해당 월 첫날부터 다음 월 첫날 미만으로 저장한다. 날짜는 측정 해상도이며 실제 수집 일시를 새로 만드는 것이 아니다. source file은 실재하지만 그 내용의 마케팅 값은 synthetic임을 구분한다.

### 범위 밖

리뷰 원문·전체 리뷰/평점·광고비/채널/캠페인 상세·사건·원인 가설 레코드·전환/매출·예산 곡선·신규 국가·신규 기간·D/F·실패용 변형 fixture는 D001에 포함하지 않는다. 필요하면 별도 제안한다. 따라서 D001만으로 Q04–Q06이나 Ads 연동을 완성했다고 하지 않는다.

### 승인 후 확인할 정합성

원천 셀과 1:1 대응, 원천 파일 해시·경로 추적, 원래 case/월/제품/지표 일치, null 보존, 기여 합계=CTI 차이, 같은 원천 재적재의 중복 방지, 사례 간 분리. 원천 변경은 새 승인 전 수행하지 않는다.

### 승인 질문

**새 수치는 만들지 않고, 위 A/B/C/E의 기존 월별 원천 192개를 이 구조로 변환·재사용해 그래프를 만들까요?** 승인/수정/보류를 받기 전에는 생성·변환·적재하지 않는다. 제안 내용·범위가 바뀌면 변경점을 다시 보여준다.

## 목표 선택 — D001 승인과 별도

첫 대표 성과 목표는 인지·관심/경쟁 존재감과 전환·매출 중 미확정이다. 추천은 현재 자료를 활용한 경쟁 존재감 진단을 먼저 검증하는 것이다. 전환·매출을 선택하면 필요한 새 필드·값·귀속·가정부터 제안하며 자동 생성하지 않는다. D001 승인 자체가 목표 선택 또는 시뮬레이션 가정 승인으로 간주되지 않는다.

## 승인 기록

| 제안 | 제안일 | 사용자 결정·증거 | 승인 범위 | 실제 생성·검증 |
| --- | --- | --- | --- | --- |
| D001 | 2026-10-13 | 아직 답변 없음 | 없음 | 미실행 |
| D003B | 2026-10-14 | 사용자 첨부 요청: ‘첫 가상 원천 데이터 배치를 생성하고 검증해 주세요’, ‘사용자가 승인한 생성 범위는 아래 D003B 제안’ | 직접 필드 11종·1,652건, 지정 제품/국가/기간/수치/리뷰/사건·검증·기록 갱신. DB/API/Git 변경·추가 기준/테스트 자료 제외 | 1,652건 생성, 검사18개 통과·종료0. [보고서](batches/D003B/report.md) / [해시](batches/D003B/manifest.json) |
| D004-SPEC | 2026-10-14 | 이번 요청은 명세/설계/검사만 승인, 데이터 작업은 명시적으로 제외. 승인 대기 | [구체적 제안](common-contract/validation-proposal.md): 기존214행 재사용→547관측 제안, 두 대표 과제 계산, 신규원천/오류주입/DB적재0. 원문추출/신규주석/52시험 전체는 별도 범위 | 명세만 작성. 실제 재사용·변환·생성·적재0 |
| D005-1.0.0 | 2026-10-15 | 미승인 상태에서 D005-2.0.0으로 대체 | 아래 이전 제안: 신규48행·오류0행 | 신규 생성0·오류 주입0·미실행 |
| D005-2.0.0 | 2026-10-15 | 명시 승인 질문에 사용자가 **‘실행해’**라고 응답: 정상534행 생성·오류60케이스 메모리 변형·명시된 검증 실행 승인 | [현행 제안](#d005-200--30종-신규-자료-생성규격-검증-상세-제안): 정상534행·31파일, 오류60케이스를 메모리에서 독립 변형, 기존 연결36행 및 D004 회귀 | 31파일/534행, 60/60오류 검출·정상 오거부0·독립 oracle/메모리 RDF·경계/재실행·D004 회귀 통과. [검증](common-contract/runs/2026-10-15-d005-cycle-verified.json)·[manifest](batches/D005/manifest.json). 전체 시스템 incomplete |

2026-10-15 D004-SPEC 후속 결정: 사용자가 [제안1.1.0](common-contract/validation-proposal.md)의 **기존214행→547관측 메모리 검사 후 통과 시 전체1,652행→예상4,105관측 확장** 질문에 “두 단계 모두 승인”이라고 명시했다. 원본 수정·영구 RDF/DB 저장·새 원천·오류 주입은 승인 범위가 아니다. 이 결정은 위 2026-10-14 당시 기록을 대체하지 않고 후속 승인으로 기록한다. 실제 실행 결과는 별도 검사 보고서에 기록한다.

후속 D002 데이터 변경 검사, Q04 사건·가설, Q05 상세 리뷰/매체, Q06 시뮬레이션은 필요성만 식별했다. 승인 가능한 완성 제안으로 간주하지 않는다. 각각 구체적인 레코드 수·값/규칙·기간·관계·검증 기준을 작성한 뒤 묻는다.

## 2026-10-13 실제형 자료 조사 요청

사용자가 실제 LLM이 그래프를 탐색할 수 있도록 실제와 유사한 가상 원천을 만들기 전에 데이터 종류·소스·상세 필드를 조사해 달라고 요청했다. [분류](data-landscape.md), [소스](data-source-register.md), [그래프 확장안](graph-data-design.md)을 작성했다.

D001은 여전히 미승인이다. 새 조사 범위를 D001 승인이나 모든 가상 데이터 생성 허가로 해석하지 않는다. 새 데이터 유형·기간·문장·수치·관계·개수가 확정되면 별도의 완성 제안서를 작성한다.

## 미구축 30종 커버리지 — 2026-10-15 대조

기준: D003B manifest의 T01/03/08/09/12/13/22/24/35/36 10종, H01 별도1종. 아래 표는 D005 생성 전 원천0행이던30종의 요구사항이다. **후속 D005 실행으로30종528행과 T01 지원6행을 추가·검증했다. 질문 전체 검증은 미완료다.** 필드명은 [필드 사전](field-dictionary.md)과 [통합 스키마](schemas/marketing-records.schema.json)를 따른다. 공통 필수9항목과 유형별 전체 required/조건부 목록은 재생성된 [의미표](common-contract/field-semantics.json)의 `schema_required_fields/conditional_contract`로 연결한다. 아래 주요 필드는 그 전체 목록을 대체하지 않는다. 당시 미확정이던2~5순위의 수량은 D005-2.0.0에서 제안·승인했다.

| 순위 | 유형·원천 행 단위 | 핵심 필드·관계 | 독립 검산·정상/오류 조건 | 질문 연결 |
| --- | --- | --- | --- | --- |
| 1 | T02 외부 ID 매핑 | external_system/value→entity_ref, country_code, 유효기간, match_status, evidence | namespace+ID+기간 유일; candidate/ambiguous 자동연결0 | CQ01/17/23 |
| 1 | T17 비커머스 이벤트 | event_id/time, site/session/page_ref, consent_state | 이벤트 유일·동의 보존; T18과 이중집계0 | CQ11/12 |
| 1 | T18 커머스 상품 이벤트 | event_id+item_index, event_name, variant_ref, quantity, transaction_ref, measurement_basis | 구매/환불→거래·상품 대사; 구매수와 상품행수 구분 | CQ06/07/12 |
| 1 | T19 주문 상품행 | order_id+line_id, variant/seller_ref, quantity, unit_price, 할인·세금·합계 | 행 산식·주문유일수·세금정의; 주문합계 반복합산0 | CQ05/12/13 |
| 1 | T20 처리 사건 | adjustment_kind, order/line_ref, requested/processed_at, quantity, refund_amount, status | 완료환불만 순액 차감; pending·취소 중복차감0 | CQ12/13 |
| 1 | T37 성능 창/장애 사건 | record_kind, page/device, period+measures 또는 incident_start+status | rolling 중첩 합산0; 종료 제외·복구시각 구분 | CQ06/11 |
| 2 | T21 SKU 비용 기간 | variant_ref, period, unit_cost, margin_definition, accounting_basis | 통화/기간별 원가 대사; 미확인 원가 이익계산 보류 | CQ13 |
| 2 | T23 배송/유통 | record_kind, 주문/행 연결, 배송/도착 또는 유통범위 | 유형별 조건부 충족; 배송시각·기간 혼합 탐지 | CQ12/13 |
| 2 | T25 리뷰 측면/집계 | record_kind, subject/aspect_ref, sentiment, definition_version, assessment_status, 원문 근거 | exact span/offset; 주석·집계·모집단 분리 | CQ14/15 |
| 2 | T26 CS 티켓 | ticket_id, created_at, channel, subject/message_text, status/link_status | 주문/제품 연결 근거; 미연결을 이름으로 보완0 | CQ14/18 |
| 3 | T04 패널×cohort×기간 | panel/cohort/subject_ref, sample_size, weighting_method, measures | 표본/가중 합 독립 계산; 시장전체 확대0 | CQ01/02/19 |
| 3 | T05 검색지수 | query_id, term_ref/kind, index_definition, normalization_scope, search_surface | 정규화 창별 최대·단위; 다른 창 단순합산0 | CQ03 |
| 3 | T06 키워드×지역×기간 | keyword, language, geo_target_ref, estimated_searches, competition_level, network_scope | 근사량·입찰단위 보존; 실제 클릭으로 치환0 | CQ03 |
| 3 | T07 자연검색 차원×기간 | site/page_ref, query, device, search_type, clicks/impressions, aggregation_scope | CTR 합분자/분모; 숨김 query/null을0으로 변경0 | CQ03/07 |
| 3 | T10 공개 광고 관측 | advertiser_ref, public_ad_id, observed_at, creative_text, served_regions, coverage_text | 관측ID/국가·비텍스트 media 조건; 비공개 지출 생성0 | CQ17 |
| 3 | T11 문서·명시사건 | document_id, publisher, published_at, body_text, subject_refs, event_time | 게시/발생/확보 분리·중복군; 주장→사실 승격0 | CQ17 |
| 3 | T32 설문 결과 | study_id, question_text, measure_definition, cohort_ref, sample_size, response_scale, measures | 표본/척도·가중 계산; 편의표본 전체효과 확대0 | CQ19/22 |
| 3 | T33 공표 통계 셀 | statistics_table_id/item_code, region_ref, period, value/unit/definition, published_at, seasonal_adjustment | 공표판·단위·지역 일치; 원계열/계절조정 혼합0 | CQ01/22 |
| 3 | T34 기상/휴일/시즌 | record_kind, region_ref, period, 하위 유형별 값 | 지역·달력·관측/예보 구분; 판매원인 정답관계0 | CQ22 |
| 4 | T14 광고 segment | campaign_ref, period, breakdown_dimensions, report_definition_ref, metrics, audience_basis | 비중복 분할에서만 합계; 중첩 세그먼트 합산0 | CQ08/09 |
| 4 | T15 경매 보고 | campaign_ref, competitor_domain, period, report_surface, impression_share, threshold_status | 분모/억제 보존; 점유율로 경쟁 지출 역산0 | CQ10/17 |
| 4 | T16 소재 버전 | creative_id/version, product_refs, format/language/message_text, valid_from | 유효기간/미디어 조건·버전 연결; 문구변화 효과확정0 | CQ08/09 |
| 4 | T27 콘텐츠 누적 관측 | content_id/platform/channel_ref, published/observed_at, title/description_text, view_count | 같은 콘텐츠 시점별 누적; snapshot 합산0 | CQ16/20 |
| 4 | T28 댓글 | comment_id, content_ref, written_at, body_text/language | 댓글→게시물 참조·원문; 중복 언급 탐지 | CQ16/20 |
| 4 | T29 협업 | collaboration_id, creator/product_refs, planned_period, message_brief, agreement_status | 계획·승인·게시물 계보; 예정집행을 실적에 합산0 | CQ20 |
| 4 | T30 코호트/기회 | record_kind, 하위 유형별 cohort 또는 opportunity 필드 | 가명키/분모·업무상태; 사람수와 기회수 혼합0 | CQ18/21 |
| 4 | T31 CRM 캠페인 | crm_campaign_id, segment_ref, sent_at/period, emails_sent/bounces/unique_clickers/unsubscribes, open_measurement_basis | 유일클릭 분모·오픈 측정한계; 캠페인 간 unique합산0 | CQ21 |
| 5 | T38 실험 arm/판 | experiment_id/arm_id, period, assignment_method/unit, treatment_description, sample_size, status | arm 모집단/관측기간·결과판; 관측차를 무작위 효과로 승격0 | CQ24/25 |
| 5 | T39 모형/예산 후보 | record_kind, model_ref/version, objective, assumptions, validity_scope | 입력/제약·단위·버전 재계산; 예측/실적 분리 | CQ26/27 |
| 5 | T40 정책 판 | policy_id/version, period, objective, kpi_definition_refs, product_refs, budget_limit, allowed_channels, approval_role, change_constraints, policy_status | 승인판·적용기간·예산제약; 초안을 승인으로 사용0 | CQ28/29 |

기존10종의 잔여 분기: T01 별도 Variant/Category ID와 변경판, T03 범위/통화/분모 충돌, T08 세금·배송 unknown/표시가격 sentinel, T09 금액·bundle·coupon·shipping·other, T12/13 계정·귀속 설정의 유효기간/정정판, T22 snapshot 공백, T24 판매처·표본/발췌, T35 변경판/대상, T36 불일치/중복 로그. 모두 별도 신규 자료/오류 주입을 승인받아야 하며 D005에서 완료하지 않는다. H01은 주문 복원에 사용하지 않는다.

## D005 — 1순위 격리 가상 배치 제안 (승인 대기)

이 절은 **미실행 이전 제안 D005-1.0.0**의 이력이다. 현재 수량·규칙·승인 대상은 아래 D005-2.0.0으로 대체하며, 이 절의48행과 중복 생성하지 않는다.

**제안 D005-1.0.0: 신규48행, 오류 주입0행, 생성 미실행.** D004214/1,652행 재검증 승인은 유지한다. 아래48행 생성·검증만 별도 승인 대상으로 제시한다. 기존 D003B와 다른 `scenario_id=D005-JP-commerce`에서 일본·샴푸 자사2변형·JPY·Asia/Tokyo·[2026-08-03,2026-08-11) 표본을 만든다. D003B P1A/H01과 합산·보정·역산하지 않는다. 새 제품/변형/브랜드/카테고리 식별을 위한 T01 지원2행을 수량에 포함했다. 다른 국가·경쟁 주문·외부 API·인과/감성/원문 주석·오류/반대 근거 레코드는 생성하지 않는다.

### 정확한 수량·ID·필드

레코드는 `D005-{T유형}-{0001부터 연속4자리}`로 고정한다. 다음은 레코드 파일이 아닌 생성 규칙이다. 실제 파일은 승인 후 `batches/D005/source` 아래 유형별 UTF-8 JSONL7개로 만든다. 공통9필수항목(`record_id,dataset_type,scope_id,scenario_id,is_synthetic,value_origin,provenance,quality,temporal`)은 모두 채우고, `related_record_ids`는 확인된 참조에만 사용한다. 세부 필드의 필수/조건부는 기존 스키마 전체를 충족한다. 아래에서 지정하지 않은 선택 필드는 생성하지 않는다.

| 유형 | 행수·레코드 접미부 | 생성 필드·내용 규칙 |
| --- | --- | --- |
| T01 지원 | 2·0001–0002 | product_id=D005-P1/P2, variant_id=D005-V1/V2, brand_id=D005-B1, category_id=D005-C1, sku=D005-SKU1/2, name=가상 샴푸1/2, valid_from=2026-08-03, status=active, pack_quantity=300 ml. 별도 브랜드/카테고리 행은 없으며 명시 ID를 메모리 개체로 표현 |
| T02 | 6·0001–0006 | A/B/C 순서×V1/V2. mapping_kind=external_id, entity_type=variant, entity_ref=V1/V2, external_system=D005-A/B/C, external_value={A/B/C}-SKU{1/2}, country_code=JP, match_status=confirmed, valid_from=2026-08-03, valid_to_exclusive=2026-08-11. evidence는 T01 해당행의 $.sku exact span; 명칭 유사성이 아닌 이 승인된 교차코드표가 매핑 근거 |
| T17 | 8·0001–0008 | 1–6은 S1–S6 page_view; 7–8은 S4/S6 consent_update. event_id=D005-G001..008, event_time 아래 시간표, site_ref=D005-SITE, session_ref=D005-S1..S6, page_ref=D005-PAGE, device=mobile, consent_state=S4/S6 denied·나머지 granted. 선택 사람ID/광고click ID/캠페인 필드 없음 |
| T18 | 20·0001–0020 | 1–12 비구매 단계, 13–18 구매6상품행, 19–20 완료환불2상품행. event_id/item_index/event_time/event_name/variant_ref/quantity/session_ref/measurement_basis, 금액이 있는 구매·환불의 unit_price, 구매·환불의 transaction_ref 필수. campaign_ref 없음. 구매는 주문과 달리 상품행 단위; 환불은 처리시각 이후 별도 사건 |
| T19 | 6·0001–0006 | O1 L1/L2, O2 L1, O3 L1/L2, O4 L1 순서. order_id=D005-O1..O4, line_id=L1/L2, variant_ref 아래 표, seller_ref=D005-SELLER, ordered_at, customer_pseudo_ref=D005-B-C1..C4(판매자 범위), quantity, unit_price, line_discount, line_tax, line_gross_total, financial_status=paid, fulfilment_status=fulfilled, transaction_ref=D005-X1..X4. acquisition_ref 없음; 분석 사람키와 연결0 |
| T20 | 3·0001–0003 | adjustment_id=D005-R1/R2/C1. R1=O1/L1 refund완료1개950 JPY, R2=O3/L2 refund완료1개1500 JPY, C1=O4/L1 cancel요청 pending1개. order_ref/order_line_ref, requested_at, quantity, reason_code=unknown, status 필수. R1/R2만 processed_at/refund_amount; pending은 두 필드 생략. restocked=null(미확인), 사유 설명/추정 없음 |
| T37 | 3·0001–0003 | 1–2 performance: page_ref=D005-PAGE, device=mobile, period=[2026-07-07,08-04),[07-08,08-05) 각28일, measures=각 p75 LCP 2500/2600 ms, metric_id=D005-lcp-p75, definition_version=1.0.0, availability=available. 3 incident: 동일 page/device, incident_start=08-05 11:00+09:00, incident_end=11:20, status=resolved, error_text=가상 접속 오류. release_ref 없음 |
| 합계 | **48** | 지원2+미구축6종46; 원천 A/B/C는 아래 필드 별칭을 같은 행 안에 보존하며 복제행을 추가하지 않음 |

시간·공통값: T01/02는 validity, T17/18/19/20·장애는 instant, 성능은 rolling; temporal은 source_grain=instant 또는 성능custom, series_role=detail, calendar_id=gregorian, reporting_timezone=Asia/Tokyo, coverage_kind=sample, revision=0. available_at은 이벤트/주문/요청/완료/장애복구시각+1시간, 성능은 창 종료일01시, T01/02는08-03 00시로 고정한다. quality.availability=available, coverage=D005 격리 표본, is_partial=true. is_synthetic=true, value_origin=simulation. scope_id=D005-JP-shampoo. provenance는 system=D005-A/B/C(마스터는D005-master), collection_method=synthetic_generation, source_record_key=record_id, artifact_ref=실제 유형파일 상대경로, access_class=internal, documentation_refs=본 제안 상대경로를 기록한다. seed=500520261015를 manifest에 고정하되 난수 없이 순번·표·산식으로 생성한다. 원문은 위 한국어 문구만 사용하고 실제 공급자 URL/응답을 꾸미지 않는다.

### 사건 순서·정확 금액·관계

O1/O2/O3/O4는 각각08-03/04/05/06 12:00(+09:00)에 주문하고 구매 이벤트는12:01에 기록한다. 거래키는 각각 X1..X4이며 주문/웹 양쪽에 명시한다. 구매 이벤트6행은 O1 2행(event_id=D005-PUR1,item_index=0/1), O2 1행(PUR2,0), O3 2행(PUR3,0/1), O4 1행(PUR4,0)이다. 구매 세션은 각각 S1/S2/S3/null이며 O4를 S4로 추정 연결하지 않는다. 비구매 단계는 S1 view/add/checkout, S2 view/add, S3 view/checkout, S4 checkout, S5 view/add/checkout, S6 view의 **12행**이다. S1–S6 날짜는08-03..08, page_view=11:50, 단계는 나열 순서대로11:51/52/53, consent_update는 S4/S6 11:49다. 단계의 대상은 V1, quantity=1, 가격 없음; 구매/환불은 실제 표본 주문행 대사값을 사용한다. 비구매 event_id=D005-F001..012는 서로 다르고 item_index=0이다. 구매가 모든 단계를 거치거나 모든 세션이 구매하도록 만들지 않는다.

| 주문행 | 변형 | 수량 | 원단가 JPY | 행할인 | 세금 | 행합계 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| O1/L1 | V1 | 2 | 1000.00 | 100.00 | 0.00 | 1900.00 |
| O1/L2 | V2 | 1 | 1500.00 | 0.00 | 0.00 | 1500.00 |
| O2/L1 | V1 | 1 | 1000.00 | 0.00 | 0.00 | 1000.00 |
| O3/L1 | V1 | 1 | 1000.00 | 0.00 | 0.00 | 1000.00 |
| O3/L2 | V2 | 2 | 1500.00 | 0.00 | 0.00 | 3000.00 |
| O4/L1 | V2 | 1 | 1500.00 | 0.00 | 0.00 | 1500.00 |

정의: `line_gross_total=quantity×unit_price-line_discount+line_tax`. 세전 금액에 세금0을 더하는 모의 계약이다. 모든 Money는 JPY·소수2자리 문자열이고 소수부는00이며 반올림이 필요 없다. T18 구매의 unit_price는 행할인 후 단가(950/1500/1000/1000/1500/1500), T19의 unit_price는 할인 전 단가로 서로 다른 정의를 보존한다.

R1은08-08 12:00 요청→13:00 완료, R2는08-09 같은 시각, C1은08-10 12:00 요청만 있다. T18 refund는 R1/R2의13:01, event_id=D005-REF1/2, item_index=0, 원거래 X1/X3, V1/V2, quantity=1, unit_price=950/1500, session_ref=null이다. R1/R2의 order_line_ref는 T19 record_id, order_ref는 O1/O3이다. 처리 사건과 계측 refund가 같은 환불을 이중 차감하지 않도록 거래+원행+수량+금액으로 검산한다. 순매출은 주문 코호트에서 완료환불을 빼는 방식이며 현금수지나 광고 귀속매출과 구분한다.

### 모의 원천 A/B/C → 공통 필드 → 개념

세 프로필은 실제 공급자 API가 아닌 D005 전용이다. 기존 통합 스키마는7종 모두 `additionalProperties=false`이므로 공통규격 행에 source_payload를 붙이지 않는다. D005 전용 원천스키마에서 동일 행의 `source_payload` 객체에 별칭/원문 lexical을 보존하고, 기존 통합규격에 맞는 투영은 메모리에서 별도 검증한다. 원천행은48로 유지하며 추가 레코드/별도 payload 파일은 만들지 않는다. T01/02는 canonical 필드를 가진 지원 원천, T17/18/19/20/37은 canonical 필드와 아래 별칭 payload를 함께 가진 원천으로 정의하고 양쪽 일치를 검사한다.

| 원천·대상 | 원천 필드 | 공통 필드/관계·단위 |
| --- | --- | --- |
| A 분석(T17/18) | evtId, occurredAt, sid, skuCode, txn, priceMajor | event_id/time/session_ref, T02의 A-SKU→variant_ref, transaction_ref, unit_price.amount(JPY 주요단위). 없는 txn/price는 생략; sid 미수집은null |
| B 판매(T19/20) | orderNo, itemNo, skuCode, txnNo, amountMinor, ccy, state | order_id/line_id, B-SKU→variant_ref, transaction_ref, 행총액 또는 refund_amount. JPY minor=major이므로 배율1; 원단가/할인/세금도 동일 표에서 파생·보존 |
| C 운영(T37) | urlKey, deviceClass, windowStart/End, lcpSeconds, openedAt/closedAt | page/device, period, LCP seconds 2.5/2.6→2500/2600 ms; 장애 timestamp는 별도. C-SKU 매핑2행은 ID해결 검사에만 사용, 성능→제품 영향관계는 생성0 |

payload 값은 각 canonical 값의 결정적 별칭이다. A는 evtId/occurredAt/sid를 항상 보존하고 T18만 skuCode를 추가하며 구매/환불만 txn/priceMajor를 추가한다. B의 orderNo/itemNo/skuCode/ccy/state는 항상 보존하고 txnNo는 T19에만, amountMinor는 T19 행합계와 완료환불에만 기록한다(취소 pending에는 생략). B 환불의 skuCode는 참조된 주문행에서 가져온다. C는 urlKey/deviceClass와 performance의 windowStart/End/lcpSeconds 또는 incident의 openedAt/closedAt만 기록한다. A의 priceMajor와 B의 amountMinor는 정확한 소수문자열/정수문자열, C의 lcpSeconds는 `2.5`/`2.6` 문자열로 보존한다.

원천 명명체계·국가·유효기간·단위·측정 정의가 같을 때만 연결한다. A의 관측 구매와 B의 주문을 값이 같다고 동일 MetricDefinition으로 합치지 않는다. T02 confirmed는 이 격리 시나리오의 설계 확정이며 실제 공급자 확인이 아니다. D003B에 없는 변형ID를 소급 채우지 않는다.

### 독립 기대값·승인 후 검증

1. 생성기와 독립된 표/Decimal 또는 BigInt oracle로 7파일·48행·ID 유일, T01→Variant/Product/Brand/Category, T02 6매핑, 주문4/상품6/거래4·구매 이벤트4/상품6·완료환불2/보류취소1을 대조한다. 원천→공통필드→관계의 file/hash/record/field·매핑/코드 버전을 추적한다.
2. 상품 수량8, 주문행합9900.00 JPY, 완료환불수량2·금액2450.00, 순수량6·순액7450.00. pending취소는 차감0, 주문·웹 구매 각각9900.00이어도 두 값을 합산0. T18 환불과 T20 환불을 이중차감0. 거래 연결4개, 구매 세션 연결3개·미연결1개로 검산한다. 실모집단 전환율·원인효과는 기대값으로 만들지 않는다.
3. T17은8 event, T18은18 event/20상품행(비구매12+구매4+환불2). 두 유형 event_id 교집합0. 누락된 단계의 원인/사람ID/광고 귀속을 보완하지 않는다. T37은rolling2창·장애1건20분, p75 두 값의 평균/합을 지표로 반환0, 장애 전후 매출효과 정답0.
4. 원천 JSON Schema·메타스키마/format, ID/조건부·기간/참조 검사를 통과한 뒤 메모리 RDF·SHACL·실제 RDF 재조회/독립 계산·OWL RL을 실행한다. 논리/질문 게이트 미구현은 not_run. 기대 관측/노드수는 매핑 확정 후 산식과 함께 승인 범위의 원천48행에서 도출하며 임의로 통과 계수를 맞추지 않는다. 보고서에는 원문/RDF payload 없이 계수·해시·검사상태만 저장한다.
5. 정상·경계 검사는 있는 자료만으로 종료일 제외·availableAt 기준일 이전/이후·미연결세션·pending 차감제외·rolling 중첩을 검사한다. 정상 원천/메모리 투영의 재실행·역순 비교도 포함한다. 새 오류 입력/근거삭제/중복주입은0행이며 오류 탐지 회귀 완료로 세지 않는다. 통과 후에도 30종 중 신규6종의 모의 적합성만 갱신하며 나머지24종·실제 공급자·AI 평가 완료로 확대하지 않는다.

승인 범위 질문: **D005-1.0.0의 위48행 생성, 원천 보존, 독립 검산, 메모리 RDF·SHACL·재실행 검사를 승인할까요?** Git 스테이징/커밋/원격은 별도 승인이다. [AGENTS.md](../../../AGENTS.md)의 “가상 데이터 생성·수정·재사용·변환·보완은 … 사용자 명시 승인 후 수행한다”와 이번 사용자 지시에 따라 승인 전 생성기 실행·신규 레코드·시험 fixture 생성은 하지 않는다.

## D005-2.0.0 — 30종 신규 자료 생성·규격 검증 상세 제안

현재 상태: **명시 승인·534행 생성·D005 내부 규격/배치 검증 통과**. 아래 생성 규칙과 완료 기준을 유지한다. D004의 기존214행/전체1,652행 메모리 검증 승인은 유지한다.

2026-10-16 후속 확정: 사용자 “현재구조로가고 d005 문서 수정하는걸로가자”에 따라 **전역 공통 사전을 목표 계약으로 유지하고 D005는 모의 원천·프로필 변환·회귀 시험으로 위치를 명확히 한다.** [수정한 D005 안내](batches/D005/README.md)의 계층별 용어·상태를 따른다. 이 절의 `common.schema.json`과 공통 스키마 통과는D005 내부 정규화 규격을 뜻한다. [실제 전역 사전 검사](common-contract/runs/2026-10-16-cq52-decisions-1-dictionary.json)는30종528행 중 전체 적합0행으로fail이며 별도 게이트다. 문서 정리는 기존 데이터/스키마/manifest 재작성이나 부족 정보의 임의 보완을 뜻하지 않는다.

승인 전 이력: 2026-10-15 사용자 제공 계획을 기존 승인 문서에 통합하고 기존48행 제안을 미승인·미실행 이력으로 대체했다. 사용자 말미의 ‘ㄱㄱ’를 최초 응답에서 생성 승인으로 해석했으나 저장소 지침을 확인한 뒤 명시 승인 대기로 정정했다. 그 시점에는 정상 자료 생성·오류 변형을 수행하지 않았다.

후속 결정: 아래 명시 승인 질문에 사용자가 **‘실행해’**라고 응답해 D005-2.0.0의 정상534행 생성·오류60케이스 메모리 변형·검증 실행을 승인했다. 위 대기 상태는 승인 전 이력이며 현재는 승인 후 구현·실행 단계다. Git 상태 변경·DB·영구 RDF·UI·LLM 원인 판단은 승인 범위에 포함하지 않는다.

실행 결과: [생성 실행](common-contract/runs/2026-10-15-d005-generate-1.json)의 누적186/249/411/507/534행이 단계별 게이트를 통과했다. [보강 검증](common-contract/runs/2026-10-15-d005-cycle-verified.json)은9게이트 pass·오류60/60검출·경계9검사·정상 오거부0이다. 메모리 RDF130,811 triples에서534행·11,139개 원천 필드 계보·국가별 계산 결과를 다시 읽었고 재실행/역순 hash가 일치했다. [D004 회귀](common-contract/runs/2026-10-15-d005-cycle-1-d004.json)는214행/1,652행과 기존7게이트 pass다. 생성 원천과 manifest를 보존한 채 검증 매핑만 보강했으며 당시 oracle/runner 바이트는 `batches/D005/generation-code/`에 보존했다. JSON Schema/모의 원천 적합성/프로그램 의미 계약은 각각534행 pass지만 독립 업무 의미 검토·HermiT/OOPS·전체52질문 assertion은 미실행이다. [실행 안내](batches/D005/README.md)에 범위와 재실행 인터페이스를 기록했다.

### 생성 범위·보존

| 구분 | 수량 | 처리 |
| --- | ---: | --- |
| 미구축30종 | 528행 | 모의 원천·주석·집계·모형·정책의 역할 구분 |
| T01 식별 지원 | 6행 | 기존6제품에 변형·SKU·카테고리 ID를 추가하는 별도 자료 |
| 정상 합계 | **534행·31파일** | `batches/D005/source/{유형}.jsonl` |
| 오류 시험 | **60케이스** | 매번 정상 자료부터 시작해1행만 메모리에서 변형·누적하지 않음 |
| 기존 연결 자료 | 36행 | T01 6·T12 6·T13 12·T24 12행, 읽기 전용 |
| D004 회귀 | 214행·1,652행 | 기존 승인 범위와 기대값 보존 |

국가/통화/시간대는 KR/KRW/Asia/Seoul, JP/JPY/Asia/Tokyo, US/USD/America/New_York다. 상세 사건은 주로2026년8월이고 비교·보고·정책 기간은 아래 규칙을 우선한다. 제품·캠페인·리뷰의 기존 ID·원문은 보존한다. 새 주문은 별도 표본이며 H01 전체 매출에 합산·역산하지 않는다. 원문·명칭·설명은 한국어이며 실제 공급자 응답·통계·승인으로 표시하지 않는다.

seed=`500520261015`, 난수/LLM 생성 없이 고정 표·순번·산식만 사용한다. 유형 내 record_id는 `D005-{유형}-0001`부터 연속이다. 제품 순서는 P1A/P1B/P2A/P2B/P3A/P3B, 국가 순서는 KR/JP/US다. UI·DB 적재·영구 RDF·LLM 원인 판단·Git 상태 변경은 제외한다.

T01 지원6행은 기존 제품명·브랜드·300ml 규격을 참조하고 `variant_id=D005-V-{기존 product_id}`, `sku=D005-SKU-{기존 product_id}`, `category_id=D005-CAT-shampoo`, 적용 시작2026-07-01을 추가한다. 기존 T01 행을 계보에 연결하되 원본에 소급 기입하지 않는다. 기존6캠페인의 국가·채널·대상 제품·귀속 설정을 유지하고 없는 계정 ID를 추정하지 않는다.

### 유형별 수량·생성 규칙

국가 인덱스 c는 KR=0/JP=1/US=2다. 산식의 브랜드·키워드·월·연도·페이지·날짜·조사·경쟁도메인 인덱스는 각 명시 순서의0부터 시작한다.

| 단계 | 유형 | 행수 | 행 단위·규칙 |
| --- | --- | ---: | --- |
| 1 | T02 외부 ID | 60 | A/B/C×3국가×6변형54개 confirmed 코드 매핑+일본 제품명 별칭6개 candidate. 코드=`{프로필}-{국가}-{제품ID}`, 유효기간 `[2026-07-01,2026-10-01)`. external_system/value, entity_ref, 국가, 기간, match_status, evidence. 후보로 자동 연결0 |
| 1 | T17 일반 이벤트 | 24 | 국가별 page_view6+consent_update2. event_id/time, site/session/page_ref, device, consent_state |
| 1 | T18 커머스 | 60 | 국가별 비구매12상품행+구매6상품행+환불2상품행. 상품행과 고유 이벤트를 구분 |
| 1 | T19 주문행 | 18 | 국가별4주문·6상품행. order_id+line_id, variant_ref, 수량·단가·할인·세금·행합계 |
| 1 | T20 처리 사건 | 9 | 국가별 완료환불2+보류 취소요청1. 주문/행 참조, 요청·완료 시각, 수량·금액·상태 |
| 1 | T37 성능·장애 | 9 | 국가별 중첩28일 창2+장애1. period/measures와 incident 시각 분리 |
| 2 | T21 원가 | 12 | 자사2변형×3국가×2기간. variant_ref, period, unit_cost, margin_definition, accounting_basis |
| 2 | T23 유통·배송 | 18 | 자사2제품×3국가 유통집계6+4주문×3국가 배송12 |
| 2 | T25 리뷰 주석·집계 | 24 | 기존12리뷰에서 측면 주석12+같은 표본의 측면 집계12 |
| 2 | T26 CS | 9 | 국가별 O1/O3 확인 연결2+unlinked1, 고정 한국어 문의. 미연결 문의의 제품·주문 추정0 |
| 3 | T04 패널 | 18 | 3브랜드×3국가×2025/2026 Q3. 비가중 표본100, 긍정수=`20+5×브랜드인덱스+2c+연도인덱스`, 비율=긍정수/100. 시장 판매량 변환0 |
| 3 | T05 검색 관심 | 36 | 2검색어×3국가×2정규화 창×3주. A=7월6/13/20일 시작 주·지수40/70/100, B=8월3/10/17일 시작 주·100/60/20. 창별 정규화 ID 분리 |
| 3 | T06 키워드 수요 | 18 | 샴푸/세정/보습×3국가×7/8월. 추정검색량=`1000+100×키워드인덱스+10c+50×월인덱스`. competition=medium·지수50, 입찰 하한/상한=국가 단위금액1배/2배 |
| 3 | T07 자연검색 | 24 | 자사2페이지×3국가×8월3~6일. 노출=`1000+100p+10c+50d`, 클릭=`100+10p+2d`, 평균 위치=`5+p`. 일본 두 번째 페이지 마지막 날짜 query=null, 클릭·노출 보존 |
| 3 | T10 공개 광고 | 12 | 경쟁2브랜드×3국가×8월10/17일. 같은 광고 ID의 두 관측, text 고정, last_seen≤관측일. 경쟁 지출/매출/전환 생성0 |
| 3 | T11 문서·사건 | 6 | 국가별 P2A의 동일 가상 발표를 인용한 안내문/전재문2개. 중복 문서군 명시. 실제 기관·언론사·URL 사용0 |
| 3 | T32 설문 | 18 | 3브랜드×3국가×2조사. 표본50, 긍정수=`20+브랜드인덱스+5×조사인덱스`. 기간8월3~7일/17~21일, 편의표본·질문·척도·분모 고정. 유의한 효과 해석0 |
| 3 | T33 공표 통계 | 12 | 3국가×7/8월×초판/수정판. 지수=`1000+100c+10×월인덱스+5×revision`. 다음달5일 초판/10일 수정판 확보, supersedes_record_id 연결 |
| 3 | T34 기상·일정 | 18 | 3국가×4일 기상12+국가별 가상 운영 일정2씩6. 온도=`25+c+d`℃·강수량=`d`mm. 실제 공휴일 표시0 |
| 4 | T14 광고 세그먼트 | 24 | 기존6캠페인×7/8월×mobile/desktop. T13 부모12행. 정수는60% 내림/나머지, 금액은 최소 통화 단위에서60% 내림/나머지. 합계 정확 일치, 가상 분할 표시 |
| 4 | T15 경매 | 12 | 기존 검색3캠페인×가상 경쟁도메인2×7/8월. 점유율=`0.30+0.05×경쟁도메인인덱스+0.01×월인덱스`, overlap_rate=.20. 분모 없으므로 기간 간 비율 합산0 |
| 4 | T16 소재 | 12 | 기존6캠페인×2버전. 텍스트 소재, 해당 캠페인·P1A 연결. `[7월1일,8월15일)`/`[8월15일,10월1일)` |
| 4 | T27 콘텐츠 | 12 | 국가별2콘텐츠×2관측. 게시8월3/10일·관측14/17일. 콘텐츠별 조회100/110→150/160. 누적 관측을 시점 간 합계로 처리0 |
| 4 | T28 댓글 | 18 | 국가별2콘텐츠×3댓글, 게시 후1/2/3시간. 두 번째는 첫 번째의 답글 |
| 4 | T29 협업 | 3 | 국가별1건, 해당국 콘텐츠2개 연결. signed·가상 비용, 게시물 관측과 협업 효과 구분 |
| 4 | T30 코호트·기회 | 9 | 국가별 코호트2+별도 B2B 기회1. 코호트1=O1/O2·2=O3/O4, 각 고객2·반복구매율0·완료환불 반영 순매출. 기회 stage=open·미성사, 소비자 매출 합산0 |
| 4 | T31 CRM | 6 | 국가별2코호트에 각1회. 발송2·반송0·유일클릭1·해지0. 오픈 수 없음·open_measurement_basis=not_collected. linked_orders 명시 연결만 보존, 매출 효과 확정0 |
| 5 | T38 실험 | 12 | 3국가×2실험×2arm, 각 표본100. 실험1 control/treatment 전환10/12·`[8월3일,10일)`, 실험2=20/18·`[8월10일,17일)`. 주문 표본과 다른 모집단·실제 효과 증명 아님 |
| 5 | T39 모형·후보 | 9 | 국가별 학습하지 않은 가정 모형1+예산 후보2. 아래 예산 산식/정책 검사 |
| 5 | T40 정책 | 6 | 국가별 proposed/approved2판. approved는 모의 상태이며 실제 생성 승인과 별개 |

### 주문·이벤트·원가·배송의 고정 표

금액은 JPY 기준이며 KRW는10배·USD는.01배다. 통화 간 합계는 만들지 않는다. `행합계=수량×단가-할인+세금`이다.

| 주문/행 | 제품 | 수량 | 단가 | 할인 | 세금 | 행합계 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| O1/L1 | P1A | 2 | 1000.00 | 100.00 | 0.00 | 1900.00 |
| O1/L2 | P1B | 1 | 1500.00 | 0.00 | 0.00 | 1500.00 |
| O2/L1 | P1A | 1 | 1000.00 | 0.00 | 0.00 | 1000.00 |
| O3/L1 | P1A | 1 | 1000.00 | 0.00 | 0.00 | 1000.00 |
| O3/L2 | P1B | 2 | 1500.00 | 0.00 | 0.00 | 3000.00 |
| O4/L1 | P1B | 1 | 1500.00 | 0.00 | 0.00 | 1500.00 |

O1~O4 주문일은8월3/4/5/6일 현지12시, 구매 계측은1분 후다. 주문의 여러 상품행은1구매 이벤트로 센다. 거래키 X1~X4에 국가를 포함하고 구매 세션은 S1/S2/S3/null이다. S1~S6은8월3~8일, page_view11:50·나열 순서의 단계11:51/52/53이다. 단계는 S1 조회/장바구니/결제시작, S2 조회/장바구니, S3 조회/결제시작, S4 결제시작, S5 조회/장바구니/결제시작, S6 조회다. S4/S6 consent=denied를 보존하며 사람 ID·영속 사용자 키는 생성하지 않는다.

완료환불은 O1/L1 1개·950 JPY 상당액, O3/L2 1개·1500 JPY 상당액이다. 각각8월8/9일 현지12시 요청→13시 완료→13:01 웹 계측이다. O4 취소요청은8월10일12시 pending으로 완료시각·환불금액을 만들지 않는다. T19 이행 상태는 O1/O3 fulfilled·O2 shipped·O4 unfulfilled이며 상태 확보는8월11일09시다. 미래 상태를 주문 시점에 노출하지 않는다.

성능 창은 `[7월7일,8월4일)`/`[7월8일,8월5일)`, p75 LCP=2500/2600ms다. 장애는8월5일11:00~11:20, 전환·매출 저하의 원인 관계는 생성하지 않는다. 원가 기간은 `[8월3일,7일)`/`[8월7일,11일)`, JPY의 P1A/P1B 원가=400/600→500/700이다. 같은 통화 배율을 적용하고 세전 상품원가로 정의한다. 재입고 미확인이므로 완전한 순이익을 산출하지 않는다.

유통 집계는8월 한 달의 가상 취급/대상 판매처 수 P1A=20/40·P1B=30/60이다. 배송 약속은 주문일+3일18시, O1=+2일 완료·O2=운송 중·O3=+4일 완료·O4=미출고다. 미완료 배송일은 생성하지 않는다.

### 리뷰 근거·모형·정책

리뷰는 국가별 P1A/P1B의 기존 record_id 순 첫2개씩12개다. 첫 리뷰에서 `거품이 잘 나서`를 positive/거품으로 추출한다. 두 번째는 용기 불편 구절을 negative/용기로, 일본 P1A만 건조감이 아쉽다는 원문 구절을 negative/건조감으로 추출한다. 인용은 그대로 보존하고 Unicode 코드포인트 offset `[start,end)`를 쓴다. assessment_status=provided이며 사람 검토로 표시하지 않는다. 제품·국가별 선택2리뷰가 분모이고 각 측면 mention_count=1·sample_size=2다.

국가 기준금액 s는 KRW1000·JPY100·USD1이다. T39 예측식은 `검색예산/(10s)+소셜예산/(20s)`, 총100s의60/40·40/60 배분으로 예측8/7을 얻는다. 채널별 하한0·상한70s, 적용 `[9월10일,17일)`이다. T40 정책1은 proposed·90s·`[9월7일,10일)`, 정책2는 approved·100s·`[9월10일,10월1일)`이다. proposed로 실행 가능 상태를 반환하지 않는다.

### 원천·공통 스키마·의미 계약

원천 JSONL 한 행은 `source_profile, metadata, payload`다. metadata는 D005 식별·시나리오·범위·원천 파일·품질 표시·확보 시각/시간대 정보이고 payload는 유형/프로필별 필드다. 전역 사전의 구조화된 `provenance`·`quality`·`temporal` 계약을 모두 제공한다는 뜻은 아니다. D005 내부 정규화534행은 메모리에만 두며 원천과 합쳐1068행으로 집계하지 않는다. 프로필은 유형·국가·유형 내 순번으로 순환 배정해 한 국가가 한 공급자로 고정되지 않게 한다.

| 프로필 | 키 | 금액 |
| --- | --- | --- |
| A | 기존 snake_case | amount 소수문자열+currency |
| B | camelCase | value 소수문자열+currencyCode |
| C | UPPER_SNAKE_CASE | amountMinor 정수문자열+currencyCode |

C의 KRW/JPY minor 배율1·USD100, 용량L→공통ml·LCP초→공통ms를 명시 변환한다. 나머지는 등록한 필드명 변환만 적용한다. 이름 유사성·자동 자료형 변환·기본값 보완은 금지한다.

기존 통합 JSON Schema는 보존하고 D005 원천 스키마(프로필별 키/자료형/금액), D005 내부 공통 스키마(유형별 required/enum/조건부), 배치 의미 계약(통화/단위/관계/기간/합계/상태)을 분리한다. `normalize()`는 프로필을 D005 내부 규격으로 해독하며 전역 사전 변환은 별도다. Ajv Draft2020-12·ajv-formats에서 coerceTypes/useDefaults/removeAdditional=false, 미등록 필드는 실패다. 생성 전에 메타스키마·compile·모든 `$ref`·필수/조건부/선택 필드 목록을 확정한다. 선택 필드는 이 제안의 규칙만 생성한다. purchase/refund의 transaction_ref·refund의 refund_amount 등 조건부를 강제하고 구조로 표현하지 못하는 규칙은 의미 검사에 등록한다.

모든 구간은 `[start,end)`, 공통 기준일은 `2026-10-06T00:00:00+09:00`이다. 발생/주문/요청/완료/관측/발행/확보 시각을 분리한다. 별도 지정이 우선하며 일반 집계 확보는 종료 다음날 현지12시·사건은 발생+1시간이다. 부모 자료 기반 행은 부모 확보 이후로 제한한다. synthetic·관측/주석/집계/예측 역할을 구분한다. 계보는 원천 file/hash/행/필드→공통 필드→개체/관계/지표→계산 결과까지 잇는다.

Order/OrderLine/Session 등 참조 대상은 RDF 투영 전에 명시 선언·제약을 추가하고 대표 개념/문자열로 대체해 통과시키지 않는다. RDF는 메모리만 사용하며 SHACL 이후 실제 RDF를 다시 읽어 대상·값·lexical·단위·통화·시간·상태·계보를 원천 oracle와 대조한다.

### 독립 기대값·오류60케이스

국가별 T17은8event다. T18은20상품행/18event, 구매4event/6상품행/수량8이다. 주문4/6상품행, 완료환불2건/수량2, 보류취소1건/차감0, 구매 세션 연결3/미연결1, 장애1건/20분, 성능28일 창2개/합산·평균 금지다.

| 통화 | 주문합계 | 완료환불 | 순액 |
| --- | ---: | ---: | ---: |
| KRW | 99000.00 | 24500.00 | 74500.00 |
| JPY | 9900.00 | 2450.00 | 7450.00 |
| USD | 99.00 | 24.50 | 74.50 |

생성기는 Node 표준 라이브러리/BigInt, 독립 oracle는 Python 표준 라이브러리/Decimal로 구현하고 생성기·정규화기·RDF 투영기의 계산 함수를 import하지 않는다. 금액 허용오차0이다. T14 부모합, T25 exact quote/span·제품·분모2, T30 코호트 순액합, T33 기준일별 최신 접근판, T39 합계/상하한/정책기간/예측8·7을 별도 검산한다. T27 누적 관측·T05 정규화 창·T15 경매 범위의 비가산성을 확인한다.

각 유형에서 구조 오류1개(아래 필드 삭제)·의미 오류1개, 총60케이스다. 조건을 갖춘 하위 유형의 첫 레코드를 고정 선택한다. 정상 입력에서 매번 시작하며 원본 파일은 수정하지 않는다.

| 유형 | 구조 삭제 필드 | 의미 변형 |
| --- | --- | --- |
| T02 | external_value | 없는 entity_ref |
| T04 | sample_size | 응답수>표본수 |
| T05 | query_id | 미등록 normalization_scope |
| T06 | keyword | 입찰 하한>상한 |
| T07 | site_ref | 클릭>노출 |
| T10 | public_ad_id | first_seen>관측일 |
| T11 | document_id | 없는 subject_ref |
| T14 | campaign_ref | 한 세그먼트 금액을 최소단위1 증가 |
| T15 | campaign_ref | 없는 캠페인 |
| T16 | creative_id | 종료<시작 |
| T17 | event_id | 다른 일반 이벤트와 event_id 충돌 |
| T18 | transaction_ref | 없는 거래 |
| T19 | line_id | 행합계 최소단위1 증가 |
| T20 | refund_amount | 환불 수량>원행 수량 |
| T21 | accounting_basis | 같은 변형 원가기간 중첩 |
| T23 | order_ref | 배송완료<출고 |
| T25 | evidence_span | 시작 offset1 이동 |
| T26 | link_status | confirmed 주문을 없는 주문으로 변경 |
| T27 | content_id | 두 번째 누적 조회<첫 번째 |
| T28 | content_ref | 다른 콘텐츠 댓글을 부모로 연결 |
| T29 | collaboration_id | 없는 콘텐츠 연결 |
| T30 | cohort_ref | 표본수<명시 고객집합 |
| T31 | emails_sent | 유일클릭>정상 도달 |
| T32 | sampling_method | 긍정수>50 |
| T33 | statistics_table_id | 다른 국가 판을 supersedes 연결 |
| T34 | station_ref | 기상 종료<시작 |
| T37 | measures | 장애 종료<시작 |
| T38 | arm_id | 전환수>100 |
| T39 | allocations | 배분합>총예산 |
| T40 | approval_role | 없는 KPI 정의 참조 |

각 케이스는 대상 record_id·원천 JSON 경로·변형 규칙·기대 오류 코드·검출 단계를 기록한다. 기대 오류를 기대 단계에서 검출해야 pass이며 누락/정상 오거부는 fail이다. 오류 원천 JSONL은 저장하지 않고 결과에는 대상·규칙·오류 위치·검사 상태만 남긴다.

레코드 추가 없이 동일 입력 재실행/역순의 ID·값·계보·RDF hash, 종료 직전/정각 선택, 확보 전/정각 접근, 미연결/unknown/null 보존, 웹/처리환불 이중차감 방지, proposed 실행 불가, USD minor·C L/ml·초/ms, D004 회귀를 검사한다. 이 배치로 미국 DST 경계·모든 행사 방식·기존52시험 전체를 검증했다고 표시하지 않는다.

### 실행·완료 조건

| 단계 | 생성 | 신규 | 누적 |
| --- | --- | ---: | ---: |
| 준비 | 입력 hash·승인 범위·스키마·의미 계약 고정 | 0 | 0 |
| 1 | T01 지원+1차6종 | 186 | 186 |
| 2 | 원가·배송·리뷰·CS | 63 | 249 |
| 3 | 관심·경쟁·패널·외부 맥락 | 162 | 411 |
| 4 | 광고·콘텐츠·CRM | 96 | 507 |
| 5 | 정책→실험→모형·후보 | 27 | 534 |

각 단계는 생성→원천 스키마→공통 스키마→관계/산술→독립 oracle→RDF/SHACL/재조회 순서다. 앞 단계 실패 시 다음 생성을 중단한다. 승인 배치의 코드 오류는 원인을 수정해 같은 입력으로 재검사하고, 새 값·관계·수량·해석이 필요하면 제안을 수정한다. 구현에 맞춰 기대값을 바꾸지 않는다.

- `generate`: 승인 기록의 버전·범위가 일치할 때만 생성한다.
- `validate`: 기존 파일 읽기 전용이며 생성기를 호출하지 않는다.
- `cycle`: 명세·자료·oracle·오류·회귀 결과를 단일 실행 보고서에 연결한다.
- 종료0=선언한 배치 검사 모두 통과,1=실패,2=필수 도구/검사 미실행이다.
- 배치/보고서 덮어쓰기를 거부하고 실패 보고서도 보존한다.
- manifest에 파일별 행수/SHA-256, seed, 생성/스키마/매핑/oracle 버전·hash, 기존 입력 hash, 환경, Git HEAD·dirty 상태를 남긴다. 검증 중 입력 hash 변경은 실패다.

완료에는 (1)31파일/534행/유형별 수량·ID, (2)원천/공통·참조/기간/단위/통화/상태, (3)원천 oracle/공통/실제 RDF 값·계보, (4)예상 단계의60오류 검출·정상 오거부0, (5)재실행/역순/기준일/경계/D004 회귀, (6)기존11원천파일·Git HEAD/refs/index 보존이 모두 필요하다. JSON Schema·모의 원천 적합성·의미 검토·논리 검사·질문 지원을 따로 집계한다. HermiT/OOPS·전체 assertion이 미실행이면 시스템은 incomplete다. 기존52시험 기대값/상태를 새 자료만으로 pass로 올리지 않는다.

실행 결과는 [기존 검증 사이클](common-contract/verification-cycle.md)과 [현재 Iteration](../../iterations/v0.2.0.md)에 이어 기록한다. 별도 계획 문서는 만들지 않는다.

**명시 승인 요청: D005-2.0.0의 정상534행·31파일 생성, 기존 연결36행의 읽기 전용 재사용, 오류60케이스의 메모리 변형, 독립 검산·메모리 RDF/SHACL/재조회·경계·D004 회귀 실행을 승인할까요?** Git 상태 변경·DB·영구 RDF·UI·LLM 원인 판단은 포함하지 않는다.

## CQ52-READONLY-1 — 기존 52시험 실행을 위한 재사용 제안 (승인 후 실행)

2026-10-15 후속 명시 승인: 사용자 원문 **“기존 데이터 재사용 승인할게. 필요한데이터는 계획먼저 세우고 더 생성하도록해”**에 따라 제안된 기존 D003B1,652행의 질문 재사용/32시험 실행을 승인받았다. [승인 기록](common-contract/question-approval-20261015.json)은 기존 제안 scope hash를 고정한다. 아래 승인 대기 문장은 승인 전 이력이다. 기존52시험을 실제 실행하고 결과·실패·잔여 자료를 확인한다. 추가 원천/주석/오류 입력은 필요 조건·정확 건수·내용·관계·검산 방법을 먼저 제안하고 승인 전 생성하지 않는다.

2026-10-15 OOPS 후속 결정: 사용자 원문 **“Oops해도 돼 수락할게”**로 아래 외부 정의 제출만 명시 승인받았다. [승인 기록](common-contract/oops-approval-20261015.json)은 당시 모델 hash·정확한 목적지·제외 범위를 고정한다. [실행](common-contract/runs/2026-10-15-cq52-oops-approved-1.json)은 HTTP200·Important3종/Minor2종·제안1건, HermiT pass다. 원천 데이터·리뷰 원문·RDF 인스턴스 전송0이며 모델도 수정하지 않았다. 아래 승인 전 거절 문단은 과거 이력이다. **CQ52-READONLY-1의 D003B 재사용/32시험 실행 승인은 여전히 대기**이며 이번 응답으로 확대하지 않는다.

2026-10-15. 사용자가 52시험 실행 계획 구현과 작업 재개를 지시했다. 저장소 지침의 계획 실행/개별 데이터 승인 구분과 D004의 전체52시험 제외 조건에 따라 이번 지시를 개별 재사용 승인으로 기록하지 않았다. [정확한 제안](common-contract/question-execution.md#cq52-readonly-1--필요한-개별-데이터-재사용-승인), [파일/hash·시험 ID 고정 범위](common-contract/question-execution-scope.json), [52시험 대조표](common-contract/question-readiness.md)를 준비했다.

대상은 기존 D003B11파일/1,652행의 메모리 재사용으로32시험의 정형 응답·독립 Decimal·근거/완전성/보류 assertion을 검증하는 것이다. 조건 부족20건은 not_run으로 유지한다. 신규 원천·주석/span·오류 케이스·원천 수정·영구 RDF/DB는 모두0이다. D005534행/기존60오류는 이미 승인된 동일 회귀만 수행한다. 원래52시험의 조건·기대 상태와 D003B/D005 manifest/source를 수정하지 않는다. 현재 신규 질문 실행은0건이다.

OOPS 외부 제출 승인은 별개다. 제출 대상은 ontology.ttl의 정의 내용 전체, 목적지는 `https://oops.linkeddata.es/rest`이며 원천 JSONL·리뷰 원문·RDF 인스턴스를 제외한다. 자동 승인 검토가 명시적 payload/목적지 승인 부재로 거절했으므로 실제 제출은 하지 않았다. 두 승인에 대한 사용자 응답이 도착하기 전까지 승인 완료로 바꾸지 않는다.

## D006-CQ-A — 남은 시험용 최소 자료 제안 (미승인·생성 0)

2026-10-16. 기존 재사용 승인 실행은 [32 pass/0 fail/20 not_run](common-contract/runs/2026-10-16-cq52-authorized-2.json)이다. 추가 자료를 만들기 전에 아래 범위만 제안한다. 목표는 잔여20시험 중13시험의 조건을 확보하는 것이며, 생성만으로 pass 처리하지 않는다. 기존 tests.json·기대 상태·원천·manifest는 변경하지 않는다.

### 신규 정상 자료: 2파일·3행

예정 경로는 `batches/D006-CQ-A/source/T24.jsonl` 1행과 `T25.jsonl` 2행이다. 승인 전 디렉터리/JSONL/메모리 fixture를 생성하지 않는다. 프로필 A와 D005 메타데이터 계약을 사용하고 `is_synthetic=true`, 별도 scenario/scope, 원천 경로·부모 ID·확보 시각을 명시한다. 원천 스키마/매핑을 먼저 구현·검사하고 기존 스키마를 덮어쓰지 않는다.

| ID | 내용·규칙 | 관계·시각 |
| --- | --- | --- |
| D006-T24-0001 | review_id D006-R-P1A-JP-1, P1A/JP, 한국어, 평점3/5, verified_purchase=null. 제안 원문: “향은 마음에 들지 않았지만 거품은 잘 났습니다.” | 부모 D003B-T01-0001. 작성2026-08-20T12:00+09:00, 확보13:00, Asia/Tokyo |
| D006-T25-0001 | 향/negative, exact quote “향은 마음에 들지 않았지만”, Unicode code point 반개방 span [0,14) | 위 리뷰 record_id와 P1A, 확보14:00, annotation/provided |
| D006-T25-0002 | 거품/positive, exact quote “거품은 잘 났습니다”, span [15,25) | 위 리뷰 record_id와 P1A, 확보14:00, annotation/provided |

이 문구는 승인 검토용 제안이며 원천 레코드는 아직 없다. 평점으로 감성을 유추하지 않고 명시 문구에 시험용 주석을 부여한다. 실제 고객/독립 현업 검토로 표시하지 않는다. 기존 D003B1,652행과 D005-T25-0009(거품 positive)/0011(건조감 negative) 및 해당 부모 리뷰만 추가 읽기 전용 재사용한다. CQ14-1은 새 향 주석+기존 건조감 주석, CQ14-4는 같은 새 리뷰의 상반된 두 측면으로 연결한다. 추가 제품/판매처/주문 마스터는0행이다.

### 격리 입력·조작: 11시험·16분기

각 분기는 불변 원본에서 새 메모리 복사본으로 시작한다. 오류 JSONL·영구 RDF·DB는 만들지 않는다. 아래 변형은 기존 재사용 승인에 포함되지 않으며 이번 별도 승인이 필요하다. 대상·변형 필드·예상 검출 단계/상태를 manifest와 결과에 기록한다.

| 시험 | 분기수 | 대상과 변형 규칙 | 확인할 assertion |
| --- | ---: | --- | --- |
| CQ01-2 | 1 | T01-0003(P2A)의 이름만 T01-0001(P1A)과 같게 변경 | ID 유지·이름만으로 병합 금지, incomparable |
| CQ01-3 | 1 | D003B-T03-0279(JP P2A 2026-08) 제외 | 분모/비교월 부족, insufficient_data·결측≠0 |
| CQ02-2 | 1 | T03-0199/0205/0211의 units_sold=0, sales_value="0.00" | 전년0, 현재수량4995, 증감수량4995·증감률null/denominator_zero |
| CQ06-4 | 1 | JP search/social 2026-08-19~30의 기존 비결측22행 conversions=0·attributed_revenue="0.00"; 기존 결측2행 유지 | 재고 회복 후 전환도 회복했다는 주장 금지·반증 제시 |
| CQ07-3 | 1 | T13-0129(JP search 08-03)의5지표 null·availability=missing | 클릭 없는 날 CVR null, 전체기간 완전값 보류, insufficient_data; 0 대체 금지 |
| CQ07-4 | 1 | T13-0178/0179/0180(JP social Q3)의 spend만 정확 Decimal로 절반 | ROAS 상승·지출 감소에도 자체 순매출 하락 근거 보존·증액 자동 결론 금지 |
| CQ11-2 | 1 | T36-0004 received_count=25, expected28/missing2 유지 | 합계 불일치 검출, execution_failed·자동 보정 금지 |
| CQ12-2 | 1 | T12-0004 social의 attribution_model=first_click·window=1, conversion_name 유지 | search last_click/7과 구분, incomparable·통화/반품 정의 혼합 합산 금지 |
| CQ14-2 | 2 | 새 향 주석에서 (a)product_ref=P2A (b)span.start만1 증가 | 제품/부모 불일치와 exact quote/offset 오류 각각 거부; 평점3으로 감성 판단 금지 |
| CQ17-2 | 2 | 두 분기 모두 CQ01-2 이름 충돌. (a)JP 조회에 기존 US가격 T08-0393 제시 (b)JP행사 T09-0001 available_at=2026-10-06T00:00:01+09:00 | ID/국가 경계와 기본 asOf 직후 자료 제외, incomparable |
| CQ28-2 | 4 | (a)필수 T03-0283 제외 (b)asOf=2026-09-30 (c)같은 ID 역순/재실행 (d)기존 D004214행에 무관 KR T03-0001 한 행 추가 | a/b 충분성 하락·완전합계null, c/d JP 사실·상태·근거 불변; d 전체 RDF hash 동일 요구 금지 |

합계는 정상3행과 독립16분기다. 분기에서 복사/변형되는 원천을 새 정상행으로 집계하지 않는다. CQ07-3은 정상 결측 스키마로 통과시킨 뒤 질문 단계의 부족 판정을 확인한다. 기존 정상 배치의 고정 결측수 assertion을 변형 입력에 잘못 적용하거나 SHACL을 우회하지 않는다.

### 검증 순서와 후속 보류7시험

승인 기록/범위 hash → 신규3행 스키마·ID/참조/시각·quote/span 검산 → 메모리 RDF/SHACL 재조회 → 원천 기반 독립 oracle → 13시험 실제 값/근거/보류/완전성 assertion → 기존32시험·D004·D005/60오류·HermiT/OOPS를 같은 사이클로 재검사한다. 코드와 oracle는 계산 함수를 공유하지 않는다. 입력/hash/Git 보존, 재실행·순서 불변, 정상 오거부0을 검사하고 실패/미실행도 보존한다. OOPS 지적을 자동 면제하지 않는다.

나머지7시험은 이번 생성 범위에서 제외한다: CQ04-2(micros/종료 경계), CQ04-4(배송 포함 역전 가격), CQ06-2·CQ23-2(DST/시간대/부분기간), CQ07-2(명시 정정판·baseline/day 중복), CQ15-1·CQ15-4(판매처·표본/수집창·구성 변화). 이들은 수량·필드·관계·기대값을 별도 확정한 뒤 제안한다. 특히 Q3/8월 조건과 미국 DST 전환일(3월/11월)의 관계는 명세 해석을 먼저 확인하며 8월에 가짜 DST를 생성하지 않는다. 기존 리뷰의 미상 판매처를 소급 추정하지 않는다.

**승인 대상은 신규 정상3행/2파일, 위 기존 주석 재사용, 격리16분기의 생성·변형과 검증뿐이다. 현재 승인 대기·추가 생성0이다.**

### 2026-10-16 D006-CQ-A/B 명시 승인

후속 사용자 원문 **“데이터 승인 다 해줄개 써도 돼. 하던 일 계속 해”**로 이 대화의 상세 계획에 있는 D006-CQ-A의 정상3행/2파일·기존 주석2건/부모 재사용·16격리분기와 아래 D006-CQ-B의 정상53행/7파일·판매처 선언2건·10메모리분기를 승인받았다. 위 미승인/생성0 문구는 승인 전 이력이다. 승인은 [범위](common-contract/d006-scope.json)의 hash와 [승인 기록](common-contract/d006-approval-20261016.json)에 연결한다. 기존 원천/manifest와 원래 tests.json은 보존한다. 새 입력으로 pass를 선기입하지 않는다.

## D006-CQ-B — 잔여7시험의 승인된 생성·검증 규격

정상53행/7파일, 별도 sellers.json의 합성 판매처 선언2건이다. 기존 D003B1,652행, A의3행 및 승인된 D005 주석2건/기존 부모만 질문별 범위에서 재사용한다. 프로필 A의 `source_profile, metadata, payload` 형식과 D006 전용 명시 스키마를 사용한다. 기존 D005 스키마를 완화하지 않는다. 모든 새 행은 synthetic/sample이며 실제 공급자 적합성이나 독립 현업 검토 완료를 뜻하지 않는다.

| 파일 | ID·수량 | 생성 규칙·관계·독립 기대값 |
| --- | --- | --- |
| T08 | D006B-T08-0001~0004,4행 | 0001/0002는 P2A/JP/S-JP/300ml,08-24 08:59:59, 원값1234000000 micros/1234.00 decimal, 정규화1234엔. 0003/0004는08-20 09시의 P1A1000+배송300/P2A1100+배송100엔. 동일 목적지·수량1·세금포함·주문당 고정배송으로 표시가격 우위와 총액1300/1200의 우위가 반대다. |
| T22 | D006B-T22-0001~0006,6행 | US P1A/L-US,2025-11-02 및2026-03-08 각각 현지00:30 재고0·03:30 재고1·04:30 재고1. 해당 날짜의 실제 offset을 명시한다. snapshot 사이 지속 품절 시간은 null이다. |
| T12 | D006B-T12-0001~0004,4행 | D006B-C-US/P1A의 두 경계일 설정. 현지 자정부터 가을01:00-05:00/봄03:00-04:00까지 last_click/7일, 경계부터 다음 자정까지 last_click/1일. [start,end), 겹침0. |
| T13 | D006B-T13-0001~0008,8행 | 각 경계일 NY/UTC 두 계정×전체/부분 두 대체 시리즈. 같은 실제 UTC 구간, 전체는 현지 하루25/23시간, 부분은 설정 변경부터 끝까지. 노출100/클릭10/전환1/지출USD1.23/귀속USD2.46. 전체/부분을 더하지 않는다. |
| T13 | D006B-T13-0009~0011,3행 | 기존0179 월/0129 일의 명시 정정revision1은 기존 지출+100.00엔,09-06 12시 확보. 0011은0179 기준 지출+200.00엔의revision2,0009를 대체하며10-07 12시 확보. 나머지 지표·캠페인·기간은 원행 그대로. 기본asOf에는revision1만 선택한다. |
| T03 | D006B-T03-0001~0004,4행 | 두 경계일의 동일 절대기간에 US USD minor123→1.23, JP JPY minor1234→1234.00, P1A/수량1. FX 없는 국가합계와 부분기간 자동비교를 거부한다. |
| T24 | D006B-T24-0001~0020,20행 | JP P1A,작성창[08-03,08-17)/[08-17,08-31). 첫창 sellerA8/B2,다음창A2/B8. A별점3/4/5순환,B1/2순환,척도5·verified_purchase=null. 각 판매처/창 안에서 시작일+k일12시 작성. 원문은 별점 표본 검증용 가상 리뷰라는 고정문구이며 감성 추출에 사용하지 않는다. |
| T36 | D006B-T36-0001~0004,4행 | 두 작성창×두 seller의 리뷰 수집로그. 기대=수신=8/2/2/8·누락0,선정방식synthetic_fixed_seller_quota·범위sample. 각 리뷰는 해당 run_id와seller를 명시 연결한다. |

별도 판매처 선언은 D006B-S-A/B,국가JP,synthetic=true,scope=D006-CQ-B다. 판매처 원천행을 추가로 만들지 않는다. 리뷰/T36 확보는 작성창 종료 다음날12시이며, DST 자료 확보는 해당 현지 하루 종료일12시다. T08은09-02 12시 확보한다. A 부모·주석의 확보 시각은 앞의 제안을 따른다.

### 업무·기간 개정

사용자 선택에 따라 CQ06-2/CQ23-2만 실제2025-11-02 DST 종료와2026-03-08 시작 기간을 정식 추가한다. 기본Q3/8월 조건과asOf=2026-10-06은 보존한다. [개정 기록](common-contract/question-revisions-20261016.json)은 원래tests.json hash를 보존하며 다른 질문의 기간을 확대하지 않는다. 가을 현지 하루는25시간·봄23시간이다. 시간 규칙 근거는 [NIST](https://www.nist.gov/pml/time-and-frequency-division/popular-links/daylight-saving-time-dst)와 [미국 기상청2025종료 안내](https://www.weather.gov/media/rlx/climate/Daylight-Saving-Time-Ends-2025.pdf)다.

CQ15는 유효한5점 척도 고유 리뷰 중1~2점의 비율이다. 3점은 낮은 별점이 아니며 null은 분모에서 제외하고 제외수를 표시한다. 본문 감성과 구분한다. seller별0%/100%는 두 기간에 그대로이고 전체20%→80%,seller동일가중50%→50%다. 이를 품질 악화의 인과 증명으로 표현하지 않는다. 사용자가 직접 할 현업 의미 확인은 승인과 구분해 대기 상태로 남긴다.

### 별도10메모리분기

| 분기 | 대상·변형 | 검출/판정 |
| --- | --- | --- |
| ambiguous_fall | T22-0002 observed_at=2025-11-02T01:30:00,offset미제공 | 의미 입구에서 모호시각 격리 |
| nonexistent_spring | T22-0005 observed_at=2026-03-08T02:30:00-05:00 | 실제 NY시간과 왕복불일치 거부 |
| overlapping_config | T12-0002 valid_from=2025-11-02T00:45:00-04:00 | 설정 유효기간 중첩 거부 |
| snapshot_gap | T22-0002 제외 | 공백 확대,지속품절null·비교보류 유지 |
| unknown_scale | T08-0001 amount_scale=unregistered | 배율 추정 없이 거부 |
| fractional_minor | T03-0001 sales_raw=123.5 | 정수 최소단위 위반 거부 |
| missing_seller | T24-0001 seller_id제외 | 판매처 연결 누락 거부 |
| null_rating | T24-0001 rating_value=null | 정상 미제공으로 수용,첫창분모9·낮은별점2·제외1 |
| duplicate_review | 같은 T24-0001 원천identity한번 재입력 | 동일 ID재적재는멱등,첫창분모10유지 |
| review_count_mismatch | T36-0001 received_count=7,expected8/missing0유지 | count mismatch와리뷰집합대사오류검출 |

각 분기는 불변 정상 입력에서 새 복사본으로 시작하고 오류JSONL/영구RDF를 저장하지 않는다. 생성/검증/질문코드와 독립 원천oracle의 계산·변형 검산 코드를 분리한다. 원천·공통 스키마/ID·참조·시각·통화/관계·산술→RDF/SHACL/전필드재조회→7시험전체assertion→기존32/D004/D00560오류/HermiT회귀 순서다. OOPS 및 실제 공급자/현업 의미 검토 상태는 별도 집계한다. 승인 입력/hash·Git HEAD/refs/index 보존과 실행 보고서 덮어쓰기 거부를 검사한다.
## 2026-10-16 공통 사전 잔여 보완 제안 — 미승인

기존 원천을 보존한 로컬 변환으로528행 중198행이 공통 JSON Schema에 적합해졌다. 나머지330행·63그룹에 대한 [상세 보완안](common-contract/canonical-followup-20261016.md)과 [필드별 대상ID/건수](common-contract/canonical-gap-proposal-20261016.json)를 제시한다. 필수 누락 설정804건과 T16 종료시각 보존12건을 합한816건의 별도 보완 파일을 제안하며 **아직 생성·승인하지 않았다**.

승인 범위는 문서에 적은 값 결정 규칙·관계·가용시점·검산 방식과 T31의 수신자 단위 중복 제거 해석이다. 코드 정의·참조는 원천의 과거 자체 버전이라고 소급 표시하지 않는다. 추가 개별 고객·리뷰·주문·실험 관측행은 제안하지 않으며 실제 공급자 자료도 필요하지 않다. 기존 계획의 일반 실행 승인을 이 신규 가상값의 개별 승인으로 처리하지 않는다. 앞부분은 기존 배치의 승인·생성 이력이다.

## 2026-10-16 공통 데이터 명세 완성 위임·실행

사용자는 계획의330행816개 필드 설정과 필요한 가상 보완·의미 확정·근거 있는OWL/SHACL 수정·단계별dev 커밋을 명시 위임했다. [원문과 범위](common-contract/completion-delegation-20261016.json), [실행 기록](common-contract/completion-execution.md)을 따른다. 원천534행·manifest·기존52시험은 보존하며 별도 보완816건은 파생228·정의336·가상 가정252건이다. AI 판단을 사람의 개별검토로 기록하지 않는다. 실제 공급자·외부 모델 전송·UI·원격 발행은 범위 밖이다.

## 2026-10-17 D007 신규 20,000행 — 도구 준비·개별 승인 확인 대기

사용자는 기존 자료에 20,000행 추가, 공통 규격·참조 통일, 독립 표본 구분 유지, 외부 LLM 없이 유연한 텍스트 생성을 선택했다. 이후 “계획대로 실행해”라고 지시했다. AGENTS.md는 일반적인 계획 실행 지시와 신규 생성 개별 승인을 구분하므로, 유형별 수량·규칙·관계·검산을 담은 [D007 명세와 실행 안내](batches/D007/README.md)를 구현하고 개별 생성 승인을 질문했다. 명시 승인 응답 전에는 신규 값·seed 레코드·오류 레코드를 생성하지 않는다.

정확한 수량은 [counts](batches/D007/spec.mjs) 합계 20,000행이다. 기존 2,242행·manifest를 보존하며 T01은 재사용한다. 가격·리뷰·시장의 제품×국가 할당량, 제품별 분포·시간 변화·반례, 주문–환불–배송과 리뷰–주석 연결, 통화 최소단위 금액과 독립 Decimal/시간대/RDF 검산을 제안 범위로 고정했다. [초기 준비 검사](batches/D007/preflight.json)는 기존 입력을 사용한 11검사 pass·신규 0행이었다. 아래는 후속 승인·실행이다.

### D007 개별 승인과 생성

사용자는 신규 20,000행 생성을 개별 승인해 달라는 질문에 **“승인한다 ㄱㄱ”**라고 응답했다. [승인 기록](batches/D007/approval.json)은 실제 응답·유형별 수량·spec hash·기존 55개 원천/manifest 파일 hash·표본 구분 유지·스키마 변경 없음·외부 LLM 없음 범위를 고정한다. 앞의 대기 상태를 승인 완료로 대체하며, 당시 준비 결과를 소급 수정하지 않는다.

승인 후 생성기는 전체 공통 스키마와 참조·시간·금액·할당량·리뷰 발췌 검사를 메모리에서 통과한 다음 **40개 JSONL에 20,000행**을 썼다. [manifest](batches/D007/manifest.json)를 따른다. [최종 결과](batches/D007/result.json)는 12검사·독립 Python 9검사·RDF/SHACL·바이트 재현 pass이며, [기존 시스템 전체 회귀](common-contract/runs/2026-10-17-d007-post-generation-system-1.json)도 7게이트·52시험/682검증 pass다. 기존 원천/manifest 55파일과 공통 스키마·OWL·SHACL을 보존했다. 기존 790행의 공통 명세 정보·매핑 차이는 그대로 노출하고 실제 미제공 값을 임의 보완하지 않았다. 실패·중단 이력과 결측 금액 단위 투영의 수정 근거는 [배치 안내](batches/D007/README.md)에 보존한다.
## 2026-10-17–18 기존 D007 재사용·대시보드 연결

사용자 요청: ‘지금 데이터 추가 증강 완료했거든? 일단 현재 화면 고정하고 너가 말한대로 2~5 쭉 순차적으로 계획 세워서 진행해줘.’ 이에 따라 화면 계약 추출, 로더·조회·표시 분리, 최신 배치 점검, 검증된 표준화 데이터 연결을 수행했다.

승인 범위는 기존 D007 40파일·20,000행과 D003B 제품 식별자 6개의 읽기·검증·고정 조회본 복사·화면 연결이다. 원래 저장소는 읽기만 수행했다. 새로운 마케팅 수치·자연어·주석·실험·승인 이력을 생성하지 않았고, 스키마 변경·생성기 실행·DB/API 도입·Git 변경으로 확대하지 않았다. D005/D006은 적합 상태만 확인하고 D007에 합치지 않았다.

공식 카탈로그의 D007 적합 20,000행을 선택하고 원천 45파일 해시 전후 일치·고정 조회본 SHA-256을 확인했다. [실행 범위와 검증](../../design/data-separation-validation/README.md)에 로컬 조회본·123조회·41화면·보존본과 한계를 기록했다. 이 기록은 이전 미승인 제안이나 모든 배치 생성의 포괄 승인으로 해석하지 않는다.

## 2026-10-18 전체 데이터 연결 범위 확대

사용자의 ‘모든데이터를 다 대시보드에 연결해’ 요청에 따라 기존 5배치의 원천 91파일·22,242행 전체를 읽기·재사용·조회본 복사·화면 연결했다. 미적합 790행도 원문과 기존 카탈로그의 문제 항목을 보존해 조회한다. 기존 데이터 생성·보완·스키마 변경·원래 저장소 수정·Git 상태 변경은 수행하지 않았다. [전체 연결 기록](../../design/data-separation-validation/all-data-connection.md)에 배치별 수량, 전 유형 시각화, 원천 보존과 실제 검증을 남겼다.


## 2026-10-19 국가·제품 비교용 D008 생성·화면 개편

사용자 직접 요청: “국가별이나 경쟁사 제품별로 … 데이터 수치들다 다르게 잡아줘”, “미국은 더 많이, 일본은 조금만 더 많이 … 다양하게”, “광고주별이랑 텍스트 이미지 비디오별로 … 실제처럼 … 들쭉날쭉하게 비율”. 이번 요청은 새로운 비교용 가상 수치·텍스트·주석 생성과 화면 개편에 대한 근거다. 구체적인 표본 수·분포·고정 해시 규칙은 구현 중 선택했으며 사용자가 개별 행이나 최종 분포를 검토했다고 기록하지 않는다.

D007을 보존한 독립 화면 시나리오 D008 40파일·30,394행을 생성했다. 한국 6,825행/리뷰560개, 일본 8,987행/리뷰730개, 미국 14,582행/리뷰1,120개다. 광고 형식·광고주·문의·제품별 표본과 별점을 다르게 구성했다. 늘어난 주문 표본은 새 식별자의 주문·환불·배송·코호트·CRM 하위 그래프를 함께 연결해 금액 산식을 보존한다. 리뷰 주석은 문장 내 발췌 규칙에 따른 가상 주석이며 인간/LLM 분석이나 실제 구매 확인을 의미하지 않는다.

원래 저장소, 기존 91원천 파일·22,242행, 확정 화면 명세 원문, 스키마·검증기·Git 참조는 변경하지 않았다. 미제공 필드를 실제 관측처럼 채우거나 실제 승인·집행 이력을 생성하지 않았다. 공식 JSON Schema·참조·발췌·통화·주문행·코호트 대사를 통과한 화면 시나리오이며 OWL/SHACL/RDF 또는 Agent 서버 신규 적재 완료로 간주하지 않는다. D008 화면과 D007 Agent 연결 선택을 분리해 유지했다.

[구현·생성 규칙·프로필·검증](../../design/marketing-redesign-20261019/README.md), [실제 데이터 프로필](../../design/marketing-redesign-20261019/data-profile.json), [조회 검증](../../design/marketing-redesign-20261019/query-checks.json)에 범위와 제약을 남겼다. 생성 시각과 SHA는 잠금 파일에 고정했다. 새 발행 버전·Iteration·커밋·푸시·브랜치 변경은 승인 범위에 포함하지 않았다.

## 2026-10-20 사용자 의미 검수와 가상 Hill 모형 적용

사용자는 더미 자료 확보시각 무시, 사이트 성능의 기존 임의 대표값 사용을 요청하고, 이어 인터넷에서 적합한 공식을 찾아 가상 전환수 모형을 적용하며 문서 갱신·커밋까지 진행하도록 명시했다. 함수 형태는 Google Meridian Hill의 slope=1이며 검색 최대60/반포화 기준총예산20%, 소셜 최대40/반포화10%를 시연 계수로 설정했다. 계수는 사용자 개별 행 검수나 실제 학습 결과가 아니다.

CURRENT T39 모형36행·시나리오36행의 파생 투영과 저장 예상값/버전을 갱신했다. 같은 채널 예산을 합산하며 기존 source/archive와 JSON Schema는 보존한다. T37 원본85성능행 중12개 업무 키의 ID 정렬 첫12행을 선택하고73행은 선택 제외로 보존한다. 장애23행은 유지한다. 새로운 마케팅 관측 행은 생성하지 않았다. 전체 활성30,327행·원본 보존52,636행, 독립 Decimal36건·통합328조회 검증을 확인했다. 실제 모델 평가의 새 예산24회 중 DNS 실패를 포함한23시도, 최종4사례 통과다. 실제 광고 집행은0이며 원격 발행은 범위에 없다.

## 2026-10-21 구매 매출 ROAS 업무, 신규 시나리오 제안

사용자는 할인 후 상품 구매금액에서 확정 취소, 환불을 중복 없이 차감하고 세금과 배송비를 제외하는 기준을 확정하고, 별도 브랜치에서 대표 업무 구축과 필요한 데이터 증강의 계획 수립을 요청했다. `feature/roas-decision-flow`에서 기존 미커밋 변경을 보존한다. 상세한 신규 수량과 관계 규약에 대한 승인 질문을 제출했으며 응답 전 생성은 0행이다. 일반적인 작업 시작 지시를 상세 규칙의 개별 검수로 기록하지 않는다.

[단일 범위와 검증 계획](../../design/roas-decision-flow.md)은 한국 P1A, 2026-08-03부터 08-30까지, 검색과 소셜의 독립 가상 시나리오 3,470행이다. 유형별 수량은 T12 2, T13 56, T14 112, T16 2, T17 1,120, T18 1,980, T19 126, T20 16, T24 28, T26 28이다. 기존 행은 변경하지 않고 업무 필드도 추가하지 않는다. 기존 유입, 세션, 거래, 주문과 추가 참조 필드를 재사용하며, 시나리오 한정 상품금액과 동일 금융 사건의 대표행 규약을 명시한다.

기본 화면과 기존 Agent의 데이터 선택은 기존 시나리오로 유지하고 새 업무는 새 scope를 명시한다. 물리 전체 행수와 해시를 먼저 검사하며 표본을 합산하지 않는다. 기존 source/archive, 스키마와 과거 Evidence를 보존하고, 신규 행을 생성할 경우 승인 응답과 입력 해시, 생성 규칙, 참조, 사건 순서, 금액, 중복 차감, 기준일, 재현 검산 결과를 이 절과 단일 결과 문서에 연결한다. 외부 모델, Ads, 원격 발행은 제외한다.

### 후속 개별 승인과 실행

사용자는 위 수량, 관계와 시나리오 한정 의미 규약의 생성 승인 질문에 **“제안 범위 생성 승인”**으로 응답했다. [승인 원문](../../../evidence/roas-decision-flow-20261021/generation-approval.json)은 기준 자료 해시와 생성 규칙 해시 `decda496e09b2c26c9a87648e57a0237bb5fa443beed3a404f89cbf357be76c0`를 고정한다. 일반적인 작업 시작 지시가 아니라 이 상세 제안에 대한 명시 응답이다.

승인 후 제안한 10유형에 정확히 3,470행을 추가했다. 기존 30,327행과 기존 정의를 보존했으며 업무 필드 추가는 0개다. 최종 활성 33,797행, 원천 판정 56,106행, 자료 해시 `f8a8bfd8cde6666f37f70d8b67a917cf3ec542c3715f0706e3e6d107661b760d`다. [구현과 검증](../../design/roas-decision-flow.md#승인-후-구현과-검증)은 원천 스냅샷, 재현, 135검사, 독립 Decimal 검산과 기존 조회 328개를 연결한다. 실제 매출 효과, 현업 유용성, 외부 모델과 Ads는 검증하지 않았다.


## 2026-10-22, 검토안 저장 구조 제안, 승인 대기

사용자의 다음 기능 시작 요청에 따라 기존 저장 경로를 확인하고 [항목, 생성 범위와 검증 방법](../../design/roas-decision-flow.md#2026-10-22-검토안-저장-제안-승인-대기)을 제안했다. 브라우저 저장과 JSON 파일 이동을 추천하며 다른 PC 자동 동기화는 별도 서버 범위다. 새 마케팅 행 0개, 사용자 저장 전 검토안 0개, 검증용 검토안 최대 10개를 제안한다. 일반적인 시작 요청을 이 구체적인 스키마와 검증용 데이터의 개별 승인으로 취급하지 않는다. 승인 전 저장 코드, 신규 저장소와 검증용 데이터를 생성하지 않았다.


### 검토안 저장, 개별 승인 후 구현 진행

사용자는 위 상세 제안에 대한 승인 질문에 “ㄱㄱ”으로 응답했다. [승인 기록](../../../evidence/roas-reviews-20261022/approval.json)을 남기고 브라우저 저장과 JSON 파일 이동을 구현했다. 마케팅 자료의 신규 행과 변경은 0개다. 자동 검사에는 두 검토안 ID를 재사용했고 PC 검증에는 저장한 검토안 하나와 가져온 검토안 둘을 사용했다. 테스트 검토안은 분석 관측 자료에 합산하지 않는다. 검증 상태와 남은 항목은 [업무 기록](../../design/roas-decision-flow.md)에 구분한다.


## 2026-10-22 독립 재감사 후 현실성 검증 사례 제안, 미승인

현재 요청은 수정 계획과 실행이며 신규 생성의 개별 승인은 아직 없다. 아래는 검토할 구체 범위이며 실행 결과가 아니다. 현재 R001 3,470행과 기존 원천, 정의와 해시는 보존하고 이번 화면 수정에서 생성하는 마케팅 행은 0행이다.

목적은 단일 결제 이후 하락 사례에 맞춘 화면을 일반적인 원인 진단 능력으로 오인하지 않도록 비교 사례를 마련하는 것이다. 실제 업계 비율 재현이나 인과효과 입증을 주장하지 않는다.

| 추가 사례 | 범위와 생성 목적 | 구분 가능한 관찰과 구분하지 못하는 원인 |
| --- | --- | --- |
| R002 비용 변화 | 한국 P1A, 검색과 소셜, 비교 전후 각 14일. 유입과 상류 단계를 고정하지 않고 CTR과 CPM 변화 조합을 다르게 구성 | CPC 변화의 산술 성분을 구분. 경매 경쟁과 입찰 정책의 실제 원인은 미확인 |
| R003 구매금액 변화 | 같은 제품, 매체와 비교 길이. 수량, 할인과 일자별 주문 수를 변동시키고 상류 퍼널도 변동 | 주문당 금액 감소를 수량과 할인 구성으로 분해. 실제 프로모션 의사결정의 원인은 미확인 |
| R004 확정 조정 변화 | 같은 제품, 매체와 비교 길이. 확정/대기, 부분 처리, 동일 사건 대표행과 늦은 처리를 기존 의미로 구성 | 원주문별 차감률 증가와 처리 지연을 구분. 실제 고객 경험과 환불의 인과 원인은 미확인 |

제안 상한은 세 사례 합계 신규 마케팅 관측 12,000행, 부가 provenance/migration은 관측당 각 1행이다. 기존 T12, T13, T14, T16, T17, T18, T19, T20, T24, T26의 현재 필드만 재사용하고 필드나 타입, 관계 의미는 변경하지 않는다. 생성 전 유형별 정확한 행수와 고정 seed, 날짜와 ID 범위, 정의 추가분과 원천 해시를 승인 명세로 고정한다. 상한과 유형 범위를 넘기거나 필드 변경이 필요하면 다시 제안한다.

방문 수와 각 단계의 생존 여부, 기기와 구매 여부를 하나의 인덱스 비교로 정하지 않는다. 기기, 유입, 단계와 구매 시각을 서로 독립적인 규칙과 명시한 시나리오 가정으로 결정하고, 일자별 변동과 재방문을 포함한다. 숫자는 테스트 가정이며 실제 업계 평균으로 표시하지 않는다. 반복 고객과 후기의 시간, 연결을 확인하며 배송 의견만 후반에 일괄 배치하지 않는다. 현재 스키마로 표현할 수 없는 결제 실패 상세나 계측 배포 이력은 만들지 않고 자료 공백으로 남긴다.

검산은 기존 파일 바이트 보존, 신규 ID와 시나리오 분리, 참조 무결성, 단계별 시간순서, 주문과 금융 대표행, 광고 일/매체/기기 합계, BigInt와 독립 Decimal 금액, 누락과 지연을 보류로 표시하는 품질 게이트를 포함한다. 현재 백엔드의 당일 구매 완결 가정과 화면의 R001 고정 선택을 별도로 검토하고, 지원하지 않는 지연/누락 상황을 정상 값으로 억지로 맞추지 않는다. 신규 사례의 화면 선택과 검사까지 포함한 후속 구현 범위로 제안한다. 원본 R001의 성공 결과를 이 신규 사례에 소급 적용하지 않는다.

실제 안내 버전, 결제 실패 로그, 운영/타기팅/계측 변경 이력과 목표 ROAS 등은 임의의 관측 사실로 채우지 않는다. 이 자료를 제공받거나 별도 가상 관측 생성 범위와 필드 승인이 있어야 후보의 기각과 해결안 확정 능력을 추가 검증할 수 있다.


### 2026-10-22 추가 사례 생성 개별 승인과 실행

사용자는 위 제안에 “ㄱㄱ 진행해. 이번엔 실제 데이터처럼 구성이정말 다양해야할거야.”라고 응답했고, 구조화된 승인 질문에도 “제안 범위 생성 승인”으로 답했다. [승인 기록](../../../evidence/roas-diversity-20261022/approval.json)과 기존 33,797행의 [기준 해시](../../../evidence/roas-diversity-20261022/baseline.json)를 보존했다. 승인 상한 12,000개 관측행 안에서 R002 2,531행, R003 2,586행, R004 2,427행, 합계 7,544행을 생성했다. provenance와 migration에는 각 7,544행을 추가했고 원본은 유형별 불변 스냅샷 10개로 보관했다. 기존 스키마와 필드 의미를 유지하고 각 사례는 독립 scope와 명시 선택 profile로 분리했다.

생성 전 코드와 seed, 정확한 유형별 수량과 profile을 [실행 명세](../../../evidence/roas-diversity-20261022/execution-spec.json)에 고정했다. 초기 메모리 점검에서 구매 단계까지의 통과 확률이 너무 높아 약 26~29%의 세션 주문율과 과도한 ROAS가 나타났다. 설치 전에 단계별 통과 확률을 명시한 시뮬레이션 가정으로 보수적으로 조정하고 전체 독립 검사를 재실행했다. 최종 표본을 업계 평균으로 보정했다고 주장하지 않는다. 날짜, 기기, 유입, 퍼널, 금액, 재방문과 의견은 분리된 seed stream으로 정하며, 논리 제약은 기기별 클릭 수가 포착 방문 수 이상이고 각 광고 분할 합계가 부모와 맞도록 적용한다.

지연 구매는 첫 광고 유입 뒤 1~3일 내 직접 재방문 세션으로 돌아온 형태로 표현한다. 매출은 7일 창의 마지막 광고 접점 날짜에 귀속하고 최초 유료 세션의 구매와 후속 구매를 분리한다. 동의 미확인과 거부 방문은 가명 고객 ID를 만들지 않으며, 주문의 직접 세션 연결을 고객 식별 동의로 해석하지 않는다. 다른 사이트 유기 유입 모집단을 새로 만들어 합산하지 않았다.

[독립 Decimal와 분포 검증](../../../evidence/roas-diversity-20261022/independent.json)은 금액, 참조, 광고 분할, 지연과 재방문, 여러 수량과 할인, 후기 조합과 처리 상태, 이전 원천과 정의 보존을 확인했다. 설치 재실행은 신규 0행이며 기존 자료를 다시 추가하지 않았다. 전체 활성 관측은 41,341행, 데이터 해시는 `4a58a7326fcd84b4d050ab2b2aea1cb7289c7d28bbb1deab1df2e378e5afadbb`다. 실제 결제 실패나 운영 변경을 관측한 사실, 업계 대표성, 실제 효과를 생성한 것은 아니다.

## 2026-10-23 교육용 ROAS 공통 집계 계약, 사용자 범위 확정과 실행 착수

사용자는 S01~S15의 데이터와 대응을 제안한 뒤 주문 136건을 표시하는 경우 원본 136건을 만들 필요는 없고, 실제 상세 분석에 필요한 텍스트만 개별 생성하라고 지정했다. 이어 “14일 구간을 기본으로 해서 구현해놓고, 1달전은 다음에 구현하자”, “S1~S15 모든 시나리오를 다 통틀어서 전체 공통 데이터 규약은 하나 짜놓고 거기서 세부적으로 데이터 값들만 각 시나리오 특징에 맞도록”이라고 범위를 구체화했다. 사례별 화면 축소나 원인 강조 대신 평범한 공통 대시보드에서 학습자가 직접 판단해야 한다는 요구도 확정했다.

위 상세 계획의 동일 화면, 공통 계약, 집계 50,000행 이하, 고유 상세 200건 이하, 신규 주문/클릭/세션 원본 0건, 기존 41,341행 보존 범위를 유지한다. 조회 08-17~08-30, 비교 08-03~08-16의 28일이며 한 달 전, 환불, 변경 효과 검증과 예산 조정액 추천은 제외한다. 기존 원천 의미를 바꾸지 않고 별도 화면용 `roas-training/1` 계약을 추가한다. 관계와 산식, 시나리오별 생성 규칙과 검산 방법은 [단일 계획과 결과 문서](../../design/roas-training-dashboard.md)에 고정했다.

사용자는 이 계획에 출처와 집행 유형만 추가해 “그거만 반영해서 이번 계획 문서에 적어두고 바로 진행하도록해”라고 요청했다. 뒤이어 “버스광고처럼 직접 노출과 클릭을 측정하기 어려운 유형에이라면 이거말고 그냥 측정하기 쉬운 case로 가자 일단”이라고 개별 정정했다. 이 요청을 구체 계획의 생성과 계약 추가에 대한 실행 근거로 기록한다. 일반적인 작업 시작만으로 신규 데이터 승인을 추정한 것이 아니며, 사용자가 개별 행과 최종 수치 분포를 직접 검수했다고 기록하지 않는다.

정정 후 범위는 구글 검색 2개, 페이스북 피드 1개, 인스타그램 피드 1개, 네이버 블로그 협찬 1개, 인스타그램 인플루언서 1개의 캠페인 6개다. 소셜 출처는 facebook, instagram, naver_blog이며 구글 검색은 별도다. 유형은 search_ads, feed_ads, sponsored_content, influencer_content다. 옥외, 버스와 지하철은 제외한다. 콘텐츠는 제공된 조회 수와 전용 추적 링크 클릭을 가정하며 광고 노출과 콘텐츠 조회를 구분한다. 콘텐츠 링크 클릭률을 광고 CTR로 합산하지 않는다. 구체 식별자와 생성 배분은 구현 선택이며 사용자의 개별 수치 승인으로 표시하지 않는다.

사용자는 여러 하위 에이전트를 통한 병렬 진행도 명시했다. 데이터와 서버, 공통 화면, 문서의 소유 범위를 나눠 구현하고 통합 검증한다. 기존 원천 바이트와 API, 정답 비노출, 공통 자료 완전성, 목표 합계와 하위 집계, 분모 구분, 퍼널, 계측 차이와 전환 지연, 재현성을 검사한다. 현재 절은 범위 확정과 실행 착수 기록이다. 생성 성공이나 검증 완료는 아직 주장하지 않으며 실제 결과를 위 단일 문서에 통합한다. stage, commit, push, 태그, 발행과 외부 광고 집행은 수행하지 않는다.

### 2026-10-23 생성과 자동 검증 결과

공통 계약으로 초기 15사례 각 2,040행과 S15 후속 보고 2,040행, 합계 32,640개 집계를 저장했다. 고유 개별 상세는 공통 마스터 참조 방식의 68건이다. 신규 주문, 세션, 클릭 원본과 리뷰 원문은 각각 0건이며 집계 50,000행과 상세 200건 상한 안이다. data/training-dashboard.json을 manifest.metadata의 public:false로 등록하고 인덱스 1개와 사례/시점별 30개 파생 자산만 공개한다. 기존 원천 41,341행과 파일별 SHA, 기존 ROAS 4개 사례의 계산 API는 보존했다. 신규 metadata 등록에 따른 manifest 전체 해시 변화와 기존 파일 바이트 보존을 구분한다.

[실제 검증](../../../evidence/training-dashboard-20261023/validation.json)은 최신 생성본의 신규 11개, 기존 ROAS 회귀 67개 통과를 기록한다. [독립 Decimal와 정수 검산](../../../evidence/training-dashboard-20261023/independent.json)은 80,909개 통과다. 두 결과의 데이터 해시는 aa0967289de9a659442a81d5aa3c5419d132dd7b1bf9ad48405bc047618348b5다. 검산 과정에서 품절 SKU의 광고 유입 유지, 정상 하위 원장과 계측 일치, 품절 SKU의 결제 시도 0, 핵심/확장 타깃의 구매율 구분을 보완했다.

5개 공통 메뉴와 15개 사례를 /workbench에 연결했다. 타입, 린트와 빌드는 1차 종료 0을 확인했고 최종 화면 조정 후 재검증 중이다. PC 브라우저 검수도 진행 중으로, 아직 완료했다고 기록하지 않는다. 실제 학습 효과와 인과효과, 모바일 검수, 한 달 전 비교는 미검증 또는 제외다. [단일 계획과 실행 결과](../../design/roas-training-dashboard.md#8-실행-결과)에 수량, 수정과 남은 검수를 통합했다. 이전 실행 착수와 과거 검증 결과는 당시 기록으로 보존한다.

최종 통합 결과: 14일 합계를 유지한 캠페인별 일분포 보완 후 신규 11개, 기존 ROAS 67개, 독립 80,909항목, 타입, 린트와 빌드를 통과했다. PC 15개 개요와 60개 상세 메뉴, 필터와 검색, 기준시점 전환을 확인했다. 모바일 검수는 사용자 지시로 제외했다. 최종 source SHA256: `a0e930f977093c853a03f4a51d7f87414b0228bdb92a4d69f9741484011f745b`. 실제 학습 효과와 배포는 미실행이며 [계획 문서의 최종 기록](../../design/roas-training-dashboard.md#최종-통합-검증-2026-10-23)과 Evidence를 따른다.

## 2026-10-23 복합 변화 S16~S18, 추가 생성 직접 요청

사용자는 기존 교육 사례에 여러 변화가 겹치는 현실적인 사례가 없다면 생성해 달라고 직접 요청했다. 이 요청에 따라 단일 변화 중심 S01~S15를 보존하고 같은 계약과 UI에 S16~S18을 추가한다. 사용자 직접 생성 요청을 실행 근거로 삼으며 구현자가 정하는 세부 수치를 사용자가 개별 검수했다고 기록하지 않는다.

범위는 사례당 성과 336행, 보조 분할 1,680행, 도달 24행, 합계 2,040개씩 3사례에 6,120개 신규 집계다. 기존 32,640개 포함 38,760개로 상한 50,000개 안이다. 고유 상세는 최대 60건 추가해 기존 68건 포함 최대 128건이며 상한 200개를 유지한다. 기존 15개와 S15 후속 payload, 기존 원천 41,341행을 보존한다. 신규 주문/클릭/세션 원본과 리뷰는 0건이다. 비교와 조회 각 14일, 동일 출처와 공통 자료, 5개 메뉴, 중립 사례명과 정답 비노출을 유지한다.

S16은 집행 확대와 고비용 유입 구성, 08-21~24 모바일 결제 오류, 08-24 일부 소재 개선이다. S17은 08-17 비효율 캠페인 예산 축소, 08-21 할인 종료, 08-24 고의도 집행 속 ROAS 상승과 매출 감소다. S18은 08-17 협업 상품 구성, 08-20~27 중간 가격 SKU 품절, 08-24 모바일 로딩 지연과 일부 소재 개선이다. 세부 수치와 최종 결과는 구현 후 검산한다. 시점과 비교 집단을 통해 관측과 조건부 대응을 판단하며 실험에 의한 인과효과 확정은 범위 밖이다.

[기존 단일 계획의 복합 확장 절](../../design/roas-training-dashboard.md#9-후속-현실적인-복합-변화-사례-s16s18)에 학습 경로, 정상 비교와 검증을 통합했다. 기존 payload 보존, 계약 완전성, 합계/퍼널/상품/사건 시점, 정답 비노출과 공통 화면을 검수한다. 신규 증거는 evidence/training-mixed-20261023/에 두며 과거 Evidence를 수정하지 않는다. 현재는 실행 착수 상태이며 생성 성공과 검증 완료를 주장하지 않는다. 새 버전, 원격 Git 변경, 배포와 외부 광고 집행은 수행하지 않는다.


구현 수량: 추가 집계 6,120개, 추가 상세 37건, 전체 집계 38,760개와 상세 105건으로 승인 범위 안이다. 신규 3사례의 기준기간은 기존의 약 8배 규모와 요일/일별 변동을 사용한다. 기존 15개와 S15 후속, 기존 상세와 원천의 보존은 별도 검사한다. 결과는 [기존 계획의 구현 결과](../../design/roas-training-dashboard.md#복합-사례-구현-결과-2026-10-23)에 통합했다. 신규 PC 조작은 브라우저 도구 비활성화로 미실행이며 데이터 검산과 구분한다.


## 2026-10-26 DATA-01~03 수정 승인과 실행 범위

사용자는 감사 후 제안한 수정안에 “너가한대로 수정 ㄱㄱ 승인해줄게”라고 명시 승인했다. 승인 대상은 교육용 상품 분리, 복합 사례 초기 예산 중복 제거, 콘텐츠 클릭당 정산 제휴와 비용 범위 명시다. 세부 ID와 문구는 구현자가 결정하며 사용자가 각 필드를 개별 검수했다고 기록하지 않는다.

- 교육용 상품 3개를 EDU-P1~P3, 교육용 자사 상품 1~3으로 분리한다. 가격 25,000/50,000/75,000원, 할인과 모든 성과 수치는 유지한다. 기존 원천 상품 P1A/P1B/P2A와 41,341행은 바꾸지 않는다.
- S16~S18에서 캠페인별 공통 60,000원 초기 설정 참조 6개를 제외하고 기존 240,000원 초기 기록을 사용한다. 후속 420,000원과 80,000원 변경을 유지한다. 기존 상세 105건 자체는 유지하며 잘못된 사례 연결만 수정한다.
- 콘텐츠는 클릭당 정산 제휴로 의미를 확정한다. 클릭 발생일 비용, 고정 협업비/제작비/제품 제공 원가 제외, 상품과 유입 분할 비용의 가상 배분을 명시한다. 집행 유형은 blog_affiliate/creator_affiliate로 정정하고 비용 표기는 유료 마케팅 집행비로 통일한다.
- 신규 관측 0건, 집계 38,760개와 고유 상세 105건 유지. 새 필수 최상위 필드는 추가하지 않고 기존 상품 ID, 유형 값과 상세 values에 승인된 의미를 반영한다. 고정비 협찬 신규 사례와 원천 생성, 배포는 제외한다.

[승인 기록](../../../evidence/training-data-contract-20261026/approval.json), [변경 전 수치와 원천 해시](../../../evidence/training-data-contract-20261026/before.json)를 남겼다. 전수 수치 해시와 원천 바이트, 재생성 일치, API와 독립 검산으로 검증한다. 검증 완료 결과는 교육 대시보드 설계 문서에 이어 기록한다.

추가 승인: 검증 중 S06 EDU-C6의 클릭 0인 일별 8개 행에 비용 4,902원이 남아 있음을 확인했다. 사용자에게 범위와 기간 KPI 보존 조건을 제시했고 “일별 비용 재배분 승인”을 받았다. 해당 캠페인 분석기간의 기기별 일비용과 연결 분할 비용만 재배분한다. 성과 28개와 분할 112개의 spend만 변경하며, 캠페인, 기기, 상품과 타깃별 14일 비용과 모든 비비용 수치를 유지한다. 앞선 모든 수치 보존 범위의 명시적 예외이며 다른 사례에는 적용하지 않는다. [전후 차이](../../../evidence/training-data-contract-20261026/cost-reallocation.json)에 실제 변경을 기록했다.
