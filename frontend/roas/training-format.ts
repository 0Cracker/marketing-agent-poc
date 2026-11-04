export function metricDigits(key:string,rate=false){
 if(['adCtr','cvr','sessionCvr','contentClickRate','viewRate','cartRate','beginRate','checkoutRate','paymentFailureRate'].includes(key))return 2;
 if(rate)return 1;
 if(key==='unitsPerOrder')return 2;
 return 0;
}
export function formatMetricValue(value:number|null|undefined,key:string,rate=false,unit=''){
 if(value==null)return '—';
 const digits=metricDigits(key,rate),number=rate?value*100:value;
 return (Object.is(number,-0)?0:number).toLocaleString('ko-KR',{minimumFractionDigits:rate?digits:0,maximumFractionDigits:digits})+(rate?'%':unit);
}
export function formatMetricDelta(value:number|null,key:string,rate=false){
 if(value===null)return '비교 불가';
 const digits=rate?metricDigits(key,true):1,scaled=rate?value*100:value,rounded=Number(scaled.toFixed(digits));
 if(rounded===0)return value===0?'0'+(rate?'%p':'%'):'≈0'+(rate?'%p':'%');
 return (rounded>0?'+':'')+rounded.toLocaleString('ko-KR',{minimumFractionDigits:rate?digits:0,maximumFractionDigits:digits})+(rate?'%p':'%');
}
export function formatMetricAbsoluteDelta(value:number|null,key:string,rate=false,unit=''){
 if(value===null)return '계산 불가';
 const digits=metricDigits(key,rate),scaled=rate?value*100:value,rounded=Number(scaled.toFixed(digits));
 if(rounded===0)return value===0?'0'+(rate?'%p':unit):'≈0'+(rate?'%p':unit);
 return (rounded>0?'+':'')+rounded.toLocaleString('ko-KR',{minimumFractionDigits:rate?digits:0,maximumFractionDigits:digits})+(rate?'%p':unit);
}

export function formatComparedMetricDelta(before:number|null,after:number|null,key:string,rate=false){
 if(before===null||after===null)return '비교 불가';
 if(!rate&&before===0&&after!==0)return '기준값 0';
 const delta=rate?after-before:before===0?0:(after/before-1)*100;
 return formatMetricDelta(delta,key,rate);
}
