//! PKCE (Proof Key for Code Exchange) utilities for RFC 7636.

use base64::Engine;
use rand::RngCore;
use sha2::{Digest, Sha256};

fn b64url(data: &[u8]) -> String {
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(data)
}

/// Generates a cryptographically random PKCE code verifier (43 base64url
/// characters, per RFC 7636).
pub fn generate_code_verifier() -> String {
    let mut buf = [0u8; 32];
    rand::rng().fill_bytes(&mut buf);
    b64url(&buf)
}

/// Derives an S256 code challenge from a code verifier.
pub fn generate_code_challenge(verifier: &str) -> String {
    let digest = Sha256::digest(verifier.as_bytes());
    b64url(&digest)
}

/// A PKCE code verifier and its derived S256 challenge.
#[derive(Clone)]
pub struct PkcePair {
    /// The high-entropy secret sent only when exchanging the authorization code.
    pub verifier: String,
    /// The public S256 digest sent with the initial authorization request.
    pub challenge: String,
}

impl std::fmt::Debug for PkcePair {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PkcePair")
            .field("verifier", &"<redacted>")
            .field("challenge", &self.challenge)
            .finish()
    }
}

/// Generates a PKCE code verifier and its S256 challenge.
pub fn generate_pkce_pair() -> PkcePair {
    let verifier = generate_code_verifier();
    let challenge = generate_code_challenge(&verifier);
    PkcePair {
        verifier,
        challenge,
    }
}
