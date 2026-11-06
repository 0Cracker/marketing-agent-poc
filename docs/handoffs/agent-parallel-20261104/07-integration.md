# I 담당 지침, 병렬 산출물 최종 통합, 키만 입력하면 실행 가능한 Agent

**공통 필독:** 시작 전 `AGENTS.md`, Skills 목록, `.agents/skills/poc-iteration-log/SKILL.md`, `git status --short --branch`, [공통 계약](00-shared-contract.md), [SDD §27~34](../../design/agent-development-sdd.md), [구현 인계서](../../design/agent-development-implementation-handoff.md), [현재 구조](../../design/roas-legacy-separation.md)를 읽는다. 실제 모델 API 호출, 결제/계정 생성, 실 외부 터널 개통, 커밋, 푸시는 별도 허가 전 금지한다.

## 목표와 착수 조건

**A~F의 독립 구현과 테스트가 정리된 다음, 기존 ROAS 서비스 경로에 모두 결선하고 'API 키 입력 → 서버 실행 → 질문'의 최소 운영 흐름을 완성한다.** 통합 담당은 각각의 변경을 검토해 기준 브랜치로 순차 수용하며 기존 미커밋 파일과 리뷰 UI/데이터를 보존한다.

- A: [모델 어댑터](01-model-providers-env.md), B: [7개 도구](02-data-tools.md), C: [실행 엔진](03-run-engine.md), D: [HTTP/SQLite/인증](04-http-store-security.md), E: [UI](05-frontend.md), F: [QA/CI](06-quality-ci.md)의 완료 파일과 테스트 보고서를 받는다.
- 합병 전 버전 SHA, 각 브랜치의 dirty 파일, 충돌 여부를 확인. 같은 파일을 병렬 에이전트들이 각각 수정한 경우 무리하게 병합하지 않고 소유권 위반과 계약 차이를 해결한다. **커밋/푸시하지 말라는 현재 지시를 유지하면서 가능한 통합만 수행**하며, 별도 worktree의 미커밋 변경을 원 작업 폴더에 임의 덮어쓰지 않는다.
- A~F가 새 디렉터리만 소유했으므로 기존 서버 파일과 루트 스크립트 수정은 오직 이 단계에서 한다.

## 통합 담당이 수정 가능한 주요 경계 파일

- `scripts/roas/agent-server.mjs`: 환경 자동 로드, 원천 manifest 검사, Provider Pool + Run Engine + Run Store + HTTP 서비스 결선.
- `backend/roas/agent-http.mjs`: 새 run API 연결과 기존 `GET /agent-api/session`, 구 `POST /agent-api/roas/chat` 동작의 호환. 새로운 코드가 필요하다면 작은 module에서 import하도록 하고 기존 보안 정책을 보존.
- `backend/roas/roas-agent.mjs`, `backend/roas/agent-model.mjs`, `backend/roas/agent-runtime.mjs`: 새 7개 도구/실행 경로와 구 내부 코드의 중복을 정리할 필요가 있을 때에만 최소 변경. 다른 레거시 analysis/budget API와 `legacy/` 보관 서비스는 건드리지 않는다.
- `package.json`, 관련 package lockfile, `docs/README.md`, 운영 문서 및 테스트 통합. `data/roas/**`, `shared/roas/**`의 원천 수치나 스키마를 임의 수정하지 않는다.
- Node 22+와 Windows, Vite 8 기반 현재 실행 방식 보존. `node:sqlite` 또는 이미 설치된 패키지의 실제 Windows 호환성을 테스트하고, SQLite가 안 되면 문서에 실패를 기록하며 임의 JSON 저장소로 조용히 대체하지 않는다.

## 중요한 구현 결과: 키 입력만으로 다음 시작부터 공급자 자동 인식

1. **환경 로더를 단일 서버 진입점에 둔다.** 프로세스에 설정된 값 우선, 프로젝트 `.env.local`, 이후 `.env`의 순서로 누락 키만 읽는다. 실 키를 문서/로그에 출력하지 않는다. 기존 `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`가 있더라도 건드리지 않는다. 이 두 키의 존재는 확인했지만 유효성, 모델 지원, 프로젝트 무료 한도는 검증 전임.
2. **비밀 키만 새로 붙이면 후보 자동 인식:** `AI_GATEWAY_API_KEY`(Vercel AI Gateway), `SAIL_API_KEY`(Sail Research), `JEV_API_KEY`(Jev 내부 설정 제안, TypeSafe 인증 문서 확인 후 최종 정리). 누락된 공급자 키는 해당 후보만 `not_configured`; 서버 전체 실행을 중지하지 않는다. 모델 ID 또는 Provider 순서를 사용자에게 매번 수동 설정시키지 않는다.
3. **기본 서버 명령 `npm run start:agents`는 설정이 준비된 경우 실제 Agent API 경로를 이용하도록 구성한다.** 기존 `--live` 옵션을 참조하는 자동화가 있다면 호환성을 테스트하고 문서에서 차이를 설명한다. 서버 기동 자체는 **외부 모델 요청을 보내지 않으며**, 사용자가 질문할 때만 비용/잔액 게이트 후 실제 호출. 테스트에서는 provider mock만 사용한다.
4. 개발자 편의용 **`npm run dev:agent` 단일 명령**을 추가해 Vite 개발 서버와 로컬 Agent 서버를 함께 시작/종료하게 한다. 새 의존성이 불필요하면 Node child_process로 구현하고, Windows PowerShell에서 signal/port 충돌/종료 시 자식 프로세스 잔존 여부를 테스트한다. 별도 `npm run dev`와 `npm run start:agents` 두 명령도 유지한다.
5. 시작 시 **개별 공급자 준비 진단**은 어떤 모델이 후보에 있는지, 키가 구성되었는지, 무료 사용 가능성/지원 기능 검증 상태와 다음 검사 항목만 보여준다. **실제 키 값, 잔액 조회 비밀 응답, 모델 프롬프트, 공용 QA 로그인 비밀번호를 표시하지 않는다.** 무료 잔액이나 무과금 강제 제한이 확인되지 않으면 모델 경로는 적격이 아니라고 알려준다. 'API 키가 있으니 무료 호출 가능' 같은 오판 금지.
6. 기본 라우팅: 역할별 Gemini 직접 무료 → Vercel 무료 크레딧 모델 → Sail의 검증된 공개 모델. quota/429/credits_exhausted이면 **동일 모델 재시도 없이 다음 적격 후보로 바로 전환**, 동일 `runId`와 출처/스냅샷 유지, 전체 quick 3회/15초, deep 6회/180초/최종 슬롯 1회 예약 유지. Jev는 먼저 도구 분류 시도, 불가 시 Flash-Lite 또는 검증된 오픈 모델 분류. 결제수단 등록이나 자동 충전은 금지.
7. `POST /agent-api/roas/runs`는 202 + runId, `GET /agent-api/roas/runs/:id`는 상태와 완료 결과, `POST .../cancel`은 사용자 중지. 공용 QA 계정이 인증돼야 Agent 경로 접근, 대시보드는 공개. **Vercel AI Gateway 모델 API 키는 QA 로그인/터널 설정을 대신하지 않음**. 운영자 PC HTTPS 인증/아웃바운드 터널 개통은 별도 승인 후 수행해야 하며 '키만 입력하면 외부 QA가 접속된다'고 주장하지 않는다.
8. 프런트 화면에서 실제 모델 변경 상태와 각 도구 조회 결과, 수치/인용 검증을 확인하고, ROAS/리뷰/화면 필터/기간이 기존과 정확히 일치하는지 검증한다. 모델이 없어도 AI가 답한 것처럼 가짜 완료를 표시하지 않는다.

