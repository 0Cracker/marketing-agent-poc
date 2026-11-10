import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createQaGateway} from '../../../backend/roas/qa-gateway.mjs';
import {createAgentServer} from '../../../backend/roas/agent-http.mjs';
import {createGatewayAuth,createRunRoutes,createRunStore} from '../../../backend/roas/run-api/index.mjs';

const origin='https://marketing-preview.vercel.app';
const password='QA_TEST_PASSWORD_only_long_random';
const gatewaySecret='qa-gateway-test-secret-value-is-at-least-32-bytes';
const env=()=>({
  QA_GATEWAY_ENABLED:'true',VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'qa/auth-test',
  QA_GATEWAY_BRANCH:'qa/auth-test',QA_LOGIN_PASSWORD:password,
  QA_SESSION_SECRET:'qa-session-test-secret-value-is-at-least-32-bytes',
  AGENT_QA_GATEWAY_SECRET:gatewaySecret,
  QA_TUNNEL_ORIGIN:'https://qa-authorization-example.trycloudflare.com'
});
const headers=(extra={})=>({host:'marketing-preview.vercel.app',origin,'content-type':'application/json',
  'x-real-ip':'qa-'+randomUUID(),...extra});
const request=(method='GET',options={})=>({
  method,headers:headers(options.headers),query:options.query||{},
  ...(options.body===undefined?{}:{body:options.body})
});
async function run(gateway,method,req){
  const response={status:0,headers:{},body:'',
    writeHead(code,head){this.status=code;this.headers=head;},
    end(body){this.body=body||'';}};
  await gateway[method](req,response);
  return {status:response.status,headers:response.headers,body:response.body?JSON.parse(response.body):null};
}
async function loggedIn(gateway,ip='session-'+randomUUID()){
  const result=await run(gateway,'login',request('POST',{headers:{'x-real-ip':ip},
    body:{password}}));
  assert.equal(result.status,200);
  const cookie=result.headers['set-cookie'].map(item=>item.split(';')[0]).join('; ');
  return {cookie,ip};
}

test('preview and scoped branch must be explicitly enabled, fail closed',async()=>{
  const requestSession=request('GET');
  for(const overrides of [
    {QA_GATEWAY_ENABLED:undefined},{VERCEL_ENV:'production'},
    {VERCEL_GIT_COMMIT_REF:'dev'},{QA_GATEWAY_BRANCH:undefined},
    {QA_SESSION_SECRET:'short'},{AGENT_QA_GATEWAY_SECRET:'short'},
    {QA_TUNNEL_ORIGIN:'http://127.0.0.1:8788'},
    {QA_TUNNEL_ORIGIN:'https://localhost'},
    {QA_TUNNEL_ORIGIN:'https://qa-authorization-example.trycloudflare.com/path'},
    {QA_LOGIN_PASSWORD:'short'}
  ]){
    const gateway=createQaGateway({env:{...env(),...overrides}});
    assert.equal((await run(gateway,'session',requestSession)).status,503,JSON.stringify(overrides));
  }
});

test('shared QA login, HttpOnly secure cookie, session, logout and origin checks',async()=>{
  const gateway=createQaGateway({env:env()});
  assert.equal((await run(gateway,'session',request())).status,401);
  assert.equal((await run(gateway,'login',request('POST',{body:{password:'wrong'}}))).status,401);
  assert.equal((await run(gateway,'login',request('POST',{body:{password},
    headers:{origin:'https://attacker.example'}}))).status,403);
  const {cookie}=await loggedIn(gateway);
  const authorized=await run(gateway,'session',request('GET',{headers:{cookie}}));
  assert.equal(authorized.status,200);
  assert.equal(authorized.body.realAdsEnabled,false);
  const login=await run(gateway,'login',request('POST',{body:{password}}));
  assert.match(login.headers['set-cookie'].join(' '),/HttpOnly; Secure; SameSite=Strict/);
  const forged=cookie.replace(/(__Host-qa_session=[^;]+)(?=;|$)/,value=>value.slice(0,-1)+(value.endsWith('a')?'b':'a'));
  assert.equal((await run(gateway,'session',request('GET',{headers:{cookie:forged}}))).status,401);
  assert.equal((await run(gateway,'logout',request('POST',{headers:{cookie}}))).status,200);
  assert.match((await run(gateway,'logout',request('POST')).then(r=>r.headers['set-cookie'].join(' '))),/Max-Age=0/);
});

