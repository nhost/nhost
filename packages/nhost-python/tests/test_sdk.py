"""Unit tests for the Nhost Python SDK using an httpx mock transport.

No network I/O: an ``httpx.MockTransport`` intercepts every request so we can
assert on request shape (aliases, headers, multipart) and drive responses.
"""

from __future__ import annotations

import asyncio
import base64
import gc
import inspect
import json
import logging
import os
import re
import socket
import stat
import threading
import time
import weakref
from collections.abc import Callable, Coroutine
from dataclasses import dataclass
from datetime import UTC, date, datetime
from datetime import time as datetime_time
from decimal import Decimal
from enum import Enum
from pathlib import Path
from typing import Any
from uuid import UUID

import httpx
import pytest
from pydantic import AnyUrl, BaseModel, ConfigDict, Field

import nhost.session.refresh as refresh_module
from nhost import (
    FileStorage,
    GraphQLExecutionError,
    HTTPError,
    MemoryStorage,
    NhostClient,
    SessionStorageBackend,
    SessionStorageError,
    UploadFile,
    create_client,
    create_nhost_client,
    create_server_client,
    generate_service_url,
    with_admin_session,
    with_chain_functions,
)
from nhost.auth import (
    Client as AuthClient,
)
from nhost.auth import (
    Oauth2AuthorizeParams,
    OptionsRedirectTo,
    Session,
    SignInEmailPasswordRequest,
    SignInProviderParams,
    SignUpEmailPasswordRequest,
    SignUpProviderParams,
    User,
    VerifyTicketParams,
    create_api_client,
    generate_code_challenge,
    generate_code_verifier,
    generate_pkce_pair,
)
from nhost.fetch import (
    AdminSessionOptions,
    FetchFunction,
    NhostError,
    ResponseDecodeError,
    create_enhanced_fetch,
    to_jsonable,
)
from nhost.fetch.middleware import (
    _extract_session,
    session_refresh_middleware,
    update_session_from_response_middleware,
    with_admin_session_middleware,
    with_headers_middleware,
    with_role_middleware,
)
from nhost.functions import Client as FunctionsClient
from nhost.graphql import Client as GraphQLClient
from nhost.session import (
    DecodedToken,
    SessionStorage,
    StoredSession,
    decode_user_session,
    refresh_session,
)
from nhost.session.session import to_stored_session
from nhost.storage import Client as StorageClient
from nhost.storage import ReplaceFileBody, UploadFileMetadata, UploadFilesBody

OWNER_ONLY_FILE_MODE = stat.S_IRUSR | stat.S_IWUSR
PRIVATE_DIRECTORY_MODE = stat.S_IRWXU
EXISTING_DIRECTORY_MODE = stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP
DEFAULT_HTTP_TIMEOUT_VALUES = (10.0, 300.0, 300.0, 60.0)
EXPLICIT_HTTP_TIMEOUT_VALUES = (2.0, 120.0, 180.0, 15.0)


def make_jwt(
    exp_offset_seconds: int | None = 3600,
    *,
    claims: dict[str, Any] | None = None,
) -> str:
    def seg(obj: dict[str, Any]) -> str:
        raw = json.dumps(obj, separators=(",", ":")).encode()
        return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()

    header = seg({"alg": "HS256", "typ": "JWT"})
    payload_claims = (
        claims
        if claims is not None
        else {
            "sub": "user-123",
            "iat": int(time.time()),
            "https://hasura.io/jwt/claims": {
                "x-hasura-default-role": "user",
                "x-hasura-allowed-roles": "{user,me}",
            },
        }
    )
    if claims is None and exp_offset_seconds is not None:
        payload_claims["exp"] = int(time.time()) + exp_offset_seconds
    payload = seg(payload_claims)
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


def build_client(
    handler: Callable[[httpx.Request], httpx.Response]
    | Callable[[httpx.Request], Coroutine[None, None, httpx.Response]],
    backend: SessionStorageBackend | None = None,
) -> NhostClient:
    transport = httpx.MockTransport(handler)
    http = httpx.AsyncClient(transport=transport)
    return create_client(
        subdomain="demo",
        region="eu-central-1",
        session_storage=backend or MemoryStorage(),
        http_client=http,
    )


def test_decode_user_session_parses_claims_and_arrays() -> None:
    decoded = decode_user_session(make_jwt())
    assert decoded.sub == "user-123"
    assert decoded.exp is not None
    assert decoded.hasura_claims is not None
    assert decoded.hasura_claims["x-hasura-default-role"] == "user"
    # PostgreSQL array literal is expanded into a list.
    assert decoded.hasura_claims["x-hasura-allowed-roles"] == ["user", "me"]


@pytest.mark.parametrize("token", ["not-a-jwt", "only.two", "", "a..c"])
def test_decode_user_session_rejects_invalid_token_format(token: str) -> None:
    with pytest.raises(ValueError, match="Invalid access token format"):
        decode_user_session(token)


def test_decode_user_session_accepts_base64url_payload() -> None:
    avatar_url = "https://lh3.googleusercontent.com/a/ACg8ocLv_IKZLRBq7-xKP3BxhGvJnQzXYs96?sz=200"
    token = make_jwt(
        claims={
            "sub": "f5765cb0-5b62-4fc0-b1a5-3e8e12345678",
            "https://hasura.io/jwt/claims": {"x-hasura-avatar-url": avatar_url},
        }
    )
    encoded_payload = token.split(".")[1]
    assert "-" in encoded_payload or "_" in encoded_payload

    decoded = decode_user_session(token)

    assert decoded.sub == "f5765cb0-5b62-4fc0-b1a5-3e8e12345678"
    assert decoded.hasura_claims is not None
    assert decoded.hasura_claims["x-hasura-avatar-url"] == avatar_url


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("{}", []),
        ('{"uuid-a","uuid-b"}', ["uuid-a", "uuid-b"]),
        ("plain-value", "plain-value"),
    ],
)
def test_decode_user_session_normalizes_hasura_claim_values(
    value: str, expected: str | list[str]
) -> None:
    token = make_jwt(claims={"https://hasura.io/jwt/claims": {"x-hasura-allowed-roles": value}})

    decoded = decode_user_session(token)

    assert decoded.hasura_claims is not None
    assert decoded.hasura_claims["x-hasura-allowed-roles"] == expected


@pytest.mark.parametrize("payload", [None, [], "claims", 42])
def test_decode_user_session_rejects_non_object_payload(payload: object) -> None:
    encoded_payload = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()

    with pytest.raises(ValueError, match="expected a JSON object"):
        decode_user_session(f"header.{encoded_payload}.signature")


async def test_generated_auth_signup_roundtrip() -> None:
    seen: dict[str, Any] = {}
    token = make_jwt()

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["content_type"] = request.headers.get("content-type")
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, content=session_payload_bytes(token))

    async with build_client(handler) as nhost:
        resp = await nhost.auth.sign_up_email_password(
            body=SignUpEmailPasswordRequest(email="ada@example.com", password="secret-pw")
        )

    assert resp.status == httpx.codes.OK
    assert resp.body.session is not None
    assert resp.body.session.access_token == token
    # Request body must use wire aliases, not python field names.
    assert seen["body"] == {"email": "ada@example.com", "password": "secret-pw"}
    assert "application/json" in seen["content_type"]
    assert seen["url"].endswith("/signup/email-password")


async def test_generated_auth_raises_for_redirect_response() -> None:
    location = "https://auth-proxy.example/maintenance"

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(httpx.codes.FOUND, headers={"Location": location})

    async with build_client(handler) as nhost:
        with pytest.raises(HTTPError) as raised:
            await nhost.auth.sign_in_email_password(
                body=SignInEmailPasswordRequest(email="ada@example.com", password="secret-pw")
            )

    assert raised.value.status == httpx.codes.FOUND
    assert raised.value.headers["Location"] == location
    assert raised.value.body == ""


async def test_generated_auth_error_preserves_decoded_response() -> None:
    error_body = {
        "error": "invalid-email-password",
        "message": "Incorrect email or password",
        "status": 401,
    }

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(httpx.codes.UNAUTHORIZED, json=error_body)

    async with build_client(handler) as nhost:
        with pytest.raises(HTTPError) as raised:
            await nhost.auth.sign_in_email_password(
                body=SignInEmailPasswordRequest(
                    email="ada@example.com", password="incorrect-password"
                )
            )

    assert raised.value.status == httpx.codes.UNAUTHORIZED
    assert raised.value.body["error"] == "invalid-email-password"
    assert str(raised.value) == "Incorrect email or password"


async def test_generated_storage_error_preserves_decoded_response() -> None:
    error_body = {"error": {"message": "File not found"}, "status": 404}

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(httpx.codes.NOT_FOUND, json=error_body)

    async with build_client(handler) as nhost:
        with pytest.raises(HTTPError) as raised:
            await nhost.storage.delete_file("missing-file")

    assert raised.value.status == httpx.codes.NOT_FOUND
    assert raised.value.body == error_body
    assert str(raised.value) == "File not found"


