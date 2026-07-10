//! Helpers for writing [Nhost Run](https://docs.nhost.io/products/run) services
//! in Rust.
//!
//! Nhost Run probes `GET /healthz` on the port configured under `[healthCheck]`;
//! the endpoint must return `200` within 5 seconds or the container is
//! restarted. This crate turns a health closure into that endpoint and runs an
//! [`axum`] server that shuts down gracefully on `SIGTERM`.
//!
//! It is a native-only companion to the [`nhost`] client crate, kept separate
//! so the client stays dependency-light and keeps compiling for `wasm32`
//! (a server does not).
//!
//! ```no_run
//! use std::net::SocketAddr;
//! use axum::{routing::get, Router};
//!
//! #[tokio::main]
//! async fn main() -> std::io::Result<()> {
//!     let app = Router::new().route("/", get(|| async { "hello from Nhost Run" }));
//!
//!     // Ok(()) -> 200; Err(msg) -> 503 and the platform restarts the container.
//!     nhost_run::serve(SocketAddr::from(([0, 0, 0, 0], 8080)), app, || async {
//!         Ok::<(), String>(())
//!     })
//!     .await
//! }
//! ```

use std::future::Future;
use std::net::SocketAddr;

use axum::http::StatusCode;
use axum::routing::get;
use axum::Router;

/// Builds a [`Router`] exposing the Nhost Run `GET /healthz` probe backed by
/// `health`. Merge it into your own router (or let [`serve`] do it) to mount the
/// endpoint. `health` returning `Ok(())` serves `200`; `Err(msg)` serves `503`
/// with `msg` as the body.
///
/// `health` must return well within the platform's 5-second probe timeout, so
/// it should check liveness cheaply rather than making slow downstream calls.
pub fn healthz_router<H, Fut>(health: H) -> Router
where
    H: Fn() -> Fut + Clone + Send + Sync + 'static,
    Fut: Future<Output = Result<(), String>> + Send + 'static,
{
    Router::new().route(
        "/healthz",
        get(move || {
            let health = health.clone();
            async move {
                match health().await {
                    Ok(()) => (StatusCode::OK, String::new()),
                    Err(msg) => (StatusCode::SERVICE_UNAVAILABLE, msg),
                }
            }
        }),
    )
}

/// Serves `app` on `addr`, mounting the `GET /healthz` probe from `health`
/// alongside it, and blocks until the process receives `SIGINT`/`SIGTERM`,
/// draining in-flight requests before returning.
///
/// # Errors
///
/// Returns an error if binding `addr` fails or the server errors while running.
pub async fn serve<H, Fut>(addr: SocketAddr, app: Router, health: H) -> std::io::Result<()>
where
    H: Fn() -> Fut + Clone + Send + Sync + 'static,
    Fut: Future<Output = Result<(), String>> + Send + 'static,
{
    let app = app.merge(healthz_router(health));
    let listener = tokio::net::TcpListener::bind(addr).await?;

    axum::serve(listener, app.into_make_service())
        .with_graceful_shutdown(shutdown_signal())
        .await
}

/// Resolves when the process receives `SIGINT` (Ctrl-C) or, on Unix, `SIGTERM`
/// (the signal the Nhost Run platform sends to stop a container).
async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };

    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut sig) => {
                sig.recv().await;
            }
            Err(_) => std::future::pending::<()>().await,
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = ctrl_c => {},
        () = terminate => {},
    }
}
