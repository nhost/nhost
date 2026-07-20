// A minimal Nhost Run service built on node:http and @nhost/nhost-js-run.
//
// It receives authenticated webhooks and lets serve() mount the platform's
// GET /healthz probe and own the server lifecycle (graceful shutdown on
// SIGTERM). The health check reports 503 until WEBHOOK_SECRET is configured,
// since without it we cannot authenticate incoming webhooks — so a
// misconfigured deploy is restarted instead of silently rejecting requests.
//
// Run it locally with:
//
//   WEBHOOK_SECRET=dev-secret node server.mjs

import { serve } from '@nhost/nhost-js-run';

// In a real service this would write to your database via the Nhost GraphQL
// API; here we just keep a count so the example stays self-contained.
const state = { received: 0 };

// Backs GET /healthz: throw → 503 until WEBHOOK_SECRET is configured.
function health() {
  if (!process.env.WEBHOOK_SECRET) {
    throw new Error('WEBHOOK_SECRET is not configured');
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString() || '{}');
}

async function handler(req, res) {
  const { pathname } = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && pathname === '/') {
    sendJson(res, 200, {
      service: 'webhook-receiver',
      received: state.received,
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/webhook') {
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret || req.headers['x-webhook-secret'] !== secret) {
      sendJson(res, 401, { error: 'invalid or missing webhook secret' });
      return;
    }

    let payload;
    try {
      payload = await readJson(req);
    } catch {
      sendJson(res, 400, { error: 'invalid JSON body' });
      return;
    }

    state.received += 1;
    sendJson(res, 200, {
      ok: true,
      event: payload.type ?? 'unknown',
      received: state.received,
    });
    return;
  }

  sendJson(res, 404, { error: 'not found' });
}

await serve(handler, {
  port: Number(process.env.PORT ?? 8080),
  health,
});
