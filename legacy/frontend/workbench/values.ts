import type {Raw} from './contract';
export const str=(r:Raw|undefined,k:string)=>typeof r?.[k]==='string'?r[k] as string:'';
export const num=(r:Raw,k:string)=>r[k]===null||r[k]===undefined?null:Number(r[k]);
// Decimal source strings remain intact in evidence; money arithmetic uses integer minor units.
export function cents(value:unknown):bigint {const [a,b='']=String(value).split('.');return BigInt(a)*BigInt(100)+BigInt(b.padEnd(2,'0').slice(0,2));}
export const moneySum=(rows:Raw[],key:string)=>Number(rows.reduce((s,r)=>r[key]==null?s:s+cents(r[key]),BigInt(0)))/100;
export const moneyDifference=(a:number,b:number)=>Number(cents(a)-cents(b))/100;
export const sum=(rows:Raw[],key:string)=>rows.reduce((s,r)=>s+(num(r,key)??0),0);
export const ratio=(a:number|null,b:number|null,multiplier=1)=>a===null||b===null||b===0?null:a/b*multiplier;
