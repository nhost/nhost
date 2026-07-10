"""Tests for the /healthz ASGI middleware, driven by a minimal ASGI harness."""

from __future__ import annotations

import asyncio
from typing import Any

from nhost_run import HealthMiddleware


async def _call(
    mw: HealthMiddleware, path: str = "/healthz", method: str = "GET"
) -> list[dict[str, Any]]:
    scope = {"type": "http", "path": path, "method": method}
    sent: list[dict[str, Any]] = []

    async def receive() -> dict[str, Any]:
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message: dict[str, Any]) -> None:
        sent.append(message)

    await mw(scope, receive, send)
    return sent


async def _unreachable(scope: Any, receive: Any, send: Any) -> None:  # noqa: ARG001
    raise AssertionError("wrapped app must not be called for /healthz")


def test_healthz_healthy() -> None:
    mw = HealthMiddleware(_unreachable, health=None)
    sent = asyncio.run(_call(mw))
    assert sent[0]["status"] == 200


def test_healthz_unhealthy() -> None:
    async def health() -> None:
        raise RuntimeError("db down")

    mw = HealthMiddleware(_unreachable, health=health)
    sent = asyncio.run(_call(mw))
    assert sent[0]["status"] == 503
    assert sent[1]["body"] == b"db down"


def test_other_paths_forwarded() -> None:
    called = False

    async def app(scope: Any, receive: Any, send: Any) -> None:  # noqa: ARG001
        nonlocal called
        called = True

    mw = HealthMiddleware(app, health=None)
    asyncio.run(_call(mw, path="/other"))
    assert called
