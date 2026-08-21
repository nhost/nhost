# nhost-rust — agent notes

Idiomatic async Rust SDK for Nhost (reqwest + serde), mirroring `@nhost/nhost-js`
and the Python/Go SDKs.

## Two parts

1. **Generated** (`src/auth/client.rs`, `src/storage/client.rs`) — produced by
   the `rust` plugin in `tools/codegen` from the shared OpenAPI specs. **Never
   hand-edit.** Regenerate with `./gen.sh` (uses the `codegen` binary or
   `go run`, then `rustfmt --edition 2021`). Files carry a generated header and
   `#![allow(...)]` so they don't trip clippy.
2. **Hand-written runtime** — `fetch`, `middleware`, `session`, `graphql`,
   `functions`, the top-level factory (`client.rs`, re-exported from `lib.rs`),
   and `auth/pkce.rs`.

## Key design points

- **Buffered responses:** `fetch::Response` holds `{ status, headers, body:
  Bytes }`. The base fetch buffers the reqwest body so middleware can read it
  (e.g. `update_session_from_response`) without consuming it downstream. This
  is how Rust sidesteps reqwest's single-consume `Response` body.
- **Async middleware:** `FetchFn` is an `#[async_trait]` trait; `ChainFunction`
  is `Arc<dyn Fn(Arc<dyn FetchFn>) -> Arc<dyn FetchFn>>`. Each middleware is a
  struct holding `next` + config.
- **Refresh:** the session-refresh middleware uses a dedicated bare
  `Arc<auth::Client>` (no middleware) to avoid the mutate-after-`Arc` problem;
  the refresh serializes via a `tokio::sync::Mutex` in `SessionStorage`.
- **`Error` is boxed** (`Api(Box<ApiError>)`) to keep `Result<_, Error>` small
  (guards `clippy::result_large_err`; there's a size test).
- clippy runs with `-D warnings` on the hand-written code (generated is
  allow-all); `client_data_json`-style names keep clippy's
  `upper_case_acronyms` happy.

## Feature matrix (TLS + wasm)

- TLS is crate-selected, not hard-wired. `reqwest` is pulled with only `json` +
  `multipart`; the `rustls-tls` (default) and `native-tls` features forward to
  reqwest. Don't add a TLS feature to the base reqwest dep.
- The `wasm` feature targets the browser (`wasm32-unknown-unknown`). The wasm
  reqwest client + its futures are `!Send`, so the feature:
  - splits `FetchFn` and `Backend` into cfg'd defs (with/without `Send + Sync`
    supertraits) and cfg's the `ChainFunction`/`ChangeCallback` type aliases;
  - applies `#[cfg_attr(feature = "wasm", async_trait(?Send))]` to every
    `FetchFn` impl (`fetch.rs` `BaseFetch` + the 6 middlewares);
  - swaps `std::time` -> `web_time` (native `SystemTime::now()` panics on wasm);
  - gates `FileStorage` to non-wasm and adds a `LocalStorage` backend
    (`cfg(all(feature = "wasm", target_arch = "wasm32"))`, key `"nhostSession"`
    for JS-SDK parity); `detect_storage` returns it in the browser;
  - crate-level `#![cfg_attr(feature = "wasm", allow(clippy::arc_with_non_send_sync))]`
    (the single-threaded wasm Arcs are intentionally `!Send`).
- getrandom on wasm: `rand` pulls getrandom 0.3; the wasm32 target dep enables
  its `wasm_js` feature and `.cargo/config.toml` sets
  `--cfg getrandom_backend="wasm_js"`. No source change to `pkce.rs`.
- The nix check builds the whole matrix: clippy (rustls), `native-tls` build
  (needs openssl+pkg-config in checkDeps), clippy (wasm), and a real
  `wasm32-unknown-unknown` build. `pkgs.rustc` ships the wasm32 std.

## Tests

- Offline: `cargo test --test unit` (pkce RFC vector, service URLs, JWT decode,
  graphql/functions/error via wiremock, middleware header injection).
- Integration: `tests/integration.rs`, gated on `NHOST_LOCAL_BACKEND`; hits the
  local backend (signup, graphql `__typename`, functions `/echo`). Uses the
  default client — the current CLI serves a valid, publicly-trusted Let's
  Encrypt cert for `*.local.nhost.run`, so no TLS override is needed.
