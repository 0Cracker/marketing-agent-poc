# D007 — 신규 20,000행 확장

현재 상태: **신규 20,000행 생성·검증 pass / 기존 시스템 회귀 pass**. [최종 결과](result.json), [확장 검증](validation-3.json), [기존 7게이트·52시험/682검증](../../common-contract/runs/2026-10-17-d007-post-generation-system-1.json)을 따른다. 사용자의 “승인한다 ㄱㄱ”를 [개별 승인](approval.json)에 기록한 뒤 생성했다. 기존 2,242행과 manifest는 보존한다. [manifest](manifest.json)에 유형별 수량·원천 바이트 hash·생성시각과 기존 입력 hash를 기록했다. 기존 자료의 모든 공통 계약 차이까지 해소했다는 뜻은 아니다.

## 실제 생성 결과

| 항목 | 확인 결과 |
| --- | ---: |
| 신규 JSONL / 레코드 | 40파일 / 20,000행 |
| 기존 포함 공통 조회 | 22,242행 |
| 리뷰 / 서로 다른 본문 | 1,800행 / 1,800종 |
| 제품×국가별 리뷰 | 각 100행 |
| 제품×국가별 가격 관측 | 각 84행 |
| 주문 상품행 / 주문 | 1,200행 / 900건 |
| 고객 코호트 | 144개 |

[분포·조회 결과](distribution-report.json)는 별점 빈도·국가별 평균·가격 범위·CTR/CVR 범위와 조회 시점 검사를 담는다. P1A의 일본/미국 평균 별점은 3.17/3.85, P2A는 4.06/3.50으로 같은 두 제품의 상대 순위도 국가별로 바뀐다. 이는 의도한 가상 표본의 특징이며 실제 시장의 평가가 아니다.

[무결성 검사](integrity-report.json)는 기존 원천/manifest 55파일 보존, 신규 20,000행·40파일 hash, 공통 JSON Schema·OWL·SHACL 파일의 Git 기준 바이트 일치를 확인했다. [최종 정적 검사](static-check-report-2.json)는 새 JavaScript 7파일의 미정의·미사용 식별자 0건이다.

기존 2,242행 중 790행은 공통 명세 후보 뷰에 `contract_gaps`를 반환한다. 원천의 필수 정보 부족과 구버전 구조·단위 매핑 차이를 포함하며, 원래 배치 규격에서 틀린 790행이라는 뜻은 아니다. 빠진 수집 시각·측정 방식·예산 등의 값을 새로 만들어 기존 사실로 채우지 않았다. 신규 20,000행의 공통 명세 적합성과 구분한다.

확장 검증은 공통 스키마·참조·시간·분포 등 12검사, 별도 Python Decimal/ZoneInfo 9검사, 바이트 재현과 기존 입력 보존을 통과했다. RDF 347,113개 관계에서 수치 12,684개를 재조회했고 기존 SHACL과 잘못된 수치 거부를 통과했다. 결측 광고비·귀속 금액의 단위도 money로 유지하며 별점은 score로 구분한다.

## 수량과 생성 규칙

정확한 유형별 수량은 [spec.mjs](spec.mjs)의 `counts`다. T02–T40과 H01의 신규 레코드 합계는 20,000행이다. T01은 기존 6제품·단일 300 ml 변형을 재사용하며 새 상품을 만들지 않는다. 변환본·RDF·지원 정의·계보는 레코드 수에 중복 계산하지 않는다. 주석·집계·예측은 원천 관측과 구분해서 보고한다.

- 범위: 가상 샴푸 3브랜드·6제품, KR/JP/US, 한국어 텍스트, 원천별 통화·시간대. 역사 `[2024-10-01, 2026-10-01)`, 상세 `[2026-08-03, 2026-08-31)`.
- 균형: 가격은 6제품×3국가×3판매처×28일=1,512행, 리뷰는 6제품×3국가×100행=1,800행, 시장은 6제품×3국가×24개월=432행.
- 분포: 층화된 입력 분위수를 제품별 가격·CTR·CVR·성장 성향에 적용한다. 국가 상호작용·계절 변화·일부 품절·수집 공백을 더한다. 샘플 수 균형과 값의 균등분포를 구분한다. 실제 시장 분포를 추정한 것이 아니다.
- 제품별 강점·약점: P1A 가격/건조감, P1B 보습감/가격, P2A 할인/향, P2B 거품/향, P3A 관심/용기, P3B 용기/가격. 국가·시기별 우위 변화와 분포 겹침을 검사한다. 의학적 효능이나 실제 회사 주장을 생성하지 않는다.
- 거래: 자사 2제품만 생성한다. 1,200개 주문 상품행은 900주문에 속한다. 120개 취소·반품·환불, 780개 배송 기록과 120개 유통 집계를 연결한다. 환불은 완료 상태만 순액에서 차감한다. 금액은 통화 최소단위 정수로 생성하고 별도 Python Decimal로 검산한다.
- 리뷰·문의·댓글: 사용 상황·측면·평가·어조·길이를 로컬에서 조합한다. 외부 LLM/API는 사용하지 않는다. 별점과 감성은 독립적으로 배치하고 구매 인증은 null로 보존한다. 중복 제거보다 내용 조합의 다양성과 발췌 일치를 검사한다.
- T25: 2,400개 가상 규칙 주석을 실제 생성 리뷰의 Unicode 발췌 위치에 연결한다. 사람의 검토나 LLM 추출로 표시하지 않는다.
- 광고: 12캠페인×(24개월+28일)=624보고, 336개 일별 부모 보고를 모바일·데스크톱 672행으로 분할한다. 누락은 null로 유지한다. 월별과 일별을 더하지 않는다. 8월 월합계에는 상세구간 밖의 3일 및 미관측분을 구분한다.
- 고객: 상세 주문창 안에서 국가별 48개의 서로 겹치지 않는 주문 코호트를 만들고 표본수·재구매율·순액을 연결된 주문에서 계산한다. CRM은 독립적인 수신자 집계이며 인과 매출로 연결하지 않는다.
- 품질: 수집 시도·실패·부분·재시도는 독립 실행 메타데이터다. 재시도 수를 관측 레코드 수로 세지 않는다. 실험은 양/무/음 효과를 모두 포함하며 유의성이나 실제 인과효과를 보장하지 않는다. 정책은 전부 proposed이며 실제 집행하지 않는다.
- 가용시각: 신규 행과 신규 정의는 실제 생성시각 이후에만 조회할 수 있다. 사건시각·관측기간은 별도 유지하며 새 가정을 과거 정보로 소급하지 않는다.

