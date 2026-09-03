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

use crate::error::{is_sensitive_field_name, Error, GraphqlOperationError, RedactedJson};
use crate::http::{self, ClientWithMiddleware};
use crate::middleware::{HeaderPriority, SetHeaders, SetRole};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

/// GraphQL variables as free-form JSON.
pub type Variables = serde_json::Value;

/// A single GraphQL error entry.
///
/// [`Debug`](std::fmt::Debug) recursively redacts credential-bearing values in
/// `locations`, `path`, and `extensions`. The conventional `extensions.code`
/// classification, message, and non-sensitive values remain visible; a
/// server-supplied message may itself contain sensitive data.
#[derive(Clone, Serialize, Deserialize)]
pub struct GraphqlError {
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub locations: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub extensions: Option<serde_json::Value>,
}

impl std::fmt::Debug for GraphqlError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("GraphqlError")
            .field("message", &self.message)
            .field("locations", &self.locations.as_ref().map(RedactedJson))
            .field("path", &self.path.as_ref().map(RedactedJson))
            .field(
                "extensions",
                &self.extensions.as_ref().map(RedactedGraphqlExtensions),
            )
            .finish()
    }
}

struct RedactedGraphqlExtensions<'a>(&'a serde_json::Value);

impl std::fmt::Debug for RedactedGraphqlExtensions<'_> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let serde_json::Value::Object(values) = self.0 else {
            return std::fmt::Debug::fmt(&RedactedJson(self.0), f);
        };

        let mut extensions = f.debug_map();
        for (name, value) in values {
            if name == "code" && value.is_string() {
                // In GraphQL extensions this is an error classification, not
                // an OAuth authorization code. Keep it useful for diagnostics.
                extensions.entry(name, value);
            } else if is_sensitive_field_name(name) {
                extensions.entry(name, &"<redacted>");
            } else {
                extensions.entry(name, &RedactedJson(value));
            }
        }
        extensions.finish()
    }
}

impl GraphqlError {
    /// Returns the machine-readable `extensions.code`, when it is a string.
    pub fn code(&self) -> Option<&str> {
        self.extensions.as_ref()?.get("code")?.as_str()
    }
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

struct RawResponse {
    status: u16,
    headers: reqwest::header::HeaderMap,
    body: Option<serde_json::Value>,
}

/// GraphQL API client.
pub struct Client {
    /// The GraphQL endpoint URL.
    pub url: String,
    http: ClientWithMiddleware,
    reqwest: reqwest::Client,
    middleware: Vec<Arc<dyn http::Middleware>>,
    scoped_middleware: Vec<Arc<dyn http::Middleware>>,
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
            url: self.url.clone(),
            http,
            reqwest: self.reqwest.clone(),
            middleware: self.middleware.clone(),
            scoped_middleware,
        }
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
    variables: Option<Result<Variables, serde_json::Error>>,
    operation_name: Option<String>,
}

