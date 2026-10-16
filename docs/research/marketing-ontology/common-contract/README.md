# 마케팅 공통 의미 규약 MC-1.0.0

현재 결과: [공통 데이터 명세 완성 기록](completion-execution.md)과 [통합 검증](runs/2026-10-16-completion-system-3.json)은 `pass / complete`다. 528/528행 적합·345필드 위임 검토·816설정 독립 검산, 기존 52시험·682검증과 D004·D005·HermiT를 통과했다. OOPS 원시 지적 106개는 개별 근거 있는 비적용으로 처리해 미해결 0개다. 사람의 직접 검토·모든 OWL 설계의 보편적 무결성을 뜻하지 않는다. [재실행 안내](local-validation.md)를 따른다.

아래는 위임 이전 실행 이력이다. 과거 ‘공통 사전’ 표현과 0행·198행 적합·106개 미해결 수치를 현재 결과로 읽지 않는다. [이전 통합 회귀](runs/2026-10-16-canonical-system-2.json)는 당시 `fail / incomplete`였으며 과거 보고서를 덮어쓰지 않았다.

2026-10-16 최신 범위 확정: 실제 데이터 연결·실제 공급자 파일럿·실제 자료 적합성 검증은 **프로젝트 범위 밖**이며 후속 과제·승인 대기·완료 조건에서 제외한다. 가상 데이터의 공통 사전·업무 의미·조회/정책·독립 검산·회귀 검증에 집중한다. 이전 미검증/파일럿 계획은 아래에 이력으로 보존하며 [최신 범위 결정](structure-decision-20261016.md)을 우선한다.

2026-10-16 선택 반영: [D005와 공통 사전 역할·선택 결과](structure-decision-20261016.md). ①②③⑤⑥ A안·④ 가상 최소단위 사사오입을 반영한 [재검증](runs/2026-10-16-cq52-decisions-1.json)은 질문52/52·assertion682개·반올림 경계7개와 기존 회귀를 통과했다. 새 전역 사전 게이트는30종528행의 공통 계약 미충족을 검출해fail이며, 전체 시스템은incomplete다. OOPS 외부 재전송은 자동 승인 심사에서 차단됐다. 사용자 업무 정의 확인과 개별 주석/30종 필드 검토 완료는 구분한다. 아래는 선택 이전 결과다.

2026-10-16 D006 최신: [최종 통합 회귀](runs/2026-10-16-cq52-d006-integrated-2.json)에서 **52통과/0실패/0미실행**, assertion682개 pass(실질 답변28·보류/거부24)를 확인했다. 승인된 신규56행/9파일·판매처 선언2건·A16변형/B10메모리검사와 기존 D004·D005/60오류·HermiT를 재검증했고 입력/Git HEAD/refs/index를 보존했다. [대조표](question-readiness.md), [실행 안내](question-execution.md), [사용자 의미 확인표](meaning-review-20261016.md)를 따른다. 전역 필드 계약 차이·현업 확인·OOPS·실제 공급자 적합성은 미완료이며 시스템은 incomplete다. 아래32시험 기록은 D006 이전 이력이다.

