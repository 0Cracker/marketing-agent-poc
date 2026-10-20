import fs from 'node:fs';
import {counts,sourceFile} from './schema.mjs';
export const seed=300320261014;
export const generatorVersion='D003B-1.0.0';
export const countries=['KR','JP','US'];
export const zones={KR:'Asia/Seoul',JP:'Asia/Tokyo',US:'America/New_York'};
export const currencies={KR:'KRW',JP:'JPY',US:'USD'};
export const basePrice={KR:15000,JP:1500,US:15};
export const cpc={KR:500,JP:50,US:0.5};
export const months=Array.from({length:24},(_,i)=>new Date(Date.UTC(2024,9+i,1)).toISOString().slice(0,10));
export const days=Array.from({length:28},(_,i)=>`2026-08-${String(i+3).padStart(2,'0')}`);
export const nextDay=d=>new Date(Date.parse(d)+86400000).toISOString().slice(0,10);
export const nextMonth=d=>new Date(Date.UTC(Number(d.slice(0,4)),Number(d.slice(5,7)),1)).toISOString().slice(0,10);
// Resolve local wall time using the runtime IANA database, including each date's DST.
export function local(country,date,hour=0,minute=0){
 const wall=Date.parse(`${date}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00Z`);
 const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:zones[country],timeZoneName:'longOffset'});
 let instant=wall,offset;
 for(let i=0;i<3;i++){
  offset=fmt.formatToParts(new Date(instant)).find(p=>p.type==='timeZoneName').value.replace('GMT','')||'+00:00';
  const minutes=(offset[0]==='-'?-1:1)*(Number(offset.slice(1,3))*60+Number(offset.slice(4,6)));
  instant=wall-minutes*60000;
 }
 return `${date}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00${offset}`;
}
// Integer minor-unit arithmetic; no float money multiplication or tolerance.
export const minor=s=>BigInt(s.replace('.',''));
export const decimal=n=>`${n/100n}.${String(n%100n).padStart(2,'0')}`;
export const money=(value,country)=>country==='US'?decimal(BigInt(Math.round(value*100))):decimal(BigInt(Math.round(value))*100n);
export const multiply=(s,n)=>decimal(minor(s)*BigInt(n));
export const productIds=Array.from({length:6},(_,i)=>`P${Math.floor(i/2)+1}${i%2?'B':'A'}`);
export const own=id=>id.startsWith('P1');
export const stockout=(id,c,d)=>id==='P1A'&&c==='JP'&&d>='2026-08-12'&&d<='2026-08-18';
export const missing=(id,d)=>id==='C-JP-social'&&['2026-08-26','2026-08-27'].includes(d);
export const observationPrice=(id,c)=>money(basePrice[c]+(id.endsWith('B')?basePrice[c]/10:0),c);
export const adUnit=c=>money(basePrice[c],c);
export const unitCpc=c=>money(cpc[c],c);
export const marketBase=(id,c)=>1800+productIds.indexOf(id)*100+countries.indexOf(c)*50;
export const ownBase=(id,c)=>500+productIds.indexOf(id)*30+countries.indexOf(c)*20;
// No labels are emitted: the ordered text choices are used only in generation/checks.
export const reviewTexts=[
 '세정감이 산뜻하고 거품이 잘 나서 사용하기 편했습니다.',
 '용기에서 내용물을 꺼내기 불편했고 가격도 부담스럽게 느껴졌습니다.',
 '향은 무난했습니다. 용기 사용성도 보통이었습니다.',
 '거품은 잘 나지만 사용 후 건조감이 조금 아쉬웠습니다.'
];
export const japanOwnReviews=[
 reviewTexts[0],
 '향이 강하게 느껴졌고 사용 후 건조감도 아쉬웠습니다.',
 reviewTexts[2],
 '향은 마음에 들었지만 사용 후 건조감은 아쉬웠습니다.'
];
export function generate(){
 let state=seed>>>0;
 const random=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};
 const integer=(lo,hi)=>lo+Math.floor(random()*(hi-lo+1));
 const data=Object.fromEntries(Object.keys(counts).map(t=>[t,[]]));
 function add(t,c,fields,available){
  data[t].push({record_id:`D003B-${t}-${String(data[t].length+1).padStart(4,'0')}`,is_synthetic:true,source_file:sourceFile(t),available_at:available,reporting_timezone:zones[c],...fields});
 }
 for(const id of productIds){
  const b=Number(id[1]),g=id[2],role=b===1?'자사':`경쟁${b-1}`;
  add('T01','KR',{product_id:id,product_name:`가상 ${role} 제품${g}`,brand_id:`B${b}`,brand_name:`가상 ${role} 브랜드`,brand_role:b===1?'own':'competitor',category_name:'샴푸',comparison_group:g,volume_ml:300,description_ko:g==='A'?'일상 세정 사용감을 비교하기 위한 가상 샴푸입니다.':'보습 사용감을 비교하기 위한 가상 샴푸입니다.',applicable_countries:countries,valid_from:months[0]},local('KR',months[0]));
 }
 for(const c of countries)for(const channel of ['search','social'])add('T12',c,{campaign_id:`C-${c}-${channel}`,campaign_name:`가상 ${c==='KR'?'한국':c==='JP'?'일본':'미국'} ${channel==='search'?'검색':'소셜'} 캠페인`,platform:channel==='search'?'모의 검색':'모의 소셜',channel,country_code:c,target_product_id:'P1A',valid_from:months[0],valid_to_exclusive:'2026-10-01',conversion_name:'구매',attribution_model:'마지막 클릭',attribution_window_days:7},local(c,months[0]));
 for(const c of countries)for(const start of months){
  const q3=[7,8,9].includes(Number(start.slice(5,7))),year=start.slice(0,4);
  const rows=[];
  for(const id of productIds){
   let factor=1+(random()*0.16-0.08);
   if(q3&&(year==='2025'||year==='2026')){
    factor=c==='JP'&&id==='P1A'?(year==='2025'?1.05:0.90):c==='JP'&&id==='P2A'?(year==='2025'?0.90:1.10):(year==='2025'?1:1.05);
   }
   const units=Math.round(marketBase(id,c)*factor);
   const unit=money(basePrice[c]*(id.endsWith('B')?1.1:1)*(1+(random()*0.08-0.04)),c);
   rows.push({id,units,unit,sales:multiply(unit,units)});
   if(own(id)){
    let gross=Math.round(ownBase(id,c)*(1+(random()*0.16-0.08)));
    if(c==='JP'&&id==='P1A'&&q3&&(year==='2025'||year==='2026'))gross=Math.round(ownBase(id,c)*(year==='2025'?1.05:0.90));
    const returned=Math.floor(gross*0.02);
    add('H01',c,{product_id:id,country_code:c,period_start:start,period_end_exclusive:nextMonth(start),gross_units:gross,returned_units:returned,net_units:gross-returned,gross_sales:multiply(unit,gross),returns_value:multiply(unit,returned),net_sales:multiply(unit,gross-returned),currency:currencies[c]},local(c,nextMonth(start).slice(0,8)+'05',12));
   }
  }
  const total=rows.reduce((n,r)=>n+minor(r.sales),0n)*3n;
  for(const r of rows)add('T03',c,{product_id:r.id,country_code:c,period_start:start,period_end_exclusive:nextMonth(start),units_sold:r.units,sales_value:r.sales,market_total_value:decimal(total),currency:currencies[c],coverage_text:'동일 국가의 모의 유통 범위입니다. 선정 여섯 제품과 기타 제품 금액을 포함하며 실제 시장 조사 결과가 아닙니다.'},local(c,nextMonth(start).slice(0,8)+'05',12));
 }
 for(const c of countries)for(const id of productIds)for(const d of days){
  const out=stockout(id,c,d);
  if(own(id))add('T22',c,{product_id:id,country_code:c,location_id:`L-${c}`,location_name:`가상 ${c==='KR'?'한국':c==='JP'?'일본':'미국'} 재고 위치`,observed_at:local(c,d,9),available_quantity:out?0:integer(150,600),sellable_status:out?'out_of_stock':'in_stock'},local(c,d,9,5));
  const base=observationPrice(id,c);
  const discount=c==='JP'&&id==='P2A'&&d>='2026-08-10'&&d<'2026-08-24';
  const price=discount?decimal(minor(base)*9n/10n):base;
  add('T08',c,{product_id:id,country_code:c,seller_id:`S-${c}`,seller_name:`가상 ${c==='KR'?'한국':c==='JP'?'일본':'미국'} 판매처`,observed_at:local(c,d,9),price,currency:currencies[c],availability:own(id)?(out?'out_of_stock':'in_stock'):'unknown',tax_included:null,shipping_included:null},local(c,d,9,5));
 }
 for(const campaign of data.T12){
  const c=campaign.country_code,id=campaign.campaign_id,detail=[];
  for(const d of days){
   let metrics;
   if(missing(id,d))metrics={impressions:null,clicks:null,conversions:null,spend:null,attributed_revenue:null};
   else{
    const impressions=integer(2000,4000),clicks=Math.round(impressions*0.02),conversions=stockout('P1A',c,d)?0:Math.round(clicks*0.03);
    metrics={impressions,clicks,conversions,spend:multiply(unitCpc(c),clicks),attributed_revenue:multiply(adUnit(c),conversions)};
   }
   const fields={campaign_id:id,country_code:c,period_start:d,period_end_exclusive:nextDay(d),grain:'day',series_role:'detail',...metrics,currency:currencies[c],availability:missing(id,d)?'missing':'complete'};
   detail.push(fields);
  }
  for(const start of months){
   let impressions,clicks,conversions;
   if(start==='2026-08-01'){
    // Aggregate scalar residual only: no additional daily record/fixture is built.
    const residualDays=id==='C-JP-social'?5:3;
    impressions=detail.reduce((s,r)=>s+(r.impressions??0),0)+residualDays*3000;
    clicks=detail.reduce((s,r)=>s+(r.clicks??0),0)+residualDays*60;
    conversions=detail.reduce((s,r)=>s+(r.conversions??0),0)+residualDays*2;
   }else{impressions=integer(60000,120000);clicks=Math.round(impressions*0.02);conversions=Math.round(clicks*0.03);}
   add('T13',c,{campaign_id:id,country_code:c,period_start:start,period_end_exclusive:nextMonth(start),grain:'month',series_role:'baseline',impressions,clicks,conversions,spend:multiply(unitCpc(c),clicks),attributed_revenue:multiply(adUnit(c),conversions),currency:currencies[c],availability:'complete'},local(c,nextMonth(start).slice(0,8)+'05',12));
  }
  for(const fields of detail)add('T13',c,fields,local(c,nextDay(fields.period_start),12));
  const absent=detail.filter(r=>r.availability==='missing').map(r=>r.period_start);
  add('T36',c,{run_id:`RUN-${id}`,campaign_id:id,country_code:c,expected_start:days[0],expected_end_exclusive:'2026-08-31',expected_count:28,received_count:28-absent.length,missing_count:absent.length,missing_dates:absent,status:absent.length?'partial':'success'},local(c,'2026-09-01',12));
 }
 for(const id of productIds)for(const c of countries)for(let i=0;i<4;i++){
  const d=days[i*7+2],texts=id==='P1A'&&c==='JP'?japanOwnReviews:reviewTexts;
  add('T24',c,{review_id:`R-${id}-${c}-${i+1}`,product_id:id,country_code:c,written_at:local(c,d,15),language:'ko',body_text:texts[i],rating_value:[5,2,3,3][i],rating_scale_max:5,verified_purchase:null},local(c,nextDay(d),12));
 }
 add('T09','JP',{promotion_id:'PROMO-JP-P2A',product_id:'P2A',country_code:'JP',seller_id:'S-JP',start_at:local('JP','2026-08-10',9),end_at_exclusive:local('JP','2026-08-24',9),discount_ratio:0.1,conditions_ko:'가상 일본 판매처에서 해당 단일 규격 제품의 관측 가격을 기간 내 십 퍼센트 할인합니다. 종료 시 기본 가격으로 돌아갑니다.'},local('JP','2026-08-10',9,5));
 const recovery=data.T22.find(r=>r.product_id==='P1A'&&r.country_code==='JP'&&r.observed_at.startsWith('2026-08-19'));
 add('T35','JP',{change_id:'CHANGE-JP-P1A',product_id:'P1A',country_code:'JP',location_id:'L-JP',changed_at:local('JP','2026-08-19',9),changed_field:'available_quantity',before_value:0,after_value:recovery.available_quantity,reason_ko:'판매 가능 수량을 확인하여 재고 상태를 갱신했습니다.'},local('JP','2026-08-19',9,5));
 return data;
}
export const serialize=data=>Object.fromEntries(Object.entries(data).map(([t,rows])=>[t,rows.map(r=>JSON.stringify(r)).join('\n')+'\n']));
export function writeSources(data){
 fs.mkdirSync(new URL('source/',import.meta.url),{recursive:true});
 for(const [type,content] of Object.entries(serialize(data)))fs.writeFileSync(new URL(`source/${type}.jsonl`,import.meta.url),content);
}
