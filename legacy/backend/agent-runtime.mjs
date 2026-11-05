import {setTimeout as sleep} from 'node:timers/promises';
import {createRemoteModel} from './agent-model.mjs';
import {requireThat} from './agent-tools.mjs';

const profiles={
  'gemini-3.5-flash-lite':{rpm:15,contextChars:120000},
  'gemini-3.1-flash-lite':{rpm:15,contextChars:120000},
  'gemini-3.8-flash':{rpm:5,contextChars:120000},
  'gemma-4-26b-a4b-it':{rpm:30,contextChars:12000},
  'gemma-4-31b-it':{rpm:30,contextChars:12000}
};

// One explicitly selected credential; keys in one project share quota.
// ponytail: process-local pacing; provider 429 remains authoritative across processes.
export function createLiveRuntime({env=process.env,fetchImpl=globalThis.fetch,now=Date.now,wait=sleep,onDiagnostic,protocol}={}){
  const keyName=env.AGENT_KEY_NAME||Object.keys(env).filter(k=>/^GEMINI_API_KEY(?:_\d+)?$/.test(k)&&env[k]?.trim()).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))[0];
  requireThat(typeof keyName==='string'&&/^GEMINI_API_KEY(?:_\d+)?$/.test(keyName)&&env[keyName]?.trim(),'provider_configuration');
  const models={analysis:env.AGENT_ANALYSIS_MODEL||'gemini-3.5-flash-lite',budget:env.AGENT_BUDGET_MODEL||'gemini-3.8-flash'};
  requireThat(Object.values(models).every(m=>Object.hasOwn(profiles,m)),'provider_configuration');
  const callers=new Map(),nextCall=new Map();
  for(const id of new Set(Object.values(models)))callers.set(id,createRemoteModel({provider:'gemini',model:id,apiKey:env[keyName],allowDataTransmission:true,fetchImpl:async(...args)=>{
    const started=now();let response;
    try{response=await fetchImpl(...args);}catch(error){onDiagnostic?.({model:id,elapsedMs:now()-started,transportError:error.cause?.code||error.name});throw error;}
    if(onDiagnostic){const data=await response.clone().json().catch(()=>({}));onDiagnostic({model:id,httpStatus:response.status,elapsedMs:now()-started,errorStatus:data.error?.status,finishReason:data.candidates?.[0]?.finishReason,usage:data.usageMetadata});}
    return response;
  },timeoutMs:60000,maxContextChars:profiles[id].contextChars,thinkingLevel:id==='gemini-3.8-flash'?'low':'minimal',protocol}));
  return {info:{mode:'remote_model',externalModelEnabled:true,models},model:async context=>{
    requireThat(Object.hasOwn(models,context.role),'provider_configuration');
    const id=models[context.role],slot=Math.max(now(),nextCall.get(id)||0);
    nextCall.set(id,slot+Math.ceil(60000/profiles[id].rpm)+100);
    if(slot>now())await wait(slot-now());
    return callers.get(id)(context);
  }};
}
