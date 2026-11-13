# A~E 통합 검증 결과, 2026-11-04

## 범위와 Git 안전성
- 기준: `5672b54`, 브랜치 `feat/roas-agent-integration-20261104`, 별도 worktree.
- A: `backend/roas/providers/`, 환경변수 감지, 과금 위험 fail-closed.
- B: `backend/roas/tools/`, 기존 ROAS, 리뷰 데이터에 연결된 7개 도구와 Evidence.
- C: `backend/roas/engine/`, 빠른 조회 최대 3회/15초, 심층 조사 최대 6회/180초, 검증 및 모델 전환.
- D: `backend/roas/run-api/`, 비동기 202, 상태 조회, 취소, 중복 요청 차단, SQLite 30일 보관, 공유 QA 인증 경계.
- E: 기존 `frontend/roas/` 채팅 컴포넌트, 진행 상태/모델 전환/도구 기록/복원.
- I: `backend/roas/run-integration.mjs`로 실구현을 연결, `scripts/roas/agent-server.mjs`에 통합 API와 키 감지, `scripts/roas/dev-agent.mjs`로 로컬 동시 기동.
- 원본 A~E worktree와 미커밋 변경사항을 건드리지 않았음. 원본 `.env.local` 미수정. 커밋/푸시/배포/외부 모델 API 호출 없음.

## 검증 결과
- `npm run test:agents`: **86개 통과, 실패 0개**. 공급자, 7개 도구, 엔진, HTTP/SQLite, UI, 실제 HTTP-엔진-데이터-SQLite 통합 테스트 포함.
- `npm run test:roas`: **65개 통과, 실패 0개**.
- `npm run test:training`: **5개 통과, 실패 0개**.
- `npm run lint`: **오류 0개, 기존 연구 코드의 미사용 변수 경고 2개**.
- `npm run build`: **성공**, 일부 Vite 코드 분할 크기 경고.
- `git diff --check`: **통과**.
- Chrome headless에서 실제 성과 현황 UI에 `현재 ROAS 알려줘` 전송, 로컬 mock 응답 **284.7%**, Evidence, 실제 로그 13건, 취소 버튼 완료 시 제거 확인.
- 브라우저 실측으로 찾아낸 GET Origin 요구 문제와 로컬 서버 재시작 시 소유자 식별값 변경 문제 수정, 이후 UI와 신규 자동 테스트에서 재시작 후 답변과 로그 복원 확인.
- 초기 ROAS server-startup 테스트 1건은 로그가 listen 이전에 출력되는 경쟁 조건으로 실패했으며, 로그 시점을 listen 이후로 이동해 해결. 최종 전체 테스트 통과.
- CI: `.github/workflows/roas-agent-qa.yml` 등록, mock 테스트/ROAS/Training/린트/빌드 실행. **실제 원격 CI 실행은 커밋/푸시 금지로 미실행**.

## 로컬 실행
- Node **24 이상** 권장(개발 및 검증 Node 26.13.0), `npm ci`.
- **전체 UI + 검증용 모의 모델:** `npm run dev:agent:mock` 후 `http://127.0.0.1:5173/`. 외부 모델 API 사용 안 함. 5173 포트가 이미 사용 중이면 자동 변경하지 않고 명확히 실패.
- **전체 UI + 일반 서버:** `npm run dev:agent`. 안전성 확인이 없는 모델은 호출하지 않으며, 완료 답변을 지어내지 않고 차단 상태를 표시.
- **별도 기동:** `npm run start:agents`(기본 API 8788), 다른 터미널 `npm run dev`. 프록시 대상 변경 시 `AGENT_PORT`와 `AGENT_API_PORT`를 동일하게 설정.
- SQLite: `.agent-state/roas-runs.sqlite` (Git 제외, 로컬 30일 보관). `AGENT_DB_PATH`로 변경 가능.
- `AGENT_UI_ORIGINS`: 허용된 UI Origin CSV, 기본은 `http://127.0.0.1:5173,http://localhost:5173`.

