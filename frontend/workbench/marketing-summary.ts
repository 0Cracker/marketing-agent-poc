import type {Chart,Model,Raw,Row} from './contract';
const obj=(v:unknown):Raw=>v&&typeof v==='object'&&!Array.isArray(v)?v as Raw:{};
const n=(v:unknown):number|null=>v==null?null:typeof v==='object'?n(obj(v).amount):Number.isFinite(Number(v))?Number(v):null;
const palette=['#8968C6','#B199D6','#7C92C7','#ACBADB','#BA82AE','#D3B0CC'];
const products:Record<string,string>={P1A:'자사 제품 A',P1B:'자사 제품 B',P2A:'경쟁1 제품 A',P2B:'경쟁1 제품 B',P3A:'경쟁2 제품 A',P3B:'경쟁2 제품 B',B1:'자사',B2:'경쟁1',B3:'경쟁2'};
const names:Record<string,string>={KR:'한국',JP:'일본',US:'미국',open:'접수',pending:'처리 중',resolved:'해결',closed:'종료',text:'텍스트',image:'이미지',video:'동영상',view_item:'상품 조회',add_to_cart:'장바구니',begin_checkout:'결제 시작',purchase:'구매',refund:'환불',positive:'긍정',neutral:'중립',negative:'부정',mobile:'모바일',desktop:'데스크톱',page_view:'페이지 조회',engagement:'참여',search:'검색',social:'소셜',direct:'직접 방문',email:'이메일',phone:'전화',chat:'채팅',synthetic_video:'동영상 채널',synthetic_social:'소셜 채널',synthetic_blog:'블로그',low:'낮음',medium:'보통',high:'높음',active:'운영 중',completed:'완료',daily:'일간',monthly:'월간',in_stock:'재고 있음',out_of_stock:'품절',sellable:'판매 가능',unknown:'미확인'};
const productId=(r:Raw)=>String(r.subject_ref||r.product_ref||r.variant_ref||(r.product_refs as string[]||[])[0]||(r.subject_refs as string[]||[])[0]||r.term_ref||r.keyword||r.page_ref||r.entity_ref||r.campaign_ref||'').match(/P[123][AB]/)?.[0]||'';
const product=(r:Raw)=>products[productId(r)]||String(r.advertiser_ref&&products[String(r.advertiser_ref)]||r.subject||r.keyword||'기타');
const day=(r:Raw)=>String(r.observed_at||r.written_at||r.created_at||r.event_time||r.incident_start||r.ordered_at||r.published_at||obj(r.period||r.expected_period||r.planned_period).start||'').slice(0,10);
const groups=(rs:Raw[],key:(r:Raw)=>string)=>{const m=new Map<string,Raw[]>();for(const r of rs){const k=key(r);m.set(k,[...(m.get(k)||[]),r]);}return [...m];};
const sum=(rs:Raw[],value:(r:Raw)=>unknown)=>rs.reduce((s,r)=>s+(n(value(r))??0),0);
const average=(rs:Raw[],value:(r:Raw)=>unknown)=>{const ns=rs.map(r=>n(value(r))).filter((v):v is number=>v!==null);return ns.length?ns.reduce((s,v)=>s+v,0)/ns.length:null;};
const median=(rs:Raw[],value:(r:Raw)=>unknown)=>{const ns=rs.map(r=>n(value(r))).filter((v):v is number=>v!==null).sort((a,b)=>a-b);return ns.length?(ns[Math.floor((ns.length-1)/2)]+ns[Math.floor(ns.length/2)])/2:null;};
const measure=(r:Raw,suffix:string,key='measures')=>((r[key]||[])as Raw[]).find(m=>String(m.metric_id).endsWith('.'+suffix))?.value;
const latest=(rs:Raw[],key:(r:Raw)=>string)=>groups(rs,key).map(([,g])=>[...g].sort((a,b)=>day(b).localeCompare(day(a))||String(b.record_id).localeCompare(String(a.record_id)))[0]);
export function marketingSummary(model:Model,records:Raw[],history:Raw[]=records){
 if(!records.length)return;
 const systemFields=new Set(['scope_id','scenario_id','_batch','_country','_conforming','report_definition_ref','definition_version','extractor_version']);
 model.columns=model.columns.filter(c=>!systemFields.has(c.key));
 const metrics:Model['metrics']=[],charts:Chart[]=[],subtitle=`${names[model.country]||'국가 비교'} · ${model.period}`;
 const metric=(label:string,value:number|null,unit:string,source=records,kind:Model['metrics'][number]['kind']='number',note='현재 선택 범위의 실제 가상 표본에서 계산')=>metrics.push({label,value,unit,source,kind,note});
 const chart=(title:string,kind:Chart['kind'],unit:string,data:Row[],series:Chart['series'],note='선택한 국가·제품·기간의 원천을 업무 범주로 집계'):Chart=>({title,kind,unit,data,series,subtitle,note});
 const series=(key:string,name:string,i=0)=>({key,name,color:palette[name.startsWith('자사')?(name.endsWith('B')?1:0):name.startsWith('경쟁1')?(name.endsWith('B')?3:2):name.startsWith('경쟁2')?(name.endsWith('B')?5:4):i%palette.length]});
 const distribution=(title:string,key:(r:Raw)=>string,kind:Chart['kind']='donut',order:string[]=[])=>{
  const data=groups(records,key).map(([name,rs])=>({id:name,values:{name:names[name]||products[name]||name,v:rs.length},source:rs}));data.sort((a,b)=>order.length?order.indexOf(a.id)-order.indexOf(b.id):Number(b.values.v)-Number(a.values.v)||a.id.localeCompare(b.id));
  return chart(title,kind,'건',data,[series('v','표본 수')]);
 };
 const line=(title:string,rs:Raw[],group:(r:Raw)=>string,value:(r:Raw)=>number|null,unit:string,mode:'sum'|'median'='sum')=>{
  const productOrder=Object.values(products);const categories=[...new Set(rs.map(group))].sort((a,b)=>{const x=productOrder.indexOf(a),y=productOrder.indexOf(b);return x>=0&&y>=0?x-y:a.localeCompare(b);}),days=groups(rs,day).filter(([d])=>d).sort(([a],[b])=>a.localeCompare(b));
  return chart(title,'line',unit,days.map(([date,items])=>({id:date,values:{name:date,...Object.fromEntries(categories.map((c,i)=>{const selected=items.filter(r=>group(r)===c);return ['v'+i,selected.length?(mode==='median'?median(selected,value):selected.some(r=>value(r)===null)?null:sum(selected,value)):null];}))},source:items})),categories.map((name,i)=>series('v'+i,names[name]||name,i)),mode==='median'?'동일 제품·관측일의 판매처 가격 중앙값 · 날짜 사이를 실제 관측으로 간주하지 않음':'같은 날짜·업무 범주별 합계 · 관측이 없는 날짜는 채우지 않음');
 };
 const rank=(title:string,rs:Raw[],key:(r:Raw)=>string,value:(r:Raw)=>number|null,unit:string)=>chart(title,'bar',unit,groups(rs,key).map(([name,g])=>({id:name,values:{name,v:sum(g,value)},source:g})).sort((a,b)=>Number(b.values.v)-Number(a.values.v)),[series('v',title)]);
 // A country comparison is not a pooled currency total or a mixed-source mean.
 if(model.country==='ALL'){
  const cols=model.type==='T24'?[series('count','리뷰 수'),series('rating','평균 별점'),series('low','2점 이하 비율')]:model.type==='T26'?[series('count','접수 문의'),series('open','미해결 문의'),series('resolution','해결 비율')]:['T04','T32'].includes(model.type)?[series('respondents','최근 조사 응답 표본'),series('products','비교 제품 수')]:model.type==='T06'?[series('demand','최근 월간 예상 검색수'),series('products','검색 대상 제품')]:[series('count','관측 표본 수'),series('products','제품·대상 수')];
  const data=groups(records,r=>String(r._country||r.scope_id).match(/(?:^|-)(KR|JP|US)(?:-|$)/)?.[1]||'GLOBAL').filter(([c])=>c!=='GLOBAL').map(([c,rs])=>({id:c,values:{name:names[c]||c,count:rs.length,products:new Set(rs.map(productId).filter(Boolean)).size,rating:average(rs,r=>r.rating_value)?.toFixed(2)??'—',low:(rs.filter(r=>Number(r.rating_value)<=2).length/rs.length*100).toFixed(1)+'%',open:rs.filter(r=>r.status==='open').length,resolution:(rs.filter(r=>r.status==='resolved').length/rs.length*100).toFixed(1)+'%',respondents:sum(latest(rs,productId),r=>r.sample_size),demand:sum(latest(rs,r=>String(r.keyword)),r=>r.estimated_searches)},source:rs}));
  const money=(value:number|null,country:string)=>value===null?'—':value.toLocaleString('ko-KR',{maximumFractionDigits:2})+' '+({KR:'KRW',JP:'JPY',US:'USD'}as Record<string,string>)[country];
  const businessColumns:Record<string,[string,string][]>= {T03:[['market','최근 시장 판매액 (현지 통화)'],['share','자사 금액 점유율'],['units','선정 제품 판매량']],H01:[['net','최근 순판매액 (현지 통화)'],['units','최근 순판매량']],T13:[['spend','최근 월 광고비 (현지 통화)'],['ctr','클릭률'],['roas','매체 집계 ROAS']],T08:[['priceRange','관측 판매가 범위 (현지 통화)'],['products','관측 제품']],T22:[['stock','최근 판매 가능 재고'],['out','품절 관측']],T18:[['viewQty','상품 조회 수량'],['purchaseQty','상품 구매 수량']],T10:[['count','공개 광고 표본'],['advertisers','관측 광고주'],['video','동영상 비중']],T37:[['incidents','장애 기록'],['longest','최장 장애 시간']],T05:[['changeRange','제품별 최근 지수 변화 범위'],['products','비교 검색어']]};
  if(businessColumns[model.type]){cols.splice(0,cols.length,...businessColumns[model.type].map(([key,label])=>series(key,label)));for(const row of data){const rs=row.source,c=row.id,last=[...rs].sort((a,b)=>day(b).localeCompare(day(a)))[0],current=rs.filter(r=>day(r)===day(last)),monthly=rs.filter(r=>obj(r.period).grain==='month'),recentMonthly=monthly.filter(r=>day(r)===day([...monthly].sort((a,b)=>day(b).localeCompare(day(a)))[0]||{})),spend=sum(recentMonthly,r=>obj(r.metrics).spend),revenue=sum(recentMonthly,r=>obj(r.metrics).attributed_value),impressions=sum(recentMonthly,r=>obj(r.metrics).impressions),clicks=sum(recentMonthly,r=>obj(r.metrics).clicks),incidents=rs.filter(r=>r.record_kind==='incident');
   const indexChanges=groups(rs,r=>String(r.normalization_scope)).flatMap(([,g])=>{const sorted=[...g].sort((a,b)=>day(a).localeCompare(day(b)));return sorted.length>1&&sorted[0].index_value!==undefined?[Number(sorted.at(-1)!.index_value)-Number(sorted.at(-2)!.index_value)]:[];});
   const prices=rs.map(r=>n(r.listed_price)).filter((v):v is number=>v!==null),denom=n(last.market_total_value);
   Object.assign(row.values,{market:money(denom,c),share:denom?(sum(current.filter(r=>productId(r).startsWith('P1')),r=>r.sales_value)/denom*100).toFixed(1)+'%':'—',units:sum(current,r=>model.type==='H01'?measure(r,'net_units'):r.units_sold),net:money(sum(current,r=>measure(r,'net_sales')),c),spend:money(spend,c),ctr:impressions?(clicks/impressions*100).toFixed(2)+'%':'—',roas:spend?(revenue/spend).toFixed(2)+'배':'—',priceRange:prices.length?money(Math.min(...prices),c)+'–'+money(Math.max(...prices),c):'—',stock:sum(latest(rs,r=>productId(r)+'/'+r.location_ref),r=>r.available_quantity),out:rs.filter(r=>Number(r.available_quantity)===0).length,viewQty:sum(rs.filter(r=>r.event_name==='view_item'),r=>r.quantity),purchaseQty:sum(rs.filter(r=>r.event_name==='purchase'),r=>r.quantity),advertisers:new Set(rs.map(r=>r.advertiser_ref).filter(Boolean)).size,video:(rs.filter(r=>r.format==='video').length/rs.length*100).toFixed(1)+'%',incidents:incidents.length,longest:incidents.length?Math.max(...incidents.map(r=>(Date.parse(String(r.incident_end))-Date.parse(String(r.incident_start)))/3600000)).toFixed(1)+'시간':'—',changeRange:indexChanges.length?Math.min(...indexChanges).toFixed(0)+'–'+Math.max(...indexChanges).toFixed(0)+'p':'—'});
  }}
  metric(model.type==='T24'?'수집 리뷰':'관측 표본',records.length,'건');metric('비교 국가',data.length,'개');
  const displayed:Row[]=data.map(row=>({...row,values:Object.fromEntries(['name',...cols.map(c=>c.key)].map(key=>[key,(row.values as Row['values'])[key]??null]))}));
  charts.push(chart(`${({T24:'리뷰',T26:'고객 문의',T10:'공개 광고',T18:'상품 행동',T08:'가격 관측',T22:'재고 관측'}as Record<string,string>)[model.type]||model.title} · 국가별 비교`,'comparison','',displayed,cols,'국가별 표본을 나란히 비교 · 통화를 합산하지 않음'));
  model.metrics=metrics;model.charts=charts;model.detailTitle=model.title+' · 국가별 상세';return;
 }
 switch(model.type){
 case 'T03':{
  const last=[...records].sort((a,b)=>day(b).localeCompare(day(a)))[0],rs=records.filter(r=>day(r)===day(last)),own=rs.filter(r=>productId(r).startsWith('P1')),denominator=n(last.market_total_value),ownValue=sum(own,r=>r.sales_value);
  metric('최근 시장 판매액',denominator,model.currency,rs,'money');metric('자사 금액 점유율',denominator?ownValue/denominator*100:null,'%',own,'percent');metric('자사 시장 판매액',ownValue,model.currency,own,'money');
  const values=groups(rs,r=>'B'+productId(r).slice(1,2)).map(([brand,g])=>({id:brand,values:{name:products[brand]||'기타',v:denominator?sum(g,r=>r.sales_value)/denominator*100:null},source:g}));
  values.push({id:'other',values:{name:'기타 시장',v:denominator?(denominator-sum(rs,r=>r.sales_value))/denominator*100:null},source:rs});charts.push(chart('최근 관측월 · 브랜드별 시장점유율','vertical-bars','%',values,[series('v','시장점유율')]));charts.push(line('제품별 시장 판매액 추이',history,product,r=>n(r.sales_value),model.currency));break;
 }
 case 'H01':{
  const last=[...records].sort((a,b)=>day(b).localeCompare(day(a)))[0],rs=records.filter(r=>day(r)===day(last));for(const [key,label]of [['gross_sales','총판매액'],['returns_value','반품 금액'],['net_sales','순판매액']])metric('최근 '+label,sum(rs,r=>measure(r,key)),model.currency,rs,'money');charts.push(line('월별 순판매액',history,product,r=>n(measure(r,'net_sales')),model.currency));break;
 }
 case 'T13':{
  const monthly=history.filter(r=>obj(r.period).grain==='month'),last=[...monthly].sort((a,b)=>day(b).localeCompare(day(a)))[0],rs=monthly.filter(r=>day(r)===day(last));metric('최근 월 광고비',sum(rs,r=>obj(r.metrics).spend),model.currency,rs,'money');metric('최근 월 노출수',sum(rs,r=>obj(r.metrics).impressions),'회',rs);metric('최근 월 클릭수',sum(rs,r=>obj(r.metrics).clicks),'회',rs);metric('매체 보고 전환수',sum(rs,r=>obj(r.metrics).attributed_conversions),'건',rs);charts.push(line('월별 매체 광고비',monthly,r=>String(r.campaign_ref).split('-').at(-1)!,r=>n(obj(r.metrics).spend),model.currency));break;
 }
 case 'T04':case 'T32':{
  const rs=latest(records,r=>productId(r)),survey=model.type==='T32',count=survey?'survey_positive_count':'panel_positive_count';
  const data=rs.map(r=>({id:String(r.record_id),values:{name:product(r),positive:n(measure(r,count)),sample:n(r.sample_size),rate:n(measure(r,count))!==null&&Number(r.sample_size)>0?Number(measure(r,count))/Number(r.sample_size)*100:null},source:[r]}));
  metric('비교 제품',rs.length,'개');metric('응답 표본',sum(rs,r=>r.sample_size),'명',rs,'number','제품별 최근 조사 응답 수 합계 · 고유 응답자 수와 다름');
  charts.push(chart(survey?'제품별 브랜드 긍정 응답':'제품별 구매 경험 긍정 응답','comparison','',data,[series('rate','긍정 응답 (%)'),series('positive','긍정 응답 수'),series('sample','조사 표본 수')],'각 제품의 최근 조사에서 긍정 응답 / 표본 수 · 조사 간 응답자를 합치지 않음'));
  charts.push(chart('제품별 긍정 응답률','bar','%',data,[series('rate','긍정 응답률')]));break;
 }
 case 'T05':{
  const scope=String(records[0].normalization_scope),rs=history.filter(r=>r.normalization_scope===scope).sort((a,b)=>day(a).localeCompare(day(b))),last=rs.at(-1)!;
  metric('최근 관심지수',n(last.index_value),'지수',[last]);metric('관측 기간',rs.length,'회',rs);metric('직전 관측 대비',rs.length>1?Number(last.index_value)-Number(rs.at(-2)!.index_value):null,'포인트',rs,'decimal');
  charts.push(chart(`${product(last)} · 검색 관심 추이`,'line','지수',rs.map(r=>({id:String(r.record_id),values:{name:day(r),v:n(r.index_value)},source:[r]})),[series('v','상대 관심지수')],'같은 정규화 요청 범위만 연결 · 검색량으로 해석하지 않음'));break;
 }
 case 'T06':{
  const rs=latest(records,r=>String(r.keyword));metric('검색어',rs.length,'개');metric('월간 예상 검색수',sum(rs,r=>r.estimated_searches),'회',rs);charts.push(rank('검색어별 예상 수요',rs,r=>String(r.keyword).replace('가상 ','').replace(/P[123][AB]/g,id=>products[id]),r=>n(r.estimated_searches),'회'));charts.push(distribution('검색어 경쟁 수준',r=>String(r.competition_level)));break;
 }
 case 'T07':metric('검색 보고 관측',records.length,'건');charts.push(line('기기별 검색 클릭 추이',records,r=>String(r.device),r=>n(r.clicks),'회'));charts.push(distribution('검색 기기 구성',r=>String(r.device),'donut',['mobile','desktop']));break;
 case 'T08':{
  const allowed=new Set(records.map(productId)),rs=history.filter(r=>allowed.has(productId(r))),observed=latest(records,r=>productId(r)+'/'+r.seller_ref);
  metric('관측 제품',allowed.size,'개');metric('관측 판매처',new Set(records.map(r=>r.seller_ref)).size,'곳');metric('최근 가격 관측',observed.length,'건',observed);
  charts.push(line('제품별 판매가 추이',rs,product,r=>n(r.listed_price),model.currency,'median'));
  charts.push(chart('최근 관측일 · 제품별 판매가 범위','range',model.currency,groups(observed,product).map(([name,g])=>({id:name,values:{name,min:Math.min(...g.map(r=>Number(n(r.listed_price)))),max:Math.max(...g.map(r=>Number(n(r.listed_price)))),median:median(g,r=>r.listed_price)},source:g})),[series('median','판매가 중앙값')]));break;
 }
 case 'T10':metric('공개 광고 표본',records.length,'건');metric('관측 광고주',new Set(records.map(r=>r.advertiser_ref)).size,'개');charts.push(distribution('경쟁사별 공개 광고',r=>String(r.advertiser_ref),'vertical-bars',['B1','B2','B3']));charts.push(distribution('광고 소재 형식',r=>String(r.format),'donut',['text','image','video']));break;
 case 'T11':metric('공개 자료',records.length,'건');metric('발행처',new Set(records.map(r=>r.publisher)).size,'곳');charts.push(distribution('발행처별 공개 자료',r=>String(r.publisher),'bar'));charts.push(line('공개 자료 발행 추이',records,()=> '공개 자료',()=>1,'건'));break;
 case 'T09':metric('관측 프로모션',records.length,'건');metric('프로모션 제품',new Set(records.map(productId)).size,'개');charts.push(chart('제품·판매처별 행사 조건','comparison','',records.map(r=>({id:String(r.record_id),values:{name:product(r),seller:'판매처 '+String(r.seller_ref).split('-').at(-1),discount:n(r.discount_ratio)==null?'—':(Number(r.discount_ratio)*100).toFixed(0)+'%',start:obj(r.period).start as string,end:obj(r.period).end_exclusive as string},source:[r]})),[series('seller','판매처'),series('discount','할인율'),series('start','시작일'),series('end','종료일 (제외)')]));break;
 case 'T12':metric('등록 캠페인',new Set(records.map(r=>r.campaign_id)).size,'개');charts.push(chart('캠페인별 운영 예산','comparison',model.currency,records.map(r=>({id:String(r.record_id),values:{name:product(r)+' · '+(names[String(r.channel)]||r.channel),budget:obj(r.budget_amount).amount as string,period:r.budget_period as string,status:names[String(r.status)]||r.status as string},source:[r]})),[series('budget','예산 ('+model.currency+')'),series('period','예산 주기'),series('status','운영 상태')]));break;
 case 'T14':metric('세그먼트 보고',records.length,'건');metric('보고 캠페인',new Set(records.map(r=>r.campaign_ref)).size,'개');charts.push(line('기기별 일간 광고비',records,r=>String(((r.breakdown_dimensions||[])as Raw[]).find(d=>d.name==='device')?.value||'미제공'),r=>n(obj(r.metrics).spend),model.currency));charts.push(rank('기기별 관측 광고비',records.filter(r=>n(obj(r.metrics).spend)!==null),r=>names[String(((r.breakdown_dimensions||[])as Raw[]).find(d=>d.name==='device')?.value)]||'기타',r=>n(obj(r.metrics).spend),model.currency));break;
 case 'T15':{
  const rs=latest(records,r=>String(r.campaign_ref)+'/'+r.competitor_domain);metric('경쟁 광고 보고',rs.length,'건');charts.push(chart('최근 경쟁 도메인 보고','comparison','',rs.map(r=>({id:String(r.record_id),values:{name:product(r)+' · '+String(r.competitor_domain).split('-').at(-1),share:(Number(r.impression_share)*100).toFixed(1)+'%',overlap:(Number(r.overlap_rate)*100).toFixed(1)+'%',period:day(r)},source:[r]})),[series('share','보고 노출 점유율'),series('overlap','중복률'),series('period','관측 기간')]));break;
 }
 case 'T16':metric('소재 버전',records.length,'개');metric('연결 소재',new Set(records.map(r=>r.creative_id)).size,'개');charts.push(distribution('소재 형식별 버전 구성',r=>String(r.format),'donut',['text','image','video']));break;
 case 'T17':metric('웹 이벤트',records.length,'건');metric('관측 세션',new Set(records.map(r=>r.session_ref).filter(Boolean)).size,'개');charts.push(line('유입 경로별 웹 활동',records,r=>String(r.traffic_source),()=>1,'건'));charts.push(distribution('기기별 웹 활동',r=>String(r.device),'donut',['mobile','desktop']));break;
 case 'T18':{
  const order=['view_item','add_to_cart','begin_checkout','purchase'],data=order.map(event=>{const rs=records.filter(r=>r.event_name===event);return {id:event,values:{name:names[event],quantity:sum(rs,r=>r.quantity)},source:rs};});
  const purchased=records.filter(r=>r.event_name==='purchase'),refund=records.filter(r=>r.event_name==='refund');metric('상품 구매 수량',sum(purchased,r=>r.quantity),'개',purchased);metric('환불 이벤트 수량',sum(refund,r=>r.quantity),'개',refund);metric('행동이 기록된 제품',new Set(records.map(productId)).size,'개');
  charts.push(chart('상품 행동별 수량','stages','개',data,[series('quantity','상품 수량')],'상품행 이벤트의 수량 합계 · 같은 이용자의 연속 경로 또는 퍼널 전환율이 아님'));
  charts.push(line('일별 상품 구매 수량',purchased,product,r=>n(r.quantity),'개'));charts.push(rank('제품별 상품 구매 수량',purchased,product,r=>n(r.quantity),'개'));break;
 }
 case 'T19':metric('주문',new Set(records.map(r=>r.order_id)).size,'건');metric('상품 판매 수량',sum(records,r=>r.quantity),'개');metric('주문행 매출',sum(records,r=>r.line_gross_total),model.currency,records,'money');charts.push(line('일별 주문행 매출',records,product,r=>n(r.line_gross_total),model.currency));charts.push(rank('제품별 주문행 매출',records,product,r=>n(r.line_gross_total),model.currency));break;
 case 'T20':metric('취소·반품·환불 요청',records.length,'건');metric('완료된 요청',records.filter(r=>r.status==='completed').length,'건');charts.push(distribution('요청 종류',r=>String(r.adjustment_kind),'donut',['cancel','return','refund']));charts.push(distribution('처리 상태',r=>String(r.status),'donut',['pending','completed']));break;
 case 'T21':{
  const rs=latest(records,productId);metric('원가 등록 제품',rs.length,'개');charts.push(chart('제품별 최근 단위 원가','comparison',model.currency,rs.map(r=>({id:String(r.record_id),values:{name:product(r),cost:n(r.unit_cost),period:day(r)},source:[r]})),[series('cost','단위 원가 ('+model.currency+')'),series('period','적용 기간')]));break;
 }
 case 'T22':{
  const rs=latest(records,r=>productId(r)+'/'+r.location_ref),allowed=new Set(records.map(productId)),hs=history.filter(r=>allowed.has(productId(r)));
  metric('최근 판매 가능 재고',sum(rs,r=>r.available_quantity),'개',rs);metric('관측 위치',new Set(records.map(r=>r.location_ref)).size,'곳');metric('품절 관측',records.filter(r=>Number(r.available_quantity)===0).length,'회');
  charts.push(line('제품별 판매 가능 재고 추이',hs,product,r=>n(r.available_quantity),'개'));
  charts.push(chart('위치별 품절 관측 달력','calendar','일',records.map(r=>({id:String(r.record_id),values:{name:product(r)+' · 위치 '+String(r.location_ref).split('-').at(-1),date:day(r),status:Number(r.available_quantity)===0?'out':'observed',detail:'판매 가능 '+r.available_quantity+'개'},source:[r]})),[series('status','관측 상태')],'기록이 없는 날짜는 정상 재고로 채우지 않음'));break;
 }
 case 'T24':{
  const ratings=records.filter(r=>r.rating_value!=null&&Number(r.rating_scale_max)===5),own=ratings.filter(r=>productId(r).startsWith('P1'));
  metric('수집 리뷰',records.length,'개');metric('평균 별점',average(ratings,r=>r.rating_value),'점',ratings,'decimal');metric('2점 이하 리뷰',ratings.filter(r=>Number(r.rating_value)<=2).length,'개');metric('리뷰 제품',new Set(records.map(productId)).size,'개');
  charts.push(chart('제품별 리뷰 요약','rating-profile','5점 만점',groups(ratings,productId).sort(([a],[b])=>a.localeCompare(b)).map(([p,rs])=>({id:p,values:{name:products[p],rating:average(rs,r=>r.rating_value),count:rs.length,...Object.fromEntries([1,2,3,4,5].map(s=>['star'+s,rs.filter(r=>Number(r.rating_value)===s).length]))},source:rs})),[series('rating','평균 별점'),series('count','표본 수')]));
  charts.push(chart('자사 별점 분포','pie','개',[5,4,3,2,1].map(s=>{const rs=own.filter(r=>Number(r.rating_value)===s);return{id:String(s),values:{name:s+'점',count:rs.length},source:rs};}),[series('count','리뷰 수')]));break;
 }
 case 'T23':{
  const shipments=records.filter(r=>r.record_kind==='fulfilment'),delivered=shipments.filter(r=>r.delivered_at),onTime=delivered.filter(r=>Date.parse(String(r.delivered_at))<=Date.parse(String(r.promised_at)));metric('배송 기록',shipments.length,'건',shipments);metric('배송 완료',delivered.length,'건',delivered);metric('약속일 내 배송',delivered.length?onTime.length/delivered.length*100:null,'%',delivered,'percent');
  charts.push(chart('배송 처리 상태','donut','건',groups(shipments,r=>String(r.status)).map(([status,g])=>({id:status,values:{name:status==='in_transit'?'배송 중':status==='delivered'?'배송 완료':status,v:g.length},source:g})),[series('v','배송 기록')]));break;
 }
 case 'T25':metric('가상 주석',records.length,'건');metric('연결 리뷰',new Set(records.map(r=>r.review_ref)).size,'개');charts.push(distribution('리뷰 측면별 주석',r=>String(r.aspect_ref),'bar'));charts.push(distribution('문장에 표시된 의견 방향',r=>String(r.sentiment),'donut',['positive','neutral','negative']));break;
 case 'T26':{
  const resolved=records.filter(r=>r.status==='resolved'||r.status==='closed'),open=records.filter(r=>r.status==='open');metric('접수 문의',records.length,'건');metric('미해결 문의',open.length,'건',open);metric('해결 비율',resolved.length/records.length*100,'%',records,'percent');
  charts.push(line('일별 고객 문의 접수',records,r=>String(r.subject),()=>1,'건'));charts.push(distribution('문의 주제별 접수',r=>String(r.subject),'bar'));charts.push(distribution('문의 처리 상태',r=>String(r.status),'donut',['open','pending','resolved','closed']));break;
 }
 case 'T27':metric('관측 콘텐츠',new Set(records.map(r=>r.content_id)).size,'개');metric('누적 조회수',sum(latest(records,r=>String(r.content_id)),r=>r.view_count),'회');charts.push(rank('제품별 콘텐츠 조회수',latest(records,r=>String(r.content_id)),product,r=>n(r.view_count),'회'));charts.push(distribution('플랫폼별 콘텐츠',r=>String(r.platform)));break;
 case 'T28':metric('수집 댓글',records.length,'개');metric('연결 콘텐츠',new Set(records.map(r=>r.content_ref)).size,'개');charts.push(line('댓글 수집 추이',records,()=> '댓글',()=>1,'개'));break;
 case 'T29':metric('가상 협업',records.length,'건');metric('협업 표기 비용',sum(records,r=>r.fee),model.currency,records,'money');charts.push(chart('협업별 대상·비용·계약 상태','comparison','',records.map(r=>({id:String(r.record_id),values:{name:product(r),fee:obj(r.fee).amount+' '+obj(r.fee).currency,status:r.agreement_status as string},source:[r]})),[series('fee','가상 표기 비용'),series('status','가상 계약 상태')]));break;
 case 'T30':metric('고객 코호트',records.length,'개');charts.push(chart('코호트별 구매·재구매 현황','comparison','',records.map(r=>({id:String(r.record_id),values:{name:'고객군 '+String(r.cohort_ref).split('-').at(-1),size:r.sample_size as number,repeat:(Number(r.repeat_purchase_rate)*100).toFixed(1)+'%',revenue:obj(r.net_revenue).amount+' '+obj(r.net_revenue).currency},source:[r]})),[series('size','코호트 표본'),series('repeat','재구매율'),series('revenue','순매출')]));break;
 case 'T31':metric('이메일 발송',sum(records,r=>r.emails_sent),'통');metric('이메일 반송',sum(records,r=>r.bounces),'통');charts.push(chart('이메일 반응 요약','stages','건',[['emails_sent','발송'],['bounces','반송'],['unique_clickers','캠페인별 클릭자 합'],['unsubscribes','구독 해지']].map(([field,name])=>({id:field,values:{name,v:sum(records,r=>r[field])},source:records})),[series('v','캠페인 보고 합계')],'유일 클릭자는 캠페인별 보고 합계이며 캠페인 간 고유 인원은 아님'));break;
 case 'T33':metric('최근 문맥 지수',n([...records].sort((a,b)=>day(b).localeCompare(day(a)))[0].value),'지수',records,'decimal');charts.push(line('시장 문맥 지수 추이',history,()=> '문맥 지수',r=>n(r.value),'지수','median'));break;
 case 'T34':{
  const weather=records.filter(r=>r.record_kind==='weather');metric('평균 관측 기온',average(weather,r=>measure(r,'temperature')),'°C',weather,'decimal');metric('관측 강수량 합계',sum(weather,r=>measure(r,'precipitation')),'mm',weather,'decimal');charts.push(line('기온 변화 · 마케팅 보조 맥락',weather,()=> '기온',r=>n(measure(r,'temperature')),'°C','median'));charts.push(line('강수량 변화',weather,()=> '강수량',r=>n(measure(r,'precipitation')),'mm','median'));break;
 }
 case 'T37':{
  const incidents=records.filter(r=>r.record_kind==='incident'),performance=records.filter(r=>r.record_kind==='performance');metric('기록된 장애',incidents.length,'건',incidents);metric('최장 장애 시간',incidents.length?Math.max(...incidents.map(r=>(Date.parse(String(r.incident_end))-Date.parse(String(r.incident_start)))/3600000)):null,'시간',incidents,'decimal');metric('가장 느린 관측 p75',performance.length?Math.max(...performance.map(r=>Number(measure(r,'lcp_p75')))):null,'ms',performance);
  if(incidents.length)charts.push(chart('페이지별 장애 발생·지속 시간','calendar','시간',incidents.map(r=>({id:String(r.record_id),values:{name:product(r)+' · '+(names[String(r.device)]||r.device),date:day(r),status:'incident',hours:(Date.parse(String(r.incident_end))-Date.parse(String(r.incident_start)))/3600000,detail:String(r.incident_start)+' → '+String(r.incident_end)+' · '+r.error_text},source:[r]})),[series('hours','기록된 지속 시간')],'사건 기록이 없는 날은 정상 가동이나 가동률을 의미하지 않음'));
  if(performance.length)charts.push(chart('페이지별 가장 느린 관측 로딩 속도','comparison','ms',groups(performance,r=>product(r)+' · '+(names[String(r.device)]||r.device)).map(([name,g])=>({id:name,values:{name,lcp:Math.max(...g.map(r=>Number(measure(r,'lcp_p75')))),count:g.length},source:g})),[series('lcp','가장 느린 관측 p75 (ms)'),series('count','측정 표본')]));break;
 }
 case 'T39':{
  const candidates=records.filter(r=>r.record_kind==='budget_scenario');metric('가상 예산안',candidates.length,'개',candidates);charts.push(chart('가상 예산안 · 채널 배분과 모형 결과','comparison','',candidates.map(r=>({id:String(r.record_id),values:{name:String(r.scenario_id_ref),budget:obj(r.total_budget).amount+' '+obj(r.total_budget).currency,search:((r.allocations||[])as Raw[]).filter(a=>String(a.campaign_ref).endsWith('search')).map(a=>obj(a.amount).amount).join(' / '),social:((r.allocations||[])as Raw[]).filter(a=>String(a.campaign_ref).endsWith('social')).map(a=>obj(a.amount).amount).join(' / '),expected:n(measure(r,'expected_conversions','expected_measures'))},source:[r]})),[series('budget','가상 총예산'),series('search','검색 배분'),series('social','소셜 배분'),series('expected','모형 예상 전환')],'실제 성과·추천·집행이 아닌 등록된 가상 모형의 후보 내역'));break;
 }
 default:return;
 }
 model.metrics=metrics;model.charts=charts.filter(c=>c.data.length);
 model.detailTitle=({T04:'제품별 구매 경험 조사',T05:'검색 관심 관측',T06:'키워드 수요',T08:'판매처별 가격 관측',T18:'상품 행동 상세',T22:'위치별 재고 관측',T24:'리뷰 원문',T26:'고객 문의 내역',T32:'브랜드 인식 조사',T37:'장애·성능 측정 내역'}as Record<string,string>)[model.type]||model.title+' 내역';
 const displayFields:Record<string,string[]>={T04:['name','period','sample_size','measures'],T08:['name','observed_at','seller_ref','listed_price','availability'],T18:['name','event_time','event_name','quantity'],T22:['name','observed_at','location_ref','available_quantity','committed_quantity','on_hand_quantity','sellable_status'],T24:['name','written_at','rating_value','body','verified_purchase','language'],T26:['name','created_at','subject','channel','status','body'],T32:['name','period','sample_size','question_text','measures']};
 if(displayFields[model.type]){if(['T24','T26'].includes(model.type)){for(const row of model.rows)row.values.body=row.values.body_text??row.values.message_text??null;model.columns.push({key:'body',label:model.type==='T24'?'리뷰 본문':'문의 내용',kind:'text'});}model.columns=displayFields[model.type].flatMap(key=>{const column=model.columns.find(c=>c.key===key);return column?[{...column,label:key==='name'?'제품':key==='status'&&model.type==='T26'?'처리 상태':column.label}]:[];});}
}
