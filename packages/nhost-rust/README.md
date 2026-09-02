# nhost (Rust SDK)

The Nhost SDK for Rust: an idiomatic async client for Nhost's Auth, Storage,
GraphQL, and Functions services. The auth and storage REST clients are generated
from the shared OpenAPI specs; the middleware chain (built on
[`reqwest-middleware`](https://crates.io/crates/reqwest-middleware)), session
handling, GraphQL, and Functions clients are hand-written.

## Quickstart

```rust
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

```rust
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
```

Per-request customization returns a scoped client (no positional option args):

```rust
let editor = client.graphql.with_role("editor");
let data: serde_json::Value = editor.query("query { ok }").send().await?;
```

## Building a client

`Nhost::builder()` returns a fluent builder:

| Method                          | Effect                                              |
| ------------------------------- | --------------------------------------------------- |
| `.subdomain(..)` / `.region(..)`| Nhost Cloud project location                        |
| `.auth_url(..)` etc.            | Override an individual service URL                  |
| `.storage(backend)`             | Session store (defaults to in-memory / localStorage)|
| `.http_client(reqwest)`         | Reuse a configured `reqwest::Client`                |
| `.role(..)` / `.header(k, v)`   | Sent on every request                               |
| `.admin_secret(..)` / `.admin(..)` | Admin access on data services (**server only**)  |
| `.server()`                     | Attach token, never auto-refresh; requires `.storage(..)` |
| `.without_session_management()` | No token attach / refresh                           |

`Nhost::new("subdomain", "region")` is a shortcut for a client-side cloud
client with defaults.

### Assembling the clients yourself

For full control over the request pipeline, build the four service clients (and
the session store) directly and hand them to `Nhost::from_clients`, which is the
Rust counterpart of `new NhostClient(..)` in `@nhost/nhost-js`:

```rust
let http = reqwest::Client::new();
let sessions = SessionStorage::new(session::detect_storage());
let url = |svc| service_url(svc, Some("abcdefgh"), Some("eu-central-1"), None);

let middleware: Vec<Arc<dyn Middleware>> = vec![
    Arc::new(AttachToken { storage: sessions.clone() }),
    Arc::new(MyTracingMiddleware),
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

Pass the same `SessionStorage` to the constructor that the session middleware
uses, or `client.session()` and the middleware will disagree.

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
