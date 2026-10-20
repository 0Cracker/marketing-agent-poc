# CURRENT 통합본 × 실제 모델 전체 흐름 검증

2026-10-19 · 일본 2026년 8월, P1A~P3B 6제품

**최신 CURRENT 자료에서 실제 모델 분석→원문→후속 질문→예산→가상 승인→승인 복원→후속 분석에 따른 무효화→최종 복원이 통과했다.** 실패분을 포함한 모델 호출 시도는 21/24회다. 이번 판정은 이 대표 흐름에 한정하며 자유 질문 전체의 품질을 뜻하지 않는다.

## 기준선과 변경

- 데이터: `marketing-current/1`, 활성 30,315행·41유형. 해시 `a37ea0b00bc7f7f0d494016d40ee5e356efb4fec90233a9729262f22fd4546b4`.
- 범위: `CURRENT-JP`, `2026-08-01` 이상 `2026-09-01` 미만, 기준시각 `2026-10-19T05:06:31.333Z`(manifest 생성시각).
- 분석 모델: `gemini-3.5-flash-lite`. 예산 모델: `gemini-3.8-flash`. 기존 설정의 키 한 개를 사용했고 자동 키 순환·공급자 전환은 하지 않았다.
- 시작 HEAD: Agent `d0f6267`, 대시보드 `4d286c5`. 양쪽의 기존 미커밋 작업은 [기준선](../../evidence/v0.2.0/current-live-20261019-3/baseline.json)에 기록했다. 변경 파일별 해시와 데이터 파일·메타데이터 해시를 고정했다.
- 검증 DB는 Evidence 폴더의 새 `flow.sqlite`다. 서버에 선택적 `AGENT_DB_PATH`를 추가했으며 미설정 기본 경로는 그대로다. fork로 시작한 검증 서버는 부모의 IPC 종료 요청으로 정상 종료 후 재시작한다.
- `createLiveRuntime`에 선택적 `onDiagnostic`을 추가했다. 검증 부모에게 모델 ID·HTTP 상태·종료 사유·사용량·경과시간·전송 오류 종류만 전달한다. 키·인증 헤더·요청 본문·모델 설명문·원시 오류 문장은 저장하지 않는다. 공개 HTTP API와 마케팅 스키마는 바꾸지 않았다.
- 별도 검증 화면 포트 5179와 Agent 포트 8797을 사용했다. 기존 서버·기존 DB·원천·manifest는 보존했다. 커밋·스테이징·푸시·태그·발행은 하지 않았다.

## 단계별 결과

| 단계 | 결과 | 근거 |
| --- | --- | --- |
| 시작 일치 | pass | [세션](../../evidence/v0.2.0/current-live-20261019-3/session-0.json), [기준선](../../evidence/v0.2.0/current-live-20261019-3/baseline.json): remote_model, 같은 dataHash, realAdsEnabled=false |
| 최초 분석 | pass · 3회 | [initial.json](../../evidence/v0.2.0/current-live-20261019-3/initial.json), 사실 18개·근거 22개 원문 대조, 가격 지지8/반대8 |
| 원문 열기 | pass | [분석 화면](../../evidence/v0.2.0/current-live-20261019-3/analysis-windows.png), [원문 화면](../../evidence/v0.2.0/current-live-20261019-3/evidence-windows.png). D008-T25-01121→D008-T24-00561 발췌 위치·원문 일치 |
| 가격 후속 질문 | pass · 4회 | [followup.json](../../evidence/v0.2.0/current-live-20261019-3/followup.json), 같은 범위·parentId 연결, 새 실행 ID·조회·반대 근거 보존 |
| 예산 인계 | pass · 성공 실행 3회 | [budget.json](../../evidence/v0.2.0/current-live-20261019-3/budget.json), 기존 후보·모형·정책으로 pending_approval. 앞선 예산 실패2회는 별도 보존 |
| 독립 검산 | pass | [분석 Decimal·원문 검산](../../evidence/v0.2.0/current-live-20261019-3/analysis-independent.json), [예산 Decimal 검산](../../evidence/v0.2.0/current-live-20261019-3/decimal-check.txt) |
| 가상 승인 | pass · 모델 호출0 | [approved.json](../../evidence/v0.2.0/current-live-20261019-3/approved.json), 자료·분석 버전·제안 해시 연결. 모델이 직접 reallocate를 선택했으며 사용자 후보 수정은 필요하지 않았음 |
| 승인 상태 재시작 복원 | pass · 추가 호출0 | [restore-1.json](../../evidence/v0.2.0/current-live-20261019-3/restore-1.json), [화면](../../evidence/v0.2.0/current-live-20261019-3/approved-restored-windows.png). 동일 실행 ID·version·승인·제안 복원, 옛 토큰 거부와 새 세션 인증 확인 |
| 재고 후속 분석·무효화 | pass · 4회 | [final.json](../../evidence/v0.2.0/current-live-20261019-3/final.json), [invalidated.json](../../evidence/v0.2.0/current-live-20261019-3/invalidated.json): analysis_changed·approval=null |
| 최종 재시작 복원 | pass · 추가 호출0 | [restore-2.json](../../evidence/v0.2.0/current-live-20261019-3/restore-2.json), [최종 화면](../../evidence/v0.2.0/current-live-20261019-3/final-restored-windows.png), [화면 텍스트](../../evidence/v0.2.0/current-live-20261019-3/final-restored-dom.txt). 질문3건·부모 이력·기존 제안 무효·승인 버튼 비활성 복원 |

