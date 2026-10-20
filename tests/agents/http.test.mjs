import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createAgentServer} from '../../backend/agent-http.mjs';
import {makeFlow,planner,scope,principal} from './support.mjs';

async function start(options){
  const flow=makeFlow(planner),server=createAgentServer(flow,options);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/agent-api`;
  const info=await (await fetch(base+'/session')).json();
  const request=(path,body,headers={})=>fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json','x-agent-token':info.token,...headers},body:body===undefined?undefined:JSON.stringify(body)});
  const close=async()=>{await new Promise(resolve=>server.close(resolve));flow.close();};
  return {flow,server,base,request,info,close};
}

test('H08 exact deployed origin can preflight and analyze; foreign origins and extra capabilities fail',async()=>{
  const origin='https://marketing.example',s=await start({origins:[origin]});try{
    const headers={origin,'access-control-request-method':'POST','access-control-request-headers':'content-type,x-agent-token','access-control-request-private-network':'true'};
    const pre=await fetch(s.base+'/analysis',{method:'OPTIONS',headers});
    assert.equal(pre.status,204);assert.equal(pre.headers.get('access-control-allow-origin'),origin);assert.equal(pre.headers.get('access-control-allow-private-network'),'true');
    const result=await s.request('/analysis',{question:'가격 근거',scope},{origin});assert.equal(result.status,200);assert.equal(result.headers.get('access-control-allow-origin'),origin);
    const foreign=await fetch(s.base+'/session',{headers:{origin:'https://other.example'}});assert.equal(foreign.status,403);assert.equal(foreign.headers.get('access-control-allow-origin'),null);
    for(const extra of [{'access-control-request-method':'DELETE'},{'access-control-request-headers':'authorization'}])assert.equal((await fetch(s.base+'/analysis',{method:'OPTIONS',headers:{...headers,...extra}})).status,403);
    assert.equal((await fetch(s.base+'/analysis',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'})).status,403);
  }finally{await s.close();}
});
test('H01 session describes offline mode and blocks foreign origins/host rebinding',async()=>{
  const s=await start();try{
    assert.equal(s.info.mode,'offline_model_substitute');assert.equal(s.info.realAdsEnabled,false);
    const foreign=await s.request('/session',undefined,{origin:'https://untrusted.example'});assert.equal(foreign.status,403);
    const hostStatus=await new Promise((resolve,reject)=>{http.get({host:'127.0.0.1',port:s.server.address().port,path:'/agent-api/session',headers:{host:'untrusted.example'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));}).on('error',reject);});assert.equal(hostStatus,403);
  }finally{await s.close();}
});
test('H02 no token, wrong token, non-JSON and invalid JSON fail before mutation',async()=>{
  const s=await start();try{
    for(const headers of [{}, {'x-agent-token':'wrong'}]){
      const r=await fetch(s.base+'/analysis',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify({question:'가격 근거',scope})});assert.equal(r.status,403);
    }
    const bad=await fetch(s.base+'/analysis',{method:'POST',headers:{'x-agent-token':s.info.token,'content-type':'application/json'},body:'{'});assert.equal(bad.status,400);
    assert.equal((await s.request('/analysis',{scope},{'content-type':'text/plain'})).status,415);
    assert.equal(s.flow.store.list().length,0);
  }finally{await s.close();}
});
test('H03 analyze -> followup -> budget -> approve, no raw execution internals disclosed',async()=>{
  const s=await start();try{
    const response=await s.request('/analysis',{question:'가격 관련 근거를 확인해줘',scope,context:{screenVersion:'workbench-model/1',metricLabels:['금액 점유율'],evidenceIds:[]}});
    assert.equal(response.status,200);const {run:a}=await response.json();assert.equal(a.status,'analyzed');assert.ok(!('history' in a));assert.ok(!('issuedFacts' in a));assert.equal(a.screenContext.screenVersion,'workbench-model/1');
    const b=await (await s.request('/budget',{analysisId:a.id,analysisVersion:a.version,userSelected:true})).json();assert.equal(b.run.status,'pending_approval');
    const approved=await (await s.request(`/runs/${b.run.id}/approve`,{version:b.run.version})).json();assert.equal(approved.run.status,'approved');assert.equal(approved.run.approval.principal.role,principal.role);
    const follow=await (await s.request('/analysis',{parentId:a.id,question:'그중 가격 영향만 다시',focus:'price'})).json();assert.equal(follow.run.status,'analyzed');
    const stale=await (await s.request('/runs/'+b.run.id)).json();assert.equal(stale.run.status,'invalidated');
  }finally{await s.close();}
});
test('H04 clients cannot supply approver, adapters, provider keys or arbitrary methods',async()=>{
  const s=await start();try{
    const a=await (await s.request('/analysis',{question:'가격 근거',scope})).json();
    const b=await (await s.request('/budget',{analysisId:a.run.id,analysisVersion:a.run.version,userSelected:true})).json();
    assert.equal((await s.request(`/runs/${b.run.id}/approve`,{version:b.run.version,principal:{id:'attacker',role:'admin'}})).status,400);
    assert.equal((await s.request('/analysis',{question:'가격',scope,apiKey:'not-a-key'})).status,400);
    assert.equal((await s.request(`/runs/${b.run.id}/submit`,{version:b.run.version,adapter:{mode:'live'}})).status,404);
  }finally{await s.close();}
});
test('H05 existing ID reload, missing ID, stale version and rejected handoff are distinct',async()=>{
  const s=await start();try{
    assert.equal((await s.request('/runs/missing')).status,404);
    const a=await (await s.request('/analysis',{question:'가격 근거',scope})).json();
    assert.equal((await s.request('/budget',{analysisId:a.run.id,analysisVersion:a.run.version,userSelected:false})).status,403);
    const b=await (await s.request('/budget',{analysisId:a.run.id,analysisVersion:a.run.version,userSelected:true})).json();
    assert.equal((await s.request(`/runs/${b.run.id}/approve`,{version:0})).status,409);
    const inputs=await (await s.request(`/runs/${b.run.id}/budget-inputs`)).json();assert.ok(inputs.scenarios.length>1);
    const revised=await (await s.request(`/runs/${b.run.id}/revise`,{version:b.run.version,candidateId:inputs.scenarios[2].record_id})).json();assert.equal(revised.run.status,'pending_approval');assert.notEqual(revised.run.id,b.run.id);
  }finally{await s.close();}
});
test('H06 oversize requests, forged context and unissued evidence do not bypass validation',async()=>{
  const s=await start();try{
    assert.equal((await s.request('/analysis',{question:'x'.repeat(70000),scope})).status,413);
    assert.equal((await s.request('/analysis',{question:'가격',scope,context:{screenVersion:'v1',metricLabels:[],evidenceIds:[],rawRecords:[]}})).status,400);
    const a=await (await s.request('/analysis',{question:'가격 근거',scope})).json();
    assert.equal((await s.request(`/runs/${a.run.id}/evidence`,{ids:['invented']})).status,400);
  }finally{await s.close();}
});
test('H07 remote session exposes model IDs only, preserving real Ads and request boundaries',async()=>{
  const s=await start({runtimeInfo:{mode:'remote_model',externalModelEnabled:true,models:{analysis:'gemini-3.5-flash-lite',budget:'gemini-3.8-flash'},apiKey:'unit-test-must-not-leak'}});try{
    assert.equal(s.info.mode,'remote_model');assert.equal(s.info.externalModelEnabled,true);assert.equal(s.info.realAdsEnabled,false);assert.ok(!JSON.stringify(s.info).includes('must-not-leak'));
    assert.equal((await s.request('/analysis',{question:'가격',scope,model:'forged'})).status,400);
    const r=await (await s.request('/analysis',{question:'가격',scope})).json();assert.equal(r.mode,'remote_model');assert.equal(r.run.status,'analyzed');
  }finally{await s.close();}
});
