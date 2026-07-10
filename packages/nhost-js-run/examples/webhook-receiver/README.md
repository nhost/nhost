# webhook-receiver (nhost-js-run example)

A minimal [Nhost Run](https://docs.nhost.io/products/run) service built with
`node:http` and [`@nhost/nhost-js-run`](../../). It receives authenticated
webhooks and lets `serve` own the `GET /healthz` probe and the server lifecycle.

## What it shows

- Your handler is a plain `node:http` request listener (`GET /`, `POST /webhook`).
- `serve(handler, { port, health })` mounts `GET /healthz` and delegates
  everything else to your handler, draining in-flight requests on
  `SIGTERM`/`SIGINT`.
- The health closure **throws → 503 until `WEBHOOK_SECRET` is set**, so a
  misconfigured deploy is restarted rather than silently rejecting every webhook.

## Run locally

```bash
# from the repository root
pnpm --filter @nhost/nhost-js-run install
pnpm --filter @nhost/nhost-js-run build          # produces the package's dist/
pnpm --filter @nhost/example-js-run-webhook-receiver install

# from packages/nhost-js-run/examples/webhook-receiver
WEBHOOK_SECRET=dev-secret node server.mjs
```

Then:

```bash
curl -s localhost:8080/healthz -o /dev/null -w '%{http_code}\n'          # 200
curl -s -X POST localhost:8080/webhook \
  -H 'x-webhook-secret: dev-secret' \
  -H 'content-type: application/json' \
  -d '{"type": "user.created"}'                                          # {"ok":true,...}
```

Without `WEBHOOK_SECRET`, `/healthz` returns `503` and `/webhook` returns `401`.

## Deploy to Nhost Run

```bash
# from the repository root
docker build -f packages/nhost-js-run/examples/webhook-receiver/Dockerfile \
  -t webhook-receiver:dev .
```

Set the `WEBHOOK_SECRET` secret and deploy with the config in
[`nhost-run-service.toml`](./nhost-run-service.toml). The `[healthCheck]` port
matches the port `serve` listens on.
