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
    /// A persisted cache of the access-token claims. [`SessionManager::get`]
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

impl StoredSession {
    /// The ID of the user this session belongs to: the auth service's `user.id`,
    /// or the access token's `sub` claim when the response carried no user. A
    /// [`MultiUserSessionStore`] saves the session under it.
    pub fn user_id(&self) -> Option<&str> {
        self.session
            .user
            .as_ref()
            .map(|user| user.id.as_str())
            .filter(|id| !id.is_empty())
            .or_else(|| {
                self.decoded_token
                    .sub
                    .as_deref()
                    .filter(|id| !id.is_empty())
            })
    }
}

/// Whether `stored` is the session a request for `user_id` should get from a
/// store holding at most one session: any session when no user is named,
/// otherwise only that user's.
fn selects(stored: Option<&StoredSession>, user_id: Option<&str>) -> bool {
    stored.is_some_and(|stored| user_id.is_none_or(|user_id| stored.user_id() == Some(user_id)))
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

/// The error a session store returns. The SDK reports it as
/// [`Error::Storage`], which keeps it so it can be downcast.
pub type BoxError = Box<dyn std::error::Error + Send + Sync>;

/// Re-exported so a custom store can be implemented without adding
/// `async-trait` as a dependency. Use `#[async_trait(?Send)]` in the browser
/// (`wasm32` with the `wasm` feature).
pub use async_trait::async_trait;

/// `Send + Sync` on native targets, and no bound in the browser (`wasm32` with
/// the `wasm` feature), whose storage handles are `!Send`. Implemented for every
/// type that satisfies it.
#[cfg(not(all(feature = "wasm", target_arch = "wasm32")))]
pub trait MaybeSendSync: Send + Sync {}
#[cfg(not(all(feature = "wasm", target_arch = "wasm32")))]
impl<T: Send + Sync + ?Sized> MaybeSendSync for T {}
/// `Send + Sync` on native targets, and no bound in the browser (`wasm32` with
/// the `wasm` feature), whose storage handles are `!Send`. Implemented for every
/// type that satisfies it.
#[cfg(all(feature = "wasm", target_arch = "wasm32"))]
pub trait MaybeSendSync {}
#[cfg(all(feature = "wasm", target_arch = "wasm32"))]
impl<T: ?Sized> MaybeSendSync for T {}

/// Where a client acting for one user keeps its session: a CLI, a script, a
/// test or a browser tab. Pass one to
/// [`NhostBuilder::session_store`](crate::NhostBuilder::session_store).
///
/// A store only loads, saves and deletes the session; the SDK decides which
/// requests get it. Built in: [`MemoryStore`], `FileStore` and, in the
/// browser, `LocalStorageStore`. The methods are async so a store can live in a
/// remote service without blocking the runtime.
#[cfg_attr(
    not(all(feature = "wasm", target_arch = "wasm32")),
    async_trait::async_trait
)]
#[cfg_attr(all(feature = "wasm", target_arch = "wasm32"), async_trait::async_trait(?Send))]
pub trait SessionStore: MaybeSendSync {
    /// Loads the session, or `None` when there is none.
    async fn load(&self) -> Result<Option<StoredSession>, BoxError>;

    /// Saves `session`, replacing any session already stored.
    async fn save(&self, session: &StoredSession) -> Result<(), BoxError>;

    /// Deletes the session. Deleting when there is none succeeds.
    async fn delete(&self) -> Result<(), BoxError>;

    /// Deletes the session if it still holds `refresh_token`, and otherwise
    /// returns the session it holds.
    ///
    /// The SDK calls this after the auth service rejected `refresh_token`. The
    /// auth service rotates the refresh token on every refresh, so a process
    /// sharing the store may have refreshed first and saved a newer session,
    /// which must survive. The default loads, compares and deletes in separate
    /// calls, so a session saved between them is deleted; a store that can do
    /// this in one atomic step should override it.
    async fn delete_if_refresh_token(
        &self,
        refresh_token: &str,
    ) -> Result<Option<StoredSession>, BoxError> {
        match self.load().await? {
            Some(current) if current.session.refresh_token != refresh_token => Ok(Some(current)),
            Some(_) => {
                self.delete().await?;
                Ok(None)
            }
            None => Ok(None),
        }
    }
}

