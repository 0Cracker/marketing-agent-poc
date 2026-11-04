import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {makeFlow,planner,analyzed,tools} from './support.mjs';
import {createRemoteModel} from '../../backend/agent-model.mjs';

for(const role of ['analysis','budget'])test(`503 ${role} manually resumes the same SQLite document and history`,async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'agent-503-')),db=path.join(dir,'flow.sqlite');
  let f=makeFlow(c=>{if(c.role===role&&c.history.length===(role==='analysis'?1:2)){const e=Error();e.code='model_unavailable';throw e;}return planner(c);},db);
  try{
    const a=await analyzed(f),paused=role==='analysis'?a:await f.budget({analysisId:a.id,analysisVersion:a.version,userSelected:true});
    assert.equal(paused.status,'paused');assert.equal(paused.reason,'model_unavailable');
    assert.equal(paused.modelCalls,role==='analysis'?2:3);assert.equal(paused.toolCalls,role==='analysis'?1:2);
    f.close();f=makeFlow(planner,db);
    const saved=f.get(paused.id);assert.deepEqual(saved,paused);
    const r=await f.resume(saved.id);
    assert.equal(r.id,paused.id);assert.equal(r.inputFingerprint,paused.inputFingerprint);
    assert.equal(r.status,role==='analysis'?'analyzed':'pending_approval');
    assert.deepEqual(r.history.slice(0,paused.history.length),paused.history);
    assert.equal(r.modelCalls,4);assert.equal(r.toolCalls,2);
    assert.equal(r.reason,undefined);assert.equal(r.resumeConditions,undefined);
    assert.ok(r.events.some(e=>e.type==='stopped'&&e.reason==='model_unavailable'));
    if(role==='budget'){
      assert.equal(r.analysisId,a.id);assert.equal(r.analysisVersion,a.version);
      assert.deepEqual(r.simulation,paused.history.find(h=>h.tool==='simulate').result);
    }
  }finally{f.close();fs.rmSync(dir,{recursive:true});}
});

test('503 repeat uses cumulative call ceiling without implicit retries',async()=>{
  let calls=0;const f=makeFlow(()=>{calls++;const e=Error();e.code='model_unavailable';throw e;},':memory:',{maxModelCalls:2});
  try{
    let r=await analyzed(f);assert.equal(calls,1);assert.equal(r.status,'paused');
    r=await f.resume(r.id);assert.equal(calls,2);assert.equal(r.status,'paused');
    r=await f.resume(r.id);assert.equal(calls,2);assert.equal(r.status,'held');assert.equal(r.reason,'call_limit');assert.equal(r.modelCalls,2);
    assert.match(r.resumeConditions[0],/call_limit/);assert.equal(r.events.filter(e=>e.reason==='model_unavailable').length,2);
  }finally{f.close();}
});

test('changed inputs and concurrent resumes cannot bypass existing run protections',async()=>{
  let release,calls=0;const f=makeFlow(()=>{calls++;if(calls===1){const e=Error();e.code='model_unavailable';throw e;}return new Promise(resolve=>{release=resolve;});});
  try{
    const paused=await analyzed(f);const savedFingerprint=tools.fingerprint;
    try{tools.fingerprint='changed';assert.throws(()=>f.resume(paused.id),e=>e.code==='inputs_changed');assert.equal(calls,1);assert.deepEqual(f.get(paused.id),paused);}finally{tools.fingerprint=savedFingerprint;}
    const pending=f.resume(paused.id);await new Promise(resolve=>setImmediate(resolve));
    assert.throws(()=>f.resume(paused.id),e=>e.code==='not_resumable');assert.equal(calls,2);
    f.cancel(paused.id);release({tool:'market_compare',args:{}});assert.equal((await pending).status,'cancelled');
  }finally{f.close();}
});

for(const status of [401,500,502,504])test(`HTTP ${status} remains held and cannot resume`,async()=>{
  let calls=0;const model=createRemoteModel({provider:'groq',model:'test',apiKey:'not-real',allowDataTransmission:true,fetchImpl:async()=>{calls++;return new Response('{}',{status});}}),f=makeFlow(model);
  try{const r=await analyzed(f);assert.equal(calls,1);assert.equal(r.status,'held');assert.equal(r.reason,'model_failed');assert.throws(()=>f.resume(r.id),e=>e.code==='not_resumable');assert.equal(calls,1);}finally{f.close();}
});

test('historic held failures are not reclassified or made resumable',async()=>{
  const f=makeFlow(()=>{throw Error('historic unknown failure');});
  try{const r=await analyzed(f);assert.equal(r.reason,'model_failed');assert.throws(()=>f.resume(r.id),e=>e.code==='not_resumable');assert.deepEqual(f.get(r.id),r);}finally{f.close();}
});
