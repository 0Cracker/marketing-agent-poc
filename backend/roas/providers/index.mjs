// Provider adapters only. The Run Engine owns retries, fallback, and attempt budgets.
const CATALOG = [
  {id:'gemini-lite',provider:'gemini',model:'gemini-3.5-flash-lite',roles:['quick_answer','deep_reasoning','deep_final','first_tool_classifier'],jsonSchema:true,toolActions:true,maxOutputTokens:4096},
  {id:'gemini-deep',provider:'gemini',model:'gemini-3.8-flash',roles:['deep_reasoning','deep_final'],jsonSchema:true,toolActions:true,maxOutputTokens:4096},
  {id:'gateway-lite',provider:'gateway',model:'zai/glm-5.3-flash',roles:['quick_answer','deep_reasoning','deep_final','first_tool_classifier'],jsonSchema:true,toolActions:true,maxOutputTokens:4096},
  {id:'sail-open',provider:'sail',model:'zai-org/GLM-5.3-Flash',roles:['quick_answer','deep_reasoning','deep_final','first_tool_classifier'],jsonSchema:false,toolActions:false,maxOutputTokens:8192},
  {id:'jev-choice',provider:'jev',model:'jev-latest',roles:['first_tool_classifier'],jsonSchema:false,toolActions:false,maxOutputTokens:256}
];
const ORDER = {
  quick_answer:['gemini-lite','gateway-lite','sail-open'],
  deep_reasoning:['gemini-deep','gateway-lite','sail-open'],
  deep_final:['gemini-deep','gateway-lite','sail-open'],
  first_tool_classifier:['jev-choice','gemini-lite','gateway-lite','sail-open']
};
const URLS = {
  gateway:'https://ai-gateway.vercel.sh/v1/chat/completions',
  sail:'https://api.sailresearch.com/v1/chat/completions',
  jev:'https://api.typesafe.ai/v1/systemone'
};
const ERRORS = new Set(['quota_exhausted','rate_limited','credits_exhausted','model_unavailable','model_timeout','model_protocol','provider_configuration','paid_risk','model_failed']);
const MAX_BODY_BYTES = 524288;
const MAX_INPUT_CHARS = 120000;

export class ProviderError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ProviderError';
    this.code = ERRORS.has(code) ? code : 'model_failed';
  }
}
const fail = code => {throw new ProviderError(code);};
const isRecord = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const safeKey = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const sortKeys = (a,b) => a.localeCompare(b,undefined,{numeric:true});

function keyFor(env,base) {
  if(safeKey(env[base]))return safeKey(env[base]);
  const names=Object.keys(env).filter(name=>name.startsWith(base+'_') &&
    /^\d+$/.test(name.slice(base.length+1)) && safeKey(env[name])).sort(sortKeys);
  return names.length?safeKey(env[names[0]]):null;
}
function credentials(env) {
  return {
    gemini:keyFor(env,'GEMINI_API_KEY'),
    gateway:keyFor(env,'AI_GATEWAY_API_KEY') || keyFor(env,'Vercel_AI_GATEWAY_API_KEY') || keyFor(env,'VERCEL_AI_GATEWAY_API_KEY'),
    sail:keyFor(env,'SAIL_API_KEY'),
    jev:keyFor(env,'JEV_API_KEY')
  };
}

function budgetPermits(remainingBudget) {
  if (remainingBudget === undefined) return true;
  if (typeof remainingBudget === 'number') return Number.isFinite(remainingBudget) && remainingBudget > 0;
  if (!isRecord(remainingBudget)) return false;
  for (const field of ['remainingCalls','attemptsLeft','remainingAttempts','remainingMs','remainingUsd']) {
    if (remainingBudget[field] !== undefined && !(typeof remainingBudget[field] === 'number' && remainingBudget[field] > 0)) return false;
  }
  return true;
}

function supports(candidate,features={}) {
  if (!isRecord(features)) return false;
  if (features.jsonSchema && !candidate.jsonSchema) return false;
  if (features.toolActions && !candidate.toolActions) return false;
  if (features.korean !== undefined && features.korean !== true && features.korean !== false) return false;
  if (features.maxOutputTokens !== undefined && (!Number.isInteger(features.maxOutputTokens) ||
      features.maxOutputTokens < 1 || features.maxOutputTokens > candidate.maxOutputTokens)) return false;
  return true;
}

