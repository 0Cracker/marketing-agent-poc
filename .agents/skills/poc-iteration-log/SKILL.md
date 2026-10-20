---
name: poc-iteration-log
description: Update marketing AI PoC iteration logs, decisions, evidence links, and AI lessons when starting an iteration, completing meaningful changes or fixes, making product or technical decisions, discovering reusable AI collaboration lessons, or preparing a release. Skip separate retrospectives for trivial edits.
---

# PoC 개발 과정 기록

저장소 루트를 기준으로 작업한다. [운영 절차](../../../docs/DEVELOPMENT-WORKFLOW.md)와 [AGENTS.md](../../../AGENTS.md)를 따른다. 이 Skill은 문서 갱신 절차이며 백그라운드 감시·Git hook·자동 테스트 실행기가 아니다. 사용자의 이번 작업 범위와 Git 승인 경계를 유지한다.

## 현재 맥락 확인

1. `git status --short --branch`, `git branch -avv`, `git remote -v`, `git tag -n`, `git log -10 --oneline --decorate`, 관련 `git diff`와 미추적 파일을 읽는다. 초기 상태는 [문서 안내](../../../docs/README.md)와 다를 수 있으므로 매번 실제 상태를 우선한다. 기존 미커밋 작업을 자신이 한 변경으로 기록하지 않는다.
2. [Iteration 인덱스](../../../docs/iterations/README.md)와 현재 일지에서 버전·시작 SHA·핵심 목표를 확인한다. 여러 진행 일지가 있거나 버전이 없으면 사용자에게 버전/대상을 확인한다. 확인 전에는 기존 문서에 근거가 명확한 내용만 갱신하거나 미확정 사항을 보고한다. package.json, 문서 제목, 태그 이름만으로 새 버전을 만들지 않는다. 초기 체계 구축 자체로 가짜 버전 일지와 Lesson을 만들지 않는다.
3. 기존 [결정](../../../docs/decisions/README.md), [Lessons](../../../docs/ai-lessons/README.md), [Evidence 규칙](../../../evidence/README.md)을 확인해 중복을 피한다. 현재 실행 계약은 backend/README.md, 자료 특성은 data/README.md와 docs/design/semantic-changes-20261020.md를 읽는다.

## 작업 중 갱신

- 새 사이클: 버전/이전 버전/시작 SHA가 확정되면 [iteration-template.md](assets/iteration-template.md)를 `docs/iterations/실제버전.md`에 복사해 문제·근거·성공 기준부터 채우고 인덱스에 추가한다. 자료가 생긴 Evidence 하위 폴더만 생성한다.
- 중요한 변경/문제 해결: 관련 diff와 실제 검증을 읽어 선택·이유·대안·시행착오를 Develop에, 변경·검증·남은 문제를 Deliver에 기록한다. 단계로 돌아가면 날짜·이유·바뀐 기준을 남긴다. 사소한 수정은 필요할 때 기존 항목에 합친다.
- 결정: 작은 선택은 일지에, 재검토할 중요한 기술·기획 결정은 decisions/README.md 형식으로 기록하고 상호 연결한다. 승인된 사실과 제안은 분리한다.
- AI 교훈: 실제 도구/프롬프트/문제/개선/결과가 있고 재사용 가치가 있을 때만 [lesson-template.md](assets/lesson-template.md)를 사용한다. 기존 Lesson에 추가 근거를 우선 축적한다. 개인 가설을 검증 완료로 올리지 않는다.
- 검증: 명령·환경·대상 SHA/미커밋 상태·종료 코드·실제 결과·한계를 남긴다. 실행되지 않은 테스트·캡처는 미실행으로 적는다. Mock 수식 통과와 실제 성과 입증을 구별한다. 대화 속 사실은 저장소/실행 결과로 확인하거나 사용자 제공 정보라고 출처를 밝혀 적고, 확인되지 않은 과거 과정을 재구성하지 않는다.

## 발행 준비와 종료

운영 절차의 Release 체크리스트를 점검하고 빠진 항목·실패·사용자 확인 사항 및 Release Notes 초안을 보고한다. 문서 정리는 개발 태그 이전에 끝낸다. 태그 이후 수정이 필요하면 발행을 중단하고 사용자가 새 발행 버전을 결정하도록 한다. 기존 태그를 이동하지 않는다.

문서 갱신만으로 커밋·푸시·fetch·브랜치 변경·태그·PR·Squash Merge·Release·dev 재정렬을 실행하지 않는다. 각 실제 상태 변경은 별도 승인된 범위에서만 운영 절차에 따라 수행한다.

마지막으로 상대 링크·파일 존재·YAML frontmatter·인덱스와 버전/상태 일치를 확인한다. 없는 Evidence 링크와 미완성 예시 파일을 만들지 않는다. 수정한 기록, 근거, 미검증/사용자 확인 사항을 간결하게 보고한다. 발행 완료 사실은 원격에서 확인한 뒤 기록하며 인덱스 갱신은 다음 사이클에 포함한다.
