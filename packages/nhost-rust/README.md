# nhost (Rust SDK)

The Nhost SDK for Rust: an idiomatic async client for Nhost's Auth, Storage,
GraphQL, and Functions services. The auth and storage REST clients are generated
from the shared OpenAPI specs; the middleware chain (built on
[`reqwest-middleware`](https://crates.io/crates/reqwest-middleware)), session
handling, GraphQL, and Functions clients are hand-written.

## Quickstart

```rust,no_run
use nhost::Nhost;
use nhost::auth::SignInEmailPasswordRequest;
use nhost::session::MemoryStore;

#[tokio::main]
async fn main() -> Result<(), nhost::Error> {
    let client = Nhost::builder()
        .subdomain("local")
        .region("local")
        .session_store(MemoryStore::default())
        .build()?;

    client
        .auth
        .sign_in_email_password(SignInEmailPasswordRequest {
            email: "user@example.com".into(),
            password: "secret".into(),
        })
        .await?;

    // With a session store, the session was captured by the auth client; its
    // token is attached and refreshed automatically on subsequent requests.
    #[derive(serde::Deserialize)]
    struct Q {
        __typename: String,
    }
    let data: Q = client.graphql.query("query { __typename }").send().await?;
    println!("{}", data.__typename);
    Ok(())
}
```

Typed GraphQL with variables:

```rust,no_run
# async fn example(client: &nhost::Nhost) -> Result<(), nhost::Error> {
#[derive(serde::Deserialize)]
struct Todos {
    todos: Vec<Todo>,
}
#[derive(serde::Deserialize)]
struct Todo {
    id: String,
}

let data: Todos = client
    .graphql
    .query("query ($limit: Int!) { todos(limit: $limit) { id } }")
    .variable("limit", 10)
    .send()
    .await?;
# Ok(())
# }
```

Per-request customization returns a scoped client (no positional option args):

```rust,no_run
# async fn example(client: &nhost::Nhost) -> Result<(), nhost::Error> {
let editor = client.graphql.with_role("editor");
let data: serde_json::Value = editor.query("query { ok }").send().await?;
# Ok(())
# }
```

Storage conditional and range headers are typed on `GetFileParams`:

```rust,no_run
use nhost::{storage::GetFileParams, Nhost};
use reqwest::header::ETAG;

#[tokio::main]
async fn main() -> Result<(), nhost::Error> {
    let client = Nhost::new("my-subdomain", "eu-central-1")?;
    let response = client
        .storage
        .get_file(
            "file-id",
            Some(GetFileParams {
                if_none_match: Some("\"previous-etag\"".into()),
                range: Some("bytes=0-1023".into()),
                ..Default::default()
            }),
        )
        .await?;

    // `304 Not Modified` is a successful response with no body; response
    // metadata such as the current ETag remains available.
    if response.status == 304 {
        assert!(response.body.is_empty());
        println!("ETag: {:?}", response.headers.get(ETAG));
    }
    Ok(())
}
```

### Path parameters

Generated REST methods and Functions requests add each dynamic path component
with `Url::path_segments_mut().push()`. Its unconditional escaping of `%` and
`/` prevents a value from traversing the base path. Because `push()` silently
omits a segment exactly equal to `.` or `..`, the SDK maps those values to an
escaped spelling first; they are sent as `%252E` or `%252E%252E` so the segment
is preserved rather than dropped. An empty parameter remains an empty trailing
segment (`delete_file("")` requests `/v1/files/`), so validate item identifiers
when that URL could resolve to a collection route.

## Building a client

`Nhost::builder()` returns a fluent builder:

| Method                          | Effect                                              |
| ------------------------------- | --------------------------------------------------- |
| `.subdomain(..)` / `.region(..)`| Nhost Cloud project location                        |
| `.auth_url(..)` etc.            | Override an individual service URL                  |
| `.session_store(..)` / `.multi_user_session_store(..)` | Enables session management for one user or many (see [Sessions](#sessions)); without either the client keeps none |
| `.http_client(reqwest)`         | Reuse a configured `reqwest::Client`                |
| `.role(..)` / `.header(k, v)`   | Public-client defaults; omitted from internal `/token` refreshes |
| `.admin_secret(..)` / `.admin(..)` | Admin access on data services. **Not target-enforced:** these APIs compile and run on wasm/browser targets and send `x-hasura-admin-secret`; never call them in client-side code. Rejected together with a session store. |
| `.refresh_margin(secs)`         | Seconds before expiry at which a session is refreshed |

`Nhost::new("subdomain", "region")` is a fallible shortcut for a cloud client
without session management. It returns `Error::Config` for empty project fields.
The builder likewise rejects incomplete project configuration unless all four
service URLs are overridden.

## Sessions

A client manages sessions only when it is built with a session store. It then
saves the session returned by each sign-in or sign-up, attaches its access
token to every request, and refreshes it before it expires. Without one,
`session()`, `refresh_session()` and `clear_session()` return
`Error::NoSessionStore`, and requests carry only a token the caller supplies.

A client that acts for one user takes a `SessionStore`; a server that signs in
many users takes a `MultiUserSessionStore`:

| Builder method                        | Built-in stores                                        |
| ------------------------------------- | ------------------------------------------------------ |
| `.session_store(store)`               | `MemoryStore`, `FileStore` (a `0o600` JSON file, for CLIs), `LocalStorageStore` (browser, `wasm` feature) |
| `.multi_user_session_store(store)`    | `MultiUserMemoryStore` (one process)                   |

A server builds one client at startup and chooses, per request, whose session
to use. Both handles are cheap and share the client's connection pool:

```rust,no_run
# async fn example() -> Result<(), nhost::Error> {
use nhost::session::MultiUserMemoryStore;
use nhost::Nhost;

let client = Nhost::builder()
    .subdomain("local")
    .region("local")
    .multi_user_session_store(MultiUserMemoryStore::default())
    .build()?;

// Use a user's stored session. The ID must come from something you have
// verified, such as your own cookie session, never from a token's claims.
let ada = client.with_user_id("ada-user-id");
ada.graphql.query("query { __typename }").send::<serde_json::Value>().await?;

// Or act with a token the caller sent: attached as-is, never stored or refreshed.
let caller = client.with_access_token("caller-access-token");
caller.graphql.query("query { __typename }").send::<serde_json::Value>().await?;
# Ok(())
# }
```

On a multi-user client, a request that names no user sends no token rather than
someone else's; the store is never asked. On a single-user client,
`with_user_id` uses the stored session only if it is that user's.

### Your own store

Replicas that share sessions implement `MultiUserSessionStore` over a shared
store such as Redis or a database. It is plain key-value storage: the SDK
decides which session a request gets, and passes the user ID in. The methods are
async, and the traits use [`async-trait`](https://crates.io/crates/async-trait)
so a client can hold any store; `nhost::session::async_trait` is re-exported
for implementing them. Errors are boxed (`session::BoxError`) and reach the
caller as `Error::Storage`, which keeps the original error for downcasting. Both
traits are implemented for `Arc<T>` and `Box<T>`, so you can keep a handle to
the store you pass in, or choose it at runtime.

Concurrent refreshes of one session collapse into a single request, and users
refresh independently. The auth service rotates the refresh token on every
refresh, so when replicas share a store, the slower replica's refresh is
rejected with `401` after the faster one has saved the rotated session. The SDK
then calls `delete_if_refresh_token`, which deletes the session only if it
still holds the rejected token and otherwise returns the newer one. Its default
loads, compares and deletes in separate calls; override it to do that in one
atomic step (a Redis script, a conditional `DELETE`), or a session saved between
those calls is deleted.

A failure to read, save or delete a session fails the request, rather than
sending it as nobody or reporting a sign-in that was not saved.

An admin secret cannot be combined with a session store, and a
`with_access_token` handle on an admin client fails Storage, GraphQL and
Functions requests: the GraphQL engine checks the admin secret before the token,
so the request would run as admin and silently ignore the user. Use two clients,
or act as a user with `AdminSessionOptions::role` and `session_variables`.

### Assembling the clients yourself

For full control over the request pipeline, build the four service clients, a
dedicated middleware-free, sink-free auth client for session refreshes, and the
session store directly and hand them to `Nhost::from_clients`.
`SetRole` and `SetHeaders` require a `middleware::HeaderPriority`:
use `Default` for global defaults equivalent to `NhostBuilder::role`/`header`,
and reserve `Scoped` for per-client overrides.

```rust,no_run
use nhost::http::Middleware;
use nhost::middleware::{AttachToken, HeaderPriority, SessionRefresh, SetHeaders};
use nhost::session::{MemoryStore, SessionManager};
use nhost::{auth, functions, graphql, service_url, storage, Nhost, Service};
use std::collections::HashMap;
use std::sync::Arc;

let http = reqwest::Client::new();
let sessions = SessionManager::new(MemoryStore::default());
let url = |svc| {
    service_url(svc, Some("abcdefgh"), Some("eu-central-1"), None)
        .expect("valid project configuration")
};

let refresh_auth = Arc::new(auth::Client::new(
    url(Service::Auth),
    http.clone(),
    Vec::new(),
));

let middleware: Vec<Arc<dyn Middleware>> = vec![
    Arc::new(SetHeaders {
        headers: HashMap::from([("x-sdk-client".into(), "custom".into())]),
        priority: HeaderPriority::Default,
    }),
    Arc::new(SessionRefresh {
        auth: refresh_auth.clone(),
        sessions: sessions.clone(),
        margin: nhost::DEFAULT_REFRESH_MARGIN_SECONDS,
    }),
    Arc::new(AttachToken {
        sessions: Some(sessions.clone()),
        service_url: url(Service::Auth),
    }),
];

let client = Nhost::from_clients(
    auth::Client::new(url(Service::Auth), http.clone(), middleware.clone())
        .with_session_capture(sessions.clone()),
    refresh_auth,
    storage::Client::new(url(Service::Storage), http.clone(), middleware.clone()),
    graphql::Client::new(url(Service::Graphql), http.clone(), middleware.clone()),
    functions::Client::new(url(Service::Functions), http, middleware),
    Some(sessions),
);
```

Pass the same `SessionManager` that the session middleware was built with,
otherwise `client.session()` and the middleware will disagree. Keep
`refresh_auth` middleware-free and do not enable session capture:
`session::refresh_once` owns that response's single store write, and a refresh
client carrying `SessionRefresh` can recurse while holding the refresh lock when
its guarded auth base differs from `refresh_auth`'s base. Middleware installed only
on the public auth client does not run for `Nhost::refresh_session`; configure
required default headers on the underlying `reqwest::Client` shared with
`refresh_auth`. The public service client constructors accept
base URLs verbatim, bypassing builder validation and
normalization; use `service_url` or supply an HTTP(S) base without userinfo, a
query, a fragment, or trailing slashes. Middleware order
is also significant: defaults and each client's scoped middleware must run
before `SessionRefresh` so an `Authorization` override can suppress refresh;
all four built-in clients preserve that ordering. Header priorities then settle
conflicts among middleware writes, while request-built headers remain final.

A builder-default `Authorization` header is sent on every request and therefore
disables automatic refresh for that client. The stored session can go stale;
only configure such a default when the caller owns token lifecycle management.

## Features

TLS backend (native builds — pick one; both are inert on wasm):

| Feature      | Default | Backend                          |
| ------------ | ------- | -------------------------------- |
| `rustls-tls` | yes     | rustls (pure-Rust, no OpenSSL)   |
| `native-tls` | no      | the platform's OpenSSL/SecureTransport/SChannel |

```toml
# Cargo.toml — use OpenSSL instead of the default rustls
nhost = { version = "...", default-features = false, features = ["native-tls"] }
```

### WebAssembly (browser) support

Enable the `wasm` feature to build the SDK for web frontends
(`wasm32-unknown-unknown`). The feature is required on that target, not
optional: without it the clock is `std::time`, whose `SystemTime::now()` panics
on `wasm32`, and no `localStorage` backend is compiled. Building for `wasm32`
without it therefore fails at compile time rather than at the first token
refresh. The browser `reqwest` futures are `!Send`;
`reqwest-middleware`'s `Middleware` trait is `?Send` on `wasm32` to match, and
`session::LocalStorageStore` persists the session in `localStorage` under the same
`"nhostSession"` key as `@nhost/nhost-js`, so sessions are interoperable on the
same origin. The persisted session includes the long-lived refresh token, and
`localStorage` is readable by any script on the origin, so an XSS can expose a
durable credential. Applications with a stricter threat model should pass a
different store to [`NhostBuilder::session_store`].

```toml
nhost = { version = "...", default-features = false, features = ["wasm"] }
```

```sh
cargo build --target wasm32-unknown-unknown --no-default-features --features wasm
```

Randomness for PKCE uses `getrandom`'s JS backend on the web. The SDK enables
`getrandom`'s `wasm_js` feature automatically, so no application-specific
backend configuration is required. Drive the (`!Send`) futures with
`wasm_bindgen_futures::spawn_local`. `FileStore` is native-only; in the browser,
pass `LocalStorageStore::new()` (which returns `None` when `localStorage` is
unavailable) to `.session_store(..)`.

## Layout

| Module       | Contents                                                     |
| ------------ | ------------------------------------------------------------ |
| crate root   | `Nhost`, `NhostBuilder`, `Error`                             |
| `auth`       | generated auth REST client + hand-written PKCE helpers       |
| `storage`    | generated storage REST client                                |
| `graphql`    | typed GraphQL client (`query(..).variable(..).send::<T>()`)  |
| `functions`  | serverless Functions client                                  |
| `session`    | `StoredSession`, JWT decoding, storage backends, refresh     |
| `http`       | `reqwest-middleware` layer + buffered `send`                 |
| `middleware` | session refresh, token attach, role/header/admin             |
| `error`      | the `Error` enum + `ApiError`                                |

## Development

```sh
./gen.sh                 # regenerate the auth/storage clients
cargo test --test unit   # offline unit tests
make dev-env-up          # start a local backend
make integration-local   # run integration tests against it
```
