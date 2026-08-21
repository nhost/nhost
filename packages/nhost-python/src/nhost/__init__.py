"""Nhost Python SDK.

Async-first SDK for Nhost applications: generated Auth and Storage REST clients,
a GraphQL client, a Functions client, session management, and a composable fetch
middleware pipeline.

Example:
    >>> import asyncio
    >>> from nhost import create_client, NhostClientOptions
    >>>
    >>> async def main() -> None:
    ...     async with create_client(
    ...         NhostClientOptions(subdomain="my-project", region="eu-central-1")
    ...     ) as nhost:
    ...         result = await nhost.graphql.request("query { __typename }")
    ...         print(result.body.data)
    >>>
    >>> asyncio.run(main())  # doctest: +SKIP
"""

from __future__ import annotations

from .fetch import (
    AdminSessionOptions,
    ChainFunction,
    FetchError,
    FetchResponse,
    UploadFile,
)
from .nhost import (
    ConfigureContext,
    NhostClient,
    NhostClientOptions,
    create_client,
    create_nhost_client,
    create_server_client,
    generate_service_url,
    with_admin_session,
    with_chain_functions,
    with_client_side_session_middleware,
    with_server_side_session_middleware,
)
from .session import (
    DecodedToken,
    FileStorage,
    MemoryStorage,
    SessionStorage,
    SessionStorageBackend,
    StoredSession,
)

__version__ = "0.0.0.dev0"

__all__ = [
    "AdminSessionOptions",
    "ChainFunction",
    "ConfigureContext",
    "DecodedToken",
    "FetchError",
    "FetchResponse",
    "FileStorage",
    "MemoryStorage",
    "NhostClient",
    "NhostClientOptions",
    "SessionStorage",
    "SessionStorageBackend",
    "StoredSession",
    "UploadFile",
    "__version__",
    "create_client",
    "create_nhost_client",
    "create_server_client",
    "generate_service_url",
    "with_admin_session",
    "with_chain_functions",
    "with_client_side_session_middleware",
    "with_server_side_session_middleware",
]
