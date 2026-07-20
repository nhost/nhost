# @nhost/nhost-js-run

Helpers for writing [Nhost Run](https://docs.nhost.io/products/run) services in
Node.js / TypeScript. It wires the health-check endpoint the platform probes and
manages the `node:http` server lifecycle, so your service only has to define its
request handler.

It is a companion to the [`@nhost/nhost-js`](../nhost-js) client SDK, published
as a separate package so the client stays free of any server concern. It depends
only on the Node.js standard library.

## What it does

Nhost Run probes `GET /healthz` on the port configured under `[healthCheck]`;
the endpoint must return `200` within 5 seconds or the container is restarted.
`nhost-js-run` answers that probe from a health closure and runs a server that
shuts down gracefully on `SIGTERM`.

## Usage

```ts
import { serve } from '@nhost/nhost-js-run';

await serve(
  (req, res) => {
    res.writeHead(200);
    res.end('hello from an Nhost Run service');
  },
  {
    port: 8080,
    // Return/resolve normally while healthy; throw/reject to make /healthz
    // respond 503 and let the platform restart the container.
    health: async () => {},
  },
);
```

Match the port in your `nhost-run-service.toml`:

```toml
[[ports]]
port = 8080
type = "http"
publish = true

[healthCheck]
port = 8080
```

If you create your own server, wrap the request listener instead:

```ts
import { createServer } from 'node:http';
import { withHealthz } from '@nhost/nhost-js-run';

createServer(withHealthz(myHandler, myHealth)).listen(8080);
```

## API

- `serve(handler, { port?, host?, health? })` — serve `handler` + `/healthz`, graceful shutdown.
- `withHealthz(handler, health?)` — a `RequestListener` answering `GET /healthz`, delegating the rest.
- `health: () => void | Promise<void>` — returns/resolves → 200, throws/rejects → 503 (message in body).
