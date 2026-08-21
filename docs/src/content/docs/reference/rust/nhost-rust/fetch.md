---
title: Fetch
---

HTTP fetch pipeline shared by the generated and hand-written Nhost clients.

The pipeline mirrors `@nhost/nhost-js`'s fetch module: a chain of middleware
wraps a base fetch backed by a `reqwest::Client`. Each middleware can
inspect/modify the outgoing `reqwest::Request` and the returned
`Response`, which is how session refresh, access-token attachment, and
role/header injection are implemented.

Unlike the browser SDK, responses are buffered into `Response` (status,
headers, and body bytes) so middleware can read the body without consuming
it from downstream consumers.

## Functions

### `create_enhanced_fetch`

```rust
fn create_enhanced_fetch(client: Client, chain: &[ChainFunction]) -> Arc<dyn FetchFn>
```

Composes `chain` around a base fetch backed by `client`. The chain executes
in slice order: the first middleware wraps the second, and so on, with the
base fetch (`client.execute`) at the center. This matches the `reduceRight`
composition used by the JS SDK.

### `is_error_status`

```rust
fn is_error_status(status: u16) -> bool
```

Whether a status code indicates an error (>= 300).

## Structs

### `ApiError`

```rust
struct ApiError
```

The payload of an API error (non-2xx/3xx response).

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `message` | `String` |  |
| `status` | `u16` |  |
| `body` | `Value` |  |
| `headers` | `HeaderMap` |  |

### `FetchResponse`

```rust
struct FetchResponse<T>
```

A structured API response: the parsed body plus status and headers.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `body` | `T` |  |
| `status` | `u16` |  |
| `headers` | `HeaderMap` |  |

### `Response`

```rust
struct Response
```

A buffered HTTP response: status, headers, and the full body.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `status` | `u16` |  |
| `headers` | `HeaderMap` |  |
| `body` | `Bytes` |  |

## Enums

### `Error`

```rust
enum Error
```

The error type returned by the SDK.

#### Variants

| Variant | Description |
| --- | --- |
| `Api` | A request completed with a non-2xx/3xx status. |
| `Reqwest` | A transport-level error from reqwest. |
| `Json` | A (de)serialization error. |

#### Methods

##### `api`

```rust
fn api(message: String, status: u16, body: Value, headers: HeaderMap) -> Self
```

Builds an `Error::Api` from its parts.

##### `from_response`

```rust
fn from_response(resp: Response) -> Self
```

Builds an `Error::Api` from an error `Response`, extracting a
human-readable message from common Nhost error response shapes.

##### `status`

```rust
fn status(&self) -> Option<u16>
```

The HTTP status code, when this is an API error.

#### Trait implementations

- `Display`
- `Error`

## Traits

### `FetchFn`

```rust
trait FetchFn
```

A fetch-like function: takes a prepared request and returns a response.

#### Required / provided methods

##### `call`

```rust
fn call<'life0, 'async_trait>(&'life0 self, req: Request) -> Pin<Box<dyn Future<Output = Result<Response, Error>> + Send + 'async_trait>>
where
    Self: 'async_trait,
    'life0: 'async_trait
```

## Type Aliases

### `ChainFunction`

```rust
type ChainFunction = Arc<dyn Fn(Arc<dyn FetchFn>) -> Arc<dyn FetchFn> + Send + Sync>
```

Middleware: takes the next fetch in the chain and returns a wrapping fetch.
