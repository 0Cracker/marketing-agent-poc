import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';

const MAX_LOGIN_BYTES=2048;
const MAX_RUN_BYTES=65536;
const MAX_REPLY_BYTES=2*1024*1024;
const SESSION_MS=2*60*60*1000;
const DEVICE_MS=30*24*60*60*1000;
const COOKIE='__Host-qa_session';
const DEVICE_COOKIE='__Host-qa_device';
const id=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const attempts=new Map();

function send(res,status,data,extra={}){
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',
    'x-content-type-options':'nosniff','referrer-policy':'no-referrer',...extra});
  res.end(JSON.stringify(data));
}
function error(res,status,code){send(res,status,{error:code});}
function equal(a,b){
  if(typeof a!=='string'||typeof b!=='string')return false;
  const left=createHash('sha256').update(a).digest(),right=createHash('sha256').update(b).digest();
  return timingSafeEqual(left,right)&&a.length===b.length;
}
function originOk(req){
  const host=req.headers.host,origin=req.headers.origin;
  if(typeof host!=='string'||typeof origin!=='string'||host.includes('/')||host.includes('@'))return false;
  try{
    const url=new URL(origin);
    return url.protocol==='https:'&&url.host===host&&url.pathname==='/'&&url.search===''&&url.hash==='';
  }catch{return false;}
}
function config(env){
  if(env.QA_GATEWAY_ENABLED!=='true'||env.VERCEL_ENV!=='preview'||!env.QA_GATEWAY_BRANCH||
    env.VERCEL_GIT_COMMIT_REF!==env.QA_GATEWAY_BRANCH)return null;
  if(typeof env.QA_LOGIN_PASSWORD!=='string'||env.QA_LOGIN_PASSWORD.length<8||
    typeof env.QA_SESSION_SECRET!=='string'||env.QA_SESSION_SECRET.length<32||
    typeof env.AGENT_QA_GATEWAY_SECRET!=='string'||env.AGENT_QA_GATEWAY_SECRET.length<32||
    env.QA_SESSION_SECRET===env.AGENT_QA_GATEWAY_SECRET||env.QA_LOGIN_PASSWORD===env.QA_SESSION_SECRET||
    env.QA_LOGIN_PASSWORD===env.AGENT_QA_GATEWAY_SECRET)return null;
  const raw=env.QA_TUNNEL_ORIGIN;
  if(typeof raw!=='string')return null;
  let url;
  try{url=new URL(raw);}catch{return null;}
  const host=url.hostname.toLowerCase(),pinned=env.QA_TUNNEL_ALLOWED_HOST?.toLowerCase();
  const quick=/^[a-z0-9-]+\.trycloudflare\.com$/.test(host);
  const named=typeof pinned==='string'&&pinned===host&&/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)&&
    !host.endsWith('.localhost')&&!host.endsWith('.internal')&&!host.endsWith('.local');
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash||
    (!quick&&!named))return null;
  return {env,origin:url.origin};
}
function validSession(req,cfg,now){
  const cookie=req.headers.cookie;
  if(typeof cookie!=='string'||cookie.length>4096)return null;
  const value=cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  if(!value||value.length>1000)return null;
  const parts=value.split('.');
  if(parts.length!==2||!/^[a-zA-Z0-9_-]{20,600}$/.test(parts[0])||!/^[a-f0-9]{64}$/.test(parts[1]))return null;
  const signature=createHmac('sha256',cfg.env.QA_SESSION_SECRET).update(parts[0]).digest('hex');
  if(!equal(signature,parts[1]))return null;
  let payload;
  try{payload=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));}catch{return null;}
  if(payload.aud!=='qa-poc'||payload.sub!=='qa-shared'||typeof payload.sid!=='string'||
    !/^[A-Za-z0-9_-]{32,64}$/.test(payload.sid)||!Number.isSafeInteger(payload.iat)||
    !Number.isSafeInteger(payload.exp)||payload.exp-payload.iat!==SESSION_MS||
    payload.iat>now+5000||payload.exp<=now)return null;
  return payload;
}
function makeSession(cfg,now,sid){
  const claim=Buffer.from(JSON.stringify({aud:'qa-poc',sub:'qa-shared',sid,iat:now,exp:now+SESSION_MS})).toString('base64url');
  const sig=createHmac('sha256',cfg.env.QA_SESSION_SECRET).update(claim).digest('hex');
  return claim+'.'+sig;
}
function cookieHeader(name,value,maxAge){
  return name+'='+value+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+maxAge;
}
function deviceId(req,cfg,now){
  const cookie=req.headers.cookie;
  if(typeof cookie!=='string'||cookie.length>4096)return null;
  const value=cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith(DEVICE_COOKIE+'='))?.slice(DEVICE_COOKIE.length+1);
  const parts=value?.split('.');
  if(!parts||parts.length!==2||!/^[A-Za-z0-9_-]{20,600}$/.test(parts[0])||!/^[a-f0-9]{64}$/.test(parts[1]))return null;
  const signature=createHmac('sha256',cfg.env.QA_SESSION_SECRET).update('device\n'+parts[0]).digest('hex');
  if(!equal(signature,parts[1]))return null;
  let claim;
  try{claim=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));}catch{return null;}
  if(claim.aud!=='qa-device'||typeof claim.sid!=='string'||!/^[A-Za-z0-9_-]{32,64}$/.test(claim.sid)||
    !Number.isSafeInteger(claim.iat)||!Number.isSafeInteger(claim.exp)||
    claim.exp-claim.iat!==DEVICE_MS||claim.iat>now+5000||claim.exp<=now)return null;
  return claim.sid;
}
function makeDevice(cfg,now,sid){
  const payload=Buffer.from(JSON.stringify({aud:'qa-device',sid,iat:now,exp:now+DEVICE_MS})).toString('base64url');
  return payload+'.'+createHmac('sha256',cfg.env.QA_SESSION_SECRET).update('device\n'+payload).digest('hex');
}
async function readJson(req,maxBytes){
  const type=req.headers['content-type'];
  if(typeof type!=='string'||type.split(';')[0].trim().toLowerCase()!=='application/json')
    return {error:415};
  const length=Number(req.headers['content-length']);
  if(Number.isFinite(length)&&length>maxBytes)return {error:413};
  if(req.body!==undefined){
    let raw;
    try{raw=Buffer.isBuffer(req.body)?req.body:Buffer.from(typeof req.body==='string'?req.body:JSON.stringify(req.body));}
    catch{return {error:400};}
    if(raw.length>maxBytes)return {error:413};
    try{return {value:JSON.parse(raw.toString('utf8')),raw};}catch{return {error:400};}
  }
  const chunks=[];let total=0;
  try{for await(const chunk of req){total+=chunk.length;if(total>maxBytes)return {error:413};chunks.push(chunk);}}
  catch{return {error:400};}
  const raw=Buffer.concat(chunks);
  try{return {value:JSON.parse(raw.toString('utf8')),raw};}catch{return {error:400};}
}
function loginLimited(req,now){
  const key=String(req.headers['x-real-ip']||req.socket?.remoteAddress||'shared').slice(0,128);
  if(attempts.size>1000)attempts.clear();
  const recent=(attempts.get(key)||[]).filter(t=>now-t<15*60_000);
  recent.push(now);attempts.set(key,recent);
  return recent.length>5;
}
function routeFor(value,method){
  if(typeof value!=='string'||value.length>180||value.includes('%')||value.includes('\\')||value.includes('#'))return null;
  if(value==='/agent-api/roas/runs'&&method==='POST')return value;
  const match=value.match(/^\/agent-api\/roas\/runs\/([0-9a-f-]{36})(?:\?(.*))?$/i);
  if(match&&id.test(match[1])&&method==='GET'&&(!match[2]||/^afterEventSeq=(?:0|[1-9][0-9]{0,12})$/.test(match[2])))return value;
  const cancel=value.match(/^\/agent-api\/roas\/runs\/([0-9a-f-]{36})\/cancel$/i);
  if(cancel&&id.test(cancel[1])&&method==='POST')return value;
  return null;
}
async function responseBody(response){
  const length=Number(response.headers.get('content-length'));
  if(Number.isFinite(length)&&length>MAX_REPLY_BYTES)throw Error('too_large');
  const chunks=[];let size=0;
  if(!response.body)return Buffer.alloc(0);
  for await(const chunk of response.body){size+=chunk.length;if(size>MAX_REPLY_BYTES)throw Error('too_large');chunks.push(Buffer.from(chunk));}
  return Buffer.concat(chunks);
}

