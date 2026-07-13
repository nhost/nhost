//! Functions client invoking Nhost serverless functions through the shared
//! fetch middleware chain.

use crate::fetch::{ChainFunction, Error, FetchFn, FetchResponse};
use serde::Serialize;
use std::sync::Arc;

/// Functions API client backed by a reqwest::Client and a middleware chain.
pub struct Client {
    pub base_url: String,
    reqwest: reqwest::Client,
    chain_functions: Vec<ChainFunction>,
    fetch: Arc<dyn FetchFn>,
}

impl Client {
    pub fn new(
        base_url: String,
        chain_functions: Vec<ChainFunction>,
        reqwest: reqwest::Client,
    ) -> Self {
        let fetch = crate::fetch::create_enhanced_fetch(reqwest.clone(), &chain_functions);
        Self {
            base_url,
            reqwest,
            chain_functions,
            fetch,
        }
    }

    pub fn push_chain_function(&mut self, cf: ChainFunction) {
        self.chain_functions.push(cf);
        self.fetch =
            crate::fetch::create_enhanced_fetch(self.reqwest.clone(), &self.chain_functions);
    }

    /// Invokes a function with an arbitrary method and raw body, returning the
    /// raw response bytes. Returns an [`Error::Api`] on a non-2xx/3xx response.
    pub async fn fetch(
        &self,
        path: &str,
        method: reqwest::Method,
        headers: Option<reqwest::header::HeaderMap>,
        body: Option<Vec<u8>>,
    ) -> Result<FetchResponse<bytes::Bytes>, Error> {
        let url = format!("{}{}", self.base_url, path);
        let mut builder = self.reqwest.request(method, &url);
        if let Some(b) = body {
            builder = builder.body(b);
        }
        if let Some(h) = headers {
            // Merge caller headers individually rather than replacing the whole
            // map, so request-builder defaults (e.g. a content type) survive.
            for (k, v) in h.iter() {
                builder = builder.header(k, v);
            }
        }

        let request = builder.build()?;
        let response = self.fetch.call(request).await?;

        if response.status >= 300 {
            return Err(Error::from_response(response));
        }

        Ok(FetchResponse {
            body: response.body,
            status: response.status,
            headers: response.headers,
        })
    }

    /// Convenience POST with a JSON body, decoding the JSON response.
    pub async fn post<B: Serialize>(
        &self,
        path: &str,
        body: &B,
        headers: Option<reqwest::header::HeaderMap>,
    ) -> Result<FetchResponse<serde_json::Value>, Error> {
        let url = format!("{}{}", self.base_url, path);
        let mut builder = self
            .reqwest
            .post(&url)
            .json(body)
            .header("Accept", "application/json");
        if let Some(h) = headers {
            // Merge caller headers individually rather than replacing the whole
            // map, so the `Content-Type: application/json` set by `.json()` and
            // the `Accept` header above survive when custom headers are passed.
            for (k, v) in h.iter() {
                builder = builder.header(k, v);
            }
        }

        let request = builder.build()?;
        let response = self.fetch.call(request).await?;

        let decoded: serde_json::Value = if response.body.is_empty() {
            serde_json::Value::Null
        } else {
            serde_json::from_slice(&response.body).unwrap_or_else(|_| {
                serde_json::Value::String(String::from_utf8_lossy(&response.body).into_owned())
            })
        };

        if response.status >= 300 {
            return Err(Error::from_response(response));
        }

        Ok(FetchResponse {
            body: decoded,
            status: response.status,
            headers: response.headers,
        })
    }
}
