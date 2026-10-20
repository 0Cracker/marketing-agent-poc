# 매핑 계층과 공식 근거

MC-1.0.0 / 2026-10-14. 외부 공식 문서 읽기는 실제 계정·원천 샘플 검증이 아니다. 기존 [44개 소스](../data-source-register.md)의 확인 수준을 유지한다. 이 문서는 추가 근거이며 M01~M44를 다시 번호 붙이지 않는다.

## 세 계층의 경계

| 계층 | 권위·적용 범위 | 명세의 위치 |
| --- | --- | --- |
| 공통규약 | 우리 설계: 식별·단일지표관측·시간·값상태·출처·비교·비가산 정책 | semantics.md, ontology/shapes, P-* |
| 원천별 계약 | 시스템·계정·보고서·API버전별 실제 필드·단위·귀속·반품정의 | source-contracts.json; official/code/design/pending 구분 |
| D003B 프로필 | 승인된 모의 데이터 조건, 실제 공급자 의미를 보증하지 않음 | d003b-mapping.json + batch.schema.json |

전수매핑은 원천11유형의 **모든 properties**를 source_path/type/required/target/rule/loss/evidence로 정의한다. 필드 원본과 필드경로·null marker를 보존하는 것이 정보손실 방지의 조건이다. 이 계약을 쓴 것만으로 보존이 실행된 것은 아니다. 원천레코드 하나를 동일한Observation으로 취급하지 않는다. 시장 분모 반복은 scope 관측으로, 광고 성과는campaign 관측으로, 별점은Review 대상 문맥으로 분리한다.

원천별 계약의 unresolved mandatory_context가 남아 있으면 변환을 멈춘다. 지원되지 않는 상품키·귀속·날짜 경계는 이름 추정/기본7일/계정국가로 채우지 않는다. 모의 마지막클릭7일·정수전환·가격2자리 규칙을 Google/Meta에 확장하지 않는다. 검색의 conversions와 소셜 actions의 purchase 명칭 일치만으로 동일 정의가 아니다.

실제 자사 판매보고의 공급자는 아직 선택하지 않았다. H01 매핑은 **모의 월집계 계약**이다. Shopify Order는 주문의 환불/할인/세금/통화가 별도 필드라는 참고이며 H01이 Shopify export를 재현한다는 뜻이 아니다. 미확인 gross/net 범위와 지연환불 기준을 승인된 모의 산식으로 덮지 않는다.

## 이번에 확인한 공식 원문

확인일2026-10-14. 아래 문서의 갱신일·커밋이 확인되지 않으면 추정하지 않는다. 공식 기능 설명과 우리 구현 선택은 분리한다.

