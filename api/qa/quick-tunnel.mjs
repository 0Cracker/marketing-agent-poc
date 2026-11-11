import { createHash, timingSafeEqual } from 'node:crypto';

const QA_BRANCH = 'qa/quick-tunnel-smoke-20261110';
const EXPECTED_BODY = { ok: true, source: 'quick-tunnel-smoke' };

function matchesToken(candidate, expected) {
  if (typeof candidate !== 'string' || typeof expected !== 'string' || expected.length < 32) {
    return false;
  }

  const received = createHash('sha256').update(candidate).digest();
  const configured = createHash('sha256').update(expected).digest();
  return timingSafeEqual(received, configured);
}

function healthUrl(origin) {
  if (typeof origin !== 'string') return null;

  try {
    const url = new URL(origin);
    if (
      url.protocol !== 'https:' ||
      !/^[a-z0-9-]+\.trycloudflare\.com$/.test(url.hostname) ||
      url.port || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash
    ) {
      return null;
    }

    return url.origin + '/health';
  } catch {
    return null;
  }
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');

  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.VERCEL_GIT_COMMIT_REF !== QA_BRANCH
  ) {
    return response.status(404).json({ error: 'not_found' });
  }

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'method_not_allowed' });
  }

  const callerToken = process.env.QUICK_TUNNEL_CALLER_TOKEN;
  const serverToken = process.env.QUICK_TUNNEL_SERVER_TOKEN;
  const target = healthUrl(process.env.QUICK_TUNNEL_ORIGIN);

  if (
    !target ||
    typeof callerToken !== 'string' || callerToken.length < 32 ||
    typeof serverToken !== 'string' || serverToken.length < 32 ||
    callerToken === serverToken
  ) {
    return response.status(503).json({ error: 'smoke_test_unavailable' });
  }

  if (!matchesToken(request.headers['x-qa-caller-token'], callerToken)) {
    return response.status(401).json({ error: 'unauthorized' });
  }

  try {
    const upstream = await fetch(target, {
      method: 'GET',
      headers: { 'x-qa-server-token': serverToken },
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });

    if (upstream.status !== 200) {
      return response.status(503).json({ error: 'smoke_test_unavailable' });
    }

    const body = await upstream.json();
    if (body?.ok !== EXPECTED_BODY.ok || body?.source !== EXPECTED_BODY.source) {
      return response.status(503).json({ error: 'smoke_test_unavailable' });
    }

    return response.status(200).json(EXPECTED_BODY);
  } catch {
    return response.status(503).json({ error: 'smoke_test_unavailable' });
  }
}
