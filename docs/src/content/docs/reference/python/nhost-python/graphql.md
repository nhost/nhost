---
title: Graphql
---

GraphQL client for the Nhost Python SDK.

## Functions

### `create_api_client`

```python
def create_api_client(url: 'str', *, middleware: 'Sequence[ChainFunction]' = (), http_client: 'httpx.AsyncClient | None' = None) -> 'Client'
```

Create a standalone GraphQL client.

## Classes

### `Client`

```python
class Client
```

GraphQL API client backed by an owned or injected HTTP client.

#### Methods

##### `aclose`

```python
async def aclose(self) -> 'None'
```

Close the internally owned HTTP client, if any.

##### `add_middleware`

```python
def add_middleware(self, middleware: 'ChainFunction') -> 'None'
```

Append HTTP middleware and rebuild the request pipeline.

##### `request`

```python
async def request(self, query: 'str', *, response_type: 'type[Any] | TypeAdapter[Any] | None' = None, variables: 'GraphQLVariables | None' = None, operation_name: 'str | None' = None, headers: 'Mapping[str, str] | None' = None) -> 'FetchResponse[GraphQLResponse[Any]]'
```

Execute an operation and optionally validate its ``data`` value.

### `GraphQLError`

```python
class GraphQLError
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
class GraphQLErrorLocation
```

Source location associated with a GraphQL error.

#### Fields

| Field | Type |
| --- | --- |
| `line` | `int` |
| `column` | `int` |

### `GraphQLExecutionError`

```python
class GraphQLExecutionError
```

Raised when a valid GraphQL response contains execution errors.

### `GraphQLResponse`

```python
class GraphQLResponse
```

Standard GraphQL response envelope.

#### Fields

| Field | Type |
| --- | --- |
| `data` | `TData \| None` |
| `errors` | `list[GraphQLError] \| None` |
