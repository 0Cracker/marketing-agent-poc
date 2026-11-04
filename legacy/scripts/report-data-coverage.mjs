import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {loadCurrentData} from './current-data.mjs';

const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}/.test(value)?value.slice(0,10):null;
const previous=value=>new Date(Date.parse(date(value)+'T00:00:00Z')-86400000).toISOString().slice(0,10);
const kindNames={fulfilment:'배송 약속일',distribution:'유통 집계',incident:'장애 시작일',performance:'성능 측정',response_model:'반응 모형 정의',budget_scenario:'가상 예산안'};
const periodNames={T04:'4개월 조사',T05:'2개월 검색 관심',T06:'2개월 키워드 추정',T09:'프로모션 적용 기간',T12:'캠페인 설정 기간',T29:'협업 예정 기간',T36:'수집 예정 기간',T38:'실험 대상 기간',T40:'2개월 정책 기간'};
const fieldNames={observed_at:'관측일',written_at:'작성일',created_at:'접수일',ordered_at:'주문일',event_time:'이벤트일',published_at:'발행일',requested_at:'환불 요청일',changed_at:'변경일',incident_start:'장애 시작일',promised_at:'배송 약속일',sent_at:'발송일'};
const examples={T01:'제품·브랜드·용량 정의 확인',T02:'제품의 외부 식별자 매핑 확인',T03:'국가·제품별 월별 시장 판매액·점유율 비교',T04:'조사 표본의 제품별 구매 경험 비교',T05:'동일 정규화 범위 안의 검색 관심 변화',T06:'키워드별 예상 검색수·입찰가 비교',T07:'기기별 검색 클릭·노출 비교',T08:'제품·판매처별 가격 관측 비교',T09:'등록된 프로모션의 기간·조건 확인',T10:'가상 광고주별 공개 광고 표본·소재 형식 비교',T11:'기사·발표 원문과 제품 연결 확인',T12:'캠페인별 설정·예산 정의 확인',T13:'월별 또는 8월 일별 광고비·클릭·매체 전환 비교',T14:'광고 세그먼트별 보고 성과 비교',T15:'공통 경매 범위의 점유율·중복률 비교',T16:'소재 문구·형식·유효기간 확인',T17:'웹 이벤트·기기별 집계 비교',T18:'상품 조회→장바구니→구매 수량 비교',T19:'8월 제품별 주문 수량·주문행 매출 비교',T20:'취소·반품·환불 수량·금액·상태 확인',T21:'제품별 원가·마진의 표본 비교',T22:'관측 위치별 재고·품절 여부 확인',T23:'월별 유통 표본과 배송 지연 기록 확인',T24:'제품별 리뷰 별점·불만 원문 비교',T25:'연결 리뷰의 측면·감성 주석과 발췌 확인',T26:'8월 문의 주제·접수량·해결 상태 비교',T27:'콘텐츠별 관측 누적 조회수 비교',T28:'수집 댓글의 내용·제품 연결 확인',T29:'예정 협업의 비용·권리·계약 상태 확인',T30:'가상 고객군별 순매출·재구매율 비교',T31:'이메일 캠페인 발송·반송·클릭자 수 비교',T32:'조사 표본의 제품별 긍정 응답률 비교',T33:'시연용 가상 지수의 저장값 확인',T34:'기온·강수·캘린더 표본 확인',T35:'설정 변경 전후값과 연결 근거 확인',T36:'수집 예정 범위와 누락·오류 확인',T37:'장애 기록·관측 성능 확인',T38:'가상 실험군·대조군의 표본 결과 확인',T39:'가상 예산안·수식·계수·모의 전환 비교',T40:'예산 한도·허용 채널·승인 조건 확인',H01:'월별 자사 순판매액·순판매량 비교'};

