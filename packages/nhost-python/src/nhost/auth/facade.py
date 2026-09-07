"""Idiomatic conveniences layered over the spec-generated Auth client."""

from __future__ import annotations

from collections.abc import Mapping

from ..fetch import FetchResponse
from .client import Client, JWKSet, OAuth2DiscoveryResponse, TotpGenerateResponse


class AuthClient(Client):
    """Generated Auth API plus stable, idiomatically named conveniences."""

    async def get_jwks(self, *, headers: Mapping[str, str] | None = None) -> FetchResponse[JWKSet]:
        """Return the JSON Web Key Set used to verify access tokens."""
        return await self.get_jw_ks(headers=headers)

    async def generate_totp_secret(
        self, *, headers: Mapping[str, str] | None = None
    ) -> FetchResponse[TotpGenerateResponse]:
        """Generate a TOTP secret for multi-factor authentication setup."""
        return await self.change_user_mfa(headers=headers)

    async def get_oauth_authorization_server(
        self, *, headers: Mapping[str, str] | None = None
    ) -> FetchResponse[OAuth2DiscoveryResponse]:
        """Return RFC 8414 OAuth authorization-server metadata."""
        return await self.get_o_auth_authorization_server(headers=headers)
