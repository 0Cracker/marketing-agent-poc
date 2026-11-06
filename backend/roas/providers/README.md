# Agent provider pool, handoff A

Implements the provider boundary in docs/handoffs/agent-parallel-20261104/00-shared-contract.md.
The Run Engine owns model attempts and fallback. The HTTP server loads credentials.

## Keys, read-only

Pass resolved env to createProviderPool({env,fetchImpl,clock,onEvent}).
Keys: GEMINI_API_KEY or GEMINI_API_KEY_1 / _2 / numbered keys,
AI_GATEWAY_API_KEY, SAIL_API_KEY, JEV_API_KEY (each also accepts numbered suffixes like _1). Gateway also accepts Vercel_AI_GATEWAY_API_KEY_1 (exact user-supplied name). The first populated Gemini key
by numeric name is selected. Different Google keys are never counted as
independent extra free quota. Adding a key is detected on the next process
start without editing provider selection. This module does not read env files.
I must load process.env before .env.local, then .env.

## Provider quota and fallback

As requested on 2026-11-06, configured keys can be used without a local billing
proof file. The operator manages billing, balance and automatic top-up in each
API account. AGENT_BILLING_SAFETY_FILE is no longer read by the server.

Gemini RESOURCE_EXHAUSTED or quota-exceeded responses mark its provider bucket
unavailable. The engine continues with Gateway, then Sail, when their keys are
configured and the remaining attempt budget allows it. Credit exhaustion on a
fallback provider continues to the next provider. This also skips the other
Gemini model in the already-selected candidate list, so it cannot consume a
fallback attempt on the same exhausted provider.

## API

    const pool = createProviderPool({env,fetchImpl,clock,onEvent});
    const diagnostic = pool.providerStatus({role:'quick_answer'});
    const candidates = pool.eligibleCandidates({
      role:'quick_answer', features:{jsonSchema:true,korean:true},
      remainingBudget:{remainingCalls:2,remainingMs:15000}
    });
    const result = await pool.invokeOnce({
      candidate:candidates[0], instruction:'Return JSON.',input:{question:'...'},
      responseSchema:{type:'object',properties:{answer:{type:'string'}}},
      signal,timeoutMs:10000
    });

Supported roles: quick_answer, deep_reasoning, deep_final,
first_tool_classifier. Jev only supports first_tool_classifier. format:'jev'
accepts input.state and input.questions for Choice and Noul questions.
The previous input.state string and input.choices map remain supported.
Sail is excluded when JSON Schema or tool-action output is required,
pending independent feature verification.

Pinned model choices: Gemini gemini-3.5-flash-lite / gemini-3.8-flash;
Gateway zai/glm-5.3-flash;
Sail zai-org/GLM-5.3-Flash;
Jev jev-latest. Do not substitute unknown model IDs.

invokeOnce makes one HTTP attempt, with no local retry or fallback.
Limits: 120,000 input characters, 512 KiB response payload,
model-specific output tokens. Upstream Gateway may perform internal routing
outside the local attempt counter. The new Jev workflow uses timeoutMs:null
and can be cancelled through its AbortSignal. Previous callers may specify a
timeout of up to 60 seconds. Return keys: output, actualModel,
provider, transport, billingBucket, usage. Error codes:
quota_exhausted, rate_limited, credits_exhausted, model_unavailable,
model_timeout, model_protocol, provider_configuration, paid_risk, model_failed.
No key, Authorization header, raw prompt, or provider response body is
included in providerStatus or onEvent.

## Local checks, no external API calls

    node --test tests/agents/providers/*.test.mjs
    npm run test:agents
    npm run test:roas
    npm run test:training
    npm run lint
    npm run build

CI wiring, package scripts, env file loading, account verification and
engine/server hookup belong to F/I. Until those are done, this new pool is
not live; do not claim that entering a key alone proves safe activation.

References:
https://vercel.com/docs/ai-gateway/pricing
https://vercel.com/docs/ai-gateway/observability-and-spend/budgets
https://vercel.com/docs/ai-gateway/sdks-and-apis/openai-chat-completions/structured-outputs
https://sail.computer/
https://typesafe-jev.com/en/guides/api/ (independent guide, confirm with vendor)
