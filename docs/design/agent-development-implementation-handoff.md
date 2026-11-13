# 에이전트 개발 구현 인계 초안, SDD-01~60 확정, §34 한도 소진 시 모델 자동 대체

**병렬 실행 작업 지침:** [6개 병렬 업무, 공통 계약과 최종 통합 지침](../handoffs/agent-parallel-20261104/README.md). 각 담당은 파일 소유권을 지키며 API 키 등록/실 모델 요청 없이 mock 기반 기능을 먼저 구현한다.

2026-11-04 코드 위치 변경: [ROAS와 구 대시보드 분리](roas-legacy-separation.md)를 현재 코드 경로와 서버 경계의 기준으로 함께 읽는다. 기존 frontend/workbench의 현재 기능은 frontend/roas, training과 ROAS 공용 계산은 shared/roas, 현재 도구와 서버는 scripts/roas와 backend/roas로 분리했다. 이전 분석, 예산 서버 구현은 legacy/backend에 보관했다. 아래 확정 기능 정책은 유지하며 구현 전 경로와 연계 지점은 이 분리 결과를 대조한다.

작성: 2026-11-03, 최신 갱신: 2026-11-04, Asia/Seoul
상태: **사용자 확정 SDD-01~60 보존. 최신 §34에서 Gemini 한도 소진 시 Vercel 및 Sail의 검증된 비-Gemini 모델을 즉시 자동 대체할 수 있도록 승인했다. 이전 §33의 Sail 비활성/추가 허가 대기 제한은 폐기한다. SDD-58에서 구 `breakdown`을 `metric_detail`(지표 세부 데이터 조회)로 바꾸고 지표별 산식, 기초 필드, 지원 차원 카탈로그를 모델에 제공한다. SDD-54 A는 HTTPS 인증 게이트웨이와 PC 아웃바운드 터널, SDD-55 A는 단일 Node 프로세스 비동기 Run Engine, SDD-56은 공용 QA 테스트 계정 하나, SDD-57 A는 실행 단위 메모리 스냅샷. §31 최신 확정 우선, 구현/TDD/실모델 호출 승인 없음.**
정본: [에이전트 개발 Intent](agent-development-intent.md), [에이전트 개발 SDD](agent-development-sdd.md) 특히 **§26(SDD-01~47 확정), §27(기술 설계), §28(SDD-48~53 확정), §29(SDD-54~55 A 확정), §30(이전 인증/스냅샷 대안 비교), §31(SDD-56 공용 계정, SDD-57 A 확정), §32(SDD-58 지표 세부 데이터 조회와 지표 조회 가능 항목 사전), §33(SDD-59 모델 호출 경로/무료 크레딧), §34(SDD-60 즉시 자동 모델 대체)**. 승인받은 SDD-01~60의 확정 범위를 재인터뷰하지 않는다. Sail 등 비-Gemini 생성 모델은 최신 §34에 따라 적격 대체 후보로 허용된다. SDD-36 B안은 실행 ID 발급과 상태 조회, SDD-37 B안은 SQLite 결과 보존, SDD-38 A안 확장은 **같은 채팅의 기본 단계 표시 + 상세 실행 로그 펼침**, SDD-39 A안은 **같은 대화 직렬 실행**, SDD-40 B안은 **7개 도구 모두 모델 공개**, SDD-41 A안은 **요약/건수/증거 ID와 페이지 정보 우선**, SDD-42 A안은 **일반 조회 실패 시 검증된 근거로 계속, 핵심 무결성 실패 시 보류**다. SDD-43 A는 **구조화된 수치 주장에 대한 서버 독립 대조**, SDD-44 A는 **일반 데이터 조회 도구의 동일 요청 자동 재시도 없음**, SDD-45 B는 **mock 기반 자동 계약/회귀 테스트를 이번 구현 기능 인수 기준으로 삼고 설명 품질 수동 QA는 후속 이관**이다. 실제 모델 호출/품질/속도와 별도 컨텍스트 독립 검증은 자동 테스트와 별개로 구분한다. SDD-46 A는 **SQLite 종료 결과와 상세 로그 30일 보관 후 자동 삭제**, SDD-47 A는 **같은 채팅의 분석 중지 버튼, 이후 신규 호출 차단, 검증된 결과만 부분 반환**이다. SDD-48~50은 §28.1, **SDD-51~53 A 확정은 §28.3**에 기록했다. 외부 접속 경계와 실행 프로세스 구조는 §29에서 A안으로 확정했다. §31에서 사용자별 계정 분리와 원천 이력 재현 저장소를 제외하고 간단한 QA 인증 및 실행별 메모리 스냅샷 구조로 확정했다. 구현 세부를 새로운 사용자 선택으로 재인터뷰하지 않는다. §27~28의 기술적 계약과 테스트 전 검토에 근거해 인터뷰를 진행하되 미승인 제안을 확정으로 취급하지 않는다.

## 1. 목표, 금지 및 기준선

**1차 개발 완료 정의:** 기존 성과 현황의 ROAS 채팅에서 사용자가 질문하면 no ontology 단일 조사 에이전트가 고정된 질문/화면 범위에 따라 데이터를 조회하고, 빠른 조회 또는 심층 조사로 분석하며, 서버가 수치/범위/인용을 검사한 결과를 기존 대화 UI에 보여준다. 심층 첫 도구는 Jev 우선 분류, 실패나 불확실성 또는 무료 크레딧 부재 시 무료 Gemini Flash-Lite 분류, 이후 추가 도구와 조사 종료는 Gemini 분석 모델이 결정한다.

범위 밖: ontology 구현과 비교 평가, 서버 간 대화 동기화, 중단 실행 자동 복구, 광고 변경 실행, 새로운 UI 전면 개편, 데이터/리뷰 원천 생성과 스키마 변경, 유료 호출, 실제 모델 시험(별도 승인 전), 배포, 커밋, 푸시. 기존 `/agent-api/analysis`, `/agent-api/budget` 및 synthetic 실행·승인 경계는 유지한다. 개발 시에도 사용자로부터 승인되지 않은 신규 데이터나 테스트 fixture를 생성하지 않는다.

착수 체크: `AGENTS.md`, `.agents/skills/poc-iteration-log/SKILL.md`, Skills 목록, `docs/README.md`, 두 정본 문서, `git status --short --branch`, 현재 코드 및 미커밋 파일을 먼저 확인한다. 이번 문서 작업의 시작 HEAD는 `df2e043`이다. 문서 전용 `docs/agent-development-contract-20261103` 브랜치를 생성했으나 작업 중 병렬 에이전트가 같은 작업 폴더의 현재 브랜치를 다시 변경했다. 따라서 **브랜치명이나 리뷰 파일 상태를 고정 가정하지 말고 착수 시 다시 확인**한다. 문서 검증 시점에는 `data/roas-reviews.json`, `data/roas-review-classification.json`, `data/roas-product-metadata.json`이 새로 보이며 존재와 최종 데이터 계약 통과는 구분해야 한다. 병렬 데이터나 기존 변경을 임의 복제, 초기화, 덮어쓰기 하지 않는다.

## 2. 실제 코드 출발점과 변경 파일

