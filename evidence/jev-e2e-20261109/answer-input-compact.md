# S16 최종 생성 모델 입력 경량화 검증 (2026-11-09)

## 대상 및 방법

- 실모델 기존 실행 기록: run-1794195811884.json
- 변경 전: attempts 마지막 markdown 생성 요청 입력
- 변경 후: 같은 실행 runs[0].tools의 실제 6개 조회 원문을 buildAnswerInput()로 재구성
- 측정 방식: Buffer.byteLength(JSON.stringify(input),'utf8')
- 재현 명령: node scripts/roas/diagnostics/answer-payload-size.mjs
- 추가 실모델 호출 없음, 토큰 사용량 및 응답 시간 비교는 미실시

## 생성용 입력 크기

| 도구 | 이전 (byte) | 이후 (byte) | 감소량 | 감소율 |
| --- | ---: | ---: | ---: | ---: |
| overview | 8,980 | 2,337 | 6,643 | 74.0% |
| metric_detail | 5,562 | 1,996 | 3,566 | 64.1% |
| trend (2페이지 통합) | 46,022 | 3,865 | 42,157 | 91.6% |
| records (2페이지 통합) | 18,424 | 11,736 | 6,688 | 36.3% |
| **최종 요청 전체** | **79,484** | **21,223** | **58,261** | **73.3%** |

도구 행은 각 도구의 생성용 results 엔트리 JSON을 합산한 값입니다. 최종 요청 전체에는 질문, 범위, 공통 보고 기준 등 다른 필드도 들어 있으므로 도구 합계와 차이가 납니다.

## 데이터 및 한계 보존 확인

- 캠페인 6개: baseline/current 분자 및 분모 유지
- 일별 ROAS 28일: 날짜, 기간, 값, 단위 및 분자/분모 유지
- 운영 기록 33건: 날짜, 유형, 제목, 관련 대상 및 운영 값 유지
- 기간의 시작과 끝, 배타적 종료, 귀속과 집계 기준은 최상위 reportingBasis 한 번만 전달
- 생성용 입력에 evidenceId, evidenceIds, sourceHash, sourceVersion, dataHash, nextOffset 없음
- 조회가 첫 페이지만 완료되면 trend 24/28, records 24/33 모두 coverage.incomplete와 moreAvailable 유지
- 서로 다른 기간 필터의 조회 결과는 병합하지 않음
- 근거 발급, 원천 연결, 실행 추적은 별도 서버 경로에 유지

## 자동 검증

- npm.cmd run test:agents: 103개 통과, 신규 경량화 회귀 4개 포함
- npm.cmd run test:roas: 72개 통과
- npm.cmd run test:training: 5개 통과
- npm.cmd run lint: 성공, 기존 연구 스크립트 경고 2건
- npm.cmd run build: 성공, 기존 번들 크기 경고
- git diff --check: 오류 없음, Windows 줄바꿈 경고만 표시
- 기존 .github/workflows/roas-agent-qa.yml의 검사 명령과 테스트 glob에서 신규 검사가 실행됨

브랜치 feat/agent-answer-payload-compact-20261109에서 검증한 미커밋 변경입니다. 기존 미커밋 작업은 보존했으며 커밋, 푸시, 실모델 호출, 데이터 원천/스키마 변경은 하지 않았습니다.
