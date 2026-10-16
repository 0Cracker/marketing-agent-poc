# 기존 스키마 대응과 충돌 해결

MC-1.0.0. 원천 JSON Schema는 보존한다. 새 RDF는 병행 표현 계약이며 기존 파일을 rewrite하지 않는다.

| 기존 필드/정의 | 새 의미·관계·검사 | 처리·충돌 해결 |
| --- | --- | --- |
| record_id, source refs | SourceRecord recordId + identifierNamespace → artifact | 원천 ID와 통합 IRI 분리; 글로벌 문자열 유일성 전제 제거 |
| is_synthetic | isSynthetic | synthetic와 originKind(관측/추정/계산/LLM/모의) 분리 |
| source_file, manifest hash | SourceArtifact path/sha256 | 관리정보는 추가 마케팅 원천 아님 |
| available_at / temporal.available_at | SourceRecord.availableAt | P-ASOF; 실제 확보일 없으면 미확보 상태 |
| temporal.time_kind/source_grain/series_role | interval/instant + grain/seriesRole | 40유형 구조와 D003B 직접 필드를 adapter별 분리; 값 발명 금지 |
| period / Period | TimeInterval startDate/endDateExclusive | 종료제외, IANA/calendar·grain; 범위 검사 |
| observed_at / written_at / changed_at | TimeInstant timestamp | snapshot/원문작성/변경발생 종류는 매핑별 |
| valid_from/valid_to_exclusive | validInterval 또는 원천 유효 metadata | T01 end가 없으면 open end metadata로 유지, 유한 TimeInterval Shape로 가짜 end 보완 금지 |
| scope_id / MarketScope | 국가·카테고리·수집범위·기간에서 scope identity 파생 | D003B 없는 scope 레코드 생성 금지; 기존40유형 참조를 first batch 필수로 강요하지 않음 |
| MetricValue / Money | Observation value decimal + currency + MetricDefinition | 일반 decimal 정확값; D003B 문자열/정수 제한은 batch profile만 |
| quality.availability / T13 availability | present/missing/unavailable/not_applicable/incomparable | complete는 수집상태이며 값있음으로만 매핑; T08 availability는 판매상태 |
| null boolean | RDF property absence + original null state metadata | false나0로 바꾸지 않음; JSON null은 RDF literal 아님 |
| H01 HistoricalReport multi metrics | field-wise Observation + sourceRecord/fieldPath | 6관측/행; Order/Refund 인스턴스 복원 금지 |
| T03 market_total_value 반복 | scope 대상 market_total 단일 관측 | product 관측 아닌 분모 관측; 반복 출처 전부 계보, 불일치 보류 |
| T12/T13 conversion integer | 일반 지표 decimal, 설정별 정의 | D003B만 정수/마지막클릭7일; Google DOUBLE과 충돌 안 함 |
| T01 country/applicability | catalog Product + applicable countries | KR 확보시각을 제품의 단일 판매국가로 해석 금지 |
| T24 rating/body_text | Review + 별점 관측 + 이후 EvidenceSpan | 별점/감성·원문/해석 분리; 주석은 별도 승인 |
| T35 reason / T09 conditions | Event와 원천 Claim | 원문 이유가 입증 인과효과가 아님 |
| Case / CTI / Neo4j Cypher | 이전 사례 격리·산식·저장소 구현 초안 | 공통규약 필수 개념/지표 아님, 새로운 범위에 자동 적용하지 않음 |

필드별 전수 대응은 [JSON 매핑](d003b-mapping.json)에 정의한다. [40유형 계약](../schema-contract.md)은 확장 요구 목록으로 유지하며 T01/T03/T12/T13/H01/T08/T22/T24/T09/T35/T36만 이번 형식 모델에 직접 연결한다. T01–T40 중 나머지30유형의 원천 매핑·SHACL은 지원 밖이다. H01은 40유형 밖의 별도 월별 집계 유형이다. JSON Schema는 lexical/required/enum, SHACL은 RDF 관계/값 상태/기본 기간, 정책 코드는 cross-record 집계·원문·시점·비교를 담당한다.

[필드 의미표](field-semantics.json)는 T01–T40의 유형별457항목, 공통10항목, H01 별도7항목을 경로·역할·개념 참조·단위 계약·시간/범위 플래그·원천 후보와 함께 전수 열거한다. 이는 **설계상 정의**이며 `원천 확인 대기`를 자동 통과로 세지 않는다. 동일 이름도 측정 단위·귀속·기간·범위가 일치한다고 가정하지 않는다. D003B 10개 T 유형과 H01의 직접 필드 매핑만 별도 데이터 적합성을 검사했다. 원천이 없는 나머지30개 유형의 공급자별 경로·값·ID 관계는 미확정이다.

SHACL에 표현한 제약이 모두 실행됐다는 뜻은 아니다. 영구 ID의 충돌, 정확한 원문 발췌, 시점 이후 유입, 원천 간 귀속/설정, 비율 계산·market_total 중복 제거는 후속 코드 검사다. TTL의 value 타입은 decimal로 통일하되 원천 정수/소수 lexical과 scale는 SourceRecord의 필드 메타데이터/보존된 원본으로 추적한다.

2026-10-16 ①A 선택 후 [D005→공통 사전 검사기](check-d005-dictionary.mjs)를 추가했다. D005의 A/B/C `normalize()`는 D005 내부 계약으로의 변환이며 전역 사전 변환 완료를 뜻하지 않는다. [실제30종528행 검사](runs/2026-10-16-cq52-decisions-1-dictionary.json)는 전역 필수·조건부·형식 차이를 검출해fail이며, 공통 출처/시각/품질 구조와 유형별 누락을 보고한다. 원천을 보존한 명시적 변환과 의미 확인이 필요한 매핑 보류를 구분한다. 실제 공급자 매핑·실제 자료 적합성은 여전히 미검증이다. [구조 비교·결정](structure-decision-20261016.md)을 따른다.
