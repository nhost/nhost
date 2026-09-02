//! The top-level [`Nhost`] client and its [`NhostBuilder`].

use crate::error::Error;
use crate::http::Middleware;
use crate::middleware::{
    AdminSession, AdminSessionOptions, AttachToken, SessionRefresh, SetHeaders, SetRole,
    DEFAULT_MARGIN_SECONDS,
};
use crate::session::{self, Backend, SessionStorage, StoredSession};
use crate::{auth, functions, graphql, storage};
use std::collections::HashMap;
use std::sync::Arc;

/// Default seconds before expiry at which the session is refreshed.
pub const DEFAULT_REFRESH_MARGIN_SECONDS: i64 = DEFAULT_MARGIN_SECONDS;

/// One of the Nhost services.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Service {
    /// The auth service (`auth.<region>.nhost.run/v1`).
    Auth,
    /// The storage service (`storage.<region>.nhost.run/v1`).
    Storage,
    /// The GraphQL endpoint (`graphql.<region>.nhost.run/v1`).
    Graphql,
    /// The functions service (`functions.<region>.nhost.run/v1`).
    Functions,
}

impl Service {
    fn as_str(self) -> &'static str {
        match self {
            Service::Auth => "auth",
            Service::Storage => "storage",
            Service::Graphql => "graphql",
            Service::Functions => "functions",
        }
    }
}

/// Builds the base URL for a service. An explicit `custom` URL wins; otherwise a
/// cloud URL is derived from subdomain/region; otherwise the local dev URL.
pub fn service_url(
    service: Service,
    subdomain: Option<&str>,
    region: Option<&str>,
    custom: Option<&str>,
) -> String {
    if let Some(u) = custom {
        return u.to_string();
    }
    match (subdomain, region) {
        (Some(s), Some(r)) => format!("https://{s}.{}.{r}.nhost.run/v1", service.as_str()),
        _ => format!("https://local.{}.local.nhost.run/v1", service.as_str()),
    }
}

/// How the client manages the auth session.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
enum SessionMode {
    /// Attach the access token and refresh it automatically (browser/app use).
    #[default]
    ClientSide,
    /// Attach the access token but never refresh (trusted server use).
    ServerSide,
    /// Do not touch the session at all.
    Disabled,
}

/// Unified, cheaply-shareable access to the Nhost services.
///
/// Build one with [`Nhost::builder`] (or [`Nhost::new`] for a cloud project);
/// [`Nhost::from_clients`] takes pre-built clients for full control over the
/// request pipeline.
pub struct Nhost {
    /// Auth service: sign-up and sign-in (password, OTP, magic link, WebAuthn,
    /// OAuth providers), MFA, PATs, user and JWK endpoints. The only client
    /// that captures sessions into [`sessions`](Self::sessions), and the only
    /// one an admin secret is never applied to.
    pub auth: auth::Client,
    /// Storage service: file upload, download, replace and delete, metadata
    /// (including presigned URLs and image transformations), plus the
    /// admin-only consistency endpoints.
    pub storage: storage::Client,
    /// GraphQL endpoint: `query(..).variable(..).send::<T>()`, decoding `data`
    /// into your own types and mapping `errors` to [`Error::GraphQl`].
    pub graphql: graphql::Client,
    /// Functions service: typed `get`/`post` helpers for your project's
    /// serverless functions, or [`functions::Client::request`] for full control.
    pub functions: functions::Client,
    /// The session store shared by every client and the session middleware:
    /// read it with [`Nhost::session`], observe it with
    /// [`SessionStorage::on_change`].
    pub sessions: SessionStorage,
}

impl Nhost {
    /// Starts configuring a client.
    pub fn builder() -> NhostBuilder {
        NhostBuilder::default()
    }

