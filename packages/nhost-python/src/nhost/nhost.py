"""Top-level Nhost client and factory functions.

``NhostClient`` bundles the auth, storage, graphql, and functions clients over a
shared :class:`httpx.AsyncClient` and a :class:`SessionStorage`. Use
:func:`create_client` for app clients (automatic refresh + token attachment),
:func:`create_server_client` for trusted server contexts with explicit storage,
and :func:`create_nhost_client` for a bare client you configure yourself.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field, replace
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

_DEFAULT_REFRESH_MARGIN_SECONDS = 60


def generate_service_url(
    service_type: ServiceType,
    subdomain: str | None = None,
    region: str | None = None,
    custom_url: str | None = None,
) -> str:
    """Build the base URL for an Nhost service.

    Precedence: an explicit ``custom_url`` wins; otherwise a cloud URL is built
    from ``subdomain``/``region``; otherwise the local development URL is used.

    >>> generate_service_url("auth", subdomain="demo", region="eu-central-1")
    'https://demo.auth.eu-central-1.nhost.run/v1'
    >>> generate_service_url("graphql")
    'https://local.graphql.local.nhost.run/v1'
    >>> generate_service_url("storage", custom_url="http://localhost:1337/v1/storage")
    'http://localhost:1337/v1/storage'
    """
    if custom_url:
        return custom_url
    if subdomain and region:
        return f"https://{subdomain}.{service_type}.{region}.nhost.run/v1"
    return f"https://local.{service_type}.local.nhost.run/v1"


@dataclass
class ConfigureContext:
    """The set of clients passed to a configuration function."""

    auth: auth_module.Client
    storage: storage_module.Client
    graphql: graphql_module.Client
    functions: functions_module.Client
    session_storage: SessionStorage


ClientConfigurationFn = Callable[[ConfigureContext], None]


def with_client_side_session_middleware(ctx: ConfigureContext) -> None:
    """Automatic session refresh, token attachment, and session capture."""
    chain: list[ChainFunction] = [
        session_refresh_middleware(ctx.auth, ctx.session_storage),
        update_session_from_response_middleware(ctx.session_storage),
        attach_access_token_middleware(ctx.session_storage),
    ]
    _apply(ctx, chain)


def with_server_side_session_middleware(ctx: ConfigureContext) -> None:
    """Token attachment and session capture, but no automatic refresh."""
    chain: list[ChainFunction] = [
        update_session_from_response_middleware(ctx.session_storage),
        attach_access_token_middleware(ctx.session_storage),
    ]
    _apply(ctx, chain)


def with_admin_session(options: AdminSessionOptions) -> ClientConfigurationFn:
    """Apply admin-secret middleware to storage, graphql, and functions.

    **Security warning:** never use in client-side code.
    """

    def configure(ctx: ConfigureContext) -> None:
        middleware = with_admin_session_middleware(options)
        ctx.storage.push_chain_function(middleware)
        ctx.graphql.push_chain_function(middleware)
        ctx.functions.push_chain_function(middleware)

    return configure


def with_chain_functions(chain_functions: list[ChainFunction]) -> ClientConfigurationFn:
    """Apply arbitrary chain functions to all four clients."""

    def configure(ctx: ConfigureContext) -> None:
        _apply(ctx, chain_functions)

    return configure


def _apply(ctx: ConfigureContext, chain: list[ChainFunction]) -> None:
    for middleware in chain:
        ctx.auth.push_chain_function(middleware)
        ctx.storage.push_chain_function(middleware)
        ctx.graphql.push_chain_function(middleware)
        ctx.functions.push_chain_function(middleware)


class NhostClient:
    """Unified access to Nhost auth, storage, graphql, and functions."""

    def __init__(
        self,
        auth: auth_module.Client,
        storage: storage_module.Client,
        graphql: graphql_module.Client,
        functions: functions_module.Client,
        session_storage: SessionStorage,
        http_client: httpx.AsyncClient,
        owns_http: bool = True,
    ) -> None:
        self.auth = auth
        self.storage = storage
        self.graphql = graphql
        self.functions = functions
        self.session_storage = session_storage
        self._http = http_client
        self._owns_http = owns_http

    def get_user_session(self) -> StoredSession | None:
        """Return the current session from storage, or ``None``."""
        return self.session_storage.get()

    async def refresh_session(
        self, margin_seconds: int = _DEFAULT_REFRESH_MARGIN_SECONDS
    ) -> StoredSession | None:
        """Refresh the session using the stored refresh token."""
        return await refresh_session(self.auth, self.session_storage, margin_seconds)

    def clear_session(self) -> None:
        """Remove the current session from storage (client-side sign-out)."""
        self.session_storage.remove()

    async def aclose(self) -> None:
        """Close the shared HTTP client and its connection pool.

        A caller-supplied ``http_client`` (via ``NhostClientOptions``) is left
        open — the SDK only closes the client it created itself.
        """
        if self._owns_http:
            await self._http.aclose()

    async def __aenter__(self) -> NhostClient:
        return self

    async def __aexit__(self, *_exc: object) -> None:
        await self.aclose()


@dataclass
class NhostClientOptions:
    """Configuration for creating an Nhost client."""

    subdomain: str | None = None
    region: str | None = None
    auth_url: str | None = None
    storage_url: str | None = None
    graphql_url: str | None = None
    functions_url: str | None = None
    storage: SessionStorageBackend | None = None
    http_client: httpx.AsyncClient | None = None
    configure: list[ClientConfigurationFn] = field(default_factory=list)


def create_nhost_client(options: NhostClientOptions | None = None) -> NhostClient:
    """Create and configure an Nhost client, applying ``options.configure``."""
    options = options or NhostClientOptions()

    backend = options.storage if options.storage is not None else detect_storage()
    session_storage = SessionStorage(backend)
    http = options.http_client if options.http_client is not None else httpx.AsyncClient()

    auth = auth_module.create_api_client(
        generate_service_url("auth", options.subdomain, options.region, options.auth_url),
        [],
        http,
    )
    storage = storage_module.create_api_client(
        generate_service_url("storage", options.subdomain, options.region, options.storage_url),
        [],
        http,
    )
    graphql = graphql_module.create_api_client(
        generate_service_url("graphql", options.subdomain, options.region, options.graphql_url),
        [],
        http,
    )
    functions = functions_module.create_api_client(
        generate_service_url("functions", options.subdomain, options.region, options.functions_url),
        [],
        http,
    )

    ctx = ConfigureContext(auth, storage, graphql, functions, session_storage)
    for configure in options.configure:
        configure(ctx)

    return NhostClient(
        auth,
        storage,
        graphql,
        functions,
        session_storage,
        http,
        owns_http=options.http_client is None,
    )


def create_client(options: NhostClientOptions | None = None) -> NhostClient:
    """Create an app client with automatic refresh + token attachment.

    This example runs against a local Nhost backend (``./dev-env.sh up``); it is
    skipped unless ``NHOST_LOCAL_BACKEND=1``. It signs a new user up, then reads
    the default role from the decoded access token.

    >>> import asyncio, uuid
    >>> from nhost.auth import SignUpEmailPasswordRequest
    >>>
    >>> async def main() -> str | None:
    ...     async with create_client(
    ...         NhostClientOptions(subdomain="local", region="local")
    ...     ) as nhost:
    ...         email = f"ada-{uuid.uuid4()}@example.com"
    ...         await nhost.auth.sign_up_email_password(
    ...             SignUpEmailPasswordRequest(email=email, password=str(uuid.uuid4()))
    ...         )
    ...         stored = nhost.get_user_session()
    ...         claims = stored.decoded_token.hasura_claims or {}
    ...         return claims.get("x-hasura-default-role")
    >>>
    >>> asyncio.run(main())
    'user'
    """
    options = options or NhostClientOptions()
    merged = replace(options, configure=[with_client_side_session_middleware, *options.configure])
    return create_nhost_client(merged)


def create_server_client(options: NhostClientOptions) -> NhostClient:
    """Create a server client with explicit storage and no automatic refresh.

    Requires ``options.storage`` — sharing a process-wide session store between
    users can leak tokens across requests, so pass a per-request/user backend.
    """
    if options.storage is None:
        raise ValueError(
            "create_server_client requires explicit options.storage "
            "(use a per-request/user backend to avoid leaking sessions)"
        )
    merged = replace(options, configure=[with_server_side_session_middleware, *options.configure])
    return create_nhost_client(merged)
