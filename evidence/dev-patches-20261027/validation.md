# dev 패치 검증, 2026-10-27

시작: dev `8029ac7d2788e62367f569c8f2ec38f1d3225366`. 기존 미커밋 ROAS 대화, UX와 카드 수정 전체를 보존하고 사용자 요청으로 두 목적의 개발 커밋으로 나눈다. Windows PowerShell, 설치된 Node.js와 기존 의존성을 사용했다. 원천 레코드와 데이터 스키마를 추가하거나 수정하지 않았다.

## v0.4.2, 조회 API와 답변 계약

- `node --test --test-concurrency=1 tests/agents/*.test.mjs`: 종료 0, 140개 통과. [실행 로그](agents.log).
- `node --experimental-strip-types --test tests/agent-client.test.ts`: 종료 0, 10개 통과. [실행 로그](client.log).

클라이언트 검사는 전체 프런트 검사에도 포함되므로 서로 합산하지 않는다. API는 기존 Origin과 토큰 검증, 데이터 해시, 조회 범위와 근거 ID 경계를 검사한다. 테스트는 실제 외부 모델을 호출하지 않았다. 이번 커밋에는 UI 변경을 포함하지 않는다.

버전은 package.json과 package-lock.json의 루트 두 곳을 함께 갱신했다. main 병합, 태그와 Release는 수행하지 않는다. 원격 반영과 배포 결과는 확인 후 후속 버전 기록에 남긴다.

## v0.4.3, 대화 UI와 대시보드 표현

API 커밋은 `c340db74521fe86f348dd6885b6032db1cac1566`이다. 이후 대화 UI, 탐색과 축, 색상, 카드와 메뉴 이름을 한 목적의 화면 개선 커밋으로 묶었다. 이전 모델 실행과 시안별 Evidence는 원래 날짜와 실패, 한계까지 보존했다.

| 명령 | 결과 | 로그 |
| --- | --- | --- |
| `node --experimental-strip-types --test tests/agent-client.test.ts tests/agent-answer.test.ts tests/agent-presentation.test.ts tests/training-presentation.test.ts` | 종료 0, 28개 통과 | [프런트](frontend.log) |
| `node --test tests/training-dashboard.test.mjs` | 종료 0, 24개 통과 | [원천 보존과 교육 대시보드](training.log) |
| `node --experimental-strip-types --test tests/roas-*.test.mjs tests/roas-*.test.ts` | 종료 0, 67개 통과 | [ROAS](roas.log) |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | 종료 0 | [타입](types.log) |
| 변경된 JS, TS, TSX와 검사 파일 대상 ESLint, `--max-warnings 0` | 종료 0 | [린트](lint.log) |
| `node node_modules/vite/bin/vite.js build` | 종료 0, 최종 버전 0.4.3 | [빌드](build.log) |

package.json, package-lock.json 최상위와 packages 루트의 버전 0.4.3 일치, `git diff --check`의 공백 오류 없음도 확인했다. 빌드의 기존 폰트 런타임 경로 해석과 플러그인 소요 시간 안내는 남았다. 최종 코드에 대한 자동 검사는 중복을 제외하면 259개다.

대상 린트에는 기존 Next pages 경로 안내가 남았다. 실제 모델 호출은 이전 기록을 보존했으며 이번 커밋 정리에서는 다시 실행하지 않았다. 전체 사례 화면과 실제 모바일 기기 사용성은 검증하지 않았다. 배포 후 AI 연결에는 로컬 API 실행과 허용 Origin 설정이 필요하다.
