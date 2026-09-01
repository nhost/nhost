"""Session refresh logic for the Nhost Python SDK.

Mirrors ``@nhost/nhost-js``'s ``refreshSession``: refresh the access token when
it is within ``margin_seconds`` of expiry, serialized by an asyncio lock (the
Python analogue of the JS Web Locks API) so concurrent requests don't trigger
overlapping refreshes.
"""

from __future__ import annotations

import asyncio
import logging
import time
from weakref import WeakKeyDictionary

from ..auth import Client as AuthClient
from ..auth import RefreshTokenRequest
from ..fetch import FetchError
from .session import StoredSession
from .storage import SessionStorage

logger = logging.getLogger("nhost.session")

_UNAUTHORIZED = 401
_DEFAULT_MARGIN_SECONDS = 60

_locks: WeakKeyDictionary[SessionStorage, asyncio.Lock] = WeakKeyDictionary()


def _lock_for(storage: SessionStorage) -> asyncio.Lock:
    lock = _locks.get(storage)
    if lock is None:
        lock = asyncio.Lock()
        _locks[storage] = lock
    return lock


def _needs_refresh(
    storage: SessionStorage, margin_seconds: int
) -> tuple[StoredSession | None, bool, bool]:
    """Return (session, needs_refresh, session_expired)."""
    session = storage.get()
    if session is None:
        return None, False, False

    exp = session.decoded_token.exp
    if not exp:
        return session, True, True

    if margin_seconds == 0:
        return session, True, False

    now = time.time()
    if exp - now > margin_seconds:
        return session, False, False

    return session, True, exp < now


async def _refresh_session(
    auth: AuthClient, storage: SessionStorage, margin_seconds: int
) -> StoredSession | None:
    session, needs_refresh, _ = _needs_refresh(storage, margin_seconds)
    if session is None:
        return None
    if not needs_refresh:
        return session

    async with _lock_for(storage):
        session, needs_refresh, session_expired = _needs_refresh(storage, margin_seconds)
        if session is None:
            return None
        if not needs_refresh:
            return session

        try:
            response = await auth.refresh_token(
                RefreshTokenRequest(refresh_token=session.refresh_token)
            )
        except FetchError:
            if not session_expired:
                return session
            raise

        storage.set(response.body)
        return storage.get()


async def refresh_session(
    auth: AuthClient,
    storage: SessionStorage,
    margin_seconds: int = _DEFAULT_MARGIN_SECONDS,
) -> StoredSession | None:
    """Refresh the session if it is close to expiry.

    Retries once on transient failure; clears the stored session and returns
    ``None`` if the refresh token is rejected with 401.
    """
    try:
        return await _refresh_session(auth, storage, margin_seconds)
    except FetchError as first_error:
        logger.warning("error refreshing session, retrying: %s", first_error)
        try:
            return await _refresh_session(auth, storage, margin_seconds)
        except FetchError as error:
            if error.status == _UNAUTHORIZED:
                logger.error("session probably expired")
                storage.remove()
            return None
