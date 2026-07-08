//! Fetch chain functions implementing session refresh, access-token
//! attachment, session capture, and role/header/admin injection. Mirrors
//! `@nhost/nhost-js`'s fetch middleware set.

use crate::auth;
use crate::fetch::{ChainFunction, Error, FetchFn, Response};
use crate::session::{self, SessionStorage};
use async_trait::async_trait;
use reqwest::header::{HeaderName, HeaderValue, AUTHORIZATION};
use std::collections::HashMap;
use std::sync::Arc;

/// Default seconds before expiry at which the refresh middleware refreshes.
pub const DEFAULT_MARGIN_SECONDS: i64 = session::DEFAULT_MARGIN_SECONDS;

fn set_header(req: &mut reqwest::Request, name: &str, value: &str) {
    if let (Ok(n), Ok(v)) = (
        HeaderName::from_bytes(name.as_bytes()),
        HeaderValue::from_str(value),
    ) {
        req.headers_mut().insert(n, v);
    }
}

// --- attach access token ---

struct AttachAccessToken {
    next: Arc<dyn FetchFn>,
    storage: SessionStorage,
}

#[cfg_attr(not(feature = "wasm"), async_trait)]
#[cfg_attr(feature = "wasm", async_trait(?Send))]
impl FetchFn for AttachAccessToken {
    async fn call(&self, mut req: reqwest::Request) -> Result<Response, Error> {
        if !req.headers().contains_key(AUTHORIZATION) {
            if let Some(s) = self.storage.get() {
                if !s.session.access_token.is_empty() {
                    set_header(
                        &mut req,
                        "authorization",
                        &format!("Bearer {}", s.session.access_token),
                    );
                }
            }
        }
        self.next.call(req).await
    }
}

/// Attaches `Authorization: Bearer <token>` from the stored session, unless the
/// request already carries one. Should run after the refresh middleware.
pub fn attach_access_token(storage: SessionStorage) -> ChainFunction {
    Arc::new(move |next| {
        Arc::new(AttachAccessToken {
            next,
            storage: storage.clone(),
        })
    })
}

// --- session refresh ---

struct SessionRefresh {
    next: Arc<dyn FetchFn>,
    auth: Arc<auth::Client>,
    storage: SessionStorage,
    margin: i64,
}

#[cfg_attr(not(feature = "wasm"), async_trait)]
#[cfg_attr(feature = "wasm", async_trait(?Send))]
impl FetchFn for SessionRefresh {
    async fn call(&self, req: reqwest::Request) -> Result<Response, Error> {
        let is_token = req.url().path().ends_with("/v1/token");
        if !req.headers().contains_key(AUTHORIZATION) && !is_token {
            let _ = session::refresh_session(&self.auth, &self.storage, self.margin).await;
        }
        self.next.call(req).await
    }
}

/// Refreshes the session before a request when the token is near expiry. Skips
/// requests that already carry an Authorization header and the token endpoint.
pub fn session_refresh(
    auth: Arc<auth::Client>,
    storage: SessionStorage,
    margin: i64,
) -> ChainFunction {
    Arc::new(move |next| {
        Arc::new(SessionRefresh {
            next,
            auth: auth.clone(),
            storage: storage.clone(),
            margin,
        })
    })
}

// --- update session from response ---

fn extract_session(body: &bytes::Bytes) -> Option<auth::Session> {
    let raw: serde_json::Value = serde_json::from_slice(body).ok()?;
    let obj = raw.as_object()?;

    if let Some(sess) = obj.get("session") {
        if sess.is_null() {
            return None;
        }
        return serde_json::from_value(sess.clone()).ok();
    }

    if obj.contains_key("accessToken")
        && obj.contains_key("refreshToken")
        && obj.contains_key("user")
    {
        return serde_json::from_value(raw).ok();
    }

    None
}

struct UpdateSession {
    next: Arc<dyn FetchFn>,
    storage: SessionStorage,
}

