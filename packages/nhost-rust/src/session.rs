//! The enriched, client-side session managed by the SDK: JWT decoding, storage
//! backends, and token refresh.
//!
//! [`StoredSession`] is a superset of the raw auth [`crate::auth::Session`],
//! adding a [`DecodedToken`] with the parsed JWT payload so Hasura claims,
//! roles, and session variables are available without manually decoding it.

use crate::auth::{self, RefreshTokenRequest, Session};
use crate::error::Error;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

// The file-backed store is native-only; the browser uses localStorage instead.
#[cfg(not(all(feature = "wasm", target_arch = "wasm32")))]
use std::fs;
#[cfg(not(all(feature = "wasm", target_arch = "wasm32")))]
use std::path::PathBuf;

// SystemTime::now() panics on wasm32; web_time provides a browser-backed clock
// (and transparently re-exports std::time off the web).
#[cfg(not(feature = "wasm"))]
use std::time::{SystemTime, UNIX_EPOCH};
#[cfg(feature = "wasm")]
use web_time::{SystemTime, UNIX_EPOCH};

const HASURA_CLAIMS: &str = "https://hasura.io/jwt/claims";
const UNAUTHORIZED: u16 = 401;
/// Default number of seconds before expiry at which to refresh.
pub const DEFAULT_MARGIN_SECONDS: i64 = 60;

/// The decoded JWT access-token payload.
///
/// The persisted shape is interoperable with `@nhost/nhost-js`: `exp`/`iat` are
/// stored in milliseconds and the Hasura claims are keyed under the JWT claim
/// URL, so a session written by either SDK under the same storage key can be
/// read by the other.
#[derive(Clone, Default, Serialize, Deserialize)]
pub struct DecodedToken {
    /// Token expiration in **milliseconds** since the Unix epoch (the raw JWT
    /// value in seconds multiplied by 1000, matching `@nhost/nhost-js`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exp: Option<i64>,
    /// Token issued-at time in **milliseconds** since the Unix epoch.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub iat: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub iss: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sub: Option<String>,
    /// Hasura claims, with PostgreSQL array literals converted to arrays.
    /// Keyed under the JWT claim URL so it round-trips with `@nhost/nhost-js`.
    #[serde(
        rename = "https://hasura.io/jwt/claims",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub hasura_claims: Option<serde_json::Value>,
    /// Every claim as decoded (including unknown ones).
    #[serde(default, skip_serializing_if = "serde_json::Value::is_null")]
    pub raw: serde_json::Value,
}

impl std::fmt::Debug for DecodedToken {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("DecodedToken")
            .field("exp", &self.exp)
            .field("iat", &self.iat)
            .field("iss", &self.iss)
            .field("sub", &self.sub)
            .field("hasura_claims", &self.hasura_claims)
            .field("raw", &"<redacted>")
            .finish()
    }
}

/// The enriched session persisted by the SDK: the raw auth session plus the
/// decoded access token.
///
/// # Sensitive data
///
/// [`Debug`](std::fmt::Debug) redacts the access token, refresh token, and raw
/// JWT claims, but it leaves caller-controlled user metadata and processed
/// Hasura claims visible. [`Serialize`] intentionally emits the complete session,
/// including the refresh token, so persistence can round-trip; do not serialize
/// a session into logs.
#[derive(Clone, Serialize, Deserialize)]
pub struct StoredSession {
    #[serde(flatten)]
    pub session: Session,
    #[serde(rename = "decodedToken")]
    pub decoded_token: DecodedToken,
}

impl std::fmt::Debug for StoredSession {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("StoredSession")
            .field("session", &self.session)
            .field("decoded_token", &self.decoded_token)
            .finish()
    }
}

fn is_postgres_array(v: &str) -> bool {
    v.starts_with('{') && v.ends_with('}')
}

fn parse_postgres_array(v: &str) -> Vec<String> {
    if v == "{}" || v.is_empty() {
        return Vec::new();
    }
    v[1..v.len() - 1]
        .split(',')
        .map(|s| s.trim().trim_matches('"').to_string())
        .collect()
}

