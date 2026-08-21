---
title: Graphql
---

GraphQL client for the Nhost Python SDK.

## Functions

### `create_api_client`

```python
def create_api_client(url: 'str', chain_functions: 'list[ChainFunction] | None' = None, http_client: 'httpx.AsyncClient | None' = None) -> 'Client'
```

## Classes

### `Client`

```python
class Client
```

GraphQL API client backed by an httpx.AsyncClient and a middleware chain.

#### Methods

##### `push_chain_function`

```python
def push_chain_function(self, chain_function: 'ChainFunction') -> 'None'
```

##### `request`

```python
async def request(self, query: 'str', variables: 'GraphQLVariables | None' = None, operation_name: 'str | None' = None, headers: 'dict[str, str] | None' = None) -> 'FetchResponse[GraphQLResponse[Any]]'
```

Execute a GraphQL query or mutation.

Raises :class:`FetchError` if the response includes GraphQL ``errors``.

Runs against a local Nhost backend (skipped unless
``NHOST_LOCAL_BACKEND=1``):

```python
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
```

### `GraphQLError`

```python
class GraphQLError
```

A single GraphQL error entry as defined by the GraphQL spec.

#### Fields

| Field | Type |
| --- | --- |
| `message` | `str` |
| `locations` | `list[GraphQLErrorLocation] | None` |
| `path` | `list[Any] | None` |
| `extensions` | `dict[str, Any] | None` |

### `GraphQLResponse`

```python
class GraphQLResponse
```

Standard GraphQL response envelope.

#### Fields

| Field | Type |
| --- | --- |
| `data` | `TData | None` |
| `errors` | `list[GraphQLError] | None` |
