//! The Nhost SDK for Rust: a small, idiomatic async client for Nhost's Auth,
//! Storage, GraphQL, and Functions services.
//!
//! The auth and storage REST clients are generated from the shared OpenAPI
//! specs; the fetch middleware chain, session handling, GraphQL, and Functions
//! clients are hand-written. It mirrors the architecture of `@nhost/nhost-js`
//! and the Python and Go SDKs.

// On wasm the SDK is single-threaded and its Arcs are deliberately not
// Send + Sync (the wasm reqwest client is !Send). Rc would do, but keeping Arc
// avoids a second code path, so silence the lint for wasm builds only.
#![cfg_attr(feature = "wasm", allow(clippy::arc_with_non_send_sync))]

pub mod auth;
pub mod fetch;
pub mod functions;
pub mod graphql;
pub mod middleware;
pub mod session;
pub mod storage;

mod client;
pub use client::*;
