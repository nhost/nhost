//! The top-level [`Nhost`] client and its [`NhostBuilder`].

use crate::error::Error;
use crate::http::Middleware;
use crate::middleware::{
    AdminSession, AdminSessionOptions, AttachToken, HeaderPriority, SessionRefresh, SetHeaders,
    SetRole, DEFAULT_MARGIN_SECONDS,
};
use crate::session::{self, Backend, SessionStorage, StoredSession};
use crate::{auth, functions, graphql, storage};
use std::collections::HashMap;
use std::sync::Arc;

/// Default seconds before expiry at which the session is refreshed.
pub const DEFAULT_REFRESH_MARGIN_SECONDS: i64 = DEFAULT_MARGIN_SECONDS;

/// One of the Nhost services.
///
/// This enum is non-exhaustive because Nhost may expose additional services.
/// Downstream matches must include a wildcard arm.
#[non_exhaustive]
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
/// cloud URL is derived when both subdomain and region are present. When neither
/// is present, the local development URL is used. Cloud-project fields must be
/// single ASCII DNS labels; Unicode/IDNA input is rejected rather than punycoded.
/// Trailing slashes are removed.
///
/// Derived and custom URLs pass through the same validation and normalization.
///
/// # Errors
///
/// Returns [`Error::Config`] when only one cloud-project field is present without
/// a custom URL, either field is empty or contains an unsupported character, or
/// the resulting URL is not an append-safe HTTP(S) base URL.
pub fn service_url(
    service: Service,
    subdomain: Option<&str>,
    region: Option<&str>,
    custom: Option<&str>,
) -> Result<String, Error> {
    for (name, value) in [("subdomain", subdomain), ("region", region)] {
        if value.is_some_and(|value| value.trim().is_empty()) {
            return Err(Error::Config(format!(
                "{name} must not be empty or whitespace-only"
            )));
        }
        if value.is_some_and(|value| !is_cloud_host_label(value)) {
            return Err(Error::Config(format!(
                "{name} must be a single DNS label of 1-63 ASCII letters, digits, or hyphens, \
                 starting and ending with a letter or digit"
            )));
        }
    }

    let url = if let Some(url) = custom {
        url.to_string()
    } else {
        match (subdomain, region) {
            (Some(subdomain), Some(region)) => derived_service_url(service, subdomain, region)?,
            (None, None) => derived_service_url(service, "local", "local")?,
            _ => {
                return Err(Error::Config(
                    "subdomain and region must be set together; omit both for the local dev \
                     backend or override every service URL"
                        .to_string(),
                ));
            }
        }
    };

    normalize_service_url(service, &url)
}

fn is_cloud_host_label(value: &str) -> bool {
    let bytes = value.as_bytes();
    (1..=63).contains(&bytes.len())
        && bytes.first().is_some_and(u8::is_ascii_alphanumeric)
        && bytes.last().is_some_and(u8::is_ascii_alphanumeric)
        && bytes
            .iter()
            .all(|byte| byte.is_ascii_alphanumeric() || *byte == b'-')
}

fn derived_service_url(service: Service, subdomain: &str, region: &str) -> Result<String, Error> {
    let mut url = url::Url::parse("https://nhost.run/v1").expect("static service URL is valid");
    let mut host = String::with_capacity(
        subdomain.len() + service.as_str().len() + region.len() + ".nhost.run".len() + 2,
    );
    host.push_str(subdomain);
    host.push('.');
    host.push_str(service.as_str());
    host.push('.');
    host.push_str(region);
    host.push_str(".nhost.run");
    url.set_host(Some(&host)).map_err(|error| {
        Error::Config(format!(
            "invalid {} service host after DNS-label validation: {error}",
            service.as_str()
        ))
    })?;
    Ok(url.into())
}