| 순서 | 파일 | 현행 사실, 구현 명령 |
| --- | --- | --- |
| P0 | `backend/roas-agent.mjs` | `createRoasChat`은 현재 `scope={caseId,snapshot,filters,dataHash,metric,screenTitle}`, `history`를 받고 조회 시점에 데이터 해시를 검사한다. overview/캠페인 선조회, `breakdown/trend/records` 및 최대 5회 모델 루프를 갖는다. 이를 **경로별 상태 기계, 정규화 범위, 기본 도구 카탈로그, 실행 장부, 검증 게이트**로 교체하거나 내부 헬퍼를 작게 분리한다. 기존 ROAS 계산은 재사용한다 |
| P0 | `shared/training-dashboard.mjs`, `shared/roas-chat.mjs`, `scripts/training-data.mjs` | `selectFacts`, `selectBreakdowns`, `selectRecords`, `comparePeriods`, `summarize`, `chatComparison`, `chatSourceRows`, `chatHighlights` 등의 기존 수식과 출처를 활용한다. 원천 수치와 보고 기준은 변경하지 않는다 |
| P1 | `backend/agent-runtime.mjs`, `backend/agent-model.mjs` | 현행 모델은 `analysis/budget` 역할과 등록 모델 프로필, Gemini JSON 행동 프로토콜, 호출별 최대 60초 타임아웃, 모델별 process-local pacing을 쓴다. 기존 B 흐름에 영향을 주지 않고 ROAS만 `quick/deep/router_fallback`의 무료 Gemini 모델 배정, 예외 분류, 전체 deadline과 호출 장부를 제공한다. 현재 모델명 또는 RPM 프로필을 실계정 무료 보증으로 취급하지 않는다 |
| P1 | `backend/jev-router.mjs` (신규 최소 어댑터) | TypeSafe Choice의 `state,questions,model`과 `choice,probabilities,confidence`만 처리한다. 사전 정의 후보 복수 판단, unknown/none 후보, 출력 및 모순 검사, 무료 크레딧 게이트, 오류 분류만 맡긴다. Jev를 생성형 대답이나 자유 텍스트 파서로 사용하지 않는다. 크레딧 게이트 미검증 상태에서는 Jev 호출을 차단하고 Flash-Lite 경로로 진행한다 |
| P2 | `backend/agent-http.mjs`, `scripts/agent-server.mjs`, 기존 `backend/agent-flow.mjs`의 저장 패턴 참조 | SDD §27.8의 **ROAS 전용 run 생성/조회/취소 HTTP 계약**과 SQLite `roas_runs/roas_events/roas_evidence`, 중복 요청 및 같은 대화 활성 실행 1개, 재시작 미완료 중단, **종료 후 30일 보관 및 자동 정리**, 중지 후 신규 호출 차단을 구현한다. 기존 `/agent-api/roas/chat`, `/analysis`, `/budget`, session Origin/Host 보안을 보존한다 |
| P3 | `frontend/workbench/agent-client.ts`, `frontend/workbench/roas-conversation.tsx`, `frontend/workbench/roas-answer.tsx`, `frontend/workbench/training-dashboard.tsx` | 기존 채팅의 **runId 상태 재조회, 주요 단계, 상세 표시/접기, 분석 중지 버튼**을 구현한다. 상세에는 실제 도구 호출/인자/건수/근거 ID/지연/오류/모델 대체/검증 결과를 표시하고, 별도 개발자 화면을 만들지 않는다. 진행 중 같은 대화 추가 전송 차단, 새로고침 후 동일 run 조회, 기존 답변 및 원래 범위 복원을 보존한다 |
| P4 | `tests/agents/roas.test.mjs`, `tests/agents/runtime.test.mjs`, `tests/agents/http.test.mjs`, `tests/agent-client.test.ts`, 필요 시 `tests/agents/roas-sdd.test.mjs` | 아래 실패 테스트를 먼저 추가하고 기존 에이전트와 ROAS 회귀를 실행한다. 테스트 네트워크는 mock 제공자만 사용한다 |
| P4 | `.github/workflows/` 관련 CI | 기존 미추적 워크플로와 충돌하지 않도록 실제 파일을 확인한 뒤 mock agent 검증, ROAS 회귀, lint, build를 기존 CI에 편입한다. 이 문서 작업에서는 수정하지 않는다 |

**주요 간극:** 기존 ROAS 모델은 최초 화면 `filters` 밖의 상품/기간을 주 분석으로 바꿀 수 없고, 리뷰 도구가 없으며, 수치 자유 서술을 원천값과 전수 대조하지 않는다. `server.requestTimeout=10000`은 Node의 요청 수신 제한이며 단순히 응답 전체를 10초로 제한한다는 뜻은 아니다. 대신 모델별 60초 제한, 브라우저→프록시→PC 전체 180초 지속성, 연결 중단과 빠른 15초 경계는 **각각** 확인한다.

## 3. HTTP 계약과 입력 우선순위

현재 경로 `POST /agent-api/roas/chat`는 기존 계약이며 **새 분석은 SDD-36의 실행 ID 생성 및 상태 조회 방식**으로 설계한다. **기존 경로의 기능 호환성은 유지**하고 신규 POST 실행 시작과 GET 실행 ID 조회의 정확한 경로명, HTTP 상태 코드, 폴링 간격은 기존 보안/대화 의미를 보존하는 구현 세부 계약으로 결정한다. 이 항목은 별도 A/B 정책 인터뷰를 요구하지 않는다. 기존 요청 필드 `question`, `scope`, `history`는 새 계약에서도 의미를 유지한다. `scope`의 기존 `caseId,snapshot,filters,dataHash,metric,screenTitle`을 계속 수용한다. 새 코드에서 사용자 질문의 명시 조건을 조회할 수 있다면 이를 정규화한 `primaryScope`로 고정한다. 별도 클라이언트 선택값으로 질문 명시 조건을 덮어쓰지 않는다.

- 우선순위: 질문의 명시 상품, 날짜/기간 → 첫 화면의 사례, 스냅샷, 채널, 집행처, 캠페인, 기기 → 검증된 원천의 지원 범위. 애매한 지시어와 이전 대화 인용은 실제 질의 내용과 이전 결과의 **확인된 적용 범위**로만 해석한다. 화면 제목이나 모델 분류 출력은 원천 식별자의 권위가 아니다.
- `primaryScope`에 사례, 스냅샷, 반개방 기간, 타임존, 상품(조회 가능한 축일 때), 필터, asOf, 보고 기준, dataHash를 담는다. `comparisonScopes[]`는 동일 사례, 기간, 상품, 보고 기준에 결속한 보조 근거만 허용한다. 주/보조 분모 및 인용을 혼합하지 않는다. 상품×캠페인×기기처럼 실제 교차 원천이 없는 조합은 `unsupported_scope`로 알리고 허용되는 분석만 반환한다.
- 분석 요청은 서버 발급 `runId`에 결속되며 상태 조회와 완료 결과 조회를 지원한다. 클라이언트는 실행 ID를 기억하고 브라우저 연결이 끊기면 **중복 생성 없이 기존 실행 ID의 상태를 조회**한다. 같은 대화의 진행 중 분석이 있으면 추가 전송을 막고, 완료/중단 후 전송을 다시 허용한다.
- 응답은 기존 `answer`, `sections`, `comparison`, `sources`, `events`, `mode`에 더해 `runId`, `route`, `executionStatus`, `causeStatus`, `stopReason`, `appliedScope`, `usage`, `checks`를 갖는다. 기존 클라이언트가 요구하는 `answer: string`, `sources: []`, `events: []`는 `blocked/withheld`에도 유효한 형태로 둔다. 원인 미확정 정상 결과는 `executionStatus: completed`, `causeStatus: undetermined`, 사용자 문구 “분석 완료, 원인 미확정”이다.
- `executionStatus`: `completed|partial|withheld|blocked`. `causeStatus`: `not_assessed|confirmed|undetermined`. `confirmed`는 검증된 인과 근거가 있을 때만 허용하며 동시 발생 또는 상관관계만으로 설정하지 않는다. `stopReason`: SDD §24.5의 enum. `checks`는 주 범위/핵심 수치/개별 근거의 검증 결과와 제외한 주장 ID를 구분한다. `usage`는 각 실제 요청의 모델, 목적, 정상/예외, 실패 및 전환 사유, 누적 시간과 카운터를 기록한다. 키/전체 프롬프트/민감한 원문을 로그에 남기지 않는다.
- 기존 보안: JSON 본문 64KiB 제한, 세션 토큰과 `x-agent-token`, Host/Origin/CORS 검사, 모델/키 서버 전용, 실제 Ads 비활성 유지. 미등록 필드 및 도구 인자는 거절한다. 현재 UI는 최근 네 번 대화를 전송하므로 새로고침 복원 후에도 **현 데이터 해시와 범위가 맞는 완료 대화만** 모델 맥락에 포함한다.

## 4. 서버 데이터 도구 계약 (내부 함수, 외부 신규 API 아님)

공통 반환형을 `{status,scopeRole,scope,reportingBasis,dataHash,sourceVersion,rows,total,nextOffset,truncated,evidenceIds,limitations}`로 둔다. `status`: `ready` 조회 가능, `empty` 확인된 0건, `not_provided` 제공 계약 없음, `pending` 분류 검수 대기, `error` 무결성 위반. 0/0 비율은 `null`, 자료 미제공은 0이 아니다. 모든 기간과 해시는 서버 원천으로부터 정한다.

| 도구 | 허용 인자 (범위는 실행 고정) | 필수 반환 및 검증 |
| --- | --- | --- |
| `overview` | `scopeRole`, 허용 `metric[]` | 자료 가용성, baseline/current 총계와 KPI, 구간/asOf, 보고 기준, 집계 ID |
| `metric_detail` (지표 세부 데이터 조회) | `scopeRole`, `metric`(지표 사전의 지원 ID, 필수), `dimension?`(해당 지표와 현재 원천에서 지원하는 enum), `offset?`, `limit?` | 계산식, 분자/분모, 기간별 값, 관련 지표, 조회 가능한 차원, 선택적 캠페인/기기/상품/트래픽 세부 비교와 실제 원천 근거 ID. 지표별 조회 가능 항목 사전은 SDD §32를 따른다. 구 `breakdown` 대체, 도구 수는 7개 유지. |
| `trend` | `scopeRole`, `metric[]`, `offset,limit` | 날짜별 총계, 기간 경계, 페이지 종료 및 원천 ID |
| `records` | `scopeRole`, `query?,offset,limit` | 운영 기록, 원문 시점, 주/보조 귀속, `total,nextOffset` |
| `review_summary` | `scopeRole`, `productId,sourceId?,periodId?` | 승인된 검수 분류 유무, 리뷰 ID 집합 기준 건수, 작성일과 수집일 및 asOf, 제공 상태 |
| `review_records` | `scopeRole`, `productId,sourceId?,periodId?,query?,offset,limit` | 허용 원문과 연결된 검수 분류 및 ID, 판정 대기/미분류 구분, 기간별 페이지 |
| `evidence` | `evidenceIds[]` | **SDD-40 B로 모델 공개**. 이번 실행에서 실제 발행된 증거 ID만 읽고 원천 범위, 데이터 해시, 원시 참조 재확인. 모델의 자체 확인과 관계없이 서버가 최종 인용을 별도 검사 |

