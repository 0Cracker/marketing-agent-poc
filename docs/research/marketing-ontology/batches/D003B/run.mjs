// Repository-root command: node docs/research/marketing-ontology/batches/D003B/run.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {writeSchema,schemaVersion,counts} from './schema.mjs';
import {generate,writeSources,seed,generatorVersion} from './generate.mjs';
import {ajvValidator,load,validate,hash} from './validate.mjs';
const here=fileURLToPath(new URL('.',import.meta.url));
const root=path.resolve(here,'../../../../..');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trimEnd();
const baselinePath=path.join(here,'initial-state.json');
const permittedDocs=['docs/research/marketing-ontology/first-batch-proposal.md','docs/research/marketing-ontology/data-proposal.md','docs/research/marketing-ontology/work-log.md','docs/research/marketing-ontology/README.md'];
function repositoryState(){return {head:git('rev-parse','HEAD'),refs:hash(git('show-ref')),index_diff:hash(git('diff','--cached','--binary')),status:git('status','--short'),files:Object.fromEntries([...new Set(git('ls-files','-co','--exclude-standard').split('\n'))].filter(p=>p&&!p.startsWith('docs/research/marketing-ontology/batches/D003B/')).map(p=>[p,fs.existsSync(path.join(root,p))?hash(fs.readFileSync(path.join(root,p))):null]))};}
writeSchema();
// Compilation must succeed before source value generation; missing packages are fatal.
const validators=ajvValidator();
if(!fs.existsSync(baselinePath))fs.writeFileSync(baselinePath,JSON.stringify(repositoryState(),null,2)+'\n');
const initial=JSON.parse(fs.readFileSync(baselinePath,'utf8'));
writeSources(generate());
const data=load();
const checks=validate(data,validators);
try{
 const current=repositoryState();assert.equal(current.head,initial.head);assert.equal(current.refs,initial.refs);assert.equal(current.index_diff,initial.index_diff);
 for(const [p,digest] of Object.entries(initial.files))if(!permittedDocs.includes(p))assert.equal(current.files[p],digest,`existing file changed: ${p}`);
 checks.push({name:'18 기존 파일/삭제·HEAD·refs·staged diff 보존',status:'pass',detail:`초기 파일 ${Object.keys(initial.files).length}개 중 승인/작업 문서 4개만 갱신 허용. Git 이력·인덱스 변경 없음.`});
}catch(e){checks.push({name:'18 기존 상태 보존',status:'fail',detail:e.message});}
const failures=checks.filter(c=>c.status==='fail'),exitCode=failures.length?1:0;
const files=Object.fromEntries(Object.keys(counts).map(t=>[`${t}.jsonl`,{records:data[t].length,sha256:hash(fs.readFileSync(path.join(here,'source',`${t}.jsonl`)))}]));
const tools=Object.fromEntries(['batch.schema.json','schema.mjs','generate.mjs','validate.mjs','run.mjs'].map(p=>[p,hash(fs.readFileSync(path.join(here,p)))]));
const manifest={batch:'D003B',is_synthetic:true,seed,generator_version:generatorVersion,schema_version:schemaVersion,format:'UTF-8 JSONL, LF, final newline',record_total:Object.values(files).reduce((s,r)=>s+r.records,0),files,tool_sha256:tools,environment:{node:process.version,icu:process.versions.icu,tz:process.versions.tz,platform:process.platform},baseline_head:initial.head};
fs.writeFileSync(path.join(here,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const result={batch:'D003B',command:'node docs/research/marketing-ontology/batches/D003B/run.mjs',exit_code:exitCode,checks};
fs.writeFileSync(path.join(here,'validation-results.json'),JSON.stringify(result,null,2)+'\n');
const report=`# D003B 생성·검증 보고서\n\n2026-10-14 사용자 명시 요청에 따른 승인 배치. 기준 HEAD ${initial.head}, 기존 미커밋 트리에서 실행. 생성기/스키마 버전 ${generatorVersion}, seed ${seed}. 환경 Node ${process.version}, ICU ${process.versions.icu}, TZ ${process.versions.tz}.\n\n실제 원천 **${manifest.record_total}건**, JSONL **11종**. ${checks.filter(c=>c.status==='pass').length} 검사 통과, ${failures.length} 실패.\n\n실행 명령: \`${result.command}\`, 종료 코드 **${exitCode}**. 독립 읽기 검사: \`node docs/research/marketing-ontology/batches/D003B/validate.mjs\`. 재생성은 파일 11종 전체의 바이트/해시를 원천과 대조하며 추가 테스트 데이터 파일을 만들지 않는다.\n\n| 원천 | 실제 건수 | 위치 |\n| --- | ---: | --- |\n${Object.entries(files).map(([p,r])=>`| ${p.slice(0,3)} | ${r.records} | [${p}](source/${p}) |`).join('\n')}\n\n| 검사 | 결과 |\n| --- | --- |\n${checks.map(c=>`| ${c.name} | ${c.status} |`).join('\n')}\n\n검사별 상세 수치·분기 증감·주별 비율·잔여분은 [기계 보고서](validation-results.json), 파일별 SHA-256와 도구 버전은 [manifest](manifest.json), 초기 Git/파일 상태는 [보존 기록](initial-state.json)에 있다. 원천 위치는 이 폴더의 source/이다.\n\n## 생성·반올림·검산 방식\n\n[생성 코드](generate.mjs), [검증 코드](validate.mjs), [기계 스키마](batch.schema.json)를 사용한다. 독립 Ajv Draft 2020-12 검증은 저장소에 이미 있는 Ajv8/ajv-formats를 재사용한다. 내부 pnpm 연결의 누락은 기존 catalog 검사처럼 자식 프로세스의 NODE_PATH에만 기존 패키지 경로를 지정한다. 새 설치·전역 변경 없음.\n\nLCG 고정 seed를 매 생성 호출마다 초기화한다. 판매량/실현 단가를 먼저 정한 뒤 시장 분모·자사 환불 산식을 계산한다. 가격/재고를 만들고 회복 로그 수량을 실제 T22에 맞춘다. 광고 일별 자료의 알려진 부분합과 잔여 스칼라로 8월 월값을 구성한다. 누락을 0으로 바꾸지 않고 부분합에서 제외한다.\n\n양수 반올림은 HALF_UP: 개수는 정수, KRW/JPY 단가는 1단위, USD 단가는 0.01단위. 소수 문자열을 정수 센트(BigInt)로 변환한 뒤 수량을 곱한다. KRW/JPY는 .00으로 직렬화한다. 산술 검산 허용 오차는 **0 최소 통화 단위**. 비율 비교의 부동소수 경계 허용 오차만 1e-10이다. 기본 관측 가격은 KRW/JPY 10단위, USD 0.10단위로 선택했으므로 10% 할인도 최소 통화 단위에 정확히 맞는다. 월 실현 단가와 관측 가격은 별도 의미다.\n\n제품/국가별 기준 판매량은 생성 코드의 marketBase/ownBase, 기준 단가는 observationPrice에 정의한다. 월 변화는 판매량 ±15%, 단가 ±5%를 검사한다. 기타 제품 금액은 선정 합계의 2배이며 개별 SKU는 없다. 모든 브랜드의 같은 비교군 기본 가격이 같아 가격대가 겹친다. 실제 가격·사업 성과 추정이 아니다.\n\n8월 잔여분은 정상 캠페인 3일, 일본 소셜 5일에 대해 일당 노출 3,000·클릭 60·전환 2의 스칼라 기여다. 각 날짜 레코드를 만들거나 월값을 일값으로 분해하지 않는다. 남은 금액도 같은 CPC/단가를 곱한다. 주간 CTR/CVR/ROAS는 알려진 행의 분자/분모 합으로 계산하고 누락이 포함된 일본 소셜 마지막 주는 partial로 표시한다. 월 baseline은 별도 확보한 complete 보고이며 detail과 더하지 않는다.\n\n시각은 IANA Intl 데이터베이스로 날짜별 오프셋을 적용하며 검사기는 instant를 현지 시각으로 round-trip한다. 미국 모의 계정은 America/New_York(-04/-05)이며 미국 전체 대표가 아니다. T01은 국가 공통 정의로 Asia/Seoul에서 역사 시작 확보; T12는 국가별 역사 시작 확보. T09 확보는 행사 첫 가격 관측과 함께 시작 5분 후인 현지09:05로 설정했다. 나머지 확보 시각은 승인된 지연 규칙대로 검사한다.\n\n## 연결 방식·분석 한계\n\nT01 product_id로 제품을 식별하고 brand_id로 같은 브랜드를 묶는다. T12 campaign_id와 target_product_id로 캠페인/홍보 제품을 연결한다. 시장·판매·가격·재고·리뷰·행사·변경은 product_id, 광고 성과/수집 요약은 campaign_id로 연결한다. 판매처/위치는 해당 원천의 seller_id/location_id이며 국가·기간·관측 시각으로 제한한다. record_id는 근거 추적 키다. 별도 브랜드/판매처/지표/출처 기준 목록은 생성하지 않았다.\n\n실제 생성 배치만 검사했다. 리뷰 템플릿 6종의 긍정·부정·중립·혼재 문장/측면/별점을 검토하고 실제 72행을 대조한다. 원천에는 감성/측면 정답 주석·인과 라벨이 없다. 4개 리뷰로 시장 전체 불만률이나 전환 감소 원인을 입증할 수 없다. 품절 관측과 광고 저하의 시간적 일치는 검증용 시나리오이며 인과 효과·현업 효과 입증이 아니다. 재고 입출고 거래가 없어 완전한 수불 대사는 불가능하다. 관측 가격/재고 합산, 통화 간 합산, 플랫폼 귀속 합계를 자사 전체 주문/순매출로 표시하는 처리는 지원하지 않는다.\n\nNeo4j 설치/적재·그래프 노드/관계 수·조회 성공·실제 LLM/API/광고 계정·앱 테스트/빌드/화면은 **미실행/미검증**. Git 스테이징·커밋·푸시·태그·이력 변경 없음. 원천 행 수를 그래프 수로 보고하지 않는다.\n`;
fs.writeFileSync(path.join(here,'report.md'),report+'\n별도 프로세스 재실행의 실제 명령/종료 코드·해시 대조·수정한 문제는 [실행 확인 기록](execution-review.md)에 남겼다.\n');
console.log(JSON.stringify({records:manifest.record_total,files:Object.keys(files).length,passed:checks.filter(c=>c.status==='pass').length,failed:failures,exit_code:exitCode},null,2));
process.exitCode=exitCode;
