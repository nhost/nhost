//! Request-side middleware implementing [`reqwest_middleware::Middleware`].
//!
//! All middleware here only mutates the outgoing request (headers) or triggers
//! a refresh before sending; none reads the response body. Response-side
//! session updates live in the auth client ([`crate::http::send`]) because a
//! browser `reqwest::Response` cannot be rebuilt from buffered bytes.

use crate::auth;
use crate::http::{self as nhost_http, Middleware};
use crate::session::{self, SessionStorage};
use http::Extensions;
use reqwest::header::{HeaderName, HeaderValue, AUTHORIZATION};
use reqwest::{Request, Response};
use reqwest_middleware::Next;
use std::collections::HashMap;
use std::sync::Arc;

/// Default seconds before expiry at which the refresh middleware refreshes.
pub const DEFAULT_MARGIN_SECONDS: i64 = session::DEFAULT_MARGIN_SECONDS;

type MwResult = reqwest_middleware::Result<Response>;
type MwUnitResult = reqwest_middleware::Result<()>;

/// Precedence assigned to headers written by SDK middleware.
///
/// Headers already present on the request but absent from the middleware map
/// were set while building the request and always win. The declaration order
/// is semantic because [`Ord`] determines which middleware value wins: variants
/// are listed from lowest to highest priority, and new variants must be inserted
/// at the position matching their intended precedence.
#[non_exhaustive]
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum HeaderPriority {
    /// A bearer token read from session storage.
    Session,
    /// A default configured on [`crate::NhostBuilder`].
    Default,
    /// An admin-session role or session variable.
    Admin,
    /// A header configured on a scoped client clone.
    Scoped,
}

#[derive(Clone, Default)]
struct MiddlewareHeaders(HashMap<HeaderName, HeaderPriority>);

fn parse_header(name: &str, value: &str) -> reqwest_middleware::Result<(HeaderName, HeaderValue)> {
    let name = HeaderName::from_bytes(name.as_bytes()).map_err(|_| {
        reqwest_middleware::Error::Middleware(anyhow::anyhow!("invalid header name `{name}`"))
    })?;
    let value = HeaderValue::from_str(value).map_err(|_| {
        reqwest_middleware::Error::Middleware(anyhow::anyhow!("invalid value for header `{name}`"))
    })?;
    Ok((name, value))
}

fn set_prioritized_header(
    req: &mut Request,
    ext: &mut Extensions,
    name: &str,
    value: &str,
    priority: HeaderPriority,
) -> MwUnitResult {
    // Parse even when a request-built header wins so invalid middleware
    // configuration is always reported instead of being silently masked.
    let (name, value) = parse_header(name, value)?;
    let existing_priority = ext
        .get::<MiddlewareHeaders>()
        .and_then(|headers| headers.0.get(&name).copied());
    let should_set = !req.headers().contains_key(&name)
        || existing_priority.is_some_and(|existing| existing <= priority);

    if should_set {
        req.headers_mut().insert(name.clone(), value);
        ext.get_or_insert_default::<MiddlewareHeaders>()
            .0
            .insert(name, priority);
    }
    Ok(())
}

/// The origin a credential middleware is allowed to write to.
///
/// Credentials are scoped to the service they were configured for so a request
/// that has been retargeted (by custom middleware, or by a caller reusing a
/// client against another host) cannot carry them off-origin.
#[derive(Clone, Debug)]
pub(crate) struct RequestScope {
    scheme: String,
    host: String,
    port: Option<u16>,
}

impl RequestScope {
    /// Parses a service base URL. An unparseable URL yields `None`, and every
    /// scope check then fails closed.
    pub(crate) fn from_base_url(base_url: &str) -> Option<Self> {
        let url = url::Url::parse(base_url).ok()?;
        Some(Self {
            scheme: url.scheme().to_ascii_lowercase(),
            host: url.host_str()?.to_ascii_lowercase(),
            port: url.port_or_known_default(),
        })
    }

    /// True when `url` is the same origin (scheme, host and port) as the scope.
    pub(crate) fn contains(&self, url: &reqwest::Url) -> bool {
        url.scheme().eq_ignore_ascii_case(&self.scheme)
            && url
                .host_str()
                .is_some_and(|host| host.eq_ignore_ascii_case(&self.host))
            && url.port_or_known_default() == self.port
    }

    /// True when the admin secret may be sent: same origin, and either HTTPS, a
    /// loopback host, or an explicit cleartext opt-in.
    pub(crate) fn permits_admin_session(
        &self,
        url: &reqwest::Url,
        allow_insecure_http: bool,
    ) -> bool {
        self.contains(url)
            && (self.scheme == "https" || allow_insecure_http || is_loopback_host(&self.host))
    }
}

