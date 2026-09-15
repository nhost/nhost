"""Session refresh logic for the Nhost Python SDK.

Refreshes within ``margin_seconds`` of expiry are serialized per session
backend within this process so clients sharing a session cannot rotate the same
refresh token concurrently.
"""

from __future__ import annotations

import asyncio
import logging
import time
from contextvars import ContextVar
from weakref import WeakKeyDictionary

import httpx

from ..auth.client import Client as AuthClient
from ..auth.client import RefreshTokenRequest
from ..fetch import HTTPError
from .session import StoredSession
from .storage import SessionStorage
from .storage_backend import SessionStorageBackend

logger = logging.getLogger("nhost.session")

_UNAUTHORIZED = 401
_DEFAULT_MARGIN_SECONDS = 60

_locks: WeakKeyDictionary[SessionStorageBackend, tuple[asyncio.AbstractEventLoop, asyncio.Lock]] = (
    WeakKeyDictionary()
)
_refreshing_backends: ContextVar[frozenset[SessionStorageBackend]] = ContextVar(
    "nhost_refreshing_backends", default=frozenset()
)


def _lock_for(storage: SessionStorage) -> asyncio.Lock:
    backend = storage.backend
    loop = asyncio.get_running_loop()
    cached = _locks.get(backend)
    if cached is None or cached[0] is not loop:
        lock = asyncio.Lock()
        _locks[backend] = (loop, lock)
        return lock
    return cached[1]


async def _needs_refresh(
    storage: SessionStorage, margin_seconds: int
) -> tuple[StoredSession | None, bool, bool]:
    """Return ``(session, needs_refresh, session_expired)``."""
    session = await storage.get()
    if session is None:
        return None, False, False

    exp = session.decoded_token.exp
    if not exp:
        return session, True, True

    now = time.time()
    if margin_seconds == 0:
        return session, True, exp < now

    if exp - now > margin_seconds:
        return session, False, False

    return session, True, exp < now


async def _refresh_session(
    auth: AuthClient, storage: SessionStorage, margin_seconds: int
) -> StoredSession | None:
    session, needs_refresh, session_expired = await _needs_refresh(storage, margin_seconds)
    if session is None or not needs_refresh:
        return session
    backend = storage.backend
    if backend in _refreshing_backends.get():
        return None if session_expired else session

    async with _lock_for(storage):
        session, needs_refresh, session_expired = await _needs_refresh(storage, margin_seconds)
        if session is None or not needs_refresh:
            return session

        refreshing = _refreshing_backends.get()
        token = _refreshing_backends.set(refreshing | {backend})
        try:
            try:
                response = await auth.refresh_token(
                    body=RefreshTokenRequest(refresh_token=session.refresh_token)
                )
            except (HTTPError, httpx.RequestError):
                if not session_expired:
                    return session
                raise

            await storage.set(response.body)
            return await storage.get()
        finally:
            _refreshing_backends.reset(token)


async def refresh_session(
    auth: AuthClient,
    storage: SessionStorage,
    margin_seconds: int = _DEFAULT_MARGIN_SECONDS,
) -> StoredSession | None:
    """Refresh the session if it is close to expiry.

    Retries once on transient failure; clears the stored session and returns
    ``None`` if the refresh token is rejected with 401.

    Supply a bare auth client without session-refresh middleware. The internal
    reentry guard is a deadlock safety net, not a supported reentrancy mechanism.
    """
    try:
        return await _refresh_session(auth, storage, margin_seconds)
    except (HTTPError, httpx.RequestError) as first_error:
        logger.warning("error refreshing session, retrying: %s", first_error)
        try:
            return await _refresh_session(auth, storage, margin_seconds)
        except (HTTPError, httpx.RequestError) as error:
            if isinstance(error, HTTPError) and error.status == _UNAUTHORIZED:
                logger.error("session probably expired")
                await storage.remove()
            return None
