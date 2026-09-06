"""Top-level Nhost client and factory functions."""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Literal

import httpx

from . import auth as auth_module
from . import functions as functions_module
from . import graphql as graphql_module
from . import storage as storage_module
from .fetch import (
    AdminSessionOptions,
    ChainFunction,
    attach_access_token_middleware,
    session_refresh_middleware,
    update_session_from_response_middleware,
    with_admin_session_middleware,
)
from .session import SessionStorage, SessionStorageBackend, StoredSession, detect_storage
from .session.refresh import refresh_session

ServiceType = Literal["auth", "storage", "graphql", "functions"]
ClientConfiguration = Callable[["ConfigureContext"], None]

_DEFAULT_REFRESH_MARGIN_SECONDS = 60
_DEFAULT_HTTP_TIMEOUT = httpx.Timeout(connect=10.0, read=300.0, write=300.0, pool=60.0)


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
    """
    if custom_url is not None:
        normalized = custom_url.rstrip("/")
        if not normalized:
            raise ValueError("custom_url must not be empty")
        return normalized
    if (subdomain is None) != (region is None):
        raise ValueError("subdomain and region must be supplied together")
    if subdomain is None:
        return f"https://local.{service_type}.local.nhost.run/v1"
    if not subdomain or not region:
        raise ValueError("subdomain and region must not be empty")
    return f"https://{subdomain}.{service_type}.{region}.nhost.run/v1"


@dataclass(slots=True)
class ConfigureContext:
    """Clients and session storage passed to a configuration callback."""

    auth: auth_module.AuthClient
    storage: storage_module.StorageClient
    graphql: graphql_module.Client
    functions: functions_module.Client
    session_storage: SessionStorage


def with_client_side_session_middleware(ctx: ConfigureContext) -> None:
    """Enable automatic refresh, token attachment, and session capture."""
    _apply(
        ctx,
        [
            session_refresh_middleware(ctx.auth, ctx.session_storage),
            update_session_from_response_middleware(ctx.session_storage, ctx.auth.base_url),
            attach_access_token_middleware(ctx.session_storage),
        ],
    )


def with_server_side_session_middleware(ctx: ConfigureContext) -> None:
    """Enable token attachment and session capture without automatic refresh."""
    _apply(
        ctx,
        [
            update_session_from_response_middleware(ctx.session_storage, ctx.auth.base_url),
            attach_access_token_middleware(ctx.session_storage),
        ],
    )


def with_admin_session(options: AdminSessionOptions) -> ClientConfiguration:
    """Apply admin credentials to Storage, GraphQL, and Functions requests.

    Never use an admin secret in client-side code.
    """

    def configure(ctx: ConfigureContext) -> None:
        ctx.storage.add_middleware(with_admin_session_middleware(options, ctx.storage.base_url))
        ctx.graphql.add_middleware(with_admin_session_middleware(options, ctx.graphql.url))
        ctx.functions.add_middleware(with_admin_session_middleware(options, ctx.functions.base_url))

    return configure


def with_chain_functions(chain_functions: Sequence[ChainFunction]) -> ClientConfiguration:
    """Apply custom HTTP middleware to every service client."""
    chain = list(chain_functions)

    def configure(ctx: ConfigureContext) -> None:
        _apply(ctx, chain)

    return configure


def _apply(ctx: ConfigureContext, chain: Sequence[ChainFunction]) -> None:
    for middleware in chain:
        ctx.auth.add_middleware(middleware)
        ctx.storage.add_middleware(middleware)
        ctx.graphql.add_middleware(middleware)
        ctx.functions.add_middleware(middleware)


class NhostClient:
    """Unified asynchronous access to Nhost services and session state."""

    def __init__(
        self,
        auth: auth_module.AuthClient,
        storage: storage_module.StorageClient,
        graphql: graphql_module.Client,
        functions: functions_module.Client,
        session_storage: SessionStorage,
        http_client: httpx.AsyncClient,
        *,
        owns_http: bool = True,
    ) -> None:
        self.auth = auth
        self.storage = storage
        self.graphql = graphql
        self.functions = functions
        self.session_storage = session_storage
        self._http = http_client
        self._owns_http = owns_http

    async def get_user_session(self) -> StoredSession | None:
        """Return the current session, if one is stored."""
        return await self.session_storage.get()

    async def refresh_session(
        self, margin_seconds: int = _DEFAULT_REFRESH_MARGIN_SECONDS
    ) -> StoredSession | None:
        """Refresh the session when it is close to expiry."""
        return await refresh_session(self.auth, self.session_storage, margin_seconds)

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
    """Create a bare Nhost client from explicit keyword configuration."""
    if (subdomain is None) != (region is None):
        raise ValueError("subdomain and region must be supplied together")

    backend = session_storage if session_storage is not None else detect_storage()
    sessions = SessionStorage(backend)
    http = http_client if http_client is not None else httpx.AsyncClient(timeout=timeout)

    auth = auth_module.AuthClient(
        generate_service_url("auth", subdomain=subdomain, region=region, custom_url=auth_url),
        http_client=http,
    )
    storage = storage_module.StorageClient(
        generate_service_url("storage", subdomain=subdomain, region=region, custom_url=storage_url),
        http_client=http,
    )
    graphql = graphql_module.create_api_client(
        generate_service_url("graphql", subdomain=subdomain, region=region, custom_url=graphql_url),
        http_client=http,
    )
    functions = functions_module.create_api_client(
        generate_service_url(
            "functions", subdomain=subdomain, region=region, custom_url=functions_url
        ),
        http_client=http,
    )

    ctx = ConfigureContext(auth, storage, graphql, functions, sessions)
    for configure_client in configure:
        configure_client(ctx)

    return NhostClient(
        auth,
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
    ...         session = await nhost.get_user_session()
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
        configure=(with_client_side_session_middleware, *configure),
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
    """Create a server client with explicit per-user session storage."""
    return create_nhost_client(
        subdomain=subdomain,
        region=region,
        auth_url=auth_url,
        storage_url=storage_url,
        graphql_url=graphql_url,
        functions_url=functions_url,
        session_storage=session_storage,
        http_client=http_client,
        configure=(with_server_side_session_middleware, *configure),
        timeout=timeout,
    )