/// Decodes the payload of a JWT access token. Hasura claims encoded as
/// PostgreSQL array literals (e.g. `{user,me}`) are converted into arrays,
/// mirroring the JS SDK.
pub fn decode_user_session(access_token: &str) -> Result<DecodedToken, Error> {
    let invalid = || Error::InvalidToken("malformed access token".to_string());

    let segments: Vec<&str> = access_token.split('.').collect();
    if segments.len() != 3 || segments[1].is_empty() {
        return Err(invalid());
    }

    let raw = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(segments[1])
        .map_err(|_| invalid())?;
    let payload: serde_json::Value = serde_json::from_slice(&raw).map_err(|_| invalid())?;

    let mut decoded = DecodedToken {
        // Store in milliseconds to match @nhost/nhost-js's persisted decodedToken.
        exp: payload
            .get("exp")
            .and_then(serde_json::Value::as_i64)
            .map(|secs| secs * 1000),
        iat: payload
            .get("iat")
            .and_then(serde_json::Value::as_i64)
            .map(|secs| secs * 1000),
        iss: payload
            .get("iss")
            .and_then(|v| v.as_str().map(String::from)),
        sub: payload
            .get("sub")
            .and_then(|v| v.as_str().map(String::from)),
        hasura_claims: None,
        raw: payload.clone(),
    };

    if let Some(claims) = payload.get(HASURA_CLAIMS).and_then(|v| v.as_object()) {
        let mut processed = serde_json::Map::new();
        for (k, v) in claims {
            match v.as_str() {
                Some(s) if is_postgres_array(s) => {
                    processed.insert(k.clone(), serde_json::json!(parse_postgres_array(s)));
                }
                _ => {
                    processed.insert(k.clone(), v.clone());
                }
            }
        }
        decoded.hasura_claims = Some(serde_json::Value::Object(processed));
    }

    Ok(decoded)
}

fn to_stored_session(session: Session) -> Result<StoredSession, Error> {
    let decoded_token = decode_user_session(&session.access_token)?;
    Ok(StoredSession {
        session,
        decoded_token,
    })
}

/// A backend persisting a single [`StoredSession`].
#[cfg(not(all(feature = "wasm", target_arch = "wasm32")))]
pub trait Backend: Send + Sync {
    fn get(&self) -> Result<Option<StoredSession>, Error>;
    fn set(&self, value: &StoredSession) -> Result<(), Error>;
    fn remove(&self) -> Result<(), Error>;
}

/// A backend persisting a single [`StoredSession`]. On a wasm32 target with the
/// `wasm` feature, the Send + Sync bounds are dropped because browser storage
/// handles are !Send; [`SessionStorage`] re-asserts them for middleware bounds.
#[cfg(all(feature = "wasm", target_arch = "wasm32"))]
pub trait Backend {
    fn get(&self) -> Result<Option<StoredSession>, Error>;
    fn set(&self, value: &StoredSession) -> Result<(), Error>;
    fn remove(&self) -> Result<(), Error>;
}

/// In-memory session backend (the default). Because a single instance is
/// process-wide, do not share one between users in a server context.
#[derive(Default)]
pub struct MemoryStorage {
    session: Mutex<Option<StoredSession>>,
}

impl Backend for MemoryStorage {
    fn get(&self) -> Result<Option<StoredSession>, Error> {
        Ok(self.session.lock().unwrap().clone())
    }

    fn set(&self, value: &StoredSession) -> Result<(), Error> {
        *self.session.lock().unwrap() = Some(value.clone());
        Ok(())
    }

    fn remove(&self) -> Result<(), Error> {
        *self.session.lock().unwrap() = None;
        Ok(())
    }
}

/// JSON-file backed session backend, useful for CLIs and local scripts.
/// Native-only; unavailable only when the `wasm` feature is built for wasm32.
#[cfg(not(all(feature = "wasm", target_arch = "wasm32")))]
pub struct FileStorage {
    path: PathBuf,
}

#[cfg(not(all(feature = "wasm", target_arch = "wasm32")))]
impl FileStorage {
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self { path: path.into() }
    }
}

#[cfg(not(all(feature = "wasm", target_arch = "wasm32")))]
impl Backend for FileStorage {
    fn get(&self) -> Result<Option<StoredSession>, Error> {
        let data = match fs::read(&self.path) {
            Ok(d) => d,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(e) => return Err(Error::Storage(e.to_string())),
        };
        match serde_json::from_slice(&data) {
            Ok(s) => Ok(Some(s)),
            // A corrupt file is not fatal: drop it and report "no session".
            Err(_) => {
                let _ = self.remove();
                Ok(None)
            }
        }
    }

