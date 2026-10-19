import http from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {FlowError,requireThat} from './agent-tools.mjs';

const json=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'});res.end(JSON.stringify(value));};
const keys=(o,allowed)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).every(k=>allowed.includes(k));
function publicRun(doc){
  const {history,issuedFacts,issuedRecords,requiredCounters,...visible}=doc;
  void history;void issuedFacts;void issuedRecords;void requiredCounters;
  return visible;
}
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
export function createAgentServer(flow,{origins=['http://127.0.0.1:5173','http://localhost:5173'],runtimeInfo={mode:'offline_model_substitute',externalModelEnabled:false}}={}){
  requireThat(['offline_model_substitute','remote_model'].includes(runtimeInfo.mode)&&runtimeInfo.externalModelEnabled===(runtimeInfo.mode==='remote_model'),'provider_configuration');
  const sessionInfo={mode:runtimeInfo.mode,externalModelEnabled:runtimeInfo.externalModelEnabled,...(runtimeInfo.dataHash?{dataHash:runtimeInfo.dataHash,dataContract:runtimeInfo.dataContract}:{}),...(runtimeInfo.models?{models:{analysis:runtimeInfo.models.analysis,budget:runtimeInfo.models.budget}}:{})};
  const token=randomBytes(32).toString('hex');
  const principal={id:'local-operator',role:'synthetic_analyst'};
  const server=http.createServer(async(req,res)=>{
    try{
      const port=server.address()?.port;
      requireThat([`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host),'host_denied');
      requireThat(!req.headers.origin||origins.includes(req.headers.origin),'origin_denied');
      const url=new URL(req.url,'http://127.0.0.1');
      if(req.method==='GET'&&url.pathname==='/agent-api/session')return json(res,200,{token,...sessionInfo,realAdsEnabled:false});
      const supplied=Buffer.from(String(req.headers['x-agent-token']||''));
      const expected=Buffer.from(token);requireThat(supplied.length===expected.length&&timingSafeEqual(supplied,expected),'csrf_denied');
      const match=url.pathname.match(/^\/agent-api\/runs\/([\w-]+)(?:\/([\w-]+))?$/);
      if(req.method==='GET'&&match&&!match[2]){const run=flow.get(match[1]);requireThat(!runtimeInfo.dataHash||run.inputFingerprint===flow.tools.fingerprint,'inputs_changed');return json(res,200,{run:publicRun(run)});}
      if(req.method==='GET'&&match?.[2]==='budget-inputs'){
        const run=flow.get(match[1]);requireThat(run.role==='budget','request_invalid');
        return json(res,200,flow.tools.call('budget_inputs',{},run.scope));
      }
      const action=match?.[2];
      const routes=['approve','reject','revise','resume','cancel','evidence'];
      requireThat(req.method==='POST'&&(['/agent-api/analysis','/agent-api/budget'].includes(url.pathname)||(match&&routes.includes(action))),'not_found');
      const input=await body(req);let result;
      if(url.pathname==='/agent-api/analysis'){
        requireThat(keys(input,['question','scope','parentId','focus','context']),'request_invalid');
        let context=null;
        if(input.context){
          const c=input.context;
          requireThat(keys(c,['screenVersion','metricLabels','evidenceIds','selectedTitle'])&&typeof c.screenVersion==='string'&&c.screenVersion.length<=80&&Array.isArray(c.metricLabels)&&c.metricLabels.length<=30&&c.metricLabels.every(v=>typeof v==='string'&&v.length<=100)&&Array.isArray(c.evidenceIds)&&c.evidenceIds.length<=24&&c.evidenceIds.every(v=>typeof v==='string'&&v.length<=120)&&(!c.selectedTitle||typeof c.selectedTitle==='string'&&c.selectedTitle.length<=120),'request_invalid');
          context={...c};
        }
        result=await flow.analyze(input);
        if(context){
          const accepted=[],excluded=[];
          for(const id of context.evidenceIds){try{flow.tools.call('evidence',{ids:[id]},result.scope);accepted.push(id);}catch{excluded.push(id);}}
          result=flow.store.update(result.id,result.version,d=>{d.screenContext={...context,evidenceIds:accepted,excludedEvidenceIds:excluded};});
        }
      }else if(url.pathname==='/agent-api/budget'){
        requireThat(keys(input,['analysisId','analysisVersion','userSelected']),'request_invalid');result=await flow.budget(input);
      }else{
        const id=match[1];
        const allowed={approve:['version'],reject:['version'],revise:['version','candidateId','modelId'],resume:[],cancel:[],evidence:['ids']};
        requireThat(keys(input,allowed[action]),'request_invalid');
        if(action==='approve')result=flow.approve(id,{...input,principal,expiresAt:new Date(Date.parse(flow.now())+30*60*1000).toISOString()});
        if(action==='reject')result=flow.reject(id,{...input,principal});
        if(action==='revise')result=flow.revise(id,input);
        if(action==='resume')result=await flow.resume(id);
        if(action==='cancel')result=flow.cancel(id);
        if(action==='evidence'){
          const doc=flow.get(id);requireThat(Array.isArray(input.ids)&&input.ids.every(v=>doc.issuedRecords.includes(v)),'evidence_not_retrieved');
          return json(res,200,flow.tools.call('evidence',input,doc.scope));
        }
      }
      return json(res,200,{run:publicRun(result),mode:sessionInfo.mode});
    }catch(error){
      const code=error instanceof FlowError?error.code:'server_error';
      if(!res.headersSent)json(res,code==='server_error'?500:statusFor(code),{error:code});else res.end();
    }
  });
  server.requestTimeout=10000;server.headersTimeout=10000;
  return server;
}
