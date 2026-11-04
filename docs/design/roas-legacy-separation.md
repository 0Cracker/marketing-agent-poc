# ROAS와 구 대시보드 분리

2026-11-04, 사용자 요청과 데이터 계약 개별 승인에 따른 작업. 기준 브랜치 feat/agent1-review-ui-data-integration-20261103, 시작 HEAD df2e043. 기존 미커밋 리뷰 UI, 자료와 설계 변경을 포함해 보존했다. 작업 브랜치는 refactor/roas-legacy-separation-20261104이며 새 발행 버전, 커밋, 배포를 완료한 기록이 아니다.

## 확정 범위

- 현재 화면, 서버, 계산, 데이터, 도구와 검사는 각 roas/ 아래에서 독립적으로 소유한다.
- 기존 구현과 자료는 추적 가능한 legacy/로 보관하고 필요한 공용 코드는 복사한다. 현재 구현에서 legacy/로 import하거나 원천을 읽지 않는다.
- 구 대시보드 메뉴를 기본 화면에서 제거한다. 구 화면은 별도 로컬 명령으로 조회한다. 루트 주소와 /workbench 모두 현재 ROAS를 제공하며 초기 CTI는 보관 화면의 루트 주소로 이동한다.
- 원천 값, 사례와 기간, 집계, 리뷰 원문과 분류를 변경하지 않는다. 실제 모델 호출은 수행하지 않는다.
- docs/, evidence/의 과거 버전, 승인, AI 교훈과 검증 원본 경로를 유지한다. 현재 안내에서 보관 위치를 구분하고 과거 보고서의 당시 경로를 덮어쓰지 않는다.

## 데이터 계약과 재현

사용자가 ROAS 전용 manifest 신설을 개별 승인했다. roas-data/1은 contract, files 배열(file, bytes, sha256), data_sha256으로 구성한다. 전체 해시는 contract와 files를 JSON.stringify한 UTF-8 문자열의 SHA-256이다. 기존 네 payload를 바이트 그대로 복사하고 R001 광고 28행을 source-ads.jsonl로 복사했다. 기존 manifest는 legacy/data/에 바이트 그대로 보존했다. 신규 관측값을 생성하지 않았다.

현재 공개 URL은 /workbench-data/roas/의 training-index.json, 36개 training 응답과 36개 review 응답이다. 원본, manifest와 이전 CURRENT URL은 기본 서버에서 공개하지 않는다. ROAS 서버는 기존 세션, Origin, Host, 토큰 검증을 유지하며 구 분석, 예산, SQLite 실행 흐름과 ontology 파일을 초기화하지 않는다. 보관 서버와는 별도 프로세스다.

## 위치와 명령

| 대상 | 현재 경로 | 보관 경로 |
| --- | --- | --- |
| 화면 | frontend/roas/ | legacy/frontend/ |
| 서버 | backend/roas/ | legacy/backend/ |
| 계산과 타입 | shared/roas/ | legacy/shared/ |
| 자료 | data/roas/ | legacy/data/ |
| 도구 | scripts/roas/ | legacy/scripts/ |
| 검사 | tests/roas/ | legacy/tests/ |

기본 명령 npm run dev, npm run build, npm run start:agents는 현재 ROAS만 사용한다. npm test는 현재 회귀 검사다. npm run dev:legacy는 5174 포트에서 보관 UI를 제공하고 /workbench는 구 탐색 화면, /는 초기 CTI다. npm run start:legacy-agents는 구 서버를 선택적으로 실행하며 현재 서버와 동시에 실행하려면 AGENT_PORT를 다르게 지정해야 한다.

## 검증과 상태

변경 전 관련 기준선 56개 통과. 이동 전 36개 성과, 36개 리뷰 응답에서 자료 식별 해시만 제외한 내용 해시와 네 payload 파일 해시를 evidence/roas-separation-20261104/baseline.json에 기록했다.

자체 검사: 현재 회귀 65개 통과, 타입 검사 통과, 현재 Vite 빌드 통과. 전체 lint는 오류 0개이며 연구 생성기 두 곳의 기존 미사용 변수 경고가 있다. 새 HTTP 코드와 Vite 설정의 미사용 경고는 제거했다. 보관 Vite 빌드와 초기 시연 검사 두 개도 통과했다. 독립 코드, 데이터 검증은 리뷰 장애 격리 수정 후 차단 이슈가 재현되지 않았다. 실제 UI 표본은 통과했으며 브라우저 도구 장애로 캠페인 범위, 예시 대화, 모바일과 키보드 조작은 미확인이다.

실행 명령과 최종 결과는 evidence/roas-separation-20261104/validation.md를 따른다. 실모델 호출, 커밋, push와 원격 배포는 이번 검증에 포함하지 않는다.
