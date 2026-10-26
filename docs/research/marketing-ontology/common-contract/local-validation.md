# 로컬 OOPS·공통 데이터 명세 검증

OOPS는 로컬 Java 도구로 설치하고 기존 Python 실행기에서 호출한다. 모델 검사에는 외부 REST 경로나 자동 원격 대체가 없다. 원천 자료·리뷰·인스턴스는 OOPS에 전달하지 않는다. 도구 설치만으로 모델 적합이나 시스템 전체 완료를 선언하지 않는다.

## 설치와 무결성

공식 저장소 `oeg-upm/OOPS`의 커밋 `11572ea6b31cba29dd3f8a443e24311652f059de`를 사용한다. JDK 17.0.20.1+1과 Maven 3.9.11을 `.tools/ontology-validation/logic/oops` 아래에 격리한다. 시스템 PATH·Java 전역 설정은 변경하지 않는다.

`setup-oops-local.py`는 명시적으로 실행하는 설치 명령이다. 공식 소스·JDK·Maven 아카이브 체크섬을 검증하고 Maven 의존성을 로컬 캐시에 준비한다. 원천·모델을 읽지 않는다. 설치 다운로드에는 네트워크가 필요하며 모델 검사와 분리한다. Apache-2.0 원본 고지·의존성 라이선스는 도구 폴더에 보존한다.

확인한 업스트림 문제와 최소 수정은 [패치 기록](oops-local-fixes.json)에 고정했다. P06은 순회 중 목록에 조상을 추가해 발생하는 `ConcurrentModificationException`을 인덱스 순회로 수정한다. 검사 조건을 바꾸거나 P06을 제외하지 않는다. 시험 비교기는 생성 UUID의 동일 참조를 유지하고 anyURI 리터럴/리소스 직렬화 차이를 정규화한다. P32 설명문 기대값은 고정 소스의 실제 설명과 맞춘다. 원본·중간 실패 보고서는 도구 폴더에 보존한다.

설치 잠금 파일은 소스 커밋·아카이브 체크섬·런타임 클래스·의존성·JDK·어댑터·수정 기록의 SHA-256을 담는다. 실행 전 잠금과 실제 파일을 대조하며 wildcard classpath의 추가 파일도 거부한다. 수정 후에는 설치기를 명시적으로 다시 실행해야 한다.

## 오프라인 검사 범위

Java 어댑터는 모델을 읽기 전에 SocketPermission·연결·수신을 차단하는 Java 17 전용 SecurityManager를 설치하고 실제 Socket 생성 거부를 확인한다. 외부 imports는 자동 로드하지 않으며 해결하지 않은 imports가 있으면 실패한다. 이 차단은 도구 프로세스에만 적용한다.

고정된 33개 검사기의 목록·중복·누락을 확인한다. P36~P40은 공개 URL/배포 검사를 요구하므로 비공개 로컬 모델 범위에서는 비적용으로 기록한다. P41은 모델 내용을 외부 Licensius로 전송하므로 실행하지 않는다. 라이선스 선언 존재 여부는 별도 로컬 메타데이터 검사로 보고하며 외부 P41을 실행했다고 표시하지 않는다. 나머지 27개 규칙의 예외·경고·예상하지 않은 네트워크 시도는 정상 통과가 아니다.

도구 오프라인 시험 프로필도 공식 공개 fixture를 재사용하고 P36~P41을 제외한다. 이는 38개 원본 시험 전체 통과와 구분한다. OOPS 발견 사항은 코드·중요도·대상 URI로 안정적인 fingerprint를 만들고 판정한다. JVM 종료 0만으로 통과시키지 않는다.

설치 검증 결과는 회귀 시험 32개와 유틸리티 시험 1개, **총 33개 통과**다. 원본 38개 중 9개 실패 기록은 삭제하지 않았다. 잠금 파일의 `offline_test_profile`은 32개 회귀 시험을 가리키며 유틸리티 시험 수와 구분한다.

## 실행

저장소 루트에서 실행한다. 각 `--output`에는 **존재하지 않는 새 파일명**을 사용한다.

```powershell
$ontologyPython = 'C:\Users\박시형\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'

# 최초 설치 / 소스·어댑터 변경 후 재설치. 모델은 읽지 않는다.
& $ontologyPython docs/research/marketing-ontology/common-contract/setup-oops-local.py --tools .tools/ontology-validation

# 빠른 사전 변환·독립 검산·메모리 RDF 재조회
node docs/research/marketing-ontology/common-contract/check-d005-dictionary.mjs --python $ontologyPython --tools .tools/ontology-validation --output docs/research/marketing-ontology/common-contract/runs/dictionary-new-run.json

# 모델 정의만 로컬 HermiT·OOPS 실행
& $ontologyPython docs/research/marketing-ontology/common-contract/check-logic.py --tools .tools/ontology-validation --oops-local --output docs/research/marketing-ontology/common-contract/runs/logic-new-run.json

# D004·D005·사전·모델·52시험 전체 검증
& $ontologyPython docs/research/marketing-ontology/common-contract/run-system-cycle.py --tools .tools/ontology-validation --question-approval-record docs/research/marketing-ontology/common-contract/question-approval-20261015.json --additional-approval-record docs/research/marketing-ontology/common-contract/d006-approval-20261016.json --oops-local --output docs/research/marketing-ontology/common-contract/runs/system-new-run.json
```

