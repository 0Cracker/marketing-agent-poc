# 상세 화면 주석 7건 검증

- 날짜: 2026-10-28, Windows, Node.js, 인앱 브라우저.
- 기준: dev `0539d26` 이후 v0.4.8 작업 트리, S16 initial과 기존 18사례/두 보고 시점. 데이터 수정 없음.
- 카드 통일은 사용자 선택. 상세/비교 통합은 추가 응답이 없는 상태에서 권장 기본안으로 진행한다고 알리고 적용한 구현 선택이다.

## 명령과 실제 결과

| 명령 | 결과 |
| --- | --- |
| `node --experimental-strip-types --test tests/training-investigation.test.ts tests/training-presentation.test.ts tests/training-dashboard.test.mjs` | 34개 통과, 종료 0 |
| `node --experimental-strip-types --test tests/training-investigation.test.ts` | 최종 시각 표시 보완 후 2개 통과, 종료 0 |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | 최종 소스 통과, 종료 0 |
| `node node_modules/eslint/bin/eslint.js frontend/workbench/training-dashboard.tsx frontend/workbench/training-investigation.ts tests/training-investigation.test.ts tests/training-presentation.test.ts` | 통과, 종료 0. 기존 Next pages 경로 안내 유지 |
| `node node_modules/vite/bin/vite.js build` | 최종 소스 통과, 종료 0. 기존 폰트 런타임 해석과 플러그인 시간 안내 유지 |

최초 회귀에서 S16의 과거 값 227.8%를 기대하던 검사가 실패했다. 실제 수치는 이전 사용자 승인으로 수정된 284.7%이며 데이터와 산식은 그대로다. 기대값만 현재 데이터에 맞췄고 기간 전체 합계 사용, 마지막 날이나 일평균을 쓰지 않는 검사는 유지했다.

변경 기록 검사는 18사례/두 시점에서 분석 기간, 캠페인과 기기 범위를 지키고 기존 행을 그대로 재사용하는지 확인한다. CTR에서 초기 설정과 상품 할인 기록을 제외하고 타깃/소재 변경 5건을 보여주며, CVR에는 결제 오류와 판매 조건 변경도 포함한다. 변경 전후 값과 시간은 기존 필드의 표시 형식만 변환한다. 데이터 원본 불변 검사를 포함한다.

## 브라우저 확인

- 상단 경로의 테두리와 화살표 제거, 텍스트 성과 현황 클릭 후 기본 제목 확인.
- CVR에서 모바일 선택, 경로로 복귀, 브라우저 뒤로 가기 후 CVR 제목과 mobile 값 유지 확인.
- 상세/비교 전환 버튼 0개, 상세 안 비교 workspace 1개 확인.
- 지표 카드가 공통 컴포넌트를 사용하고 CPC 상승에 위쪽 화살표와 악화 색상 class를 사용하는지 DOM으로 확인.
- 집계 기준에 초점을 맞추면 tooltip이 나오고 Escape로 닫힘. 마우스 호버는 기존 Radix Tooltip 포인터 처리에 연결했으며 자동 포인터 이동 검수는 미실행.
- CTR 변경 5건의 값과 확인 방향 표시, 중복 캠페인 설정/상품 정보 0개 확인.
- 광고를 본 사람 수와 1인당 평균 노출 횟수의 표 제목과 헤더, 합산 불가 설명 확인.

[카드와 툴팁](ctr-card-tooltip.jpg), [관련 변경 목록](related-changes.jpg)을 저장했다. 실제 마케터 과업 성과, 모바일 실기기와 실제 모델 답변은 이번 검수 범위 밖이다. 기존 미커밋 파일 삭제 3건은 보존하고 이번 커밋에서 제외한다.