#[cfg_attr(not(feature = "wasm"), async_trait)]
#[cfg_attr(feature = "wasm", async_trait(?Send))]
impl FetchFn for UpdateSession {
    async fn call(&self, req: reqwest::Request) -> Result<Response, Error> {
        let path = req.url().path().to_string();
        let resp = self.next.call(req).await?;

        if path.ends_with("/signout") {
            self.storage.remove();
            return Ok(resp);
        }

        if path.ends_with("/user/password") && resp.status < 300 {
            self.storage.remove();
            return Ok(resp);
        }

        if path.ends_with("/token")
            || path.contains("/token/exchange")
            || path.contains("/signin/")
            || path.contains("/signup/")
        {
            if let Some(sess) = extract_session(&resp.body) {
                if !sess.access_token.is_empty() && !sess.refresh_token.is_empty() {
                    let _ = self.storage.set(sess);
                }
            }
        }

        Ok(resp)
    }
}

/// Persists session data returned by auth endpoints and clears it on sign-out.
pub fn update_session_from_response(storage: SessionStorage) -> ChainFunction {
    Arc::new(move |next| {
        Arc::new(UpdateSession {
            next,
            storage: storage.clone(),
        })
    })
}

// --- with role / headers / admin ---

struct WithRole {
    next: Arc<dyn FetchFn>,
    role: String,
}

#[cfg_attr(not(feature = "wasm"), async_trait)]
#[cfg_attr(feature = "wasm", async_trait(?Send))]
impl FetchFn for WithRole {
    async fn call(&self, mut req: reqwest::Request) -> Result<Response, Error> {
        if !req.headers().contains_key("x-hasura-role") {
            set_header(&mut req, "x-hasura-role", &self.role);
        }
        self.next.call(req).await
    }
}

/// Sets `x-hasura-role` on requests that don't already specify it.
pub fn with_role(role: String) -> ChainFunction {
    Arc::new(move |next| {
        Arc::new(WithRole {
            next,
            role: role.clone(),
        })
    })
}

struct WithHeaders {
    next: Arc<dyn FetchFn>,
    headers: HashMap<String, String>,
}

#[cfg_attr(not(feature = "wasm"), async_trait)]
#[cfg_attr(feature = "wasm", async_trait(?Send))]
impl FetchFn for WithHeaders {
    async fn call(&self, mut req: reqwest::Request) -> Result<Response, Error> {
        for (k, v) in &self.headers {
            if !req.headers().contains_key(k.as_str()) {
                set_header(&mut req, k, v);
            }
        }
        self.next.call(req).await
    }
}

/// Attaches default headers, preserving any request-specific values.
pub fn with_headers(headers: HashMap<String, String>) -> ChainFunction {
    Arc::new(move |next| {
        Arc::new(WithHeaders {
            next,
            headers: headers.clone(),
        })
    })
}

/// Admin session configuration.
///
/// Security warning: never use in untrusted/client code — the admin secret
/// grants unrestricted database access.
#[derive(Debug, Clone, Default)]
pub struct AdminSessionOptions {
    pub admin_secret: String,
    pub role: Option<String>,
    pub session_variables: HashMap<String, String>,
}

struct WithAdminSession {
    next: Arc<dyn FetchFn>,
    options: AdminSessionOptions,
}

#[cfg_attr(not(feature = "wasm"), async_trait)]
#[cfg_attr(feature = "wasm", async_trait(?Send))]
impl FetchFn for WithAdminSession {
    async fn call(&self, mut req: reqwest::Request) -> Result<Response, Error> {
        if !req.headers().contains_key("x-hasura-admin-secret") {
            set_header(
                &mut req,
                "x-hasura-admin-secret",
                &self.options.admin_secret,
            );
        }

        if let Some(role) = &self.options.role {
            if !req.headers().contains_key("x-hasura-role") {
                set_header(&mut req, "x-hasura-role", role);
            }
        }

        for (k, v) in &self.options.session_variables {
            let header = if k.starts_with("x-hasura-") {
                k.clone()
            } else {
                format!("x-hasura-{k}")
            };
            if !req.headers().contains_key(header.as_str()) {
                set_header(&mut req, &header, v);
            }
        }

        self.next.call(req).await
    }
}

/// Attaches `x-hasura-admin-secret` and optional role/session variables.
pub fn with_admin_session(options: AdminSessionOptions) -> ChainFunction {
    Arc::new(move |next| {
        Arc::new(WithAdminSession {
            next,
            options: options.clone(),
        })
    })
}