// Same-site QA password login. Local in-memory attempt limits are only defense in depth,
// not a distributed brute-force control. Keep Vercel Deployment Protection and WAF enabled.
export function createQaGateway({env=process.env,now=Date.now,fetcher=fetch}={}){
  return {
    async session(req,res){
      const cfg=config(env);if(!cfg)return error(res,503,'gateway_not_configured');
      if(req.method!=='GET')return error(res,405,'method_not_allowed');
      const session=validSession(req,cfg,now());
      if(!session)return error(res,401,'authentication_required');
      const remote=env.QA_AGENT_MODEL_MODE==='remote_model';
      send(res,200,{token:'qa-cookie-session',mode:remote?'remote_model':'offline_model_substitute',
        externalModelEnabled:remote,realAdsEnabled:false});
    },
    async login(req,res){
      const cfg=config(env);if(!cfg)return error(res,503,'gateway_not_configured');
      if(req.method!=='POST')return error(res,405,'method_not_allowed');
      if(!originOk(req))return error(res,403,'origin_denied');
      const parsed=await readJson(req,MAX_LOGIN_BYTES);
      if(parsed.error)return error(res,parsed.error,'request_invalid');
      if(!parsed.value||typeof parsed.value!=='object'||Array.isArray(parsed.value)||
        Object.keys(parsed.value).length!==1||typeof parsed.value.password!=='string')
        return error(res,400,'request_invalid');
      const timestamp=now();
      const blocked=loginLimited(req,timestamp);
      if(blocked)return error(res,429,'rate_limited');
      if(!equal(parsed.value.password,cfg.env.QA_LOGIN_PASSWORD))return error(res,401,'authentication_required');
      const sid=deviceId(req,cfg,timestamp)||randomBytes(24).toString('base64url');
      send(res,200,{ok:true},{'set-cookie':[
        cookieHeader(COOKIE,makeSession(cfg,timestamp,sid),SESSION_MS/1000),
        cookieHeader(DEVICE_COOKIE,makeDevice(cfg,timestamp,sid),DEVICE_MS/1000)
      ]});
    },
    async logout(req,res){
      const cfg=config(env);if(!cfg)return error(res,503,'gateway_not_configured');
      if(req.method!=='POST')return error(res,405,'method_not_allowed');
      if(!originOk(req))return error(res,403,'origin_denied');
      send(res,200,{ok:true},{'set-cookie':[cookieHeader(COOKIE,'',0),cookieHeader(DEVICE_COOKIE,'',0)]});
    },
    async forward(req,res){
      const cfg=config(env);if(!cfg)return error(res,503,'gateway_not_configured');
      const session=validSession(req,cfg,now());
      if(!session)return error(res,401,'authentication_required');
      if(!['POST','GET'].includes(req.method))return error(res,405,'method_not_allowed');
      if(req.method==='POST'&&!originOk(req))return error(res,403,'origin_denied');
      const target=routeFor(req.query?.route,req.method);
      if(!target)return error(res,404,'not_found');
      let raw=Buffer.alloc(0);
      if(req.method==='POST'){
        const parsed=await readJson(req,MAX_RUN_BYTES);
        if(parsed.error)return error(res,parsed.error,'request_invalid');
        if(!parsed.value||typeof parsed.value!=='object'||Array.isArray(parsed.value))return error(res,400,'request_invalid');
        raw=parsed.raw;
      }
      const timestamp=now();
      const assertion=Buffer.from(JSON.stringify({iss:'qa-access-gateway',aud:'roas-agent',sub:'qa-shared',
        session:session.sid,nonce:randomBytes(16).toString('base64url'),iat:timestamp,exp:timestamp+30_000})).toString('base64url');
      const hash=createHash('sha256').update(raw).digest('hex');
      const signature=createHmac('sha256',cfg.env.AGENT_QA_GATEWAY_SECRET)
        .update(req.method+'\n'+target+'\n'+hash+'\n'+assertion).digest('hex');
      let response;
      try{
        response=await fetcher(cfg.origin+target,{method:req.method,redirect:'manual',cache:'no-store',
          signal:AbortSignal.timeout(8000),headers:{
            'content-type':'application/json',
            'origin':'http://127.0.0.1:5173',
            'x-qa-assertion':assertion,'x-qa-signature':signature
          },body:req.method==='POST'?raw:undefined});
      }catch{return error(res,503,'gateway_disconnected');}
      const acceptable=[200,202,400,401,403,404,409,413,415,422,429,503];
      if(!acceptable.includes(response.status)||response.headers.get('content-type')?.split(';')[0].trim()!=='application/json')
        return error(res,503,'gateway_disconnected');
      try{
        const bytes=await responseBody(response);
        const result=JSON.parse(bytes.toString('utf8'));
        if(!result||typeof result!=='object'||Array.isArray(result))throw Error('invalid');
        send(res,response.status,result);
      }catch{return error(res,503,'gateway_disconnected');}
    }
  };
}
