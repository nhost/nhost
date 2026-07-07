"""Webhook receiver — Nhost Python SDK Run service example.

A FastAPI service that accepts webhooks from a third-party system, verifies the
HMAC-SHA256 signature, and records each event in Nhost via a GraphQL mutation.
It talks to Nhost server-to-server using the admin secret (``with_admin_session``),
which is the typical pattern for a trusted backend integration.

Designed to run as an Nhost Run service; see the accompanying README.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Request

from nhost import (
    AdminSessionOptions,
    NhostClientOptions,
    create_nhost_client,
    with_admin_session,
)

INSERT_EVENT = """
mutation InsertWebhookEvent($object: webhook_events_insert_input!) {
  insert_webhook_events_one(object: $object) {
    id
    received_at
  }
}
"""


def _env(key: str, default: str | None = None) -> str | None:
    value = os.getenv(key)
    return value if value else default


WEBHOOK_SECRET = _env("WEBHOOK_SECRET", "dev-webhook-secret") or ""
ADMIN_SECRET = _env("HASURA_ADMIN_SECRET", "nhost-admin-secret") or ""


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Create one Nhost client for the app's lifetime.

    Inside a Run service, ``NHOST_GRAPHQL_URL`` points at the internal GraphQL
    endpoint (e.g. ``http://graphql:8080/v1``); on a laptop it can be left unset
    and ``subdomain``/``region`` are used instead.
    """
    async with create_nhost_client(
        NhostClientOptions(
            subdomain=_env("NHOST_SUBDOMAIN", "local"),
            region=_env("NHOST_REGION", "local"),
            graphql_url=_env("NHOST_GRAPHQL_URL"),
            configure=[with_admin_session(AdminSessionOptions(admin_secret=ADMIN_SECRET))],
        )
    ) as client:
        app.state.nhost = client
        yield


app = FastAPI(title="Nhost webhook receiver", lifespan=lifespan)


def _verify_signature(body: bytes, signature: str | None) -> None:
    """Reject the request unless it carries a valid ``sha256=<hex>`` HMAC."""
    if not signature:
        raise HTTPException(status_code=401, detail="missing signature")
    digest = hmac.new(WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    expected = f"sha256={digest}"
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="invalid signature")


@app.post("/webhook")
async def receive_webhook(
    request: Request,
    x_webhook_signature: str | None = Header(default=None),
    x_webhook_source: str = Header(default="thirdparty"),
) -> dict[str, Any]:
    """Verify, parse, and persist a third-party webhook event."""
    body = await request.body()
    _verify_signature(body, x_webhook_signature)

    try:
        event = json.loads(body)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="body is not valid JSON") from exc

    obj = {
        "source": x_webhook_source,
        "event_type": str(event.get("type", "unknown")),
        "payload": event,
    }
    result = await request.app.state.nhost.graphql.request(INSERT_EVENT, variables={"object": obj})
    inserted = (result.body.data or {}).get("insert_webhook_events_one")
    if inserted is None:
        raise HTTPException(status_code=502, detail="failed to record event")
    return {"recorded": inserted}


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}
