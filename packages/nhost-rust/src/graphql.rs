//! GraphQL client executing operations against a Hasura endpoint through the
//! shared fetch middleware chain.

use crate::fetch::{ChainFunction, Error, FetchFn, FetchResponse, Response};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// GraphQL variables.
pub type Variables = serde_json::Value;

/// A single GraphQL error entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphqlError {
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub locations: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub extensions: Option<serde_json::Value>,
}

/// The standard GraphQL response envelope.
#[derive(Debug, Clone, Deserialize)]
pub struct GraphqlResponse<T> {
    #[serde(default = "Option::default")]
    pub data: Option<T>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub errors: Option<Vec<GraphqlError>>,
}

/// GraphQL API client backed by a reqwest::Client and a middleware chain.
pub struct Client {
    pub url: String,
    reqwest: reqwest::Client,
    chain_functions: Vec<ChainFunction>,
    fetch: Arc<dyn FetchFn>,
}

impl Client {
    pub fn new(url: String, chain_functions: Vec<ChainFunction>, reqwest: reqwest::Client) -> Self {
        let fetch = crate::fetch::create_enhanced_fetch(reqwest.clone(), &chain_functions);
        Self {
            url,
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

    async fn execute(
        &self,
        query: &str,
        variables: Option<Variables>,
        operation_name: Option<&str>,
        headers: Option<reqwest::header::HeaderMap>,
    ) -> Result<Response, Error> {
        let mut payload = serde_json::Map::new();
        payload.insert(
            "query".to_string(),
            serde_json::Value::String(query.to_string()),
        );
        if let Some(v) = variables {
            payload.insert("variables".to_string(), v);
        }
        if let Some(op) = operation_name {
            payload.insert(
                "operationName".to_string(),
                serde_json::Value::String(op.to_string()),
            );
        }

        let mut builder = self.reqwest.post(&self.url).json(&payload);
        if let Some(h) = headers {
            builder = builder.headers(h);
        }

        let request = builder.build()?;
        self.fetch.call(request).await
    }

    /// Executes a GraphQL operation, decoding `data` as generic JSON. Returns
    /// an [`Error::Api`] if the response contains GraphQL errors.
    pub async fn request(
        &self,
        query: &str,
        variables: Option<Variables>,
        operation_name: Option<&str>,
        headers: Option<reqwest::header::HeaderMap>,
    ) -> Result<FetchResponse<GraphqlResponse<serde_json::Value>>, Error> {
        let response = self
            .execute(query, variables, operation_name, headers)
            .await?;

        let result: GraphqlResponse<serde_json::Value> = if response.body.is_empty() {
            GraphqlResponse {
                data: None,
                errors: None,
            }
        } else {
            serde_json::from_slice(&response.body)?
        };

        if result.errors.as_ref().is_some_and(|e| !e.is_empty()) {
            return Err(Error::from_response(response));
        }

        Ok(FetchResponse {
            body: result,
            status: response.status,
            headers: response.headers,
        })
    }
}
