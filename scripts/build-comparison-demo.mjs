// Explicitly requested comparison demo. D007 and the ontology source checkout stay immutable.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const destination='frontend/public/workbench-data/D008';
const sha=v=>createHash('sha256').update(v).digest('hex');
const input=fs.readFileSync('frontend/public/workbench-data/D007/catalog.json');
const old=JSON.parse(input),createdAt=process.env.DEMO_CREATED_AT||(fs.existsSync(destination+'/lock.json')?JSON.parse(fs.readFileSync(destination+'/lock.json')).source_created_at:new Date().toISOString());
const country=['KR','JP','US'],products=['P1A','P1B','P2A','P2B','P3A','P3B'];
const reviewCounts={KR:[83,111,74,129,97,66],JP:[119,138,92,151,127,103],US:[213,167,245,196,162,137]};
const ticketCounts={KR:[17,22,10,15,8,7],JP:[23,25,14,18,16,11],US:[35,47,26,39,31,22]};
const contentCounts={KR:[3,5,2,4,3,2],JP:[5,7,4,6,4,3],US:[10,14,8,13,9,6]};
const ads={KR:[[5,3,1],[8,4,2],[3,0,2]],JP:[[7,3,3],[12,4,2],[4,4,2]],US:[[12,8,10],[17,9,5],[8,12,6]]};
const random=key=>parseInt(sha('comparison-20261019/'+key).slice(0,8),16)/0x100000000;
const choose=(weights,key)=>{let n=random(key)*weights.reduce((s,v)=>s+v,0);for(let i=0;i<weights.length;i++){n-=weights[i];if(n<0)return i;}return weights.length-1;};
const source=JSON.parse(input.toString().replaceAll('D007','D008'));
const rows=Object.fromEntries([...new Set(source.records.map(r=>r.dataset_type))].map(t=>[t,source.records.filter(r=>r.dataset_type===t)]));
const templates=Object.fromEntries(Object.entries(rows).map(([t,rs])=>[t,structuredClone(rs[0])]));
const reset=['T10','T11','T24','T25','T26','T27','T28','T29','T37'];for(const t of reset)rows[t]=[];
const local=(c,day,hour=12)=>`2026-08-${String(day).padStart(2,'0')}T${String(hour).padStart(2,'0')}:00:00${c==='US'?'-04:00':'+09:00'}`;
const add=(t,c,fields)=>{const r={...structuredClone(templates[t]),...fields};r.record_id=`D008-${t}-${String(rows[t].length+1).padStart(5,'0')}`;r.scope_id=`D008-${c}-sample`;r.scenario_id='D008-comparison-demo';r.temporal={...r.temporal,reporting_timezone:{KR:'Asia/Seoul',JP:'Asia/Tokyo',US:'America/New_York'}[c],available_at:createdAt};delete r.related_record_ids;rows[t].push(r);return r;};
const aspects=[['가격','가격에 비해 만족스러웠습니다','가격이 부담스러웠습니다'],['세정감','세정감이 산뜻했습니다','세정 후 건조함이 느껴졌습니다'],['향','향이 은은해서 좋았습니다','향이 제 취향과 달랐습니다'],['용기','용기에서 꺼내 쓰기 편했습니다','용기에서 꺼내 쓰기 불편했습니다'],['거품','거품이 풍성하게 났습니다','거품이 부족하게 느껴졌습니다'],['사용감','사용 후 머릿결이 부드러웠습니다','사용 후 뻣뻣함이 남았습니다']];
for(const c of country)for(let pi=0;pi<6;pi++)for(let i=0;i<reviewCounts[c][pi];i++){
 const p=products[pi],key=c+p+i,bias=[.52,.7,.8,.64,.6,.73][pi]+({KR:0,JP:-.04,US:.05}[c]),rating=1+choose([Math.max(.02,1-bias)*.32,.1,.2,bias*.42,bias*.58],key+'rating');
 const a=aspects[(pi+i)%6],b=aspects[(pi+i+2)%6],positive=rating>=4,secondary=choose([.52,.48],key+'secondary')===0;
 const quote=a[positive?1:2],quote2=b[secondary?1:2],body=`${['출근 전 사용해 보니','두 주 동안 사용해 보니','운동 후 사용했을 때','가족과 함께 사용해 보니'][i%4]} ${quote}. ${quote2}. ${['다음 구매 때도 비교해 보려 합니다','사용량을 조절해서 써 보려고 합니다','제 사용 환경에서 느낀 점입니다'][i%3]}.`;
 const r=add('T24',c,{review_id:`D008-Review-${key}`,subject_ref:p,written_at:local(c,3+i%28,15),body_text:body,rating_value:rating,verified_purchase:null,invited_review:null});
 for(const [aspect,q,sentiment] of [[a[0],quote,positive?'positive':'negative'],[b[0],quote2,secondary?'positive':'negative']]){
  const start=body.indexOf(q),annotation=add('T25',c,{subject_ref:p,aspect_ref:aspect,sentiment,review_ref:r.record_id,evidence_span:{record_ref:r.record_id,field_path:'$.body_text',quote:q,language:'ko',start_offset:start,end_offset:start+q.length},extractor_version:'D008-explicit-text-rule-1'});annotation.related_record_ids=[r.record_id];
 }
}
for(const c of country){
 for(let bi=0;bi<3;bi++)for(let f=0;f<3;f++)for(let i=0;i<ads[c][bi][f];i++)add('T10',c,{advertiser_ref:'B'+(bi+1),public_ad_id:`D008-Ad-${c}-${bi}-${f}-${i}`,observed_at:local(c,3+Math.floor(random(c+bi+f+i)*28)),format:['text','image','video'][f],creative_text:`가상 ${bi===0?'자사':'경쟁'+bi} 샴푸의 ${['가격·혜택','제품 사용법','사용 경험'][f]} 안내 소재`,served_regions:[c]});
 for(let i=0;i<({KR:11,JP:16,US:27}[c]);i++)add('T11',c,{document_id:`D008-Document-${c}-${i}`,publisher:['가상 뷰티 매거진','가상 유통 소식','가상 소비자 조사실'][choose([.55,.3,.15],c+i+'pub')],published_at:local(c,3+i%28,8),subject_refs:[products[choose([.2,.17,.24,.14,.16,.09],c+i+'prod')]],title:['샴푸 구매 시 고려하는 기준','가격·용량 비교 소식','제품 사용 경험 조사'][i%3]});
 for(let pi=0;pi<6;pi++)for(let i=0;i<ticketCounts[c][pi];i++){
  const key=c+pi+i,status=random(key+'status')<({KR:.72,JP:.81,US:.64}[c])?'resolved':'open',day=3+i%25;
  const r=add('T26',c,{ticket_id:`D008-Ticket-${key}`,created_at:local(c,day,10+i%7),channel:['email','chat','phone'][choose([.4,.48,.12],key+'ch')],subject:['사용 방법','배송 문의','교환 문의','가격·혜택','제품 사용감'][choose(c==='US'?[.17,.4,.18,.14,.11]:c==='JP'?[.28,.15,.12,.18,.27]:[.22,.28,.23,.17,.1],key+'topic')],product_ref:products[pi],status,message_text:`가상 ${products[pi]} 제품에 관한 고객 문의입니다. ${['사용 방법을 안내받고 싶습니다','배송 일정을 확인하고 싶습니다','제품 선택 기준을 문의합니다'][i%3]}`,link_status:'unlinked'});
  r.message_text=({ '사용 방법':'한 번에 어느 정도를 사용하면 좋을지 안내받고 싶습니다.', '배송 문의':'배송 예정일과 배송 상태를 확인하고 싶습니다.', '교환 문의':'교환 가능한 조건과 접수 방법을 알고 싶습니다.', '가격·혜택':'표시된 할인과 혜택의 적용 조건을 확인하고 싶습니다.', '제품 사용감':'사용 후 건조함이 느껴져 권장 사용 방법을 문의합니다.' })[r.subject]+' '+['선택한 제품은 '+products[pi]+'입니다.','처음 이용해 보아 문의드립니다.','확인 후 안내 부탁드립니다.'][i%3];delete r.order_ref;delete r.resolved_at;if(status==='resolved')r.resolved_at=local(c,Math.min(30,day+1+Math.floor(random(key+'lag')*3)),17);
 }
 const content=[];
 for(let pi=0;pi<6;pi++)for(let i=0;i<contentCounts[c][pi];i++)content.push(add('T27',c,{content_id:`D008-Content-${c}-${pi}-${i}`,product_refs:[products[pi]],published_at:local(c,3+i%27,9),observed_at:local(c,4+i%27,18),platform:['synthetic_video','synthetic_social','synthetic_blog'][choose([.46,.39,.15],c+pi+i+'platform')],title:`${['사용법','가격 비교','일주일 사용기','제품 선택'][i%4]} · ${products[pi]}`,view_count:Math.round((200+16000*random(c+pi+i+'views')**2)*({KR:1,JP:1.2,US:2.3}[c]))}));
 for(const item of content){const n=2+Math.floor(random(item.content_id+'comments')*({KR:9,JP:13,US:23}[c]));for(let i=0;i<n;i++){const r=add('T28',c,{comment_id:`D008-Comment-${item.content_id}-${i}`,content_ref:item.content_id,written_at:item.observed_at,body_text:['가격 비교에 도움이 됐어요','사용량이 궁금합니다','향에 대한 설명을 더 보고 싶어요','용량도 함께 비교해 주세요'][i%4]});r.related_record_ids=[item.record_id];}}
 for(const item of content.slice(0,{KR:3,JP:5,US:10}[c])){const r=add('T29',c,{collaboration_id:`D008-Collaboration-${item.content_id}`,creator_ref:item.channel_ref,product_refs:item.product_refs,content_refs:[item.content_id]});r.related_record_ids=[item.record_id];r.fee=structuredClone(source.records.find(x=>x.dataset_type==='T29'&&x.scope_id.includes('-'+c+'-')).fee);r.planned_period.timezone=r.temporal.reporting_timezone;}
 const n={KR:25,JP:35,US:48}[c],incidents={KR:5,JP:7,US:11}[c];
 for(let i=0;i<n;i++){
  const day=3+i%27,p=products[i%2],r=add('T37',c,{page_ref:`D008-LandingPage-${c}-${p}`,device:i%3===0?'desktop':'mobile',record_kind:i<incidents?'incident':'performance'});
  for(const k of ['incident_start','incident_end','error_text','period','measures'])delete r[k];
  if(i<incidents){r.incident_start=local(c,day,9);r.incident_end=local(c,day,10+Math.floor(random(c+i+'duration')*6));r.status=i===0?'reported':'resolved';r.error_text=['페이지 응답 지연','결제 화면 오류','상품 이미지 응답 지연'][i%3];}
  else{r.period={start:'2026-08-03',end_exclusive:'2026-08-31',timezone:r.temporal.reporting_timezone,grain:'custom'};r.measures=[{metric_id:'D008.lcp_p75',value:Math.round(1100+random(c+i+'lcp')*3500),unit:'ms',availability:'available',definition_version:'D008-1'}];r.status='reported';}
 }
}
for(const t of ['T04','T32'])for(const r of rows[t]){const c=r.scope_id.split('-')[1],p=r.subject_ref,seed=r.record_id;const n=Math.round((95+random(seed+'n')*240)*({KR:1,JP:1.18,US:1.9}[c])*(.8+Number(p[1])*.13)),yes=Math.round(n*(.3+random(seed+'yes')*.5));r.sample_size=n;for(const m of r.measures){if(String(m.metric_id).endsWith('positive_count'))m.value=yes;if(String(m.metric_id).endsWith('sample_size'))m.value=n;if(String(m.metric_id).endsWith('positive_rate'))m.value=yes/n;}}
for(const r of rows.T06){const c=r.scope_id.split('-')[1];r.estimated_searches=Math.round(r.estimated_searches*({KR:1,JP:1.22,US:2.15}[c])*(.75+random(r.keyword+c)*.6));}
for(const r of rows.T16)r.format=['text','image','video'][choose([.27,.45,.28],r.record_id)];
// Vary independent visit/activity samples while preserving order/refund linkage.
for(const c of ['JP','US'])for(let i=0;i<(c==='JP'?400:1400);i++){
 const parent=source.records.filter(r=>r.dataset_type==='T17'&&r.scope_id.includes('-'+c+'-'))[i%900];
 const visit=add('T17',c,{...structuredClone(parent),event_id:'D008-WebEvent-extra-'+c+'-'+i,event_time:local(c,3+i%28,9+i%9)});
 const events=i%5===0?['view_item','add_to_cart','begin_checkout']:i%2===0?['view_item','add_to_cart']:['view_item'];
 for(const event of events){const e=add('T18',c,{event_id:'D008-Item-extra-'+c+'-'+i+'-'+event,item_index:0,event_time:visit.event_time,event_name:event,variant_ref:'D005-V-'+(i%3?'P1A':'P1B'),quantity:1,session_ref:visit.session_ref,measurement_basis:'synthetic_web_item_event'});delete e.transaction_ref;delete e.unit_price;e.related_record_ids=[visit.record_id];}
}
for(const r of rows.T17){const c=r.scope_id.split('-')[1];r.device=random(r.record_id+'device')<(c==='KR'?.73:c==='JP'?.64:.58)?'mobile':'desktop';r.traffic_source=['search','social','direct','email'][choose(c==='US'?[.37,.41,.15,.07]:c==='JP'?[.5,.22,.19,.09]:[.4,.3,.17,.13],r.record_id+'traffic')];}
for(const r of rows.T18)if(!['purchase','refund'].includes(r.event_name)){const c=r.scope_id.split('-')[1];r.event_name=['view_item','add_to_cart','begin_checkout'][choose(c==='US'?[.59,.27,.14]:c==='JP'?[.5,.32,.18]:[.48,.3,.22],r.record_id+'event')];}
// Additional independent customer cohorts: retain complete order/refund/shipment graphs.
for(const c of ['JP','US']){
 const cohorts=rows.T30.filter(r=>r.scope_id.includes('-'+c+'-')).slice(0,c==='JP'?12:48),cohortIds=new Set(cohorts.map(r=>r.cohort_ref)),lineRecords=new Set(cohorts.flatMap(r=>r.related_record_ids||[]));
 const orders=rows.T19.filter(r=>lineRecords.has(r.record_id)),orderIds=new Set(orders.map(r=>r.order_id)),transactions=new Set(orders.map(r=>r.transaction_ref));
 const candidates=[...orders,...rows.T20.filter(r=>orderIds.has(r.order_ref)),...rows.T18.filter(r=>['purchase','refund'].includes(r.event_name)&&transactions.has(r.transaction_ref)),...rows.T23.filter(r=>r.record_kind==='fulfilment'&&orderIds.has(r.order_ref)),...cohorts,...rows.T31.filter(r=>cohortIds.has(r.segment_ref))];
 const mapping=new Map(),cursor=Object.fromEntries(Object.entries(rows).map(([t,rs])=>[t,rs.length]));
 for(const r of candidates){mapping.set(r.record_id,'D008-'+r.dataset_type+'-'+String(++cursor[r.dataset_type]).padStart(5,'0'));for(const k of ['order_id','line_id','transaction_ref','adjustment_id','cohort_ref','crm_campaign_id','customer_pseudo_ref','event_id'])if(typeof r[k]==='string')mapping.set(r[k],r[k]+'-extended');}
 const remap=v=>typeof v==='string'?(mapping.get(v)||v):Array.isArray(v)?v.map(remap):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,n])=>[k,remap(n)])):v;
 for(const r of candidates){const copy=remap(r),next=add(r.dataset_type,c,copy);if(copy.related_record_ids)next.related_record_ids=copy.related_record_ids;}
}
const records=Object.values(rows).flat();
for(const r of records){r.scenario_id='D008-comparison-demo';r.temporal.available_at=createdAt;r.provenance={...r.provenance,system:'D008-comparison-1',source_record_key:r.record_id,artifact_ref:`frontend/public/workbench-data/D008/source/${r.dataset_type}.jsonl`,collected_at:createdAt,documentation_refs:['docs/design/marketing-redesign-20261019/README.md']};r.quality.coverage='User-requested synthetic comparison demo; independent from historical source versions';if(r.dataset_type==='T37'){delete r.temporal.timestamp_field;delete r.temporal.period_field;if(r.period){r.temporal.time_kind='interval';r.temporal.period_field='period';}else{r.temporal.time_kind='instant';r.temporal.timestamp_field='incident_start';}}}
source.definitions.created_at=createdAt;source.definitions.version='D008-comparison-1';
const known=new Set(source.definitions.definitions.map(d=>d.id));for(const d of source.definitions.definitions)d.available_at=createdAt;
const entityFields={review_id:'Review',public_ad_id:'PublicAd',document_id:'Document',ticket_id:'Ticket',content_id:'Content',comment_id:'Comment',collaboration_id:'Collaboration',order_id:'Order',line_id:'OrderLine',transaction_ref:'Transaction',adjustment_id:'Adjustment',cohort_ref:'Cohort',crm_campaign_id:'CRM',customer_pseudo_ref:'Customer',event_id:'WebEvent'};
for(const r of records)for(const [key,kind] of Object.entries(entityFields))if(typeof r[key]==='string'&&!known.has(r[key])){known.add(r[key]);source.definitions.definitions.push({id:r[key],kind,definition:'Synthetic comparison version identity; not real-world evidence',version:'D008-comparison-1',is_synthetic:true,available_at:createdAt});}
const counts=Object.fromEntries(Object.entries(rows).map(([t,rs])=>[t,rs.length]));
const plan={created_at:createdAt,schema_sha256:sha(fs.readFileSync('../marketing-agent-poc/docs/research/marketing-ontology/schemas/marketing-records.schema.json')),validator_sha256:sha(fs.readFileSync('../marketing-agent-poc/docs/research/marketing-ontology/batches/D007/catalog.mjs')),purpose:'Country/product comparison requested on 2026-10-19',source_sha256:sha(input),rows:records.length,counts,reviewCounts,ticketCounts,advertising:ads,policy:'New independent scenario; no old file overwritten; no actual market or verified purchases; annotations follow exact text spans'};
if(process.argv.includes('--plan')){console.log(JSON.stringify(plan,null,2));process.exit(0);}
const rebuild=process.argv.includes('--rebuild-current');if(rebuild){const previous=JSON.parse(fs.readFileSync(destination+'/lock.json'));assert.equal(previous.source_sha256,sha(input));assert.equal(previous.purpose,'Country/product comparison requested on 2026-10-19');}else assert(!fs.existsSync(destination),'Immutable demo snapshot already exists');
const flag=rebuild?'w':'wx';
const {validRecord}=await import(pathToFileURL(path.resolve('../marketing-agent-poc/docs/research/marketing-ontology/batches/D007/catalog.mjs')));
for(const r of records){const v=validRecord(r);assert(v.conforming,r.record_id+' '+JSON.stringify(v.errors));}
const ids=new Set(records.map(r=>r.record_id));assert.equal(ids.size,records.length);
for(const r of records){for(const id of r.related_record_ids||[])if(/^D008-(?:T\d\d|H01)-/.test(id))assert(ids.has(id),'Missing parent '+id);if(r.review_ref)assert(ids.has(r.review_ref));if(r.dataset_type==='T25'){const review=rows.T24.find(p=>p.record_id===r.review_ref);assert.equal(review.body_text.slice(r.evidence_span.start_offset,r.evidence_span.end_offset),r.evidence_span.quote);}}
fs.mkdirSync(destination+'/source',{recursive:true});for(const [t,rs]of Object.entries(rows))fs.writeFileSync(`${destination}/source/${t}.jsonl`,rs.map(JSON.stringify).join('\n')+'\n',{flag});
const payload=JSON.stringify({batch:'D008',scenario:'D008-comparison-demo',products:old.products,definitions:source.definitions,records});fs.writeFileSync(destination+'/catalog.json',payload,{flag});fs.writeFileSync(destination+'/lock.json',JSON.stringify({sha256:sha(payload),source_created_at:createdAt,rows:records.length,screen_contract:'workbench-model/1',...plan},null,2),{flag});
assert.equal(sha(fs.readFileSync('frontend/public/workbench-data/D007/catalog.json')),sha(input));console.log(JSON.stringify({pass:true,rows:records.length,counts,reviewCounts}));