## 사용자가 나중에 수행할 최소 설정 안내, 값은 적지 말 것

```dotenv
# 기존 변수의 실제 값을 유지
GEMINI_API_KEY_1=
GEMINI_API_KEY_2=

# 추가 공급자를 사용하려는 경우, 값만 붙여넣기
AI_GATEWAY_API_KEY=
SAIL_API_KEY=

# Jev를 사용할 경우
JEV_API_KEY=
```

위 예시는 이름/형식이며 **실제 `.env.local`을 덮어쓰라는 지시가 아니다**. 사용자는 자신이 발급받은 키 값을 직접 입력, 파일을 저장하고 `npm run dev:agent`를 실행한다. 실제 Sail/Gateway 잔액이 남고 안전한 초과 과금 차단이 가능한지, 각 모델의 JSON/tool schema가 동작하는지는 계정/제공자 상태에 의존한다. **코드 수정 없이 자동 인식이 목표이지만 정상 답변이 항상 보장되는 것은 아니다**. 외부 QA 공개 경로는 별도 gateway/터널 인증 설정이 필요하다.

## 통합 검증, 기능 완료 판정

- A~F 개별 mock 테스트와 `node --experimental-strip-types --test tests/agents/**/*.test.mjs`의 실제 Windows glob 지원 여부를 확인한 뒤, 안전한 Node-compatible 스크립트로 모든 Agent mock 테스트를 실행하도록 `npm run test:agents`를 확장. PowerShell/CI 모두에서 glob이 일관되게 매칭되는지 확인. 기존 ROAS `tests/roas/agent.test.mjs`도 반드시 포함.
- `npm run test:agents`, `npm run test:roas`, `npm run test:training`, `npm run lint`, `npm run build`, 관련 새 CI 실제 실행과 비밀키 노출 검사. 실패가 있으면 원인/해결 여부와 타 담당 구역을 분리 보고.
- **mock 시나리오:** 키 0개, 기존 Gemini만, 나중에 Gateway/Sail 키 추가, 후보가 없는 상태, provider 429 연쇄 대체, 무료 크레딧 0/유료 위험 차단, JSON/tool 미지원, 7개 도구 결과/수치 검증, 중지/복원/DB TTL, 인증 경계, UI 상태, 범위 잠금.
- 외부 Provider 실제 API 접속, 실 Gemini 키/크레딧 사용, 모델 품질과 실제 속도, Vercel 배포/HTTPS 게이트웨이 터널 접속은 이번 mock 검증으로 증명되지 않았다고 표시.
- AI Agent no-ontology 통합 결과의 **실 수치와 리뷰 원천 검산**, source SHA, run 별 evidence, 미지원 CAC, 기기/캠페인별 지표가 기존 대시보드와 일치하는지를 실제 승인된 ROAS 데이터로 재현 검증. 새로운 가상 마케팅 원천을 생성하지 않는다.
- 최종 보고서에 수정 파일과 API 키 준비 상태(키 값 제외), 환경 진단 결과, 실행 명령, mock 통과 건수, 사용자의 추후 키 추가 항목, 실행이 막히는 조건, 실제 모델/외부 QA 미실시를 분리한다.

**완료 정의:** 사용자가 별도의 코드 수정이나 모델 프로바이더 수동 선택 없이 `.env.local`에 지원되는 API 키를 입력하고 `npm run dev:agent`를 실행했을 때, 서버가 비용 안전성이 확인된 적격 모델로 요청을 전송할 수 있게 준비되어 있고, 실패 시 즉시 다음 후보로 전환하며, 7개 도구와 검증된 출처를 사용해 기존 UI에 결과를 반환한다. 실제 유료 과금 위험을 감추거나 계정 인증/외부 터널 연결까지 완료됐다고 주장하는 것은 완료 조건이 아니다.
