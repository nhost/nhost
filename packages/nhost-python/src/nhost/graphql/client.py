"""GraphQL client for the Nhost Python SDK.

Executes GraphQL operations against a Hasura GraphQL endpoint through the shared
fetch middleware chain. Raises :class:`FetchError` when the response contains
GraphQL ``errors``.
"""

from __future__ import annotations

from typing import Any, Generic, TypeVar

import httpx
from pydantic import BaseModel, ConfigDict

from ..fetch import ChainFunction, FetchError, FetchResponse, create_enhanced_fetch

GraphQLVariables = dict[str, Any]

TData = TypeVar("TData")


class GraphQLErrorLocation(BaseModel):
    model_config = ConfigDict(extra="allow")

    line: int
    column: int


class GraphQLError(BaseModel):
    """A single GraphQL error entry as defined by the GraphQL spec."""

    model_config = ConfigDict(extra="allow")

    message: str
    locations: list[GraphQLErrorLocation] | None = None
    path: list[Any] | None = None
    extensions: dict[str, Any] | None = None


class GraphQLResponse(BaseModel, Generic[TData]):
    """Standard GraphQL response envelope."""

    model_config = ConfigDict(extra="allow")

    data: TData | None = None
    errors: list[GraphQLError] | None = None


class Client:
    """GraphQL API client backed by an httpx.AsyncClient and a middleware chain."""

    def __init__(
        self,
        url: str,
        chain_functions: list[ChainFunction] | None = None,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self.url = url
        self._chain_functions: list[ChainFunction] = list(chain_functions or [])
        self._http = http_client if http_client is not None else httpx.AsyncClient()
        self._fetch = create_enhanced_fetch(self._http, self._chain_functions)

    def push_chain_function(self, chain_function: ChainFunction) -> None:
        self._chain_functions.append(chain_function)
        self._fetch = create_enhanced_fetch(self._http, self._chain_functions)

    async def request(
        self,
        query: str,
        variables: GraphQLVariables | None = None,
        operation_name: str | None = None,
        headers: dict[str, str] | None = None,
    ) -> FetchResponse[GraphQLResponse[Any]]:
        """Execute a GraphQL query or mutation.

        Raises :class:`FetchError` if the response includes GraphQL ``errors``.

        Runs against a local Nhost backend (skipped unless
        ``NHOST_LOCAL_BACKEND=1``):

        >>> import asyncio
        >>> from nhost import create_client, NhostClientOptions
        >>>
        >>> async def main() -> str | None:
        ...     async with create_client(
        ...         NhostClientOptions(subdomain="local", region="local")
        ...     ) as nhost:
        ...         result = await nhost.graphql.request("query { __typename }")
        ...         return result.body.data["__typename"]
        >>>
        >>> asyncio.run(main())
        'query_root'
        """
        payload: dict[str, Any] = {"query": query}
        if variables is not None:
            payload["variables"] = variables
        if operation_name is not None:
            payload["operationName"] = operation_name

        request = self._http.build_request(
            "POST",
            self.url,
            json=payload,
            headers={"Content-Type": "application/json", **(headers or {})},
        )
        response = await self._fetch(request)

        raw: dict[str, Any] = response.json() if response.content else {}
        result: GraphQLResponse[Any] = GraphQLResponse.model_validate(raw)

        if result.errors:
            raise FetchError(raw, response.status_code, response.headers)

        return FetchResponse(body=result, status=response.status_code, headers=response.headers)


def create_api_client(
    url: str,
    chain_functions: list[ChainFunction] | None = None,
    http_client: httpx.AsyncClient | None = None,
) -> Client:
    return Client(url, chain_functions, http_client)
