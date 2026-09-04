//! The SDK error type.

use crate::graphql::GraphqlError;
use bytes::Bytes;
use reqwest::header::HeaderMap;

/// The payload of an API error: a response with a 3xx status other than 304,
/// or a 4xx/5xx status.
///
/// # Sensitive data
///
/// [`Debug`](std::fmt::Debug) redacts values of credential-bearing response
/// headers and recursively redacts values whose JSON field names match the
/// SDK's generated-model credential policy. It keeps header and body field
/// names, non-sensitive values, `message`, and `status` visible. Because
/// arbitrary field names and the human-readable message can still contain
/// sensitive data, treat debug output as redacted rather than secret-free.
///
/// This type is non-exhaustive so response metadata can grow without breaking
/// downstream crates. Use [`ApiError::new`] to construct one in test fixtures.
#[non_exhaustive]
#[derive(Clone, thiserror::Error)]
#[error("{message} (HTTP {status})")]
pub struct ApiError {
    /// A human-readable, single-line message extracted from common Nhost error
    /// body shapes, or from a trimmed, non-blank `X-Error` response header as a
    /// fallback. Response-derived messages contain at most 200 characters plus
    /// an ellipsis; unstructured non-JSON bodies are not used as messages.
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

impl ApiError {
    /// Creates an API error from its response parts.
    pub fn new(
        message: impl Into<String>,
        status: u16,
        body: serde_json::Value,
        headers: HeaderMap,
    ) -> Self {
        Self {
            message: message.into(),
            status,
            body,
            headers,
        }
    }
}

impl std::fmt::Debug for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ApiError")
            .field("message", &self.message)
            .field("status", &self.status)
            .field("body", &RedactedJson(&self.body))
            .field("headers", &RedactedHeaders(&self.headers))
            .finish()
    }
}

struct RedactedHeaders<'a>(&'a HeaderMap);

impl std::fmt::Debug for RedactedHeaders<'_> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let mut headers = f.debug_map();
        for (name, value) in self.0 {
            if is_sensitive_header_name(name.as_str()) {
                headers.entry(name, &"<redacted>");
            } else {
                headers.entry(name, value);
            }
        }
        headers.finish()
    }
}

pub(crate) struct RedactedJson<'a>(pub(crate) &'a serde_json::Value);

impl std::fmt::Debug for RedactedJson<'_> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self.0 {
            serde_json::Value::Array(values) => f
                .debug_list()
                .entries(values.iter().map(RedactedJson))
                .finish(),
            serde_json::Value::Object(values) => {
                let mut object = f.debug_map();
                for (name, value) in values {
                    if is_sensitive_field_name(name) {
                        object.entry(name, &"<redacted>");
                    } else {
                        object.entry(name, &RedactedJson(value));
                    }
                }
                object.finish()
            }
            value => value.fmt(f),
        }
    }
}

fn is_sensitive_header_name(name: &str) -> bool {
    let normalized = normalize_field_name(name);
    matches!(
        normalized.as_str(),
        "location" | "set_cookie" | "proxy_authorization"
    ) || is_normalized_sensitive_field_name(&normalized)
}

pub(crate) fn is_sensitive_field_name(name: &str) -> bool {
    is_normalized_sensitive_field_name(&normalize_field_name(name))
}

fn is_normalized_sensitive_field_name(name: &str) -> bool {
    const EXACT: &[&str] = &[
        "api_key",
        "authorization",
        "code",
        "code_verifier",
        "cookie",
        "credential",
        "otp",
        "password",
        "private_key",
        "secret",
        "signature",
        "ticket",
        "token",
    ];
    const SUFFIXES: &[&str] = &[
        "_api_key",
        "_code_verifier",
        "_otp",
        "_password",
        "_private_key",
        "_secret",
        "_signature",
        "_ticket",
        "_token",
    ];

    EXACT.contains(&name) || SUFFIXES.iter().any(|suffix| name.ends_with(suffix))
}

fn normalize_field_name(name: &str) -> String {
    let chars: Vec<char> = name.chars().collect();
    let mut normalized = String::with_capacity(name.len());

    for (index, character) in chars.iter().copied().enumerate() {
        if matches!(character, '-' | ' ' | '_') {
            if !normalized.is_empty() && !normalized.ends_with('_') {
                normalized.push('_');
            }
            continue;
        }

        if character.is_ascii_uppercase() {
            let previous = index.checked_sub(1).and_then(|index| chars.get(index));
            let next = chars.get(index + 1);
            let starts_word = previous
                .is_some_and(|previous| previous.is_ascii_lowercase() || previous.is_ascii_digit())
                || (previous.is_some_and(|previous| previous.is_ascii_uppercase())
                    && next.is_some_and(|next| next.is_ascii_lowercase()));
            if starts_word && !normalized.ends_with('_') {
                normalized.push('_');
            }
            normalized.push(character.to_ascii_lowercase());
        } else {
            normalized.push(character);
        }
    }

    normalized.trim_matches('_').to_string()
}

