import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
const target='docs/design/data-separation-validation/d003b-baseline.json';
const server=await createServer({configFile:false,root:process.cwd()+'/frontend',server:{middlewareMode:true},optimizeDeps:{noDiscovery:true},appType:'custom'});
try{
 const {buildModel,typeMap}=await server.ssrLoadModule('/workbench/adapter.ts');
 const cases=[];
 for(const country of ['JP','KR','US'])for(const month of ['2025-08','2026-07','2026-08','2026-09'])for(const type of [...typeMap.types.map(t=>t.id),'H01']){
  const model=buildModel(type,country,month);
  cases.push({type,country,month,sha256:createHash('sha256').update(JSON.stringify(model)).digest('hex')});
 }
 for(const [type,options] of [['T03',{brand:'B1'}],['T03',{product:'P2A',compare:'brands'}],['T13',{grain:'day',media:'C-JP-social'}],['T08',{observed:'2026-08-10',group:'B'}]]){
  cases.push({type,options,sha256:createHash('sha256').update(JSON.stringify(buildModel(type,'JP','2026-08',options))).digest('hex')});
 }
 if(process.argv.includes('--freeze'))fs.writeFileSync(target,JSON.stringify({contract:'workbench-model/1',cases},null,2)+'\n',{flag:'wx'});
 else assert.deepEqual(cases,JSON.parse(fs.readFileSync(target)).cases,'Frozen D003B behavior changed');
 console.log(JSON.stringify({pass:true,cases:cases.length,mode:process.argv.includes('--freeze')?'freeze':'compare'}));
}finally{await server.close();}
