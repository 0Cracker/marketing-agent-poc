# 로컬 버전과 커밋 대응표

v0.2.0 데이터 기반 → v0.3.0 대시보드·자료 통합 → v0.4.0 에이전트 연결로 정리했다. 이번 작업은 로컬 커밋 정리다. main·기존 태그·원격은 유지했으며 새 태그·Release는 만들지 않았다. package.json의0.1.0은 기존 패키지 메타데이터로 유지한다.

## 버전 체크포인트

- v0.2.0: `d5f437727d8a704aeb296b134bebee693578e0d3` — 데이터·온톨로지·D007.
- v0.3.0: `39d9339af56ac704d6adcded3722d36e79225fa8` — 실행 가능한 에이전트와 프록시가 없는 대시보드.
- v0.4.0: `bed0986ec1d17e348234c77813c077c4a503d0b9` — 에이전트·대화·승인·복원과 검증 마감.

전체 커밋 SHA와 버전별 범위는 [체크포인트 인덱스](version-history.json)에 있다. 버전별 범위의 커밋 수는 v0.2.0 30개, v0.3.0 8개, v0.4.0 9개다. v0.2.0에는 기존 데이터 이력29개와 경계 문서1개, v0.3.0에는 기존 화면 이력4개가 포함된다. 이 문서의 최종 SHA 기록은 체크포인트 뒤의 별도 메타데이터 커밋이다.

현재 통합 경로는 marketing-version-history, 브랜치는 integration/version-history다. 원본 dev와 feature/workbench-evolution의 기존 커밋은 보존했다. cherry-pick 순서는 재현 가능한 버전 구성을 위한 사후 정리이며 실제 작업 발생 순서가 아니다.

## 작업별 커밋

| 원본 SHA | 통합 SHA | 작업 |
| --- | --- | --- |
| 61af9c1 | d5f4377 | docs: 데이터 기반 버전의 범위와 검증 근거 정리 |
| 32547c9 | 63f8595 | feat: 확정 명세 기반 마케팅 워크벤치 구현 |
| 6364908 | 60db4fe | fix: 검색형 필터와 글꼴 및 브랜드 제품 계층 개선 |
| 6c060f9 | 47abf00 | fix: 리뷰 시각화와 KPI 단위 및 보라색 차트 피드백 반영 |
| 4d286c5 | bfdfaac | docs: 데이터와 화면 분리 더블 다이아몬드 및 발전 과정 기록 |
| 3f01d9e | bebea07 | refactor: 화면 계약과 데이터 조회 계층 분리 |
| 7f53f52 | bcbcd15 | feat: 국가별 비교 자료와 마케팅 화면 개선 |
| 2dec303 | 04d4034 | refactor: CURRENT 데이터와 화면 배포 경로 통합 |
| f16b8c1 | 33ac016 | feat: 분석과 예산 검토 에이전트 구현 |
| 490cc65 | 275b58d | feat: 에이전트 HTTP와 모델 실행 연결 |
| 6d6f59c | 3e6a168 | feat: 대시보드에 에이전트 통신과 응답 표시 계층 추가 |
| 70205d5 | d09f516 | feat: 대화형 패널과 근거 중심 답변 표시 |
| ebac22b | 0a19b14 | fix: 통합 checkout의 원천 줄바꿈 차이를 대사에서 구분 |
| 3896c62 | 4db82dd | docs: 에이전트 작업 기록을 v0.4.0으로 분류 |
| 02a3af4 | 69d3902 | docs: 대시보드와 데이터 통합의 작업 근거 정리 |
| d0af493 | 1d88d16 | fix: 검증 근거의 원본 CRLF 바이트 보존 |

## 재현

같은 통합 worktree에서 다음 명령을 사용한다. 기존 Node 의존성은 로컬 node_modules 연결을 재사용했다.

```powershell
node scripts/agent-server.mjs
# 별도 터미널
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173
```

기본 에이전트는 오프라인 대역이며 실제 Ads는 비활성이다. 기본 서버 DB는 work/ 아래에만 생성되고 Git에서 제외한다. 데이터 manifest·UI/서버 해시가 다르면 보류한다.

검증 명령·대상 SHA·종료 코드·로그는 [실행 목록](../../evidence/version-arrangement/checks.json)에 있다. WORKBENCH_CHECK_OUTPUT으로 과거 보고서를 덮어쓰지 않는 새 출력 경로를 지정할 수 있다. 전체 Agent 회귀의 --output도 새 경로를 사용한다.

v0.2.0의 승인·OOPS 설치 근거는 원본 절대 경로에 묶여 있어 전체 사이클은 원본 marketing-agent-poc에서 실행했다. [입력 대조](../../evidence/version-arrangement/v0.2.0/checkpoint-inputs.json)는 체크포인트와 모든 검증 입력 바이트가 같음을 확인했다. 새 worktree 실행의 실패도 보존했으며 통과로 바꾸지 않았다.

과거 evidence/v0.2.0/agents-* 등의 이름은 역사적 식별자로 유지하고 논리 버전만 v0.4.0으로 분류했다. 실제 모델의 이전 성공·실패 근거를 보존했으며 이번 정리에서 외부 모델 호출은0이다.
