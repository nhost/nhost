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
fn new<impl Into<String>: Into<String>>(url: impl Into<String>, reqwest: Client, middleware: Vec<Arc<dyn Middleware>>) -> Self
```

Creates a client for the GraphQL endpoint `url` from a base client and
an ordered middleware stack (the first entry runs first on the way out).

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

##### `query`

```rust
fn query<impl Into<String>: Into<String>>(&self, query: impl Into<String>) -> Operation<'_>
```

Begins building a GraphQL operation.

### `GraphqlError`

```rust
struct GraphqlError
```

A single GraphQL error entry.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `message` | `String` |  |
| `locations` | `Option<Value>` |  |
| `path` | `Option<Value>` |  |
| `extensions` | `Option<Value>` |  |

### `GraphqlResponse`

```rust
struct GraphqlResponse<T>
```

The standard GraphQL response envelope, with `data` decoded as `T`.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `data` | `Option<T>` |  |
| `errors` | `Option<Vec<GraphqlError>>` |  |

### `Operation`

```rust
struct Operation<'a>
```

A GraphQL operation being built. Created by `Client::query`.

#### Methods

##### `variables`

```rust
fn variables<impl Serialize: Serialize>(self, variables: impl Serialize) -> Self
```

Sets all variables at once from any serializable value.

##### `variable`

```rust
fn variable<impl Into<String>: Into<String>, impl Serialize: Serialize>(self, key: impl Into<String>, value: impl Serialize) -> Self
```

Sets a single variable, merging into any already set.

##### `operation_name`

```rust
fn operation_name<impl Into<String>: Into<String>>(self, name: impl Into<String>) -> Self
```

Sets the operation name (for multi-operation documents).

##### `send`

```rust
async fn send<T: DeserializeOwned>(self) -> Result<T, Error>
```

Sends the operation and returns `data` decoded as `T`. Returns
`Error::GraphQl` if the response carries `errors` or no data.

##### `execute`

```rust
async fn execute<T: DeserializeOwned>(self) -> Result<GraphqlResponse<T>, Error>
```

Sends the operation and returns the full response envelope (`data` +
`errors`), decoding `data` as `T`. Only transport/HTTP failures error.

## Type Aliases

### `Variables`

```rust
type Variables = Value
```

GraphQL variables as free-form JSON.
