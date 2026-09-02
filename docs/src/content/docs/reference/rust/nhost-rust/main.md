---
title: Main
---

The Nhost SDK for Rust: an idiomatic async client for Nhost's Auth, Storage,
GraphQL, and Functions services.

Build a client with `Nhost::builder`, then reach the services through it:

```rust
use nhost::Nhost;
use nhost::auth::SignInEmailPasswordRequest;

let client = Nhost::builder().subdomain("local").region("local").build()?;
client
    .auth
    .sign_in_email_password(SignInEmailPasswordRequest {
        email: "user@example.com".into(),
        password: "secret".into(),
    })
    .await?;
```

Callers that need full control over the request pipeline can build the four
service clients themselves and combine them with `Nhost::from_clients`.

The auth and storage REST clients are generated from the shared OpenAPI
specs; the middleware chain (built on `reqwest_middleware`), session
handling, GraphQL, and Functions clients are hand-written.

## Functions

### `service_url`

```rust
fn service_url(service: Service, subdomain: Option<&str>, region: Option<&str>, custom: Option<&str>) -> String
```

Builds the base URL for a service. An explicit `custom` URL wins; otherwise a
cloud URL is derived from subdomain/region; otherwise the local dev URL.

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

### `Nhost`

```rust
struct Nhost
```

Unified, cheaply-shareable access to the Nhost services.

Build one with `Nhost::builder` (or `Nhost::new` for a cloud project);
`Nhost::from_clients` takes pre-built clients for full control over the
request pipeline.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `auth` | `Client` | Auth service: sign-up and sign-in (password, OTP, magic link, WebAuthn, OAuth providers), MFA, PATs, user and JWK endpoints. The only client that captures sessions into `sessions`, and the only one an admin secret is never applied to. |
| `storage` | `Client` | Storage service: file upload, download, replace and delete, metadata (including presigned URLs and image transformations), plus the admin-only consistency endpoints. |
| `graphql` | `Client` | GraphQL endpoint: `query(..).variable(..).send::<T>()`, decoding `data` into your own types and mapping `errors` to `Error::GraphQl`. |
| `functions` | `Client` | Functions service: typed `get`/`post` helpers for your project's serverless functions, or `functions::Client::request` for full control. |
| `sessions` | `SessionStorage` | The session store shared by every client and the session middleware: read it with `Nhost::session`, observe it with `SessionStorage::on_change`. |

#### Methods

##### `builder`

```rust
fn builder() -> NhostBuilder
```

Starts configuring a client.

##### `from_clients`

```rust
fn from_clients(auth: Client, storage: Client, graphql: Client, functions: Client, sessions: SessionStorage) -> Self
```

Assembles a client from pre-built service clients.

This is reserved for advanced use cases — for typical usage prefer
`Nhost::builder`, which wires the session middleware for you. The
caller owns each client's middleware stack and must pass the same
`sessions` store that the session middleware was built with, otherwise
`Nhost::session` and the middleware will disagree.

```rust
use std::sync::Arc;
use nhost::http::Middleware;
use nhost::middleware::{AttachToken, SessionRefresh};
use nhost::session::{self, SessionStorage};
use nhost::{auth, functions, graphql, service_url, storage, Nhost, Service};

let http = reqwest::Client::new();
let sessions = SessionStorage::new(session::detect_storage());
let url = |svc| service_url(svc, Some("abcdefgh"), Some("eu-central-1"), None);

// A bare auth client, so refreshing does not recurse through the stack.
let refresh_auth = Arc::new(auth::Client::new(url(Service::Auth), http.clone(), Vec::new()));

let middleware: Vec<Arc<dyn Middleware>> = vec![
    Arc::new(SessionRefresh {
        auth: refresh_auth,
        storage: sessions.clone(),
        margin: nhost::DEFAULT_REFRESH_MARGIN_SECONDS,
    }),
    Arc::new(AttachToken { storage: sessions.clone() }),
];

let client = Nhost::from_clients(
    auth::Client::new(url(Service::Auth), http.clone(), middleware.clone())
        .with_session_capture(sessions.clone()),
    storage::Client::new(url(Service::Storage), http.clone(), middleware.clone()),
    graphql::Client::new(url(Service::Graphql), http.clone(), middleware.clone()),
    functions::Client::new(url(Service::Functions), http, middleware),
    sessions,
);
```

##### `new`

```rust
fn new<impl Into<String>: Into<String>, impl Into<String>: Into<String>>(subdomain: impl Into<String>, region: impl Into<String>) -> Self
```

