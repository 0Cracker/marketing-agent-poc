# 마케팅 AI PoC 개발 및 기록 운영

## 목적과 초기 구축 기록

현재 작업 위치·버전은 [문서 안내](README.md)와 실제 Git 상태를 따른다. 아래 원격·dev·태그 없음 설명은 초기 구축 당시 기록이다.

성과와 과정을 함께 남긴다. main에는 검증된 버전별 결과를, 개발 태그에는 세부 커밋을, Iteration에는 문제 해결 과정을, AI Lessons에는 반복해서 검증한 협업 원칙을 축적한다. 기능의 수보다 문제 정의·분석 신뢰성·결과 전달력을 우선한다.

초기 점검 (이전 파일 `REPOSITORY-BASELINE.md`, 현재 미보존) 기준 main 커밋 1개, 원격·dev·태그 없음, 기존 미커밋 작업 있음, 발행 버전 미확정이다. 이번 구축은 파일 작성만 수행한다. 기존 커밋을 정리하거나 최초 버전을 임의 발행하지 않는다. 아래 절차는 원격·개발 브랜치·발행 버전이 확정된 이후의 운영 가이드다.

## 더블 다이아몬드

| 단계 | 실제 작업 | 기록 시점 |
| --- | --- | --- |
| Discover · 확산 | 이전 버전·사용자 피드백·테스트를 보고 문제와 가능성 탐색 | 문제/근거를 발견할 때 |
| Define · 수렴 | 원인과 가설 구분, 핵심 문제·우선순위·성공 기준 결정 | 문제와 평가 기준을 정할 때 |
| Develop · 확산 | 대안 비교, AI 활용, 구현·실패·재시도 | 대안 검토와 구현 중 |
| Deliver · 수렴 | 동일 조건의 전후 비교, 수치·Mock·UX 검증, 남은 문제 확인 | 실제 검증 직후 |

선형 단계로 강제하지 않는다. 검증에서 정의로 되돌아가면 날짜·근거·변경 이유를 남긴다. 회고를 끝에 한꺼번에 재구성하지 않는다. 관측된 사실, 계산 결과, 원인 가설, 모의 효과, 미실행 검증을 구별한다.

## 최소 기록 구조

- [iterations/README.md](iterations/README.md): 버전·목표·상태·시작 SHA·일지·태그 인덱스. 실제 사이클만 등록한다.
- [Iteration 템플릿](../.agents/skills/poc-iteration-log/assets/iteration-template.md): `docs/iterations/실제버전.md` 생성에 사용한다.
- [decisions/README.md](decisions/README.md): 재검토할 중요한 기술·기획 선택과 대안·이유. 작은 선택은 일지에 통합한다.
- [ai-lessons/README.md](ai-lessons/README.md) 및 [Lesson 템플릿](../.agents/skills/poc-iteration-log/assets/lesson-template.md): 주제별 교훈·검증 상태·반복 근거. 같은 교훈은 기존 문서에 축적한다.
- [evidence/README.md](../evidence/README.md): 버전별 before/after/validation. 일지에서 `../../evidence/실제버전/...`로 실제 파일을 연결한다.
- [AGENTS.md](../AGENTS.md) 및 [poc-iteration-log](../.agents/skills/poc-iteration-log/SKILL.md): 중요한 작업의 기록 지침과 실행 절차.

자료마다 입력·시나리오·기간·환경·기준 SHA 또는 미커밋 상태를 남긴다. 전후 조건이 다르면 비교 한계를 적는다. 큰 로그·임시 산출물·민감한 정보는 제외한다. 가짜 버전·교훈·Evidence는 만들지 않는다. 검증된 AI 경험과 개인 가설을 구분하고 원칙의 적용 범위를 기록한다.

## 브랜치와 태그

| 대상 | 역할 | 갱신 조건 |
| --- | --- | --- |
| main | 정식 검증 버전 | 한 사이클당 dev → main PR의 Squash Commit 하나 |
| dev | 개발·실험과 세부 커밋 | 의미 있는 작업 단위로 커밋, 다음 사이클 시작 시 main 기준 재정렬 |
| dev-vX.Y.Z | 마지막 개발 커밋과 그 조상 이력 | Squash 전에 Annotated Tag 생성·원격 보존 확인 |
| vX.Y.Z | main의 해당 Squash Commit | 병합 및 main 검증 후 Annotated Tag·GitHub Release |

