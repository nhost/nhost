"""Fetch middleware (chain functions) for the Nhost Python SDK.

Each middleware wraps the next fetch in the chain and may mutate the outgoing
:class:`httpx.Request` headers and/or inspect the :class:`httpx.Response`. This
mirrors the middleware set in ``@nhost/nhost-js``'s ``fetch`` module.
"""

from __future__ import annotations

import ipaddress
import logging
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

import httpx
from pydantic import ValidationError

from . import FetchFunction, Middleware

if TYPE_CHECKING:
    from ..auth.client import Client as AuthClient
    from ..auth.client import Session
    from ..session.manager import SessionManager

logger = logging.getLogger("nhost.fetch")

_DEFAULT_MARGIN_SECONDS = 60


@dataclass(frozen=True)
class _RequestScope:
    scheme: str
    host: str
    path_prefix: str

    @classmethod
    def from_base_url(cls, base_url: str) -> _RequestScope:
        parsed = httpx.URL(base_url)
        return cls(
            scheme=parsed.scheme.casefold(),
            host=parsed.netloc.decode("ascii").casefold(),
            path_prefix=parsed.path.rstrip("/"),
        )

    def contains(self, url: httpx.URL) -> bool:
        return (
            url.scheme.casefold() == self.scheme
            and url.netloc.decode("ascii").casefold() == self.host
        )

    def permits_admin_session(self, url: httpx.URL, allow_insecure_http: bool) -> bool:
        return self.contains(url) and (
            url.scheme.casefold() == "https" or allow_insecure_http or _is_loopback_host(url.host)
        )


def _is_loopback_host(host: str) -> bool:
    if host.casefold() == "localhost":
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


@dataclass(frozen=True, slots=True)
class SessionScope:
    """Which session a request acts with, as a scoped ``Nhost`` handle chose it.

    It travels in the request's extensions, so every middleware sees the same
    choice. ``access_token`` is a token the caller supplied: it is attached
    as-is and never stored, refreshed or replaced by a session from the
    response.
    """

    user_id: str | None = None
    access_token: str | None = None

    @classmethod
    def of(cls, request: httpx.Request) -> SessionScope:
        scope = request.extensions.get(_SCOPE_EXTENSION)
        return scope if isinstance(scope, SessionScope) else _NO_SCOPE


_SCOPE_EXTENSION = "nhost.session_scope"
_NO_SCOPE = SessionScope()


def session_scope_middleware(scope: SessionScope) -> Middleware:
    """Record ``scope`` on each request. Installed first on a scoped handle."""

    def chain(next_fetch: FetchFunction) -> FetchFunction:
        async def fetch(request: httpx.Request) -> httpx.Response:
            request.extensions[_SCOPE_EXTENSION] = scope
            return await next_fetch(request)

        return fetch

    return chain


def attach_access_token_middleware(sessions: SessionManager | None, service_url: str) -> Middleware:
    """Attach the request's access token only within the configured service origin.

    The token is the caller's own (``Nhost.with_access_token``), or else that of
    the stored session the request selects (``Nhost.with_user_id``). Should run
    after the refresh middleware so the freshest token is used. A caller-supplied
    authorization header is preserved unless it is that token on a request that
    has moved outside the service origin. If the session store cannot be read,
    the request fails with :class:`~nhost.session.SessionStoreError`.
    """
    scope = _RequestScope.from_base_url(service_url)

    async def token_for(request: httpx.Request) -> str | None:
        session_scope = SessionScope.of(request)
        if session_scope.access_token is not None:
            return session_scope.access_token
        if sessions is None:
            return None
        session = await sessions.get(session_scope.user_id)
        return session.access_token if session is not None and session.access_token else None

    def chain(next_fetch: FetchFunction) -> FetchFunction:
        async def fetch(request: httpx.Request) -> httpx.Response:
            in_scope = scope.contains(request.url)
            has_authorization = "Authorization" in request.headers
            if (in_scope and has_authorization) or (not in_scope and not has_authorization):
                return await next_fetch(request)

            token = await token_for(request)
            if token is None:
                return await next_fetch(request)

            authorization = f"Bearer {token}"
            if in_scope:
                request.headers["Authorization"] = authorization
            elif request.headers.get("Authorization") == authorization:
                del request.headers["Authorization"]
            return await next_fetch(request)

        return fetch

    return chain


