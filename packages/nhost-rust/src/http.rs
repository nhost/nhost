//! HTTP layer built on [`reqwest_middleware`].
//!
//! Each service client owns a [`ClientWithMiddleware`] assembled from a base
//! [`reqwest::Client`] and an ordered middleware stack. [`send`] issues a
//! request through that stack and buffers the response so auth responses can
//! capture or clear the session and the body can be mapped to a typed value.

use crate::auth::Session;
use crate::error::Error;
use crate::session::SessionStorage;
use bytes::Bytes;
use reqwest::header::HeaderMap;
use std::sync::Arc;

pub use reqwest_middleware::{ClientBuilder, ClientWithMiddleware, Middleware, RequestBuilder};

/// Appends already-separated path segments to a base URL without allowing a
/// segment to alter the URL's authority, query, or preceding path.
pub(crate) fn append_path(base_url: &str, segments: &[&str]) -> Result<url::Url, Error> {
    let mut url = url::Url::parse(base_url)
        .map_err(|error| Error::Config(format!("invalid service base URL: {error}")))?;
    let mut path = url
        .path_segments_mut()
        .map_err(|()| Error::Config("service base URL cannot accept path segments".to_string()))?;
    path.pop_if_empty();
    for &segment in segments {
        // `push()` escapes `%` and `/`, preventing a segment from changing the
        // path structure, but silently drops a literal `.` or `..`. Give those
        // two values an escaped spelling so they remain present; `push()` then
        // escapes the `%` again for the wire. Unlike `push()`, `set_path()` does
        // normalize dot spellings, so pre-encoding followed by `set_path()` is
        // unsafe here.
        path.push(match segment {
            "." => "%2E",
            ".." => "%2E%2E",
            other => other,
        });
    }
    drop(path);
    Ok(url)
}

/// A successful response: the decoded payload plus the status and headers that
/// came with it.
///
/// Generated REST methods, Functions response helpers, and
/// [`crate::graphql::Operation::execute`] return this so callers can reach
/// response metadata (`ETag`, `Content-Type`, the header-only result of a `HEAD`
/// request) instead of only the body. Use [`Response::into_body`] when the
/// metadata is not needed.
///
/// [`Debug`](std::fmt::Debug) includes the response headers verbatim. Do not
/// format a response with `Debug` when its headers can contain credentials or
/// cookies.
#[derive(Debug, Clone)]
pub struct Response<T> {
    /// The decoded response payload. `()` for operations with no body.
    pub body: T,
    /// The HTTP status code.
    pub status: u16,
    /// The response headers.
    pub headers: HeaderMap,
}

impl<T> Response<T> {
    /// Discards the status and headers, yielding just the payload.
    pub fn into_body(self) -> T {
        self.body
    }
}

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

pub(crate) struct BufferedResponse {
    pub(crate) status: u16,
    pub(crate) headers: HeaderMap,
    pub(crate) success: bool,
    pub(crate) bytes: Result<Bytes, Error>,
}

/// Sends and buffers a response without interpreting its HTTP status.
///
/// Keeping the buffered body available before status mapping lets protocols
/// such as GraphQL give body-level errors precedence over the HTTP status.
pub(crate) async fn send_buffered(
    request: RequestBuilder,
    sink: Option<&SessionStorage>,
) -> Result<BufferedResponse, Error> {
    let (client, request) = request.build_split();
    let request = request.map_err(Error::from)?;
    let path = request.url().path().to_owned();
    let response = client.execute(request).await.map_err(Error::from)?;
    let success = response.status().is_success();
    let status = response.status().as_u16();
    let headers = response.headers().clone();
    let bytes = read_and_apply_session(response, &path, success, sink).await;

    Ok(BufferedResponse {
        status,
        headers,
        success,
        bytes,
    })
}

