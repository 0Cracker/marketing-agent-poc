# B 담당 지침, 실행별 원천 스냅샷과 7개 데이터 도구

**공통 필독:** 시작 전 `AGENTS.md`, Skills 목록, `.agents/skills/poc-iteration-log/SKILL.md`, `git status --short --branch`, [공통 계약](00-shared-contract.md), [SDD §27~34](../../design/agent-development-sdd.md), [현재 경로 분리 문서](../../design/roas-legacy-separation.md)를 읽는다. 이 작업은 **별도 worktree와 브랜치**에서 수행하며 본문에 정한 파일 밖을 수정하지 않는다. 실제 외부 AI 요청, 비밀키 출력, 결제, 커밋, 푸시는 명시적 별도 허가 전 금지한다.

## 목표

**원천 데이터 읽기, 지표 상세 조회, 리뷰 분석, Evidence Registry를 서버 결정적 코드로 구현한다.** AI 모델이 숫자를 직접 계산하거나 데이터를 창작하도록 하지 않는다. ROAS/리뷰 스키마, 14일 baseline/current, asOf, 선택한 사례와 필터를 그대로 유지한다.

## 수정 가능 영역

- 신규 `backend/roas/tools/**`, `tests/agents/tools/**`만 수정.
- 읽기 전용 참고: `shared/roas/training-dashboard.mjs`, `shared/roas/roas-chat.mjs`, `scripts/roas/training-data.mjs`, `scripts/roas/review-data.mjs`, `scripts/roas/data.mjs`, `data/roas/**`, [SDD §27.5~6, §32](../../design/agent-development-sdd.md).
- 데이터 파일, 원본 계산식, 화면, 기존 `backend/roas/roas-agent.mjs`, 임의 테스트용 가짜 마케팅 원천은 만들거나 고치지 않는다. 다른 담당 모듈을 편집하지 않는다.

## 구현 API

```js
const tools = await createToolRuntime({directory, scope, runId, issuedAt, now, sourceLoader});
tools.metricCatalog();   // 지표 ID, 계산식, 기초 필드, 지원 차원, 제공 상태
tools.toolSchemas();     // 모델에 공개할 일곱 개 스키마만
await tools.execute({name:'metric_detail', args:{scopeRole:'primary',metric:'cvr',dimension:'campaign'}});
tools.verifyEvidence({evidenceIds,claims});
await tools.dispose();
```

- 스냅샷은 실행 시작 시 한 번만 로드한다. 승인된 해시와 리뷰 원문/분류/상품 메타데이터를 함께 검증하고 run 도중 파일 변경이 있어도 동일 객체를 유지. SHA/범위 충돌은 오류, 종료 후 메모리 해제. 신규 영속 원천 복제 저장소는 만들지 않는다.
- `overview`: baseline/current 매출, 집행비, 주문, 클릭 등 전체 KPI 및 분자/분모, 제공 상태. 빠른 경로에서 `review_summary`와 함께 선조회할 수 있어야 한다.
- `metric_detail`: **지표 세부 데이터 조회**, 구 `breakdown` 모델 공개 ID는 사용하지 않는다. 필수 `metric`, 선택 `dimension`, 데이터/기간별 계산식, 원시 분자/분모, 값, 관련 지표, 동적 `supportedDimensions`, 그룹별 직전/현재, 근거와 페이지. CVR `orders/clicks`, AOV `revenue/orders`, ROAS `revenue/spend`. 0분모는 `null`, 평균 비율/지원되지 않는 집계 금지.
- `trend`: 날짜별 승인 기간에 해당하는 값, 누락 날짜를 0으로 위장하지 않음.
- `records`: 운영 변경 기록, asOf와 범위 제한, 시간 근접을 인과로 확정 금지.
- `review_summary`: S16/S17, EDU-P1 쓱쓱샴푸만 검증된 리뷰/분류 집계. 각각 25건, 총 원본 50건은 두 사례 합계이지 단일 사례 총합 아님. 타 사례는 `not_provided`와 실제 0건을 구분, 다중 카테고리 비율 합계 100% 강제 금지.
- `review_records`: 리뷰 원문, 작성일 기준 기간, 수집일은 보고 asOf 컷오프, 검증된 분류와 실제 인용, 페이지/원문 ID. 임의 재분류 금지.
- `evidence`: 같은 run에서 **실제 발행한** 증거 ID만 재조회, 원천 해시/범위/기간 결속, 미발행/타 run/해시 불일치 ID 거절. 최종 답변의 수치 검증은 C 엔진과 협력.
- 공통 반환 `status:ready|empty|not_provided|pending|error`, `scope,reportingBasis,dataHash,sourceVersion,evidenceIds,limitations`; `total,nextOffset,truncated`를 필요한 목록에 제공. `limit:1..24`, 검색어 최대 120자, evidence IDs 1..24의 초기 계약 유지.

## 특정 지표를 AI가 이해하도록 만드는 방식

`metricCapabilities`는 기존 `chatMetrics`, `summarize`, `metricMissingReason` 및 실제 원천 필드에서 파생하고, **정의상 계산 가능**과 **이번 사례/필터에서 실제 자료 제공**을 분리한다. quick/deep 프롬프트에 전달할 압축 `metricCatalog`를 반환한다. 지표마다 허용 차원이나 원천이 다를 수 있다. 지원하지 않는 CAC는 CPA로 바꾸지 않고 명시적으로 거절한다. `metric_detail`에 없는 ROI/순이익/상품×매체×기기 교차 조합을 추정 생성하지 않는다. 합성 배분 비용에는 합성 원천 표시를 유지한다.

## 테스트와 인계

- 정확히 7개 모델 공개 이름, 비정상 도구명/인자 거절, 지표 사전/실제 조회 차원, CVR/AOV/ROAS의 분자/분모/기간 합계/0분모, 페이지 커서 검증.
- S16/S17 25건, 타 사례 `not_provided`, 작성일과 수집일 asOf 차이, 분류 SHA 오류/미제공/빈 결과가 ROAS 조회를 중단시키지 않는지 테스트.
- run 스냅샷 생성 후 파일 변경 모의, 모든 도구,근거 검증이 **동일 해시**를 쓰는지, run 종료/다른 run의 ID 오염 차단, 임의 자유 SQL/URL/파일 경로 금지.
- 테스트 데이터는 현재 승인된 원본/fixtures와 통제된 행 선택을 사용하고 신규 가상 마케팅 관측 생성은 하지 않는다. 외부 AI 호출 없음.
- 단독 테스트 `node --test tests/agents/tools/*.test.mjs`, 공통 회귀/lint/build. 결과, 계약 차이, 아직 연결하지 않은 부분과 사용한 파일 목록을 I에게 인계한다.
