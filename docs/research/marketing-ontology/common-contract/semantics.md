# 핵심 개념·관계·지표 의미

MC-1.0.0 / 2026-10-14. 공통규약은 독자 설계다. W3C 규격이 우리의 제품·지표 정의나 수용 기준을 보증하는 것은 아니다. 안정적 설계 IRI는 `https://example.org/marketing/`를 사용한다. example.org는 발행/해석 서버가 아닌 예약된 설계 네임스페이스다. 확정할 때 namespace 변경 매핑을 남긴다. 정의 변경은 지표·규칙·매핑 버전과 영향 질문/시험을 함께 올린다. 필드명만 변경하면 의미 버전은 유지하고 매핑 버전을 올린다.

## 개념의 정의·범위

모든 원천 유래 개체는 sourceRecord를 통해 원천 행·파일·필드·확보 시각·변환 버전을 추적한다. 정의 개체는 마케팅 원천으로 계수하지 않는다. 아래 이름은 ontology.ttl의 같은 이름과 대응한다.

| 개념 | 정의와 포함 범위 | 제외·필수 의미 | 근거/성격 |
| --- | --- | --- | --- |
| Entity / Subject | 식별 가능한 개체 / 측정 대상 | 이름만으로 동일성 확정 금지 | 공통 설계 |
| Brand / Product | 브랜드 / 원천이 식별한 제품·규격 | 없는 변형·SKU 생성 금지, brand 연결은 확정 ID만 | T01·M11 참고 |
| Campaign | 계정 범위의 광고 집행 단위 | 홍보 제품이 구매 제품을 증명하지 않음; 설정 유효기간·귀속 보존 | T12·M01/M04 |
| Seller / Location | 판매처 / 자사 재고 위치 | 같은 국가 전체 유통·경쟁 내부 재고로 확대 금지 | T08/T22·M13 |
| MarketScope | 국가·카테고리·수집 범위·비교 집합·기간 | 경쟁은 전역 본질적 속성이 아님; 미확인 분모를 시장 전체로 부르지 않음 | Data Cube 참고·설계 |
| MetricDefinition | 이름·정의·단위·자료형·집계·부호·정밀도·버전 | 이름이 같아도 전환·귀속·반품 조건이 다르면 다른 정의 | 공통 설계 |
| Observation | 대상 하나·지표 하나·범위 하나의 값/결측 상태 | 여러 지표 행은 필드별 관측; 원천 행 수와 별도 계수 | Data Cube 참고·설계 |
| SourceArtifact / SourceRecord | 원천 파일 / 파일 안의 행 | 파일 hash와 행 ID를 분리; recordId·fieldPath 보존 | PROV-O 참고 |
| CollectionRun / Transformation | 수집 실행 / 변환 활동·코드 버전 | 수집 누락과 실제 0 구별; 변환은 별도 승인 | PROV-O 직접 상속 |
| TimeInterval / TimeInstant | 측정·유효 구간 / 관측·발생 시점 | 구간 [start,end), IANA 시간대·달력·grain 유지 | OWL-Time 참고 |
| Review / EvidenceSpan | 원문 리뷰 / 원문에 실제 있는 발췌·offset | rating=감성 아님; 한국어 모의 원문은 번역 자료 아님 | T24·설계 |
| Event / Claim | 기록된 사건 / 원천이 말하는 명제 | 사건의 이유 문구는 원천 주장; 사실로 자동 승격 금지 | 설계 |
| Hypothesis / AnalysisResult | 설명 후보 / 계산·조사의 버전 있는 결과 | supports는 인과 확정이 아님; causal_effect는 별도 연구 없으면 금지 | 설계 |

## 관계 계약

개수는 명시 입력 적합성 조건이며 OWL의 개방세계 추론으로 입력을 거부하지 않는다. 관계 이름은 ontology.ttl의 local name이다. 관계와 국가/시간 의미 중 SHACL에 없는 검사는 계산 단계의 필수 게이트다.

