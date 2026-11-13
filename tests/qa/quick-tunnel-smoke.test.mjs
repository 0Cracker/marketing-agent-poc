import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import handler from '../../api/qa/quick-tunnel.mjs';
import { createSmokeServer } from '../../scripts/qa/quick-tunnel-smoke-server.mjs';

const CALLER_TOKEN = randomBytes(32).toString('hex');
const SERVER_TOKEN = randomBytes(32).toString('hex');
const ORIGIN = 'https://example-smoke.trycloudflare.com';
const VARIABLES = [
  'VERCEL_ENV',
  'VERCEL_GIT_COMMIT_REF',
  'QUICK_TUNNEL_CALLER_TOKEN',
  'QUICK_TUNNEL_SERVER_TOKEN',
  'QUICK_TUNNEL_ORIGIN',
];

function configure(t) {
  const previous = Object.fromEntries(VARIABLES.map((key) => [key, process.env[key]]));
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  Object.assign(process.env, {
    VERCEL_ENV: 'preview',
    VERCEL_GIT_COMMIT_REF: 'qa/quick-tunnel-smoke-20261110',
    QUICK_TUNNEL_CALLER_TOKEN: CALLER_TOKEN,
    QUICK_TUNNEL_SERVER_TOKEN: SERVER_TOKEN,
    QUICK_TUNNEL_ORIGIN: ORIGIN,
  });
}

async function callProxy(token = CALLER_TOKEN, method = 'GET') {
  const response = {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await handler({
    method,
    url: '/api/qa/quick-tunnel',
    headers: token == null ? {} : { 'x-qa-caller-token': token },
  }, response);
  return response;
}

function validUpstream() {
  return new Response(JSON.stringify({ ok: true, source: 'quick-tunnel-smoke' }), { status: 200 });
}

async function listen(server, port = 0) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return server.address().port;
}

async function close(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

test('server fails startup without a sufficiently long secret', () => {
  assert.throws(() => createSmokeServer(undefined), /QUICK_TUNNEL_SERVER_TOKEN/);
  assert.throws(() => createSmokeServer('short'), /QUICK_TUNNEL_SERVER_TOKEN/);

  const entry = fileURLToPath(new URL('../../scripts/qa/quick-tunnel-smoke-server.mjs', import.meta.url));
  const env = { ...process.env };
  delete env.QUICK_TUNNEL_SERVER_TOKEN;
  const result = spawnSync(process.execPath, [entry], { env, encoding: 'utf8', timeout: 5000 });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /QUICK_TUNNEL_SERVER_TOKEN/);
});

test('local server only exposes authenticated GET /health', async (t) => {
  const server = createSmokeServer(SERVER_TOKEN);
  const port = await listen(server);
  t.after(() => close(server));
  const url = 'http://127.0.0.1:' + port;
  const request = (path, options) => fetch(url + path, options);
  const validHeaders = { 'x-qa-server-token': SERVER_TOKEN };

  const ok = await request('/health', { headers: validHeaders });
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { ok: true, source: 'quick-tunnel-smoke' });

  assert.equal((await request('/health')).status, 401);
  assert.equal((await request('/health', { headers: { 'x-qa-server-token': 'incorrect' } })).status, 401);
  for (const path of ['/agent-api/roas/chat', '/agent-api/session', '/trace', '/health?url=/trace']) {
    assert.equal((await request(path, { headers: validHeaders })).status, 404, path);
  }
  assert.equal((await request('/health', { method: 'POST', headers: validHeaders })).status, 404);
});

test('Preview QA branch and exact caller token are required before upstream fetch', async (t) => {
  configure(t);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return validUpstream(); });

  assert.equal((await callProxy(null)).statusCode, 401);
  assert.equal((await callProxy('invalid')).statusCode, 401);
  assert.equal(calls, 0);

  assert.equal((await callProxy(CALLER_TOKEN, 'POST')).statusCode, 405);
  assert.equal(calls, 0);

  process.env.VERCEL_ENV = 'production';
  assert.equal((await callProxy()).statusCode, 404);
  process.env.VERCEL_ENV = 'preview';
  process.env.VERCEL_GIT_COMMIT_REF = 'dev';
  assert.equal((await callProxy()).statusCode, 404);
  assert.equal(calls, 0);
});

test('server destination is fixed to an HTTPS trycloudflare subdomain', async (t) => {
  configure(t);
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return validUpstream();
  });

  const response = await callProxy();
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { ok: true, source: 'quick-tunnel-smoke' });
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, ORIGIN + '/health');
  assert.equal(calls[0].options.redirect, 'manual');
  assert.equal(calls[0].options.headers['x-qa-server-token'], SERVER_TOKEN);
  assert.equal(calls[0].options.signal.aborted, false);

  for (const badOrigin of [
    'http://example-smoke.trycloudflare.com',
    'https://trycloudflare.com',
    'https://example-smoke.trycloudflare.com.attacker.com',
    'https://example-smoke.trycloudflare.com/path',
    'https://example-smoke.trycloudflare.com?url=https://evil.com',
    'https://example-smoke.trycloudflare.com:8443',
    'https://user@example-smoke.trycloudflare.com',
    'https://127.0.0.1',
  ]) {
    process.env.QUICK_TUNNEL_ORIGIN = badOrigin;
    assert.equal((await callProxy()).statusCode, 503, badOrigin);
  }
  assert.equal(calls.length, 1);
});

test('missing or matching secrets fail closed', async (t) => {
  configure(t);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return validUpstream(); });

  delete process.env.QUICK_TUNNEL_SERVER_TOKEN;
  assert.equal((await callProxy()).statusCode, 503);
  process.env.QUICK_TUNNEL_SERVER_TOKEN = CALLER_TOKEN;
  assert.equal((await callProxy()).statusCode, 503);
  assert.equal(calls, 0);
});

test('upstream errors, invalid payload and redirects return 503 without redirecting', async (t) => {
  configure(t);
  let result = new Response(null, { status: 302, headers: { Location: 'https://evil.example/' } });
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    if (result instanceof Error) throw result;
    return result;
  });

  assert.equal((await callProxy()).statusCode, 503);
  assert.equal(calls[0].options.redirect, 'manual');
  result = new Response('no', { status: 401 });
  assert.equal((await callProxy()).statusCode, 503);
  result = new Response(JSON.stringify({ ok: true, source: 'another-service' }), { status: 200 });
  assert.equal((await callProxy()).statusCode, 503);
  result = new Error('request timeout');
  assert.equal((await callProxy()).statusCode, 503);
});

test('local stop/restart simulation preserves origin and recovers 503 to 200', async (t) => {
  configure(t);
  let server = createSmokeServer(SERVER_TOKEN);
  const port = await listen(server);
  const originalFetch = globalThis.fetch.bind(globalThis);
  const urls = [];
  t.mock.method(globalThis, 'fetch', (url, options) => {
    urls.push(url);
    return originalFetch('http://127.0.0.1:' + port + '/health', options);
  });

  assert.equal((await callProxy()).statusCode, 200);
  await close(server);
  assert.equal((await callProxy()).statusCode, 503);

  server = createSmokeServer(SERVER_TOKEN);
  await listen(server, port);
  t.after(() => close(server));
  assert.equal((await callProxy()).statusCode, 200);
  assert.deepEqual(urls, [ORIGIN + '/health', ORIGIN + '/health', ORIGIN + '/health']);
});
