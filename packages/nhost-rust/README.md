# nhost (Rust SDK)

The Nhost SDK for Rust: a small, idiomatic async client for Nhost's Auth,
Storage, GraphQL, and Functions services. It mirrors the architecture of
[`@nhost/nhost-js`](../nhost-js) and the Python and Go SDKs: the auth and
storage REST clients are generated from the shared OpenAPI specs, while the
fetch middleware chain, session handling, GraphQL, and Functions clients are
hand-written.

## Quickstart

```rust
use nhost::{create_client, Options};
use nhost::auth::SignInEmailPasswordRequest;

#[tokio::main]
async fn main() -> Result<(), nhost::fetch::Error> {
    let client = create_client(Options {
        subdomain: Some("local".to_string()),
        region: Some("local".to_string()),
        ..Default::default()
    });

    client
        .auth
        .sign_in_email_password(
            SignInEmailPasswordRequest {
                email: "user@example.com".to_string(),
                password: "secret".to_string(),
                options: None,
                code_challenge: None,
            },
            None,
        )
        .await?;

    // The session was captured by middleware; the token is attached and
    // refreshed automatically on subsequent requests.
    let resp = client
        .graphql
        .request("query { __typename }", None, None, None)
        .await?;

    println!("{:?}", resp.body.data);
    Ok(())
}
```

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
(`wasm32-unknown-unknown`). It relaxes the `Send + Sync` bounds (the browser
`reqwest` client and its futures are `!Send`), uses a browser-compatible clock,
and persists the session in `localStorage` by default — under the same
`"nhostSession"` key as `@nhost/nhost-js`, so sessions are interoperable on the
same origin.

```toml
nhost = { version = "...", default-features = false, features = ["wasm"] }
```

```sh
cargo build --target wasm32-unknown-unknown --no-default-features --features wasm
```

See [`examples/leptos`](examples/leptos) for a runnable client-side Leptos app
built on this feature.

Randomness for PKCE uses `getrandom`'s JS backend on the web; the crate's
`.cargo/config.toml` sets the required `--cfg getrandom_backend="wasm_js"` for
the `wasm32-unknown-unknown` target. Drive the (`!Send`) futures with
`wasm_bindgen_futures::spawn_local`. `FileStorage` is native-only; construct a
[`NhostClient`] as usual and it will pick up `localStorage` automatically.

## Layout

| Module       | Contents                                                     |
| ------------ | ------------------------------------------------------------ |
| crate root   | `NhostClient`, `create_client`/`create_server_client`, URLs  |
| `auth`       | generated auth REST client + hand-written PKCE helpers       |
| `storage`    | generated storage REST client                                |
| `graphql`    | GraphQL client                                               |
| `functions`  | serverless Functions client                                  |
| `session`    | `StoredSession`, JWT decoding, storage backends, refresh     |
| `fetch`      | fetch pipeline (`FetchFn`, `ChainFunction`, `Error`)         |
| `middleware` | session refresh, token attachment, role/header/admin         |

## Development

```sh
./gen.sh                 # regenerate the auth/storage clients
cargo test --test unit   # offline unit tests
make dev-env-up          # start a local backend
make integration-local   # run integration tests against it
```

Client selection:

- `create_client` — app client with automatic refresh + token attachment.
- `create_server_client` — trusted server contexts; requires explicit
  per-request `storage` to avoid leaking sessions across users.
- `create_nhost_client` — a bare client you configure yourself.
