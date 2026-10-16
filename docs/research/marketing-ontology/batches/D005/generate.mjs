import {countries,currencies,zones,payloads,codec,loadParents,toMinor,fromMinor} from './contract.mjs';
export const parents=loadParents();
export const selected={T01:parents.T01,T12:parents.T12,T13:parents.T13.filter(r=>['2026-07-01','2026-08-01'].includes(r.period_start)),T24:parents.T24.filter(r=>['P1A','P1B'].includes(r.product_id)&&Number(r.review_id.split('-').at(-1))<=2)};
const products=['P1A','P1B','P2A','P2B','P3A','P3B'];
const days=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const stamp=(c,d,h='12:00:00')=>`${d}T${h}${c===2?'-04:00':'+09:00'}`;
const hourAfter=t=>new Date(Date.parse(t)+3600000).toISOString();
const period=(start,end)=>({start,end});
const ref=(c,k)=>`D005-${countries[c]}-${k}`;
const variant=p=>'D005-V-'+p;
const money=(jpy,c)=>{const cents=BigInt(jpy)*100n*(c===0?10n:1n)/(c===2?100n:1n);return {amount:`${cents/100n}.${String(cents%100n).padStart(2,'0')}`,currency:currencies[c]};};
const table=[[1,'L1','P1A',2,1000,100,1900],[1,'L2','P1B',1,1500,0,1500],[2,'L1','P1A',1,1000,0,1000],[3,'L1','P1A',1,1000,0,1000],[3,'L2','P1B',2,1500,0,3000],[4,'L1','P1B',1,1500,0,1500]];
const role=t=>['T25'].includes(t)?'annotation':['T14','T30'].includes(t)?'derived':t==='T39'?'assumption':t==='T40'?'policy':'simulation';
export function generateTypes(types){
 const out=[];const counters={};
 function add(t,c,p,available,parentIds=[]){
  if(!types.includes(t))return;
  const n=counters[t]=(counters[t]??0)+1;
  for(const id of parentIds){const r=Object.values(selected).flat().find(x=>x.record_id===id);if(r&&Date.parse(available)<=Date.parse(r.available_at))available=hourAfter(r.available_at);}
  const metadata={record_id:`D005-${t}-${String(n).padStart(4,'0')}`,dataset_type:t,country_code:c<0?'GLOBAL':countries[c],scenario_id:'D005-independent-sample',scope_id:c<0?'D005-global-products':ref(c,'sample'),is_synthetic:true,value_origin:role(t),available_at:available,reporting_timezone:zones[Math.max(0,c)],source_file:`docs/research/marketing-ontology/batches/D005/source/${t}.jsonl`,parent_record_ids:parentIds,quality:'synthetic_sample'};
  const profile=['A','B','C'][(Number(t.slice(1))+Math.max(0,c)+n-1)%3];
  out.push({source_profile:profile,metadata,payload:codec(p,payloads[t],profile)});
 }
 for(const p of selected.T01)add('T01',-1,{product_id:p.product_id,product_name:p.product_name,brand_id:p.brand_id,brand_name:p.brand_name,variant_id:variant(p.product_id),sku:'D005-SKU-'+p.product_id,category_id:'D005-CAT-shampoo',volume:{value:p.volume_ml,unit:'ml'},valid_from:'2026-07-01'},stamp(0,'2026-07-01','00:00:00'),[p.record_id]);
 for(let profile=0;profile<3;profile++)for(let c=0;c<3;c++)for(const p of products)add('T02',c,{mapping_kind:'external_id',external_system:['A','B','C'][profile],external_value:`${['A','B','C'][profile]}-${countries[c]}-${p}`,entity_ref:variant(p),match_status:'confirmed',period:period('2026-07-01','2026-10-01'),evidence:['D005-2.0.0 승인 코드표']},stamp(c,'2026-07-01','00:00:00'));
 for(const p of selected.T01)add('T02',1,{mapping_kind:'name_alias',external_system:'일본 제품명 별칭',external_value:p.product_name,entity_ref:variant(p.product_id),match_status:'candidate',period:period('2026-07-01','2026-10-01'),evidence:[p.record_id]},stamp(1,'2026-07-01','00:00:00'),[p.record_id]);
 for(let c=0;c<3;c++){
  const at=(day,h)=>stamp(c,`2026-08-${String(day).padStart(2,'0')}`,h);
  const aggregate=per=>stamp(c,days(per.end,1));
  const eventBase=(s,product='P1A')=>({session_ref:s===null?null:ref(c,'S'+s),variant_ref:variant(product),item_index:0,quantity:1,consent_state:[4,6].includes(s)?'denied':'granted',measurement_basis:'web_item_event'});
  for(let s=1;s<=6;s++)add('T17',c,{event_id:ref(c,'G'+s),event_time:at(s+2,'11:50:00'),event_name:'page_view',site_ref:ref(c,'SITE'),session_ref:ref(c,'S'+s),page_ref:ref(c,'PAGE1'),device:'mobile',consent_state:[4,6].includes(s)?'denied':'granted'},hourAfter(at(s+2,'11:50:00')));
  for(const s of [4,6])add('T17',c,{event_id:ref(c,'CONSENT'+s),event_time:at(s+2,'11:49:00'),event_name:'consent_update',site_ref:ref(c,'SITE'),session_ref:ref(c,'S'+s),page_ref:ref(c,'PAGE1'),device:'mobile',consent_state:'denied'},hourAfter(at(s+2,'11:49:00')));
  const funnel=[['view_item','add_to_cart','begin_checkout'],['view_item','add_to_cart'],['view_item','begin_checkout'],['begin_checkout'],['view_item','add_to_cart','begin_checkout'],['view_item']];
  for(let s=1;s<=6;s++)for(const [i,event_name] of funnel[s-1].entries())add('T18',c,{...eventBase(s),event_id:ref(c,`F${s}-${i}`),event_time:at(s+2,`11:${51+i}:00`),event_name},hourAfter(at(s+2,`11:${51+i}:00`)));
  for(const [o,line,p,q,unit,discount,total] of table){
   add('T19',c,{order_id:ref(c,'O'+o),line_id:line,transaction_ref:ref(c,'X'+o),ordered_at:at(o+2,'12:00:00'),variant_ref:variant(p),quantity:q,unit_price:money(unit,c),line_discount:money(discount,c),line_tax:money(0,c),line_gross_total:money(total,c),fulfilment_status:[1,3].includes(o)?'fulfilled':o===2?'shipped':'unfulfilled',status_available_at:at(11,'09:00:00')},at(11,'09:00:00'));
   add('T18',c,{...eventBase(o===4?null:o,p),event_id:ref(c,'PUR'+o),event_time:at(o+2,'12:01:00'),event_name:'purchase',item_index:line==='L2'?1:0,quantity:q,transaction_ref:ref(c,'X'+o),unit_price:money(total/q,c)},hourAfter(at(o+2,'12:01:00')));
  }
  for(const [i,o,line,p,amount] of [[1,1,'L1','P1A',950],[2,3,'L2','P1B',1500]]){
   add('T20',c,{adjustment_id:ref(c,'R'+i),adjustment_kind:'refund',order_ref:ref(c,'O'+o),order_line_ref:ref(c,`O${o}/${line}`),requested_at:at(i+7,'12:00:00'),processed_at:at(i+7,'13:00:00'),quantity:1,refund_amount:money(amount,c),status:'completed',reason_code:'unknown',restocked:null},hourAfter(at(i+7,'13:00:00')));
   add('T18',c,{...eventBase(null,p),event_id:ref(c,'REF'+i),event_time:at(i+7,'13:01:00'),event_name:'refund',transaction_ref:ref(c,'X'+o),adjustment_ref:ref(c,'R'+i),unit_price:money(amount,c),refund_amount:money(amount,c)},hourAfter(at(i+7,'13:01:00')));
  }
  add('T20',c,{adjustment_id:ref(c,'C1'),adjustment_kind:'cancel',order_ref:ref(c,'O4'),order_line_ref:ref(c,'O4/L1'),requested_at:at(10,'12:00:00'),quantity:1,status:'pending',reason_code:'unknown',restocked:null},hourAfter(at(10,'12:00:00')));
  for(let i=0;i<2;i++){const per=period(`2026-07-0${7+i}`,`2026-08-0${4+i}`);add('T37',c,{record_kind:'performance',page_ref:ref(c,'PAGE1'),device:'mobile',period:per,measures:[{metric_id:'lcp_p75',value:2500+100*i,unit:'ms'}]},aggregate(per));}
  add('T37',c,{record_kind:'incident',page_ref:ref(c,'PAGE1'),device:'mobile',incident_start:at(5,'11:00:00'),incident_end:at(5,'11:20:00'),status:'resolved',error_text:'가상 접속 오류'},hourAfter(at(5,'11:00:00')));
  for(let p=0;p<2;p++)for(let i=0;i<2;i++){const per=period(i?'2026-08-07':'2026-08-03',i?'2026-08-11':'2026-08-07');add('T21',c,{variant_ref:variant(products[p]),period:per,unit_cost:money(400+200*p+100*i,c),margin_definition:'세전 상품원가',accounting_basis:'재입고 미확인'},aggregate(per));}
  for(let p=0;p<2;p++)add('T23',c,{record_kind:'distribution',product_ref:products[p],period:period('2026-08-01','2026-09-01'),stockists:20+10*p,target_stockists:40+20*p},stamp(c,'2026-09-02'));
  for(let o=1;o<=4;o++){
   const ship={record_kind:'shipment',order_ref:ref(c,'O'+o),promised_at:at(o+5,'18:00:00'),status:[1,3].includes(o)?'delivered':o===2?'in_transit':'unshipped'};
   if(o!==4)ship.shipped_at=at(o+3,'12:00:00');
   if([1,3].includes(o))ship.delivered_at=at(o+2+(o===1?2:4),'12:00:00');
   add('T23',c,ship,at(11,'09:00:00'));
  }
  for(const p of ['P1A','P1B']){
   const reviews=selected.T24.filter(r=>r.product_id===p&&r.country_code===countries[c]).sort((a,b)=>a.record_id.localeCompare(b.record_id));
   for(const [i,r] of reviews.entries()){
    const quote=i===0?'거품이 잘 나서':c===1&&p==='P1A'?'건조감도 아쉬웠습니다':'용기에서 내용물을 꺼내기 불편했고';
    const chars=Array.from(r.body_text),start=Array.from(r.body_text.slice(0,r.body_text.indexOf(quote))).length;
    if(r.body_text.indexOf(quote)<0)throw new Error('QUOTE_NOT_IN_SOURCE:'+r.record_id);
    const aspect=i===0?'거품':c===1&&p==='P1A'?'건조감':'용기';
    add('T25',c,{record_kind:'annotation',review_ref:r.record_id,product_ref:p,aspect,sentiment:i===0?'positive':'negative',evidence_span:{quote,start,end:start+Array.from(quote).length},assessment_status:'provided'},hourAfter(r.available_at),[r.record_id]);
    add('T25',c,{record_kind:'aggregate',product_ref:p,aspect,sample_size:2,mention_count:1,review_refs:reviews.map(x=>x.record_id)},hourAfter(reviews.at(-1).available_at),reviews.map(x=>x.record_id));
   }
  }
  for(let i=0;i<3;i++)add('T26',c,{ticket_id:ref(c,'CS'+(i+1)),created_at:at(10,'12:00:00'),message_text:['주문 배송 문의','환불 처리 문의','일반 문의'][i],link_status:i<2?'confirmed':'unlinked',...(i<2?{order_ref:ref(c,i===0?'O1':'O3')}:{})},hourAfter(at(10,'12:00:00')));
  for(let b=0;b<3;b++)for(let y=0;y<2;y++){const n=20+5*b+2*c+y,year=2025+y,per=period(`${year}-07-01`,`${year}-10-01`);add('T04',c,{panel_id:ref(c,'PANEL'),subject_ref:'B'+(b+1),period:per,sample_size:100,positive_responses:n,positive_rate:n/100,weighting_method:'unweighted'},aggregate(per));}
  for(let q=0;q<2;q++)for(let w=0;w<2;w++)for(let j=0;j<3;j++){const start=w?days('2026-08-03',7*j):days('2026-07-06',7*j),per=period(start,days(start,7));add('T05',c,{query_id:ref(c,'QUERY'+q),term:['샴푸','세정'][q],normalization_scope:ref(c,'NORM'+(w?'B':'A')),period:per,index_value:(w?[100,60,20]:[40,70,100])[j],search_surface:'모의 검색'},aggregate(per));}
  for(let k=0;k<3;k++)for(let m=0;m<2;m++){const per=period(`2026-0${7+m}-01`,`2026-0${8+m}-01`);add('T06',c,{keyword:['샴푸','세정','보습'][k],language:'ko',period:per,estimated_searches:1000+100*k+10*c+50*m,competition_level:'medium',competition_index:50,bid_lower:money(100,c),bid_upper:money(200,c)},aggregate(per));}
  for(let p=0;p<2;p++)for(let d=0;d<4;d++){const start=days('2026-08-03',d),per=period(start,days(start,1));add('T07',c,{site_ref:ref(c,'SITE'),page_ref:ref(c,'PAGE'+(p+1)),query:c===1&&p===1&&d===3?null:'샴푸',device:'mobile',period:per,impressions:1000+100*p+10*c+50*d,clicks:100+10*p+2*d,average_position:5+p},aggregate(per));}
  for(let b=0;b<2;b++)for(const d of [10,17])add('T10',c,{public_ad_id:ref(c,'AD'+b),advertiser_ref:'B'+(b+2),observed_at:at(d,'12:00:00'),first_seen:at(10,'12:00:00'),last_seen:at(d,'12:00:00'),format:'text',creative_text:'가상 경쟁 샴푸 안내'},hourAfter(at(d,'12:00:00')));
  for(let i=0;i<2;i++)add('T11',c,{document_id:ref(c,'DOC'+i),publisher:i?'가상 전재문':'가상 안내문',published_at:at(10+i,'12:00:00'),event_time:at(10,'11:00:00'),body_text:'가상 경쟁 제품 P2A 안내입니다.',subject_refs:['P2A'],duplicate_group:ref(c,'ANNOUNCEMENT')},hourAfter(at(10+i,'12:00:00')));
  for(let b=0;b<3;b++)for(let i=0;i<2;i++){const per=period(i?'2026-08-17':'2026-08-03',i?'2026-08-22':'2026-08-08');add('T32',c,{study_id:ref(c,'SURVEY'+i),subject_ref:'B'+(b+1),period:per,question_text:'샴푸 사용감에 만족하십니까?',response_scale:['긍정','그 외'],sample_size:50,positive_responses:20+b+5*i,sampling_method:'convenience'},aggregate(per));}
  for(let m=0;m<2;m++)for(let rev=0;rev<2;rev++){
   const per=period(`2026-0${7+m}-01`,`2026-0${8+m}-01`),id=`D005-T33-${String(c*4+m*2+1).padStart(4,'0')}`;
   add('T33',c,{statistics_table_id:ref(c,'STAT'),region_ref:countries[c],period:per,value:1000+100*c+10*m+5*rev,unit:'index',revision:rev,published_at:stamp(c,`2026-0${8+m}-${rev?'10':'05'}`),...(rev?{supersedes_record_id:id}:{})},stamp(c,`2026-0${8+m}-${rev?'10':'05'}`));
  }
  for(let d=0;d<4;d++){const start=days('2026-08-03',d),per=period(start,days(start,1));add('T34',c,{record_kind:'weather',station_ref:ref(c,'STATION'),period:per,temperature:{value:25+c+d,unit:'℃'},precipitation:{value:d,unit:'mm'}},aggregate(per));}
  for(let i=0;i<2;i++){const start=i?'2026-08-10':'2026-08-03',per=period(start,days(start,1));add('T34',c,{record_kind:'schedule',period:per,title:'가상 운영 일정',is_public_holiday:false},aggregate(per));}
  const campaigns=selected.T12.filter(r=>r.country_code===countries[c]);
  for(const campaign of campaigns){
   for(const parent of selected.T13.filter(r=>r.campaign_id===campaign.campaign_id))for(let device=0;device<2;device++){
    const values={};for(const k of ['impressions','clicks','conversions']){const first=parent[k]*6/10;values[k]=device?parent[k]-Math.floor(first):Math.floor(first);}
    for(const k of ['spend','attributed_revenue']){const total=toMinor({amount:parent[k],currency:parent.currency}),first=total*6n/10n;values[k]=fromMinor(device?total-first:first,parent.currency);}
    add('T14',c,{campaign_ref:campaign.campaign_id,parent_record_id:parent.record_id,period:period(parent.period_start,parent.period_end_exclusive),device:device?'desktop':'mobile',metrics:values,split_basis:'synthetic_partition'},hourAfter(parent.available_at),[campaign.record_id,parent.record_id]);
   }
   for(let i=0;i<2;i++)add('T16',c,{creative_id:'D005-CREATIVE-'+campaign.campaign_id,version:i+1,campaign_ref:campaign.campaign_id,product_refs:['P1A'],format:'text',message_text:'가상 자사 샴푸 안내',period:period(i?'2026-08-15':'2026-07-01',i?'2026-10-01':'2026-08-15')},stamp(c,i?'2026-08-15':'2026-07-01','00:00:00'),[campaign.record_id]);
   if(campaign.channel==='search')for(let domain=0;domain<2;domain++)for(let m=0;m<2;m++){const per=period(`2026-0${7+m}-01`,`2026-0${8+m}-01`);add('T15',c,{campaign_ref:campaign.campaign_id,competitor_domain:`competitor${domain+1}.invalid`,period:per,impression_share:(30+5*domain+m)/100,overlap_rate:.2,denominator_status:'not_provided'},aggregate(per),[campaign.record_id]);}
  }
  for(let p=0;p<2;p++){
   for(let i=0;i<2;i++)add('T27',c,{content_id:ref(c,'CONTENT'+p),published_at:at(p?10:3,'12:00:00'),observed_at:at(i?17:14,'12:00:00'),title:'가상 샴푸 콘텐츠',description_text:'가상 사용 안내',view_count:100+10*p+50*i},hourAfter(at(i?17:14,'12:00:00')));
   for(let i=0;i<3;i++)add('T28',c,{comment_id:ref(c,`COMMENT${p}-${i}`),content_ref:ref(c,'CONTENT'+p),written_at:at(p?10:3,`${13+i}:00:00`),body_text:['샴푸 사용 문의','문의에 대한 답글','제품 안내 확인'][i],...(i===1?{parent_comment_ref:ref(c,`COMMENT${p}-0`)}:{})},hourAfter(at(p?10:3,`${13+i}:00:00`)));
  }
  add('T29',c,{collaboration_id:ref(c,'COLLAB'),content_refs:[ref(c,'CONTENT0'),ref(c,'CONTENT1')],agreement_status:'signed',cost:money(100,c)},at(3,'13:00:00'));
  for(let i=0;i<2;i++){
   const orders=[ref(c,'O'+(1+i*2)),ref(c,'O'+(2+i*2))];
   add('T30',c,{record_kind:'cohort',cohort_ref:ref(c,'COHORT'+i),order_refs:orders,customer_set:orders.map(x=>x.replace(/O([1-4])$/,'COHORT-MEMBER$1')),sample_size:2,repeat_purchase_rate:0,net_revenue:money(i?4000:3450,c)},at(11,'09:00:00'));
   add('T31',c,{crm_campaign_id:ref(c,'CRM'+i),cohort_ref:ref(c,'COHORT'+i),emails_sent:2,bounces:0,unique_clicks:1,unsubscribes:0,open_measurement_basis:'not_collected',linked_orders:orders},at(12,'13:00:00'));
  }
  add('T30',c,{record_kind:'opportunity',opportunity_id:ref(c,'B2B'),stage:'open',population:'separate_B2B'},at(11,'09:00:00'));
  for(let e=0;e<2;e++)for(let arm=0;arm<2;arm++){const per=period(e?'2026-08-10':'2026-08-03',e?'2026-08-17':'2026-08-10');add('T38',c,{experiment_id:ref(c,'EXP'+e),arm_id:arm?'treatment':'control',period:per,sample_size:100,conversions:e?(arm?18:20):(arm?12:10),population:'separate_experiment'},aggregate(per));}
  for(let i=0;i<2;i++)add('T40',c,{policy_id:ref(c,'POLICY'+i),status:i?'approved':'proposed',budget:money(i?10000:9000,c),period:period(i?'2026-09-10':'2026-09-07',i?'2026-10-01':'2026-09-10'),approval_role:'모의 업무 승인자',kpi_definition_ref:'D005-KPI-conversions'},stamp(c,i?'2026-09-10':'2026-09-07','00:00:00'));
  const lower=money(0,c),upper=money(7000,c);
  add('T39',c,{record_kind:'model',model_id:ref(c,'MODEL'),formula:'search/(10s)+social/(20s)',trained:false,unit_budget:money(100,c),bounds:{search:{lower,upper},social:{lower,upper}}},stamp(c,'2026-09-10','00:00:00'));
  for(let i=0;i<2;i++)add('T39',c,{record_kind:'budget_candidate',model_ref:ref(c,'MODEL'),policy_ref:ref(c,'POLICY1'),period:period('2026-09-10','2026-09-17'),total_budget:money(10000,c),allocations:{search:money(i?4000:6000,c),social:money(i?6000:4000,c)},predicted_conversions:i?7:8},stamp(c,'2026-09-10','01:00:00'));
 }
 return out;
}