A cloud client for `subdomain`/`region` with default (client-side)
session management. For anything else, use `Nhost::builder`.

##### `session`

```rust
fn session(&self) -> Result<Option<StoredSession>, Error>
```

The current stored session, if any.

##### `refresh_session`

```rust
async fn refresh_session(&self) -> Result<Option<StoredSession>, Error>
```

Refreshes the session if it is near expiry, using the stored refresh
token. Returns the (possibly unchanged) session.

The refresh goes through `Nhost::auth` and its middleware;
`SessionRefresh` skips the token endpoint, so this does not recurse.

##### `clear_session`

```rust
fn clear_session(&self) -> Result<(), Error>
```

Clears the stored session (client-side sign-out).

### `NhostBuilder`

```rust
struct NhostBuilder
```

Fluent builder for `Nhost`. Obtain one from `Nhost::builder`.

#### Methods

##### `subdomain`

```rust
fn subdomain<impl Into<String>: Into<String>>(self, subdomain: impl Into<String>) -> Self
```

Sets the cloud project subdomain.

##### `region`

```rust
fn region<impl Into<String>: Into<String>>(self, region: impl Into<String>) -> Self
```

Sets the cloud project region.

##### `auth_url`

```rust
fn auth_url<impl Into<String>: Into<String>>(self, url: impl Into<String>) -> Self
```

Overrides the auth service URL.

##### `storage_url`

```rust
fn storage_url<impl Into<String>: Into<String>>(self, url: impl Into<String>) -> Self
```

Overrides the storage service URL.

##### `graphql_url`

```rust
fn graphql_url<impl Into<String>: Into<String>>(self, url: impl Into<String>) -> Self
```

Overrides the GraphQL service URL.

##### `functions_url`

```rust
fn functions_url<impl Into<String>: Into<String>>(self, url: impl Into<String>) -> Self
```

Overrides the functions service URL.

##### `storage`

```rust
fn storage(self, backend: Box<dyn Backend>) -> Self
```

Sets the session storage backend (defaults to in-memory / localStorage).

##### `http_client`

```rust
fn http_client(self, client: Client) -> Self
```

Uses a pre-configured `reqwest::Client` (connection pools, proxies…).

##### `role`

```rust
fn role<impl Into<String>: Into<String>>(self, role: impl Into<String>) -> Self
```

Sets `x-hasura-role` on every request.

##### `header`

```rust
fn header<impl Into<String>: Into<String>, impl Into<String>: Into<String>>(self, name: impl Into<String>, value: impl Into<String>) -> Self
```

Adds a header sent on every request.

##### `headers`

```rust
fn headers(self, headers: HashMap<String, String>) -> Self
```

Sets the whole per-request header map.

##### `admin_secret`

```rust
fn admin_secret<impl Into<String>: Into<String>>(self, secret: impl Into<String>) -> Self
```

Enables the admin secret on storage/graphql/functions. **Never use in
client-side code** — it grants full admin access.

##### `admin`

```rust
fn admin(self, options: AdminSessionOptions) -> Self
```

Enables an admin session with full options (role, session variables).

##### `server`

```rust
fn server(self) -> Self
```

Server mode: attach the token but never auto-refresh. Requires an
explicit per-request `storage` to avoid sharing one
session across users.

##### `without_session_management`

```rust
fn without_session_management(self) -> Self
```

Disables all session middleware (token attach + refresh). You manage
auth headers yourself (or via `role`/`admin`).

##### `refresh_margin`

```rust
fn refresh_margin(self, seconds: i64) -> Self
```

Overrides the refresh margin (seconds before expiry).

##### `build`

```rust
fn build(self) -> Result<Nhost, Error>
```

Builds the `Nhost` client.

###### Errors
Returns `Error::Config` in server mode without an explicit storage
backend.

#### Trait implementations

- `Default`

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

### `Service`

```rust
enum Service
```

One of the Nhost services.

#### Variants

| Variant | Description |
| --- | --- |
| `Auth` | The auth service (`auth.<region>.nhost.run/v1`). |
| `Storage` | The storage service (`storage.<region>.nhost.run/v1`). |
| `Graphql` | The GraphQL endpoint (`graphql.<region>.nhost.run/v1`). |
| `Functions` | The functions service (`functions.<region>.nhost.run/v1`). |

## Constants

### `DEFAULT_REFRESH_MARGIN_SECONDS`

```rust
const DEFAULT_REFRESH_MARGIN_SECONDS: i64 = DEFAULT_MARGIN_SECONDS
```

Default seconds before expiry at which the session is refreshed.
