// 화면 표를 엑셀에서 바로 열 수 있는 CSV로 만든다. 값은 화면 반올림 전 원래 수치를 쓴다.
export type CsvCell=string|number|null|undefined;

function csvCell(value:CsvCell){
 if(value===null||value===undefined)return '';
 const text=typeof value==='number'?(Number.isFinite(value)?String(Number(value.toPrecision(12))):''):value;
 // 수식으로 해석될 수 있는 문자열은 텍스트로 고정한다.
 const safe=typeof value==='string'&&/^[=+\-@]/.test(text)?"'"+text:text;
 return /[",\n\r]/.test(safe)?`"${safe.replaceAll('"','""')}"`:safe;
}

export function toCsv(rows:CsvCell[][]){
 return rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
}

/** 비율 지표는 %, 금액과 건수는 원래 단위로 내보낸다. */
export function csvValue(value:number|null|undefined,rate=false){
 if(value===null||value===undefined||!Number.isFinite(value))return null;
 return rate?value*100:value;
}

/** 비율은 %p 차이, 나머지는 상대 증감률(%)이다. 화면의 증감 규칙과 같다. */
export function csvChange(before:number|null|undefined,after:number|null|undefined,rate=false){
 if(before===null||before===undefined||after===null||after===undefined)return null;
 if(rate)return (after-before)*100;
 if(before===0)return after===0?0:null;
 return (after/before-1)*100;
}

export function csvUnit(rate=false,unit=''){
 return rate?'%':unit;
}

export function comparisonCsv(items:{label:string;rate?:boolean;unit?:string;before:number|null;after:number|null}[]){
 return toCsv([
  ['지표','단위','직전 14일','분석 기간','증감','증감 단위'],
  ...items.map(item=>[item.label,csvUnit(item.rate,item.unit),csvValue(item.before,item.rate),csvValue(item.after,item.rate),csvChange(item.before,item.after,item.rate),item.rate?'%p':'%']),
 ]);
}

export function downloadCsv(filename:string,csv:string){
 // 엑셀이 한글을 깨뜨리지 않도록 UTF-8 BOM을 붙인다.
 const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob);
 const link=document.createElement('a');
 link.href=url;link.download=filename;link.style.display='none';
 document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
