# Agent1 리뷰 데이터, UI 통합 검증 (2026-11-03)

## 변경 경계
- 작업 폴더: `marketing-agent-poc/`
- 통합 작업 브랜치: `feat/agent1-review-ui-data-integration-20261103`
- 데이터 원본: 별도 미커밋 작업 폴더 `marketing-agent-poc-review-data-20261103/`, 승인된 파일만 **복사**, 원본 유지
- 최신 사용자 결정: 기존 UI SDD의 ROAS 하단 배치보다 **사이드바의 독립 리뷰 분석 메뉴**를 우선
- 승인된 리뷰 JSON, 분류 JSON, 상품 메타데이터, ROAS 원천 및 성과값은 수정하지 않음

## 데이터와 회귀 검증
- `node scripts/validate-roas-review-classification.mjs` 통과: 원문 50건, S16/S17 각 25건, 기간별 12/13건, 미분류 2건, 상위 5, 세부 18, 정확한 근거 인용 63개, A/B/C 조건 확인
- `node --experimental-strip-types --test tests/review-projection.test.mjs tests/review-analysis.test.mjs tests/roas-review-data-contract.test.mjs tests/review-data-loader.test.mjs tests/roas-review-classification.test.mjs`: 24/24 통과
- `npm.cmd test`: 통과
- `npm.cmd run test:roas`: 81/81 통과
- `npm.cmd run test:training`: 24/24 통과
- `npm.cmd run lint`: 오류 0건, 기존 코드의 사용하지 않는 변수 경고 3건
- `node node_modules/typescript/bin/tsc --noEmit --pretty false`: 통과
- `npm.cmd run build`: 통과, S16/S17 각각 initial/mature 리뷰 JSON 에셋 생성
- 주요 데이터, UI 테스트를 `.github/workflows/dashboard-ux.yml`, `review-classification-validation.yml`, `review-product-metadata.yml`에 등록. **원격 CI는 실행하지 않음**

## 브라우저 화면 QA
- Vite 개발 서버: `http://127.0.0.1:5189/workbench`
- Chrome Headless CDP에서 사이드바 진입, S16 current 13건, 5/18 카테고리, 근거 인용, both 25건, 미분류 1건, S17 전환과 필터 초기화, S01 미제공 상태, ROAS 화면 복귀 검사 **9개 통과**
- 구조화된 결과: `browser-qa.json`
- 실제 화면 캡처: `s16-current.png`

## 제한 및 상태
- 원문 URL이 제공되지 않아 외부 원문 링크는 생성하지 않고 '링크 없음'으로 표시
- 분류 오류 시 검증되지 않은 분류를 미분류로 간주하지 않고 리뷰 데이터 오류로 격리, 분류 단독 장애에서 원문만 별도 복구하는 기능은 향후 과제
- 리뷰와 ROAS의 직접적 인과관계 추론 또는 자동 권고를 추가하지 않음
- 로컬 화면 테스트는 완료했지만 실제 운영 사용자 인수와 원격 CI는 아직 미검증
- **커밋, 푸시, 배포 없음**

## 2026-11-03 사용자 화면 피드백 후 UI 정정
- 최신 화면 피드백 우선: `지표 상세`는 `성과 현황` 바로 아래의 하위 메뉴로 유지하고 `리뷰 분석`은 그 다음 독립 메뉴로 배치
- 원인: `workbench.css`의 `.wb button{display:inline-flex}`가 리뷰 막대 버튼의 `display:grid`보다 우선 적용되어 그래프가 사라져 보임. `.wb .review-bar-row` 선택자로 우선순위 교정, 0~100% 길이를 실제 렌더링 너비로 검산
- 공통 디자인 적용: 체크박스 대신 선택 강조형 원형 칩, 기본 select 대신 기존 `roas-segment` 패턴의 기간, 정렬 및 페이지 크기 버튼
- 최다 언급 카테고리 카드에 언급 수/조회 분모/비율을 표시. 조회 카드에 S16/S17 각 25건, 전체 승인 50건에 관한 범위 안내를 추가
- 세부 18개 기간별 비교표는 접힌 상태에서 시작, 필요할 때 펼칠 수 있도록 유지
- `tests/review-projection.test.mjs`에 사이드바 계층, 선택 버튼 및 그래프 CSS 회귀 확인을 보완
- 브라우저 CDP 1440px QA: `redesign-browser-qa.json` 13항목 통과, 막대 30.8%가 실제 너비 약 30.77%로 표시되는 것을 확인, `s16-redesign.png` 캡처
- 원문 50건, 분류 48건 및 미분류 2건, 기존 ROAS 원천은 변경하지 않음

