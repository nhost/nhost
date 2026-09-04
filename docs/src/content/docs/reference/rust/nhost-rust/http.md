---
title: Http
---

HTTP layer built on `reqwest_middleware`.

Each service client owns a `ClientWithMiddleware` assembled from a base
`reqwest::Client` and an ordered middleware stack. `send` issues a
request through that stack and buffers the response so auth responses can
capture or clear the session and the body can be mapped to a typed value.

## Re-exports

- `ClientBuilder` *(struct)* — re-exported from `reqwest_middleware::ClientBuilder`.
- `ClientWithMiddleware` *(struct)* — re-exported from `reqwest_middleware::ClientWithMiddleware`.
- `Middleware` *(trait)* — re-exported from `reqwest_middleware::Middleware`.
- `RequestBuilder` *(struct)* — re-exported from `reqwest_middleware::RequestBuilder`.

## Functions

### `build_client`

```rust
fn build_client(reqwest: reqwest::Client, middleware: &[Arc<dyn reqwest_middleware::Middleware>]) -> reqwest_middleware::ClientWithMiddleware
```

Assembles a `ClientWithMiddleware` from a base client and an ordered
middleware stack (the first entry runs first on the way out).

### `send`

```rust
async fn send(request: reqwest_middleware::RequestBuilder, sink: Option<&SessionStorage>) -> Result<(u16, http::HeaderMap, bytes::Bytes), Error>
```

Sends a request through the middleware chain and buffers the full response.

A 3xx status other than `304 Not Modified`, or a 4xx/5xx status, is turned
into `Error::Api`. A 304 is returned with an empty body so callers can
inspect `Response::status` and response headers. When `sink` is provided
(only the auth client sets it), successful session responses are captured,
`/signout` clears the session regardless of status, and a successful
`/user/password` response clears it because the server revoked all refresh
tokens. Session path rules use the original request path, so redirects do
not change which rule applies. Storage failures are propagated to the
caller. If both a `/signout` response and removal fail, the storage error
takes precedence because local credentials may remain persisted.

## Structs

### `Response`

```rust
struct Response<T>
```

A successful response: the decoded payload plus the status and headers that
came with it.

Generated REST methods, Functions response helpers, and
`crate::graphql::Operation::execute` return this so callers can reach
response metadata (`ETag`, `Content-Type`, the header-only result of a `HEAD`
request) instead of only the body. Use `Response::into_body` when the
metadata is not needed.

`Debug` includes the response headers verbatim. Do not
format a response with `Debug` when its headers can contain credentials or
cookies.

This type is non-exhaustive so additional response metadata can be retained
without breaking downstream crates. Use `Response::new` to construct one.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `body` | `T` | The decoded response payload. `()` for operations with no body. |
| `status` | `u16` | The HTTP status code. |
| `headers` | `http::HeaderMap` | The response headers. |

#### Methods

##### `new`

```rust
fn new(body: T, status: u16, headers: http::HeaderMap) -> Self
```

Creates a successful response from its payload and transport metadata.

##### `into_body`

```rust
fn into_body(self) -> T
```

Discards the status and headers, yielding just the payload.
