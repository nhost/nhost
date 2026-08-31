//! HTTP layer built on [`reqwest_middleware`].
//!
//! Each service client owns a [`ClientWithMiddleware`] assembled from a base
//! [`reqwest::Client`] and an ordered middleware stack. [`send`] issues a
//! request through that stack and buffers the response so the body can be
//! inspected (for session capture) and mapped to a typed value.

use crate::auth::Session;
use crate::error::Error;
use crate::session::SessionStorage;
use bytes::Bytes;
use reqwest::header::HeaderMap;
use std::sync::Arc;

pub use reqwest_middleware::{ClientBuilder, ClientWithMiddleware, Middleware, RequestBuilder};

/// Assembles a [`ClientWithMiddleware`] from a base client and an ordered
/// middleware stack (the first entry runs first on the way out).
pub fn build_client(
    reqwest: reqwest::Client,
    middleware: &[Arc<dyn Middleware>],
) -> ClientWithMiddleware {
    let mut builder = ClientBuilder::new(reqwest);
    for mw in middleware {
        builder = builder.with_arc(mw.clone());
    }
    builder.build()
}

/// Sends a request through the middleware chain and buffers the full response.
///
/// A status of 300 or greater is turned into [`Error::Api`]. When `sink` is
/// provided (only the auth client sets it), a session found in a successful
/// response body is captured into storage — this replaces the JS SDK's
/// response-sniffing middleware, which cannot work on wasm.
pub async fn send(
    request: RequestBuilder,
    sink: Option<&SessionStorage>,
) -> Result<(u16, HeaderMap, Bytes), Error> {
    let response = request.send().await?;
    let status = response.status().as_u16();
    let headers = response.headers().clone();
    let body = response.bytes().await?;

    if status >= 300 {
        return Err(Error::from_response(status, headers, body));
    }
    if let Some(sink) = sink {
        capture_session(&body, sink);
    }
    Ok((status, headers, body))
}

/// Extracts a session from a successful auth response body and stores it.
/// A silent no-op when the body carries no session.
fn capture_session(body: &Bytes, storage: &SessionStorage) {
    if let Some(session) = extract_session(body) {
        let _ = storage.set(session);
    }
}

/// Recognizes both response shapes that carry a session: an envelope with a
/// (non-null) `session` field, and a bare session object.
fn extract_session(body: &Bytes) -> Option<Session> {
    let raw: serde_json::Value = serde_json::from_slice(body).ok()?;
    let obj = raw.as_object()?;

    if let Some(sess) = obj.get("session") {
        if sess.is_null() {
            return None;
        }
        return serde_json::from_value(sess.clone()).ok();
    }

    if obj.contains_key("accessToken")
        && obj.contains_key("refreshToken")
        && obj.contains_key("user")
    {
        return serde_json::from_value(raw).ok();
    }
    None
}
