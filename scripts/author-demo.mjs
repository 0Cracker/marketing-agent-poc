// Authoring only: writes a fully static content file. Never imported by the app.
import {writeFileSync} from 'node:fs';
import {decisions} from './scenario-decisions.mjs';
const baseline=[6000,4000,650,350,5500,4500,600000,400000];
const weights=[.35,.25,.2,.2];
const share=r=>[0,2,4,6].map(i=>r[i]===null||r[i+1]===null?null:100*r[i]/(r[i]+r[i+1]));
const cti=s=>s.some(v=>v===null)?null:s.reduce((t,v,i)=>t+v*weights[i],0);
const configs=[
 {id:'A',name:'리뷰 경쟁력 하락',focus:'review',tag:'고객 경험',raw:[5500,4500,450,550,5300,4700,450000,550000],review:[900,450,150,300,3.6],peerReviews:1000,spend:10000000,
 headline:'리뷰 경쟁력 약화가 CTI 하락에 가장 크게 기여했습니다.',
 observation:'긍정 리뷰 점유율은 65%에서 45%로 하락했습니다. 광고 노출 점유율 하락도 함께 관측됩니다.',
 claim:'제품 경험과 상대적 리뷰 경쟁력이 함께 약해졌을 가능성',support:'자사 긍정률이 65%에서 50%로 낮아지고 평균 평점도 4.4에서 3.6으로 하락했습니다.',counter:'리뷰 건수도 1,000건에서 900건으로 감소했습니다. 수집 범위와 플랫폼 구성 변화는 배제하지 못합니다.',
 alternative:'경쟁사 긍정 리뷰 증가와 리뷰 수집 구성 변화도 상대 점유율 하락을 설명할 수 있습니다.',
 actions:['제품·CS 팀이 사용감 관련 불만을 확인하고 개선 과제를 먼저 정합니다.','광고 노출 약화는 별도 예산 실험으로 검토하되, 광고로 제품 경험 문제가 해결된다고 가정하지 않습니다.'],topics:[['사용 후 건조함',35,120],['향에 대한 불만',20,65],['배송 불만',45,50]],event:'8월부터 사용감 관련 불만이 증가한 가상 기록. CTI와의 동시 변화는 인과 증명이 아닙니다.'},
 {id:'B',name:'경쟁사 급성장',focus:'competitor',tag:'상대 경쟁력',raw:[6000,8000,650,700,5500,9000,600000,800000],review:[1000,650,200,150,4.4],peerReviews:2000,spend:10000000,
 headline:'자사 절대 실적은 유지됐지만, 경쟁사 성장으로 상대 점유율이 낮아졌습니다.',
 observation:'자사 검색·긍정 리뷰·참여·광고 노출은 모두 유지됐습니다. 경쟁사 원천값은 각각 두 배가 됐습니다.',
 claim:'경쟁사 디지털 접점 확대가 상대적 열위와 관련됐을 가능성',support:'자사 긍정률 65%와 평점 4.4가 유지되는 동안 경쟁사 긍정 리뷰는 350→700건으로 증가했습니다.',counter:'경쟁사 성장 자체가 자사 고객 이탈이나 제품 품질 저하를 증명하지는 않습니다. 자사 절대 실적은 감소하지 않았습니다.',
 alternative:'경쟁사 측정 커버리지 확대나 신제품 초기 관심도 같은 요인을 추가로 확인해야 합니다.',
 actions:['경쟁사 캠페인·검색·리뷰 증가 구간을 비교해 차별화 메시지를 점검합니다.','자사 고객 반응을 유지하면서 노출 경쟁력에 대한 제한된 예산안을 검토합니다.'],topics:[['사용 후 건조함',35,35],['향에 대한 불만',20,20],['배송 불만',45,45]],event:'경쟁사 B가 7월 신제품 캠페인을 시작한 가상 기록. 캠페인의 인과 효과는 확인되지 않았습니다.'},
 {id:'C',name:'광고비 증가·성과 하락',focus:'media',tag:'매체 효율',raw:[5800,4200,650,350,5400,4600,450000,550000],review:[1000,650,200,150,4.4],peerReviews:1000,spend:12000000,
 headline:'지출은 늘었지만 노출은 감소했습니다. 구매 가능한 노출 효율을 먼저 점검해야 합니다.',
 observation:'광고비는 20% 증가하고 노출은 25% 감소했습니다. 총 CPM은 약 60% 상승했습니다.',
 claim:'광고 단가와 캠페인 운영 변화가 노출 경쟁력 약화와 관련됐을 가능성',support:'광고비 1,000만→1,200만원, 노출 60만→45만회. CPM은 약 16,667→26,667원입니다.',counter:'CPM만으로 경쟁 심화·소재 피로도·타기팅 실패 중 어느 것이 원인인지 구분할 수 없습니다. 리뷰는 안정적입니다.',
 alternative:'캠페인 믹스·입찰·시즌·운영 중단 변화가 같은 현상을 설명할 수 있습니다.',
 actions:['채널·캠페인별 CPM과 운영 변경 기록을 비교합니다.','가정된 노출 효율을 기준으로 예산 이동안을 검토하고 실제 효과는 별도 실험으로 확인합니다.'],topics:[['사용 후 건조함',35,35],['향에 대한 불만',20,20],['배송 불만',45,45]],event:'8월 검색 입찰과 캠페인 믹스 변경·검색 지출 확대 기록. 운영 변화와 시점이 가까우나 인과는 미확립입니다.'},
 {id:'D',name:'복합 요인',focus:'mixed',tag:'상반된 변화',raw:[6000,4000,400,600,5500,4500,750000,250000],review:[1000,400,250,350,3.5],peerReviews:1000,spend:10000000,
 headline:'광고 개선이 리뷰 하락을 일부 상쇄했지만, 전체 CTI는 하락했습니다.',
 observation:'리뷰 기여도 −6.25pt와 광고 기여도 +3.00pt가 동시에 발생했습니다. 순변화는 −3.25pt입니다.',
 claim:'고객 경험 약화가 광고 개선 효과를 상쇄했을 가능성',support:'긍정률은 65→40%, 광고 노출 점유율은 60→75%입니다. 두 변화의 방향이 다릅니다.',counter:'광고 노출은 개선됐지만 고유 도달·구매·수익 개선까지 확인된 것은 아닙니다.',
 alternative:'리뷰 표본 구성 변화와 특정 고객군 불만 집중을 함께 확인해야 합니다.',
 actions:['리뷰 개선과 고객 대응을 우선하고 효과적인 광고 운영은 유지합니다.','CTI 하락만으로 광고 예산 전체를 감축하지 않습니다. 추가 배분은 별도 가정으로 검토합니다.'],topics:[['사용 후 건조함',35,155],['향에 대한 불만',20,90],['배송 불만',45,45]],event:'9월 자사 캠페인 노출 개선과 불만 증가가 동시 관측된 가상 기록.'},
 {id:'E',name:'측정 문제',focus:'quality',tag:'데이터 품질',raw:[5500,4500,450,550,5300,4700,null,550000],review:[900,450,150,300,3.6],peerReviews:1000,spend:10000000,
 headline:'9월 광고 노출이 누락돼 전체 CTI와 하락 폭을 확정할 수 없습니다.',
 observation:'S=55%, R=45%, E=53%는 계산 가능하지만 M은 결측입니다. 남은 가중치를 재정규화하지 않습니다.',
 claim:'측정 누락으로 성과 판단이 제한됨',support:'자사 광고 노출 9월 값이 미수집 상태입니다. 0회 노출과 다른 상태입니다.',counter:'리뷰 관련 악화는 별도로 관측됩니다. 광고 결측이 리뷰 변화까지 무효화하지는 않습니다.',
 alternative:'실제 노출 감소와 수집 실패를 분리하려면 원천 누락을 먼저 복구해야 합니다.',
 actions:['광고 노출 수집을 복구하고 같은 기준으로 CTI를 다시 검산합니다.','리뷰 이슈는 부분 근거로 검토하되 전체 CTI 진단과 예산안 승인 판단은 보류합니다.'],topics:[['사용 후 건조함',35,120],['향에 대한 불만',20,65],['배송 불만',45,50]],event:'9월 광고 노출 수집 실패 기록. 차트의 빈 구간은 0으로 연결하지 않습니다.'},
 {id:'F',name:'성과 개선',focus:'growth',tag:'유지 전략',raw:[6500,3500,700,300,6000,4000,650000,350000],review:[1000,700,180,120,4.6],peerReviews:1000,spend:10000000,
 headline:'네 접점이 함께 개선됐습니다. 효과를 유지하며 확대 가능성을 검토합니다.',
 observation:'CTI는 60.25→65.25, +5.00pt입니다. 검색 +1.75pt, 리뷰 +1.25pt, 참여 +1.00pt, 광고 +1.00pt입니다.',
 claim:'고객 반응과 디지털 접점의 동반 개선 가능성',support:'긍정률은 65→70%, 평점은 4.4→4.6으로 개선됐고 광고 노출도 증가했습니다.',counter:'CTI 상승은 매출·ROAS·수익 증가를 증명하지 않습니다. 계절성과 경쟁사 변화도 존재할 수 있습니다.',
 alternative:'시장 관심 변화와 경쟁사 접점 감소가 상대 점유율 개선에 기여했을 수 있습니다.',
 actions:['고객 반응과 운영 조건을 유지하고 개선 구간을 지속 관찰합니다.','현재 예산·운영을 유지하고 2주 모니터링 후 확대 실험 필요성을 검토합니다.'],topics:[['사용 후 건조함',35,20],['향에 대한 불만',20,15],['배송 불만',45,30]],event:'9월 긍정 반응과 노출이 함께 개선된 가상 기록. 실제 사업 성과는 별도 검증이 필요합니다.'},
];
const result=configs.map(c=>{
 const s=share(c.raw),current=cti(s),base=share(baseline);
 // Static, authored month records. All intermediate metrics have corresponding raw counts.
 const profiles={A:[[0,.08,.2,.4,.7,1],[0,0,0,0,.6,1],[0,0,0,.1,.5,1],[0,.08,.2,.4,.7,1]],B:Array(4).fill([0,0,0,.25,.65,1]),C:[[0,0,.1,.2,.6,1],[0,0,0,0,0,1],[0,0,0,.1,.5,1],[0,0,0,0,.65,1]],D:Array(4).fill([0,0,0,0,0,1]),E:[[0,.08,.2,.4,.7,1],[0,0,0,0,.6,1],[0,0,0,.1,.5,1],[0,0,0,0,0,1]],F:Array(4).fill([0,0,.1,.25,.55,1])};
 const progress=[0,1,2,3,4,5];
 const history=progress.map((p,i)=>{
   const raw=baseline.map((v,k)=>c.raw[k]===null?(i===5?null:v):Math.round(v+(c.raw[k]-v)*profiles[c.id][Math.floor(k/2)][p]));
   return {month:['4월','5월','6월','7월','8월','9월'][i],raw,shares:share(raw),cti:cti(share(raw))};
 });
 const channelNames=['Google 검색','Meta','YouTube','기타'];
 const fractions=c.id==='C'?[.25,.45,.15,.15]:[.3,.45,.15,.1],originalBudget=[4000000,3000000,2000000,1000000];
 const currentBudget=c.id==='C'?[6000000,3000000,2000000,1000000]:originalBudget;
 const recommended=c.id==='C'?[4000000,4000000,2000000,2000000]:currentBudget;
 const channels=channelNames.map((name,i)=>({name,beforeSpend:originalBudget[i],spend:currentBudget[i],beforeImpressions:600000*fractions[i],impressions:c.raw[6]===null?null:c.raw[6]*fractions[i]}));
 const budget=c.raw[6]===null?null:(()=>{
   const rows=channels.map((r,i)=>{
     const k=2000000,q=r.impressions/Math.log(1+currentBudget[i]/k);
     return {name:r.name,current:currentBudget[i],recommended:recommended[i],min:500000,max:6000000,k,q,currentImpressions:r.impressions,expectedImpressions:q*Math.log(1+recommended[i]/k)};
   });
   const expected=rows.reduce((t,r)=>t+r.expectedImpressions,0),m=100*expected/(expected+c.raw[7]);
   const curves=[0,1000000,2000000,3000000,4000000,5000000,6000000].map(b=>({budget:b,...Object.fromEntries(rows.map(r=>[r.name,r.q*Math.log(1+b/r.k)]))}));
   return {total:c.spend,currentCti:current,currentM:s[3],competitorImpressions:c.raw[7],rows,curves,expectedImpressions:expected,expectedM:m,expectedCti:current+.2*(m-s[3]),assumption:'다음 달에도 현재 경쟁사 노출과 S/R/E가 유지된다는 가정입니다. 곡선은 관측값에 기준점을 맞춘 모의 함수입니다.'};
 })();
 const decision=decisions[c.id];
 const components=['검색 관심','긍정 리뷰','디지털 참여','광고 노출'];
 const contributions=s.map((v,i)=>v===null?null:weights[i]*(v-base[i]));
 const fmt=(n,d=2)=>n===null?'결측':n.toLocaleString('ko-KR',{maximumFractionDigits:d});
 const proof=components.map((name,i)=>({name,source:c.id+'-202604 / '+c.id+'-202609 · '+name,beforeA:baseline[i*2],beforeB:baseline[i*2+1],currentA:c.raw[i*2],currentB:c.raw[i*2+1],beforeShare:base[i],currentShare:s[i],weight:weights[i],contribution:contributions[i],formula:s[i]===null?'9월 자사 노출 결측 → 비중·기여도 계산 보류':fmt(c.raw[i*2],0)+' ÷ ('+fmt(c.raw[i*2],0)+' + '+fmt(c.raw[i*2+1],0)+') × 100 = '+fmt(s[i])+'%; ('+fmt(s[i])+' − '+fmt(base[i])+') × '+weights[i]+' = '+fmt(contributions[i])+'pt'}));
 const chronology={A:'검색·노출 약화는 5월부터, 리뷰 악화는 8월부터입니다. 사용감 불만의 시작 시점은 리뷰 변화와 일치하지만 앞선 검색·노출 변화 전체를 설명하지 못합니다.',B:'4–6월은 원천값 유지, 경쟁사 캠페인이 시작된 7월부터 경쟁사 값이 확대됩니다. 시점 일치는 캠페인 인과 효과의 증명이 아닙니다.',C:'8월 입찰·캠페인 믹스 변경 구간부터 노출 감소를 작성했습니다. 전체 CPM의 전후 비교는 비용 효율 경고이며 특정 운영 변경의 인과 효과는 아닙니다.',D:'4–8월은 유지, 9월 리뷰 악화와 노출 개선이 동시에 관측됩니다. 상반된 변화의 가중 합계를 분리해 봅니다.',E:'리뷰 약화는 8월부터, 광고 노출 누락은 9월입니다. 앞선 관측은 유지하고 9월 전체 CTI만 공백으로 남깁니다.',F:'6월부터 각 접점이 점진적으로 개선됩니다. 9월은 최종 관측값이며 한 번의 사건이 전체 개선을 유발했다고 가정하지 않습니다.'}[c.id];
 const process=[{title:'비교 범위와 품질 확인',detail:'일본·헤어케어·A/B·4월 대비 9월·동일 수집 기준이라는 시연 가정으로 비교합니다. '+(current===null?'9월 노출 결측으로 전체 CTI를 보류합니다.':'네 구성요소의 원천값이 존재하고 리뷰 감성 합계와 채널 노출 합계를 대사했습니다.')},{title:'원천값 → 상대 비중 → 가중 기여도',detail:current===null?'확인 가능한 세 항목만 별도로 계산합니다. 결측 항목을 0으로 넣거나 가중치를 재정규화하지 않습니다.':'각 A/(A+B) 비중의 전후 차이에 고정 가중치를 곱합니다. 네 기여도의 합 '+fmt(current-60.25)+'pt가 CTI 변화와 일치합니다.'},{title:'시점과 별도 근거 대조',detail:chronology},{title:'관측과 원인 가설 구별',detail:decision.why},{title:'검증할 결정 선택',detail:decision.reason+' '+decision.alternative}];
 const delta=current===null?null:current-60.25;
 const responses={lookup:{question:'제품 A의 CTI 현황을 보여줘.',title:'CTI 현황',conclusion:current===null?'4월 CTI는 60.25pt입니다. 9월은 광고 노출 결측으로 계산할 수 없습니다.':`CTI는 60.25 → ${current.toFixed(2)}pt, ${delta>0?'+':''}${delta.toFixed(2)}pt 변했습니다.`},diagnosis:{question:'제품 A의 CTI 변화 원인을 분석해 줘.',title:c.name+' 분석',conclusion:c.headline},action:{question:'제품 A의 CTI 개선을 위해 무엇을 해야 해?',title:'실행 결정',conclusion:decision.reason}};
 return {...c,decision,proof,process,chronology,responses,context:'일본 / 헤어케어 / 제품 A vs B',period:'2026년 4월–9월',comparison:'2026년 4월 대비 9월',baseline,current,shares:s,contributions:s.map((v,i)=>v===null?null:weights[i]*(v-base[i])),history,channels,budget,reviewBaseline:[1000,650,200,150,4.4],baselinePeerReviews:700};
});
const header=`// Fixed authored content. Generated offline by scripts/author-demo.mjs; no runtime analysis or data access.
export type DemoCase = {
 decision:{kind:string;title:string;risk:string;reason:string;rule:string;alternative:string;resource:string;timeline:string;success:string;stop:string;followup:string;why:string;tasks:{owner:string;due:string;action:string;inputs:string;done:string}[]};
 proof:{name:string;source:string;beforeA:number;beforeB:number;currentA:number|null;currentB:number|null;beforeShare:number;currentShare:number|null;weight:number;contribution:number|null;formula:string}[];
 process:{title:string;detail:string}[];chronology:string;
 id:string;name:string;focus:string;tag:string;raw:(number|null)[];review:number[];peerReviews:number;spend:number;
 headline:string;observation:string;claim:string;support:string;counter:string;alternative:string;actions:string[];
 responses:Record<'lookup'|'diagnosis'|'action',{question:string;title:string;conclusion:string}>;
 topics:(string|number)[][];event:string;context:string;period:string;comparison:string;
 baseline:number[];current:number|null;shares:(number|null)[];contributions:(number|null)[];
 history:{month:string;raw:(number|null)[];shares:(number|null)[];cti:number|null}[];
 channels:{name:string;beforeSpend:number;spend:number;beforeImpressions:number;impressions:number|null}[];
 reviewBaseline:number[];baselinePeerReviews:number;
 budget:null|{total:number;currentCti:number;currentM:number;competitorImpressions:number;expectedImpressions:number;expectedM:number;expectedCti:number;assumption:string;curves:({budget:number}&Record<string,number>)[];rows:{name:string;current:number;recommended:number;min:number;max:number;k:number;q:number;currentImpressions:number;expectedImpressions:number}[]};
};
export const demoCases: DemoCase[] = `;
writeFileSync(new URL('../frontend/lib/demo-scenarios.ts',import.meta.url),header+JSON.stringify(result,null,2)+';\n'+`
export const componentNames = ['검색 관심', '긍정 리뷰', '디지털 참여', '광고 노출'];
export const componentWeights = [.35, .25, .20, .20];
export type QuestionLevel = 'lookup' | 'diagnosis' | 'action';
export const levels: {id:QuestionLevel;name:string;question:string}[] = [
 {id:'lookup',name:'단순 조회',question:'제품 A의 CTI 현황을 보여줘.'},
 {id:'diagnosis',name:'원인 분석',question:'제품 A의 CTI 변화 원인을 분석해 줘.'},
 {id:'action',name:'대응 방안',question:'제품 A의 CTI 개선을 위해 무엇을 해야 해?'},
];
export const budgetQuestion='현재 총예산 안에서 광고비를 재배분해 줘.';
export const approvalQuestion='추천안으로 진행할게.';
export const references=[
 {label:'고객 리뷰와 사회적 증거',url:'https://www.thinkwithgoogle.com/_qs/documents/9998/Decoding_Decisions_The_Messy_Middle_of_Purchase_Behavior.pdf',note:'리뷰는 구매 판단에 관련된 단서입니다. 이 사례에서 판매 영향을 추정한 것은 아닙니다.'},
 {label:'광고 반응 곡선과 한계 효과',url:'https://developers.google.com/meridian/docs/post-modeling/roi-mroi-response-curves',note:'평균 성과와 추가 투자 효과를 구별합니다. 데모 log 노출 곡선은 실제 광고 효과 추정이 아닙니다.'},
 {label:'인과 추정의 가정',url:'https://developers.google.com/meridian/docs/causal-inference/about-mmm-causal-inference-methodology',note:'관측 변화와 인과 효과를 구별합니다. CTI의 산술적 기여도는 인과 기여율이 아닙니다.'},
];
`);
const playbook=['# CTI 판단·실행 시나리오','고정 Mock 콘텐츠입니다. 사실·계산·가설·검토 규칙·실행안을 구분합니다. 검토 임계값과 성공/중단 조건은 PoC 가정이며 실제 성과 기준으로 검증되지 않았습니다.','대표 시연: A 원인 분석 → 조사 계획 승인 → Mock 업무 요청 등록. E는 결측으로 판단 중단. C는 현행 유지 대비 실험 검토.','CTI는 A+B 내 디지털 지표의 가중 상대 비중이며 매출·구매 확률·전체 시장 점유율이 아닙니다.'];
for(const c of result){playbook.push('## '+c.id+'. '+c.name,'### 오늘 필요한 결정',c.decision.title,c.decision.risk,c.decision.reason,'### 분석 경로',...c.process.map((p,i)=>(i+1)+'. '+p.title+' — '+p.detail),'### 원천과 검산',...c.proof.map(p=>'- '+p.name+': '+p.formula+' (가상 기록 '+p.source+')'),'### 가설·반대 근거',c.claim,c.support,c.counter,c.alternative,'### 실행 과제',...c.decision.tasks.map(t=>'- '+t.owner+' / '+t.due+': '+t.action+'. 자료: '+t.inputs+'. 완료: '+t.done),'### 승인 범위·검증',c.decision.resource,c.decision.timeline,'성공·완료: '+c.decision.success,'중단·보류: '+c.decision.stop,'후속 판단: '+c.decision.followup);}
playbook.push('## 파일럿의 업무 가치','자료별 원천 대사·기여도 계산·시간 흐름 비교·반대 근거 검토·실행안 작성을 같은 사례 안에 묶습니다. 기존 수작업 대비 검토 시간과 근거 누락을 줄이는 것이 목표이며 절감 수치는 미측정입니다. 같은 자료와 검토 기준으로 기존 방식/PoC 방식의 자료 정리·검산·검토안 작성 시간을 비교해 평가합니다.','이론 참고: [리뷰와 사회적 증거](https://www.thinkwithgoogle.com/_qs/documents/9998/Decoding_Decisions_The_Messy_Middle_of_Purchase_Behavior.pdf), [반응 곡선 해석](https://developers.google.com/meridian/docs/post-modeling/roi-mroi-response-curves), [인과 가정](https://developers.google.com/meridian/docs/causal-inference/about-mmm-causal-inference-methodology). 참고 자료는 이 데모의 가중치·임계값·모의 효과를 검증해 주지 않습니다.');
writeFileSync(new URL('../docs/scenario-playbook.md',import.meta.url),playbook.join('\n\n')+'\n');
console.log('Authored 6 static cases, 18 Q&A, five-step evidence paths, differentiated decisions and one budget experiment.');
