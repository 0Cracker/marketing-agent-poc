import {connectVisuals} from './connected-views';
import type {Raw,Model,QueryOptions} from './contract';
import {createStandardQuery,type StandardCatalog,type CatalogLock} from './standard-query';
type Entry={batch:string;country:string;record:Raw;source:Raw;payload:Raw;schema_conforming:boolean;contract_gaps:Raw[]};
type Batch={id:string;rows:number;conforming:number;url:string;sha256:string};
export type ConnectionIndex={rows:number;physical_source_rows:number;source_files:number;batches:Batch[]};
const obj=(v:unknown)=>v&&typeof v==='object'?v as Raw:{};
export function createConnectedServices(entries:Entry[],catalog:StandardCatalog,lock:CatalogLock,index:ConnectionIndex,demo?:{catalog:StandardCatalog;lock:CatalogLock}){
 const latest=[lock.source_created_at,...entries.map(e=>String(obj(e.record.temporal).available_at||''))].filter(t=>Number.isFinite(Date.parse(t))).sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1)!;
 const records=entries.map(e=>({...e.record,_batch:e.batch,_country:e.country,_conforming:e.schema_conforming,_contract_gaps:e.contract_gaps,_source:e.source,_payload:e.payload}));
 const standard=createStandardQuery(catalog,lock);
 const comparison=demo?createStandardQuery(demo.catalog,demo.lock):standard;
 const allMonths=new Set<string>(standard.months);
 for(const e of entries){const r=e.record;for(const field of ['period','planned_period','expected_period']){const p=obj(r[field]);if(p.start&&p.end_exclusive){let date=String(p.start).slice(0,7)+'-01';const end=String(p.end_exclusive).slice(0,10);for(let i=0;i<240&&date<end;i++){allMonths.add(date.slice(0,7));date=new Date(Date.UTC(Number(date.slice(0,4)),Number(date.slice(5,7)),1)).toISOString().slice(0,10);}}}for(const key of ['written_at','observed_at','created_at','event_time','ordered_at','changed_at','published_at'])if(/^\d{4}-\d{2}/.test(String(r[key]||'')))allMonths.add(String(r[key]).slice(0,7));}
 function service(batch:string){
  const rows=batch==='ALL'?records:records.filter(r=>r._batch===batch);
  const base=createStandardQuery({...catalog,batch,records:rows},{...lock,source_created_at:latest});
  return {...base,months:[...allMonths].sort(),query:(type:string,country:string,month:string,options:QueryOptions={}):Model=>{
   if(batch==='ALL'&&!options.detailOnly){const m=comparison.query(type,country,month,options);return {...m,dataset:'ALL',coverage:'전체 자료의 최신 호환 버전 기준 · 원천 레코드에서 모든 보존 버전 조회 가능 · '+m.coverage};}
   const m=base.query(type,country,month,{...options,detailOnly:true});
   const counts=new Map<string,Raw[]>();for(const r of m.source){const b=String(r._batch);counts.set(b,[...(counts.get(b)||[]),r]);}
   const bad=m.source.filter(r=>r._conforming===false);
   m.metrics=[{label:'선택 원천 레코드',value:m.source.length,kind:'number',unit:'건',source:m.source,note:'현재 필터에 해당하는 실제 원천 행 수'}, {label:'연결 배치',value:counts.size,kind:'number',unit:'개',source:m.source}, {label:'명세 미적합',value:bad.length,kind:'number',unit:'건',source:bad,note:'원문을 보존하고 문제 항목을 근거에 표시 · 검증된 집계에 합산하지 않음'}];
   m.charts=[];
   if(!options.detailOnly&&m.source.some(r=>r._conforming===true))connectVisuals(m,m.source.filter(r=>r._conforming===true),options.context);
   m.coverage=`전체 ${index.rows.toLocaleString('ko-KR')}건 연결 · ${batch==='ALL'?'모든 배치':batch} · 스키마 미적합도 원문·문제 항목 조회 가능`;
   return m;
  }};
 }
 const services:Record<string,ReturnType<typeof createStandardQuery>>={ALL:service('ALL'),D007:standard,...(demo?{D008:comparison}:{})};
 for(const b of index.batches.filter(b=>!['D007','D008'].includes(b.id)))services[b.id==='D003B'?'D003B-source':b.id]=service(b.id);
 return {services,index};
}
export async function loadConnectedServices(){
 const json=async(url:string)=>{const r=await fetch(url);if(!r.ok)throw Error(`자료를 읽을 수 없습니다: ${url}`);return r.json();};
 const index=await json('/workbench-data/connected/index.json') as ConnectionIndex;
 const data=await Promise.all(index.batches.map(async b=>{const response=await fetch(b.url);if(!response.ok)throw Error(`${b.id} 자료를 읽지 못했습니다`);const bytes=await response.arrayBuffer();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');if(hash!==b.sha256)throw Error(`${b.id} 원천 해시 불일치`);return {batch:b.id,value:JSON.parse(new TextDecoder().decode(bytes))};}));
 const catalog=data.find(d=>d.batch==='D007')!.value as StandardCatalog;
 const lock=await json('/workbench-data/D007/lock.json') as CatalogLock;
 const entries:Entry[]=data.flatMap(d=>d.batch==='D007'?(d.value as StandardCatalog).records.map(record=>({batch:'D007',country:String(record.scope_id).split('-')[1],record,source:record,payload:record,schema_conforming:true,contract_gaps:[]})):d.value as Entry[]);
 if(entries.length!==index.rows||index.rows!==index.physical_source_rows||lock.screen_contract!=='workbench-model/1')throw Error('전체 원천 행수 또는 화면 계약 불일치');
 const demoLock=await json('/workbench-data/D008/lock.json') as CatalogLock;
 const response=await fetch('/workbench-data/D008/catalog.json');if(!response.ok)throw Error('비교 데모 데이터를 읽지 못했습니다');const bytes=await response.arrayBuffer();
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==demoLock.sha256)throw Error('비교 데모 데이터 해시 불일치');
 const demoCatalog=JSON.parse(new TextDecoder().decode(bytes)) as StandardCatalog;if(demoCatalog.records.length!==demoLock.rows)throw Error('비교 데모 행수 불일치');
 const extra=demoCatalog.records.map(record=>({batch:'D008',country:String(record.scope_id).split('-')[1],record,source:record,payload:record,schema_conforming:true,contract_gaps:[]}));
 return createConnectedServices([...entries,...extra],catalog,lock,{...index,rows:index.rows+extra.length,physical_source_rows:index.physical_source_rows+extra.length,source_files:index.source_files+40,batches:[...index.batches,{id:'D008',rows:extra.length,conforming:extra.length,url:'/workbench-data/D008/catalog.json',sha256:hash}]},{catalog:demoCatalog,lock:demoLock});
}
