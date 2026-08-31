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
//! The auth and storage REST clients are generated from the shared OpenAPI
//! specs; the middleware chain (built on [`reqwest_middleware`]), session
//! handling, GraphQL, and Functions clients are hand-written.

// On wasm the session store is single-threaded and its Arc wraps deliberately
// !Send state (see `session::SessionStorage`), so silence the lint there.
#![cfg_attr(feature = "wasm", allow(clippy::arc_with_non_send_sync))]

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
pub use error::{ApiError, Error};
