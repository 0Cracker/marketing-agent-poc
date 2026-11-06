# E 담당 지침, ROAS 기존 채팅의 비동기 Agent UI

**공통 필독:** 시작 전 `AGENTS.md`, Skills 목록, `.agents/skills/poc-iteration-log/SKILL.md`, `git status --short --branch`, [공통 계약](00-shared-contract.md), [SDD §27~34](../../design/agent-development-sdd.md), [현재 경로 분리 문서](../../design/roas-legacy-separation.md)를 읽는다. 이 작업은 **별도 worktree와 브랜치**에서 수행하며 본문에 정한 파일 밖을 수정하지 않는다. 실제 외부 AI 요청, 비밀키 출력, 결제, 커밋, 푸시는 명시적 별도 허가 전 금지한다.

## 목표

**기존 성과 현황의 ROAS 채팅 UI에서 질문 후 runId로 비동기 분석을 조회하고, 모델 자동 전환, 7개 도구, 수치 검증 과정을 확인하고 중지할 수 있게 한다.** 새 채팅 페이지/전체 화면 리디자인을 하지 않고 기존 데이터 필터 및 UI 디자인을 유지한다.

## 수정 가능 파일

- `frontend/roas/agent-client.ts`, `frontend/roas/roas-conversation.tsx`, `frontend/roas/roas-answer.tsx`, 필요시 이 영역의 전용 CSS 및 하위 컴포넌트, 새 `tests/agents/ui/**`만 담당.
- 현재 `frontend/roas/training-dashboard.tsx`의 화면 선택/필터 상태는 **읽기 전용**, 불가피한 연결 변경은 I와 계약으로 인계. `shared/roas/**`, `backend/**`, `scripts/**`, `package.json`, `legacy/**`는 수정 금지.
- 현재 `createAgentClient`에는 동기 `roasChat`과 구 analysis/budget 클라이언트가 공존한다. ROAS 새 run 메서드를 **추가**하고, 구 메서드와 타입의 다른 소비자는 제거하지 않는다.

## 새 API 계약

```ts
startRoasRun(payload): Promise<{runId:string;executionStatus:string}>
getRoasRun(runId): Promise<RunState>
cancelRoasRun(runId): Promise<RunState>
```

통합 전에는 D에서 정의한 `POST /agent-api/roas/runs`, `GET /agent-api/roas/runs/:runId`, `POST /agent-api/roas/runs/:runId/cancel`을 mock HTTP로 시험. 실제 GET/POST 경로는 [공통 계약](00-shared-contract.md)과 I가 고정한다.

## 실제 UX 요구

- 질문 송신 시 현재 선택 사례, 스냅샷, 캠페인/매체/기기 필터, 화면 지표/제목과 자료 해시를 요청에 담고, **서버가 반환한 적용 범위와 조회 조건을 답변과 함께 보존**. 화면이 바뀌어도 앞선 실행 결과가 새 화면의 분석인 것처럼 보이지 않게 함.
- 202 응답의 `runId` 저장, 상태 polling 및 연결 중단 후 **동일 ID 재조회**, 오류가 발생해도 같은 질문을 자동으로 신규 생성하지 않음. `clientRequestId`/브라우저별 임의의 충돌 어려운 `threadId`를 발급하되 실제 비밀 키/사용자 식별 정보를 포함하지 않음.
- 기본 단계는 **접수 → 자료 조회 → 분석 → 근거 검증 → 완료/부분/보류**의 간결한 흐름. `상세 표시`에서 실제 도구명, 인자 요약, 상태, 반환 건수, 근거 ID, 실행 시각/소요 시간, 실제 모델 경로/전환 사유/검증 결과를 펼침. 실제 발생하지 않은 단계, 추정 퍼센트, 모델 내부 추론을 표시하지 않음.
- 모델 한도 소진으로 다음 경로를 사용하면 **"다른 모델로 전환 중"** 상태를 실제 서버 이벤트 기반으로 출력. 사용자의 수동 전환 질문이나 키 입력 UI는 만들지 않는다. 모든 후보가 불가할 때는 실제 종료 상태와 안내를 정확히 표기.
- 실행 중 같은 대화의 추가 전송 막음, **분석 중지** 버튼은 승인된 취소 API 호출, 이후 신규 모델 호출 중단 표시. 서버 취소 완료 전에 성공처럼 보이지 않게 함.
- `completed`와 `causeStatus:undetermined`은 **"분석 완료, 원인 미확정"**으로 표시. `partial`, `withheld`, `blocked`는 별개. 검증 실패한 숫자와 가짜 인용 숨김. 표/차트는 서버에서 검증한 응답을 바탕으로 그리며 UI에서 임의 가중 평균을 계산하지 않음.
- 서버 완료 대화와 `localStorage` 보조 복원을 runId, caseId, snapshot, dataHash, threadId로 묶고, 형식 버전/손상/금지 저장/quota를 방어. 초기 새로고침, 뒤로 가기, 비교 표 진입, 성과 현황 복귀, 리뷰 분석 메뉴 등 **기존 UX 보존**.
- `VITE_AGENT_API_URL`처럼 클라이언트가 알아야 할 API **공개 주소만** 유지. `GEMINI_API_KEY`, `AI_GATEWAY_API_KEY`, `SAIL_API_KEY`, `JEV_API_KEY`는 프런트 환경 변수/소스/응답에 절대 포함하지 않는다.
- Agent 외부 QA 계정 인증 화면/게이트웨이 실제 로그인 연결은 D/I와 경계를 맞추되 사용자를 개별 실명 추적하는 기능을 도입하지 않는다.

## mock UI 테스트

- 202→queued/running→completed, polling 에러/재연결 후 같은 run 조회, 중복 전송/스레드 경합, 사용자 취소 및 취소 경합, 화면 바뀐 상태에서 원래 분석 범위 유지.
- quota 초과 후 제공자 변경 이벤트, 상세 로그 접기/펴기, 근거 ID, `completed+undetermined`, `partial/withheld/blocked`, 미지원 지표 `not_provided`, 누락 세부 차원의 오류 상태 검증.
- 기존 예시 대화, ROAS 테이블, 리뷰 분석, 선택기, 용어 표시, 키보드/접근성 및 모바일 레이아웃이 손상되지 않도록 하는 회귀. 실제 AI 호출, 브라우저에서 API 키 조회 금지.
- 새 테스트 `tests/agents/ui/**` 및 현재 ROAS test, lint/build. UI 사진/스크린샷 없이 성공이라 주장하지 말고 mock과 실제 브라우저 확인 여부를 분리 보고한다.