## 공통 조회와 기존 자료

[catalog.mjs](catalog.mjs)의 `loadCatalog`, `select`, `summarize`가 기존 4배치와 D007을 공통 인터페이스로 제공한다. 옵션은 batch/scenario/scope/type/country/asOf다. 원문은 source, 해독한 값은 payload, 공통 명세 후보는 record로 분리하고 `schema_conforming`과 `contract_gaps`를 반환한다.

기존 D005의 528개 비상품행은 기존 명시 변환과 승인된 보완 파일을 재사용한다. 완성된 공통 명세 뷰는 보완 작성시각부터 가용하다. 과거 원천 값과 원래 가용시각은 source/payload에 그대로 보존한다. 기존 자료에 없는 예산·수집 시작시각 등을 임의 생성해 적합 상태로 바꾸지 않는다. 공통 조회 가능과 모든 과거 원천의 완전한 공통 스키마 적합은 별개다.

`summarize`는 표본·범위·정의·통화·기간·grain·baseline/detail이 다른 자료를 나눠서 반환하며 전체합을 만들지 않는다. 주석과 주문 같은 다른 유형도 합치지 않는다. 지원 정의의 합성 신규 식별자와 기존 제품/변형 식별자는 `definitions.json`으로 추적한다.

```powershell
node docs/research/marketing-ontology/batches/D007/catalog.mjs --batch D007 --type T24 --country JP --field rating_value
```

요약 조회에도 `--scope`·`--scenario`·`--as-of` 필터를 동일하게 적용한다. 잘못된 시각은 거부하고, 신규 생성시각 직전의 조회에서는 D007 값을 반환하지 않는다. [조회 회귀](query-validation.json)는 6개 제품별 리뷰 집합, 72개 독립 검색 집합, 24개 실험군 집합을 분리함을 확인했다. 정규화창·실험군·귀속 설정·별점 척도·정정판·중첩 지표 정의도 합치지 않는다. 앱 UI와 기존 고정 질문의 기본 입력을 새 배치로 교체하지 않았다.

## 실행과 검증

신규 값 생성 전에도 실행할 수 있는 검사:

```powershell
node docs/research/marketing-ontology/batches/D007/check.mjs
node docs/research/marketing-ontology/batches/D007/generate.mjs --plan
```

개별 승인 후 승인 기록은 `source=explicit_human_response`, 실제 사용자 승인 원문, `approved=true`, `new_rows=20000`, 정확한 counts, spec_sha256, preserve_existing/preserve_sample_scopes=true를 담아 고정한다. 승인 원문을 AI가 지어내거나 일반 실행 요청을 별도 승인으로 바꾸지 않는다.

```powershell
node docs/research/marketing-ontology/batches/D007/generate.mjs --approval docs/research/marketing-ontology/batches/D007/approval.json
node docs/research/marketing-ontology/batches/D007/validate.mjs --approval docs/research/marketing-ontology/batches/D007/approval.json --python 'C:/Users/박시형/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' --output docs/research/marketing-ontology/batches/D007/validation-new-run.json
```

생성은 전체 공통 JSON Schema와 관계·분포 검사를 메모리에서 먼저 통과해야 파일을 쓴다. 기존 source 디렉터리가 있으면 덮어쓰기를 거부한다. 검증기는 seed와 생성시각으로 바이트 재현, 기존 입력 해시 보존, 독립 Python 검산, 실제 기존 SHACL과 RDF 재조회, 잘못된 수치 거부를 검사한다. 기존 7게이트 통합 회귀는 별도 실행하고 보고서를 새 이름으로 남긴다. 명세 검사만으로 전체 완료를 선언하지 않는다.

생성 명령은 이미 실행했다. 재검증할 때는 검증 명령만 실행하고 출력 보고서에 새 이름을 사용한다. [첫 검증 시도](validation-1.json)는 300초 제한의 하위 프로세스가 종료코드/독립 보고서를 반환하지 못해 실패했다. [두 번째](validation-2.json)는 결측 금액의 단위 추론 문제를 발견해 중단했다. 원천 값·검사 기준을 보존하고 단위 투영·날짜 전용 유효시점 처리를 수정했으며, [82행 진단](rdf-probe.json)과 [20,000행 최종 검증](validation-3.json)을 통과했다. 시도별 실패·중단·진행 기록을 삭제하지 않았다.

RDF의 범위는 모든 원천·artifact 계보와 수치 관측의 subject/scope/시각·기간/지표 연결이다. 다른 업무 필드의 의미는 공통 스키마와 독립 계산으로 검사한다. 전체 인스턴스의 모든 OWL 의미를 검증했다고 표시하지 않는다.

참고: [SciPy LHS](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.qmc.LatinHypercube.html), [시계열 증강 연구](https://www.ijcai.org/proceedings/2021/0631.pdf). SDV/GAN 학습·외부 모델·실제 데이터 연결은 이번 구현에 포함하지 않는다.
