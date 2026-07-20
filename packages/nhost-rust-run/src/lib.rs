//! Helpers for writing [Nhost Run](https://docs.nhost.io/products/run) services
//! in Rust.
//!
//! Nhost Run probes `GET /healthz` on the port configured under `[healthCheck]`;
//! the endpoint must return `200` within 5 seconds or the container is
//! restarted. [`RunService`] mounts that endpoint onto your [`axum`] app and
//! runs a server that shuts down gracefully on `SIGTERM`.
//!
//! It is a native-only companion to the [`nhost`] client crate, kept separate
//! so the client stays dependency-light and keeps compiling for `wasm32`
//! (a server does not).
//!
//! ```no_run
//! use std::net::SocketAddr;
//! use axum::{routing::get, Router};
//! use nhost_run::RunService;
//!
//! #[tokio::main]
//! async fn main() -> std::io::Result<()> {
//!     let app = Router::new().route("/", get(|| async { "hello from Nhost Run" }));
//!
//!     RunService::new(app)
//!         // Optional: Ok(()) -> 200, Err(msg) -> 503 (platform restarts the
//!         // container). Without a health check /healthz always answers 200.
//!         .health(|| async { Ok::<(), String>(()) })
//!         .serve(SocketAddr::from(([0, 0, 0, 0], 8080)))
//!         .await
//! }
//! ```

use std::future::Future;
use std::net::SocketAddr;
use std::pin::Pin;
use std::sync::Arc;

use axum::http::StatusCode;
use axum::routing::get;
use axum::Router;

/// A boxed health-check future, so the check can be stored without leaking its
/// concrete future type into [`RunService`].
type HealthFuture = Pin<Box<dyn Future<Output = Result<(), String>> + Send>>;

/// A type-erased health check: `Ok(())` → `200`, `Err(msg)` → `503` with `msg`.
type HealthFn = Arc<dyn Fn() -> HealthFuture + Send + Sync>;

/// Builder for an Nhost Run service: your [`axum`] app plus the platform's
/// `GET /healthz` probe, served with graceful shutdown.
///
/// The health check is **optional**. Without one, `GET /healthz` always answers
/// `200` (the service is healthy as long as it can accept connections); set one
/// with [`health`](RunService::health) to gate readiness on your own liveness
/// signal. This mirrors the Go, JavaScript and Python `nhost-*-run` packages,
/// where the health check may be omitted for the same default.
#[must_use]
pub struct RunService {
    app: Router,
    health: Option<HealthFn>,
}

impl RunService {
    /// Starts a service from your application router. Until you set a health
    /// check with [`health`](Self::health), `GET /healthz` answers `200`.
    pub fn new(app: Router) -> Self {
        Self { app, health: None }
    }

    /// Sets the health check backing `GET /healthz`. Returning `Ok(())` serves
    /// `200`; `Err(msg)` serves `503` with `msg` as the body, so the platform
    /// restarts the container.
    ///
    /// It must return well within the platform's 5-second probe timeout, so it
    /// should check liveness cheaply rather than making slow downstream calls.
    pub fn health<H, Fut>(mut self, health: H) -> Self
    where
        H: Fn() -> Fut + Send + Sync + 'static,
        Fut: Future<Output = Result<(), String>> + Send + 'static,
    {
        self.health = Some(Arc::new(move || Box::pin(health())));
        self
    }

    /// Consumes the builder and returns the [`Router`] with `GET /healthz`
    /// merged into your app. Use this when you drive the server yourself;
    /// prefer [`serve`](Self::serve) otherwise.
    pub fn into_router(self) -> Router {
        let health = self.health;
        let healthz = get(move || {
            let health = health.clone();
            async move {
                match health {
                    None => (StatusCode::OK, String::new()),
                    Some(check) => match check().await {
                        Ok(()) => (StatusCode::OK, String::new()),
                        Err(msg) => (StatusCode::SERVICE_UNAVAILABLE, msg),
                    },
                }
            }
        });

        self.app.merge(Router::new().route("/healthz", healthz))
    }

    /// Serves the app plus `GET /healthz` on `addr`, blocking until the process
    /// receives `SIGINT`/`SIGTERM` and draining in-flight requests before
    /// returning.
    ///
    /// # Errors
    ///
    /// Returns an error if binding `addr` fails or the server errors while
    /// running.
    pub async fn serve(self, addr: SocketAddr) -> std::io::Result<()> {
        let listener = tokio::net::TcpListener::bind(addr).await?;

        axum::serve(listener, self.into_router().into_make_service())
            .with_graceful_shutdown(shutdown_signal())
            .await
    }
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
