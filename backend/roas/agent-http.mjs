import http from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {FlowError,requireThat} from './errors.mjs';

const json=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'});res.end(JSON.stringify(value));};

async function body(req){
  requireThat(req.headers['content-type']?.split(';')[0]==='application/json','json_required');
  let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size<=65536)chunks.push(chunk);}
  requireThat(size<=65536,'request_too_large');
  try{const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));requireThat(value&&typeof value==='object'&&!Array.isArray(value),'request_invalid');return value;}catch{throw new FlowError('request_invalid');}
}
function statusFor(code){
  if(['host_denied','origin_denied','csrf_denied','user_choice_required','approval_forbidden','real_execution_forbidden'].includes(code))return 403;
  if(code==='not_found')return 404;
  if(code==='json_required')return 415;
  if(code==='request_too_large')return 413;
  if(['version_conflict','analysis_stale','approval_stale','approval_expired','approval_required','proposal_not_editable','not_resumable','not_cancellable'].includes(code))return 409;
  return 400;
}

// Loopback development API. Session capability + exact Origin/Host checks prevent
// another website from using a browser to approve local changes. Model and key
// selection stay server-side. Live Ads and arbitrary tool endpoints stay disabled.
export function createAgentServer(_flow,{origins=['http://127.0.0.1:5173','http://localhost:5173'],runtimeInfo={mode:'offline_model_substitute',externalModelEnabled:false},roasChat,runRoutes}={}){
  requireThat(['offline_model_substitute','remote_model'].includes(runtimeInfo.mode)&&runtimeInfo.externalModelEnabled===(runtimeInfo.mode==='remote_model'),'provider_configuration');
  const sessionInfo={mode:runtimeInfo.mode,externalModelEnabled:runtimeInfo.externalModelEnabled,...(runtimeInfo.dataHash?{dataHash:runtimeInfo.dataHash,dataContract:runtimeInfo.dataContract}:{}),...(runtimeInfo.models?{models:{analysis:runtimeInfo.models.analysis,budget:runtimeInfo.models.budget}}:{})};
  const token=randomBytes(32).toString('hex');
  const runs=typeof runRoutes==='function'?runRoutes({token,origins}):runRoutes;
  const gatewayOnly=Boolean(process.env.AGENT_QA_GATEWAY_SECRET);
  const server=http.createServer(async(req,res)=>{
    try{
      const port=server.address()?.port;
      requireThat([`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host),'host_denied');
      requireThat(!req.headers.origin||origins.includes(req.headers.origin),'origin_denied');
      if(req.headers.origin){
        res.setHeader('access-control-allow-origin',req.headers.origin);
        res.setHeader('vary','Origin');
      }
      if(req.method==='OPTIONS'){
        requireThat(Boolean(req.headers.origin),'origin_denied');
        requireThat(['GET','POST'].includes(req.headers['access-control-request-method']),'origin_denied');
        const requested=String(req.headers['access-control-request-headers']||'').toLowerCase().split(',').map(v=>v.trim()).filter(Boolean);
        requireThat(requested.every(v=>['content-type','x-agent-token'].includes(v)),'origin_denied');
        res.setHeader('access-control-allow-methods','GET, POST');
        res.setHeader('access-control-allow-headers','content-type, x-agent-token');
        if(req.headers['access-control-request-private-network']==='true')res.setHeader('access-control-allow-private-network','true');
        res.writeHead(204);res.end();return;
      }
      const url=new URL(req.url,'http://127.0.0.1');
      if(gatewayOnly&&url.pathname!=='/agent-api/roas/runs'&&!url.pathname.startsWith('/agent-api/roas/runs/'))throw new FlowError('not_found');
      if(req.method==='GET'&&url.pathname==='/agent-api/session')return json(res,200,{token,...sessionInfo,realAdsEnabled:false});
      if(runs&&await runs.handle(req,res))return;
      if(gatewayOnly)throw new FlowError('not_found');
      const supplied=Buffer.from(String(req.headers['x-agent-token']||''));
      const expected=Buffer.from(token);requireThat(supplied.length===expected.length&&timingSafeEqual(supplied,expected),'csrf_denied');
      if(req.method==='POST'&&url.pathname==='/agent-api/roas/chat'){
        requireThat(typeof roasChat==='function','not_found');
        return json(res,200,await roasChat(await body(req)));
      }
      throw new FlowError('not_found');
    }catch(error){
      const code=error instanceof FlowError?error.code:'server_error';
      if(!res.headersSent)json(res,code==='server_error'?500:statusFor(code),{error:code});else res.end();
    }
  });
  server.requestTimeout=10000;server.headersTimeout=10000;
  return server;
}
