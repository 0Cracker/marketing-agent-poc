# dev 패치 검증, 2026-10-27

시작: dev `8029ac7d2788e62367f569c8f2ec38f1d3225366`. 기존 미커밋 ROAS 대화, UX와 카드 수정 전체를 보존하고 사용자 요청으로 두 목적의 개발 커밋으로 나눈다. Windows PowerShell, 설치된 Node.js와 기존 의존성을 사용했다. 원천 레코드와 데이터 스키마를 추가하거나 수정하지 않았다.

## v0.4.2, 조회 API와 답변 계약

- `node --test --test-concurrency=1 tests/agents/*.test.mjs`: 종료 0, 140개 통과. [실행 로그](agents.log).
- `node --experimental-strip-types --test tests/agent-client.test.ts`: 종료 0, 10개 통과. [실행 로그](client.log).

클라이언트 검사는 전체 프런트 검사에도 포함되므로 서로 합산하지 않는다. API는 기존 Origin과 토큰 검증, 데이터 해시, 조회 범위와 근거 ID 경계를 검사한다. 테스트는 실제 외부 모델을 호출하지 않았다. 이번 커밋에는 UI 변경을 포함하지 않는다.

버전은 package.json과 package-lock.json의 루트 두 곳을 함께 갱신했다. main 병합, 태그와 Release는 수행하지 않는다. 원격 반영과 배포 결과는 확인 후 후속 버전 기록에 남긴다.
