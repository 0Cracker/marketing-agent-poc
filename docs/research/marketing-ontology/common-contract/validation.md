# 명세 검사 실행 기록

2026-10-14 (Asia/Seoul). 대상은 `dev`, HEAD `fb74fed8e2a34ca46f3d6026c3f52630b79057b7`의 기존 미커밋 트리에 추가한 MC-1.0.0 명세다. 앱 발행 버전은 미확정이다. 기존 작업/삭제를 유지했고 원격 상태를 변경하지 않았다.

## 실제 검사 결과

| 명령·검사 | 종료 코드·결과 | 정확한 대상·한계 |
| --- | --- | --- |
| `python check-spec.py --tools <검증 전용 패키지 경로>` | 0, **10 통과·0 실패·4 묶음 미실행** | [기계 결과](validation-results.json). 11유형·163필드 전수 대응, 18지표, 13×4시험, 30질문 상태,214ID 제안/547관측 산술, 3원천 계약·참조·링크 |
| RDFLib 7.6.0 Turtle parser | 통과 | ontology275 triples / shapes558 triples, OWL클래스22·NodeShape21. 마케팅 인스턴스0 |
| pySHACL 0.40.1·W3C SHACL-SHACL 메타검사 | 통과 | `shapes.ttl` 자체가 data graph, 도구의 `assets/shacl-shacl.ttl`이 shapes graph. 마케팅 데이터 그래프 통과가 아님 |
| RDFLib SHACL-SPARQL parser | 통과 | 제약 SELECT4개 구문파싱. 마케팅 데이터에서 제약 실행0 |
| 선언된 subclass 순환/disjoint ancestor 검사 | 통과 | 제한된 구조검사만. OWL DL 일관성/클래스 충족가능성을 증명하지 않음 |
| `node check-json-schemas.mjs` | 0, 통과 | Ajv8.20.0 Draft2020-12: D003B batch와40유형/H01 schema메타검사·compile/format. 데이터 instance 검사 미실행 |
| `node ../schemas/check-catalog.mjs` (저장소루트 상대경로로 실행) | 0, 통과 | 40유형·857속성등장·44소스·시간정책24개월/28일·H01별도·메타스키마/compile. 레코드 생성0 |
| 원본/해시·HEAD/refs/staged 보존 | 결과는 [보존 기록](preservation-results.json) | 읽기 전용 바이트 hash 대조; 의미상 재사용·분석·행변환은 없음 |
| `git diff --check` | 0, 통과 | 기존 tracked diff와 문서변경의 공백검사, untracked명세는 별도링크/파싱검사 |

실행 환경: Windows, Python3.12.14, Nodev24.19.0, RDFLib7.6.0, pySHACL0.40.1, owlrl7.6.2(설치만, 추론기 실행 아님). 검증패키지는 저장소 밖 `C:/Users/박시형/Desktop/Marketing/ontology-validation-tools`에만 설치했다. package.json/lockfile·전역Python·Node의존성은 변경하지 않았다. 재실행은 저장소 루트에서 다음 명령을 쓴다.

```powershell
& 'C:\Users\박시형\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' docs\research\marketing-ontology\common-contract\check-spec.py --tools 'C:\Users\박시형\Desktop\Marketing\ontology-validation-tools'
node docs\research\marketing-ontology\common-contract\check-json-schemas.mjs
node docs\research\marketing-ontology\schemas\check-catalog.mjs
```

검사 코드는 명세만 읽는다. 기존 원천 파일의 hash는 보존 확인에서만 바이트로 읽었고 source/*.jsonl의 행/값을 파싱·선택·복제하거나 분석에 재사용하지 않았다. 선택ID 존재/목적·547관측의 실제 계수는 승인 후 검증한다.

## 실패·수정 이력

첫 명세 작성 검사에서 T03 `coverage_text` 대응 누락을 발견해 AssertionError·종료1이었다. 원천 수치나 행을 수정하지 않고 필드 매핑을 추가했다. 첫 Python 검사 보고 출력은 cp949가 `Protégé` 문자를 표현하지 못해 UnicodeEncodeError·종료1이었다. stdout UTF-8로 수정한 뒤 현재10개검사를 통과했다.

첫 격리패키지 설치는 sandbox DNS에서 pypi.org 해석이 실패해 종료1이었다. 자동검토로 허용된 네트워크 설치 재시도는 종료0으로 RDFLib/pySHACL을 설치했다. 실패를 검증 통과로 기록하지 않는다. 패키지 설치 승인과 데이터 작업 승인은 별개다.

구현 검토에서 CollectionRun은 PROV Activity이므로 AnalysisResult.input의 range를 Entity로 강제하면 잘못된 타입 추론이 생길 수 있음을 확인했다. range를Resource로 넓히고 실제 허용대상을 의미계약에 명시했다. 광고지표는 패밀리IRI와 원천·귀속·버전이 확정된 실제정의IRI를 구분했다. 이는 데이터 변경이 아니라명세 보완이다.

## 미실행·완료 수준

- Protégé/HermiT: 미설치, Java가 PATH에서 확인되지 않음. 실제 OWL DL 일관성·충족불가능 클래스0 판정은 미실행. 도구 버전을 발명하지 않는다.
- OOPS!: 공식소개만 확인, 자동스캔/외부명세제출 미실행. OntoClean 관점은 수동 의미검토만 수행했다.
- **52개 질문의 데이터 기반 시험 모두 미실행.** 가상자료 재사용·변환·오류주입·적재 승인 없음. 명세10pass를 질문답변/모의기술검증 완료로 승격하지 않는다.
- 검색/소셜/자사판매 실제원천샘플·권한·추적·현업평가 미검증. DB선정/연결·LLM·앱시험·Git발행 미실행.

현재 완료는 설계 산출물 작성과 위 명세 검사다. 정식 논리 검사와 모의 기술 검증은 남아 있다. 다음 데이터 작업은 [214행 제안서](validation-proposal.md)의 구체적 범위를 별도로 승인받아야 한다.