/// Where a server keeps the sessions of the users it acts for, keyed by user
/// ID. Pass one to
/// [`NhostBuilder::multi_user_session_store`](crate::NhostBuilder::multi_user_session_store).
///
/// A request names its user with
/// [`Nhost::with_user_id`](crate::Nhost::with_user_id). The SDK never asks the
/// store about a request that names none, so such a request sends no token
/// rather than someone else's. Sessions are saved under the user the auth
/// service returned them for.
///
/// Built in: [`MultiUserMemoryStore`], for one process. Replicas that share
/// sessions implement this over a shared store:
///
/// ```
/// use nhost::session::{async_trait, BoxError, MultiUserSessionStore, StoredSession};
/// use std::collections::HashMap;
/// use std::sync::Mutex;
///
/// /// Stands in for a Redis or database client.
/// #[derive(Default)]
/// struct SharedStore {
///     rows: Mutex<HashMap<String, String>>,
/// }
///
/// #[async_trait]
/// impl MultiUserSessionStore for SharedStore {
///     async fn load(&self, user_id: &str) -> Result<Option<StoredSession>, BoxError> {
///         let rows = self.rows.lock().unwrap();
///         Ok(rows.get(user_id).map(|json| serde_json::from_str(json)).transpose()?)
///     }
///
///     async fn save(&self, user_id: &str, session: &StoredSession) -> Result<(), BoxError> {
///         let json = serde_json::to_string(session)?;
///         self.rows.lock().unwrap().insert(user_id.to_string(), json);
///         Ok(())
///     }
///
///     async fn delete(&self, user_id: &str) -> Result<(), BoxError> {
///         self.rows.lock().unwrap().remove(user_id);
///         Ok(())
///     }
/// }
/// ```
#[cfg_attr(
    not(all(feature = "wasm", target_arch = "wasm32")),
    async_trait::async_trait
)]
#[cfg_attr(all(feature = "wasm", target_arch = "wasm32"), async_trait::async_trait(?Send))]
pub trait MultiUserSessionStore: MaybeSendSync {
    /// Loads `user_id`'s session, or `None` when there is none.
    async fn load(&self, user_id: &str) -> Result<Option<StoredSession>, BoxError>;

    /// Saves `session` as `user_id`'s, replacing any session already stored
    /// for them.
    async fn save(&self, user_id: &str, session: &StoredSession) -> Result<(), BoxError>;

    /// Deletes `user_id`'s session. Deleting when there is none succeeds.
    async fn delete(&self, user_id: &str) -> Result<(), BoxError>;

    /// Deletes `user_id`'s session if it still holds `refresh_token`, and
    /// otherwise returns the session it holds.
    ///
    /// The SDK calls this after the auth service rejected `refresh_token`. The
    /// auth service rotates the refresh token on every refresh, so a replica
    /// sharing the store may have refreshed first and saved a newer session,
    /// which must survive. The default loads, compares and deletes in separate
    /// calls, so a session saved between them is deleted; a store that can do
    /// this in one atomic step (a Redis script, a conditional `DELETE`) should
    /// override it.
    async fn delete_if_refresh_token(
        &self,
        user_id: &str,
        refresh_token: &str,
    ) -> Result<Option<StoredSession>, BoxError> {
        match self.load(user_id).await? {
            Some(current) if current.session.refresh_token != refresh_token => Ok(Some(current)),
            Some(_) => {
                self.delete(user_id).await?;
                Ok(None)
            }
            None => Ok(None),
        }
    }
}

