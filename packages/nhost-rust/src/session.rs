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
use std::sync::{Arc, Mutex};

// The file-backed store is native-only; the browser uses localStorage instead.
#[cfg(not(target_arch = "wasm32"))]
use std::fs;
#[cfg(not(target_arch = "wasm32"))]
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
    /// The `iss` claim, when the token carries one. Decoded and exposed for
    /// callers but never checked by this SDK, so an application that needs to
    /// pin the issuer must compare it itself.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub iss: Option<String>,
    /// Subject identifier from the `sub` claim, normally the authenticated user's ID.
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
    /// The raw auth response, flattened into the persisted object for JS SDK
    /// interoperability.
    #[serde(flatten)]
    pub session: Session,
    /// A persisted cache of the access-token claims. [`SessionStorage::get`]
    /// re-decodes the token instead of trusting this value after deserialization.
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
    let milliseconds = |claim: &str| {
        payload
            .get(claim)
            .and_then(serde_json::Value::as_i64)
            .map(|seconds| {
                seconds.checked_mul(1000).ok_or_else(|| {
                    Error::InvalidToken(format!(
                        "{claim} claim is outside the supported millisecond range"
                    ))
                })
            })
            .transpose()
    };

    let mut decoded = DecodedToken {
        // Store in milliseconds to match @nhost/nhost-js's persisted decodedToken.
        exp: milliseconds("exp")?,
        iat: milliseconds("iat")?,
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

fn session_lifetime_ms(session: &Session) -> Result<i64, Error> {
    session
        .access_token_expires_in
        .checked_mul(1000)
        .filter(|lifetime| *lifetime > 0)
        .ok_or_else(|| {
            Error::InvalidToken(
                "accessTokenExpiresIn must be a positive representable duration".to_string(),
            )
        })
}

fn validate_session_expiry(session: &Session, decoded: &DecodedToken) -> Result<(), Error> {
    match decoded.exp {
        Some(exp) if exp > 0 => {}
        Some(_) => {
            return Err(Error::InvalidToken(
                "exp claim must be after the Unix epoch".to_string(),
            ));
        }
        None => {
            return Err(Error::InvalidToken(
                "access token must contain an integer exp claim".to_string(),
            ));
        }
    }

    session_lifetime_ms(session)?;
    Ok(())
}

fn advertised_deadline(session: &StoredSession, now: i64) -> Result<i64, Error> {
    now.checked_add(session_lifetime_ms(&session.session)?)
        .ok_or_else(|| {
            Error::InvalidToken(
                "accessTokenExpiresIn is too large to schedule from the current time".to_string(),
            )
        })
}

fn received_refresh_deadline(
    session: &StoredSession,
    now: i64,
    after_refresh: bool,
) -> Result<i64, Error> {
    let advertised_deadline = advertised_deadline(session, now)?;
    let exp = session.decoded_token.exp.ok_or_else(|| {
        Error::InvalidToken("access token must contain an integer exp claim".to_string())
    })?;

    let Some(iat) = session.decoded_token.iat else {
        // Without iat the client cannot distinguish an expired token from a fast
        // local clock. Probe an apparently expired token once, then anchor an
        // accepted refresh response to receipt so clock skew cannot hot-loop.
        return Ok(if after_refresh {
            advertised_deadline
        } else {
            exp.min(advertised_deadline)
        });
    };

    let issuer_lifetime = exp
        .checked_sub(iat)
        .filter(|lifetime| *lifetime > 0)
        .ok_or_else(|| {
            Error::InvalidToken(
                "exp claim must be later than iat with a representable duration".to_string(),
            )
        })?;
    let issuer_deadline = now.checked_add(issuer_lifetime).ok_or_else(|| {
        Error::InvalidToken("issuer token lifetime is too large to schedule".to_string())
    })?;
    Ok(issuer_deadline.min(advertised_deadline))
}

fn persisted_refresh_deadline(session: &StoredSession, now: i64) -> Result<i64, Error> {
    let exp = session.decoded_token.exp.ok_or_else(|| {
        Error::InvalidToken("access token must contain an integer exp claim".to_string())
    })?;
    Ok(exp.min(advertised_deadline(session, now)?))
}

fn to_stored_session(session: Session) -> Result<StoredSession, Error> {
    let decoded_token = decode_user_session(&session.access_token)?;
    validate_session_expiry(&session, &decoded_token)?;
    Ok(StoredSession {
        session,
        decoded_token,
    })
}

fn canonicalize_stored_session(mut stored: StoredSession) -> Result<StoredSession, Error> {
    stored.decoded_token = decode_user_session(&stored.session.access_token)?;
    validate_session_expiry(&stored.session, &stored.decoded_token)?;
    Ok(stored)
}

/// A backend persisting a single [`StoredSession`].
#[cfg(not(all(feature = "wasm", target_arch = "wasm32")))]
pub trait Backend: Send + Sync {
    /// Loads the current session, returning `None` when no session is persisted.
    fn get(&self) -> Result<Option<StoredSession>, Error>;
    /// Replaces the persisted session with `value`.
    fn set(&self, value: &StoredSession) -> Result<(), Error>;
    /// Deletes the persisted session; built-in backends treat absence as success.
    fn remove(&self) -> Result<(), Error>;
}

/// A backend persisting a single [`StoredSession`]. On a wasm32 target with the
/// `wasm` feature, the Send + Sync bounds are dropped because browser storage
/// handles are !Send; [`SessionStorage`] re-asserts them for middleware bounds.
#[cfg(all(feature = "wasm", target_arch = "wasm32"))]
pub trait Backend {
    /// Loads the current session, returning `None` when no session is persisted.
    fn get(&self) -> Result<Option<StoredSession>, Error>;
    /// Replaces the persisted session with `value`.
    fn set(&self, value: &StoredSession) -> Result<(), Error>;
    /// Deletes the persisted session; built-in backends treat absence as success.
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
///
/// Not available on wasm32, which has no filesystem: the browser persists
/// sessions through [`LocalStorage`] instead. This is deliberately keyed on the
/// target rather than on the `wasm` feature, so the type is absent wherever a
/// file cannot actually be written.
///
/// # Sensitive data
///
/// The persisted [`StoredSession`] includes the long-lived refresh token, which
/// can mint access tokens until it is revoked server-side. On Unix the file is
/// created `0o600`, so it is readable only by the owning user; because each
/// write renames a freshly created file into place, a file left at a wider mode
/// by an earlier version is replaced rather than reused. A parent directory
/// *created* here is `0o700`; a directory that already exists is left as it is,
/// so point this at a private path rather than relying on it to tighten one.
/// Other platforms inherit the default permissions, so avoid this backend on
/// shared storage there.
///
/// # Durability
///
/// Writes are atomic: the session is written to a temporary file in the same
/// directory, flushed, and renamed over the destination, so a concurrent reader
/// or an interrupted write never observes a partial file. A file that cannot be
/// parsed is reported as [`Error::Storage`] and left in place — it may still
/// hold a usable refresh token, so it is never deleted to manufacture a clean
/// "no session" result.
#[cfg(not(target_arch = "wasm32"))]
pub struct FileStorage {
    path: PathBuf,
}

#[cfg(not(target_arch = "wasm32"))]
impl FileStorage {
    /// Creates a backend for `path`; parent directories are created on the first
    /// write attempt rather than during construction, so they persist even if
    /// that write then fails.
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self { path: path.into() }
    }

    /// Names the scratch file [`Backend::set`] renames into place. The process
    /// id separates concurrent processes and the counter separates concurrent
    /// writers within one, so two writers never contend for the same path.
    fn temporary_name(&self) -> String {
        static COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

        let file_name = self
            .path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("session");

        format!(
            ".{file_name}.{}.{}.tmp",
            std::process::id(),
            COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
        )
    }
}

/// Removes a partially written scratch file unless it was renamed into place.
///
/// Every failure between creating the temporary file and renaming it returns
/// early, so the cleanup is a drop guard rather than a step that each of those
/// paths has to remember.
#[cfg(not(target_arch = "wasm32"))]
struct TemporaryFile {
    path: PathBuf,
    renamed: bool,
}

#[cfg(not(target_arch = "wasm32"))]
impl TemporaryFile {
    fn new(path: PathBuf) -> Self {
        Self {
            path,
            renamed: false,
        }
    }

    fn path(&self) -> &std::path::Path {
        &self.path
    }

    /// Gives up ownership after a successful rename, so the guard does not
    /// delete the file now living at the destination.
    fn into_renamed(mut self) {
        self.renamed = true;
    }
}

#[cfg(not(target_arch = "wasm32"))]
impl Drop for TemporaryFile {
    fn drop(&mut self) {
        if !self.renamed {
            let _ = fs::remove_file(&self.path);
        }
    }
}

#[cfg(not(target_arch = "wasm32"))]
impl Backend for FileStorage {
    fn get(&self) -> Result<Option<StoredSession>, Error> {
        let data = match fs::read(&self.path) {
            Ok(d) => d,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(e) => return Err(Error::Storage(e.to_string())),
        };

        // A file that will not parse is reported, never deleted. Discarding it
        // would destroy the refresh token it may still contain, and reporting
        // `Ok(None)` would present that loss to the caller as a signed out
        // user, so a transient problem becomes permanent silently.
        serde_json::from_slice(&data)
            .map(Some)
            .map_err(|e| Error::Storage(format!("{}: {e}", self.path.display())))
    }

    fn set(&self, value: &StoredSession) -> Result<(), Error> {
        use std::io::Write;

        let data = serde_json::to_vec(value)?;

        let parent = self.path.parent().unwrap_or(std::path::Path::new("."));

        if self.path.parent().is_some() {
            let mut builder = fs::DirBuilder::new();
            builder.recursive(true);
            #[cfg(unix)]
            {
                use std::os::unix::fs::DirBuilderExt;
                builder.mode(0o700);
            }
            builder
                .create(parent)
                .map_err(|e| Error::Storage(e.to_string()))?;
        }

        // Write to a temporary file in the same directory and rename it over the
        // destination. Writing in place would truncate the stored session first,
        // so an interrupted write would leave a half-written file that no longer
        // parses; rename within a directory is atomic, so a reader sees either
        // the previous session or the new one.
        let temporary = TemporaryFile::new(parent.join(self.temporary_name()));

        // The mode is applied at open time rather than by a later chmod, so the
        // refresh token is never briefly readable by other users. `create_new`
        // refuses to reuse a path, so a stale temporary file from a crashed run
        // is never written through.
        let mut options = fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }

        let mut file = options
            .open(temporary.path())
            .map_err(|e| Error::Storage(e.to_string()))?;

        file.write_all(&data)
            .map_err(|e| Error::Storage(e.to_string()))?;

        // Flush to disk before the rename. Without this the rename can be
        // durable while the contents are not, which is the truncated-file case
        // this rewrite exists to prevent.
        file.sync_all().map_err(|e| Error::Storage(e.to_string()))?;
        drop(file);

        // Renaming moves the temporary file's inode, so the destination takes
        // its 0o600 mode; a file previously left at a wider mode is replaced
        // rather than reused, and needs no separate chmod.
        fs::rename(temporary.path(), &self.path).map_err(|e| Error::Storage(e.to_string()))?;
        temporary.into_renamed();

        Ok(())
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
///
/// # Sensitive data
///
/// The persisted [`StoredSession`] includes the long-lived refresh token.
/// `localStorage` is readable by any script on the origin, so an XSS can expose
/// a durable credential. Applications with a stricter threat model should pass
/// an explicit backend through [`crate::NhostBuilder::storage`].
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
        // Reported, never deleted: the stored value may hold a usable refresh
        // token, and `Ok(None)` would present the loss as a signed out user.
        // A value written by another SDK version is a case to surface, not to
        // silently discard.
        serde_json::from_str(&raw)
            .map(Some)
            .map_err(|e| Error::Storage(format!("{}: {e}", Self::KEY)))
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
/// the browser (when available), otherwise an in-memory store. See
/// `LocalStorage`'s sensitive-data warning; callers can select an explicit
/// backend with [`crate::NhostBuilder::storage`].
pub fn detect_storage() -> Box<dyn Backend> {
    #[cfg(all(feature = "wasm", target_arch = "wasm32"))]
    {
        if let Some(ls) = LocalStorage::new() {
            return Box::new(ls);
        }
    }
    Box::<MemoryStorage>::default()
}

struct StorageInner {
    backend: Box<dyn Backend>,
    refresh_deadline: Mutex<Option<(String, i64)>>,
    refresh_lock: tokio::sync::Mutex<()>,
}

/// Wraps a [`Backend`], decoding tokens on set. Cheaply cloneable (shares one
/// backend).
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
    /// Takes ownership of a backend without reading it; persisted data is loaded
    /// and canonicalized when [`Self::get`] is called.
    pub fn new(backend: Box<dyn Backend>) -> Self {
        Self {
            inner: Arc::new(StorageInner {
                backend,
                refresh_deadline: Mutex::new(None),
                refresh_lock: tokio::sync::Mutex::new(()),
            }),
        }
    }

    /// Reads the session and re-decodes its access token so persisted
    /// `decodedToken` cache values cannot diverge from the public result.
    pub fn get(&self) -> Result<Option<StoredSession>, Error> {
        let Some(stored) = self.inner.backend.get()? else {
            return Ok(None);
        };

        // decodedToken is persisted for JS SDK interoperability, but it is
        // redundant and may have been edited independently of the access token.
        // Re-decode on read so scheduling and public accessors use one canonical
        // set of claims instead of trusting attacker-controlled cached values.
        Ok(Some(canonicalize_stored_session(stored)?))
    }

    /// Stores a raw auth session, enriching it into a stored session. The access
    /// token must contain a positive integer `exp` claim representable as
    /// milliseconds and `accessTokenExpiresIn` must be a positive duration
    /// representable as milliseconds.
    pub fn set(&self, value: Session) -> Result<(), Error> {
        self.set_received(value, false)
    }

    fn set_received(&self, value: Session, after_refresh: bool) -> Result<(), Error> {
        let stored = to_stored_session(value)?;
        let deadline = received_refresh_deadline(&stored, now_ms(), after_refresh)?;
        self.inner.backend.set(&stored)?;
        *self.inner.refresh_deadline.lock().unwrap() =
            Some((stored.session.access_token.clone(), deadline));
        Ok(())
    }

    /// Deletes the persisted session and clears its refresh schedule.
    pub fn remove(&self) -> Result<(), Error> {
        self.inner.backend.remove()?;
        *self.inner.refresh_deadline.lock().unwrap() = None;
        Ok(())
    }

    fn scheduled_expiry(&self, session: &StoredSession, now: i64) -> Result<i64, Error> {
        let mut scheduled = self.inner.refresh_deadline.lock().unwrap();
        if let Some((token, deadline)) = scheduled.as_ref() {
            if token == &session.session.access_token {
                return Ok(*deadline);
            }
        }

        // A persisted session has no trustworthy receipt time. Prefer a
        // possibly unnecessary refresh under a fast local clock over attaching
        // a potentially stale bearer, while capping a far-future expiry to one
        // advertised lifetime so a slow clock cannot create a never-refresh.
        let deadline = persisted_refresh_deadline(session, now)?;
        *scheduled = Some((session.session.access_token.clone(), deadline));
        Ok(deadline)
    }
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn refresh_cutoff(margin: i64) -> Result<(i64, i64), Error> {
    if margin < 0 {
        return Err(Error::Config(
            "refresh margin must be zero or a positive number of seconds".to_string(),
        ));
    }

    let margin_ms = margin.checked_mul(1000).ok_or_else(|| {
        Error::Config("refresh margin is too large to represent in milliseconds".to_string())
    })?;
    let now = now_ms();
    let cutoff = now.checked_add(margin_ms).ok_or_else(|| {
        Error::Config("refresh margin is too large to schedule from the current time".to_string())
    })?;
    Ok((now, cutoff))
}

pub(crate) fn validate_refresh_margin(margin: i64) -> Result<(), Error> {
    refresh_cutoff(margin).map(|_| ())
}

/// Returns (session, needs_refresh, session_expired).
fn needs_refresh(
    storage: &SessionStorage,
    margin: i64,
) -> Result<(Option<StoredSession>, bool, bool), Error> {
    let (now, cutoff) = refresh_cutoff(margin)?;
    let Some(session) = storage.get()? else {
        return Ok((None, false, false));
    };

    let exp = storage.scheduled_expiry(&session, now)?;

    // Force refresh if margin is 0, matching @nhost/nhost-js. The session is
    // deliberately classified as not expired for refresh-failure policy.
    if margin == 0 {
        return Ok((Some(session), true, false));
    }

    // exp and cutoff are absolute milliseconds, so this comparison cannot
    // overflow even for an expiry loaded from untrusted persisted JSON.
    if exp > cutoff {
        Ok((Some(session), false, false))
    } else {
        Ok((Some(session), true, exp <= now))
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
                .set_received(refreshed, true)
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
/// status `401`, which clears the store; a failure to clear it is returned
/// rather than reported as a sign-out. `Ok(None)` also means
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
/// Negative margins and margins too large for millisecond scheduling return
/// [`Error::Config`] without making a refresh request.
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
                    // The refresh token was rejected, so the stored session is
                    // unusable. Report a failure to clear it rather than
                    // returning `Ok(None)`: that reads as a clean sign-out
                    // while the dead session stays behind for the next `get`.
                    storage.remove()?;
                }
                Ok(None)
            }
        },
    }
}
