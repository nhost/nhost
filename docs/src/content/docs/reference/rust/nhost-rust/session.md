---
title: Session
---

The enriched, client-side session managed by the SDK: JWT decoding, storage
backends, and token refresh.

`StoredSession` is a superset of the raw auth `crate::auth::Session`,
adding a `DecodedToken` with the parsed JWT payload so Hasura claims,
roles, and session variables are available without manually decoding it.

## Functions

### `decode_user_session`

```rust
fn decode_user_session(access_token: &str) -> Result<DecodedToken, Error>
```

Decodes the payload of a JWT access token. Hasura claims encoded as
PostgreSQL array literals (e.g. `{user,me}`) are converted into arrays,
mirroring the JS SDK.

### `detect_storage`

```rust
fn detect_storage() -> Box<dyn Backend>
```

Returns the default backend for the current environment: `localStorage` in
the browser (when available), otherwise an in-memory store.

### `refresh_session`

```rust
async fn refresh_session(auth: &Client, storage: &SessionStorage, margin: i64) -> Result<Option<StoredSession>, Error>
```

Refreshes the session if it is close to expiry. Retries once on transient
failure; clears the stored session and returns `Ok(None)` if the refresh
token is rejected with 401.

## Structs

### `DecodedToken`

```rust
struct DecodedToken
```

The decoded JWT access-token payload.

The persisted shape is interoperable with `@nhost/nhost-js`: `exp`/`iat` are
stored in milliseconds and the Hasura claims are keyed under the JWT claim
URL, so a session written by either SDK under the same storage key can be
read by the other.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `exp` | `Option<i64>` | Token expiration in **milliseconds** since the Unix epoch (the raw JWT value in seconds multiplied by 1000, matching `@nhost/nhost-js`). |
| `iat` | `Option<i64>` | Token issued-at time in **milliseconds** since the Unix epoch. |
| `iss` | `Option<String>` |  |
| `sub` | `Option<String>` |  |
| `hasura_claims` | `Option<Value>` | Hasura claims, with PostgreSQL array literals converted to arrays. Keyed under the JWT claim URL so it round-trips with `@nhost/nhost-js`. |
| `raw` | `Value` | Every claim as decoded (including unknown ones). |

#### Trait implementations

- `Default`

### `FileStorage`

```rust
struct FileStorage
```

JSON-file backed session backend, useful for CLIs and local scripts.
Native-only; not available under the `wasm` feature.

#### Methods

##### `new`

```rust
fn new<impl Into<PathBuf>: Into<PathBuf>>(path: impl Into<PathBuf>) -> Self
```

#### Trait implementations

- `Backend`

### `MemoryStorage`

```rust
struct MemoryStorage
```

In-memory session backend (the default). Because a single instance is
process-wide, do not share one between users in a server context.

#### Trait implementations

- `Backend`
- `Default`

### `SessionStorage`

```rust
struct SessionStorage
```

Wraps a `Backend`, decoding tokens on set and notifying subscribers on
every change. Cheaply cloneable (shares one backend).

#### Methods

##### `new`

```rust
fn new(backend: Box<dyn Backend>) -> Self
```

##### `get`

```rust
fn get(&self) -> Option<StoredSession>
```

##### `set`

```rust
fn set(&self, value: Session) -> Result<(), Error>
```

Stores a raw auth session, enriching it into a stored session, and
notifies subscribers.

##### `remove`

```rust
fn remove(&self)
```

##### `on_change`

```rust
fn on_change<F>(&self, callback: F) -> Subscription
where
    F: Fn(Option<&StoredSession>) + Send + Sync + 'static
```

Subscribes to session changes; the returned guard unsubscribes on drop.

### `StoredSession`

```rust
struct StoredSession
```

The enriched session persisted by the SDK: the raw auth session plus the
decoded access token.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `session` | `Session` |  |
| `decoded_token` | `DecodedToken` |  |

### `Subscription`

```rust
struct Subscription
```

A session-change subscription; unsubscribes when dropped.

## Traits

### `Backend`

```rust
trait Backend
```

A backend persisting a single `StoredSession`.

#### Required / provided methods

##### `get`

```rust
fn get(&self) -> Option<StoredSession>
```

##### `set`

```rust
fn set(&self, value: StoredSession)
```

##### `remove`

```rust
fn remove(&self)
```

## Constants

### `DEFAULT_MARGIN_SECONDS`

```rust
const DEFAULT_MARGIN_SECONDS: i64 = 60
```

Default number of seconds before expiry at which to refresh.