**SDD-40~42 및 최신 SDD-58 반영:** AI가 호출할 수 있는 도구는 표의 **7개 전부**다. 모델이 선택 지표의 조회 가능 데이터, 산식 및 지원 차원을 미리 알고 `metric_detail`을 호출하도록 서버가 검증된 지표 조회 가능 항목 사전을 제공한다. 모델이 제안한 지표/차원이 사전 또는 현재 데이터에서 미지원이면 명확히 거절한다. `evidence`는 **이번 실행에서 앞선 조회가 발행한 검증된 ID만** 받아 원문/출처를 재확인하며 최초 조회 전에 없는 근거 ID를 요청하면 거절한다. 서버는 모델의 자체 근거 확인 결과와 무관하게 최종 수치, 범위, 인용을 검증한다. 최초 반환은 집계, 요약, 자료 상태, 근거 ID, `total`, `nextOffset`, `truncated`를 우선하고, 추가 원문/후속 페이지는 모델의 후속 도구 요청 시 제공한다. 개별 도구의 구체적인 페이지 크기와 JSON 필드명은 승인된 의미를 만족하는 테스트 계약으로 검증한다.

도구별 인자는 허용 화이트리스트로 제한하고, 서버가 `scopeRole`에 대응하는 범위를 지정한다. Jev와 Gemini가 임의 파일 경로, 임의 기간, 미제공 교차 축을 넣어도 실행하지 않는다. Jev가 고른 도구 수에는 임의 상한을 두지 않지만 데이터 페이지와 프롬프트 크기, CPU/메모리/시간 제한을 검사하고 중복 요청을 제거한다. 복수 도구 응답이 크면 집계와 ID, 가용 상태를 먼저 요약하며 모델이 요청한 원문만 별도 제공한다.

원본 증거 ID는 **한 실행, 자료 해시, 기간, 주/보조 범위, 발행 도구**에 결속해 다른 범위에 재사용할 수 없게 한다. 모델의 자유 서술 숫자를 단순한 참조 ID 유효성만으로 통과시키지 않는다. **SDD-43 A**에 따라 숫자/비율/기간에 관한 정형 `numericClaims`(metric, value, unit, period, evidenceIds)를 모델의 필수 출력 계약에 포함한다. 서버는 계산 원본과 대조하고 **답변 본문에 있는 모든 수치 주장이 정형 주장과 일치하는지도 검사**한다. 검증되지 않는 자유 숫자 문장은 제거 또는 수정 후 재검사한다. 일치하지 않은 핵심 수치를 유효한 근거 ID만으로 승인하지 않는다. 시각화의 수치는 서버가 확정한 비교 블록에서만 생성한다. 반대 근거의 내용적 충분성 검사는 서버가 강제하지 않으며 별도 QA에서 평가한다.

**SDD-42, SDD-44 일반 조회 실패 처리:** 도구 오류는 실행 이벤트에 도구명, 실패 상태, 허용 가능한 사유 코드, 영향 받은 데이터 범위를 남기고 기존의 검증된 근거와 사용 가능한 다른 도구로만 분석을 지속한다. **서버가 동일 데이터 도구를 자동으로 다시 호출하지 않는다.** 이는 기존 모델 제공자 API 일시 오류의 제한된 재시도 정책과 별개다. 자료 오류를 `empty`나 `ready`로 변환하지 않고, 영향을 받은 자료의 미제공/실패와 사용자 답변의 한계를 표시한다. **핵심 데이터 해시, 주 분석 범위 또는 핵심 수치 검증 실패 시 관련 결과는 `withheld`** 처리한다. 이미 Gemini가 `insufficient_evidence`라고 종료했다면 SDD-33에 따라 다른 도구도 새로 조회하지 않는다. 재시도 정책의 미결 부분은 후속 SDD에서 정한다.

리뷰 공급상태는 현재 데이터 SDD와 실제 통합된 검증 완료 파일만 따른다. 리뷰 작업 브랜치의 파일을 임의로 복제하지 않는다. 파일이 없거나 승인된 제공 선언이 없다면 `not_provided`, 분류의 검수/통합이 아직 확인되지 않으면 `pending`, 무결성 검사에 실패하면 `error`로 답하며 ROAS 분석은 계속한다. 이번 작업 중 추가된 파일들의 원문 해시와 분류 sidecar 출처, taxonomy 버전, 제공 범위를 확인한 뒤에만 검증된 분류로 처리한다. 개별 고객의 광고 기여와 리뷰를 임의로 결합하지 않는다.

## 5. 모델 라우팅, 예산, 종료 상태 기계

1. **빠른 조회:** 서버가 질문 유형을 판별하고 필요한 집계/근거를 미리 읽는다. 다른 Gemini 경로와 구별된 **무료 빠른 모델**을 정상 1회 호출한다. 성공 답변은 결정적으로 검사한다. 오류 재시도, 대체, 검증 수정을 통틀어 예외 2회, 총 3회, 15초 상한이다. 5초 목표는 QA 실측 후 판단한다.
2. **심층 최초 선택:** 사전에 증빙한 Jev 무료 크레딧 범위이면 Choice 1회에 도구별 yes/no 후보, `metric/device/period_kind/comparison_scope` 등의 유한 선택지를 포함한다. 서버는 모든 응답을 동시 해석하고 명시 범위와 모순을 확인한다. 점수 임계값은 무근거 기본값을 확정하지 않고 라벨된 질문에 대한 오분류 측정 후 정한다. 미연결/크레딧 0이면 **Jev 0회, Flash-Lite 정상 1회**. Jev 실제 요청 후 실패/모순/낮은 신뢰도이면 **Jev 정상 1회, Flash-Lite 예외 1회**다.
3. **자유 값 보완:** 원문에 있는 캠페인 ID와 날짜는 서버가 검증해 고정한다. Jev 후보에 없는 자유 입력으로 의미가 분명하지 않다면 Flash-Lite 구조화 출력으로만 보완하고 이 추가 요청도 예외 슬롯에서 지불한다. 후보가 없는 값을 날조해 채우지 않는다.
4. **심층 조사:** 첫 조회 결과를 범위, 집계, 자료 상태, ID, 전체 건수와 페이지 커서로 요약한다. Gemini는 SDD-40에 따라 `evidence`를 포함한 **7개 조회 도구 전체**를 사용할 수 있고, `evidence`는 앞서 발행된 ID의 원문 확인에만 사용한다. 모든 도구 호출/실패/근거 조회를 SDD-38의 상세 이벤트에서 확인할 수 있게 한다. 이후 도구 선택은 **현재 Gemini 심층 모델**이 하고 Jev를 재호출하지 않는다. `continue`는 예산 내 추가 조회 가능, `gemini_sufficient`는 조기 종료, `insufficient_evidence`는 즉시 신규 조회 중지 후 이미 확보한 사실을 답변한다. 서버는 종료의 근거 망라율을 검사하지 않는다. 정답처럼 단정한 인과는 별도 QA 대상으로 명시하고, 관측과 미검증 가설을 구분한다.
5. **심층 호출 장부:** `normal<=4`, `exception<=2`, `total<=6`, 최대 180초. 심층 정상 호출 중 **마지막 1회는 최종 답변용 예약**이며 중간 도구 선택이 소비하지 않는다. 모델/공급자별 재시도와 오류는 모두 실제 요청 시도 기준 계상한다. 동일 모델 일시적 오류 재시도는 1회 이내, 할당량 소진이면 재시도 없이 확인된 무료 후보로 전환한다. 한도 초과를 단순 크레딧 부족과 혼동하지 않는다.
6. **무료 정책:** Gemini는 모델의 가격표만 아니라 **사용 중인 프로젝트의 실제 무료 티어와 잔여 한도**가 확인된 경우만 실행한다. API 키 회전으로 무료 할당량을 회피하지 않는다. Jev는 적용 가능한 무료 크레딧의 확인된 잔액을 선행 검사하고 0원이 승인된 비용 상한이다. 확인 불가능한 상태에서는 Jev 호출하지 않고 Flash-Lite로 전환한다. 모든 무료 Gemini 불가 시 `blocked + models_unavailable`이며 오프라인 대역으로 AI 분석을 속이지 않는다.
7. **검증 실패:** 핵심 범위/핵심 수치 검증 실패 → `withheld`. 핵심은 통과, 일부 주장/인용만 실패 또는 시간/호출 한도 → 검증된 부분만 `partial`. 모두 통과하고 Gemini가 종료를 선언하면 `completed`, 원인이 확정되지 않았으면 `causeStatus=undetermined`. `insufficient_evidence` 종료 뒤에는 예외 슬롯이 남아도 신규 조회하지 않는다. 다만 이미 받은 증거만으로 답변의 수치/인용을 정정하는 SDD-04 절차는 남은 예외 슬롯에서 수행할 수 있다. 이때도 **신규 도구 조회와 새로운 원인 탐색은 하지 않는다**.
8. **추가 확인 작업:** 원인 미확정 시 운영 기록, 지표 분모, 판매처별 리뷰 원문 등 다음 확인 순서를 제안한다. 광고 예산, 입찰, 타기팅, 캠페인 설정 변경을 하라고 권고하지 않는다. 자료를 확보할 수 없을 때는 검증된 관측과 가설을 나눠 안내한다.

