---
title: Session
---

The enriched, client-side session managed by the SDK: JWT decoding, storage
backends, and token refresh.

`StoredSession` is a superset of the raw auth `crate::auth::Session`,
adding a `DecodedToken` with the parsed JWT payload so Hasura claims,
roles, and session variables are available without manually decoding it.

## Re-exports

- `async_trait` *(proc_attribute)* — re-exported from [`async_trait::async_trait`](https://docs.rs/async-trait/0.1.89/).

## Functions

### `decode_user_session`

```rust
fn decode_user_session(access_token: &str) -> Result<DecodedToken, Error>
```

Decodes the payload of a JWT access token. Hasura claims encoded as
PostgreSQL array literals (e.g. `{user,me}`) are converted into arrays,
mirroring the JS SDK.

### `refresh_session`

```rust
async fn refresh_session(auth: &auth::Client, sessions: &SessionManager, user_id: Option<&str>, margin: i64) -> Result<Option<StoredSession>, Error>
```

Refreshes the session `user_id` selects (see `SessionManager`) if it is close to
expiry.

Concurrent refreshes of the same session, from any number of clients sharing
`sessions`, collapse into one request; different users refresh independently.
The auth service rotates the refresh token on every refresh, so when several
processes share a store, a slower process's refresh is rejected with `401`
after a faster one has stored the rotated session. The session is then
cleared only if the store still holds the rejected refresh token; otherwise
the newer session is returned.

With a nonzero margin, an expired session's refresh request is retried once
only when no 2xx response was observed. If both requests fail, this returns
`Ok(None)` but retains the existing session unless the second failure has
status `401`, which clears the store; a failure to clear it is returned
rather than reported as a sign-out. `Ok(None)` also means
there was no session to refresh; it does not by itself mean the store is
empty, so call `SessionManager::get` (or `crate::Nhost::session`) to
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

### `FileStore`

**Availability:** Native targets with the default features; not available on browser wasm.

```rust
struct FileStore
```

Session store in a JSON file, for a CLI or a local script.

Not available on wasm32, which has no filesystem: the browser persists
sessions through `LocalStorageStore` instead. This is deliberately keyed on the
target rather than on the `wasm` feature, so the type is absent wherever a
file cannot actually be written.

###### Sensitive data

The persisted `StoredSession` includes the long-lived refresh token, which
can mint access tokens until it is revoked server-side. On Unix the file is
created `0o600`, so it is readable only by the owning user; because each
write renames a freshly created file into place, a file left at a wider mode
by an earlier version is replaced rather than reused. A parent directory
*created* here is `0o700`; a directory that already exists is left as it is,
so point this at a private path rather than relying on it to tighten one.
Other platforms inherit the default permissions, so avoid this store on
shared storage there.

###### Durability

Writes are atomic: the session is written to a temporary file in the same
directory, flushed, and renamed over the destination, so a concurrent reader
or an interrupted write never observes a partial file. A file that cannot be
parsed is reported as an error and left in place — it may still
hold a usable refresh token, so it is never deleted to manufacture a clean
"no session" result.

#### Methods

##### `new`

```rust
fn new(path: impl Into<PathBuf>) -> Self
```

Creates a store for `path`; parent directories are created on the first
write attempt rather than during construction, so they persist even if
that write then fails.

#### Trait implementations

- `SessionStore`

### `LocalStorageStore`

**Availability:** Browser wasm only (`wasm` feature on `wasm32`).

```rust
struct LocalStorageStore
```

Session store in the browser's `localStorage`, holding one session. Uses
the same `"nhostSession"` key as `@nhost/nhost-js`, so a session persisted
by either SDK on the same origin is interoperable.

###### Sensitive data

The persisted `StoredSession` includes the long-lived refresh token.
`localStorage` is readable by any script on the origin, so an XSS can expose
a durable credential. Applications with a stricter threat model should pass
a different store to `crate::NhostBuilder::session_store`.

#### Methods

##### `new`

```rust
fn new() -> Option<Self>
```

Returns a handle to `window.localStorage`, or `None` when it is
unavailable (e.g. no `window`, or storage disabled).

#### Trait implementations

- `SessionStore`

### `MemoryStore`

```rust
struct MemoryStore
```

In-memory store holding one session, for a CLI, a script or a test.

It is not shared across processes and is cleared when the process exits. A
server acting for many users uses `MultiUserMemoryStore` or its own
`MultiUserSessionStore` instead.

#### Trait implementations

- `Default`
- `SessionStore`

### `MultiUserMemoryStore`

```rust
struct MultiUserMemoryStore
```

In-memory store holding one session per user, for a server that signs users
in and keeps their sessions for them.

Sessions live only in this process; replicas that share sessions need a
`MultiUserSessionStore` of their own, such as one on Redis.

#### Trait implementations

- `Default`
- `MultiUserSessionStore`

### `SessionManager`

```rust
struct SessionManager
```

Manages the sessions in a store: picks the one a request selects, decodes
tokens, and schedules and coordinates refreshes. Cheaply cloneable (shares
one store).

The builder creates one from the store passed to
`NhostBuilder::session_store` or
`NhostBuilder::multi_user_session_store`;
build one yourself only to assemble clients with
`Nhost::from_clients`.

`user_id` is the user a request selected with
`Nhost::with_user_id`, or `None` when it named
none. With a `SessionStore`, `None` selects its one session and a user ID
selects it only if it is that user's. With a `MultiUserSessionStore`,
`None` selects nothing.

#### Methods

##### `new`

```rust
fn new(store: impl SessionStore + 'static) -> Self
```

Manages the one session in `store`, without reading it; persisted data
is loaded and canonicalized when `Self::get` is called.

##### `multi_user`

```rust
fn multi_user(store: impl MultiUserSessionStore + 'static) -> Self
```

Manages the sessions of many users in `store`, without reading it.

##### `get`

```rust
async fn get(&self, user_id: Option<&str>) -> Result<Option<StoredSession>, Error>
```

Reads the session `user_id` selects and re-decodes its access token so
persisted `decodedToken` cache values cannot diverge from the public
result.

##### `set`

```rust
async fn set(&self, value: Session) -> Result<(), Error>
```

Stores a raw auth session under its user, enriching it into a stored
session. The access token must contain a positive integer `exp` claim
representable as milliseconds and `accessTokenExpiresIn` must be a
positive duration representable as milliseconds. With a
`MultiUserSessionStore`, a session without a user ID fails with
`Error::Storage`.

##### `remove`

```rust
async fn remove(&self, user_id: Option<&str>) -> Result<(), Error>
```

Deletes the session `user_id` selects and clears its refresh schedule.

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
| `decoded_token` | `DecodedToken` | A persisted cache of the access-token claims. `SessionManager::get` re-decodes the token instead of trusting this value after deserialization. |

#### Methods

##### `user_id`

```rust
fn user_id(&self) -> Option<&str>
```

The ID of the user this session belongs to: the auth service's `user.id`,
or the access token's `sub` claim when the response carried no user. A
`MultiUserSessionStore` saves the session under it.

## Traits

### `MaybeSendSync`

**Target variants:** Declarations are shown for native targets with default features. Browser wasm differences are noted where they occur.

```rust
trait MaybeSendSync: Send + Sync
```

**Browser wasm:** The `MaybeSendSync` declaration omits the native `Send + Sync` bounds:

```rust
trait MaybeSendSync
```

`Send + Sync` on native targets, and no bound in the browser (`wasm32` with
the `wasm` feature), whose storage handles are `!Send`. Implemented for every
type that satisfies it.

### `MultiUserSessionStore`

```rust
trait MultiUserSessionStore: MaybeSendSync
```

Where a server keeps the sessions of the users it acts for, keyed by user
ID. Pass one to
`NhostBuilder::multi_user_session_store`.

A request names its user with
`Nhost::with_user_id`. The SDK never asks the
store about a request that names none, so such a request sends no token
rather than someone else's. Sessions are saved under the user the auth
service returned them for.

Built in: `MultiUserMemoryStore`, for one process. Replicas that share
sessions implement this over a shared store:

```rust
use nhost::session::{async_trait, BoxError, MultiUserSessionStore, StoredSession};
use std::collections::HashMap;
use std::sync::Mutex;

/// Stands in for a Redis or database client.
#[derive(Default)]
struct SharedStore {
    rows: Mutex<HashMap<String, String>>,
}

#[async_trait]
impl MultiUserSessionStore for SharedStore {
    async fn load(&self, user_id: &str) -> Result<Option<StoredSession>, BoxError> {
        let rows = self.rows.lock().unwrap();
        Ok(rows.get(user_id).map(|json| serde_json::from_str(json)).transpose()?)
    }

    async fn save(&self, user_id: &str, session: &StoredSession) -> Result<(), BoxError> {
        let json = serde_json::to_string(session)?;
        self.rows.lock().unwrap().insert(user_id.to_string(), json);
        Ok(())
    }

    async fn delete(&self, user_id: &str) -> Result<(), BoxError> {
        self.rows.lock().unwrap().remove(user_id);
        Ok(())
    }
}
```

#### Required / provided methods

##### `load`

```rust
async fn load(&self, user_id: &str) -> Result<Option<StoredSession>, BoxError>
```

Loads `user_id`'s session, or `None` when there is none.

##### `save`

```rust
async fn save(&self, user_id: &str, session: &StoredSession) -> Result<(), BoxError>
```

Saves `session` as `user_id`'s, replacing any session already stored
for them.

##### `delete`

```rust
async fn delete(&self, user_id: &str) -> Result<(), BoxError>
```

Deletes `user_id`'s session. Deleting when there is none succeeds.

##### `delete_if_refresh_token`

```rust
async fn delete_if_refresh_token(&self, user_id: &str, refresh_token: &str) -> Result<Option<StoredSession>, BoxError>
```

Deletes `user_id`'s session if it still holds `refresh_token`, and
otherwise returns the session it holds.

The SDK calls this after the auth service rejected `refresh_token`. The
auth service rotates the refresh token on every refresh, so a replica
sharing the store may have refreshed first and saved a newer session,
which must survive. The default loads, compares and deletes in separate
calls, so a session saved between them is deleted; a store that can do
this in one atomic step (a Redis script, a conditional `DELETE`) should
override it.

### `SessionStore`

```rust
trait SessionStore: MaybeSendSync
```

Where a client acting for one user keeps its session: a CLI, a script, a
test or a browser tab. Pass one to
`NhostBuilder::session_store`.

A store only loads, saves and deletes the session; the SDK decides which
requests get it. Built in: `MemoryStore`, `FileStore` and, in the
browser, `LocalStorageStore`. The methods are async so a store can live in a
remote service without blocking the runtime.

#### Required / provided methods

##### `load`

```rust
async fn load(&self) -> Result<Option<StoredSession>, BoxError>
```

Loads the session, or `None` when there is none.

##### `save`

```rust
async fn save(&self, session: &StoredSession) -> Result<(), BoxError>
```

Saves `session`, replacing any session already stored.

##### `delete`

```rust
async fn delete(&self) -> Result<(), BoxError>
```

Deletes the session. Deleting when there is none succeeds.

##### `delete_if_refresh_token`

```rust
async fn delete_if_refresh_token(&self, refresh_token: &str) -> Result<Option<StoredSession>, BoxError>
```

Deletes the session if it still holds `refresh_token`, and otherwise
returns the session it holds.

The SDK calls this after the auth service rejected `refresh_token`. The
auth service rotates the refresh token on every refresh, so a process
sharing the store may have refreshed first and saved a newer session,
which must survive. The default loads, compares and deletes in separate
calls, so a session saved between them is deleted; a store that can do
this in one atomic step should override it.

## Type Aliases

### `BoxError`

```rust
type BoxError = Box<dyn Error + Send + Sync>
```

The error a session store returns. The SDK reports it as
`Error::Storage`, which keeps it so it can be downcast.

## Constants

### `DEFAULT_MARGIN_SECONDS`

```rust
const DEFAULT_MARGIN_SECONDS: i64 = 60
```

Default number of seconds before expiry at which to refresh.