// A store behind an `Arc` or a `Box` is still a store: an `Arc` lets the caller
// keep a handle to the store it gave the builder, and a `Box<dyn ..>` lets it
// pick the store at runtime.
macro_rules! forward_stores {
    ($($pointer:ident),*) => {$(
        #[cfg_attr(
            not(all(feature = "wasm", target_arch = "wasm32")),
            async_trait::async_trait
        )]
        #[cfg_attr(all(feature = "wasm", target_arch = "wasm32"), async_trait::async_trait(?Send))]
        impl<T: SessionStore + ?Sized> SessionStore for $pointer<T> {
            async fn load(&self) -> Result<Option<StoredSession>, BoxError> {
                (**self).load().await
            }

            async fn save(&self, session: &StoredSession) -> Result<(), BoxError> {
                (**self).save(session).await
            }

            async fn delete(&self) -> Result<(), BoxError> {
                (**self).delete().await
            }

            async fn delete_if_refresh_token(
                &self,
                refresh_token: &str,
            ) -> Result<Option<StoredSession>, BoxError> {
                (**self).delete_if_refresh_token(refresh_token).await
            }
        }

        #[cfg_attr(
            not(all(feature = "wasm", target_arch = "wasm32")),
            async_trait::async_trait
        )]
        #[cfg_attr(all(feature = "wasm", target_arch = "wasm32"), async_trait::async_trait(?Send))]
        impl<T: MultiUserSessionStore + ?Sized> MultiUserSessionStore for $pointer<T> {
            async fn load(&self, user_id: &str) -> Result<Option<StoredSession>, BoxError> {
                (**self).load(user_id).await
            }

            async fn save(&self, user_id: &str, session: &StoredSession) -> Result<(), BoxError> {
                (**self).save(user_id, session).await
            }

            async fn delete(&self, user_id: &str) -> Result<(), BoxError> {
                (**self).delete(user_id).await
            }

            async fn delete_if_refresh_token(
                &self,
                user_id: &str,
                refresh_token: &str,
            ) -> Result<Option<StoredSession>, BoxError> {
                (**self).delete_if_refresh_token(user_id, refresh_token).await
            }
        }
    )*};
}

forward_stores!(Arc, Box);

/// The session `slot` holds unless it still holds `refresh_token`, in which
/// case the slot is emptied: [`SessionStore::delete_if_refresh_token`] in one
/// step, for the in-memory stores.
fn take_if_refresh_token(
    slot: &mut Option<StoredSession>,
    refresh_token: &str,
) -> Option<StoredSession> {
    match slot {
        Some(current) if current.session.refresh_token != refresh_token => Some(current.clone()),
        _ => {
            *slot = None;
            None
        }
    }
}

/// In-memory store holding one session, for a CLI, a script or a test.
///
/// It is not shared across processes and is cleared when the process exits. A
/// server acting for many users uses [`MultiUserMemoryStore`] or its own
/// [`MultiUserSessionStore`] instead.
#[derive(Default)]
pub struct MemoryStore {
    session: Mutex<Option<StoredSession>>,
}

#[cfg_attr(
    not(all(feature = "wasm", target_arch = "wasm32")),
    async_trait::async_trait
)]
#[cfg_attr(all(feature = "wasm", target_arch = "wasm32"), async_trait::async_trait(?Send))]
impl SessionStore for MemoryStore {
    async fn load(&self) -> Result<Option<StoredSession>, BoxError> {
        Ok(self.session.lock().unwrap().clone())
    }

    async fn save(&self, session: &StoredSession) -> Result<(), BoxError> {
        *self.session.lock().unwrap() = Some(session.clone());
        Ok(())
    }

    async fn delete(&self) -> Result<(), BoxError> {
        *self.session.lock().unwrap() = None;
        Ok(())
    }

    async fn delete_if_refresh_token(
        &self,
        refresh_token: &str,
    ) -> Result<Option<StoredSession>, BoxError> {
        Ok(take_if_refresh_token(
            &mut self.session.lock().unwrap(),
            refresh_token,
        ))
    }
}

/// In-memory store holding one session per user, for a server that signs users
/// in and keeps their sessions for them.
///
/// Sessions live only in this process; replicas that share sessions need a
/// [`MultiUserSessionStore`] of their own, such as one on Redis.
#[derive(Default)]
pub struct MultiUserMemoryStore {
    sessions: Mutex<HashMap<String, StoredSession>>,
}

#[cfg_attr(
    not(all(feature = "wasm", target_arch = "wasm32")),
    async_trait::async_trait
)]
#[cfg_attr(all(feature = "wasm", target_arch = "wasm32"), async_trait::async_trait(?Send))]
impl MultiUserSessionStore for MultiUserMemoryStore {
    async fn load(&self, user_id: &str) -> Result<Option<StoredSession>, BoxError> {
        Ok(self.sessions.lock().unwrap().get(user_id).cloned())
    }

    async fn save(&self, user_id: &str, session: &StoredSession) -> Result<(), BoxError> {
        self.sessions
            .lock()
            .unwrap()
            .insert(user_id.to_string(), session.clone());
        Ok(())
    }

    async fn delete(&self, user_id: &str) -> Result<(), BoxError> {
        self.sessions.lock().unwrap().remove(user_id);
        Ok(())
    }

