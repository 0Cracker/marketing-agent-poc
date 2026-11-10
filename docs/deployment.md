# Vercel 화면 + 로컬 AI 서버

본인 PC에서 Vercel 화면을 열고 같은 PC의 AI 서버를 호출하는 구성이다. 다른 방문자는 운영자의 PC에 연결되지 않는다. PC와 서버가 켜져 있어야 한다. API 키와 SQLite 실행 기록은 PC에만 둔다.

## Vercel 프로젝트

GitHub `0Cracker/marketing-agent-poc`를 Import한다. 저장소 자체가 앱 루트이므로 Root Directory는 `.`이다. 로컬 상위 폴더 이름인 `Marketing/marketing-agent-poc`를 입력하지 않는다.

`vercel.json`이 Vite 빌드, npm 설치, `dist` 출력과 `/workbench` 새로고침 경로를 설정한다. Node.js는 24.x로 선택한다.

Production 브랜치는 `main`, Preview 대상은 `dev`로 둔다. 같은 프로젝트에서 main의 Production 주소와 dev의 고정 브랜치 Preview 주소를 별도로 사용한다. 배포별 임시 주소를 로컬 서버 허용 목록에 무작정 추가하지 않는다.

Environment Variables에 다음 공개 설정을 Production과 Preview 모두 추가한 뒤 재배포한다. 이 값은 브라우저 번들에 들어간다. 모델 API 키는 Vercel에 입력하지 않는다.

```text
VITE_AGENT_API_URL=http://127.0.0.1:8788/agent-api
```

## 로컬 AI 서버

