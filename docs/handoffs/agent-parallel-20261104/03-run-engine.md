# C 담당 지침, Agent 실행 엔진과 독립 수치 검증

**공통 필독:** 시작 전 `AGENTS.md`, Skills 목록, `.agents/skills/poc-iteration-log/SKILL.md`, `git status --short --branch`, [공통 계약](00-shared-contract.md), [SDD §27~34](../../design/agent-development-sdd.md), [현재 경로 분리 문서](../../design/roas-legacy-separation.md)를 읽는다. 이 작업은 **별도 worktree와 브랜치**에서 수행하며 본문에 정한 파일 밖을 수정하지 않는다. 실제 외부 AI 요청, 비밀키 출력, 결제, 커밋, 푸시는 명시적 별도 허가 전 금지한다.

## 목표

**SDD-60의 자동 모델 대체, quick/deep 상태 기계, Jev 최초 도구 선택, Gemini 또는 적격 Sail 심층 분석, 독립 수치 검증을 실행 엔진 하나에서 관리한다.** 공급자 구현 A, 데이터 B, HTTP 저장 D는 주입된 mock 인터페이스로 호출하므로 완성을 기다리지 않고 개발한다.

## 수정 가능 영역

- 신규 `backend/roas/engine/**`, `tests/agents/engine/**`. 다른 파일은 읽기만 한다. `backend/roas/providers/**`, `backend/roas/tools/**`, `backend/roas/run-api/**`, `scripts/roas/agent-server.mjs`, `backend/roas/roas-agent.mjs`는 수정하지 않는다.
- [공통 계약](00-shared-contract.md)의 `createRunEngine({toolRuntimeFactory,providerPool,store,clock})`, `start/getRun/cancel`를 구현. 별도 provider/mock store 없이 단독 테스트 가능해야 한다.

## 기본 실행 흐름

1. `start`에서 정규화된 주 분석 범위, 승인된 비교 범위, threadId, clientRequestId를 잠그고 실행 상태와 runId를 보관. 동일 스레드의 중복 요청/실행 직렬화는 D 저장소와 협력한다.
2. B가 제공하는 단일 불변 메모리 스냅샷을 확보한 뒤 자료 SHA, 지표 조회 가능 카탈로그와 보고 기준을 확보.
3. **quick**: 질문 내용과 무관하게 B의 `overview`와 `review_summary`를 함께 선조회. 검증된 집계와 출처, 제공 상태를 모델의 단일 정상 생성 호출에 전달. 정상 1회, 예외 전환/수정 2회 이내, 15초 내 종료.
4. **deep**: Jev Choice가 가용하면 최초 도구 선택 시도, 없거나 실패/불확실하면 Flash-Lite 또는 적격한 Sail 구조화 분류 모델을 같은 예산 안에서 사용. 모델이 선택한 7개 도구를 B에서 실행. 상호 독립 조회는 승인된 고정 스냅샷으로 병렬화하고, 같은 요청 중복과 과도한 토큰/페이지를 제어.
5. Gemini 심층 모델 또는 역할 적격 Sail 모델이 추가 도구/종료를 판단한다. `gemini_sufficient`, `insufficient_evidence` 종료의 의미를 지키고 근거 부족 종료 후 신규 도구 조회 금지. 정상 호출 최대 4회 가운데 마지막 1회는 최종 답변 예약, 전체 예외 2회 더해 최대 6회, 180초 내.
6. 최종 모델 응답에는 `numericClaims[{metric,value,unit,period,evidenceIds}]`와 인용을 요구한다. **서버가** 기초 원천값과 모든 수치, %, %p, 분자/분모, 기간, 범위 및 본문 자유 숫자와 정형 숫자를 독립 검산한다. 단순 ID 존재만으로 원인/숫자를 통과시키지 않는다. 인과 불확실 시 `completed + causeStatus:undetermined`; 일부 근거만 검증되면 `partial`, 핵심 SHA/범위 불일치 시 `withheld`.
7. 사용자 취소나 15/180초 마감 시 신규 조회,모델 호출을 즉시 중지하고 가능한 부분 결과만 검증 후 보존한다. 서버 재시작으로 중단된 실행의 자동 재개는 금지한다.

## 모델 자동 대체 책임, A와 구분

- **C만 모델 시도 예산을 예약/차감**하고 A의 `eligibleCandidates` 및 `invokeOnce`를 순서대로 호출한다. A는 각 호출을 정확히 1회 시도한다.
- 공급자에 429, 무료 한도 소진, credits_exhausted 응답이 오면 **해당 후보는 같은 요청에서 재시도하지 않고** 다음 적격 후보로 바로 이동. Google 직접 → Vercel Gateway → Sail 순. Jev의 최초 도구 분류 우선 원칙은 별도.
- 예산이 남은 상황에서 동일 run/model 단계만 재시도하며 이미 확보한 ROAS/리뷰/근거,도구 결과를 버리거나 처음부터 새로 조사하지 않는다. 실제 실패 시도와 성공 대체 시도 모두 예산에 포함. `5xx` 등 일시 오류의 제한적 1회 재시도 정책은 quota 오류와 분리한다.
- provider/model 역할별 JSON schema와 toolActions 지원 확인, 컨텍스트 크기/응답 검증, 누락된 모델을 성공으로 기록하지 않음. 공급자 내부 fallback이 숨은 호출/비용을 일으키면 A가 금지하도록 계약 테스트한다.
- 모든 후보가 없거나 무료 크레딧 검증 실패 시 `blocked + models_unavailable`; **기존 offline substitute가 실제 AI 답변인 것처럼 성공 반환하는 경로 금지**.

## 테스트와 인계

- quick 정상 1/최대 3, deep 정상 최대 4/최대 6, 마지막 정상 호출 예약, Jev 호출 선행/미가용 0회, Jev 실패 1+Flash-Lite 예외 1, 모델 순차 전환, 동일 후보 quota 재시도 0회.
- `429` Google→Gateway→Sail, 각 후보 미지원/키 없음/크레딧 0/paid_risk/시간 종료 및 호출 상한별 종료 상태. 중간 모델 전환 시 같은 run/snapshot/evidence와 숫자 검증 유지.
- 도구 오류 `empty`와 `error` 구분, 일반 도구 자동 재시도 0회, `insufficient_evidence` 후 새 조회 없음, 숫자 인용 위조/분모 0/잘못된 %p/근거 밖 숫자 차단.
- 로그/상태는 실제 실행 순서로만, 내부 추론/키/전체 모델 프롬프트 저장 금지. 단독 `node --test tests/agents/engine/*.test.mjs`, 공통 회귀/lint/build 실시. A/B/D에 필요한 추가 입력을 무단 변경하지 말고 I에게 계약 변경 요청으로 인계한다.
