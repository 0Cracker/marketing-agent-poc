# 데이터 영역

## 2026-10-23 교육용 공통 대시보드

S01~S18은 `training-dashboard.json`의 단일 `roas-training/1` 규약을 사용한다. 조회와 비교는 각각 14일이며, 기존 활성 관측 41,341행과 기존 원천 파일은 보존한다. 신규 자료는 38,760개 집계와 공유하는 개별 상세 105건이다. 기존 기초형 15개에 날짜별 복합 변화 사례 3개를 추가했다. 주문, 클릭, 세션과 리뷰 원문은 새로 생성하지 않았다. 상품 식별 정보와 기존 R001의 클릭 요일 패턴을 참조하고 수치는 교육용 가상 집계로 생성했다.

원본 묶음은 manifest의 비공개 metadata로 해시를 관리하며 직접 배포하지 않는다. `/workbench-data/current/training-index.json`과 사례별 `training-S01-initial.json` 등의 파생 응답만 제공한다. 보고 기준시점은 8월 31일과 9월 7일이고, 미래 구매는 해당 시점 조회에만 반영한다. 광고 노출 CTR과 콘텐츠 조회 대비 링크 클릭률을 구분하며 콘텐츠의 미관측 도달을 임의로 채우지 않는다.

[공통 규약과 사례별 계획, 실행 결과](../docs/design/roas-training-dashboard.md), [수치와 보존 검증](../evidence/training-dashboard-20261023/validation.json), [독립 검산](../evidence/training-dashboard-20261023/independent.json)을 따른다. 생성기의 기본 실행은 쓰기 없는 검산이며 `--write`로 승인 범위를 설치한다. 독립 검산 스크립트는 Python 런타임으로 실행한다. 실제 학습 효과는 아직 검증하지 않았다.

## 2026-10-22 추가 업무 사례

사용자가 최대 12,000개 관측행 제안을 승인해 비용 변화 R002, 구매금액 변화 R003, 확정 조정 변화 R004에 합계 7,544행을 추가했다. 기존 33,797행과 R001의 바이트, 기존 정의와 default scope는 보존했다. 현재 활성 관측은 41,341행, 데이터 해시는 `4a58a7326fcd84b4d050ab2b2aea1cb7289c7d28bbb1deab1df2e378e5afadbb`다. provenance와 migration에는 관측당 각 1행을 추가했다. 아래 10월 21일 해시와 행수는 당시 기록이다.

