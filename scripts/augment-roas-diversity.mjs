import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {validRecord} from '../docs/research/marketing-ontology/batches/D007/catalog.mjs';
import {spec,specHash} from './roas-diversity-spec.mjs';
export {spec,specHash};

const dayMs=86400000, epoch=Date.parse(spec.start+'T00:00:00+09:00');
const stamp=ms=>new Date(ms+9*3600000).toISOString().replace('Z','+09:00');
const day=ms=>stamp(ms).slice(0,10);
const cash=value=>({amount:(Math.round(value*100)/100).toFixed(2),currency:'KRW'});
const period=(start,end=day(Date.parse(start+'T00:00:00+09:00')+dayMs),grain='day')=>({start,end_exclusive:end,timezone:'Asia/Seoul',grain});
const interval=grain=>({time_kind:'interval',source_grain:grain,period_field:'period'});
function random(key){
  let state=2166136261;
  for(const c of spec.seed+'|'+key)state=Math.imul(state^c.charCodeAt(0),16777619)>>>0;
  return ()=>{state+=0x6D2B79F5;let n=state;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return ((n^(n>>>14))>>>0)/4294967296;};
}
const integer=(rng,min,max)=>min+Math.floor(rng()*(max-min+1));
const choose=(rng,values)=>values[integer(rng,0,values.length-1)];
const netOf=order=>Number(order.unit_price.amount)*order.quantity-Number(order.line_discount.amount);
const distribution=(rows,fn)=>Object.fromEntries([...new Set(rows.map(fn))].map(value=>[value,rows.filter(row=>fn(row)===value).length]));
const topics=[
 ['출고 예정일을 찾는 데 시간이 걸렸습니다.','배송 일정을 어디서 확인할 수 있는지 문의합니다.'],
 ['배송비가 적용되는 조건을 다시 읽어야 했습니다.','배송비와 할인 조건을 함께 확인하고 싶습니다.'],
 ['결제 금액이 예상과 같아 쉽게 확인했습니다.','주문에 사용한 결제수단을 확인하고 싶습니다.'],
 ['사용 방법 안내가 도움이 되었습니다.','권장 사용량과 보관 방법을 알고 싶습니다.'],
 ['용량이 사용 목적에 맞았습니다.','제품의 용량을 비교하고 싶습니다.'],
 ['향의 강도가 예상과 달랐습니다.','향에 관한 안내를 더 자세히 보고 싶습니다.'],
 ['포장 상태가 아쉬워 확인을 요청했습니다.','포장 상태와 교환 절차를 문의합니다.'],
 ['할인 적용 내역을 확인하기 어려웠습니다.','할인이 중복 적용되는 조건을 문의합니다.'],
 ['배송 안내가 분명해 계획을 세우기 쉬웠습니다.','받을 수 있는 날짜의 범위를 알고 싶습니다.'],
 ['사용감은 만족했지만 다른 제품도 비교해 보겠습니다.','구매 전 제품 특징을 더 확인하고 싶습니다.'],
 ['취소 처리 내역을 별도로 확인했습니다.','취소와 환불의 처리 기간을 문의합니다.'],
 ['설명과 실제 사용 경험이 비슷했습니다.','사용 순서를 확인하고 싶습니다.'],
];
const openings=['제품 설명을 살펴봤습니다.','안내 내용을 다시 확인했습니다.','구매 과정에서 궁금한 점이 있었습니다.','이전 사용 경험과 비교했습니다.','상품 정보를 읽어봤습니다.','필요한 내용을 따로 정리했습니다.','이번에 처음 확인한 내용입니다.','구매를 검토하며 적어둡니다.'];
const endings=['다음에도 이 내용을 참고하겠습니다.','한눈에 확인할 수 있으면 좋겠습니다.','관련 안내를 더 찾아보겠습니다.','현재 경험에 관한 의견입니다.','다른 조건도 비교해 보고 싶습니다.','가족에게도 설명하려고 확인했습니다.','필요한 부분을 다시 읽어보겠습니다.','제 상황에서는 이 점이 눈에 띄었습니다.'];

