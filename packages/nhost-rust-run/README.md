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
`nhost-run` mounts that endpoint onto your app and runs a server that shuts down
gracefully on `SIGTERM`.

## Usage

```rust
use std::net::SocketAddr;
use axum::{routing::get, Router};
use nhost_run::RunService;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let app = Router::new().route("/", get(|| async { "hello from an Nhost Run service" }));

    RunService::new(app)
        // Ok(()) -> 200; Err(msg) -> 503 and the platform restarts the container.
        .health(|| async { Ok::<(), String>(()) })
        .serve(SocketAddr::from(([0, 0, 0, 0], 8080)))
        .await
}
```

The health check is optional — omit `.health(...)` and `GET /healthz` always
answers `200`, matching the Go, JavaScript and Python `nhost-*-run` packages.

Match the port in your `nhost-run-service.toml`:

```toml
[[ports]]
port = 8080
type = "http"
publish = true

[healthCheck]
port = 8080
```

If you drive the server yourself, call `.into_router()` to get your app with
`GET /healthz` merged in, and run it however you like.

## API

- `RunService::new(app)` — start a service from your `axum::Router`.
- `.health(f)` — optional health check; `Ok(())` → 200, `Err(msg)` → 503. Omit for an always-200 probe.
- `.serve(addr).await` — serve app + `/healthz`, graceful shutdown on SIGTERM.
- `.into_router() -> axum::Router` — app with `/healthz` merged in, to run yourself.
- `health: Fn() -> Future<Output = Result<(), String>>`.
