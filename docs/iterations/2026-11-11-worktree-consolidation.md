# 2026-11-11 worktree 통합 기록

## 기준 및 보존

- 기준: 검증 당시 origin/dev ecdd4dd, v0.4.25.
- main은 기존 35d2c0e 유지. 서버 푸시, 커밋, 태그, main 병합 없음.
- 활성 작업 폴더: Desktop/Marketing/marketing-agent-poc, dev.
- 로컬 브랜치: dev, main.
- 복구 위치: Desktop/Marketing-worktree-backup-20261111. 모든 이전 작업 트리의 patch, untracked 사본, 전체 Git 참조 bundle 및 옮겨둔 보조 작업 폴더 6개 포함. 이전 worktree의 .git 포인터는 등록 해제된 상태여서 보관본으로 취급한다.
- 미커밋 통합 결과가 dev 워킹 트리에 있으며 원격 dev는 변경하지 않았다.

## 통합된 내용

1. Jev 도구 분류와 ROAS 캠페인 변화 기여도 계산 및 관련 테스트.
2. 운영 기록 타임라인과 관련 활동 UI, 기존 커밋 b87a367.
3. Quick Tunnel QA 검증 코드, 자동 테스트 및 실연결 문서, 기존 브랜치의 3개 고유 커밋.
4. ROAS 온톨로지 설계 문서와 실행 지침.
5. 기존 불필요한 legacy, Next.js, 중복 UI, 구 공개 자료 정리로 추적 파일 693개 삭제. 사용 중인 ROAS UI 컴포넌트를 내부 디렉터리로 이전하고 의존성 정리.
6. dev의 최신 QA 인증 게이트웨이, 2시간 쿠키와 route 기반 API, HMAC 계약 유지.

## 미병합 대안

오래된 별도 qa-gateway 작업 트리에 존재하던 12시간 쿠키, path 기반 API 및 별도 터널 서버 설계는 최신 dev의 2시간 쿠키, route 기반 API, HMAC 검증 계약과 충돌하여 덮어쓰지 않았다. 해당 작업 내용 14개 파일의 변경본은 백업에 보존돼 있다. 현재 dev의 QA 기능은 정상 유지한다.

## 검증 범위

- npm run test:agents
- npm run test:roas
- npm run test:training
- node --test tests/qa/quick-tunnel-smoke.test.mjs
- npx tsc --noEmit
- npm run lint
- npm run build
- npm run build:agent-trace
- git diff --cached --check

추가 실 API 호출, 실제 외부망 E2E, Vercel 배포는 범위에 없다.
## 최종 검증 결과
- Agent 테스트 124/124, ROAS 테스트 82/82, 교육 데이터 테스트 5/5, Quick Tunnel 테스트 7/7 통과.
- TypeScript 검사 통과, 린트 오류 0건, 기존 경고 2건.
- 웹 빌드, Agent Trace 빌드 통과.
- 정적 파일 정리 회귀 테스트 포함, 자동화 CI에 주요 검사를 유지하고 Quick Tunnel 테스트의 dev/main push 범위 활성화.
- dev 브랜치의 작업물은 Git 스테이징 상태로만 남겨둠. 커밋 및 push, 원격 CI 실행은 하지 않음.
