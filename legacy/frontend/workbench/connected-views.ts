import {marketingSummary} from './marketing-summary';
import type {Chart,Model,Raw,Row} from './contract';
const object=(v:unknown):Raw=>v&&typeof v==='object'&&!Array.isArray(v)?v as Raw:{};
const get=(r:Raw,path:string):unknown=>path.split('.').reduce<unknown>((v,k)=>object(v)[k],r);
const numeric=(v:unknown):number|null=>v==null?null:typeof v==='object'?numeric(object(v).amount):Number.isFinite(Number(v))?Number(v):null;
const colors=['#9B7EDB','#B19BE5','#C2B3DD','#C58CB9','#D78DB4'];
const translations:Record<string,string>={candidate:'후보',active:'운영 중',open:'접수',resolved:'해결',pending:'대기',completed:'완료',failed:'실패',success:'성공',partial:'부분 수신',paid:'결제 완료',refunded:'환불',cancel:'취소',return:'반품',in_transit:'배송 중',delivered:'배송 완료',text:'텍스트',positive:'긍정',neutral:'중립',negative:'부정',proposed:'제안',page_view:'페이지 조회',session_start:'세션 시작',purchase:'구매',refund:'환불',add_to_cart:'장바구니',begin_checkout:'결제 시작',mobile:'모바일',desktop:'데스크톱'};
export function connectVisuals(model:Model,records:Raw[],context?:string,history:Raw[]=records){
 if(!records.length)return;
 const type=model.type;
 const label=(r:Raw)=>String(r.keyword||r.title||r.subject||r.subject_ref||r.variant_ref||r.campaign_ref||r.creative_id||r.content_id||r.cohort_ref||r.crm_campaign_id||r.entity_ref||r.policy_id||r.record_id).replace('D005-V-','');
 const at=(r:Raw)=>String(object(r.period||r.expected_period||r.planned_period).start||r.observed_at||r.event_time||r.changed_at||r.created_at||r.written_at||r.published_at||r.incident_start||'').slice(0,10);
 const primary=(r:Raw)=>`${label(r)}${at(r)?' · '+at(r):''}`;
 const note='현재 선택한 원천 표본 · 다른 배치·통화·정의·집계 수준을 합치지 않음';
 const chart=(title:string,unit:string,data:Row[],series:Chart['series'],kind:Chart['kind']='vertical-bars'):Chart=>({title,subtitle:`${model.country} · ${model.period}`,unit,data,series,kind,note});
 const series=(name:string,i=0)=>({key:'v'+i,name,color:colors[i%colors.length]});
 const distribution=(title:string,key:string):Chart=>{
  const groups=new Map<string,Raw[]>();for(const r of records){const raw=get(r,key);const name=raw==null?'미제공':String(raw);groups.set(name,[...(groups.get(name)||[]),r]);}
  return chart(title,'건',[...groups].map(([name,rs])=>({id:name,values:{name:translations[name]||name,v0:rs.length},source:rs})),[series('레코드 수')]);
 };
 const values=(title:string,unit:string,rows:Raw[],paths:string[],names:string[],name=(r:Raw)=>primary(r),kind:Chart['kind']='bar')=>chart(title,unit,rows.map(r=>({id:String(r.record_id),values:{name:name(r),...Object.fromEntries(paths.map((p,i)=>['v'+i,numeric(get(r,p))]))},source:[r]})),names.map(series),kind);
 const measure=(r:Raw,part:string,collection='measures')=>((r[collection]||[])as Raw[]).find(m=>String(m.metric_id).endsWith('.'+part));
 const measured=(title:string,unit:string,part:string,collection='measures',rs=records)=>chart(title,unit,rs.map(r=>({id:String(r.record_id),values:{name:primary(r),v0:numeric(measure(r,part,collection)?.value)},source:[r]})),[series(title)],'bar');
 // Count records and identifiers, not population, unique people, or pooled samples.
 const ids=new Set(records.map(r=>String(r.subject_ref||r.variant_ref||r.campaign_ref||r.product_ref||r.content_ref||r.order_ref||r.experiment_id||r.model_ref||r.cohort_ref||r.policy_id||r.record_id)));
 model.metrics=[model.metrics[0],{label:'연결 대상',value:ids.size,kind:'number',unit:'개',source:records,note:'선택 레코드의 선언된 대상 ID 수 · 유일 고객 수와 다름'}];
 const add=(c:Chart)=>model.charts.push(c);
 model.charts=[];
 switch(type){
 case 'T01':add(distribution('브랜드별 제품 기준','brand_id'));break;
 case 'T02':add(distribution('식별자 연결 상태','match_status'));add(distribution('연결 시스템','external_system'));break;
 case 'T04':add(values('패널별 표본 수','명',records,['sample_size'],['표본 수']));add(measured('패널별 긍정 응답 수','명','panel_positive_count'));break;
 case 'T05':{const scope=typeof context==='string'&&records.some(r=>r.normalization_scope===context)?context:String(records[0].normalization_scope);const rs=records.filter(r=>r.normalization_scope===scope);const c=values('검색 관심지수 · 동일 정규화 범위','지수',rs,['index_value'],['관심지수'],at,'line');c.subtitle=scope;c.note='선택한 정규화 범위의 관측값만 표시 · 절대 검색수 및 다른 정규화 범위와 비교하지 않음';add(c);break;}
 case 'T06':add(values('키워드별 예상 검색수','회',records,['estimated_searches'],['예상 검색수'],r=>String(r.keyword)));add(distribution('키워드 경쟁 수준','competition_level'));break;
 case 'T07':add(values('페이지·기기별 검색 유입','회',records,['clicks','impressions'],['클릭수','노출수'],r=>`${r.page_ref} · ${r.device} · ${at(r)}`));break;
 case 'T08':add(values('판매처별 관측 가격',model.currency,records,['listed_price','regular_price'],['관측 가격','기준 가격'],r=>`${r.variant_ref} · ${r.seller_ref} · ${at(r)}`));add(distribution('가격 관측 상태','availability'));break;
 case 'T09':add(values('프로모션 할인율','%',records.map(r=>({...r,_discount:numeric(r.discount_ratio)==null?null:Number(r.discount_ratio)*100})),['_discount'],['할인율'],r=>`${(r.product_refs as string[]||[]).join(' · ')} · ${at(r)}`));break;
 case 'T10':add(distribution('공개 광고 형식','format'));add(distribution('광고주별 공개 표본','advertiser_ref'));break;
 case 'T11':add(distribution('공개 자료 발행처','publisher'));break;
 case 'T12':add(values('캠페인별 설정 예산',model.currency,records,['budget_amount'],['설정 예산'],r=>`${r.campaign_id} · ${r.budget_period}`));add(distribution('캠페인 운영 상태','status'));break;
 case 'T14':add(values('세그먼트별 광고비',model.currency,records,['metrics.spend'],['광고비'],r=>`${r.campaign_ref} · ${at(r)} · ${(r.breakdown_dimensions as Raw[]||[]).map(d=>translations[String(d.value)]||String(d.value)).join(' · ')}`));break;
 case 'T15':add(values('경쟁 도메인별 보고 점유율','%',records.map(r=>({...r,_share:numeric(r.impression_share)==null?null:Number(r.impression_share)*100,_overlap:numeric(r.overlap_rate)==null?null:Number(r.overlap_rate)*100})),['_share','_overlap'],['노출 점유율','중복률'],r=>`${r.competitor_domain} · ${r.campaign_ref} · ${at(r)}`));break;
 case 'T16':add(distribution('소재 형식별 버전','format'));add(distribution('소재 버전 구성','version'));break;
 case 'T17':add(distribution('웹 이벤트 구성','event_name'));add(distribution('기기별 이벤트','device'));break;
 case 'T18':add(distribution('상품 이벤트 구성','event_name'));add(values('상품 이벤트별 수량','개',records,['quantity'],['관측 수량']));break;
 case 'T19':add(values('주문행별 금액',model.currency,records,['line_gross_total'],['주문행 금액']));add(distribution('주문 결제 상태','financial_status'));break;
 case 'T20':add(distribution('취소·반품·환불 종류','adjustment_kind'));add(distribution('처리 상태','status'));break;
 case 'T21':add(values('제품별 단위 원가',model.currency,records,['unit_cost'],['단위 원가']));break;
 case 'T22':add(values('위치별 관측 재고','개',records,['available_quantity','committed_quantity','on_hand_quantity'],['판매 가능','예약','보유'],r=>`${r.variant_ref} · ${r.location_ref} · ${at(r)}`));add(distribution('판매 가능 상태','sellable_status'));break;
 case 'T23':add(distribution('배송·유통 처리 상태','status'));add(distribution('배송·유통 자료 종류','record_kind'));break;
 case 'T25':add(distribution('가상 규칙 주석 분포','sentiment'));add(distribution('리뷰 측면별 주석 수','aspect_ref'));break;
 case 'T26':add(distribution('문의 주제별 접수','subject'));add(distribution('문의 처리 상태','status'));break;
 case 'T27':add(values('콘텐츠별 관측 조회수','회',records,['view_count'],['관측 조회수'],r=>`${r.content_id} · ${at(r)}`));add(distribution('콘텐츠 플랫폼','platform'));break;
 case 'T28':add(distribution('콘텐츠별 댓글 표본','content_ref'));break;
 case 'T29':add(values('협업별 계약 표기 비용',model.currency,records,['fee'],['표기 비용'],r=>String(r.collaboration_id)));add(distribution('가상 협업 계약 상태','agreement_status'));break;
 case 'T30':add(values('코호트별 표본 수','명',records,['sample_size'],['코호트 표본']));add(values('코호트별 순매출',model.currency,records,['net_revenue'],['코호트 순매출']));break;
 case 'T31':add(values('CRM 캠페인별 발송·반송','통',records,['emails_sent','bounces'],['발송수','반송수'],r=>String(r.crm_campaign_id)));add(values('CRM 캠페인별 유일 클릭자','명',records,['unique_clickers'],['유일 클릭자'],r=>String(r.crm_campaign_id)));break;
 case 'T32':add(values('조사별 표본 수','명',records,['sample_size'],['응답 표본']));add(measured('조사별 긍정 응답 수','명','survey_positive_count'));break;
 case 'T33':add(values('국가 문맥 지수','지수',records,['value'],['문맥 지수'],at,'line'));break;
 case 'T34':add(measured('일별 기온 표본','°C','temperature'));add(measured('일별 강수량 표본','mm','precipitation'));break;
 case 'T35':{const money=records.filter(r=>object(r.before_value).amount!==undefined||object(r.after_value).amount!==undefined);if(money.length)add(values('변경 전·후 관측 가격',model.currency,money,['before_value','after_value'],['변경 전','변경 후']));add(distribution('변경 필드별 이력','changed_field'));break;}
 case 'T36':add(values('실행별 기대·수신·누락','건',records,['expected_count','received_count','missing_count'],['기대','수신','누락'],r=>String(r.run_id)));add(distribution('수집 실행 상태','status'));break;
 case 'T37':add(distribution('사이트 품질 사건 상태','status'));add(values('사이트 사건 지속 시간','시간',records.map(r=>({...r,_duration:r.incident_start&&r.incident_end?(Date.parse(String(r.incident_end))-Date.parse(String(r.incident_start)))/3600000:null})),['_duration'],['확인된 지속 시간'],r=>`${r.page_ref} · ${at(r)}`));break;
 case 'T38':{const experiment=typeof context==='string'&&records.some(r=>r.experiment_id===context)?context:String(records[0].experiment_id);const rs=records.filter(r=>r.experiment_id===experiment);const data=rs.map(r=>({id:String(r.record_id),values:{name:String(r.arm_id),v0:Number(r.sample_size)>0&&numeric(measure(r,'experiment_conversions','outcome_measures')?.value)!==null?Number(measure(r,'experiment_conversions','outcome_measures')?.value)/Number(r.sample_size)*100:null},source:[r]}));const c=chart('실험군별 관측 전환율','%',data,[series('전환율')]);c.subtitle=experiment;c.note='같은 실험 안의 실험군별 관측 전환수 / 해당 군 표본 수 ×100 · 유의성·효과 확정 아님';add(c);break;}
 case 'T39':{const selected=typeof context==='string'&&records.some(r=>r.model_ref===context)?context:String(records[0].model_ref);const rs=records.filter(r=>r.model_ref===selected&&r.record_kind==='budget_scenario');add(values('모형별 후보 총예산',model.currency,rs,['total_budget'],['후보 총예산'],r=>String(r.scenario_id_ref)));add(measured('후보별 모의 예상 전환수','건','expected_conversions','expected_measures',rs));break;}
 case 'T40':add(values('정책별 예산 한도',model.currency,records,['budget_limit'],['예산 한도'],r=>`${r.policy_id} · ${at(r)}`));add(distribution('모의 정책 상태','policy_status'));break;
 }
 const readable=(name:string)=>name.replace(/D005-V-/g,'').replace(/D007-Campaign-(?:KR|JP|US)-(P[123][AB])-(search|social)/g,(_,p,c)=>p+' '+(c==='search'?'검색':'소셜')).replace(/D007-(Content|CRM|CollectionRun|Seller|Location|AdvertiserDomain|Cohort|LandingPage|Policy|Creative|Experiment|BudgetScenario|ResponseModel|Study|Panel|Offer|Document|StatisticsTable|SearchTerm|Query|Creator)(?:-(?:KR|JP|US))?-/g,(_,k)=>({Content:'콘텐츠',CRM:'CRM',CollectionRun:'수집',Seller:'판매처',Location:'위치',AdvertiserDomain:'경쟁 도메인',Cohort:'코호트',LandingPage:'페이지',Policy:'정책',Creative:'소재',Experiment:'실험',BudgetScenario:'예산안',ResponseModel:'모형',Study:'조사',Panel:'패널',Offer:'제안',Document:'문서',StatisticsTable:'통계',SearchTerm:'검색어',Query:'요청',Creator:'크리에이터'} as Record<string,string>)[k]+' ').replace(/P1A/g,'자사 A').replace(/P1B/g,'자사 B').replace(/P2A/g,'경쟁1 A').replace(/P2B/g,'경쟁1 B').replace(/P3A/g,'경쟁2 A').replace(/P3B/g,'경쟁2 B');
 for(const c of model.charts)for(const r of c.data)r.values.name=readable(String(r.values.name));
 // KPI values are direct record-level observations; no pooled average of unrelated definitions.
 for(const c of model.charts){c.data=c.data.filter(r=>c.series.some(s=>r.values[s.key]!==null&&r.values[s.key]!==undefined));}
 model.charts=model.charts.filter(c=>c.data.length);
 marketingSummary(model,records,history);
}