export function coverageRows(catalog,manifest){
 const byId=new Map(catalog.records.map(r=>[r.record_id,r]));
 function span(r){
  const t=r.temporal||{},period=r.period||r.planned_period||r.expected_period;
  if(period?.start&&period?.end_exclusive)return {start:date(period.start),end:previous(period.end_exclusive),basis:t.period_field||'period',mode:'interval',grain:period.grain||t.source_grain,label:kindNames[r.record_kind]||periodNames[r.dataset_type]||({month:'월별',day:'일별',custom:'대상 기간'})[period.grain]||'대상 기간'};
  if(r.valid_from)return {start:date(r.valid_from),end:r.valid_to_exclusive?previous(r.valid_to_exclusive):null,basis:'valid_from / valid_to_exclusive',mode:'validity',grain:'definition',label:'정의 유효기간'};
  const field=t.timestamp_field||Object.keys(fieldNames).find(k=>r[k]);
  if(field&&date(r[field]))return {start:date(r[field]),end:date(r[field]),basis:field,mode:'instant',grain:'instant',label:kindNames[r.record_kind]||fieldNames[field]||field};
  if(r.review_ref&&byId.has(r.review_ref)){const parent=span(byId.get(r.review_ref));return {...parent,basis:'review_ref → '+parent.basis,label:'연결 리뷰 작성일'};}
  return {start:null,end:null,basis:'측정 시점 없음',mode:'definition',grain:'definition',label:kindNames[r.record_kind]||'시계열 없는 정의'};
 }
 const types=JSON.parse(fs.readFileSync('docs/design/marketing-workbench-type-map.json','utf8')).types;
 return manifest.files.map(f=>{
  const records=catalog.records.filter(r=>r.dataset_type===f.type),groups=new Map();
  for(const r of records){const s=span(r),country=r.scope_id?.split('-')[1];const c=['KR','JP','US'].includes(country)?country:'GLOBAL';const key=JSON.stringify([c,s.label,s.basis,s.mode,s.grain]);if(!groups.has(key))groups.set(key,{country:c,label:s.label,basis:s.basis,mode:s.mode,grain:s.grain,rows:0,spans:[]});const g=groups.get(key);g.rows++;g.spans.push(s);}
  const coverage=[...groups.values()].map(g=>{
   const starts=g.spans.map(s=>s.start).filter(Boolean).sort(),ends=g.spans.map(s=>s.end).filter(Boolean).sort(),windows=[...new Set(g.spans.filter(s=>s.start).map(s=>s.start+'/'+s.end))].sort();
   const days=new Set();if(g.mode!=='validity')for(const s of g.spans)if(s.start&&s.end)for(let d=Date.parse(s.start+'T00:00:00Z');d<=Date.parse(s.end+'T00:00:00Z');d+=86400000)days.add(new Date(d).toISOString().slice(0,10));
   const start=starts[0]||null,end=g.spans.some(s=>s.start&&!s.end)?null:ends.at(-1)||null;
   const extent=start&&end?Math.round((Date.parse(end)-Date.parse(start))/86400000)+1:0;
   return {...g,spans:undefined,start,end,windows,coveredDates:days.size,missingDatesWithinRange:g.mode==='validity'?null:extent-days.size};
  });
  return {type:f.type,name:f.type==='H01'?'월별 자사 판매 요약':types.find(t=>t.id===f.type)?.name||f.type,file:f.file,rows:records.length,coverage,question:examples[f.type]};
 });
}