async def test_generated_client_error_uses_non_json_text_fallback() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            httpx.codes.SERVICE_UNAVAILABLE,
            text="upstream unavailable",
            headers={"content-type": "text/plain"},
        )

    async with build_client(handler) as nhost:
        with pytest.raises(HTTPError) as raised:
            await nhost.auth.get_jwks()

    assert raised.value.status == httpx.codes.SERVICE_UNAVAILABLE
    assert raised.value.body == "upstream unavailable"
    assert str(raised.value) == "upstream unavailable"


async def test_generated_client_invalid_success_response_raises_decode_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            httpx.codes.OK,
            text="not json",
            headers={"content-type": "application/json"},
        )

    async with build_client(handler) as nhost:
        with pytest.raises(ResponseDecodeError) as raised:
            await nhost.auth.get_jwks()

    assert raised.value.response.status_code == httpx.codes.OK
    assert raised.value.expected_type is not None
    assert raised.value.request.url.path.endswith("/.well-known/jwks.json")


@pytest.mark.parametrize(
    "redirect_to",
    [
        "https://my-app.com",
        "http://localhost:3000?next=%2Fa",
        "/dashboard",
        "https://a.com/x?y=1#frag",
    ],
)
def test_generated_redirect_values_roundtrip_unchanged(redirect_to: str) -> None:
    options = OptionsRedirectTo(redirect_to=redirect_to)

    assert options.redirect_to == redirect_to
    assert to_jsonable(options) == {"redirectTo": redirect_to}


async def test_redirect_returning_auth_operations_remain_url_builders() -> None:
    redirect_to = "https://my-app.com"

    def reject_network_request(request: httpx.Request) -> httpx.Response:
        raise AssertionError(f"URL builder unexpectedly sent {request.method} {request.url}")

    async with httpx.AsyncClient(transport=httpx.MockTransport(reject_network_request)) as http:
        auth = AuthClient("https://auth.example/v1", http_client=http)

        sign_in_url = auth.sign_in_provider_url(
            "github", params=SignInProviderParams(redirect_to=redirect_to)
        )
        sign_up_url = auth.sign_up_provider_url(
            "github", params=SignUpProviderParams(redirect_to=redirect_to)
        )
        verify_url = auth.verify_ticket_url(
            params=VerifyTicketParams(ticket="verifyEmail:ticket", redirect_to="/dashboard")
        )
        authorize_url = auth.oauth2_authorize_url(
            params=Oauth2AuthorizeParams(
                client_id="client-id",
                redirect_uri=redirect_to,
                response_type="code",
            )
        )
        authorize_post_url = auth.oauth2_authorize_post_url()

    assert httpx.URL(sign_in_url).params["redirectTo"] == redirect_to
    assert httpx.URL(sign_up_url).params["redirectTo"] == redirect_to
    assert httpx.URL(verify_url).params["redirectTo"] == "/dashboard"
    assert httpx.URL(authorize_url).params["redirect_uri"] == redirect_to
    assert authorize_post_url == "https://auth.example/v1/oauth2/authorize"


async def test_signup_response_is_captured_into_session_storage() -> None:
    token = make_jwt()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=session_payload_bytes(token))

    async with build_client(handler) as nhost:
        await nhost.auth.sign_up_email_password(
            body=SignUpEmailPasswordRequest(email="ada@example.com", password="secret-pw")
        )
        stored = await nhost.get_user_session()

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


@pytest.mark.parametrize(
    ("service_url", "request_url", "allow_insecure_http", "should_send"),
    [
        ("http://internal-host/v1/graphql", "http://internal-host/v1/graphql", False, False),
        ("https://graphql.example/v1", "https://graphql.example/v1", False, True),
        ("http://127.0.0.1:1337/v1", "http://127.0.0.1:1337/v1", False, True),
        ("http://internal-host/v1", "http://internal-host/v1", True, True),
        ("https://graphql.example/v1", "https://storage.example/v1", False, False),
    ],
)
async def test_admin_session_respects_origin_and_transport_security(
    service_url: str,
    request_url: str,
    allow_insecure_http: bool,
    should_send: bool,
    caplog: pytest.LogCaptureFixture,
) -> None:
    captured: dict[str, str | None] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["secret"] = request.headers.get("x-hasura-admin-secret")
        captured["role"] = request.headers.get("x-hasura-role")
        captured["user_id"] = request.headers.get("x-hasura-user-id")
        return httpx.Response(200, json={})

    options = AdminSessionOptions(
        admin_secret="ADMIN-SECRET-XYZ",
        role="admin",
        session_variables={"user-id": "user-123"},
        allow_insecure_http=allow_insecure_http,
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        fetch = create_enhanced_fetch(http, [with_admin_session_middleware(options, service_url)])
        with caplog.at_level(logging.WARNING, logger="nhost.fetch"):
            await fetch(http.build_request("POST", request_url))

    warnings = [
        record
        for record in caplog.records
        if record.name == "nhost.fetch"
        and record.message == "admin session headers withheld from request"
    ]
    if should_send:
        assert captured == {
            "secret": "ADMIN-SECRET-XYZ",
            "role": "admin",
            "user_id": "user-123",
        }
        assert warnings == []
    else:
        assert captured == {"secret": None, "role": None, "user_id": None}
        assert len(warnings) == 1


async def test_enhanced_fetch_disables_caller_redirect_following() -> None:
    requests: list[tuple[str, str | None]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append((str(request.url), request.headers.get("x-hasura-admin-secret")))
        if request.url.host == "graphql.example":
            return httpx.Response(302, headers={"location": "https://untrusted.example/capture"})
        return httpx.Response(200, json={})

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handler), follow_redirects=True
    ) as http:
        fetch = create_enhanced_fetch(http)
        response = await fetch(
            http.build_request(
                "POST",
                "https://graphql.example/v1",
                headers={"x-hasura-admin-secret": "ADMIN-SECRET-XYZ"},
            )
        )

    assert response.status_code == httpx.codes.FOUND
    assert requests == [("https://graphql.example/v1", "ADMIN-SECRET-XYZ")]


async def test_admin_session_uses_each_service_origin() -> None:
    captured: list[tuple[str, str | None]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append((request.url.host, request.headers.get("x-hasura-admin-secret")))
        return httpx.Response(200, json={})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        nhost = create_nhost_client(
            storage_url="https://storage.example/v1",
            graphql_url="https://graphql.example/v1",
            functions_url="https://functions.example/v1",
            http_client=http,
            configure=[with_admin_session(AdminSessionOptions("service-secret"))],
        )
        await nhost.storage._fetch(http.build_request("GET", "https://storage.example/v1"))
        await nhost.graphql._fetch(http.build_request("GET", "https://graphql.example/v1"))
        await nhost.functions._fetch(http.build_request("GET", "https://functions.example/v1"))
        await nhost.storage._fetch(http.build_request("GET", "https://graphql.example/v1"))

    assert captured == [
        ("storage.example", "service-secret"),
        ("graphql.example", "service-secret"),
        ("functions.example", "service-secret"),
        ("graphql.example", None),
    ]


async def test_access_token_attached_to_graphql_request() -> None:
    token = make_jwt()
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["auth"] = request.headers.get("authorization")
        return httpx.Response(200, json={"data": {"__typename": "query_root"}})

    backend = MemoryStorage()
    async with build_client(handler, backend) as nhost:
        await nhost.session_storage.set(
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


async def test_access_token_is_scoped_to_each_service_origin() -> None:
    captured: list[tuple[str, str | None]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append((request.url.host, request.headers.get("authorization")))
        return httpx.Response(200, json={})

    backend = MemoryStorage()
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        nhost = create_client(
            auth_url="https://auth.example/v1",
            storage_url="https://storage.example/v1",
            graphql_url="https://graphql.example/v1",
            functions_url="https://functions.example/v1",
            session_storage=backend,
            http_client=http,
        )
        session = await _seed_session(nhost.session_storage)
        await nhost.auth._fetch(http.build_request("GET", "https://auth.example/v1/user"))
        await nhost.storage._fetch(http.build_request("GET", "https://storage.example/v1/files"))
        await nhost.graphql._fetch(http.build_request("POST", "https://graphql.example/v1"))
        await nhost.functions._fetch(
            http.build_request("POST", "https://functions.example/v1/echo")
        )
        await nhost.graphql._fetch(http.build_request("POST", "https://untrusted.example/capture"))

    authorization = f"Bearer {session.access_token}"
    assert captured == [
        ("auth.example", authorization),
        ("storage.example", authorization),
        ("graphql.example", authorization),
        ("functions.example", authorization),
        ("untrusted.example", None),
    ]


async def test_access_token_scope_strips_only_the_stored_token_off_origin() -> None:
    captured: list[str | None] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request.headers.get("authorization"))
        return httpx.Response(200, json={})

    backend = MemoryStorage()
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        nhost = create_client(
            graphql_url="https://graphql.example/v1",
            session_storage=backend,
            http_client=http,
        )
        session = await _seed_session(nhost.session_storage)
        await nhost.graphql._fetch(
            http.build_request(
                "POST",
                "https://untrusted.example/capture",
                headers={"Authorization": f"Bearer {session.access_token}"},
            )
        )
        await nhost.graphql._fetch(
            http.build_request(
                "POST",
                "https://untrusted.example/capture",
                headers={"Authorization": "Bearer caller-token"},
            )
        )

    assert captured == [None, "Bearer caller-token"]


async def test_access_token_is_withheld_after_custom_middleware_changes_origin() -> None:
    captured: list[tuple[str, str | None]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append((request.url.host, request.headers.get("authorization")))
        return httpx.Response(200, json={"data": {}})

    def rewrite_origin(next_fetch: FetchFunction) -> FetchFunction:
        async def fetch(request: httpx.Request) -> httpx.Response:
            request.url = request.url.copy_with(host="untrusted.example")
            return await next_fetch(request)

        return fetch

    backend = MemoryStorage()
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        nhost = create_client(
            graphql_url="https://graphql.example/v1",
            session_storage=backend,
            http_client=http,
            configure=[with_chain_functions([rewrite_origin])],
        )
        await _seed_session(nhost.session_storage)
        await nhost.graphql.request("query { __typename }")

    assert captured == [("untrusted.example", None)]


async def test_existing_authorization_header_is_preserved() -> None:
    token = make_jwt()
    captured: list[str | None] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request.headers.get("authorization"))
        return httpx.Response(200, json={"data": None})

    backend = MemoryStorage()
    async with build_client(handler, backend) as nhost:
        await nhost.session_storage.set(
            Session(
                access_token=token,
                access_token_expires_in=3600,
                refresh_token="r",
                refresh_token_id="rid",
                user=None,
            )
        )
        await nhost.graphql.request(
            "query { __typename }", headers={"Authorization": "Bearer caller-token"}
        )

    assert captured == ["Bearer caller-token"]


async def test_role_middleware_preserves_request_value() -> None:
    captured: list[str | None] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request.headers.get("x-hasura-role"))
        return httpx.Response(200, json={})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        fetch = create_enhanced_fetch(http, [with_role_middleware("default-role")])
        await fetch(http.build_request("GET", "https://graphql.example/v1"))
        await fetch(
            http.build_request(
                "GET",
                "https://graphql.example/v1",
                headers={"x-hasura-role": "request-role"},
            )
        )

    assert captured == ["default-role", "request-role"]


async def test_headers_middleware_preserves_request_value() -> None:
    captured: list[str | None] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request.headers.get("x-client-name"))
        return httpx.Response(200, json={})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        fetch = create_enhanced_fetch(
            http, [with_headers_middleware({"x-client-name": "default-client"})]
        )
        await fetch(http.build_request("GET", "https://graphql.example/v1"))
        await fetch(
            http.build_request(
                "GET",
                "https://graphql.example/v1",
                headers={"x-client-name": "request-client"},
            )
        )

    assert captured == ["default-client", "request-client"]


