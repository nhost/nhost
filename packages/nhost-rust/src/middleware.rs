//! Request-side middleware implementing [`reqwest_middleware::Middleware`].
//!
//! All middleware here only mutates the outgoing request (headers) or triggers
//! a refresh before sending; none reads the response body. Response-side
//! session capture lives in the auth client ([`crate::http::send`]) because a
//! browser `reqwest::Response` cannot be rebuilt from buffered bytes.

use crate::auth;
use crate::http::Middleware;
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

fn set_header(req: &mut Request, name: &str, value: &str) {
    if let (Ok(n), Ok(v)) = (
        HeaderName::from_bytes(name.as_bytes()),
        HeaderValue::from_str(value),
    ) {
        req.headers_mut().insert(n, v);
    }
}

/// Attaches `Authorization: Bearer <token>` from the stored session, unless the
/// request already carries one. Runs after [`SessionRefresh`].
pub struct AttachToken {
    pub storage: SessionStorage,
}

#[cfg_attr(not(target_arch = "wasm32"), async_trait::async_trait)]
#[cfg_attr(target_arch = "wasm32", async_trait::async_trait(?Send))]
impl Middleware for AttachToken {
    async fn handle(&self, mut req: Request, ext: &mut Extensions, next: Next<'_>) -> MwResult {
        if !req.headers().contains_key(AUTHORIZATION) {
            if let Ok(Some(s)) = self.storage.get() {
                if !s.session.access_token.is_empty() {
                    set_header(
                        &mut req,
                        "authorization",
                        &format!("Bearer {}", s.session.access_token),
                    );
                }
            }
        }
        next.run(req, ext).await
    }
}

/// Refreshes the session before a request when the token is near expiry. Skips
/// requests that already carry an Authorization header and the token endpoint.
pub struct SessionRefresh {
    pub auth: Arc<auth::Client>,
    pub storage: SessionStorage,
    pub margin: i64,
}

#[cfg_attr(not(target_arch = "wasm32"), async_trait::async_trait)]
#[cfg_attr(target_arch = "wasm32", async_trait::async_trait(?Send))]
impl Middleware for SessionRefresh {
    async fn handle(&self, req: Request, ext: &mut Extensions, next: Next<'_>) -> MwResult {
        let is_token = req.url().path().ends_with("/v1/token");
        if !req.headers().contains_key(AUTHORIZATION) && !is_token {
            let _ = session::refresh_session(&self.auth, &self.storage, self.margin).await;
        }
        next.run(req, ext).await
    }
}

/// Sets `x-hasura-role` on every request.
pub struct SetRole {
    pub role: String,
}

#[cfg_attr(not(target_arch = "wasm32"), async_trait::async_trait)]
#[cfg_attr(target_arch = "wasm32", async_trait::async_trait(?Send))]
impl Middleware for SetRole {
    async fn handle(&self, mut req: Request, ext: &mut Extensions, next: Next<'_>) -> MwResult {
        set_header(&mut req, "x-hasura-role", &self.role);
        next.run(req, ext).await
    }
}

/// Sets arbitrary headers on every request.
pub struct SetHeaders {
    pub headers: HashMap<String, String>,
}

#[cfg_attr(not(target_arch = "wasm32"), async_trait::async_trait)]
#[cfg_attr(target_arch = "wasm32", async_trait::async_trait(?Send))]
impl Middleware for SetHeaders {
    async fn handle(&self, mut req: Request, ext: &mut Extensions, next: Next<'_>) -> MwResult {
        for (k, v) in &self.headers {
            set_header(&mut req, k, v);
        }
        next.run(req, ext).await
    }
}

/// Options for the admin-secret middleware.
#[derive(Debug, Clone, Default)]
pub struct AdminSessionOptions {
    pub admin_secret: String,
    pub role: Option<String>,
    pub session_variables: HashMap<String, String>,
}

/// Attaches `x-hasura-admin-secret` (plus optional role and session variables).
///
/// Security warning: never use in client-side code — it grants admin access.
pub struct AdminSession {
    pub options: AdminSessionOptions,
}

#[cfg_attr(not(target_arch = "wasm32"), async_trait::async_trait)]
#[cfg_attr(target_arch = "wasm32", async_trait::async_trait(?Send))]
impl Middleware for AdminSession {
    async fn handle(&self, mut req: Request, ext: &mut Extensions, next: Next<'_>) -> MwResult {
        set_header(
            &mut req,
            "x-hasura-admin-secret",
            &self.options.admin_secret,
        );
        if let Some(role) = &self.options.role {
            set_header(&mut req, "x-hasura-role", role);
        }
        for (k, v) in &self.options.session_variables {
            set_header(&mut req, &format!("x-hasura-{k}"), v);
        }
        next.run(req, ext).await
    }
}
