// Stable screen contract; source vocabulary stays behind query functions.
export const screenContractVersion='workbench-model/1';
export type Raw = Record<string, unknown>;
export type Value = string | number | null;
export type Row = {id:string; values:Record<string,Value>; source:Raw[]; group?:string; child?:boolean; formula?:string};
export type Column = {key:string; label:string; kind?:'money'|'percent'|'decimal'|'ratio'|'number'|'text'};
export type Chart = {title:string; subtitle:string; unit:string; kind:'line'|'bar'|'vertical-bars'|'waterfall'|'matrix'|'timeline'|'rating-profile'|'columns'|'pie'|'donut'|'stages'|'calendar'|'range'|'comparison'; data:Row[]; series:{key:string;name:string;color:string;dashed?:boolean}[]; note:string;events?:{start:string;end?:string;label:string;source:Raw[]}[]};
export type Model = {products?:Raw[];dataset?:string;detailTitle?:string;asOf?:string;type:string; title:string; status:'ready'|'empty'|'ungenerated'; reason:string; country:string; currency:string; period:string; timezone:string; coverage:string; metrics:{label:string;value:Value;kind?:Column['kind'];note?:string;formula?:string;unit?:string;source:Raw[]}[]; charts:Chart[]; columns:Column[]; rows:Row[]; sort:string; direction:'asc'|'desc'; source:Raw[]};
export type QueryOptions={brand?:string;product?:string;group?:string;observed?:string;grain?:string;media?:string;adView?:string;compare?:string;asOf?:string;context?:string;detailOnly?:boolean};
