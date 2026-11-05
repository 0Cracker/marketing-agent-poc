# 표 성과 색상 검증, 2026-10-27

기준 dev SHA: `3fffbdd7e9d59a369d98c8db8a19cc3465c6f99b`, v0.4.4 미커밋 변경. Windows PowerShell, Node v24.22.1.

| 명령 | 결과 |
| --- | --- |
| node --experimental-strip-types --test tests/agent-client.test.ts tests/agent-answer.test.ts tests/agent-presentation.test.ts tests/training-presentation.test.ts | 29개 통과, 종료 0 |
| node --test tests/training-dashboard.test.mjs | 24개 통과, 종료 0, 기존 원천 바이트 보존 포함 |
| node --experimental-strip-types --test tests/roas-*.test.mjs tests/roas-*.test.ts | 67개 통과, 종료 0 |
| node node_modules/typescript/bin/tsc --noEmit --incremental false | 통과, 종료 0 |
| node node_modules/eslint/bin/eslint.js frontend/workbench/training-dashboard.tsx frontend/workbench/training-presentation.ts frontend/workbench/roas-answer.tsx tests/training-presentation.test.ts | 종료 0, 기존 pages 경로 안내 출력 |
| node node_modules/vite/bin/vite.js build | 통과, 종료 0, 2617개 모듈 변환 |

공통 판정 검사는 기존 승인 S16 값을 재사용해 높은 값이 유리한 지표, 낮은 값이 유리한 지표와 중립 지표의 양방향 변화를 검사한다. 기존 검사에서 0 증감, 반올림된 0, 결측과 기준값 0의 비교 불가도 확인한다.

현재 수치와 증감의 공통 함수 연결, AI 답변의 부호 기반 판정 제거, CSS 우선순위와 색상 일치를 소스 diff로 확인했다. 실제 브라우저 렌더링, 모바일과 전 사례의 육안 확인은 미실행이다.

처음 시도한 npm 명령은 PATH에 npm이 없어 실행되지 않았다. 위 Node 직접 명령으로 동일 검사와 빌드를 수행했다. 빌드의 폰트 URL 경고는 런타임 경로 유지 안내이며 최종 dist에 해당 폰트 파일이 포함됐다.
