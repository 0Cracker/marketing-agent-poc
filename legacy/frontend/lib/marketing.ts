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
export type Analysis={kind:string;title:string;conclusion:string;scope:Context;facts:{label:string;value:string;formula:string}[];hypothesis:string;actions:string[];choices:string[];followups:string[]};
// ponytail: rule-based scenario simulation; Cloud integration should replace this with schema-validated LLM output.
export function analyze(question:string,ctx:Context):Analysis{
 const q=question.trim(),scope={...ctx};
 if(/메타|meta/i.test(q))scope.channel='Meta Ads';else if(/구글|google/i.test(q))scope.channel='Google Ads';else if(/네이버|naver/i.test(q))scope.channel='Naver';else if(/카카오|kakao/i.test(q))scope.channel='Kakao';else if(/전체|채널별/.test(q))scope.channel='전체 채널';
 if(/지난주/.test(q)&&!/비교|대비/.test(q))scope.period='지난주';if(/이번\s?주/.test(q))scope.period='이번 주';
 const a:Analysis={kind:'performance',title:'성과 변화 분석',conclusion:'',scope,facts:[],hypothesis:'',actions:[],choices:[],followups:['채널별로 비교해줘','전환이 어디서 줄었어?','팀에 공유할 요약 만들어줘']};
 if(!/성과|매출|광고|예산|전환|roas|cpa|채널|메타|구글|네이버|카카오|요약|보고|비교|왜|떨어|문제|망|분석|비용|클릭/i.test(q)){return {...a,kind:'clarify',title:'어떤 업무를 도와드릴까요?',conclusion:'성과 점검, 원인 탐색, 예산 검토 중 먼저 할 일을 골라주세요.',choices:['이번 주 성과 점검해줘','ROAS 왜 떨어졌어?','예산 어디에 더 써야 해?']};}
 if(/망했|개판|뭐가\s?문제|잘\s?안|잘\s?되고/.test(q)&&!/roas|cpa|전환|매출/i.test(q))return {...a,kind:'clarify',title:'판단 기준을 먼저 정할게요',conclusion:`${scope.channel} · ${scope.period} 기준으로 볼게요. 어떤 지표가 가장 중요한가요?`,choices:['ROAS 기준으로 분석해줘','CPA 기준으로 분석해줘','전환수 기준으로 분석해줘']};
 if(/내년|확실|보장|경쟁사|소재별|연령별|어제|오늘|지난달|이번달/.test(q))return {...a,kind:'unavailable',title:'현재 근거로는 답하기 어렵습니다',conclusion:'이 데모에는 두 주간의 채널별 집계만 있습니다. 요청한 기간·세부 차원 또는 확정적인 예측은 제공할 수 없습니다.',actions:['현재 제공된 주간·채널별 성과로 범위를 좁혀주세요.'],choices:['이번 주 성과 점검해줘','채널별로 비교해줘']};
 const now=aggregate(scope),before=aggregate({...scope,period:'지난주'}),compare=scope.period==='이번 주';
 const roas=now.roas??0,cpa=now.cpa??0;
 a.facts=[{label:'ROAS',value:`${roas.toFixed(2)}배`,formula:`${money(now.revenue)} ÷ ${money(now.spend)}`},{label:'CPA',value:money(cpa),formula:`${money(now.spend)} ÷ ${now.conversions.toLocaleString()}건`},{label:'전환수',value:`${now.conversions.toLocaleString()}건`,formula:compare?`지난주 ${before.conversions.toLocaleString()}건 대비 ${pct(delta(now.conversions,before.conversions))}`:'이전 주의 비교 데이터 없음'}];
 a.conclusion=compare?`${scope.channel} ROAS는 ${roas.toFixed(2)}배로 지난주 대비 ${pct(delta(roas,before.roas??0))}입니다. ${scope.channel==='전체 채널'?'Meta Ads의 매출 감소를 우선 확인하세요.':`전환수는 ${pct(delta(now.conversions,before.conversions))} 변했습니다.`}`:`${scope.channel}의 지난주 ROAS는 ${roas.toFixed(2)}배, CPA는 ${money(cpa)}입니다. 그 이전 주 데이터가 없어 증감 판단은 보류합니다.`;
 a.hypothesis='채널 집계만으로 소재 피로도·타기팅·랜딩페이지 문제를 확정할 수 없습니다. 전환 감소 구간과 운영 변경 이력을 함께 검토해야 합니다.';
 a.actions=[`${scope.channel==='전체 채널'?'Meta Ads':scope.channel}의 캠페인·소재·랜딩 변경 이력을 확인하세요.`,'같은 귀속 기준에서 비교한 뒤 작은 실험으로 원인 가설을 검증하세요.'];
 if(/예산|더\s?써|배분/.test(q)){a.kind='budget';a.title='예산 배분 검토';const best=channels.filter(c=>scope.channel==='전체 채널'||c.name===scope.channel).map(c=>({name:c.name,r:scope.period==='지난주'?c.previous:c})).sort((a,b)=>b.r.revenue/b.r.spend-a.r.revenue/a.r.spend)[0];a.conclusion=`${best.name}의 관측 ROAS는 ${(best.r.revenue/best.r.spend).toFixed(2)}배입니다. 목표 효율과 추가 집행 여력을 확인한 뒤 소규모 예산 배분 실험을 검토하세요.`;a.hypothesis='평균 ROAS가 높아도 추가 예산의 효율이 같다는 보장은 없습니다. 한계 효율·집행 여력이 없어 최적 배분과 예상 매출을 단정하지 않습니다.';a.actions=['목표 ROAS·CPA와 변경 가능한 예산 상한을 정하세요.','합의된 한도 안에서 배분 실험을 하고 전환 지연을 고려해 결과를 비교하세요.'];}
 else if(/전환|클릭|퍼널/.test(q)&&!/cpa/i.test(q)){a.kind='funnel';a.title='전환 흐름 분석';a.conclusion=`클릭 ${now.clicks.toLocaleString()}회 중 ${now.conversions.toLocaleString()}건이 전환됐습니다. 클릭→전환율은 ${((now.cvr??0)*100).toFixed(2)}%입니다.${compare?` 지난주 ${((before.cvr??0)*100).toFixed(2)}%와 비교하세요.`:''}`;a.hypothesis='클릭→전환 집계는 확인할 수 있지만 상품 조회·장바구니·결제 단계 데이터가 없어 세부 이탈 지점은 알 수 없습니다.';a.actions=['전환율이 낮아진 채널의 랜딩·오퍼·운영 변경을 검토하세요.','세부 퍼널 데이터가 제공되면 단계별 이탈률로 가설을 좁히세요.'];}
 else if(/요약|보고|공유/.test(q)){a.kind='summary';a.title='팀 공유용 성과 브리핑';a.actions=['성과 변화와 확인이 필요한 가설을 함께 공유하세요.','검증 담당자와 다음 확인 시점을 정하세요.'];}
 else if(/cpa/i.test(q)){a.title='전환 비용 분석';a.conclusion=`${scope.channel} CPA는 ${money(cpa)}입니다.${compare?` 지난주 대비 ${pct(delta(cpa,before.cpa??0))}, 전환수는 ${pct(delta(now.conversions,before.conversions))} 변했습니다.`:' 이전 기간 데이터가 없어 증감 판단은 보류합니다.'}`;}
 return a;
}
export const scenarios=[
 {group:'모호한 질문',question:'요즘 광고 개판인데 뭐가 문제야?',expected:'판단할 지표를 먼저 확인',kind:'clarify'},
 {group:'원인 탐색',question:'ROAS 왜 떨어졌어?',expected:'관측 데이터와 원인 가설 구분',kind:'performance'},
 {group:'의사결정',question:'예산 어디에 더 써야 해?',expected:'효율 비교와 배분 실험 제안',kind:'budget'},
 {group:'범위 지정',question:'메타 전환이 어디서 줄었어?',expected:'Meta 범위 적용·없는 단계 고지',kind:'funnel'},
 {group:'업무 공유',question:'팀에 공유할 요약 만들어줘',expected:'결론 → 근거 → 다음 액션',kind:'summary'},
 {group:'근거 부족',question:'내년 매출 확실하게 예측해줘',expected:'수치 생성 없이 데이터 한계 안내',kind:'unavailable'},
];