| 관계 | 방향·허용 대상·개수 | 연결 근거·국가/시간 조건 | 검사 |
| --- | --- | --- | --- |
| brand | Product→Brand, 1 | T01 brand_id 확정·유효 버전 일치 | ProductShape |
| promotes | Campaign→Product, 1 이상 | T12 target_product_id; 국가 지원·캠페인 유효기간 대조 | CampaignShape + P-ID/P-TIME |
| subject | Observation/Event/Review→Subject, 1 | 광고는 Campaign, 판매는 Product, 시장 분모는 MarketScope | Observation/Review/EventShape |
| scope | Observation/Event/Review/Campaign→MarketScope, 1 | 국가·카테고리·수집 범위 유지; 기간 문맥은 scope 유효구간 | 기본 shape + P-COMPARE |
| member | MarketScope→Product, 0 이상 | 비교 집합 membership, 동일 그룹 A/B와 규격. 없음은 전체시장 무지정 | P-COMPARE |
| metric | Observation→MetricDefinition, 1 | 같은 이름 대신 정의·버전 ID | ObservationShape |
| interval / instant | Observation→TimeInterval 또는 TimeInstant, 정확히 한 종류 | 기간 집계와 snapshot 구별; 원천 날짜/offset 보존 | ObservationShape xone |
| validInterval | Campaign/MarketScope→TimeInterval, 1 | 구간 내 설정만 적용; 중간 변경은 분리 또는 비교 불가 | Campaign/ScopeShape + P-TIME |
| sourceRecord | 원천 유래 Entity→SourceRecord, 1 이상 | record_id exact, 파일 sha256/확보 시각/필드 경로 | ProvenanceShape |
| artifact | SourceRecord→SourceArtifact, 1 | 실제 파일 경로·hash; 파일 존재는 후속 읽기 검증 | SourceRecordShape |
| generatedBy | 원천 유래 Entity→Transformation, 1 | mapping/code version·입력 record/field path, 복제·보완 금지 | ProvenanceShape |
| seller / location | Observation/Event→Seller/Location, 각각 0..1 | 원천 ID 명시 때만. seller는 T08/T09, location은 T22/T35 | 매핑·P-ID |
| evidenceSpan | Claim/Hypothesis→EvidenceSpan, 0 이상 | 원문 body_text[offsetStart:offsetEnd] exact 일치 | EvidenceSpanShape + P-EVIDENCE |
| supports / counters | Observation/Event/Claim/EvidenceSpan→Hypothesis, 0 이상 | 분석자가 명시한 연결·국가/기간·선후·대안; 자동 생성 금지 | P-EVIDENCE |
| input | AnalysisResult→Entity 또는 CollectionRun/Transformation 활동 IRI, 0 이상 | answered이면 사용 입력 필수; asOf 이후 배제 | AnalysisResultShape + P-ASOF |
| supersedes | SourceRecord→SourceRecord, 0..1 | 같은 원천 identity, revision 증가; 이전 버전과 합산 금지 | P-REVISION |

## 공통 정책 식별자

| ID | 실행할 규칙·보류 조건 | 담당 |
| --- | --- | --- |
| P-ID | source system/account/type/id로 원천 식별, 통합 IRI 별도. 이름 근접은 후보로만 유지; 충돌은 quarantine, sameAs 자동 금지 | 매핑·응답 게이트 |
| P-TIME | 발생/측정/유효/확보를 분리. 현지 날짜 구간은 현지 달력의 다음 경계로 처리(24시간 더하기 금지). DST·설정 경계 혼합 시 분할 근거 없으면 비교 불가 | 시간/비교 코드, 후속 |
| P-ASOF | availableAt≤asOf인 최신 revision만 선택. 미확보 2026년9월 보고로 9월말 판단 금지 | 조회, 후속 |
| P-REVISION | 같은 identity·지표의 revision 최고 하나 선택. 월 baseline과 포함된 day detail은 합산하지 않음 | 조회, 후속 |
| P-VALUE | present=실제값(0 허용), missing=결측, unavailable=미확보, not_applicable=해당 없음, incomparable=비교 불가. present에만 value; 불명확 원천 상태는 unavailable와 이유 | SHACL + 매핑 |
| P-AGG | 가산값은 동일 grain·범위·정의·통화의 비중첩 구간만 합산. 가격·재고 snapshot은 합산 금지. unique는 재중복제거 없으면 합산 금지, 지수는 정규화 요청 일치 필요 | 계산, 후속 |
| P-COMPARE | 국가·제품군·규격·시장/판매/귀속 정의·기간 완전성·세금/배송·반품 기준·통화·시간대/달력·수집 범위·설정 일치 모두 확인. 실패하면 비교 불가/자료 부족, 같은 표의 별도 열로만 표시 | 비교, 후속 |
| P-RATIO | CTR=clicks/impressions, CVR=정의별conversions/clicks, CPA=spend/conversions, ROAS=귀속가치/spend, CPM=1000×spend/impressions. ratio는 0–1 표현을 기본으로 하되 CVR/증감의 허용 범위는 정의별. 분모0/결측이면 값 없음·이유, 단순 평균 금지 | 계산, 후속 |
| P-MONEY | 소수 문자열→정확 decimal/정수 스케일. 원천 정밀도 그대로 유지; 통화별 최소단위 반올림은 표시용이며 exact 원값 보존. 환율 없는 국가합계 금지. 음수는 지표별; 손실 있는 배율/반올림은 기록·허용 없으면 보류 | 매핑·계산, 후속 |
| P-EVIDENCE | 원문·관측 사실·추정·계산·LLM 추출·모의 결과 구분; isSynthetic는 별도 boolean. supports/counters·선후로 causal_effect 생성 금지. evidence 삭제 시 자료 부족/혼재로 전환 | 응답/근거, 후속 |
| P-COVERAGE | 수신 행 수와 결측 정규화 행 수 구별. sample 전체시장 확장 금지. partial 기간은 known subtotal만, 완전 합계처럼 표시 금지 | 계산/응답, 후속 |

