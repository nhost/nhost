---
title: Http
---

HTTP layer built on `reqwest_middleware`.

Each service client owns a `ClientWithMiddleware` assembled from a base
`reqwest::Client` and an ordered middleware stack. `send` issues a
request through that stack and buffers the response so the body can be
inspected (for session capture) and mapped to a typed value.

## Functions

### `build_client`

```rust
fn build_client(reqwest: Client, middleware: &[Arc<dyn Middleware>]) -> ClientWithMiddleware
```

Assembles a `ClientWithMiddleware` from a base client and an ordered
middleware stack (the first entry runs first on the way out).

### `send`

```rust
async fn send(request: RequestBuilder, sink: Option<&SessionStorage>) -> Result<(u16, HeaderMap, Bytes), Error>
```

Sends a request through the middleware chain and buffers the full response.

A status of 300 or greater is turned into `Error::Api`. When `sink` is
provided (only the auth client sets it), a session found in a successful
response body is captured into storage — this replaces the JS SDK's
response-sniffing middleware, which cannot work on wasm.

## Structs

### `Response`

```rust
struct Response<T>
```

A successful response: the decoded payload plus the status and headers that
came with it.

Generated client methods return this so callers can reach response metadata
(`ETag`, `Content-Type`, the header-only result of a `HEAD` request) instead
of only the body. Use `Response::into_body` when the metadata is not
needed.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `body` | `T` | The decoded response payload. `()` for operations with no body. |
| `status` | `u16` | The HTTP status code. |
| `headers` | `HeaderMap` | The response headers. |

#### Methods

##### `into_body`

```rust
fn into_body(self) -> T
```

Discards the status and headers, yielding just the payload.
