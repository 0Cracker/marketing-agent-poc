# 공통 인터페이스와 파일 경계, A~F 작업 시작 전 필독

상태: 병렬 작업자 간 **목표 계약**, 최종 구현 연결 담당이 소스와 대조해 확정하는 대상.
정본: [에이전트 개발 SDD](../../design/agent-development-sdd.md) §27~34, [구현 인계서](../../design/agent-development-implementation-handoff.md). 충돌 시 최신 확정 SDD-58~60 및 SDD-56~57 우선.

## 1. 불변 아키텍처

```text
기존 ROAS 채팅 UI
  -> 인증된 Agent API (start/get/cancel, idempotency, SQLite)
  -> Run Engine (scope lock, immutable run snapshot, mode choice, deadline)
      -> quick: overview + review_summary 선조회 -> 빠른 생성 모델
      -> deep: Jev 최초 선택, 불가 시 Flash-Lite/적격 분류 모델
               -> 7개 읽기 전용 도구 + Evidence Registry
               -> Gemini 심층 또는 적격 오픈 모델, 후속 조회 반복
      -> 서버 숫자, 범위, 인용 검증 -> completion / partial / withheld
  -> API 상태/결과 저장, UI 상태/실제 이벤트 표시
```

- 사용자 요청에서 명시한 범위가 화면 기본 필터보다 우선하지만, 서버의 지원 범위를 절대 넘지 않는다.
- SDD-57, 실행 시작에 검증된 ROAS/리뷰/분류/메타데이터를 **한 번에 불변 메모리 스냅샷**으로 만들고 모든 도구와 서버 검증이 참조한다. 메모리 스냅샷은 run 종료 후 폐기하고 데이터 파일을 재로드해서 동일 실행에 혼합하지 않는다.
- SDD-56, 대시보드는 공개하되 Agent 요청만 공용 QA 인증을 통과한다. 별도 Vercel **AI Gateway(모델 경로)**와 HTTPS **접근 게이트웨이(사용자 인증)**를 혼동하지 않는다.
- model attempts는 모든 제공자 합산, quick 정상 1 + 예외 2 = 최대 3, 15초, deep 정상 최대 4 + 예외 2 = 최대 6, 180초, 마지막 정상 슬롯 1개는 final 예약. **429/잔액 소진은 같은 모델 재시도 0회, 다음 적격 경로로 즉시 전환**하되 실제 실패 요청과 전환 요청 모두 호출 예산에 계상.
- 외부 모델의 선택 또는 종료 판단은 서버 검증을 대체하지 않는다. `numericClaims` 모든 수치, `evidenceIds`, 주/비교 범위를 각각 서버가 검증. 원인 미확정 `executionStatus:completed, causeStatus:undetermined` 가능.

## 2. 공통 모듈 경계, 소유자마다 별도 파일

계약 표기는 개념적 이름이다. export 함수명은 아래를 우선 채택하고 변경하면 통합 담당에게 변경 사항을 인계한다.

### A, 모델 공급자 풀: `backend/roas/providers/index.mjs`

```js
const pool = createProviderPool({env, fetchImpl, clock, onEvent});
const candidates = pool.eligibleCandidates({role, features, remainingBudget});
// role: quick_answer | deep_reasoning | deep_final | first_tool_classifier
// features: jsonSchema, toolActions, korean, maxOutputTokens
const response = await pool.invokeOnce({
  candidate, instruction, input, responseSchema, signal, timeoutMs
});
// invokeOnce 는 정확히 단일 HTTP/SDK 호출 시도만 수행하고 내부 임의 재시도 없음
// response: {output, actualModel, provider, transport, billingBucket,
//            usage:{inputTokens?,outputTokens?,reportedCostUsd?}, diagnostics?}
// throws typed error.code: quota_exhausted | rate_limited | credits_exhausted |
//   model_unavailable | model_timeout | model_protocol | provider_configuration |
//   paid_risk | model_failed
```

**비용 제약:** `eligibleCandidates`는 키 존재만으로 유료 사용을 허용하지 않는다. 무료 자격/예산/해당 역할 지원과 차단 수단을 확인한다. 잔액 조회 API가 없어도 임의로 '무료 보증'하지 않으며, 제공자 측 quota/free-only 예산 제약을 확인 못 하면 `paid_risk`로 건너뛴다. **다른 키가 동일 Google 프로젝트의 한도를 공유할 수 있으므로 키를 돌려 무료 한도를 우회하지 않는다.** Provider 모듈은 자체 retry/fallback을 수행하지 않고 **C 엔진이** 호출 예산과 후보 이동을 소유한다. Jev는 가능한 경우 별도 분류 입력/출력 어댑터로 제공한다.

