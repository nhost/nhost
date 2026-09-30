"""Tests for session stores, scoped handles and refreshing sessions per user.

No network I/O: an ``httpx.MockTransport`` answers every request.
"""

from __future__ import annotations

import asyncio
import base64
import json
import time
from collections.abc import Callable, Coroutine
from pathlib import Path
from typing import Any

import httpx
import pytest

from nhost import (
    AdminSessionOptions,
    FileStore,
    MemoryStore,
    MultiUserMemoryStore,
    Nhost,
    NoSessionStoreError,
    SessionManager,
    SessionStoreError,
    StoredSession,
)
from nhost.auth import Session, SignInEmailPasswordRequest, SignOutRequest
from nhost.auth import User as AuthUser
from nhost.session import to_stored_session

AUTH_URL = "https://auth.example/v1"
GRAPHQL_URL = "https://graphql.example/v1"
Handler = Callable[[httpx.Request], Coroutine[None, None, httpx.Response]]


def jwt(sub: str, *, exp_offset_seconds: int = 3600) -> str:
    def segment(value: dict[str, Any]) -> str:
        raw = json.dumps(value, separators=(",", ":")).encode()
        return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()

    claims = {"sub": sub, "exp": int(time.time()) + exp_offset_seconds}
    return f"{segment({'alg': 'HS256'})}.{segment(claims)}.signature"


def session_for(
    user_id: str, *, refresh_token: str | None = None, exp_offset_seconds: int = 3600
) -> Session:
    return Session(
        access_token=jwt(user_id, exp_offset_seconds=exp_offset_seconds),
        access_token_expires_in=3600,
        refresh_token=refresh_token or f"{user_id}-refresh",
        refresh_token_id=f"{user_id}-refresh-id",
        user=None,
    )


def session_json(session: Session, *, wrapped: bool) -> bytes:
    body = session.model_dump(mode="json", by_alias=True)
    return json.dumps({"session": body} if wrapped else body).encode()


