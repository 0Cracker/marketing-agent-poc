# 두 에이전트 B 흐름

2026-10-19 통합본 안내: 이 worktree에서는 같은 저장소의 `scripts/current-data.mjs`와 `data/manifest.json`을 우선 읽는다. 아래 sibling 설명은 기존 두 worktree 구성도 지원하기 위한 이력이다. 로컬 버전과 재현 명령은 [버전 대응표](../docs/iterations/version-history.md)를 따른다.

2026-10-19 통합 자료 연결: 기본 `scripts/agent-server.mjs`는 sibling `marketing-dashboard-drafts/data/manifest.json`과 업무 유형 JSONL을 검증해 읽는다. `MARKETING_DATA_DIR`로 통합 data/ 경로를 지정할 수 있다. 현재 논리 데이터셋은 `CURRENT`이며 원래 레코드 ID와 scope는 manifest 매핑으로 유지한다. 세션의 자료 해시가 화면과 다르거나 저장 실행의 자료 fingerprint가 바뀌면 만료/보류 처리한다. D007로 바꿔 보내는 데이터 별칭은 사용하지 않는다. 아래 D007 호출 예는 고정 회귀용으로 보존한다.

이 변경은 새 관측·명세·온톨로지를 생성하지 않았다. 오프라인 전체 기간 분석은 기존 최종 사실100개 제한 안에서 선택한다. [109시험·기존 회귀·입력102파일 불변](../docs/design/agent-data-consolidation-20261019-final.json), [통합 판정·328조회·윈도우272화면·재시작 복원](../../marketing-dashboard-drafts/docs/design/data-consolidation-20261019/README.md)을 확인했다. 외부 LLM·실제 Ads는 이번 통합 검증에서 호출하지 않았다.

2026-10-19 실제 모델 연결 추가: `node scripts/agent-server.mjs --live`는 서버 루트 `.env.local`의 번호형 Gemini 키를 읽고, 기본 분석 Flash Lite·예산 Flash를 사용한다. 기본 명령은 기존 오프라인 모드를 유지하며 실제 Ads는 두 모드 모두 비활성이다. [실행·모델 배치·검증 기록](../docs/design/agent-live-20261019.md)을 따른다. 아래 외부 모델 미실측 설명은 최초 오프라인 구현 당시 기록이다.

분석·예산 역할이 허용된 도구를 선택하고, 코드가 범위·자료·수치·근거·승인·집행 경계를 통제한다. [설계와 TDD 기록](../docs/design/agent-tdd-20261018.md), [상세 시험 목록](../docs/design/agent-test-cases-20261018.md)을 따른다.

## 실행

저장소 루트에서 현재 제공된 Node 24.19.0을 사용한다. 새 패키지는 필요 없다. `node:sqlite`가 있는 런타임이어야 한다.

```powershell
node --test --test-concurrency=1 tests/agents/*.test.mjs
node scripts/agent-demo.mjs
node scripts/agent-server.mjs
node scripts/check-agent-tdd.mjs --output evidence/v0.2.0/agents-tdd/new-result.json
```

결과 파일은 새 이름만 허용한다. 데모는 로컬 모델 대역이 실제 조회·계산 도구를 호출하는 절차 검증이다. 질문을 이해하는 외부 LLM의 실측 결과가 아니다. 기존 원천과 공통 명세를 변경하지 않는다. 현행 비교의 baseline은 선택한 기존 **가상 예산 시나리오**이며 실제 광고 계정의 현행 설정이 아니다.

## 파일별 책임

| 파일 | 책임 |
| --- | --- |
| `agent-tools.mjs` | 기존 공통 카탈로그의 적합 자료만 조회. 기간/asOf·국가·제품 검증, 관측/관계/원문 조회, 정확한 가상 예산 계산 |
| `agent-flow.mjs` | 역할별 허용 도구 루프, 출력 검증, 후속 분석/인계, SQLite 저장, 승인·수정·모의 제출·대사 |
| `agent-model.mjs` | Gemini/Groq의 JSON 행동 응답을 공통 프로토콜로 읽는 선택적 연결부 |
| `agent-http.mjs` | 로컬 전용 HTTP 연결, 요청·출처 검증, 서버 측 가상 승인자, 공개 응답 제한 |
| `local-planner.mjs` | 오프라인 절차 데모용 모델 대역. 답·숫자·시험 ID를 갖지 않으며 반환된 실제 근거 ID를 사용 |