    fn set(&self, value: &StoredSession) -> Result<(), Error> {
        let data = serde_json::to_vec(value)?;
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|e| Error::Storage(e.to_string()))?;
        }
        fs::write(&self.path, data).map_err(|e| Error::Storage(e.to_string()))
    }

    fn remove(&self) -> Result<(), Error> {
        match fs::remove_file(&self.path) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(Error::Storage(e.to_string())),
        }
    }
}

/// Browser `localStorage`-backed session store (the default on the web). Uses
/// the same `"nhostSession"` key as `@nhost/nhost-js`, so a session persisted
/// by either SDK on the same origin is interoperable.
#[cfg(all(feature = "wasm", target_arch = "wasm32"))]
pub struct LocalStorage {
    storage: web_sys::Storage,
}

#[cfg(all(feature = "wasm", target_arch = "wasm32"))]
impl LocalStorage {
    const KEY: &'static str = "nhostSession";

    /// Returns a handle to `window.localStorage`, or `None` when it is
    /// unavailable (e.g. no `window`, or storage disabled).
    pub fn new() -> Option<Self> {
        let storage = web_sys::window()?.local_storage().ok()??;
        Some(Self { storage })
    }
}

#[cfg(all(feature = "wasm", target_arch = "wasm32"))]
impl Backend for LocalStorage {
    fn get(&self) -> Result<Option<StoredSession>, Error> {
        let raw = match self.storage.get_item(Self::KEY) {
            Ok(Some(r)) => r,
            Ok(None) => return Ok(None),
            Err(_) => return Err(Error::Storage("localStorage read failed".to_string())),
        };
        match serde_json::from_str(&raw) {
            Ok(s) => Ok(Some(s)),
            Err(_) => {
                let _ = self.remove();
                Ok(None)
            }
        }
    }

    fn set(&self, value: &StoredSession) -> Result<(), Error> {
        let data = serde_json::to_string(value)?;
        self.storage
            .set_item(Self::KEY, &data)
            .map_err(|_| Error::Storage("localStorage write failed".to_string()))
    }

    fn remove(&self) -> Result<(), Error> {
        self.storage
            .remove_item(Self::KEY)
            .map_err(|_| Error::Storage("localStorage remove failed".to_string()))
    }
}

/// Returns the default backend for the current environment: `localStorage` in
/// the browser (when available), otherwise an in-memory store.
pub fn detect_storage() -> Box<dyn Backend> {
    #[cfg(all(feature = "wasm", target_arch = "wasm32"))]
    {
        if let Some(ls) = LocalStorage::new() {
            return Box::new(ls);
        }
    }
    Box::<MemoryStorage>::default()
}

// Callbacks are stored behind an Arc so `notify` can snapshot the current set
// under the lock, release it, and invoke them without holding the mutex (which
// would deadlock if a callback re-enters set/remove/subscribe/unsubscribe).
#[cfg(not(all(feature = "wasm", target_arch = "wasm32")))]
type ChangeCallback = Arc<dyn Fn(Option<&StoredSession>) + Send + Sync>;
#[cfg(all(feature = "wasm", target_arch = "wasm32"))]
type ChangeCallback = Arc<dyn Fn(Option<&StoredSession>)>;

struct StorageInner {
    backend: Box<dyn Backend>,
    subscribers: Mutex<HashMap<usize, ChangeCallback>>,
    next_id: Mutex<usize>,
    refresh_lock: tokio::sync::Mutex<()>,
}

/// Wraps a [`Backend`], decoding tokens on set and notifying subscribers on
/// every change. Cheaply cloneable (shares one backend).
#[derive(Clone)]
pub struct SessionStorage {
    inner: Arc<StorageInner>,
}

// wasm32 is single-threaded, and the localStorage backend (`web_sys::Storage`)
// is the only !Send state the SDK holds. Asserting Send + Sync here lets
// SessionStorage (and the clients that own it) satisfy reqwest-middleware's
// `Middleware: Send + Sync` bound. The target gate is essential to soundness:
// native builds that enable the additive `wasm` feature must not get these
// unsafe impls.
#[cfg(all(feature = "wasm", target_arch = "wasm32"))]
unsafe impl Send for SessionStorage {}
#[cfg(all(feature = "wasm", target_arch = "wasm32"))]
unsafe impl Sync for SessionStorage {}