    /// Assembles a client from pre-built service clients.
    ///
    /// This is reserved for advanced use cases — for typical usage prefer
    /// [`Nhost::builder`], which wires the session middleware for you. The
    /// caller owns each client's middleware stack and must pass the same
    /// `sessions` store that the session middleware was built with, otherwise
    /// [`Nhost::session`] and the middleware will disagree.
    ///
    /// ```no_run
    /// use std::sync::Arc;
    /// use nhost::http::Middleware;
    /// use nhost::middleware::{AttachToken, SessionRefresh};
    /// use nhost::session::{self, SessionStorage};
    /// use nhost::{auth, functions, graphql, service_url, storage, Nhost, Service};
    ///
    /// let http = reqwest::Client::new();
    /// let sessions = SessionStorage::new(session::detect_storage());
    /// let url = |svc| service_url(svc, Some("abcdefgh"), Some("eu-central-1"), None);
    ///
    /// // A bare auth client, so refreshing does not recurse through the stack.
    /// let refresh_auth = Arc::new(auth::Client::new(url(Service::Auth), http.clone(), Vec::new()));
    ///
    /// let middleware: Vec<Arc<dyn Middleware>> = vec![
    ///     Arc::new(SessionRefresh {
    ///         auth: refresh_auth,
    ///         storage: sessions.clone(),
    ///         margin: nhost::DEFAULT_REFRESH_MARGIN_SECONDS,
    ///     }),
    ///     Arc::new(AttachToken { storage: sessions.clone() }),
    /// ];
    ///
    /// let client = Nhost::from_clients(
    ///     auth::Client::new(url(Service::Auth), http.clone(), middleware.clone())
    ///         .with_session_capture(sessions.clone()),
    ///     storage::Client::new(url(Service::Storage), http.clone(), middleware.clone()),
    ///     graphql::Client::new(url(Service::Graphql), http.clone(), middleware.clone()),
    ///     functions::Client::new(url(Service::Functions), http, middleware),
    ///     sessions,
    /// );
    /// ```
    pub fn from_clients(
        auth: auth::Client,
        storage: storage::Client,
        graphql: graphql::Client,
        functions: functions::Client,
        sessions: SessionStorage,
    ) -> Self {
        Self {
            auth,
            storage,
            graphql,
            functions,
            sessions,
        }
    }

    /// A cloud client for `subdomain`/`region` with default (client-side)
    /// session management. For anything else, use [`Nhost::builder`].
    pub fn new(subdomain: impl Into<String>, region: impl Into<String>) -> Self {
        NhostBuilder::default()
            .subdomain(subdomain)
            .region(region)
            .build()
            .expect("client-side build cannot fail")
    }

    /// The current stored session, if any.
    pub fn session(&self) -> Result<Option<StoredSession>, Error> {
        self.sessions.get()
    }

    /// Refreshes the session if it is near expiry, using the stored refresh
    /// token. Returns the (possibly unchanged) session.
    ///
    /// The refresh goes through [`Nhost::auth`](Self::auth) and its middleware;
    /// [`SessionRefresh`] skips the token endpoint, so this does not recurse.
    pub async fn refresh_session(&self) -> Result<Option<StoredSession>, Error> {
        session::refresh_session(&self.auth, &self.sessions, DEFAULT_REFRESH_MARGIN_SECONDS).await
    }

    /// Clears the stored session (client-side sign-out).
    pub fn clear_session(&self) -> Result<(), Error> {
        self.sessions.remove()
    }
}

/// Fluent builder for [`Nhost`]. Obtain one from [`Nhost::builder`].
#[derive(Default)]
pub struct NhostBuilder {
    subdomain: Option<String>,
    region: Option<String>,
    auth_url: Option<String>,
    storage_url: Option<String>,
    graphql_url: Option<String>,
    functions_url: Option<String>,
    storage: Option<Box<dyn Backend>>,
    reqwest: Option<reqwest::Client>,
    admin: Option<AdminSessionOptions>,
    role: Option<String>,
    headers: HashMap<String, String>,
    mode: SessionMode,
    margin: Option<i64>,
}

impl NhostBuilder {
    /// Sets the cloud project subdomain.
    pub fn subdomain(mut self, subdomain: impl Into<String>) -> Self {
        self.subdomain = Some(subdomain.into());
        self
    }

    /// Sets the cloud project region.
    pub fn region(mut self, region: impl Into<String>) -> Self {
        self.region = Some(region.into());
        self
    }

    /// Overrides the auth service URL.
    pub fn auth_url(mut self, url: impl Into<String>) -> Self {
        self.auth_url = Some(url.into());
        self
    }

    /// Overrides the storage service URL.
    pub fn storage_url(mut self, url: impl Into<String>) -> Self {
        self.storage_url = Some(url.into());
        self
    }

    /// Overrides the GraphQL service URL.
    pub fn graphql_url(mut self, url: impl Into<String>) -> Self {
        self.graphql_url = Some(url.into());
        self
    }

    /// Overrides the functions service URL.
    pub fn functions_url(mut self, url: impl Into<String>) -> Self {
        self.functions_url = Some(url.into());
        self
    }

    /// Sets the session storage backend (defaults to in-memory / localStorage).
    pub fn storage(mut self, backend: Box<dyn Backend>) -> Self {
        self.storage = Some(backend);
        self
    }

    /// Uses a pre-configured [`reqwest::Client`] (connection pools, proxies…).
    pub fn http_client(mut self, client: reqwest::Client) -> Self {
        self.reqwest = Some(client);
        self
    }