/// The payload of a GraphQL operation failure.
///
/// A non-empty GraphQL `errors` array takes precedence over a 3xx status other
/// than 304, or a 4xx/5xx status, so this payload also retains the response
/// status and headers. Use
/// [`GraphqlError::code`] to inspect machine-readable Hasura or constellation
/// error codes.
///
/// # Sensitive data
///
/// [`Debug`](std::fmt::Debug) keeps error entries, partial-data field names,
/// header names, non-sensitive values, and the response status visible. It
/// recursively redacts credential-bearing values in partial data and structured
/// error fields, and redacts credential-bearing response header values. Error
/// messages remain visible and may contain sensitive data supplied by a server.
///
/// This type is non-exhaustive so additional GraphQL failure context can be
/// retained without breaking downstream crates. Use
/// [`GraphqlOperationError::new`] to construct one in test fixtures.
#[non_exhaustive]
#[derive(Clone, thiserror::Error)]
#[error("GraphQL error: {}", GraphqlErrorsDisplay(.errors.as_slice()))]
pub struct GraphqlOperationError {
    errors: Vec<GraphqlError>,
    data: Option<serde_json::Value>,
    status: u16,
    headers: HeaderMap,
}

impl std::fmt::Debug for GraphqlOperationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("GraphqlOperationError")
            .field("errors", &self.errors)
            .field("data", &self.data.as_ref().map(RedactedJson))
            .field("status", &self.status)
            .field("headers", &RedactedHeaders(&self.headers))
            .finish()
    }
}

impl GraphqlOperationError {
    /// Creates a GraphQL operation error from its response parts.
    pub fn new(
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

struct GraphqlErrorsDisplay<'a>(&'a [GraphqlError]);

impl std::fmt::Display for GraphqlErrorsDisplay<'_> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        if self.0.is_empty() {
            return f.write_str("response contained no data");
        }

        for (index, error) in self.0.iter().enumerate() {
            if index > 0 {
                f.write_str(", ")?;
            }
            f.write_str(&error.message)?;
        }
        Ok(())
    }
}

/// The error type returned by every fallible SDK operation.
///
/// This enum is non-exhaustive because the SDK may gain new failure modes.
/// Downstream matches must include a wildcard arm.
#[non_exhaustive]
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

    /// A caller-supplied value was invalid at the client boundary (for example,
    /// client configuration, a service URL, or a multipart MIME type).
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
    pub fn api(
        message: impl Into<String>,
        status: u16,
        body: serde_json::Value,
        headers: HeaderMap,
    ) -> Self {
        Error::Api(Box::new(ApiError::new(message, status, body, headers)))
    }

    /// Builds an [`Error::GraphQl`] from its response parts.
    pub fn graphql(
        errors: Vec<GraphqlError>,
        data: Option<serde_json::Value>,
        status: u16,
        headers: HeaderMap,
    ) -> Self {
        Error::GraphQl(Box::new(GraphqlOperationError::new(
            errors, data, status, headers,
        )))
    }

    /// Builds an [`Error::Api`] from a buffered error response, extracting a
    /// human-readable message from common Nhost error response shapes.
    pub fn from_response(status: u16, headers: HeaderMap, body: Bytes) -> Self {
        let (value, body_message) = if body.is_empty() {
            (serde_json::Value::Null, None)
        } else {
            match serde_json::from_slice(&body) {
                Ok(value) => {
                    let message =
                        extract_message(&value).and_then(|message| bounded_log_message(&message));
                    (value, message)
                }
                Err(_) => (
                    serde_json::Value::String(String::from_utf8_lossy(&body).into_owned()),
                    None,
                ),
            }
        };
        let message = body_message
            .or_else(|| {
                headers
                    .get("x-error")
                    .and_then(|value| value.to_str().ok())
                    .and_then(bounded_log_message)
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

const MAX_API_ERROR_MESSAGE_CHARS: usize = 200;

fn bounded_log_message(value: &str) -> Option<String> {
    let line_end = value.find(['\r', '\n']);
    let first_line = &value[..line_end.unwrap_or(value.len())];
    let mut message = String::with_capacity(first_line.len().min(MAX_API_ERROR_MESSAGE_CHARS));
    let mut characters = first_line
        .trim()
        .chars()
        .filter(|character| !character.is_control());

    for _ in 0..MAX_API_ERROR_MESSAGE_CHARS {
        let Some(character) = characters.next() else {
            break;
        };
        message.push(character);
    }

    if message.is_empty() {
        return None;
    }
    if line_end.is_some() || characters.next().is_some() {
        message.push('…');
    }
    Some(message)
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
