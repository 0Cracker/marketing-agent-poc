# ROAS 에이전트 대화 검증, 2026-10-27

대상: dev `8029ac7` 이후 미커밋 트리, Windows PowerShell과 설치된 Node.js. 원천과 스키마를 수정하거나 테스트용 레코드를 만들지 않고 기존 S01~S18과 initial/mature 응답을 사용했다. 시작 시 존재한 `evidence/ux-independent-20261027/`는 보존했다.

## 자동 검사

- `node --test --test-concurrency=1 tests/agents/*.test.mjs`: 통합 실행 134개 통과, 0개 실패. 이후 추가한 인용 정규화와 모델 호출 간격 공유 검사를 포함해 `node --test tests/agents/roas.test.mjs tests/agents/models.test.mjs tests/agents/runtime.test.mjs tests/agents/server.test.mjs` 최종 31개 통과, 0개 실패. 이 중 ROAS 대상은 9개다.
- `node --experimental-strip-types --test tests/agent-client.test.ts tests/agent-presentation.test.ts tests/agent-answer.test.ts`: 최종 21개 통과, 0개 실패. ROAS API의 세션 토큰 재사용 검사 1개를 포함한다.
- `node --test tests/training-dashboard.test.mjs`: 24개 통과, 0개 실패. 원본 보존, 재생성 대사와 production 응답 검사를 포함한다.
- `node --experimental-strip-types --test tests/roas-*.test.mjs tests/roas-*.test.ts`: 67개 통과, 0개 실패.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: 최종 코드 종료 코드 0.
- 변경 파일 대상 ESLint: 최종 코드 종료 코드 0. 기존 pages 경로 안내는 남는다.
- `node node_modules/vite/bin/vite.js build`: 최종 코드 종료 코드 0. 폰트의 빌드 시점 경로 해석 안내는 남으나 최종 폰트 파일은 dist에 포함됐다.

ROAS 추가 검사는 36개 사례와 보고 시점 조합의 화면 집계 일치, 필터 격리, 후속 대화 전달, 데이터 해시 불일치, 모든 제공 분할의 비용 대사, 상세 기록 페이지 이동, 미조회 인용과 중복 도구 요청 거부, Origin과 토큰 검사, 기존 공급자 연결 재사용을 확인한다. 초기 검사에서 캠페인 그룹 키가 `campaignId`와 일치하지 않는 오류가 발견되어 수정했다.

## 실제 모델과 브라우저

환경: `http://127.0.0.1:5173/workbench`, 기존 Vite 서버, 이번 작업에서 실행한 로컬 AI 서버 `127.0.0.1:8788`, 실제 모델 `gemini-3.5-flash-lite`, in-app browser의 기본 1265×714 화면. S16, initial, 전체 캠페인과 기기, 분석 기간 2026-08-17~2026-08-30과 직전 14일을 사용했다.

1. 오른쪽 하단 AI 버튼을 누르면 공유 패널의 대화, 근거, 원본 탭과 입력창이 표시된다.
2. 최초 캠페인 비교 호출은 `model_protocol`으로 실패했다. 별도 직접 호출에서는 유효한 ID와 답변을 확인했으나 ROAS 배수와 종료일 표기가 부정확했다. 조회 ID를 응답 스키마에 제한하고 유효한 묶음과 번호 인용을 정규화했으며 %, %p와 종료일 미포함 안내를 강화했다.
3. 서버 재시작 후 “캠페인별 현재 ROAS와 하락 폭을 비교해줘”에 실제 답변을 받았다. 검색 A 302.9%, -293.7%p, 검색 B 109.6%, -84.3%p, Facebook 피드 296.1%, -254.5%p 등 화면과 같은 수치와 12개 기간별 인용을 표시했다.
4. “그중 검색 A의 ROAS 하락과 관련된 운영 변경 기록과 반대 근거를 확인해줘”의 후속 답변에서 일예산 240,000원 → 420,000원과 8월 17일 적용, 소재와 랜딩 설정 유지 기록을 반환했다. 인용을 눌러 실제 change 기록의 변경 전, 변경 후와 적용 시각을 확인했다. 추론의 완전성이나 인과 타당성을 검증한 것은 아니다.
5. 근거 → 대화 복귀, 패널 닫기 후 AI 버튼으로 포커스 복귀, 모바일 기기 필터에서 빈 대화, 전체 기기로 복귀 시 기존 두 대화 복원을 확인했다.
6. 전체 데이터 탐색으로 이동해 기존 시장, 경쟁 화면의 AI 패널과 대화, 근거, 원본 탭을 확인했다. 제품 ROAS 검토로 복귀해 기존 두 대화가 복원됐으며 브라우저의 최종 error 로그는 0개였다. 기존 전체 데이터의 실제 모델 재질문은 실행하지 않았다.
7. 최종 서버는 ROAS와 전체 데이터가 기존 모델 호출 간격 제한을 공유한다. 재시작 후 HTTP로 “전체 ROAS의 현재 값과 직전 값을 퍼센트로 짧게 비교해줘”를 요청해 200 응답, 355.8% → 227.8%, -128.0%p와 실제 summary ID 두 개를 확인했다. [최종 HTTP 결과](live-http.json)에 키와 세션 토큰을 제외한 결과를 보존했다.

[실제 후속 답변 화면](conversation-desktop.png)은 기본 화면 크기에서 성과 대시보드와 대화를 함께 캡처했다. 대화 자동 스크롤을 답변 끝에서 최신 질문 시작 위치로 보완한 후 촬영했다. 새 데이터, API 키와 내부 모델 사고 과정은 Evidence에 저장하지 않았다.

## 미검증과 발행

모바일 브라우저, 전 사례의 실제 모델 답변, 실제 마케터 활용성과 새로운 Vercel 배포는 미검증이다. 미조회 ID와 잘못된 데이터 연결은 거부하지만 모델 자유 서술의 모든 수치와 해석을 자동 증명하지 않는다. 대화는 현재 페이지 메모리에만 보관하며 새로고침 후 복원하지 않는다. Git 커밋, push와 배포는 수행하지 않았다.