2026-10-16 최신: 기존 데이터 재사용 명시 승인 후 [통합 실행](runs/2026-10-16-cq52-integrated-local-1.json)에서52시험 **32통과/0실패/20자료부족**, assertion448개 통과(실질 답변18/보류·거부14)를 확인했다. [실제 대조표](question-readiness.md)와 [수정·검증 근거](question-execution.md#2026-10-16-승인-후-실제-실행)를 반영했다. D004·D005/60오류·HermiT pass, 입력/Git 보존이다. OOPS 재전송은 자동 승인 검토 거절로 이번 사이클 not_run이고 전날5종 지적도 미해결이라 시스템은 incomplete다. [추가3행/16격리분기 제안](../data-proposal.md#d006-cq-a--남은-시험용-최소-자료-제안-미승인생성-0)은 미승인·생성0이다. 아래는 날짜별 과거 기록이다.

2026-10-15 OOPS 후속: 사용자 “Oops해도 돼 수락할게” 명시 승인으로 [정의 제출 승인](oops-approval-20261015.json)을 기록하고 공식 서비스에 정의만 제출했다. [실제 검사](runs/2026-10-15-cq52-oops-approved-1.json)는 HTTP200·Important3종/Minor2종·제안1건이며 HermiT는 통과했다. [지적 검토](question-execution.md#oops-지적-검토)에 영향·수정 방향을 기록했다. 앞선 외부 제출 거절은 승인 전 이력이다. 현재 OOPS는 실행 완료/설계 지적 미해결, 52시험은 별도 재사용 승인 대기로 미실행이다.

2026-10-15 후속 실행 연결: [52시험 대조표](question-readiness.md)의32건은 조회·독립 oracle·전체 assertion 코드 연결,20건은 조건/입력 부족이다. 데이터 통합 검증은 CQ52-READONLY-1 개별 승인 대기이며 전체시험 not_run52를 유지한다. [실행·의미 검토·승인 범위](question-execution.md), [통합 실행기](run-system-cycle.py)를 추가했다. HermiT 실제 검사에서 날짜 OWL range 문제를 수정한 뒤 정의 일관성·25클래스 충족가능성·추론2건을 통과했다. OOPS 외부 제출은 자동 승인 검토에서 거절돼 미실행이다. 기존 배치 회귀와 전체시험 상태를 구분한다.

2026-10-15 우선순위: 온톨로지 구축과 시스템 반복 검증에 집중한다. [검증 사이클·7게이트](verification-cycle.md), [40종 필드 의미표](field-semantics.json), [명세 실행기](run-spec-cycle.py), [승인된 D003B 반복 실행기](run-validation-cycle.py)를 연결했다. 정의 파일의 OWL RL 추론은 부분 논리 검사다. 전체 데이터/질문/회귀 검증 사이클은 완료가 아니다.

2026-10-15 후속: 명시 승인된 [D005](../batches/D005/README.md)의30종528행+T01 지원6행=534행/31파일을 생성했다. [반복 검증](runs/2026-10-15-d005-cycle-verified.json)에서 원천/공통 스키마·의미/관계·독립 oracle·메모리 RDF/SHACL/재조회·오류60/60·재실행/경계·D004 회귀·기존 입력/Git 보존을 통과했다. 기존52시험 전체는 not_run이며 시스템은 incomplete다.

2026-10-14, 설계 기준 버전이며 앱 발행 버전이 아니다. 2026-10-15 사용자가 D004의 214행 및 전체 1,652행 메모리 투영을 별도로 승인했다. 원본 수정·영구 RDF/DB 저장·새 오류 자료는 수행하지 않았다.

1. [핵심 의미와 계산·비교 정책](semantics.md)
2. [ontology.ttl](ontology.ttl), [shapes.ttl](shapes.ttl), [스키마 대응·충돌표](schema-crosswalk.md)
3. [D003B 전체 필드 매핑](d003b-mapping.json), [세 원천 계약](source-contracts.json), [매핑 설명·공식 근거](mapping-notes.md)
4. [D004 승인 범위](validation-proposal.md), [214행 선택 명세](batch-selection.json), [데이터 승인 기록](../data-proposal.md)
5. [13질문·52시험 명세](tests.json), [30질문 커버리지·평가](evaluation.md)
6. [실행 기록](validation.md), [명세 검사](check-spec.py), [JSON Schema 검사](check-json-schemas.mjs), [기계 결과](validation-results.json), [보존 확인](preservation-results.json), [D004 실행 결과](runs/2026-10-15-d004-cycle-final.json)

승인된 D004는 [메모리 RDF 투영](validate-d003b.py)과 [독립 Decimal 계산](calculate-d003b.py)을 실행한다. 영구 레코드별 RDF 산출물은 없으며 52개 답변 시험의 기대값은 그대로 보존하고 전부 `not_run`으로 추적한다. D003B의 사실·계산 단계 통과를 AI 답변 통과로 세지 않는다.

적용 우선순위는 새 공통규약 → 확정된 원천별 계약 → D003B 조건이다. 초기 [CTI/Neo4j 명세](../ontology-spec.md)는 보존한 이전 설계다. [시간 계약](../temporal-design.md)과 [40유형 스키마](../schema-contract.md)의 의미 원칙을 유지하되, 첫 배치의 직접 필드 구조는 [D003B 스키마](../batches/D003B/batch.schema.json)를 따른다. 충돌은 대응표에서 해결한다. 기존 [연구 인덱스](../README.md), [작업 기록](../work-log.md), [승인 기록](../data-proposal.md)에 연결한다.

완료 수준: 40종·유형별457필드·공통10필드·H01별도7필드의 **의미 설계 표**를 작성하고 개념 참조를 정적 검사했다. D003B 10개 T 유형과 H01의1,652행 및 D005 추가30개 T 유형/지원 T01의534행은 각각 승인 범위의 모의 원천 검사를 통과했다. 실제 공급자별 매핑·독립 업무 의미 검토·OWL DL 논리 검사·OOPS·실제 외부 원천 적합성·전체 질문/AI 답변 평가는 미검증이다. 필수 원천 의미가 미확정이면 해당 원천 변환을 보류한다.
## 2026-10-16 로컬 검증 후속

OOPS 외부 REST 전송 경로를 제거하고 고정된 Java 엔진을 로컬에서 호출한다. 설치·실행·범위·승인 기록 형식은 [로컬 검증 안내](local-validation.md)를 따른다. 기존 외부 전송 보류 설명은 당시 이력이며 현재 후속 방향은 로컬 실행이다.

[첫 통합 회귀](runs/2026-10-16-canonical-system-1.json)는 D004·D005·52시험/682개 검증을 통과했고 실행 중 입력/Git 상태를 보존했다. 사전 변환은 **198/528행 스키마 적합**, 독립 원천 검산·메모리 RDF/SHACL/재조회 통과다. 잔여330행·63그룹과 OOPS106개 지적은 미해결로 유지해 전체 상태는fail/incomplete다. 이 결과는 사람의 전체 필드 의미 확인이나 OOPS 예외 승인을 뜻하지 않는다.

[잔여 보완안](canonical-followup-20261016.md)은330행·816개 필드 설정 규칙과 T31 고유 클릭 수신자 해석을 제시한 **승인 대기 제안**이다. 신규 가상값·원천행을 생성하지 않았다. 실제 공급자 자료는 요청하지 않는다. 앞부분의 이전 실행·상태 설명은 당시 이력이다.
