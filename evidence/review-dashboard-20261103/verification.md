# Agent1 리뷰 분석 UI 구현 검증, 2026-11-03

- 작업 분기: `agent1/review-dashboard-20261103`, 기준 HEAD `38cee52`, 커밋, 푸시, 병합, 배포 없음.
- 범위: 성과 현황 ROAS 하단 `ReviewAnalysisSection` 삽입, 승인된 원문 선택자와 읽기 전용 뷰 모델, 스타일, 테스트, CI.
- 기존 미커밋 변경은 작업 전부터 있었으며, 이 증거는 그 문서/삭제/데이터 테스트를 새로 구현한 것으로 취급하지 않는다.
- 기존 `data/training-dashboard.json` SHA-256: `4ada40bb6153fcc40cdaa2654c48aaa3cccd46c489a1558ad888d5a0d2e80c66`, 데이터 작업 트리의 검증 기록과 동일. 이 구현에서 ROAS 원천을 변경하지 않음.

## 실제 명령 결과

| 검사 | 결과 | 범위 및 한계 |
| --- | --- | --- |
| `npm test` | exit 0 | 기존 마케팅/데모 검증 |
| `npm run test:roas` | exit 1, 75개 중 74 통과 | 시작 전부터 미추적 상태였던 `tests/roas-review-data-contract.test.mjs`의 `data/roas-reviews.json` 필수 조건 실패. 이 파일은 **현재 작업 트리**에 없음 |
| 기존 ROAS 테스트만 별도 실행(원문 파일을 필수로 요구하는 위 테스트 제외) | exit 0, 74개 통과 | 기존 ROAS 회귀 테스트 |
| `npm run test:training` | exit 0, 24개 통과 | ROAS 사례, 원본 수치, 매체, 캠페인, 기기, 공개 데이터 검사 |
| `npm run lint` | exit 0, error 0, warning 3 | 최초 실행은 Git 무시 경로 `work/roas_history_qa.cjs`의 require 경고가 아니라 **4개 오류**로 실패. `eslint.config.mjs`에 Git 무시 작업 폴더 `work/**` 제외 후 재실행 성공 |
| `npx tsc --noEmit --pretty false` | exit 0 | 현재 타입 검사 |
| `npm run build` | exit 0 | 최종 변경 반영 Vite 빌드 |
| `node --experimental-strip-types --test tests/review-analysis.test.mjs` | 로컬 실원문 지정 시 5/5 통과, CI 원문 부재 시 4 통과/1 스킵 | 원시 48건은 별도 작업 트리에서 **읽기 전용**으로 테스트. 복사/발행하지 않음 |
| `git diff --check` | exit 0 | 추적 중인 파일의 patch whitespace 확인 |

## 기능/계약 구분

- 프론트엔드 구현: 14일 비교/분석/합집합 선택, 판매처 다중 OR, 요약 3개, 유일 리뷰 ID 기반 카테고리 언급 비율, 카테고리 다중 OR, 검색(연속 부분 문자열, 약 300ms, Enter), 테이블 정렬/페이지/원문 펼침/링크 및 오류 상태 UI.
- 실제 원시 리뷰: 별도 데이터 작업 트리 `data/agent1-reviews-48-20261103`에 48건, 4개 제공 선언 존재. **현재 UI 브랜치의 필수 배포 경로에는 없음**. 해당 증거의 자동 1,128쌍 검사와 A/B/C 검산은 완료됐지만, 2차 전수 인간 의미 검수 및 완전 승인 범위는 별도로 확인 필요.
- 분류 결과/상품 공통 메타데이터/조회 계약: 승인 및 배포되지 않음. 화면이 분류를 추정하거나 미검수 리뷰를 `미분류`로 만드는 동작 없음. 신규 raw/sidecar/API 경로 및 별도 상품 선택기 생성 없음.
- 최종 브라우저 조작, 스크린샷, 접근성 실기기, 0건/부분 오류 실자료 주입 검증은 **미실행**. 타입, 빌드, 선택자 단위 테스트를 UI E2E 합격으로 대체하지 않음.
- CI: 기존 미추적 상태의 `.github/workflows/dashboard-ux.yml`을 보존하며 `tests/review-analysis.test.mjs`와 새 파일 ESLint 검사 추가. 커밋하지 않았으므로 CI 원격 실행은 미확인.

## 남은 인수 조건

1. 48건 원문의 2차 독립 전수 검수와 분류 원천 생성, 검수 통과 및 승인.
2. 상품 공통 메타데이터, 분류 저장소, 원문 수집/분류 버전 확인, 제공상태 카탈로그, 읽기 전용 조회 계약의 사용자 승인.
3. 승인된 조회 로더의 실제 화면 연결 및 사례/보고 기준 stale 요청 격리, 전체/부분 오류와 원문/분류 검증, UI 키보드/좁은 화면/검색/페이지 전이 E2E 인수.
