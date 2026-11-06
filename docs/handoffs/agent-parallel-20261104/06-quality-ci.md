# F 담당 지침, 독립 계약 QA 및 CI 검증 경로

**공통 필독:** 시작 전 `AGENTS.md`, Skills 목록, `.agents/skills/poc-iteration-log/SKILL.md`, `git status --short --branch`, [공통 계약](00-shared-contract.md), [SDD §27~34](../../design/agent-development-sdd.md), [현재 경로 분리 문서](../../design/roas-legacy-separation.md)를 읽는다. 이 작업은 **별도 worktree와 브랜치**에서 수행하며 본문에 정한 파일 밖을 수정하지 않는다. 실제 외부 AI 요청, 비밀키 출력, 결제, 커밋, 푸시는 명시적 별도 허가 전 금지한다.

## 목표

**A~E 구현과 상관없이 공통 계약에 대한 mock 인수 테스트와 CI 진입점을 독립 작성한다.** 기존 ROAS 데이터와 리뷰 기능이 새 Agent 구현으로 달라지지 않았음을 검증하고, 실제 외부 API를 사용하지 않은 상태에서 한도 전환, 수치 근거, 취소/보안 실패를 재현한다.

## 수정 소유권

- 신규 `tests/agents/acceptance/**`, 신규 `.github/workflows/roas-agent-qa.yml`만 수정. 기존 `.github/workflows/dashboard-ux.yml`, `review-classification-validation.yml`, `review-product-metadata.yml` 및 `package.json`과 다른 Agent 테스트 폴더는 수정하지 않는다. CI 명령 통합은 I의 책임이다.
- A~E의 새 구현 모듈이 작업 완료 전 없으면 **공통 계약 기반 테스트를 RED 상태로 준비**하고 현재 실제 실패를 '검증 통과'로 보지 않는다. 단, 현재 안정적인 기존 ROAS/리뷰 회귀는 독립 실행 가능.

## 독립 인수 매트릭스

| 영역 | 반드시 증명할 것 |
| --- | --- |
| 모델 후보 | Gemini 키만, Vercel만, Sail만, 혼합, 키 없음, 잘못된 키, 무료 한도 불명, Sail 모델 기능 미지원 |
| 자동 전환 | Google quota/429→다음 적격 후보, Gateway 잔액 소진→Sail, 같은 후보 재시도 0회, 실패 포함 quick 3/deep 6, 15/180초 한도 |
| 비용 안전 | 무승인 실제 유료 요청 0회, 자동 충전/BYOK 내부 fallback이 의도치 않게 사용되는 경로 차단, API 키 값 비노출 |
| 도구 목록 | 정확히 7개: overview, metric_detail, trend, records, review_summary, review_records, evidence |
| 지표 정확도 | CVR/AOV/ROAS 산식과 분자/분모, 지원 차원, 0분모 null, 미지원 CAC, 그룹 원시 재합산, %/%p 구분 |
| 리뷰/자료 | S16/S17 각 25건, 타 사례 not_provided, 수집일 asOf, 분류 SHA, run 불변 스냅샷 |
| 서버 검증 | 임의 수치/원문/근거 ID, 타 run 근거, 자유 숫자, 잘못된 인과 확정과 반대 근거 누락 |
| run API | 202→GET→완료, 동일 clientRequestId 멱등, 같은 thread 활성 run 1개, 취소 후 신규 호출 0회, 재시작 미완료 중단, SQLite 30일 |
| 외부 인증 | Agent 요청 공용 QA 로그인 필요, 공개 ROAS 화면 유지, Host/Origin/프록시 헤더 위조/CSRF 거부 |
| UI | 요청 후 상태/로그, 모델 전환 이벤트, 취소, 데이터 해시와 대화 복원, 기존 선택기/리뷰 UI 회귀 |

## 테스트 설계 원칙

- **모든 Provider fetch를 mock**으로 대체한다. 테스트 프로세스에서 `.env.local`을 열지 않고, Google/Vercel/Sail/Jev의 실제 키나 API 호출을 사용하지 않는다.
- 테스트 mock으로 구조/실패를 검증하는 것은 허용하되 **새 실제 ROAS 관측값이나 리뷰 원문 데이터를 만들거나 수정하지 않는다**. 기존 검증된 사례와 축약된 합법 fixture를 사용하며 수식 가짜 성공 테스트를 운영 데이터 품질 증명으로 오해하지 않는다.
- quota/잔액 부족, 일시 오류, key 누락, 모델 JSON 미지원/스키마 오류, 동시성 경합, db reopen과 TTL, cancellation을 결정론적으로 재현한다.
- CI는 ROAS Agent 관련 소스/테스트/워크플로 변경 PR와 branch push에서 실행하되 비밀값 없이 통과할 수 있어야 한다. 수신된 PR에서 제공자 키를 노출하거나 live 테스트를 실행하지 않는다.
- CI 체크는 변경된 전체 `tests/agents` 실행, `npm run test:roas`, `npm run test:training`, `npm run lint`, `npm run build`을 포함한다. 기존 `npm run test:agents`가 현재는 `tests/roas/agent.test.mjs` **하나만** 실행한다는 점을 인지하고, I가 신규 테스트 폴더까지 스크립트를 확장하도록 요구한다.
- 테스트 기록에는 실행 명령, SHA/미커밋 상태, 종료 코드, 통과/실패 건수, mock 사용 여부, 미실시 공급자 및 UI 수동 QA를 명시. 실모델 응답 품질과 비용/지연의 실제 실측은 **이번 자동 인수 범위가 아님**.

## 단독 실행 및 인계

- 신규 `node --test tests/agents/acceptance/*.test.mjs`, 기존 `npm test`, `npm run lint`, `npm run build` 실행(가능할 때). CI 파일 문법과 연결할 스크립트 존재 여부 확인.
- A~E가 아직 구현하지 않은 부분은 RED 상태 테스트와 expected 계약으로 보고. 테스트를 건너뛰거나 일시적으로 무효화해 green으로 속이지 않는다. I에게 최종 테스트 명령, CI 포함 필요 파일과 남은 자동화 공백 인계.