impl Operation<'_> {
    /// Replaces all variables at once from any serializable value.
    ///
    /// This discards named variables previously merged by [`Self::variable`],
    /// including any serialization error already recorded by the builder.
    /// Serialization failures are returned by [`Self::execute`] or [`Self::send`].
    pub fn variables(mut self, variables: impl Serialize) -> Self {
        self.variables = Some(serde_json::to_value(variables));
        self
    }

    /// Sets a single variable, merging into an object set by [`Self::variables`].
    ///
    /// Serialization failures and attempts to merge into non-object variables
    /// are returned by [`Self::execute`] or [`Self::send`].
    pub fn variable(mut self, key: impl Into<String>, value: impl Serialize) -> Self {
        if matches!(self.variables.as_ref(), Some(Err(_))) {
            return self;
        }

        let value = match serde_json::to_value(value) {
            Ok(value) => value,
            Err(error) => {
                self.variables = Some(Err(error));
                return self;
            }
        };
        let variables = self
            .variables
            .get_or_insert_with(|| Ok(serde_json::Value::Object(serde_json::Map::new())));
        match variables {
            Ok(serde_json::Value::Object(map)) => {
                map.insert(key.into(), value);
            }
            Ok(_) => {
                *variables = Err(<serde_json::Error as serde::ser::Error>::custom(
                    "cannot add a named variable after setting non-object variables",
                ));
            }
            Err(_) => return self,
        }
        self
    }

    /// Sets the operation name (for multi-operation documents).
    pub fn operation_name(mut self, name: impl Into<String>) -> Self {
        self.operation_name = Some(name.into());
        self
    }

    /// Sends the operation and returns `data` decoded as `T`.
    ///
    /// A non-empty GraphQL `errors` array produces [`Error::GraphQl`] before
    /// `data` is decoded, preserving any partial data in the error payload.
    /// GraphQL errors take precedence over a 3xx status other than 304, or a
    /// 4xx/5xx status; such a status without GraphQL errors produces
    /// [`Error::Api`]. A response with neither errors nor data also produces
    /// [`Error::GraphQl`].
    pub async fn send<T: DeserializeOwned>(self) -> Result<T, Error> {
        let raw = self.execute_raw().await?;
        let Some(body) = raw.body else {
            return Err(Error::GraphQl(Box::new(GraphqlOperationError::new(
                Vec::new(),
                None,
                raw.status,
                raw.headers,
            ))));
        };

        let envelope: GraphqlResponse<serde_json::Value> = serde_json::from_value(body)?;
        if let Some(errors) = envelope.errors.filter(|errors| !errors.is_empty()) {
            return Err(Error::GraphQl(Box::new(GraphqlOperationError::new(
                errors,
                envelope.data,
                raw.status,
                raw.headers,
            ))));
        }

        let data = envelope.data.ok_or_else(|| {
            Error::GraphQl(Box::new(GraphqlOperationError::new(
                Vec::new(),
                None,
                raw.status,
                raw.headers,
            )))
        })?;
        Ok(serde_json::from_value(data)?)
    }

    /// Sends the operation and returns the full GraphQL envelope (`data` +
    /// `errors`) together with the transport status and headers, decoding
    /// `data` as `T`.
    ///
    /// On a successful HTTP response, GraphQL errors remain in the returned
    /// envelope so callers can inspect them directly. On a 3xx status other
    /// than 304, or a 4xx/5xx status, a non-empty GraphQL `errors` array takes
    /// precedence and produces [`Error::GraphQl`]; otherwise that status
    /// produces [`Error::Api`]. Variable serialization, transport, and
    /// response-decoding failures are also returned as errors.
    pub async fn execute<T: DeserializeOwned>(
        self,
    ) -> Result<http::Response<GraphqlResponse<T>>, Error> {
        let raw = self.execute_raw().await?;
        let body = match raw.body {
            Some(body) => serde_json::from_value(body)?,
            None => GraphqlResponse {
                data: None,
                errors: None,
            },
        };
        Ok(http::Response {
            body,
            status: raw.status,
            headers: raw.headers,
        })
    }

    async fn execute_raw(self) -> Result<RawResponse, Error> {
        let variables = self.variables.transpose()?;
        let payload = Payload {
            query: &self.query,
            variables: variables.as_ref(),
            operation_name: self.operation_name.as_deref(),
        };
        let request = self.client.http.post(&self.client.url).json(&payload);
        let response = http::send_buffered(request, None).await?;
        let bytes = response.bytes?;
        let body = if bytes.is_empty() {
            None
        } else {
            match serde_json::from_slice(&bytes) {
                Ok(body) => Some(body),
                Err(_) if !response.success && response.status != 304 => {
                    return Err(Error::from_response(
                        response.status,
                        response.headers,
                        bytes,
                    ));
                }
                Err(error) => return Err(error.into()),
            }
        };

        if !response.success && response.status != 304 {
            if let Some(error) = body.as_ref().and_then(|body| {
                graphql_error_from_body(body, response.status, response.headers.clone())
            }) {
                return Err(Error::GraphQl(Box::new(error)));
            }
            return Err(Error::from_response(
                response.status,
                response.headers,
                bytes,
            ));
        }

        Ok(RawResponse {
            status: response.status,
            headers: response.headers,
            body,
        })
    }
}

fn graphql_error_from_body(
    body: &serde_json::Value,
    status: u16,
    headers: reqwest::header::HeaderMap,
) -> Option<GraphqlOperationError> {
    let envelope: GraphqlResponse<serde_json::Value> = serde_json::from_value(body.clone()).ok()?;
    let errors = envelope.errors.filter(|errors| !errors.is_empty())?;
    Some(GraphqlOperationError::new(
        errors,
        envelope.data,
        status,
        headers,
    ))
}
