import type {TrainingData,Filters,Total,Fact,Breakdown,DetailRecord} from './training-dashboard.mjs';
export type ChatSource={id:string;kind:string;label?:string;title?:string;key?:string;dimension?:string;date?:string;period?:{id:string;start:string;end:string};total?:Total;rowCount?:number}&Record<string,unknown>;
export type ChatComparison={metric:string;label:string;unit:string;rate?:boolean;rows:{key:string;label:string;before:number|null;after:number|null;sourceIds:string[]}[]};
export const chatMetrics:Record<string,{label:string;unit:string;rate?:boolean}>;
export function chatValue(value:number|null|undefined,metric:string):string;
export function chatComparison(sources:ChatSource[],metric:string):ChatComparison|null;
export function chatHighlights(comparison:ChatComparison|null,kinds:string[]):string[];
export function chatSourceRows(data:TrainingData,filters:Filters,source:ChatSource):(Fact|Breakdown|DetailRecord)[];
