# 상세 표 간소화 검증, 2026-10-28

- 대상: dev `d79baf7` 이후 v0.4.12 작업 트리, Windows, Node v24.22.1, 내장 Chromium.
- 입력: 기존 S16 initial, 전체 캠페인. 원천 데이터와 API 계약은 변경하지 않았다.

## 자동 검사

- `node --experimental-strip-types --test tests/training-presentation.test.ts tests/training-analysis.test.ts tests/roas-examples.test.ts tests/training-dashboard.test.mjs`: 45/45 통과, 종료 코드 0. [출력](tests.txt).
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: 통과, 종료 코드 0.
- 변경한 대시보드, 분석 표, 표현 함수와 관련 테스트의 ESLint: 오류와 경고 0, 종료 코드 0. 기존 Next 페이지 위치 안내는 출력된다.
- `node node_modules/vite/bin/vite.js build --logLevel warn`: 통과. 기존 글꼴 경로 사전 해석 경고 2개는 유지한다.
- `git diff --check`, 원천 데이터와 공통 타입의 diff 없음 확인. 기존 삭제 3개는 보존한다.

## 실제 화면 확인

| 항목 | 관측 결과 |
| --- | --- |
| 행 펼침 | 기본 내용은 지표, 직전, 현재, 증감의 수치 표. 보고서 영역, 기준 설정과 소재 원문, 운영 기록 영역 0개 |
| 추가 데이터 | 일별 추이와 도달, 퍼널과 결제, 상품 표는 선택 펼침. 새 화면에서 추가 영역의 기본 펼침 0개 |
| 설명 | 항상 보이는 회색 설명 문장 제거. 노출 비중 (i)에 키보드로 초점을 주면 분모 설명 표시 |
| 클릭수 색상 | 검색 A +65.1%는 `rgb(196, 61, 66)`, Facebook v1 -17%는 `rgb(35, 106, 185)`. 비교 불가는 중립색 |
| ROAS 순서 | 보조 지표 영역이 분석 표보다 먼저 배치되며 details 안에 있지 않음 |
| 전체 구매 퍼널 | 행 선택 없이 CVR, CPA 조회 범위의 퍼널 표시. S16 랜딩 세션 17,139 → 24,701, 같은 세션 구매 963 → 1,180 |
| 정렬 | 기본 표의 6개 데이터 행 높이 모두 69px. 제목과 정보 아이콘의 수직 중심선 차이 0px. 퍼널 5개 행 높이 모두 97px, 전후 수치 열과 머리글의 왼쪽 좌표 차이 0px |
| 좁은 화면 | 375px 검사에서 본문 360px, 표 영역 298px, 표 콘텐츠 715px. 표 안에서만 가로 스크롤 |

좁은 화면의 첫 검사에서 숨겨진 Recharts 툴팁이 이전 위치를 유지해 본문 폭이 731px로 늘어나는 문제를 발견했다. 숨겨진 툴팁에만 위치 변환을 해제한 뒤 본문 360px을 재확인했다. 표시 중인 툴팁의 내용과 위치 계산은 유지한다. 검사 후 뷰포트는 기본 크기로 복원했다.

- [기간별 데이터 펼침](data-expansion.jpg): 설명과 보고서 없이 직전, 현재, 증감과 (i)를 표시한 최종 화면.
- [전체 캠페인 퍼널](overall-funnel.jpg): S16 전체 캠페인의 구매 과정.

모바일 실기기는 미검증이다. 이번 변경은 화면 표현과 기존 값의 색상 분류이며 원인이나 성과 효과를 새로 입증한 결과는 아니다. 원격 push와 배포는 수행하지 않는다.
