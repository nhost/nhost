"""Session types and JWT decoding for the Nhost Python SDK.

``StoredSession`` is the enriched, client-side session managed by the SDK. It is
a superset of the raw auth ``Session`` returned by the API, adding a
``decoded_token`` with the parsed JWT payload so Hasura claims, roles, and
session variables are available without manually decoding the access token.
"""

from __future__ import annotations

import base64
import binascii
import json
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

# ``User`` is imported so pydantic can resolve the ``Session.user`` forward
# reference when rebuilding the ``StoredSession`` subclass in this namespace.
from ..auth import Session, User  # noqa: F401

_JWT_SEGMENTS = 3
_HASURA_CLAIMS = "https://hasura.io/jwt/claims"


class DecodedToken(BaseModel):
    """Decoded JWT access-token payload.

    ``exp`` and ``iat`` are epoch seconds as encoded in the JWT. Unknown claims
    are preserved via ``extra="allow"``.
    """

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    exp: int | None = None
    iat: int | None = None
    iss: str | None = None
    sub: str | None = None
    hasura_claims: dict[str, Any] | None = Field(default=None, alias="https://hasura.io/jwt/claims")


class StoredSession(Session):
    """The enriched session persisted by the SDK (raw ``Session`` + decoded token)."""

    model_config = ConfigDict(populate_by_name=True)

    decoded_token: DecodedToken = Field(alias="decodedToken")


StoredSession.model_rebuild()


def _decode_base64url(segment: str) -> bytes:
    padding = "=" * (-len(segment) % 4)
    try:
        return base64.urlsafe_b64decode(segment + padding)
    except (binascii.Error, ValueError) as exc:  # pragma: no cover - defensive
        raise ValueError("Invalid access token format") from exc


def _is_postgres_array(value: str) -> bool:
    return value.startswith("{") and value.endswith("}")


def _parse_postgres_array(value: str) -> list[str]:
    if not value or value == "{}":
        return []
    return [item.strip().strip('"') for item in value[1:-1].split(",")]


def decode_user_session(access_token: str) -> DecodedToken:
    """Decode the payload of a JWT access token into a :class:`DecodedToken`.

    Hasura claims encoded as PostgreSQL array literals (e.g. ``{user,me}``) are
    converted into Python lists, mirroring the JS SDK.
    """
    segments = access_token.split(".")
    if len(segments) != _JWT_SEGMENTS or not segments[1]:
        raise ValueError("Invalid access token format")

    payload: dict[str, Any] = json.loads(_decode_base64url(segments[1]))

    raw_claims = payload.get(_HASURA_CLAIMS)
    processed_claims: dict[str, Any] | None = None
    if isinstance(raw_claims, dict):
        processed_claims = {
            key: _parse_postgres_array(value)
            if isinstance(value, str) and _is_postgres_array(value)
            else value
            for key, value in raw_claims.items()
        }

    extra = {
        key: value
        for key, value in payload.items()
        if key not in {"exp", "iat", "iss", "sub", _HASURA_CLAIMS}
    }

    return DecodedToken.model_validate(
        {
            "exp": payload.get("exp"),
            "iat": payload.get("iat"),
            "iss": payload.get("iss"),
            "sub": payload.get("sub"),
            _HASURA_CLAIMS: processed_claims,
            **extra,
        }
    )


def to_stored_session(session: Session) -> StoredSession:
    """Enrich a raw auth :class:`Session` into a :class:`StoredSession`."""
    decoded = decode_user_session(session.access_token)
    return StoredSession(**session.model_dump(), decoded_token=decoded)
