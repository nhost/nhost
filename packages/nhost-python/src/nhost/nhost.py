"""Top-level Nhost client and factory functions."""

from __future__ import annotations

import re
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Any, Literal, cast

import httpx

from . import auth as auth_module
from . import functions as functions_module
from . import graphql as graphql_module
from . import storage as storage_module
from .fetch import (
    AdminSessionOptions,
    Middleware,
    attach_access_token_middleware,
    session_refresh_middleware,
    update_session_from_response_middleware,
    with_admin_session_middleware,
)
from .session import MemoryStorage, SessionStorage, SessionStorageBackend, StoredSession
from .session.refresh import refresh_session

ServiceType = Literal["auth", "storage", "graphql", "functions"]
ClientConfiguration = Callable[["ConfigureContext"], None]

_DEFAULT_REFRESH_MARGIN_SECONDS = 60
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


@dataclass(slots=True)
class ConfigureContext:
    """Clients and session storage passed to a configuration callback."""

    auth: auth_module.AuthClient
    refresh_auth: auth_module.AuthClient
    storage: storage_module.StorageClient
    graphql: graphql_module.Client
    functions: functions_module.Client
    session_storage: SessionStorage


def _attach_access_token_to_each_service(ctx: ConfigureContext) -> None:
    ctx.auth.add_middleware(attach_access_token_middleware(ctx.session_storage, ctx.auth.base_url))
    ctx.storage.add_middleware(
        attach_access_token_middleware(ctx.session_storage, ctx.storage.base_url)
    )
    ctx.graphql.add_middleware(
        attach_access_token_middleware(ctx.session_storage, ctx.graphql.base_url)
    )
    ctx.functions.add_middleware(
        attach_access_token_middleware(ctx.session_storage, ctx.functions.base_url)
    )


def with_client_side_session_middleware(ctx: ConfigureContext) -> None:
    """Enable automatic refresh, token attachment, and session capture."""
    _apply(
        ctx,
        [
            session_refresh_middleware(ctx.refresh_auth, ctx.session_storage),
            update_session_from_response_middleware(ctx.session_storage, ctx.auth.base_url),
        ],
    )
    _attach_access_token_to_each_service(ctx)


def with_server_side_session_middleware(ctx: ConfigureContext) -> None:
    """Enable token attachment and session capture without automatic refresh."""
    _apply(
        ctx,
        [update_session_from_response_middleware(ctx.session_storage, ctx.auth.base_url)],
    )
    _attach_access_token_to_each_service(ctx)


def with_admin_session(options: AdminSessionOptions) -> ClientConfiguration:
    """Apply admin credentials to Storage, GraphQL, and Functions requests.

    Never use an admin secret in client-side code.
    """

    def configure(ctx: ConfigureContext) -> None:
        ctx.storage.add_middleware(with_admin_session_middleware(options, ctx.storage.base_url))
        ctx.graphql.add_middleware(with_admin_session_middleware(options, ctx.graphql.base_url))
        ctx.functions.add_middleware(with_admin_session_middleware(options, ctx.functions.base_url))

    return configure


def with_middleware(middleware: Sequence[Middleware]) -> ClientConfiguration:
    """Apply custom HTTP middleware to every service client."""
    chain = list(middleware)

    def configure(ctx: ConfigureContext) -> None:
        _apply(ctx, chain)

    return configure


def _apply(ctx: ConfigureContext, chain: Sequence[Middleware]) -> None:
    for middleware in chain:
        ctx.auth.add_middleware(middleware)
        ctx.storage.add_middleware(middleware)
        ctx.graphql.add_middleware(middleware)
        ctx.functions.add_middleware(middleware)


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


class NhostClient:
    """Unified asynchronous access to Nhost services and session state."""

    def __init__(
        self,
        auth: auth_module.AuthClient,
        refresh_auth: auth_module.AuthClient,
        storage: storage_module.StorageClient,
        graphql: graphql_module.Client,
        functions: functions_module.Client,
        session_storage: SessionStorage,
        http_client: httpx.AsyncClient,
        *,
        owns_http: bool = True,
    ) -> None:
        self.auth = auth
        self._refresh_auth = refresh_auth
        self.storage = storage
        self.graphql = graphql
        self.functions = functions
        self.session_storage = session_storage
        self._http = http_client
        self._owns_http = owns_http

    async def get_session(self) -> StoredSession | None:
        """Return the current session, if one is stored."""
        return await self.session_storage.get()

    async def refresh_session(
        self, margin_seconds: int = _DEFAULT_REFRESH_MARGIN_SECONDS
    ) -> StoredSession | None:
        """Refresh the session when it is close to expiry."""
        return await refresh_session(self._refresh_auth, self.session_storage, margin_seconds)

    async def clear_session(self) -> None:
        """Remove the current session without making a sign-out request."""
        await self.session_storage.remove()

    async def aclose(self) -> None:
        """Close the internally owned HTTP connection pool, if any."""
        if self._owns_http:
            await self._http.aclose()

    async def __aenter__(self) -> NhostClient:
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.aclose()