한 버전의 모든 수정과 기록은 개발 태그 전에 dev에 포함한다. 태그 이후 수정이 필요하면 발행을 중단하고 새 버전명을 결정한다. 이미 만든 태그는 이동·삭제·덮어쓰지 않는다. 개발 이력 태그는 정식 태그와 SHA가 달라도 파일 트리가 같아야 한다. 다음 dev는 이전 main에서 시작하므로 세부 커밋 범위는 **해당 사이클 시작 SHA .. 개발 태그**로 조회한다. 이전 개발 태그를 다음 사이클의 조상이라고 가정하지 않는다.

main의 기존 커밋은 보존하며 이 규칙은 앞으로 완료되는 버전에 적용한다. 직접 main 개발·불필요한 rebase·merge commit을 피한다. 개인 프로젝트에 추가 상시 브랜치·외부 자동화·브랜치 보호 설정 변경을 도입하지 않는다.

## 커밋과 PR 작성 규칙

- 개발 커밋 제목: `유형: 변경 내용`. 유형은 `feat`, `fix`, `docs`, `test`, `refactor`, `chore`를 사용하고 변경 내용은 한국어로 구체적으로 쓴다. 예: `fix: 결측 시 예산 계산 차단`.
- 한 커밋에는 설명 가능한 작업 단위 하나를 담는다. 본문은 필요할 때만 문제·변경 이유·실제 검증 결과와 미검증 사항을 적는다.
- 버전 발행 PR: `dev → main`, 제목은 `vX.Y.Z: 핵심 개선 내용`. 본문은 문제/목표·주요 변경·검증/Evidence·남은 문제·Iteration/개발 태그 링크를 간결하게 적는다.
- 정식 Squash Commit 제목은 PR 제목과 동일하게 쓴다. 본문에는 주요 변경·검증·개발 태그를 요약하고, 상세 과정은 Iteration 문서로 연결한다. 버전당 main 커밋 하나를 유지한다.

## 승인과 명령 실행 규칙

아래 코드 블록은 복사해 일괄 실행할 스크립트가 아니다. 저장소 루트의 PowerShell에서 **한 명령씩 결과와 종료 코드를 확인**하며 진행한다. 실패·빈 SHA·예상과 다른 상태이면 다음 변경 명령을 실행하지 않는다. `${LASTEXITCODE}`가 0인지 확인한다. `git diff --exit-code`는 차이가 있으면 1이므로 중단한다.

스테이징·커밋·push·fetch·브랜치 생성/전환/재정렬·태그·PR 생성/병합·Release 등 상태 변경은 대상과 영향이 명확한 사용자 별도 승인 후 실행한다. 문서 작성이나 발행 준비 요청은 실행 승인이 아니다. 원격 조회(`ls-remote`, GitHub 읽기)는 읽기 작업이다. 승인된 범위를 이미 받은 경우 같은 승인을 반복해서 요구하지 않는다.

