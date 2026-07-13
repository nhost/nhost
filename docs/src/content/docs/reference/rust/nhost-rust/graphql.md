---
title: Graphql
---

GraphQL client executing operations against a Hasura endpoint through the
shared fetch middleware chain.

## Structs

### `Client`

```rust
struct Client
```

GraphQL API client backed by a reqwest::Client and a middleware chain.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `url` | `String` |  |

#### Methods

##### `new`

```rust
fn new(url: String, chain_functions: Vec<ChainFunction>, reqwest: Client) -> Self
```

##### `push_chain_function`

```rust
fn push_chain_function(&mut self, cf: ChainFunction)
```

##### `request`

```rust
async fn request(&self, query: &str, variables: Option<Variables>, operation_name: Option<&str>, headers: Option<HeaderMap>) -> Result<FetchResponse<GraphqlResponse<Value>>, Error>
```

Executes a GraphQL operation, decoding `data` as generic JSON. Returns
an `Error::Api` if the HTTP response is a non-2xx/3xx status (e.g. a
`401` from the gateway) or if the response envelope contains GraphQL
errors, keeping error handling consistent with the functions, auth, and
storage clients.

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

The standard GraphQL response envelope.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `data` | `Option<T>` |  |
| `errors` | `Option<Vec<GraphqlError>>` |  |

## Type Aliases

### `Variables`

```rust
type Variables = Value
```

GraphQL variables.