class Backend:
    """Answers auth and GraphQL requests, recording what each one carried."""

    def __init__(self) -> None:
        self.graphql_authorizations: list[str | None] = []
        self.refreshed: list[str] = []
        self.sign_in_user = "ada"
        self.refresh_status = 200
        self.refresh_gate: asyncio.Event | None = None

    async def __call__(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == "/v1/token":
            refresh_token = json.loads(request.content)["refreshToken"]
            self.refreshed.append(refresh_token)
            if self.refresh_gate is not None:
                await self.refresh_gate.wait()
            if self.refresh_status != 200:
                return httpx.Response(self.refresh_status, json={"message": "rejected"})
            user_id = refresh_token.split("-")[0]
            rotated = session_for(user_id, refresh_token=f"{user_id}-rotated")
            return httpx.Response(200, content=session_json(rotated, wrapped=False))
        if path == "/v1/signin/email-password":
            signed_in = session_for(self.sign_in_user)
            return httpx.Response(200, content=session_json(signed_in, wrapped=True))
        if path == "/v1/signout":
            return httpx.Response(200, json="OK")
        self.graphql_authorizations.append(request.headers.get("authorization"))
        return httpx.Response(200, json={"data": {"__typename": "query_root"}})


def client(backend: Backend, http: httpx.AsyncClient, **kwargs: Any) -> Nhost:
    return Nhost(auth_url=AUTH_URL, graphql_url=GRAPHQL_URL, http_client=http, **kwargs)


def mock_http(backend: Handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(backend))


async def sign_in(nhost: Nhost) -> None:
    await nhost.auth.sign_in_email_password(
        body=SignInEmailPasswordRequest(email="ada@example.com", password="secret-pw")
    )


async def query(nhost: Nhost) -> None:
    await nhost.graphql.request("query { __typename }")


def manager(nhost: Nhost) -> SessionManager:
    assert nhost.session_manager is not None
    return nhost.session_manager


# --- Clients without a session store ---------------------------------------


async def test_client_without_store_has_no_session_methods() -> None:
    backend = Backend()
    async with mock_http(backend) as http:
        nhost = client(backend, http)
        assert nhost.session_manager is None
        with pytest.raises(NoSessionStoreError):
            await nhost.get_session()
        with pytest.raises(NoSessionStoreError):
            await nhost.refresh_session()
        with pytest.raises(NoSessionStoreError):
            await nhost.clear_session()

        await sign_in(nhost)
        await query(nhost)

    assert backend.graphql_authorizations == [None]


async def test_access_token_handle_works_without_store() -> None:
    backend = Backend()
    async with mock_http(backend) as http:
        nhost = client(backend, http)
        await query(nhost.with_access_token("caller-token"))
        await query(nhost)

    assert backend.graphql_authorizations == ["Bearer caller-token", None]


# --- Multi-user stores ------------------------------------------------------


async def test_multi_user_requests_use_the_selected_users_session() -> None:
    backend = Backend()
    store = MultiUserMemoryStore()
    await store.save("ada", to_stored_session(session_for("ada")))
    await store.save("bob", to_stored_session(session_for("bob")))
    async with mock_http(backend) as http:
        nhost = client(backend, http, multi_user_session_store=store)
        await query(nhost)
        await query(nhost.with_user_id("ada"))
        await query(nhost.with_user_id("bob"))
        await query(nhost.with_user_id("carol"))
        ada = await nhost.with_user_id("ada").get_session()
        assert await nhost.get_session() is None

    ada_token = session_for("ada").access_token
    bob_token = session_for("bob").access_token
    assert backend.graphql_authorizations == [
        None,
        f"Bearer {ada_token}",
        f"Bearer {bob_token}",
        None,
    ]
    assert ada is not None
    assert ada.user_id == "ada"


async def test_multi_user_sign_in_is_stored_under_the_returned_user() -> None:
    backend = Backend()
    store = MultiUserMemoryStore()
    async with mock_http(backend) as http:
        nhost = client(backend, http, multi_user_session_store=store)
        # The session is filed under the user the auth service returned it
        # for, whichever handle made the request.
        await sign_in(nhost)
        backend.sign_in_user = "bob"
        await sign_in(nhost.with_user_id("someone-else"))

    ada = await store.load("ada")
    bob = await store.load("bob")
    assert ada is not None and ada.user_id == "ada"
    assert bob is not None and bob.user_id == "bob"
    assert await store.load("someone-else") is None


async def test_multi_user_sign_out_removes_only_the_selected_users_session() -> None:
    backend = Backend()
    store = MultiUserMemoryStore()
    await store.save("ada", to_stored_session(session_for("ada")))
    await store.save("bob", to_stored_session(session_for("bob")))
    async with mock_http(backend) as http:
        nhost = client(backend, http, multi_user_session_store=store)
        # A sign-out naming no user removes nothing.
        await nhost.auth.sign_out(body=SignOutRequest())
        assert await store.load("ada") is not None
        await nhost.with_user_id("ada").auth.sign_out(body=SignOutRequest())
        await nhost.with_user_id("bob").clear_session()

    assert await store.load("ada") is None
    assert await store.load("bob") is None


async def test_multi_user_session_without_user_is_refused() -> None:
    sessions = SessionManager(multi_user_session_store=MultiUserMemoryStore())
    anonymous = Session(
        access_token="e30.e30.signature",
        access_token_expires_in=3600,
        refresh_token="refresh",
        refresh_token_id="refresh-id",
        user=None,
    )
    with pytest.raises(ValueError, match="names no user"):
        await sessions.set(anonymous)


def test_session_manager_needs_exactly_one_store() -> None:
    with pytest.raises(ValueError, match="exactly one"):
        SessionManager()
    with pytest.raises(ValueError, match="exactly one"):
        SessionManager(session_store=MemoryStore(), multi_user_session_store=MultiUserMemoryStore())


def test_stored_session_user_id_prefers_user_then_token_subject() -> None:
    from_token = to_stored_session(session_for("ada"))
    assert from_token.user_id == "ada"

    user = AuthUser(
        avatar_url="",
        created_at="2026-01-01T00:00:00Z",
        default_role="user",
        display_name="Bob",
        email="bob@example.com",
        email_verified=True,
        id="bob",
        is_anonymous=False,
        locale="en",
        metadata=None,
        phone_number_verified=False,
        roles=["user"],
    )
    with_user = to_stored_session(session_for("ada").model_copy(update={"user": user}))
    assert with_user.user_id == "bob"


# --- Single-user stores and user selection ---------------------------------


async def test_single_store_session_is_used_only_for_its_own_user() -> None:
    backend = Backend()
    store = MemoryStore()
    await store.save(to_stored_session(session_for("ada")))
    async with mock_http(backend) as http:
        nhost = client(backend, http, session_store=store)
        await query(nhost.with_user_id("bob"))
        await nhost.with_user_id("bob").clear_session()
        assert await store.load() is not None
        await query(nhost.with_user_id("ada"))
        await nhost.with_user_id("ada").clear_session()

    ada_token = session_for("ada").access_token
    assert backend.graphql_authorizations == [None, f"Bearer {ada_token}"]
    assert await store.load() is None


# --- Caller-supplied access tokens -----------------------------------------


async def test_access_token_handle_leaves_the_store_alone() -> None:
    backend = Backend()
    store = MemoryStore()
    stored = to_stored_session(session_for("ada", exp_offset_seconds=-10))
    await store.save(stored)
    async with mock_http(backend) as http:
        nhost = client(backend, http, session_store=store)
        caller = nhost.with_access_token("caller-token")
        # The caller's token wins over the stored session, and an expired
        # stored session is not refreshed for it.
        await query(caller)
        await query(caller.with_user_id("ada"))
        backend.sign_in_user = "bob"
        await sign_in(caller)
        await caller.auth.sign_out(body=SignOutRequest())

    assert backend.graphql_authorizations == ["Bearer caller-token"] * 2
    assert backend.refreshed == []
    assert await store.load() == stored


async def test_admin_client_refuses_caller_tokens() -> None:
    async with mock_http(Backend()) as http:
        nhost = Nhost(http_client=http, admin=AdminSessionOptions("secret"))
        with pytest.raises(ValueError, match="admin secret"):
            nhost.with_access_token("caller-token")


async def test_newest_handle_scope_wins() -> None:
    backend = Backend()
    store = MultiUserMemoryStore()
    await store.save("ada", to_stored_session(session_for("ada")))
    await store.save("bob", to_stored_session(session_for("bob")))
    async with mock_http(backend) as http:
        nhost = client(backend, http, multi_user_session_store=store)
        await query(nhost.with_user_id("ada").with_user_id("bob"))
        await query(nhost.with_access_token("one").with_access_token("two"))
        # A token set earlier survives choosing a user.
        await query(nhost.with_access_token("caller").with_user_id("ada"))

    bob_token = session_for("bob").access_token
    assert backend.graphql_authorizations == [
        f"Bearer {bob_token}",
        "Bearer two",
        "Bearer caller",
    ]


async def test_closing_a_handle_leaves_the_connection_pool_open() -> None:
    backend = Backend()
    nhost = Nhost(auth_url=AUTH_URL, graphql_url=GRAPHQL_URL, session_store=MemoryStore())
    nhost.graphql._http = mock_http(backend)
    nhost._http = nhost.graphql._http
    async with nhost.with_user_id("ada") as handle:
        assert handle.session_manager is nhost.session_manager
    assert not nhost._http.is_closed
    await nhost.aclose()
    assert nhost._http.is_closed


# --- Store failures fail the request ---------------------------------------


class FailingStore(MemoryStore):
    def __init__(self) -> None:
        super().__init__()
        self.fail_on: set[str] = set()

    async def load(self) -> StoredSession | None:
        if "load" in self.fail_on:
            raise OSError("store unavailable")
        return await super().load()

    async def save(self, session: StoredSession) -> None:
        if "save" in self.fail_on:
            raise OSError("store unavailable")
        await super().save(session)

    async def delete(self) -> None:
        if "delete" in self.fail_on:
            raise OSError("store unavailable")
        await super().delete()


@pytest.mark.parametrize("operation", ["save", "delete"])
async def test_auth_request_fails_when_its_session_cannot_be_stored(operation: str) -> None:
    backend = Backend()
    store = FailingStore()
    await store.save(to_stored_session(session_for("ada")))
    store.fail_on.add(operation)
    async with mock_http(backend) as http:
        nhost = client(backend, http, session_store=store)
        with pytest.raises(SessionStoreError, match="store unavailable") as error:
            if operation == "save":
                await sign_in(nhost)
            else:
                await nhost.auth.sign_out(body=SignOutRequest())

    assert error.value.operation == operation
    assert isinstance(error.value.__cause__, OSError)


async def test_request_fails_when_the_store_cannot_be_read() -> None:
    backend = Backend()
    store = FailingStore()
    store.fail_on.add("load")
    async with mock_http(backend) as http:
        nhost = client(backend, http, session_store=store)
        with pytest.raises(SessionStoreError, match="Could not read the session"):
            await query(nhost)

    assert backend.graphql_authorizations == []


# --- Refreshing -------------------------------------------------------------


async def test_users_refresh_independently_and_each_once() -> None:
    backend = Backend()
    backend.refresh_gate = asyncio.Event()
    store = MultiUserMemoryStore()
    for user_id in ("ada", "bob"):
        await store.save(user_id, to_stored_session(session_for(user_id, exp_offset_seconds=-10)))
    async with mock_http(backend) as http:
        nhost = client(backend, http, multi_user_session_store=store)
        requests = [
            asyncio.create_task(query(nhost.with_user_id(user_id)))
            for user_id in ("ada", "bob", "ada", "bob")
        ]
        while len(backend.refreshed) < 2:
            await asyncio.sleep(0)
        backend.refresh_gate.set()
        await asyncio.gather(*requests)

    assert sorted(backend.refreshed) == ["ada-refresh", "bob-refresh"]
    ada = await store.load("ada")
    bob = await store.load("bob")
    assert ada is not None and ada.refresh_token == "ada-rotated"
    assert bob is not None and bob.refresh_token == "bob-rotated"
    assert sorted(str(authorization) for authorization in backend.graphql_authorizations) == sorted(
        [f"Bearer {ada.access_token}", f"Bearer {bob.access_token}"] * 2
    )


async def test_cancelled_caller_does_not_abandon_a_refresh() -> None:
    backend = Backend()
    backend.refresh_gate = asyncio.Event()
    store = MemoryStore()
    await store.save(to_stored_session(session_for("ada", exp_offset_seconds=-10)))
    async with mock_http(backend) as http:
        nhost = client(backend, http, session_store=store)
        refresh = asyncio.create_task(nhost.refresh_session())
        while not backend.refreshed:
            await asyncio.sleep(0)
        refresh.cancel()
        with pytest.raises(asyncio.CancelledError):
            await refresh
        backend.refresh_gate.set()
        while manager(nhost)._refreshes:
            await asyncio.sleep(0)

    stored = await store.load()
    assert stored is not None
    assert stored.refresh_token == "ada-rotated"


class UnconditionalStore(MemoryStore):
    """A custom store without delete_if_refresh_token: the SDK compares itself."""

    delete_if_refresh_token = None  # type: ignore[assignment]


@pytest.mark.parametrize("store_type", [MemoryStore, UnconditionalStore])
async def test_rejected_refresh_keeps_a_session_another_process_rotated(
    store_type: type[MemoryStore],
) -> None:
    backend = Backend()
    backend.refresh_status = 401
    store = store_type()
    await store.save(to_stored_session(session_for("ada", exp_offset_seconds=-10)))
    newer = to_stored_session(session_for("ada", refresh_token="ada-newer"))

    async def rotate_then_reject(request: httpx.Request) -> httpx.Response:
        # Another process refreshes and saves its rotated session while this
        # process's retry is on its way, so the retry is rejected too.
        if backend.refreshed:
            await store.save(newer)
        return await backend(request)

    async with mock_http(rotate_then_reject) as http:
        nhost = client(backend, http, session_store=store)
        refreshed = await nhost.refresh_session()

    assert backend.refreshed == ["ada-refresh", "ada-refresh"]
    assert refreshed is not None
    assert refreshed.refresh_token == "ada-newer"
    assert await store.load() == newer


@pytest.mark.parametrize("store_type", [MemoryStore, UnconditionalStore])
async def test_rejected_refresh_deletes_the_session_it_spent(
    store_type: type[MemoryStore],
) -> None:
    backend = Backend()
    backend.refresh_status = 401
    store = store_type()
    await store.save(to_stored_session(session_for("ada", exp_offset_seconds=-10)))
    async with mock_http(backend) as http:
        nhost = client(backend, http, session_store=store)
        assert await nhost.refresh_session() is None

    assert backend.refreshed == ["ada-refresh", "ada-refresh"]
    assert await store.load() is None


async def test_multi_user_rejected_refresh_keeps_a_rotated_session() -> None:
    backend = Backend()
    backend.refresh_status = 401
    store = MultiUserMemoryStore()
    await store.save("ada", to_stored_session(session_for("ada", exp_offset_seconds=-10)))
    await store.save("bob", to_stored_session(session_for("bob", exp_offset_seconds=-10)))
    newer = to_stored_session(session_for("ada", refresh_token="ada-newer"))

    async def rotate_ada_then_reject(request: httpx.Request) -> httpx.Response:
        # Ada's retry races another replica's refresh; Bob's does not.
        if backend.refreshed.count("ada-refresh") == 1 and b"ada-refresh" in request.content:
            await store.save("ada", newer)
        return await backend(request)

    async with mock_http(rotate_ada_then_reject) as http:
        nhost = client(backend, http, multi_user_session_store=store)
        ada = await nhost.with_user_id("ada").refresh_session()
        bob = await nhost.with_user_id("bob").refresh_session()

    assert ada is not None and ada.refresh_token == "ada-newer"
    assert bob is None
    assert await store.load("ada") == newer
    assert await store.load("bob") is None


# --- Built-in stores --------------------------------------------------------


async def test_memory_stores_delete_only_an_unchanged_refresh_token() -> None:
    single = MemoryStore()
    ada = to_stored_session(session_for("ada"))
    await single.save(ada)
    assert await single.delete_if_refresh_token("other") == ada
    assert await single.delete_if_refresh_token("ada-refresh") is None
    assert await single.load() is None

    multi = MultiUserMemoryStore()
    await multi.save("ada", ada)
    assert await multi.delete_if_refresh_token("ada", "other") == ada
    assert await multi.delete_if_refresh_token("bob", "ada-refresh") is None
    assert await multi.load("ada") == ada
    assert await multi.delete_if_refresh_token("ada", "ada-refresh") is None
    assert await multi.load("ada") is None


async def test_file_store_deletes_only_an_unchanged_refresh_token(tmp_path: Path) -> None:
    store = FileStore(tmp_path / "session.json")
    assert store.path == tmp_path / "session.json"
    assert await store.delete_if_refresh_token("ada-refresh") is None

    ada = to_stored_session(session_for("ada"))
    await store.save(ada)
    assert await store.delete_if_refresh_token("other") == ada
    assert store.path.exists()
    assert await store.delete_if_refresh_token("ada-refresh") is None
    assert not store.path.exists()
