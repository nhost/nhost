---
title: Functions
---

Functions client for the Nhost Python SDK.

## Functions

### `create_api_client`

```python
def create_api_client(base_url: str, *, middleware: Sequence[ChainFunction] = (), http_client: httpx.AsyncClient | None = None) -> Client
```

Create a standalone Functions client.

## Classes

### `Client`

```python
class Client:
    def __init__(base_url: str, *, middleware: Sequence[ChainFunction] = (), http_client: httpx.AsyncClient | None = None) -> None
```

Functions client backed by an owned or injected HTTP client.

#### Methods

##### `aclose`

```python
async def aclose(self) -> None
```

Close the internally owned HTTP client, if any.

##### `add_middleware`

```python
def add_middleware(self, middleware: ChainFunction) -> None
```

Append HTTP middleware and rebuild the request pipeline.

##### `fetch`

```python
async def fetch(self, path: str, *, method: str = 'GET', headers: Mapping[str, str] | None = None, content: bytes | str | None = None, json: Any = ...) -> FetchResponse[Any]
```

Invoke a function with an arbitrary HTTP method and request body.

Omitting ``json`` sends no JSON body; passing ``json=None`` explicitly
sends the JSON literal ``null``. ``content`` and ``json`` are mutually
exclusive.

Raises:
    ValueError: If ``path`` is absolute or escapes the Functions base path.
    NhostError: If the Functions base URL or ``path`` is not a valid URL.

##### `post`

```python
async def post(self, path: str, *, json: Any = None, headers: Mapping[str, str] | None = None) -> FetchResponse[Any]
```

Invoke a function with a JSON ``POST`` request.

Raises:
    ValueError: If ``path`` is absolute or escapes the Functions base path.
    NhostError: If the Functions base URL or ``path`` is not a valid URL.