## 6. 대화 복원과 UI 반영

**서버 SQLite가 완료된 실행 결과와 상태 이력의 영속 저장소**이며, 브라우저 `localStorage`는 사용자가 읽던 대화의 보조 복원 캐시다. 둘을 동일한 대화/실행 ID와 범위/데이터 해시로 결속한다. 서버 재시작에서 미완료 실행은 중단 처리하고 **자동 재개하지 않는다**.

현 `training-dashboard.tsx`의 화면별 exchanges를 유지하고 완료 결과를 `localStorage`에 보조 저장한다. 키는 서비스 origin과 `caseId,snapshot,dataHash` 등 범위 버전으로 구분하고, 저장 JSON에 검증된 `appliedScope`, `route`, `executionStatus`, `causeStatus`, `sources`를 포함한다. 시작/진행 중 실행은 저장하지 않는다. 기본 저장 상한은 예시로 **화면별 최근 20개, 전체 약 500KiB**를 적용하고 quota/금지/파싱 실패는 화면 기능을 중단시키지 않고 메모리 대화만 유지한다. 이 값은 데이터나 비즈니스 정책이 아닌 구현 안전 기본값이며 브라우저 테스트로 조정한다.

**같은 채팅 화면**에 접수, 조회, 분석, 검증, 완료 또는 중단의 주요 단계만 기본 표시하고 **상세 표시**를 누르면 구조화된 실제 이벤트를 순서대로 펼친다. 이벤트에는 검증된 도구명/인자 요약, 도구 결과 상태/건수/출처 ID, 실행 소요 시간, 모델 호출/대체/재시도, 검증 결과/오류 코드가 포함된다. 수행하지 않은 단계는 표시하지 않고 실제 퍼센트 진척도를 추정하지 않으며 모델의 비공개 추론, 키, 민감한 내용을 노출하지 않는다. 별도 개발용 화면을 만들지 않는다. 같은 대화에서 실행 중 추가 전송은 금지한다.

복원 시 schema 버전, 자료 해시, 출처 ID/상태 형식, 범위를 검증하고 오래된 분석을 현재 보고 기준의 새로운 결과로 제시하지 않는다. 화면 변경 뒤 먼저 시작한 실행의 응답은 당시 적용 범위와 함께 해당 요청 대화에 기록한다. 화면 변경만으로 자동 재요청하지 않는다. 화면 표시에는 **“분석 완료, 원인 미확정”**, `partial`/한도 종료, `blocked`/모델 불가를 구분한다. 모바일 접속 별도 대응과 UI 전체 디자인 개편은 하지 않는다.

## 7. TDD 및 회귀 검증, 완료 게이트

**RED → 최소 구현 → 회귀** 순서로 진행하고 모든 외부 제공자를 mock으로 주입한다. 기존 승인된 S16/S17 및 합법적인 기존 fixture만 사용하며 신규 가상 마케팅 원천과 리뷰를 만들지 않는다. 필요한 신규 테스트 데이터의 생성은 `AGENTS.md`에 따라 별도 승인받는다.

| 테스트 ID | 반드시 검증할 조건 |
| --- | --- |
| T01~T03 | 빠른/심층 자동 경로, 혼합 질의 심층, 명시한 상품/기간이 화면보다 우선하며 데이터에 없는 조건은 안전하게 거절 |
| T04~T06 | 캠페인 A 진행 중 B 화면 변경 시 A 고정, 주/보조 범위 및 분모 격리, 지원하지 않는 상품×기기 교차 집계 차단 |
| T07~T09 | Jev 복수 Choice/none 후보/모순/낮은 신뢰도, Flash-Lite 대체. 제로 크레딧 Jev 0+Flash-Lite 정상 1, Jev 실패 1+Flash-Lite 예외 1 |
| T10~T12 | quick 정상 1+예외 2, deep 정상 4+예외 2, 최종 정상 호출 예약, 재시도/전환/수정 합산 총 상한 차단 |
| T13~T15 | 15초/180초 deadline, 모델별 타임아웃과 프록시 중단, Gemini 무료 모델 전부 불가 시 유료 및 오프라인 AI 우회 없음 |
| T16~T18 | ROAS/비율/분모 0/%p의 독립 수치 검사, 부정확한 자유 숫자/인용 ID 거부, 부분 답변과 전체 보류 |
| T19~T21 | Gemini 충분 판단의 조기 종료, Gemini 근거 부족 선언 뒤 추가 조회 0회, 서버 별도 후보 완전성 게이트 없음 |
| T22~T24 | `completed+undetermined`와 `partial/withheld` 분리, 미확정 광고 설정 변경 권고 없음, 검증 자료와 반대 근거 구분 |
| T25~T27 | 리뷰 not_provided/pending/error가 ROAS 집계를 중단시키지 않음, 출처 ID와 페이지의 일치, 검수 분류를 원문보다 우위에 두지 않음 |
| T28~T30 | 완료 대화 저장 및 새로고침 복원, 해시 변경/손상된 localStorage/금지 저장 처리, 세션 보안과 기존 API 호환. SDD-36~39의 run ID 재조회, 재시작 후 SQLite 결과 복원, 미완료 자동 재개 금지, 상세 이벤트, 같은 대화 중복 차단을 검사한다. **SDD-46**의 종료 후 30일 만료와 **SDD-47**의 명시적 중지는 별도 T37~T39에도 반영한다 |
| T31~T33 | **SDD-40~42:** `evidence` 포함 7개 도구가 모델에 공개되고 발행되지 않은 ID를 거절함, 요약/건수/커서 뒤 원문 선택 조회와 페이지의 정확한 합계, 일반 도구 실패 시 검증된 다른 자료로 계속하면서 오류 이벤트 및 응답 한계가 기록됨. 해시/범위/핵심 수치 오류는 보류, Gemini 근거 부족 선언 후 신규 조회 없음 |
| T34~T36 | **SDD-43~45:** 수치 주장 `metric,value,unit,period,evidenceIds`를 서버 원천과 독립 대조하고 자유 서술 숫자 우회 금지, 일반 데이터 도구 오류에서 자동 동일 도구 재시도 0회/실패 이력 기록/검증된 자료로 계속, 자동 계약/회귀 검증 결과로 기능 인수 판정하되 수동 설명 품질 QA 및 실모델 성능/비용 검증은 후속 작업으로 명시 |

**실행 명령(구현 담당이 실행):** `npm run test:agents`, `npm run test:roas`, `npm run test:training`, `npm run lint`, `npm run build`, 새 도구/HTTP/프론트 테스트의 개별 Node 명령. CI에도 이 중 자동화 가능한 **mock 기반** 검사들을 반영한다. 기존 `tests/agents/*.test.mjs`의 B 흐름, ROAS 원천 합계, 기존 리뷰 UI 코드/미커밋 변경이 영향을 받지 않아야 한다. 실패가 있으면 수정 범위와 기존 실패 여부를 구분해 보고한다. `npm test`만으로 이 범위를 모두 검증했다고 간주하지 않는다.

**수용 기준:** SDD §22의 AG-ROUTE, AG-SCOPE, AG-RESULT, AG-TOOL, AG-STOP, AG-STATE, AG-COST, AG-HISTORY, §27.10의 AT-ARCH/FLOW/TOOL/REVIEW/EVIDENCE/NUMERIC/ERROR/RUN/STORE/SECURITY/CI 기준과 계획된 T01~T45의 mock 계약/회귀 테스트, lint, build가 모두 통과하면 **이번 구현의 기능 테스트 인수 조건**을 만족한다. **SDD-45 B**에 따라 설명 품질, 근거 반박의 충분성과 원인 가설 서술을 수동으로 평가하는 QA는 후속 작업이다. `intent-to-done`의 별도 컨텍스트 독립 검증 단계는 유지하며 별도 사용자 판정 없이 단계 완료를 선언하지 않는다. no ontology에서 실제 승인된 데이터 조회가 end-to-end 연결돼 있고 모든 숫자와 인용이 추적 가능해야 한다. 실제 Gemini/Jev 품질, 지연과 한도/크레딧은 **별도 사용 승인 후**, 호출 수를 제한하고 실제 과금이 발생하지 않는 전제에서만 실측한다. 실측 전에는 기능 코드 완료와 실모델 운영 검증 완료를 구분해 보고한다.

## 8. 남은 기술 확인, 정책 결정 아님

