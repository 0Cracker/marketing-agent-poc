import {createHash, createHmac, randomUUID, timingSafeEqual} from 'node:crypto';
import {fingerprint, RunApiError} from './store.mjs';
export {createRunStore, RunApiError} from './store.mjs';

const PREFIX = '/agent-api/roas/runs';
const MAX_BYTES = 65536;
const idPattern = /^[a-zA-Z0-9_-]{16,128}$/;
const allowedScope = new Set(['caseId','snapshot','filters','dataHash','metric','screenTitle']);
const allowedFilters = new Set(['campaign','campaignId','platform','source','medium','device','product','productId','channel','traffic','period','dateFrom','dateTo','startDate','endDate']);
const sensitive = /api[_-]?key|bearer\s|password|secret|token|AIza[\w-]{15,}|sk-[\w-]{12,}|[\w.+-]+@[\w.-]+\.[a-z]{2,}|01[016789][- ]?\d{3,4}[- ]?\d{4}/i;
const hashBody = raw => createHash('sha256').update(raw).digest('hex');
const json = (res, status, value) => {
  res.writeHead(status, {
    'content-type':'application/json; charset=utf-8','cache-control':'no-store',
    'x-content-type-options':'nosniff','referrer-policy':'no-referrer'
  });
  res.end(JSON.stringify(value));
};
const reject = code => { throw new RunApiError(code); };
const statusCode = code => ({
  gateway_not_configured:503, gateway_disconnected:503,
  authentication_required:401, invalid_assertion:401, expired_assertion:401,
  host_denied:403, origin_denied:403, csrf_denied:403,
  json_required:415, request_too_large:413, request_invalid:400, invalid_input:422,
  not_found:404, method_not_allowed:405, idempotency_conflict:409, run_in_progress:409,
  concurrency_limited:429, rate_limited:429, model_budget_exhausted:429
})[code] || 500;
function validateScope(scope) {
  if (!scope || typeof scope!=='object' || Array.isArray(scope)) reject('invalid_input');
  for(const [key,val] of Object.entries(scope)) {
    if(!allowedScope.has(key)) reject('invalid_input');
    if(key==='filters') {
      if(!val||typeof val!=='object'||Array.isArray(val))reject('invalid_input');
      for(const [filter,value] of Object.entries(val)) {
        if(!allowedFilters.has(filter))reject('invalid_input');
        const allowed = v => (typeof v==='string' && v.length<=120 && !sensitive.test(v)) ||
          (Number.isFinite(v) && typeof v==='number') || typeof v==='boolean';
        if(Array.isArray(value) ? value.length>20 || !value.every(allowed) : !allowed(value))reject('invalid_input');
      }
    } else if(typeof val!=='string' || val.length>160 || sensitive.test(val))reject('invalid_input');
  }
  return scope;
}
function validateBody(b) {
  if(!b || typeof b!=='object' || Array.isArray(b))reject('request_invalid');
  if(Object.keys(b).some(k=>!['question','scope','history','threadId','clientRequestId'].includes(k)))reject('invalid_input');
  if(typeof b.question!=='string'||!b.question.trim()||b.question.length>2000)reject('invalid_input');
  if(typeof b.threadId!=='string'||!idPattern.test(b.threadId))reject('invalid_input');
  if(typeof b.clientRequestId!=='string'||!idPattern.test(b.clientRequestId))reject('invalid_input');
  validateScope(b.scope);
  const history=b.history===undefined?[]:b.history;
  if(!Array.isArray(history)||history.length>12||
    history.some(h=>!h||!['user','assistant'].includes(h.role)||typeof h.content!=='string'||h.content.length>3000))
    reject('invalid_input');
  return {...b,question:b.question.trim(),history};
}
const stable = value => Array.isArray(value) ? value.map(stable) :
  value && typeof value==='object' ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])) : value;
async function body(req) {
  if(req.headers['content-type']?.split(';')[0].trim().toLowerCase()!=='application/json')reject('json_required');
  if(Number(req.headers['content-length'])>MAX_BYTES)reject('request_too_large');
  const chunks=[];let length=0;
  for await(const chunk of req) {
    length+=chunk.length;
    if(length>MAX_BYTES)reject('request_too_large');
    chunks.push(chunk);
  }
  const raw=Buffer.concat(chunks);
  let value;
  try{value=JSON.parse(raw.toString('utf8'));}catch{reject('request_invalid');}
  if(!value||typeof value!=='object'||Array.isArray(value))reject('request_invalid');
  return {raw,value};
}

