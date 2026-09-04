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

`Debug` redacts values of credential-bearing response
headers and recursively redacts values whose JSON field names match the
SDK's generated-model credential policy. It keeps header and body field
names, non-sensitive values, `message`, and `status` visible. Because
arbitrary field names and the human-readable message can still contain
sensitive data, treat debug output as redacted rather than secret-free.

This type is non-exhaustive so response metadata can grow without breaking
downstream crates. Use `ApiError::new` to construct one in test fixtures.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `message` | `String` | A human-readable, single-line message extracted from common Nhost error body shapes, or from a trimmed, non-blank `X-Error` response header as a fallback. Response-derived messages contain at most 200 characters plus an ellipsis; unstructured non-JSON bodies are not used as messages. |
| `status` | `u16` | The HTTP status code. |
| `body` | `serde_json::Value` | The parsed response body (or a JSON string of the raw body). Non-empty bodies are retained for every error status; empty bodies are represented as `serde_json::Value::Null`. |
| `headers` | `http::HeaderMap` | The response headers. |

#### Methods

##### `new`

```rust
fn new(message: impl Into<String>, status: u16, body: serde_json::Value, headers: http::HeaderMap) -> Self
```

Creates an API error from its response parts.

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

###### Sensitive data

`Debug` keeps error entries, partial-data field names,
header names, non-sensitive values, and the response status visible. It
recursively redacts credential-bearing values in partial data and structured
error fields, and redacts credential-bearing response header values. Error
messages remain visible and may contain sensitive data supplied by a server.

This type is non-exhaustive so additional GraphQL failure context can be
retained without breaking downstream crates. Use
`GraphqlOperationError::new` to construct one in test fixtures.

#### Methods

##### `new`

```rust
fn new(errors: Vec<GraphqlError>, data: Option<serde_json::Value>, status: u16, headers: http::HeaderMap) -> Self
```

Creates a GraphQL operation error from its response parts.

##### `errors`

```rust
fn errors(&self) -> &[GraphqlError]
```

The GraphQL error entries returned by the server.

##### `data`

```rust
fn data(&self) -> Option<&serde_json::Value>
```

Partial GraphQL data returned alongside the errors, when present.

##### `status`

```rust
fn status(&self) -> u16
```

The HTTP response status carrying the GraphQL failure.

##### `headers`