- **공급자 계정:** Gemini 프로젝트 무료 티어, 모델별 실제 지원과 잔여 RPM/TPM/RPD, 구조화 출력/도구 선택 기능, Jev 무료 크레딧과 부과 기준 및 계정별 Choice 사용 가능 여부. 확인은 정책/설정 조회로 시작하고 실제 모델 요청이나 결제는 승인받기 전 금지한다.
- **분류 신뢰도:** Jev 한국어 질문 후보별 probability/confidence와 Flash-Lite의 오류 비교, 선택지 후보/none의 오분류 테스트로 임계값 결정. 보정 실측 전에는 낮은 신뢰도인지 알 수 없는 응답을 무조건 신뢰하지 않고 Flash-Lite의 무료 경로로 fail closed한다.
- **전송 성능 및 실행 ID:** SDD-36~47로 실행 ID/단계/상세 조회, SQLite 30일 보관, 같은 대화 직렬 실행, 명시 중지/부분 답변이 확정됐다. 신규 ROAS API의 기본 경로와 실행 상태는 SDD §27.8~9에 기술하고 구현 시 테스트로 검증한다. Vite 로컬 프록시와 Vercel 화면→PC 경로의 로컬 접속, 15초/180초, 연결 중단, 탭 변경/재조회, 중복 요청과 취소를 별도로 확인해야 한다. 다른 대화 간 처리량과 폴링 속도는 현 자원 한도에서 구현 단계 안전 기본값으로 제어하며 사용자에게 새 선호 질문을 만들지 않는다. 서버 종료 후 미완료 자동 재개는 제외한다.
- **원천 통합:** 승인된 리뷰 원문/분류/메타데이터 파일의 데이터 담당 브랜치 통합, 사례별 제공 선언 및 asOf, 자료 해시와 조회 ID 연결, 현재 원천과 비교 무결성. 자료가 합쳐지지 않으면 보이는 미제공 상태와 한계를 테스트한다.
- **분석 품질:** Gemini가 지지와 반대 근거를 실제로 대조하는지는 서버 검사 통과와 다르므로 별도 QA에서 확인한다. no ontology와 ontology 비교는 이후 같은 원천, 모델 할당, 질문, 예산과 인용 검증 기준으로 진행한다.

**이번 문서 작성의 실행 경계:** 문서만 갱신하며 코드/데이터/테스트/CI 변경 없음. 실제 API 요청, 결제, 커밋, 푸시 없음. 이 지시서는 다음 구현 담당의 작업 순서와 수용 계약이며 사용자 동의 없는 구현 시작 허가로 해석하지 않는다.

## 9. SDD-43~47 확정과 아키텍처/API 감사 기록 (2026-11-03)

**사용자 확정:** SDD-43 A, 숫자 주장마다 `metric,value,unit,period,evidenceIds`를 포함하고 답변 전체의 숫자가 구조화 주장과 일치하는지 원천 검증한다. SDD-44 A, 일반 데이터 도구를 서버가 동일 인자로 자동 재시도하지 않고 실패 기록 후 Gemini가 다른 허용 도구 또는 이미 검증된 자료로 계속한다. **모델 제공자 API**의 기존 일시 오류 1회 재시도는 별도 계층이므로 유지한다. SDD-45 B, 이번 기능 인수는 mock 기반 자동 계약, 회귀, lint, build 통과 기준으로 한정하고 분석의 설명 품질에 대한 **수동 QA는 후속**으로 이관한다. 실제 모델/제공자 연동 검증과 intent-to-done 독립 검증 단계는 별개이며 미실행을 통과로 표시하지 않는다.

**코드 대조 결과:** `backend/agent-http.mjs`의 ROAS 경로는 동기 `POST /agent-api/roas/chat`이고, 별도의 `/agent-api/runs/:id`와 `backend/agent-flow.mjs` SQLite 저장은 analysis/budget 용도다. `backend/roas-agent.mjs`의 현행 모델 도구는 `breakdown,trend,records`이고 승인된 7개 도구 및 최신 예산과 다르다. 기존 `frontend/workbench/agent-client.ts`도 ROAS에는 동기 chat API를 쓴다. **새 ROAS 실행 ID 생성, GET 상태/상세 조회, 같은 대화 중복 방지, 7개 모델 공개 도구, 숫자 검증을 추가하되 기존 경로/보안 계약과 별도 analysis/budget 흐름은 보존해야 한다.** 이 문서는 구현 지시이며 작동 확인 결과가 아니다.

| 분류 | 처리 | 추가 승인 필요 여부 |
| --- | --- | --- |
| 사용자 확정 | 단일 조사 에이전트, 범위 잠금, Jev 첫 분류/Flash-Lite 대체, Gemini 종료 판단, 7개 모델 공개 도구, 요약 우선, ID 기반 `evidence`, 일반 조회 실패 시 계속, 구조화 수치 검증, 자동 도구 재시도 없음, 자동 테스트 기능 인수, SQLite 30일 보관, 명시 중지 | 이미 **SDD-01~47로 확정. 다시 질문하지 않음** |
| 구현 담당의 세부 기술 계약 | 새 ROAS POST 실행 생성/GET 상태/취소 경로, `runId/threadId/clientRequestId`, 동일 키+동일 입력 fingerprint 중복 방지, HTTP 상태/폴링 간격, 도구 인자 enum/JSON 스키마, 반환 페이지 크기, 원본 필드 매핑, 원천 ID 해시/범위 검증 및 UI 이벤트 타입 | **새 사용자 선호 결정이 아님.** §27.8의 경로/의미 계약과 보안을 지키는 mock 테스트로 확정 |
| 사용자 운영 정책 완료 | SQLite 결과/로그 **종료 후 30일 자동 삭제**, 기존 채팅에서 **분석 중지 버튼** 제공, 중지 후 신규 호출 차단, 검증된 일부 결과만 부분 표시 | **SDD-46 A 및 47 A 확정.** 구체적인 기술 설계는 [SDD §27](agent-development-sdd.md) |
| 환경/검증 미실측 | 실제 Gemini/Jev 무료 한도와 호환성, 네트워크 응답 시간, 리뷰 통합 무결성, 실제 분석 품질의 수동 QA, intent-to-done 독립 검증 | 새 인터뷰가 아닌 별도 환경 확인/QA/권한 범위. 실 API 요청, 결제, 푸시는 별도 승인 필요 |

**추가 자동 인수 테스트:** T34는 모든 숫자와 정형 주장 일치/단위/반개방 기간/인용 ID/원천값 대조, 숫자 우회 차단. T35는 일반 데이터 도구 오류 자동 재시도 0회, 검증된 자료로 계속, 무결성 오류 시 보류, 모델 제공자 재시도 정책과 구분. T36은 mock 계약 및 회귀, lint, build 결과를 기록하고 수동 설명 품질 QA와 실계정 검증을 후속/미실측으로 남기는지 확인한다. 기존 T01~T33 회귀와 별도 analysis/budget API를 보존해야 한다.

**인계 상태 기록:** SDD-46~47까지의 초기 사용자 정책 결정은 완료됐고, 이후 **SDD-48~50을 추가 확정**했다. SDD-51~53은 별도 선택을 기다린다. SDD §27의 설계와 실 코드 기반 계약, TDD 수용 기준을 검토할 수 있지만 **테스트 착수/실제 구현 허가가 있었다고 해석하지 않는다**. 실제 모델 계정 무료 한도, 현 원천 통합 및 네트워크 호환성의 확인은 별도 미실측 사항으로 남긴다. 실 API 호출, 기능 구현, 커밋, 푸시는 이 문서 작업 범위 밖이다.


## 10. 아키텍처, 워크플로우, 7개 도구 구현 인계, SDD §27 요약

**핵심 아키텍처와 도구 구현 설계는 [SDD §27~28](agent-development-sdd.md)에 상세 작성했다.** 사용자가 우려한 것은 구현 버튼이나 JSON 필드명 결정의 부족이 아니라 **어떤 컴포넌트가 분석을 통제하고 도구가 실제 어떤 원천을 조회하는지**에 관한 계약 부족이었다. 다음은 구현 담당이 읽어야 할 시스템 흐름과 각 도구의 구현 출발점이다. 테스트나 실제 호출을 수행했다는 뜻은 아니다.

### 10.1 컴포넌트와 호출 순서

```text
기존 ROAS 대화 UI
   → ROAS run HTTP(인가, idempotency, thread 활성 실행 1개)
   → Orchestrator(범위 잠금, 경로, 예산, 마감, 취소, 상태 전이)
   → 서버 overview 선조회 + 증거 발행
        ├ quick: review_summary도 반드시 선조회(미제공/오류 상태 유지)
        |         → overview + review_summary 요약 → 빠른 Gemini → 정형 답변/숫자 검증
        └ deep: Jev(미연결/불확실 시 Flash-Lite)
              → 최초 선택 데이터 도구 조회
              → Gemini 분석 모델의 도구 선택과 조사 반복
              → Gemini 충분/근거 부족 종료
              → 숫자 주장, 범위, 인용의 서버 독립 검증
   → SQLite 종료 결과 + 이벤트 저장(30일)
   → 기존 채팅의 주요 단계, 상세 표시, 분석 중지, 검증된 응답
```