function httpError(status,body,provider) {
  const info = [body?.error?.code,body?.error?.status,body?.code,body?.error?.message]
    .filter(value=>typeof value==='string'||typeof value==='number').join(' ').toLowerCase();
  if (status === 402 || /insufficient.?(credit|balance)|credit.?exhaust|billing.?limit/.test(info)) return 'credits_exhausted';
  if (provider==='gemini'&&/resource_exhausted|quota.{0,60}exceed|exceed.{0,60}quota/.test(info))return 'quota_exhausted';
  if (status === 429) return provider === 'gemini' || /quota|resource_exhausted/.test(info) ? 'quota_exhausted' : 'rate_limited';
  if (status === 401 || status === 403) return 'provider_configuration';
  if (status === 404 || status === 503 || status === 529) return 'model_unavailable';
  if (status === 400 || status === 413 || status === 422) return 'model_protocol';
  return 'model_failed';
}

function responsePayload(candidate,instruction,input,responseSchema,format) {
  let prompt;
  try {prompt=typeof input === 'string' ? input : JSON.stringify(input);} catch {fail('model_protocol');}
  if (typeof prompt !== 'string' || prompt.length > MAX_INPUT_CHARS ||
      typeof instruction !== 'string' || !instruction.trim() || instruction.length > 20000) fail('model_protocol');
  if (responseSchema !== undefined) {
    if (!isRecord(responseSchema)) fail('model_protocol');
    let encoded;
    try {encoded=JSON.stringify(responseSchema);} catch {fail('model_protocol');}
    if (!encoded || encoded.length > 16384) fail('model_protocol');
  }

  if (candidate.provider === 'jev') {
    if(format==='jev') {
      if(!isRecord(input?.state)||!isRecord(input?.questions)||!Object.keys(input.questions).length)fail('model_protocol');
      return {model:candidate.model,state:input.state,questions:input.questions};
    }
    // Jev is a typed Choice classifier, not a generative chat model.
    if (!isRecord(input) || !isRecord(input.choices) || !Object.keys(input.choices).length ||
        Object.keys(input.choices).length > 255 || !Object.values(input.choices).every(x=>typeof x==='string' && x.trim()) ||
        typeof input.state !== 'string' || !input.state.trim()) fail('model_protocol');
    return {model:candidate.model,state:input.state,questions:{first_tool:{
      type:'choice',instructions:instruction,criteria:input.choices
    }}};
  }
  if (candidate.provider === 'gemini') return {
    systemInstruction:{parts:[{text:instruction}]},
    contents:[{role:'user',parts:[{text:prompt}]}],
    generationConfig:{responseMimeType:format==='markdown'?'text/plain':'application/json',maxOutputTokens:candidate.maxOutputTokens,
      ...(responseSchema ? {responseJsonSchema:responseSchema} : {})}
  };
  const body = {model:candidate.model,messages:[{role:'system',content:instruction},{role:'user',content:prompt}],
    max_completion_tokens:candidate.maxOutputTokens};
  if (responseSchema) body.response_format = {type:'json_schema',json_schema:{name:'agent_result',strict:true,schema:responseSchema}};
  else if(format!=='markdown')body.response_format = {type:'json_object'};
  if(candidate.provider === 'sail')body.reasoning_effort = 'low';
  return body;
}

function extract(candidate,data,format) {
  if (candidate.provider === 'jev') {
    if(format==='jev') {
      if(!isRecord(data?.answers))fail('model_protocol');
      return {answers:data.answers};
    }
    const answer = data?.answers?.first_tool;
    if (!isRecord(answer) || answer.type !== 'choice' || typeof answer.choice !== 'string' ||
        !isRecord(answer.probabilities) || typeof answer.confidence !== 'number' ||
        answer.confidence < 0 || answer.confidence > 1) fail('model_protocol');
    return {choice:answer.choice,confidence:answer.confidence,probabilities:answer.probabilities};
  }
  const content = candidate.provider === 'gemini'
    ? data?.candidates?.[0]?.content?.parts?.filter(p=>!p.thought && typeof p.text==='string').map(p=>p.text).join('')
    : data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') fail('model_protocol');
  if(format==='markdown')return content;
  try {return JSON.parse(content);} catch {fail('model_protocol');}
}

function usageFor(provider,data) {
  const usage = provider === 'gemini' ? data?.usageMetadata : data?.usage;
  const inputTokens = usage?.promptTokenCount ?? usage?.prompt_tokens ?? usage?.input_tokens;
  const outputTokens = usage?.candidatesTokenCount ?? usage?.completion_tokens ?? usage?.output_tokens;
  return {
    ...(Number.isFinite(inputTokens) && inputTokens >= 0 ? {inputTokens} : {}),
    ...(Number.isFinite(outputTokens) && outputTokens >= 0 ? {outputTokens} : {})
  };
}

function safeEvent(onEvent,event) {
  // No authorization headers, request prompts, URLs containing keys or provider error bodies.
  try {onEvent?.(event);} catch {/* observability must never affect provider execution */}
}