ROAS 교육 대시보드의 AI 대화도 같은 서버를 사용한다. 업데이트된 `scripts/agent-server.mjs`를 다시 실행하면 `/agent-api/roas/chat`이 열리며, 별도 키나 온톨로지 설정은 필요하지 않다. `--live`는 실제 모델 답변, 생략하면 연결 확인용 집계를 제공한다. [ROAS 데이터 연결](design/roas-training-dashboard.md#16-roas-에이전트-대화와-데이터-연결-2026-10-27)을 참고한다.

프로젝트 폴더의 PowerShell에서 실제 발급된 두 주소를 사용한다. 아래 예시는 실제 배포 주소가 아니다. Origin에는 경로와 끝의 `/`를 넣지 않는다.

```powershell
$env:AGENT_UI_ORIGINS='https://YOUR-PRODUCTION.vercel.app,https://YOUR-DEV-BRANCH.vercel.app,http://127.0.0.1:5173'
npm run start:agents -- --live
```

기존 `.env.local`의 모델 키를 사용한다. 모델 호출 없이 연결만 확인하려면 `--live`를 빼면 된다. 서버는 계속 `127.0.0.1`에만 바인딩된다. 외부 사이트는 정확한 Origin 허용 목록과 세션 토큰 검사로 제한한다.

브라우저에서 실제 배포 주소의 `/workbench`를 열고 로컬 네트워크 접근 권한을 허용한다. 브라우저·관리 정책에 따라 차단될 수 있다. 이 경우 사이트 권한을 확인하거나 로컬 Vite 화면을 사용한다. 보안 기능 전체 해제는 필요하지 않다.

## 검증 범위와 남은 설정

HTTP 자동 테스트는 허용 Origin의 사전 요청·실제 분석, 다른 Origin 차단, 잘못된 헤더·메서드, 토큰 누락을 확인한다. 실제 Vercel 배포와 브라우저 권한을 포함한 연결은 별도 확인이 필요하다. 현재 작업 세션에는 Vercel 도구가 노출되지 않았고 브라우저 사용이 Work 설정에서 비활성화되어 있어 배포 URL을 아직 발급·검증하지 못했다.

참고: [Vercel Git 배포](https://vercel.com/docs/git), [Vite 설정](https://vercel.com/docs/frameworks/frontend/vite), [Chrome 로컬 네트워크 권한](https://developer.chrome.com/blog/local-network-access?hl=ko).

## 2026-10-26 dev 배포 확인

dev e23511c78d44c57f168e45364c3371bcc5391e28의 GitHub Vercel 상태가 success, Deployment has completed임을 확인했다. [해당 배포](https://vercel.com/cracker5/marketing-agent-poc/95GhBLWRxNqJ3XPTe92hJHYRQosv). 위의 URL 미발급 설명은 초기 검증 당시 상태다. 이후 dev 패치 커밋을 push하고 새 커밋의 Vercel 상태를 확인한다.


## 2026-11-10 Cloudflare Quick Tunnel 연결 QA (배포 전)

이번 QA는 기존 Agent와 분리한 127.0.0.1:18788 고정 응답 서버만 외부에 연결한다. 구현은 scripts/qa/quick-tunnel-smoke-server.mjs 및 api/qa/quick-tunnel.mjs에 있다. 브랜치는 qa/quick-tunnel-smoke-20261110이며, 실제 터널 개설 및 배포는 별도 승인 후 진행한다.

### 로컬 검증

1. 별도 QA Worktree에서 다음 테스트를 실행한다.

       node --test tests/qa/quick-tunnel-smoke.test.mjs

   자동 테스트는 외부 접속 없이 200/401/404, Preview 차단, 목적지 검증, 리디렉션 차단, 503, 서버 중지와 재시작 복원을 모의 검증한다.
2. 다음 명령을 두 번 실행해 서로 다른 32바이트 난수 토큰을 생성한다. 실제 토큰을 Git, 문서, 공개 로그 또는 브라우저 번들에 저장하지 않는다.

       node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"

3. PowerShell의 QUICK_TUNNEL_SERVER_TOKEN 환경변수에 서버 간 토큰을 넣고 테스트 서버를 기동한다. 토큰이 없거나 32자 미만이면 시작하지 않는다.

       $env:QUICK_TUNNEL_SERVER_TOKEN = '<SERVER_TOKEN>'
       node scripts/qa/quick-tunnel-smoke-server.mjs

4. 다른 PowerShell 터미널에서 아래 요청을 검증한다. 정상 인증은 200과 고정 응답, 누락 인증은 401, 다른 경로는 404여야 한다.

       curl.exe -i http://127.0.0.1:18788/health
       curl.exe -i -H "x-qa-server-token: <SERVER_TOKEN>" http://127.0.0.1:18788/health
       curl.exe -i -H "x-qa-server-token: <SERVER_TOKEN>" http://127.0.0.1:18788/agent-api/roas/chat

5. [Cloudflare 설치 문서](https://developers.cloudflare.com/tunnel/downloads/)로 cloudflared를 설치한 후 아래 명령을 실행한다.

       cloudflared tunnel --url http://127.0.0.1:18788

Quick Tunnel은 테스트용이다. 임시 URL을 아는 누구나 요청할 수 있으므로 서버 간 토큰 검사를 반드시 유지한다. 실제 Agent 포트로 터널을 열지 않는다.

### Vercel Preview 설정

기존 Vercel 프로젝트 Settings, Environment Variables에서 환경은 **Preview**, Git Branch는 **qa/quick-tunnel-smoke-20261110 전용**으로 선택하고 다음 값을 등록한다. VITE_ 접두사는 사용하지 않는다.

| 환경변수 | 값 |
| --- | --- |
| QUICK_TUNNEL_ORIGIN | https://<임시-서브도메인>.trycloudflare.com (경로 제외) |
| QUICK_TUNNEL_CALLER_TOKEN | 호출자용 임시 토큰 |
| QUICK_TUNNEL_SERVER_TOKEN | 로컬 서버와 동일한 서버 간 토큰 |

Vercel의 System Environment Variables 노출을 확인한다. 함수는 VERCEL_ENV=preview 및 VERCEL_GIT_COMMIT_REF=qa/quick-tunnel-smoke-20261110을 동시에 검사하고, Production과 다른 브랜치에서는 404를 반환한다. QA 브랜치 푸시, Preview 배포는 승인 후 진행한다. 환경변수 갱신 후에는 반드시 새 Preview 배포가 필요하다.

다음 호출로 검증한다. 토큰 누락 또는 오입력은 401이며 터널로 요청하지 않는다. 정상 호출만 200과 고정 JSON을 반환한다. 업스트림 401/404, 잘못된 응답, 연결 중단, 리디렉션 또는 5초 타임아웃은 모두 503으로 처리한다.

    curl.exe -i -H "x-qa-caller-token: <CALLER_TOKEN>" https://<QA-PREVIEW>/api/qa/quick-tunnel

함수는 HTTPS 단일 서브도메인 (*.trycloudflare.com)의 /health만 요청한다. 요청자가 목적지나 경로를 변경할 수 없다. Vercel Deployment Protection이 활성화된 경우 함수 호출 전 추가 인증이 필요할 수 있으므로 프로젝트 전체의 보호 설정을 해제하지 않고 허용된 QA 인증 방식으로 검증한다.

### 실연결 합격 기준과 종료

- Preview에서 올바른 호출자 토큰은 200, 누락 및 잘못된 토큰은 401
- Quick Tunnel 직접 접근에서 서버 간 토큰 누락 및 오류는 401
- Quick Tunnel에서 기존 Agent, 세션, Trace 경로는 404
- 서버 중지 중 Preview는 503, 같은 포트 재시작 후 동일한 터널 주소로 200

터널을 재시작하면 새 URL로 QUICK_TUNNEL_ORIGIN을 변경하고 Preview를 재배포한다. 로컬 서버만 같은 포트로 재시작하면 기존 터널 URL을 유지할 수 있다. 검증이 끝나면 cloudflared와 테스트 서버를 종료하고, 해당 Preview 배포와 브랜치 한정 환경변수를 삭제한다. 결과 기록에는 상태코드와 실제 검증 여부만 남기고 **토큰과 임시 주소는 기록하지 않는다**.


### 2026-11-10 로컬 실행 검증 기록

- 기준: qa/quick-tunnel-smoke-20261110, dev 시작 SHA f2cb8e95f9f70805efc8babf37316db5b1a4058a, Windows Node v26.13.0, 미커밋 QA Worktree
- node --test tests/qa/quick-tunnel-smoke.test.mjs: 7/7 성공. 인증/브랜치 차단, HTTPS 호스트 제한, 리디렉션과 실패 응답, 서버 중단 및 동일 포트 재시작 모의 포함
- 별도 127.0.0.1:18788 직접 실행: GET /health 인증 시 200, 누락 시 401, GET /trace는 404. 테스트 직후 서버 종료
- npm ci --include=dev --include=optional: 성공, 설치 스크립트 허용 관련 경고 존재
- npm run lint: 종료코드 0, 기존 docs/research/marketing-ontology/batches/D005의 미사용 변수 경고 2건, 신규 QA 파일 오류 없음
- npm run build: 종료코드 0, 기존 CSS 폰트 해석 및 번들 크기 경고
- npm test: 기존 ROAS 회귀 73/73 성공
- 미실행: cloudflared 설치, Quick Tunnel 실개설, 브랜치 푸시, Vercel Preview 배포, Preview에서 터널을 거친 실연결, QA Preview와 환경변수 정리. 위 항목은 실행 승인 이후 확인 필요
- 실제 임시 토큰과 터널 주소는 생성하거나 보관하지 않았으며, 기존 Agent/SQLite/모델 키는 사용하지 않았다.

### 2026-11-10 QA 실연결 진행 기록 (후속)

- 승인 후 QA 브랜치에 로컬 검증 완료 구현을 커밋하고 GitHub로 푸시했다. 초기 QA 커밋은 a42e49c이며 main, dev는 변경하지 않았다.
- Windows에 Cloudflare cloudflared 2026.10.7을 설치하고 기존 Agent와 분리한 localhost:18788 서버에 Quick Tunnel을 개설했다.
- 발급된 HTTPS trycloudflare.com 임시 주소에서 직접 검증했다. 서버 간 토큰 누락 시 401, 정상 토큰 시 200, Trace 경로 접근 시 404.
- 테스트 서버를 중지하자 Quick Tunnel 직접 요청은 502를 반환했다. 같은 포트로 서버만 다시 기동한 후 같은 터널 주소에서 200으로 복구됐다. **Vercel API의 503 응답 검증과는 다른 테스트이다.**
- GitHub의 Vercel 배포 상태가 success로 확인되어 QA 브랜치 Preview 빌드 완료가 확인됐다.
- Vercel CLI는 로컬 계정이 로그인되어 있지 않아 브랜치 한정 3개 환경변수 등록 및 Preview API 실왕복 검증은 아직 미완료다. Vercel 계정 연결 이후 진행해야 한다.
- 보안상 토큰 및 Quick Tunnel 임시 URL은 Git, 배포 문서에 기록하지 않았다. 현재 로컬 테스트 서버와 Quick Tunnel은 다음 연결 단계까지 실행 중이며 완료 후 종료 및 QA 환경변수 정리가 필요하다.
