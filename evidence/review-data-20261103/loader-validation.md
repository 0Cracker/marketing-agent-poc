# 2026-11-03 선택적 리뷰 로더, 읽기 전용 API 검증

## 변경 및 계약 경계

- 브랜치: `data/agent1-reviews-48-20261103`, 기존 두 작업 트리의 미커밋 변경 유지.
- 새 코드: `scripts/review-data.mjs`, `tests/review-data-loader.test.mjs`. 설정: `vite.config.ts`에서 `reviewDataPlugin()`을 필수 ROAS 로더보다 앞에 독립 등록. CI: `.github/workflows/review-product-metadata.yml`의 테스트, 린트, 빌드 검사 추가.
- 원본 계약: `roas-reviews/1`, `roas-product-metadata/1`만 읽고 전용 SHA-256, 48개 고유 ID, 정확한 coverage 4개, 8개 판매처×기간 셀, 작성/수집 시간, 별점, 상품명 및 품목을 검증. 원본 데이터 파일과 `data/manifest.json` 수정 없음.
- 조회 자산: `/workbench-data/current/review-S{01..18}-{initial|mature}.json`, 총 36개. S16/S17은 24개 원문, 각 기간 12개, 다른 사례는 `not_provided`(미제공 건수는 `null`). `productId=EDU-P1`, `productName=쓱쓱샴푸` 반환.
- 정적 HTTP 조회의 범위는 **사례/보고 스냅샷별 전체 기간과 전체 판매처**다. `reviewQuery({caseId,snapshotId,sourceId,listPeriod})`는 서버 내부에서 기간/판매처 필터를 검증하며 두 기간 집계 분모를 보존하지만, 정적 URL의 HTTP 쿼리 필터는 구현하지 않았다. UI 필터 적용과 상품명 실제 표시는 후속 6번 범위다. 분류 원천/스키마는 미승인이므로 `classificationStatus=pending`, `categories=[]`이며 `미분류`로 대체하지 않는다.
- 원본 리뷰 데이터 누락, 해시 불일치, 잘못된 계약/조회 범위는 리뷰 응답의 `status=error`로 격리, 기존 ROAS manifest 로딩과 Vite 빌드는 계속 가능. 정적 파일은 HTTP 200이더라도 오류 상태를 본문에 명시한다.

## 실행 검증

| 검사 | 실제 결과 |
| --- | --- |
| `node --test tests/review-data-loader.test.mjs` | 6개 pass, 0 fail, 종료 0. 18사례×2스냅샷, 판매처/기간, 스키마/중복/시각, 사전 미존재 자료 오류, 빌드의 오류 격리, 원시 비공개 |
| `npm test` | 종료 0. 기존 마케팅 및 데모 테스트 두 집합 pass |
| `npm run test:training` | 25개 pass, 0 fail, 종료 0. ROAS 원천, 산출 및 KPI 회귀 |
| `npm run lint` | 종료 0. 미사용 변수 경고 3건, 기존 파일(D005 generate, validate, frontend/app/page) |
| `npm run build` | 종료 0. Vite v8.0.13 프로덕션 빌드 완료. 리뷰 36개 자산 생성 확인 |
| 실제 로컬 개발 서버 `127.0.0.1:5191` | `review-S16-initial.json` HTTP 200, ready, 24개. `review-S17-mature.json` HTTP 200, ready, 24개. `review-S01-initial.json` HTTP 200, not_provided. `training-index.json` HTTP 200, 18개 사례. 원본 두 JSON 경로는 모두 HTTP 404 |
| `npm run test:roas` | **60개 통과, 3개 테스트 파일 실행 실패, 종료 1.** 새 코드의 검증 실패가 아니라 과거 D005 Ajv 보조 로더가 이 작업 폴더의 `node_modules/.pnpm` 존재를 강제하는데, 실제 설치는 `npm ci`로 수행돼 해당 경로가 없어 발생한 환경 차이. 이 결과를 전체 테스트 통과로 보고하지 않음 |
| `git diff --check` | 종료 0 |
| 원격 CI | 워크플로만 등록, push/PR과 CI 실행 자체는 수행하지 않음 |

## 범위 밖 및 다음 단계

- 승인된 분류 결과 파일과 버전, 상위/세부 카테고리 집계, 미분류 검수, 분류 오류 상태 UI 연동은 2/3번 확정 후 통합.
- 사용자 화면에서 `쓱쓱샴푸` 실제 노출, 기존 리뷰 UI의 `ReviewView`에 비동기 응답 연결, 카테고리 표시 및 필터의 최종 통합은 6번.
- 필수 `manifest.json`, `loadCurrentData()`, 기존 ROAS, 사용자 미커밋 프런트 작업 및 원시 리뷰 48건 수정, 커밋, push, 배포는 전부 제외.

## 2026-11-03 50건 및 실제 분류 로더 후속

기존 48건, `classificationStatus=pending` 검증은 당시 스냅샷이다. 현재는 승인된 두 리뷰를 포함하여 각 사례 25건, 비교 12건, 분석 13건이다. 검증된 분류 sidecar를 결합하고 리뷰별 `classified/unclassified` 상태와 원문 근거, 기간별 상위 카테고리 고유 건수, 세부 경험 건수, 미분류 수를 산출한다. 미분류도 전체 분모와 평균 별점 계산에는 포함되지만 카테고리 근거로 강제 집계하지 않는다. 원시 ROAS 자료와 다른 사례의 미제공 상태는 유지한다.

### 최종 50건 로더와 빌드 검증 결과

- `reviewQuery`는 원문, 공통 상품 메타데이터, 분류 sidecar의 SHA-256/분류 사전 관계를 검증한다. 하나라도 누락 또는 불일치하면 `error`로 처리한다.
- S16/S17의 `classificationStatus=ready`, `classificationVersion=1.0.0`; `reviews[]`는 `classified`와 `unclassified`를 구분하고 근거 있는 경험만 노출한다.
- `periods[]`는 전체 리뷰 수와 평균 별점에 미분류를 포함하며 상위 카테고리, 세부 경험과 원문 ID는 별도 고유 수로 계산한다. 미분류는 `unclassifiedCount`와 `unclassifiedReviewIds`로 표시한다.
- 정적 빌드로 생성한 S16/S17 `review-*-initial.json`의 기간 건수는 [12,13], 현재 미분류 각각 1건, 전체 25건으로 검산했다. `listPeriod`는 원문 목록에만 작용하고 두 기간 집계를 줄이지 않는다.
- 분류, 로더 자동 테스트 **13개 전부 통과**, 학습 대시보드 테스트 **25개 전부 통과**, 빌드 성공. 기존 ROAS 전체 회귀는 61 통과, 초기화 환경 오류로 3 실패(자세한 범위는 [분류 검수 기록](classification-qa.md)).
