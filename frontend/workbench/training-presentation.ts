// 집행 규모와 가격 조건은 증가만으로 성과 방향을 정하지 않는다.
const higherIsBetter=new Set(['roas','revenue','orders','ledgerOrders','ledgerRevenue','units','returnPurchases','purchases','cvr','adCtr','contentClickRate','aov','sessionCvr','checkoutRate','viewRate','cartRate','beginRate']);
const lowerIsBetter=new Set(['cpc','cpa','cac','adCpm','contentCpm','paymentFailureRate','paymentFailures','redirectErrors','loadMs','duplicateEvents']);

export function deltaTone(key:string,before:number|null,after:number|null,rate=false){
 if(before==null||after==null||!Number.isFinite(before)||!Number.isFinite(after)||before===after)return 'neutral';
 // 색도 표시 정밀도를 따른다. 반올림된 +0%, -0%p를 성과 변화로 칠하지 않는다.
 const delta=rate?(after-before)*100:before===0?null:(after/before-1)*100;
 if(delta===null||Number(new Intl.NumberFormat('en-US',{maximumFractionDigits:1,useGrouping:false}).format(delta))===0)return 'neutral';
 const preference=higherIsBetter.has(key)?1:lowerIsBetter.has(key)?-1:0;
 return preference===0?'neutral':(after-before)*preference>0?'positive':'negative';
}

export function plotUpper(values:(number|null)[]){
 const maximum=Math.max(0,...values.filter((value):value is number=>value!==null&&Number.isFinite(value)));
 const step=10**Math.floor(Math.log10(maximum||1));
 return maximum?Math.ceil(maximum/step)*step:1;
}

// 작은 추이는 두 기간의 실제 값 범위를 함께 감싼다. 큰 추이의 0 기준 축과 구분한다.
export function miniPlotDomain(values:(number|null)[]):[number,number]{
 const present=values.filter((value):value is number=>value!==null&&Number.isFinite(value));
 if(!present.length)return [0,1];
 const minimum=Math.min(...present),maximum=Math.max(...present);
 if(minimum===maximum){const padding=Math.abs(maximum)*0.1||1;return [Math.max(0,minimum-padding),maximum+padding];}
 const span=maximum-minimum,power=10**Math.floor(Math.log10(span));
 const step=([1,2,2.5,5,10].find(value=>value>=span/power)||10)*power;
 return [Math.max(0,Math.floor(minimum/step)*step),Math.ceil(maximum/step)*step];
}

const relatedColumns:Record<string,string[]>={roas:['revenue','spend'],cpc:['spend','clicks'],cvr:['orders','clicks'],cpa:['spend','orders'],aov:['revenue','orders'],adCtr:['clicks','impressions']};
export function prioritizeColumns<T extends {key:string}>(items:T[],metricKey:string){
 if(!items.some(item=>item.key===metricKey))return items;
 const priority=[metricKey,...(relatedColumns[metricKey]||[])];
 return [...priority.flatMap(key=>items.filter(item=>item.key===key)),...items.filter(item=>!priority.includes(item.key))];
}
