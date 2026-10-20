import {aspects,profiles,random} from './spec.mjs';

const contexts=['아침에 머리를 감을 때','운동을 마친 뒤','퇴근하고 샤워할 때','여행지에서 사용했을 때','저녁에 씻고 나서',
 '바쁜 출근 준비 중에','주말에 여유 있게 써 보니','수영을 다녀온 날','머리를 짧게 자른 뒤','긴 머리를 씻을 때',
 '땀이 많이 났던 날','평소 쓰던 제품을 바꾸고 나서','가족과 함께 써 보니','혼자 사는 집에서','외출 준비를 하면서','헬스장 샤워실에서'];
const introductions=['처음에는 큰 기대가 없었는데','한동안 고민하다 골랐는데','기존 제품과 번갈아 써 보니','주변 이야기를 듣고 사용해 보니',
 '할인할 때 구입해서 써 보니','소량부터 사용해 봤는데','평소 사용량대로 써 보니','설명서를 읽고 사용해 봤는데',
 '선물로 받아 사용해 보니','다른 향의 제품과 비교해 보니','며칠 쉬었다 다시 써 보니','여러 번 사용한 느낌으로는'];
const positives={세정감:['씻고 난 느낌이 산뜻했습니다','헹구고 나니 개운했습니다','잔여감이 적어 마음에 들었습니다'],보습감:['사용 후 촉촉한 느낌이 좋았습니다','머릿결이 덜 뻣뻣하게 느껴졌습니다','손으로 만졌을 때 부드러운 느낌이 들었습니다'],향:['향이 은은해서 좋았습니다','남는 향이 취향에 맞았습니다','씻는 동안 향이 기분 좋게 느껴졌습니다'],거품:['적은 양으로도 거품이 잘 났습니다','거품을 내기가 수월했습니다','거품이 부드러워 편했습니다'],용기:['펌프를 누르기 편했습니다','젖은 손으로도 용기를 잡기 좋았습니다','내용물이 일정하게 나와 편했습니다'],가격:['용량에 비해 가격이 만족스러웠습니다','다시 살 만한 가격이라고 느꼈습니다','사용량을 생각하면 부담이 적었습니다'],건조감:['사용 후 당기는 느낌이 적었습니다','말리고 나서도 건조함이 덜 느껴졌습니다','세정 후 건조한 느낌이 심하지 않았습니다']};
const negatives={세정감:['헹군 뒤에도 잔여감이 느껴졌습니다','씻고 나서 개운함이 아쉬웠습니다','여러 번 헹궈야 해서 번거로웠습니다'],보습감:['기대했던 촉촉함은 부족했습니다','사용 후 머릿결이 뻣뻣하게 느껴졌습니다','부드러운 느낌이 오래가지 않았습니다'],향:['향이 강해서 부담스러웠습니다','남는 향이 취향과 달랐습니다','향이 너무 빨리 사라져 아쉬웠습니다'],거품:['거품을 내려면 양을 많이 써야 했습니다','기대보다 거품이 적었습니다','거품이 빨리 꺼져 불편했습니다'],용기:['펌프가 뻑뻑해서 누르기 어려웠습니다','마지막에 남은 내용물을 꺼내기 힘들었습니다','젖은 손으로 용기를 잡기 불편했습니다'],가격:['정상가로 다시 사기에는 부담스러웠습니다','용량을 생각하면 비싸게 느껴졌습니다','할인이 없으면 선택하기 망설여집니다'],건조감:['사용 후 당기는 느낌이 들었습니다','말린 뒤 건조함이 신경 쓰였습니다','매일 쓰기에는 건조한 느낌이 부담스러웠습니다']};
const neutrals={세정감:['세정감은 평범했습니다'],보습감:['촉촉한 느낌은 무난했습니다'],향:['향은 특별한 인상이 없었습니다'],거품:['거품의 양은 보통이었습니다'],용기:['용기는 익숙한 방식이었습니다'],가격:['가격은 예상한 정도였습니다'],건조감:['건조한 느낌은 이전 제품과 비슷했습니다']};
const endings=['다음에는 사용량을 조금 바꿔 보려고 합니다.','다른 계절에도 비슷한지 궁금합니다.','가족의 평가는 저와 조금 달랐습니다.',
 '한 통을 다 쓴 뒤 다시 판단하려고 합니다.','매일 쓰는 제품이라 이 부분이 눈에 들어왔습니다.','다음 구매 때도 이 점을 고려할 것 같습니다.',
 '제 사용 습관에서는 이런 차이가 느껴졌습니다.','다른 제품과 번갈아 쓰면서 비교해 보겠습니다.','여행용으로도 써 볼 생각입니다.',
 '한 번에 쓰는 양에 따라서도 느낌이 달랐습니다.','기대했던 부분과 실제 느낌에 차이가 있었습니다.','사용 환경에 따라 다를 수 있을 것 같습니다.'];
function clause(aspect,sentiment,n){const a=sentiment==='positive'?positives:sentiment==='negative'?negatives:neutrals;return a[aspect][n%a[aspect].length];}

export function compose(kind,n,p){
 const q=profiles[p],mixed=n%4===0;
 const a=mixed?q.strength:aspects[n%aspects.length],b=mixed?q.weakness:aspects[(n+3)%aspects.length];
 const sa=mixed?'positive':['positive','negative','neutral'][Math.floor(n/7)%3],sb=mixed?'negative':['negative','neutral','positive'][Math.floor(n/11)%3];
 const first=clause(a,sa,Math.floor(n/3)),second=clause(b,sb,Math.floor(n/5));
 const prefix=`${contexts[n%contexts.length]} ${introductions[Math.floor(n/contexts.length)%introductions.length]} `;
 const parts=[{aspect:a,sentiment:sa,quote:first},{aspect:b,sentiment:sb,quote:second}];
 const suffix=endings[Math.floor(n/13)%endings.length];
 let body=prefix+first+'. '+(mixed?'다만 ':'')+second+'. '+suffix;
 if(kind==='ticket')body=prefix+second+'. '+['사용 방법을 안내받고 싶습니다.','교환 가능한 조건을 알고 싶습니다.','다른 사용량을 권장하는지 궁금합니다.'][n%3]+' '+suffix;
 if(kind==='comment')body=prefix+(n%2?first:second)+'. '+suffix;
 if(kind==='document')body=`가상 제품의 ${a}에 관한 사용 경험과 ${b} 관련 의견을 소개합니다. `+body;
 const spans=parts.filter(x=>body.includes(x.quote)).map(x=>({...x,start:Array.from(body.slice(0,body.indexOf(x.quote))).length,end:Array.from(body.slice(0,body.indexOf(x.quote)+x.quote.length)).length}));
 return {body,spans,mixed};
}
export function rating(p,c,i){
 const weights=[...profiles[p].ratings];
 // Country interaction reverses some product rankings without fixing sentiment to stars.
 const delta=(c==='JP'?(p==='P1A'?-10:p==='P2A'?8:0):c==='US'?(p==='P1A'?8:p==='P2A'?-10:0):0);
 const transfer=delta>0?Math.min(delta,weights[0]-1):-Math.min(-delta,weights[4]-1);
 weights[0]-=transfer;weights[4]+=transfer;
 // Exact base quotas are preserved within KR; other countries use deterministic shifted ranks.
 const order=Array.from({length:100},(_,j)=>j).sort((a,b)=>random(p+c+'/rating/'+a)-random(p+c+'/rating/'+b));
 let rank=order[i],total=0;
 for(let j=0;j<5;j++){total+=weights[j];if(rank<total)return j+1;}
 return 5;
}
