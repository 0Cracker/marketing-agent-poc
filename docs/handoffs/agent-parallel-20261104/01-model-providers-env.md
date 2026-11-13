# A 담당 지침, 모델 API 어댑터와 .env 키 자동 인식

**공통 필독:** 시작 전 `AGENTS.md`, Skills 목록, `.agents/skills/poc-iteration-log/SKILL.md`, `git status --short --branch`, [공통 계약](00-shared-contract.md), [SDD §27~34](../../design/agent-development-sdd.md), [현재 경로 분리 문서](../../design/roas-legacy-separation.md)를 읽는다. 이 작업은 **별도 worktree와 브랜치**에서 수행하며 본문에 정한 파일 밖을 수정하지 않는다. 실제 외부 AI 요청, 비밀키 출력, 결제, 커밋, 푸시는 명시적 별도 허가 전 금지한다.

## 목표

**현재 Gemini 키를 보존하면서 사용자가 나중에 Vercel/Sail 키만 `.env.local`에 추가하면 모델 후보로 자동 인식하는 서버 전용 모듈을 구현한다.** Gemini 직접 무료 → Vercel AI Gateway 무료 크레딧 → Sail 공개 모델의 우선순위를 지원하고, quota/429/credits_exhausted는 호출자에게 즉시 대체 가능한 정형 오류로 반환한다. Jev 분류 어댑터도 키가 준비되면 자동 활성화되는 형태로 만든다. 경로 순서와 호출 예산의 **실제 실행 제어는 C 엔진이 담당**한다.

## 수정 가능 영역과 금지 영역

- 수정: 신규 `backend/roas/providers/**`, `tests/agents/providers/**`, 필요시 해당 폴더 내 타입 및 README. 기존 `backend/roas/agent-model.mjs`, `agent-runtime.mjs`, `scripts/roas/agent-server.mjs`, `package.json`은 **읽기 전용**. 구형 모델 코드를 새 모듈로 완전히 옮기기 전에 레거시 동작을 깨지 않는다.
- `.env.local`과 실제 키 값, `frontend/**`, 데이터 원문, `legacy/**`, 다른 담당 모듈은 **수정 금지**. 개인 키를 테스트/샘플에 복제하지 않는다.

## 현행 코드 확인 사실

- 현재 `scripts/roas/agent-server.mjs`는 `--live`에서만 `.env.local`을 로드하고, 기본 시작은 offline substitute다. 이 진입점 수정은 **I 통합 담당**이다.
- `backend/roas/agent-runtime.mjs`는 `GEMINI_API_KEY` 또는 `GEMINI_API_KEY_숫자`를 선택하며 현재 Gemini 전용 runtime. 현 `.env.local`에는 `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`가 비어 있지 않게 존재한다는 점만 확인했다. 실제 값/유효성을 읽거나 출력하지 않는다.
- 같은 Google 프로젝트에 연결된 복수 키는 무료 할당량을 공유할 수 있다. 키 회전으로 무료 사용량을 늘린다고 판단하거나 자동 우회하지 않는다.

## 제공해야 할 모듈 계약

```js
import {createProviderPool} from './backend/roas/providers/index.mjs';
const pool = createProviderPool({env, fetchImpl, clock, onEvent});
pool.eligibleCandidates({role, features, remainingBudget});
await pool.invokeOnce({
  candidate, instruction, input, responseSchema, signal, timeoutMs
}); // 단일 요청 시도만, 내부 재시도 및 숨은 fallback 금지
```

- role: `quick_answer | deep_reasoning | deep_final | first_tool_classifier`.
- 응답: `{output, actualModel, provider, transport, billingBucket, usage, diagnostics?}`. 실패: `error.code`를 `quota_exhausted | rate_limited | credits_exhausted | model_unavailable | model_timeout | model_protocol | provider_configuration | paid_risk | model_failed` 등으로 정규화.
- **Jev Choice**는 처음 도구 선택에만 사용하며 `JEV_API_KEY`(내부 명칭, 공식 인증 방식 확인 필요)가 없으면 eligible 후보에 나타나지 않는다. Jev 자체 무료 크레딧과 Gemini/Sail을 합산하지 않는다.
- 후보 등록은 현재 역할에서 실제 JSON 출력과 도구 선택 프로토콜을 충족하는 모델만 허용한다. Sail 모델명, 응답 schema, 구조화 출력/함수 호출 지원은 공식 카탈로그에 근거해 검증 가능한 방식으로 설정하고, 확인 안 된 모델명을 기본 성공 후보로 가정하지 않는다.
- 공급자 호출 라이브러리는 가능하면 기존 `fetch` 및 Node 내장 기능으로 한정한다. 새 의존성이 필요하면 **I에게 요청**하고 `package.json`을 A가 직접 수정하지 않는다.