### B, 도구 런타임: `backend/roas/tools/index.mjs`

```js
const toolRuntime = await createToolRuntime({
  directory, scope, runId, issuedAt, now, sourceLoader
});
const catalog = toolRuntime.metricCatalog(); // metricCapabilities, 현재 조회 가능 차원
const toolSchemas = toolRuntime.toolSchemas(); // 7개 정확히
const result = await toolRuntime.execute({name, args});
// result: {status, scope, reportingBasis, sourceVersion, dataHash,
//          rows?/periods?/groups?, total?, nextOffset?,truncated?,
//          evidenceIds?,limitations?}
const verifyEvidence = toolRuntime.verifyEvidence({evidenceIds, claims});
// 모든 도구/수치 검증은 toolRuntime 안의 동일 snapshot 사용
await toolRuntime.dispose();
```

정확히 7개 모델 공개 도구: `overview`, `metric_detail`(사용자 표시명 **지표 세부 데이터 조회**, 구 breakdown 대체), `trend`, `records`, `review_summary`, `review_records`, `evidence`. 상태는 `ready|empty|not_provided|pending|error`. 없는 기간/세부 차원, 무효한 ID, 데이터 무결성 실패는 허용된 오류로 분리하고 임의 원천 데이터를 만들지 않는다. 계층 B의 Evidence 원시 검증을 엔진 C의 **최종 수치 주장 전수 검증**과 분리한다.

### C, 실행 엔진: `backend/roas/engine/index.mjs`

```js
const engine = createRunEngine({toolRuntimeFactory, providerPool, store, clock});
const run = await engine.start({question, scope, history, threadId, clientRequestId});
// start: scope 잠금과 실행 ID 생성 후 비동기 분석 시작, 실제 HTTP 연결을 180초 붙잡지 않음
const state = await engine.getRun({runId});
const cancelled = await engine.cancel({runId, reason:"user_cancelled"});
```

의미 있는 상태: `queued|running|completed|partial|withheld|blocked|cancelled|interrupted` 또는 기존 SDD와 정합된 세분 상태. 사건은 실제 `stage,tool,model,provider,transport,billingBucket,count,elapsed,errorCode,evidenceIds`가 있을 때만 기록한다. C가 모델 총 호출 횟수, 에러별 대체, final 슬롯 예약, 종료 판단, numericClaims 검증을 소유한다. 모델 출력이 검증되지 않으면 수치가 포함된 완료 답변으로 반환하지 않는다.

### D, run 저장소와 HTTP 어댑터: `backend/roas/run-api/index.mjs`

```js
const store = createRunStore({dbPath, now}); // SQLite, 종료 후 30일 보존
const routes = createRunRoutes({engine, store, authContext});
// 기본 새 경로, 최종 통합에서 기존 서버에 연결
// POST /agent-api/roas/runs -> 202 {runId,executionStatus}
// GET  /agent-api/roas/runs/:runId -> 상태, 이벤트, 최종 결과
// POST /agent-api/roas/runs/:runId/cancel -> 취소 요청 처리
```

기존 `GET /agent-api/session`, `POST /agent-api/roas/chat` 호환은 통합 단계 I에서 관리. D는 인증 없거나 우회된 요청 차단, 동시 run 제한, `threadId/clientRequestId` idempotency, JSON 크기/호스트/출처 검사와 동일 계정 전역 예산을 담당. 비밀 또는 원본 전체 tool JSON을 공개 이벤트로 반환하지 않는다.

### E, UI

기존 `frontend/roas/agent-client.ts`에 run API 타입/함수를 추가하고 `roas-conversation.tsx`와 `roas-answer.tsx`를 점진적으로 확장한다. 화면별 조건, 기록/검증 결과, 로딩, 취소, 복원, 재접속을 기존 디자인 규격과 일치시키며 UI 계산으로 ROAS 원천 수식을 다시 만들지 않는다. UI는 서버의 실행 상태를 표현하며 모델을 직접 호출하지 않는다.