async def test_graphql_errors_raise_graphql_execution_error() -> None:
    error_body = {"errors": [{"message": "field not found"}]}

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=error_body)

    async with build_client(handler) as nhost:
        with pytest.raises(GraphQLExecutionError) as exc:
            await nhost.graphql.request("query { nope }")

    assert exc.value.response.status_code == httpx.codes.OK
    assert exc.value.errors[0].message == "field not found"
    assert str(exc.value) == "field not found"


async def test_graphql_non_graphql_http_error_raises() -> None:
    error_body = {"message": "Malformed Authorization header"}

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json=error_body)

    async with build_client(handler) as nhost:
        with pytest.raises(HTTPError) as exc:
            await nhost.graphql.request("query { __typename }")

    assert exc.value.status == httpx.codes.UNAUTHORIZED
    assert exc.value.body == error_body
    assert exc.value.response.request.url == "https://demo.graphql.eu-central-1.nhost.run/v1"
    assert exc.value.request is exc.value.response.request
    assert str(exc.value) == "Malformed Authorization header"


async def test_graphql_errors_take_precedence_over_http_status() -> None:
    error_body = {"errors": [{"message": "validation failed", "extensions": {"code": "bad"}}]}

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(422, json=error_body)

    async with build_client(handler) as nhost:
        with pytest.raises(GraphQLExecutionError) as exc:
            await nhost.graphql.request("query { nope }")

    assert exc.value.response.status_code == httpx.codes.UNPROCESSABLE_ENTITY
    assert exc.value.errors[0].extensions == {"code": "bad"}
    assert str(exc.value) == "validation failed"


async def test_graphql_non_json_http_error_raises_fetch_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(502, text="<html>bad gateway</html>")

    async with build_client(handler) as nhost:
        with pytest.raises(HTTPError) as exc:
            await nhost.graphql.request("query { __typename }")

    assert exc.value.status == httpx.codes.BAD_GATEWAY
    assert exc.value.body == "<html>bad gateway</html>"


@pytest.mark.parametrize(
    ("body", "content_type"),
    [
        (b"not json", "application/json"),
        (b"[1, 2, 3]", "application/json"),
    ],
)
async def test_graphql_invalid_success_response_raises_decode_error(
    body: bytes, content_type: str
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            httpx.codes.OK,
            content=body,
            headers={"content-type": content_type},
        )

    async with build_client(handler) as nhost:
        with pytest.raises(ResponseDecodeError) as raised:
            await nhost.graphql.request("query { __typename }")

    assert raised.value.response.status_code == httpx.codes.OK
    assert raised.value.request.url == "https://demo.graphql.eu-central-1.nhost.run/v1"


async def test_graphql_invalid_typed_data_raises_decode_error() -> None:
    class Viewer(BaseModel):
        id: str

    class QueryData(BaseModel):
        viewer: Viewer

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(httpx.codes.OK, json={"data": {"viewer": {"id": 5}}})

    async with build_client(handler) as nhost:
        with pytest.raises(ResponseDecodeError) as raised:
            await nhost.graphql.request("query { viewer { id } }", response_type=QueryData)

    assert raised.value.expected_type is QueryData
    assert raised.value.response.status_code == httpx.codes.OK


async def test_graphql_validates_typed_response_data() -> None:
    class Viewer(BaseModel):
        id: str

    class QueryData(BaseModel):
        viewer: Viewer

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"data": {"viewer": {"id": "user-1"}}})

    async with build_client(handler) as nhost:
        response = await nhost.graphql.request("query { viewer { id } }", response_type=QueryData)

    assert response.body.data is not None
    assert response.body.data.viewer.id == "user-1"


async def test_graphql_normalizes_variables_and_case_insensitive_headers() -> None:
    requests: list[httpx.Request] = []
    identifier = UUID("12345678-1234-5678-1234-567812345678")
    requested_at = datetime(2026, 9, 7, 12, 30, tzinfo=UTC)

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"data": None})

    async with build_client(handler) as nhost:
        await nhost.graphql.request(
            "query Lookup($id: uuid!, $at: timestamptz!) { item_by_pk(id: $id) { id } }",
            variables={"id": identifier, "at": requested_at},
            headers={"content-type": "application/graphql"},
        )

    assert json.loads(requests[0].content) == {
        "query": "query Lookup($id: uuid!, $at: timestamptz!) { item_by_pk(id: $id) { id } }",
        "variables": {"id": str(identifier), "at": "2026-09-07T12:30:00Z"},
    }
    content_type_headers = [
        (name, value) for name, value in requests[0].headers.raw if name.lower() == b"content-type"
    ]
    assert content_type_headers == [(b"content-type", b"application/graphql")]


def test_to_jsonable_preserves_containers_and_converts_supported_scalars() -> None:
    class State(Enum):
        READY = "ready"
        SCHEDULED = date(2026, 9, 8)

    class GeneratedLikeModel(BaseModel):
        model_config = ConfigDict(populate_by_name=True)

        created_at: datetime = Field(alias="createdAt")
        optional_note: str | None = Field(default=None, alias="optionalNote")

    identifier = UUID("12345678-1234-5678-1234-567812345678")
    created_at = datetime(2026, 9, 7, 12, 30, tzinfo=UTC)
    model = GeneratedLikeModel(created_at=created_at)

    assert to_jsonable(model) == {"createdAt": "2026-09-07T12:30:00Z"}
    assert to_jsonable([model, {"nested": (identifier, Decimal("12.3400"), State.SCHEDULED)}]) == [
        {"createdAt": "2026-09-07T12:30:00Z"},
        {"nested": [str(identifier), "12.3400", "2026-09-08"]},
    ]
    assert to_jsonable(date(2026, 9, 7)) == "2026-09-07"
    assert to_jsonable(created_at) == "2026-09-07T12:30:00Z"
    assert to_jsonable(datetime_time(12, 30, 45)) == "12:30:45"
    assert to_jsonable(identifier) == str(identifier)
    assert to_jsonable(Decimal("1.2300")) == "1.2300"
    assert to_jsonable(AnyUrl("https://example.com/path")) == "https://example.com/path"
    assert to_jsonable(State.READY) == "ready"


def test_sentinel_defaults_have_stable_repr() -> None:
    http_error_body = inspect.signature(HTTPError.from_response).parameters["body"].default
    functions_json = inspect.signature(FunctionsClient.fetch).parameters["json"].default

    assert repr(http_error_body) == "_MISSING"
    assert repr(functions_json) == "_UNSET"


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
        j = await nhost.functions.post("/json", json={"x": 1})
        t = await nhost.functions.fetch("/text")
        b = await nhost.functions.fetch("/bin")

    assert j.body == {"ok": True}
    assert t.body == "hello"
    assert b.body == b"\x00\x01"


