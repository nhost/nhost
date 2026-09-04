//! The Nhost SDK for Rust: an idiomatic async client for Nhost's Auth, Storage,
//! GraphQL, and Functions services.
//!
//! Build a client with [`Nhost::builder`], then reach the services through it:
//!
//! ```no_run
//! # async fn f() -> Result<(), nhost::Error> {
//! use nhost::Nhost;
//! use nhost::auth::SignInEmailPasswordRequest;
//!
//! let client = Nhost::builder().subdomain("local").region("local").build()?;
//! client
//!     .auth
//!     .sign_in_email_password(SignInEmailPasswordRequest {
//!         email: "user@example.com".into(),
//!         password: "secret".into(),
//!     })
//!     .await?;
//! # Ok(())
//! # }
//! ```
//!
//! Callers that need full control over the request pipeline can build the four
//! service clients themselves and combine them with [`Nhost::from_clients`].
//!
//! The auth and storage REST clients are generated from the shared OpenAPI
//! specs; the middleware chain (built on [`reqwest_middleware`]), session
//! handling, GraphQL, and Functions clients are hand-written.

#![warn(missing_docs)]
// On wasm32 the session store is single-threaded and its Arc wraps deliberately
// !Send state (see `session::SessionStorage`), so silence the lint only there.
#![cfg_attr(
    all(feature = "wasm", target_arch = "wasm32"),
    allow(clippy::arc_with_non_send_sync)
)]

// Keep the crate-level overview above concise while compiling every Rust
// example in the more extensive README as a doctest.
#[cfg(doctest)]
#[doc = include_str!("../README.md")]
struct ReadmeDoctests;

/// Compile-fail checks exercise the public API as a downstream crate. They
/// ensure extensible SDK-owned types cannot be constructed with struct literals
/// or matched exhaustively outside this crate.
///
/// ```compile_fail
/// let _ = nhost::ApiError {
///     message: String::new(),
///     status: 500,
///     body: Default::default(),
///     headers: Default::default(),
/// };
/// ```
///
/// ```compile_fail
/// fn inspect(error: nhost::ApiError) {
///     let nhost::ApiError { message, status, body, headers } = error;
/// }
/// ```
///
/// ```compile_fail
/// let _ = nhost::http::Response {
///     body: (),
///     status: 200,
///     headers: Default::default(),
/// };
/// ```
///
/// ```compile_fail
/// fn inspect(response: nhost::http::Response<()>) {
///     let nhost::http::Response { body, status, headers } = response;
/// }
/// ```
///
/// ```compile_fail
/// fn inspect(error: nhost::Error) {
///     match error {
///         nhost::Error::Api(_) => {}
///         nhost::Error::GraphQl(_) => {}
///         nhost::Error::InvalidToken(_) => {}
///         nhost::Error::Config(_) => {}
///         nhost::Error::Storage(_) => {}
///         nhost::Error::Http(_) => {}
///         nhost::Error::Middleware(_) => {}
///         nhost::Error::Json(_) => {}
///     }
/// }
/// ```
///
/// ```compile_fail
/// fn inspect(service: nhost::Service) {
///     match service {
///         nhost::Service::Auth => {}
///         nhost::Service::Storage => {}
///         nhost::Service::Graphql => {}
///         nhost::Service::Functions => {}
///     }
/// }
/// ```
///
/// ```compile_fail
/// let _ = nhost::graphql::GraphqlError {
///     message: String::new(),
///     locations: None,
///     path: None,
///     extensions: None,
/// };
/// ```
///
/// ```compile_fail
/// let _ = nhost::graphql::GraphqlResponse::<()> {
///     data: None,
///     errors: None,
/// };
/// ```
#[cfg(doctest)]
struct CompatibilityDoctests;

pub mod auth;
pub mod error;
pub mod functions;
pub mod graphql;
pub mod http;
pub mod middleware;
pub mod session;
pub mod storage;

mod client;
pub use client::*;
pub use error::{ApiError, Error, GraphqlOperationError};