### F, QA/CI

각 작업자는 담당 폴더별 테스트를 소유하고, F는 통합에 요구되는 별도 acceptance mock과 신규 CI 초안을 소유한다. `package.json`, `scripts/roas/agent-server.mjs`, 기존 전체 테스트 및 공유 데이터 파일은 I가 편집한다.

## 3. 환경 파일 계약, API 키 입력만으로 모델 경로 자동 인식

현재 `scripts/roas/agent-server.mjs`는 `--live`일 때만 `.env.local`을 로드하고, 기본 `npm run start:agents`는 offline substitute다. **I가 이를 사용자 목표로 바꾸되 실 모델 요청은 QA 요청 발생 이전에는 금지한다.**

```dotenv
# 기존: 이미 이름 기준으로 비어 있지 않은 키 2개가 등록돼 있음. 값을 덮어쓰지 말 것
GEMINI_API_KEY_1=
GEMINI_API_KEY_2=

# 사용자가 나중에 아래 키 값만 입력
AI_GATEWAY_API_KEY=
SAIL_API_KEY=
JEV_API_KEY=
```

- 위는 **이름/형식 참고만**이며 실제 `.env.local`을 작성, 초기화하거나 키 값을 읽지 않는다. `JEV_API_KEY`는 내부 앱 설정 명칭 제안이며 TypeSafe AI 실제 인증 규격을 확인한 뒤 어댑터와 최종 인계 문서에 맞춘다. Jev 키가 없으면 허용된 Gemini/오픈 모델 분류 경로로 전환 가능.
- 기본 서버 환경 파일 탐색 순서: **이미 존재하는 process.env 우선**, `<repo>/.env.local`, 그다음 `<repo>/.env`. 설정과 공급자 준비 여부는 외부 요청 없이 사전 파싱하되, 실제 모델 지원/잔액 확인은 계정의 안전한 조회 수단이 있을 때에만 수행. 민감 정보가 포함된 `.env.local`은 서버에서만 로드, 프런트 번들/로그/스크린샷 노출 금지.
- `AI_GATEWAY_API_KEY`는 Vercel AI Gateway 공식 변수, endpoint `https://ai-gateway.vercel.sh/v1`. `SAIL_API_KEY`는 앱이 사용할 변수, endpoint `https://api.sailresearch.com/v1`의 실제 지원을 공식 문서와 연결 테스트(승인 후)로 최종 검증. 모델 ID는 환경별 유효 후보를 확인하고 허위 하드코딩 금지.
- 키를 하나 추가할 때마다 필수 수동 config 수정 없이 서버가 후보를 인식해야 한다. 키 누락/형식 불량/잔액 미확인 시 서버는 죽지 않고 해당 후보만 `unavailable`로 기록한다. 단 사용 가능한 안전 후보가 전혀 없으면 AI 실행 경로는 `blocked`, **오프라인 집계 답변을 AI 완료로 위장하지 않는다**.
- API Key 준비와 **외부 QA의 HTTPS 접근 게이트웨이와 공유 로그인**은 별개다. 키만 넣었다고 외부 접속 터널/인증이 자동 생성되었다고 주장하지 않는다.
- 다른 모델로 넘어갈 때 기존 run 범위, 증거 ID와 snapshot은 고정, 같은 실패 모델 재시도 없음, quick 3/deep 6 전체 상한. 사전 가격/크레딧 안전성을 검증하지 못한 경로는 호출을 시도하지 않는다.

## 4. 공통 수용 기준

A~F가 각 모듈 mock 테스트를 통과하고 I에서 `npm run test:agents`, `npm run test:roas`, `npm run test:training`, `npm run lint`, `npm run build`가 성공해야 통합 기능 완료라고 할 수 있다. CI가 같은 mock 경로를 실행해야 한다. 실계정 모델 응답 품질, 실제 무료 크레딧/유효성, 접속 게이트웨이 공개 QA 연결은 별도 운영 검증이며 코드 완성으로 속이지 않는다.

공급자 공식 참고: [Vercel AI Gateway](https://vercel.com/ai-gateway), [Vercel OpenAI-compatible endpoint](https://vercel.com/academy/ai-gateway/existing-ai-stack), [Sail Research](https://sail.computer/), [Sail 호환 API](https://sail.computer/support).
