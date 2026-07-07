"""Fetch middleware (chain functions) for the Nhost Python SDK.

Each middleware wraps the next fetch in the chain and may mutate the outgoing
:class:`httpx.Request` headers and/or inspect the :class:`httpx.Response`. This
mirrors the middleware set in ``@nhost/nhost-js``'s ``fetch`` module.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

import httpx

from ..auth import Client as AuthClient
from ..auth import Session
from . import ChainFunction, FetchFunction

if TYPE_CHECKING:
    # Type-only import: avoids the session -> auth -> fetch runtime cycle.
    from ..session.storage import SessionStorage

logger = logging.getLogger("nhost.fetch")

_DEFAULT_MARGIN_SECONDS = 60


def attach_access_token_middleware(storage: SessionStorage) -> ChainFunction:
    """Attach ``Authorization: Bearer <access_token>`` from the stored session.

    Should run after the refresh middleware so the freshest token is used. Skips
    requests that already carry an ``Authorization`` header.
    """

    def chain(next_fetch: FetchFunction) -> FetchFunction:
        async def fetch(request: httpx.Request) -> httpx.Response:
            if "Authorization" not in request.headers:
                session = storage.get()
                if session is not None and session.access_token:
                    request.headers["Authorization"] = f"Bearer {session.access_token}"
            return await next_fetch(request)

        return fetch

    return chain


def session_refresh_middleware(
    auth: AuthClient,
    storage: SessionStorage,
    margin_seconds: int = _DEFAULT_MARGIN_SECONDS,
) -> ChainFunction:
    """Refresh the session before a request when the token is near expiry.

    Skips requests that already carry an ``Authorization`` header and the token
    endpoint itself (to avoid recursively refreshing during a refresh).
    """
    # Runtime lazy import: refresh -> auth would close the import cycle at module
    # load time, so import it only when the middleware actually runs.
    from ..session.refresh import refresh_session  # noqa: PLC0415

    def chain(next_fetch: FetchFunction) -> FetchFunction:
        async def fetch(request: httpx.Request) -> httpx.Response:
            if "Authorization" not in request.headers and not request.url.path.endswith(
                "/v1/token"
            ):
                try:
                    await refresh_session(auth, storage, margin_seconds)
                except Exception:  # noqa: BLE001 - never block the request on refresh failure
                    logger.debug("session refresh failed; continuing", exc_info=True)
            return await next_fetch(request)

        return fetch

    return chain


def _extract_session(body: object) -> Session | None:
    if not isinstance(body, Mapping):
        return None
    if "session" in body:
        raw = body["session"]
        return Session.model_validate(raw) if raw else None
    if {"accessToken", "refreshToken", "user"} <= set(body):
        return Session.model_validate(body)
    return None


def update_session_from_response_middleware(storage: SessionStorage) -> ChainFunction:
    """Persist session data returned by auth endpoints, and clear it on sign-out.

    Handles ``/signout`` (remove), a successful ``/user/password`` change
    (remove, since the server revokes refresh tokens), and session-bearing
    responses from ``/token``, ``/token/exchange``, ``/signin/*`` and
    ``/signup/*``.
    """

    def chain(next_fetch: FetchFunction) -> FetchFunction:
        async def fetch(request: httpx.Request) -> httpx.Response:
            response = await next_fetch(request)
            try:
                path = request.url.path
                if path.endswith("/signout"):
                    storage.remove()
                    return response
                if path.endswith("/user/password") and response.is_success:
                    storage.remove()
                    return response
                if (
                    path.endswith("/token")
                    or "/token/exchange" in path
                    or "/signin/" in path
                    or "/signup/" in path
                ):
                    try:
                        body = response.json()
                    except (ValueError, UnicodeDecodeError):
                        body = None
                    session = _extract_session(body)
                    if session is not None and session.access_token and session.refresh_token:
                        storage.set(session)
            except Exception:  # noqa: BLE001 - middleware must not break the response
                logger.warning("error in session response middleware", exc_info=True)
            return response

        return fetch

    return chain


def with_role_middleware(role: str) -> ChainFunction:
    """Set ``x-hasura-role`` on requests that don't already specify it."""

    def chain(next_fetch: FetchFunction) -> FetchFunction:
        async def fetch(request: httpx.Request) -> httpx.Response:
            if "x-hasura-role" not in request.headers:
                request.headers["x-hasura-role"] = role
            return await next_fetch(request)

        return fetch

    return chain


def with_headers_middleware(default_headers: Mapping[str, str]) -> ChainFunction:
    """Attach default headers, preserving any request-specific values."""

    def chain(next_fetch: FetchFunction) -> FetchFunction:
        async def fetch(request: httpx.Request) -> httpx.Response:
            for key, value in default_headers.items():
                if key not in request.headers:
                    request.headers[key] = value
            return await next_fetch(request)

        return fetch

    return chain


@dataclass
class AdminSessionOptions:
    """Admin session configuration.

    **Security warning:** never use in untrusted/client code — the admin secret
    grants unrestricted database access.
    """

    admin_secret: str
    role: str | None = None
    session_variables: dict[str, str] = field(default_factory=dict)


def with_admin_session_middleware(options: AdminSessionOptions) -> ChainFunction:
    """Attach ``x-hasura-admin-secret`` and optional role/session variables."""

    def chain(next_fetch: FetchFunction) -> FetchFunction:
        async def fetch(request: httpx.Request) -> httpx.Response:
            headers = request.headers
            if "x-hasura-admin-secret" not in headers:
                headers["x-hasura-admin-secret"] = options.admin_secret
            if options.role and "x-hasura-role" not in headers:
                headers["x-hasura-role"] = options.role
            for key, value in options.session_variables.items():
                header = key if key.startswith("x-hasura-") else f"x-hasura-{key}"
                if header not in headers:
                    headers[header] = value
            return await next_fetch(request)

        return fetch

    return chain


__all__ = [
    "AdminSessionOptions",
    "attach_access_token_middleware",
    "session_refresh_middleware",
    "update_session_from_response_middleware",
    "with_admin_session_middleware",
    "with_headers_middleware",
    "with_role_middleware",
]