    /// Sets `x-hasura-role` on every request.
    pub fn role(mut self, role: impl Into<String>) -> Self {
        self.role = Some(role.into());
        self
    }

    /// Adds a header sent on every request.
    pub fn header(mut self, name: impl Into<String>, value: impl Into<String>) -> Self {
        self.headers.insert(name.into(), value.into());
        self
    }

    /// Sets the whole per-request header map.
    pub fn headers(mut self, headers: HashMap<String, String>) -> Self {
        self.headers = headers;
        self
    }

    /// Enables the admin secret on storage/graphql/functions. **Never use in
    /// client-side code** — it grants full admin access.
    pub fn admin_secret(mut self, secret: impl Into<String>) -> Self {
        self.admin = Some(AdminSessionOptions {
            admin_secret: secret.into(),
            ..Default::default()
        });
        self
    }

    /// Enables an admin session with full options (role, session variables).
    pub fn admin(mut self, options: AdminSessionOptions) -> Self {
        self.admin = Some(options);
        self
    }

    /// Server mode: attach the token but never auto-refresh. Requires an
    /// explicit per-request [`storage`](Self::storage) to avoid sharing one
    /// session across users.
    pub fn server(mut self) -> Self {
        self.mode = SessionMode::ServerSide;
        self
    }

    /// Disables all session middleware (token attach + refresh). You manage
    /// auth headers yourself (or via [`role`](Self::role)/[`admin`](Self::admin)).
    pub fn without_session_management(mut self) -> Self {
        self.mode = SessionMode::Disabled;
        self
    }

    /// Overrides the refresh margin (seconds before expiry).
    pub fn refresh_margin(mut self, seconds: i64) -> Self {
        self.margin = Some(seconds);
        self
    }

    /// Builds the [`Nhost`] client.
    ///
    /// # Errors
    /// Returns [`Error::Config`] in server mode without an explicit storage
    /// backend.
    pub fn build(self) -> Result<Nhost, Error> {
        if self.mode == SessionMode::ServerSide && self.storage.is_none() {
            return Err(Error::Config(
                "server mode requires an explicit storage backend (use a \
                 per-request/user backend to avoid leaking sessions across users)"
                    .to_string(),
            ));
        }

        let backend = self.storage.unwrap_or_else(session::detect_storage);
        let sessions = SessionStorage::new(backend);
        let http = self.reqwest.unwrap_or_default();
        let margin = self.margin.unwrap_or(DEFAULT_REFRESH_MARGIN_SECONDS);

        let sd = self.subdomain.as_deref();
        let rg = self.region.as_deref();
        let url = |svc, custom: Option<&str>| service_url(svc, sd, rg, custom);

        // A bare auth client (no middleware) used by the refresh middleware, so
        // refreshing does not recurse through the session middleware.
        let refresh_auth = Arc::new(auth::Client::new(
            url(Service::Auth, self.auth_url.as_deref()),
            http.clone(),
            Vec::new(),
        ));

        // Shared session/role/header middleware applied to every client.
        let mut common: Vec<Arc<dyn Middleware>> = Vec::new();
        match self.mode {
            SessionMode::ClientSide => {
                common.push(Arc::new(SessionRefresh {
                    auth: refresh_auth.clone(),
                    storage: sessions.clone(),
                    margin,
                }));
                common.push(Arc::new(AttachToken {
                    storage: sessions.clone(),
                }));
            }
            SessionMode::ServerSide => {
                common.push(Arc::new(AttachToken {
                    storage: sessions.clone(),
                }));
            }
            SessionMode::Disabled => {}
        }
        if let Some(role) = &self.role {
            common.push(Arc::new(SetRole { role: role.clone() }));
        }
        if !self.headers.is_empty() {
            common.push(Arc::new(SetHeaders {
                headers: self.headers.clone(),
            }));
        }

        // The admin secret applies to the data services, not auth.
        let mut data = common.clone();
        if let Some(admin) = &self.admin {
            data.push(Arc::new(AdminSession {
                options: admin.clone(),
            }));
        }

        let auth = auth::Client::new(
            url(Service::Auth, self.auth_url.as_deref()),
            http.clone(),
            common,
        )
        .with_session_capture(sessions.clone());
        let storage = storage::Client::new(
            url(Service::Storage, self.storage_url.as_deref()),
            http.clone(),
            data.clone(),
        );
        let graphql = graphql::Client::new(
            url(Service::Graphql, self.graphql_url.as_deref()),
            http.clone(),
            data.clone(),
        );
        let functions = functions::Client::new(
            url(Service::Functions, self.functions_url.as_deref()),
            http,
            data,
        );

        Ok(Nhost::from_clients(
            auth, storage, graphql, functions, sessions,
        ))
    }
}
