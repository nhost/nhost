//! The SDK error type.
//!
//! Unlike the JS SDK — which funnels everything through a single API-error
//! shape — this is a real Rust error enum: transport, middleware, HTTP-API,
//! GraphQL, (de)serialization, token-decode, configuration, and session-storage
//! failures are distinct variants you can match on.

use crate::graphql::GraphqlError;
use bytes::Bytes;
use reqwest::header::HeaderMap;

/// The payload of an API error: a response with a 3xx status other than 304,
/// or a 4xx/5xx status.
///
/// # Sensitive data
///
/// [`Debug`](std::fmt::Debug) includes `body` and `headers` verbatim. They can
/// contain tokens, cookies, or sensitive redirect URLs, so do not debug-format
/// an API error when the response may contain credentials.
#[derive(Debug, Clone)]
pub struct ApiError {
    /// A human-readable message extracted from common Nhost error body shapes,
    /// or from a trimmed, non-blank `X-Error` response header as a fallback.
    pub message: String,
    /// The HTTP status code.
    pub status: u16,
    /// The parsed response body (or a JSON string of the raw body). Non-empty
    /// bodies are retained for every error status; empty bodies are represented
    /// as [`serde_json::Value::Null`].
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

/// The payload of a GraphQL operation failure.
///
/// A non-empty GraphQL `errors` array takes precedence over a 3xx status other
/// than 304, or a 4xx/5xx status, so this payload also retains the response
/// status and headers. Use
/// [`GraphqlError::code`] to inspect machine-readable Hasura or constellation
/// error codes.
#[derive(Debug, Clone)]
pub struct GraphqlOperationError {
    errors: Vec<GraphqlError>,
    data: Option<serde_json::Value>,
    status: u16,
    headers: HeaderMap,
}

impl GraphqlOperationError {
    pub(crate) fn new(
        errors: Vec<GraphqlError>,
        data: Option<serde_json::Value>,
        status: u16,
        headers: HeaderMap,
    ) -> Self {
        Self {
            errors,
            data,
            status,
            headers,
        }
    }

    /// The GraphQL error entries returned by the server.
    pub fn errors(&self) -> &[GraphqlError] {
        &self.errors
    }

    /// Partial GraphQL data returned alongside the errors, when present.
    pub fn data(&self) -> Option<&serde_json::Value> {
        self.data.as_ref()
    }

    /// The HTTP response status carrying the GraphQL failure.
    pub fn status(&self) -> u16 {
        self.status
    }

    /// The HTTP response headers carrying the GraphQL failure.
    pub fn headers(&self) -> &HeaderMap {
        &self.headers
    }
}

impl std::fmt::Display for GraphqlOperationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("GraphQL error: ")?;
        if self.errors.is_empty() {
            return f.write_str("response contained no data");
        }

        for (index, error) in self.errors.iter().enumerate() {
            if index > 0 {
                f.write_str(", ")?;
            }
            f.write_str(&error.message)?;
        }
        Ok(())
    }
}

impl std::error::Error for GraphqlOperationError {}

/// The error type returned by every fallible SDK operation.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// A request completed with a 3xx status other than 304, or a 4xx/5xx
    /// status. A GraphQL response carrying a non-empty `errors` array instead
    /// produces [`Error::GraphQl`].
    /// Boxed to keep `Result<_, Error>` small (`clippy::result_large_err`).
    #[error(transparent)]
    Api(Box<ApiError>),

    /// A GraphQL response carried a non-empty `errors` array, regardless of its
    /// HTTP status, or [`crate::graphql::Operation::send`] received no data. The
    /// structured errors, partial data, status, and headers are preserved in the
    /// payload.
    #[error(transparent)]
    GraphQl(Box<GraphqlOperationError>),

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
        let value: serde_json::Value = if body.is_empty() {
            serde_json::Value::Null
        } else {
            serde_json::from_slice(&body).unwrap_or_else(|_| {
                serde_json::Value::String(String::from_utf8_lossy(&body).into_owned())
            })
        };
        let message = extract_message(&value)
            .or_else(|| {
                headers
                    .get("x-error")
                    .and_then(|value| value.to_str().ok())
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(str::to_owned)
            })
            .unwrap_or_else(|| "An unexpected error occurred".to_string());
        Error::api(message, status, value, headers)
    }

    /// The HTTP status code, when this error came from an HTTP response.
    pub fn status(&self) -> Option<u16> {
        match self {
            Error::Api(error) => Some(error.status),
            Error::GraphQl(error) => Some(error.status),
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

fn extract_message(body: &serde_json::Value) -> Option<String> {
    if let Some(s) = body.as_str() {
        if !s.is_empty() {
            return Some(s.to_string());
        }
    }

    if let Some(obj) = body.as_object() {
        if let Some(msg) = obj
            .get("message")
            .and_then(|v| v.as_str())
            .filter(|msg| !msg.is_empty())
        {
            return Some(msg.to_string());
        }

        match obj.get("error") {
            Some(serde_json::Value::String(s)) if !s.is_empty() => return Some(s.clone()),
            Some(serde_json::Value::Object(e)) => {
                if let Some(msg) = e
                    .get("message")
                    .and_then(|v| v.as_str())
                    .filter(|msg| !msg.is_empty())
                {
                    return Some(msg.to_string());
                }
            }
            _ => {}
        }

        if let Some(errs) = obj.get("errors").and_then(|v| v.as_array()) {
            let messages: Vec<String> = errs
                .iter()
                .filter_map(|e| {
                    e.get("message")
                        .and_then(|v| v.as_str())
                        .filter(|msg| !msg.is_empty())
                        .map(String::from)
                })
                .collect();
            if !messages.is_empty() {
                return Some(messages.join(", "));
            }
        }
    }

    None
}
