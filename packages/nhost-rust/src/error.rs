//! The SDK error type.
//!
//! Unlike the JS SDK — which funnels everything through a single API-error
//! shape — this is a real Rust error enum: transport, middleware, HTTP-API,
//! GraphQL, (de)serialization, token-decode, configuration, and session-storage
//! failures are distinct variants you can match on.

use bytes::Bytes;
use reqwest::header::HeaderMap;

/// The payload of an API error: a response whose status was >= 300.
#[derive(Debug, Clone)]
pub struct ApiError {
    /// A human-readable message extracted from common Nhost error shapes.
    pub message: String,
    /// The HTTP status code.
    pub status: u16,
    /// The parsed response body (or a JSON string of the raw body).
    pub body: serde_json::Value,
    /// The response headers.
    pub headers: HeaderMap,
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} (HTTP {})", self.message, self.status)
    }
}

impl std::error::Error for ApiError {}

/// The error type returned by every fallible SDK operation.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// A request completed with a non-success HTTP status (>= 300). Boxed to
    /// keep `Result<_, Error>` small (`clippy::result_large_err`).
    #[error(transparent)]
    Api(Box<ApiError>),

    /// A GraphQL response carried `errors` (the joined messages).
    #[error("GraphQL error: {0}")]
    GraphQl(String),

    /// An access token could not be decoded.
    #[error("invalid access token: {0}")]
    InvalidToken(String),

    /// The client was misconfigured (e.g. a server client without storage).
    #[error("configuration error: {0}")]
    Config(String),

    /// A session-storage backend failed (file/localStorage I/O).
    #[error("session storage error: {0}")]
    Storage(String),

    /// A transport-level error from reqwest.
    #[error(transparent)]
    Http(#[from] reqwest::Error),

    /// An error raised by a middleware in the chain.
    #[error(transparent)]
    Middleware(anyhow::Error),

    /// A (de)serialization error.
    #[error(transparent)]
    Json(#[from] serde_json::Error),
}

impl Error {
    /// Builds an [`Error::Api`] from its parts.
    pub fn api(message: String, status: u16, body: serde_json::Value, headers: HeaderMap) -> Self {
        Error::Api(Box::new(ApiError {
            message,
            status,
            body,
            headers,
        }))
    }

    /// Builds an [`Error::Api`] from a buffered error response, extracting a
    /// human-readable message from common Nhost error response shapes.
    pub fn from_response(status: u16, headers: HeaderMap, body: Bytes) -> Self {
        let value: serde_json::Value = if status == 412 || body.is_empty() {
            serde_json::Value::Null
        } else {
            serde_json::from_slice(&body).unwrap_or_else(|_| {
                serde_json::Value::String(String::from_utf8_lossy(&body).into_owned())
            })
        };
        Error::api(extract_message(&value), status, value, headers)
    }

    /// The HTTP status code, when this is an API error.
    pub fn status(&self) -> Option<u16> {
        match self {
            Error::Api(e) => Some(e.status),
            _ => None,
        }
    }
}

impl From<reqwest_middleware::Error> for Error {
    fn from(e: reqwest_middleware::Error) -> Self {
        match e {
            reqwest_middleware::Error::Reqwest(r) => Error::Http(r),
            reqwest_middleware::Error::Middleware(m) => Error::Middleware(m),
        }
    }
}

fn extract_message(body: &serde_json::Value) -> String {
    if let Some(s) = body.as_str() {
        if !s.is_empty() {
            return s.to_string();
        }
    }

    if let Some(obj) = body.as_object() {
        if let Some(msg) = obj.get("message").and_then(|v| v.as_str()) {
            return msg.to_string();
        }

        match obj.get("error") {
            Some(serde_json::Value::String(s)) => return s.clone(),
            Some(serde_json::Value::Object(e)) => {
                if let Some(msg) = e.get("message").and_then(|v| v.as_str()) {
                    return msg.to_string();
                }
            }
            _ => {}
        }

        if let Some(errs) = obj.get("errors").and_then(|v| v.as_array()) {
            let messages: Vec<String> = errs
                .iter()
                .filter_map(|e| e.get("message").and_then(|v| v.as_str()).map(String::from))
                .collect();
            if !messages.is_empty() {
                return messages.join(", ");
            }
        }
    }

    "An unexpected error occurred".to_string()
}
