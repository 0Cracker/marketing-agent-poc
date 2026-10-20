# 문서 안내

현재 작업은 `marketing-agent-poc` 한 곳에서 진행한다. 같은 이름의 과거 파일을 찾았을 때는 이 인덱스와 실제 Git 상태를 우선한다.

| 찾는 정보 | 기준 문서 |
| --- | --- |
| 실행과 폴더 구조 | [프로젝트 README](../README.md) |
| Vercel main·dev와 로컬 AI 연결 | [배포 설정](deployment.md) |
| 버전·원본 커밋·통합 이력 | [버전 대응표](iterations/version-history.md) |
| 현재 v0.4.0 변경·검증·한계 | [v0.4.0 일지](iterations/v0.4.0.md), [10월 20일 최종 반영](design/semantic-changes-20261020.md) |
| 데이터 기반 v0.2.0 | [일지](iterations/v0.2.0.md), [더블 다이아몬드](iterations/v0.2.0-double-diamond.md) |
| 대시보드 v0.3.0 | [일지](iterations/v0.3.0.md), [분리 과정의 더블 다이아몬드](design/dashboard-data-separation.md) |
| AI 활용 교훈 | [교훈 인덱스](ai-lessons/README.md): 001 데이터·검증, 002 화면·업무 의미 |
| 실제 모델의 실행·실패·복원 | [연결 기록](design/agent-live-20261019.md), [CURRENT 실행](design/current-live-20261019.md) |
| 질문 평가의 범위 | [평가 기록](design/question-evaluation-20261020.md) |
| 온톨로지·필드·시간·조회 정책 | [연구 인덱스](research/marketing-ontology/README.md), [공통 의미 규약](research/marketing-ontology/common-contract/README.md) |
| 데이터 생성·변경 승인 | [승인 기록](research/marketing-ontology/data-proposal.md). 제안이라는 이름이어도 승인·규칙의 근거는 보존한다. |
| 현재 데이터·해시·보존 정책 | [데이터 안내](../data/README.md) |
| 데이터별 보유 기간·질문 범위 | [41개 유형·국가별 기간표](design/current-data-coverage.md) |
| 설계 선택과 이유 | [결정 인덱스](decisions/README.md) |
| 디자인·답변 예시·외부 조사 | [디자인 보드](references/dashboard-design/README.md), [답변 예시](references/marketing-agent-answer-examples-20261019.md), [API 조사](references/free-llm-api-specs-20261016.md) |
| 검증 원본 | [Evidence 안내](../evidence/README.md), 연구 폴더의 `runs/`와 배치별 결과 |

## 보관과 정리

`../archive/`는 과거 디자인 스냅샷·버전 정리 작업물·원본 백업의 보관소이며 Git 추적에서 제외한다. 현재 작업용 소스 사본으로 사용하지 않는다. 삭제한 계획서 7개의 복구 사본과 작업 폴더 정리 기록은 `archive/workspace-consolidation-20261020/`에 둔다.

계획·검수 초안 중 완료 결과가 다른 문서에 반영된 2개는 제거하고 해당 결과로 연결했다. 바깥에 흩어진 초기 디자인·하네스·흐름·키 준비·출력 UX 계획 5개도 제거했다. 버전·다이아몬드·AI 교훈·승인 범위·원천·과거 실패 Evidence는 보존했다. 레퍼런스 ZIP은 내부 38파일이 보존 폴더와 모두 일치함을 확인한 뒤 삭제했다.

외부 조사 문서는 작성일 기준 자료다. 모델·요금·한도와 외부 API 사양은 사용할 때 다시 확인한다. 과거 검증 보고서의 경로·해시·실패·당시 상태는 현재 상태에 맞춰 덮어쓰지 않는다.
