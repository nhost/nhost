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
fn service_url(service: Service, subdomain: Option<&str>, region: Option<&str>, custom: Option<&str>) -> Result<String, Error>
```

Builds the base URL for a service. An explicit `custom` URL wins; otherwise a
cloud URL is derived when both subdomain and region are present. When neither
is present, the local development URL is used. Cloud-project fields must be
single ASCII DNS labels; Unicode/IDNA input is rejected rather than punycoded.
Trailing slashes are removed.

Derived and custom URLs pass through the same validation and normalization.

###### Errors

Returns `Error::Config` when only one cloud-project field is present without
a custom URL, either field is empty or contains an unsupported character, or
the resulting URL is not an append-safe HTTP(S) base URL.

## Structs

### `ApiError`

```rust
struct ApiError
```

The payload of an API error: a response with a 3xx status other than 304,
or a 4xx/5xx status.

###### Sensitive data

`Debug` includes `body` and `headers` verbatim. They can
contain tokens, cookies, or sensitive redirect URLs, so do not debug-format
an API error when the response may contain credentials.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `message` | `String` | A human-readable message extracted from common Nhost error body shapes, or from a trimmed, non-blank `X-Error` response header as a fallback. |
| `status` | `u16` | The HTTP status code. |
| `body` | `Value` | The parsed response body (or a JSON string of the raw body). Non-empty bodies are retained for every error status; empty bodies are represented as `serde_json::Value::Null`. |
| `headers` | `HeaderMap` | The response headers. |

#### Trait implementations

- `Display`
- `Error`

### `GraphqlOperationError`

```rust
struct GraphqlOperationError
```

The payload of a GraphQL operation failure.

A non-empty GraphQL `errors` array takes precedence over a 3xx status other
than 304, or a 4xx/5xx status, so this payload also retains the response
status and headers. Use
`GraphqlError::code` to inspect machine-readable Hasura or constellation
error codes.

#### Methods

##### `errors`

```rust
fn errors(&self) -> &[GraphqlError]
```

The GraphQL error entries returned by the server.

##### `data`

```rust
fn data(&self) -> Option<&Value>
```

Partial GraphQL data returned alongside the errors, when present.

##### `status`

```rust
fn status(&self) -> u16
```

The HTTP response status carrying the GraphQL failure.

##### `headers`

```rust
fn headers(&self) -> &HeaderMap
```

The HTTP response headers carrying the GraphQL failure.

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
| `auth` | `Client` | Auth service: sign-up and sign-in (password, OTP, magic link, WebAuthn, OAuth providers), MFA, PATs, user and JWK endpoints. The only client that captures sessions into `sessions`, and the only one where the [admin middleware](NhostBuilder::admin) is never installed. Arbitrary defaults from `NhostBuilder::header` and headers on an `auth::Client::with_headers` clone still apply, including an explicitly configured `x-hasura-admin-secret`. |
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
fn from_clients(auth: Client, refresh_auth: Arc<Client>, storage: Client, graphql: Client, functions: Client, sessions: SessionStorage) -> Self
```

Assembles a client from pre-built service clients.

This is reserved for advanced use cases — for typical usage prefer
`Nhost::builder`, which wires the session middleware for you. The
caller owns each client's middleware stack, must supply a dedicated,
middleware-free `refresh_auth` client without session capture, and must
pass the same `sessions` store that the session middleware was built with.
Otherwise `Nhost::session` and the middleware will disagree or a refresh
response may be written twice. A `refresh_auth` client carrying
`SessionRefresh` can recursively acquire the session refresh lock and hang
rather than return an error when that middleware's guarded auth base differs
from `refresh_auth`'s base. Direct service-client constructors do not validate
or normalize their base URLs; derive them with `service_url` or ensure
they are HTTP(S) URLs without userinfo, a query, a fragment, or trailing
slashes. If the public stack includes `SessionRefresh`, its refresh
client's auth base URL must be textually equivalent to the public `auth`
client's base URL so direct refresh requests do not trigger a redundant
automatic refresh. Middleware installed only on the public `auth` client
does not apply to `Nhost::refresh_session`; configure required default
headers on the underlying `reqwest::Client` shared with `refresh_auth`.

