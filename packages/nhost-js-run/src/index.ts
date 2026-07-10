/**
 * Helpers for writing {@link https://docs.nhost.io/products/run | Nhost Run}
 * services in JavaScript/TypeScript.
 *
 * Nhost Run probes `GET /healthz` on the port configured under `[healthCheck]`;
 * the endpoint must return `200` within 5 seconds or the container is restarted.
 * This package answers that probe from a health closure and manages the
 * `node:http` server lifecycle, shutting down gracefully on `SIGTERM`.
 *
 * It is a companion to the `@nhost/nhost-js` client SDK, kept as a separate
 * package so the client stays free of any server concern. It depends only on
 * the Node.js standard library.
 *
 * @packageDocumentation
 */

import {
  createServer,
  type RequestListener,
  type ServerResponse,
} from 'node:http';

/**
 * A health check. Returning (or resolving) normally serves `GET /healthz` as
 * `200`; throwing (or rejecting) serves `503` with the error message, so the
 * Nhost Run platform restarts the container.
 *
 * It must settle well within the platform's 5-second probe timeout, so it
 * should check liveness cheaply rather than making slow downstream calls.
 */
export type HealthCheck = () => void | Promise<void>;

/** Options for {@link serve}. */
export interface ServeOptions {
  /** Port to listen on. Defaults to `8080`. */
  port?: number;
  /** Interface to bind. Defaults to `0.0.0.0` (all interfaces). */
  host?: string;
  /** Health check backing `GET /healthz`. Omit to always report healthy. */
  health?: HealthCheck;
}

async function respondHealth(
  res: ServerResponse,
  health?: HealthCheck,
): Promise<void> {
  if (health) {
    try {
      await health();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(message);
      return;
    }
  }

  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  res.end();
}

/**
 * Wraps a request listener so that `GET /healthz` is answered from `health` and
 * every other request is delegated to `handler`. Use it to mount the probe on a
 * server you create yourself; {@link serve} wires it for you.
 */
export function withHealthz(
  handler: RequestListener,
  health?: HealthCheck,
): RequestListener {
  return (req, res) => {
    const path = (req.url ?? '').split('?', 1)[0];
    if (req.method === 'GET' && path === '/healthz') {
      void respondHealth(res, health);
      return;
    }

    handler(req, res);
  };
}

/**
 * Serves `handler` with the `GET /healthz` probe mounted, and resolves once the
 * server has closed after receiving `SIGTERM`/`SIGINT`.
 */
export function serve(
  handler: RequestListener,
  options: ServeOptions = {},
): Promise<void> {
  const { port = 8080, host = '0.0.0.0', health } = options;
  const server = createServer(withHealthz(handler, health));

  return new Promise<void>((resolve, reject) => {
    const shutdown = (): void => {
      server.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    };

    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
    server.on('error', reject);
    server.listen(port, host);
  });
}
