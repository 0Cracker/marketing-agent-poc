import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const HOST = '127.0.0.1';
const PORT = 18788;
const BODY = JSON.stringify({ ok: true, source: 'quick-tunnel-smoke' });

function matchesToken(candidate, expected) {
  if (typeof candidate !== 'string') return false;
  const received = createHash('sha256').update(candidate).digest();
  const configured = createHash('sha256').update(expected).digest();
  return timingSafeEqual(received, configured);
}

export function createSmokeServer(token) {
  if (typeof token !== 'string' || token.length < 32) {
    throw new Error('QUICK_TUNNEL_SERVER_TOKEN must contain at least 32 characters.');
  }

  return createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (request.method !== 'GET' || request.url !== '/health') {
      response.writeHead(404);
      response.end(JSON.stringify({ error: 'not_found' }));
      return;
    }

    if (!matchesToken(request.headers['x-qa-server-token'], token)) {
      response.writeHead(401);
      response.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }

    response.writeHead(200);
    response.end(BODY);
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createSmokeServer(process.env.QUICK_TUNNEL_SERVER_TOKEN);
  server.listen(PORT, HOST, () => {
    process.stdout.write('Quick Tunnel smoke server listening on 127.0.0.1:18788\n');
  });
}
