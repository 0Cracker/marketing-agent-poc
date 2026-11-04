import type {Value,Column,Model,Row} from './contract';
export const brandColors:Record<string,string>={B1:'#8666BD',B2:'#7C92C7',B3:'#BA82AE',other:'#C4C1CE'};
export const mediaColors:Record<string,string>={search:'#8666BD',social:'#BA82AE'};
export const countries:Record<string,string>={JP:'일본',KR:'한국',US:'미국',ALL:'국가별 비교',GLOBAL:'국가 미지정 자료'};
export const currencies:Record<string,string>={JP:'JPY',KR:'KRW',US:'USD'};
export function format(value:Value,kind:Column['kind']='text',currency='JPY',compact=false):string {
 if(value===null)return '—';if(typeof value==='string')return value;
 if(compact&&kind==='money'){return new Intl.NumberFormat('ko-KR',{notation:'compact',maximumFractionDigits:1}).format(value);}
 const digits=kind==='money'?(currency==='USD'?2:0):kind==='percent'||kind==='decimal'?1:kind==='ratio'?2:0;
 return value.toLocaleString('ko-KR',{minimumFractionDigits:digits,maximumFractionDigits:digits})+(kind==='percent'?'%':kind==='ratio'?'배':'');
}
export function sortRows(rows:Row[],key:string,dir:'asc'|'desc') {return [...rows].sort((a,b)=>{const x=a.values[key],y=b.values[key];if(x==null&&y!=null)return 1;if(y==null&&x!=null)return -1;const d=x==null&&y==null?0:typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),'ko');return (dir==='asc'?d:-d)||a.id.localeCompare(b.id);});}
export function csv(model:Model,rows:Row[]){const cell=(v:unknown)=>'"'+String(v??'').replaceAll('"','""')+'"';return '\uFEFF'+[model.columns.map(c=>cell(c.label)).join(','),...rows.map(r=>model.columns.map(c=>cell(r.values[c.key])).join(','))].join('\r\n');}
