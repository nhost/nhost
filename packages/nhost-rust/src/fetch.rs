//! HTTP fetch pipeline shared by the generated and hand-written Nhost clients.
//!
//! The pipeline mirrors `@nhost/nhost-js`'s fetch module: a chain of middleware
//! wraps a base fetch backed by a [`reqwest::Client`]. Each middleware can
//! inspect/modify the outgoing [`reqwest::Request`] and the returned
//! [`Response`], which is how session refresh, access-token attachment, and
//! role/header injection are implemented.
//!
//! Unlike the browser SDK, responses are buffered into [`Response`] (status,
//! headers, and body bytes) so middleware can read the body without consuming
//! it from downstream consumers.

use async_trait::async_trait;
use std::sync::Arc;

const MIN_ERROR_STATUS: u16 = 300;

/// A buffered HTTP response: status, headers, and the full body.
#[derive(Debug, Clone)]
pub struct Response {
    pub status: u16,
    pub headers: reqwest::header::HeaderMap,
    pub body: bytes::Bytes,
}

// The wasm reqwest client and the futures it returns are !Send, so under the
// `wasm` feature the fetch pipeline drops its Send + Sync bounds and uses
// non-Send async-trait futures. On native, the bounds are kept so the clients
// remain Send + Sync.

/// A fetch-like function: takes a prepared request and returns a response.
#[cfg(not(feature = "wasm"))]
#[async_trait]
pub trait FetchFn: Send + Sync {
    async fn call(&self, req: reqwest::Request) -> Result<Response, Error>;
}

/// A fetch-like function: takes a prepared request and returns a response.
#[cfg(feature = "wasm")]
#[async_trait(?Send)]
pub trait FetchFn {
    async fn call(&self, req: reqwest::Request) -> Result<Response, Error>;
}

/// Middleware: takes the next fetch in the chain and returns a wrapping fetch.
#[cfg(not(feature = "wasm"))]
pub type ChainFunction = Arc<dyn Fn(Arc<dyn FetchFn>) -> Arc<dyn FetchFn> + Send + Sync>;

/// Middleware: takes the next fetch in the chain and returns a wrapping fetch.
#[cfg(feature = "wasm")]
pub type ChainFunction = Arc<dyn Fn(Arc<dyn FetchFn>) -> Arc<dyn FetchFn>>;

struct BaseFetch {
    client: reqwest::Client,
}

#[cfg_attr(not(feature = "wasm"), async_trait)]
#[cfg_attr(feature = "wasm", async_trait(?Send))]
impl FetchFn for BaseFetch {
    async fn call(&self, req: reqwest::Request) -> Result<Response, Error> {
        let resp = self.client.execute(req).await?;
        let status = resp.status().as_u16();
        let headers = resp.headers().clone();
        let body = resp.bytes().await?;
        Ok(Response {
            status,
            headers,
            body,
        })
    }
}

/// Composes `chain` around a base fetch backed by `client`. The chain executes
/// in slice order: the first middleware wraps the second, and so on, with the
/// base fetch (`client.execute`) at the center. This matches the `reduceRight`
/// composition used by the JS SDK.
pub fn create_enhanced_fetch(client: reqwest::Client, chain: &[ChainFunction]) -> Arc<dyn FetchFn> {
    let mut fetch: Arc<dyn FetchFn> = Arc::new(BaseFetch { client });
    for cf in chain.iter().rev() {
        fetch = cf(fetch);
    }
    fetch
}

/// A structured API response: the parsed body plus status and headers.
#[derive(Debug, Clone)]
pub struct FetchResponse<T> {
    pub body: T,
    pub status: u16,
    pub headers: reqwest::header::HeaderMap,
}

/// The payload of an API error (non-2xx/3xx response).
#[derive(Debug, Clone)]
pub struct ApiError {
    pub message: String,
    pub status: u16,
    pub body: serde_json::Value,
    pub headers: reqwest::header::HeaderMap,
}

/// The error type returned by the SDK.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// A request completed with a non-2xx/3xx status.
    #[error("{}", .0.message)]
    Api(Box<ApiError>),
    /// A transport-level error from reqwest.
    #[error(transparent)]
    Reqwest(#[from] reqwest::Error),
    /// A (de)serialization error.
    #[error(transparent)]
    Json(#[from] serde_json::Error),
}

impl Error {
    /// Builds an [`Error::Api`] from its parts.
    pub fn api(
        message: String,
        status: u16,
        body: serde_json::Value,
        headers: reqwest::header::HeaderMap,
    ) -> Self {
        Error::Api(Box::new(ApiError {
            message,
            status,
            body,
            headers,
        }))
    }

    /// Builds an [`Error::Api`] from an error [`Response`], extracting a
    /// human-readable message from common Nhost error response shapes.
    pub fn from_response(resp: Response) -> Self {
        let body: serde_json::Value = if resp.status == 412 || resp.body.is_empty() {
            serde_json::Value::Null
        } else {
            serde_json::from_slice(&resp.body).unwrap_or_else(|_| {
                serde_json::Value::String(String::from_utf8_lossy(&resp.body).into_owned())
            })
        };

        Error::api(extract_message(&body), resp.status, body, resp.headers)
    }

    /// The HTTP status code, when this is an API error.
    pub fn status(&self) -> Option<u16> {
        match self {
            Error::Api(e) => Some(e.status),
            _ => None,
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

/// Whether a status code indicates an error (>= 300).
pub fn is_error_status(status: u16) -> bool {
    status >= MIN_ERROR_STATUS
}
