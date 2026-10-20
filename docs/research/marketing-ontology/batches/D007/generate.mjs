import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {local} from '../D003B/generate.mjs';
import {here,version,seed,counts,countries,zones,products,profiles,unitBase,months,days,nextDay,nextMonth,
 random,stratified,money,minor,sha,fileSha,relative,inputHashes,requireApproval,checkSpec} from './spec.mjs';
import {compose,rating} from './text.mjs';

export function generate(approvalFile,createdAt){
 requireApproval(approvalFile);checkSpec();assert.ok(Number.isFinite(Date.parse(createdAt)),'createdAt required for replay');
 const rows=Object.fromEntries(Object.keys(counts).map(t=>[t,[]])),ledger=[],definitions=new Map(),textSpans=new Map();
 const entity=(kind,id,definition=kind+' in the explicit D007 synthetic sample')=>{
  if(!definitions.has(id))definitions.set(id,{id,kind,definition,version,is_synthetic:true,available_at:createdAt});
  else assert.equal(definitions.get(id).kind,kind,'entity namespace collision: '+id);
  return id;
 };
 const ref=(kind,key)=>entity(kind,`D007-${kind}-${key}`);
 const variant=p=>entity('Variant','D005-V-'+p,'Existing D005 single 300 ml variant; source: D005 T01, product '+p);
 for(const p of products){entity('Product',p,'Existing D003B product identity');entity('Brand','B'+p[1],'Existing D003B brand identity');variant(p);}
 for(const c of countries)entity('Region',c,'Synthetic country scope; not population completeness');
 const metric=(id,value,unit='count')=>{
  entity('MetricDefinition',id,id+'; same scope, definition, currency and compatible window required for aggregation');
  return {metric_id:id,value,unit,availability:value===null?'missing':'available',definition_version:version};
 };
 const period=(c,start='2026-08-03',end='2026-08-31',grain='custom')=>({start,end_exclusive:end,timezone:zones[c],grain});
 const month=(c,m)=>period(c,m,nextMonth(m),'month');
 const day=(c,d)=>period(c,d,nextDay(d),'day');
 const mm=(c,n)=>money(Math.max(0,Math.round(n)),c);
 const base=(p,c)=>Math.round(unitBase[c]*profiles[p].price);
 const seller=(c,s=0)=>ref('Seller',c+'-'+s);
 const location=(c,l=0)=>ref('Location',c+'-'+l);
 const campaign=(c,p,ch)=>ref('Campaign',c+'-'+p+'-'+ch);
 const own=['P1A','P1B'];
 function add(t,c,payload,{origin='simulation',role='detail',coverage='sample',related=[],rule='profile-conditional-synthetic-generation'}={}){
  const id=`D007-${t}-${String(rows[t].length+1).padStart(5,'0')}`;
  const window=payload.period||payload.planned_period||payload.expected_period||payload.training_period;
  const timestamp=['observed_at','event_time','ordered_at','requested_at','written_at','changed_at','created_at','published_at','sent_at','incident_start','valid_from','started_at'].find(k=>payload[k]);
  const temporal={time_kind:window?'interval':t==='T39'?'model':['T02','T16'].includes(t)?'validity':'instant',source_grain:window?.grain||'instant',
   series_role:role,calendar_id:'Gregorian',reporting_timezone:zones[c],coverage_kind:coverage,available_at:createdAt,revision:0};
  if(window)temporal.period_field=['period','planned_period','expected_period','training_period'].find(k=>payload[k]);
  else if(timestamp)temporal.timestamp_field=timestamp;
  const record={record_id:id,dataset_type:t==='H01'?'H01':t,scope_id:`D007-${c}-sample`,scenario_id:'D007-expansion',is_synthetic:true,value_origin:origin,
   provenance:{system:version,collection_method:'synthetic_generation',source_record_key:id,artifact_ref:relative(path.join(here,'source',t+'.jsonl')),
    collected_at:createdAt,access_class:'internal',documentation_refs:[relative(path.join(here,'README.md'))]},
   quality:{availability:'available',coverage:'Approved synthetic sample; distinct from D003B/D005/D006 independent samples',is_partial:true},temporal,
   ...(related.length?{related_record_ids:[...new Set(related)]}:{}),...payload};
  rows[t].push(record);ledger.push({record_id:id,country:c,rule,parents:[...new Set(related)],created_at:createdAt});return record;
 }

 // Campaigns and product/region price series share causes, never fixed outcome ratios.
 const campaigns=[];
 for(const c of countries)for(const p of own)for(const ch of ['search','social']){
  const id=campaign(c,p,ch);
  campaigns.push(add('T12',c,{platform:'synthetic_'+ch,account_id:ref('Account',c),campaign_id:id,objective:'synthetic_purchases',status:'active',
   period:period(c,months[0],'2026-10-01'),product_refs:[p],channel:ch,budget_amount:mm(c,unitBase[c]*100),budget_period:'daily',
   bidding_strategy:'synthetic_bounded',target_definition:`가상 ${c} ${p} 표본; 다른 국가·제품·표본으로 확대하지 않음`,landing_ref:ref('LandingPage',c+'-'+p)}));
 }
 const monthlyMarket=new Map();
 for(const c of countries)for(let m=0;m<24;m++){
  const observed=[];
  for(let pi=0;pi<6;pi++){
   const p=products[pi],q=profiles[p],season=Math.sin(m*Math.PI/6+(c==='JP'?1:0)+pi*.35);
   const interaction=c==='JP'?(p==='P1A'?-.32:p==='P2A'?.25:0):c==='US'?(p==='P1A'?.28:p==='P2A'?-.22:0):0;
   const units=Math.round((1400+pi*130)*(1+q.growth*m/23+season*.18+interaction*(m>17?1:.1))*(.85+.3*random(p+c+m)));
   const price=Math.round(base(p,c)*(1+.06*Math.sin(m/4+pi)));
   observed.push({p,units,price,value:units*price});
  }
  const total=observed.reduce((s,r)=>s+r.value,0)*2;
  for(const r of observed){
   const row=add('T03',c,{subject_ref:r.p,period:month(c,months[m]),region_ref:c,retail_channel:'synthetic_panel',coverage_id:ref('Coverage',c+'-market'),
    measurement_method:'panel_projected',units_sold:r.units,sales_value:mm(c,r.value),market_total_value:mm(c,total),projection_version:version},{role:'baseline'});
   monthlyMarket.set(c+r.p+m,row);
  }
 }
 for(const c of countries)for(const p of own)for(let m=0;m<24;m++){
  const market=monthlyMarket.get(c+p+m),gross=Math.round(market.units_sold*(.25+.08*random('historic'+c+p+m))),returned=Math.floor(gross*(.01+.05*random('returns'+c+p+m)));
  const unit=Number(minor(market.sales_value))/market.units_sold;
  const grossValue=Math.round(gross*unit),returnValue=Math.round(returned*unit);
  add('H01',c,{report_kind:'sales',subject_ref:p,period:month(c,months[m]),measures:[metric('D007.gross_units',gross),metric('D007.returned_units',returned),
   metric('D007.net_units',gross-returned),metric('D007.gross_sales',mm(c,grossValue),'money'),metric('D007.returns_value',mm(c,returnValue),'money'),metric('D007.net_sales',mm(c,grossValue-returnValue),'money')],
   metric_definition_refs:['D007.gross_units','D007.returned_units','D007.net_units','D007.gross_sales','D007.returns_value','D007.net_sales'],reconciliation:'no_detail'},
   {origin:'derived_calculation',role:'baseline',related:[market.record_id],rule:'historical-independent-sales-sample; not a sum of 28-day orders'});
 }
 const promotions=new Map(),offers=new Map();
 for(const c of countries)for(let pi=0;pi<6;pi++)for(let s=0;s<3;s++){
  const p=products[pi],start=days[2+(pi+s)%8],end=days[15+(pi+s)%9],ratio=[.05,.10,.15,.20][(pi+s)%4];
  const promo=add('T09',c,{promotion_id:ref('Promotion',c+p+s),product_refs:[p],seller_ref:seller(c,s),period:period(c,start,end),
   promotion_type:'percent_discount',discount_ratio:ratio,eligibility_text:'지정 가상 판매처·제품·기간에만 적용하는 표본 할인'});
  promotions.set(c+p+s,promo);
 }
 function quantity(p,c,d,l){
  const i=days.indexOf(d),out=(p==='P1A'&&c==='JP'&&i>=9&&i<15)||(p==='P1B'&&c==='US'&&l===1&&i>=18&&i<21);
  return out?0:Math.round(50+600*random('stock'+p+c+d+l));
 }
 const stocks=new Map();
 for(const c of countries)for(const p of own)for(let l=0;l<2;l++)for(const d of days){
  const available=quantity(p,c,d,l),committed=Math.round(10+40*random('committed'+p+c+d+l));
  const r=add('T22',c,{variant_ref:variant(p),location_ref:location(c,l),observed_at:local(c,d,9),available_quantity:available,
   committed_quantity:committed,on_hand_quantity:available+committed,sellable_status:available?'sellable':'out_of_stock'});
  stocks.set(c+p+l+d,r);
 }
 for(const c of countries)for(let pi=0;pi<6;pi++)for(let s=0;s<3;s++)for(let di=0;di<28;di++){
  const p=products[pi],d=days[di],promo=promotions.get(c+p+s),regular=Math.round(base(p,c)*(1+(s-1)*.045));
  const discounted=d>=promo.period.start&&d<promo.period.end_exclusive,price=discounted?Math.floor(regular*(100-Math.round(promo.discount_ratio*100))/100):regular;
  const stock=own.includes(p)?[stocks.get(c+p+0+d),stocks.get(c+p+1+d)]:[];
  const availability=stock.length?(stock.some(r=>r.available_quantity>0)?'in_stock':'out_of_stock'):'unknown';
  const r=add('T08',c,{offer_id:ref('Offer',c+p+s),variant_ref:variant(p),seller_ref:seller(c,s),observed_at:local(c,d,10),listed_price:mm(c,price),regular_price:mm(c,regular),
   ...(discounted?{sale_price:mm(c,price)}:{}),availability,tax_included:null,shipping_included:null,pack_quantity:{amount:300,unit:'ml'}},
   {related:[...(discounted?[promo.record_id]:[]),...stock.map(r=>r.record_id)]});
  offers.set(c+p+s+d,r);
 }
 for(const c of countries)for(const p of products)for(let s=0;s<3;s++){
  const promo=promotions.get(c+p+s);
  for(const d of [promo.period.start,promo.period.end_exclusive]){
   const previous=offers.get(c+p+s+new Date(Date.parse(d)-86400000).toISOString().slice(0,10)),current=offers.get(c+p+s+d);
   assert.ok(previous&&current);
   add('T35',c,{change_id:ref('Change',c+p+s+d),entity_ref:current.offer_id,changed_at:current.observed_at,operation:'update',changed_field:'listed_price',
    before_value:previous.listed_price,after_value:current.listed_price,client_type:'synthetic_internal_log',reason_text:'동일 가상 offer의 할인 시작 또는 종료에 따른 관측 가격 변경'},
    {origin:'derived_calculation',related:[previous.record_id,current.record_id,promo.record_id]});
  }
 }
 function adMetrics(c,p,ch,d,i,n,monthly=false){
  const q=profiles[p],impressions=Math.round((monthly?65000:2300)*(0.6+1.0*stratified(c+p+ch+'-reach-'+n,i,n)));
  const season=1+.18*Math.sin(i*.8+(c==='US'?2:0));
  const ctr=q.ctr*(ch==='social'?1.18:.9)*season*(.65+.7*stratified(c+p+ch+'-ctr-'+n,i,n));
  const clicks=Math.round(impressions*ctr),out=!monthly&&[0,1].every(l=>quantity(p,c,d,l)===0);
  const cvr=out?0:q.cvr*(ch==='search'?1.2:.7)*(.6+.8*stratified(c+p+ch+'-cvr-'+n,i,n));
  const conversions=Math.round(clicks*cvr),cpc=Math.round(unitBase[c]*(ch==='search'?.033:.023)*(.7+.6*random('cpc'+c+p+ch+i+n)));
  return {impressions,clicks,spend:mm(c,clicks*cpc),attributed_conversions:conversions,attributed_value:mm(c,conversions*base(p,c))};
 }
 for(const ca of campaigns){
  const c=ca.scope_id.split('-')[1],p=ca.product_refs[0],ch=ca.channel;
  const specifics=[];
  for(let i=0;i<28;i++){
   const missing=c==='JP'&&p==='P1A'&&ch==='social'&&[23,24].includes(i),d=days[i];
   const metrics=missing?{impressions:null,clicks:null,spend:null,attributed_conversions:null,attributed_value:null}:adMetrics(c,p,ch,d,i,28);
   const r=add('T13',c,{platform:ca.platform,account_id:ca.account_id,campaign_ref:ca.campaign_id,entity_level:'campaign',entity_id:ca.campaign_id,
    period:day(c,d),metrics,report_state:'final',conversion_definition_ref:ref('ConversionDefinition',c+'-purchase'),attribution_model:'last_click',attribution_window:'7_days'},
    {origin:'platform_attributed',coverage:missing?'partial':'sample',related:[ca.record_id]});
   if(missing){r.quality.availability='missing';r.quality.reason='synthetic collection gap, not zero activity';}
   specifics.push(r);
   const fraction=.35+.4*random('device'+r.record_id);
   const first={};const second={};
   for(const [k,v] of Object.entries(metrics)){
    if(v===null){first[k]=null;second[k]=null;}
    else if(typeof v==='object'){const n=Number(minor(v)),a=Math.floor(n*fraction);first[k]=mm(c,a);second[k]=mm(c,n-a);}
    else {first[k]=Math.floor(v*fraction);second[k]=v-first[k];}
   }
   for(const [device,values] of [['mobile',first],['desktop',second]])add('T14',c,{campaign_ref:ca.campaign_id,period:r.period,
    breakdown_dimensions:[{name:'device',value:device}],report_definition_ref:ref('ReportDefinition','device-disjoint-partition'),metrics:values,audience_basis:'observed_aggregate',parent_report_ref:r.record_id},
    {origin:'derived_calculation',related:[r.record_id]});
  }
  for(let i=0;i<24;i++){
   let metrics=adMetrics(c,p,ch,months[i],i,24,true);
   if(months[i]==='2026-08-01'){
    // Three days outside the 28-day sample are explicit scalar residuals, not hidden events.
    const residualDays=31-specifics.filter(r=>r.metrics.impressions!==null).length,residual=adMetrics(c,p,ch,'2026-08-01',0,residualDays);
    metrics={};for(const k of ['impressions','clicks','attributed_conversions'])metrics[k]=specifics.reduce((s,r)=>s+(r.metrics[k]??0),0)+residual[k]*residualDays;
    for(const k of ['spend','attributed_value'])metrics[k]=mm(c,specifics.reduce((s,r)=>s+(r.metrics[k]?Number(minor(r.metrics[k])):0),0)+Number(minor(residual[k]))*residualDays);
   }
   const monthly=add('T13',c,{platform:ca.platform,account_id:ca.account_id,campaign_ref:ca.campaign_id,entity_level:'campaign',entity_id:ca.campaign_id,period:month(c,months[i]),metrics,report_state:'final',
    conversion_definition_ref:ref('ConversionDefinition',c+'-purchase'),attribution_model:'last_click',attribution_window:'7_days'},
    {origin:'platform_attributed',role:'baseline',related:[ca.record_id,...(months[i]==='2026-08-01'?specifics.map(r=>r.record_id):[])],rule:months[i]==='2026-08-01'?'monthly-total-with-explicit-unobserved-residual':'independent-monthly-report'});
   if(months[i]==='2026-08-01'){
    const residualDays=31-specifics.filter(r=>r.metrics.impressions!==null).length;
    ledger.find(x=>x.record_id===monthly.record_id).aggregation={known_detail_ids:specifics.filter(r=>r.metrics.impressions!==null).map(r=>r.record_id),residual_days:residualDays,
     residual_per_day:adMetrics(c,p,ch,'2026-08-01',0,residualDays),residual_basis:'3 days outside detail window plus missing daily reports; scalar assumption, not hidden source rows'};
   }
  }
 }
 const orders=[],orderRecords=new Map();
 for(const c of countries)for(let i=0;i<400;i++){
  const p=own[i%2],index=Math.floor(i/2)%28,d=days[c==='JP'&&index>=9&&index<15?15:index],orderIndex=Math.floor(i/4)*3+Math.max(0,i%4-1),order=ref('Order',c+'-'+orderIndex),transaction=ref('Transaction',c+'-'+orderIndex);
  const quantity=1+(i%7===0?1:0),price=offers.get(c+p+0+d).listed_price,discount=i%9===0?Math.floor(Number(minor(price))*.03):0,tax=0;
  const total=Number(minor(price))*quantity-discount+tax;
  const customerKey=(orderIndex%48)+'-'+(Math.floor(orderIndex/48)%(2+(orderIndex%48)%6));
  const r=add('T19',c,{order_id:order,line_id:ref('OrderLine',c+'-'+i),variant_ref:variant(p),seller_ref:seller(c,0),ordered_at:local(c,d,14),customer_pseudo_ref:ref('Customer',c+'-'+customerKey),
   quantity,unit_price:price,line_discount:mm(c,discount),line_tax:mm(c,tax),line_gross_total:mm(c,total),financial_status:'paid',fulfilment_status:'fulfilled',transaction_ref:transaction},
   {related:[offers.get(c+p+0+d).record_id],rule:'order-line-price-from-own-seller-offer; tax unknown excluded, no purchase verified review inferred'});
  orders.push(r);if(!orderRecords.has(order))orderRecords.set(order,[]);orderRecords.get(order).push(r);
 }
 for(const c of countries){
  const lines=orders.filter(r=>r.scope_id.includes('-'+c+'-'));
  for(let i=0;i<40;i++){
   const r=lines[i*9],p=r.variant_ref.endsWith('P1A')?'P1A':'P1B',d=r.ordered_at.slice(0,10),completed=i%4!==0,kind=i%4===0?'cancel':i%4===1?'return':'refund';
   const payload={adjustment_id:ref('Adjustment',c+'-'+i),adjustment_kind:kind,order_ref:r.order_id,order_line_ref:r.line_id,requested_at:local(c,nextDay(d),12),
    ...(completed?{processed_at:local(c,nextDay(nextDay(d)),12)}:{}),quantity:1,reason_code:['changed_mind','packaging','delivery','usage'][i%4],status:completed?'completed':'pending',restocked:null};
   if(kind==='refund')payload.refund_amount=mm(c,Math.floor(Number(minor(r.line_gross_total))/r.quantity));
   const adjustment=add('T20',c,payload,{related:[r.record_id]});
   if(kind==='refund'&&completed)r.financial_status=Number(minor(payload.refund_amount))===Number(minor(r.line_gross_total))?'refunded':'partially_refunded';
   if(completed&&kind==='refund')add('T18',c,{event_id:ref('WebEvent','refund-'+c+'-'+i),item_index:0,event_time:payload.processed_at,event_name:'refund',variant_ref:variant(p),quantity:1,
    session_ref:null,measurement_basis:'synthetic_web_item_event',transaction_ref:r.transaction_ref,unit_price:r.unit_price},{related:[r.record_id,adjustment.record_id]});
  }
 }
 for(const r of orders){
  const c=r.scope_id.split('-')[1];
  add('T18',c,{event_id:ref('WebEvent','purchase-'+r.line_id),item_index:orderRecords.get(r.order_id).indexOf(r),event_time:r.ordered_at,event_name:'purchase',variant_ref:r.variant_ref,quantity:r.quantity,
   session_ref:null,measurement_basis:'synthetic_web_item_event',transaction_ref:r.transaction_ref,unit_price:r.unit_price},{related:[r.record_id]});
 }
 for(let n=0;n<2800;n++){
  const c=countries[n%3],p=own[Math.floor(n/3)%2],d=days[Math.floor(n/6)%28],denied=n%7===0;
  add('T17',c,{event_id:ref('WebEvent','visit-'+n),event_time:local(c,d,10+n%3),event_name:n%5===0?'engagement':'page_view',site_ref:ref('Site',c),
   session_ref:denied?null:ref('Session',n),user_pseudo_ref:denied?null:ref('Visitor',Math.floor(n/3)),page_ref:ref('LandingPage',c+'-'+p),device:n%3===0?'desktop':'mobile',
   traffic_source:['search','social','direct','email'][Math.floor(n/6)%4],consent_state:denied?'denied':'granted'});
 }
 const remaining=counts.T18-rows.T18.length;
 for(let n=0;n<remaining;n++){
  const visit=rows.T17[n%rows.T17.length],c=visit.scope_id.split('-')[1],p=own[Math.floor(n/3)%2];
  add('T18',c,{event_id:ref('WebEvent','funnel-'+n),item_index:0,event_time:visit.event_time,event_name:['view_item','add_to_cart','begin_checkout'][Math.floor(n/6)%3],variant_ref:variant(p),quantity:1,
   session_ref:visit.session_ref,measurement_basis:'synthetic_web_item_event'},{related:[visit.record_id]});
 }
 for(const c of countries){
  const grouped=[...orderRecords.values()].filter(v=>v[0].scope_id.includes('-'+c+'-'));
  for(let i=0;i<260;i++){
   const group=grouped[i],r=group[0],d=r.ordered_at.slice(0,10),late=i%9===0,inTransit=i%10===0;
   for(const line of group)line.fulfilment_status=inTransit?'shipped':'fulfilled';
   add('T23',c,{record_kind:'fulfilment',order_ref:r.order_id,promised_at:local(c,nextDay(nextDay(d)),18),shipped_at:local(c,nextDay(d),16),
    ...(!inTransit?{delivered_at:local(c,late?nextDay(nextDay(nextDay(d))):nextDay(nextDay(d)),17)}:{}),status:inTransit?'in_transit':'delivered',location_ref:location(c,i%2)},{related:group.map(r=>r.record_id)});
  }
  for(let i=0;i<40;i++)add('T23',c,{record_kind:'distribution',product_ref:products[Math.floor(i/24)*3+i%3],period:month(c,months[i%24]),retail_channel:'synthetic_retail_sample',
   distribution_measures:[metric('D007.stockists',20+i%37),metric('D007.target_stockists',80)]});
 }
 for(const c of countries)for(let pi=0;pi<6;pi++)for(let i=0;i<100;i++){
  const p=products[pi],n=countries.indexOf(c)*600+pi*100+i,d=days[i%28],text=compose('review',n,p);
  const r=add('T24',c,{review_id:ref('Review',c+p+i),review_subject_type:'product',subject_ref:p,written_at:local(c,d,15),language:'ko',body_text:text.body,
   rating_value:rating(p,c,i),rating_scale_max:5,verified_purchase:null,invited_review:null});
  textSpans.set(r.record_id,text.spans);
 }
 for(let n=0;n<2400;n++){
  const review=rows.T24[n%1800],spans=textSpans.get(review.record_id),span=spans[n<1800?0:1],c=review.scope_id.split('-')[1];
  add('T25',c,{record_kind:'annotation',subject_ref:review.subject_ref,aspect_ref:entity('Aspect',span.aspect),sentiment:span.sentiment,definition_version:version,
   assessment_status:'provided',review_ref:review.record_id,evidence_span:{record_ref:review.record_id,field_path:'$.body_text',quote:span.quote,language:'ko',start_offset:span.start,end_offset:span.end},extractor_version:'D007-rule-annotations-1'},
   {origin:'simulation',related:[review.record_id],rule:'synthetic-rule-annotation; not human review or LLM extraction'});
 }
 // Remaining smaller datasets use balanced country cycles; no fabricated supplier data.
 for(let n=0;n<108;n++){
  const c=countries[n%3],p=products[Math.floor(n/3)%6],i=Math.floor(n/18),m=months[i*4];
  const panel=ref('Cohort','panel-'+c+p+i),sample=80+Math.floor(stratified('panel-size',n,108)*320),yes=Math.round(sample*(.25+.55*random('panel'+n)));
  add('T04',c,{panel_id:ref('Panel',c),cohort_id:panel,subject_ref:p,period:period(c,m,nextMonth(months[i*4+3])),sample_size:sample,weighting_method:'unweighted',
   measures:[metric('D007.panel_positive_count',yes),metric('D007.panel_positive_rate',yes/sample,'ratio')]});
  add('T32',c,{study_id:ref('Study',c+p+i),subject_ref:p,period:period(c,m,nextMonth(months[i*4+3])),question_text:'이 가상 표본에서 사용 경험에 만족하셨습니까?',
   measure_definition:'positive=count of yes; denominator=sample_size; separate from panel definition',cohort_ref:ref('Cohort','survey-'+c+p+i),sample_size:sample,response_scale:'yes/no',
   measures:[metric('D007.survey_positive_count',Math.round(sample*(.2+.6*random('survey'+n)))),metric('D007.survey_sample_size',sample)],sampling_method:'synthetic_balanced_quota',uncertainty_text:'실제 모집단 추정이나 유의성 보장이 아닌 가상 표본'});
  add('T10',c,{advertiser_ref:entity('Brand','B'+p[1]),public_ad_id:ref('PublicAd',n),observed_at:local(c,days[n%28],12),format:['text','image','video'][Math.floor(n/3)%3],
   creative_text:compose('document',n,p).body,served_regions:[c],coverage_text:'독립적인 가상 공개 광고 표본; 경쟁사 전환·매출은 제공하지 않음'});
 }
 for(let n=0;n<108;n++){
  const c=countries[n%3],p=products[Math.floor(n/3)%6],kind=['external_id','alias'][Math.floor(n/18)%2];
  add('T02',c,{mapping_kind:kind,entity_type:'variant',entity_ref:variant(p),external_system:'synthetic_catalog_'+Math.floor(n/36),external_value:`가상-${c}-${p}-${Math.floor(n/18)}`,
   country_code:c,language:'ko',match_status:n%9===0?'candidate':'confirmed',valid_from:months[0]});
 }
 for(let n=0;n<216;n++){
  const c=countries[n%3],p=products[Math.floor(n/3)%6],i=Math.floor(n/18),m=months[i*2];
  const term=ref('SearchTerm',c+p),index=Math.round(10+90*stratified('search-'+c+p,i,12));
  add('T05',c,{query_id:ref('Query',c+p),term_ref:term,term_kind:'keyword',period:period(c,m,nextMonth(months[i*2+1])),index_value:index,
   index_definition:'가상 요청창 안의 상대 관심지수; 절대 검색수와 다름',normalization_scope:ref('NormalizationScope',c+p),search_surface:'synthetic_web_search'});
  add('T06',c,{keyword:'가상 '+p+' 샴푸',language:'ko',geo_target_ref:c,period:period(c,m,nextMonth(months[i*2+1])),estimated_searches:Math.round(100+4900*stratified('demand-'+c+p,i,12)),
   competition_level:['low','medium','high'][i%3],competition_index:Math.round(15+80*random('competition'+n)),network_scope:'synthetic_search_only',low_bid:mm(c,unitBase[c]*.02),high_bid:mm(c,unitBase[c]*.08)});
 }
 for(let n=0;n<432;n++){
  const c=countries[n%3],p=own[Math.floor(n/3)%2],m=months[Math.floor(n/6)%24],impressions=Math.round(100+900*stratified('organic',n,432));
  add('T07',c,{site_ref:ref('Site',c),period:month(c,m),query:n%9===0?null:'가상 '+p+' 샴푸',page_ref:ref('LandingPage',c+'-'+p),device:Math.floor(n/144)%2?'desktop':'mobile',
   search_type:'synthetic_web_search',clicks:Math.round(impressions*(.01+.09*random('organic-click'+n))),impressions,average_position:1+Math.round(200*random('position'+n))/10,
   aggregation_scope:ref('ReportDefinition','organic-query-page-device-'+Math.floor(n/144))});
 }
 for(let n=0;n<54;n++){
  const c=countries[n%3],p=products[Math.floor(n/3)%6];
  add('T11',c,{document_id:ref('Document',n),publisher:'가상 소식 편집부',published_at:local(c,days[n%28],8),language:'ko',title:'가상 샴푸 사용 경험과 제품 안내',body_text:compose('document',n,p).body,subject_refs:[p]});
 }
 for(let n=0;n<144;n++){
  const ca=campaigns[n%12],c=ca.scope_id.split('-')[1],m=months[Math.floor(n/12)*2];
  add('T15',c,{campaign_ref:ca.campaign_id,competitor_domain:ref('AdvertiserDomain',(n%2)+2),period:month(c,m),report_surface:'synthetic_auction',impression_share:.1+.7*stratified('share',n,144),overlap_rate:.05+.6*random('overlap'+n),threshold_status:'denominator_not_provided'});
 }
 for(let n=0;n<72;n++){
  const ca=campaigns[n%12],c=ca.scope_id.split('-')[1],p=ca.product_refs[0],i=Math.floor(n/12);
  add('T16',c,{creative_id:ref('Creative',ca.campaign_id),version:String(i+1),product_refs:[p],format:'text',language:'ko',message_text:compose('document',n,p).body,
   valid_from:local(c,months[i*4]),valid_to_exclusive:local(c,i===5?'2026-10-01':months[(i+1)*4])},{related:[ca.record_id]});
 }
 for(const c of countries)for(const p of own)for(let i=0;i<24;i++)add('T21',c,{variant_ref:variant(p),period:month(c,months[i]),unit_cost:mm(c,base(p,c)*(.28+.15*random('cost'+c+p+i))),margin_definition:'세전 상품원가 기준; 미확인 부대비용 제외',accounting_basis:'synthetic_unit_cost_not_actual_supplier'});
 for(let n=0;n<180;n++){
  const r=orders[(n%3)*400+Math.floor(n/3)*6],c=r.scope_id.split('-')[1],p=r.variant_ref.slice(-3),confirmed=Math.floor(n/3)%3!==0;
  add('T26',c,{ticket_id:ref('Ticket',n),created_at:r.ordered_at,channel:['email','chat','phone'][n%3],subject:['사용 방법','배송 문의','교환 문의'][Math.floor(n/3)%3],message_text:compose('ticket',n,p).body,status:n%4===0?'open':'resolved',
   ...(n%4?{resolved_at:local(c,nextDay(r.ordered_at.slice(0,10)),16)}:{}),product_ref:p,...(confirmed?{order_ref:r.order_id}:{}),link_status:confirmed?'confirmed':'unlinked'},{related:confirmed?[r.record_id]:[]});
 }
 for(let n=0;n<108;n++){
  const c=countries[n%3],p=products[Math.floor(n/3)%6],d=days[n%28];
  add('T27',c,{content_id:ref('Content',n),platform:'synthetic_video',channel_ref:ref('Creator','channel-'+n%12),published_at:local(c,d,9),observed_at:local(c,nextDay(d),18),
   title:'가상 샴푸 사용 기록',description_text:compose('document',n,p).body,language:'ko',view_count:Math.round(100+20000*Math.pow(stratified('views',n,108),2)),product_refs:[p]});
 }
 for(let n=0;n<540;n++){
  const content=rows.T27[n%108],c=content.scope_id.split('-')[1],p=content.product_refs[0];
  add('T28',c,{comment_id:ref('Comment',n),content_ref:content.content_id,written_at:content.observed_at,body_text:compose('comment',n,p).body,language:'ko'},
   {related:[content.record_id]});
 }
 for(let n=0;n<36;n++){
  const content=rows.T27[n],c=content.scope_id.split('-')[1];
  add('T29',c,{collaboration_id:ref('Collaboration',n),creator_ref:content.channel_ref,product_refs:content.product_refs,planned_period:period(c),message_brief:'사용감의 장점과 아쉬운 점을 함께 소개하는 가상 협업',
   content_refs:[content.content_id],agreement_status:'synthetic_signed',fee:mm(c,unitBase[c]*(10+n%8)),rights_text:'가상 문서이며 실제 계약 효력 없음'},{related:[content.record_id]});
 }
 for(let n=0;n<144;n++){
  const c=countries[n%3],i=Math.floor(n/3),window=period(c),cohort=ref('Cohort',c+'-'+i),all=[...orderRecords.values()].filter(g=>g[0].scope_id.includes('-'+c+'-'));
  // Forty-eight disjoint cohorts per country, all within the actual detailed order window.
  const selected=all.filter((_,j)=>j%48===i),flat=selected.flat(),adjustments=rows.T20.filter(a=>selected.some(g=>g[0].order_id===a.order_ref)&&a.status==='completed'&&a.refund_amount);
  const customers=new Map();for(const g of selected){const customer=g[0].customer_pseudo_ref;customers.set(customer,(customers.get(customer)||0)+1);}
  const revenue=flat.reduce((s,r)=>s+Number(minor(r.line_gross_total)),0)-adjustments.reduce((s,r)=>s+Number(minor(r.refund_amount)),0);
  add('T30',c,{record_kind:'cohort',cohort_ref:cohort,period:window,sample_size:customers.size,acquisition_channel:'synthetic_partition_'+i%2,net_revenue:mm(c,revenue),
   repeat_purchase_rate:customers.size?[...customers.values()].filter(x=>x>1).length/customers.size:0},{origin:'derived_calculation',related:[...flat,...adjustments].map(r=>r.record_id),rule:'cohort-from-listed-order-customers; empty-period-is-zero-observed-orders-not-population-zero'});
  const sent=100+Math.floor(900*stratified('email',n,144)),bounces=Math.floor(sent*(.005+.03*random('bounce'+n))),clickers=Math.floor((sent-bounces)*(.01+.2*random('email-click'+n)));
  add('T31',c,{crm_campaign_id:ref('CRM',n),segment_ref:cohort,sent_at:local(c,window.start,12),period:window,emails_sent:sent,bounces,unique_clickers:clickers,unsubscribes:Math.floor((sent-bounces)*.01*random('unsub'+n)),
   open_measurement_basis:'not_collected',unique_opens:null,linked_orders:[]},{rule:'independent-email-recipient-sample; no causal revenue linkage'});
 }
 for(let n=0;n<72;n++){
  const c=countries[n%3],i=Math.floor(n/3),m=months[i];
  add('T33',c,{statistics_table_id:ref('StatisticsTable',c),item_code:'synthetic_context_index',region_ref:c,period:month(c,m),value:Math.round(1000+150*Math.sin(i/3)+i*2)/10,unit:'index',
   definition:'가상 국가별 문맥 지수; 실제 공표 통계 아님',published_at:nextMonth(m),seasonal_adjustment:'not_adjusted'});
 }
 for(const c of countries)for(let i=0;i<28;i++){
  const d=days[i];
  add('T34',c,{record_kind:'weather',region_ref:c,period:day(c,d),station_ref:ref('WeatherStation',c),measures:[metric('D007.temperature',22+10*Math.sin(i/8+countries.indexOf(c)),'C'),metric('D007.precipitation',i%4===0?Math.round(40*random('rain'+c+i)):0,'mm')],observation_quality:'synthetic_context_not_meteorological_observation'});
  add('T34',c,{record_kind:'calendar',region_ref:c,period:day(c,d),event_name:i%7<2?'가상 휴무 운영':'가상 정상 운영',calendar_kind:'internal_operational_schedule_not_public_holiday'});
 }
 for(let n=0;n<216;n++){
  const c=countries[n%3],i=Math.floor(n/3),failed=i%12===0,partial=i%12===1,expected=28,received=failed?0:partial?26:28;
  add('T36',c,{run_id:ref('CollectionRun',n),target_dataset:'T13',expected_period:period(c),started_at:local(c,'2026-09-01',8),completed_at:local(c,'2026-09-01',9),
   status:failed?'failed':partial?'partial':'success',expected_count:expected,received_count:received,duplicate_count:i%11===0?2:0,missing_count:expected-received,schema_version:version,
   ...(received<expected?{error_code:failed?'synthetic_timeout':'synthetic_partial'}:{})},{rule:'independent-collection-attempt-metadata; retries are not extra observations'});
 }
 for(let n=0;n<108;n++){
  const c=countries[n%3],p=own[Math.floor(n/3)%2],i=Math.floor(n/6);
  const common={page_ref:ref('LandingPage',c+'-'+p),device:n%2?'desktop':'mobile'};
  if(i%6===0)add('T37',c,{...common,record_kind:'incident',incident_start:local(c,days[i%28],11),incident_end:local(c,days[i%28],13),status:'resolved',error_text:'가상 페이지 응답 지연 사건'});
  else add('T37',c,{...common,record_kind:'performance',period:period(c),measures:[metric('D007.lcp_p75',Math.round(1200+3000*stratified('performance',n,108)),'ms')],status:'reported'});
 }
 for(let n=0;n<36;n++){
  const c=countries[n%3],sample=100+Math.floor(400*random('experiment-size'+n)),baseRate=.03+.08*random('control'+n),delta=[.03,0,-.025][Math.floor(n/3)%3],experiment=ref('Experiment',n);
  for(const arm of ['control','treatment'])add('T38',c,{experiment_id:experiment,arm_id:arm,hypothesis_text:'가상 안내문 변경 집단과 대조 집단의 전환율을 비교한다',period:period(c),assignment_method:'synthetic_random_assignment',
   assignment_unit:'synthetic_participant',treatment_description:arm==='control'?'기존 가상 안내문':'변경된 가상 안내문',sample_size:sample,status:'completed',outcome_measures:[metric('D007.experiment_conversions',Math.round(sample*(baseRate+(arm==='treatment'?delta:0))))],
   uncertainty_text:'표본 변동과 불확실성을 포함하며 실험 성공·유의성을 보장하지 않음'});
 }
 for(let n=0;n<36;n++){
  const c=countries[n%3],i=Math.floor(n/3),model=ref('ResponseModel',n),cas=campaigns.filter(r=>r.scope_id.includes('-'+c+'-')).slice(0,2),budget=unitBase[c]*1000;
  const definition={model_ref:model,model_version:version,objective:'maximize_synthetic_conversions',assumptions:['가상 포화 반응 함수이며 학습된 실제 효과가 아님','통화·기간·국가가 다른 후보를 합치지 않음'],validity_scope:`D007-${c}-sample`};
  const saturation=unitBase[c]*(150+i*10),scale=40+i*3;
  const modelRecord=add('T39',c,{...definition,record_kind:'response_model',formula:'scale * budget / (saturation + budget)',parameters:[{name:'scale',value:String(scale)},{name:'saturation',value:String(saturation)}]});
  const ratio=[.35,.5,.65][i%3],a=Math.floor(budget*ratio),allocations=cas.map((ca,j)=>({campaign_ref:ca.campaign_id,amount:mm(c,j?budget-a:a),lower:mm(c,budget*.1),upper:mm(c,budget*.9)}));
  add('T39',c,{...definition,record_kind:'budget_scenario',scenario_id_ref:ref('BudgetScenario',n),period:period(c),total_budget:mm(c,budget),allocations,
   expected_measures:[metric('D007.expected_conversions',allocations.reduce((s,x)=>{const b=Number(minor(x.amount));return s+scale*b/(saturation+b);},0))]},
   {origin:'derived_calculation',related:[modelRecord.record_id,...cas.map(r=>r.record_id)]});
  add('T40',c,{policy_id:ref('Policy',c),version:String(i+1),period:period(c,months[i*2],nextMonth(months[i*2+1])),objective:'가상 전환수 후보 비교',kpi_definition_refs:['D007.expected_conversions'],product_refs:own,
   budget_limit:mm(c,budget),allowed_channels:['search','social'],approval_role:'synthetic_analyst',change_constraints:['총예산과 채널 상하한 유지','동일 통화·기간·국가만 비교','실제 집행 금지'],policy_status:'proposed'});
 }
 for(const [t,n] of Object.entries(counts))assert.equal(rows[t].length,n,t+' count');
 const registry={version,created_at:createdAt,definitions:[...definitions.values()].sort((a,b)=>a.id.localeCompare(b.id))};
 return {rows,registry,ledger};
}