main 강제 푸시 금지, 기존 태그 재사용 금지, `reset --hard` 기본 사용 금지. dev 재정렬 중 예기치 않은 상태가 나오면 멈춘다. `--force` 대신 정확한 이전 원격 SHA를 지정한 `--force-with-lease`를 사용한다. [Git 공식 문서](https://git-scm.com/docs/git-push)에 설명된 lease는 원격 ref가 기대 SHA일 때만 갱신한다.

## 초기 연결과 첫 사이클 (구축 당시 절차)

1. 실제 GitHub 저장소 URL, 원격의 기존 main/dev·태그·PR·Release 이력, 첫 사이클 버전과 기존 변경의 소유/범위를 확인한다. 원격이 없다는 로컬 사실만으로 새 원격이 비어 있다고 가정하지 않는다.
2. 원격 연결 승인을 받은 뒤 `git remote add origin '확인된-저장소-URL'`. `git ls-remote origin`으로 확인하고 승인된 fetch 이후 이력 차이를 검토한다. 기존 원격 이력과 다르면 초기 push를 중단하고 보존 방안을 정한다.
3. 기존 미커밋 작업을 dev로 가져갈지 별도 보관할지 사용자와 확정한다. 임의 stash/삭제 금지. 승인 후 현재 HEAD에서 `git switch -c dev`로 시작할 수 있으나 작업 보존 여부를 전후 확인한다. 원격 dev가 이미 있으면 이 명령을 사용하지 않고 기존 브랜치를 확인한다.
4. 실제 버전과 시작 SHA를 일지에 적는다. 의미 있는 파일만 명시적으로 `git add '검토한-파일-경로'`, staged diff를 검토하고 승인된 커밋을 만든다. 전체 `git add .`로 기존 작업을 섞지 않는다. 초기 main/dev push도 별도 승인된 범위에서만 수행한다.

최초 발행 전에는 기존 main이 검증된 안정 버전이라고 부르지 않는다. 패키지의 0.1.0은 발행 근거가 아니며 이번에 변경하지 않는다.

## Release 체크리스트

### 1. 개발 및 검증

- [ ] Define의 문제·목표·성공 기준과 Deliver 결과가 대응한다.
- [ ] CTI 및 지표의 산식·가중치·분모·단위·결측·리뷰/매체 합계·Mock 연대기 정합성을 검산했다.
- [ ] 근거와 해석의 타당성, 관측/계산/가설/모의 효과 구분을 검토했다.
- [ ] 정보 구조·마케터 이해 가능성·실제 의사결정 연결·시나리오별 UX/UI를 확인했다.
- [ ] 실제 수행한 테스트·타입 검사·빌드와 환경/결과를 기록했다. 미실행·실패·남은 문제는 공개했다.
- [ ] 동일 입력의 before/after 비교를 확인하거나 불가능한 이유를 적었다.

### 2. 문서 정리와 후보 확정

- [ ] Iteration·Evidence·Lessons·중요 결정·인덱스·상대 경로를 확인했다.
- [ ] 사용자 확인이 필요한 기획·성공 기준을 확정했다. 민감 정보·대용량/임시 파일을 제외했다.
- [ ] 모든 후보 변경을 승인된 dev 커밋에 포함했다. dirty/untracked 작업·미완료 커밋을 남기지 않았다.
- [ ] 버전·이전 main/시작 SHA·후보 dev SHA·태그 이름을 확인했고 로컬/원격에 같은 태그가 없다.

### 3. 개발 이력 보존

- [ ] dev-vX.Y.Z가 Annotated Tag이며 후보 dev SHA를 가리킨다.
- [ ] 원격 태그 object SHA 및 peeled commit SHA가 로컬과 같다.
- [ ] origin/dev도 후보 SHA다. 이후 후보 변경이 없으며 PR은 정확히 그 head를 사용한다.

### 4. 정식 반영

- [ ] dev → main PR을 Squash로 병합했고 PR의 merged/head/base/squash SHA를 실제 조회했다.
- [ ] 해당 main 커밋은 이전 main을 부모로 갖는 단일 Squash Commit이다.
- [ ] main과 개발 태그의 파일 트리가 같고 main 대상 검증이 통과했다.
- [ ] 정식 Annotated Tag를 해당 Squash SHA에 생성·푸시했고 원격 object/commit SHA를 확인했다.
- [ ] 이미 존재하는 태그를 사용한 GitHub Release를 발행하고 링크·내용을 조회했다.

### 5. 다음 사이클 준비

- [ ] 두 태그가 원격에 보존되고 정식 Release가 해당 태그와 연결되어 있다.
- [ ] dev 및 origin/dev가 보존된 개발 SHA이며 추가 커밋·변경·다른 worktree의 dev 사용이 없다.
- [ ] 승인된 dev 재정렬 및 명시적 lease push 이후 dev·origin/dev가 최신 main과 같다.
- [ ] 다음 실제 버전·핵심 문제·시작 SHA를 확정하고 새로운 일지를 시작한다.

## 실제 발행 명령 순서

현재 gh는 PATH에서 확인되지 않았다. 아래 gh 명령은 GitHub CLI 설치/로그인과 원격 연결을 확인한 환경용이다. 필요하면 GitHub UI에서 같은 값을 확인하고 같은 순서로 수행한다. 개발 콘텐츠 생성 스크립트는 검증 명령에 포함하지 않는다.

### A. 후보 검증 및 문서 완료

```powershell
git status --short --branch
git branch -avv
git remote -v
git log --oneline --decorate -10
git diff
git diff --cached
git ls-files --others --exclude-standard
git worktree list
node --experimental-strip-types tests/marketing.test.ts
node --experimental-strip-types tests/demo.test.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/vite/bin/vite.js build
```

빌드 산출물은 기존 ignore 규칙을 따른다. UI는 `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173`으로 실행해 시나리오와 화면을 수동 확인한다. 실행하지 못한 항목을 통과로 처리하지 않는다. 검사 결과·Evidence·일지를 정리하고 명시적 파일 스테이징·커밋 승인을 받아 **태그 전에** 모두 dev에 포함한다. 그 뒤 테스트 결과가 확정 커밋에도 유효한지 확인하고 clean 상태를 요구한다.

### B. 개발 후보 고정과 태그 보존

버전은 사용자가 확정한 실제 값으로 입력한다. main/dev의 원격 추적 상태를 확인하고 승인된 fetch로 최신화한다. 이전 main SHA는 일지의 사이클 시작 SHA와 같아야 한다. main이 이미 달라졌다면 새 변경을 검토·재검증하고 후보를 다시 확정한다.

```powershell
$pocVersion = Read-Host '확정 버전(vX.Y.Z)'
if ($pocVersion -notmatch '^v[0-9]+\.[0-9]+\.[0-9]+$') { throw '버전 형식 확인' }
$pocDevTag = "dev-$pocVersion"
git fetch origin
git status --porcelain=v1
$pocBaseSha = git rev-parse origin/main
$pocDevSha = git rev-parse dev
git merge-base --is-ancestor $pocBaseSha $pocDevSha
git log --oneline "$pocBaseSha..$pocDevSha"
git tag --list $pocVersion $pocDevTag
git ls-remote --tags origin "refs/tags/$pocVersion" "refs/tags/$pocDevTag"
```

dev 체크아웃·clean·사이클 시작 SHA 일치·예상한 커밋 범위를 확인한다. 위 태그 조회에서 하나라도 있으면 중단한다. 승인된 push/tag를 한 명령씩 수행한다.

```powershell
git push origin dev:refs/heads/dev
git ls-remote origin refs/heads/dev
git tag -a $pocDevTag $pocDevSha -m "$pocVersion 개발 과정"
git push origin "refs/tags/$pocDevTag"
git cat-file -t "refs/tags/$pocDevTag"
git rev-parse "refs/tags/$pocDevTag"
git rev-parse "$pocDevTag^{}"
git ls-remote --tags origin "refs/tags/$pocDevTag" "refs/tags/$pocDevTag^{}"
```

cat-file 결과는 `tag`, 원격 dev는 후보 SHA, 태그의 로컬/원격 object와 peeled SHA는 각각 일치해야 한다. 개발 태그가 생긴 뒤에는 dev를 더 변경하지 않는다. push 실패 시 태그를 옮기거나 재생성하지 말고 조회 후 같은 태그 push만 재시도한다.

### C. PR 생성·Squash Merge

구현·검증·미완료 항목·일지·개발 태그가 담긴 PR 본문을 실제 임시 파일에 저장한 뒤 경로를 입력한다. 원격 main이 여전히 `$pocBaseSha`, dev/head가 `$pocDevSha`인지 다시 읽어 확인한다. 자동 병합이나 dev 삭제를 사용하지 않는다.

```powershell
$pocPrBody = Read-Host '작성한 PR 본문 파일 경로'
gh pr create --base main --head dev --title "$pocVersion 마케팅 AI PoC 개선" --body-file $pocPrBody
$pocPrNumber = Read-Host '방금 생성된 PR 번호'
gh pr view $pocPrNumber --json state,baseRefName,headRefName,headRefOid,mergeable,url
gh pr merge $pocPrNumber --squash --match-head-commit $pocDevSha
gh pr view $pocPrNumber --json state,mergedAt,mergeCommit,headRefOid,baseRefName,url
```

[GitHub CLI 공식 문서](https://cli.github.com/manual/gh_pr_merge)에 따른 head 일치 옵션을 사용한다. 명령이 성공 반환해도 merge queue·대기 상태일 수 있으므로 `MERGED`와 실제 squash SHA를 확인한 후 다음 단계로 간다. 이력/정책 때문에 merge commit이 생기면 정식 태그를 만들지 않고 중단한다. 병합 후 검증 실패 시 태그/Release/dev 재정렬을 중단하고 승인된 복구 계획을 마련한다.

### D. main 검증·정식 태그·Release

PR에서 얻은 mergeCommit.oid를 실제로 확인하고 입력한다. fetch/전환/pull도 승인된 범위에서만 수행한다. dirty 상태면 전환하지 않는다.

```powershell
$pocSquashSha = Read-Host '확인한 PR Squash SHA'
git fetch origin
git status --porcelain=v1
git switch main
git pull --ff-only origin main
git rev-parse HEAD
git show --no-patch --format='%H %P %s' $pocSquashSha
git rev-list --count "$pocBaseSha..$pocSquashSha"
git diff --exit-code $pocDevTag $pocSquashSha
node --experimental-strip-types tests/marketing.test.ts
node --experimental-strip-types tests/demo.test.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/vite/bin/vite.js build
git status --porcelain=v1
```

HEAD 및 origin/main이 Squash SHA인지, 부모가 이전 main SHA 하나인지, 범위 커밋 수가 1인지 확인한다. 파일 트리 차이 0·main 검증 통과·clean이 필수다. 다른 main 변경이 들어왔다면 멈춰 검토한다. 승인 후:

```powershell
git tag --list $pocVersion
git ls-remote --tags origin "refs/tags/$pocVersion"
git tag -a $pocVersion $pocSquashSha -m "$pocVersion 검증된 PoC"
git push origin "refs/tags/$pocVersion"
git cat-file -t "refs/tags/$pocVersion"
git rev-parse "refs/tags/$pocVersion"
git rev-parse "$pocVersion^{}"
git ls-remote --tags origin "refs/tags/$pocVersion" "refs/tags/$pocVersion^{}"
$pocReleaseNotes = Read-Host '검토한 Release Notes 파일 경로'
gh release create $pocVersion --verify-tag --title $pocVersion --notes-file $pocReleaseNotes
gh release view $pocVersion --json tagName,isDraft,url,body
```

태그가 이미 있으면 새로 생성하지 않는다. 재시도는 기존 태그의 object/commit SHA와 발행 상태를 확인하고 필요한 단계만 진행한다. [Release 공식 문서](https://cli.github.com/manual/gh_release_create)의 `--verify-tag`로 원격 태그 존재를 요구한다.

Release Notes에는 버전·핵심 목표, 이전 문제, 주요 변경, 실제 검증 결과/환경, 남은 문제·다음 과제, Iteration·Evidence·개발 태그·두 commit SHA·PR 링크를 간결하게 적는다. GitHub 저장소 URL은 확정한 실제 URL만 사용한다. 일지는 `/blob/정식태그/docs/iterations/실제버전.md`, Evidence는 `/tree/정식태그/evidence/실제버전`, 개발 태그는 `/tree/개발태그` 형태로 **존재를 확인한 자료만** 링크한다. 최종 발행 사실 기록 때문에 tagged tree를 다시 수정하지 않는다.

### E. dev 재정렬과 다음 사이클

두 Annotated Tag의 원격 object/peeled SHA를 위 방법으로 다시 확인한다. Release·PR을 조회하고 개발 태그가 실제 개발 SHA를 보존하는지 확인한다. dev가 개발 태그 이후 진행됐다면 재정렬하지 않는다. 원격 dev의 SHA도 개발 SHA와 같아야 한다. 명시적 lease 값은 재정렬 **전에** 원격 조회에서 직접 고정한다.

```powershell
git status --porcelain=v1
git worktree list
git rev-parse dev
git rev-parse "$pocDevTag^{}"
git log --oneline "$pocDevTag..dev"
$pocRemoteDevLine = @(git ls-remote origin refs/heads/dev)
if ($pocRemoteDevLine.Count -ne 1) { throw '원격 dev 확인 실패' }
$pocExpectedRemoteDev = ($pocRemoteDevLine[0] -split '\s+')[0]
if ($pocExpectedRemoteDev -ne $pocDevSha) { throw '보존한 개발 SHA와 원격 dev 불일치' }
git ls-remote origin refs/heads/main
git rev-parse main
```

main 체크아웃·전체 worktree clean·다른 worktree가 dev를 사용하지 않음·미완료 커밋 없음·main 원격 일치를 확인한다. 최신 main은 정식 태그 커밋이거나, 이후 추가된 검증 완료 버전으로 별도 확인돼야 한다. 승인 후 **main에서** dev 참조만 변경한다.

```powershell
git branch -f dev main
git push "--force-with-lease=refs/heads/dev:$pocExpectedRemoteDev" origin dev:refs/heads/dev
git ls-remote origin refs/heads/dev
git rev-parse dev
git rev-parse main
git switch dev
git status --short --branch
```

lease 실패 시 강제로 재시도하지 않는다. 로컬 dev는 이미 이동됐을 수 있으므로 원격과 개발 태그를 읽어 차이를 검토한다. 태그가 상세 이력을 계속 보존한다. 새 버전의 문제·목표·시작 SHA를 확정하고 Iteration 템플릿을 사용한다. 이전 발행 완료 인덱스/링크 갱신도 이 새 dev 사이클에서 커밋한다.

## 이전 버전·상세 이력 조회 및 복원

읽기 조회는 작업 트리를 변경하지 않는다. 아래 태그는 실제 존재하는 것으로 입력한다.

```powershell
$pocInspectVersion = Read-Host '조회할 실제 정식 태그'
$pocInspectDevTag = "dev-$pocInspectVersion"
git show --no-patch $pocInspectVersion
git show --no-patch $pocInspectDevTag
git log --graph --oneline --decorate $pocInspectDevTag
$pocIterationPath = "docs/iterations/$pocInspectVersion.md"
git show "${pocInspectVersion}:$pocIterationPath"
$pocStartSha = Read-Host '해당 일지의 사이클 시작 SHA'
git log --reverse --oneline "$pocStartSha..$pocInspectDevTag"
git diff --stat $pocStartSha $pocInspectDevTag
git diff --exit-code $pocInspectDevTag $pocInspectVersion
```

새 checkout에서 개발 태그가 없다면 원격 존재를 확인하고 승인된 `git fetch origin "refs/tags/${pocInspectDevTag}:refs/tags/$pocInspectDevTag"`로 가져온다. force 옵션은 쓰지 않는다.

과거 결과 실행은 현재 작업 디렉터리를 덮어쓰지 않고, 사용자 승인 후 비어 있는 별도 경로에 `git worktree add --detach '사용자가-확정한-새-경로' $pocInspectVersion`를 사용한다. 상세 개발 상태는 개발 태그를 같은 방식으로 checkout한다. 두 상시 브랜치는 유지하고 detached worktree는 임시 검증 용도로만 쓴다. 과거 의존성/설치 환경과 실제 데이터 조건을 확인하고 설치·실행 결과를 별도로 기록한다.

현재 코드에 과거 변경을 되살리는 작업은 조회와 구분한다. 승인 후 dev의 새 사이클에서 필요한 변경만 적용·검증하고 새 버전으로 발행한다. main/태그를 과거로 이동시키지 않는다. 개발 태그 없이 reflog만 장기 보존 수단으로 삼지 않는다.

## Skill 실행과 자동화 한계

저장소 루트에서 Codex 작업을 시작한다. `$poc-iteration-log 이번 변경의 근거와 실제 검증 결과를 현재 일지에 반영해줘`로 명시 호출할 수 있다. 버전 시작에는 실제 버전·이전 버전·목표를 제공한다. 자동 선택되지 않으면 `.agents/skills/poc-iteration-log/SKILL.md`를 직접 읽어 적용하도록 요청한다. 새 Skill이 보이지 않으면 Codex를 다시 시작해 확인한다. 저장소 Skill 경로·frontmatter·자동/명시 선택은 [공식 Skill 문서](https://learn.chatgpt.com/docs/build-skills)를 따른다.

AGENTS.md가 중요한 작업 완료 시 Skill 적용을 요구하며, 적용된 Codex가 diff·검증·선택 이유·실제 Evidence를 바탕으로 관련 일지/인덱스를 갱신한다. 별도 데몬·매 커밋 hook·자동 발행은 없다. 사용자의 승인 없이 Git 상태를 변경하지 않는다.

사람은 실제 버전·핵심 문제·성공 기준, 원인 해석의 타당성, 마케터 이해와 UX, 촬영 조건, 미검증 가설, 원격 보존/PR·Release 결과, 발행 및 재정렬 승인을 확인한다. Skill 호출이 테스트 실행·화면 캡처·실제 효과 검증을 보장하지 않는다.
