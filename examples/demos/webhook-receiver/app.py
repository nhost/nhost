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
import logging
import os
import re
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any, cast

import httpx
from fastapi import FastAPI, Header, HTTPException, Request

from nhost import (
    AdminSessionOptions,
    NhostClient,
    NhostError,
    create_nhost_client,
    with_admin_session,
)

MAX_BODY_BYTES = 1 << 20
SHA256_HEX_LENGTH = hashlib.sha256().digest_size * 2
SOURCE_PATTERN = re.compile(r"^[a-z0-9._-]{1,64}$")

INSERT_EVENT = """
mutation InsertWebhookEvent($object: webhook_events_insert_input!) {
  insert_webhook_events_one(object: $object) {
    id
    received_at
  }
}
"""


logger = logging.getLogger("webhook-receiver")

_ALLOW_INSECURE = os.getenv("ALLOW_INSECURE_DEV_SECRETS", "").lower() in ("1", "true", "yes")


def _env(key: str, default: str | None = None) -> str | None:
    value = os.getenv(key)
    return value if value else default


def _required_secret(key: str, dev_default: str) -> str:
    """Return a required secret, failing fast instead of falling back silently.

    Falling back to a well-known, publicly documented default would make the
    signature check (and admin auth) fail *open*: any attacker knows the value.
    The local-dev default is therefore only used when the operator explicitly
    opts in via ``ALLOW_INSECURE_DEV_SECRETS=1``; otherwise startup fails.
    """
    value = os.getenv(key)
    if value:
        return value
    if _ALLOW_INSECURE:
        logger.warning(
            "%s is not set; using the well-known local-dev default. This provides "
            "NO protection and must never be used in a real deployment.",
            key,
        )
        return dev_default
    raise RuntimeError(
        f"{key} is not set. Set it to a strong secret, or export "
        "ALLOW_INSECURE_DEV_SECRETS=1 to use the well-known local-dev default "
        "(local development only)."
    )


def _configured_source() -> str:
    """Return the server-controlled source label stored with every event."""
    source = os.getenv("WEBHOOK_SOURCE") or "thirdparty"
    if SOURCE_PATTERN.fullmatch(source) is None:
        raise RuntimeError(
            "WEBHOOK_SOURCE must contain 1-64 lowercase letters, digits, dots, underscores, "
            "or hyphens"
        )
    return source


WEBHOOK_SECRET = _required_secret("WEBHOOK_SECRET", "dev-webhook-secret")
ADMIN_SECRET = _required_secret("HASURA_ADMIN_SECRET", "nhost-admin-secret")
WEBHOOK_SOURCE = _configured_source()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Create one Nhost client for the app's lifetime.

    Inside a Run service, ``NHOST_GRAPHQL_URL`` points at the internal GraphQL
    endpoint (e.g. ``http://graphql:8080/v1``); on a laptop it can be left unset
    and ``subdomain``/``region`` are used instead.
    """
    async with create_nhost_client(
        subdomain=_env("NHOST_SUBDOMAIN", "local"),
        region=_env("NHOST_REGION", "local"),
        graphql_url=_env("NHOST_GRAPHQL_URL"),
        configure=[with_admin_session(AdminSessionOptions(admin_secret=ADMIN_SECRET))],
    ) as client:
        app.state.nhost = client
        yield


app = FastAPI(title="Nhost webhook receiver", lifespan=lifespan)


async def _read_capped_body(request: Request) -> bytes:
    """Read at most ``MAX_BODY_BYTES`` without truncating the signed payload."""
    declared = request.headers.get("content-length")
    if declared is not None:
        try:
            declared_size = int(declared)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="invalid content-length") from exc
        if declared_size < 0:
            raise HTTPException(status_code=400, detail="invalid content-length")
        if declared_size > MAX_BODY_BYTES:
            raise HTTPException(status_code=413, detail="payload too large")

    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > MAX_BODY_BYTES:
            raise HTTPException(status_code=413, detail="payload too large")
        body.extend(chunk)
    return bytes(body)


def _verify_signature(body: bytes, signature: str | None) -> None:
    """Reject the request unless it carries a valid ``sha256=<hex>`` HMAC."""
    if not signature:
        raise HTTPException(status_code=401, detail="missing signature")

    scheme, separator, encoded_digest = signature.partition("=")
    if scheme != "sha256" or separator != "=" or len(encoded_digest) != SHA256_HEX_LENGTH:
        raise HTTPException(status_code=401, detail="invalid signature")
    try:
        provided_digest = bytes.fromhex(encoded_digest)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="invalid signature") from exc

    expected_digest = hmac.new(WEBHOOK_SECRET.encode(), body, hashlib.sha256).digest()
    if not hmac.compare_digest(expected_digest, provided_digest):
        raise HTTPException(status_code=401, detail="invalid signature")


@app.post("/webhook")
async def receive_webhook(
    request: Request,
    x_webhook_signature: str | None = Header(default=None),
) -> dict[str, Any]:
    """Verify, parse, and persist a third-party webhook event."""
    body = await _read_capped_body(request)
    _verify_signature(body, x_webhook_signature)

    try:
        event = json.loads(body)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="body is not valid JSON") from exc
    if not isinstance(event, dict):
        raise HTTPException(status_code=400, detail="body must be a JSON object")

    obj = {
        "source": WEBHOOK_SOURCE,
        "event_type": str(event.get("type", "unknown")),
        "payload": event,
    }
    nhost = cast(NhostClient, request.app.state.nhost)
    try:
        result = await nhost.graphql.request(INSERT_EVENT, variables={"object": obj})
    except (NhostError, httpx.HTTPError) as exc:
        logger.warning("GraphQL write failed (%s); returning 502 for retry", type(exc).__name__)
        raise HTTPException(status_code=502, detail="failed to record event") from exc

    inserted = (result.body.data or {}).get("insert_webhook_events_one")
    if inserted is None:
        raise HTTPException(status_code=502, detail="failed to record event")
    return {"recorded": inserted}


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}
