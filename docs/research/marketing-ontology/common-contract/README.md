# 마케팅 공통 의미 규약 MC-1.0.0

2026-10-14, 설계 기준 버전이며 앱 발행 버전이 아니다. DB 선정은 후속이다. 이번 범위는 **정의·매핑·시험 설계와 명세 검사**다. 승인된 D003B 1,652행도 이번에 재사용·변환·오류 주입하지 않았다.

1. [핵심 의미와 계산·비교 정책](semantics.md)
2. [ontology.ttl](ontology.ttl), [shapes.ttl](shapes.ttl), [스키마 대응·충돌표](schema-crosswalk.md)
3. [D003B 전체 필드 매핑](d003b-mapping.json), [세 원천 계약](source-contracts.json), [매핑 설명·공식 근거](mapping-notes.md)
4. [214행 검증 배치 제안](validation-proposal.md), [기계 판독 선택 명세](batch-selection.json)
5. [13질문·52시험 명세](tests.json), [30질문 커버리지·평가](evaluation.md)
6. [실행 기록](validation.md), [명세 검사](check-spec.py), [JSON Schema 검사](check-json-schemas.mjs), [기계 결과](validation-results.json), [보존 확인](preservation-results.json)

원천의 값 생성·복제·정규화·변환 코드는 없다. 위 JSON의 필드 경로·검사 조건·선택 ID는 명세이며 마케팅 레코드가 아니다. 금액 계산이나 질문 답변의 실질적 통과를 주장하지 않는다.

적용 우선순위는 새 공통규약 → 확정된 원천별 계약 → D003B 조건이다. 초기 [CTI/Neo4j 명세](../ontology-spec.md)는 보존한 이전 설계다. [시간 계약](../temporal-design.md)과 [40유형 스키마](../schema-contract.md)의 의미 원칙을 유지하되, 첫 배치의 직접 필드 구조는 [D003B 스키마](../batches/D003B/batch.schema.json)를 따른다. 충돌은 대응표에서 해결한다. 기존 [연구 인덱스](../README.md), [작업 기록](../work-log.md), [승인 기록](../data-proposal.md)에 연결한다.

완료 수준: 설계 산출물 작성 완료, Turtle 파싱·SHACL 명세 메타검사 수행. 마케팅 데이터의 SHACL 검사·OWL DL 논리 검사·모의 기술 검증·실제 원천 적합성·현업 적합성은 미완료다. 필수 원천 의미가 미확정이면 해당 원천 변환을 보류한다.
