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
the browser (when available), otherwise an in-memory store. See
`LocalStorage`'s sensitive-data warning; callers can select an explicit
backend with `crate::NhostBuilder::storage`.

### `refresh_session`

```rust
async fn refresh_session(auth: &auth::Client, storage: &SessionStorage, margin: i64) -> Result<Option<StoredSession>, Error>
```

Refreshes the session if it is close to expiry.

With a nonzero margin, an expired session's refresh request is retried once
only when no 2xx response was observed. If both requests fail, this returns
`Ok(None)` but retains the existing session unless the second failure has
status `401`, which triggers a store-clear attempt. `Ok(None)` also means
there was no session to refresh; it does not by itself mean the store is
empty, so call `SessionStorage::get` (or `crate::Nhost::session`) to
distinguish those cases. From `crate::middleware::SessionRefresh`, a
retained session lets the request continue and
`crate::middleware::AttachToken` can attach its existing, possibly expired
access token.

A margin of `0` forces a refresh attempt but deliberately classifies the
session as not expired, even when its access token is past `exp`. A transport
failure or rejected response is therefore soft: this returns the existing
session after one attempt, does not retry, and does not clear the store on
`401`. From `crate::middleware::SessionRefresh`, the request then continues
with the existing, possibly expired bearer token.

Negative margins and margins too large for millisecond scheduling return
`Error::Config` without making a refresh request.

Once a 2xx response is observed, body-read, decode, and storage failures are
returned without retrying, regardless of their error variant. An undecodable
2xx therefore reaches the caller as `Error::Json` rather than `Ok(None)`.
Storage failures before a request are also returned without retrying. This
prevents an observed-successful rotation from re-submitting its consumed
token. A response lost after the server commits is indistinguishable from a
pre-acceptance transport failure, and a proxy 5xx cannot reveal whether the
origin committed; both remain retryable and require a server-side rotation
grace window to close safely.

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
| `iss` | `Option<String>` | The `iss` claim, when the token carries one. Decoded and exposed for callers but never checked by this SDK, so an application that needs to pin the issuer must compare it itself. |
| `sub` | `Option<String>` | Subject identifier from the `sub` claim, normally the authenticated user's ID. |
| `hasura_claims` | `Option<serde_json::Value>` | Hasura claims, with PostgreSQL array literals converted to arrays. Keyed under the JWT claim URL so it round-trips with `@nhost/nhost-js`. |
| `raw` | `serde_json::Value` | Every claim as decoded (including unknown ones). |

#### Trait implementations

- `Default`

### `FileStorage`

**Availability:** Native targets with the default features; not available on browser wasm.

```rust
struct FileStorage
```

JSON-file backed session backend, useful for CLIs and local scripts.
Native-only; unavailable only when the `wasm` feature is built for wasm32.

#### Methods

##### `new`

```rust
fn new(path: impl Into<PathBuf>) -> Self
```

Creates a backend for `path`; parent directories are created on the first
write attempt rather than during construction, so they persist even if
that write then fails.

#### Trait implementations

- `Backend`

### `LocalStorage`

**Availability:** Browser wasm only (`wasm` feature on `wasm32`).

```rust
struct LocalStorage
```

Browser `localStorage`-backed session store (the default on the web). Uses
the same `"nhostSession"` key as `@nhost/nhost-js`, so a session persisted
by either SDK on the same origin is interoperable.

###### Sensitive data

The persisted `StoredSession` includes the long-lived refresh token.
`localStorage` is readable by any script on the origin, so an XSS can expose
a durable credential. Applications with a stricter threat model should pass
an explicit backend through `crate::NhostBuilder::storage`.

#### Methods

##### `new`

```rust
fn new() -> Option<Self>
```

Returns a handle to `window.localStorage`, or `None` when it is
unavailable (e.g. no `window`, or storage disabled).

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

**Target variants:** Declarations are shown for native targets with default features. Browser wasm differences are noted where they occur.

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

Takes ownership of a backend without reading it; persisted data is loaded
and canonicalized when `Self::get` is called.

##### `get`

```rust
fn get(&self) -> Result<Option<StoredSession>, Error>
```

Reads the session and re-decodes its access token so persisted
`decodedToken` cache values cannot diverge from the public result.

##### `set`

```rust
fn set(&self, value: Session) -> Result<(), Error>
```

Stores a raw auth session, enriching it into a stored session, and
notifies subscribers. The access token must contain a positive integer
`exp` claim representable as milliseconds and `accessTokenExpiresIn`
must be a positive duration representable as milliseconds.

##### `remove`

```rust
fn remove(&self) -> Result<(), Error>
```

Deletes the persisted session, clears its refresh schedule, and notifies
subscribers with `None` after the backend deletion succeeds.

##### `on_change`

```rust
fn on_change<F>(&self, callback: F) -> Subscription
where
    F: Fn(Option<&StoredSession>) + Send + Sync + 'static
```

**Browser wasm:** The `on_change` declaration omits the native `Send + Sync` bounds:

```rust
fn on_change<F>(&self, callback: F) -> Subscription
where
    F: Fn(Option<&StoredSession>) + 'static
```

Subscribes to session changes; the returned guard unsubscribes on drop.

### `StoredSession`

```rust
struct StoredSession
```

The enriched session persisted by the SDK: the raw auth session plus the
decoded access token.

###### Sensitive data

`Debug` redacts the access token, refresh token, and raw
JWT claims, but it leaves caller-controlled user metadata and processed
Hasura claims visible. `Serialize` intentionally emits the complete session,
including the refresh token, so persistence can round-trip; do not serialize
a session into logs.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `session` | `Session` | The raw auth response, flattened into the persisted object for JS SDK interoperability. |
| `decoded_token` | `DecodedToken` | A persisted cache of the access-token claims. `SessionStorage::get` re-decodes the token instead of trusting this value after deserialization. |

### `Subscription`

```rust
struct Subscription
```

A session-change subscription; unsubscribes when dropped.

## Traits

### `Backend`

**Target variants:** Declarations are shown for native targets with default features. Browser wasm differences are noted where they occur.

```rust
trait Backend: Send + Sync
```

**Browser wasm:** The `Backend` declaration omits the native `Send + Sync` bounds:

```rust
trait Backend
```

A backend persisting a single `StoredSession`.

**Additional browser wasm documentation:** On a wasm32 target with the
`wasm` feature, the Send + Sync bounds are dropped because browser storage
handles are !Send; `SessionStorage` re-asserts them for middleware bounds.

#### Required / provided methods

##### `get`

```rust
fn get(&self) -> Result<Option<StoredSession>, Error>
```

Loads the current session, returning `None` when no session is persisted.

##### `set`

```rust
fn set(&self, value: &StoredSession) -> Result<(), Error>
```

Replaces the persisted session with `value`.

##### `remove`

```rust
fn remove(&self) -> Result<(), Error>
```

Deletes the persisted session; built-in backends treat absence as success.

## Constants

### `DEFAULT_MARGIN_SECONDS`

```rust
const DEFAULT_MARGIN_SECONDS: i64 = 60
```

Default number of seconds before expiry at which to refresh.
