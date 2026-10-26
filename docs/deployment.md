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
