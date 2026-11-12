# 실제 Agent QA 인증 게이트웨이, 2026-11-10

## 목적과 활성화 범위

고정 응답을 반환하던 Quick Tunnel Smoke 서버 대신 기존 `scripts/roas/agent-server.mjs`와
`backend/roas/run-api/index.mjs`의 실제 실행 API를 연결한다.
신규 Vercel Preview 게이트웨이는 브라우저 비밀번호를 확인한 후 서명된 요청만 로컬 Agent로 전달한다.
기존 ROAS 데이터, Agent 실행 모델, SQLite는 로컬 PC에 둔다.
Production은 게이트웨이가 동작하지 않도록 차단했다.

```text
QA 브라우저 /workbench
  → POST /api/qa/login (공용 QA 비밀번호)
  → HttpOnly Secure SameSite=Strict 2시간 세션 쿠키, 30일 기기 식별 쿠키
  → POST /api/qa/agent?route=/agent-api/roas/runs
      Vercel: 세션, Origin, 메서드, 경로, JSON 최대 64 KiB 검증
      Vercel: 요청마다 30초 HMAC-SHA256 Assertion + Body SHA256 생성
  → HTTPS Cloudflare Tunnel (운영자 PC의 127.0.0.1:8788)
      로컬: Host, Origin, 서명, 발급자, 대상, 시각 검증
  → 기존 createRunRoutes(): SQLite 실행 예약, 모델 엔진, 조회/취소
  → Vercel: JSON 응답만 전송, 오류/리디렉션/8초 timeout 차단
```

로컬 Agent는 루프백에만 바인딩하며, Trace는 다른 포트(기본 8789)에 유지한다.
게이트웨이 인증이 켜진 경우 공용 /agent-api/session, 레거시 /agent-api/roas/chat 경로는
404로 차단되며, Run API에도 서명 없는 접근은 허용되지 않는다.

## 환경 설정

비밀번호는 **최소 8자**이며 외부 공개 QA 환경에서는 긴 무작위 값을 권장한다. 비밀번호, 각 서명 키는 **32바이트 이상**으로
서로 다르게 설정한다. `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`
명령을 세 번 실행해 예시가 아닌 새 값을 생성한다. 키와 비밀번호는 저장소에 커밋하지 않는다.

| 위치 | 환경변수 | 값 및 의미 |
| --- | --- | --- |
| Vercel Preview, QA 브랜치 한정 | `QA_GATEWAY_ENABLED` | `true` |
| Vercel Preview, QA 브랜치 한정 | `QA_GATEWAY_BRANCH` | 실제 배포한 QA Git 브랜치, `VERCEL_GIT_COMMIT_REF`와 일치해야 함 |
| Vercel Preview, QA 브랜치 한정 | `QA_LOGIN_PASSWORD` | 공용 QA 로그인 비밀번호, Secret |
| Vercel Preview, QA 브랜치 한정 | `QA_SESSION_SECRET` | 세션 쿠키 서명 키, Secret |
| Vercel Preview, QA 브랜치 한정 | `AGENT_QA_GATEWAY_SECRET` | 요청 Assertion HMAC 키, Secret |
| Vercel Preview, QA 브랜치 한정 | `QA_TUNNEL_ORIGIN` | 터널의 고정 HTTPS Origin, 예: `https://random.trycloudflare.com` |
| Vercel Preview, 선택 | `QA_AGENT_MODEL_MODE` | 모델 준비가 확인될 때만 `remote_model`로 지정 |
| Vercel Preview, 선택 | `QA_TUNNEL_ALLOWED_HOST` | 명명된 Tunnel의 정확한 FQDN, trycloudflare 이외의 도메인 사용 시만 |
| 운영자 PC의 `.env.local` | `AGENT_QA_GATEWAY_SECRET` | Vercel과 **정확히 동일**한 HMAC 키 |
| 운영자 PC, 선택 | `AGENT_PORT` | 기본 8788 |
| 운영자 PC, 선택 | `AGENT_TRACE_PORT` | 기본 8789 |
| 운영자 PC, 선택 | `AGENT_UI_ORIGINS` | 기본 `http://127.0.0.1:5173,http://localhost:5173` |

