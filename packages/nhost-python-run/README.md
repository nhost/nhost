# nhost-run (Python)

Helpers for writing [Nhost Run](https://docs.nhost.io/products/run) services in
Python. It wires the health-check endpoint the platform probes and can run your
app, so your service only has to define its routes.

It is a companion to the [`nhost`](../nhost-python) client SDK, published as a
separate distribution so the client stays free of any HTTP-server dependency.
It depends only on [`uvicorn`](https://www.uvicorn.org/) and works with any ASGI
framework (FastAPI, Starlette, ...).

## What it does

Nhost Run probes `GET /healthz` on the port configured under `[healthCheck]`;
the endpoint must return `200` within 5 seconds or the container is restarted.
`nhost_run.HealthMiddleware` wraps your ASGI app so that probe is answered from
a health closure (without touching your routes), and `nhost_run.serve` runs the
wrapped app with uvicorn.

## Usage

```python
from fastapi import FastAPI
import nhost_run

app = FastAPI()


@app.get("/")
async def root() -> dict[str, str]:
    return {"hello": "from an Nhost Run service"}


async def health() -> None:
    # Return normally while healthy; raise to make /healthz respond 503 and let
    # the platform restart the container.
    return None


if __name__ == "__main__":
    nhost_run.serve(app, health=health, port=8080)
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

If you run your own server, wrap the app yourself:

```python
app = nhost_run.HealthMiddleware(app, health=health)
```

## API

- `serve(app, health=None, *, host="0.0.0.0", port=8080)` — wrap + run with uvicorn (blocking).
- `HealthMiddleware(app, health=None)` — ASGI middleware answering `GET /healthz`.
- `health` — a sync/async callable; returns normally → 200, raises → 503 (message in body).