export const serialize=data=>Object.fromEntries(Object.entries(data.rows).sort(([a],[b])=>a.localeCompare(b)).map(([t,rows])=>[t,rows.map(JSON.stringify).join('\n')+'\n']));

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2),option=k=>args.includes(k)?args[args.indexOf(k)+1]:undefined;
 if(args.includes('--plan'))console.log(JSON.stringify({...checkSpec(),counts,existing_input_sha256:inputHashes()}));
 else {
  const approval=option('--approval');requireApproval(approval);
  assert.ok(!fs.existsSync(path.join(here,'source')),'Existing source directory: use --verify-replay, never overwrite');
  const before=inputHashes(),createdAt=new Date().toISOString(),data=generate(approval,createdAt),serialized=serialize(data);
  const {validateData}=await import('./validate.mjs');validateData(data);
  fs.mkdirSync(path.join(here,'source'));
  for(const [t,body] of Object.entries(serialized))fs.writeFileSync(path.join(here,'source',t+'.jsonl'),body,{flag:'wx'});
  fs.writeFileSync(path.join(here,'definitions.json'),JSON.stringify(data.registry,null,2)+'\n',{flag:'wx'});
  fs.writeFileSync(path.join(here,'lineage.jsonl'),data.ledger.map(JSON.stringify).join('\n')+'\n',{flag:'wx'});
  const manifest={version,seed,created_at:createdAt,new_rows:20000,counts,approval_sha256:fileSha(approval),spec_sha256:fileSha(path.join(here,'spec.mjs')),generator_sha256:fileSha(fileURLToPath(import.meta.url)),text_sha256:fileSha(path.join(here,'text.mjs')),
   existing_input_sha256:before,files:Object.fromEntries(Object.entries(serialized).map(([t,body])=>[t+'.jsonl',{rows:counts[t],sha256:sha(body)}]))};
  assert.deepEqual(inputHashes(),before,'Existing inputs changed');
  fs.writeFileSync(path.join(here,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({status:'generated_not_yet_validated',new_rows:20000,types:Object.keys(counts).length}));
 }
}