**Vercel 설정에서 Automatically expose System Environment Variables 활성화가 필요하다.**
특히 런타임에 `VERCEL_ENV=preview`와 `VERCEL_GIT_COMMIT_REF`가 없으면
게이트웨이는 `503 gateway_not_configured`로 종료한다.
기존 `VITE_AGENT_API_URL=http://127.0.0.1:8788/agent-api` 설정은
배포 브라우저용으로 사용하지 않는다. 배포된 대시보드는 `/api/qa`로 접근하고,
로컬 개발 화면은 기존 `/agent-api`를 유지한다.
Vercel 인증 보호(Deployment Protection)를 해제하지 않는다.

## 테스트 실행 순서

1. 운영자 PC에서 모델 키, SQLite 경로 및 공유 HMAC 키를 설정하고
   `npm run start:agents`로 서버를 기동한다. 키가 없으면 실제 모델이 동작하는 것으로
   간주하지 않는다.
2. Quick Tunnel은 개발 검증용이다. Cloudflare 계정이 없어도
   `cloudflared tunnel --url http://127.0.0.1:8788 --http-host-header 127.0.0.1:8788`
   명령으로 생성할 수 있다. **Host 헤더 덮어쓰기는 실제 서버의 Host 검증 때문에 필수**다.
   명명된 Tunnel은 운영 중 주소 안정성이 필요할 때 별도 구성한다.
3. 발급된 HTTPS Origin을 위 Vercel Preview QA 브랜치의 `QA_TUNNEL_ORIGIN`에 입력한다.
   비밀번호와 두 서명 키를 포함해 **브랜치 전용 환경변수**를 설정한 다음 Preview 재배포한다.
   로컬 HMAC 키를 모델 키와 혼동하지 않는다.
4. QA Preview의 `/workbench`에서 채팅을 열면 로그인 입력이 나타난다.
   올바른 비밀번호로 로그인 후 실행 API에 질문하고 상태 조회, 취소를 테스트한다.
5. 누락/잘못된 비밀번호, Origin 불일치, 인증 쿠키 위조, 허용되지 않은 경로,
   직접 터널 접근, 서버 중지/재시작을 확인한다. 모델 호출이 필요하면
   실제 API 사용량/키 한도에 대한 별도 승인을 받고 진행한다.
6. QA 종료 시 Vercel의 테스트 환경변수와 배포, 임시 Tunnel을 삭제하고 세션 키를 교체한다.

## 보안 및 알려진 제약

- 브라우저에는 로그인 비밀번호와 서버용 HMAC 키를 저장하지 않는다.
  `x-agent-token`과 사용자가 전달하는 `x-qa-*` 헤더는 게이트웨이의 신뢰 근거가 아니다.
- 브라우저의 Origin과 Host가 정확히 일치하는 POST만 승인하며,
  로컬 Agent에는 미리 허용한 루프백 Origin을 전달한다. Assertion의 HMAC은 메서드,
  경로/쿼리, 본문 해시, 30초 세션 주장을 결합한다.
- 공유 QA 계정은 **개인별 권한 분리나 감사 로그를 제공하지 않는다**. 로그아웃은
  해당 브라우저의 세션 및 기기 식별 쿠키를 모두 제거한다. 세션은 2시간 후 만료되며,
  정상 재로그인 시 30일 기기 식별 쿠키로 이전 실행 소유권을 복원한다.
  명시적으로 로그아웃하면 기기 식별자가 초기화되어 이전 실행 복원이 제한된다.
  강제 만료가 필요하면 `QA_SESSION_SECRET`을 교체해야 한다.
- 로그인 실패 횟수 제한은 Vercel 함수 인스턴스별 보조 제한이다.
  **분산 봇 대응을 보장하지 않으므로** Vercel Deployment Protection을 유지하고,
  외부 QA 공개 시 플랫폼 차원의 WAF / Rate Limiting을 추가해야 한다.
- Quick Tunnel은 재시작 시 주소가 바뀌며 가동시간 보장이 없다.
  Tunnel 도메인 검증이 있어도 PC 비밀키 유출이 탐지되는 구조는 아니다.