    async fn delete_if_refresh_token(
        &self,
        user_id: &str,
        refresh_token: &str,
    ) -> Result<Option<StoredSession>, BoxError> {
        let mut sessions = self.sessions.lock().unwrap();
        let mut slot = sessions.remove(user_id);
        let kept = take_if_refresh_token(&mut slot, refresh_token);
        if let Some(session) = slot {
            sessions.insert(user_id.to_string(), session);
        }
        Ok(kept)
    }
}

/// Session store in a JSON file, for a CLI or a local script.
///
/// Not available on wasm32, which has no filesystem: the browser persists
/// sessions through `LocalStorageStore` instead. This is deliberately keyed on the
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
/// Other platforms inherit the default permissions, so avoid this store on
/// shared storage there.
///
/// # Durability
///
/// Writes are atomic: the session is written to a temporary file in the same
/// directory, flushed, and renamed over the destination, so a concurrent reader
/// or an interrupted write never observes a partial file. A file that cannot be
/// parsed is reported as an error and left in place — it may still
/// hold a usable refresh token, so it is never deleted to manufacture a clean
/// "no session" result.
#[cfg(not(target_arch = "wasm32"))]
pub struct FileStore {
    path: PathBuf,
}

#[cfg(not(target_arch = "wasm32"))]
impl FileStore {
    /// Creates a store for `path`; parent directories are created on the first
    /// write attempt rather than during construction, so they persist even if
    /// that write then fails.
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self { path: path.into() }
    }

    /// Names the scratch file [`SessionStore::save`] renames into place. The process
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
impl FileStore {
    fn read(&self) -> Result<Option<StoredSession>, BoxError> {
        let data = match fs::read(&self.path) {
            Ok(d) => d,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(e) => return Err(e.into()),
        };

        // A file that will not parse is reported, never deleted. Discarding it
        // would destroy the refresh token it may still contain, and reporting
        // `Ok(None)` would present that loss to the caller as a signed out
        // user, so a transient problem becomes permanent silently.
        serde_json::from_slice(&data)
            .map(Some)
            .map_err(|e| format!("{}: {e}", self.path.display()).into())
    }
}

// The file operations are synchronous: the file is one small JSON document on
// local disk, so they finish in microseconds, and the SDK does not require a
// particular async runtime to hand them to.
#[cfg(not(target_arch = "wasm32"))]
#[async_trait::async_trait]
impl SessionStore for FileStore {
    async fn load(&self) -> Result<Option<StoredSession>, BoxError> {
        self.read()
    }

    async fn save(&self, session: &StoredSession) -> Result<(), BoxError> {
        use std::io::Write;

        let data = serde_json::to_vec(session)?;

        let parent = self.path.parent().unwrap_or(std::path::Path::new("."));

        if self.path.parent().is_some() {
            let mut builder = fs::DirBuilder::new();
            builder.recursive(true);
            #[cfg(unix)]
            {
                use std::os::unix::fs::DirBuilderExt;
                builder.mode(0o700);
            }
            builder.create(parent)?;
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

        let mut file = options.open(temporary.path())?;

        file.write_all(&data)?;

        // Flush to disk before the rename. Without this the rename can be
        // durable while the contents are not, which is the truncated-file case
        // this rewrite exists to prevent.
        file.sync_all()?;
        drop(file);

        // Renaming moves the temporary file's inode, so the destination takes
        // its 0o600 mode; a file previously left at a wider mode is replaced
        // rather than reused, and needs no separate chmod.
        fs::rename(temporary.path(), &self.path)?;
        temporary.into_renamed();

        Ok(())
    }

    async fn delete(&self) -> Result<(), BoxError> {
        match fs::remove_file(&self.path) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(e.into()),
        }
    }
}

/// Session store in the browser's `localStorage`, holding one session. Uses
/// the same `"nhostSession"` key as `@nhost/nhost-js`, so a session persisted
/// by either SDK on the same origin is interoperable.
///
/// # Sensitive data
///
/// The persisted [`StoredSession`] includes the long-lived refresh token.
/// `localStorage` is readable by any script on the origin, so an XSS can expose
/// a durable credential. Applications with a stricter threat model should pass
/// a different store to [`crate::NhostBuilder::session_store`].
#[cfg(all(feature = "wasm", target_arch = "wasm32"))]
pub struct LocalStorageStore {
    storage: web_sys::Storage,
}

