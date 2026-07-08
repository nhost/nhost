//! Top-level Nhost client and factory functions.
//!
//! [`NhostClient`] bundles the auth, storage, graphql, and functions clients
//! over a shared [`reqwest::Client`] and a [`SessionStorage`]. Use
//! [`create_client`] for app clients (automatic refresh + token attachment),
//! [`create_server_client`] for trusted server contexts with explicit storage,
//! and [`create_nhost_client`] for a bare client you configure yourself.

use crate::fetch::{ChainFunction, Error};
use crate::middleware::{self, AdminSessionOptions};
use crate::session::{self, Backend, SessionStorage, StoredSession};
use crate::{auth, functions, graphql, storage};
use std::sync::Arc;

/// Default refresh margin used by the client-side middleware and refresh.
pub const DEFAULT_REFRESH_MARGIN_SECONDS: i64 = 60;

/// One of the Nhost services.
#[derive(Debug, Clone, Copy)]
pub enum ServiceType {
    Auth,
    Storage,
    Graphql,
    Functions,
}

impl ServiceType {
    fn as_str(self) -> &'static str {
        match self {
            ServiceType::Auth => "auth",
            ServiceType::Storage => "storage",
            ServiceType::Graphql => "graphql",
            ServiceType::Functions => "functions",
        }
    }
}

/// Builds the base URL for an Nhost service. Precedence: an explicit
/// `custom_url` wins; otherwise a cloud URL is built from subdomain/region;
/// otherwise the local development URL is used.
pub fn generate_service_url(
    service: ServiceType,
    subdomain: Option<&str>,
    region: Option<&str>,
    custom_url: Option<&str>,
) -> String {
    if let Some(u) = custom_url {
        return u.to_string();
    }

    match (subdomain, region) {
        (Some(s), Some(r)) => format!("https://{s}.{}.{r}.nhost.run/v1", service.as_str()),
        _ => format!("https://local.{}.local.nhost.run/v1", service.as_str()),
    }
}

/// The set of clients passed to a configuration function.
pub struct ConfigureContext {
    pub auth: auth::Client,
    pub storage: storage::Client,
    pub graphql: graphql::Client,
    pub functions: functions::Client,
    pub session_storage: SessionStorage,
    pub refresh_auth: Arc<auth::Client>,
}

impl ConfigureContext {
    fn apply(&mut self, chain: Vec<ChainFunction>) {
        for cf in chain {
            self.auth.push_chain_function(cf.clone());
            self.storage.push_chain_function(cf.clone());
            self.graphql.push_chain_function(cf.clone());
            self.functions.push_chain_function(cf);
        }
    }
}

/// A configuration function applied during client construction.
pub type ConfigurationFn = Box<dyn FnOnce(&mut ConfigureContext)>;

/// Enables automatic session refresh, token attachment, and session capture.
pub fn with_client_side_session_middleware(ctx: &mut ConfigureContext) {
    let chain = vec![
        middleware::session_refresh(
            ctx.refresh_auth.clone(),
            ctx.session_storage.clone(),
            DEFAULT_REFRESH_MARGIN_SECONDS,
        ),
        middleware::update_session_from_response(ctx.session_storage.clone()),
        middleware::attach_access_token(ctx.session_storage.clone()),
    ];
    ctx.apply(chain);
}

/// Enables token attachment and session capture, but no automatic refresh.
pub fn with_server_side_session_middleware(ctx: &mut ConfigureContext) {
    let chain = vec![
        middleware::update_session_from_response(ctx.session_storage.clone()),
        middleware::attach_access_token(ctx.session_storage.clone()),
    ];
    ctx.apply(chain);
}

/// Applies admin-secret middleware to storage, graphql, and functions.
/// Security warning: never use in client-side code.
pub fn with_admin_session(options: AdminSessionOptions) -> ConfigurationFn {
    Box::new(move |ctx| {
        let mw = middleware::with_admin_session(options);
        ctx.storage.push_chain_function(mw.clone());
        ctx.graphql.push_chain_function(mw.clone());
        ctx.functions.push_chain_function(mw);
    })
}

/// Applies arbitrary chain functions to all four clients.
pub fn with_chain_functions(chain: Vec<ChainFunction>) -> ConfigurationFn {
    Box::new(move |ctx| ctx.apply(chain))
}