**책임 경계:** Jev/Flash-Lite는 최초 제한된 도구 선택만, Gemini는 추가 조회/해석/종료 판단, Tool Layer는 검증된 데이터 조회/계산, 서버는 범위/모델 요청/비용/시간/취소/수치/인용 검사를 담당한다. Gemini의 종료 판단을 서버가 새 설명 충분성 점수로 거절하지 않는다.

### 10.2 도구 구현 책임과 정확한 소스

| 모델 공개 도구 | 실제 소스와 알고리즘 | 입력/출력 필수 계약 |
| --- | --- | --- |
| `overview` | `trainingScreenData` → `comparePeriods` → `summarize`. baseline/current의 원행 합계를 집계하고 분모 0/해시를 검증 | `scopeRole,metrics` → 기간별 KPIs, 원시 분자/분모, rowCount, 증거 ID, 보고 기준 |
| `metric_detail` (지표 세부 데이터 조회) | `metricCapabilities`로 지표 구성/가용성을 확인하고, 기존 `summarize`와 `selectFacts/selectBreakdowns`를 재사용해 기간별 분자/분모/값과 선택한 그룹 비교를 계산 | `scopeRole,metric,dimension?,offset?,limit?` → 산식, 원시 분자/분모, 관련 지표와 실제 지원 차원, baseline/current 및 선택적 그룹/근거 ID. 여러 차원의 합산 금지, SDD §32 우선 |
| `trend` | `selectFacts`와 `trendRows`, 동일 원행 기준 날짜별 `summarize` | `periodId,granularity:"day",metrics,offset,limit` → 일별 기간/날짜, 숫자, 원천 증거 ID, 페이지 |
| `records` | `selectRecords`, asOf 및 현재 기간의 종료일 제한, 단순 제목/본문/범주 검색 | `category,query,offset,limit` → `recordId,date,category,scope,values,evidenceId`, total/nextOffset. 운영 기록은 상관관계이지 인과 확정 아님 |
| `review_summary` | `reviewQuery`, 원문/분류/메타데이터 SHA 검증. 작성일 기준 baseline/current, 수집일은 asOf cutoff로 제한 | `productId=EDU-P1,sourceId,periodId,categoryId` → 고유 건수, 별점, 다중 카테고리 건수/비율, 미분류, taxonomy, evidence. S16/S17 각 25건, 타 사례 not_provided |
| `review_records` | `reviewQuery`의 원문 ID, 작성일, 판매처, 감성/카테고리/경험/문구 검색. `evidenceQuote`와 원문 대조 | `reviewIds,sourceId,periodId,categoryId,experienceId,sentiment,query,offset,limit` → 실제 리뷰 ID/원문/별점/분류/인용과 페이지 |
| `evidence` | run별 발행 evidence registry에서 ID 검증. ROAS `chatSourceRows` 등으로 원행 복원, 리뷰 `reviewQuery`에서 원문 재확인 | `evidenceIds[]` → 이번 run의 발행/해시/기간/주, 보조 범위와 일치하는 원천. 모델 확인과 **서버 최종 검증 별개** |

**공통 도구 응답:** `status=ready|empty|not_provided|pending|error`, `scope,reportingBasis,dataHash,sourceVersion,rows,total,nextOffset,truncated,evidenceIds,limitations`. 한 번에 반환할 원문/페이지/증거 ID의 안전 제한은 SDD §27.5에 제시한 기존 코드의 24개 기본안을 우선하되 mock 테스트로 확인한다. 원천 없는 교차 조회, 자유 SQL/파일 경로/외부 검색은 거절한다.

### 10.3 run API, 상태/저장 및 취소

**SDD-48 B**를 만족하려면 **인증된 QA 참가자의 Vercel 화면 → HTTPS 접속 계층 → 운영자 PC 서버**가 필요하다. 기존 `127.0.0.1` 주소는 운영자 PC의 브라우저에서만 유효하며 외부 참가자의 브라우저에서는 참가자 본인 컴퓨터를 가리킨다. 외부 사용자별 인증, 승인/회수, 실행/스레드 소유권, 무료 모델 사용량 및 요청 속도 제한을 서버와 외부 경계에서 강제한다. 기존 공유 토큰/Origin만으로 사용자 인증을 대체하지 않으며, 정확한 접근 방식은 아직 별도 설계 대상이다. HTTPS 터널/프록시, 포트 개방, 외부 배포 및 계정 생성은 별도 승인 전 실행하지 않는다.

SDD §27.8 기술 설계에 따라 `POST /agent-api/roas/runs`는 `runId`를 곧바로 반환하고 `GET /agent-api/roas/runs/:id`는 진행 단계/실제 이벤트/완료 시 결과를 조회한다. `POST /agent-api/roas/runs/:id/cancel`은 멱등 중지 요청을 기록하고 이후 신규 모델/도구 호출을 차단한다. runStatus와 결과 executionStatus, 원인 causeStatus는 **서로 다른 필드**로 관리한다. SQLite run/event/evidence의 원자 갱신과 만료/재시작 처리, 기존 토큰/Origin/Host와 analysis/budget 호환을 검증한다.

**SDD-46 A:** 종료 시각부터 30일간 SQLite 결과/상세 로그/발행 증거를 보관 후 자동 삭제. 브라우저에 남은 완료 대화 캐시와 서버 만료된 상세 이력을 혼동하지 않는다.

**SDD-47 A:** 기존 채팅에 분석 중지 버튼. 요청 이후 신규 호출 0건, 진행 중 외부 호출 best-effort 취소, **서버가 검증한 내용만 부분 표시**, 근거가 없다면 중단 안내. 중지한 실행은 정상 완료로 표기하지 않는다. 화면 이동/연결 이탈은 자동 중지가 아니다.

### 10.4 TDD, CI와 남은 승인 경계

| 추가 테스트 | 검증 |
| --- | --- |
| **T37** | 완료 후 30일 보관, 만료 시 SQLite run/event/evidence 동시 삭제, 브라우저 캐시에서 서버 만료 안내 |
| **T38** | 실행 중 사용자 중지, 이후 모델/도구 신규 호출 0회, 이미 진행 중인 호출 취소 best-effort, 부분/미제공/취소 상태 구분 |
| **T39** | 취소, 완료, 재시작 경합에서 terminal 단일 확정, 로그/사용량 정합성, 자동 재개 금지 |
| **T40~T42** | `AT-TOOL-01/02`, 7개 도구 schema, 실제 원천 함수와 기간별 숫자/주문/비율 역검증, 지원하지 않는 교차 범위 거절 |
| **T43~T45** | `AT-REVIEW-01`, S16/S17 사례별 25건, 작성일/수집일/asOf, 분류와 다중 라벨, 리뷰 미제공 상태와 증거 원문 확인 |

**필수 자동 검사:** 기존 `npm run test:agents`, `npm run test:roas`, `npm run test:training`와 신규 mock run/7-tool/HTTP/UI 테스트, `npm run lint`, `npm run build`를 통과시키고 CI에 등록한다. 구현 시 첫 단위는 run 저장 및 동시 요청/보안 계약의 **RED 테스트**다. 이후 각 도구, 단계 전이, 모델 라우터, 수치 검증, UI 순으로 구현한다. **코드 변경 또는 테스트 실행은 현재 허용받지 않았다.**

**SDD-45 B 유지:** 자동 테스트와 CI가 통과해야만 이번 기능 인수 대상이고, 실제 모델 반응의 질과 반대 근거 해석의 수동 QA는 후속이다. 실제 제공자 호출, 유료 과금, 새 마케팅 데이터 생성/스키마 변경, 배포 및 커밋/푸시는 별도 승인이 없으면 금지한다. 기존 미커밋 리뷰 통합과 ROAS 동작을 보존한다.

## 11. SDD-48~50 추가 확정, 7개 도구 연계 검토

**SDD-48 B, SDD-54 A, SDD-56 최종:** 외부 QA는 Vercel 공개 대시보드에서 **Agent 기능에만 공용 테스트 계정으로 로그인**해 사용한다. PC는 아웃바운드 터널과 인증 HTTPS 게이트웨이를 사용하고 Agent 서버의 로컬 바인딩은 유지한다. 참가자 브라우저의 127.0.0.1은 본인 PC를 가리킨다. 사용자별 계정 관리/개인 추적 없이 공용 계정 전체 실행량을 제한한다. 실제 게이트웨이와 테스트 계정은 별도 구현 승인 전 생성하지 않는다.

**SDD-49 B:** 빠른 조회에서는 질문과 상관없이 서버가 overview와 review_summary를 함께 선조회한다. 두 도구의 자료 상태와 검증된 집계 및 근거 ID를 빠른 Gemini의 정상 호출 한 번에 전달한다. 리뷰 미제공, 검증된 빈 결과, 원천 오류를 구분하고 ROAS 집계에는 영향을 주지 않는다. 실행 한도는 기존 15초, 정상 모델 1회, 전체 3회를 유지한다.

**SDD-50 B:** 같은 채팅의 상세 표시에는 실제 도구명, 입력 요약, 성공/실패/빈 결과 상태, 반환 건수, 근거 ID, 실행 시각과 소요 시간만 보여준다. 모델 경로와 검증의 요약 상태를 포함할 수 있지만 도구 요청/반환 전체 JSON과 비공개 모델 추론은 보여주지 않는다. 본래 답변의 정상 원문 인용 및 AI의 evidence 도구 사용은 유지한다.

