import test from 'node:test';
import assert from 'node:assert/strict';
import {scopeFromScreen,snapshotKey,createAgentClient,errorText} from '../frontend/workbench/agent-client.ts';

test('503 guidance describes saved state and manual resume without hiding other errors',()=>{
  assert.match(errorText('model_unavailable'),/일시적으로/);assert.match(errorText('model_unavailable'),/직접 재개/);assert.match(errorText('model_unavailable'),/자동 재시도하지 않습니다/);
  assert.notEqual(errorText('model_unavailable'),errorText('quota_exhausted'));assert.notEqual(errorText('model_unavailable'),errorText('model_failed'));
});

const selection={dataset:'D007',country:'JP',month:'2026-08',productIds:['P1A','P2A'],asOf:'2026-10-18T00:00:00Z'};
test('C01 screen context becomes explicit half-open scope without raw data',()=>{
  const s=scopeFromScreen(selection);assert.equal(s.scopeId,'D007-JP-sample');assert.equal(s.start,'2026-08-01');assert.equal(s.end,'2026-09-01');assert.deepEqual(s.productIds,['P1A','P2A']);
});
test('C02 aggregate countries, legacy batches and unspecified periods need explicit scope',()=>{
  for(const delta of [{dataset:'ALL'},{dataset:'D003B'},{country:'ALL'},{month:'ALL'},{month:'2026-13'},{asOf:''},{productIds:[]}])assert.throws(()=>scopeFromScreen({...selection,...delta}));
});
test('C03 restoring a run cannot cross country, period, product or asOf snapshots',()=>{
  const key=snapshotKey(scopeFromScreen(selection),['record-1']);
  for(const delta of [{country:'KR'},{month:'2026-07'},{productIds:['P1A']},{asOf:'2026-10-19T00:00:00Z'}])assert.notEqual(snapshotKey(scopeFromScreen({...selection,...delta}),['record-1']),key);
  assert.notEqual(snapshotKey(scopeFromScreen(selection),['record-2']),key);
});
test('C04 session token is attached to API requests, never put in body',async()=>{
  const calls:{url:string;init?:RequestInit}[]=[];
  const client=createAgentClient(async(input,init)=>{calls.push({url:String(input),init});return new Response(JSON.stringify(String(input).endsWith('/session')?{token:'test-session',mode:'offline_model_substitute',realAdsEnabled:false}:{run:{id:'saved',status:'analyzed'}}));});
  const run=await client.analyze({question:'가격',scope:scopeFromScreen(selection)});assert.equal(run.id,'saved');assert.equal(calls.length,2);
  assert.equal(new Headers(calls[1].init?.headers).get('x-agent-token'),'test-session');assert.ok(!calls[1].init?.body?.toString().includes('test-session'));
});
test('C05 lost POST response is not automatically submitted again',async()=>{
  let writes=0;const client=createAgentClient(async input=>{if(String(input).endsWith('/session'))return new Response(JSON.stringify({token:'test',mode:'offline_model_substitute',realAdsEnabled:false}));writes++;throw Error('network lost');});
  await assert.rejects(client.analyze({question:'가격',scope:scopeFromScreen(selection)}));assert.equal(writes,1);
});
test('C06 token rejected before mutation may refresh once after a server restart',async()=>{
  let sessions=0,writes=0;const client=createAgentClient(async input=>{
    if(String(input).endsWith('/session')){sessions++;return new Response(JSON.stringify({token:'session-'+sessions,mode:'offline_model_substitute',realAdsEnabled:false}));}
    writes++;return writes===1?new Response(JSON.stringify({error:'csrf_denied'}),{status:403}):new Response(JSON.stringify({run:{id:'recovered',status:'analyzed'}}));
  });
  assert.equal((await client.analyze({question:'가격',scope:scopeFromScreen(selection)})).id,'recovered');assert.equal(sessions,2);assert.equal(writes,2);
});
test('C07 server errors remain actionable codes; no fake successful result',async()=>{
  const client=createAgentClient(async input=>new Response(JSON.stringify(String(input).endsWith('/session')?{token:'test',mode:'offline_model_substitute',realAdsEnabled:false}:{error:'version_conflict'}),{status:String(input).endsWith('/session')?200:409}));
  await assert.rejects(client.action('saved','approve',{version:1}),e=>(e as Error).message==='version_conflict');
});
test('C08 remote mode requires explicit external flag and still rejects real Ads mode',async()=>{
  const session={token:'test',mode:'remote_model',externalModelEnabled:true,realAdsEnabled:false};
  const client=createAgentClient(async()=>new Response(JSON.stringify(session)));assert.equal((await client.session()).mode,'remote_model');
  for(const delta of [{externalModelEnabled:false},{realAdsEnabled:true},{mode:'unknown'}])await assert.rejects(createAgentClient(async()=>new Response(JSON.stringify({...session,...delta}))).session(),e=>(e as Error).message==='unsupported_server_mode');
});