def session_refresh_middleware(
    auth: AuthClient,
    sessions: SessionManager,
    margin_seconds: int = _DEFAULT_MARGIN_SECONDS,
) -> Middleware:
    """Refresh the request's session before sending when its token is near expiry.

    Skips requests that already carry an ``Authorization`` header or a caller's
    own token, and the token endpoint itself (to avoid recursively refreshing
    during a refresh). ``auth`` must be an auth client without session
    middleware. A refresh that fails leaves the request to go out with the
    session it has; a session store that fails fails the request.
    """
    auth_scope = _RequestScope.from_base_url(auth.base_url)
    auth_token_path = f"{auth_scope.path_prefix}/token"

    def chain(next_fetch: FetchFunction) -> FetchFunction:
        async def fetch(request: httpx.Request) -> httpx.Response:
            session_scope = SessionScope.of(request)
            is_auth_token_request = (
                auth_scope.contains(request.url) and request.url.path == auth_token_path
            )
            if (
                session_scope.access_token is None
                and "Authorization" not in request.headers
                and not is_auth_token_request
            ):
                await sessions.refresh(
                    auth, user_id=session_scope.user_id, margin_seconds=margin_seconds
                )
            return await next_fetch(request)

        return fetch

    return chain


def _extract_session(body: object) -> Session | None:
    from ..auth.client import Session  # noqa: PLC0415

    if not isinstance(body, Mapping):
        return None
    # A body the auth client cannot decode fails there, as ResponseDecodeError.
    try:
        if "session" in body:
            raw = body["session"]
            return Session.model_validate(raw) if raw else None
        # No explicit ``session`` wrapper: the body may itself be a raw session
        # (e.g. a direct ``/token`` refresh response). We can't key off ``user``
        # being present — the Go auth service serialises it with ``omitempty``
        # and omits the field entirely when the user has no profile — so let
        # pydantic validate the required fields instead.
        return Session.model_validate(body)
    except ValidationError:
        return None


def update_session_from_response_middleware(sessions: SessionManager, auth_url: str) -> Middleware:
    """Store session data returned by auth endpoints, and clear it on sign-out.

    Handles ``/signout`` (remove), a successful ``/user/password`` change
    (remove, since the server revokes refresh tokens), and session-bearing
    responses from ``/token``, ``/token/exchange``, ``/signin/*`` and
    ``/signup/*`` under the configured auth origin and path prefix. Sessions
    are stored under the user they are for; a sign-out removes the session the
    request selects. Requests made with a caller's own token leave the store
    alone. If the store cannot be updated, the request fails with
    :class:`~nhost.session.SessionStoreError` rather than reporting a sign-in or
    sign-out that did not stick.
    """
    auth_scope = _RequestScope.from_base_url(auth_url)
    prefix = auth_scope.path_prefix

    def chain(next_fetch: FetchFunction) -> FetchFunction:
        async def fetch(request: httpx.Request) -> httpx.Response:
            response = await next_fetch(request)
            session_scope = SessionScope.of(request)
            if session_scope.access_token is not None or not auth_scope.contains(request.url):
                return response

            path = request.url.path
            if path == f"{prefix}/signout" or (
                path == f"{prefix}/user/password" and response.is_success
            ):
                await sessions.remove(session_scope.user_id)
                return response

            is_session_response = (
                path == f"{prefix}/token"
                or path.startswith(f"{prefix}/token/exchange")
                or path.startswith(f"{prefix}/signin/")
                or path.startswith(f"{prefix}/signup/")
            )
            if is_session_response and response.is_success:
                try:
                    body = response.json()
                except (ValueError, UnicodeDecodeError):
                    body = None
                session = _extract_session(body)
                if session is not None and session.access_token and session.refresh_token:
                    await sessions.set(session)
            return response

        return fetch

    return chain


def with_role_middleware(role: str) -> Middleware:
    """Set ``x-hasura-role`` on requests that don't already specify it."""

    def chain(next_fetch: FetchFunction) -> FetchFunction:
        async def fetch(request: httpx.Request) -> httpx.Response:
            if "x-hasura-role" not in request.headers:
                request.headers["x-hasura-role"] = role
            return await next_fetch(request)

        return fetch

    return chain


def with_headers_middleware(default_headers: Mapping[str, str]) -> Middleware:
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

    secret: str
    role: str | None = None
    session_variables: dict[str, str] = field(default_factory=dict)
    allow_insecure_http: bool = False


def with_admin_session_middleware(options: AdminSessionOptions, service_url: str) -> Middleware:
    """Attach admin headers only within the configured secure service origin."""
    scope = _RequestScope.from_base_url(service_url)

    def chain(next_fetch: FetchFunction) -> FetchFunction:
        async def fetch(request: httpx.Request) -> httpx.Response:
            if not scope.permits_admin_session(request.url, options.allow_insecure_http):
                logger.warning(
                    "admin session headers withheld from request",
                    extra={"host": request.url.netloc.decode("ascii")},
                )
                return await next_fetch(request)

            headers = request.headers
            if "x-hasura-admin-secret" not in headers:
                headers["x-hasura-admin-secret"] = options.secret
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
    "SessionScope",
    "attach_access_token_middleware",
    "session_refresh_middleware",
    "session_scope_middleware",
    "update_session_from_response_middleware",
    "with_admin_session_middleware",
    "with_headers_middleware",
    "with_role_middleware",
]