#[cfg(all(feature = "wasm", target_arch = "wasm32"))]
impl LocalStorageStore {
    const KEY: &'static str = "nhostSession";

    /// Returns a handle to `window.localStorage`, or `None` when it is
    /// unavailable (e.g. no `window`, or storage disabled).
    pub fn new() -> Option<Self> {
        let storage = web_sys::window()?.local_storage().ok()??;
        Some(Self { storage })
    }
}

#[cfg(all(feature = "wasm", target_arch = "wasm32"))]
impl LocalStorageStore {
    fn read(&self) -> Result<Option<StoredSession>, BoxError> {
        let raw = match self.storage.get_item(Self::KEY) {
            Ok(Some(r)) => r,
            Ok(None) => return Ok(None),
            Err(_) => return Err("localStorage read failed".into()),
        };
        // Reported, never deleted: the stored value may hold a usable refresh
        // token, and `Ok(None)` would present the loss as a signed out user.
        // A value written by another SDK version is a case to surface, not to
        // silently discard.
        serde_json::from_str(&raw)
            .map(Some)
            .map_err(|e| format!("{}: {e}", Self::KEY).into())
    }
}

#[cfg(all(feature = "wasm", target_arch = "wasm32"))]
#[async_trait::async_trait(?Send)]
impl SessionStore for LocalStorageStore {
    async fn load(&self) -> Result<Option<StoredSession>, BoxError> {
        self.read()
    }

    async fn save(&self, session: &StoredSession) -> Result<(), BoxError> {
        let data = serde_json::to_string(session)?;
        self.storage
            .set_item(Self::KEY, &data)
            .map_err(|_| "localStorage write failed".into())
    }

    async fn delete(&self) -> Result<(), BoxError> {
        self.storage
            .remove_item(Self::KEY)
            .map_err(|_| "localStorage remove failed".into())
    }
}

enum Store {
    Single(Box<dyn SessionStore>),
    MultiUser(Box<dyn MultiUserSessionStore>),
}

struct ManagerInner {
    store: Store,
    /// The refresh deadline scheduled for each user's current access token,
    /// keyed by user ID (`""` for a session without one).
    refresh_deadlines: Mutex<HashMap<String, (String, i64)>>,
    /// Refreshes in progress, keyed by the refresh token they exchange.
    refreshes: Mutex<HashMap<String, Arc<RefreshCall>>>,
}

/// One refresh of one session. Callers refreshing the same session queue on
/// `outcome`; the first to take it performs the refresh and records how it went,
/// so the rest neither repeat a failed request nor resubmit a refresh token the
/// auth service has already rotated.
#[derive(Default)]
struct RefreshCall {
    outcome: tokio::sync::Mutex<Option<RefreshOutcome>>,
}

#[derive(Clone)]
enum RefreshOutcome {
    /// The store holds the result; read it back.
    Settled,
    /// The refresh request failed before any 2xx response.
    RequestFailed(String),
    /// A failure after the refresh was accepted, or before it was sent.
    Failed(String),
}

/// Manages the sessions in a store: picks the one a request selects, decodes
/// tokens, and schedules and coordinates refreshes. Cheaply cloneable (shares
/// one store).
///
/// The builder creates one from the store passed to
/// [`NhostBuilder::session_store`](crate::NhostBuilder::session_store) or
/// [`NhostBuilder::multi_user_session_store`](crate::NhostBuilder::multi_user_session_store);
/// build one yourself only to assemble clients with
/// [`Nhost::from_clients`](crate::Nhost::from_clients).
///
/// `user_id` is the user a request selected with
/// [`Nhost::with_user_id`](crate::Nhost::with_user_id), or `None` when it named
/// none. With a [`SessionStore`], `None` selects its one session and a user ID
/// selects it only if it is that user's. With a [`MultiUserSessionStore`],
/// `None` selects nothing.
#[derive(Clone)]
pub struct SessionManager {
    inner: Arc<ManagerInner>,
}

