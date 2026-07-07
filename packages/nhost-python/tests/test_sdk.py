"""Unit tests for the Nhost Python SDK using an httpx mock transport.

No network I/O: an ``httpx.MockTransport`` intercepts every request so we can
assert on request shape (aliases, headers, multipart) and drive responses.
"""

from __future__ import annotations

import base64
import json
import re
import time

import httpx
import pytest

from nhost import (
    FetchError,
    MemoryStorage,
    NhostClientOptions,
    create_client,
)
from nhost.auth import (
    Session,
    SignUpEmailPasswordRequest,
    generate_code_challenge,
    generate_code_verifier,
    generate_pkce_pair,
)
from nhost.session import decode_user_session


def make_jwt(exp_offset_seconds: int = 3600) -> str:
    def seg(obj: dict) -> str:
        raw = json.dumps(obj).encode()
        return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()

    header = seg({"alg": "HS256", "typ": "JWT"})
    payload = seg(
        {
            "sub": "user-123",
            "iat": int(time.time()),
            "exp": int(time.time()) + exp_offset_seconds,
            "https://hasura.io/jwt/claims": {
                "x-hasura-default-role": "user",
                "x-hasura-allowed-roles": "{user,me}",
            },
        }
    )
    return f"{header}.{payload}.signature"


def session_payload_bytes(access_token: str) -> bytes:
    return json.dumps(
        {
            "session": {
                "accessToken": access_token,
                "accessTokenExpiresIn": 3600,
                "refreshToken": "refresh-token",
                "refreshTokenId": "refresh-id",
                "user": None,
            }
        }
    ).encode()


def build_client(handler, backend=None):
    transport = httpx.MockTransport(handler)
    http = httpx.AsyncClient(transport=transport)
    return create_client(
        NhostClientOptions(
            subdomain="demo",
            region="eu-central-1",
            storage=backend or MemoryStorage(),
            http_client=http,
        )
    )


def test_decode_user_session_parses_claims_and_arrays() -> None:
    decoded = decode_user_session(make_jwt())
    assert decoded.sub == "user-123"
    assert decoded.exp is not None
    assert decoded.hasura_claims is not None
    assert decoded.hasura_claims["x-hasura-default-role"] == "user"
    # PostgreSQL array literal is expanded into a list.
    assert decoded.hasura_claims["x-hasura-allowed-roles"] == ["user", "me"]


async def test_generated_auth_signup_roundtrip() -> None:
    seen: dict = {}
    token = make_jwt()

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["content_type"] = request.headers.get("content-type")
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, content=session_payload_bytes(token))

    async with build_client(handler) as nhost:
        resp = await nhost.auth.sign_up_email_password(
            SignUpEmailPasswordRequest(email="ada@example.com", password="secret-pw")
        )

    assert resp.status == 200
    assert resp.body.session is not None
    assert resp.body.session.access_token == token
    # Request body must use wire aliases, not python field names.
    assert seen["body"] == {"email": "ada@example.com", "password": "secret-pw"}
    assert "application/json" in seen["content_type"]
    assert seen["url"].endswith("/signup/email-password")


async def test_signup_response_is_captured_into_session_storage() -> None:
    token = make_jwt()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=session_payload_bytes(token))

    async with build_client(handler) as nhost:
        await nhost.auth.sign_up_email_password(
            SignUpEmailPasswordRequest(email="ada@example.com", password="secret-pw")
        )
        stored = nhost.get_user_session()

    assert stored is not None
    assert stored.access_token == token
    assert stored.decoded_token.sub == "user-123"


async def test_access_token_attached_to_graphql_request() -> None:
    token = make_jwt()
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["auth"] = request.headers.get("authorization")
        return httpx.Response(200, json={"data": {"__typename": "query_root"}})

    backend = MemoryStorage()
    async with build_client(handler, backend) as nhost:
        nhost.session_storage.set(
            Session(
                access_token=token,
                access_token_expires_in=3600,
                refresh_token="r",
                refresh_token_id="rid",
                user=None,
            )
        )
        result = await nhost.graphql.request("query { __typename }")

    assert captured["auth"] == f"Bearer {token}"
    assert result.body.data == {"__typename": "query_root"}


