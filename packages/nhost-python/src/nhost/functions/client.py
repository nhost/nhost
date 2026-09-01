"""Functions client for the Nhost Python SDK.

Invokes serverless functions through the shared fetch middleware chain. The
response body is decoded by content type: ``application/json`` into parsed JSON,
``text/*`` into ``str``, everything else into ``bytes``.
"""

from __future__ import annotations

from typing import Any

import httpx

from ..fetch import ChainFunction, FetchError, FetchResponse, create_enhanced_fetch


def _decode_body(response: httpx.Response) -> Any:
    content_type = response.headers.get("content-type", "")
    if "application/json" in content_type:
        return response.json() if response.content else None
    if content_type.startswith("text/"):
        return response.text
    return response.content


class Client:
    """Functions API client backed by an httpx.AsyncClient and a middleware chain."""

    def __init__(
        self,
        base_url: str,
        chain_functions: list[ChainFunction] | None = None,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self.base_url = base_url
        self._chain_functions: list[ChainFunction] = list(chain_functions or [])
        self._http = http_client if http_client is not None else httpx.AsyncClient()
        self._fetch = create_enhanced_fetch(self._http, self._chain_functions)

    def push_chain_function(self, chain_function: ChainFunction) -> None:
        self._chain_functions.append(chain_function)
        self._fetch = create_enhanced_fetch(self._http, self._chain_functions)

    async def fetch(
        self,
        path: str,
        method: str = "GET",
        headers: dict[str, str] | None = None,
        content: bytes | str | None = None,
        json: Any = None,
    ) -> FetchResponse[Any]:
        """Invoke a function with an arbitrary method and raw or JSON body.

        The body is decoded by content type. Raises :class:`FetchError` on a
        non-2xx/3xx response.
        """
        kwargs: dict[str, Any] = {"headers": headers}
        if json is not None:
            kwargs["json"] = json
        elif content is not None:
            kwargs["content"] = content

        request = self._http.build_request(method, f"{self.base_url}{path}", **kwargs)
        response = await self._fetch(request)

        body = _decode_body(response)
        if response.status_code >= 300:  # noqa: PLR2004
            raise FetchError(body, response.status_code, response.headers)

        return FetchResponse(body=body, status=response.status_code, headers=response.headers)

    async def post(
        self,
        path: str,
        body: Any = None,
        headers: dict[str, str] | None = None,
    ) -> FetchResponse[Any]:
        """Convenience POST with a JSON body and JSON ``Accept``/``Content-Type``.

        Runs against a local Nhost backend (skipped unless
        ``NHOST_LOCAL_BACKEND=1``). The bundled ``/echo`` function reflects the
        request as ``{"body": ..., "headers": ..., "method": ...}``:

        >>> import asyncio
        >>> from nhost import create_client, NhostClientOptions
        >>>
        >>> async def main() -> object:
        ...     async with create_client(
        ...         NhostClientOptions(subdomain="local", region="local")
        ...     ) as nhost:
        ...         resp = await nhost.functions.post("/echo", {"message": "hello"})
        ...         return resp.body["body"]["message"]
        >>>
        >>> asyncio.run(main())
        'hello'
        """
        merged = {"Accept": "application/json", **(headers or {})}
        return await self.fetch(path, method="POST", headers=merged, json=body)


def create_api_client(
    base_url: str,
    chain_functions: list[ChainFunction] | None = None,
    http_client: httpx.AsyncClient | None = None,
) -> Client:
    return Client(base_url, chain_functions, http_client)