`--oops-artifact-lock`으로 별도 설치 잠금 파일을 지정할 수 있다. `--oops-local`을 생략하면 OOPS는 미실행이며 전체 완료로 판정하지 않는다. 과거 `--oops`/`--oops-approval-record` 외부 전송 옵션은 지원하지 않는다.

## 원천 변환과 후속 승인 — 위임 이전 이력

이 절의 미승인·미생성 설명은 당시 상태다. 현재는 아래 ‘공통 데이터 명세 완성 위임’ 절과 별도 위임·보완·검토 기록을 적용한다. 과거 승인 자체를 소급 변경하지 않았다.

`d005-canonical.mjs`는 D005 A/B/C 해독 다음 단계의 명시적 변환만 담당한다. 원천·manifest·스키마·원래 52시험은 유지한다. 공통 provenance/temporal/quality, 반개방 기간, 이름/배열 차이, 원천·부모에 근거한 참조를 변환한다. 목적 필드별 계보와 변환하지 못한 원천 필드를 보고서에 남긴다. 원천 `value_origin`도 별도 보존하며 가상 주석을 사람 검토·LLM 추출로 표시하지 않는다.

별도 Python 검산기는 원천을 독립 해독하고 변환 입력과 대조한다. 적합한 레코드만 메모리 RDF에 투영해 모든 필드 값과 타입이 있는 관계를 재조회한다. 이 단계의 SHACL은 전송·재조회 구조 검사이며 기존 D005의 업무 도메인 SHACL 회귀를 대체하지 않는다. RDF는 영구 저장하지 않는다.

30종의 335개 개별 필드와 공통 정의 10개를 보고서에 전수 표시한다. 변환 근거·원천 미제공·해석 미확정·스키마 차이를 구분한다. 생성형 필드 목록의 기존 검토 상태를 일괄 완료 처리하지 않는다. 실행 보고서와 별도 보완/확인 기록을 보존하므로 기존 `field-semantics.json` 재생성으로 확인 기록이 사라지지 않는다.

[잔여 보완안](canonical-followup-20261016.md)은 **미승인 제안**이다. `--supplement`와 `--supplement-approval-record`는 함께 지정해야 하며 명시 승인·보완 바이트 hash·입력 hash·행수·필드 수가 일치해야 로드한다. 보완 파일은 누락 필드만 채우며 기존 값·식별자·출처·시각 메타데이터를 덮어쓰지 못한다. 이번 실행에서는 보완 파일을 생성하거나 적용하지 않았다.

`--field-review-record`는 현 스키마·매핑 hash와 335/10개 필드 검토, 미해결 의미 쟁점 0건을 명시 확인한 기록이다. 이 확인이 없으면 스키마 적합 528행이 되더라도 전체 업무 의미 게이트는 미완료다. `--oops-review-record`는 현 모델·엔진·모든 지적 fingerprint와 일치하고, 명시 승인·비적용 이유·대체 검증 보고서 hash가 있어야만 예외를 반영한다. 현재 [OOPS 검토표](oops-review-20261016.json)는 승인된 예외 기록이 아니다.

전체 실행기는 필수 게이트 누락·실패·미실행·사전/의미/OOPS 미완료를 구분한다. 통과 0, 실패 1, 미실행 2를 반환하며 필수 조건을 모두 충족할 때만 `system_validation=complete`로 기록한다. 실제 공급자 적합성은 범위 밖이다.

## 위임 이전 구현 검증 — 2026-10-16

[최종 통합 회귀](runs/2026-10-16-canonical-system-2.json)는 52시험·682개 assertion, D004·D005 회귀와 HermiT를 통과했다. 실행 중 입력 변경은 0건이며 Git HEAD·refs·index를 보존했다. 사전은 198/528행 스키마 적합이며 업무 의미 확인까지 완료됐다는 뜻은 아니다. 330행·63그룹의 부족과 OOPS 106개 지적으로 전체 판정은 `fail / incomplete`다.

독립 [사전 재실행](runs/2026-10-16-canonical-repeat-1.json)은 최종 통합의 사전 보고서와 모든 값·상태·계보가 일치했다. [모델 재실행](runs/2026-10-16-oops-local-repeat-1.json)의 OOPS 결과도 최종 통합 결과와 완전히 같았다. 27개 적용 규칙 실행, 6개 근거 있는 비적용, 외부 통신 시도 0건을 확인했다. 지적을 승인된 예외로 바꾸지는 않았다.

