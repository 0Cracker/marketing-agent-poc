# Agent provider connection and E2E validation, 2026-11-05

## Scope
Integration worktree: feat/roas-agent-integration-20261104, no commit or push.
Used the existing main-worktree .env.local for read-only credential discovery. No API key value was printed, copied, or committed.

## Non-billable real API checks
- Sail Research: GET https://api.sailresearch.com/v1/models returned HTTP 200. Account-accessible ID: zai-org/GLM-5.3-Flash.
- Jev: GET https://api.typesafe.ai/v1/models returned HTTP 200.
- Vercel AI Gateway: AI_GATEWAY_API_KEY / _1 not found in the inspected local .env.local.
- Gemini: two configured keys; no inference request made.
- A model-list HTTP 200 verifies authentication/model listing, not chat inference or billing eligibility.

## Source adjustments
- Recognize numbered _1, _2, etc. Gateway, Sail and Jev keys (and retain Gemini support).
- Set Gateway model to zai/glm-5.3-flash.
- Set Sail model to account-listed zai-org/GLM-5.3-Flash.
- Add numbered-key forwarding regression test included in test:agents and CI workflow.
- Keep the existing verifiedFreeOnly/enforcedNoPaidUsage/remainingUsd/validUntil billing safeguard unchanged.

## Exact Korean ROAS deep-question smoke, S16 / initial / all filters
- POST /agent-api/roas/runs returned HTTP 202 and GET polling reached terminal state.
- Explicit mock: route=deep, executionStatus=completed, verification passed, 3 mock model attempts, 1 overview tool result. No provider was called.
- Real-provider mode: route=deep, executionStatus=blocked, stopReason=models_unavailable, modelAttempts=0, overview tool result only.
- This is NOT evidence that a live LLM generated a causal ROAS analysis or campaign-level actions. Real inference is blocked until an account-enforced no-paid-usage guarantee is validated.

## Validation
- npm run test:agents: 87 passed, 0 failed.
- npm run test:roas: 65 passed, 0 failed.
- npm run test:training: 5 passed, 0 failed.
- npm run lint: 0 errors, 2 existing warnings in docs/research/marketing-ontology/batches/D005.
- npm run build: passed (exit code 0); Vite emitted non-fatal font resolution notices and a Node module.register deprecation warning.
- git diff --check: no whitespace errors; Git warned about existing Windows LF-to-CRLF conversion.

## Open conditions
- Ensure the Vercel Gateway API key is present in the server runtime (not just remote Vercel dashboard).
- Verify vendor-side enforceable free-only / hard no-paid-spend settings and available balance before enabling real inference.
- Run one real deep prompt after those checks; model-generated evidence, numeric validation and campaign recommendations remain unverified.
## 2026-11-05 live inference follow-up
- Explicit live provider POST requests (not mocks):
  - Sail GLM-5.3-Flash, HTTP 200, JSON {"ok":true}, usage prompt 19, completion 133, total 152 tokens.
  - Jev systemone, HTTP 200, returned model jev-1.14.0, selected metric_detail, confidence 0.85, input 393/output 56 tokens.
  - Gemini gemini-3.5-flash-lite, HTTP 200, JSON {"ok":true}, input 9/output 9 tokens.
  - Gemini gemini-3-flash (previous pinned invalid ID), HTTP 404.
  - Gemini gemini-3.8-flash, HTTP 503 (high demand). GET Gemini model list authenticated successfully and lists gemini-3.8-flash and gemini-3.5-flash-lite.
  - Gateway live POST not executed because no key in inspected local .env.local.
- Corrections: pinned Gemini deep gemini-3.8-flash, lite gemini-3.5-flash-lite. Retain GLM-5.3-Flash for Sail and Gateway.
- Bounded local diagnostic with real data runtime and real model transport, S16 initial / all:
  1. route=deep, Jev 200, Gemini 200, metric_detail retrieved; ended withheld/model_protocol before final response (2 model attempts). Gemini had output decision=continue; precise malformed-response cause requires inspection.
  2. route=deep, Jev 200, Gemini HTTP 503, Sail timeout, Gemini HTTP 503; ended withheld/model_unavailable (5 engine attempts; 4 outbound calls due diagnostic transport cap).
- These diagnostic scripts used a deliberately separate one-off provider pool to inspect inference behavior, not the normal server's billing-safety proof. They do not demonstrate production HTTP agent completion or zero-cost/free-only billing.
- No claimed final causal analysis, validated campaign recommendations or production readiness.
- Any billed tokens/credits should be checked on each vendor dashboard; no account billing state was verified.
- Persistent local production paid-risk guard remains intact.
