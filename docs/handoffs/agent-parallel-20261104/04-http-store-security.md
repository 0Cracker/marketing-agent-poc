# D 담당 지침, 비동기 HTTP, SQLite 상태 저장과 QA 인증 경계

**공통 필독:** 시작 전 `AGENTS.md`, Skills 목록, `.agents/skills/poc-iteration-log/SKILL.md`, `git status --short --branch`, [공통 계약](00-shared-contract.md), [SDD §27~34](../../design/agent-development-sdd.md), [현재 경로 분리 문서](../../design/roas-legacy-separation.md)를 읽는다. 이 작업은 **별도 worktree와 브랜치**에서 수행하며 본문에 정한 파일 밖을 수정하지 않는다. 실제 외부 AI 요청, 비밀키 출력, 결제, 커밋, 푸시는 명시적 별도 허가 전 금지한다.

## 목표

**run 생성/조회/취소, SQLite 30일 보관, 브라우저별 대화 분리와 Agent 전용 인증 경계를 구현한다.** C의 실행 엔진은 mock으로 주입하고, E의 UI가 이용할 안정적인 HTTP 계약을 만든다. Vercel AI Gateway(API 호출 크레딧)와 외부 QA 로그인 게이트웨이는 서로 별개라는 점을 반드시 지킨다.

## 수정 소유권

- 신규 `backend/roas/run-api/**`, `tests/agents/run-api/**`만 수정. 현재 `backend/roas/agent-http.mjs`, `scripts/roas/agent-server.mjs`, `frontend/roas/agent-client.ts`, `package.json`은 읽기만 하며 실제 서비스 결선은 I에게 넘긴다.
- 기존 loopback Node 서버의 Host, Origin, 세션 CSRF 원칙을 깨뜨리거나 공개 대시보드 로그인으로 확장하지 않는다. `legacy/`, 데이터 스키마와 원천은 편집하지 않는다.

## HTTP 초안 계약, I가 구 경로와 결합

```http
POST /agent-api/roas/runs
Content-Type: application/json
{ "question": "...", "scope": {...}, "threadId": "...", "clientRequestId": "...", "history": [] }
=> 202 { "runId": "...", "executionStatus": "queued" }

GET /agent-api/roas/runs/:runId
=> 200 { "runId": "...", "executionStatus": "running|completed|...", "stage": "...",
         "events": [...], "result": {...} }

POST /agent-api/roas/runs/:runId/cancel
=> 200 { "runId": "...", "executionStatus": "cancelled|...", "stopReason": "user_cancelled" }
```

- 기존 `/agent-api/session` 및 `/agent-api/roas/chat` 동기 API의 경로/이전 요청 호환성을 깨지 않고 I가 결합할 수 있도록 `createRunRoutes({engine,store,authContext})` 또는 같은 책임의 어댑터를 제공.
- GET polling은 상태 조회이며 **같은 질문을 새로 시작하지 않는다**. 202를 반환한 뒤 서버 메모리에서 비동기 실행하고 180초 HTTP 연결을 붙잡지 않는다. 작업 프로세스 재시작 시 미완료 `interrupted`, 완료된 결과는 ID로 재조회, 자동 재실행/자동 재개 금지.
- `clientRequestId`는 동일 입력의 중복 실행 방지, `threadId`는 같은 대화의 활성 run 1개 보장. 전역 QA 계정 전체의 동시 요청/속도/AI 사용량 한도도 적용. 브라우저별 threadId는 개인정보별 접근 격리가 아니며 공용 QA 사용자간 보안 분리를 보장한다고 주장하지 않는다.
- 저장: `runId`, 잠긴 scope와 자료 해시, 전송/모델 경로, 단계, 이벤트, 종료 상태/답변, 실제 발행 근거 ID, 사용량. SQLite를 **실제 SQLite DB**로 구현, 단순 JSON 파일을 SQLite로 부르지 않는다. 관련 Node/라이브러리 지원과 Windows 실행 호환 확인. 종료 후 30일 TTL 자동 정리, run 진행 중 스냅샷 원문 영속 저장은 금지.
- 사용자 표시 이벤트는 도구명, 인자 요약, 상태/건수/근거 ID, 시각/소요 시간, 모델,공급자 대체와 검증 결과만 포함. 원본 전체 tool JSON, 개인정보, 비밀 키, 프롬프트 원문, 숨겨진 추론은 포함하지 않는다.

## 보안 핵심

- 대시보드 자체는 계속 공개, **Agent POST/GET/취소는 공용 QA 계정 인증 필요**. 단순히 프런트 버튼 숨김이나 `x-agent-token`의 존재만으로 외부 QA 인증이 완료됐다고 판단하지 않는다.
- 운영자 PC의 Agent Node 서버는 **127.0.0.1 loopback** 유지. 외부 QA는 공용 로그인 가능한 HTTPS 인증 접근 게이트웨이, 운영자 PC 아웃바운드 터널을 통해서만 접근. 실제 서비스 선택, 터널 생성, 로그인 비밀번호 등록은 사용자 별도 허가 전 금지.
- 인증된 상위 게이트웨이 요청인지 확인하는 신뢰 경계를 설계한다. 임의 `X-Forwarded-User`, `Origin`, 외부 Host header를 신뢰하지 않는다. CSRF, CORS, JSON 제한/공용 계정 사용량 제한을 함께 테스트.
- 생성/조회/취소 모두 인증,실행 ID 접근을 검사하고 실행 중 쓰기/취소 경합을 원자 처리한다. 서버가 사용자별 별도 권한과 개인 감사 기록을 자동으로 제공한다고 주장하지 않는다.

## mock 테스트

- 정상 202→GET 진행→완료, 취소, 중복 POST, 동일 thread 활성 run 2개 거부, 다른 브라우저 thread 충돌 방지, 재시작시 완료 재조회/진행중 중단, 30일 TTL.
- 신뢰되지 않은 호스트/Origin/토큰/게이트웨이 헤더/무인증 GET,POST,취소 차단, 비밀값과 전체 tool JSON 응답 누출 방지, 크기 제한, 잘못된 JSON.
- PC 오프라인/터널 미연결은 서버 기능과 외부 QA 연결 상태를 구별해 오류. 로컬 mock으로만 테스트하며 인증 게이트웨이나 PC 터널 실 개통 금지.
- 단독 `node --test tests/agents/run-api/*.test.mjs`, 공통 회귀/lint/build. C 엔진의 `start/getRun/cancel` 호출/상태 명칭 불일치는 I에게 문서로 전달, 독자 수정 금지.