## 서버 환경 키 계약

```dotenv
GEMINI_API_KEY_1=
GEMINI_API_KEY_2=
AI_GATEWAY_API_KEY=
SAIL_API_KEY=
JEV_API_KEY=
```

- 위는 **이름만 안내**. 앱 설정 이름 `JEV_API_KEY`는 TypeSafe 실제 인증 규격 확인 후 최종 확정. Google 직접 모델은 현존하는 `GEMINI_API_KEY` 또는 번호 키를 검증해서 선택한다. `AI_GATEWAY_API_KEY`는 공식 Vercel 키명이고 Gateway baseURL은 `https://ai-gateway.vercel.sh/v1`; Sail은 앱의 `SAIL_API_KEY`로 공식 OpenAI 호환 API에 접속한다.
- `process.env` 우선, 이후 저장소 `.env.local`, `.env` 환경 로드는 **서버 진입점 I**에서 한다. A는 받은 env 객체만 읽어 적격 후보를 구성한다. **키 존재만으로 실 잔액/무과금을 보장하지 말고**, 제공자 계정 상태와 호출 제한이 검증되지 않은 후보는 이유를 붙여 스킵한다.
- 일단 키가 추가되면 별도의 강제 `AGENT_MODEL_PROVIDER` 스위치, 소스 수정, 별도 재배포 없이 후보를 등록한다. 실행 중 키 핫리로드는 요구하지 않는다. 서버 재시작 시 반영이면 충분하다.
- Vercel 경유 요청과 Sail 자체 계정의 무료 5달러는 독립 비용 버킷이다. Gateway의 BYOK 또는 내부 자동 fallback이 개발자가 예상한 비용/요청을 추가로 발생시키지 않도록 **기본 비활성/단일 요청 보장**. 강제 예산 통제 수단 확인 전에는 live 전송 차단.
- 오류 `429`는 별도 버킷에서 속도 제한인지 할당량 소진인지 기록하되 동일 후보 자동 retry 없음. `401/403`은 잘못된 키/권한 설정으로 판단해 대체 가능 여부를 엔진에 알린다. `5xx`, 네트워크/timeout은 타입만 전달하고 retry는 엔진 소유.

## mock 테스트와 인수 기준

- 키가 0개, Gemini만 있음, Vercel만 있음, Sail만 있음, 셋 모두 있음, 잘못된 키명, 빈 키, 복수 Gemini 키인 경우의 후보 목록과 실패 이유를 검증한다.
- Google 429→다음 후보 선정을 위한 정형 오류, Gateway 크레딧 부족→Sail, Sail 구조화 출력 불가→선택 제외, 모델 응답 스키마 오류 처리, signal 취소, timeout 및 외부 응답 크기 제한을 테스트한다. 테스트 네트워크를 모두 `fetchImpl` mock으로 바꾸고 실 키를 로드하지 않는다.
- 환경 진단은 `configured:true/false`, `eligible:true/false`, `reason`만 반환하며 비밀값, Authorization 헤더, 실제 입력 프롬프트를 출력하지 않는다. 사전 무료 잔액 확인이 불가능한 경우 `paid_risk`를 우회하지 않는다.
- 단독 테스트: `node --test tests/agents/providers/*.test.mjs` 및 가능한 공통 `npm run test:agents`, `npm run test:roas`, `npm run lint`, `npm run build`. 계약 구현 완료, 사용 계정 실제 연결 미확인, 유료 발생 위험 차단 여부를 별도 보고한다.
- **I에게 인계:** `createProviderPool` 실제 시그니처, 서버 진입점 env 로딩 방법, 공식 API 모델 목록/지원 제약, 기능 호환성 및 무과금 보장에 남은 설정. 키 주입 자체는 하지 않는다.

공식 참고: [Vercel AI Gateway](https://vercel.com/ai-gateway), [Vercel OpenAI 호환 API](https://vercel.com/academy/ai-gateway/existing-ai-stack), [Sail 공식 호환 API](https://sail.computer/support).