test('re-login after session expiration keeps browser run ownership for 30 days',async()=>{
  let timestamp=Date.now();
  const gateway=createQaGateway({env:env(),now:()=>timestamp});
  const initial=await loggedIn(gateway);
  const sidFrom=cookie=>{
    const token=cookie.match(/__Host-qa_session=([^;]+)/)?.[1];
    return JSON.parse(Buffer.from(token.split('.')[0],'base64url').toString('utf8')).sid;
  };
  assert.equal((await run(gateway,'session',request('GET',{headers:{cookie:initial.cookie}}))).status,200);
  timestamp+=2*60*60*1000+1;
  assert.equal((await run(gateway,'session',request('GET',{headers:{cookie:initial.cookie}}))).status,401);
  const next=await run(gateway,'login',request('POST',{headers:{cookie:initial.cookie},body:{password}}));
  assert.equal(next.status,200);
  const after=next.headers['set-cookie'].map(item=>item.split(';')[0]).join('; ');
  assert.equal(sidFrom(initial.cookie),sidFrom(after));
  assert.equal((await run(gateway,'session',request('GET',{headers:{cookie:after}}))).status,200);
});

test('agent proxy forwards ONLY allowlisted run routes and server-signed headers',async()=>{
  const calls=[];
  const gateway=createQaGateway({env:env(),fetcher:async(url,options)=>{
    calls.push({url,options});
    return new Response(JSON.stringify({runId:randomUUID(),executionStatus:'queued'}),{
      status:202,headers:{'content-type':'application/json'}});
  }});
  const {cookie}=await loggedIn(gateway);
  const base={cookie,'x-qa-assertion':'ATTACKER','x-qa-signature':'ATTACKER'};
  const allowed='/agent-api/roas/runs';
  const unauth=await run(gateway,'forward',request('POST',{query:{route:allowed},body:{question:'test'}}));
  assert.equal(unauth.status,401);
  assert.equal(calls.length,0);
  const invalid=await run(gateway,'forward',request('POST',{headers:base,query:{route:'/agent-api/session'},body:{}}));
  assert.equal(invalid.status,404);
  assert.equal(calls.length,0);
  const badOrigin=await run(gateway,'forward',request('POST',{headers:{...base,origin:'https://evil.example'},query:{route:allowed},body:{}}));
  assert.equal(badOrigin.status,403);
  const ok=await run(gateway,'forward',request('POST',{headers:base,query:{route:allowed},body:{question:'test'}}));
  assert.equal(ok.status,202);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://qa-authorization-example.trycloudflare.com'+allowed);
  assert.equal(calls[0].options.redirect,'manual');
  assert.notEqual(calls[0].options.headers['x-qa-assertion'],'ATTACKER');
  assert.match(calls[0].options.headers['x-qa-signature'],/^[a-f0-9]{64}$/);
  const claim=JSON.parse(Buffer.from(calls[0].options.headers['x-qa-assertion'],'base64url'));
  assert.equal(claim.sub,'qa-shared');
  assert.equal(claim.exp-claim.iat,30000);
  assert.deepEqual(Object.keys(calls[0].options.headers).sort(),['content-type','origin','x-qa-assertion','x-qa-signature']);
  const redirect=createQaGateway({env:env(),fetcher:async()=>new Response('',{status:302,headers:{location:'https://evil.example'}})});
  const rejected=await run(redirect,'forward',request('POST',{headers:{cookie},query:{route:allowed},body:{}}));
  assert.equal(rejected.status,503);
  const down=createQaGateway({env:env(),fetcher:async()=>{throw Error('offline');}});
  assert.equal((await run(down,'forward',request('POST',{headers:{cookie},query:{route:allowed},body:{}}))).status,503);
});

