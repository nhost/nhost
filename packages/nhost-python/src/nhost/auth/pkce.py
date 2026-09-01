"""PKCE (Proof Key for Code Exchange) utilities for RFC 7636.

Mirrors the ``pkce`` helpers in ``@nhost/nhost-js``'s ``auth`` module. Unlike
the JS version (which awaits the async Web Crypto API), these are synchronous:
the underlying work is pure CPU-bound crypto from the standard library, so there
is no I/O to await.
"""

from __future__ import annotations

import base64
import hashlib
import secrets
from typing import NamedTuple

__all__ = [
    "PKCEPair",
    "generate_code_challenge",
    "generate_code_verifier",
    "generate_pkce_pair",
]


def _b64url(data: bytes) -> str:
    """Base64url-encode ``data`` without padding (per RFC 7636)."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def generate_code_verifier() -> str:
    """Generate a cryptographically random PKCE code verifier.

    Returns 43 base64url characters (32 random bytes), the RFC 7636 recommended
    length.
    """
    return _b64url(secrets.token_bytes(32))


def generate_code_challenge(verifier: str) -> str:
    """Derive an S256 code challenge from a code verifier."""
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return _b64url(digest)


class PKCEPair(NamedTuple):
    """A PKCE code verifier and its derived S256 challenge."""

    verifier: str
    challenge: str


def generate_pkce_pair() -> PKCEPair:
    """Generate a PKCE code verifier and its S256 challenge in one call."""
    verifier = generate_code_verifier()
    return PKCEPair(verifier=verifier, challenge=generate_code_challenge(verifier))
