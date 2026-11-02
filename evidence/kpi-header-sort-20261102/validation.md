# KPI 머리글 증감 정렬 검증

- 날짜: 2026-11-02, 작업 경로 `marketing-agent-poc`, 기준 `3488c8d`, 작업 브랜치 `fix/kpi-header-sort`의 미커밋 변경.
- 범위: 메인 분석 표의 정렬 UI와 열 순서. 원천 자료와 API, KPI 계산과 기여 산식은 유지한다.

## 자동 검사

- 변경 전 새 열 우선순위 검사에서 예상한 실패를 확인했다. 구현 후 분석 검사 10개 통과.
- `node --experimental-strip-types --test tests/training-presentation.test.ts tests/training-analysis.test.ts tests/roas-examples.test.ts tests/training-dashboard.test.mjs`: 종료 0, 46개 통과. 기존 18개 사례와 초기, 성숙 보고 시점의 분자, 분모와 기여 합계 검사 포함.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: 종료 0.
- `node node_modules/eslint/bin/eslint.js frontend/workbench/training-analysis.ts frontend/workbench/training-analysis-panel.tsx tests/training-analysis.test.ts`: 종료 0. 기존 pages 경로 안내 외 검사 오류 없음.
- `node node_modules/vite/bin/vite.js build --logLevel warn`: 종료 0. 기존 폰트 경로 2건과 플러그인 소요 시간 안내가 출력됐다.

## 화면 확인

로컬 Vite, IAB의 별도 임시 탭에서 S16 ROAS 표를 확인했다. 정렬용 선택 목록이 없고 분석 단위 선택만 남았다. 실제 열 순서는 캠페인, ROAS, 전체 변화 기여, CPC, CVR, AOV, 매출, 집행비다.

ROAS 제목 첫 클릭 후 증감은 +84.9, +37.7, -56.9, -57.9, -180.5, -218%p 순서이며 `aria-sort=descending`이다. 두 번째 클릭 후 역순으로 바뀌고 `aria-sort=ascending`이다. 현재값과 증감은 기존 한 셀 두 줄이다. [오름차순 화면](header-sort.jpg).

## 독립 UI 검증

별도 컨텍스트의 `ui_ux_verifier`가 현재 미커밋 화면을 검증했다. 표본 확인 범위에서 결함을 발견하지 못했다.

- ROAS 기본 기여 순서: -26.5, -25.8, -17.5, -13.8, -3.8, +16.3%p, 전체 하락 방향 우선 유지.
- ROAS 제목 클릭과 Enter 키로 증감 양방향 전환 확인.
- CPC 집행비 증감 내림차순: +117.7, +96.5, +96.4, +96.4%. AOV 기여 오름차순: -641.7원에서 +2,017.4원.
- CPC와 ROAS의 다른 상세 화면 이동 후 복귀 시 정렬 상태 유지.
- ROAS와 하위 5개 지표, CPC 광고와 콘텐츠 구역의 열 순서 확인.
- PC의 화살표와 정보 아이콘 배치, 활성 열의 `aria-sort`, 390×844 화면의 표 내부 가로 스크롤 확인. 뷰포트는 원복했다.

한계: 화면에서 모든 열의 양방향 정렬, 좁은 화면의 전체 가로 조작, 스크린리더 실제 음성은 확인하지 않았다. 원격 반영과 실제 마케터 사용성 평가는 포함하지 않는다.
