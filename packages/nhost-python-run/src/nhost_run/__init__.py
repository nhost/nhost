"""Helpers for writing `Nhost Run <https://docs.nhost.io/products/run>`_ services.

Nhost Run probes ``GET /healthz`` on the port configured under ``[healthCheck]``;
the endpoint must return ``200`` within 5 seconds or the container is restarted.
:class:`HealthMiddleware` wraps any ASGI application (FastAPI, Starlette, ...) so
that probe is answered from a health closure, and :func:`serve` runs it with
uvicorn.

It is a companion to the ``nhost`` client SDK, kept as a separate distribution
so the client stays free of any HTTP-server dependency. It depends only on
uvicorn (and the standard library).
"""

from __future__ import annotations

import inspect
from collections.abc import Awaitable, Callable
from typing import Any

import uvicorn

__all__ = ["HealthCheck", "HealthMiddleware", "serve"]

Scope = dict[str, Any]
Message = dict[str, Any]
Receive = Callable[[], Awaitable[Message]]
Send = Callable[[Message], Awaitable[None]]
ASGIApp = Callable[[Scope, Receive, Send], Awaitable[None]]

# A health check returns normally while the service is healthy; raising any
# exception marks it unhealthy (served as 503 with the exception text). It may
# be a plain or async callable.
HealthCheck = Callable[[], Awaitable[None] | None]


class HealthMiddleware:
    """ASGI middleware that answers ``GET /healthz`` and forwards everything else.

    Wrap your ASGI app with it to expose the Nhost Run health probe without
    touching your routes::

        app = HealthMiddleware(fastapi_app, health=my_health)
    """

    def __init__(self, app: ASGIApp, health: HealthCheck | None = None) -> None:
        self._app = app
        self._health = health

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        is_probe = (
            scope.get("type") == "http"
            and scope.get("path") == "/healthz"
            and scope.get("method") == "GET"
        )
        if is_probe:
            await self._respond(send)
            return

        await self._app(scope, receive, send)

    async def _respond(self, send: Send) -> None:
        status = 200
        body = b""

        if self._health is not None:
            try:
                result = self._health()
                if inspect.isawaitable(result):
                    await result
            except Exception as exc:  # noqa: BLE001 - any failure means unhealthy
                status = 503
                body = str(exc).encode()

        await send(
            {
                "type": "http.response.start",
                "status": status,
                "headers": [(b"content-type", b"text/plain; charset=utf-8")],
            }
        )
        await send({"type": "http.response.body", "body": body})


def serve(
    app: ASGIApp,
    health: HealthCheck | None = None,
    *,
    host: str = "0.0.0.0",  # noqa: S104 - Run containers bind all interfaces
    port: int = 8080,
) -> None:
    """Wrap ``app`` with the ``/healthz`` probe and serve it with uvicorn.

    Blocks until the process is stopped; uvicorn handles graceful shutdown on
    ``SIGTERM`` (the signal the Nhost Run platform sends).
    """
    uvicorn.run(HealthMiddleware(app, health), host=host, port=port)
