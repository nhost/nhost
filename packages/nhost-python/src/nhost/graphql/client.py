"""Typed asynchronous GraphQL client for Nhost."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any, Generic, TypeVar, overload

import httpx
from pydantic import BaseModel, ConfigDict, TypeAdapter, ValidationError

from ..fetch import (
    FetchResponse,
    HTTPError,
    Middleware,
    NhostError,
    ResponseDecodeError,
    create_fetch_pipeline,
    to_jsonable,
)

GraphQLVariables = Mapping[str, Any]
TData = TypeVar("TData")


class GraphQLErrorLocation(BaseModel):
    """Source location associated with a GraphQL error."""

    model_config = ConfigDict(extra="allow")

    line: int
    column: int


class GraphQLError(BaseModel):
    """One GraphQL error entry."""

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


class GraphQLExecutionError(NhostError):
    """Raised when a valid GraphQL response contains execution errors."""

    def __init__(self, response: httpx.Response, result: GraphQLResponse[Any]) -> None:
        self.response = response
        self.result = result
        self.errors = result.errors or []
        self.data = result.data
        super().__init__(", ".join(error.message for error in self.errors))

    @property
    def request(self) -> httpx.Request:
        return self.response.request


class Client:
    """GraphQL API client backed by an owned or injected HTTP client."""

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

    @overload
    async def request(
        self,
        query: str,
        *,
        response_type: type[TData] | TypeAdapter[TData],
        variables: GraphQLVariables | None = None,
        operation_name: str | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> FetchResponse[GraphQLResponse[TData]]: ...

    @overload
    async def request(
        self,
        query: str,
        *,
        response_type: None = None,
        variables: GraphQLVariables | None = None,
        operation_name: str | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> FetchResponse[GraphQLResponse[Any]]: ...

    async def request(
        self,
        query: str,
        *,
        response_type: type[Any] | TypeAdapter[Any] | None = None,
        variables: GraphQLVariables | None = None,
        operation_name: str | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> FetchResponse[GraphQLResponse[Any]]:
        """Execute an operation and optionally validate its ``data`` value."""
        payload: dict[str, Any] = {"query": query}
        if variables is not None:
            payload["variables"] = dict(variables)
        if operation_name is not None:
            payload["operationName"] = operation_name

        request_headers = httpx.Headers(headers)
        request_headers.setdefault("Content-Type", "application/json")
        request = self._http.build_request(
            "POST",
            self.base_url,
            json=to_jsonable(payload),
            headers=request_headers,
        )
        response = await self._fetch(request)

        try:
            raw: Any = response.json() if response.content else {}
        except (ValueError, UnicodeDecodeError) as error:
            if response.is_error:
                raise HTTPError.from_response(response) from error
            raise ResponseDecodeError(response, GraphQLResponse[Any], error) from error

        try:
            result = GraphQLResponse[Any].model_validate(raw)
        except ValidationError as error:
            if response.is_error:
                raise HTTPError.from_response(response, body=raw) from error
            raise ResponseDecodeError(response, GraphQLResponse[Any], error) from error

        if result.errors:
            raise GraphQLExecutionError(response, result)
        if response.is_error:
            raise HTTPError.from_response(response, body=raw)

        if response_type is not None and result.data is not None:
            adapter = (
                response_type
                if isinstance(response_type, TypeAdapter)
                else TypeAdapter(response_type)
            )
            try:
                typed_data = adapter.validate_python(result.data)
            except (ValueError, TypeError) as error:
                raise ResponseDecodeError(response, response_type, error) from error
            result = GraphQLResponse[Any].model_validate({**raw, "data": typed_data})

        return FetchResponse(body=result, status=response.status_code, headers=response.headers)
