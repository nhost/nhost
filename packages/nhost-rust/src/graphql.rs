//! Typed GraphQL client.
//!
//! Operations are built fluently and decoded into your own types:
//!
//! ```no_run
//! # async fn f(client: &nhost::graphql::Client) -> Result<(), nhost::Error> {
//! # #[derive(serde::Deserialize)]
//! # struct Data { todos: Vec<serde_json::Value> }
//! let data: Data = client
//!     .query("query ($limit: Int!) { todos(limit: $limit) { id } }")
//!     .variable("limit", 10)
//!     .send()
//!     .await?;
//! # let _ = data.todos;
//! # Ok(())
//! # }
//! ```

use crate::error::Error;
use crate::http::{self, ClientWithMiddleware};
use crate::middleware::{SetHeaders, SetRole};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

/// GraphQL variables as free-form JSON.
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

/// The standard GraphQL response envelope, with `data` decoded as `T`.
#[derive(Debug, Clone, Deserialize)]
pub struct GraphqlResponse<T> {
    #[serde(default = "Option::default")]
    pub data: Option<T>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub errors: Option<Vec<GraphqlError>>,
}

#[derive(Serialize)]
struct Payload<'a> {
    query: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    variables: Option<&'a Variables>,
    #[serde(rename = "operationName", skip_serializing_if = "Option::is_none")]
    operation_name: Option<&'a str>,
}

/// GraphQL API client.
pub struct Client {
    /// The GraphQL endpoint URL.
    pub url: String,
    http: ClientWithMiddleware,
    reqwest: reqwest::Client,
    middleware: Vec<Arc<dyn http::Middleware>>,
}

impl Client {
    /// Creates a client for the GraphQL endpoint `url` from a base client and
    /// an ordered middleware stack (the first entry runs first on the way out).
    ///
    /// Most applications get their clients from [`crate::Nhost::builder`]
    /// instead; use this together with [`crate::Nhost::from_clients`] to
    /// assemble the pipeline yourself.
    pub fn new(
        url: impl Into<String>,
        reqwest: reqwest::Client,
        middleware: Vec<Arc<dyn http::Middleware>>,
    ) -> Self {
        let http = http::build_client(reqwest.clone(), &middleware);
        Self {
            url: url.into(),
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
        Self::new(self.url.clone(), self.reqwest.clone(), middleware)
    }

    /// Begins building a GraphQL operation.
    pub fn query(&self, query: impl Into<String>) -> Operation<'_> {
        Operation {
            client: self,
            query: query.into(),
            variables: None,
            operation_name: None,
        }
    }
}

/// A GraphQL operation being built. Created by [`Client::query`].
#[must_use = "an operation does nothing until `.send()` or `.execute()` is awaited"]
pub struct Operation<'a> {
    client: &'a Client,
    query: String,
    variables: Option<Variables>,
    operation_name: Option<String>,
}

impl Operation<'_> {
    /// Sets all variables at once from any serializable value.
    pub fn variables(mut self, variables: impl Serialize) -> Self {
        self.variables = Some(serde_json::to_value(variables).unwrap_or_default());
        self
    }

    /// Sets a single variable, merging into any already set.
    pub fn variable(mut self, key: impl Into<String>, value: impl Serialize) -> Self {
        let obj = self
            .variables
            .get_or_insert_with(|| serde_json::Value::Object(serde_json::Map::new()));
        if let Some(map) = obj.as_object_mut() {
            map.insert(key.into(), serde_json::to_value(value).unwrap_or_default());
        }
        self
    }

    /// Sets the operation name (for multi-operation documents).
    pub fn operation_name(mut self, name: impl Into<String>) -> Self {
        self.operation_name = Some(name.into());
        self
    }

    /// Sends the operation and returns `data` decoded as `T`. Returns
    /// [`Error::GraphQl`] if the response carries `errors` or no data.
    pub async fn send<T: DeserializeOwned>(self) -> Result<T, Error> {
        let resp = self.execute::<T>().await?;
        if let Some(errors) = &resp.errors {
            if !errors.is_empty() {
                let msg = errors
                    .iter()
                    .map(|e| e.message.clone())
                    .collect::<Vec<_>>()
                    .join(", ");
                return Err(Error::GraphQl(msg));
            }
        }
        resp.data
            .ok_or_else(|| Error::GraphQl("response contained no data".to_string()))
    }

    /// Sends the operation and returns the full response envelope (`data` +
    /// `errors`), decoding `data` as `T`. Only transport/HTTP failures error.
    pub async fn execute<T: DeserializeOwned>(self) -> Result<GraphqlResponse<T>, Error> {
        let payload = Payload {
            query: &self.query,
            variables: self.variables.as_ref(),
            operation_name: self.operation_name.as_deref(),
        };
        let request = self.client.http.post(&self.client.url).json(&payload);
        let (_status, _headers, body) = http::send(request, None).await?;

        if body.is_empty() {
            return Ok(GraphqlResponse {
                data: None,
                errors: None,
            });
        }
        Ok(serde_json::from_slice(&body)?)
    }
}
