import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {counts,sourceFile} from './schema.mjs';
import {countries,zones,currencies,months,days,nextDay,nextMonth,local,minor,decimal,multiply,marketBase,ownBase,productIds,own,stockout,missing,observationPrice,adUnit,unitCpc,reviewTexts,japanOwnReviews,generate,serialize} from './generate.mjs';
export const hash=text=>createHash('sha256').update(text).digest('hex');
export function load(){return Object.fromEntries(Object.keys(counts).map(t=>[t,fs.readFileSync(new URL(`source/${t}.jsonl`,import.meta.url),'utf8').trimEnd().split('\n').map(JSON.parse)]));}
const root=fileURLToPath(new URL('../../../../../',import.meta.url));
export function ajvValidator(){
 const store=path.join(root,'node_modules','.pnpm'),dirs=fs.readdirSync(store);
 const require=createRequire(import.meta.url);
 try{
  const ajvDir=dirs.find(d=>/^ajv@8\./.test(d)),formatDir=dirs.find(d=>/^ajv-formats@/.test(d));
  assert.ok(ajvDir&&formatDir,'Existing Ajv8/formats required; do not install automatically');
  const Ajv=require(path.join(store,ajvDir,'node_modules/ajv/dist/2020.js')).default;
  const formats=require(path.join(store,formatDir,'node_modules/ajv-formats')).default;
  const ajv=new Ajv({strict:true,allErrors:true});formats(ajv);
  const schema=JSON.parse(fs.readFileSync(new URL('batch.schema.json',import.meta.url),'utf8'));
  assert.ok(ajv.validateSchema(schema),JSON.stringify(ajv.errors));
  ajv.addSchema(schema);
  return Object.fromEntries(Object.keys(counts).map(t=>[t,ajv.compile({$ref:`${schema.$id}#/$defs/${t}`} )]));
 }catch(e){
  if(e.code!=='MODULE_NOT_FOUND'||process.env.D003B_PATH_RETRY)throw e;
  // Same process-local package resolution workaround as the existing catalog checker.
  const paths=dirs.filter(d=>/^(ajv@8\.|fast-deep-equal@|fast-uri@|json-schema-traverse@1\.|require-from-string@)/.test(d)).map(d=>path.join(store,d,'node_modules'));
  const retry=spawnSync(process.execPath,process.argv.slice(1),{encoding:'utf8',env:{...process.env,D003B_PATH_RETRY:'1',NODE_PATH:[...paths,process.env.NODE_PATH].filter(Boolean).join(path.delimiter)}});
  if(retry.error)throw retry.error;
  process.stdout.write(retry.stdout);process.stderr.write(retry.stderr);process.exit(retry.status??1);
 }
}
const key=r=>[r.product_id||r.campaign_id,r.country_code,r.period_start||r.observed_at?.slice(0,10)].join('|');
const within=(n,lo,hi,message)=>assert.ok(n>=lo-1e-10&&n<=hi+1e-10,`${message}: ${n} not in [${lo},${hi}]`);
function coverage(rows,expected,keyFn=key){assert.deepEqual(rows.map(keyFn).sort(),expected.sort());}
const grid=(ids,dates)=>ids.flatMap(id=>countries.flatMap(c=>dates.map(d=>`${id}|${c}|${d}`)));
function checkTimestamp(s,c){
 assert.match(s,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00[+-]\d{2}:\d{2}$/);
 // Independently round-trip the instant through IANA, checking wall-clock parts and offset.
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zones[c],year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',timeZoneName:'longOffset'}).formatToParts(new Date(s));
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
 assert.equal(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`,s.slice(0,19));
 assert.equal(p.timeZoneName.replace('GMT','')||'+00:00',s.slice(19));
}
export function validate(data,validators){
 const checks=[];
 function check(name,fn){try{const detail=fn();checks.push({name,status:'pass',detail:detail??'통과'});}catch(e){checks.push({name,status:'fail',detail:e.message});}}
 const all=Object.values(data).flat(),products=new Map(data.T01.map(r=>[r.product_id,r])),campaigns=new Map(data.T12.map(r=>[r.campaign_id,r]));
 const market=new Map(data.T03.map(r=>[key(r),r])),inventory=new Map(data.T22.map(r=>[key(r),r]));
 check('01 유형별 건수·총합·정확한 조합',()=>{
  assert.equal(all.length,1652);for(const [t,n] of Object.entries(counts))assert.equal(data[t].length,n,t);
  assert.deepEqual(fs.readdirSync(new URL('source/',import.meta.url)).sort(),Object.keys(counts).map(t=>`${t}.jsonl`).sort());
  coverage(data.T03,grid(productIds,months));coverage(data.H01,grid(productIds.filter(own),months));
  coverage(data.T08,grid(productIds,days));coverage(data.T22,grid(productIds.filter(own),days));
  for(const grain of ['month','day'])coverage(data.T13.filter(r=>r.grain===grain),data.T12.flatMap(c=>(grain==='month'?months:days).map(d=>`${c.campaign_id}|${c.country_code}|${d}`)));
  assert.deepEqual([...products.keys()].sort(),productIds.slice().sort());
  assert.deepEqual([...campaigns.keys()].sort(),countries.flatMap(c=>['search','social'].map(ch=>`C-${c}-${ch}`)).sort());
  return Object.fromEntries(Object.entries(data).map(([t,r])=>[t,r.length]));
 });
 check('02 JSON Schema·자료형·필수·추가 필드 금지',()=>{
  for(const [t,rows] of Object.entries(data))for(const r of rows)assert.ok(validators[t](r),`${r.record_id}: ${JSON.stringify(validators[t].errors)}`);
  return 'Draft 2020-12 메타스키마·11유형 컴파일·format assertion·1,652 인스턴스';
 });
 check('03 ID 유일성',()=>{
  assert.equal(new Set(all.map(r=>r.record_id)).size,all.length);
  for(const [t,field] of [['T01','product_id'],['T12','campaign_id'],['T24','review_id'],['T09','promotion_id'],['T35','change_id'],['T36','run_id']])assert.equal(new Set(data[t].map(r=>r[field])).size,data[t].length);
 });
 check('04 제품·캠페인·국가·판매처·위치 참조',()=>{
  for(const r of all){
   if(r.product_id)assert.ok(products.has(r.product_id),r.record_id);
   if(r.campaign_id){const c=campaigns.get(r.campaign_id);assert.ok(c);assert.equal(r.country_code,c.country_code);if(r.period_start)assert.ok(r.period_start>=c.valid_from&&r.period_end_exclusive<=c.valid_to_exclusive);}
   if(r.country_code&&r.product_id)assert.ok(products.get(r.product_id).applicable_countries.includes(r.country_code));
   if(r.seller_id)assert.equal(r.seller_id,`S-${r.country_code}`);
   if(r.location_id)assert.equal(r.location_id,`L-${r.country_code}`);
  }
  for(const c of data.T12){assert.equal(c.target_product_id,'P1A');assert.equal(c.platform,c.channel==='search'?'모의 검색':'모의 소셜');}
  for(const r of [...data.H01,...data.T22,...data.T35])assert.ok(own(r.product_id));
  for(const [t,id,name] of [['T08','seller_id','seller_name'],['T22','location_id','location_name']])for(const value of new Set(data[t].map(r=>r[id])))assert.equal(new Set(data[t].filter(r=>r[id]===value).map(r=>r[name])).size,1);
 });
 check('05 브랜드·규격·비교군 일관성',()=>{
  assert.equal(new Set(data.T01.map(r=>r.brand_id)).size,3);
  for(const id of new Set(data.T01.map(r=>r.brand_id))){const rows=data.T01.filter(r=>r.brand_id===id);assert.equal(rows.length,2);assert.equal(new Set(rows.map(r=>r.brand_name)).size,1);assert.equal(new Set(rows.map(r=>r.brand_role)).size,1);assert.deepEqual(rows.map(r=>r.comparison_group).sort(),['A','B']);}
  assert.equal(data.T01.filter(r=>r.brand_role==='own').length,2);
  for(const c of countries)for(const g of ['A','B'])assert.equal(new Set(data.T08.filter(r=>r.country_code===c&&products.get(r.product_id).comparison_group===g&&r.observed_at.startsWith(days[0])).map(r=>r.price)).size,1);
 });
 check('06 국가·통화·시간대·DST·기간 경계',()=>{
  const usOffsets=new Set();
  for(const r of all){const c=r.country_code??'KR';assert.equal(r.reporting_timezone,zones[c]);if(r.currency)assert.equal(r.currency,currencies[c]);
   for(const field of ['available_at','observed_at','written_at','start_at','end_at_exclusive','changed_at'])if(r[field]){checkTimestamp(r[field],c);if(c==='US')usOffsets.add(r[field].slice(-6));}
   if(r.period_start){const month=r.period_start.endsWith('-01')&&(r.grain!=='day');assert.equal(r.period_end_exclusive,month?nextMonth(r.period_start):nextDay(r.period_start));assert.ok(r.period_start>=months[0]&&r.period_end_exclusive<='2026-10-01');}
   if(r.observed_at||r.written_at){const d=(r.observed_at??r.written_at).slice(0,10);assert.ok(days.includes(d));}
   if(r.valid_from)assert.equal(r.valid_from,months[0]);if(r.valid_to_exclusive)assert.equal(r.valid_to_exclusive,'2026-10-01');
  }
  assert.deepEqual([...usOffsets].sort(),['-04:00','-05:00']);
  assert.equal(new Date(days[0]).getUTCDay(),1);assert.equal((Date.parse('2026-08-31')-Date.parse(days[0]))/86400000,28);
  return '미국 날짜별 -04:00/-05:00 IANA round-trip 통과; 현지 달력 기준';
 });
 check('07 전년 동월·동일 분기·기준 변동',()=>{
  const summary=[];
  for(const c of countries)for(const id of productIds){
   for(const table of ['T03',...(c==='JP'&&id==='P1A'?['H01']:[])]){
    const field=table==='T03'?'units_sold':'net_units';let previous=0,current=0;
    const lo=c==='JP'&&id==='P1A'?-0.2:c==='JP'&&id==='P2A'?0.15:-0.05,hi=c==='JP'&&id==='P1A'?-0.1:c==='JP'&&id==='P2A'?0.3:0.15;
    for(const m of ['07','08','09']){const a=data[table].find(r=>r.product_id===id&&r.country_code===c&&r.period_start===`2025-${m}-01`)[field],b=data[table].find(r=>r.product_id===id&&r.country_code===c&&r.period_start===`2026-${m}-01`)[field];within(b/a-1,lo,hi,`${table}/${c}/${id}/${m}`);previous+=a;current+=b;}
    within(current/previous-1,lo,hi,`${table} quarter`);summary.push({type:table,country:c,product:id,previous,current,change:current/previous-1});
   }
  }
  for(const r of data.T03){within(r.units_sold/marketBase(r.product_id,r.country_code),0.85,1.15,'market baseline');const unit=minor(r.sales_value)/BigInt(r.units_sold);assert.equal(minor(r.sales_value)%BigInt(r.units_sold),0n);const b=minor(observationPrice(r.product_id,r.country_code));within(Number(unit)/Number(b),0.95,1.05,'realized unit baseline');within(Number(unit)/100,...(r.country_code==='KR'?[8000,25000]:r.country_code==='JP'?[800,2500]:[8,25]),'unit range');}
  for(const r of data.H01)within(r.gross_units/ownBase(r.product_id,r.country_code),0.85,1.15,'own baseline');
  return summary;
 });
 check('08 판매·반품·순판매·금액 산식',()=>{
  for(const r of data.H01){const m=market.get(key(r)),unit=decimal(minor(m.sales_value)/BigInt(m.units_sold));assert.ok(r.gross_units<=m.units_sold);within(r.returned_units,0,r.gross_units*0.05,'returns');assert.equal(r.net_units,r.gross_units-r.returned_units);assert.equal(r.gross_sales,multiply(unit,r.gross_units));assert.equal(r.returns_value,multiply(unit,r.returned_units));assert.equal(r.net_sales,decimal(minor(r.gross_sales)-minor(r.returns_value)));}
 });
 check('09 시장 분모·기타 금액·분자',()=>{
  for(const c of countries)for(const d of months){const rows=data.T03.filter(r=>r.country_code===c&&r.period_start===d);assert.equal(new Set(rows.map(r=>r.market_total_value)).size,1);const sum=rows.reduce((s,r)=>s+minor(r.sales_value),0n),den=minor(rows[0].market_total_value);assert.ok(den-sum>=sum&&den-sum<=3n*sum);for(const r of rows)assert.ok(minor(r.sales_value)<=den);}
 });
 check('10 광고 정수·금액·기본 범위·전환 저하',()=>{
  for(const r of data.T13){
   assert.equal(r.series_role,r.grain==='month'?'baseline':'detail');
   if(r.availability==='missing')continue;
   within(r.impressions,...(r.grain==='month'?[10000,300000]:[500,5000]),'impressions');
   within(r.clicks/r.impressions,0.005,0.03,'CTR');
   const suppressed=r.grain==='day'&&stockout('P1A',r.country_code,r.period_start);
   if(!suppressed)within(r.conversions/r.clicks,0.01,0.05,'CVR');
   assert.ok(r.conversions<=r.clicks&&r.clicks<=r.impressions);
   assert.equal(r.spend,multiply(unitCpc(r.country_code),r.clicks));assert.equal(r.attributed_revenue,multiply(adUnit(r.country_code),r.conversions));
   within(Number(unitCpc(r.country_code)),...(r.country_code==='KR'?[200,1500]:r.country_code==='JP'?[20,150]:[0.2,1.5]),'CPC');
  }
  const out=[];
  for(const id of ['C-JP-search','C-JP-social']){const rows=data.T13.filter(r=>r.campaign_id===id&&r.grain==='day'&&r.availability==='complete'),normal=rows.filter(r=>!stockout('P1A','JP',r.period_start)),low=rows.filter(r=>stockout('P1A','JP',r.period_start));assert.equal(low.length,7);const base=normal.reduce((s,r)=>s+r.conversions,0)/normal.reduce((s,r)=>s+r.clicks,0);for(const r of low)within(r.conversions/r.clicks,0,base*0.5,'stockout CVR');out.push({campaign:id,normal_cvr:base,low_cvr:low.reduce((s,r)=>s+r.conversions,0)/low.reduce((s,r)=>s+r.clicks,0)});}
  return out;
 });
 check('11 월/일 부분합·잔여분·비율 재계산·주간 partial',()=>{
  const result=[];
  for(const c of data.T12){const daily=data.T13.filter(r=>r.campaign_id===c.campaign_id&&r.grain==='day'),known=daily.filter(r=>r.availability==='complete'),monthly=data.T13.find(r=>r.campaign_id===c.campaign_id&&r.grain==='month'&&r.period_start==='2026-08-01');
   const sums=Object.fromEntries(['impressions','clicks','conversions'].map(k=>[k,known.reduce((s,r)=>s+r[k],0)]));const n=3+(28-known.length),res=Object.fromEntries(Object.keys(sums).map(k=>[k,monthly[k]-sums[k]]));
   within(res.impressions,500*n,5000*n,'residual impressions');within(res.clicks/res.impressions,0.005,0.03,'residual CTR');within(res.conversions/res.clicks,0.01,0.05,'residual CVR');
   assert.equal(minor(monthly.spend)-known.reduce((s,r)=>s+minor(r.spend),0n),minor(multiply(unitCpc(c.country_code),res.clicks)));
   assert.equal(minor(monthly.attributed_revenue)-known.reduce((s,r)=>s+minor(r.attributed_revenue),0n),minor(multiply(adUnit(c.country_code),res.conversions)));
   // The documented residual is an equal 3/5-day scalar contribution, not daily records.
   for(const k of ['impressions','clicks','conversions'])assert.equal(res[k]%n,0);
   within(res.impressions/n,500,5000,'per-day feasible residual');within(res.clicks/n,0.005*res.impressions/n,0.03*res.impressions/n,'per-day clicks');within(res.conversions/n,0.01*res.clicks/n,0.05*res.clicks/n,'per-day conversions');
   for(let w=0;w<4;w++){const rows=daily.filter(r=>days.slice(w*7,w*7+7).includes(r.period_start)),ok=rows.filter(r=>r.availability==='complete');assert.equal(rows.length,7);const clicks=ok.reduce((s,r)=>s+r.clicks,0),impressions=ok.reduce((s,r)=>s+r.impressions,0),conversions=ok.reduce((s,r)=>s+r.conversions,0),spend=ok.reduce((s,r)=>s+minor(r.spend),0n),revenue=ok.reduce((s,r)=>s+minor(r.attributed_revenue),0n);const status=ok.length<7?'partial':'complete';assert.equal(status,c.campaign_id==='C-JP-social'&&w===3?'partial':'complete');result.push({campaign:c.campaign_id,week_start:days[w*7],status,known_count:ok.length,ctr:clicks/impressions,cvr:conversions/clicks,roas:Number(revenue)/Number(spend)});}
   result.push({campaign:c.campaign_id,residual_days:n,residual:res,monthly_availability:monthly.availability});
  }
  return result;
 });
 check('12 할인 기간·가격·원복',()=>{
  const p=data.T09[0];assert.equal(p.product_id,'P2A');assert.equal(p.country_code,'JP');assert.equal(p.start_at,local('JP','2026-08-10',9));assert.equal(p.end_at_exclusive,local('JP','2026-08-24',9));
  for(const r of data.T08){const b=minor(observationPrice(r.product_id,r.country_code)),discount=r.country_code==='JP'&&r.product_id==='P2A'&&Date.parse(r.observed_at)>=Date.parse(p.start_at)&&Date.parse(r.observed_at)<Date.parse(p.end_at_exclusive);assert.equal(minor(r.price),discount?b*9n/10n:b);within(Number(r.price),...(r.country_code==='KR'?[8000,25000]:r.country_code==='JP'?[800,2500]:[8,25]),'observed price');assert.equal(b%(r.country_code==='US'?10n:1000n),0n);}
 });
 check('13 품절·회복·상태·변경 로그',()=>{
  for(const r of data.T22){const out=stockout(r.product_id,r.country_code,r.observed_at.slice(0,10));if(out)assert.equal(r.available_quantity,0);else within(r.available_quantity,150,600,'normal stock');assert.equal(r.sellable_status,out?'out_of_stock':'in_stock');}
  for(const r of data.T08)assert.equal(r.availability,own(r.product_id)?inventory.get(key(r)).sellable_status:'unknown');
  const log=data.T35[0];assert.equal(log.product_id,'P1A');assert.equal(log.country_code,'JP');assert.equal(log.changed_at,local('JP','2026-08-19',9));assert.equal(log.before_value,inventory.get('P1A|JP|2026-08-18').available_quantity);assert.equal(log.after_value,inventory.get('P1A|JP|2026-08-19').available_quantity);
 });
 check('14 누락 날짜·null·수신/정규화 행 계수',()=>{
  for(const r of data.T13){const absent=r.grain==='day'&&missing(r.campaign_id,r.period_start);assert.equal(r.availability,absent?'missing':'complete');for(const f of ['impressions','clicks','conversions','spend','attributed_revenue'])assert.equal(r[f]===null,absent);}
  coverage(data.T36,data.T12.map(r=>r.campaign_id),r=>r.campaign_id);
  for(const log of data.T36){const rows=data.T13.filter(r=>r.campaign_id===log.campaign_id&&r.grain==='day'),absent=rows.filter(r=>r.availability==='missing').map(r=>r.period_start);assert.deepEqual(log.missing_dates,absent);assert.equal(log.received_count,rows.filter(r=>r.availability==='complete').length);assert.equal(log.missing_count,absent.length);assert.equal(log.expected_count,log.received_count+log.missing_count);assert.equal(log.expected_start,days[0]);assert.equal(log.expected_end_exclusive,'2026-08-31');assert.equal(log.status,absent.length?'partial':'success');}
  return '168 상세 정규화 행 중 실제 수신 166, 누락 2. 전환 0과 null 구별';
 });
 check('15 리뷰·한국어·문장/측면·별점·범위·구매 인증',()=>{
  for(const id of productIds)for(const c of countries){const rows=data.T24.filter(r=>r.product_id===id&&r.country_code===c),texts=id==='P1A'&&c==='JP'?japanOwnReviews:reviewTexts;assert.equal(rows.length,4);assert.deepEqual(rows.map(r=>r.body_text),texts);const intervals=[[4,5],[1,2],[3,3],[2,4]];for(let i=0;i<4;i++){const r=rows[i];within(r.rating_value,...intervals[i],'review rating');assert.equal(r.verified_purchase,null);assert.equal(r.language,'ko');const sentences=r.body_text.split('.').filter(s=>s.trim());within(sentences.length,1,3,'sentences');const aspects=['세정감','건조감','향','거품','용기','가격'].filter(a=>r.body_text.includes(a));within(aspects.length,1,2,'aspects');assert.ok(days.includes(r.written_at.slice(0,10)));}}
  for(const r of all)for(const f of ['product_name','brand_name','description_ko','campaign_name','seller_name','location_name','body_text','conditions_ko','reason_ko','coverage_text'])if(r[f]){assert.match(r[f],/[가-힣]/);assert.doesNotMatch(r[f],/[\u3040-\u30ff\u4e00-\u9fff]|https?:\/\//);assert.doesNotMatch(r[f].replace(/[AB]/g,''),/[A-Za-z]/);}
  return '검토한 한국어 문장 템플릿 6종과 실제 72행 대조. 실명·상표·의학 효능 없음 수동 검토 병행; 감성/측면 주석은 원천에 없음';
 });
 check('16 가상 표시·파일 출처·확보 시각·최소 화폐 단위',()=>{
  for(const [t,rows] of Object.entries(data))for(const r of rows){const c=r.country_code??'KR';assert.equal(r.is_synthetic,true);assert.equal(r.source_file,sourceFile(t));let expected;
   if(['T03','H01'].includes(t)||t==='T13'&&r.grain==='month')expected=local(c,r.period_end_exclusive.slice(0,8)+'05',12);
   else if(t==='T13')expected=local(c,nextDay(r.period_start),12);
   else if(['T08','T22'].includes(t))expected=local(c,r.observed_at.slice(0,10),9,5);
   else if(t==='T24')expected=local(c,nextDay(r.written_at.slice(0,10)),12);
   else if(t==='T35')expected=local(c,'2026-08-19',9,5);
   else if(t==='T09')expected=local(c,'2026-08-10',9,5);
   else if(t==='T36')expected=local(c,'2026-09-01',12);
   else expected=local(c,months[0]);
   assert.equal(r.available_at,expected,r.record_id);
   if(r.observed_at)assert.equal(Date.parse(r.available_at)-Date.parse(r.observed_at),300000);
   if(r.changed_at)assert.equal(Date.parse(r.available_at)-Date.parse(r.changed_at),300000);
   if(r.period_end_exclusive)assert.ok(Date.parse(r.available_at)>=Date.parse(local(c,r.period_end_exclusive)));
   for(const f of ['sales_value','market_total_value','gross_sales','returns_value','net_sales','price','spend','attributed_revenue'])if(r[f]!=null){assert.match(r[f],/^\d+\.\d{2}$/);if(c!=='US')assert.equal(minor(r[f])%100n,0n);}
  }
  return 'T09는 행사 첫 가격 관측과 함께 09:05 확보로 둠; 추가 사건 없음';
 });
 check('17 재생성 원천 바이트·SHA-256',()=>{
  const regenerated=serialize(generate()),second=serialize(generate());const hashes={};
  for(const t of Object.keys(counts)){const actual=fs.readFileSync(new URL(`source/${t}.jsonl`,import.meta.url),'utf8');assert.equal(actual,regenerated[t],`${t} regeneration bytes`);assert.equal(regenerated[t],second[t],`${t} same-process reset seed`);hashes[t]=hash(actual);}
  return hashes;
 });
 return checks;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const validators=ajvValidator(),checks=validate(load(),validators);
 const failures=checks.filter(c=>c.status==='fail');console.log(JSON.stringify({checks,exit_code:failures.length?1:0},null,2));process.exitCode=failures.length?1:0;
}
