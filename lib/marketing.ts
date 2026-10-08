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
export type Analysis={title:string;conclusion:string;scope:Context;sections:{title:string;paragraphs:string[]}[];rows:{name:string;spend:string;revenue:string;change:string;roas:string;cvr:string}[];closing:string;followups:string[]};
const amount=(n:number)=>`${(n/10000).toLocaleString('ko-KR',{maximumFractionDigits:1})}만원`;
const rate=(n:number|null)=>`${((n??0)*100).toFixed(2)}%`;
// ponytail: curated demo reports from weekly aggregates, not unrestricted LLM answers. Replace this boundary when connecting a model.
export function analyze(question:string,ctx:Context):Analysis{
 const q=question.trim(),scope={...ctx};
 if(/메타|meta/i.test(q))scope.channel='Meta Ads';else if(/구글|google/i.test(q))scope.channel='Google Ads';else if(/네이버|naver/i.test(q))scope.channel='Naver';else if(/카카오|kakao/i.test(q))scope.channel='Kakao';else if(/전체|채널별|종합/.test(q))scope.channel='전체 채널';
 if(/지난주/.test(q)&&!/비교|대비/.test(q))scope.period='지난주';if(/이번\s?주/.test(q))scope.period='이번 주';
 const a:Analysis={title:'마케팅 성과 종합 분석',conclusion:'',scope,sections:[],rows:[],closing:'',followups:[]};
 if(/내년|보장|경쟁사|소재별|연령별|어제|오늘|지난달|이번달/.test(q))return {...a,title:'요청한 분석 범위 확인',conclusion:'현재 화면의 두 주간 채널 집계만으로는 요청한 기간이나 세부 항목을 분석할 수 없습니다.',sections:[{title:'현재 확인할 수 있는 내용',paragraphs:['주간 매출·광고비·구매 전환·클릭을 기준으로 성과 변화, 변화가 큰 채널, 예산 검토 우선순위를 설명할 수 있습니다. 소재·연령별 성과와 미래 매출은 해당 데이터 없이 추정하지 않겠습니다.']}],closing:'현재 화면의 성과를 종합 분석해 달라고 요청하면 제공된 범위에서 보고서를 작성하겠습니다.'};
 if(!/성과|매출|광고|예산|전환|roas|cpa|채널|메타|meta|구글|google|네이버|naver|카카오|kakao|요약|보고|비교|왜|떨어|문제|망|분석|비용|클릭|종합|개판|대응|조치|추천|어떻게/i.test(q))return {...a,title:'분석 요청 확인',conclusion:'현재 마케팅 화면을 기준으로 성과와 대응 방향을 분석할 수 있습니다.',sections:[{title:'분석 범위',paragraphs:['“이번 주 성과를 종합 분석해줘” 또는 “예산을 어떻게 조정해야 해?”처럼 요청해 주세요. 현재 기간과 채널을 기준으로 문제, 영향, 결론, 권고 행동을 한 번에 정리하겠습니다.']}],closing:''};
 const now=aggregate(scope),before=aggregate({...scope,period:'지난주'}),compare=scope.period==='이번 주';
 const selected=channels.filter(c=>scope.channel==='전체 채널'||scope.channel===c.name);
 a.rows=selected.map(c=>{const r=compare?c:c.previous;return {name:c.name,spend:amount(r.spend),revenue:amount(r.revenue),change:compare?`${c.revenue-c.previous.revenue>0?'+':''}${amount(c.revenue-c.previous.revenue)}`:'—',roas:`${(r.revenue/r.spend).toFixed(2)}배`,cvr:rate(r.conversions/r.clicks)};});
 if(!compare){a.conclusion=`${scope.channel}의 지난주 매출은 ${amount(now.revenue)}, 광고비는 ${amount(now.spend)}, 광고비 대비 매출은 ${(now.roas??0).toFixed(2)}배입니다. 이전 주 데이터가 없어 개선·악화 판단은 할 수 없습니다.`;a.sections=[{title:'성과 현황',paragraphs:[`클릭 ${now.clicks.toLocaleString()}회에서 구매 전환 ${now.conversions.toLocaleString()}건이 발생했습니다. 클릭 대비 구매 전환율은 ${rate(now.cvr)}, 구매 1건당 광고비는 ${money(now.cpa??0)}입니다.`,`채널별 수익률의 차이는 관측할 수 있지만, 광고 목적·고객 구성·귀속 기준이 같아야 직접 비교할 수 있습니다.`]},{title:'종합 판단과 권고',paragraphs:['현재 수치는 한 주의 현황입니다. 목표 효율과 비교 기간 없이 성과가 나쁘다고 판단하거나 예산을 변경할 근거는 부족합니다. 이번 주 데이터를 함께 비교해 변화가 생긴 채널부터 확인하는 것이 다음 순서입니다.']}];a.closing='이번 주로 기간을 바꾸면 두 기간의 차이와 채널별 영향을 분석할 수 있습니다.';return a;}
 a.conclusion=`${scope.channel} 매출은 ${amount(now.revenue)}로 지난주 대비 ${pct(delta(now.revenue,before.revenue))}, 광고비는 ${amount(now.spend)}로 ${pct(delta(now.spend,before.spend))}입니다. 광고비 대비 매출은 ${(before.roas??0).toFixed(2)}배에서 ${(now.roas??0).toFixed(2)}배로 변했습니다.`;
 a.sections.push({title:'1. 무엇이 달라졌나',paragraphs:[`구매 전환은 ${before.conversions.toLocaleString()}건에서 ${now.conversions.toLocaleString()}건으로 ${pct(delta(now.conversions,before.conversions))} 변했습니다. 클릭은 ${before.clicks.toLocaleString()}회에서 ${now.clicks.toLocaleString()}회로 ${pct(delta(now.clicks,before.clicks))} 변했고, 클릭 대비 구매 전환율은 ${rate(before.cvr)}에서 ${rate(now.cvr)}입니다.`,`구매 1건당 광고비는 ${money(before.cpa??0)}에서 ${money(now.cpa??0)}로 ${pct(delta(now.cpa??0,before.cpa??0))} 변했습니다. 이 지표와 매출을 함께 봐야 구매 수 감소와 구매당 매출 감소를 구분할 수 있습니다.`]});
 const diagnosis:Record<string,string[]>={
 'Meta Ads':['Meta Ads가 가장 먼저 점검할 구간입니다. 광고비는 1,600만원에서 1,800만원으로 12.5% 늘었지만, 매출은 6,400만원에서 4,500만원으로 29.7% 줄었습니다. 구매 1건당 광고비도 12,500원에서 20,000원으로 60.0% 상승했습니다.','클릭은 40,000회에서 45,000회로 늘었지만 전환율이 3.20%에서 2.00%로 떨어지면서 구매는 1,280건에서 900건으로 줄었습니다. 구매당 매출은 두 기간 모두 5만원입니다. 따라서 집계상 매출 감소는 구매 건수 감소로 설명되며, 유입 부족보다 클릭 이후 구매 전환과 유입 구성 변화가 우선 점검 대상입니다.','전환율이 지난주 수준이었다면 같은 45,000클릭에서 1,440건이 계산됩니다. 실제 900건과의 차이 540건은 전환율 차이를 설명하는 비교값입니다. 회복 가능한 구매 수나 예상 매출을 뜻하지는 않습니다.'],
 'Google Ads':['Google Ads는 같은 광고비 1,400만원으로 매출이 6,300만원에서 7,000만원으로 11.1% 증가했습니다. 클릭은 28,000회로 같고 구매가 1,260건에서 1,400건으로 늘어, 전환율은 4.50%에서 5.00%로 개선됐습니다.','구매당 매출은 5만원으로 같고, 광고비 대비 매출은 4.50배에서 5.00배로 높아졌습니다. 관측된 개선은 구매 건수 증가에서 나왔습니다. 다만 브랜드 검색·리타기팅 비중이나 귀속 변경을 확인하지 않았으므로 이를 광고 자체의 순증 효과로 확정할 수는 없습니다.'],
 'Naver':['Naver는 광고비 800만원, 매출 3,200만원, 구매 800건으로 두 기간 모두 같습니다. 전환율은 3.33%, 구매 1건당 광고비는 10,000원, 광고비 대비 매출은 4.00배입니다.','이번 집계에서 전체 매출 감소를 설명하는 채널은 아닙니다. 현재 집행을 유지하며 다른 채널의 문제를 먼저 점검하는 것이 합리적입니다. 수치가 안정적이라는 사실만으로 확대 여력이 있다고 판단하지는 않습니다.'],
 'Kakao':['Kakao는 클릭 10,000회와 구매 160건, 광고비 200만원이 두 기간 모두 같습니다. 그런데 매출은 700만원에서 400만원으로 42.9% 감소했습니다.','구매 전환율과 구매 비용이 그대로이므로, Meta와 달리 구매 건수 감소가 핵심은 아닙니다. 구매당 매출이 43,750원에서 25,000원으로 하락했습니다. 구매 상품 구성·할인·취소 및 환불 반영·매출 귀속 변경을 먼저 확인해야 합니다.']};
 a.sections.push({title:'2. 주요 영향과 채널별 진단',paragraphs:scope.channel==='전체 채널'?['전체 매출은 1,500만원 감소했습니다. Meta Ads에서 1,900만원, Kakao에서 300만원 줄었고 Google Ads의 700만원 증가가 일부를 상쇄했습니다. Naver는 변동이 없습니다. Meta의 감소액은 전체 순감소액의 126.7%이며, 다른 채널의 증가로 상쇄되기 때문에 100%를 넘습니다.',...selected.flatMap(c=>diagnosis[c.name])]:diagnosis[scope.channel]??[]});
 const all=scope.channel==='전체 채널',budget=/예산|배분|더\s?써/.test(q),funnel=/전환|클릭|퍼널/.test(q);
 if(budget)a.title='예산 조정 검토 보고서';else if(funnel)a.title='구매 전환 종합 분석';else if(/요약|보고|공유/.test(q))a.title='주간 마케팅 성과 보고';
 const recommendations:Record<string,string[]>={
 'Meta Ads':['Meta Ads의 추가 증액은 우선 보류하고, 두 기간의 캠페인별 클릭·구매 전환을 같은 귀속 기준으로 비교하세요. 전환율 하락이 특정 캠페인에 집중되는지, 여러 캠페인에 공통으로 나타나는지부터 구분해야 합니다.','광고 유입 구성과 소재·오퍼 변경 이력, 모바일 랜딩 및 결제 오류, 전환 추적 누락을 차례로 확인하세요. 현재 집계로 소재 피로도나 랜딩 문제를 확정할 수 없습니다. 문제가 확인된 구간에 한해 수정하고, 전환 집계가 충분히 반영된 뒤 같은 기준으로 재평가하세요.'],
 'Google Ads':['Google Ads는 현재 집행을 유지하고 확대 후보로 검토하세요. 브랜드 검색 의존도·캠페인별 효율·추가 집행 여력·이익 기준의 목표 효율을 확인한 뒤, 합의된 소규모 증액 실험으로 추가 광고비의 성과를 따로 측정하세요. 평균 수익률 5배를 추가 예산에도 그대로 적용하면 안 됩니다.'],
 'Naver':['Naver는 현재 예산과 운영을 유지하며 목표 효율 이탈 여부를 모니터링하세요. 변화가 없는 채널을 먼저 조정하기보다 성과가 크게 바뀐 채널에 조사 시간을 쓰는 편이 이번 분석에 맞습니다.'],
 'Kakao':['Kakao는 전환 개선보다 구매당 매출 검증이 먼저입니다. 두 기간의 주문 상품·할인·취소 및 환불·매출 집계 기준을 비교하세요. 상품 구성 변화라면 이익을 함께 보고, 추적이나 집계 문제라면 데이터 수정 후 예산 판단을 다시 해야 합니다.']};
 a.sections.push({title:'3. 종합 결론',paragraphs:[all?'전체 성과 하락을 모든 채널의 공통 문제로 볼 근거는 없습니다. 우선순위는 Meta의 구매 전환 하락, 다음은 Kakao의 구매당 매출 하락입니다. Google은 개선됐고 Naver는 안정적이므로 채널별로 다른 대응이 필요합니다.':scope.channel==='Meta Ads'?'핵심은 더 많은 클릭을 확보하는 것이 아니라 늘어난 유입이 구매로 이어지지 않는 구간을 확인하는 것입니다. 추가 광고비 투입보다 전환율 하락의 범위를 좁히는 작업을 우선해야 합니다.':scope.channel==='Kakao'?'구매 수가 같아도 매출은 줄 수 있습니다. 이번 변화는 구매당 매출 하락으로 설명되므로 구매 전환 문제와 분리해서 대응해야 합니다.':scope.channel==='Google Ads'?'동일 광고비에서 구매가 늘어난 개선입니다. 현재 운영을 유지할 근거는 있지만, 추가 집행의 성과까지 확인된 것은 아닙니다.':'현재 집계상 변화가 없어 유지·관찰이 우선입니다. 목표 달성 여부와 확대 판단에는 별도 기준이 필요합니다.',budget?'현재 데이터로 최적 예산 배분액이나 추가 매출을 계산할 수는 없습니다. 목표 수익성·채널별 확대 여력·추가 집행의 효율이 없기 때문입니다. 지금 제안할 수 있는 것은 조정의 우선순위와 검증 순서입니다.':'위 설명은 주간 집계의 변화와 산술적 분해입니다. 원인 확정에는 운영 이력과 더 세부적인 데이터가 필요합니다.']});
 a.sections.push({title:'4. 추천 행동과 확인 기준',paragraphs:(all?['Meta Ads','Kakao','Google Ads','Naver']:selected.map(c=>c.name)).flatMap(n=>recommendations[n])});
 a.closing=all?'이번 주 의사결정은 전 채널 일괄 감액보다 Meta 전환 점검과 Kakao 매출 검증에 집중하는 것이 적절합니다. Google의 확대는 조건을 확인한 실험으로 접근하고, 결과가 나오면 다음 예산 조정에 반영하세요.':'먼저 위 점검을 통해 집계 변화의 원인을 좁히고, 수정 전후 성과를 같은 기간·귀속 기준으로 비교한 뒤 집행을 조정하세요.';
 a.followups=all?['Meta Ads의 구매 전환 하락을 자세히 분석해줘','예산 조정 우선순위를 보고해줘']:['전체 채널 성과를 종합 분석해줘'];
 return a;
}
