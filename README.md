# 마케팅 분석, 예산 Agent PoC

**[main 배포 화면](https://marketing-agent-poc.vercel.app/workbench) | [dev 배포 화면](https://marketing-agent-poc-git-dev-cracker5.vercel.app/workbench)**

main은 Production, dev는 개발 브랜치 Preview다. 2026-10-27 확인 기준 main은 v0.4.0 (`3c11e42`), dev는 v0.4.3 (`810eeee`)이며 두 배포 모두 Vercel Ready 상태다. 위 고정 주소는 각 브랜치의 후속 배포에 따라 갱신된다.

**작업 폴더는 이 저장소 하나다.** 프런트, 백엔드, CURRENT 데이터, 문서, 검증 도구를 모두 여기서 실행한다. [문서 안내](docs/README.md)에서 버전, 더블 다이아몬드, AI 교훈, 결과 근거를 찾는다.

이 README는 현재 dev 구조를 설명한다. 기본 화면은 ROAS 교육 대시보드이며, 성과 현황에서 지표 상세, 비교 표, 운영 근거로 이동한다. S01~S18 사례와 캠페인, 매체, 기기별 조회, 직전 14일 비교를 제공한다. 기존 데이터 탐색 화면은 `(구) 대시보드` 메뉴로 남겨 두었다.

ROAS 대화는 현재 조회 범위의 집계와 원천 행을 읽어 결론, 결과 정리, 판단 근거와 액션을 제시한다. 비교 표, 그래프와 인용 원천을 답변 안에서 확인할 수 있다. 데이터 연결에 온톨로지 설정은 필요하지 않다. 가상 교육 자료를 사용하며 실제 광고 집행은 비활성이다. 구현과 한계는 [ROAS 대시보드 설계](docs/design/roas-training-dashboard.md), [v0.4.2 API 변경](docs/iterations/v0.4.2.md), [v0.4.3 화면 변경](docs/iterations/v0.4.3.md)을 따른다.

화면과 AI 서버는 분리되어 있다. 대시보드는 Vite가 제공하는 자료로 조회하고, AI 대화는 별도 로컬 서버를 사용한다. 기본 서버는 외부 모델 없이 동작하며 `--live`를 지정하면 실제 모델을 호출한다. 기존 분석, Hill 모형 기반 예산 검토와 승인 흐름도 백엔드에 보존되어 있다.

## 폴더 구조

```text
marketing-agent-poc/
├─ frontend/       Vite 진입점(src/), ROAS 화면과 대화(workbench/), 기존 CTI 화면(app/)
├─ backend/        ROAS 대화 API, 기존 분석과 예산, 승인, SQLite, 모델 연결
├─ shared/         대시보드 집계, 지표와 비교, ROAS 답변 계약
├─ data/           CURRENT 자료, 교육 대시보드, manifest와 원천 보존
├─ docs/           버전, 설계, AI 교훈, 연구, 레퍼런스
├─ evidence/       검증 결과, 실패, 캡처 원본
├─ scripts/        로컬 서버, Vite 자료 제공과 빌드, 조회와 검산 도구
├─ tests/          회귀 검사
├─ work/           로컬 DB, 이번 실행 로그 (Git 제외)
└─ archive/        과거 스냅샷, 백업 (Git 제외)
```

별도 프로젝트 폴더, worktree는 사용하지 않는다. 온톨로지용 Python/Java 검증 도구는 내부 `.tools/ontology-validation/`에 둔다. 앱 실행에는 필요하지 않으며 RDF/SHACL, HermiT, OOPS 검증에 사용한다. Git 추적에서는 제외한다. 과거 보고서의 이전 경로는 실행 당시 기록으로 보존한다.

## 실행, 검증

아래 명령은 모두 이 저장소 루트에서 실행한다. Node.js 최소 버전은 `package.json` 기준 22.13.0이며, Vercel은 24.x를 사용한다. 로컬 백엔드는 `node:sqlite`를 사용한다.

```powershell
npm ci --include=dev --include=optional
npm run start:agents
# 별도 터미널
npm run dev
# 화면: http://127.0.0.1:5173/workbench
```

실제 모델은 기존 서버용 `.env.local` 설정을 유지하고 `npm run start:agents -- --live`로 시작한다. 모델 호출 예산은 실행 전에 정한다. 로컬 Vite는 `/agent-api` 요청을 기본 `127.0.0.1:8788` 서버로 전달한다. Vercel 화면에서 로컬 서버를 연결하는 공개 API 주소, 허용 Origin과 브라우저 권한 설정은 [배포 설정](docs/deployment.md)을 따른다. API 키와 SQLite 실행 기록은 로컬 PC에 둔다.

변경 범위에 맞춰 아래 검사를 실행한다. `data:training`은 자료 생성 명령이므로 일반 실행이나 검증 절차에 포함하지 않는다.

```powershell
npm run test:agents
npm run test:roas
npm run test:training
node --experimental-strip-types --test tests/agent-client.test.ts tests/agent-answer.test.ts tests/agent-presentation.test.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm run lint
npm run build
```

## 배포와 개발 기록

Vercel은 같은 프로젝트에서 main의 Production과 dev의 Preview를 운영한다. 화면 배포만으로 AI 서버가 실행되지는 않는다. 방문자가 AI 대화를 사용하려면 같은 PC에서 로컬 서버를 실행하고 연결을 허용해야 한다. 대시보드 조회와 AI 연결의 검증 범위는 구분한다.

- [배포 설정](docs/deployment.md): Vercel 빌드, main과 dev, 로컬 AI 서버 연결.
- [개발 운영 절차](docs/DEVELOPMENT-WORKFLOW.md): dev 세부 커밋, main Squash 병합과 발행 규칙.
- [버전 대응표](docs/iterations/version-history.md): 버전과 커밋, 통합 이력.
- [dev 패치 검증](evidence/dev-patches-20261027/validation.md): v0.4.2와 v0.4.3의 자동 검증, 한계.

과거 [Sites 시연](https://marketing-canvas-poc-1008.gogoseo110416586.chatgpt.site)은 보존 링크다. 현재 Git main 또는 dev와 일치하는 배포로 취급하지 않는다.

## 기존 CTI 고정 시연, v0.1.0 기록

아래는 `/`의 기존 CTI 시연 설명이다. 현재 `/workbench`의 ROAS 교육 대시보드와 구분한다. 2026-10-20 통합 당시 기록은 [최종 반영 기록](docs/design/semantic-changes-20261020.md)에 보존한다.

A 원인 분석 → 다섯 단계의 분석 과정, 원천/산식, 반대 근거 → 실행안 검토 → CS/제품 조사 계획 승인 → Mock 업무 요청 등록. 이어 E를 선택하면 결측 때문에 성과, 예산 판단을 보류하고 계측 복구를 요청합니다.

- A: 고객 경험 조사. 광고 배분 유지.
- B: 경쟁사 활동, 수집 범위 조사. 자사 예산 유지.
- C: 현행 유지 대비 14일 광고 배분 실험. 계측과 무작위 분할 준비 후 조건부 검증.
- D: 리뷰 조사와 광고 유지의 분리.
- E: 판단 보류, 계측 복구. 전체 CTI와 예산 계산 차단.
- F: 현행 유지, 2주 관찰. 근거 없는 확대를 피함.

오늘 필요한 결정은 대시보드 첫 영역에 표시합니다. 답변은 채팅 안에서 완결되며, 상세 화면은 선택 사항입니다. 담당 팀, 기한, 확인 자료, 완료 산출물, 성공/중단 조건, 후속 판단이 실행안에 포함됩니다. 실제 업무 전달, 광고 집행은 하지 않습니다.

## 기존 CTI 데이터와 작성 근거

- frontend/lib/demo-scenarios.ts: 6개 사례, 18개 고정 응답, 36개 월 기록, 원천/검산, 다섯 단계 분석, 차별화된 실행안. 앱은 이 정적 콘텐츠를 표시합니다.
- scripts/author-demo.mjs: 작성 단계 계산, 콘텐츠 생성. 앱에서 호출하지 않습니다.
- scripts/scenario-decisions.mjs: 시나리오별 판단 규칙과 실행안의 작성 원본.
- tests/demo.test.ts: 수식, 리뷰/매체 합계, 결측, 월별 사건 정합성, 예산 및 대응 차별화 검산.

CTI는 A+B 내 검색, 긍정 리뷰, 참여, 노출 비중의 가중 합계(.35/.25/.20/.20)입니다. 매출, 구매 확률, 전체 시장 점유율, 광고 효율이 아닙니다. 가중치, 검토 임계값, 승인 조건은 검증되지 않은 PoC 가정입니다. 산술적 변화와 원인 가설은 구분합니다.

예산 이동은 C 한 사례만 제안합니다. 나머지 관측 가능 사례는 현행 배분 유지, E는 계산 보류입니다. C의 모의 곡선은 관측점 하나에 맞춘 가정 함수이며 실제 효과를 추정하지 않습니다. 1,200만원 월간 비교와 대조/실험 각 300만원의 제한 실험을 구분합니다. 성공 기준은 실제 CPM, CVR, 충분한 표본으로 검증할 계획이며 이 Mock에는 전환 자료가 없습니다.

파일럿 목표는 자료 정리, 검산, 근거 검토, 실행안 작성의 시간과 누락을 줄이는 것입니다. 시간 절감 수치는 미측정입니다. React/Vite/TypeScript와 기존 Recharts를 사용하며 새 의존성은 추가하지 않았습니다.