**SDD-04와 SDD-44 정합성:** 일반 데이터 도구 오류에서는 서버의 동일 요청 자동 재시도 0회가 적용된다. 별개로 답변 수치나 인용의 검증에 실패한 경우에는 SDD-04에 따라 동일 실행, 범위, 원천 해시에서 실패 항목의 근거를 표적 재조회하고 답변 수정 후 검증을 반복할 수 있다. 이때 모델 호출 및 시간 상한을 지킨다. Gemini의 근거 부족 종료 후(SDD-33), 사용자 중지 후(SDD-47), 예산/시간 한도 도달 후에는 신규 조회를 하지 않고 이미 검증된 자료로만 부분 답변/보류한다.

**시나리오:** S16의 '현재 ROAS'는 overview+review_summary 선조회 뒤 수치 검증, '쓱쓱샴푸 리뷰 특징'은 검증된 요약과 필요 시 review_records/evidence, 'ROAS 하락과 리뷰 관계'는 overview부터 Jev/Gemini 선택에 따라 metric_detail/trend/records/review_summary/review_records를 조사하고 두 자료의 원천과 기간을 독립 검증한다. 사용자 구매행동과 리뷰의 연결 원천이 없으므로 동시 변화를 인과 확정으로 표현하지 않는다.

**추가 테스트:** T46은 공용 QA 계정 없이 Agent API 접근 불가, 브라우저별 대화 충돌 방지, PC 오프라인과 HTTPS 연결 실패 안내. T47은 빠른 경로 overview와 review_summary 공통 조회, 리뷰 상태 구분, 기존 모델 호출/시간 상한. T48은 상세 로그의 허용 메타데이터 표시와 원본 JSON 비노출. T49는 검증 실패의 표적 재조회와 일반 도구 오류의 자동 재시도 금지 및 근거 부족 종료 후 신규 조회 금지를 각각 검증한다.

**SDD-51~53 모두 A안 확정:** 독립 도구는 고정 원천 버전으로 병렬 처리, ROAS/리뷰의 같은 기간 변화를 나란히 비교하되 인과 미확정, Gemini evidence 호출은 필요시 선택하고 서버 검증은 항상 필수다. **SDD-54와 SDD-55는 모두 A안 확정**이다. 운영자 PC가 생성한 HTTPS 아웃바운드 터널을 인증 게이트웨이로 연결하되 PC 서버는 로컬 바인딩을 유지한다. PC의 단일 Node 프로세스에서 Run Engine을 비동기로 실행하고 POST 요청에는 즉시 runId를 반환하며 별도 워커/큐를 운영하지 않는다. 인수 조건은 [SDD §30.3](agent-development-sdd.md)의 AT-ARCH-54/55를 따른다. **SDD-56은 공용 QA 계정 하나, SDD-57은 A안의 실행별 검증된 메모리 스냅샷으로 확정**했다. 개인별 로그인/사용량 감사와 영속 원천 버전 저장소는 구현 대상에서 제외한다. 구현 및 실제 접속/모델 호출 승인은 여전히 없다.


## 12. SDD-58 구현 인계, 지표 세부 데이터 조회와 조회 가능 항목 사전 (2026-11-04)

**최신 사용자 승인:** 기존 모델 공개 `breakdown`을 **`metric_detail`(UI/실행 상세 표시: 지표 세부 데이터 조회)**로 대체한다. 총 7개 공개 도구 수는 그대로다. 이 절과 [SDD §32](agent-development-sdd.md)가 위의 과거 `breakdown` 입력/목록/구현 순서 제안보다 우선한다.

**실행 전 해야 할 기술 작업:**

1. 현재 리팩터링 작업 브랜치와 실제 소스 경로, 승인된 ROAS 원천/리뷰 로더를 먼저 재확인한다. 기존 미커밋 파일/삭제/이동을 임의 복구하거나 덮어쓰지 않는다.
2. 승인된 기존 `chatMetrics`, `summarize`, `metricMissingReason`와 실제 지표 상세 UI의 수식/원천을 참조하여 서버 단일 정의 원천의 `metricCapabilities` 사전을 구성한다. `metric` ID, 표시명, 산식, 원시 분자/분모 또는 직접 합계, 단위, 관련 지표 후보, 가능한 차원과 출처 제약, 원천 미제공 사유를 정의한다. 초기 등록은 SDD §32.2의 기존 11개 지표를 기준으로 한다.
3. 실행 시작에 SDD-57의 고정 메모리 스냅샷과 현재 필터/보고 `asOf` 기준으로 `metricCatalog`를 산출해 Jev 최초 도구 선택 및 Flash-Lite/Gemini 호출에 제공한다. 스키마의 `metric`은 허용된 값만 받으며 `dimension`은 선택적이고 해당 원천에서 실제 제공하는 조합만 허용한다.
4. `metric_detail({scopeRole,metric,dimension?,offset?,limit?})`의 반환 계약을 SDD §32.3과 같이 구현한다. 지표 구성/기간별 합계 및 기초 필드, 관련 지표 후보/가용성, 선택 차원별 직전/현재 그룹값, 근거 ID, 범위와 해시를 반환한다. 기존 `selectFacts/selectBreakdowns/summarize`를 재사용하며 도구 자체가 임의 관련 지표의 인과를 확정하지 않는다. 기존 그룹 비교/페이지/숫자/범위 제약은 보존한다.
5. 모델 공개 도구 목록, Jev 후보, Gemini tool schema, dispatcher, evidence verifier, 사용 로그 표시명과 mock fixtures에서 구 `breakdown`을 새 `metric_detail`로 정합성 있게 바꾼다. 신규 도구 하나를 추가하는 것이 아니라 **기존 하나의 교체**다. 역사 문서의 옛 명칭은 참고용으로 보존한다.

**추가 mock 인수 시험:** `T50` 7개 도구 목록과 유일한 `metric_detail` ID, `T51` CVR의 `orders/clicks`와 AOV의 `revenue/orders` 기초 필드/단위/직전과 현재/0분모, `T52` 사례와 필터별 실제 지원 차원 동적 제공 및 미지원 `CAC`, 허용되지 않은 `dimension` 거절, `T53` 그룹별 원시 분자/분모 검산과 서로 다른 차원 중복 합계 금지, `T54` 지표 카탈로그가 Jev/Flash-Lite/Gemini에 제공되고 근거 ID가 동일 run 스냅샷에 속하는지 검증. 기존 계약/회귀, lint, build 및 관련 CI를 통과해야 기능 완료로 판단한다.

**이 문서는 설계/인계 갱신이며 실제 코드/데이터/CI, 모델 API, 커밋/푸시는 변경하거나 실행하지 않는다.**


## 13. SDD-59 구현 인계, Gemini 직접 무료 한도와 Vercel/Sail 무료 제공 크레딧 경로 (2026-11-04)

**주의: 최신 §14/SDD §34가 우선한다.** 이 절에서 Sail을 비활성으로 두거나 Gemini 전용 생성 정책 때문에 대체하지 못한다고 한 제한은 SDD-60에서 철회했다. Sail의 적격 오픈 모델은 예산/기능 검증 후 바로 자동 전환할 수 있다.

**최신 모델 선택/전송 계약:** [SDD §33](agent-development-sdd.md)을 우선한다. 사용자 지급 주장: Vercel AI Gateway 5달러, Sail Research 5달러. **Vercel의 크레딧은 Gateway를 통한 Gemini 모델 요청용**, Sail의 크레딧은 **공개 모델 요청용**이며 **Gemini 요청으로 전용하거나 합산할 수 없다**. 실제 사용자 계정의 잔액/청구 조건은 아직 확인하지 않았다. Sail 비-Gemini 모델의 실 Agent 답변 자동 대체는 **추가 허가 전 비활성**.

| 역할 | 모델 정책 | 전송/크레딧 선택 | 필수 검증 |
| --- | --- | --- | --- |
| 빠른 답변 | 기존 빠른 Gemini 생성 모델 | Google 직접 무료 할당량 우선, 부족 시 Vercel Gateway 무료 제공 크레딧으로 같은 역할의 Gemini | 15초, 정상 1회/전체 최대 3회, 구조화 수치 주장 |
| 심층 Gemini 조사/종료/답변 | 기존 별도 심층 Gemini 생성 모델 | 직접 무료 우선, 부족 시 Gateway 크레딧 사용 | 180초, 정상 최대 4회/예외 최대 2회/총 6회, 정상 마지막 1회 답변 예약 |
| 최초 심층 도구 선택 | Jev Choice 우선 | Jev의 확인된 무료 크레딧 | Jev 0이면 Flash-Lite 정상 1회, 실제 실패 후 fallback은 예외 1회 |
| Flash-Lite 분류 | 무료 Gemini Flash-Lite | Google 직접 무료, 부족 시 Vercel Gateway에서 해당 모델 지원 확인 후 크레딧 | 후보 스키마/JSON 및 Jev 예산 규칙 검증 |
| Sail 오픈 모델 | **후보, 비활성** | `SAIL_API_KEY` 별도 5달러 크레딧(계정 상태 미실측) | 비-Gemini 생성 모델 채택은 별도 사용자 허가, 모델 ID/도구·JSON 지원, QA 검증 필요 |