def create_nhost_client(  # noqa: PLR0913 - explicit keyword API is intentional
    *,
    subdomain: str | None = None,
    region: str | None = None,
    auth_url: str | None = None,
    storage_url: str | None = None,
    graphql_url: str | None = None,
    functions_url: str | None = None,
    session_storage: SessionStorageBackend | None = None,
    http_client: httpx.AsyncClient | None = None,
    configure: Sequence[ClientConfiguration] = (),
    timeout: httpx.Timeout | float | None = _DEFAULT_HTTP_TIMEOUT,
) -> NhostClient:
    """Create a bare Nhost client from explicit keyword configuration.

    ``timeout`` applies to each SDK-built request, including when ``http_client``
    is supplied. A timeout set explicitly for one request takes precedence.
    """
    if (subdomain is None) != (region is None):
        raise ValueError("subdomain and region must be supplied together")

    backend = session_storage if session_storage is not None else MemoryStorage()
    sessions = SessionStorage(backend)
    http = http_client if http_client is not None else httpx.AsyncClient(timeout=timeout)
    request_http = (
        http
        if http_client is None
        else cast(httpx.AsyncClient, _PerRequestTimeoutClient(http, timeout))
    )
    resolved_auth_url = generate_service_url(
        "auth", subdomain=subdomain, region=region, custom_url=auth_url
    )

    auth = auth_module.AuthClient(resolved_auth_url, http_client=request_http)
    refresh_auth = auth_module.AuthClient(resolved_auth_url, http_client=request_http)
    storage = storage_module.StorageClient(
        generate_service_url("storage", subdomain=subdomain, region=region, custom_url=storage_url),
        http_client=request_http,
    )
    graphql = graphql_module.Client(
        generate_service_url("graphql", subdomain=subdomain, region=region, custom_url=graphql_url),
        http_client=request_http,
    )
    functions = functions_module.Client(
        generate_service_url(
            "functions", subdomain=subdomain, region=region, custom_url=functions_url
        ),
        http_client=request_http,
    )

    ctx = ConfigureContext(auth, refresh_auth, storage, graphql, functions, sessions)
    for configure_client in configure:
        configure_client(ctx)

    return NhostClient(
        auth,
        refresh_auth,
        storage,
        graphql,
        functions,
        sessions,
        http,
        owns_http=http_client is None,
    )


def create_client(  # noqa: PLR0913 - explicit keyword API is intentional
    *,
    subdomain: str | None = None,
    region: str | None = None,
    auth_url: str | None = None,
    storage_url: str | None = None,
    graphql_url: str | None = None,
    functions_url: str | None = None,
    session_storage: SessionStorageBackend | None = None,
    http_client: httpx.AsyncClient | None = None,
    configure: Sequence[ClientConfiguration] = (),
    timeout: httpx.Timeout | float | None = _DEFAULT_HTTP_TIMEOUT,
) -> NhostClient:
    """Create an application client with automatic session management.

    ``timeout`` applies to SDK requests even when ``http_client`` is supplied.

    >>> import asyncio, uuid
    >>> from nhost.auth import SignUpEmailPasswordRequest
    >>> async def main() -> str | None:
    ...     async with create_client(subdomain="local", region="local") as nhost:
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
    return create_nhost_client(
        subdomain=subdomain,
        region=region,
        auth_url=auth_url,
        storage_url=storage_url,
        graphql_url=graphql_url,
        functions_url=functions_url,
        session_storage=session_storage,
        http_client=http_client,
        configure=(*configure, with_client_side_session_middleware),
        timeout=timeout,
    )


def create_server_client(  # noqa: PLR0913 - explicit keyword API is intentional
    *,
    session_storage: SessionStorageBackend,
    subdomain: str | None = None,
    region: str | None = None,
    auth_url: str | None = None,
    storage_url: str | None = None,
    graphql_url: str | None = None,
    functions_url: str | None = None,
    http_client: httpx.AsyncClient | None = None,
    configure: Sequence[ClientConfiguration] = (),
    timeout: httpx.Timeout | float | None = _DEFAULT_HTTP_TIMEOUT,
) -> NhostClient:
    """Create a server client with explicit per-user session storage.

    ``timeout`` applies to SDK requests even when ``http_client`` is supplied.
    """
    return create_nhost_client(
        subdomain=subdomain,
        region=region,
        auth_url=auth_url,
        storage_url=storage_url,
        graphql_url=graphql_url,
        functions_url=functions_url,
        session_storage=session_storage,
        http_client=http_client,
        configure=(*configure, with_server_side_session_middleware),
        timeout=timeout,
    )
