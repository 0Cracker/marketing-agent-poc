# 예시 질문별 분석 목적 검증

- 날짜: 2026-10-28, Windows, Node.js, Chrome.
- 대상: dev `b2f8222` 이후 v0.4.7 작업 트리. 기존 미커밋 변경 없음.
- 데이터: 기존 S01~S18의 initial, mature 보고 시점. 데이터 생성과 수정 없음.

| 질문 | 변경 후 답변과 검증 |
| --- | --- |
| ROAS가 직전 기간보다 달라진 이유를 분석해줘 | 매출 +29.3%, 집행비 +61.6%, 캠페인 하락 4개/상승 2개. 검색 A -218%p, 네이버 블로그 +84.9%p, 현재 최저 Instagram 피드 120.7%. 캠페인 비교 6행, 요약 2개와 캠페인 12개의 집계 근거 |
| AOV, CVR, CPC가 함께 변했는데 ROAS는 왜 떨어졌을까? | 수식상 ROAS 기여 AOV +17.2%p, CVR -51.8%p, CPC -36.5%p. 상쇄 효과와 CVR 우선 확인. 전체 비교 1행, 기간 요약 2개 근거 |

동일한 선택 데이터의 전체 ROAS 355.8% → 284.7%는 공통 사실로 유지한다. 질문 목적에 따라 비교와 해석을 달리하며 다른 수치를 만들지 않는다. 캠페인의 ROAS 증감은 인과적 기여도 순위로 주장하지 않는다.

## 실행 결과

| 명령 | 결과 |
| --- | --- |
| `node --experimental-strip-types --test tests/roas-examples.test.ts tests/agents/roas.test.mjs` | 17개 통과, 종료 0 |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | 통과, 종료 0 |
| `node node_modules/eslint/bin/eslint.js frontend/workbench/roas-examples.ts tests/roas-examples.test.ts` | 통과, 종료 0. 기존 Next pages 경로 안내 유지 |
| `node node_modules/vite/bin/vite.js build` | 통과, 종료 0. 기존 폰트 런타임 해석과 플러그인 시간 안내 유지 |

추가한 회귀 검사는 두 예시의 결론, 요약, 근거와 행동이 서로 다름을 확인한다. 첫 예시에 세 지표 기여도가 섞이지 않고, 첫 예시 6행과 둘째 1행의 비교 자료, 인용 ID와 실제 캠페인 원천 행이 일치하는지 검사한다. 단일 캠페인/모바일 필터에서도 범위를 벗어나지 않는지 확인했다. 기존 684개 조합과 세 질문의 전수 검사에서 원천 행 합계, 입력 불변, 결측과 기여도 검사가 통과했다.

Chrome 로컬 S16, 전체 캠페인, 서버 미연결 상태에서 두 질문을 연속 클릭해 [첫째 캠페인 비교 화면](overview.jpg), [둘째 복합 지표 화면](drivers.jpg)을 확인했다. 실제 모델 생성과 마케터의 과업 성공은 미검증이다.
