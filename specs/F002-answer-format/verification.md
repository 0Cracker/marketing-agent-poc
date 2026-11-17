# F002 이행 검증

원본 답변 변경 4건을 PR #14 병합 dev 위에 순서대로 옮겼으며, 로컬 통합 검사와 버전 대조를 통과했다.

- 날짜: 2026-11-17, Node 24.22.1, npm 11.9.0, Linux, Chromium.
- 시작 dev: `f53a3785f965ee1da561dd39b76a5941171b5272`, 최종 검증 대상: `e2612c4` 이후 v0.4.32 변경 트리.
- 기존 원격 branch `claude/fervent-lovelace-50b3me`는 `7855270dd5e13720c10939877c77599d8fde2b0f`로 보존했다. 강제 push와 원본 이력 재작성은 하지 않았다.

## 버전과 기준 SHA

| 원본 변경 | 이전 번호 | 새 번호 | 새 일지의 기준 SHA |
| --- | --- | --- | --- |
| `5d3a3fd`, Markdown 표시 | v0.4.28 | v0.4.29 | `f53a378` |
| `b871edf`, 근거 칩 | v0.4.29 | v0.4.30 | `384a888` |
| `08b7ca4`, Deep 형식 | v0.4.30 | v0.4.31 | `f3518c8` |
| `7855270`, 실행 기록 분리 | v0.4.31 | v0.4.32 | `e2612c4` |

- 문서 add/add 충돌은 v0.4.28 QA 일지를 보존하고 원본 답변 일지를 v0.4.29부터 별도 생성해 해소했다. 따라서 파일 충돌을 덮어쓰지 않았다.
- 원본 코드/테스트 diff는 3-way 적용으로 모두 깨끗하게 반영됐다. 패키지 파일과 버전별 문서는 별도로 조정했다.
- 각 일지에 기존 검증과 이행 후 검증을 구분하고 원본 SHA를 기록했다. 기준 SHA는 실제 새 부모 커밋으로 갱신했다.
- 일지 파일명, 제목과 본문 버전, 인덱스, SDD §36.19 링크를 한 단계씩 올렸다. v0.4.28은 QA 버전으로 보존했다.
- 최종 package.json, package-lock.json과 packages 루트 버전은 모두 0.4.32다.

## 실행 검사

| 검사 | 결과 | 종료 코드 |
| --- | --- | --- |
| v0.4.29 UI 회귀, 타입 | 13개 통과, 타입 성공 | 0 |
| v0.4.30 UI 회귀, 타입 | 15개 통과, 타입 성공 | 0 |
| v0.4.31 UI와 생성 입력 회귀, 타입 | 23개 통과, 타입 성공 | 0 |
| 최종 npm test | 84개 통과 | 0 |
| 최종 npm run test:agents | 133개 통과, 일부 ROAS 검사 중복 | 0 |
| 최종 npx tsc --noEmit | 통과 | 0 |
| 최종 npm run lint | 오류 0, 기존 경고 2건 | 0 |
| 최종 npm run build | 성공, 기존 폰트와 번들 크기 경고 유지 | 0 |
| CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium python evidence/v0.4.28/validation/browser-check.py | 통합 상태에서 화면 14개 재통과 | 0 |

[최종 실행 요약](../../evidence/answer-version-port-20261117/checks.txt). UI 검사 실행 원본과 QA 캡처는 [기존 결과](../../evidence/v0.4.28/validation/ui-results.json)와 같은 내용이다.

## 독립 대조와 한계

- 원본 브랜치와 answer-guide.md, run-markdown.tsx/css, roas-answer.tsx, roas-conversation.css 및 변경된 Agent 테스트 3파일을 git diff로 대조해 차이 0을 확인했다.
- data/와 shared/는 이번 이행에서 바꾸지 않았다. QA 상세 차트의 마커 3개, 결제 오류 원문 열기와 PC 범위의 오류 제외는 통합 화면 검사로 보존을 확인했다.
- 근거 칩, Deep 구역과 실행 정보 접기는 기존 렌더러 단위 검사로 확인했다. 이행 후 답변 화면 별도 캡처와 실제 모델 답변 품질 평가는 미실행이다.
- 새 PR은 dev 대상 검토용이다. 사용자 검토 전에 병합하거나 main에 반영하지 않는다.
