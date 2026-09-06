"""Asynchronous client for invoking Nhost serverless functions."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

import httpx

from ..fetch import (
    ChainFunction,
    FetchResponse,
    HTTPError,
    ResponseDecodeError,
    create_enhanced_fetch,
)

_UNSET = object()


def _is_json_media_type(content_type: str) -> bool:
    media_type = content_type.partition(";")[0].strip().casefold()
    return media_type == "application/json" or media_type.endswith("+json")


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
        middleware: Sequence[ChainFunction] = (),
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self.base_url = base_url
        self._middleware = list(middleware)
        self._owns_http_client = http_client is None
        self._http = http_client if http_client is not None else httpx.AsyncClient()
        self._fetch = create_enhanced_fetch(self._http, self._middleware)

    async def __aenter__(self) -> Client:
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        """Close the internally owned HTTP client, if any."""
        if self._owns_http_client:
            await self._http.aclose()

    def add_middleware(self, middleware: ChainFunction) -> None:
        """Append HTTP middleware and rebuild the request pipeline."""
        self._middleware.append(middleware)
        self._fetch = create_enhanced_fetch(self._http, self._middleware)

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
        """
        if json is not _UNSET and content is not None:
            raise ValueError("content and json are mutually exclusive")

        request_headers = dict(headers or {})
        kwargs: dict[str, Any] = {"headers": request_headers or None}
        if json is None:
            request_headers.setdefault("Content-Type", "application/json")
            kwargs.update(headers=request_headers, content=b"null")
        elif json is not _UNSET:
            kwargs["json"] = json
        elif content is not None:
            kwargs["content"] = content

        request = self._http.build_request(method, f"{self.base_url}{path}", **kwargs)
        response = await self._fetch(request)

        try:
            body = _decode_body(response)
        except ResponseDecodeError as error:
            if response.is_error:
                raise HTTPError.from_response(response) from error
            raise
        if response.is_error:
            raise HTTPError.from_response(response, body=body)

        return FetchResponse(body=body, status=response.status_code, headers=response.headers)

    async def post(
        self,
        path: str,
        *,
        json: Any = None,
        headers: Mapping[str, str] | None = None,
    ) -> FetchResponse[Any]:
        """Invoke a function with a JSON ``POST`` request."""
        merged = {"Accept": "application/json", **(headers or {})}
        return await self.fetch(path, method="POST", headers=merged, json=json)


def create_api_client(
    base_url: str,
    *,
    middleware: Sequence[ChainFunction] = (),
    http_client: httpx.AsyncClient | None = None,
) -> Client:
    """Create a standalone Functions client."""
    return Client(base_url, middleware=middleware, http_client=http_client)