impl SessionStorage {
    pub fn new(backend: Box<dyn Backend>) -> Self {
        Self {
            inner: Arc::new(StorageInner {
                backend,
                subscribers: Mutex::new(HashMap::new()),
                next_id: Mutex::new(0),
                refresh_lock: tokio::sync::Mutex::new(()),
            }),
        }
    }

    pub fn get(&self) -> Result<Option<StoredSession>, Error> {
        self.inner.backend.get()
    }

    /// Stores a raw auth session, enriching it into a stored session, and
    /// notifies subscribers.
    pub fn set(&self, value: Session) -> Result<(), Error> {
        let stored = to_stored_session(value)?;
        self.inner.backend.set(&stored)?;
        self.notify(Some(&stored));
        Ok(())
    }

    pub fn remove(&self) -> Result<(), Error> {
        self.inner.backend.remove()?;
        self.notify(None);
        Ok(())
    }

    /// Subscribes to session changes; the returned guard unsubscribes on drop.
    #[cfg(not(all(feature = "wasm", target_arch = "wasm32")))]
    pub fn on_change<F>(&self, callback: F) -> Subscription
    where
        F: Fn(Option<&StoredSession>) + Send + Sync + 'static,
    {
        self.subscribe(Arc::new(callback))
    }

    /// Subscribes to session changes; the returned guard unsubscribes on drop.
    #[cfg(all(feature = "wasm", target_arch = "wasm32"))]
    pub fn on_change<F>(&self, callback: F) -> Subscription
    where
        F: Fn(Option<&StoredSession>) + 'static,
    {
        self.subscribe(Arc::new(callback))
    }

    fn subscribe(&self, callback: ChangeCallback) -> Subscription {
        let mut id = self.inner.next_id.lock().unwrap();
        let this_id = *id;
        *id += 1;
        self.inner
            .subscribers
            .lock()
            .unwrap()
            .insert(this_id, callback);
        Subscription {
            inner: Arc::downgrade(&self.inner),
            id: this_id,
        }
    }

    fn notify(&self, session: Option<&StoredSession>) {
        // Snapshot the callbacks and drop the lock before invoking them. Running
        // callbacks outside the lock avoids a reentrancy deadlock when a
        // callback touches the storage (set/remove/subscribe or drops its
        // Subscription), and recovering from a poisoned lock plus isolating each
        // callback keeps one panicking subscriber from bricking the rest.
        let callbacks: Vec<ChangeCallback> = self
            .inner
            .subscribers
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .values()
            .cloned()
            .collect();

        for cb in callbacks {
            let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| cb(session)));
        }
    }
}

/// A session-change subscription; unsubscribes when dropped.
pub struct Subscription {
    inner: std::sync::Weak<StorageInner>,
    id: usize,
}