- 이번 로컬 통합 테스트는 실제 HTTP Agent/SQLite/HMAC을 사용하되 모델은
  테스트 스텁이다. Vercel 배포, 외부 네트워크 왕복, 실제 모델 비용 발생은 별도 검증이다.

테스트: `node --test tests/agents/integration/qa-gateway.test.mjs`,
`npm run test:agents`, `npm run lint`, `npm run build`.
CI: `.github/workflows/roas-agent-qa.yml`에서 API 경로 변경에도 Agent 회귀 테스트 수행.


## 2026-11-10 보안 보완 및 검증 결과

- 브랜치: `feat/agent-auth-gateway-20261110`. QA Preview에만 로그인/게이트웨이를 활성화하고, `dev`와 Production은 `VERCEL_ENV` 및 `QA_GATEWAY_BRANCH` 검사가 일치하지 않으면 `503 gateway_not_configured`로 닫힌다.
- 브라우저는 `/api/qa/login`으로 로그인한 뒤 HttpOnly 세션 쿠키를 사용한다. `/api/qa/agent?route=...`는 세션, Origin, 경로, 메서드, 본문 크기를 검증하고 HMAC을 새로 생성한다. 브라우저가 보낸 `X-QA-*` 헤더는 전달하지 않는다.
- 모든 전달 요청에는 고유한 `nonce`가 포함된 30초 서명 Assertion을 발급한다. 로컬 Agent는 메서드, 정확한 경로 및 쿼리, 본문 SHA-256, Assertion을 검산하고 유효한 서명이라도 재사용하면 거절한다. 재사용 기록은 로컬 단일 프로세스의 최대 4,096개 메모리 캐시이므로 Agent 재시작을 가로지르는 완전한 재전송 방지 저장소는 아니다. Run 생성 자체는 SQLite의 요청 중복 방지 계약도 적용된다.
- Run Engine, 7개 데이터 도구, SQLite 기록, 기존 ROAS 화면은 유지했다. Gateway 모드에서 레거시 `/agent-api/session`, `/agent-api/roas/chat`은 외부에서 사용할 수 없다.
- 공용 QA 비밀번호의 로그인 제한은 서버리스 인스턴스별 메모리 방어에 불과하다. 실제 외부 공개 전에 Vercel Deployment Protection과 WAF/Rate Limiting을 별도로 설정해야 한다. 브라우저 로그아웃은 쿠키 삭제이며 이미 탈취된 유효한 쿠키의 서버 전역 즉시 폐기는 지원하지 않는다. 강제 종료가 필요하면 `QA_SESSION_SECRET`을 교체한다.

### 로컬에서 확인한 검증

| 검증 | 확인 결과 |
| --- | --- |
| QA 인증, HMAC, 재전송, 로그인 제한, 실제 Run API 통합과 SQLite 회귀 | 관련 통합 및 Run API 테스트 18/18 통과 |
| 전체 Agent 테스트 | 117/117 통과 |
| ROAS 테스트 | 73/73 통과 |
| 교육 데이터 테스트 | 5/5 통과 |
| TypeScript, ESLint, Vite, Agent Trace | 모두 성공, ESLint 기존 경고 2건 |
| 로컬 실제 Agent 프로세스 `--mock`, HTTP, SQLite 스모크 | 잘못된 암호 401, 로그인 200, 비인증 401, Run 생성 202, 조회 200, 서버 중지 503, 재시작 후 조회 200 |

위 스모크는 **실제 로컬 Agent 서버**를 기동했지만 Cloudflare 또는 Vercel 외부망을 통과한 검증이 아니다. 서버 재시작 시 처리 중이던 Run은 SQLite 정책에 따라 중단 또는 차단 상태로 보존될 수 있다. 실제 유료 모델 API 호출은 수행하지 않았다. 중요한 보안 및 회귀 테스트는 `.github/workflows/roas-agent-qa.yml`의 `test:agents` 및 다른 검증 단계에 포함된다.

### 실제 QA Preview 개통 시 필요한 설정

