export type Context = { channel: string; period: string };
export const channels = [
 {name:'Meta Ads',spend:18000000,revenue:45000000,conversions:900,clicks:45000,previous:{spend:16000000,revenue:64000000,conversions:1280,clicks:40000}},
 {name:'Google Ads',spend:14000000,revenue:70000000,conversions:1400,clicks:28000,previous:{spend:14000000,revenue:63000000,conversions:1260,clicks:28000}},
 {name:'Naver',spend:8000000,revenue:32000000,conversions:800,clicks:24000,previous:{spend:8000000,revenue:32000000,conversions:800,clicks:24000}},
 {name:'Kakao',spend:2000000,revenue:4000000,conversions:160,clicks:10000,previous:{spend:2000000,revenue:7000000,conversions:160,clicks:10000}},
];
export const money=(n:number)=>`₩${Math.round(n).toLocaleString('ko-KR')}`;
export const compact=(n:number)=>n>=100000000?`₩${(n/100000000).toFixed(2)}억`:`₩${(n/10000).toLocaleString('ko-KR',{maximumFractionDigits:1})}만`;
export const ratio=(a:number,b:number)=>b?a/b:null;
export const delta=(a:number,b:number)=>b?(a-b)/b*100:null;
export const pct=(n:number|null)=>n===null?'계산 불가':`${n>0?'+':''}${n.toFixed(1)}%`;
export function aggregate(ctx:Context){
 const rows=channels.filter(c=>ctx.channel==='전체 채널'||ctx.channel===c.name);
 const t=rows.reduce((a,c)=>{const r=ctx.period==='지난주'?c.previous:c;return {spend:a.spend+r.spend,revenue:a.revenue+r.revenue,conversions:a.conversions+r.conversions,clicks:a.clicks+r.clicks};},{spend:0,revenue:0,conversions:0,clicks:0});
 return {...t,roas:ratio(t.revenue,t.spend),cpa:ratio(t.spend,t.conversions),cvr:ratio(t.conversions,t.clicks)};
}
export type Analysis={title:string;conclusion:string;scope:Context;sections:{title:string;paragraphs:string[]}[];metrics:{label:string;before:string;current:string;change:string}[];rows:{name:string;spend:string;revenue:string;change:string;roas:string;cvr:string;clicks:string;conversions:string;cpa:string;aov:string}[];closing:string;followups:string[]};
const amount=(n:number)=>`${(n/10000).toLocaleString('ko-KR',{maximumFractionDigits:1})}만원`;
const rate=(n:number|null)=>`${((n??0)*100).toFixed(2)}%`;
// ponytail: curated demo reports from weekly aggregates, not unrestricted LLM answers. Replace this boundary when connecting a model.
export function analyze(question:string,ctx:Context):Analysis{
 const q=question.trim(),scope={...ctx};
 if(/메타|meta/i.test(q))scope.channel='Meta Ads';else if(/구글|google/i.test(q))scope.channel='Google Ads';else if(/네이버|naver/i.test(q))scope.channel='Naver';else if(/카카오|kakao/i.test(q))scope.channel='Kakao';else if(/전체|채널별|종합/.test(q))scope.channel='전체 채널';
 if(/지난주/.test(q)&&!/비교|대비/.test(q))scope.period='지난주';if(/이번\s?주/.test(q))scope.period='이번 주';
 const a:Analysis={title:'마케팅 성과 종합 분석',conclusion:'',scope,sections:[],metrics:[],rows:[],closing:'',followups:[]};

 if(/내년|보장|경쟁사|소재별|연령별|어제|오늘|지난달|이번달/.test(q))return {...a,title:'분석 범위',conclusion:'요청한 기간·세부 데이터가 없어 분석할 수 없습니다.',sections:[{title:'가능한 분석',paragraphs:['현재 두 주간의 채널별 성과와 예산 조정 우선순위는 확인할 수 있습니다.']}],closing:''};
 if(!/성과|매출|광고|예산|전환|roas|cpa|채널|메타|meta|구글|google|네이버|naver|카카오|kakao|요약|보고|비교|왜|떨어|문제|망|분석|비용|클릭|종합|개판|대응|조치|추천|어떻게/i.test(q))return {...a,title:'분석 요청',conclusion:'“이번 주 성과를 종합 분석해줘”처럼 요청해 주세요.'};
 const now=aggregate(scope),before=aggregate({...scope,period:'지난주'}),compare=scope.period==='이번 주';
 const selected=channels.filter(c=>scope.channel==='전체 채널'||scope.channel===c.name);

 const pair=(current:number,previous:number,format:(n:number)=>string)=>compare?`${format(previous)} → ${format(current)}`:format(current);
 const integer=(n:number)=>n.toLocaleString('ko-KR');
 a.rows=selected.map(c=>{const r=compare?c:c.previous,b=c.previous;return {name:c.name,spend:pair(r.spend,b.spend,amount),revenue:pair(r.revenue,b.revenue,amount),change:compare?`${r.revenue-b.revenue>0?'+':''}${amount(r.revenue-b.revenue)}`:'—',roas:pair(r.revenue/r.spend,b.revenue/b.spend,n=>`${n.toFixed(2)}배`),cvr:pair(r.conversions/r.clicks,b.conversions/b.clicks,rate),clicks:pair(r.clicks,b.clicks,integer),conversions:pair(r.conversions,b.conversions,n=>`${integer(n)}건`),cpa:pair(r.spend/r.conversions,b.spend/b.conversions,money),aov:pair(r.revenue/r.conversions,b.revenue/b.conversions,money)};});
 const metric=(label:string,current:number,previous:number,format:(n:number)=>string)=>({label,current:format(current),before:compare?format(previous):'—',change:compare?pct(delta(current,previous)):'—'});
 a.metrics=[metric('매출',now.revenue,before.revenue,amount),metric('광고비',now.spend,before.spend,amount),metric('광고비 대비 매출 (ROAS)',now.roas??0,before.roas??0,n=>`${n.toFixed(2)}배`),metric('구매당 광고비 (CPA)',now.cpa??0,before.cpa??0,money),metric('클릭',now.clicks,before.clicks,n=>`${integer(n)}회`),metric('구매 수',now.conversions,before.conversions,n=>`${integer(n)}건`),metric('구매 전환율',now.cvr??0,before.cvr??0,rate),metric('구매당 매출',now.revenue/now.conversions,before.revenue/before.conversions,money)];

 if(!compare){a.title='지난주 성과';a.conclusion='이전 주 데이터가 없어 성과의 개선·악화는 판단할 수 없습니다.';a.sections=[{title:'성과 현황',paragraphs:[`매출 ${amount(now.revenue)} · 광고비 ${amount(now.spend)} · ROAS ${(now.roas??0).toFixed(2)}배`,`구매 ${now.conversions.toLocaleString()}건 · 전환율 ${rate(now.cvr)} · 구매당 광고비 ${money(now.cpa??0)}`]},{title:'추천 행동',paragraphs:['이번 주와 비교해 변화가 큰 채널부터 확인하세요.']}];return a;}
 const all=scope.channel==='전체 채널',budget=/예산|배분|더\s?써/.test(q);
 a.title=budget?'예산 조정 방향':/전환|클릭|퍼널/.test(q)?'구매 전환 분석':'성과 분석';
 const conclusions:Record<string,string>={
 '전체 채널':budget?'Meta 증액은 보류하고, Google은 조건부 확대를 검토하세요.':'매출 감소의 중심은 Meta입니다. 추가 증액보다 구매 전환 하락 점검이 먼저입니다.',
 'Meta Ads':'클릭은 늘었지만 구매가 줄었습니다. 증액을 보류하고 전환율 하락부터 점검하세요.',
 'Kakao':'구매 수는 같지만 구매당 매출이 줄었습니다. 상품·할인·매출 집계를 먼저 확인하세요.',
 'Google Ads':'같은 광고비로 구매와 매출이 늘었습니다. 현재 집행을 유지하고, 증액은 소규모 실험으로 검토하세요.',
 'Naver':'성과 변화가 없습니다. 현재 집행을 유지하고 목표 효율을 확인하세요.'};
 a.conclusion=conclusions[scope.channel]??'분석할 채널을 선택해 주세요.';
 a.sections.push({title:'성과 변화',paragraphs:[]});
 const facts:Record<string,string[]>={
 'Meta Ads':['Meta: 클릭 +12.5%, 구매 −29.7%. 전환율 3.20% → 2.00%, 구매당 매출은 5만원으로 같습니다. 매출 감소는 구매 수 감소로 설명됩니다. 광고비는 12.5% 늘었고 구매당 광고비는 12,500원 → 20,000원(+60.0%)입니다.','지난주 전환율을 이번 주 45,000클릭에 적용하면 1,440건으로 실제보다 540건 많습니다. 전환율 차이를 설명하는 비교값이며, 회복 가능한 구매 수나 예상 매출은 아닙니다.'],
 'Kakao':['Kakao: 구매 160건으로 동일. 구매당 매출은 43,750원 → 25,000원으로 떨어졌습니다. 전환율 하락과는 다른 문제입니다.'],
 'Google Ads':['Google: 광고비 1,400만원으로 동일. 전환율 4.50% → 5.00%, 매출 +11.1%. 구매당 매출은 5만원으로 같습니다.'],
 'Naver':['Naver: 매출 3,200만원, 광고비 800만원, 구매 800건으로 동일합니다. 이번 매출 감소에 기여하지 않았습니다.']};
 a.sections.push({title:'핵심 근거',paragraphs:all?['전체 매출 −1,500만원: Meta −1,900만원, Kakao −300만원을 Google +700만원이 일부 상쇄했습니다.',...facts['Meta Ads'],...facts['Kakao'],...facts['Google Ads'],...facts['Naver']]:facts[scope.channel]??[]});
 const actions:Record<string,string[]>={
 'Meta Ads':['Meta 증액 보류 — 캠페인별 전환율과 유입 구성, 랜딩·결제 오류, 전환 추적 변경을 확인하세요.'],
 'Kakao':['Kakao 매출 검증 — 상품 구성·할인·취소/환불·매출 귀속 기준을 비교하세요.'],
 'Google Ads':['Google 유지·조건부 확대 — 목표 수익성과 추가 집행 여력을 확인하고, 소규모 증액 후 추가 광고비의 효율을 측정하세요.'],
 'Naver':['Naver 유지 — 목표 효율 이탈 여부를 관찰하세요.']};
 a.sections.push({title:'추천 행동',paragraphs:(all?['Meta Ads','Kakao','Google Ads','Naver']:selected.map(c=>c.name)).flatMap(n=>actions[n])});
 a.closing=budget||all||scope.channel==='Google Ads'?'원인은 집계만으로 확정할 수 없습니다. 최적 예산·추가 매출은 산정하지 않았으며, 현재 ROAS가 증액 후에도 유지된다는 보장은 없습니다.':'집계상 변화는 확인됐지만 원인은 아직 확정되지 않았습니다. 점검 후 같은 기간·귀속 기준으로 재평가하세요.';
 return a;
}