test('gateway signs exact body and local real run routes verify it, legacy endpoints blocked',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'qa-auth-gateway-'));
  const store=createRunStore({dbPath:join(dir,'runs.sqlite')});
  const engine={async start({runId}){store.saveRun({runId,executionStatus:'running',stage:'retrieving'});return {runId};},
    async cancel(){}};
  const auth=createGatewayAuth({secret:gatewaySecret,allowedOrigins:['http://127.0.0.1:5173']});
  const previous=process.env.AGENT_QA_GATEWAY_SECRET;
  process.env.AGENT_QA_GATEWAY_SECRET=gatewaySecret;
  const server=createAgentServer(null,{origins:['http://127.0.0.1:5173'],
    runtimeInfo:{mode:'offline_model_substitute',externalModelEnabled:false},
    roasChat:async()=>({answer:'legacy should be blocked'}),
    runRoutes:createRunRoutes({store,engine,authContext:auth})});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  t.after(async()=>{
    await new Promise(resolve=>server.close(resolve));
    store.close();rmSync(dir,{recursive:true,force:true});
    if(previous===undefined)delete process.env.AGENT_QA_GATEWAY_SECRET;
    else process.env.AGENT_QA_GATEWAY_SECRET=previous;
  });
  const address='http://127.0.0.1:'+port;
  assert.equal((await fetch(address+'/agent-api/session')).status,404);
  assert.equal((await fetch(address+'/agent-api/roas/chat',{method:'POST',headers:{origin:'http://127.0.0.1:5173'}})).status,404);
  assert.equal((await fetch(address+'/agent-api/roas/runs',{method:'POST',headers:{origin:'http://127.0.0.1:5173','content-type':'application/json'},body:'{}'})).status,401);
  const gateway=createQaGateway({env:env(),fetcher:async(url,options)=>fetch(address+new URL(url).pathname,{
    ...options,headers:{...options.headers,host:'127.0.0.1:'+port}})});
  const {cookie}=await loggedIn(gateway);
  const payload={question:'지난 14일 ROAS?',scope:{caseId:'S16',snapshot:'initial',filters:{device:'mobile'}},
    history:[],threadId:randomUUID(),clientRequestId:randomUUID()};
  const result=await run(gateway,'forward',request('POST',{headers:{cookie},query:{route:'/agent-api/roas/runs'},body:payload}));
  assert.equal(result.status,202,JSON.stringify(result.body));
  assert.match(result.body.runId,/^[a-f0-9-]{36}$/);
  const poll=await run(gateway,'forward',request('GET',{headers:{cookie},
    query:{route:'/agent-api/roas/runs/'+result.body.runId}}));
  assert.equal(poll.status,200,JSON.stringify(poll.body));
  assert.equal(poll.body.runId,result.body.runId);
  assert.equal(poll.body.appliedScope.caseId,'S16');
  const cancelled=await run(gateway,'forward',request('POST',{headers:{cookie},
    query:{route:'/agent-api/roas/runs/'+result.body.runId+'/cancel'},body:{}}));
  assert.equal(cancelled.status,200,JSON.stringify(cancelled.body));
  assert.equal(cancelled.body.executionStatus,'cancelled');
  const afterCancel=await run(gateway,'forward',request('GET',{headers:{cookie},
    query:{route:'/agent-api/roas/runs/'+result.body.runId}}));
  assert.equal(afterCancel.body.executionStatus,'cancelled');
});

test('gateway signatures are single-use and bound to method, target and body',()=>{
  const timestamp=Date.now();
  const rawBody=Buffer.from('{"question":"check"}');
  const target='/agent-api/roas/runs';
  const assertion=Buffer.from(JSON.stringify({iss:'qa-access-gateway',aud:'roas-agent',
    sub:'qa-shared',session:'a'.repeat(32),nonce:randomUUID(),
    iat:timestamp,exp:timestamp+30000})).toString('base64url');
  const signature=createHmac('sha256',gatewaySecret).update(
    'POST\n'+target+'\n'+createHash('sha256').update(rawBody).digest('hex')+'\n'+assertion
  ).digest('hex');
  const req={method:'POST',url:target,headers:{'x-qa-assertion':assertion,'x-qa-signature':signature}};
  const auth=createGatewayAuth({secret:gatewaySecret,now:()=>timestamp});
  assert.equal(auth.verify({req,rawBody}).browserId,'a'.repeat(32));
  assert.throws(()=>auth.verify({req,rawBody}),{code:'invalid_assertion'});
  for(const mutation of [
    {req,rawBody:Buffer.from('{"question":"changed"}')},
    {req:{...req,method:'GET'},rawBody},
    {req:{...req,url:target+'/other'},rawBody}
  ]){
    const fresh=createGatewayAuth({secret:gatewaySecret,now:()=>timestamp});
    assert.throws(()=>fresh.verify(mutation),{code:'invalid_assertion'});
  }
  const expired=createGatewayAuth({secret:gatewaySecret,now:()=>timestamp+30001});
  assert.throws(()=>expired.verify({req,rawBody}),{code:'expired_assertion'});
});

test('login denies a sixth attempt from the same source',async()=>{
  const gateway=createQaGateway({env:env()});
  const ip='rate-'+randomUUID();
  for(let i=0;i<5;i++){
    assert.equal((await run(gateway,'login',request('POST',{
      headers:{'x-real-ip':ip},body:{password:'incorrect'}}))).status,401);
  }
  assert.equal((await run(gateway,'login',request('POST',{
    headers:{'x-real-ip':ip},body:{password}}))).status,429);
});