## 공통 데이터 명세 완성 위임을 포함한 전체 실행

원천·manifest와 과거 실행 보고서는 그대로 보존한다. 별도 `completion-values.json`은 원천 정보 파생·정의 확정·가상 가정을 구분하며 `completion-values-authorization.json`이 사용자 위임과 파일 hash를 연결한다. 모든 보완 필드는 보완 작성시각부터 가용하며 원래 사건·확보시각은 별도로 유지한다. 과거 시점용 소비자는 `completion-review.mjs`의 `availableCompletion(fields, metadata, asOf)`로 가용 필드만 선택해야 한다. 기존 질문 실행에는 새 보완값을 혼입하지 않는다.

```powershell
$ontologyPython = 'C:\Users\박시형\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $ontologyPython docs/research/marketing-ontology/common-contract/run-system-cycle.py --tools .tools/ontology-validation --completion --output docs/research/marketing-ontology/common-contract/runs/completion-new-run.json
```

`--completion`은 보완·위임 검토·OOPS 검토·기존 질문 승인 경로와 로컬 모델 검사를 함께 설정한다. CLI에 명시한 개별 경로는 유지한다. 현재 실행기는 기존 질문 protocol, 보완 protocol, D004, D005, 공통 데이터 명세, 모델, 질문의7게이트를 요구한다. 보완 protocol은345개 필드 inventory·불완전/위조 검토 거부·가용시각 직전/정각을 포함한다.

새 검토는 `delegated_ai_review`이며 `human_confirmed=false`다. 사람의 개별 필드 검토나 과거 주석의 사람 검토 완료를 뜻하지 않는다. OOPS 원시 지적과 근거 있는 비적용 후 미해결 수는 별도로 기록한다. 비적용은 현재 모델·엔진·정확한 지적·대체 검사의 내용과 현 입력 hash가 맞아야 적용된다. 과거 승인 원문과 실행 보고서를 새 용어·HEAD로 소급 수정하지 않는다.

[실제 통합 실행](runs/2026-10-16-completion-system-2.json)은 7개 게이트 `pass`, 시스템 `complete`다. 명세 528/528행·335+10필드 위임 검토·816설정 독립 검산, 기존 52/682·D004·D005·HermiT를 통과했고 실행 중 입력·현재 Git 변경은 0건이다. OOPS는 27개 적용 규칙 실행·6개 프로필 비적용, 원시 지적 106개·개별 근거 비적용 106개·미해결 0개·외부 통신 시도 0건이다. 적용 규칙의 오류나 누락을 통과로 바꾸지 않는다.

공통 데이터 명세만 확인하려면 기존 `check-d005-dictionary.mjs`에 `--supplement completion-values.json`, `--supplement-approval-record completion-values-authorization.json`, `--field-review-record completion-field-review.json`과 Python·tools·새 output 경로를 전달한다. 경로는 실행 디렉터리 기준이다. 모델만 확인하려면 위 모델 명령에 `--oops-review-record`와 실제 `completion-oops-review.json` 경로를 전달한다. 기존 output은 덮어쓸 수 없으며 매번 새 이름을 사용한다.

[명세 반복 실행](runs/2026-10-16-completion-repeat-1.json)은 값·상태·계보·RDF hash가 같았다. 명령에서 상대경로와 절대경로를 다르게 전달한 메타데이터만 경로 정규화 후 비교한다. [모델 반복 실행](runs/2026-10-16-completion-logic-repeat-1.json)은 HermiT와 OOPS 결과가 각각 같았다. 모델·엔진·근거 입력을 수정하면 기존 비적용 기록은 그대로 재사용할 수 없으며 검사와 근거 검토를 다시 실행해야 한다.

커밋 `3ee92a9`의 [전체 재실행](runs/2026-10-16-completion-system-3.json)도7게이트 pass·시스템 complete다. [명세 재실행2](runs/2026-10-16-completion-repeat-2.json)는 이번에는 경로 정규화 없이 전체 보고서가 같다. OOPS 결과도 같고 HermiT는 상위 클래스 출력의 줄 순서만 달라 추론 집합과 상태를 비교했다. 원시 출력은 보존한다.

검토 기록의 위조·누락 거부는 다음처럼 재검사한다. 이 명령은 실제 스캔 결과를 재생하는 protocol 시험이며 Java 스캔 자체는 위 전체/모델 명령으로 실행한다.

```powershell
& $ontologyPython docs/research/marketing-ontology/common-contract/check-model-review-protocol.py --tools .tools/ontology-validation --scan-report docs/research/marketing-ontology/common-contract/runs/2026-10-16-completion-system-3-logic.json --output docs/research/marketing-ontology/common-contract/runs/model-review-protocol-new.json
```
