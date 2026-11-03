# 로컬 성과 화면 dev 동기화 검증

- 날짜: 2026-11-03, 기준 `f329be0`, 작업 브랜치 `fix/local-performance-sync`.
- 대상: 성과 UI 모듈 6개, 표시 서식 검사와 버전 기록. 데이터와 API, 별도 리뷰 데이터 계약 및 CI 초안은 이번 커밋 대상이 아니다.
- 자동 검사: `node --experimental-strip-types --test tests/training-analysis.test.ts tests/training-presentation.test.ts tests/roas-format-ux.test.mjs tests/roas-examples.test.ts tests/training-dashboard.test.mjs`에서 분석, 서식, 예시와 원천 회귀 41개가 통과했으나 표시 모듈의 확장자 없는 import로 presentation 검사가 로드 실패했다. import에 `.ts`를 명시한 후, 기존 한 자리 CVR 기준의 중립 기대 2건이 소수 두 자리 표시에 맞지 않는 것을 확인했다. ±0.01%p가 실제 표시되므로 방향색을 기대하도록 갱신했다. 영향받은 presentation과 format 검사 12개 재실행 통과, 중복 3개를 제외한 관련 검사 50개가 통과했다.
- 타입 검사 `node node_modules/typescript/bin/tsc --noEmit --incremental false`: 종료 0. import 수정 후 재실행도 종료 0.
- 변경 UI 파일 5개, 새 서식 모듈과 관련 테스트의 ESLint 검사: 종료 0. 기존 pages 경로 안내는 유지됐다.
- `node node_modules/vite/bin/vite.js build --logLevel warn`: 종료 0. 기존 폰트 경로 2건과 플러그인 소요 시간 안내가 남았다.
- 로컬 S16, 전체 캠페인, ROAS 내림차순 정렬의 표 머리글과 전체 6개 행, 상단 요약 텍스트를 비교 기준으로 저장했다. [로컬 화면](local.jpg). 배포 후 동일 조건으로 비교한다.
