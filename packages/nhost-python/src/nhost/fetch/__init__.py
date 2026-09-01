"""HTTP fetch pipeline shared by the generated and hand-written Nhost clients.

The pipeline mirrors ``@nhost/nhost-js``'s ``fetch`` module: a chain of
middleware functions wrap a base fetch backed by an :class:`httpx.AsyncClient`.
Each middleware can inspect/modify the outgoing :class:`httpx.Request` and the
returned :class:`httpx.Response`, which is how session refresh, access-token
attachment, and role/header injection are implemented.
"""

from __future__ import annotations

import contextlib
import json as _json
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, Generic, TypeVar

import httpx
from pydantic import BaseModel, TypeAdapter

T = TypeVar("T")

#: A fetch-like function: takes a prepared request and returns a response.
FetchFunction = Callable[[httpx.Request], Awaitable[httpx.Response]]

#: Middleware: takes the next fetch in the chain and returns a wrapping fetch.
ChainFunction = Callable[[FetchFunction], FetchFunction]

_MIN_ERROR_STATUS = 300
_NO_BODY_STATUSES = frozenset({204, 205, 304})


def create_enhanced_fetch(
    client: httpx.AsyncClient,
    chain_functions: list[ChainFunction] | None = None,
) -> FetchFunction:
    """Compose ``chain_functions`` around a base fetch backed by ``client``.

    The chain executes in list order: the first middleware wraps the second,
    and so on, with the base fetch (``client.send``) at the center. This matches
    the ``reduceRight`` composition used by the JS SDK.
    """

    async def base_fetch(request: httpx.Request) -> httpx.Response:
        return await client.send(request)

    fetch: FetchFunction = base_fetch
    for chain_function in reversed(chain_functions or []):
        fetch = chain_function(fetch)

    return fetch


@dataclass
class FetchResponse(Generic[T]):
    """A structured API response: the parsed body plus status and headers."""

    body: T
    status: int
    headers: httpx.Headers


@dataclass(frozen=True)
class UploadFile:
    """A binary payload for a multipart file part, carrying its filename.

    Pass this instead of bare ``bytes`` to a generated upload method when the
    server should record a specific filename. Multipart parts built from bare
    ``bytes`` are sent with httpx's default ``"upload"`` filename, so every
    such file is stored under the same name unless an explicit
    ``metadata[].name`` is supplied.
    """

    filename: str
    content: bytes
    content_type: str = "application/octet-stream"


def to_file_part(value: bytes | UploadFile) -> Any:
    """Normalize a binary multipart value into an httpx ``files`` entry.

    An :class:`UploadFile` becomes a ``(filename, content, content_type)``
    tuple so its filename reaches the ``Content-Disposition`` header; bare
    ``bytes`` are passed through unchanged (httpx assigns its default
    ``"upload"`` filename).
    """
    if isinstance(value, UploadFile):
        return (value.filename, value.content, value.content_type)
    return value


def to_jsonable(value: Any) -> Any:
    """Convert pydantic models (recursively) into JSON-serializable primitives.

    Uses ``by_alias=True`` so wire names are preserved and ``exclude_none=True``
    so optional fields left unset are omitted from the payload.
    """
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json", by_alias=True, exclude_none=True)
    if isinstance(value, (list, tuple)):
        return [to_jsonable(item) for item in value]
    if isinstance(value, dict):
        return {key: to_jsonable(item) for key, item in value.items()}
    return value


def to_json(value: Any) -> str:
    """Serialize ``value`` to a JSON string (used for multipart JSON parts)."""
    return _json.dumps(to_jsonable(value))


_adapter_cache: dict[Any, TypeAdapter[Any]] = {}


def _adapter_for(type_: Any) -> TypeAdapter[Any]:
    try:
        return _adapter_cache[type_]
    except (KeyError, TypeError):
        adapter: TypeAdapter[Any] = TypeAdapter(type_)
        with contextlib.suppress(TypeError):  # unhashable type key
            _adapter_cache[type_] = adapter
        return adapter


def decode_json(response: httpx.Response, type_: Any) -> Any:
    """Validate and parse ``response`` content against ``type_`` via pydantic.

    Returns ``None`` for empty/no-content responses. ``type_`` may be any type
    pydantic understands: a model, a ``Literal``, a scalar, a ``list[...]`` or a
    union.
    """
    if type_ is None or response.status_code in _NO_BODY_STATUSES or not response.content:
        return None
    return _adapter_for(type_).validate_json(response.content)


def _extract_message(body: Any) -> str:
    """Best-effort extraction of a human-readable message from an error body."""
    if isinstance(body, str) and body:
        return body

    if isinstance(body, dict):
        message = body.get("message")
        if isinstance(message, str):
            return message

        error = body.get("error")
        if isinstance(error, str):
            return error
        if isinstance(error, dict):
            nested = error.get("message")
            if isinstance(nested, str):
                return nested

        errors = body.get("errors")
        if isinstance(errors, list):
            messages = [
                item["message"]
                for item in errors
                if isinstance(item, dict) and isinstance(item.get("message"), str)
            ]
            if messages:
                return ", ".join(messages)

    return "An unexpected error occurred"


class FetchError(Exception, Generic[T]):
    """Raised when a request completes with a non-2xx/3xx status.

    Carries the parsed response ``body``, ``status`` code, and ``headers``. The
    exception message is extracted from common Nhost error response shapes.
    """

    body: T
    status: int
    headers: httpx.Headers

    def __init__(self, body: T, status: int, headers: httpx.Headers) -> None:
        self.body = body
        self.status = status
        self.headers = headers
        super().__init__(_extract_message(body))

    @classmethod
    def from_response(cls, response: httpx.Response) -> FetchError[Any]:
        """Build a :class:`FetchError` from an error ``response``."""
        body: Any
        if response.status_code == 412:  # noqa: PLR2004 - precondition failed has no body
            body = None
        else:
            try:
                body = response.json()
            except (ValueError, _json.JSONDecodeError):
                body = response.text
        return cls(body, response.status_code, response.headers)


# Re-export middleware from the bottom so the core names above are already
# defined when middleware (transitively) imports back from this package.
from .middleware import (  # noqa: E402
    AdminSessionOptions,
    attach_access_token_middleware,
    session_refresh_middleware,
    update_session_from_response_middleware,
    with_admin_session_middleware,
    with_headers_middleware,
    with_role_middleware,
)

__all__ = [
    "AdminSessionOptions",
    "ChainFunction",
    "FetchError",
    "FetchFunction",
    "FetchResponse",
    "UploadFile",
    "attach_access_token_middleware",
    "create_enhanced_fetch",
    "decode_json",
    "session_refresh_middleware",
    "to_file_part",
    "to_json",
    "to_jsonable",
    "update_session_from_response_middleware",
    "with_admin_session_middleware",
    "with_headers_middleware",
    "with_role_middleware",
]
