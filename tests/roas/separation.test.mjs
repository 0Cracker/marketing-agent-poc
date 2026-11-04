import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {trainingScreenData} from '../../scripts/roas/training-data.mjs';
import {reviewAsset} from '../../scripts/roas/review-data.mjs';
import {roasManifest,sourceCatalog} from '../../scripts/roas/data.mjs';
import {buildTrainingData} from '../../scripts/roas/generate-training-dashboard.mjs';
import {roasDataPlugin} from '../../scripts/roas/plugin.mjs';
const root=path.resolve(import.meta.dirname,'../..');
const hash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const baseline=JSON.parse(fs.readFileSync(path.join(root,'evidence/roas-separation-20261104/baseline.json')));
test('all 36 training and review projections preserve baseline results with independently owned identity',()=>{
 const manifest=roasManifest();
 for(let i=1;i<=18;i++)for(const snapshot of ['initial','mature']){
  const id=`S${String(i).padStart(2,'0')}`,key=`${id}-${snapshot}`;
  const {dataHash,...pack}=trainingScreenData(undefined,id,snapshot);assert.equal(dataHash,manifest.data_sha256);assert.equal(hash(pack),baseline.training[key],key);
  const {dataHash:reviewHash,...review}=reviewAsset(`review-${key}.json`);assert.equal(reviewHash,manifest.data_sha256);assert.equal(hash(review),baseline.review[key],key);
 }
 for(const [file,expected]of Object.entries(baseline.files))assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,'data/roas',file))).digest('hex'),expected,file);
});
test('reproduction uses the approved 28 copied sources and produces identical installed bytes',()=>{
 const catalog=sourceCatalog();assert.equal(catalog.records.length,28);
 const {payload}=buildTrainingData(catalog);
 assert.equal(hash(JSON.stringify(payload)+'\n'),baseline.files['training-dashboard.json']);
});
test('default data plugin emits only current projections and denies raw or old data URLs',()=>{
 const plugin=roasDataPlugin(),emitted=[];plugin.buildStart();plugin.generateBundle.call({emitFile:a=>emitted.push(a)});
 const data=emitted.filter(a=>a.fileName.startsWith('workbench-data/'));
 assert.equal(data.length,73);assert(data.every(a=>/^workbench-data\/roas\/(training-index|(?:training|review)-S\d{2}-(?:initial|mature))\.json$/.test(a.fileName)));
 let middleware;plugin.configureServer({middlewares:{use:m=>middleware=m}});
 for(const url of ['/workbench-data/current/manifest.json','/workbench-data/roas/manifest.json','/workbench-data/roas/training-dashboard.json','/workbench-data/roas/../roas-reviews.json']){const res={statusCode:200,setHeader(){},end(){}};middleware({url},res,()=>assert.fail('data URL fell through'));assert.equal(res.statusCode,404,url);}
});
test('active source imports and filesystem paths cannot refer to legacy implementation',()=>{
 const files=[];const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(/\.(tsx?|m?js|mts|css)$/.test(p))files.push(p);}};
 for(const d of ['frontend/roas','backend/roas','shared/roas','scripts/roas'])walk(path.join(root,d));
 for(const file of files){const text=fs.readFileSync(file,'utf8');for(const m of text.matchAll(/(?:from\s*|import\s*(?:\(\s*)?)["']([^"']+)["']/g)){assert(!m[1].includes('legacy'),file);if(m[1].startsWith('.')){const base=path.resolve(path.dirname(file),m[1]);assert([base,...['.ts','.tsx','.mjs','.js'].map(e=>base+e)].some(p=>fs.existsSync(p)),file+': '+m[1]);}}assert(!text.includes('/workbench-data/current/'),file);}
});

test('missing or damaged optional review data never blocks performance, startup or production projections',()=>{
 const original=fs.readFileSync;
 for(const file of ['roas-reviews.json','roas-product-metadata.json','roas-review-classification.json'])for(const damaged of [false,true]){
  fs.readFileSync=function(source,...args){if(String(source).replaceAll('\\','/').endsWith('/data/roas/'+file)){if(damaged)return Buffer.from('{}');const error=new Error('unavailable');error.code='ENOENT';throw error;}return original.call(this,source,...args);};
  try{
   assert.equal(trainingScreenData(undefined,'S16','initial').caseId,'S16');
   assert.equal(reviewAsset('review-S16-initial.json').status,'error');
   const plugin=roasDataPlugin();plugin.buildStart();let middleware;plugin.configureServer({middlewares:{use:m=>middleware=m}});
   const res={statusCode:200,setHeader(){},end(body){this.body=body;}};middleware({url:'/workbench-data/roas/training-index.json'},res,()=>assert.fail('missing endpoint'));assert.equal(res.statusCode,200);assert.equal(JSON.parse(res.body).cases.length,18);
  }finally{fs.readFileSync=original;}
 }
});
