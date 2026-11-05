import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {fork} from 'node:child_process';
import {once} from 'node:events';

test('S01 verification database is isolated and graceful process restart preserves the same run',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'current-agent-server-')),database=path.join(directory,'isolated.sqlite');
  const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const serverPath=new URL('../../scripts/agent-server.mjs',import.meta.url),base=`http://127.0.0.1:${port}/agent-api`;
  let child;
  async function launch(){
    child=fork(serverPath,[],{env:{...process.env,AGENT_PORT:String(port),AGENT_DB_PATH:database},stdio:['ignore','pipe','pipe','ipc'],windowsHide:true});
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timeout')),20000);child.once('exit',code=>{clearTimeout(timer);reject(Error('Server exited '+code));});child.stdout.on('data',text=>{if(String(text).includes('Agent API')){clearTimeout(timer);resolve();}});});
    return (await fetch(base+'/session')).json();
  }
  async function stop(){if(child&&child.exitCode===null){const exited=once(child,'exit');child.send('shutdown');await exited;}child=null;}
  try{
    const before=await launch();assert.equal(before.mode,'offline_model_substitute');assert(fs.existsSync(database));
    const response=await fetch(base+'/analysis',{method:'POST',headers:{'content-type':'application/json','x-agent-token':before.token},body:JSON.stringify({question:'범위 확인'})});
    assert.equal(response.status,200);const {run}=await response.json();assert.equal(run.status,'needs_scope');assert.equal(run.modelCalls,0);
    await stop();const after=await launch();assert.notEqual(after.token,before.token);
    const restored=await (await fetch(base+'/runs/'+run.id,{headers:{'x-agent-token':after.token}})).json();assert.deepEqual(restored.run,run);
  }finally{await stop();fs.rmSync(directory,{recursive:true,force:true});}
});
