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

#[tokio::main]
async fn main() -> Result<(), nhost::Error> {
    let client = Nhost::builder()
        .subdomain("local")
        .region("local")
        .build()?;

    client
        .auth
        .sign_in_email_password(SignInEmailPasswordRequest {
            email: "user@example.com".into(),
            password: "secret".into(),
        })
        .await?;

    // The session was captured by the auth client; the token is attached and
    // refreshed automatically on subsequent requests.
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
| `.storage(backend)`             | Session store (defaults to in-memory / localStorage)|
| `.http_client(reqwest)`         | Reuse a configured `reqwest::Client`                |
| `.role(..)` / `.header(k, v)`   | Public-client defaults; omitted from internal `/token` refreshes |
| `.admin_secret(..)` / `.admin(..)` | Admin access on data services. **Not target-enforced:** these APIs compile and run on wasm/browser targets and send `x-hasura-admin-secret`; never call them in client-side code. |
| `.server()`                     | Attach token, never auto-refresh; requires `.storage(..)` |
| `.without_session_management()` | No token attach / refresh                           |

`Nhost::new("subdomain", "region")` is a fallible shortcut for a client-side
cloud client with defaults. It returns `Error::Config` for empty project fields.
The builder likewise rejects incomplete project configuration unless all four
service URLs are overridden.

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
use nhost::session::{self, SessionStorage};
use nhost::{auth, functions, graphql, service_url, storage, Nhost, Service};
use std::collections::HashMap;
use std::sync::Arc;

let http = reqwest::Client::new();
let sessions = SessionStorage::new(session::detect_storage());
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
        storage: sessions.clone(),
        margin: nhost::DEFAULT_REFRESH_MARGIN_SECONDS,
    }),
    Arc::new(AttachToken {
        storage: sessions.clone(),
    }),
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

Pass the same `SessionStorage` that the session middleware was built with,
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
(`wasm32-unknown-unknown`). The browser `reqwest` futures are `!Send`;
`reqwest-middleware`'s `Middleware` trait is `?Send` on `wasm32` to match, and
the session store persists in `localStorage` by default — under the same
`"nhostSession"` key as `@nhost/nhost-js`, so sessions are interoperable on the
same origin.

```toml
nhost = { version = "...", default-features = false, features = ["wasm"] }
```

```sh
cargo build --target wasm32-unknown-unknown --no-default-features --features wasm
```

Randomness for PKCE uses `getrandom`'s JS backend on the web; the crate's
`.cargo/config.toml` sets the required `--cfg getrandom_backend="wasm_js"` for
the `wasm32-unknown-unknown` target. Drive the (`!Send`) futures with
`wasm_bindgen_futures::spawn_local`. `FileStorage` is native-only; construct an
[`Nhost`] client as usual and it will pick up `localStorage` automatically.

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