// wasm32 is single-threaded, and the localStorage store (`web_sys::Storage`)
// is the only !Send state the SDK holds. Asserting Send + Sync here lets
// SessionManager (and the clients that own it) satisfy reqwest-middleware's
// `Middleware: Send + Sync` bound. The target gate is essential to soundness:
// native builds that enable the additive `wasm` feature must not get these
// unsafe impls.
#[cfg(all(feature = "wasm", target_arch = "wasm32"))]
unsafe impl Send for SessionManager {}
#[cfg(all(feature = "wasm", target_arch = "wasm32"))]
unsafe impl Sync for SessionManager {}

impl SessionManager {
    /// Manages the one session in `store`, without reading it; persisted data
    /// is loaded and canonicalized when [`Self::get`] is called.
    pub fn new(store: impl SessionStore + 'static) -> Self {
        Self::with_store(Store::Single(Box::new(store)))
    }

    /// Manages the sessions of many users in `store`, without reading it.
    pub fn multi_user(store: impl MultiUserSessionStore + 'static) -> Self {
        Self::with_store(Store::MultiUser(Box::new(store)))
    }

    fn with_store(store: Store) -> Self {
        Self {
            inner: Arc::new(ManagerInner {
                store,
                refresh_deadlines: Mutex::new(HashMap::new()),
                refreshes: Mutex::new(HashMap::new()),
            }),
        }
    }

    /// Reads the session `user_id` selects and re-decodes its access token so
    /// persisted `decodedToken` cache values cannot diverge from the public
    /// result.
    pub async fn get(&self, user_id: Option<&str>) -> Result<Option<StoredSession>, Error> {
        let stored = match (&self.inner.store, user_id) {
            (Store::Single(store), _) => store
                .load()
                .await
                .map_err(Error::Storage)?
                .filter(|stored| selects(Some(stored), user_id)),
            (Store::MultiUser(_), None) => None,
            (Store::MultiUser(store), Some(user_id)) => {
                store.load(user_id).await.map_err(Error::Storage)?
            }
        };
        // decodedToken is persisted for JS SDK interoperability, but it is
        // redundant and may have been edited independently of the access token.
        // Re-decode on read so scheduling and public accessors use one canonical
        // set of claims instead of trusting attacker-controlled cached values.
        stored.map(canonicalize_stored_session).transpose()
    }

    /// Stores a raw auth session under its user, enriching it into a stored
    /// session. The access token must contain a positive integer `exp` claim
    /// representable as milliseconds and `accessTokenExpiresIn` must be a
    /// positive duration representable as milliseconds. With a
    /// [`MultiUserSessionStore`], a session without a user ID fails with
    /// [`Error::Storage`].
    pub async fn set(&self, value: Session) -> Result<(), Error> {
        self.set_received(value, false).await
    }

    async fn set_received(&self, value: Session, after_refresh: bool) -> Result<(), Error> {
        let stored = to_stored_session(value)?;
        let deadline = received_refresh_deadline(&stored, now_ms(), after_refresh)?;
        match &self.inner.store {
            Store::Single(store) => store.save(&stored).await,
            Store::MultiUser(store) => {
                let user_id = stored.user_id().ok_or_else(|| {
                    Error::Storage("session has no user ID to store it under".into())
                })?;
                store.save(user_id, &stored).await
            }
        }
        .map_err(Error::Storage)?;
        self.inner.refresh_deadlines.lock().unwrap().insert(
            stored.user_id().unwrap_or_default().to_string(),
            (stored.session.access_token.clone(), deadline),
        );
        Ok(())
    }

    /// Deletes the session `user_id` selects and clears its refresh schedule.
    pub async fn remove(&self, user_id: Option<&str>) -> Result<(), Error> {
        match (&self.inner.store, user_id) {
            (Store::Single(store), None) => store.delete().await.map_err(Error::Storage)?,
            // Removing a named user's session must not delete another user's.
            (Store::Single(store), Some(_)) => {
                let stored = store.load().await.map_err(Error::Storage)?;
                if !selects(stored.as_ref(), user_id) {
                    return Ok(());
                }
                store.delete().await.map_err(Error::Storage)?;
            }
            (Store::MultiUser(_), None) => return Ok(()),
            (Store::MultiUser(store), Some(user_id)) => {
                store.delete(user_id).await.map_err(Error::Storage)?;
            }
        }
        self.forget_deadline(user_id);
        Ok(())
    }

