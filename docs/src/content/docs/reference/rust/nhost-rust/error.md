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

`Debug` includes `body` and `headers` verbatim. They can
contain tokens, cookies, or sensitive redirect URLs, so do not debug-format
an API error when the response may contain credentials.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `message` | `String` | A human-readable message extracted from common Nhost error body shapes, or from a trimmed, non-blank `X-Error` response header as a fallback. |
| `status` | `u16` | The HTTP status code. |
| `body` | `Value` | The parsed response body (or a JSON string of the raw body). Non-empty bodies are retained for every error status; empty bodies are represented as `serde_json::Value::Null`. |
| `headers` | `HeaderMap` | The response headers. |

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

#### Methods

##### `errors`

```rust
fn errors(&self) -> &[GraphqlError]
```

The GraphQL error entries returned by the server.

##### `data`

```rust
fn data(&self) -> Option<&Value>
```

Partial GraphQL data returned alongside the errors, when present.

##### `status`

```rust
fn status(&self) -> u16
```

The HTTP response status carrying the GraphQL failure.

##### `headers`

```rust
fn headers(&self) -> &HeaderMap
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

#### Variants

| Variant | Description |
| --- | --- |
| `Api` | A request completed with a 3xx status other than 304, or a 4xx/5xx status. A GraphQL response carrying a non-empty `errors` array instead produces `Error::GraphQl`. Boxed to keep `Result<_, Error>` small (`clippy::result_large_err`). |
| `GraphQl` | A GraphQL response carried a non-empty `errors` array, regardless of its HTTP status, or `crate::graphql::Operation::send` received no data. The structured errors, partial data, status, and headers are preserved in the payload. |
| `InvalidToken` | An access token could not be decoded. |
| `Config` | A caller-supplied value was invalid at the client boundary (for example, client configuration, a service URL, or a multipart MIME type). |
| `Storage` | A session-storage backend failed (file/localStorage I/O). |
| `Http` | A transport-level error from reqwest. |
| `Middleware` | An error raised by a middleware in the chain. |
| `Json` | A (de)serialization error. |

#### Methods

##### `api`

```rust
fn api(message: String, status: u16, body: Value, headers: HeaderMap) -> Self
```

Builds an `Error::Api` from its parts.

##### `from_response`

```rust
fn from_response(status: u16, headers: HeaderMap, body: Bytes) -> Self
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
