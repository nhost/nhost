//! A minimal Nhost Run service built with axum and `nhost-run`.
//!
//! It receives authenticated webhooks and lets `nhost_run::serve` mount the
//! platform's `GET /healthz` probe and own the server lifecycle (graceful
//! shutdown on `SIGTERM`).
//!
//! The health check reports the service as unhealthy (503) until
//! `WEBHOOK_SECRET` is configured, since without it we cannot authenticate
//! incoming webhooks — so a misconfigured deploy is restarted instead of
//! silently rejecting every request.
//!
//! Run it locally with:
//!
//! ```bash
//! WEBHOOK_SECRET=dev-secret cargo run
//! ```

use std::env;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicI64, Ordering};
use std::sync::Arc;

use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde_json::{json, Value};

#[derive(Clone, Default)]
struct AppState {
    // In a real service this would write to your database via the Nhost
    // GraphQL API; here we just keep a count so the example is self-contained.
    received: Arc<AtomicI64>,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let app = Router::new()
        .route("/", get(root))
        .route("/webhook", post(webhook))
        .with_state(AppState::default());

    let port: u16 = env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("webhook-receiver listening on {addr}");

    // serve mounts GET /healthz (backed by `health`) and drains on SIGTERM.
    nhost_run::serve(addr, app, health).await
}

/// Backs `GET /healthz`: `Err` → 503 until `WEBHOOK_SECRET` is configured.
async fn health() -> Result<(), String> {
    if env::var("WEBHOOK_SECRET").unwrap_or_default().is_empty() {
        return Err("WEBHOOK_SECRET is not configured".to_owned());
    }

    Ok(())
}

async fn root(State(state): State<AppState>) -> Json<Value> {
    Json(json!({
        "service": "webhook-receiver",
        "received": state.received.load(Ordering::Relaxed),
    }))
}

async fn webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<Value>,
) -> impl IntoResponse {
    let secret = env::var("WEBHOOK_SECRET").unwrap_or_default();
    let provided = headers
        .get("x-webhook-secret")
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default();
    if secret.is_empty() || provided != secret {
        return (
            StatusCode::UNAUTHORIZED,
            "invalid or missing webhook secret",
        )
            .into_response();
    }

    let event = payload
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or("unknown")
        .to_owned();
    let received = state.received.fetch_add(1, Ordering::Relaxed) + 1;

    Json(json!({ "ok": true, "event": event, "received": received })).into_response()
}
