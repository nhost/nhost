---
title: Functions
---

Functions client invoking Nhost serverless functions through the shared
fetch middleware chain.

## Structs

### `Client`

```rust
struct Client
```

Functions API client backed by a reqwest::Client and a middleware chain.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `base_url` | `String` |  |

#### Methods

##### `new`

```rust
fn new(base_url: String, chain_functions: Vec<ChainFunction>, reqwest: Client) -> Self
```

##### `push_chain_function`

```rust
fn push_chain_function(&mut self, cf: ChainFunction)
```

##### `fetch`

```rust
async fn fetch(&self, path: &str, method: Method, headers: Option<HeaderMap>, body: Option<Vec<u8>>) -> Result<FetchResponse<Bytes>, Error>
```

Invokes a function with an arbitrary method and raw body, returning the
raw response bytes. Returns an `Error::Api` on a non-2xx/3xx response.

##### `post`

```rust
async fn post<B: Serialize>(&self, path: &str, body: &B, headers: Option<HeaderMap>) -> Result<FetchResponse<Value>, Error>
```

Convenience POST with a JSON body, decoding the JSON response.