1. 이 Worktree의 Git에서 무시되는 `.env.local`에 로컬 QA용 암호 및 독립 서명 키를 생성해 둔다. 파일을 Git, 로그, 채팅에 올리지 않는다. 새 Windows 셸에서 `npm run start:agents -- --mock`으로 실행한다. 종료 후 실제 모델 허가 없이 `--live` 또는 모델 유료 호출을 실행하지 않는다.
2. 운영자 PC에서 Quick Tunnel을 실행한다: `cloudflared tunnel --url http://127.0.0.1:8788 --http-host-header 127.0.0.1:8788`. 발급된 URL이 `https://<임의이름>.trycloudflare.com` 형식인지 확인한다. PC를 끄거나 Tunnel이 재시작되면 주소가 바뀔 수 있다.
3. Vercel 프로젝트의 **Preview, 해당 Git 브랜치만** 지정해 `QA_GATEWAY_ENABLED=true`, `QA_GATEWAY_BRANCH=feat/agent-auth-gateway-20261110`, `QA_TUNNEL_ORIGIN=<발급한 HTTPS Origin>`을 등록한다. `QA_LOGIN_PASSWORD`, `QA_SESSION_SECRET`, `AGENT_QA_GATEWAY_SECRET`은 Worktree `.env.local`의 값으로 각각 등록하되, 비공개 서버 측 환경변수로만 저장한다. `AGENT_QA_GATEWAY_SECRET`은 로컬과 Vercel에서 같아야 하며 다른 두 값과 같으면 안 된다. Vercel의 자동 시스템 환경변수 노출을 켜서 `VERCEL_ENV`, `VERCEL_GIT_COMMIT_REF`를 사용할 수 있게 한다. `QA_AGENT_MODEL_MODE`는 별도 승인 전 설정하지 않거나 `offline_model_substitute`로 둔다.
4. Vercel QA Preview를 재배포한 뒤 `/workbench`에서 로그인, Run 생성/조회/취소, 비인가 거절, 로컬 Agent 중지와 재시작을 다시 검증한다. 배포 URL과 서버 로그는 비밀키가 포함되지 않도록 확인한다. 외부 QA 인원에게 공유할 때는 Vercel Deployment Protection 방식과 접근 권한을 먼저 정한다.
5. 장기 운영에는 사용자 정의 DNS와 Named Tunnel, 중앙 집중식 로그인 제한, 세션 강제 폐기, 유출 시 키 교체 절차가 필요하다. Quick Tunnel은 단기 QA 검증용으로만 사용한다.

**외부 실연결 상태:** 해당 Worktree에서 Vercel CLI 로그인과 배포 연결 설정, Cloudflare Tunnel 실행 환경은 아직 확보되지 않아 Preview → Tunnel → 운영자 PC 전체 왕복은 검증 전이다. 외부 E2E 완료로 표시하지 않는다.

## dev 브랜치 Preview 배포 (2026-11-10, v0.4.25)

QA 인증 게이트웨이 코드가 dev에 포함되어도 기본적으로 자동 활성화되지 않는다. `config()`가 `VERCEL_ENV=preview` 및 `VERCEL_GIT_COMMIT_REF===QA_GATEWAY_BRANCH`를 검사하기 때문이다. dev Preview에서 로그인하려면 Vercel 프로젝트 환경변수를 **Preview의 dev 브랜치에만** 적용하고 `QA_GATEWAY_ENABLED=true`, `QA_GATEWAY_BRANCH=dev`, `QA_LOGIN_PASSWORD`, `QA_SESSION_SECRET`, `AGENT_QA_GATEWAY_SECRET`, `QA_TUNNEL_ORIGIN`을 설정한다. QA 전용 브랜치의 설정값만 등록하면 dev에서는 `503 gateway_not_configured`가 정상이다. 키는 Git이나 브라우저에 노출하지 않는다.

기존 `feat/agent-auth-gateway-20261110` 브랜치 Preview를 계속 사용한다면 해당 브랜치에서는 `QA_GATEWAY_BRANCH=feat/agent-auth-gateway-20261110`로 개별 설정한다. Vercel 배포 성공은 외부 Tunnel E2E의 성공을 뜻하지 않는다. Tunnel과 로컬 Agent가 실행되어 있어야 한다.