/// Unified access to Nhost auth, storage, graphql, and functions.
pub struct NhostClient {
    pub auth: auth::Client,
    pub storage: storage::Client,
    pub graphql: graphql::Client,
    pub functions: functions::Client,
    pub session_storage: SessionStorage,
    refresh_auth: Arc<auth::Client>,
}

impl NhostClient {
    /// Returns the current session from storage, or `None`.
    pub fn get_user_session(&self) -> Option<StoredSession> {
        self.session_storage.get()
    }

    /// Refreshes the session using the stored refresh token.
    pub async fn refresh_session(&self, margin: i64) -> Result<Option<StoredSession>, Error> {
        session::refresh_session(&self.refresh_auth, &self.session_storage, margin).await
    }

    /// Removes the current session from storage (client-side sign-out).
    pub fn clear_session(&self) {
        self.session_storage.remove();
    }
}

/// Configuration for creating an Nhost client.
#[derive(Default)]
pub struct Options {
    pub subdomain: Option<String>,
    pub region: Option<String>,
    pub auth_url: Option<String>,
    pub storage_url: Option<String>,
    pub graphql_url: Option<String>,
    pub functions_url: Option<String>,
    pub storage: Option<Box<dyn Backend>>,
    pub reqwest: Option<reqwest::Client>,
    pub configure: Vec<ConfigurationFn>,
}

/// Creates and configures an Nhost client, applying `options.configure`.
pub fn create_nhost_client(options: Options) -> NhostClient {
    let Options {
        subdomain,
        region,
        auth_url,
        storage_url,
        graphql_url,
        functions_url,
        storage,
        reqwest,
        configure,
    } = options;

    let backend = storage.unwrap_or_else(session::detect_storage);
    let session_storage = SessionStorage::new(backend);
    let http = reqwest.unwrap_or_default();

    let sd = subdomain.as_deref();
    let rg = region.as_deref();

    let auth_client = auth::Client::new(
        generate_service_url(ServiceType::Auth, sd, rg, auth_url.as_deref()),
        vec![],
        http.clone(),
    );
    let storage_client = storage::Client::new(
        generate_service_url(ServiceType::Storage, sd, rg, storage_url.as_deref()),
        vec![],
        http.clone(),
    );
    let graphql_client = graphql::Client::new(
        generate_service_url(ServiceType::Graphql, sd, rg, graphql_url.as_deref()),
        vec![],
        http.clone(),
    );
    let functions_client = functions::Client::new(
        generate_service_url(ServiceType::Functions, sd, rg, functions_url.as_deref()),
        vec![],
        http.clone(),
    );
    let refresh_auth = Arc::new(auth::Client::new(
        generate_service_url(ServiceType::Auth, sd, rg, auth_url.as_deref()),
        vec![],
        http,
    ));

    let mut ctx = ConfigureContext {
        auth: auth_client,
        storage: storage_client,
        graphql: graphql_client,
        functions: functions_client,
        session_storage: session_storage.clone(),
        refresh_auth: refresh_auth.clone(),
    };

    for configure in configure {
        configure(&mut ctx);
    }

    NhostClient {
        auth: ctx.auth,
        storage: ctx.storage,
        graphql: ctx.graphql,
        functions: ctx.functions,
        session_storage,
        refresh_auth,
    }
}

/// Creates an app client with automatic refresh + token attachment.
pub fn create_client(mut options: Options) -> NhostClient {
    options
        .configure
        .insert(0, Box::new(with_client_side_session_middleware));
    create_nhost_client(options)
}

/// Creates a server client with explicit storage and no automatic refresh. It
/// requires `options.storage` — sharing a process-wide session store between
/// users can leak tokens across requests, so pass a per-request/user backend.
pub fn create_server_client(mut options: Options) -> Result<NhostClient, Error> {
    if options.storage.is_none() {
        return Err(Error::api(
            "create_server_client requires explicit options.storage \
                (use a per-request/user backend to avoid leaking sessions)"
                .to_string(),
            0,
            serde_json::Value::Null,
            reqwest::header::HeaderMap::new(),
        ));
    }

    options
        .configure
        .insert(0, Box::new(with_server_side_session_middleware));
    Ok(create_nhost_client(options))
}