fn is_loopback_host(host: &str) -> bool {
    if host.eq_ignore_ascii_case("localhost") {
        return true;
    }
    host.parse::<std::net::IpAddr>()
        .is_ok_and(|address| address.is_loopback())
}

/// Attaches `Authorization: Bearer <token>` from the stored session, unless the
/// request already carries one. Runs after [`SessionRefresh`].
///
/// The token is written only for requests inside `service_url`'s origin. A
/// request that has left that origin has the stored bearer stripped, so a
/// retargeting middleware cannot forward the user's access token to another
/// host; an unrelated caller-supplied `Authorization` value is preserved.
pub struct AttachToken {
    /// The store the access token is read from.
    pub storage: SessionStorage,
    /// The base URL of the service this middleware is installed on.
    pub service_url: String,
}

#[cfg_attr(not(target_arch = "wasm32"), async_trait::async_trait)]
#[cfg_attr(target_arch = "wasm32", async_trait::async_trait(?Send))]
impl Middleware for AttachToken {
    async fn handle(&self, mut req: Request, ext: &mut Extensions, next: Next<'_>) -> MwResult {
        // A missing or unparseable service URL fails closed: no token is written
        // and any stored bearer already on the request is stripped.
        let scope = RequestScope::from_base_url(&self.service_url);
        let in_scope = scope.is_some_and(|scope| scope.contains(req.url()));
        let has_authorization = req.headers().contains_key(AUTHORIZATION);

        if in_scope && has_authorization {
            return next.run(req, ext).await;
        }

        let stored = self
            .storage
            .get()
            .map_err(|error| reqwest_middleware::Error::Middleware(anyhow::Error::new(error)))?;
        let Some(session) = stored else {
            return next.run(req, ext).await;
        };
        if session.session.access_token.is_empty() {
            return next.run(req, ext).await;
        }

        let bearer = format!("Bearer {}", session.session.access_token);
        if in_scope {
            set_prioritized_header(
                &mut req,
                ext,
                "authorization",
                &bearer,
                HeaderPriority::Session,
            )?;
        } else if req
            .headers()
            .get(AUTHORIZATION)
            .is_some_and(|value| value.as_bytes() == bearer.as_bytes())
        {
            // Off-origin and carrying exactly the stored token: strip it. An
            // unrelated caller-supplied value is left untouched.
            req.headers_mut().remove(AUTHORIZATION);
        }
        next.run(req, ext).await
    }
}

/// Refreshes the session before a request when the token is near expiry. Skips
/// requests that already carry an Authorization header and this client's exact
/// auth refresh endpoint.
///
/// Prefer a middleware-free [`auth::Client`] here: refreshing through a client
/// that carries this middleware relies on the refresh-endpoint check to avoid
/// recursing into itself.
pub struct SessionRefresh {
    /// The client used to call the refresh endpoint.
    pub auth: Arc<auth::Client>,
    /// The store the refresh token is read from and the new session written to.
    pub storage: SessionStorage,
    /// Seconds before expiry at which to refresh; `0` always refreshes. Negative
    /// or unrepresentably large values fail the request with a configuration error.
    pub margin: i64,
}

#[cfg_attr(not(target_arch = "wasm32"), async_trait::async_trait)]
#[cfg_attr(target_arch = "wasm32", async_trait::async_trait(?Send))]
impl Middleware for SessionRefresh {
    async fn handle(&self, req: Request, ext: &mut Extensions, next: Next<'_>) -> MwResult {
        // Do not automatically refresh a public `auth.refresh_token` request:
        // that would issue two requests and submit the caller's original token
        // after the stored token has already rotated. A custom `from_clients`
        // pipeline can also hang if `refresh_auth` carries `SessionRefresh` whose
        // guarded auth base differs from `refresh_auth`'s base, because it re-enters
        // refresh while the storage lock is held. Compare the complete,
        // normalized endpoint rather than its path suffix: this middleware also
        // runs for storage, GraphQL and Functions, whose valid request paths may
        // end in `/token` too.
        let is_refresh_endpoint = nhost_http::append_path(&self.auth.base_url, &["token"])
            .is_ok_and(|url| url.as_str() == req.url().as_str());
        if !req.headers().contains_key(AUTHORIZATION) && !is_refresh_endpoint {
            session::refresh_session(&self.auth, &self.storage, self.margin)
                .await
                .map_err(|error| {
                    reqwest_middleware::Error::Middleware(anyhow::Error::new(error))
                })?;
        }
        next.run(req, ext).await
    }
}