fn normalize_service_url(service: Service, url: &str) -> Result<String, Error> {
    let parsed = url::Url::parse(url).map_err(|error| {
        Error::Config(format!("invalid {} service URL: {error}", service.as_str()))
    })?;

    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(Error::Config(format!(
            "invalid {} service URL: scheme must be http or https",
            service.as_str()
        )));
    }
    if parsed.host_str().is_none() {
        return Err(Error::Config(format!(
            "invalid {} service URL: host is required",
            service.as_str()
        )));
    }
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err(Error::Config(format!(
            "invalid {} service URL: userinfo is not allowed",
            service.as_str()
        )));
    }
    if parsed.query().is_some() || parsed.fragment().is_some() {
        return Err(Error::Config(format!(
            "invalid {} service URL: query strings and fragments are not allowed",
            service.as_str()
        )));
    }

    Ok(parsed.as_str().trim_end_matches('/').to_string())
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
    /// Middleware-free auth client used only by [`Nhost::refresh_session`].
    /// Keeping it separate makes `session::refresh_once` the sole owner of the
    /// refresh response's session-store write.
    refresh_auth: Arc<auth::Client>,
    /// Auth service: sign-up and sign-in (password, OTP, magic link, WebAuthn,
    /// OAuth providers), MFA, PATs, user and JWK endpoints. The only client
    /// that captures sessions into [`sessions`](Self::sessions), and the only
    /// one where the [admin middleware](NhostBuilder::admin) is never installed.
    /// Arbitrary defaults from [`NhostBuilder::header`] and headers on an
    /// [`auth::Client::with_headers`] clone still apply, including an explicitly
    /// configured `x-hasura-admin-secret`.
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
    /// caller owns each client's middleware stack, must supply a dedicated,
    /// middleware-free `refresh_auth` client without session capture, and must
    /// pass the same `sessions` store that the session middleware was built with.
    /// Otherwise [`Nhost::session`] and the middleware will disagree or a refresh
    /// response may be written twice. A `refresh_auth` client carrying
    /// [`SessionRefresh`] can recursively acquire the session refresh lock and hang
    /// rather than return an error when that middleware's guarded auth base differs
    /// from `refresh_auth`'s base. Direct service-client constructors do not validate
    /// or normalize their base URLs; derive them with [`service_url`] or ensure
    /// they are HTTP(S) URLs without userinfo, a query, a fragment, or trailing
    /// slashes. If the public stack includes [`SessionRefresh`], its refresh
    /// client's auth base URL must be textually equivalent to the public `auth`
    /// client's base URL so direct refresh requests do not trigger a redundant
    /// automatic refresh. Middleware installed only on the public `auth` client
    /// does not apply to [`Nhost::refresh_session`]; configure required default
    /// headers on the underlying `reqwest::Client` shared with `refresh_auth`.
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
    /// let url = |svc| {
    ///     service_url(svc, Some("abcdefgh"), Some("eu-central-1"), None)
    ///         .expect("valid project configuration")
    /// };
    ///
    /// // A bare auth client, so refreshing does not recurse through the stack.
    /// let refresh_auth = Arc::new(auth::Client::new(url(Service::Auth), http.clone(), Vec::new()));
    ///
    /// let middleware: Vec<Arc<dyn Middleware>> = vec![
    ///     Arc::new(SessionRefresh {
    ///         auth: refresh_auth.clone(),
    ///         storage: sessions.clone(),
    ///         margin: nhost::DEFAULT_REFRESH_MARGIN_SECONDS,
    ///     }),
    ///     Arc::new(AttachToken { storage: sessions.clone() }),
    /// ];
    ///
    /// let client = Nhost::from_clients(
    ///     auth::Client::new(url(Service::Auth), http.clone(), middleware.clone())
    ///         .with_session_capture(sessions.clone()),
    ///     refresh_auth,
    ///     storage::Client::new(url(Service::Storage), http.clone(), middleware.clone()),
    ///     graphql::Client::new(url(Service::Graphql), http.clone(), middleware.clone()),
    ///     functions::Client::new(url(Service::Functions), http, middleware),
    ///     sessions,
    /// );
    /// ```
    pub fn from_clients(
        auth: auth::Client,
        refresh_auth: Arc<auth::Client>,
        storage: storage::Client,
        graphql: graphql::Client,
        functions: functions::Client,
        sessions: SessionStorage,
    ) -> Self {
        Self {
            refresh_auth,
            auth,
            storage,
            graphql,
            functions,
            sessions,
        }
    }

    /// A cloud client for `subdomain`/`region` with default (client-side)
    /// session management. For anything else, use [`Nhost::builder`].
    ///
    /// # Errors
    ///
    /// Returns [`Error::Config`] when either project field is empty, contains
    /// characters other than ASCII letters, digits, or hyphens, or produces an
    /// invalid derived service URL.
    pub fn new(subdomain: impl Into<String>, region: impl Into<String>) -> Result<Self, Error> {
        NhostBuilder::default()
            .subdomain(subdomain)
            .region(region)
            .build()
    }

    /// The current stored session, if any.
    pub fn session(&self) -> Result<Option<StoredSession>, Error> {
        self.sessions.get()
    }

    /// Refreshes the session if it is near expiry, using the stored refresh
    /// token. Returns the (possibly unchanged) session.
    ///
    /// The refresh uses the dedicated auth client supplied at construction,
    /// without the public [`Nhost::auth`](Self::auth) client's session capture.
    /// [`session::refresh_session`] is therefore the sole owner of the store write.
    pub async fn refresh_session(&self) -> Result<Option<StoredSession>, Error> {
        session::refresh_session(
            &self.refresh_auth,
            &self.sessions,
            DEFAULT_REFRESH_MARGIN_SECONDS,
        )
        .await
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

    /// Overrides the auth service URL. [`Self::build`] validates it as an
    /// append-safe HTTP(S) URL and removes trailing slashes.
    pub fn auth_url(mut self, url: impl Into<String>) -> Self {
        self.auth_url = Some(url.into());
        self
    }

    /// Overrides the storage service URL. [`Self::build`] validates it as an
    /// append-safe HTTP(S) URL and removes trailing slashes.
    pub fn storage_url(mut self, url: impl Into<String>) -> Self {
        self.storage_url = Some(url.into());
        self
    }

    /// Overrides the GraphQL service URL. [`Self::build`] validates it as an
    /// append-safe HTTP(S) URL and removes trailing slashes.
    pub fn graphql_url(mut self, url: impl Into<String>) -> Self {
        self.graphql_url = Some(url.into());
        self
    }

    /// Overrides the functions service URL. [`Self::build`] validates it as an
    /// append-safe HTTP(S) URL and removes trailing slashes.
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

    /// Overrides the automatic session-refresh middleware's margin in seconds
    /// before access-token expiry. [`Self::build`] rejects negative margins and
    /// values too large to schedule without overflowing millisecond timestamps.
    ///
    /// A margin of `0` forces an automatic refresh attempt before every eligible
    /// request; requests that already have an `Authorization` header and direct
    /// calls to the refresh endpoint are excluded. It also deliberately treats
    /// the stored session as not expired: a transport failure or rejected
    /// response (including `401`) is not retried, the session is not cleared, and
    /// the request continues with the existing, possibly expired, bearer token.
    ///
    /// This setting configures only [`crate::middleware::SessionRefresh`].
    /// [`Nhost::refresh_session`] always uses
    /// [`crate::DEFAULT_REFRESH_MARGIN_SECONDS`] and ignores this value; call
    /// [`session::refresh_session`] directly to select a margin for an explicit
    /// refresh.
    pub fn refresh_margin(mut self, seconds: i64) -> Self {
        self.margin = Some(seconds);
        self
    }

    /// Builds the [`Nhost`] client.
    ///
    /// # Errors
    ///
    /// Returns [`Error::Config`] for incomplete, empty, or invalid cloud-project
    /// fields, invalid service URLs, an invalid refresh margin, or server mode
    /// without an explicit storage backend.
    pub fn build(self) -> Result<Nhost, Error> {
        if self.mode == SessionMode::ServerSide && self.storage.is_none() {
            return Err(Error::Config(
                "server mode requires an explicit storage backend (use a \
                 per-request/user backend to avoid leaking sessions across users)"
                    .to_string(),
            ));
        }

        let subdomain = self.subdomain.as_deref();
        let region = self.region.as_deref();
        let auth_url = service_url(Service::Auth, subdomain, region, self.auth_url.as_deref())?;
        let storage_url = service_url(
            Service::Storage,
            subdomain,
            region,
            self.storage_url.as_deref(),
        )?;
        let graphql_url = service_url(
            Service::Graphql,
            subdomain,
            region,
            self.graphql_url.as_deref(),
        )?;
        let functions_url = service_url(
            Service::Functions,
            subdomain,
            region,
            self.functions_url.as_deref(),
        )?;

        let margin = self.margin.unwrap_or(DEFAULT_REFRESH_MARGIN_SECONDS);
        session::validate_refresh_margin(margin)?;

        let backend = self.storage.unwrap_or_else(session::detect_storage);
        let sessions = SessionStorage::new(backend);
        let http = self.reqwest.unwrap_or_default();

        // A bare auth client (no middleware) used by the refresh middleware, so
        // refreshing does not recurse through the session middleware.
        let refresh_auth = Arc::new(auth::Client::new(
            auth_url.clone(),
            http.clone(),
            Vec::new(),
        ));

        // Builder defaults run before session middleware so an explicit
        // Authorization default suppresses refresh as well as winning on the
        // wire. Stack position makes the Authorization short-circuit effective;
        // priorities settle conflicts among headers written by middleware.
        let mut common: Vec<Arc<dyn Middleware>> = Vec::new();
        if let Some(role) = &self.role {
            common.push(Arc::new(SetRole {
                role: role.clone(),
                priority: HeaderPriority::Default,
            }));
        }
        if !self.headers.is_empty() {
            common.push(Arc::new(SetHeaders {
                headers: self.headers.clone(),
                priority: HeaderPriority::Default,
            }));
        }
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

        // The admin secret applies to the data services, not auth.
        let mut data = common.clone();
        if let Some(admin) = &self.admin {
            data.push(Arc::new(AdminSession {
                options: admin.clone(),
            }));
        }

        let auth = auth::Client::new(auth_url, http.clone(), common)
            .with_session_capture(sessions.clone());
        let storage = storage::Client::new(storage_url, http.clone(), data.clone());
        let graphql = graphql::Client::new(graphql_url, http.clone(), data.clone());
        let functions = functions::Client::new(functions_url, http, data);

        Ok(Nhost::from_clients(
            auth,
            refresh_auth,
            storage,
            graphql,
            functions,
            sessions,
        ))
    }
}
