import fs from 'node:fs';
import path from 'node:path';
import {roasManifest,dataDirectory} from './data.mjs';
import {trainingAssetNames,trainingAsset,trainingIndex} from './training-data.mjs';
import {reviewAssetNames,reviewAsset} from './review-data.mjs';
const prefix='/workbench-data/roas/';
const training=new Set(trainingAssetNames),reviews=new Set(reviewAssetNames);
export function roasDataPlugin(){
 const publicRoot=path.resolve(import.meta.dirname,'../../frontend/public');
 const assets=[];function walk(dir=''){for(const e of fs.readdirSync(path.join(publicRoot,dir),{withFileTypes:true})){if(!dir&&e.name==='workbench-data')continue;const name=dir?dir+'/'+e.name:e.name;if(e.isDirectory())walk(name);else assets.push(name);}}walk();
 const asset=file=>training.has(file)?trainingAsset(file):reviewAsset(file,dataDirectory);
 const setup=()=>{roasManifest();trainingIndex();};
 const middleware=(req,res,next)=>{const url=(req.url||'').split('?')[0];
  if(assets.includes(url.slice(1))){res.setHeader('content-type',url.endsWith('.woff2')?'font/woff2':url.endsWith('.svg')?'image/svg+xml':'application/octet-stream');return res.end(fs.readFileSync(path.join(publicRoot,url.slice(1))));}
  if(!url.startsWith('/workbench-data/'))return next();const file=url.slice(prefix.length);
  if(!url.startsWith(prefix)||(!training.has(file)&&!reviews.has(file))){res.statusCode=404;return res.end();}
  res.setHeader('content-type','application/json');res.setHeader('cache-control','no-cache');
  try{res.end(JSON.stringify(asset(file)));}catch{res.statusCode=503;res.end(JSON.stringify({error:'ROAS data unavailable'}));}
 };
 return{name:'roas-only-data',buildStart:setup,configureServer(s){setup();s.middlewares.use(middleware);},configurePreviewServer(s){setup();s.middlewares.use(middleware);},generateBundle(){for(const file of [...training,...reviews])this.emitFile({type:'asset',fileName:prefix.slice(1)+file,source:JSON.stringify(asset(file))});for(const file of assets)this.emitFile({type:'asset',fileName:file,source:fs.readFileSync(path.join(publicRoot,file))});}};
}