```rust
fn headers(&self) -> &http::HeaderMap
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
| `auth` | `auth::Client` | Auth service: sign-up and sign-in (password, OTP, magic link, WebAuthn, OAuth providers), MFA, PATs, user and JWK endpoints. The only client that captures sessions into `sessions`, and the only one where the [admin middleware](NhostBuilder::admin) is never installed. Arbitrary defaults from `NhostBuilder::header` and headers on an `auth::Client::with_headers` clone still apply, including an explicitly configured `x-hasura-admin-secret`. |
| `storage` | `storage::Client` | Storage service: file upload, download, replace and delete, metadata (including presigned URLs and image transformations), plus the admin-only consistency endpoints. |
| `graphql` | `graphql::Client` | GraphQL endpoint: `query(..).variable(..).send::<T>()`, decoding `data` into your own types and mapping `errors` to `Error::GraphQl`. |
| `functions` | `functions::Client` | Functions service: typed `get`/`post` helpers for your project's serverless functions, or `functions::Client::request` for full control. |
| `sessions` | `SessionStorage` | The session store shared by every client and the session middleware: read it with `Nhost::session`, observe it with `SessionStorage::on_change`. |

#### Methods

##### `builder`

```rust
fn builder() -> NhostBuilder
```

Starts configuring a client.

##### `from_clients`

```rust
fn from_clients(auth: auth::Client, refresh_auth: Arc<auth::Client>, storage: storage::Client, graphql: graphql::Client, functions: functions::Client, sessions: SessionStorage) -> Self
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
fn new(subdomain: impl Into<String>, region: impl Into<String>) -> Result<Self, Error>
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
fn subdomain(self, subdomain: impl Into<String>) -> Self
```

Sets the cloud project subdomain.

##### `region`

```rust
fn region(self, region: impl Into<String>) -> Self
```

Sets the cloud project region.

##### `auth_url`

```rust
fn auth_url(self, url: impl Into<String>) -> Self
```

Overrides the auth service URL. `Self::build` validates it as an
append-safe HTTP(S) URL and removes trailing slashes.

##### `storage_url`

```rust
fn storage_url(self, url: impl Into<String>) -> Self
```

Overrides the storage service URL. `Self::build` validates it as an
append-safe HTTP(S) URL and removes trailing slashes.

##### `graphql_url`

```rust
fn graphql_url(self, url: impl Into<String>) -> Self
```

Overrides the GraphQL service URL. `Self::build` validates it as an
append-safe HTTP(S) URL and removes trailing slashes.

##### `functions_url`

```rust
fn functions_url(self, url: impl Into<String>) -> Self
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
fn http_client(self, client: reqwest::Client) -> Self
```

Uses a pre-configured `reqwest::Client` (connection pools, proxies…).

##### `role`

```rust
fn role(self, role: impl Into<String>) -> Self
```

Sets `x-hasura-role` on every request.

`Self::build` rejects values that cannot be encoded in an HTTP header,
but does not restrict the server-defined role vocabulary.

##### `header`

```rust
fn header(self, name: impl Into<String>, value: impl Into<String>) -> Self
```

Adds a header sent on every request. `Self::build` rejects names and
values that cannot be encoded as HTTP headers.

##### `headers`

```rust
fn headers(self, headers: HashMap<String, String>) -> Self
```

Sets the whole per-request header map. `Self::build` rejects names and
values that cannot be encoded as HTTP headers.

##### `admin_secret`

```rust
fn admin_secret(self, secret: impl Into<String>) -> Self
```

Enables the admin secret on storage/graphql/functions. **Never use in
client-side code** — it grants full admin access. `Self::build` rejects
a secret that cannot be encoded in an HTTP header.

##### `admin`

```rust
fn admin(self, options: AdminSessionOptions) -> Self
```

Enables an admin session with full options (role, session variables).
`Self::build` rejects any option that cannot be encoded as its
corresponding HTTP header.

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
before access-token expiry. `Self::build` rejects negative margins and
values too large to schedule without overflowing millisecond timestamps.

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
fields, invalid service URLs, invalid default or admin header names or
values, an invalid refresh margin, or server mode without an explicit
storage backend.

#### Trait implementations

- `Default`

## Enums

### `Error`

```rust
enum Error
```

The error type returned by every fallible SDK operation.

This enum is non-exhaustive because the SDK may gain new failure modes.
Downstream matches must include a wildcard arm.

#### Variants

| Variant | Description |
| --- | --- |
| `Api(Box<ApiError>)` | A request completed with a 3xx status other than 304, or a 4xx/5xx status. A GraphQL response carrying a non-empty `errors` array instead produces `Error::GraphQl`. Boxed to keep `Result<_, Error>` small (`clippy::result_large_err`). |
| `GraphQl(Box<GraphqlOperationError>)` | A GraphQL response carried a non-empty `errors` array, regardless of its HTTP status, or `crate::graphql::Operation::send` received no data. The structured errors, partial data, status, and headers are preserved in the payload. |
| `InvalidToken(String)` | An access token could not be decoded. |
| `Config(String)` | A caller-supplied value was invalid at the client boundary (for example, client configuration, a service URL, or a multipart MIME type). |
| `Storage(String)` | A session-storage backend failed (file/localStorage I/O). |
| `Http(reqwest::Error)` | A transport-level error from reqwest. |
| `Middleware(anyhow::Error)` | An error raised by a middleware in the chain. |
| `Json(serde_json::Error)` | A (de)serialization error. |

#### Methods

##### `api`

```rust
fn api(message: impl Into<String>, status: u16, body: serde_json::Value, headers: http::HeaderMap) -> Self
```

Builds an `Error::Api` from its parts.

##### `graphql`

```rust
fn graphql(errors: Vec<GraphqlError>, data: Option<serde_json::Value>, status: u16, headers: http::HeaderMap) -> Self
```

Builds an `Error::GraphQl` from its response parts.

##### `from_response`

```rust
fn from_response(status: u16, headers: http::HeaderMap, body: bytes::Bytes) -> Self
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

This enum is non-exhaustive because Nhost may expose additional services.
Downstream matches must include a wildcard arm.

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