// Account credit and quota availability are determined by provider responses.
export function createProviderPool({env={},fetchImpl=globalThis.fetch,clock=Date.now,onEvent,maxTimeoutMs=60000}={}) {
  const keys = credentials(env);
  const registry = new Map(CATALOG.map(x=>[x.id,Object.freeze({...x})]));
  const exhausted = new Map();
  const now = () => typeof clock === 'function' ? clock() : clock.now();
  const status = ({role,features={},remainingBudget}={}) => {
    const ids = role ? ORDER[role] : CATALOG.map(c=>c.id);
    if (!ids) fail('provider_configuration');
    return ids.map(id=>{
      const candidate = registry.get(id);
      const configured = !!keys[candidate.provider];
      const reason = !configured ? 'missing_key'
        : !budgetPermits(remainingBudget) ? 'call_budget_exhausted'
        : !supports(candidate,features) ? 'unsupported_features'
        : exhausted.get(candidate.provider);
      return Object.freeze({...candidate,transport:candidate.provider === 'gemini' ? 'gemini_direct'
        : candidate.provider === 'jev' ? 'typesafe_systemone' : 'openai_compatible',
        billingBucket:candidate.provider === 'gemini' ? 'google_project' : candidate.provider,
        configured,eligible:!reason,reason:reason || 'ready'});
    });
  };
  return {
    providerStatus:status,
    eligibleCandidates:options=>status(options).filter(c=>c.eligible),
    async invokeOnce({candidate,instruction,input,responseSchema,signal,timeoutMs=20000,format}={}) {
      if (!isRecord(candidate) || typeof candidate.id !== 'string') fail('provider_configuration');
      const spec = registry.get(candidate.id);
      if (!spec || (responseSchema && !spec.jsonSchema)) fail('provider_configuration');
      const selected = status({role:undefined}).find(c=>c.id===candidate.id);
      if (!selected?.configured) fail('provider_configuration');
      if (!selected.eligible) fail(ERRORS.has(selected.reason) ? selected.reason : 'provider_configuration');
      if ((timeoutMs!==null&&(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>maxTimeoutMs)) ||
          typeof fetchImpl !== 'function') fail('provider_configuration');
      if (signal?.aborted) fail('model_timeout');
      const body = responsePayload(spec,instruction,input,responseSchema,format);
      const key = keys[spec.provider];
      const url = spec.provider === 'gemini'
        ? 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(spec.model) + ':generateContent'
        : URLS[spec.provider];
      const headers = {'content-type':'application/json',
        ...(spec.provider === 'gemini' ? {'x-goog-api-key':key} : {authorization:'Bearer '+key})};
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal?.addEventListener('abort',abort,{once:true});
      const timer = timeoutMs===null?undefined:setTimeout(abort,timeoutMs);
      const started = now();
      let response;
      try {
        safeEvent(onEvent,{stage:'attempt',model:spec.model,provider:spec.provider,transport:selected.transport,billingBucket:selected.billingBucket});
        response = await fetchImpl(url,{method:'POST',headers,body:JSON.stringify(body),signal:controller.signal,redirect:'error',cache:'no-store'});
        if (!response || typeof response.status !== 'number' || typeof response.text !== 'function') fail('model_protocol');
        const raw = await response.text();
        if (typeof raw !== 'string' || Buffer.byteLength(raw,'utf8') > MAX_BODY_BYTES || controller.signal.aborted) fail(controller.signal.aborted ? 'model_timeout' : 'model_protocol');
        let data;
        try {data=JSON.parse(raw);} catch {fail('model_protocol');}
        if (!response.ok) fail(httpError(response.status,data,spec.provider));
        const output = extract(spec,data,format);
        if (spec.provider === 'jev' && format!=='jev' && !Object.hasOwn(body.questions.first_tool.criteria,output.choice)) fail('model_protocol');
        if (responseSchema && (!isRecord(output) && !Array.isArray(output))) fail('model_protocol');
        safeEvent(onEvent,{stage:'completed',model:spec.model,provider:spec.provider,elapsedMs:Math.max(0,now()-started)});
        return {output,actualModel:typeof data.model === 'string' && data.model.length <= 128 ? data.model : spec.model,
          provider:spec.provider,transport:selected.transport,billingBucket:selected.billingBucket,usage:usageFor(spec.provider,data)};
      } catch (error) {
        const code = error instanceof ProviderError ? error.code
          : controller.signal.aborted || signal?.aborted || error?.name === 'TimeoutError' ? 'model_timeout' : 'model_failed';
        if (code === 'quota_exhausted' || code === 'credits_exhausted') exhausted.set(spec.provider,code);
        safeEvent(onEvent,{stage:'failed',model:spec.model,provider:spec.provider,elapsedMs:Math.max(0,now()-started),errorCode:code});
        fail(code);
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort',abort);
      }
    }
  };
}
