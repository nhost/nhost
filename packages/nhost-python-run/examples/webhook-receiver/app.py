"""A minimal Nhost Run service: a FastAPI webhook receiver.

It shows how to pair a normal FastAPI application with ``nhost_run``:

  - Your routes stay plain FastAPI.
  - ``serve(app, health=...)`` mounts the ``GET /healthz`` probe the Nhost Run
    platform requires and runs the app with uvicorn, shutting down gracefully
    on ``SIGTERM``.

The health check reports the service as unhealthy (``503``) until
``WEBHOOK_SECRET`` is configured, since without it we cannot authenticate
incoming webhooks — so a misconfigured deploy is restarted instead of silently
rejecting every request.

Run it locally with::

    WEBHOOK_SECRET=dev-secret python app.py
"""

from __future__ import annotations

import os

from fastapi import FastAPI, Header, HTTPException, Request

from nhost_run import serve

app = FastAPI(title="Nhost Run webhook receiver")

# In a real service this would write to your database via the Nhost GraphQL
# API; here we just keep a count so the example stays self-contained.
state = {"received": 0}


@app.get("/")
async def root() -> dict[str, object]:
    return {"service": "webhook-receiver", "received": state["received"]}


@app.post("/webhook")
async def webhook(
    request: Request,
    x_webhook_secret: str | None = Header(default=None),
) -> dict[str, object]:
    secret = os.environ.get("WEBHOOK_SECRET")
    if not secret or x_webhook_secret != secret:
        raise HTTPException(status_code=401, detail="invalid or missing webhook secret")

    payload = await request.json()
    state["received"] += 1
    return {
        "ok": True,
        "event": payload.get("type", "unknown"),
        "received": state["received"],
    }


def health() -> None:
    """Liveness check backing ``GET /healthz`` (raise → 503)."""
    if not os.environ.get("WEBHOOK_SECRET"):
        raise RuntimeError("WEBHOOK_SECRET is not configured")


def main() -> None:
    serve(app, health=health, port=int(os.environ.get("PORT", "8080")))


if __name__ == "__main__":
    main()