명시 선택된 profile마다 7일 내 마지막 유료 접점 매출, 첫 광고 세션의 퍼널과 후속 직접 재방문 구매를 구분한다. 생성은 고정 seed의 가상 가정이며 실제 고객, 업계 평균과 인과 원인을 관측한 자료가 아니다. [승인과 실행](../docs/research/marketing-ontology/data-proposal.md#2026-10-22-추가-사례-생성-개별-승인과-실행), [원본 보존과 독립 검산](../evidence/roas-diversity-20261022/independent.json), [검증 결과](../evidence/roas-diversity-20261022/validation.json)를 따른다. 생성기는 메모리 dry-run만 수행하고 `node scripts/install-roas-diversity.mjs --write`가 승인과 baseline, spec을 대조한 뒤 설치한다. 설치 재실행은 같은 행을 추가하지 않는다.

## 2026-10-21 구매 매출 ROAS 업무 시나리오

사용자의 “제안 범위 생성 승인”에 따라 한국 P1A, 2026-08-03부터 08-30까지 검색과 소셜의 독립 가상 시나리오 `R001-roas-decline` 3,470행을 같은 41유형 파일에 추가했다. 물리 활성 자료는 33,797행, 보존 원천 판정은 56,106행이다. 기존 활성 30,327행의 바이트와 기존 정의는 보존했다. [범위와 검증](../docs/design/roas-decision-flow.md), [승인 원문과 규칙 해시](../evidence/roas-decision-flow-20261021/generation-approval.json)를 따른다.

`manifest.json`은 유일한 자료 진입점이다. `scope_ids`는 기존 데이터 탐색과 Agent의 기본 D008 선택을 유지하며, 새 업무의 명시 선택은 manifest가 해시로 관리하는 `definitions.json`의 `scenario_profiles`에 등록했다. 제품 ROAS 검토 화면은 R001을 명시 선택한 파생 계산과 원천을 읽는다. 물리 전체 파일의 해시와 행수를 검사한 뒤 시나리오를 선택한다. 두 표본을 합산하지 않는다. 현재 자료 해시는 `f8a8bfd8cde6666f37f70d8b67a917cf3ec542c3715f0706e3e6d107661b760d`다.

새 시나리오의 매출은 할인 후 상품금액에서 확정 취소, 환불을 중복 없이 차감하고 세금과 배송비를 제외한다. `T19.acquisition_ref`는 실제 T17 유입 이벤트를 가리킨다. T17의 세션과 전달된 캠페인 ID, T18의 거래를 통해 구매를 연결한다. 같은 금융 사건의 T20 추가 참조는 대표 금전 처리행 하나를 가리킨다. 이 의미는 R001에만 적용하고 기존 결측값이나 금액 정의를 소급 변경하지 않는다. 예산 목표나 증감 비율은 생성하지 않았다.

`node scripts/augment-roas-case.mjs --write`는 승인 기록과 명세 해시를 확인한다. 이미 설치된 3,470행이 생성 규칙과 같으면 추가하지 않는다. 원천 10파일은 `archive/files/`에 해시 이름으로 보존하고 provenance와 migration에 연결했다. 과거 원천으로 전체를 다시 만드는 `consolidate-data.mjs`는 이 승인 시나리오를 유실시키지 않도록 실행을 차단한다. 기존 주문 추세 변환은 D008에만 적용한다. 이후 전체 재통합은 별도 검토된 이관 절차가 필요하다.

실행: `npm run demo:roas`. 검토서 출력: `node scripts/roas-case.mjs --scenario R001-roas-decline --output 새파일.md`. 출력은 기존 파일을 덮어쓰지 않는다. 계산은 Agent와 대시보드 없이 실행하며 실제 효과와 현업 유용성을 입증한 것은 아니다. 아래 날짜별 내용은 이전 처리 당시의 기록이다.

2026-10-20 구매 이벤트 후속: 주문 추세 변경 시 빠뜨린 T18 구매·환불 이벤트를 연결된 T19 주문·T20 환불의 기존 수량·시각과 일치시켰다. 새 분포를 생성하지 않았으며 실제 변경은 1,507행이다. `scripts/demo-order-flow.mjs`가 원본 재현 시에도 이 관계를 유지한다. [전수 관계·그래프 일치 검증](../evidence/purchase-event-sync-20261020/checks.json)을 참고한다.

2026-10-20 주문 추세 후속: 사용자 요청으로 CURRENT 주문 수량·일별 분포와 연결 환불·배송 시각·고객군 순매출을 조정했다. 원본과 행수·스키마는 보존했다. [범위·재현·검증](../docs/design/dashboard-trends-20261020.md)을 참고한다. 아래 관측 수치 유지 설명은 이 후속 변경 전 상태다.

## 현재 관리 기준 · 2026-10-20 대표 선택 반영

`manifest.json`을 현재 자료의 유일한 진입점으로 사용한다. 활성 30,327행을 바로 아래 41개 업무 유형 JSONL에 두며, 화면과 Agent가 같은 계약·파일 해시를 검사한다. 원본 source/archive는 보존한다. CURRENT T39의 승인된 Hill 가상 모형·예상값 파생 투영은 `scripts/demo-budget-model.mjs`로 재현하며 변환을 migration/provenance에 기록한다. 나머지 관측 수치·단위·결측은 유지한다. 국가·월·배치별 실행 폴더를 추가하지 않는다.

`provenance.jsonl`은 활성 행의 출처, `migration-map.jsonl`은 보존 52,636행 각각의 판정을 기록한다. `archive/`는 원문·해시 목록·업무 키·미적합790행을 보존하며 KPI와 배포에서 제외한다. 기존 사이트 성능 충돌 85행은 사용자 승인으로 12개 업무 키마다 ID 정렬 첫 행 하나를 데모 대표로 활성화했고 나머지73행은 `selection_excluded`로 보존한다. 측정값의 우열을 판정하거나 평균 p75를 만든 것이 아니다. [대표 선택과 검증](../docs/design/site-performance-conflicts-20261020.md), [최초 통합 결과](../docs/design/data-consolidation-20261019/README.md)를 참고한다.

새 자료는 해당 업무 파일에서 검증 후 추가·교체한다. 국가·시나리오·수집 범위·기간·기기·채널·지표 정의를 포함한 업무 키로 충돌을 확인하고, 출처·참조·스키마·발췌·통화·분모·산식을 검증한다. manifest의 행수·해시·기간·scope와 관리 변경 기록도 함께 갱신한다. 새 값을 만들거나 schema 의미를 바꿀 때는 저장소의 데이터 승인 규칙을 따른다. 새 버전 폴더나 전용 로더는 만들지 않는다.

Vite는 manifest에 명시한 현재 가상 자료만 빌드로 파생한다. public/에 수동 복사본을 추가하지 않는다. `db/`와 `drizzle/`은 기존 템플릿으로 유지한다. 과거 고정 회귀 입력·옛 public 카탈로그·레거시 시연 TS는 보존하지만 현재 런타임 자료로 적재하지 않는다.

아래 설명은 통합 전 이력이다.

- `db/`: 기존 Cloudflare D1 연결 템플릿과 빈 스키마. 현재 프론트 앱에서는 사용하지 않습니다.
- `drizzle/`: 기존 마이그레이션 메타데이터. 실제 테이블·데이터베이스는 구축되지 않았습니다.

현재 시연용 고정 데이터는 `../frontend/lib/demo-scenarios.ts`와 `../frontend/lib/marketing.ts`에 그대로 있습니다. 조사·설계 및 기존 생성 자료는 `../docs/research/marketing-ontology/`에 보존합니다. 이번 정리는 파일 위치만 변경하며 데이터를 생성하거나 가공하지 않습니다.


## 다음 정리 작업

2026-10-19 사용자가 배치별 데이터 분할을 끝내고 이 data/ 영역으로 통폐합하는 방향을 요청했다. [업무 이관·통합 실행 기준](../docs/handoffs/2026-10-19-data-consolidation.md)을 먼저 읽는다. 현재는 계획 문서만 작성했으며 위 DB 템플릿과 기존 데이터 위치를 실제로 옮기거나 통합하지 않았다.