// The external HTTPS access gateway must authenticate the SHARED QA login and
// sign each forwarded request with a server-only key. It must strip all
// caller-supplied X-QA-* headers before injecting its own proof.
// This is not a login provider or tunnel, and is fail-closed without a key.
export function createGatewayAuth({secret, audience='roas-agent', allowedOrigins=[], now=Date.now}={}) {
  const key=typeof secret==='string'?Buffer.from(secret):secret;
  const ready=Buffer.isBuffer(key)&&key.length>=32;
  const origins=new Set(allowedOrigins);
  return {
    allowedOrigins:origins,
    verify({req, rawBody=Buffer.alloc(0)}) {
      if(!ready)reject('gateway_not_configured');
      const assertion=req.headers['x-qa-assertion'],signature=req.headers['x-qa-signature'];
      if(typeof assertion!=='string'||typeof signature!=='string')reject('authentication_required');
      if(assertion.length>2000||!/^[A-Za-z0-9_-]+$/.test(assertion)||!/^[a-f0-9]{64}$/i.test(signature))reject('invalid_assertion');
      const expected=createHmac('sha256',key).update(req.method+'\n'+req.url+'\n'+hashBody(rawBody)+'\n'+assertion).digest();
      const provided=Buffer.from(signature,'hex');
      if(provided.length!==expected.length||!timingSafeEqual(provided,expected))reject('invalid_assertion');
      let claim;
      try{claim=JSON.parse(Buffer.from(assertion,'base64url').toString('utf8'));}catch{reject('invalid_assertion');}
      const t=now(),at=t instanceof Date?t.getTime():t;
      if(claim.iss!=='qa-access-gateway'||claim.aud!==audience||claim.sub!=='qa-shared'||
        typeof claim.session!=='string'||!idPattern.test(claim.session))reject('invalid_assertion');
      if(!Number.isSafeInteger(claim.iat)||!Number.isSafeInteger(claim.exp)||claim.exp-claim.iat>60000||
        claim.iat>at+5000||claim.exp<=at)reject('expired_assertion');
      return {accountId:'qa-shared',browserId:claim.session};
    }
  };
}
function hostCheck(req) {
  const port=req.socket.localPort;
  const validHost=['127.0.0.1:'+port,'localhost:'+port];
  const ip=req.socket.remoteAddress;
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(ip)||!validHost.includes(req.headers.host))
    reject('host_denied');
}
function originCheck(req,res,authContext) {
  const origin=req.headers.origin;
  if(origin!==undefined && !authContext?.allowedOrigins?.has(origin))reject('origin_denied');
  if(origin) {
    res.setHeader('access-control-allow-origin',origin);
    res.setHeader('access-control-allow-credentials','true');
    res.setHeader('vary','Origin');
  }
  if(req.method==='POST' && !origin)reject('csrf_denied');
}
export function createRunRoutes({engine,store,authContext}={}) {
  if(!engine||!store)throw new RunApiError('engine_store_required');
  return {
    // Returns false for non-run paths: I can preserve /session and /roas/chat unchanged.
    async handle(req,res) {
      const url=new URL(req.url,'http://127.0.0.1');
      const path=url.pathname;
      if(path!==PREFIX&&!path.startsWith(PREFIX+'/'))return false;
      try {
        hostCheck(req);
        originCheck(req,res,authContext);
        if(req.method==='OPTIONS') {
          if(!req.headers.origin||!['POST','GET'].includes(req.headers['access-control-request-method']))reject('origin_denied');
          res.setHeader('access-control-allow-methods','GET, POST, OPTIONS');
          res.setHeader('access-control-allow-headers','content-type');
          res.writeHead(204,{'cache-control':'no-store'});res.end();return true;
        }
        const create=path===PREFIX&&req.method==='POST';
        const match=path.match(/^\/agent-api\/roas\/runs\/([a-f0-9-]{36})(?:\/(cancel))?$/i);
        if(!create&&!match)reject('not_found');
        if(!create&&!(req.method==='GET'&&!match[2])&&!(req.method==='POST'&&match[2]))reject('method_not_allowed');
        const parsed=req.method==='POST'?await body(req):{raw:Buffer.alloc(0),value:null};
        if(!authContext?.verify)reject('gateway_not_configured');
        const user=authContext.verify({req,rawBody:parsed.raw});
        if(!user?.accountId||!user?.browserId)reject('authentication_required');
        if(create) {
          const input=validateBody(parsed.value);
          const inputHash=fingerprint(stable({question:input.question,scope:input.scope,history:input.history,threadId:input.threadId}));
          const scopeFingerprint=fingerprint(stable(input.scope));
          const claimed=store.claimRun({runId:randomUUID(),...user,threadId:input.threadId,clientRequestId:input.clientRequestId,inputHash,scope:input.scope,scopeFingerprint});
          if(!claimed.duplicate) {
            // Non-blocking: C owns its snapshot, timers and verified result.
            void Promise.resolve().then(()=>engine.start({runId:claimed.runId,...input,accountId:user.accountId,browserId:user.browserId}))
              .then(run=>{
                if(run?.runId&&run.runId!==claimed.runId)throw new RunApiError('engine_run_id_mismatch');
              })
              .catch(e=>store.saveRun({runId:claimed.runId,executionStatus:'blocked',stopReason:'provider_error',
                event:{kind:'engine_error',stage:'terminal',errorCode:e instanceof RunApiError?e.code:'engine_failed'}}));
          }
          json(res,202,{runId:claimed.runId,executionStatus:claimed.executionStatus,scopeFingerprint,duplicate:claimed.duplicate});
          return true;
        }
        const runId=match[1];
        if(match[2]) {
          if(Object.keys(parsed.value).length)reject('invalid_input');
          const cancelled=store.cancelRun({runId,...user});
          if(!cancelled)reject('not_found');
          if(cancelled.cancelledNow) {
            void Promise.resolve().then(()=>engine.cancel({runId,reason:'user_cancelled'})).catch(()=>{});
          }
          json(res,200,{runId,executionStatus:cancelled.executionStatus,
            ...(cancelled.executionStatus==='cancelled'?{stopReason:'user_cancelled'}:{})});
          return true;
        }
        const cursor=url.searchParams.get('afterEventSeq');
        if(cursor!==null&&(!/^\d+$/.test(cursor)||!Number.isSafeInteger(Number(cursor))))reject('invalid_input');
        // Polling never waits on an active C model/tool operation.
        const state=store.getRun({runId,...user,afterEventSeq:cursor===null?0:Number(cursor)});
        if(!state)reject('not_found');
        json(res,200,state);return true;
      } catch(error) {
        const code=error instanceof RunApiError?error.code:'server_error';
        if(!res.headersSent)json(res,statusCode(code),{error:code});else res.end();
        return true;
      }
    }
  };
}
