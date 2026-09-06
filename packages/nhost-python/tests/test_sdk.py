"""Unit tests for the Nhost Python SDK using an httpx mock transport.

No network I/O: an ``httpx.MockTransport`` intercepts every request so we can
assert on request shape (aliases, headers, multipart) and drive responses.
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import re
import stat
import time
from collections.abc import Callable
from pathlib import Path

import httpx
import pytest
from nhost import (
    FetchError,
    FileStorage,
    MemoryStorage,
    NhostClientOptions,
    UploadFile,
    create_client,
    generate_service_url,
)
from nhost.auth import (
    Session,
    SignInEmailPasswordRequest,
    SignUpEmailPasswordRequest,
    User,
    create_api_client,
    generate_code_challenge,
    generate_code_verifier,
    generate_pkce_pair,
)
from nhost.fetch import FetchFunction, create_enhanced_fetch
from nhost.fetch.middleware import (
    _extract_session,
    session_refresh_middleware,
    update_session_from_response_middleware,
)
from nhost.session import (
    DecodedToken,
    SessionStorage,
    StoredSession,
    decode_user_session,
    refresh_session,
    storage_backend,
)
from nhost.session.session import to_stored_session
from nhost.storage import ReplaceFileBody, UploadFileMetadata, UploadFilesBody

OWNER_ONLY_FILE_MODE = stat.S_IRUSR | stat.S_IWUSR
PRIVATE_DIRECTORY_MODE = stat.S_IRWXU
EXISTING_DIRECTORY_MODE = stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP


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


def raw_session_bytes(access_token: str) -> bytes:
    """A bare auth ``Session`` JSON body, as returned by ``POST /token``."""
    return json.dumps(
        {
            "accessToken": access_token,
            "accessTokenExpiresIn": 3600,
            "refreshToken": "new-refresh-token",
            "refreshTokenId": "new-refresh-id",
            "user": None,
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

    assert resp.status == httpx.codes.OK
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


def test_extract_session_without_user_field() -> None:
    """Regression: a session body that omits ``user`` entirely still parses.

    The Go auth service serialises ``User`` with ``omitempty``, so a profile-less
    account produces a ``/token`` | ``/signin`` body with no ``user`` field at
    all (not ``user: null``). Keying off ``user`` being present would drop the
    session; ``_extract_session`` must rely on pydantic validation instead.
    """
    fields = {
        "accessToken": "at",
        "accessTokenExpiresIn": 3600,
        "refreshToken": "rt",
        "refreshTokenId": "rid",
    }

    # Raw body (e.g. POST /token refresh) with no ``user`` key.
    raw = _extract_session(fields)
    assert raw is not None
    assert raw.access_token == "at"
    assert raw.user is None

    # Wrapped body ({"session": {...}}) with no ``user`` key.
    wrapped = _extract_session({"session": fields})
    assert wrapped is not None
    assert wrapped.access_token == "at"

    # A body that isn't a session must still be rejected.
    assert _extract_session({"error": "nope"}) is None


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

    assert exc.value.status == httpx.codes.INTERNAL_SERVER_ERROR
    assert "boom" in str(exc.value)


async def test_storage_multipart_upload_wire_shape() -> None:
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

    assert resp.status == httpx.codes.CREATED
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


async def test_expired_token_triggers_refresh_and_updates_storage() -> None:
    old_token = make_jwt(exp_offset_seconds=-10)
    new_token = make_jwt(exp_offset_seconds=3600)
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.path)
        if request.url.path.endswith("/token"):
            return httpx.Response(200, content=raw_session_bytes(new_token))
        return httpx.Response(200, json={"data": {"__typename": "query_root"}})

    backend = MemoryStorage()
    async with build_client(handler, backend) as nhost:
        nhost.session_storage.set(
            Session(
                access_token=old_token,
                access_token_expires_in=3600,
                refresh_token="r",
                refresh_token_id="rid",
                user=None,
            )
        )
        await nhost.graphql.request("query { __typename }")

        # An expired token must trigger a /token refresh and update storage.
        assert any(path.endswith("/token") for path in calls)
        stored = nhost.get_user_session()
        assert stored is not None
        assert stored.access_token == new_token


async def test_refresh_401_clears_session() -> None:
    old_token = make_jwt(exp_offset_seconds=-10)

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/token"):
            return httpx.Response(401, json={"message": "invalid refresh token"})
        return httpx.Response(200, json={"data": None})

    backend = MemoryStorage()
    async with build_client(handler, backend) as nhost:
        nhost.session_storage.set(
            Session(
                access_token=old_token,
                access_token_expires_in=3600,
                refresh_token="r",
                refresh_token_id="rid",
                user=None,
            )
        )
        await nhost.graphql.request("query { __typename }")

        # A 401 from the refresh endpoint must clear the stored session.
        assert nhost.get_user_session() is None


def _seed_session(storage: SessionStorage, *, exp_offset_seconds: int = 3600) -> StoredSession:
    storage.set(
        Session(
            access_token=make_jwt(exp_offset_seconds),
            access_token_expires_in=3600,
            refresh_token="original-refresh",
            refresh_token_id="original-id",
            user=None,
        )
    )
    session = storage.get()
    assert session is not None
    return session


async def test_forced_refresh_of_expired_session_retries_and_clears_on_401() -> None:
    token_calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/token"):
            token_calls.append(request.url.path)
            return httpx.Response(401, json={"message": "invalid refresh token"})
        return httpx.Response(200, json={"data": None})

    backend = MemoryStorage()
    async with build_client(handler, backend) as nhost:
        _seed_session(nhost.session_storage, exp_offset_seconds=-10)
        refreshed = await nhost.refresh_session(margin_seconds=0)

        assert refreshed is None
        assert token_calls == ["/v1/token", "/v1/token"]
        assert nhost.session_storage.get() is None


async def test_forced_refresh_of_valid_session_preserves_it_on_500() -> None:
    token_calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/token"):
            token_calls.append(request.url.path)
            return httpx.Response(500, json={"message": "temporary failure"})
        return httpx.Response(200, json={"data": None})

    backend = MemoryStorage()
    async with build_client(handler, backend) as nhost:
        session = _seed_session(nhost.session_storage)
        refreshed = await nhost.refresh_session(margin_seconds=0)

        assert refreshed is session
        assert token_calls == ["/v1/token"]
        assert nhost.session_storage.get() is session


def test_session_storage_snapshot_allows_self_unsubscribe() -> None:
    storage = SessionStorage(MemoryStorage())
    notifications: list[tuple[str, bool]] = []
    unsubscribe_first: Callable[[], None]

    def first(session: StoredSession | None) -> None:
        notifications.append(("first", session is None))
        unsubscribe_first()

    def second(session: StoredSession | None) -> None:
        notifications.append(("second", session is None))

    unsubscribe_first = storage.on_change(first)
    storage.on_change(second)

    _seed_session(storage)
    storage.remove()

    assert notifications == [("first", False), ("second", False), ("second", True)]


def test_session_storage_duplicate_subscriptions_unsubscribe_independently() -> None:
    storage = SessionStorage(MemoryStorage())
    notifications: list[StoredSession | None] = []

    def subscriber(session: StoredSession | None) -> None:
        notifications.append(session)

    unsubscribe_first = storage.on_change(subscriber)
    unsubscribe_second = storage.on_change(subscriber)

    stored = _seed_session(storage)
    assert notifications == [stored, stored]

    unsubscribe_first()
    unsubscribe_first()
    storage.remove()
    assert notifications == [stored, stored, None]

    unsubscribe_second()
    _seed_session(storage)
    assert notifications == [stored, stored, None]


def test_session_storage_notifications_allow_reentrant_set_and_remove() -> None:
    storage = SessionStorage(MemoryStorage())
    replacement = Session(
        access_token=make_jwt(),
        access_token_expires_in=3600,
        refresh_token="replacement-refresh",
        refresh_token_id="replacement-id",
        user=None,
    )
    notifications: list[tuple[str, str | None]] = []
    reentry_count = 0

    def reentrant(session: StoredSession | None) -> None:
        nonlocal reentry_count
        notifications.append(("reentrant", None if session is None else session.refresh_token))
        if reentry_count == 0:
            reentry_count += 1
            storage.set(replacement)
        elif reentry_count == 1:
            reentry_count += 1
            storage.remove()

    def observer(session: StoredSession | None) -> None:
        notifications.append(("observer", None if session is None else session.refresh_token))

    storage.on_change(reentrant)
    storage.on_change(observer)
    storage.set(
        Session(
            access_token=make_jwt(),
            access_token_expires_in=3600,
            refresh_token="original-refresh",
            refresh_token_id="original-id",
            user=None,
        )
    )

    assert notifications == [
        ("reentrant", "original-refresh"),
        ("reentrant", "replacement-refresh"),
        ("reentrant", None),
        ("observer", None),
        ("observer", "replacement-refresh"),
        ("observer", "original-refresh"),
    ]
    assert storage.get() is None


def test_session_storage_rederives_forged_decoded_token() -> None:
    storage = SessionStorage(MemoryStorage())
    original = _stored_session("refresh-token")
    expected = decode_user_session(original.access_token)
    forged_decoded = original.decoded_token.model_copy(
        update={"sub": "ATTACKER", "exp": expected.exp + 999999 if expected.exp else 999999}
    )
    forged = original.model_copy(update={"decoded_token": forged_decoded})

    storage.set(forged)

    stored = storage.get()
    assert stored is not None
    assert stored.decoded_token.sub == expected.sub == "user-123"
    assert stored.decoded_token.exp == expected.exp
    assert stored.decoded_token != forged_decoded
    assert stored is not forged


def test_session_tokens_are_hidden_from_display_but_remain_accessible() -> None:
    access_token = make_jwt()
    refresh_token = "controlled-refresh-token-value"
    raw = Session(
        access_token=access_token,
        access_token_expires_in=3600,
        refresh_token=refresh_token,
        refresh_token_id="refresh-id",
        user=None,
    )
    stored = to_stored_session(raw)

    for session in (raw, stored):
        for rendered in (repr(session), str(session), f"{session}"):
            assert access_token not in rendered
            assert refresh_token not in rendered
        assert session.access_token == access_token
        assert session.refresh_token == refresh_token
        assert session.model_dump()["access_token"] == access_token
        serialized = json.loads(session.model_dump_json(by_alias=True))
        assert serialized["accessToken"] == access_token
        assert serialized["refreshToken"] == refresh_token

    decoded_fields = set(stored.decoded_token.model_dump(by_alias=True))
    assert decoded_fields == {
        "exp",
        "iat",
        "iss",
        "sub",
        "https://hasura.io/jwt/claims",
    }
    assert access_token not in repr(stored.decoded_token)
    assert refresh_token not in repr(stored.decoded_token)


def test_decoded_token_repr_redacts_only_undeclared_claim_values() -> None:
    unknown_claim = "unknown-top-level-value-WU-S4"
    custom_hasura_claim = "visible-custom-hasura-value-WU-S4"
    claims = {
        "x-hasura-default-role": "visible-role-WU-S4",
        "x-hasura-user-id": "visible-user-WU-S4",
        "x-hasura-org-api-key": custom_hasura_claim,
    }
    decoded = DecodedToken.model_validate(
        {
            "exp": 1_700_000_001,
            "iat": 1_700_000_000,
            "iss": "visible-issuer-WU-S4",
            "sub": "visible-subject-WU-S4",
            "https://hasura.io/jwt/claims": claims,
            "internal_api_key": unknown_claim,
        }
    )
    stored = StoredSession(
        access_token="controlled-access-token-WU-S4",
        access_token_expires_in=3600,
        refresh_token="controlled-refresh-token-WU-S4",
        refresh_token_id="visible-refresh-id-WU-S4",
        user=None,
        decoded_token=decoded,
    )

    for value in (decoded, stored):
        for rendered in (repr(value), str(value), f"{value}"):
            assert unknown_claim not in rendered
            assert "internal_api_key='<redacted>'" in rendered
            assert "exp=1700000001" in rendered
            assert "iat=1700000000" in rendered
            assert "visible-issuer-WU-S4" in rendered
            assert "visible-subject-WU-S4" in rendered
            assert "x-hasura-default-role" in rendered
            assert "visible-role-WU-S4" in rendered
            assert custom_hasura_claim in rendered

    dumped = decoded.model_dump()
    dumped_json = json.loads(decoded.model_dump_json(by_alias=True))
    assert decoded.internal_api_key == unknown_claim
    assert dumped["internal_api_key"] == unknown_claim
    assert dumped_json["internal_api_key"] == unknown_claim
    assert dumped_json["https://hasura.io/jwt/claims"] == claims

    round_tripped = DecodedToken.model_validate(dumped_json)
    assert round_tripped.model_extra == {"internal_api_key": unknown_claim}
    assert round_tripped.internal_api_key == unknown_claim


def test_custom_service_urls_are_normalized() -> None:
    assert generate_service_url("auth", custom_url="https://auth.example/v1/") == (
        "https://auth.example/v1"
    )
    assert generate_service_url("storage", custom_url="https://storage.example/v1///") == (
        "https://storage.example/v1"
    )
    assert generate_service_url("graphql", custom_url="https://graphql.example/") == (
        "https://graphql.example"
    )
    assert generate_service_url("functions", custom_url="https://functions.example") == (
        "https://functions.example"
    )


async def test_trailing_slash_auth_url_stores_session_without_double_slash() -> None:
    paths: list[str] = []
    replacement_access_token = make_jwt()

    def handler(request: httpx.Request) -> httpx.Response:
        paths.append(request.url.path)
        return httpx.Response(200, content=session_payload_bytes(replacement_access_token))

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        nhost = create_client(
            NhostClientOptions(
                auth_url="https://auth.example/v1/",
                storage=MemoryStorage(),
                http_client=http,
            )
        )
        await nhost.auth.sign_in_email_password(
            SignInEmailPasswordRequest(email="ada@example.com", password="secret")
        )
        stored = nhost.get_user_session()

    assert paths == ["/v1/signin/email-password"]
    assert stored is not None
    assert stored.access_token == replacement_access_token


@pytest.mark.parametrize(
    "path",
    ["/signout", "/signin/custom", "/token", "/user/password"],
)
async def test_session_response_ignores_functions_origin(path: str) -> None:
    replacement_access_token = make_jwt()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=raw_session_bytes(replacement_access_token))

    session_storage = SessionStorage(MemoryStorage())
    original = _seed_session(session_storage)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        fetch = create_enhanced_fetch(
            http,
            [update_session_from_response_middleware(session_storage, "https://auth.example/v1")],
        )
        request = http.build_request("POST", f"https://functions.example/v1{path}")
        await fetch(request)

    assert session_storage.get() == original


@pytest.mark.parametrize(
    ("path", "stores_session"),
    [
        ("/signout", False),
        ("/signin/custom", True),
        ("/token", True),
        ("/user/password", False),
    ],
)
async def test_session_response_handles_auth_origin(path: str, stores_session: bool) -> None:
    replacement_access_token = make_jwt()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=raw_session_bytes(replacement_access_token))

    session_storage = SessionStorage(MemoryStorage())
    _seed_session(session_storage)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        fetch = create_enhanced_fetch(
            http,
            [update_session_from_response_middleware(session_storage, "HTTPS://AUTH.EXAMPLE/v1")],
        )
        request = http.build_request("POST", f"https://auth.example/v1{path}")
        await fetch(request)

    stored = session_storage.get()
    if stores_session:
        assert stored is not None
        assert stored.access_token == replacement_access_token
        assert stored.refresh_token == "new-refresh-token"
    else:
        assert stored is None


@pytest.mark.parametrize(
    "path",
    ["/v1/functions/signout", "/v1/functions/token"],
)
async def test_session_response_ignores_nested_non_auth_path(path: str) -> None:
    replacement_access_token = make_jwt()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=raw_session_bytes(replacement_access_token))

    session_storage = SessionStorage(MemoryStorage())
    original = _seed_session(session_storage)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        fetch = create_enhanced_fetch(
            http,
            [update_session_from_response_middleware(session_storage, "https://host.example/v1")],
        )
        await fetch(http.build_request("POST", f"https://host.example{path}"))

    assert session_storage.get() == original


async def test_session_response_ignores_scheme_mismatch() -> None:
    replacement_access_token = make_jwt()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=raw_session_bytes(replacement_access_token))

    session_storage = SessionStorage(MemoryStorage())
    original = _seed_session(session_storage)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        fetch = create_enhanced_fetch(
            http,
            [update_session_from_response_middleware(session_storage, "https://auth.example/v1")],
        )
        await fetch(http.build_request("POST", "http://auth.example/v1/token"))

    assert session_storage.get() == original


async def test_unsuccessful_auth_response_does_not_update_session() -> None:
    replacement_access_token = make_jwt()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, content=raw_session_bytes(replacement_access_token))

    session_storage = SessionStorage(MemoryStorage())
    original = _seed_session(session_storage)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        fetch = create_enhanced_fetch(
            http,
            [
                update_session_from_response_middleware(
                    session_storage, "https://auth.example/v1/auth"
                )
            ],
        )
        request = http.build_request("POST", "https://auth.example/v1/auth/token")
        await fetch(request)

    assert session_storage.get() == original


async def test_subpath_auth_refresh_completes_once() -> None:
    calls: list[tuple[str, str]] = []
    refreshed_access_token = make_jwt()

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append((request.method, request.url.path))
        if request.url.path == "/v1/auth/token":
            return httpx.Response(200, content=raw_session_bytes(refreshed_access_token))
        return httpx.Response(200, json={"ok": True})

    backend = MemoryStorage()
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        nhost = create_client(
            NhostClientOptions(
                auth_url="http://localhost:1337/v1/auth",
                functions_url="http://localhost:1337/v1/functions",
                storage=backend,
                http_client=http,
            )
        )
        _seed_session(nhost.session_storage, exp_offset_seconds=-10)
        await asyncio.wait_for(nhost.functions.post("/hello"), timeout=1)

    assert calls.count(("POST", "/v1/auth/token")) == 1


async def test_functions_token_path_still_triggers_auth_refresh() -> None:
    calls: list[tuple[str, str]] = []
    refreshed_access_token = make_jwt()

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append((request.url.host, request.url.path))
        if request.url.host == "auth.example":
            return httpx.Response(200, content=raw_session_bytes(refreshed_access_token))
        return httpx.Response(200, json={"ok": True})

    backend = MemoryStorage()
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        nhost = create_client(
            NhostClientOptions(
                auth_url="https://auth.example/v1",
                functions_url="https://functions.example/v1",
                storage=backend,
                http_client=http,
            )
        )
        _seed_session(nhost.session_storage, exp_offset_seconds=5)
        await nhost.functions.post("/token")

    assert calls.count(("auth.example", "/v1/token")) == 1
    assert ("functions.example", "/v1/token") in calls


async def test_reentrant_refresh_returns_without_deadlock() -> None:
    calls: list[str] = []
    refreshed_access_token = make_jwt()

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.path)
        return httpx.Response(200, content=raw_session_bytes(refreshed_access_token))

    session_storage = SessionStorage(MemoryStorage())
    _seed_session(session_storage, exp_offset_seconds=-10)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        differently_scoped_auth = create_api_client("https://different.example/v1", [], http)
        reentrant_auth = create_api_client(
            "https://auth.example/v1/auth",
            [session_refresh_middleware(differently_scoped_auth, session_storage)],
            http,
        )
        result = await asyncio.wait_for(refresh_session(reentrant_auth, session_storage), timeout=1)

    assert result is not None
    assert result.access_token == refreshed_access_token
    assert calls == ["/v1/auth/token"]


async def test_expired_reentrant_refresh_returns_none() -> None:
    reentry_results: list[StoredSession | None] = []
    refreshed_access_token = make_jwt()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=raw_session_bytes(refreshed_access_token))

    session_storage = SessionStorage(MemoryStorage())
    _seed_session(session_storage, exp_offset_seconds=-10)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        bare_auth = create_api_client("https://bare-auth.example/v1", [], http)

        def reenter(next_fetch: FetchFunction) -> FetchFunction:
            async def fetch(request: httpx.Request) -> httpx.Response:
                reentry_results.append(await refresh_session(bare_auth, session_storage))
                return await next_fetch(request)

            return fetch

        reentrant_auth = create_api_client("https://auth.example/v1", [reenter], http)
        refreshed = await refresh_session(reentrant_auth, session_storage)

    assert reentry_results == [None]
    assert refreshed is not None
    assert refreshed.access_token == refreshed_access_token


def _user_with_metadata(metadata: dict | None) -> User:
    return User(
        avatar_url="",
        created_at="2026-01-01T00:00:00Z",
        default_role="user",
        display_name="Ada",
        email="ada@example.com",
        email_verified=True,
        id="user-123",
        is_anonymous=False,
        locale="en",
        metadata=metadata,
        phone_number_verified=False,
        roles=["user"],
    )


def _stored_session(refresh_token: str) -> StoredSession:
    return to_stored_session(
        Session(
            access_token=make_jwt(),
            access_token_expires_in=3600,
            refresh_token=refresh_token,
            refresh_token_id="rid",
            user=_user_with_metadata(None),
        )
    )


def test_file_storage_roundtrips_session_with_null_metadata(tmp_path) -> None:
    # User.metadata is required-but-nullable; exclude_none would drop it and make
    # reload validation fail, silently deleting the session file.
    path = tmp_path / "private" / "session.json"
    storage = FileStorage(path)

    previous_umask = os.umask(0)
    try:
        storage.set(_stored_session("r"))
    finally:
        os.umask(previous_umask)
    reloaded = storage.get()

    assert reloaded is not None
    assert isinstance(reloaded, StoredSession)
    assert reloaded.user is not None
    assert reloaded.user.metadata is None
    assert stat.S_IMODE(path.stat().st_mode) == OWNER_ONLY_FILE_MODE
    assert stat.S_IMODE(path.parent.stat().st_mode) == PRIVATE_DIRECTORY_MODE


def test_file_storage_replaces_existing_file_with_owner_only_permissions(tmp_path) -> None:
    path = tmp_path / "existing" / "session.json"
    path.parent.mkdir(mode=EXISTING_DIRECTORY_MODE)
    path.parent.chmod(EXISTING_DIRECTORY_MODE)
    path.write_text(_stored_session("old").model_dump_json(by_alias=True), encoding="utf-8")
    path.chmod(stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP | stat.S_IROTH)

    FileStorage(path).set(_stored_session("new"))
    reloaded = FileStorage(path).get()

    assert reloaded is not None
    assert reloaded.refresh_token == "new"
    assert stat.S_IMODE(path.stat().st_mode) == OWNER_ONLY_FILE_MODE
    assert stat.S_IMODE(path.parent.stat().st_mode) == EXISTING_DIRECTORY_MODE


def test_file_storage_failed_atomic_replace_preserves_original(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = tmp_path / "session.json"
    storage = FileStorage(path)
    storage.set(_stored_session("original"))
    original_payload = path.read_bytes()
    replace_calls: list[tuple[object, object]] = []

    def fail_replace(source: object, destination: object) -> None:
        replace_calls.append((source, destination))
        raise OSError("simulated atomic replace failure")

    monkeypatch.setattr(storage_backend.os, "replace", fail_replace)

    with pytest.raises(OSError, match="simulated atomic replace failure"):
        storage.set(_stored_session("replacement"))

    assert len(replace_calls) == 1
    temporary_path, destination = (Path(value) for value in replace_calls[0])
    assert temporary_path.parent == path.parent
    assert destination == path
    assert path.read_bytes() == original_payload
    assert storage.get() is not None
    assert [child.name for child in path.parent.iterdir()] == [path.name]


def test_create_client_does_not_mutate_shared_options() -> None:
    opts = NhostClientOptions(subdomain="demo", region="eu-central-1")
    original_configure = opts.configure

    create_client(opts)
    create_client(opts)

    # The factory must not mutate the caller's options in place, so reusing the
    # same options object does not accumulate duplicate middleware.
    assert opts.configure is original_configure
    assert opts.configure == []


async def test_replace_file_sends_file_as_multipart_file_part() -> None:
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["content_type"] = request.headers.get("content-type", "")
        captured["content"] = request.content
        return httpx.Response(
            200,
            json={
                "id": "file-1",
                "name": "hello.txt",
                "size": 3,
                "bucketId": "default",
                "etag": '"abc"',
                "createdAt": "2026-01-01T00:00:00Z",
                "updatedAt": "2026-01-01T00:00:00Z",
                "isUploaded": True,
                "mimeType": "text/plain",
            },
        )

    async with build_client(handler) as nhost:
        await nhost.storage.replace_file("file-1", ReplaceFileBody(file=b"abc"))

    assert captured["content_type"].startswith("multipart/form-data")
    body = captured["content"]
    # The binary payload must be a file part (has filename=) so Go's ReadForm
    # classifies it under form.File, not a plain form value.
    assert b'name="file"; filename=' in body
    assert b"abc" in body


async def test_upload_file_carries_filename_via_uploadfile() -> None:
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["content"] = request.content
        return httpx.Response(201, json={"processedFiles": []})

    async with build_client(handler) as nhost:
        await nhost.storage.upload_files(
            UploadFilesBody(file=[UploadFile(filename="photo.png", content=b"img")])
        )

    body = captured["content"]
    # An UploadFile threads its filename into the multipart Content-Disposition.
    assert b'filename="photo.png"' in body
    assert b"img" in body


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
