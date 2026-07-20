import { createServer, type RequestListener, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from '@jest/globals';
import { type HealthCheck, withHealthz } from '../index';

let server: Server | undefined;

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = undefined;
  }
});

async function start(health?: HealthCheck): Promise<string> {
  const app: RequestListener = (_req, res) => {
    res.writeHead(200);
    res.end('app');
  };
  server = createServer(withHealthz(app, health));
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

describe('withHealthz', () => {
  it('serves 200 when healthy', async () => {
    const base = await start();
    const res = await fetch(`${base}/healthz`);
    expect(res.status).toBe(200);
  });

  it('serves 503 when the health check throws', async () => {
    const base = await start(() => {
      throw new Error('db down');
    });
    const res = await fetch(`${base}/healthz`);
    expect(res.status).toBe(503);
    expect(await res.text()).toBe('db down');
  });

  it('delegates other paths to the wrapped handler', async () => {
    const base = await start();
    const res = await fetch(`${base}/other`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('app');
  });
});