예산은 일본 P1A의 search/social 기존 후보를 사용했다. 기준 525,000/975,000 JPY와 후보 750,000/750,000 JPY, 총액 1,500,000 JPY가 일치했다. 독립 Python Decimal 결과는 기준안 60.500000·후보안 61.538462다. 예산 기간은 **2026-08-03 이상 2026-08-31 미만**으로 분석의 월간 범위와 구분해 표시했다. 이는 기존 가상 포화 함수의 계산이며 실제 성과 예측이나 인과 효과가 아니다.

## 실패·재개와 호출 예산

첫 준비 실행 `current-live-20261019-1`은 호출 없이 종료했다. 두 번째 [실행 상태](../../evidence/v0.2.0/current-live-20261019-2/state.json)는 최초 분석3회 후 가격 후속 질문2회에서 model_failed로 중단됐다. 공급자 HTTP 진단을 수집하기 전이므로 그 오류의 상세 원인은 확정하지 않는다. 이 폴더의 `check` 명령 실패는 검증 제어기의 허용되지 않은 명령 거부이며 모델·앱 실패가 아니다.

진단을 보강한 세 번째 기준선에서 같은 자료로 재검증했다. 예산 첫 실행은 60초 timeout으로 paused가 됐고, 사용자가 누르는 기존 수동 재개 경로를 검사한 요청은 HTTP503 UNAVAILABLE로 held가 됐다. [중단 실행](../../evidence/v0.2.0/current-live-20261019-3/stopped-6eb3018c-0cc6-412b-8f42-3ccec569dd0e.json)과 [공급자 진단](../../evidence/v0.2.0/current-live-20261019-3/provider.jsonl)을 보존한다. 간격을 둔 뒤 같은 모델·키 설정으로 새 예산 검토를 한 차례 수행해3회 호출로 성공했다. 실패 실행을 성공으로 덮어쓰지 않았다.

| 구분 | 호출 시도 |
| --- | ---: |
| 이전 기준선의 최초·실패 후속 분석 | 5 |
| 최종 기준선 최초 분석 | 3 |
| 가격 후속 분석 | 4 |
| 예산 timeout·503 | 2 |
| 성공 예산 검토 | 3 |
| 재고 후속 분석 | 4 |
| 합계 / 상한 | **21 / 24** |

실행기의 modelCalls는 공급자 요청 전 시도도 세는 보수적 카운터다. 최종 기준선의16시도는 진단16건과 일치한다. 이전 기준선5시도는 세부 HTTP 진단이 없다. 승인·원문 조회·두 수용 재시작·화면 복원은 새 모델 호출을 만들지 않았다. 공급자 오류 뒤 검증 제어기 자체를 한 번 중단·재개했으며, 표의 두 재시작은 승인 상태와 무효 상태의 수용 검사다.

## 회귀와 보존

- [최종 회귀](../../evidence/v0.2.0/current-live-20261019-3/regression.json): Agent111/111·기존 앱2검사·카탈로그 회귀pass, 원천/계약102파일 변경0.
- 프런트엔드 클라이언트·답변·표현18/18, TypeScript `--noEmit --incremental false` 종료0. 이번에 프런트 코드는 수정하지 않았으며 빌드를 새로 실행하지 않았다.
- 최초 제한 환경의 서버 재시작 시험은 loopback EACCES로 실패했다. 허용된 로컬 연결 환경에서 새 재시작 시험을 재실행해 pass를 확인했다. 제품 실패와 환경 제한을 구분한다.
- [전체 결과](../../evidence/v0.2.0/current-live-20261019-3/result.json): 현재 자료·표시 메타데이터 변경0, 업무 실행 코드 해시 고정, 기존 두 SQLite 파일 해시 유지, 양쪽 HEAD 유지, 실제 Ads0.
- Windows 데스크톱 화면에서 카드·그래프·표·원문·승인·무효·복원을 확인했다. [실측 크기](../../evidence/v0.2.0/current-live-20261019-3/geometry.json)는 문서1233/1233px, 대화478/478px로 가로 넘침이 없었다. 요청한 viewport override와 실제 DOM 너비가 달라 실측값을 근거로 삼는다. 최종 재로드 후 브라우저 warn/error 로그는0이었다. 이전 timeout·503은 별도 서버 진단과 화면에 남는다. 모바일 수용 검사는 수행하지 않았다.