| 근거 | 확인 수준·확인한 사실 | 사용/제외·가정 |
| --- | --- | --- |
| [RDF 1.1](https://www.w3.org/TR/rdf11-concepts/) | W3C 본문, 정보 표현 모델 | 개체·관계·IRI 표현, DB제품 아님 |
| [OWL 2 Primer](https://www.w3.org/TR/owl2-primer/) | W3C 본문, 클래스·속성·논리 표현 | 제한된 subclass/domain/range/disjointness; 입력 오류 거부·변환 자동화 아님 |
| [SHACL](https://www.w3.org/TR/shacl/) | W3C 본문, shapes/data graph·제약 조건 | 직접사용; 이번 meta 검사는 shapes 문서 대상, 마케팅 graph 통과 아님 |
| [SKOS](https://www.w3.org/TR/skos-reference/) | W3C 본문, 개념 라벨·정의 패턴 | definition/prefLabel 직접사용, 전체 개념체계 호환 미검증 |
| [Data Cube](https://www.w3.org/TR/vocab-data-cube/) | W3C 본문, 측정·차원 패턴 | 참고만; qb 선언/DSD검증 제외 |
| [PROV-O](https://www.w3.org/TR/prov-o/) | W3C 본문, Entity/Activity·파생/생성 계보 | 직접 subclass/subproperty, 전체 import/계보완결성 미검증 |
| [OWL-Time](https://www.w3.org/TR/owl-time/) | W3C 본문, 시점/구간 표현 | 참고만; 우리의 IANA/calendar/date 계약과 전체표준호환 동일시 금지 |
| [Google reporting](https://developers.google.com/google-ads/api/docs/reporting/overview) | 공식본문, 리소스·세그먼트·지표 보고 | campaign/date 프로필 후보, 실제 query호환·권한 미검증 |
| [Google v22 metrics](https://developers.google.com/google-ads/api/fields/v22/metrics) | 공식필드본문, cost_micros INT64, conversions DOUBLE와 include 설정 | decimal 전환 허용; micros 배율은 구현계약, 실제 고객통화/귀속확인 필수. v22는 읽은 버전이며 현재 연결버전 선정 아님 |
| [Meta AdsInsights SDK](https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/adsinsights.py) | 공식 main 코드, spend/clicks/impressions/account_currency 문자열, actions/action_values list형 | 필드존재/코드타입만확인; 날짜끝 포함·spend단위·nested action 의미·귀속 기본값 미확정. main 커밋미고정 |
| [Shopify Order](https://shopify.dev/docs/api/admin-graphql/latest/objects/Order) | 공식본문, currentTotalPriceSet·refunds·통화/할인/세금 분리 | 공급자 후보 참고만; 요청한2026-10경로는latest로redirect, 고정버전확인 아님 |

Google 비용 micros는 source-specific scale 정책이다. 통화 최소단위 반올림은 원값을 수정하는 매핑이 아니라 표시/보고정책으로 분리한다. 플랫폼 보고 DOUBLE에서 이미 잃은 정밀도를 원천보다 더 정확하다고 주장하지 않는다. 실제 소수 lexical을 확보하지 못하면 오차/정밀도 한계를 기록한다.

## 방법론·평가 근거와 확인 한계

| 자료 | 확인 수준 | 적용 방식·미검증 |
| --- | --- | --- |
| [LOT](https://lot.linkeddata.es/), [저자 자료](https://zenodo.org/records/2539305), [공식 리소스](https://github.com/oeg-upm/LOT-resources) | 사이트 직접접근 실패, 저자 소개/리소스 확인 | 요구사항·유지관리 흐름을 설계 방향으로 참고. LOT 준수 인증/전체 실행 주장 없음 |
| [NeOn](https://oeg.etsiinf.upm.es/index.php/en/methodologies/59-neon-methodology/index.html) | 이번 직접접근 실패 | 재사용 판단표는 우리의 설계. 전체 방법론 실행 주장 없음 |
| [SAMOD](https://github.com/essepuntato/samod/blob/gh-pages/index.html) | 저자 저장소 페이지 확인 | 작은 모델·질문·승인시험의 반복 방향 참고; 데이터 반복 검증은 승인대기 |
| [NIST IR8008](https://www.nist.gov/publications/toward-ontology-evaluation-across-life-cycle) | 공식 소개·발행정보 확인, 전체보고서 미정독 | 생애주기 평가 참고, 우리의 통과기준을NIST공식기준이라 부르지 않음 |
| [OQuaRE](https://github.com/tecnomod-um/oquare) | 저자 프레임워크 저장소 소개 확인 | 평가축 참고 후보; 프레임워크 실행/점수없음 |
| [FOCA](https://arxiv.org/abs/1612.03353) | 논문소개 페이지 확인 | 평가방법론 후보; 공식FOCA점수·전체평가 미실행 |
| [OOPS!](https://oops.linkeddata.es/) | 공식 도구소개 확인 | 스캔 미실행·명세 업로드없음; 자동스캔이업무의미검토 대체하지 않음 |
| [OntoClean 저자 개요](https://www.loa-cnr.it/Papers/GuarinoWeltyOntoCleanv3.pdf) | 저자 PDF의 rigidity/identity 설명 확인 | 역할·상태와 대상 유형을 구분하는 수동 검토 참고. 전체 메타속성 인증 미실행 |

OntoClean 관점의 수동 역할/상태/대상 검토는 semantics.md에 기록했다. 특정 기업 내부 모델이나 기존 누락된 S/L 근거의 내용을 복원하지 않았다. 초기에 누락된 [근거 목록](../research-status.md)의 S/L 식별자를새 근거로위장하지 않는다.