// Pure generation: importing or running this file never installs or overwrites data.
export function generateDiverseCases(){
 const records=[],profiles=[],counts={},diagnostics={specHash,cases:{}};
 for(const scenario of spec.cases){
  const {id}=scenario,rows=[],counters={},orders=[],customers=[];
  const scope=id+'-KR-paid-p1a';
  const add=(type,payload,temporal={})=>{
   const ordinal=(counters[type]||0)+1;counters[type]=ordinal;
   const row={record_id:`${id}-${type}-${String(ordinal).padStart(5,'0')}`,dataset_type:type,scope_id:scope,scenario_id:scenario.scenario_id,is_synthetic:true,value_origin:'simulation',
    provenance:{system:spec.seed,collection_method:'synthetic_generation',source_record_key:`${id}-${type}-${ordinal}`,artifact_ref:'scripts/augment-roas-diversity.mjs',access_class:'internal',documentation_refs:['docs/design/roas-decision-flow.md','docs/research/marketing-ontology/data-proposal.md']},
    quality:{availability:'available',coverage:'Approved diverse synthetic paid-workflow sample, not observed marketing outcomes; see generator spec assumptions',is_partial:true},
    temporal:{time_kind:'instant',source_grain:'instant',series_role:'detail',calendar_id:'Gregorian',reporting_timezone:'Asia/Seoul',coverage_kind:'sample',available_at:spec.generated_at,revision:0,...temporal},...payload};
   rows.push(row);return row;
  };
  const campaigns=['search','social'].map(channel=>add('T12',{platform:'synthetic_'+channel,account_id:id+'-Account-KR',campaign_id:id+'-Campaign-'+channel,objective:'purchases',status:'active',period:period(spec.start,spec.end,'custom'),product_refs:['P1A'],channel,budget_amount:cash(60000),budget_period:'daily',bidding_strategy:'synthetic_manual',target_definition:'Approved synthetic KR paid sample, simulated setting only; no estimated real audience',landing_ref:id+'-Landing-P1A'},interval('custom')));
  for(const campaign of campaigns)add('T16',{creative_id:id+'-Creative-'+campaign.channel,version:'1',product_refs:['P1A'],format:'text',language:'ko',message_text:campaign.channel==='search'?'제품의 용량과 사용 방법을 비교하고 구매 조건을 확인하세요.':'제품 특징과 사용 순서를 살펴보고 구매 조건을 확인하세요.',valid_from:stamp(epoch),valid_to_exclusive:spec.end+'T00:00:00+09:00',related_record_ids:[campaign.record_id]},{time_kind:'validity',timestamp_field:'valid_from'});
  const paidVisits=[];
  for(let index=0;index<28;index++)for(const campaign of campaigns){
   const key=id+'|'+index+'|'+campaign.channel;
   const traffic=random(key+'|traffic'),clock=random(key+'|clock'),devices=random(key+'|device'),consent=random(key+'|consent'),people=random(key+'|people'),funnel=random(key+'|funnel'),money=random(key+'|money'),delay=random(key+'|delay');
   const count=integer(traffic,spec.daily_paid_sessions.min,spec.daily_paid_sessions.max),after=index>=14;
   const mobileShare=0.44+devices()*0.34;
   for(let j=0;j<count;j++){
    const time=epoch+index*dayMs+(clock()<0.7?integer(clock,8*60,23*60+30):integer(clock,0,23*60+30))*60000;
    const device=devices()<mobileShare?'mobile':'desktop',state=choose(consent,['granted','granted','granted','granted','denied','unknown']);
    let customer=null;
    if(state==='granted'){
     const eligible=customers.filter(item=>time-item.lastUsed>=spec.minimum_repeat_paid_touch_days*dayMs);
     if(eligible.length&&people()<0.48)customer=choose(people,eligible);
     else {customer={id:id+'-Visitor-'+(customers.length+1),lastUsed:time};customers.push(customer);}
     customer.lastUsed=time;
    }
    const session=id+'-Session-'+(counters.T17||0),visit=add('T17',{event_id:id+'-Visit-'+(counters.T17||0),event_time:stamp(time),event_name:'page_view',site_ref:id+'-Site-KR',session_ref:session,user_pseudo_ref:customer?.id||null,page_ref:id+'-Landing-P1A',device,traffic_source:campaign.channel,traffic_medium:'paid',utm_campaign:campaign.campaign_id,...(state==='granted'?{click_id:id+'-Click-'+session}:{}),consent_state:state,event_parameters:[{name:'paid_touch_role',value:'acquisition'}],related_record_ids:[campaign.record_id]},{timestamp_field:'event_time'});
    paidVisits.push(visit);
    let eventTime=time;
    const commerce=(name,quantity=1,unitPrice=20000,extra={})=>add('T18',{event_id:id+'-Event-'+((counters.T18||0)+1),item_index:0,event_time:stamp(eventTime),event_name:name,variant_ref:'D005-V-P1A',quantity,unit_price:cash(unitPrice),session_ref:session,campaign_ref:campaign.campaign_id,measurement_basis:'Synthetic observed event; final discounted product revenue from linked order ledger',related_record_ids:[visit.record_id],...extra},{timestamp_field:'event_time'});
    if(funnel()>spec.funnel_probabilities.view)continue;
    eventTime+=integer(funnel,1,8)*60000;commerce('view_item');
    if(funnel()>(device==='mobile'?spec.funnel_probabilities.cart_mobile:spec.funnel_probabilities.cart_desktop))continue;
    eventTime+=integer(funnel,1,18)*60000;commerce('add_to_cart');
    if(funnel()>spec.funnel_probabilities.checkout)continue;
    eventTime+=integer(funnel,1,25)*60000;commerce('begin_checkout');
    if(funnel()>spec.funnel_probabilities.purchase)continue;
    let quantity=choose(money,[1,1,2,2,2,3]);
    if(after&&scenario.focus==='revenue')quantity=money()<scenario.after_quantity?1:2;
    const price=choose(money,[18500,19000,19500,20000,20500]);
    const rate=choose(money,[0,0.025,0.05,0.075,0.1,0.125])+(after?scenario.after_discount:0);
    const discount=Math.round(price*quantity*rate/10)*10,net=price*quantity-discount;
    const delayDays=state==='granted'&&delay()<0.29?integer(delay,1,3):0;
    let purchaseVisit=visit;
    if(delayDays){
     const returnTime=time+delayDays*dayMs+integer(delay,15,360)*60000;
     purchaseVisit=add('T17',{event_id:id+'-Return-'+(counters.T17||0),event_time:stamp(returnTime),event_name:'page_view',site_ref:id+'-Site-KR',session_ref:id+'-Session-'+(counters.T17||0),user_pseudo_ref:customer.id,page_ref:id+'-Landing-P1A',device:devices()<0.2?(device==='mobile'?'desktop':'mobile'):device,traffic_source:'direct',traffic_medium:'direct',utm_campaign:campaign.campaign_id,consent_state:'granted',event_parameters:[{name:'paid_touch_role',value:'conversion_return'}],related_record_ids:[visit.record_id,campaign.record_id]},{timestamp_field:'event_time'});
     eventTime=returnTime+integer(delay,1,15)*60000;
     commerce('begin_checkout',quantity,price,{session_ref:purchaseVisit.session_ref,related_record_ids:[purchaseVisit.record_id,visit.record_id]});
    }
    eventTime+=integer(delay,2,85)*60000;
    const number=(counters.T19||0)+1,transaction=id+'-Transaction-'+number;
    const order=add('T19',{order_id:id+'-Order-'+number,line_id:id+'-Line-'+number,variant_ref:'D005-V-P1A',seller_ref:id+'-Seller-KR',ordered_at:stamp(eventTime),customer_pseudo_ref:customer?.id||id+'-OrderCustomer-'+number,quantity,unit_price:cash(price),line_discount:cash(discount),line_tax:cash(net/10),line_gross_total:cash(net*1.1),financial_status:'paid',fulfilment_status:choose(money,['shipped','delivered','processing']),transaction_ref:transaction,acquisition_ref:visit.record_id,related_record_ids:[visit.record_id,purchaseVisit.record_id].filter((value,i,array)=>array.indexOf(value)===i)},{timestamp_field:'ordered_at'});
    orders.push(order);
    commerce('purchase',quantity,price,{transaction_ref:transaction,session_ref:purchaseVisit.session_ref,related_record_ids:[purchaseVisit.record_id,order.record_id]});
   }
  }
  const byId=new Map(rows.map(row=>[row.record_id,row]));
  for(let index=0;index<28;index++)for(const campaign of campaigns){
   const date=day(epoch+index*dayMs),rng=random(id+'|'+index+'|'+campaign.channel+'|media'),after=index>=14;
   const visits=paidVisits.filter(visit=>visit.event_time.startsWith(date)&&visit.utm_campaign===campaign.campaign_id);
   const sold=orders.filter(order=>{const visit=byId.get(order.acquisition_ref);return visit.event_time.startsWith(date)&&visit.utm_campaign===campaign.campaign_id;});
   const totalClicks=visits.length+integer(rng,3,17),cpc=(campaign.channel==='search'?490:350)*(0.86+rng()*0.3)*(after?scenario.after_cpc[campaign.channel]:1);
   const spend=Math.round(totalClicks*cpc),ctr=(0.032+rng()*0.032)*(after?scenario.after_ctr:1),impressions=Math.round(totalClicks/ctr);
   const mobileVisits=visits.filter(visit=>visit.device==='mobile').length;
   const mobileClicks=mobileVisits+integer(rng,0,totalClicks-visits.length),mobileSpend=Math.round(spend*(0.45+rng()*0.3));
   const mobileImpressions=Math.max(mobileClicks,Math.min(impressions-(totalClicks-mobileClicks),Math.round(impressions*(0.46+rng()*0.28))));
   const parent=add('T13',{platform:campaign.platform,account_id:campaign.account_id,campaign_ref:campaign.campaign_id,entity_level:'campaign',entity_id:campaign.campaign_id,period:period(date),metrics:{impressions,clicks:totalClicks,spend:cash(spend),attributed_conversions:sold.length,attributed_value:cash(sold.reduce((sum,order)=>sum+netOf(order),0))},report_state:'final',conversion_definition_ref:id+'-PurchaseDefinition',attribution_model:'last_click',attribution_window:'7_days',related_record_ids:[campaign.record_id]},interval('day'));
   for(const device of ['mobile','desktop']){
    const selected=sold.filter(order=>byId.get(order.acquisition_ref).device===device);
    add('T14',{campaign_ref:campaign.campaign_id,period:period(date),breakdown_dimensions:[{name:'device',value:device}],report_definition_ref:id+'-DevicePartition',audience_basis:'observed_aggregate',parent_report_ref:parent.record_id,metrics:{impressions:device==='mobile'?mobileImpressions:impressions-mobileImpressions,clicks:device==='mobile'?mobileClicks:totalClicks-mobileClicks,spend:cash(device==='mobile'?mobileSpend:spend-mobileSpend),attributed_conversions:selected.length,attributed_value:cash(selected.reduce((sum,order)=>sum+netOf(order),0))},related_record_ids:[parent.record_id]},interval('day'));
   }
  }
  const adjustments=random(id+'|adjustments'),adjusted=new Set();
  const adjust=(order,kind,status,fraction,delayDays,representative)=>{
   const time=Date.parse(order.ordered_at)+delayDays*dayMs+integer(adjustments,30,400)*60000,amount=Math.round(netOf(order)*fraction*100)/100;
   const row=add('T20',{adjustment_id:id+'-Adjustment-'+((counters.T20||0)+1),adjustment_kind:kind,order_ref:order.order_id,order_line_ref:order.line_id,requested_at:stamp(time),...(status==='completed'?{processed_at:stamp(time+integer(adjustments,20,180)*60000)}:{}),quantity:fraction===1?order.quantity:Math.min(1,order.quantity),...(kind!=='return'?{refund_amount:cash(amount)}:{}),reason_code:choose(adjustments,['sim_changed_mind','sim_packaging_issue','sim_delivery_delay','sim_duplicate_order','sim_discount_query']),reason_text:'승인된 가상 가정의 처리 사유, 실제 고객 원인이나 실측 품질 아님. 금전액은 세금과 배송비 제외 상품금액.',status,restocked:status==='completed'&&kind==='return'?choose(adjustments,[true,false]):null,related_record_ids:[order.record_id,...(representative?[representative.record_id]:[])]},{timestamp_field:'requested_at'});
   if(kind!=='return'&&status==='completed'){
    // Status is the latest ledger state; the evaluator uses processing timestamps for as-of money.
    order.financial_status=fraction===1?'refunded':'partially_refunded';
    if(kind==='refund')add('T18',{event_id:id+'-RefundEvent-'+row.adjustment_id,item_index:0,event_time:row.processed_at,event_name:'refund',variant_ref:order.variant_ref,quantity:row.quantity,unit_price:cash(amount/row.quantity),session_ref:null,transaction_ref:order.transaction_ref,campaign_ref:byId.get(order.acquisition_ref).utm_campaign,measurement_basis:'confirmed_product_refund_ex_tax_shipping',related_record_ids:[order.record_id,row.record_id]},{timestamp_field:'event_time'});
   }
   return row;
  };
  for(const order of orders){
   const after=byId.get(order.acquisition_ref).event_time.slice(0,10)>='2026-08-17';
   if(adjustments()>(after?scenario.after_adjustment:0.09))continue;
   adjusted.add(order.record_id);
   const kind=adjustments()<0.22?'cancel':'refund',status=adjustments()<0.14?'pending':'completed',fraction=choose(adjustments,[0.25,0.5,1,1]);
   const refund=adjust(order,kind,status,fraction,integer(adjustments,1,12));
   if(kind==='refund'&&status==='completed'&&adjustments()<0.23)adjust(order,'return','completed',fraction,14,refund);
  }
  // Independently sampled ledger cases guarantee the explicitly approved edge coverage.
  const edgeOrders=orders.filter(order=>!adjusted.has(order.record_id));
  const take=()=>edgeOrders.splice(integer(adjustments,0,edgeOrders.length-1),1)[0];
  const partial=take();adjust(partial,'refund','completed',0.25,2);adjust(partial,'refund','completed',0.25,5);
  const aliasOrder=take(),refund=adjust(aliasOrder,'refund','completed',1,3);adjust(aliasOrder,'return','completed',1,5,refund);
  adjust(take(),'refund','pending',0.5,2);adjust(take(),'cancel','pending',1,1);
  const late=take(),lateDays=Math.max(20,Math.ceil((Date.parse(spec.default_as_of)-Date.parse(late.ordered_at))/dayMs)+2);adjust(late,'refund','completed',0.5,lateDays);
  const textRng=random(id+'|feedback-text'),usedTexts=new Set();
  const text=(topic,type)=>{
   let value;
   do{value=choose(textRng,openings)+' '+topics[topic][type==='T24'?0:1]+' '+choose(textRng,endings);}while(usedTexts.has(value));
   usedTexts.add(value);return value;
  };
  for(let index=0;index<28;index++){
   const rng=random(id+'|'+index+'|feedback');
   for(const type of ['T24','T26'])for(let j=0,n=integer(rng,0,3);j<n;j++){
    const time=epoch+index*dayMs+integer(rng,6*60,23*60+50)*60000;
    const eligible=orders.filter(order=>Date.parse(order.ordered_at)<time-(type==='T24'?3:0.03)*dayMs);
    const order=eligible.length&&rng()<0.7?choose(rng,eligible):null,topic=integer(rng,0,topics.length-1),body=text(topic,type);
    if(type==='T24')add('T24',{review_id:id+'-Review-'+((counters.T24||0)+1),review_subject_type:'product',subject_ref:'P1A',written_at:stamp(time),language:'ko',body_text:body,rating_value:[2,2,4,4,4,3,2,3,5,4,3,4][topic],rating_scale_max:5,verified_purchase:order?true:null,invited_review:choose(rng,[null,false,true]),related_record_ids:order?[order.record_id]:[]},{timestamp_field:'written_at'});
    else{
     const resolved=rng()<0.57;
     add('T26',{ticket_id:id+'-Ticket-'+((counters.T26||0)+1),created_at:stamp(time),...(resolved?{resolved_at:stamp(time+integer(rng,60,2000)*60000)}:{}),channel:choose(rng,['email','chat','web_form']),subject:choose(rng,['제품 안내 확인','구매 조건 문의','주문 관련 확인'])+' (가상)',message_text:body,status:resolved?'resolved':'open',product_ref:'P1A',link_status:order?'confirmed':'unlinked',...(order?{order_ref:order.order_id,related_record_ids:[order.record_id]}:{})},{timestamp_field:'created_at'});
    }
   }
  }
  const profile={scenario_id:scenario.scenario_id,product_id:'P1A',currency:'KRW',scope_ids:{KR:[scope]},baseline:{start:spec.start,end:'2026-08-17'},observed:{start:'2026-08-17',end:spec.end},revenue_basis:spec.revenue_basis,adjustment_links:spec.adjustment_links,attribution_date_basis:'paid_touch_date',purchase_timing:'within_window',attribution_model:'last_click',attribution_window:'7_days',default_as_of:spec.default_as_of,coverage:'Synthetic complete declared paid-touch sample and explicitly linked direct returns, not all site traffic; streams and assumptions in roas-diversity-spec.mjs',counts:{...counters},approval_spec_sha256:specHash};
  const visitMap=new Map(rows.filter(row=>row.dataset_type==='T17').map(row=>[row.record_id,row]));
  diagnostics.cases[scenario.scenario_id]={rows:rows.length,counts:{...counters},paidSessions:paidVisits.length,returnSessions:counters.T17-paidVisits.length,paidSessionsByDay:distribution(paidVisits,row=>row.event_time.slice(0,10)),visitHours:distribution(paidVisits,row=>row.event_time.slice(11,13)),devices:distribution(paidVisits,row=>row.device),consent:distribution(paidVisits,row=>row.consent_state),knownVisitors:new Set(paidVisits.map(row=>row.user_pseudo_ref).filter(Boolean)).size,quantity:distribution(orders,row=>row.quantity),purchaseDelayDays:distribution(orders,row=>Math.floor((Date.parse(row.ordered_at)-Date.parse(visitMap.get(row.acquisition_ref).event_time))/dayMs)),uniqueFeedbackTexts:usedTexts.size};
  for(const row of rows){const result=validRecord(row);assert(result.conforming,row.record_id+': '+JSON.stringify(result.errors));}
  profiles.push(profile);records.push(...rows);counts[scenario.scenario_id]={...counters};
 }
 assert(records.length<=spec.max_records,'approved_record_cap_exceeded');
 const ids=new Set(records.map(row=>row.record_id));assert.equal(ids.size,records.length,'duplicate_record_id');
 for(const row of records)for(const ref of row.related_record_ids||[])assert(ids.has(ref),'missing_generated_reference:'+ref);
 return {spec,profiles,records,counts,diagnostics};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=generateDiverseCases();
 console.log(JSON.stringify({specHash,records:result.records.length,diagnostics:result.diagnostics},null,2));
}