async def test_functions_supports_explicit_json_null_and_structured_json() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json={"title": "ok"},
            headers={"content-type": "application/problem+json; charset=utf-8"},
        )

    async with build_client(handler) as nhost:
        await nhost.functions.fetch("/omitted", method="POST")
        response = await nhost.functions.fetch("/problem", method="POST", json=None)

    assert requests[0].content == b""
    assert "content-type" not in requests[0].headers
    assert requests[1].content == b"null"
    assert requests[1].headers["content-type"] == "application/json"
    assert response.body == {"title": "ok"}


async def test_functions_normalizes_models_and_case_insensitive_headers() -> None:
    class FunctionPayload(BaseModel):
        invoked_at: datetime

    requests: list[httpx.Request] = []
    invoked_at = datetime(2026, 9, 7, 12, 30, tzinfo=UTC)

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"ok": True})

    async with build_client(handler) as nhost:
        await nhost.functions.post(
            "/model",
            json=FunctionPayload(invoked_at=invoked_at),
            headers={"accept": "application/problem+json"},
        )
        await nhost.functions.fetch(
            "/null",
            method="POST",
            json=None,
            headers={"content-type": "application/merge-patch+json"},
        )

    assert json.loads(requests[0].content) == {"invoked_at": "2026-09-07T12:30:00Z"}
    accept_headers = [
        (name, value) for name, value in requests[0].headers.raw if name.lower() == b"accept"
    ]
    assert accept_headers == [(b"accept", b"application/problem+json")]
    assert requests[1].content == b"null"
    content_type_headers = [
        (name, value) for name, value in requests[1].headers.raw if name.lower() == b"content-type"
    ]
    assert content_type_headers == [(b"content-type", b"application/merge-patch+json")]


@pytest.mark.parametrize(
    ("path", "expected_url"),
    [
        ("files/100%25", b"https://x.functions.local/v1/files/100%25"),
        ("files/a%2Fb", b"https://x.functions.local/v1/files/a%2Fb"),
        ("files/a%3Fb", b"https://x.functions.local/v1/files/a%3Fb"),
        ("files/a%23b", b"https://x.functions.local/v1/files/a%23b"),
        ("echo", b"https://x.functions.local/v1/echo"),
        ("/echo", b"https://x.functions.local/v1/echo"),
        ("", b"https://x.functions.local/v1/"),
    ],
)
async def test_functions_preserves_encoded_paths_in_absolute_request_url(
    path: str, expected_url: bytes
) -> None:
    request_urls: list[bytes] = []

    def handler(request: httpx.Request) -> httpx.Response:
        request_urls.append(str(request.url).encode("ascii"))
        return httpx.Response(200, json={"ok": True})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        functions = FunctionsClient("https://x.functions.local/v1", http_client=http)
        await functions.fetch(path)

    assert request_urls == [expected_url]


@pytest.mark.parametrize(
    "path",
    ["/a/../../evil", "..", "a/../../b", "%2e%2e%2f", "..%2f"],
)
async def test_functions_rejects_paths_that_escape_the_base_path(path: str) -> None:
    request_urls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        request_urls.append(str(request.url))
        return httpx.Response(200, json={"ok": True})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        functions = FunctionsClient("https://x.functions.local/v1", http_client=http)
        with pytest.raises(ValueError, match="must not escape"):
            await functions.fetch(path)

    assert request_urls == []


async def test_functions_wraps_invalid_url_errors() -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200))
    ) as http:
        functions = FunctionsClient("https://x.functions.local/v1", http_client=http)
        with pytest.raises(NhostError, match="invalid Functions URL or path") as raised:
            await functions.fetch("\x00")

    assert isinstance(raised.value.__cause__, httpx.InvalidURL)


async def test_functions_redirect_raises_for_status_parity() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(304)

    async with build_client(handler) as nhost:
        with pytest.raises(HTTPError) as raised:
            await nhost.functions.fetch("/cached")

    assert raised.value.status == httpx.codes.NOT_MODIFIED
    assert raised.value.body == b""


async def test_functions_error_raises() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"error": "boom"})

    async with build_client(handler) as nhost:
        with pytest.raises(HTTPError) as exc:
            await nhost.functions.post("/crash")

    assert exc.value.status == httpx.codes.INTERNAL_SERVER_ERROR
    assert "boom" in str(exc.value)


@pytest.mark.parametrize(
    ("status", "expected_error"),
    [
        (httpx.codes.OK, ResponseDecodeError),
        (httpx.codes.INTERNAL_SERVER_ERROR, HTTPError),
    ],
)
async def test_functions_malformed_json_uses_status_appropriate_error(
    status: int, expected_error: type[NhostError]
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status,
            content=b"not json",
            headers={"content-type": "application/json"},
        )

    async with build_client(handler) as nhost:
        with pytest.raises(expected_error) as raised:
            await nhost.functions.post("/malformed")

    error = raised.value
    if isinstance(error, HTTPError):
        assert error.response.status_code == status
        assert error.body == "not json"
    else:
        assert isinstance(error, ResponseDecodeError)
        assert error.response.status_code == status


async def test_high_level_facades_hide_generated_wire_names() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.path.endswith("/.well-known/jwks.json"):
            return httpx.Response(200, json={"keys": []})
        return httpx.Response(201, json={"processedFiles": []})

    async with build_client(handler) as nhost:
        jwks = await nhost.auth.get_jwks()
        uploaded = await nhost.storage.upload([UploadFile(filename="hello.txt", content=b"hello")])

    assert jwks.body.keys == []
    assert uploaded.body.processed_files == []
    assert requests[1].url.path.endswith("/files")
    assert b'filename="hello.txt"' in requests[1].content


