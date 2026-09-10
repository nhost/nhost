"""Asynchronous client for invoking Nhost serverless functions."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

import httpx

from ..fetch import (
    FetchResponse,
    HTTPError,
    Middleware,
    NhostError,
    ResponseDecodeError,
    create_fetch_pipeline,
    to_jsonable,
)


class _Unset:
    def __repr__(self) -> str:
        return "_UNSET"


_UNSET = _Unset()


def _is_json_media_type(content_type: str) -> bool:
    media_type = content_type.partition(";")[0].strip().casefold()
    return media_type == "application/json" or media_type.endswith("+json")


def _join_function_url(base_url: str, path: str) -> httpx.URL:
    base = httpx.URL(base_url)
    base_directory = base.copy_with(
        raw_path=base.raw_path.partition(b"?")[0].rstrip(b"/") + b"/",
        fragment=None,
    )
    relative = httpx.URL(path)
    if relative.scheme or relative.host:
        raise ValueError("function path must not include a scheme or host")
    if ".." in relative.path.split("/"):
        raise ValueError("function path must not escape the functions base path")

    joined = base_directory.join(path.lstrip("/"))
    if not joined.path.startswith(base_directory.path):
        raise ValueError("function path must not escape the functions base path")
    return joined


def _decode_body(response: httpx.Response) -> Any:
    content_type = response.headers.get("content-type", "")
    if _is_json_media_type(content_type):
        if not response.content:
            return None
        try:
            return response.json()
        except (ValueError, UnicodeDecodeError) as error:
            raise ResponseDecodeError(response, Any, error) from error
    if content_type.casefold().startswith("text/"):
        return response.text
    return response.content


class Client:
    """Functions client backed by an owned or injected HTTP client."""

    def __init__(
        self,
        base_url: str,
        *,
        middleware: Sequence[Middleware] = (),
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self.base_url = base_url
        self._middleware = list(middleware)
        self._owns_http_client = http_client is None
        self._http = http_client if http_client is not None else httpx.AsyncClient()
        self._fetch = create_fetch_pipeline(self._http, self._middleware)

    async def __aenter__(self) -> Client:
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        """Close the internally owned HTTP client, if any."""
        if self._owns_http_client:
            await self._http.aclose()

    def add_middleware(self, middleware: Middleware) -> None:
        """Append HTTP middleware and rebuild the request pipeline."""
        self._middleware.append(middleware)
        self._fetch = create_fetch_pipeline(self._http, self._middleware)

    async def fetch(
        self,
        path: str,
        *,
        method: str = "GET",
        headers: Mapping[str, str] | None = None,
        content: bytes | str | None = None,
        json: Any = _UNSET,
    ) -> FetchResponse[Any]:
        """Invoke a function with an arbitrary HTTP method and request body.

        Omitting ``json`` sends no JSON body; passing ``json=None`` explicitly
        sends the JSON literal ``null``. ``content`` and ``json`` are mutually
        exclusive.

        Raises:
            ValueError: If ``path`` is absolute or escapes the Functions base path.
            NhostError: If the Functions base URL or ``path`` is not a valid URL.
        """
        if json is not _UNSET and content is not None:
            raise ValueError("content and json are mutually exclusive")

        request_headers = httpx.Headers(headers)
        kwargs: dict[str, Any] = {"headers": request_headers or None}
        if json is None:
            request_headers.setdefault("Content-Type", "application/json")
            kwargs.update(headers=request_headers, content=b"null")
        elif json is not _UNSET:
            kwargs["json"] = to_jsonable(json)
        elif content is not None:
            kwargs["content"] = content

        try:
            request = self._http.build_request(
                method, _join_function_url(self.base_url, path), **kwargs
            )
        except httpx.InvalidURL as error:
            raise NhostError(f"invalid Functions URL or path: {error}") from error
        response = await self._fetch(request)

        try:
            body = _decode_body(response)
        except ResponseDecodeError as error:
            if response.status_code >= httpx.codes.MULTIPLE_CHOICES:
                raise HTTPError.from_response(response) from error
            raise
        if response.status_code >= httpx.codes.MULTIPLE_CHOICES:
            raise HTTPError.from_response(response, body=body)

        return FetchResponse(body=body, status=response.status_code, headers=response.headers)

    async def post(
        self,
        path: str,
        *,
        json: Any = None,
        headers: Mapping[str, str] | None = None,
    ) -> FetchResponse[Any]:
        """Invoke a function with a JSON ``POST`` request.

        Raises:
            ValueError: If ``path`` is absolute or escapes the Functions base path.
            NhostError: If the Functions base URL or ``path`` is not a valid URL.
        """
        request_headers = httpx.Headers(headers)
        request_headers.setdefault("Accept", "application/json")
        return await self.fetch(path, method="POST", headers=request_headers, json=json)
