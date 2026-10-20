import fs from 'node:fs';
const spec=fs.readFileSync('docs/design/marketing-workbench-spec.md','utf8');
const tabs=[['시장·경쟁',['시장 현황','구매 패널','경쟁 활동','외부 환경'],{T03:0,T04:1,T10:2,T11:2,T15:2,T33:3,T34:3}],['브랜드·소비자',['리뷰','검색 수요','VOC·문의','브랜드 조사'],{T24:0,T25:0,T05:1,T06:1,T26:2,T32:3}],['광고·소재',['성과','세그먼트','운영 설정','소재'],{T13:0,T14:1,T12:2,T16:3}],['웹·전환',['유입','구매 단계','사이트 품질'],{T07:0,T17:0,T18:1,T37:2}],['매출·고객',['판매 요약','주문·환불','원가·마진','고객','CRM 캠페인'],{T19:1,T20:1,T21:2,T30:3,T31:4}],['상품·유통',['가격·프로모션','재고','유통·배송'],{T08:0,T09:0,T22:1,T23:2}],['소셜·콘텐츠',['콘텐츠','댓글·언급','크리에이터 협업'],{T27:0,T28:1,T29:2}],['예산·실험',['예산안 비교','실험','정책·승인 검토'],{T39:0,T38:1,T40:2}],['기준·품질',['수집 상태','변경 이력','제품 기준','식별자 연결'],{T36:0,T35:1,T01:2,T02:3}]];
const available=['T01','T03','T08','T09','T12','T13','T22','T24','T35','T36'];
const types=[...spec.matchAll(/^\| \*\*(T\d\d) (● )?([^*]+)\*\* \| ([^|]+) \| ([^|]+) \| ([^|]+) \|/gm)].map(m=>{const d=tabs.findIndex(t=>m[1] in t[2]);const [cols,sort]=m[5].trim().split(/\. /);return {id:m[1],name:m[3].trim(),domain:tabs[d][0],domainIndex:d,tab:tabs[d][1][tabs[d][2][m[1]]],tabIndex:tabs[d][2][m[1]],chart:m[4].trim(),columns:cols.split(' → '),defaultSort:sort||'record_id 오름차순',rules:m[6].trim(),availability:available.includes(m[1])?'D003B':'미생성',fields:{default:'기본 표 열에 명시한 필드',otherSimple:'상세 속성 목록·스키마 순서',identity:'근거 패널 출처',timeQuality:'근거 패널 범위·품질',nested:'원본 JSON 손실 없이 표시'}};}).sort((a,b)=>a.id.localeCompare(b.id));
if(types.length!==40)throw Error('40유형 매핑 실패 '+types.length);
const schema=JSON.parse(fs.readFileSync('docs/research/marketing-ontology/schemas/marketing-records.schema.json','utf8'));
const positions=(properties)=>Object.fromEntries(Object.entries(properties).map(([key,field])=>[key,{description:field.description||'',location:['record_id','dataset_type','scope_id','scenario_id','is_synthetic','provenance','source_file'].includes(key)?'근거 패널 · 출처':['temporal','quality','value_origin','available_at','reporting_timezone'].includes(key)?'근거 패널 · 범위·품질':field.type==='array'?'상세 속성 · 앞 3개 및 전체 펼치기':field.type==='object'||field.$ref?'원본 JSON · 손실 없이 확인':'상세 속성 · 스키마 순서',raw:'원본 JSON'}]));
const defaultSort={T01:'제품 이름 오름차순, record_id 오름차순',T08:'관측 가격 오름차순, record_id 오름차순',T09:'시작일 내림차순, record_id 오름차순',T12:'캠페인 이름 오름차순, record_id 오름차순',T13:'광고비 내림차순, campaign_id 오름차순',T22:'제품 이름 오름차순, record_id 오름차순',T02:'모호·미연결 우선, record_id 오름차순',T26:'미해결 우선, 생성일 내림차순',T35:'변경 시각 내림차순',T36:'상태, 대상 ID 오름차순'};
for(const t of types){
 t.schemaFieldLocations=positions(schema.$defs[t.id].properties);
 if(defaultSort[t.id])t.defaultSort=defaultSort[t.id];
 if(t.availability==='D003B'){
  const rows=fs.readFileSync(`docs/research/marketing-ontology/batches/D003B/source/${t.id}.jsonl`,'utf8').trim().split('\n').map(JSON.parse);
  t.directSource={file:`docs/research/marketing-ontology/batches/D003B/source/${t.id}.jsonl`,records:rows.length,fieldLocations:positions(Object.fromEntries(Object.entries(rows[0]).map(([k,v])=>[k,{type:Array.isArray(v)?'array':typeof v}])))};
 }
}
fs.writeFileSync('docs/design/marketing-workbench-type-map.json',JSON.stringify({spec:'marketing-workbench-spec.md',acceptance:'marketing-workbench-acceptance.md',domains:tabs.map(t=>({name:t[0],tabs:t[1]})),types,historical:{id:'H01',domain:'매출·고객',tab:'판매 요약',chart:'순매출 12개월 직선 추이·전년 점선 + 총판매액→반품금액→순매출 워터폴',columns:['제품','총판매수량','반품수량','순판매수량','총판매액','반품금액','순매출','비교값'],availability:'D003B'}},null,2)+'\n');
console.log('40 types, 9 domains mapped without altering specification');
