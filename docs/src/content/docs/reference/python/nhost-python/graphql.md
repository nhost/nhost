---
title: Graphql
---

GraphQL client for the Nhost Python SDK.

## Type aliases

### `GraphQLVariables`

```python
GraphQLVariables = Mapping[str, Any]
```

## Classes

### `Client`

```python
class Client:
    def __init__(base_url: str, *, middleware: Sequence[Middleware] = (), http_client: httpx.AsyncClient | None = None) -> None
```

GraphQL API client backed by an owned or injected HTTP client.

#### Methods

##### `aclose`

```python
async def aclose(self) -> None
```

Close the internally owned HTTP client, if any.

##### `add_middleware`

```python
def add_middleware(self, middleware: Middleware) -> None
```

Append HTTP middleware and rebuild the request pipeline.

##### `request`

```python
async def request(self, query: str, *, response_type: type[Any] | TypeAdapter[Any] | None = None, variables: GraphQLVariables | None = None, operation_name: str | None = None, headers: Mapping[str, str] | None = None) -> FetchResponse[GraphQLResponse[Any]]
```

Execute an operation and optionally validate its ``data`` value.

### `GraphQLError`

```python
class GraphQLError(BaseModel):
```

One GraphQL error entry.

#### Fields

| Field | Type |
| --- | --- |
| `message` | `str` |
| `locations` | `list[GraphQLErrorLocation] \| None` |
| `path` | `list[Any] \| None` |
| `extensions` | `dict[str, Any] \| None` |

### `GraphQLErrorLocation`

```python
class GraphQLErrorLocation(BaseModel):
```

Source location associated with a GraphQL error.

#### Fields

| Field | Type |
| --- | --- |
| `line` | `int` |
| `column` | `int` |

### `GraphQLExecutionError`

```python
class GraphQLExecutionError(NhostError):
    def __init__(response: httpx.Response, result: GraphQLResponse[Any]) -> None
```

Raised when a valid GraphQL response contains execution errors.

#### Properties

##### `request`

```python
@property
def request(self) -> httpx.Request
```

### `GraphQLResponse`

```python
class GraphQLResponse(BaseModel, Generic):
```

Standard GraphQL response envelope.

#### Fields

| Field | Type |
| --- | --- |
| `data` | `TData \| None` |
| `errors` | `list[GraphQLError] \| None` |