## 재현

Agent 저장소에서 전용 포트·독립 DB로 시작한다. `PYTHON`은 실제 Python 실행 파일 경로로 지정한다. 출력 폴더는 매번 새 경로를 사용한다.

```powershell
$env:AGENT_PORT='8797'
$env:VERIFY_UI_PORT='5179'
$env:PYTHON='Python 실행 파일의 절대 경로'
node scripts/verify-current-live.mjs --observe --output evidence/v0.2.0/새-실행-ID
```

대시보드 저장소에서 `$env:AGENT_API_PORT='8797'`을 설정하고 `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5179 --strictPort`로 실행한다. 화면에서 일본·2026년8월·전체 제품을 선택한다. 자동으로 실제 모델을 호출하는 smoke를 실행하지 않는다.

화면의 각 작업을 마친 뒤 제어기 stdin에 다음 명령을 순서대로 전달한다. Windows stdin 전달이 제한된 경우 출력 폴더 `command.txt`에 `1 analysis`처럼 증가하는 번호와 명령을 한 줄로 쓴다.

1. 최초 질문: “일본 2026년 8월 6제품의 금액 점유율을 비교하고 P1A의 경쟁 열위와 가격 관련 지지·반대 근거를 확인해줘.”, 초점 가격 → `analysis`.
2. 후속 질문: “그중 가격 관련 지지·반대 근거만 다시 확인해줘.”, 초점 가격 → `followup`.
3. 예산 검토로 넘기기 → `budget`. 실제 기존 후보가 pending_approval 또는 retained에 도달해야 한다.
4. pending_approval이면 가상 변경 승인. retained이면 기존의 동일 기간·통화·모형에 속하고 기준안과 배분이 다른 유효 후보를 ID순 첫 번째로 선택해 수정·승인한다. 유효 후보가 없으면 미실행으로 남긴다 → `approve`.
5. `restart` → 화면 새로고침·AI와 대화에서 승인 복원 확인.
6. “가격 외 재고 관련 근거를 다시 확인해줘.”, 초점 재고 → `invalidate`.
7. `restart` → 새로고침 후 무효 상태와 이력 확인 → `finish`.
8. 검증 종료는 `quit`. 작업자가 기존에 켠 서버를 종료하지 않는다.

제어기를 중단했다면 원래 포트·`VERIFY_PRIOR_CALLS`와 같은 설정으로 `--resume`을 추가한다. 원래 기준선과 state를 다시 읽고 data/code hash를 검증한다. `VERIFY_PRIOR_CALLS`는 이 작업의 다른 기준선에서 이미 사용한 호출 시도를 합산할 때만 사용한다. 화면을 조작하는 관찰 모드에서도 새 모델 실행을 시작하기 전 남은 총량과 역할별6회 한도를 작업자가 확인해야 한다. 자동 API 모드(관찰 옵션 생략)는 새 실행 전6회 여유를 검사한다. 제어기는 범용 일일 사용량 관리자나 전역 호출 차단기가 아니다.

예산 검산은 `python scripts/check-current-live-budget.py <simulation.json> ../marketing-dashboard-drafts/data/budget-models.jsonl`로 다시 수행한다. 이전 기준선 실패·새 기준선 결과·모델 재개 이력을 합쳐 호출 상한을 초기화하지 않는다.

## 확인하지 않은 범위

3국가·전체 기간·임의 질문의 반복 품질, Gemma 업무 품질, 사람 선호 평가, 비정상 강제 종료·분산 복구는 이번 범위가 아니다. 재고 조회의 지지/반대0은 원인 부재의 입증이 아니며 분류되지 않은 관계 자료와 구분한다. 실제 시장 데이터 연결·실제 공급자 적합성·광고 집행은 프로젝트 범위 밖이다. 기술 검증 통과를 현업 수용이나 원격 배포 완료로 표시하지 않는다.
