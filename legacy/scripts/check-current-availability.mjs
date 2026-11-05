import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import {loadCurrentData} from './current-data.mjs';

const {catalog,lock,manifest}=loadCurrentData(),hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'),before=hash(catalog);
const vite=await createServer({configFile:false,root:process.cwd()+'/frontend',server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true},appType:'custom'});
let cases=0;
try{
  const {createStandardQuery}=await vite.ssrLoadModule('/workbench/standard-query.ts');
  const query=createStandardQuery(catalog,lock),early='2020-01-01T00:00:00Z';
  for(const country of ['JP','KR','US'])for(const {type} of manifest.files)for(const detailOnly of [false,true]){
    const options={observed:'ALL',group:'ALL',detailOnly},current=query.query(type,country,'2026-08',options),past=query.query(type,country,'2026-08',{...options,asOf:early});
    assert.deepEqual({...past,asOf:current.asOf},current,`${country} ${type} detailOnly=${detailOnly}`);cases++;
  }
  assert.equal(query.query('T24','JP','2020-01',{asOf:early}).source.length,0,'Measurement month must still filter');
  assert.throws(()=>query.query('T24','JP','2026-08',{asOf:'invalid'}));
  const oldBase='frontend/public/workbench-data/D007/',oldCatalog=JSON.parse(fs.readFileSync(oldBase+'catalog.json')),oldLock=JSON.parse(fs.readFileSync(oldBase+'lock.json')),historical=createStandardQuery(oldCatalog,oldLock);
  assert.equal(historical.query('T24','JP','2026-08',{asOf:early}).source.length,0,'Historical acquisition filter must stay');
  assert.equal(historical.query('T24','JP','2026-08').source.length,600);
  assert.equal(hash(catalog),before,'Canonical records were mutated');
  console.log(JSON.stringify({pass:true,cases,currentTypes:manifest.files.length,historicalPreserved:true,dataUnchanged:true}));
}finally{await vite.close();}