## API 키, 과금 안전성과 남은 운영 작업
- 작업 worktree에 별도로 위치한 `.env.local`에 사용자가 나중에 입력: `GEMINI_API_KEY` 또는 `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, `AI_GATEWAY_API_KEY`, `SAIL_API_KEY`, `JEV_API_KEY`.
- 환경변수 로딩 우선순위: 이미 설정된 프로세스 환경변수, 현재 worktree `.env.local`, 현재 worktree `.env`. 키 값은 응답/로그로 출력하지 않음.
- **중요한 제약:** API 키 발견 자체는 무료 제공량, 과금 중단, 현재 잔액의 증명이 아니므로, 별도의 운영자 검증 없이 모델 요청은 `paid_risk`로 차단. 즉 **키만 추가했다고 실제 모델 호출까지 자동 허용되는 상태는 아님**. 이는 의도적인 과금 안전 경계이며, 초기 '키만 넣으면 바로 실행' 목표와 남은 차이임.
- 안전 경계의 선택적 입력: `AGENT_BILLING_SAFETY_FILE`을 절대 경로로 설정하고 JSON에 각 공급자별 `verifiedFreeOnly=true`, `enforcedNoPaidUsage=true`, 미래의 `validUntil` (epoch ms), 양수 `remainingUsd`를 제공할 수 있음. **이 파일은 프로그램이 외부 잔액을 실제 검증했다는 뜻이 아니다.** 공급자 계정 차원의 무료 전용 사용 및 유료 요청 차단이 실제로 강제되는지 운영자가 독립 확인한 뒤에만 유효 증명을 기록해야 함. 본 작업에서는 어떠한 공급자 잔액도 확인하지 않았고, 해당 파일도 생성하지 않았음.
- 공유 QA 접속: `AGENT_QA_GATEWAY_SECRET`가 있으면 HMAC 서명된 게이트웨이 검증을 사용함. 실제 HTTPS 게이트웨이, QA 로그인, PC 터널은 **미구축**. 기본 로컬 토큰 경계는 외부 QA 인증이 아니므로 127.0.0.1 외부로 노출하지 말 것.
- 실제 모델 모델 ID, 응답 프로토콜 및 무료 크레딧 사용 가능 여부는 **실 API 호출 금지로 미검증**. 운영 전 별도 승인 후 제한된 검증 필요.
- 기존 `POST /agent-api/roas/chat`는 호환 목적으로 보존하지만 레거시 live 모델 라우팅은 새 모델 예산/안전 경계로 자동 연결하지 않음. 새 기능은 `/agent-api/roas/runs` 사용.
- 공유 QA 계정은 사용자별 접근 제어가 없으며, 각 브라우저의 외부 QA 권한/개인정보 정책은 실제 게이트웨이에서 구축해야 함.

## 2026-11-05 Gemini 최종 응답 형식 보완

- 기존 모델 출력 스키마가 `sections` 내부 필드를 지정하지 않아 Gemini가 `conclusion` 없이 응답했고, 서버가 `invalid_final_schema`로 보류했다.
- 결론과 네 섹션, 수치 주장, 근거 ID, 원인 판단 상태의 구조와 타입을 출력 스키마에 명시했다. 배열 상한을 중첩한 스키마에서 실 API가 HTTP 400을 반환해 수치 주장과 근거 ID 배열의 상한은 기존 서버 검증에서 적용한다. 최종 요청에 성과 요약의 검증 가능한 수치와 근거 ID를 함께 제공하고 빠른 조회는 요청한 수치에 집중하도록 했다.
- Node 26.13.0의 통합 작업본에서 변경 전 회귀 검사 두 건의 실패를 재현했다. 첫 검사는 필수 필드 누락, 둘째 검사는 성과 요약 수치 미제공을 확인했다. 변경 후 `npm run test:agents` 86개, `npm run test:roas` 65개, `npm run test:training` 5개를 통과했다. 린트는 오류 0개, 기존 연구 코드 경고 2개였다. 빌드와 `git diff --check`를 통과했다. 빌드의 폰트 경로와 큰 청크 경고는 남았다.
- 사용자가 무료 등급으로 확인한 첫 Gemini 키와 `gemini-3.1-flash-lite`만 사용했다. 마지막 검증에서는 실행 프로세스의 빠른 조회 한도를 60초로 늘리고 질문당 외부 요청을 1회로 제한했다. 두 요청 모두 HTTP 200과 필수 섹션 5개를 반환했다. 현재 ROAS 질문은 수치 주장 3개가 검증됐으나 본문에 수치 주장으로 등록하지 않은 숫자가 있어 보류됐다. 기간 비교 질문은 355.8% → 284.7%, -71.1%p로 수치와 근거 검증을 통과해 SQLite에서 완료 답변을 조회했다. 완료 답변에 원인을 단정하는 문장도 포함됐다.
- 외부 생성 요청은 이번 수정 과정 전체에서 9회였다. 할당량과 청구 내역은 미확인이다.
- 별도 컨텍스트의 검증자가 실 API 호출 없이 37개 실행을 확인했다. 기존 18개 사례의 두 보고 시점과 S16 비교 범위를 포함하며, 전달한 수치 주장 1,251개가 엔진과 원천 검증을 모두 통과했다. Gemini와 Gateway의 전송 스키마가 동일함을 확인했다.

## 2026-11-06 단일 작업 폴더 반영

- 백업 브랜치 `backup/worktrees-20261106/agent-integration`의 통합 코드를 `marketing-agent-poc`에 반영했다. 기존 리뷰 화면과 패키지 버전 0.4.21을 유지했다.
- 기존 [실모델 E2E 기록 6개](../../../evidence/agent-provider-connect-20261105/)를 원본과 동일하게 보존했다. [진단 스크립트 4개](../../../scripts/roas/diagnostics/)는 저장소 루트의 `.env.local`을 읽는다. `--live`가 있어야 실행하며 새 결과는 `.agent-state/diagnostics/`에 별도로 저장한다. 이 진단은 일반 서버의 과금 확인 절차를 우회한다.
- 에이전트가 리뷰를 사례당 25건으로 제한해 승인된 S16 리뷰를 거부하는 문제를 재현했다. 도구가 기간별 건수와 실제 조회 목록을 대조하도록 수정하고 S16 60건, S17 25건의 조회를 검증했다.
- 에이전트 테스트 90개, ROAS 테스트 72개, 학습 데이터 검사 5개를 통과했다. 린트 오류는 0개이며 기존 경고 2개가 남아 있다. 빌드와 진단 스크립트의 기본 실행 차단을 확인했다.
- 로컬 모의 모델로 HTTP 요청 접수, 답변 검증, 서버 재시작 후 복구를 확인했다. 이번 반영에서 실모델 E2E와 브라우저 조작은 수행하지 않았다. 기존 실모델 E2E에서 발견한 답변 형식과 캠페인별 수치 누락 문제는 남아 있다.

## 2026-11-06 JSON 최종 답변 경로 제거

- 사용자 요청에 따라 최종 답변의 JSON 스키마, sections/numericClaims 봉투, overviewClaims 프롬프트, 전용 verify.mjs와 검증 실패 시 재생성 루프를 제거했다. 기존 기본 엔진과 Jev workflow 모두 최종 생성은 Markdown으로 요청한다.
- 도구 선택용 JSON, 데이터 조회의 원천 검증, Markdown 인용과 수치 검증은 유지한다. 과거 검증 결과와 Evidence는 당시 기록으로 보존한다.
- 기존 JSON 전용 테스트를 제거하거나 Markdown 계약으로 변경했다. 도구 원천 수치 검사는 도구의 verifyEvidence를 직접 호출한다.
- 변경 후 npm run test:agents는 94개 통과, 실패 0개다. 실모델 호출과 브라우저 검증은 이번 작업에서 실행하지 않았다. 기존 미커밋 작업 위에서 진행했으며 새 발행 버전은 부여하지 않았다.
- 독립 검토에서 이번 제거 범위의 회귀 문제를 발견하지 못했고 집중 검사 15개가 통과했다. 전체 린트는 오류 0개였으며 변경 테스트의 새 미사용 변수 경고 2개를 정리했다. 기존 D005 경고 2개는 남아 있다.