## 추가 독립 강검증 및 결함 수정 (2026-11-03, 사용자 요청)
- 검증 전 실패 재현: `tests/review-projection.test.mjs`에서 동일 사례가 아닌 리뷰 ID, 카테고리/세부 경험의 부모 불일치, 동일 세부 경험 중복, 14일 구간 밖 작성일, 보고 시점 이후 수집일이 `ready`로 통과하는 문제 재현.
- 수정: `frontend/workbench/review-projection.ts`에서 리뷰 ID 사례와 001~025 범위, 분류 사전 부모 관계, 중복 경험, 작성/수집 시점, 25건 초과 응답, 전 건이 무효인 상태를 검증. 분류 오류 시 미승인 분류 칩/근거를 노출하지 않고 원문 조회와 분류 오류를 분리.
- 검증 전 실패 재현: 리뷰 페이지에서 작성일 `both`와 카테고리 하나를 선택하고 성과 현황으로 이동, 브라우저 뒤로가기 시 기본 `current`와 무선택으로 초기화.
- 수정: 동일 사례에서 화면을 오가더라도 리뷰 컴포넌트를 비표시 상태로 유지해 필터/페이지 상태를 보존. 사례/보고 시점이 변경되면 키를 교체해 해당 상태를 초기화. ROAS 상세 disclosure 복원은 숨겨진 리뷰 상세를 제외하도록 분리. 리뷰 화면의 키보드 포커스는 보이는 리뷰 제목으로 이동.
- `tests/review-ui-exhaustive.test.mjs`: 승인 원문/분류 데이터를 별도로 읽어 화면 계산과 **12,288개 조합** 독립 대조(사례 2 × 보고 시점 2 × 기간 3 × 판매처 집합 4 × 카테고리 선택 64 × 검색어 4), 상위/세부 언급 수, 원문 필터, 평균 평점, 정렬 보존까지 통과.
- Chrome CDP 반응형 QA: 360, 390, 768, 1024, 1440px 전부 문서 전체 가로 넘침 없음(좁은 테이블은 내부 스크롤만 허용). 증거: `audit-mobile-360.png`, `audit-mobile-768.png`.
- Chrome CDP 상호작용 13항목 재통과(`redesign-browser-qa.json`). 실제 0~100% 가로 막대 표시, 칩 동기화, 판매처 OR, 두 기간 25건, 미분류, 사례 전환, 미제공과 ROAS 복귀를 검증.
- Chrome CDP 뒤로가기 재현 및 수정 후 재검증: `both`, 카테고리 선택이 동일하게 보존됨.
- 네트워크 강제 실패/재시도 QA: 리뷰 JSON 요청 1건 강제 실패 → 리뷰 전용 오류 화면 및 재시도 버튼 → 정상 13건으로 복구. ROAS 전역 오류로 전파되지 않음.
- 검증 명령 결과: 리뷰 계약/기능 테스트 **27/27**, 기본 `npm.cmd test` 통과, `npm.cmd run test:roas` **81/81**, `npm.cmd run test:training` **24/24**, `tsc --noEmit` 통과, `npm.cmd run lint` 종료코드 0(기존 경고 3건, Next.js pages 경로 메시지), `npm.cmd run build` 통과. 빌드/린트/타입 검사에서 새 오류 확인되지 않음.
- 중요 대조 테스트를 `.github/workflows/dashboard-ux.yml`에 추가. 원격 CI 실행은 하지 않음.
- 최신 사용자 사이드바 및 50건 결정과 오래된 UI/UX SDD 및 구현 인계서의 C01/48건 기록이 충돌하는 점을 확인해, **과거 인터뷰를 보존하면서** 최신 결정 우선 주석을 각 문서 맨 앞에 추가.
- 승인 원문, 분류, 상품 메타데이터, ROAS 원천은 수정하지 않음. **커밋, 푸시, 배포는 하지 않음.**
- 미검증 범위: 원격 CI 실행 결과, 실 사용자 최종 인수, 실제 리뷰/광고 성과의 인과 관계(이 PoC는 합성 데이터만 사용). 브라우저 QA는 로컬 Chrome Headless에 한정된다.
