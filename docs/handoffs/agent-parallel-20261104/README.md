# ROAS AI Agent 병렬 구현 작업 지침서

작성: 2026-11-04, Asia/Seoul
상태: 작업 분할 및 인계 문서, 실제 구현과 실 API 호출은 아직 진행하지 않음.

## 결론과 실행 순서

**6개 작업을 병렬 수행하고, 통합 담당 1명이 마지막에 연결한다.** 먼저 [공통 계약](00-shared-contract.md)을 모든 담당이 동일하게 읽고 동결한다. 각 담당은 원칙적으로 지정 파일만 변경한다. 작업 간 의존성은 mock과 인터페이스로 분리한다. 마지막 통합 담당이 서버 진입점, package.json 및 실제 연결 작업을 일괄 책임진다.

| 순서 | 문서 | 담당 | 병렬 가능 | 수정 소유권 |
| --- | --- | --- | --- | --- |
| A | [01-model-providers-env.md](01-model-providers-env.md) | Gemini, Vercel, Sail, Jev 어댑터, .env 기반 자동 인식과 무료 한도 보호 | 예 | `backend/roas/providers/**`, `tests/agents/providers/**` |
| B | [02-data-tools.md](02-data-tools.md) | 불변 원천 스냅샷, 7개 도구, 지표 사전, Evidence Registry | 예 | `backend/roas/tools/**`, `tests/agents/tools/**` |
| C | [03-run-engine.md](03-run-engine.md) | quick/deep 실행, 모델/도구 선택, 전체 호출 예산, 서버 수치 검증 | 예, mock 계약 사용 | `backend/roas/engine/**`, `tests/agents/engine/**` |
| D | [04-http-store-security.md](04-http-store-security.md) | run HTTP, SQLite, 중복 실행, 취소, 인증 경계 | 예, mock 계약 사용 | `backend/roas/run-api/**`, `tests/agents/run-api/**` |
| E | [05-frontend.md](05-frontend.md) | 기존 채팅에 run 진행, 도구 로그, 취소, 대화 복원 추가 | 예, mock HTTP 사용 | `frontend/roas/**`의 명시 파일 및 `tests/agents/ui/**` |
| F | [06-quality-ci.md](06-quality-ci.md) | 독립 QA 테스트와 CI 새 워크플로 초안, 회귀 검증 | 예, 독립 mock 기반 | `tests/agents/acceptance/**`, 신규 `.github/workflows/roas-agent-qa.yml` |
| 최종 | [07-integration.md](07-integration.md) | A~F 병합, 실제 실행 진입점 결선, 전체 회귀와 운영 인수 점검 | **A~F 후 순차** | `scripts/roas/agent-server.mjs`, `backend/roas/agent-http.mjs` 필요 변경, `package.json`, 최종 연결과 문서 |

**중요:** 작업 A~F는 서로의 원본 파일을 수정하지 않는다. 기존 `backend/roas/agent-model.mjs`, `agent-runtime.mjs`, `roas-agent.mjs`, `agent-http.mjs`는 공통 레거시 접점으로 보고 A~F에서 직접 편집하지 않고 새 경로에 구현한다. 구형 ROAS 채팅 동작 보존과 공통 진입점 개편은 통합 담당 책임이다. 다른 사람의 미커밋 문서, 리뷰 자료, UI 수정도 보존한다.

## 공통 착수와 Git 격리

- 시작 전 **`AGENTS.md`, Skills 목록, `.agents/skills/poc-iteration-log/SKILL.md`, `git status --short --branch`**, [SDD](../../design/agent-development-sdd.md) §27~34, [기존 전체 구현 인계서](../../design/agent-development-implementation-handoff.md), [최근 ROAS 구조 분리](../../design/roas-legacy-separation.md), [공통 계약](00-shared-contract.md)을 읽는다.
- 실제 소스는 `backend/roas/`, `shared/roas/`, `scripts/roas/`, `frontend/roas/`, `tests/roas/`에 있다. 오래된 `backend/` 루트 및 `frontend/workbench/` 경로 지시는 현재 구조에 맞게 해석한다. `legacy/`는 보관용이며 새 서비스에서 import하지 않는다.
- **각 Agent는 별도 Git worktree와 작업 브랜치를 사용**한다. 기존 작업 폴더의 브랜치를 타 Agent가 체크아웃하거나 리셋하지 않는다. 문서/미커밋 변경이 커밋되지 않은 상태이므로 새 worktree에는 파일이 자동으로 따라오지 않는다. 필요한 지침 문서를 승인된 방법으로 복사하거나 읽기 전용으로 제공하고, 기준 커밋과 누락된 원천을 확인한다.
- 브랜치 예: `feat/roas-agent-providers`, `feat/roas-agent-tools`, `feat/roas-agent-engine`, `feat/roas-agent-run-api`, `feat/roas-agent-ui`, `test/roas-agent-acceptance`, 최종 통합 `feat/roas-agent-integration`. 작업자는 파일 소유권을 어기지 않는다.
- **커밋, 푸시, 배포, API 키 생성/등록, 결제/자동 충전, 실제 외부 API 호출은 별도 명시 승인 전 수행하지 않는다.** 현재 Gemini 키가 존재해도 연결/모델 호출은 테스트에서 금지하고 모두 mock으로 검증한다.

## 키 입력만으로 준비되는 목표 상태

현재 로컬 `.env.local`에는 이름 기준으로 `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`가 비어 있지 않게 존재한다. 실제 값, 유효성, 같은 프로젝트에 속하는지는 확인하지 않았다. **키를 읽거나 내용을 로그에 출력하거나 문서로 복사하지 않는다.**

사용자가 나중에 `.env.local`에 `AI_GATEWAY_API_KEY`, `SAIL_API_KEY`(원할 때 `JEV_API_KEY`)를 추가하면 서버가 구성된 적격 경로를 자동 인식하도록 구현한다. 별도의 필수 모델 라우팅 플래그나 코드 수정이 없어야 한다. 선택 모델 ID/정형 출력 지원 검증, 한도와 비용 안전성 검증에 실패한 경로는 명확한 이유로 제외한다. `npm run start:agents` 명령으로 서버가 실제 Agent 모드 준비 여부를 보고하도록 최종 연결한다.

**제약:** API 키 입력만으로 실제 무료 잔액, 계정 과금 제한, 모델 기능, HTTPS QA 접속 게이트웨이와 PC 터널이 자동 보장되지는 않는다. 이 항목은 시작 시 진단하고 안전하게 차단하거나 추가 설정 작업으로 알린다. 모델 API 키와 외부 QA 접속 로그인은 **서로 다른 보안 경계**다.

## 완료 인계 규칙

각 담당은 수정 파일 목록, 계약 및 테스트 결과, 잔여 제한, 실제 호출 미실행, 데이터/키 변경 유무를 남긴다. 공통 인터페이스를 바꿔야 하면 자기 모듈에서 독단적으로 바꾸지 않고 최종 통합 담당에게 **명시적 계약 변경 요청**을 전달한다.

각 담당은 최소 단위 mock 테스트와 `npm run test:agents`, `npm run test:roas`, `npm run test:training`, `npm run lint`, `npm run build`를 가능한 환경에서 수행한다. 새 코드와 원인 관련 테스트 실패는 해결하고, 병렬 미통합으로 실패한 경우와 기존 기준선 실패는 근거를 분리한다. 중요한 자동 검사는 CI에 들어가야 한다. A~F의 개별 진행 상태는 테스트 합격이 아니라 각각의 독립 계약 완료로 구분한다.