**구현 단계:** 현재 리팩터링의 실제 `backend/roas`, `scripts/roas`, `shared/roas` 경로 확인 → 모델 논리 역할과 실제 API 전송 경로를 분리한 provider adapter/selector 작성 → `AI_GATEWAY_API_KEY`의 서버 전용 주입과 Gateway의 `https://ai-gateway.vercel.sh/v1` 및 Google/Gemini 모델 ID 지원 점검 → 기존 Gemini 네이티브 응답과 Gateway 구조화 출력/도구 호출 결과 정규화 → 잔액/키 예산/자동 충전/유료 티어 상태 확인을 선행하는 fail-closed 예산 게이트 → 호출 기록과 제공자별 지연·비용 추적 → Sail API(`https://api.sailresearch.com/v1`, `SAIL_API_KEY`)의 **비활성 후보 어댑터** 구성(실제 사용 금지) → 계약 mock 및 승인된 후속 실계정 검증. 키는 로컬 비밀 저장소/서버 환경에서만 사용하고 클라이언트와 저장소에서 제외한다.

**비용/자동 전환 주의:** Gateway는 팀 무료 티어가 월 5달러이며 유료 크레딧 구매 시 월 무료 제공이 유지된다는 보장이 없다. BYOK 실패의 Gateway 자체 시스템 키 fallback은 **Gateway 크레딧을 소비할 수 있다**. Sail의 월 5달러 혜택에는 결제수단 연동 조건이 안내돼 있으므로 계정의 실제 혜택/초과 청구 방지 확인 없이 모델 요청하지 않는다. 동일 논리 요청을 두 경로로 병렬 송신하지 않고 실제 전송별 `transport,provider,model,billingBucket,attempt,tokenUsage,cost,fallbackReason`를 기록한다. 모델 호출 상한을 무력화하는 공급자 SDK 자동 재시도 및 Gateway 자동 fallback은 명시적으로 제한한다.

**추가 자동화 계획:** `T55` 직접 Gemini → Gateway 단일 경로 전환/모델 역할 고정, `T56` 0 잔액/미검증/유료 전환 상태 fail-closed 및 자동 충전·BYOK fallback 경계, `T57` 빠른/심층/Jev/Flash-Lite 전체 모델 호출 예산과 Gateway 내부 fallback 계측 구분, `T58` Sail 생성 경로 기본 비활성 및 비-Gemini 모델의 무승인 자동 대체 금지, `T59` API 키 비노출과 provider/model/usage 이벤트 기록. 모두 테스트용 mock으로 구현해야 하며 실제 모델 API/실요금/속도 검증은 별도 승인한다. 기존 SDD-45의 회귀, lint, build, CI 계약은 그대로 유지한다.

**공식 참고:** [Vercel Gateway Pricing](https://vercel.com/docs/ai-gateway/pricing), [Vercel Text Generation](https://vercel.com/docs/ai-gateway/getting-started/text), [Vercel BYOK](https://vercel.com/docs/ai-gateway/authentication-and-byok/byok), [Sail Research](https://sail.computer/), [Sail API 호환 안내](https://sail.computer/support). 2026-11-04 문서 조회에 근거하며 실제 계정 사용·연동이 완료됐다는 뜻이 아니다.

**이번 요청 수행 범위:** 문서 갱신만. 프로그램 코드, 키 연결, 크레딧 사용, 결제수단 설정, 실 API 호출, 커밋, 푸시는 진행하지 않는다.


## 14. SDD-60 구현 인계, 한도 소진 시 다른 생성 모델로 즉시 자동 전환 (2026-11-04)

**최신 확정:** 사용자가 비-Gemini 공개 모델을 **Agent 답변용 대체 모델**로 명시 허용했다. Gemini에 할당량/429/크레딧 소진이 발생하면 같은 모델에 재시도하거나 사용자에게 재질문하지 않고 **다음 적격 모델로 즉시 전환**한다. 이 절은 앞 §13의 **Sail 비활성 및 별도 허가 필요** 문구를 대체한다. API 계정/키 연결과 실 호출은 여전히 별도 작업이다.

| 우선순위 | 논리 모델/전송 경로 | 실행 조건 |
| --- | --- | --- |
| 1 | 역할별 Google Gemini 직접 무료 API | 실제 무료 할당량, 모델의 JSON/도구 기능, 비용 차단이 검증된 경우 |
| 2 | Vercel AI Gateway의 사용 가능한 Gemini 또는 기능 호환 모델 | 실제 Gateway 무료 $5 계정 잔액, 모델 기능, 결제 차단이 검증된 경우 |
| 3 | Sail Research의 적격 DeepSeek/GLM/Kimi 등 공개 모델 | 실제 Sail 무료 $5 계정 잔액/결제 경계, 해당 역할의 구조화 출력과 도구 호출 호환성이 검증된 경우 |
| 별도 | 최초 도구 선택은 Jev 우선 → Flash-Lite → 필요시 Sail의 검증된 분류 후보 | 원래 Jev Choice 우선과 비용 제한 유지 |

**라우터 필수 동작:**

- `quota_exhausted`, `insufficient_credits`, 429 등 현재 후보의 요청 제한을 만나면 **동일 후보 재시도 없이** 다음 적격 후보로 이동한다. 계정별 잔액과 RPM/TPM/RPD는 구분한다. 사전 상태가 없는 후보를 무작정 API 호출하지 않는다.
- 전환 대상이 바뀌어도 기존 `runId`, 정규화 범위, ROAS/리뷰 원천 스냅샷, 이미 발행된 Evidence ID와 도구 이력을 보존한다. **실패한 모델 요청 단계만 교체**하고 동일 조회를 처음부터 반복하지 않는다. 어떤 생성 모델이든 `metric_detail` 포함 **7개 도구 카탈로그와 동일한 정형 `numericClaims`/서버 검증**을 통과해야 한다.
- 실제 요청 시도는 성공/실패 무관 카운트한다. Gemini 실패를 정상 슬롯으로 사용했으면 Vercel 또는 Sail의 재요청은 **예외 슬롯 1회**를 차감한다. 전체 빠른 **3회/15초**, 심층 **6회/180초**, 심층 최종 정상 호출 예약은 그대로 적용한다. 예산이나 시간이 모자라면 모델을 추가 호출하지 않고 검증된 부분 답변/보류를 반환한다.
- 공급자마다 JSON 출력, 도구 호출, API 응답 객체가 다를 수 있다. `modelRole,actualModel,transport,provider,billingBucket,attemptIndex,errorClass,fallbackReason,tokenUsage,estimatedCostUsd,reportedCostUsd?`를 공통 계측하고 provider adapter에서 정규화한다. 한국어, 인용, 숫자 및 완료 판단을 검증한 모델만 후보 목록에 등록한다.
- **Vercel의 내부 자동 모델 fallback과 직접 API→Gateway→Sail의 앱 레벨 전환을 중복 실행하지 않는다.** BYOK 실패 시 Vercel 자체 자격증명으로 넘어가 Gateway 크레딧이 차감될 수 있어 기본적으로 BYOK와 내부 모델 fallback은 비용 통제 방식이 검증될 때까지만 비활성/제한한다.
- 크레딧과 실제 유료 과금은 다르다. Google 무료, Vercel 무료 $5, Sail 무료 $5에서 벗어나 **사용자에게 실제 과금이 발생할 위험이 있으면 해당 후보를 건너뛴다**. Sail 결제수단 등록, 자동 충전, 유료 전환을 이번 사용자 승인으로 간주하지 않는다.

**모의 인수 테스트 추가:** `T60` Google 직접 429 → Vercel 즉시 대체, `T61` Gateway 부족 → Sail 대체, `T62` Sail JSON/도구 기능 미지원 시 건너뛰고 원인 기록, `T63` 실제 API 실패/대체 요청 합산과 3회/6회·15초/180초 초과 차단, `T64` 중간 전환에서 실행 범위/스냅샷/증거/수치 검증 보존, `T65` 모든 무료 버킷 불가 시 안전 중단과 사용자 상태 문구, `T66` 키/비용 정보 비노출, SDK/Gateway 내부 재시도 및 BYOK 비용 경계. 계약 mock 및 기존 agent/ROAS 회귀, lint/build, 관련 CI에 포함한다. 모델별 실제 유료 호출, 키 연결, 결제, 푸시는 **별도 명시 승인 전 실시하지 않는다**.

**근거:** [Vercel 무료 요금](https://vercel.com/docs/ai-gateway/pricing), [Vercel 모델 Fallbacks](https://vercel.com/docs/ai-gateway/models-and-providers/model-fallbacks), [Sail Research](https://sail.computer/), [Sail FAQ](https://sail.computer/support). 해당 서비스의 제공 모델과 무료 한도는 계정·시점별로 실제 확인해야 하며 이번 작업은 설계 문서의 최신 정책을 고정한 것이다.
