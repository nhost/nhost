//! Client for invoking Nhost serverless functions.
//!
//! Typed helpers cover the common JSON cases; [`Client::request`] returns a
//! middleware-aware [`reqwest_middleware::RequestBuilder`] for full control
//! (custom methods, raw bodies, streaming).

use crate::error::Error;
use crate::http::{self, ClientWithMiddleware, RequestBuilder};
use crate::middleware::{SetHeaders, SetRole};
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
        }
    }

    /// Returns a copy of this client that sends `x-hasura-role: <role>` on every
    /// request.
    pub fn with_role(&self, role: impl Into<String>) -> Self {
        self.with_middleware(Arc::new(SetRole { role: role.into() }))
    }

    /// Returns a copy of this client that sends extra headers on every request.
    pub fn with_headers(&self, headers: HashMap<String, String>) -> Self {
        self.with_middleware(Arc::new(SetHeaders { headers }))
    }

    fn with_middleware(&self, mw: Arc<dyn http::Middleware>) -> Self {
        let mut middleware = self.middleware.clone();
        middleware.push(mw);
        Self::new(self.base_url.clone(), self.reqwest.clone(), middleware)
    }

    /// A middleware-aware request builder for `path` (joined onto `base_url`).
    /// Use it directly for full control, then buffer it with [`Client::send`].
    pub fn request(&self, method: reqwest::Method, path: &str) -> RequestBuilder {
        self.http
            .request(method, format!("{}{}", self.base_url, path))
    }

    /// Sends a built request through the middleware chain and returns the raw
    /// response body. A non-success status becomes [`Error::Api`].
    pub async fn send(&self, request: RequestBuilder) -> Result<Bytes, Error> {
        let (_status, _headers, body) = http::send(request, None).await?;
        Ok(body)
    }

    /// POSTs `body` as JSON to `path` and decodes the JSON response as `T`.
    pub async fn post<B, T>(&self, path: &str, body: &B) -> Result<T, Error>
    where
        B: Serialize + ?Sized,
        T: DeserializeOwned,
    {
        let request = self
            .request(reqwest::Method::POST, path)
            .json(body)
            .header("accept", "application/json");
        self.send_json(request).await
    }

    /// GETs `path` and decodes the JSON response as `T`.
    pub async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T, Error> {
        let request = self
            .request(reqwest::Method::GET, path)
            .header("accept", "application/json");
        self.send_json(request).await
    }

    async fn send_json<T: DeserializeOwned>(&self, request: RequestBuilder) -> Result<T, Error> {
        let body = self.send(request).await?;
        if body.is_empty() {
            // Allows `T = ()` / `Option<_>` for empty function responses.
            return Ok(serde_json::from_slice(b"null")?);
        }
        Ok(serde_json::from_slice(&body)?)
    }
}
