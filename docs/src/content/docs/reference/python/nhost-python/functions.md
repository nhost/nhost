---
title: Functions
---

Functions client for the Nhost Python SDK.

## Functions

### `create_api_client`

```python
def create_api_client(base_url: 'str', chain_functions: 'list[ChainFunction] | None' = None, http_client: 'httpx.AsyncClient | None' = None) -> 'Client'
```

## Classes

### `Client`

```python
class Client
```

Functions API client backed by an httpx.AsyncClient and a middleware chain.

#### Methods

##### `fetch`

```python
async def fetch(self, path: 'str', method: 'str' = 'GET', headers: 'dict[str, str] | None' = None, content: 'bytes | str | None' = None, json: 'Any' = None) -> 'FetchResponse[Any]'
```

Invoke a function with an arbitrary method and raw or JSON body.

The body is decoded by content type. Raises :class:`FetchError` on a
non-2xx/3xx response.

##### `post`

```python
async def post(self, path: 'str', body: 'Any' = None, headers: 'dict[str, str] | None' = None) -> 'FetchResponse[Any]'
```

Convenience POST with a JSON body and JSON ``Accept``/``Content-Type``.

Runs against a local Nhost backend (skipped unless
``NHOST_LOCAL_BACKEND=1``). The bundled ``/echo`` function reflects the
request as ``{"body": ..., "headers": ..., "method": ...}``:

```python
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
```

##### `push_chain_function`

```python
def push_chain_function(self, chain_function: 'ChainFunction') -> 'None'
```
