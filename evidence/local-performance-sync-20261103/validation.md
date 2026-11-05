# 로컬 성과 화면 dev 동기화 검증

- 날짜: 2026-11-03, 기준 `f329be0`, 작업 브랜치 `fix/local-performance-sync`.
- 대상: 성과 UI 모듈 6개, 표시 서식 검사와 버전 기록. 데이터와 API, 별도 리뷰 데이터 계약 및 CI 초안은 이번 커밋 대상이 아니다.
- 자동 검사: `node --experimental-strip-types --test tests/training-analysis.test.ts tests/training-presentation.test.ts tests/roas-format-ux.test.mjs tests/roas-examples.test.ts tests/training-dashboard.test.mjs`에서 분석, 서식, 예시와 원천 회귀 41개가 통과했으나 표시 모듈의 확장자 없는 import로 presentation 검사가 로드 실패했다. import에 `.ts`를 명시한 후, 기존 한 자리 CVR 기준의 중립 기대 2건이 소수 두 자리 표시에 맞지 않는 것을 확인했다. ±0.01%p가 실제 표시되므로 방향색을 기대하도록 갱신했다. 영향받은 presentation과 format 검사 12개 재실행 통과, 중복 3개를 제외한 관련 검사 50개가 통과했다.
- 타입 검사 `node node_modules/typescript/bin/tsc --noEmit --incremental false`: 종료 0. import 수정 후 재실행도 종료 0.
- 변경 UI 파일 5개, 새 서식 모듈과 관련 테스트의 ESLint 검사: 종료 0. 기존 pages 경로 안내는 유지됐다.
- `node node_modules/vite/bin/vite.js build --logLevel warn`: 종료 0. 기존 폰트 경로 2건과 플러그인 소요 시간 안내가 남았다.
- 로컬 S16, 전체 캠페인, ROAS 내림차순 정렬의 표 머리글과 전체 6개 행, 상단 요약 텍스트를 비교 기준으로 저장했다. [로컬 화면](local.jpg). 배포 후 동일 조건으로 비교한다.

## 배포와 화면 대조

- 기능 커밋 `440d96286378858969c39bbb6cc8bf893be87e0a`, v0.4.18을 원격 dev에 푸시했다. 누락된 v0.4.16과 v0.4.17도 포함했다. Vercel 체크는 success이며 [배포](https://vercel.com/cracker5/marketing-agent-poc/eRX8W2hr9HSk9NYC5AiWiH5WKitk)를 확인했다.
- 실제 [dev 링크](https://marketing-agent-poc-git-dev-cracker5.vercel.app/workbench)를 새 탭에서 열고 S16 전체 캠페인, ROAS 증감 내림차순 조건으로 비교했다. 머리글, 전체 6개 행의 텍스트, 상단 요약과 추이 텍스트가 로컬 DOM 결과와 완전히 일치했다. 표 내부 정보 아이콘은 0개다. [비교 결과](comparison.json), [배포 화면](dev.jpg).
- 첫 행은 ROAS +84.9%p 위에, 현재 595.0% 아래에 표시한다. CPC 0%와 563원, CVR -0.48%p와 6.79%를 확인했다. 전체 행의 같은 위치를 비교해 증감/현재값 순서와 서식 누락을 확인했다.
- 별도 `ui_ux_verifier`의 로컬 표본 검증에서 결함을 발견하지 못했다. 요약과 추이의 나란한 배치, ROAS 증감 양방향 정렬과 단일 화살표, 하위 5개 상세 진입 및 표 렌더링을 확인했다.
- 한계: 모든 필터 조합, 모든 열의 양방향 조작과 모바일, 스크린리더는 이번 배포 대조에 포함하지 않았다. 원천 데이터, API와 리뷰 데이터 작업은 배포 대상에서 제외했다.