    fn forget_deadline(&self, user_id: Option<&str>) {
        let mut deadlines = self.inner.refresh_deadlines.lock().unwrap();
        match user_id {
            Some(user_id) => {
                deadlines.remove(user_id);
            }
            // Only a single-session store selects a session for no user, and
            // it holds just that one.
            None => deadlines.clear(),
        }
    }

    fn scheduled_expiry(&self, session: &StoredSession, now: i64) -> Result<i64, Error> {
        let key = session.user_id().unwrap_or_default();
        let mut deadlines = self.inner.refresh_deadlines.lock().unwrap();
        if let Some((token, deadline)) = deadlines.get(key) {
            if token == &session.session.access_token {
                return Ok(*deadline);
            }
        }

        // A persisted session has no trustworthy receipt time. Prefer a
        // possibly unnecessary refresh under a fast local clock over attaching
        // a potentially stale bearer, while capping a far-future expiry to one
        // advertised lifetime so a slow clock cannot create a never-refresh.
        let deadline = persisted_refresh_deadline(session, now)?;
        deadlines.insert(
            key.to_string(),
            (session.session.access_token.clone(), deadline),
        );
        Ok(deadline)
    }

    /// Returns the refresh in progress for `refresh_token`, starting one if
    /// there is none.
    fn refresh_call(&self, refresh_token: &str) -> Arc<RefreshCall> {
        self.inner
            .refreshes
            .lock()
            .unwrap()
            .entry(refresh_token.to_string())
            .or_default()
            .clone()
    }

    /// Forgets a finished refresh, so a later one starts afresh.
    fn finish_refresh(&self, refresh_token: &str, call: &Arc<RefreshCall>) {
        let mut refreshes = self.inner.refreshes.lock().unwrap();
        if refreshes
            .get(refresh_token)
            .is_some_and(|current| Arc::ptr_eq(current, call))
        {
            refreshes.remove(refresh_token);
        }
    }

    /// Clears the session `user_id` selects after its refresh token was
    /// rejected, unless the store has since been given a session with another
    /// refresh token: then another process refreshed first, and that newer
    /// session is returned instead.
    async fn remove_rejected(
        &self,
        user_id: Option<&str>,
        rejected_refresh_token: &str,
    ) -> Result<Option<StoredSession>, Error> {
        let current = match (&self.inner.store, user_id) {
            (Store::Single(store), _) => store
                .delete_if_refresh_token(rejected_refresh_token)
                .await
                .map_err(Error::Storage)?
                .filter(|stored| selects(Some(stored), user_id)),
            (Store::MultiUser(_), None) => return Ok(None),
            (Store::MultiUser(store), Some(user_id)) => store
                .delete_if_refresh_token(user_id, rejected_refresh_token)
                .await
                .map_err(Error::Storage)?,
        };
        match current {
            Some(current) => canonicalize_stored_session(current).map(Some),
            None => {
                self.forget_deadline(user_id);
                Ok(None)
            }
        }
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
async fn needs_refresh(
    sessions: &SessionManager,
    user_id: Option<&str>,
    margin: i64,
) -> Result<(Option<StoredSession>, bool, bool), Error> {
    let (now, cutoff) = refresh_cutoff(margin)?;
    let Some(session) = sessions.get(user_id).await? else {
        return Ok((None, false, false));
    };

    let exp = sessions.scheduled_expiry(&session, now)?;

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
    /// `refresh_token` is the one the failed request exchanged.
    RequestFailed { error: Error, refresh_token: String },
}

async fn refresh_once(
    auth: &auth::Client,
    sessions: &SessionManager,
    user_id: Option<&str>,
    margin: i64,
) -> Result<Option<StoredSession>, RefreshFailure> {
    let (session, needs, _) = needs_refresh(sessions, user_id, margin)
        .await
        .map_err(RefreshFailure::DoNotRetry)?;
    let Some(session) = session else {
        return Ok(None);
    };
    if !needs {
        return Ok(Some(session));
    }

    let refresh_token = session.session.refresh_token;
    let call = sessions.refresh_call(&refresh_token);
    let mut outcome = call.outcome.lock().await;
    let result = match outcome.clone() {
        Some(finished) => follow_refresh(sessions, user_id, margin, &refresh_token, finished).await,
        None => {
            let result = perform_refresh(auth, sessions, user_id, margin).await;
            *outcome = Some(match &result {
                Ok(_) => RefreshOutcome::Settled,
                Err(RefreshFailure::RequestFailed { error, .. }) => {
                    RefreshOutcome::RequestFailed(error.to_string())
                }
                Err(RefreshFailure::DoNotRetry(error)) => RefreshOutcome::Failed(error.to_string()),
            });
            result
        }
    };
    drop(outcome);
    sessions.finish_refresh(&refresh_token, &call);
    result
}

/// Reports the outcome of a refresh another caller performed for this session.
async fn follow_refresh(
    sessions: &SessionManager,
    user_id: Option<&str>,
    margin: i64,
    refresh_token: &str,
    finished: RefreshOutcome,
) -> Result<Option<StoredSession>, RefreshFailure> {
    let concurrent = |message: String| {
        Error::Middleware(anyhow::anyhow!(
            "a concurrent refresh of this session failed: {message}"
        ))
    };
    match finished {
        RefreshOutcome::Settled => needs_refresh(sessions, user_id, margin)
            .await
            .map(|(session, _, _)| session)
            .map_err(RefreshFailure::DoNotRetry),
        RefreshOutcome::RequestFailed(message) => Err(RefreshFailure::RequestFailed {
            error: concurrent(message),
            refresh_token: refresh_token.to_string(),
        }),
        RefreshOutcome::Failed(message) => Err(RefreshFailure::DoNotRetry(concurrent(message))),
    }
}

async fn perform_refresh(
    auth: &auth::Client,
    sessions: &SessionManager,
    user_id: Option<&str>,
    margin: i64,
) -> Result<Option<StoredSession>, RefreshFailure> {
    // Another refresh may have completed between the first check and this call
    // taking the lead.
    let (session, needs, expired) = needs_refresh(sessions, user_id, margin)
        .await
        .map_err(RefreshFailure::DoNotRetry)?;
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
            sessions
                .set_received(refreshed, true)
                .await
                .map_err(RefreshFailure::DoNotRetry)?;
            sessions
                .get(user_id)
                .await
                .map_err(RefreshFailure::DoNotRetry)
        }
        crate::http::SendOutcome::NotAccepted(error) if expired => {
            Err(RefreshFailure::RequestFailed {
                error,
                refresh_token: session.session.refresh_token,
            })
        }
        crate::http::SendOutcome::NotAccepted(_) => Ok(Some(session)),
    }
}

