---
title: Fetch
---

HTTP fetch pipeline shared by the generated and hand-written Nhost clients.

The pipeline mirrors ``@nhost/nhost-js``'s ``fetch`` module: a chain of
middleware functions wrap a base fetch backed by an `httpx.AsyncClient`.
Each middleware can inspect/modify the outgoing `httpx.Request` and the
returned `httpx.Response`, which is how session refresh, access-token
attachment, and role/header injection are implemented.

## Functions

### `attach_access_token_middleware`

```python
def attach_access_token_middleware(storage: SessionStorage, service_url: str) -> ChainFunction
```

Attach the stored access token only within the configured service origin.

Should run after the refresh middleware so the freshest token is used. A
caller-supplied authorization header is preserved unless it is the stored
bearer token on a request that has moved outside the service origin.

### `create_enhanced_fetch`

```python
def create_enhanced_fetch(client: httpx.AsyncClient, chain_functions: list[ChainFunction] | None = None) -> FetchFunction
```

Compose ``chain_functions`` around a base fetch backed by ``client``.

The chain executes in list order: the first middleware wraps the second,
and so on, with the base fetch (``client.send``) at the center. This matches
the ``reduceRight`` composition used by the JS SDK.

### `decode_json`

```python
def decode_json(response: httpx.Response, type_: Any) -> Any
```

Validate and parse ``response`` content against ``type_`` via pydantic.

Returns ``None`` for empty/no-content responses. ``type_`` may be any type
pydantic understands: a model, a ``Literal``, a scalar, a ``list[...]`` or a
union. Invalid successful responses raise `ResponseDecodeError` so
every service exposes the same decoding contract.

### `session_refresh_middleware`

```python
def session_refresh_middleware(auth: AuthClient, storage: SessionStorage, margin_seconds: int = 60) -> ChainFunction
```

Refresh the session before a request when the token is near expiry.

Skips requests that already carry an ``Authorization`` header and the token
endpoint itself (to avoid recursively refreshing during a refresh).

### `to_file_part`

```python
def to_file_part(value: bytes | UploadFile) -> Any
```

Normalize a binary multipart value into an httpx ``files`` entry.

An `UploadFile` becomes a ``(filename, content, content_type)``
tuple so its filename reaches the ``Content-Disposition`` header; bare
``bytes`` are passed through unchanged (httpx assigns its default
``"upload"`` filename).

### `to_json`

```python
def to_json(value: Any) -> str
```

Serialize ``value`` to a JSON string (used for multipart JSON parts).

### `to_jsonable`

```python
def to_jsonable(value: Any) -> Any
```

Recursively convert supported values into JSON-serializable primitives.

Pydantic models preserve wire aliases and omit ``None`` fields. Dates,
datetimes, and times use ISO 8601 strings; UUIDs and URLs use strings;
Decimals use strings to preserve precision; and Enums use their values.

### `update_session_from_response_middleware`

```python
def update_session_from_response_middleware(storage: SessionStorage, auth_url: str) -> ChainFunction
```

Persist session data returned by auth endpoints, and clear it on sign-out.

Handles ``/signout`` (remove), a successful ``/user/password`` change
(remove, since the server revokes refresh tokens), and session-bearing
responses from ``/token``, ``/token/exchange``, ``/signin/*`` and
``/signup/*`` under the configured auth origin and path prefix.

### `with_admin_session_middleware`

```python
def with_admin_session_middleware(options: AdminSessionOptions, service_url: str) -> ChainFunction
```

Attach admin headers only within the configured secure service origin.

### `with_headers_middleware`

```python
def with_headers_middleware(default_headers: Mapping[str, str]) -> ChainFunction
```

Attach default headers, preserving any request-specific values.

### `with_role_middleware`

```python
def with_role_middleware(role: str) -> ChainFunction
```

Set ``x-hasura-role`` on requests that don't already specify it.

## Type aliases

### `ChainFunction`

```python
ChainFunction = Callable[[Callable[[httpx.Request], Awaitable[httpx.Response]]], Callable[[httpx.Request], Awaitable[httpx.Response]]]
```

### `FetchFunction`

```python
FetchFunction = Callable[[httpx.Request], Awaitable[httpx.Response]]
```

## Classes

### `AdminSessionOptions`

```python
class AdminSessionOptions:
```

Admin session configuration.

**Security warning:** never use in untrusted/client code — the admin secret
grants unrestricted database access.

#### Fields

| Field | Type |
| --- | --- |
| `admin_secret` | `str` |
| `role` | `str \| None` |
| `session_variables` | `dict[str, str]` |
| `allow_insecure_http` | `bool` |

### `FetchResponse`

```python
class FetchResponse(Generic):
```

A structured API response: the parsed body plus status and headers.

#### Fields

| Field | Type |
| --- | --- |
| `body` | `T` |
| `status` | `int` |
| `headers` | `httpx.Headers` |

### `HTTPError`

```python
class HTTPError(NhostError, Generic):
    def __init__(response: httpx.Response, body: T) -> None
```

Extends [`NhostError`](#nhosterror).

Raised when an API responds with a 3xx, 4xx, or 5xx status.

The complete `httpx.Response` is retained so callers can inspect the
request, response extensions, and protocol details in addition to the
decoded error body.

#### Fields

| Field | Type |
| --- | --- |
| `body` | `T` |
| `response` | `httpx.Response` |

#### Properties

##### `headers`

```python
@property
def headers(self) -> httpx.Headers
```

The HTTP response headers.

##### `request`

```python
@property
def request(self) -> httpx.Request
```

The request which produced the error response.

##### `status`

```python
@property
def status(self) -> int
```

The HTTP response status code.

#### Methods

##### `from_response`

```python
@classmethod
def from_response(response: httpx.Response, *, body: Any = ...) -> HTTPError[Any]
```

Build an `HTTPError` from an error response.

### `NhostError`

```python
class NhostError(Exception):
```

Base class for errors raised by the Nhost SDK.

### `ResponseDecodeError`

```python
class ResponseDecodeError(NhostError):
    def __init__(response: httpx.Response, expected_type: Any, error: Exception) -> None
```

Extends [`NhostError`](#nhosterror).

Raised when a successful response does not match its documented shape.

#### Properties

##### `request`

```python
@property
def request(self) -> httpx.Request
```

The request which produced the invalid response.

### `UploadFile`

```python
class UploadFile:
```

A binary payload for a multipart file part, carrying its filename.

Pass this instead of bare ``bytes`` to a generated upload method when the
server should record a specific filename. Multipart parts built from bare
``bytes`` are sent with httpx's default ``"upload"`` filename, so every
such file is stored under the same name unless an explicit
``metadata[].name`` is supplied.

#### Fields

| Field | Type |
| --- | --- |
| `filename` | `str` |
| `content` | `bytes` |
| `content_type` | `str` |