## 지표 사전

정의 목록·집계·unit·값의 타입은 [d003b-mapping.json](d003b-mapping.json)의 metrics가 단일 기계 정의다. 아래는 업무 해석이다. `m:metric-{id}`는 지표 정의의 패밀리 IRI다. 실제 Observation.metric은 namespace/account/coverage/귀속/유효설정/버전을 확정한 키의 SHA-256를 포함하는 resolved_iri_template으로 구체화한다. 서로 다른 플랫폼의 동명 전환을 같은 정의에 연결하지 않는다. 정의 개체는 스키마 메타데이터다.

| 정의 그룹 | 의미·단위·집계·제외 |
| --- | --- |
| market_units / market_sales | T03 모의 유통 시장 판매량/금액; 자사 수주나 광고 구매와 다름. 비중첩 월 합산, 금액은 같은 통화. 추정 실제 시장은 별도 estimate 정의 |
| market_total | T03 국가·월 분모. 제품별 반복 필드를 하나의 scope 관측으로 묶고 각 원천 field 계보 보존; 값 불일치 시 보류. 6제품 분모를 6번 합산 금지 |
| own_gross_units / own_returned_units / own_net_units | H01 월 자사 판매·반품·순수량; net=gross-returned. 주문수·고객수로 해석 금지 |
| own_gross_sales / own_returns_value / own_net_sales | H01 동일 모의 기간 gross-return=value. 실제 지연 환불·세금·배송·할인·환율 기준은 원천 계약별. 실제 net이 항상 gross-refunds라고 가정하지 않음 |
| ad_impressions / ad_clicks / ad_conversions / ad_spend / ad_value | T13 원천+설정별 정의. campaign 대상이며 구매제품 미확정. conversions는 일반 decimal 허용, D003B만 정수. attributed revenue는 매출 확정이나 증분 효과 아님 |
| offer_price | T08 seller×product×시점의 표시 가격, snapshot. 세금/배송 null이면 가격 비교에 제한, 무료로 보완 금지 |
| inventory_quantity | T22 자사 location×product×시점의 판매 가능 수량, snapshot. 7번 0 관측은 전 시간대 품절 길이 증명 아님 |
| review_rating | T24 척도별 별점, 원문에 연결. 평균은 동일 척도·표본에서 count 가중; 긍정률·제품 품질로 대체 금지 |
| promotion_discount | T09 조건 있는 행사 비율, 유효 기간. 비가산; 실현 판매할인·매출 효과 아님 |

## D003B에만 적용하는 조건

샴푸, 3브랜드·6제품, KR/JP/US, 모의 구매/마지막 클릭7일, 2024-10-01~2026-10-01 월·2026-08-03~08-31 상세, 모든 원문 한국어, 광고전환 정수, 비음수 금액2자리 문자열·KRW/JPY .00, HALF_UP·최소통화단위 오차0. 소셜08-26/27 결측, 할인/품절/회복은 모의 사건이다. 이 조건은 일반 지표 값 범위·반품 정책·언어·시간대 정책을 제한하지 않는다. 원천 reporting_timezone가 국가와 일치하는 것도 D003B 조건이다.

## 논리·재사용 검토

OntoClean 관점의 수동 검토: Product/Brand는 대상 유형, own/competitor는 시장·기간에 의존하는 역할이다. 품절·캠페인 활성·리뷰 부정은 상태/해석으로 클래스 본질에 넣지 않는다. Observation은 정보 개체이며 Product 하위가 아니다. Review는 원문 개체로서 Event 하위로 강제하지 않는다. Claim·Hypothesis·AnalysisResult를 분리해 원문 주장과 계산 결과를 혼합하지 않는다. 이것은 정식 OntoClean 인증/점수나 OWL 일관성 통과가 아니다.

OWL 허용 범위: subclass, domain/range, 명시한 disjointness만 사용한다. inverseFunctional·hasKey·sameAs·자동 인과·전역 경쟁 관계는 사용하지 않는다. 수치 계산/폐쇄세계 입력 검사/버전 선택을 OWL 추론에 맡기지 않는다.

PROV-O는 Entity/Activity와 wasDerivedFrom/wasGeneratedBy를 직접 재사용하되 ontology import는 실행하지 않는다. SKOS definition/prefLabel은 직접 사용한다. Data Cube는 관측/차원 패턴 참고만, qb:Observation 선언·DSD 적합성 주장 없음. OWL-Time은 interval/instant 패턴 참고만, local timezone/calendar/grain은 우리 정의이며 전체 OWL-Time 호환 주장 없음. 전체 SKOS 체계·PROV provenance 완결성·OWL 프로파일 적합성은 별도 미검증이다. 근거 확인 수준은 [매핑 설명](mapping-notes.md)에 있다.
