---
title: Functions
---

Client for invoking Nhost serverless functions.

Typed helpers cover the common JSON cases and retain response status and
headers in `crate::http::Response`; call
`crate::http::Response::into_body` when only the decoded value is needed.
`Client::request` returns a middleware-aware
`reqwest_middleware::RequestBuilder` for full control (custom methods, raw
bodies, streaming).

## Structs

### `Client`

```rust
struct Client
```

Functions API client.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `base_url` | `String` | The base URL functions are invoked under. |

#### Methods

##### `new`

```rust
fn new<impl Into<String>: Into<String>>(base_url: impl Into<String>, reqwest: Client, middleware: Vec<Arc<dyn Middleware>>) -> Self
```

Creates a client for `base_url` from a base client and an ordered
middleware stack (the first entry runs first on the way out).

Most applications get their clients from `crate::Nhost::builder`
instead; use this together with `crate::Nhost::from_clients` to
assemble the pipeline yourself.

##### `with_role`

```rust
fn with_role<impl Into<String>: Into<String>>(&self, role: impl Into<String>) -> Self
```

Returns a copy of this client that sends `x-hasura-role: <role>` on every
request.

##### `with_headers`

```rust
fn with_headers(&self, headers: HashMap<String, String>) -> Self
```

Returns a copy of this client that sends extra headers on every request.

##### `request`

```rust
fn request(&self, method: Method, path: &str) -> Result<RequestBuilder, Error>
```

A middleware-aware request builder for `path`, appended to `base_url`.
The path may have a leading slash and may contain multiple segments;
every segment is percent-encoded so it cannot escape the base path or
inject a query. Other segments round-trip, but a segment exactly `.` or
`..` is deliberately sent as `%252E` or `%252E%252E`, not as the caller's
literal identifier, to prevent traversal. Use the builder directly for
full control, then buffer it with `Client::send`.

###### Errors

Returns `Error::Config` when `base_url` is not a valid hierarchical URL.

##### `send`

```rust
async fn send(&self, request: RequestBuilder) -> Result<Response<Bytes>, Error>
```

Sends a built request through the middleware chain and returns its raw
body, status, and headers. A non-success status becomes `Error::Api`.

##### `post`

```rust
async fn post<B, T>(&self, path: &str, body: &B) -> Result<Response<T>, Error>
where
    B: Serialize + ?Sized,
    T: DeserializeOwned
```

POSTs `body` as JSON to `path` and returns the decoded response together
with its status and headers.

##### `get`

```rust
async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<Response<T>, Error>
```

GETs `path` and returns the decoded response together with its status and
headers.
