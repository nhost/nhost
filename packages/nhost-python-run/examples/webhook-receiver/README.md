# webhook-receiver (nhost-python-run example)

A minimal [Nhost Run](https://docs.nhost.io/products/run) service built with
**FastAPI** and [`nhost-run`](../../). It receives authenticated webhooks and
exposes the platform health probe via `nhost_run.serve`.

## What it shows

- Your application stays plain FastAPI (`GET /`, `POST /webhook`).
- `serve(app, health=...)` mounts `GET /healthz` and runs the app with uvicorn,
  draining in-flight requests on `SIGTERM`.
- The health closure reports **503 until `WEBHOOK_SECRET` is set**, so a
  misconfigured deploy is restarted rather than silently rejecting every
  webhook.

## Run locally

```bash
# from packages/nhost-python-run
pip install .                                  # installs nhost-run + uvicorn
pip install -r examples/webhook-receiver/requirements.txt

WEBHOOK_SECRET=dev-secret python examples/webhook-receiver/app.py
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
# from packages/nhost-python-run
docker build -f examples/webhook-receiver/Dockerfile -t webhook-receiver:dev .
```

Set the `WEBHOOK_SECRET` secret and deploy with the config in
[`nhost-run-service.toml`](./nhost-run-service.toml) (`nhost run` / the
dashboard). The `[healthCheck]` port matches the port `serve` listens on.