async def test_storage_multipart_upload_wire_shape() -> None:
    captured: dict[str, Any] = {}

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
            body=UploadFilesBody(
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


async def test_automatic_refresh_bypasses_user_auth_middleware_chain() -> None:
    transport_requests: list[tuple[str, str]] = []
    middleware_requests: list[tuple[str, str]] = []
    notifications: list[str | None] = []
    refreshed_access_token = make_jwt()

    class CountingMemoryStorage(MemoryStorage):
        def __init__(self) -> None:
            super().__init__()
            self.set_calls = 0

        async def set(self, value: StoredSession) -> None:
            self.set_calls += 1
            await super().set(value)

    def handler(request: httpx.Request) -> httpx.Response:
        transport_requests.append((request.method, str(request.url)))
        if request.url.path.endswith("/token"):
            return httpx.Response(200, content=raw_session_bytes(refreshed_access_token))
        return httpx.Response(200, json={"data": {"__typename": "query_root"}})

    def observe_requests(next_fetch: FetchFunction) -> FetchFunction:
        async def fetch(request: httpx.Request) -> httpx.Response:
            middleware_requests.append((request.method, str(request.url)))
            return await next_fetch(request)

        return fetch

    backend = CountingMemoryStorage()
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        nhost = create_client(
            auth_url="https://auth.example/v1",
            graphql_url="https://graphql.example/v1",
            session_storage=backend,
            http_client=http,
            configure=[with_chain_functions([observe_requests])],
        )
        await _seed_session(nhost.session_storage, exp_offset_seconds=-10)
        backend.set_calls = 0
        nhost.session_storage.on_change(
            lambda session: notifications.append(session.access_token if session else None)
        )
        await nhost.graphql.request("query { __typename }")

    assert transport_requests == [
        ("POST", "https://auth.example/v1/token"),
        ("POST", "https://graphql.example/v1"),
    ]
    assert middleware_requests == [("POST", "https://graphql.example/v1")]
    assert backend.set_calls == 1
    assert notifications == [refreshed_access_token]


async def test_explicit_refresh_bypasses_user_auth_middleware_chain() -> None:
    transport_requests: list[tuple[str, str]] = []
    middleware_requests: list[tuple[str, str]] = []
    notifications: list[str | None] = []
    refreshed_access_token = make_jwt()

    class CountingMemoryStorage(MemoryStorage):
        def __init__(self) -> None:
            super().__init__()
            self.set_calls = 0

        async def set(self, value: StoredSession) -> None:
            self.set_calls += 1
            await super().set(value)

    def handler(request: httpx.Request) -> httpx.Response:
        transport_requests.append((request.method, str(request.url)))
        return httpx.Response(200, content=raw_session_bytes(refreshed_access_token))

    def observe_requests(next_fetch: FetchFunction) -> FetchFunction:
        async def fetch(request: httpx.Request) -> httpx.Response:
            middleware_requests.append((request.method, str(request.url)))
            return await next_fetch(request)

        return fetch

    backend = CountingMemoryStorage()
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        nhost = create_server_client(
            auth_url="https://auth.example/v1",
            session_storage=backend,
            http_client=http,
            configure=[with_chain_functions([observe_requests])],
        )
        await _seed_session(nhost.session_storage, exp_offset_seconds=-10)
        backend.set_calls = 0
        nhost.session_storage.on_change(
            lambda session: notifications.append(session.access_token if session else None)
        )
        await nhost.refresh_session(margin_seconds=0)

    assert transport_requests == [("POST", "https://auth.example/v1/token")]
    assert middleware_requests == []
    assert backend.set_calls == 1
    assert notifications == [refreshed_access_token]


async def test_no_refresh_when_token_is_fresh() -> None:
    token = make_jwt(exp_offset_seconds=3600)
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.path)
        return httpx.Response(200, json={"data": None})

    backend = MemoryStorage()
    async with build_client(handler, backend) as nhost:
        await nhost.session_storage.set(
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
        await nhost.session_storage.set(
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
        stored = await nhost.get_user_session()
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
        await nhost.session_storage.set(
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
        assert await nhost.get_user_session() is None


async def _seed_session(
    storage: SessionStorage, *, exp_offset_seconds: int | None = 3600
) -> StoredSession:
    await storage.set(
        Session(
            access_token=make_jwt(exp_offset_seconds),
            access_token_expires_in=3600,
            refresh_token="original-refresh",
            refresh_token_id="original-id",
            user=None,
        )
    )
    session = await storage.get()
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
        await _seed_session(nhost.session_storage, exp_offset_seconds=-10)
        refreshed = await nhost.refresh_session(margin_seconds=0)

        assert refreshed is None
        assert token_calls == ["/v1/token", "/v1/token"]
        assert await nhost.session_storage.get() is None


async def test_forced_refresh_of_valid_session_preserves_it_on_500() -> None:
    token_calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/token"):
            token_calls.append(request.url.path)
            return httpx.Response(500, json={"message": "temporary failure"})
        return httpx.Response(200, json={"data": None})

    backend = MemoryStorage()
    async with build_client(handler, backend) as nhost:
        session = await _seed_session(nhost.session_storage)
        refreshed = await nhost.refresh_session(margin_seconds=0)

        assert refreshed is session
        assert token_calls == ["/v1/token"]
        assert await nhost.session_storage.get() is session


@pytest.mark.parametrize("failure", ["connect", "read-timeout", "dns", "redirect"])
async def test_valid_session_survives_request_failure_during_refresh(failure: str) -> None:
    token_calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal token_calls
        token_calls += 1
        if failure == "read-timeout":
            raise httpx.ReadTimeout("timed out reading refresh response", request=request)
        if failure == "dns":
            try:
                raise socket.gaierror("name resolution failed")
            except socket.gaierror as error:
                raise httpx.ConnectError("DNS lookup failed", request=request) from error
        if failure == "redirect":
            raise httpx.TooManyRedirects("too many redirects", request=request)
        raise httpx.ConnectError("connection reset", request=request)

    backend = MemoryStorage()
    async with build_client(handler, backend) as nhost:
        original = await _seed_session(nhost.session_storage)
        refreshed = await nhost.refresh_session(margin_seconds=0)

        assert refreshed is original
        assert token_calls == 1
        assert await nhost.session_storage.get() is original


async def test_request_continues_with_valid_session_after_refresh_redirect_failure() -> None:
    token_calls = 0
    graphql_authorizations: list[str | None] = []

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal token_calls
        if request.url.path.endswith("/token"):
            token_calls += 1
            raise httpx.TooManyRedirects("too many redirects", request=request)
        graphql_authorizations.append(request.headers.get("authorization"))
        return httpx.Response(200, json={"data": {"__typename": "query_root"}})

    backend = MemoryStorage()
    async with build_client(handler, backend) as nhost:
        original = await _seed_session(nhost.session_storage, exp_offset_seconds=30)
        await nhost.graphql.request("query { __typename }")

    assert token_calls == 1
    assert graphql_authorizations == [f"Bearer {original.access_token}"]


async def test_expired_session_retries_transport_failure_then_refreshes() -> None:
    token_calls = 0
    refreshed_access_token = make_jwt(exp_offset_seconds=3600)

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal token_calls
        token_calls += 1
        if token_calls == 1:
            raise httpx.ReadTimeout("timed out reading refresh response", request=request)
        return httpx.Response(200, content=raw_session_bytes(refreshed_access_token))

    backend = MemoryStorage()
    async with build_client(handler, backend) as nhost:
        await _seed_session(nhost.session_storage, exp_offset_seconds=-10)
        refreshed = await nhost.refresh_session()

        assert refreshed is not None
        assert refreshed.access_token == refreshed_access_token
        assert token_calls == 2
        assert await nhost.session_storage.get() == refreshed


async def test_expired_session_transport_failure_preserves_storage() -> None:
    token_calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal token_calls
        token_calls += 1
        raise httpx.ConnectError("connection reset", request=request)

    backend = MemoryStorage()
    async with build_client(handler, backend) as nhost:
        original = await _seed_session(nhost.session_storage, exp_offset_seconds=-10)
        refreshed = await nhost.refresh_session()

        assert refreshed is None
        assert token_calls == 2
        assert await nhost.session_storage.get() is original


async def test_refresh_middleware_propagates_unexpected_failures(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requests = 0

    async def fail_refresh(*args: object, **kwargs: object) -> None:
        raise RuntimeError("unexpected refresh invariant failure")

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal requests
        requests += 1
        return httpx.Response(200)

    monkeypatch.setattr(refresh_module, "refresh_session", fail_refresh)
    storage = SessionStorage(MemoryStorage())
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        auth = create_api_client("https://auth.example/v1", http_client=http)
        fetch = create_enhanced_fetch(http, [session_refresh_middleware(auth, storage)])
        request = http.build_request("GET", "https://graphql.example/v1")
        with pytest.raises(RuntimeError, match="unexpected refresh invariant failure"):
            await fetch(request)

    assert requests == 0


async def test_concurrent_stale_requests_refresh_once() -> None:
    request_count = 5
    token_calls = 0
    graphql_authorizations: list[str | None] = []
    refresh_started = asyncio.Event()
    allow_refresh = asyncio.Event()
    refreshed_access_token = make_jwt(exp_offset_seconds=3600)

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal token_calls
        if request.url.path.endswith("/token"):
            token_calls += 1
            refresh_started.set()
            await allow_refresh.wait()
            return httpx.Response(200, content=raw_session_bytes(refreshed_access_token))
        graphql_authorizations.append(request.headers.get("authorization"))
        return httpx.Response(200, json={"data": {"__typename": "query_root"}})

    backend = MemoryStorage()
    async with build_client(handler, backend) as nhost:
        await _seed_session(nhost.session_storage, exp_offset_seconds=-10)
        requests = [
            asyncio.create_task(nhost.graphql.request("query { __typename }"))
            for _ in range(request_count)
        ]
        await asyncio.wait_for(refresh_started.wait(), timeout=1)
        allow_refresh.set()
        responses = await asyncio.gather(*requests)

    assert token_calls == 1
    assert graphql_authorizations == [f"Bearer {refreshed_access_token}"] * request_count
    assert all(response.body.data == {"__typename": "query_root"} for response in responses)


async def test_clients_sharing_backend_serialize_refresh() -> None:
    token_calls = 0
    graphql_authorizations: list[str | None] = []
    refresh_started = asyncio.Event()
    allow_refresh = asyncio.Event()
    refreshed_access_token = make_jwt(exp_offset_seconds=3600)

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal token_calls
        if request.url.path.endswith("/token"):
            token_calls += 1
            refresh_started.set()
            await allow_refresh.wait()
            return httpx.Response(200, content=raw_session_bytes(refreshed_access_token))
        graphql_authorizations.append(request.headers.get("authorization"))
        return httpx.Response(200, json={"data": {"__typename": "query_root"}})

    backend = MemoryStorage()
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        clients = [
            create_client(
                auth_url="https://auth.example/v1",
                graphql_url="https://graphql.example/v1",
                session_storage=backend,
                http_client=http,
            )
            for _ in range(2)
        ]
        await _seed_session(clients[0].session_storage, exp_offset_seconds=-10)
        requests = [
            asyncio.create_task(client.graphql.request("query { __typename }"))
            for client in clients
        ]
        await asyncio.wait_for(refresh_started.wait(), timeout=1)
        await asyncio.sleep(0)
        allow_refresh.set()
        responses = await asyncio.gather(*requests)

    assert clients[0].session_storage is not clients[1].session_storage
    assert clients[0].session_storage.backend is clients[1].session_storage.backend
    assert token_calls == 1
    assert graphql_authorizations == [f"Bearer {refreshed_access_token}"] * 2
    assert all(response.body.data == {"__typename": "query_root"} for response in responses)


def test_shared_backend_refresh_lock_is_replaced_between_event_loops() -> None:
    backend = MemoryStorage()
    refreshed_access_token = make_jwt(exp_offset_seconds=3600)

    def run_refresh_round() -> int:
        async def run() -> int:
            token_calls = 0
            refresh_started = asyncio.Event()
            allow_refresh = asyncio.Event()

            async def handler(request: httpx.Request) -> httpx.Response:
                nonlocal token_calls
                token_calls += 1
                refresh_started.set()
                await allow_refresh.wait()
                return httpx.Response(200, content=raw_session_bytes(refreshed_access_token))

            async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
                clients = [
                    create_client(
                        auth_url="https://auth.example/v1",
                        session_storage=backend,
                        http_client=http,
                    )
                    for _ in range(2)
                ]
                await _seed_session(clients[0].session_storage, exp_offset_seconds=-10)
                refreshes = [asyncio.create_task(client.refresh_session()) for client in clients]
                await asyncio.wait_for(refresh_started.wait(), timeout=1)
                await asyncio.sleep(0)
                allow_refresh.set()
                sessions = await asyncio.gather(*refreshes)

            assert all(
                session is not None and session.access_token == refreshed_access_token
                for session in sessions
            )
            return token_calls

        return asyncio.run(run())

    assert run_refresh_round() == 1
    assert run_refresh_round() == 1


def test_refresh_lock_cache_releases_backend_and_lock() -> None:
    gc.collect()
    baseline = len(refresh_module._locks)

    def register_backend() -> tuple[
        weakref.ReferenceType[MemoryStorage], weakref.ReferenceType[asyncio.Lock]
    ]:
        backend = MemoryStorage()
        storage = SessionStorage(backend)

        async def register() -> asyncio.Lock:
            return refresh_module._lock_for(storage)

        lock = asyncio.run(register())
        assert len(refresh_module._locks) == baseline + 1
        references = weakref.ref(backend), weakref.ref(lock)
        del lock
        return references

    backend_reference, lock_reference = register_backend()
    gc.collect()

    assert backend_reference() is None
    assert lock_reference() is None
    assert len(refresh_module._locks) <= baseline


@pytest.mark.parametrize(
    ("exp_offset_seconds", "margin_seconds", "expected_token_calls"),
    [
        pytest.param(3600, 60, 0, id="outside-margin"),
        pytest.param(30, 60, 1, id="within-margin"),
        pytest.param(3600, 0, 1, id="zero-margin-forces-refresh"),
        pytest.param(None, 60, 1, id="missing-exp"),
    ],
)
async def test_refresh_margin_rules(
    exp_offset_seconds: int | None,
    margin_seconds: int,
    expected_token_calls: int,
) -> None:
    token_calls = 0
    refreshed_access_token = make_jwt(exp_offset_seconds=3600)

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal token_calls
        if request.url.path.endswith("/token"):
            token_calls += 1
            return httpx.Response(200, content=raw_session_bytes(refreshed_access_token))
        return httpx.Response(200, json={"data": None})

    backend = MemoryStorage()
    async with build_client(handler, backend) as nhost:
        original = await _seed_session(nhost.session_storage, exp_offset_seconds=exp_offset_seconds)
        refreshed = await nhost.refresh_session(margin_seconds=margin_seconds)

    assert token_calls == expected_token_calls
    if expected_token_calls:
        assert refreshed is not None
        assert refreshed.access_token == refreshed_access_token
    else:
        assert refreshed is original


async def test_expired_session_retries_500_without_clearing_storage() -> None:
    token_calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal token_calls
        if request.url.path.endswith("/token"):
            token_calls += 1
            return httpx.Response(500, json={"message": "temporary failure"})
        return httpx.Response(200, json={"data": None})

    backend = MemoryStorage()
    async with build_client(handler, backend) as nhost:
        original = await _seed_session(nhost.session_storage, exp_offset_seconds=-10)
        refreshed = await nhost.refresh_session()

        assert refreshed is None
        assert token_calls == 2
        assert await nhost.session_storage.get() is original


def test_session_storage_rejects_unhashable_backend_at_construction() -> None:
    @dataclass
    class UnhashableBackend:
        pass

    with pytest.raises(TypeError, match="UnhashableBackend must be hashable"):
        SessionStorage(UnhashableBackend())  # type: ignore[arg-type]


def test_session_storage_rejects_non_weak_referenceable_backend_at_construction() -> None:
    class SlottedBackend:
        __slots__ = ()

    with pytest.raises(TypeError, match="SlottedBackend must support weak references"):
        SessionStorage(SlottedBackend())  # type: ignore[arg-type]


async def test_session_storage_snapshot_allows_self_unsubscribe() -> None:
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

    await _seed_session(storage)
    await storage.remove()

    assert notifications == [("first", False), ("second", False), ("second", True)]


async def test_session_storage_duplicate_subscriptions_unsubscribe_independently() -> None:
    storage = SessionStorage(MemoryStorage())
    notifications: list[StoredSession | None] = []

    def subscriber(session: StoredSession | None) -> None:
        notifications.append(session)

    unsubscribe_first = storage.on_change(subscriber)
    unsubscribe_second = storage.on_change(subscriber)

    stored = await _seed_session(storage)
    assert notifications == [stored, stored]

    unsubscribe_first()
    unsubscribe_first()
    await storage.remove()
    assert notifications == [stored, stored, None]

    unsubscribe_second()
    await _seed_session(storage)
    assert notifications == [stored, stored, None]


async def test_session_storage_notifications_allow_reentrant_set_and_remove() -> None:
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

    async def reentrant(session: StoredSession | None) -> None:
        nonlocal reentry_count
        notifications.append(("reentrant", None if session is None else session.refresh_token))
        if reentry_count == 0:
            reentry_count += 1
            await storage.set(replacement)
        elif reentry_count == 1:
            reentry_count += 1
            await storage.remove()

    def observer(session: StoredSession | None) -> None:
        notifications.append(("observer", None if session is None else session.refresh_token))

    storage.on_change(reentrant)
    storage.on_change(observer)
    await storage.set(
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
    assert await storage.get() is None


async def test_session_storage_rederives_forged_decoded_token() -> None:
    storage = SessionStorage(MemoryStorage())
    original = _stored_session("refresh-token")
    expected = decode_user_session(original.access_token)
    forged_decoded = original.decoded_token.model_copy(
        update={"sub": "ATTACKER", "exp": expected.exp + 999999 if expected.exp else 999999}
    )
    forged = original.model_copy(update={"decoded_token": forged_decoded})

    await storage.set(forged)

    stored = await storage.get()
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
    assert decoded.model_extra is not None
    assert decoded.model_extra["internal_api_key"] == unknown_claim
    assert dumped["internal_api_key"] == unknown_claim
    assert dumped_json["internal_api_key"] == unknown_claim
    assert dumped_json["https://hasura.io/jwt/claims"] == claims

    round_tripped = DecodedToken.model_validate(dumped_json)
    assert round_tripped.model_extra == {"internal_api_key": unknown_claim}
    assert round_tripped.model_extra["internal_api_key"] == unknown_claim


@pytest.mark.parametrize("field", ["subdomain", "region"])
@pytest.mark.parametrize("value", ["evil@attacker.example", "evil/path", "evil:443", "evil host"])
def test_cloud_service_url_rejects_invalid_authority_labels(field: str, value: str) -> None:
    values = {"subdomain": "demo", "region": "eu-central-1"}
    values[field] = value

    with pytest.raises(ValueError, match=field):
        generate_service_url("auth", **values)


@pytest.mark.parametrize("field", ["subdomain", "region"])
def test_cloud_service_url_rejects_overlong_authority_labels(field: str) -> None:
    values = {"subdomain": "demo", "region": "eu-central-1"}
    values[field] = "a" * 64

    with pytest.raises(ValueError, match=field):
        generate_service_url("auth", **values)


def test_cloud_service_url_accepts_valid_authority_labels() -> None:
    assert generate_service_url("auth", subdomain="demo-1", region="eu-central-1") == (
        "https://demo-1.auth.eu-central-1.nhost.run/v1"
    )
    assert generate_service_url("auth", subdomain="a" * 63, region="r") == (
        f"https://{'a' * 63}.auth.r.nhost.run/v1"
    )


@pytest.mark.parametrize(
    "custom_url",
    ["not-a-url", "javascript:alert(1)", "https://user@auth.example/v1"],
)
def test_custom_service_url_rejects_unsafe_urls(custom_url: str) -> None:
    with pytest.raises(ValueError, match="custom URL for auth"):
        generate_service_url("auth", custom_url=custom_url)


def test_custom_service_url_requires_an_explicit_scheme() -> None:
    with pytest.raises(ValueError, match="explicit HTTP or HTTPS scheme"):
        generate_service_url("auth", custom_url="localhost:1337/v1")


def test_custom_service_url_takes_precedence_over_cloud_labels() -> None:
    assert (
        generate_service_url(
            "auth",
            subdomain="invalid/path",
            region="invalid/path",
            custom_url="https://auth.example/v1/",
        )
        == "https://auth.example/v1"
    )


def test_custom_service_urls_are_normalized() -> None:
    assert generate_service_url("auth", custom_url="https://auth.example/v1/") == (
        "https://auth.example/v1"
    )
    assert generate_service_url("storage", custom_url="http://localhost:1337/v1///") == (
        "http://localhost:1337/v1"
    )
    assert generate_service_url("graphql", custom_url="https://graphql.example:8443/api/") == (
        "https://graphql.example:8443/api"
    )
    assert generate_service_url("functions", custom_url="http://functions.example") == (
        "http://functions.example"
    )


async def test_trailing_slash_auth_url_stores_session_without_double_slash() -> None:
    paths: list[str] = []
    replacement_access_token = make_jwt()

    def handler(request: httpx.Request) -> httpx.Response:
        paths.append(request.url.path)
        return httpx.Response(200, content=session_payload_bytes(replacement_access_token))

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        nhost = create_client(
            auth_url="https://auth.example/v1/",
            session_storage=MemoryStorage(),
            http_client=http,
        )
        await nhost.auth.sign_in_email_password(
            body=SignInEmailPasswordRequest(email="ada@example.com", password="secret")
        )
        stored = await nhost.get_user_session()

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
    original = await _seed_session(session_storage)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        fetch = create_enhanced_fetch(
            http,
            [update_session_from_response_middleware(session_storage, "https://auth.example/v1")],
        )
        request = http.build_request("POST", f"https://functions.example/v1{path}")
        await fetch(request)

    assert await session_storage.get() == original


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
    await _seed_session(session_storage)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        fetch = create_enhanced_fetch(
            http,
            [update_session_from_response_middleware(session_storage, "HTTPS://AUTH.EXAMPLE/v1")],
        )
        request = http.build_request("POST", f"https://auth.example/v1{path}")
        await fetch(request)

    stored = await session_storage.get()
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
    original = await _seed_session(session_storage)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        fetch = create_enhanced_fetch(
            http,
            [update_session_from_response_middleware(session_storage, "https://host.example/v1")],
        )
        await fetch(http.build_request("POST", f"https://host.example{path}"))

    assert await session_storage.get() == original


async def test_session_response_ignores_scheme_mismatch() -> None:
    replacement_access_token = make_jwt()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=raw_session_bytes(replacement_access_token))

    session_storage = SessionStorage(MemoryStorage())
    original = await _seed_session(session_storage)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        fetch = create_enhanced_fetch(
            http,
            [update_session_from_response_middleware(session_storage, "https://auth.example/v1")],
        )
        await fetch(http.build_request("POST", "http://auth.example/v1/token"))

    assert await session_storage.get() == original


async def test_failed_password_change_keeps_session() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"message": "current password is invalid"})

    session_storage = SessionStorage(MemoryStorage())
    original = await _seed_session(session_storage)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        fetch = create_enhanced_fetch(
            http,
            [update_session_from_response_middleware(session_storage, "https://auth.example/v1")],
        )
        await fetch(http.build_request("POST", "https://auth.example/v1/user/password"))

    assert await session_storage.get() is original


async def test_unsuccessful_auth_response_does_not_update_session() -> None:
    replacement_access_token = make_jwt()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, content=raw_session_bytes(replacement_access_token))

    session_storage = SessionStorage(MemoryStorage())
    original = await _seed_session(session_storage)
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

    assert await session_storage.get() == original


async def test_subpath_auth_refresh_completes_once(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[tuple[str, str]] = []
    refresh_checks = 0
    refreshed_access_token = make_jwt()

    async def tracked_refresh(
        auth: AuthClient,
        storage: SessionStorage,
        margin_seconds: int = 60,
    ) -> StoredSession | None:
        nonlocal refresh_checks
        refresh_checks += 1
        return await refresh_session(auth, storage, margin_seconds)

    monkeypatch.setattr(refresh_module, "refresh_session", tracked_refresh)

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append((request.method, request.url.path))
        if request.url.path == "/v1/auth/token":
            return httpx.Response(200, content=raw_session_bytes(refreshed_access_token))
        return httpx.Response(200, json={"ok": True})

    backend = MemoryStorage()
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        nhost = create_client(
            auth_url="http://localhost:1337/v1/auth",
            functions_url="http://localhost:1337/v1/functions",
            session_storage=backend,
            http_client=http,
        )
        await _seed_session(nhost.session_storage, exp_offset_seconds=-10)
        await asyncio.wait_for(nhost.functions.post("/hello"), timeout=1)

    assert refresh_checks == 1
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
            auth_url="https://auth.example/v1",
            functions_url="https://functions.example/v1",
            session_storage=backend,
            http_client=http,
        )
        await _seed_session(nhost.session_storage, exp_offset_seconds=5)
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
    await _seed_session(session_storage, exp_offset_seconds=-10)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        differently_scoped_auth = create_api_client(
            "https://different.example/v1", http_client=http
        )
        reentrant_auth = create_api_client(
            "https://auth.example/v1/auth",
            chain_functions=[session_refresh_middleware(differently_scoped_auth, session_storage)],
            http_client=http,
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
    await _seed_session(session_storage, exp_offset_seconds=-10)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        bare_auth = create_api_client("https://bare-auth.example/v1", http_client=http)

        def reenter(next_fetch: FetchFunction) -> FetchFunction:
            async def fetch(request: httpx.Request) -> httpx.Response:
                reentry_results.append(await refresh_session(bare_auth, session_storage))
                return await next_fetch(request)

            return fetch

        reentrant_auth = create_api_client(
            "https://auth.example/v1", chain_functions=[reenter], http_client=http
        )
        refreshed = await refresh_session(reentrant_auth, session_storage)

    assert reentry_results == [None]
    assert refreshed is not None
    assert refreshed.access_token == refreshed_access_token


def _user_with_metadata(metadata: dict[str, Any] | None) -> User:
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


def test_file_storage_lock_is_replaced_between_event_loops(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    storage = FileStorage(tmp_path / "session.json")
    expected = _stored_session("refresh-token")

    def run_get_round() -> None:
        read_started = threading.Event()
        allow_read = threading.Event()

        def blocking_read() -> StoredSession:
            read_started.set()
            assert allow_read.wait(timeout=1)
            return expected

        monkeypatch.setattr(storage, "_read", blocking_read)

        async def run() -> None:
            first = asyncio.create_task(storage.get())
            assert await asyncio.to_thread(read_started.wait, 1)
            second = asyncio.create_task(storage.get())
            await asyncio.sleep(0)
            allow_read.set()
            assert list(await asyncio.gather(first, second)) == [expected, expected]

        asyncio.run(run())

    run_get_round()
    run_get_round()


async def test_file_storage_roundtrips_session_with_null_metadata(tmp_path: Path) -> None:
    # User.metadata is required-but-nullable; exclude_none would drop it and make
    # reload validation fail, silently deleting the session file.
    path = tmp_path / "private" / "session.json"
    storage = FileStorage(path)

    previous_umask = os.umask(0)
    try:
        await storage.set(_stored_session("r"))
    finally:
        os.umask(previous_umask)
    reloaded = await storage.get()

    assert reloaded is not None
    assert isinstance(reloaded, StoredSession)
    assert reloaded.user is not None
    assert reloaded.user.metadata is None
    assert stat.S_IMODE(path.stat().st_mode) == OWNER_ONLY_FILE_MODE
    assert stat.S_IMODE(path.parent.stat().st_mode) == PRIVATE_DIRECTORY_MODE


async def test_session_storage_rederives_tampered_file_claims(tmp_path: Path) -> None:
    path = tmp_path / "session.json"
    storage = SessionStorage(FileStorage(path))
    legitimate = to_stored_session(
        Session(
            access_token=make_jwt(exp_offset_seconds=-10),
            access_token_expires_in=3600,
            refresh_token="refresh",
            refresh_token_id="rid",
            user=None,
        )
    )

    await storage.set(legitimate)
    assert await storage.get() == legitimate

    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["decodedToken"]["sub"] = "ATTACKER"
    payload["decodedToken"]["exp"] = int(time.time()) + 999_999
    payload["decodedToken"]["https://hasura.io/jwt/claims"] = {"x-hasura-default-role": "admin"}
    path.write_text(json.dumps(payload), encoding="utf-8")

    restored = await storage.get()
    expected = decode_user_session(legitimate.access_token)
    assert restored is not None
    assert restored.decoded_token == expected
    assert restored.decoded_token.sub == "user-123"
    assert restored.decoded_token.hasura_claims is not None
    assert restored.decoded_token.hasura_claims["x-hasura-default-role"] == "user"

    token_calls = 0
    refreshed_access_token = make_jwt(exp_offset_seconds=3600)

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal token_calls
        token_calls += 1
        return httpx.Response(200, content=raw_session_bytes(refreshed_access_token))

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        auth = create_api_client("https://auth.example/v1", http_client=http)
        refreshed = await refresh_session(auth, storage)

    assert token_calls == 1
    assert refreshed is not None
    assert refreshed.access_token == refreshed_access_token


async def test_file_storage_replaces_existing_file_with_owner_only_permissions(
    tmp_path: Path,
) -> None:
    path = tmp_path / "existing" / "session.json"
    path.parent.mkdir(mode=EXISTING_DIRECTORY_MODE)
    path.parent.chmod(EXISTING_DIRECTORY_MODE)
    path.write_text(_stored_session("old").model_dump_json(by_alias=True), encoding="utf-8")
    path.chmod(stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP | stat.S_IROTH)

    await FileStorage(path).set(_stored_session("new"))
    reloaded = await FileStorage(path).get()

    assert reloaded is not None
    assert reloaded.refresh_token == "new"
    assert stat.S_IMODE(path.stat().st_mode) == OWNER_ONLY_FILE_MODE
    assert stat.S_IMODE(path.parent.stat().st_mode) == EXISTING_DIRECTORY_MODE


async def test_file_storage_failed_atomic_replace_preserves_original(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = tmp_path / "session.json"
    storage = FileStorage(path)
    await storage.set(_stored_session("original"))
    original_payload = path.read_bytes()
    replace_calls: list[tuple[Path, Path]] = []

    def fail_replace(source: str | os.PathLike[str], destination: str | os.PathLike[str]) -> None:
        replace_calls.append((Path(source), Path(destination)))
        raise OSError("simulated atomic replace failure")

    monkeypatch.setattr("nhost.session.storage_backend.os.replace", fail_replace)

    with pytest.raises(SessionStorageError, match="simulated atomic replace failure") as exc:
        await storage.set(_stored_session("replacement"))

    assert isinstance(exc.value.__cause__, OSError)

    assert len(replace_calls) == 1
    temporary_path, destination = replace_calls[0]
    assert temporary_path.parent == path.parent
    assert destination == path
    assert path.read_bytes() == original_payload
    assert await storage.get() is not None
    assert [child.name for child in path.parent.iterdir()] == [path.name]


async def test_file_storage_expands_home_and_surfaces_corruption(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("HOME", str(tmp_path))
    storage = FileStorage("~/.config/nhost/session.json")
    await storage.set(_stored_session("refresh"))

    path = tmp_path / ".config" / "nhost" / "session.json"
    assert path.exists()
    path.write_text("not json", encoding="utf-8")

    with pytest.raises(SessionStorageError, match="Could not read"):
        await storage.get()
    assert path.read_text(encoding="utf-8") == "not json"


async def test_server_client_attaches_expired_token_without_refreshing() -> None:
    expired_token = make_jwt(exp_offset_seconds=-10)
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(httpx.codes.OK, json={"data": {"__typename": "query_root"}})

    backend = MemoryStorage()
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        nhost = create_server_client(
            subdomain="demo",
            region="eu-central-1",
            session_storage=backend,
            http_client=http,
        )
        await nhost.session_storage.set(
            Session(
                access_token=expired_token,
                access_token_expires_in=0,
                refresh_token="refresh-token",
                refresh_token_id="refresh-id",
                user=None,
            )
        )
        await nhost.graphql.request("query { __typename }")

    assert [request.url.path for request in requests] == ["/v1"]
    assert requests[0].headers["authorization"] == f"Bearer {expired_token}"


async def test_server_client_captures_auth_session() -> None:
    token = make_jwt()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(httpx.codes.OK, content=session_payload_bytes(token))

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        nhost = create_server_client(
            subdomain="demo",
            region="eu-central-1",
            session_storage=MemoryStorage(),
            http_client=http,
        )
        await nhost.auth.sign_in_email_password(
            body=SignInEmailPasswordRequest(email="ada@example.com", password="secret-pw")
        )
        stored = await nhost.get_user_session()

    assert stored is not None
    assert stored.access_token == token


async def test_with_chain_functions_applies_to_every_service_client() -> None:
    middleware_hosts: list[str] = []

    def observe(next_fetch: FetchFunction) -> FetchFunction:
        async def fetch(request: httpx.Request) -> httpx.Response:
            middleware_hosts.append(request.url.host)
            return await next_fetch(request)

        return fetch

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "auth.example":
            return httpx.Response(httpx.codes.OK, json={"keys": []})
        if request.url.host == "storage.example":
            return httpx.Response(httpx.codes.NO_CONTENT)
        if request.url.host == "graphql.example":
            return httpx.Response(httpx.codes.OK, json={"data": {}})
        return httpx.Response(httpx.codes.OK, json={"ok": True})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        nhost = create_nhost_client(
            auth_url="https://auth.example/v1",
            storage_url="https://storage.example/v1",
            graphql_url="https://graphql.example/v1",
            functions_url="https://functions.example/v1",
            http_client=http,
            configure=[with_chain_functions([observe])],
        )
        await nhost.auth.get_jwks()
        await nhost.storage.delete_file("file-id")
        await nhost.graphql.request("query { __typename }")
        await nhost.functions.fetch("echo")

    assert middleware_hosts == [
        "auth.example",
        "storage.example",
        "graphql.example",
        "functions.example",
    ]


def test_client_configuration_is_keyword_only_and_coordinates_are_paired() -> None:
    with pytest.raises(TypeError):
        create_client("demo", "eu-central-1")  # type: ignore[misc]
    with pytest.raises(TypeError):
        create_server_client()  # type: ignore[call-arg]
    with pytest.raises(ValueError, match="supplied together"):
        create_client(subdomain="demo")
    with pytest.raises(ValueError, match="supplied together"):
        create_client(region="eu-central-1")


@pytest.mark.parametrize(
    "client_type",
    [AuthClient, StorageClient, GraphQLClient, FunctionsClient],
)
async def test_standalone_clients_close_only_owned_http_client(client_type: type[Any]) -> None:
    owned = client_type("https://api.example/v1")
    async with owned:
        assert not owned._http.is_closed
    assert owned._http.is_closed

    external_http = httpx.AsyncClient()
    injected = client_type("https://api.example/v1", http_client=external_http)
    async with injected:
        pass
    assert not external_http.is_closed
    await external_http.aclose()


async def test_sdk_http_timeout_default_and_explicit_option() -> None:
    default_client = create_nhost_client()
    explicit_timeout = httpx.Timeout(connect=2.0, read=120.0, write=180.0, pool=15.0)
    explicit_client = create_nhost_client(timeout=explicit_timeout)
    try:
        default_timeout = default_client._http.timeout
        assert (
            default_timeout.connect,
            default_timeout.read,
            default_timeout.write,
            default_timeout.pool,
        ) == DEFAULT_HTTP_TIMEOUT_VALUES
        assert default_timeout != httpx.Timeout(5.0)
        assert default_client._owns_http is True

        configured_timeout = explicit_client._http.timeout
        assert (
            configured_timeout.connect,
            configured_timeout.read,
            configured_timeout.write,
            configured_timeout.pool,
        ) == EXPLICIT_HTTP_TIMEOUT_VALUES
        assert explicit_client._owns_http is True
    finally:
        await default_client.aclose()
        await explicit_client.aclose()


async def test_sdk_timeout_applies_to_each_service_with_injected_http_client() -> None:
    captured_timeouts: list[tuple[str, dict[str, float]]] = []
    configured_timeout = httpx.Timeout(99.0)

    def handler(request: httpx.Request) -> httpx.Response:
        captured_timeouts.append((request.url.host, request.extensions["timeout"]))
        if request.url.host == "auth.example":
            return httpx.Response(200, json={"keys": []})
        if request.url.host == "storage.example":
            return httpx.Response(204)
        if request.url.host == "graphql.example":
            return httpx.Response(200, json={"data": {}})
        return httpx.Response(200, json={"ok": True})

    async with httpx.AsyncClient(timeout=1.0, transport=httpx.MockTransport(handler)) as http:
        nhost = create_nhost_client(
            auth_url="https://auth.example/v1",
            storage_url="https://storage.example/v1",
            graphql_url="https://graphql.example/v1",
            functions_url="https://functions.example/v1",
            http_client=http,
            timeout=configured_timeout,
        )
        await nhost.auth.get_jw_ks()
        await nhost.storage.delete_file("file-id")
        await nhost.graphql.request("query { __typename }")
        await nhost.functions.fetch("echo")
        assert http.timeout == httpx.Timeout(1.0)

    assert captured_timeouts == [
        ("auth.example", configured_timeout.as_dict()),
        ("storage.example", configured_timeout.as_dict()),
        ("graphql.example", configured_timeout.as_dict()),
        ("functions.example", configured_timeout.as_dict()),
    ]


async def test_explicit_request_timeout_overrides_sdk_timeout() -> None:
    captured_timeouts: list[dict[str, float]] = []
    configured_timeout = httpx.Timeout(99.0)
    request_timeout = httpx.Timeout(7.0)

    def handler(request: httpx.Request) -> httpx.Response:
        captured_timeouts.append(request.extensions["timeout"])
        return httpx.Response(200, json={"ok": True})

    def apply_request_timeout(next_fetch: FetchFunction) -> FetchFunction:
        async def fetch(request: httpx.Request) -> httpx.Response:
            request.extensions["timeout"] = request_timeout.as_dict()
            return await next_fetch(request)

        return fetch

    async with httpx.AsyncClient(timeout=1.0, transport=httpx.MockTransport(handler)) as http:
        nhost = create_nhost_client(
            http_client=http,
            timeout=configured_timeout,
            configure=[with_chain_functions([apply_request_timeout])],
        )
        await nhost.functions.fetch("echo")

    assert captured_timeouts == [request_timeout.as_dict()]


async def test_replace_file_sends_file_as_multipart_file_part() -> None:
    captured: dict[str, Any] = {}

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
        await nhost.storage.replace_file("file-1", body=ReplaceFileBody(file=b"abc"))

    assert captured["content_type"].startswith("multipart/form-data")
    body = captured["content"]
    # The binary payload must be a file part (has filename=) so Go's ReadForm
    # classifies it under form.File, not a plain form value.
    assert b'name="file"; filename=' in body
    assert b"abc" in body


async def test_upload_file_carries_filename_via_uploadfile() -> None:
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["content"] = request.content
        return httpx.Response(201, json={"processedFiles": []})

    async with build_client(handler) as nhost:
        await nhost.storage.upload_files(
            body=UploadFilesBody(file=[UploadFile(filename="photo.png", content=b"img")])
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


@pytest.mark.integration
async def test_local_backend_graphql_integration() -> None:
    async with create_server_client(
        subdomain="local",
        region="local",
        session_storage=MemoryStorage(),
    ) as nhost:
        response = await nhost.graphql.request("query { __typename }")

    assert response.status == httpx.codes.OK
    assert response.body.data == {"__typename": "query_root"}
