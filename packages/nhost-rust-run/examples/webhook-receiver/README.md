# webhook-receiver (nhost-rust-run example)

A minimal [Nhost Run](https://docs.nhost.io/products/run) service built with
[axum](https://github.com/tokio-rs/axum) and [`nhost-run`](../../). It receives
authenticated webhooks and lets `nhost_run::serve` own the `GET /healthz` probe
and the server lifecycle.

## What it shows

- Your routes are a plain axum `Router` (`GET /`, `POST /webhook`).
- `nhost_run::serve(addr, app, health)` merges in `GET /healthz` and serves it
  all, draining in-flight requests on `SIGINT`/`SIGTERM`.
- The health closure returns `Err` (→ **503**) until `WEBHOOK_SECRET` is set, so
  a misconfigured deploy is restarted rather than silently rejecting webhooks.

## Run locally

```bash
# from packages/nhost-rust-run/examples/webhook-receiver
WEBHOOK_SECRET=dev-secret cargo run
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
# from packages/nhost-rust-run
docker build -f examples/webhook-receiver/Dockerfile -t webhook-receiver:dev .
```

Set the `WEBHOOK_SECRET` secret and deploy with the config in
[`nhost-run-service.toml`](./nhost-run-service.toml). The `[healthCheck]` port
matches the port `serve` listens on.
