---
title: Error
---

The SDK error type.

## Structs

### `ApiError`

```rust
struct ApiError
```

The payload of an API error: a response with a 3xx status other than 304,
or a 4xx/5xx status.

###### Sensitive data

`Debug` redacts values of credential-bearing response
headers and recursively redacts values whose JSON field names match the
SDK's generated-model credential policy. It keeps header and body field
names, non-sensitive values, `message`, and `status` visible. Because
arbitrary field names and the human-readable message can still contain
sensitive data, treat debug output as redacted rather than secret-free.

This type is non-exhaustive so response metadata can grow without breaking
downstream crates. Use `ApiError::new` to construct one in test fixtures.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `message` | `String` | A human-readable, single-line message extracted from common Nhost error body shapes, or from a trimmed, non-blank `X-Error` response header as a fallback. Response-derived messages contain at most 200 characters plus an ellipsis; unstructured non-JSON bodies are not used as messages. |
| `status` | `u16` | The HTTP status code. |
| `body` | `serde_json::Value` | The parsed response body (or a JSON string of the raw body). Non-empty bodies are retained for every error status; empty bodies are represented as `serde_json::Value::Null`. |
| `headers` | `http::HeaderMap` | The response headers. |

#### Methods

##### `new`

```rust
fn new(message: impl Into<String>, status: u16, body: serde_json::Value, headers: http::HeaderMap) -> Self
```

Creates an API error from its response parts.

#### Trait implementations

- `Display`
- `Error`

### `GraphqlOperationError`

```rust
struct GraphqlOperationError
```

The payload of a GraphQL operation failure.

A non-empty GraphQL `errors` array takes precedence over a 3xx status other
than 304, or a 4xx/5xx status, so this payload also retains the response
status and headers. Use
`GraphqlError::code` to inspect machine-readable Hasura or constellation
error codes.

###### Sensitive data

`Debug` keeps error entries, partial-data field names,
header names, non-sensitive values, and the response status visible. It
recursively redacts credential-bearing values in partial data and structured
error fields, and redacts credential-bearing response header values. Error
messages remain visible and may contain sensitive data supplied by a server.

This type is non-exhaustive so additional GraphQL failure context can be
retained without breaking downstream crates. Use
`GraphqlOperationError::new` to construct one in test fixtures.

#### Methods

##### `new`

```rust
fn new(errors: Vec<GraphqlError>, data: Option<serde_json::Value>, status: u16, headers: http::HeaderMap) -> Self
```

Creates a GraphQL operation error from its response parts.

##### `errors`

```rust
fn errors(&self) -> &[GraphqlError]
```

The GraphQL error entries returned by the server.

##### `data`

```rust
fn data(&self) -> Option<&serde_json::Value>
```

Partial GraphQL data returned alongside the errors, when present.

##### `status`

```rust
fn status(&self) -> u16
```

The HTTP response status carrying the GraphQL failure.

##### `headers`

```rust
fn headers(&self) -> &http::HeaderMap
```

The HTTP response headers carrying the GraphQL failure.

#### Trait implementations

- `Display`
- `Error`

## Enums

### `Error`

```rust
enum Error
```

The error type returned by every fallible SDK operation.

This enum is non-exhaustive because the SDK may gain new failure modes.
Downstream matches must include a wildcard arm.

#### Variants

| Variant | Description |
| --- | --- |
| `Api(Box<ApiError>)` | A request completed with a 3xx status other than 304, or a 4xx/5xx status. A GraphQL response carrying a non-empty `errors` array instead produces `Error::GraphQl`. Boxed to keep `Result<_, Error>` small (`clippy::result_large_err`). |
| `GraphQl(Box<GraphqlOperationError>)` | A GraphQL response carried a non-empty `errors` array, regardless of its HTTP status, or `crate::graphql::Operation::send` received no data. The structured errors, partial data, status, and headers are preserved in the payload. |
| `InvalidToken(String)` | An access token could not be decoded. |
| `Config(String)` | A caller-supplied value was invalid at the client boundary (for example, client configuration, a service URL, or a multipart MIME type). |
| `Storage(String)` | A session-storage backend failed (file/localStorage I/O). |
| `Http(reqwest::Error)` | A transport-level error from reqwest. |
| `Middleware(anyhow::Error)` | An error raised by a middleware in the chain. |
| `Json(serde_json::Error)` | A (de)serialization error. |

#### Methods

##### `api`

```rust
fn api(message: impl Into<String>, status: u16, body: serde_json::Value, headers: http::HeaderMap) -> Self
```

Builds an `Error::Api` from its parts.

##### `graphql`

```rust
fn graphql(errors: Vec<GraphqlError>, data: Option<serde_json::Value>, status: u16, headers: http::HeaderMap) -> Self
```

Builds an `Error::GraphQl` from its response parts.

##### `from_response`

```rust
fn from_response(status: u16, headers: http::HeaderMap, body: bytes::Bytes) -> Self
```

Builds an `Error::Api` from a buffered error response, extracting a
human-readable message from common Nhost error response shapes.

##### `status`

```rust
fn status(&self) -> Option<u16>
```

The HTTP status code, when this error came from an HTTP response.

#### Trait implementations

- `Display`
- `Error`
