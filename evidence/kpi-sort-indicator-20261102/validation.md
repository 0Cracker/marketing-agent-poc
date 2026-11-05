# 정렬 표시 간소화 검증

- 날짜: 2026-11-02, 기준 `b934a4e`, `fix/kpi-header-sort`의 미커밋 변경.
- 대상: `training-analysis-panel.tsx`, `training-dashboard.css`. 수치 계산과 정렬 논리는 유지한다.

## 자동 검사

- `node --experimental-strip-types --test tests/training-analysis.test.ts`: 종료 0, 10개 통과.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: 종료 0.
- `node node_modules/eslint/bin/eslint.js frontend/workbench/training-analysis-panel.tsx`: 종료 0. 기존 pages 경로 안내 외 검사 오류 없음.
- `node node_modules/vite/bin/vite.js build --logLevel warn`: 종료 0. 기존 폰트 2건과 플러그인 소요 시간 안내.

## 실제 화면

별도 IAB 임시 탭의 S16 ROAS 표에서 제목 클릭 후 활성 머리글 배경이 `rgb(243, 240, 249)`이며 삼각형 텍스트는 `▼` 하나, 나머지 6개 열은 빈 문자열인 것을 DOM과 화면에서 확인했다. 메인 표의 정보 버튼은 0개다. [화면](single-arrow.jpg).

별도 컨텍스트의 `ui_ux_verifier`가 임시 Chrome 탭에서 ROAS 기본 기여 열의 ▲, ROAS 클릭 후 ▼와 재클릭 후 ▲, 해당 열만 연한 배경과 `aria-sort`가 활성화되는 것을 확인했다. CTR에서도 활성 기여 열의 단일 ▼를 확인했다. ROAS와 CTR 행 펼침의 기간별 데이터 표 정보 아이콘은 0개이며, CTR의 데이터 없음 수치는 기존 이유를 title로 유지했다. 확인 범위에서 결함을 발견하지 못했다.

한계: 모든 KPI의 모든 행과 결측 유형은 화면에서 확인하지 않았다. 행 확장 내 별도 일별 추이의 기간 비교 안내와 표 밖의 정보 버튼은 유지한다. 원격 배포와 실제 사용자 사용성 평가는 포함하지 않는다.
