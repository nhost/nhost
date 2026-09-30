"""Nhost Python SDK.

Async-first SDK for Nhost applications: generated Auth and Storage REST clients,
a GraphQL client, a Functions client, session management, and a composable fetch
middleware pipeline.

Example:
    >>> import asyncio
    >>> from nhost import Nhost
    >>>
    >>> async def main() -> None:
    ...     async with Nhost(subdomain="my-project", region="eu-central-1") as nhost:
    ...         result = await nhost.graphql.request("query { __typename }")
    ...         print(result.body.data)
    >>>
    >>> asyncio.run(main())  # doctest: +SKIP
"""

from __future__ import annotations

import logging
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
from .nhost import Nhost, generate_service_url
from .session import (
    DecodedToken,
    FileStore,
    MemoryStore,
    MultiUserMemoryStore,
    MultiUserSessionStore,
    NoSessionStoreError,
    SessionManager,
    SessionStore,
    SessionStoreError,
    StoredSession,
)
from .storage import StorageClient

try:
    __version__ = version("nhost")
except PackageNotFoundError:  # Running directly from an unpackaged source tree.
    __version__ = "0+unknown"


# A library leaves logging output to the application. Without a handler here,
# Python's last-resort handler would print the SDK's warnings to stderr in any
# program that has not configured logging, such as a CLI.
logging.getLogger("nhost").addHandler(logging.NullHandler())

__all__ = [
    "AdminSessionOptions",
    "AuthClient",
    "DecodedToken",
    "FetchResponse",
    "FileStore",
    "GraphQLExecutionError",
    "HTTPError",
    "MemoryStore",
    "Middleware",
    "MultiUserMemoryStore",
    "MultiUserSessionStore",
    "Nhost",
    "NhostError",
    "NoSessionStoreError",
    "ResponseDecodeError",
    "SessionManager",
    "SessionStore",
    "SessionStoreError",
    "StorageClient",
    "StoredSession",
    "UploadFile",
    "__version__",
    "generate_service_url",
]
