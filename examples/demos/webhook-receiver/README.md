# webhook-receiver — Nhost Python SDK Run service example

A [FastAPI](https://fastapi.tiangolo.com) service that integrates a third-party
system with Nhost, designed to run as an [Nhost Run](https://docs.nhost.io/products/run/overview)
service. It:

1. accepts webhooks on `POST /webhook`,
2. verifies the `HMAC-SHA256` signature against a shared secret,
3. records each event in Nhost via a GraphQL mutation.

It talks to Nhost server-to-server using the **admin secret**
(`with_admin_session`) — the typical pattern for a trusted backend integration —
so no user session is involved.

## Endpoints

| Method | Path       | Description                                  |
| ------ | ---------- | -------------------------------------------- |
| POST   | `/webhook` | Verify signature, record the event.          |
| GET    | `/healthz` | Liveness probe.                               |

### Request headers

| Header                | Required | Description                                             |
| --------------------- | -------- | ------------------------------------------------------- |
| `X-Webhook-Signature` | yes      | `sha256=<hex>` HMAC of the raw body with `WEBHOOK_SECRET`. |
| `X-Webhook-Source`    | no       | Stored as the event `source` (default `thirdparty`).    |

Requests larger than 1 MiB receive `413 Payload Too Large` before the service
buffers the complete body. The cap is enforced both from `Content-Length` and
while streaming, so chunked requests cannot bypass it and signatures are always
checked against the complete, untruncated body.

Events are written to the `public.webhook_events` table (`source`, `event_type`,
`payload` jsonb, `received_at`), added by a migration in this backend and
readable by the `public` role so you can query them straight away.

## Configuration (environment variables)

| Variable              | Default               | Notes                                          |
| --------------------- | --------------------- | ---------------------------------------------- |
| `NHOST_SUBDOMAIN`     | `local`               | Used when `NHOST_GRAPHQL_URL` is unset.        |
| `NHOST_REGION`        | `local`               |                                                |
| `NHOST_GRAPHQL_URL`   | *(unset)*             | Override, e.g. `http://graphql:8080/v1` in-cluster. |
| `HASURA_ADMIN_SECRET` | *(required)*          | Server credential for GraphQL writes.          |
| `WEBHOOK_SECRET`      | *(required)*          | Shared secret for signature verification.      |
| `ALLOW_INSECURE_DEV_SECRETS` | *(unset)*      | Set to `1` to fall back to the well-known local-dev secrets below. |

> **Security:** `HASURA_ADMIN_SECRET` and `WEBHOOK_SECRET` MUST be set to strong
> secrets in any real deployment. If unset, the service fails to start rather
> than falling back to a publicly known default (which would make signature
> verification useless). For local development only, export
> `ALLOW_INSECURE_DEV_SECRETS=1` to use the well-known defaults
> `HASURA_ADMIN_SECRET=nhost-admin-secret` and `WEBHOOK_SECRET=dev-webhook-secret`.

## Run locally

Start the [demos backend](../backend), which owns the `webhook_events` table
this service inserts into:

```sh
cd ../backend && ./env-up.sh   # or, from here: make backend-up
```

Only one local backend can run at a time, so stop any other one first.

Then install this example's dependencies (including the SDK, editable from the
checkout) and run it. `ALLOW_INSECURE_DEV_SECRETS=1` opts into the well-known
local-dev secrets so you don't have to set them explicitly:

```sh
cd examples/demos/webhook-receiver
uv pip install -r requirements.txt
ALLOW_INSECURE_DEV_SECRETS=1 uvicorn app:app --host 127.0.0.1 --port 8081
```

Send a signed webhook:

```sh
BODY='{"type":"payment.succeeded","data":{"amount":4200,"currency":"usd"}}'
SIG="sha256=$(python3 -c "import hmac,hashlib,sys;print(hmac.new(b'dev-webhook-secret', sys.argv[1].encode(), hashlib.sha256).hexdigest())" "$BODY")"
curl -s -X POST http://127.0.0.1:8081/webhook \
  -H "content-type: application/json" \
  -H "X-Webhook-Signature: $SIG" -H "X-Webhook-Source: stripe" \
  -d "$BODY"
```

Confirm it landed:

```sh
curl -sk -X POST https://local.graphql.local.nhost.run/v1 \
  -H 'content-type: application/json' \
  -d '{"query":"query { webhook_events { source event_type payload received_at } }"}'
```

## Run as an Nhost Run service

The container starts uvicorn with at most 64 concurrent connections and a
10-second keep-alive timeout. Keep these bounds when adapting the Dockerfile so
unauthenticated clients cannot hold unbounded request buffers or idle
connections.

Build the image with the repository root as the build context, so both the
example and the local SDK it depends on are available:

```sh
# from the repository root
docker build -f examples/demos/webhook-receiver/Dockerfile -t webhook-receiver:dev .
```

Add the secrets the service config references (in
`examples/demos/backend/.secrets`); `HASURA_GRAPHQL_ADMIN_SECRET` is already
present, so **append** rather than overwrite:

```sh
cd examples/demos/backend
[ -f .secrets ] || cp .secrets.example .secrets
echo "WEBHOOK_SECRET = 'dev-webhook-secret'" >> .secrets
```

Then start it alongside the stack (from `examples/demos/backend`):

```sh
nhost up --run-service ../webhook-receiver/nhost-run-service.toml

# the published port is reachable from your laptop on http://localhost:8080
```