/// Sets `x-hasura-role` on every request at an explicit priority.
pub struct SetRole {
    /// The Hasura role to request.
    pub role: String,
    /// The precedence assigned to the role header.
    pub priority: HeaderPriority,
}

#[cfg_attr(not(target_arch = "wasm32"), async_trait::async_trait)]
#[cfg_attr(target_arch = "wasm32", async_trait::async_trait(?Send))]
impl Middleware for SetRole {
    async fn handle(&self, mut req: Request, ext: &mut Extensions, next: Next<'_>) -> MwResult {
        set_prioritized_header(&mut req, ext, "x-hasura-role", &self.role, self.priority)?;
        next.run(req, ext).await
    }
}

/// Sets arbitrary headers on every request at an explicit priority.
pub struct SetHeaders {
    /// Header names and values to apply.
    pub headers: HashMap<String, String>,
    /// The precedence assigned to every header in `headers`.
    pub priority: HeaderPriority,
}

#[cfg_attr(not(target_arch = "wasm32"), async_trait::async_trait)]
#[cfg_attr(target_arch = "wasm32", async_trait::async_trait(?Send))]
impl Middleware for SetHeaders {
    async fn handle(&self, mut req: Request, ext: &mut Extensions, next: Next<'_>) -> MwResult {
        for (name, value) in &self.headers {
            set_prioritized_header(&mut req, ext, name, value, self.priority)?;
        }
        next.run(req, ext).await
    }
}

/// Options for the admin-secret middleware.
///
/// # Sensitive data
///
/// [`Debug`](std::fmt::Debug) redacts `admin_secret`, but it leaves the role and
/// caller-controlled session-variable map visible. Those variables are sent as
/// `x-hasura-*` headers; do not log this value when they contain sensitive data.
#[derive(Clone, Default)]
pub struct AdminSessionOptions {
    /// The project's admin secret, sent as `x-hasura-admin-secret`.
    pub admin_secret: String,
    /// Role to impersonate, sent as `x-hasura-role`.
    pub role: Option<String>,
    /// Session variables, each sent as `x-hasura-<key>`. They are applied after
    /// `admin_secret` and `role` at the same priority, so `admin-secret` and
    /// `role` keys override those dedicated fields.
    pub session_variables: HashMap<String, String>,
    /// Permits sending the admin secret over cleartext HTTP to a non-loopback
    /// host. Defaults to `false`; enable only on a trusted development network.
    pub allow_insecure_http: bool,
}

impl std::fmt::Debug for AdminSessionOptions {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AdminSessionOptions")
            .field("admin_secret", &"<redacted>")
            .field("role", &self.role)
            .field("session_variables", &self.session_variables)
            .field("allow_insecure_http", &self.allow_insecure_http)
            .finish()
    }
}

/// Attaches `x-hasura-admin-secret` (plus optional role and session variables).
///
/// Security warning: never use in client-side code — it grants admin access.
pub struct AdminSession {
    /// The admin secret, role and session variables to send.
    pub options: AdminSessionOptions,
    /// The base URL of the service this middleware is installed on. Admin
    /// headers are written only for requests inside this origin, and only over
    /// HTTPS or to a loopback host unless
    /// [`AdminSessionOptions::allow_insecure_http`] is set.
    pub service_url: String,
}

#[cfg_attr(not(target_arch = "wasm32"), async_trait::async_trait)]
#[cfg_attr(target_arch = "wasm32", async_trait::async_trait(?Send))]
impl Middleware for AdminSession {
    async fn handle(&self, mut req: Request, ext: &mut Extensions, next: Next<'_>) -> MwResult {
        // Fail closed: an unparseable service URL, a different origin, or
        // cleartext to a non-loopback host all withhold every admin header.
        let permitted = RequestScope::from_base_url(&self.service_url).is_some_and(|scope| {
            scope.permits_admin_session(req.url(), self.options.allow_insecure_http)
        });
        if !permitted {
            return next.run(req, ext).await;
        }

        set_prioritized_header(
            &mut req,
            ext,
            "x-hasura-admin-secret",
            &self.options.admin_secret,
            HeaderPriority::Admin,
        )?;
        if let Some(role) = &self.options.role {
            set_prioritized_header(&mut req, ext, "x-hasura-role", role, HeaderPriority::Admin)?;
        }
        for (key, value) in &self.options.session_variables {
            set_prioritized_header(
                &mut req,
                ext,
                &format!("x-hasura-{key}"),
                value,
                HeaderPriority::Admin,
            )?;
        }
        next.run(req, ext).await
    }
}
