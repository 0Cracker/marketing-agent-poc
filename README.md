# 마케팅 분석·예산 Agent PoC

**작업 폴더는 이 저장소 하나다.** 프런트·백엔드·CURRENT 데이터·문서·검증 도구를 모두 여기서 실행한다. [문서 안내](docs/README.md)에서 버전·더블 다이아몬드·AI 교훈·결과 근거를 찾는다.

2026-10-20 정리 시작 시 main은 `ee2ca66`이었다. 후속 개발 커밋 `0492054`(화면·자료)와 `6267858`(백엔드·예산·평가)을 통합·검증하고 폴더 정리와 함께 로컬 main에 반영했다. 원격 main은 변경하지 않았다. 현재 브랜치와 미커밋 상태는 `git status`로 확인한다. 이 정리는 원격 배포나 새 버전 발행이 아니다.

가상 마케팅 자료와 채널별 Hill 모형을 사용한다. 기본 에이전트는 오프라인 대역이고, `--live`를 지정하면 실제 모델을 사용한다. 실제 광고 집행은 비활성이다. 최신 구현·실패·검증 범위는 [최종 반영 기록](docs/design/semantic-changes-20261020.md)을 따른다.

## 폴더 구조

```text
marketing-agent-poc/
├─ frontend/       화면·차트·대화 패널
├─ backend/        분석·예산·승인·SQLite·모델 연결
├─ data/           CURRENT 자료·manifest·원천 보존
├─ docs/           버전·설계·AI 교훈·연구·레퍼런스
├─ evidence/       검증 결과·실패·캡처 원본
├─ scripts/        실행·조회·검산 도구
├─ tests/          회귀 검사
├─ work/           로컬 DB·이번 실행 로그 (Git 제외)
└─ archive/        과거 스냅샷·백업 (Git 제외)
```

별도 프로젝트 폴더·worktree는 사용하지 않는다. 온톨로지용 Python/Java 검증 도구는 내부 `.tools/ontology-validation/`에 둔다. 앱 실행에는 필요하지 않으며 RDF/SHACL·HermiT·OOPS 검증에 사용한다. Git 추적에서는 제외한다. 과거 보고서의 이전 경로는 실행 당시 기록으로 보존한다.

## 실행·검증

아래 명령은 모두 이 저장소 루트에서 실행한다. 현재 검증 환경은 Node 24.19.0이며 `node:sqlite`를 사용한다.

```powershell
node scripts/agent-server.mjs
# 별도 터미널
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173
# 화면: http://127.0.0.1:5173/workbench
```

실제 모델은 기존 서버용 `.env.local` 설정을 유지하고 `node scripts/agent-server.mjs --live`로 시작한다. 모델 호출 예산은 실행 전에 정한다.

```powershell
node --test --test-concurrency=1 tests/agents/*.test.mjs
node --experimental-strip-types --test tests/agent-client.test.ts tests/agent-answer.test.ts tests/agent-presentation.test.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/vite/bin/vite.js build
```

## 배포 링크

현재 배포: [마케팅 Canvas · Agent PoC](https://marketing-canvas-poc-1008.gogoseo110416586.chatgpt.site)

2026-10-20 Sites 조회에서 확인한 기존 배포 주소입니다. 이 배포가 현재 Git `main` 또는 `dev`의 어느 커밋과 일치하는지는 확인하지 않았습니다.

`main`과 `dev`는 별도 Sites 사이트로 나누어 고정 주소 두 개를 운영할 수 있습니다. 아래는 운영 방침이며, 브랜치별 사이트 분리와 자동 배포는 아직 설정하지 않았습니다.

| 기준 브랜치 | 용도 | 전용 배포 링크 |
| --- | --- | --- |
| `main` | 검증·병합된 정식 버전 확인 | 미설정 |
| `dev` | 개발 중인 변경 확인 | 미설정 |

- 두 사이트는 서로 다른 `project_id`와 주소를 사용합니다. 같은 사이트에 번갈아 배포하면 기존 화면이 교체됩니다.
- 배포할 때 해당 브랜치의 커밋을 빌드하고, 대상 사이트와 배포 커밋 SHA를 확인합니다. 브랜치에 푸시하는 것만으로 배포되는 설정은 현재 없습니다.
- 분리 배포가 완료되면 위 표를 실제 주소로 갱신하고, 기존 배포의 역할과 각 사이트의 접근 권한을 함께 기록합니다.

## 기존 CTI 고정 시연 · v0.1.0 기록

A 원인 분석 → 다섯 단계의 분석 과정·원천/산식·반대 근거 → 실행안 검토 → CS/제품 조사 계획 승인 → Mock 업무 요청 등록. 이어 E를 선택하면 결측 때문에 성과·예산 판단을 보류하고 계측 복구를 요청합니다.

- A: 고객 경험 조사. 광고 배분 유지.
- B: 경쟁사 활동·수집 범위 조사. 자사 예산 유지.
- C: 현행 유지 대비 14일 광고 배분 실험. 계측과 무작위 분할 준비 후 조건부 검증.
- D: 리뷰 조사와 광고 유지의 분리.
- E: 판단 보류·계측 복구. 전체 CTI와 예산 계산 차단.
- F: 현행 유지·2주 관찰. 근거 없는 확대를 피함.

오늘 필요한 결정은 대시보드 첫 영역에 표시합니다. 답변은 채팅 안에서 완결되며, 상세 화면은 선택 사항입니다. 담당 팀·기한·확인 자료·완료 산출물·성공/중단 조건·후속 판단이 실행안에 포함됩니다. 실제 업무 전달·광고 집행은 하지 않습니다.

## 데이터·작성 근거

- frontend/lib/demo-scenarios.ts: 6개 사례·18개 고정 응답·36개 월 기록·원천/검산·다섯 단계 분석·차별화된 실행안. 앱은 이 정적 콘텐츠를 표시합니다.
- scripts/author-demo.mjs: 작성 단계 계산·콘텐츠 생성. 앱에서 호출하지 않습니다.
- scripts/scenario-decisions.mjs: 시나리오별 판단 규칙과 실행안의 작성 원본.
- tests/demo.test.ts: 수식·리뷰/매체 합계·결측·월별 사건 정합성·예산 및 대응 차별화 검산.

CTI는 A+B 내 검색·긍정 리뷰·참여·노출 비중의 가중 합계(.35/.25/.20/.20)입니다. 매출·구매 확률·전체 시장 점유율·광고 효율이 아닙니다. 가중치·검토 임계값·승인 조건은 검증되지 않은 PoC 가정입니다. 산술적 변화와 원인 가설은 구분합니다.

예산 이동은 C 한 사례만 제안합니다. 나머지 관측 가능 사례는 현행 배분 유지, E는 계산 보류입니다. C의 모의 곡선은 관측점 하나에 맞춘 가정 함수이며 실제 효과를 추정하지 않습니다. 1,200만원 월간 비교와 대조/실험 각 300만원의 제한 실험을 구분합니다. 성공 기준은 실제 CPM·CVR·충분한 표본으로 검증할 계획이며 이 Mock에는 전환 자료가 없습니다.

파일럿 목표는 자료 정리·검산·근거 검토·실행안 작성의 시간과 누락을 줄이는 것입니다. 시간 절감 수치는 미측정입니다. React/Vite/TypeScript와 기존 Recharts를 사용하며 새 의존성은 추가하지 않았습니다.
