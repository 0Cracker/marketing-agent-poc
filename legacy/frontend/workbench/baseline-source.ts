import type {Raw} from './contract';
import {str} from './values';
const files=import.meta.glob('../../docs/research/marketing-ontology/batches/D003B/source/*.jsonl',{query:'?raw',import:'default',eager:true}) as Record<string,string>;
export const source:Record<string,Raw[]>=Object.fromEntries(Object.entries(files).map(([path,text])=>[path.split('/').pop()!.split('.')[0],text.trim().split('\n').map(line=>JSON.parse(line))]));
export const products=source.T01;
export const product=(id:string)=>products.find(r=>r.product_id===id)!;
export const campaign=(id:string)=>source.T12.find(r=>r.campaign_id===id)!;
export const months=Array.from(new Set(source.T03.map(r=>str(r,'period_start').slice(0,7)))).sort();