impl Drop for Subscription {
    fn drop(&mut self) {
        if let Some(inner) = self.inner.upgrade() {
            inner.subscribers.lock().unwrap().remove(&self.id);
        }
    }
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Returns (session, needs_refresh, session_expired).
fn needs_refresh(
    storage: &SessionStorage,
    margin: i64,
) -> Result<(Option<StoredSession>, bool, bool), Error> {
    let Some(session) = storage.get()? else {
        return Ok((None, false, false));
    };

    let Some(exp) = session.decoded_token.exp else {
        return Ok((Some(session), true, true));
    };

    // Force refresh if margin is 0, matching @nhost/nhost-js. The session is
    // deliberately classified as not expired for refresh-failure policy.
    if margin == 0 {
        return Ok((Some(session), true, false));
    }

    // exp is milliseconds; margin is seconds (matching @nhost/nhost-js).
    let now = now_ms();
    if exp - now > margin * 1000 {
        Ok((Some(session), false, false))
    } else {
        Ok((Some(session), true, exp < now))
    }
}

enum RefreshFailure {
    /// No request should follow this error: it occurred outside the request or
    /// after a 2xx refresh response was observed.
    DoNotRetry(Error),
    /// No 2xx response was observed, so the refresh request may be retried.
    RequestFailed(Error),
}

async fn refresh_once(
    auth: &auth::Client,
    storage: &SessionStorage,
    margin: i64,
) -> Result<Option<StoredSession>, RefreshFailure> {
    let (session, needs, _) = needs_refresh(storage, margin).map_err(RefreshFailure::DoNotRetry)?;
    let Some(session) = session else {
        return Ok(None);
    };
    if !needs {
        return Ok(Some(session));
    }

    let _guard = storage.inner.refresh_lock.lock().await;

    let (session, needs, expired) =
        needs_refresh(storage, margin).map_err(RefreshFailure::DoNotRetry)?;
    let Some(session) = session else {
        return Ok(None);
    };
    if !needs {
        return Ok(Some(session));
    }

    let request = auth
        .refresh_token_request(&RefreshTokenRequest {
            refresh_token: session.session.refresh_token.clone(),
        })
        .map_err(RefreshFailure::DoNotRetry)?;

    match crate::http::send_phased(request, None).await {
        crate::http::SendOutcome::Accepted { bytes, .. }
        | crate::http::SendOutcome::NotModified { bytes, .. } => {
            // A 2xx status is the acceptance boundary. Body reads, decoding,
            // and storage all remain on the non-retryable side of it. The 304
            // compatibility path is also non-retryable because retrying its
            // decode failure is not useful.
            let bytes = bytes.map_err(RefreshFailure::DoNotRetry)?;
            let refreshed = serde_json::from_slice(&bytes)
                .map_err(Error::from)
                .map_err(RefreshFailure::DoNotRetry)?;
            storage
                .set(refreshed)
                .and_then(|()| storage.get())
                .map_err(RefreshFailure::DoNotRetry)
        }
        crate::http::SendOutcome::NotAccepted(error) if expired => {
            Err(RefreshFailure::RequestFailed(error))
        }
        crate::http::SendOutcome::NotAccepted(_) => Ok(Some(session)),
    }
}

/// Refreshes the session if it is close to expiry.
///
/// With a nonzero margin, an expired session's refresh request is retried once
/// only when no 2xx response was observed. If both requests fail, this returns
/// `Ok(None)` but retains the existing session unless the second failure has
/// status `401`, which triggers a store-clear attempt. `Ok(None)` also means
/// there was no session to refresh; it does not by itself mean the store is
/// empty, so call [`SessionStorage::get`] (or [`crate::Nhost::session`]) to
/// distinguish those cases. From [`crate::middleware::SessionRefresh`], a
/// retained session lets the request continue and
/// [`crate::middleware::AttachToken`] can attach its existing, possibly expired
/// access token.
///
/// A margin of `0` forces a refresh attempt but deliberately classifies the
/// session as not expired, even when its access token is past `exp`. A transport
/// failure or rejected response is therefore soft: this returns the existing
/// session after one attempt, does not retry, and does not clear the store on
/// `401`. From [`crate::middleware::SessionRefresh`], the request then continues
/// with the existing, possibly expired bearer token.
///
/// Once a 2xx response is observed, body-read, decode, and storage failures are
/// returned without retrying, regardless of their error variant. An undecodable
/// 2xx therefore reaches the caller as [`Error::Json`] rather than `Ok(None)`.
/// Storage failures before a request are also returned without retrying. This
/// prevents an observed-successful rotation from re-submitting its consumed
/// token. A response lost after the server commits is indistinguishable from a
/// pre-acceptance transport failure, and a proxy 5xx cannot reveal whether the
/// origin committed; both remain retryable and require a server-side rotation
/// grace window to close safely.
pub async fn refresh_session(
    auth: &auth::Client,
    storage: &SessionStorage,
    margin: i64,
) -> Result<Option<StoredSession>, Error> {
    match refresh_once(auth, storage, margin).await {
        Ok(session) => Ok(session),
        Err(RefreshFailure::DoNotRetry(error)) => Err(error),
        Err(RefreshFailure::RequestFailed(_)) => match refresh_once(auth, storage, margin).await {
            Ok(session) => Ok(session),
            Err(RefreshFailure::DoNotRetry(error)) => Err(error),
            Err(RefreshFailure::RequestFailed(error)) => {
                if error.status() == Some(UNAUTHORIZED) {
                    let _ = storage.remove();
                }
                Ok(None)
            }
        },
    }
}
