# 초기 구축 시 저장소 상태

확인일: 2026-10-12 (Asia/Seoul). 이 문서는 초기 점검 스냅샷이며 정식 버전 일지나 발행 기록이 아니다. 운영 절차는 [DEVELOPMENT-WORKFLOW.md](DEVELOPMENT-WORKFLOW.md)를 따른다.

## Git 및 버전

| 항목 | 실제 확인 결과 |
| --- | --- |
| 로컬 브랜치 | main 하나, dev 없음 |
| HEAD 및 main | b7f05515c7e42692c7e1b7552741d5f1294939ea |
| 커밋 이력 | 1개, `Update Site source`, 2026-10-08, Sites 작성 |
| 원격 및 추적 브랜치 | `git remote -v`, `git branch -avv`에 원격 없음 |
| 로컬 태그 | 없음 |
| GitHub PR·Release·원격 태그 | 연결된 저장소 URL이 없어 조회 대상 확정 불가. 존재하지 않는다고 단정하지 않음 |
| 현재 발행 버전 | 미확정. package.json의 0.1.0은 패키지 메타데이터, 설계의 v2.0은 요구사항 기준 |
| 기존 기록 구조 | docs/agent-contract.md 및 설계·시나리오 문서 존재. 저장소 내 AGENTS.md와 Skill 구조는 없었음 |

## 기존 미커밋 작업

이번 작업 시작 전 수정 파일 7개, 미추적 파일 8개였다. 스테이징된 변경은 없었다. 이번 초기 구축은 아래 파일을 수정하거나 스테이징하지 않는다.

수정: `README.md`, `app/marketing.css`, `app/page.tsx`, `docs/agent-contract.md`, `index.html`, `package.json`, `tsconfig.tsbuildinfo`.

미추적: `docs/cti-decision-plan.jpg`, `docs/cti-demo-preview.jpg`, `docs/poc-v2-initial-design.md`, `docs/scenario-playbook.md`, `lib/demo-scenarios.ts`, `scripts/author-demo.mjs`, `scripts/scenario-decisions.mjs`, `tests/demo.test.ts`.

현재 변경을 기존 main 커밋의 검증 결과와 혼동하지 않는다. 향후 승인된 브랜치 전환·커밋 때 기존 작업의 범위와 보존 방법을 먼저 결정한다.

## 구현 및 검증

- React/Vite/TypeScript. `src/main.tsx`가 `app/page.tsx`를 렌더링한다. Next/DB 관련 파일은 남아 있으나 현재 시연의 실행 기준은 Vite와 고정 콘텐츠다.
- `lib/demo-scenarios.ts`: 6개 사례, 18개 질문/응답, 36개 월 기록, 원천/산식/기여도/판단·실행안. `scripts/author-demo.mjs`와 `scripts/scenario-decisions.mjs`는 작성 단계 원본이다. 초기 구축에서 생성 스크립트를 실행하지 않았다.
- [응답 계약](agent-contract.md)과 [시나리오](scenario-playbook.md)를 재사용한다. [기존 설계](poc-v2-initial-design.md)는 당시 상태를 담아 현재 구현과 시점 차이가 있으므로 과거 내용은 고치지 않았다.
- 2026-10-12 현재 작업 트리, Node v24.19.0에서 `node --experimental-strip-types tests/marketing.test.ts` 통과: 집계·0 분모·6개 시나리오·컨텍스트·근거 제한 검사.
- 같은 환경에서 `node --experimental-strip-types tests/demo.test.ts` 통과: 고정 사례·질문/응답·월 기록, CTI/기여도/리뷰/매체 합계, 사건 순서, 실행 계약, 제한 실험 및 예산 유지·결측 검산.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false` 종료 코드 0. 기존 tsconfig.tsbuildinfo를 갱신하지 않도록 incremental을 끈 검사다.
- 이번에는 Vite 빌드·브라우저 UI/사용성·실제 효과를 검증하지 않았다. 기존 JPG는 존재만 확인했고 새 버전의 전후 Evidence로 지정하지 않았다. 가중치·임계값·모의 예산 효과와 시간 절감은 실제 성과로 검증되지 않았다.

## 초기 구축의 조정

기존 docs와 검증 명령을 유지하며 인덱스·템플릿·Skill을 추가한다. 버전과 교훈을 확정하지 않았으므로 vX.Y.Z 일지·lesson-001·버전별 Evidence 폴더는 만들지 않는다. evidence/README.md 자체가 폴더를 보존하므로 .gitkeep도 필요 없다.

기존 .gitignore의 `/.agents/` 제외를 좁혀 `poc-iteration-log`만 추적 가능하게 한다. 다른 로컬 도구 상태는 계속 제외한다. README는 기존 미커밋 작업이라 수정하지 않았고 진입 안내는 AGENTS.md와 운영 문서에 둔다. 새 의존성·Git hook·CI·외부 자동화는 추가하지 않는다.

## 기록 체계 검증

- 새 Markdown 10개와 로컬 상대 링크 34개를 검사해 파일 존재·코드 블록 짝을 확인했다. 템플릿의 미래 Evidence 경로는 설명으로만 제시하고 존재하지 않는 링크를 만들지 않았다.
- Skill frontmatter를 기존 pnpm 의존성 js-yaml 4.3.2로 파싱하고 name/description, 필드·길이·이름 형식·미완성 scaffold를 확인했다. Skill Creator의 quick_validate.py는 실행을 시도했으나 번들 Python에 PyYAML이 없어 실행 불가였다. 대체 검사에 새 패키지는 설치하지 않았다.
- git check-ignore로 요청 Skill/템플릿은 추적 가능하고 다른 .agents 도구 상태는 제외됨을 확인했다. git diff --check는 통과했다.
- 기존 파일 133개의 SHA256을 전후 비교해 기존 변경·Mock·코드를 보존했으며 기존 파일 중 .gitignore만 수정했다. Git refs·config·index가 동일하고 staged 변경이 없음을 확인했다.
- 문서·Skill의 구조 검증이며, 새 Skill이 실제 자동 선택됐다는 실행 이력이나 UI 표시 검증을 뜻하지 않는다. 저장소 루트에서 명시 호출하거나 경로를 직접 읽어 적용할 수 있다.
