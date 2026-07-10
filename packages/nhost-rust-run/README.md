# nhost-run

Helpers for writing [Nhost Run](https://docs.nhost.io/products/run) services in
Rust. It wires the health-check endpoint the platform probes and manages the
HTTP server lifecycle so your service only has to define its routes.

It is a **native-only** companion to the [`nhost`](../nhost-rust) client crate,
kept as a separate crate so the client stays dependency-light and keeps
compiling for `wasm32` (a server does not). Built on [`axum`] + [`tokio`].

## What it does

Nhost Run probes `GET /healthz` on the port configured under `[healthCheck]`;
the endpoint must return `200` within 5 seconds or the container is restarted.
`nhost-run` builds that endpoint from a health closure and runs a server that
shuts down gracefully on `SIGTERM`.

## Usage

```rust
use std::net::SocketAddr;
use axum::{routing::get, Router};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let app = Router::new().route("/", get(|| async { "hello from an Nhost Run service" }));

    // Ok(()) -> 200; Err(msg) -> 503 and the platform restarts the container.
    nhost_run::serve(SocketAddr::from(([0, 0, 0, 0], 8080)), app, || async {
        Ok::<(), String>(())
    })
    .await
}
```

Match the port in your `nhost-run-service.toml`:

```toml
[[ports]]
port = 8080
type = "http"
publish = true

[healthCheck]
port = 8080
```

If you already build your own router, use `nhost_run::healthz_router(health)` and
`merge` it yourself instead of calling `serve`.

## API

- `serve(addr, app, health).await` — serve `app` + `/healthz`, graceful shutdown on SIGTERM.
- `healthz_router(health) -> axum::Router` — a router with just `GET /healthz`, to merge.
- `health: Fn() -> Future<Output = Result<(), String>>` — `Ok(())` → 200, `Err(msg)` → 503.