/// Refreshes the session `user_id` selects (see [`SessionManager`]) if it is close to
/// expiry.
///
/// Concurrent refreshes of the same session, from any number of clients sharing
/// `sessions`, collapse into one request; different users refresh independently.
/// The auth service rotates the refresh token on every refresh, so when several
/// processes share a store, a slower process's refresh is rejected with `401`
/// after a faster one has stored the rotated session. The session is then
/// cleared only if the store still holds the rejected refresh token; otherwise
/// the newer session is returned.
///
/// With a nonzero margin, an expired session's refresh request is retried once
/// only when no 2xx response was observed. If both requests fail, this returns
/// `Ok(None)` but retains the existing session unless the second failure has
/// status `401`, which clears the store; a failure to clear it is returned
/// rather than reported as a sign-out. `Ok(None)` also means
/// there was no session to refresh; it does not by itself mean the store is
/// empty, so call [`SessionManager::get`] (or [`crate::Nhost::session`]) to
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
    sessions: &SessionManager,
    user_id: Option<&str>,
    margin: i64,
) -> Result<Option<StoredSession>, Error> {
    match refresh_once(auth, sessions, user_id, margin).await {
        Ok(session) => Ok(session),
        Err(RefreshFailure::DoNotRetry(error)) => Err(error),
        Err(RefreshFailure::RequestFailed { .. }) => {
            match refresh_once(auth, sessions, user_id, margin).await {
                Ok(session) => Ok(session),
                Err(RefreshFailure::DoNotRetry(error)) => Err(error),
                Err(RefreshFailure::RequestFailed {
                    error,
                    refresh_token,
                }) => {
                    if error.status() == Some(UNAUTHORIZED) {
                        // The refresh token was rejected, so the stored session
                        // is unusable unless another process has replaced it.
                        // A failure to clear it is reported rather than
                        // returning `Ok(None)`: that reads as a clean sign-out
                        // while the dead session stays behind for the next `get`.
                        return sessions.remove_rejected(user_id, &refresh_token).await;
                    }
                    Ok(None)
                }
            }
        }
    }
}
