import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
export const dataDirectory=path.resolve(import.meta.dirname,'../data');
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function currentManifest(directory=dataDirectory){
 const m=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json')));
 assert.equal(m.contract,'marketing-current/1');assert.equal(m.screen_contract,'workbench-model/1');
 assert.equal(m.data_sha256,sha256(JSON.stringify({contract:m.contract,screen_contract:m.screen_contract,schema_sha256:m.schema_sha256,source_created_at:m.source_created_at,scope_ids:m.scope_ids,period:m.period,files:m.files.map(({file,sha256})=>({file,sha256})),metadata:m.metadata})));
 assert.equal(new Set(m.files.map(f=>f.type)).size,41);return m;
}
export function publicFiles(m){return ['manifest.json',...m.files.map(f=>f.file),...m.metadata.map(f=>f.file)];}
export function loadCurrentData(directory=dataDirectory){
 const manifest=currentManifest(directory);
 const read=f=>{assert(/^[\w-]+\.(json|jsonl)$/.test(f.file));const b=fs.readFileSync(path.join(directory,f.file));assert.equal(sha256(b),f.sha256,f.file+' hash');return b.toString();};
 const records=manifest.files.flatMap(f=>{const rows=read(f).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);assert.equal(rows.length,f.rows);assert(rows.every(r=>r.dataset_type===f.type));return rows;});
 assert.equal(records.length,manifest.rows);assert.equal(new Set(records.map(r=>r.record_id)).size,records.length);
 const metadata=Object.fromEntries(manifest.metadata.map(f=>[f.file,JSON.parse(read(f))]));
 return {manifest,catalog:{batch:'CURRENT',scenario:'current-comparison',records,products:metadata['product-presentation.json'],definitions:metadata['definitions.json']},lock:{...manifest,sha256:manifest.data_sha256}};
}
// Only approved synthetic current files are public. Archives are never copied.
export function currentDataPlugin(){
 let manifest;
 const assetsDirectory=path.resolve(import.meta.dirname,'../frontend/public');
 const assets=[];
 const walk=(dir='')=>{for(const entry of fs.readdirSync(path.join(assetsDirectory,dir),{withFileTypes:true})){if(!dir&&entry.name==='workbench-data')continue;const relative=dir?dir+'/'+entry.name:entry.name;if(entry.isDirectory())walk(relative);else assets.push(relative);}};walk();
 const setup=()=>{loadCurrentData();manifest=currentManifest();};
 const middleware=(req,res,next)=>{const requested=(req.url||'').split('?')[0];if(assets.includes(requested.slice(1))){res.setHeader('content-type',requested.endsWith('.woff2')?'font/woff2':'image/svg+xml');return res.end(fs.readFileSync(path.join(assetsDirectory,requested.slice(1))));}if(!requested.startsWith('/workbench-data/'))return next();const manifest=currentManifest();const file=requested.slice('/workbench-data/current/'.length);if(!requested.startsWith('/workbench-data/current/')||!publicFiles(manifest).includes(file)){res.statusCode=404;return res.end();}res.setHeader('content-type',file.endsWith('.jsonl')?'application/x-ndjson':'application/json');res.setHeader('cache-control','no-cache');res.end(fs.readFileSync(path.join(dataDirectory,file)));};
 return {name:'current-marketing-data',buildStart:setup,configureServer(server){setup();server.middlewares.use(middleware);},configurePreviewServer(server){setup();server.middlewares.use(middleware);},generateBundle(){for(const file of publicFiles(manifest))this.emitFile({type:'asset',fileName:'workbench-data/current/'+file,source:fs.readFileSync(path.join(dataDirectory,file))});for(const file of assets)this.emitFile({type:'asset',fileName:file,source:fs.readFileSync(path.join(assetsDirectory,file))});}};
}
