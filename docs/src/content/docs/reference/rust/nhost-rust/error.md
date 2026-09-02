---
title: Error
---

The SDK error type.

Unlike the JS SDK — which funnels everything through a single API-error
shape — this is a real Rust error enum: transport, middleware, HTTP-API,
GraphQL, (de)serialization, token-decode, configuration, and session-storage
failures are distinct variants you can match on.

## Structs

### `ApiError`

```rust
struct ApiError
```

The payload of an API error: a response whose status was >= 300.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `message` | `String` | A human-readable message extracted from common Nhost error shapes. |
| `status` | `u16` | The HTTP status code. |
| `body` | `Value` | The parsed response body (or a JSON string of the raw body). |
| `headers` | `HeaderMap` | The response headers. |

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
| `Api` | A request completed with a non-success HTTP status (>= 300). Boxed to keep `Result<_, Error>` small (`clippy::result_large_err`). |
| `GraphQl` | A GraphQL response carried `errors` (the joined messages). |
| `InvalidToken` | An access token could not be decoded. |
| `Config` | The client was misconfigured (e.g. a server client without storage). |
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

The HTTP status code, when this is an API error.

#### Trait implementations

- `Display`
- `Error`
