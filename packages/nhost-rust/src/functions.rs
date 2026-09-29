//! Client for invoking Nhost serverless functions.
//!
//! Typed helpers cover the common JSON cases and retain response status and
//! headers in [`crate::http::Response`]; call
//! [`crate::http::Response::into_body`] when only the decoded value is needed.
//! [`Client::request`] returns a middleware-aware
//! [`reqwest_middleware::RequestBuilder`] for full control (custom methods, raw
//! bodies, streaming).

use crate::error::Error;
use crate::http::{self, ClientWithMiddleware, RequestBuilder};
use crate::middleware::{HeaderPriority, SetHeaders, SetRole};
use bytes::Bytes;
use serde::de::DeserializeOwned;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;

/// Functions API client.
pub struct Client {
    /// The base URL functions are invoked under.
    pub base_url: String,
    http: ClientWithMiddleware,
    reqwest: reqwest::Client,
    middleware: Vec<Arc<dyn http::Middleware>>,
    scoped_middleware: Vec<Arc<dyn http::Middleware>>,
}

impl Client {
    /// Creates a client for `base_url` from a base client and an ordered
    /// middleware stack (the first entry runs first on the way out).
    ///
    /// Most applications get their clients from [`crate::Nhost::builder`]
    /// instead; use this together with [`crate::Nhost::from_clients`] to
    /// assemble the pipeline yourself.
    pub fn new(
        base_url: impl Into<String>,
        reqwest: reqwest::Client,
        middleware: Vec<Arc<dyn http::Middleware>>,
    ) -> Self {
        let http = http::build_client(reqwest.clone(), &middleware);
        Self {
            base_url: base_url.into(),
            http,
            reqwest,
            middleware,
            scoped_middleware: Vec::new(),
        }
    }

    /// Returns a copy of this client that sends `x-hasura-role: <role>` on every
    /// request.
    pub fn with_role(&self, role: impl Into<String>) -> Self {
        self.with_middleware(Arc::new(SetRole {
            role: role.into(),
            priority: HeaderPriority::Scoped,
        }))
    }

    /// Returns a copy of this client that sends extra headers on every request.
    pub fn with_headers(&self, headers: HashMap<String, String>) -> Self {
        self.with_middleware(Arc::new(SetHeaders {
            headers,
            priority: HeaderPriority::Scoped,
        }))
    }

    fn with_middleware(&self, mw: Arc<dyn http::Middleware>) -> Self {
        let mut scoped_middleware = self.scoped_middleware.clone();
        scoped_middleware.push(mw);
        let middleware = scoped_middleware
            .iter()
            .chain(&self.middleware)
            .cloned()
            .collect::<Vec<_>>();
        let http = http::build_client(self.reqwest.clone(), &middleware);
        Self {
            base_url: self.base_url.clone(),
            http,
            reqwest: self.reqwest.clone(),
            middleware: self.middleware.clone(),
            scoped_middleware,
        }
    }

    /// A middleware-aware request builder for `path`, appended to `base_url`.
    /// The path may have a leading slash and may contain multiple segments;
    /// every segment is percent-encoded so it cannot escape the base path or
    /// inject a query. Other segments round-trip, but a segment exactly `.` or
    /// `..` is deliberately sent as `%252E` or `%252E%252E`, not as the caller's
    /// literal identifier, to prevent traversal. Use the builder directly for
    /// full control, then buffer it with [`Client::send`].
    ///
    /// # Errors
    ///
    /// Returns [`Error::Config`] when `base_url` is not a valid hierarchical URL.
    pub fn request(&self, method: reqwest::Method, path: &str) -> Result<RequestBuilder, Error> {
        let segments = path.trim_start_matches('/').split('/').collect::<Vec<_>>();
        let url = http::append_path(&self.base_url, &segments)?;
        Ok(self.http.request(method, url))
    }

    /// Sends a built request through the middleware chain and returns its raw
    /// body, status, and headers. A 304 is returned successfully with an empty
    /// body; any other 3xx status, or a 4xx/5xx status, becomes [`Error::Api`].
    pub async fn send(&self, request: RequestBuilder) -> Result<http::Response<Bytes>, Error> {
        let (status, headers, body) = http::send(request, None).await?;
        Ok(http::Response {
            body,
            status,
            headers,
        })
    }

    /// POSTs `body` as JSON to `path` and returns the decoded response together
    /// with its status and headers. An empty successful body, including a 304
    /// response, is decoded as JSON `null`; use `T = Option<_>` or `T = ()` to
    /// accept it.
    pub async fn post<B, T>(&self, path: &str, body: &B) -> Result<http::Response<T>, Error>
    where
        B: Serialize + ?Sized,
        T: DeserializeOwned,
    {
        let request = self
            .request(reqwest::Method::POST, path)?
            .json(body)
            .header("accept", "application/json");
        self.send_json(request).await
    }

    /// GETs `path` and returns the decoded response together with its status and
    /// headers. An empty successful body, including a 304 response, is decoded as
    /// JSON `null`; use `T = Option<_>` or `T = ()` to accept it.
    pub async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<http::Response<T>, Error> {
        let request = self
            .request(reqwest::Method::GET, path)?
            .header("accept", "application/json");
        self.send_json(request).await
    }

    async fn send_json<T: DeserializeOwned>(
        &self,
        request: RequestBuilder,
    ) -> Result<http::Response<T>, Error> {
        let http::Response {
            body,
            status,
            headers,
        } = self.send(request).await?;
        let body = if body.is_empty() {
            // Treats any empty successful response body as JSON null so
            // `T = ()` / `Option<_>` can decode it; status remains available.
            serde_json::from_slice(b"null")?
        } else {
            serde_json::from_slice(&body)?
        };
        Ok(http::Response {
            body,
            status,
            headers,
        })
    }
}