온톨로지는 기존 `ontology.ttl`의 관계 이름과 의미를 사용하는 **조회 시점의 타입 있는 투영**이다. 새 RDF DB·추론기를 설치하지 않았다. `promotes`, `subject`, `variantOf`, `evidenceSpan`, `sourceRecord`, `artifact`를 구분한다. 가격 감성 주석의 지지/반대 분류는 분석용 해석으로 표시하고 온톨로지에 확정 인과 관계로 쓰지 않는다. 조회 결과의 온톨로지 해시와 업무 코드·자료 해시가 바뀌면 오래된 승인으로 집행할 수 없다.

## 호출 예

```javascript
import {loadCatalog} from '../docs/research/marketing-ontology/batches/D007/catalog.mjs';
import {CatalogTools} from './agent-tools.mjs';
import {AgentFlow,FlowStore} from './agent-flow.mjs';
import {localPlanner} from './local-planner.mjs';

const flow=new AgentFlow({tools:new CatalogTools(loadCatalog()),model:localPlanner,
  store:new FlowStore(':memory:')});
// scope는 배치·국가·표본·제품 ID·반개방 기간·asOf를 명시한 요청이다.
// await flow.analyze({question,scope});
// await flow.analyze({question,parentId:analysis.id,focus:'price'});
// await flow.budget({analysisId:analysis.id,analysisVersion:analysis.version,userSelected:true});
flow.close();
```

승인 대기를 재시작 뒤 유지하려면 `:memory:` 대신 작업용 SQLite 파일 경로를 지정한다. `get`, `resume`, `cancel`, `approve`, `reject`, `revise`, `submit`, `reconcile`은 같은 서버 객체의 메서드다. 서버는 기본 `127.0.0.1:8788`에서 오프라인으로 실행하며 `--live`로 실제 모델을 선택한다. 기본 저장소는 모드별 `work/agent-flow.sqlite`와 `work/agent-flow-live.sqlite`이며 검증에는 `AGENT_DB_PATH`로 독립 DB를 지정할 수 있다. 현재 자료는 sibling의 CURRENT manifest를 읽는다. [최신 전체 흐름 검증](../docs/design/current-live-20261019.md)을 따른다. HTTP로 모델·키를 선택하거나 실제 Ads를 제출할 수 없다. 가상 승인자는 서버가 지정하는 로컬 운영자이며 다중 사용자 로그인·권한 서버는 구현하지 않았다.

`submit`/`reconcile`은 `mode:'synthetic'` 어댑터만 허용한다. 실제 매체 어댑터는 존재하지 않는다. 어댑터는 `preflight(proposal)`, `submit(proposal,{idempotencyKey})`, `status(proposal)`을 제공한다. 타임아웃은 `execution_unknown`이며 재제출 대신 대사한다. 복원된 `submitting` 상태도 재제출하지 않는다. 외부 반영의 정확히 한 번 실행을 보장한다고 주장하지 않는다.

## 외부 모델 경계

`createRemoteModel`은 공급자·모델 ID·키와 `allowDataTransmission:true`를 명시해야 만들 수 있다. 초기 네트워크 대역 검사에 이어 실제 Gemini 모델의 CURRENT 대표 흐름도 검증했다. 원천 텍스트는 신뢰할 수 없는 자료로 전달하고 도구·범위·출력 관문은 서버가 다시 검사한다. API 키는 헤더에만 사용하고 실행 기록에 저장하지 않는다. 429·타임아웃은 저장 후 재개 가능 상태이며 자동 유료 전환·다른 공급자 재전송은 없다. `createLiveRuntime`의 선택적 `onDiagnostic`은 검증용 HTTP 상태·사용량 등의 메타데이터만 받는다.

연결부는 공급자 고유 함수 호출 대신 JSON 행동 봉투를 사용한다. LLM이 `{tool,args}` 또는 `{finish}`를 선택하고 서버가 실제 도구를 실행한다. 입력 스키마와 최종 사실/가설/모의 결과 계약은 공급자와 분리한다. 검증된 대표 흐름을 넘는 질문·모델 품질과 공급자의 잔여 한도를 보장하지 않는다. [Gemini generateContent](https://ai.google.dev/api/generate-content), [Groq 구조화 출력](https://console.groq.com/docs/structured-outputs)을 기준으로 작성했다.

초기에는 단일 프로세스 로컬 업무 흐름을 지원한다. SQLite CAS로 승인·제출 경합을 막지만 분산 워커 lease·자동 장애 인계·다중 사용자 권한 서버를 구현했다고 보지 않는다. 모델 대기 중 프로세스가 종료된 실행은 작업자가 기존 실행 ID로 재개하며 호출 예산은 리셋되지 않는다.