/// The acceptance phase of an HTTP request.
///
/// `Accepted` is constructed as soon as a 2xx status is observable. Reading or
/// processing that response body can still fail, but that failure remains on
/// the accepted side of the boundary. `NotAccepted` therefore means that no
/// 2xx response was observed. `NotModified` preserves [`send`]'s special 304
/// response handling without calling a non-2xx response accepted.
pub(crate) enum SendOutcome {
    Accepted {
        status: u16,
        headers: HeaderMap,
        bytes: Result<Bytes, Error>,
    },
    NotModified {
        status: u16,
        headers: HeaderMap,
        bytes: Result<Bytes, Error>,
    },
    NotAccepted(Error),
}

/// Sends a request while preserving whether a 2xx response was observed.
pub(crate) async fn send_phased(
    request: RequestBuilder,
    sink: Option<&SessionStorage>,
) -> SendOutcome {
    let response = match send_buffered(request, sink).await {
        Ok(response) => response,
        Err(error) => return SendOutcome::NotAccepted(error),
    };

    if response.success {
        return SendOutcome::Accepted {
            status: response.status,
            headers: response.headers,
            bytes: response.bytes,
        };
    }

    if response.status == 304 {
        return SendOutcome::NotModified {
            status: response.status,
            headers: response.headers,
            bytes: response.bytes,
        };
    }

    let error = match response.bytes {
        Ok(body) => Error::from_response(response.status, response.headers, body),
        Err(error) => error,
    };
    SendOutcome::NotAccepted(error)
}

async fn read_and_apply_session(
    response: reqwest::Response,
    path: &str,
    success: bool,
    sink: Option<&SessionStorage>,
) -> Result<Bytes, Error> {
    let body = response.bytes().await?;
    if let Some(sink) = sink {
        apply_session_response(path, success, &body, sink)?;
    }
    Ok(body)
}

/// Sends a request through the middleware chain and buffers the full response.
///
/// A 3xx status other than `304 Not Modified`, or a 4xx/5xx status, is turned
/// into [`Error::Api`]. A 304 is returned with an empty body so callers can
/// inspect [`Response::status`] and response headers. When `sink` is provided
/// (only the auth client sets it), successful session responses are captured,
/// `/signout` clears the session regardless of status, and a successful
/// `/user/password` response clears it because the server revoked all refresh
/// tokens. Session path rules use the original request path, so redirects do
/// not change which rule applies. Storage failures are propagated to the
/// caller.
pub async fn send(
    request: RequestBuilder,
    sink: Option<&SessionStorage>,
) -> Result<(u16, HeaderMap, Bytes), Error> {
    match send_phased(request, sink).await {
        SendOutcome::Accepted {
            status,
            headers,
            bytes,
        }
        | SendOutcome::NotModified {
            status,
            headers,
            bytes,
        } => Ok((status, headers, bytes?)),
        SendOutcome::NotAccepted(error) => Err(error),
    }
}

/// Applies a completed auth response to the session store.
fn apply_session_response(
    path: &str,
    success: bool,
    body: &Bytes,
    storage: &SessionStorage,
) -> Result<(), Error> {
    if path.ends_with("/signout") || (success && path.ends_with("/user/password")) {
        return storage.remove();
    }
    if success {
        capture_session(body, storage)?;
    }
    Ok(())
}

/// Extracts a session from a successful auth response body and stores it.
/// A no-op when the body carries no session.
fn capture_session(body: &Bytes, storage: &SessionStorage) -> Result<(), Error> {
    match extract_session(body) {
        Some(session) => storage.set(session),
        None => Ok(()),
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

    // This explicit field list keeps the discriminator stable if generated
    // `Session` fields become optional after a future spec change. Today it is
    // equivalent to decoding `Session`; `user` is optional and may be omitted.
    if obj.contains_key("accessToken")
        && obj.contains_key("accessTokenExpiresIn")
        && obj.contains_key("refreshToken")
        && obj.contains_key("refreshTokenId")
    {
        return serde_json::from_value(raw).ok();
    }
    None
}