export function coverageMarkdown(report){
 const text=g=>!g.start?g.label:`${g.label}: ${g.start} ~ ${g.end||'종료 미지정'}${g.mode==='instant'?` (${g.coveredDates}개 날짜${g.missingDatesWithinRange?'·중간 미관측 '+g.missingDatesWithinRange+'일':''})`:g.mode==='interval'?` (${g.windows.length}개 기간${g.missingDatesWithinRange?'·중간 미제공 기간 있음':''})`:''}`;
 const cell=(row,c)=>row.coverage.filter(g=>g.country===c).map(text).join('<br>')||(row.coverage.some(g=>g.country==='GLOBAL')?'국가 공통 정의 (아래 참조)':'—');
 return `# 현재 연결 데이터의 보유 기간\n\n기준: 2026-10-20 / CURRENT 활성 ${report.rows.toLocaleString('ko-KR')}행 / 자료 해시 \`${report.dataHash}\`. 보존 archive와 제외·보류 행은 이 표에 포함하지 않는다. **전체 자료는 가상 표본이며 실제 기업·시장 데이터가 아니다.**\n\n표의 날짜는 대상·관측 기간이다. 파일 확보일이나 수집 실행일을 데이터의 측정기간으로 사용하지 않았다. 종료일은 원천의 종료 제외값에서 하루를 빼 포함 날짜로 표시했다. 한국·일본·미국은 각 원천의 현지 날짜 기준이다. 날짜 범위가 길어도 모든 제품·지표·날짜가 존재하는 것은 아니다. ‘중간 미관측’은 0건을 의미하지 않는다.\n\n## 데이터별 기간표\n\n| ID · 데이터 | 한국 | 일본 | 미국 | 원천 행수 | 자료로 확인 가능한 내용 |\n| --- | --- | --- | --- | ---: | --- |\n${report.types.map(row=>`| ${row.type} · ${row.type==='T33'?'가상 시장 배경 지수 (공표 통계 유형)':row.name} | ${cell(row,'KR')} | ${cell(row,'JP')} | ${cell(row,'US')} | ${row.rows.toLocaleString('ko-KR')} | ${row.question} |`).join('\n')}\n\n### 국가 공통 정의\n\n${report.types.filter(row=>row.coverage.some(g=>g.country==='GLOBAL')).map(row=>`- ${row.type} ${row.name}: ${cell(row,'GLOBAL')} / ${row.rows}행. 국가별 관측 시계열이 아닌 공통 정의다.`).join('\n')||'별도 국가 공통 정의 없음.'}\n\n## 세부 범위 주의사항\n\n- T15 경매 경쟁은 매월 자료가 아니다. 2024년 10·12월, 2025년 2·4·6·8·10·12월, 2026년 2·4·6·8월만 있다.\n- T18 구매 단계의 조회·장바구니·결제 시작·구매는 8월 3~30일이다. 9월 1일까지 이어지는 것은 환불 이벤트이며, 9월 구매 데이터가 있다는 뜻이 아니다.\n- T04·T32는 4개월 조사 구간 6개, T05·T06은 2개월 구간 12개다. 기간이 겹치는 달에 조회되더라도 해당 월 단독으로 측정한 값은 아니다.\n- T27은 관측일 기준 누적 조회수다. 일별 신규 조회수나 콘텐츠 발행일 기준 집계와 구분한다. T23 배송 범위는 화면 필터와 같은 배송 약속일 기준이며 출고·도착일 범위와 다르다.\n\n## Agent 질문에 적용하는 방법\n\n- 월별 자료는 해당 집계 단위로 묻는다. 예: “일본의 2025년 8월과 2026년 8월 자사 순판매액을 비교해 줘.” 월별 합계를 일별 성과로 분해할 수는 없다.\n- 8월 상세는 실제 날짜와 제품을 지정한다. 예: “미국의 2026년 8월 제품 A·B 주문 수량과 문의 주제를 비교해 줘.” 표에 없는 7월 주문 상세는 답할 근거가 없다.\n- 여러 자료를 결합할 때는 기간 교집합·국가·제품·통화·집계 정의를 먼저 확인한다. 월별 판매 요약은 no_detail 자료이며 주문 표본과 일치하는 원장이 아니다.\n- T05 검색 관심은 동일 정규화 범위 안에서만 비교한다. T10은 가상 광고 표본 수이며 실제 경쟁사의 광고비·전환·매출은 알 수 없다. T33은 산출식·기준연도 없는 시연 지수이며 경제·시장 성장률을 설명하지 못한다.\n- 제품·식별자·소재 유효기간, 캠페인 설정 기간, 협업 예정 기간, 수집 예정 기간, 모형·정책 기간은 실제 성과 시계열과 구분한다. 모형·예산안은 실제 예측 성능·인과 효과·집행 결과를 입증하지 않는다.\n- 위 질문은 **자료상 가능한 조회 예시**다. 모든 자연어 질문의 Agent 성공을 보증하지 않는다. 화면에서 국가·기간을 먼저 선택하고 질문하는 것이 현재 지원 범위를 명확히 한다.\n\n[기계 판독 상세](../../evidence/dashboard-trends-20261020/data-coverage.json)는 유형·국가·세부 종류·날짜 필드·개별 기간 목록을 담는다. 재생성: \`node scripts/report-data-coverage.mjs\`. 원천 수치·스키마는 변경하지 않는다.\n`;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const {catalog,manifest}=loadCurrentData();const report={date:'2026-10-20',dataHash:manifest.data_sha256,rows:manifest.rows,types:coverageRows(catalog,manifest)};
 fs.mkdirSync('evidence/dashboard-trends-20261020',{recursive:true});fs.writeFileSync('evidence/dashboard-trends-20261020/data-coverage.json',JSON.stringify(report,null,2)+'\n');
 fs.writeFileSync('docs/design/current-data-coverage.md',coverageMarkdown(report));console.log(JSON.stringify({types:report.types.length,rows:report.rows,groups:report.types.reduce((n,t)=>n+t.coverage.length,0)}));
}
