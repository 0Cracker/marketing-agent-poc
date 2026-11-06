# D run API, integration handoff

This module was implemented independently. No production route, external HTTPS access gateway, login provider, PC tunnel or model account was connected. Integration owner I owns the existing server and frontend; F/I own CI.

## API and ownership

Public exports from index.mjs:
- createRunStore({dbPath, now?, maxConcurrentRuns?, maxStartsPerMinute?, maxModelAttemptsPerDay?, cleanupIntervalMs?})
- createGatewayAuth({secret, allowedOrigins, audience?, now?})
- createRunRoutes({engine, store, authContext}).handle(req, res)

Use a writable local SQLite path outside public assets. This uses actual Node built-in SQLite, tested with Windows Node 26.13.0. The minimal engine test does not call live providers. Defaults apply per entire shared QA account: 2 active runs, 8 accepted starts per minute, 60 model attempts per 24h, hourly expired-record cleanup.

Register handle(req,res) before existing routes, and fall through when it returns false. Do not change the existing /agent-api/session or /agent-api/roas/chat behavior. The Node listening address must remain 127.0.0.1.

New HTTP:
- POST /agent-api/roas/runs with JSON question, scope, history, threadId, clientRequestId; HTTP 202 contains runId and status.
- GET /agent-api/roas/runs/:runId?afterEventSeq=N; HTTP 200 contains status, events, validated terminal result.
- POST /agent-api/roas/runs/:runId/cancel with JSON empty object; HTTP 200 contains cancellation/terminal status.

## Provisional HTTPS gateway trust assertion

This is NOT a gateway implementation and is not configured for external access. The selected gateway must first authenticate the shared QA login, strip ALL inbound X-QA-* headers, and inject verified claims. Do not trust a plain X-Forwarded-User, Origin, Host or browser token as QA login evidence.

X-QA-Assertion is base64url-encoded JSON:
- iss = qa-access-gateway
- aud = roas-agent
- sub = qa-shared
- session = unique random browser session ID, 16 to 128 URL-safe characters
- iat, exp = Unix milliseconds, max lifetime 60 seconds

X-QA-Signature is the lowercase hex HMAC-SHA256 using a server-only secret of at least 32 bytes over these newline-separated strings, in order:
1. HTTP method
2. exact forwarded request target including query (req.url)
3. hex SHA-256 of the exact forwarded raw body
4. unchanged X-QA-Assertion string

The gateway must rewrite Host to the loopback host/port, preserve a configured allowed browser Origin on POST, and only reach the local PC via a separately approved outbound tunnel. A real gateway might use a different signed format: I must adapt this verification when an actual product is selected, never weaken it to accept unsigned headers. This secret is NOT an AI model API key. Vercel AI Gateway, which routes model requests, is a different service.

## C run engine adapter

D allocates the runId in an atomic SQLite reservation before returning HTTP 202. C must honor the optional runId supplied to engine.start({runId,question,scope,history,threadId,clientRequestId,accountId,browserId}); a different returned runId is blocked. C must execute asynchronously, not await the model before HTTP 202.

Pass the identical store instance into createRunEngine. C may use:
- store.saveRun({runId,executionStatus,stage,route,sourceHashes,causeStatus,stopReason,result,usage,event})
- store.recordEvent({runId,event}) for safe summary-only events
- store.publishEvidence({runId,evidence:{evidenceId,sourceHash,sourceVersion,periodId,tool,sourceRowIds}})
- store.claimModelAttempt({runId,accountId}) BEFORE each external model call. This enforces the shared daily attempt budget in addition to C's quick/deep per-run caps. A controls paid-risk and provider eligibility.

C final result must provide verified=true (or verification.passed=true), a plain result.answer string and actually published evidence IDs. Unverified answer or unissued ID is withheld. D persists source hashes, event summaries, verified result and usage, but NEVER raw run snapshot, tool JSON, private reasoning or prompt histories.

GET polls SQLite only so it cannot stall behind a model call. C must persist each stage via store.saveRun/recordEvent; C engine.getRun({runId}) remains a separate engine interface but D does not wait on it. C engine.cancel({runId,reason:'user_cancelled'}) must stop future calls and abort in-flight calls best-effort. D atomically commits cancellation before notification; later completion cannot overwrite it.

## Persistence, failures and remaining integration

A process restart marks incomplete runs interrupted without resuming any model requests. Terminal results and their event/evidence IDs are removed after 30 days (startup, request-time and hourly cleanup).

The shared account offers no per-person privacy, permissions or audit history. Browser sessions only prevent accidental thread/run collisions. The local code cannot report a PC/tunnel outage if the PC is unreachable: the external gateway/UI must distinguish that transport error from blocked analysis. An absent signing secret fails closed (503).

I needs to wire the real server, define the approved external gateway adapter, and preserve legacy routes. F/I needs to add the standalone node test command for tests/agents/run-api/*.test.mjs to scripts and CI. No actual external access or provider test has been performed.
