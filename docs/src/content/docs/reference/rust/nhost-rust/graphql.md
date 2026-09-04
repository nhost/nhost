---
title: Graphql
---

Typed GraphQL client.

Operations are built fluently and decoded into your own types:

```rust
let data: Data = client
    .query("query ($limit: Int!) { todos(limit: $limit) { id } }")
    .variable("limit", 10)
    .send()
    .await?;
```

## Structs

### `Client`

```rust
struct Client
```

GraphQL API client.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `url` | `String` | The GraphQL endpoint URL. |

#### Methods

##### `new`

```rust
fn new(url: impl Into<String>, reqwest: reqwest::Client, middleware: Vec<Arc<dyn reqwest_middleware::Middleware>>) -> Self
```

Creates a client for the GraphQL endpoint `url` from a base client and
an ordered middleware stack (the first entry runs first on the way out).

Most applications get their clients from `crate::Nhost::builder`
instead; use this together with `crate::Nhost::from_clients` to
assemble the pipeline yourself.

##### `with_role`

```rust
fn with_role(&self, role: impl Into<String>) -> Self
```

Returns a copy of this client that sends `x-hasura-role: <role>` on every
request.

##### `with_headers`

```rust
fn with_headers(&self, headers: HashMap<String, String>) -> Self
```

Returns a copy of this client that sends extra headers on every request.

##### `query`

```rust
fn query(&self, query: impl Into<String>) -> Operation<'_>
```

Begins building a GraphQL operation.

### `GraphqlError`

```rust
struct GraphqlError
```

A single GraphQL error entry.

`Debug` recursively redacts credential-bearing values in
`locations`, `path`, and `extensions`. The conventional `extensions.code`
classification, message, and non-sensitive values remain visible; a
server-supplied message may itself contain sensitive data.

This type is non-exhaustive because future GraphQL revisions or Nhost
services may provide additional structured error fields. Use
`GraphqlError::new` to construct one in test fixtures.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `message` | `String` | The server-provided human-readable description; it may contain sensitive data. |
| `locations` | `Option<serde_json::Value>` | Source locations in the submitted document, omitted when the server cannot associate the error with a particular syntax node. |
| `path` | `Option<serde_json::Value>` | The response path of the field that produced the error, when applicable. |
| `extensions` | `Option<serde_json::Value>` | Server-defined metadata; `Self::code` reads its conventional string `code` classification. |

#### Methods

##### `new`

```rust
fn new(message: impl Into<String>) -> Self
```

Creates a GraphQL error with no locations, path, or extensions.

The public fields can be updated when a test fixture needs structured
context.

##### `code`

```rust
fn code(&self) -> Option<&str>
```

Returns the machine-readable `extensions.code`, when it is a string.

### `GraphqlResponse`

```rust
struct GraphqlResponse<T>
```

The standard GraphQL response envelope, with `data` decoded as `T`.

This type is non-exhaustive so the envelope can retain additional protocol
metadata without breaking downstream crates. Use `GraphqlResponse::new`
to construct one in test fixtures.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `data` | `Option<T>` | The operation result, absent when the response omits `data` or returns it as JSON `null`; partial data may coexist with `Self::errors`. |
| `errors` | `Option<Vec<GraphqlError>>` | Protocol errors returned by the server, omitted when no `errors` member was present. `Operation::send` and `Operation::execute` return a non-empty list as `Error::GraphQl` instead of yielding this envelope. |

#### Methods

##### `new`

```rust
fn new(data: Option<T>, errors: Option<Vec<GraphqlError>>) -> Self
```

Creates a GraphQL response envelope from optional data and errors.

### `Operation`

```rust
struct Operation<'a>
```

A GraphQL operation being built. Created by `Client::query`.

#### Methods

##### `variables`

```rust
fn variables(self, variables: impl serde::Serialize) -> Self
```

Replaces all variables at once from any serializable value.

This discards named variables previously merged by `Self::variable`,
including any serialization error already recorded by the builder.
Serialization failures are returned by `Self::execute` or `Self::send`.

##### `variable`

```rust
fn variable(self, key: impl Into<String>, value: impl serde::Serialize) -> Self
```

Sets a single variable, merging into an object set by `Self::variables`.

Serialization failures and attempts to merge into non-object variables
are returned by `Self::execute` or `Self::send`.

##### `operation_name`

```rust
fn operation_name(self, name: impl Into<String>) -> Self
```

Sets the operation name (for multi-operation documents).

##### `send`

```rust
async fn send<T: serde::de::DeserializeOwned>(self) -> Result<T, Error>
```

Sends the operation and returns `data` decoded as `T`.

A non-empty GraphQL `errors` array produces `Error::GraphQl` before
`data` is decoded, preserving any partial data in the error payload.
GraphQL errors take precedence over a 3xx status other than 304, or a
4xx/5xx status; such a status without GraphQL errors produces
`Error::Api`. A response with neither errors nor data also produces
`Error::GraphQl`.

##### `execute`

```rust
async fn execute<T: serde::de::DeserializeOwned>(self) -> Result<Response<GraphqlResponse<T>>, Error>
```

Sends the operation and returns the decoded `data` as `T`, together with
the transport status and headers. The envelope's `errors` is always
`None` here, because a non-empty array is reported as `Error::GraphQl`
instead of being returned.

A non-empty GraphQL `errors` array produces `Error::GraphQl` before
`data` is decoded, preserving any raw partial data in the error payload.
This applies regardless of whether the HTTP response was successful.
Without GraphQL errors, a 3xx status other than 304, or a 4xx/5xx status,
produces `Error::Api`. Variable serialization, transport, and genuine
response-decoding failures are also returned as errors.

## Type Aliases

### `Variables`

```rust
type Variables = serde_json::Value
```

GraphQL variables as free-form JSON.
