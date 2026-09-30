"""The Nhost client."""

from __future__ import annotations

import copy
import re
from collections.abc import Sequence
from typing import Any, Literal, cast

import httpx

from . import auth as auth_module
from . import functions as functions_module
from . import graphql as graphql_module
from . import storage as storage_module
from .fetch import (
    AdminSessionOptions,
    Middleware,
    SessionScope,
    attach_access_token_middleware,
    session_refresh_middleware,
    session_scope_middleware,
    update_session_from_response_middleware,
    with_admin_session_middleware,
)
from .session import (
    DEFAULT_REFRESH_MARGIN_SECONDS,
    MultiUserSessionStore,
    NoSessionStoreError,
    SessionManager,
    SessionStore,
    StoredSession,
)

ServiceType = Literal["auth", "storage", "graphql", "functions"]

_DEFAULT_HTTP_TIMEOUT = httpx.Timeout(connect=10.0, read=300.0, write=300.0, pool=60.0)
_CLOUD_HOST_LABEL = re.compile(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?")


def _validate_cloud_host_label(name: str, value: str) -> None:
    if _CLOUD_HOST_LABEL.fullmatch(value) is None:
        raise ValueError(
            f"{name} must be a valid DNS label: 1-63 ASCII letters, digits, or hyphens, "
            "starting and ending with a letter or digit"
        )


def generate_service_url(
    service_type: ServiceType,
    *,
    subdomain: str | None = None,
    region: str | None = None,
    custom_url: str | None = None,
) -> str:
    """Build a normalized service URL.

    An explicit ``custom_url`` takes precedence. Otherwise ``subdomain`` and
    ``region`` must be supplied together; omitting both selects the local Nhost
    development URL.

    >>> generate_service_url("auth", subdomain="demo", region="eu-central-1")
    'https://demo.auth.eu-central-1.nhost.run/v1'
    >>> generate_service_url("graphql")
    'https://local.graphql.local.nhost.run/v1'
    >>> generate_service_url("functions", custom_url="http://localhost:1337/v1/")
    'http://localhost:1337/v1'
    """
    if custom_url is not None:
        try:
            parsed = httpx.URL(custom_url)
        except httpx.InvalidURL as error:
            raise ValueError(f"invalid custom URL for {service_type}: {error}") from error
        if parsed.scheme not in {"http", "https"} or not parsed.host or parsed.userinfo:
            raise ValueError(
                f"custom URL for {service_type} must supply an explicit HTTP or HTTPS scheme, "
                "include a host, and omit user information"
            )
        return str(parsed).rstrip("/")

    if subdomain is not None:
        _validate_cloud_host_label("subdomain", subdomain)
    if region is not None:
        _validate_cloud_host_label("region", region)
    if (subdomain is None) != (region is None):
        raise ValueError("subdomain and region must be supplied together")
    if subdomain is None:
        return f"https://local.{service_type}.local.nhost.run/v1"
    return f"https://{subdomain}.{service_type}.{region}.nhost.run/v1"


class _PerRequestTimeoutClient:
    """Apply an SDK timeout while delegating transport ownership to another client."""

    def __init__(
        self,
        client: httpx.AsyncClient,
        timeout: httpx.Timeout | float | None,
    ) -> None:
        self._client = client
        self._timeout = timeout

    def build_request(self, *args: Any, **kwargs: Any) -> httpx.Request:
        kwargs.setdefault("timeout", self._timeout)
        return self._client.build_request(*args, **kwargs)

    async def send(self, request: httpx.Request, **kwargs: Any) -> httpx.Response:
        return await self._client.send(request, **kwargs)


class Nhost:
    """Asynchronous access to Nhost's Auth, Storage, GraphQL and Functions services.

    Every argument is a keyword. Services are addressed by ``subdomain`` and
    ``region`` (together), by an explicit ``*_url`` per service, or, with
    neither, by the local development environment.

    A client manages sessions only when given a store: ``session_store`` for a
    client acting for one user (a CLI, a script, a test), or
    ``multi_user_session_store`` for a server acting for many, which says which
    user each request is for with :meth:`with_user_id`. Its requests then get the
    stored access token, refreshed before it expires, and sign-in and sign-out
    responses update the store. Without a store, requests carry no user token
    unless the caller supplies one with :meth:`with_access_token`.

    ``admin`` sends an admin secret to Storage, GraphQL and Functions. It cannot
    be combined with a session store or a caller's token, because the GraphQL
    engine lets the admin secret override the user's token; use a separate
    client for each, or set a role and session variables in
    :class:`AdminSessionOptions`. Never use an admin secret in client-side code.

    ``middleware`` runs on every service request before the SDK's own, in list
    order. ``timeout`` applies to each SDK-built request, including when
    ``http_client`` is supplied; a timeout set explicitly for one request takes
    precedence. A supplied ``http_client`` is left open by :meth:`aclose`.

    >>> import asyncio, uuid
    >>> from nhost.auth import SignUpEmailPasswordRequest
    >>> from nhost.session import MemoryStore
    >>> async def main() -> str | None:
    ...     async with Nhost(
    ...         subdomain="local", region="local", session_store=MemoryStore()
    ...     ) as nhost:
    ...         await nhost.auth.sign_up_email_password(
    ...             body=SignUpEmailPasswordRequest(
    ...                 email=f"ada-{uuid.uuid4()}@example.com",
    ...                 password=str(uuid.uuid4()),
    ...             )
    ...         )
    ...         session = await nhost.get_session()
    ...         return (session.decoded_token.hasura_claims or {}).get(
    ...             "x-hasura-default-role"
    ...         )
    >>> asyncio.run(main())
    'user'
    """

    auth: auth_module.AuthClient
    storage: storage_module.StorageClient
    graphql: graphql_module.Client
    functions: functions_module.Client

    def __init__(  # noqa: PLR0913 - explicit keyword API is intentional
        self,
        *,
        subdomain: str | None = None,
        region: str | None = None,
        auth_url: str | None = None,
        storage_url: str | None = None,
        graphql_url: str | None = None,
        functions_url: str | None = None,
        session_store: SessionStore | None = None,
        multi_user_session_store: MultiUserSessionStore | None = None,
        admin: AdminSessionOptions | None = None,
        middleware: Sequence[Middleware] = (),
        http_client: httpx.AsyncClient | None = None,
        timeout: httpx.Timeout | float | None = _DEFAULT_HTTP_TIMEOUT,
    ) -> None:
        if (subdomain is None) != (region is None):
            raise ValueError("subdomain and region must be supplied together")
        if session_store is not None and multi_user_session_store is not None:
            raise ValueError("pass session_store or multi_user_session_store, not both")
        sessions = (
            None
            if session_store is None and multi_user_session_store is None
            else SessionManager(
                session_store=session_store, multi_user_session_store=multi_user_session_store
            )
        )
        if admin is not None and sessions is not None:
            raise ValueError(
                "an admin secret cannot be combined with a session store: the GraphQL "
                "engine lets the admin secret override the user's token"
            )

        def url(service: ServiceType, custom_url: str | None) -> str:
            return generate_service_url(
                service, subdomain=subdomain, region=region, custom_url=custom_url
            )

        http = http_client if http_client is not None else httpx.AsyncClient(timeout=timeout)
        request_http = (
            http
            if http_client is None
            else cast(httpx.AsyncClient, _PerRequestTimeoutClient(http, timeout))
        )
        resolved_auth_url = url("auth", auth_url)

        # The refresh client has no middleware of its own, so a refresh is never
        # seen, retried or captured by anything but the session manager.
        self._refresh_auth = auth_module.AuthClient(resolved_auth_url, http_client=request_http)
        services: tuple[
            auth_module.AuthClient,
            storage_module.StorageClient,
            graphql_module.Client,
            functions_module.Client,
        ] = (
            auth_module.AuthClient(resolved_auth_url, http_client=request_http),
            storage_module.StorageClient(url("storage", storage_url), http_client=request_http),
            graphql_module.Client(url("graphql", graphql_url), http_client=request_http),
            functions_module.Client(url("functions", functions_url), http_client=request_http),
        )
        for service in services:
            for custom in middleware:
                service.add_middleware(custom)
            if admin is not None and service is not services[0]:
                service.add_middleware(with_admin_session_middleware(admin, service.base_url))
            if sessions is not None:
                service.add_middleware(session_refresh_middleware(self._refresh_auth, sessions))
                service.add_middleware(
                    update_session_from_response_middleware(sessions, resolved_auth_url)
                )
            service.add_middleware(attach_access_token_middleware(sessions, service.base_url))

        self._unscoped = services
        self._scope = SessionScope()
        self._sessions = sessions
        self._admin = admin is not None
        self._http = http
        self._owns_http = http_client is None
        self.auth, self.storage, self.graphql, self.functions = services

    def with_user_id(self, user_id: str) -> Nhost:
        """Return a handle whose requests use the stored session of ``user_id``.

        It is how a server built with ``multi_user_session_store`` says which
        user a request is for. The handle shares this client's connection pool,
        configuration and sessions; closing it closes nothing.

        ``user_id`` must come from something the caller has already verified,
        such as its own authenticated cookie session. Never take it from an
        access token a client sent: the SDK does not verify its claims, so a
        forged token could select another user's stored session.

        Without a user ID, a request uses the one session of a
        :class:`~nhost.session.SessionStore` and no session of a
        :class:`~nhost.session.MultiUserSessionStore`. With one, a
        :class:`~nhost.session.SessionStore`'s session is used only if it is
        that user's.
        """
        return self._scoped(SessionScope(user_id=user_id, access_token=self._scope.access_token))

    def with_access_token(self, access_token: str) -> Nhost:
        """Return a handle whose requests authenticate with ``access_token``.

        For a server acting on behalf of a caller that sent its own token. The
        token is attached as-is: it is never stored, refreshed or replaced by a
        session from a response, and the client's session store is left alone.
        The handle shares this client's connection pool and configuration;
        closing it closes nothing.

        Raises :class:`ValueError` on a client with an admin secret, because
        the GraphQL engine would let the admin secret override the token.
        """
        if self._admin:
            raise ValueError(
                "a caller's access token cannot be used on a client with an admin secret: "
                "the GraphQL engine lets the admin secret override it"
            )
        return self._scoped(SessionScope(user_id=self._scope.user_id, access_token=access_token))

    def _scoped(self, scope: SessionScope) -> Nhost:
        handle = copy.copy(self)
        handle._scope = scope
        handle._owns_http = False
        scope_middleware = session_scope_middleware(scope)
        auth, storage, graphql, functions = self._unscoped
        handle.auth = auth.with_middleware(scope_middleware)
        handle.storage = storage.with_middleware(scope_middleware)
        handle.graphql = graphql.with_middleware(scope_middleware)
        handle.functions = functions.with_middleware(scope_middleware)
        return handle

    @property
    def session_manager(self) -> SessionManager | None:
        """The sessions this client and its middleware share, if it has a store."""
        return self._sessions

    def _session_manager(self) -> SessionManager:
        if self._sessions is None:
            raise NoSessionStoreError
        return self._sessions

    async def get_session(self) -> StoredSession | None:
        """Return the stored session this handle selects, if any.

        Raises :class:`~nhost.session.NoSessionStoreError` on a client without
        a session store, and :class:`~nhost.session.SessionStoreError` if the
        store cannot be read.
        """
        return await self._session_manager().get(self._scope.user_id)

    async def refresh_session(
        self, margin_seconds: int = DEFAULT_REFRESH_MARGIN_SECONDS
    ) -> StoredSession | None:
        """Refresh the session this handle selects if it expires within the margin.

        See :meth:`~nhost.session.SessionManager.refresh`.
        """
        return await self._session_manager().refresh(
            self._refresh_auth, user_id=self._scope.user_id, margin_seconds=margin_seconds
        )

    async def clear_session(self) -> None:
        """Remove the session this handle selects, without a sign-out request."""
        await self._session_manager().remove(self._scope.user_id)

    async def aclose(self) -> None:
        """Close the internally owned HTTP connection pool, if any.

        A handle from :meth:`with_user_id` or :meth:`with_access_token` owns
        nothing, so closing one does nothing.
        """
        if self._owns_http:
            await self._http.aclose()

    async def __aenter__(self) -> Nhost:
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.aclose()
