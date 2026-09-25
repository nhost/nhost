"""Nhost Python SDK.

Async-first SDK for Nhost applications: generated Auth and Storage REST clients,
a GraphQL client, a Functions client, session management, and a composable fetch
middleware pipeline.

Example:
    >>> import asyncio
    >>> from nhost import create_client
    >>>
    >>> async def main() -> None:
    ...     async with create_client(
    ...         subdomain="my-project", region="eu-central-1"
    ...     ) as nhost:
    ...         result = await nhost.graphql.request("query { __typename }")
    ...         print(result.body.data)
    >>>
    >>> asyncio.run(main())  # doctest: +SKIP
"""

from __future__ import annotations

from importlib.metadata import PackageNotFoundError, version

from .auth import AuthClient
from .fetch import (
    AdminSessionOptions,
    FetchResponse,
    HTTPError,
    Middleware,
    NhostError,
    ResponseDecodeError,
    UploadFile,
)
from .graphql import GraphQLExecutionError
from .nhost import (
    ClientConfiguration,
    ConfigureContext,
    NhostClient,
    create_client,
    create_nhost_client,
    create_server_client,
    generate_service_url,
    with_admin_session,
    with_client_side_session_middleware,
    with_middleware,
    with_server_side_session_middleware,
)
from .session import (
    DecodedToken,
    FileStorage,
    MemoryStorage,
    SessionStorage,
    SessionStorageBackend,
    SessionStorageError,
    StoredSession,
)
from .storage import StorageClient

try:
    __version__ = version("nhost")
except PackageNotFoundError:  # Running directly from an unpackaged source tree.
    __version__ = "0+unknown"

__all__ = [
    "AdminSessionOptions",
    "AuthClient",
    "Middleware",
    "ClientConfiguration",
    "ConfigureContext",
    "DecodedToken",
    "FetchResponse",
    "GraphQLExecutionError",
    "HTTPError",
    "NhostError",
    "ResponseDecodeError",
    "FileStorage",
    "MemoryStorage",
    "NhostClient",
    "SessionStorage",
    "SessionStorageBackend",
    "SessionStorageError",
    "StorageClient",
    "StoredSession",
    "UploadFile",
    "__version__",
    "create_client",
    "create_nhost_client",
    "create_server_client",
    "generate_service_url",
    "with_admin_session",
    "with_middleware",
    "with_client_side_session_middleware",
    "with_server_side_session_middleware",
]
