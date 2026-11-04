import {createStandardQuery,type StandardCatalog,type CatalogLock} from './standard-query';
import type {Raw} from './contract';
import {selectScenario} from '../../shared/scenario-selection.mjs';
export type CurrentManifest={contract:string;screen_contract:string;schema_sha256:string;pending_by_type:Record<string,number>;data_sha256:string;source_created_at:string;rows:number;preserved_rows:number;source_files:number;decisions:Record<string,number>;files:{type:string;file:string;rows:number;bytes:number;sha256:string}[];metadata:{file:string;sha256:string}[];period:{start:string;end:string};scope_ids:Record<string,string[]>};
const digest=async(bytes:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
export function createCurrentServices(catalog:StandardCatalog,lock:CatalogLock,index:CurrentManifest){const service=createStandardQuery({...catalog,records:selectScenario(catalog.records,index.scope_ids)},lock);return {service,index,services:{CURRENT:service}};}
export async function loadConnectedServices(){
 const base='/workbench-data/current/';
 const response=await fetch(base+'manifest.json',{cache:'no-cache'});if(!response.ok)throw Error('통합 manifest를 읽지 못했습니다');
 const manifest=await response.json() as CurrentManifest;
 if(manifest.contract!=='marketing-current/1'||manifest.screen_contract!=='workbench-model/1'||new Set(manifest.files.map(f=>f.type)).size!==41)throw Error('통합 자료 계약 불일치');
 const fingerprint=await digest(new TextEncoder().encode(JSON.stringify({contract:manifest.contract,screen_contract:manifest.screen_contract,schema_sha256:manifest.schema_sha256,source_created_at:manifest.source_created_at,scope_ids:manifest.scope_ids,period:manifest.period,files:manifest.files.map(({file,sha256})=>({file,sha256})),metadata:manifest.metadata})).buffer);
 if(fingerprint!==manifest.data_sha256)throw Error('통합 manifest 해시 불일치');
 const checked=async(f:{file:string;sha256:string})=>{if(!/^[\w-]+\.(json|jsonl)$/.test(f.file))throw Error('잘못된 자료 경로');const r=await fetch(base+f.file);if(!r.ok)throw Error('통합 자료를 읽지 못했습니다: '+f.file);const bytes=await r.arrayBuffer();if(await digest(bytes)!==f.sha256)throw Error('통합 자료 해시 불일치: '+f.file);return new TextDecoder().decode(bytes);};
 const presentation=manifest.metadata.find(f=>f.file==='product-presentation.json');if(!presentation)throw Error('제품 표시 계약 누락');
 const products=JSON.parse(await checked(presentation)) as Raw[];
 const pending=new Map<string,Promise<Raw[]>>(),loaded=new Map<string,Raw[]>();
 const load=async(type:string)=>{
  if(!pending.has(type)){
   const f=manifest.files.find(f=>f.type===type);if(!f)throw Error('통합 유형 누락: '+type);
   const request=checked(f).then(text=>{const rows=text.trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line) as Raw);if(rows.length!==f.rows||rows.some(r=>r.dataset_type!==f.type)||new Set(rows.map(r=>r.record_id)).size!==rows.length)throw Error('통합 유형/행수/ID 불일치');loaded.set(type,rows);return rows;}).catch(error=>{pending.delete(type);throw error;});
   pending.set(type,request);
  }
  return pending.get(type)!;
 };
 const loadType=async(type:string)=>{
  // Share one download per type; review annotations need their actual parent text.
  await Promise.all([...new Set(['T01','T03','T12',type,...(type==='T25'?['T24']:[])])].map(load));
  const records=[...loaded.values()].flat();if(new Set(records.map(r=>r.record_id)).size!==records.length)throw Error('통합 ID 중복');
  return createCurrentServices({batch:'CURRENT',scenario:'current-comparison',records,products,definitions:{}},{sha256:manifest.data_sha256,source_created_at:manifest.source_created_at,rows:manifest.rows,screen_contract:manifest.screen_contract},manifest).service;
 };
 return {service:await loadType('T03'),index:manifest,loadType};
}