async def test_graphql_errors_raise_fetch_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"errors": [{"message": "field not found"}]})

    async with build_client(handler) as nhost:
        with pytest.raises(FetchError) as exc:
            await nhost.graphql.request("query { nope }")

    assert "field not found" in str(exc.value)


async def test_functions_decodes_by_content_type() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/json"):
            return httpx.Response(200, json={"ok": True})
        if request.url.path.endswith("/text"):
            return httpx.Response(200, text="hello", headers={"content-type": "text/plain"})
        return httpx.Response(
            200, content=b"\x00\x01", headers={"content-type": "application/octet-stream"}
        )

    async with build_client(handler) as nhost:
        j = await nhost.functions.post("/json", {"x": 1})
        t = await nhost.functions.fetch("/text")
        b = await nhost.functions.fetch("/bin")

    assert j.body == {"ok": True}
    assert t.body == "hello"
    assert b.body == b"\x00\x01"


async def test_functions_error_raises() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"error": "boom"})

    async with build_client(handler) as nhost:
        with pytest.raises(FetchError) as exc:
            await nhost.functions.post("/crash")

    assert exc.value.status == 500
    assert "boom" in str(exc.value)


async def test_storage_multipart_upload_wire_shape() -> None:
    from nhost.storage import UploadFileMetadata, UploadFilesBody

    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["content_type"] = request.headers.get("content-type", "")
        captured["content"] = request.content
        return httpx.Response(
            201,
            json={
                "processedFiles": [
                    {
                        "id": "file-1",
                        "name": "hello.txt",
                        "size": 17,
                        "bucketId": "default",
                        "etag": '"abc"',
                        "createdAt": "2026-01-01T00:00:00Z",
                        "updatedAt": "2026-01-01T00:00:00Z",
                        "isUploaded": True,
                        "mimeType": "text/plain",
                    }
                ]
            },
        )

    async with build_client(handler) as nhost:
        resp = await nhost.storage.upload_files(
            UploadFilesBody(
                bucket_id="default",
                metadata=[UploadFileMetadata(name="hello.txt")],
                file=[b"hello from python"],
            )
        )

    assert resp.status == 201
    assert resp.body.processed_files[0].id == "file-1"
    assert captured["content_type"].startswith("multipart/form-data")
    body = captured["content"]
    # bucket-id as a form field, file[] and metadata[] as the multipart parts.
    assert b'name="bucket-id"' in body
    assert b'name="file[]"' in body
    assert b'name="metadata[]"' in body
    assert b"hello from python" in body


async def test_no_refresh_when_token_is_fresh() -> None:
    token = make_jwt(exp_offset_seconds=3600)
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.path)
        return httpx.Response(200, json={"data": None})

    backend = MemoryStorage()
    async with build_client(handler, backend) as nhost:
        nhost.session_storage.set(
            Session(
                access_token=token,
                access_token_expires_in=3600,
                refresh_token="r",
                refresh_token_id="rid",
                user=None,
            )
        )
        await nhost.graphql.request("query { __typename }")

    # A fresh token must not trigger a /token refresh call.
    assert not any(path.endswith("/token") for path in calls)


class TestPKCE:
    """Mirror @nhost/nhost-js's auth/pkce test coverage."""

    def test_code_verifier_is_43_base64url_chars(self) -> None:
        verifier = generate_code_verifier()
        assert re.fullmatch(r"[A-Za-z0-9_-]{43}", verifier)

    def test_code_verifier_is_random(self) -> None:
        assert generate_code_verifier() != generate_code_verifier()

    def test_code_challenge_matches_rfc7636_appendix_b(self) -> None:
        # RFC 7636 Appendix B test vector.
        challenge = generate_code_challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")
        assert challenge == "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

    def test_code_challenge_is_unpadded_base64url(self) -> None:
        challenge = generate_code_challenge("test-verifier")
        assert re.fullmatch(r"[A-Za-z0-9_-]+", challenge)
        assert "=" not in challenge

    def test_pkce_pair_is_consistent(self) -> None:
        pair = generate_pkce_pair()
        assert pair.challenge == generate_code_challenge(pair.verifier)
        assert re.fullmatch(r"[A-Za-z0-9_-]{43}", pair.verifier)
