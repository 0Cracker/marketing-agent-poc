# D005 모의 원천·내부 규격·회귀 시험 안내

최신 범위: 실제 데이터 연결·공급자 파일럿·실제 자료 적합성 검증은 사용자 지시로 **프로젝트 범위 밖**이다. 미완료 항목이나 완료 조건에 포함하지 않는다. D005/D006 등 승인된 가상 원천의 구조·업무 의미·계산·사전 적합성을 검증한다.

[D005-2.0.0 승인 범위](../../data-proposal.md#d005-200--30종-신규-자료-생성규격-검증-상세-제안)에 따른 모의 원천이다. 사용자의 후속 응답 ‘실행해’를 승인 근거로 기록했다. 정상 자료는 `source/`의 유형별31개 JSONL·534행이며, 오류 원천 파일은 만들지 않는다. 원천과 메모리 내부 정규화 결과를 중복 집계하지 않는다.

**2026-10-16 사용자 결정: 현재의 공통 사전 중심 구조를 유지하고 D005 문서를 그 역할에 맞춰 정리한다.** D005는 모의 원천·프로필 변환·회귀 시험에 사용한다. 전체 업무 의미의 목표 계약은 [마케팅 공통 사전](../../schemas/marketing-records.schema.json)이며, D005 내부 스키마와 구분한다. [구조 결정](../../common-contract/structure-decision-20261016.md)을 따른다.

## 현재 구조와 용어

처리 흐름은 **D005 원천 → A/B/C 프로필 해독 → D005 내부 정규화 → 명시적 사전 변환·적합 검사 → 질문별 조회·정책·독립 검산**이다. 전역 적합 검사에서 부족한 후보를 검출하면 전체 공통 계약 통과로 내보내지 않는다. 기존 질문별 실행은 승인된 입력과 해당 질문의 검증 범위를 별도로 따르며, 이 흐름 전체의 적합 완료를 뜻하지 않는다.

| 문서·코드의 이름 | 실제 역할 | 통과가 보장하는 범위 |
| --- | --- | --- |
| `source.schema.json` | A/B/C 모의 원천 표현 검사 | D005가 선언한 프로필별 키·자료형·금액 형식 |
| `common.schema.json` | D005 내부 정규화 규격 | D005 유형/하위 유형에 선언한 필드·조건 |
| `contract.mjs`의 `normalize()` | A/B/C를 위 내부 규격으로 해독 | 등록한 필드명·금액·단위 변환 |
| 전역 `marketing-records.schema.json` | 전체 마케팅 공통 사전의 목표 계약 | 공통 출처·시간·품질 구조와 유형별 필수·조건부 계약 |
| `check-d005-dictionary.mjs` | D005 내부 결과와 전역 사전의 차이 검사 | 적용한 명시적 변환과 남은 누락·형식 불일치 |

기존 파일명 `common.schema.json`과 실행기 보고서의 `common`은 보존한다. 여기서 common은 **D005 프로필 간 공통**이라는 뜻이며 전역 사전 적합을 의미하지 않는다. `normalize()`도 전역 계약 변환을 완료하는 함수가 아니다.

## 계층별 검증 결과

| 대상 | 실제 결과 | 근거·한계 |
| --- | --- | --- |
| D005 원천·내부 규격·배치 검산 | 통과 | 정상534행·기존 오류60건·독립 oracle·RDF/SHACL/재조회·회귀 |
| 전역 공통 사전 적합 | 실패 | 대상30종528행 중 전체 적합0행. T01 지원6행은 이 대조 대상 밖 |
| 기존52질문 | 52통과·assertion682개 통과 | D003B·D006 등 승인된 질문별 범위의 결과. D005 전체 사전 적합과 별개 |
| 전체 시스템 | 미완료 | 가상 데이터의 전역 계약 부족, 개별 업무 필드 검토, OOPS 미해결. 실제 공급자 검증은 범위 밖 |

최신 근거는 [통합 실행](../../common-contract/runs/2026-10-16-cq52-decisions-1.json)과 [전역 사전 대조](../../common-contract/runs/2026-10-16-cq52-decisions-1-dictionary.json)다. `provenance`·`temporal`·`quality` 공통 구조 차이가 전 행에 걸치므로528건의 서로 독립된 원천 오류라는 뜻은 아니다. 원천 규격 적합, 질문별 조건 충족, 전체 사전 적합을 구분한다.

| 차이 | 현재 처리 |
| --- | --- |
| T02 별칭 enum·유효기간 이름 | D005 의미 범위에서 명시적으로 변환 |
| T25 제품 참조 → 대상 참조 | 제품 대상에 한정해 변환 |
| T40 예산·모의 승인 상태·단일 KPI 참조 | 의미를 보존해 변환. 실제 집행 승인으로 확대하지 않음 |
| T16 날짜 → 사전의 날짜·시각 | 하루 중 시각이 부족해 보류 |
| T31 유일 클릭 → 유일 클릭자 | 사람 단위 중복 제거 정의 확인 전 보류 |
| T25 측면 참조·분류/추출 버전·집계 기간 | 누락을 표시하며 과거 기준을 소급 생성하지 않음 |

전역 사전 부족은 명시적 변환, 의미 확인, 추가 정보 필요로 나눠 해결한다. D005에 맞춰 사전의 필수 조건을 줄이거나, 문서를 수정한 것만으로 검사 상태를 통과로 바꾸지 않는다.

생성 당시 결과: [최종 cycle](../../common-contract/runs/2026-10-15-d005-cycle-final-verified.json)과 [읽기 전용 validate](../../common-contract/runs/2026-10-15-d005-readonly-validate.json)는 종료0이다. [무결성 검사](../../common-contract/runs/2026-10-15-d005-integrity-final.json)에서 실행 입력61개 hash·원본/Git 보존·기존 배치/보고서 덮어쓰기 거부를 확인했다. 이는 D005 배치 범위의 완료 기록이며 전역 사전 적합 완료를 뜻하지 않는다.

## 실행

저장소 루트에서 실행한다. 보고서 경로는 매번 새 경로를 사용한다.

```powershell
node docs/research/marketing-ontology/batches/D005/run.mjs validate --output docs/research/marketing-ontology/common-contract/runs/d005-new-validation.json
node docs/research/marketing-ontology/batches/D005/run.mjs cycle --output docs/research/marketing-ontology/common-contract/runs/d005-new-cycle.json
node docs/research/marketing-ontology/common-contract/check-d005-dictionary.mjs --output docs/research/marketing-ontology/common-contract/runs/d005-new-dictionary.json
```

`validate`는 기존 원천을 읽고 생성기를 import하거나 호출하지 않는다. `cycle`은 같은 검사에 기존 D004 명세/214행/1,652행 회귀를 연결한다. 필요하면 `--python <실행파일>`·`--tools <기존 ontology-validation-tools 경로>`를 지정한다. `--d004-report <기존 보고서>`는7개 게이트 통과와 입력 hash 전부의 현재 일치를 확인한 D004 회귀만 재사용한다. 재사용 여부와 보고서 hash를 결과에 명시한다.

세 번째 명령은 별도의 전역 사전 검사다. 현재 부족 상태에서는 검사 실행이 정상이어도 적합 결과는fail·종료1이다. 원천을 읽고 메모리 후보와 차이 보고서만 만들며 원천/사전을 변경하지 않는다. 통합 실행기 `run-system-cycle.py`는 이 검사를 `dictionary` 게이트로 연결한다.

`generate`는 승인 문서와 제안 버전을 확인하고5단계를 순차 생성한다. D005 원천/내부 스키마·관계/산술·독립 oracle·메모리 RDF/SHACL/재조회가 통과한 단계만 저장한다. manifest가 존재하면 재생성을 거부한다. 실패 후 남은 부분 파일은 `--resume`으로 같은 바이트인지 대조할 수 있으며 다른 내용으로 덮어쓰지 않는다. `preflight`는 D005 스키마 메타검사·compile만 수행하며 원천을 생성하지 않는다.

종료0은 해당 명령의 선언된 검사 통과,1은 실패,2는 필수 도구/검사 미실행이다. `validate` 자체는 D004를 실행하지 않으므로 D005 검사 통과와 D004 회귀를 구분한다. 배치 검증 완료는 D004까지 연결한 cycle 보고서를 기준으로 판단한다.

## 파일·계산·모델

- `contract.mjs`, `source.schema.json`, `common.schema.json`: D005 유형/하위 유형의 필수·조건부·선택 필드와 프로필별 내부 정규화. 추가 필드·형변환·기본값 보완을 허용하지 않는다.
- `generate.mjs`: 고정 표/순번/BigInt 생성. seed는500520261015이며 난수·LLM 호출이 없다.
- `validate.mjs`: D005 원천/내부 구조, 관계·금액·기간·상태, 유형별 구조/의미 오류30쌍. 각 오류는 정상 자료에서 독립적으로 시작한다.
- `oracle.py`: 생성기/정규화기/투영기의 계산 함수를 import하지 않는 Python Decimal 원천 검산, RDF/SHACL·실제 RDF 재조회. 표본 원천·공통 투영·RDF는 각 단계에서 서로 대조한다.
- `initial-state.json`, `manifest.json`: 기존11원천/통합 스키마/52시험·Git HEAD/refs/index 보존 기준과 신규 파일 행수·SHA-256·환경·코드 버전/hash.
- `generation-code/`: 생성 당시 oracle/runner의 원래 바이트. 생성 뒤 검증 매핑을 보강했으므로 manifest는 당시 코드를, 각 검증 보고서의 `execution_input_sha256`는 실제 실행한 코드를 가리킨다. 생성기·스키마·원천·manifest는 변경하지 않았다.

원천의 T01 지원6행은 기존 제품6개의 공통 식별 자료다. metadata의 GLOBAL은 국가를 추가한 것이 아니며, KR/JP/US 표본의 공통 제품 범위를 표시한다. 실제 사건·금액의 국가/통화는 세 국가별로 분리한다. 원문에서 이미 정한 제품명·브랜드·300ml는 복사하며 원본에 변형 ID를 소급 기입하지 않는다.

미지정 문구는 코드의 고정 한국어 상수로 제한했다. CS는 ‘주문 배송 문의’/‘환불 처리 문의’/‘일반 문의’, 검색어는 샴푸/세정, 문서는 ‘가상 경쟁 제품 P2A 안내입니다.’, 설문은 ‘샴푸 사용감에 만족하십니까?’와 긍정/그 외 척도다. 예측/실험·정책과 표본 주문을 실제 성과·승인으로 표시하지 않는다.

검증 매핑 `D005-2.0.0-validation.1`은 기존 온톨로지를 메모리에서 읽고 Product/Brand/Campaign/Review의 D004 식별 규칙을 재사용한다. 없는 Order/OrderLine/Session 등은 구체적인 클래스로 선언하고 주문행→주문/변형, 주문→거래, 세션→사이트 제약을 검사한다. 후보 별칭6개에는 확정 identity 연결을 만들지 않는다. 원천 file/hash/행/필드→공통 필드→타입이 있는 관계→국가별 금액 계산 결과의 계보와 lexical을 실제 RDF에서 다시 읽는다. RDF 데이터는 파일로 저장하지 않는다.

## 해석 범위

D005 원천/내부 JSON Schema, 전역 사전 적합성, 모의 원천 적합성, 프로그램 의미 계약, 독립 업무 의미 검토, 논리 검사, 질문 지원을 따로 집계한다. 데이터가 있다는 이유로 기존52시험을pass로 바꾸지 않는다. 최신 승인 범위의52시험과 HermiT 정의 검사는 통과했지만, 전역 사전 적합은fail이며 실제 외부 공급자 적합성·AI 답변 평가는 미검증이다. OOPS 외부 재전송은 자동 승인 심사에서 특정 payload/목적지 승인 부족으로 차단된 상태를 유지한다. 시스템 전체는incomplete다.

미국 DST 경계는 D006의 별도 승인·기간 개정으로 검사했으며 D005 배치 자체가 이를 포괄한다고 해석하지 않는다. 모든 행사 방식이나 개별 업무 필드의 검토까지 완료했다고 표시하지 않는다.

실제 결과와 한계는 [검증 사이클](../../common-contract/verification-cycle.md)과 [현재 Iteration](../../../../iterations/v0.2.0.md)에 이어 기록한다.
