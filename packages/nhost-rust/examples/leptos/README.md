# Nhost + Leptos (client-side / WASM) example

A minimal [Leptos](https://leptos.dev) client-side app that uses the Nhost Rust
SDK compiled to WebAssembly. It shows the SDK's `wasm` feature in a real web
frontend: email/password sign-in, session display, sign-out, and a GraphQL
query against the example backend's seeded `movies` table. The session is
persisted in `localStorage` (key `nhostSession`, shared with `@nhost/nhost-js`),
so it survives a page reload.

It talks to the example backend under
[`packages/nhost-rust/build/backend`](../../build/backend) — the same backend
used by the SDK's integration tests. That backend seeds a `movies` table
(readable by the `public` role), so the movie list loads immediately, even
before signing in.

The SDK is enabled with `default-features = false, features = ["wasm"]` (see
`Cargo.toml`). Its `!Send` futures are driven with `leptos::task::spawn_local`
and the client is shared via `Rc` — the browser is single-threaded.

## Prerequisites

```sh
rustup target add wasm32-unknown-unknown
cargo install trunk            # WASM bundler / dev server
```

A backend to talk to. The example points at the local example backend by
default:

```sh
# from packages/nhost-rust
./dev-env.sh up
```

For a cloud project instead, edit `make_client()` in `src/main.rs` and set
`subdomain` / `region` (or the per-service `*_url`s).

## Run

```sh
# from packages/nhost-rust/examples/leptos
trunk serve --open
```

Trunk builds the crate for `wasm32-unknown-unknown` and serves it. The
`getrandom` JS-backend flag needed for PKCE is inherited from the SDK's
`../../.cargo/config.toml` (`--cfg getrandom_backend="wasm_js"`), so no extra
configuration is required.

> Note: because the local backend uses a self-signed certificate, your browser
> may require you to accept it once (open the auth URL directly and proceed).

## Build only (no server)

```sh
cargo build --target wasm32-unknown-unknown
```
