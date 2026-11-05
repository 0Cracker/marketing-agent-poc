# 예시 대화와 S16 복합 사례 검증

- 날짜: 2026-10-27, Windows, Node.js, Python 3.14, Chrome.
- 대상: dev `84d0046` 이후 v0.4.5 미커밋 작업 트리. 기존 미커밋 작업은 없었다.
- 승인: 사용자가 최종적으로 S16의 AOV 상승, CVR 하락, CPC 상승 수정안을 명시 승인했다. 구체 범위는 [데이터 승인 기록](../../docs/research/marketing-ontology/data-proposal.md#2026-10-27-s16의-aov-개선과-roas-하락-복합-사례-승인-실행)을 따른다.

## 변경과 수치

예시 클릭은 입력창 채우기에서 즉시 대화 추가로 변경했다. 첫째와 셋째 질문은 보존하고 둘째는 복합 지표 변화의 기여도와 확인 순서를 묻는다. 예시 답변은 프런트에서 현재 선택된 자료로 계산하며 AI 서버를 호출하지 않는다. 실시간 모델 출력과 구분해 “예시 답변”으로 표시한다. 직접 입력한 질문은 기존 서버 경로를 사용한다.

S16 분석 기간의 성과 168행, 분할 840행에서 할인액과 매출, 원장 매출만 변경하고 상품별 할인 종료 기록 3건을 추가했다. AOV는 38,712.4원 → 40,847.5원, CVR은 4.9% → 4.2%, CPC는 531.9원 → 596.3원, ROAS는 355.8% → 284.7%다.

여섯 가지 지표 교체 순서의 평균으로 상호작용을 나눴다. ROAS 기여도는 AOV +17.2%p, CVR -51.8%p, CPC -36.5%p이며 전체 변화 -71.1%p와 반올림 정밀도 안에서 일치한다. 실제 인과효과나 회복량 추정으로 표시하지 않는다.

## 실행한 검증

| 명령 | 결과 |
| --- | --- |
| `node evidence/roas-examples-20261027/check-data.mjs --capture-before` | 승인된 변경 전 원본 해시와 수치 보관 |
| `node scripts/generate-training-dashboard.mjs --write` | 18사례, 상세 108건 생성, 종료 0 |
| `node evidence/roas-examples-20261027/check-data.mjs` | 허용한 1,008행과 기록 3건의 수정, 다른 사례, 이전 상세, 원천 파일 보존 확인, 종료 0 |
| `node --experimental-strip-types --test tests/roas-*.test.mjs tests/roas-*.test.ts tests/training-dashboard.test.mjs tests/agents/roas.test.mjs` | 107개 통과, 종료 0 |
| `python scripts/check-training-dashboard.py` | 18사례, 독립 Decimal와 정수 검산 97,067항목 통과, 종료 0 |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | 타입 검사 통과, 종료 0 |
| `node node_modules/eslint/bin/eslint.js`와 변경한 TS, TSX, MJS 파일 9개 | 대상 린트 통과, 종료 0. 기존 Next pages 경로 안내 경고는 남음 |
| `node node_modules/vite/bin/vite.js build` | 프로덕션 빌드 통과, 종료 0. 기존 폰트 런타임 해석, 플러그인 시간 안내는 남음 |

예시 답변 회귀는 18사례와 두 보고 시점, 전체와 캠페인별 세 기기 범위의 684개 조합에서 질문 3개씩 계산했다. 실제 원천 행과 합계의 일치, 수치 미정의 처리, 기여도 합계, 입력 보존과 상승한 ROAS를 하락으로 오인하지 않는 조건을 확인했다. 재생성 일치 검사는 교육 대시보드 회귀에 포함된다.

Chrome의 로컬 `/workbench`, S16, 전체 캠페인에서 KPI 284.7%와 AOV +5.5%, 둘째 예시 클릭 후 질문과 답변, 지표별 기여도 표시를 확인했다. 앞선 화면 검사에서는 첫째와 셋째 질문 클릭, 원천 168행 열람도 확인했다. [최종 둘째 예시 화면](example-answer.jpg)은 수정된 S16 데이터이며 앞선 화면의 수치와 구분한다.

## 한계

실제 모델 출력과 마케터의 과업 성공, 인과효과, 모바일 화면은 이번에 검증하지 않았다. 기존 2026-10-26 검증 기준의 수치 보존 검사는 승인된 S16 금액 필드만 예외로 갱신하고 나머지 필드, 이전 상세와 다른 사례의 보존 검사를 유지했다.
