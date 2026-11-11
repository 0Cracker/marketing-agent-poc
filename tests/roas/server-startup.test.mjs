import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import net from 'node:net';
import {once} from 'node:events';
import {trainingIndex,trainingScreenData} from '../../scripts/roas/training-data.mjs';
import {roasDataHash} from '../../backend/roas/roas-agent.mjs';

test('real ROAS server starts independently and serves authenticated chat while old APIs stay unavailable',{timeout:20000},async()=>{
 const probe=net.createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
 const envDir=mkdtempSync(join(tmpdir(),'roas-agent-env-'));
 const child=spawn(process.execPath,['scripts/roas/agent-server.mjs'],{cwd:new URL('../..',import.meta.url),env:{...process.env,AGENT_PORT:String(port),AGENT_ENV_DIR:envDir},stdio:['ignore','pipe','pipe']});
 let errors='';child.stderr.on('data',chunk=>errors+=chunk);let timer;
 try{
  await Promise.race([once(child.stdout,'data'),once(child,'exit').then(([code])=>{throw Error('server exited '+code+': '+errors);}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('server startup timeout: '+errors)),15000);})]);clearTimeout(timer);
  const base=`http://127.0.0.1:${port}/agent-api`;const sessionResponse=await fetch(base+'/session');assert.equal(sessionResponse.status,200);const session=await sessionResponse.json();
  assert.equal(session.dataContract,'roas-data/1');assert.equal(session.dataHash,trainingIndex().dataHash);assert.equal(session.realAdsEnabled,false);
  const headers={'content-type':'application/json','x-agent-token':session.token};
  assert.equal((await fetch(base+'/analysis',{method:'POST',headers,body:'{}'})).status,404);
  const response=await fetch(base+'/roas/chat',{method:'POST',headers,body:JSON.stringify({question:'현재 ROAS를 요약해 주세요',scope:{caseId:'S16',snapshot:'initial',metric:'',dataHash:roasDataHash(trainingScreenData(undefined,'S16','initial')),filters:{channel:'all',source:'all',campaignId:'all',device:'all'}},history:[]})});
  assert.equal(response.status,200,await response.clone().text());assert.equal((await response.json()).mode,'offline_model_substitute');
 }finally{clearTimeout(timer);const exited=once(child,'exit');child.kill();await exited;rmSync(envDir,{recursive:true,force:true});}
});