```rust
use std::sync::Arc;
use nhost::http::Middleware;
use nhost::middleware::{AttachToken, SessionRefresh};
use nhost::session::{self, SessionStorage};
use nhost::{auth, functions, graphql, service_url, storage, Nhost, Service};

let http = reqwest::Client::new();
let sessions = SessionStorage::new(session::detect_storage());
let url = |svc| {
    service_url(svc, Some("abcdefgh"), Some("eu-central-1"), None)
        .expect("valid project configuration")
};

// A bare auth client, so refreshing does not recurse through the stack.
let refresh_auth = Arc::new(auth::Client::new(url(Service::Auth), http.clone(), Vec::new()));

let middleware: Vec<Arc<dyn Middleware>> = vec![
    Arc::new(SessionRefresh {
        auth: refresh_auth.clone(),
        storage: sessions.clone(),
        margin: nhost::DEFAULT_REFRESH_MARGIN_SECONDS,
    }),
    Arc::new(AttachToken { storage: sessions.clone() }),
];

let client = Nhost::from_clients(
    auth::Client::new(url(Service::Auth), http.clone(), middleware.clone())
        .with_session_capture(sessions.clone()),
    refresh_auth,
    storage::Client::new(url(Service::Storage), http.clone(), middleware.clone()),
    graphql::Client::new(url(Service::Graphql), http.clone(), middleware.clone()),
    functions::Client::new(url(Service::Functions), http, middleware),
    sessions,
);
```

##### `new`

```rust
fn new<impl Into<String>: Into<String>, impl Into<String>: Into<String>>(subdomain: impl Into<String>, region: impl Into<String>) -> Result<Self, Error>
```

A cloud client for `subdomain`/`region` with default (client-side)
session management. For anything else, use `Nhost::builder`.

###### Errors

Returns `Error::Config` when either project field is empty, contains
characters other than ASCII letters, digits, or hyphens, or produces an
invalid derived service URL.

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

The refresh uses the dedicated auth client supplied at construction,
without the public `Nhost::auth` client's session capture.
`session::refresh_session` is therefore the sole owner of the store write.

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

Overrides the auth service URL. `Self::build` validates it as an
append-safe HTTP(S) URL and removes trailing slashes.

##### `storage_url`

```rust
fn storage_url<impl Into<String>: Into<String>>(self, url: impl Into<String>) -> Self
```

Overrides the storage service URL. `Self::build` validates it as an
append-safe HTTP(S) URL and removes trailing slashes.

##### `graphql_url`

```rust
fn graphql_url<impl Into<String>: Into<String>>(self, url: impl Into<String>) -> Self
```

Overrides the GraphQL service URL. `Self::build` validates it as an
append-safe HTTP(S) URL and removes trailing slashes.

##### `functions_url`

```rust
fn functions_url<impl Into<String>: Into<String>>(self, url: impl Into<String>) -> Self
```

Overrides the functions service URL. `Self::build` validates it as an
append-safe HTTP(S) URL and removes trailing slashes.

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

Overrides the automatic session-refresh middleware's margin in seconds
before access-token expiry.

A margin of `0` forces an automatic refresh attempt before every eligible
request; requests that already have an `Authorization` header and direct
calls to the refresh endpoint are excluded. It also deliberately treats
the stored session as not expired: a transport failure or rejected
response (including `401`) is not retried, the session is not cleared, and
the request continues with the existing, possibly expired, bearer token.

This setting configures only `crate::middleware::SessionRefresh`.
`Nhost::refresh_session` always uses
`crate::DEFAULT_REFRESH_MARGIN_SECONDS` and ignores this value; call
`session::refresh_session` directly to select a margin for an explicit
refresh.

##### `build`

```rust
fn build(self) -> Result<Nhost, Error>
```

Builds the `Nhost` client.

###### Errors

Returns `Error::Config` for incomplete, empty, or invalid cloud-project
fields, invalid service URLs, or server mode without an explicit storage
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
| `Api` | A request completed with a 3xx status other than 304, or a 4xx/5xx status. A GraphQL response carrying a non-empty `errors` array instead produces `Error::GraphQl`. Boxed to keep `Result<_, Error>` small (`clippy::result_large_err`). |
| `GraphQl` | A GraphQL response carried a non-empty `errors` array, regardless of its HTTP status, or `crate::graphql::Operation::send` received no data. The structured errors, partial data, status, and headers are preserved in the payload. |
| `InvalidToken` | An access token could not be decoded. |
| `Config` | A caller-supplied value was invalid at the client boundary (for example, client configuration, a service URL, or a multipart MIME type). |
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

The HTTP status code, when this error came from an HTTP response.

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
