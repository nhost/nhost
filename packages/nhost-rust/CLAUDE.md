# nhost-rust — agent notes

Idiomatic async Rust SDK for Nhost (reqwest + reqwest-middleware + serde). The
public surface is Rust-native (builder, typed GraphQL, `Error` enum), not a port
of `@nhost/nhost-js`. See `DESIGN_idiomatic_rebuild.md` at the worktree root.

## Two parts

1. **Generated** (`src/auth/client.rs`, `src/storage/client.rs`) — produced by
   the `rust` plugin in `tools/codegen` from the shared OpenAPI specs. **Never
   hand-edit.** Regenerate with `./gen.sh` (uses the `codegen` binary or
   `go run`, then `rustfmt --edition 2021`). Files carry a generated header and
   `#![allow(...)]` so they don't trip clippy. Methods return the payload `T`
   directly (void → `()`), take no `headers` arg; per-request customization is
   via scoped `with_role`/`with_headers` clones.
2. **Hand-written runtime** — `error`, `http`, `middleware`, `session`,
   `graphql`, `functions`, the top-level builder (`client.rs`, re-exported from
   `lib.rs`), and `auth/pkce.rs`.

## Key design points

- **Middleware = `reqwest-middleware`.** Each middleware impls
  `reqwest_middleware::Middleware`; the trait future is `?Send` on `wasm32`.
  `crate::http::build_client` assembles a `ClientWithMiddleware` from a base
  `reqwest::Client` + an ordered `Vec<Arc<dyn Middleware>>`. Middleware is
  request-side only (attach token, refresh, role/headers/admin).
- **Session capture is NOT middleware.** A browser `reqwest::Response` cannot be
  rebuilt from buffered bytes, so the JS SDK's response-sniffing middleware is
  impossible on wasm. Instead `crate::http::send` buffers the response and, when
  the client carries a `session_sink` (only the auth client does), extracts a
  session into `SessionStorage`.
- **Refresh:** the session-refresh middleware uses a dedicated bare
  `Arc<auth::Client>` (no middleware) so refreshing doesn't recurse; the refresh
  serializes via a `tokio::sync::Mutex` in `SessionStorage`.
- **`Backend` returns `Result`** (`Error::Storage` on file/localStorage I/O);
  don't silently swallow errors.
- **`Error` is a real enum** (`Api(Box<ApiError>)`, `GraphQl`, `InvalidToken`,
  `Config`, `Storage`, `Http`, `Middleware`, `Json`). Boxed `ApiError` keeps
  `Result<_, Error>` small (there's a `<= 32` size test).
- clippy runs with `-D warnings` on the hand-written code (generated is
  allow-all).

## Feature matrix (TLS + wasm)

- TLS is crate-selected. reqwest 0.13 renamed its pure-Rust backend feature to
  `rustls`; our `rustls-tls` (default) forwards to `reqwest/rustls`, `native-tls`
  to `reqwest/native-tls`. Base reqwest pulls `json`+`multipart`+`form`+`query`
  (the last two are feature-gated in 0.13 and used by generated clients).
- The `wasm` feature targets the browser (`wasm32-unknown-unknown`). The wasm
  `reqwest::Client` state is `Send + Sync`; only its futures are `!Send`. The
  sole `!Send` state is `web_sys::Storage` in `LocalStorage`, so
  `session.rs` has a **`#[cfg(feature = "wasm")] unsafe impl Send + Sync for
  SessionStorage`** (sound: wasm is single-threaded). This lets every
  middleware/client satisfy `Middleware: Send + Sync` on both targets and keeps
  the cfg-splits minimal:
  - `Backend`/`ChangeCallback` drop `Send + Sync` under `feature = "wasm"`;
  - `#[cfg_attr(target_arch = "wasm32", async_trait(?Send))]` on every
    `Middleware` impl (matching reqwest-middleware);
  - `std::time` → `web_time`; `FileStorage` gated off wasm, `LocalStorage`
    (`cfg(all(feature = "wasm", target_arch = "wasm32"))`, key `"nhostSession"`)
    gated on; `detect_storage` returns it in the browser;
  - crate-level `#![cfg_attr(feature = "wasm", allow(clippy::arc_with_non_send_sync))]`.
- getrandom on wasm: `.cargo/config.toml` sets `--cfg getrandom_backend="wasm_js"`.
- The nix check builds the whole matrix: clippy (rustls), `native-tls` build,
  clippy (wasm), and a real `wasm32-unknown-unknown` build (needs the devshell's
  wasm32 std — not available in a bare sandbox).

## Tests

- Offline: `cargo test --test unit` (pkce, service URLs via the builder, JWT
  decode, graphql/functions/error via wiremock, scoped `with_role`/`with_headers`).
- Integration: `tests/integration.rs`, gated on `NHOST_LOCAL_BACKEND`; hits the
  local backend (signup, graphql `__typename`, storage upload, functions
  `/echo`) with the default `Nhost::new("local", "local")` client.
