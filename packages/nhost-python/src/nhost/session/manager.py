"""The sessions a client and its middleware share."""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Awaitable
from contextvars import ContextVar
from typing import TYPE_CHECKING, TypeVar

import httpx

from ..auth.client import RefreshTokenRequest, Session
from ..fetch import HTTPError
from .session import StoredSession, to_stored_session
from .stores import MultiUserSessionStore, SessionStore, SessionStoreError

if TYPE_CHECKING:
    from ..auth.client import Client as AuthClient

logger = logging.getLogger("nhost.session")

T = TypeVar("T")

_UNAUTHORIZED = 401
DEFAULT_REFRESH_MARGIN_SECONDS = 60

# The refresh tokens the current task is spending. A refresh that re-enters
# itself (an auth client wrongly given session middleware) would otherwise
# wait for its own task forever.
_spending: ContextVar[frozenset[str]] = ContextVar(
    "nhost_spending_refresh_tokens", default=frozenset()
)


class _RefreshRequestFailed(Exception):
    """The refresh request got no 2xx response, so it may be retried."""

    def __init__(self, error: HTTPError[object] | httpx.RequestError, refresh_token: str) -> None:
        self.error = error
        self.refresh_token = refresh_token
        super().__init__(str(error))

    @property
    def status(self) -> int | None:
        return self.error.status if isinstance(self.error, HTTPError) else None


class SessionManager:
    """Loads, saves and refreshes the sessions in one store.

    ``Nhost`` builds one from ``session_store=`` or ``multi_user_session_store=``
    and shares it with its middleware and every handle made from it
    (:attr:`nhost.Nhost.session_manager`). Use it directly to store a session
    obtained elsewhere, or to read another user's session.

    Methods that select a session take a ``user_id``. Without one, they use the
    one session of a :class:`SessionStore` and no session of a
    :class:`MultiUserSessionStore`. With one, a :class:`SessionStore`'s session
    is used only if it is that user's.
    """

    def __init__(
        self,
        *,
        session_store: SessionStore | None = None,
        multi_user_session_store: MultiUserSessionStore | None = None,
    ) -> None:
        """Manage the sessions in exactly one of the two stores."""
        self._store: _SingleUser | _MultiUser
        if session_store is not None and multi_user_session_store is None:
            self._store = _SingleUser(session_store)
        elif multi_user_session_store is not None and session_store is None:
            self._store = _MultiUser(multi_user_session_store)
        else:
            raise ValueError("pass exactly one of session_store and multi_user_session_store")
        self._refreshes: dict[str, asyncio.Task[StoredSession | None]] = {}

    async def get(self, user_id: str | None = None) -> StoredSession | None:
        """Return the stored session ``user_id`` selects, if any.

        The decoded token is derived again from the access token rather than
        trusted from storage.
        """
        stored = await _store_call("read", self._store.load(user_id))
        return None if stored is None else _canonical(stored)

    async def set(self, session: Session) -> None:
        """Store an auth :class:`Session` under the user it is for.

        With a :class:`MultiUserSessionStore`, a session that names no user
        raises :class:`ValueError`.
        """
        stored = to_stored_session(session)
        if isinstance(self._store, _MultiUser) and stored.user_id is None:
            raise ValueError("the session names no user to store it under")
        await _store_call("save", self._store.save(stored))

    async def remove(self, user_id: str | None = None) -> None:
        """Delete the stored session ``user_id`` selects, if any."""
        await _store_call("delete", self._store.delete(user_id))

    async def refresh(
        self,
        auth: AuthClient,
        *,
        user_id: str | None = None,
        margin_seconds: int = DEFAULT_REFRESH_MARGIN_SECONDS,
    ) -> StoredSession | None:
        """Refresh the session ``user_id`` selects if it expires within the margin.

        Returns the (possibly unchanged) session. ``auth`` must be an auth client
        without session middleware, so this is the only thing that stores the
        refreshed session.

        Concurrent refreshes of one session, from any handle sharing this
        manager, collapse into one request that finishes even if every caller
        waiting for it is cancelled; different users refresh independently. If
        the refresh fails and the session has not expired yet, it is returned
        unchanged. An expired session's refresh is retried once; if that fails
        too, this returns ``None``, and a ``401`` from the auth service also
        deletes the session, unless the store has meanwhile been given a session
        with another refresh token (another process refreshed first), which is
        returned instead. Store failures raise :class:`SessionStoreError`, and
        are never retried.
        """
        try:
            return await self._refresh_once(auth, user_id, margin_seconds)
        except _RefreshRequestFailed as first:
            logger.warning("error refreshing session, retrying: %s", first.error)
        try:
            return await self._refresh_once(auth, user_id, margin_seconds)
        except _RefreshRequestFailed as failure:
            if failure.status != _UNAUTHORIZED:
                logger.warning("error refreshing session: %s", failure.error)
                return None
            logger.error("session probably expired")
            return await self._remove_rejected(user_id, failure.refresh_token)

    async def _needs_refresh(
        self, user_id: str | None, margin_seconds: int
    ) -> tuple[StoredSession | None, bool, bool]:
        """Return ``(session, needs_refresh, session_expired)``."""
        session = await self.get(user_id)
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

    async def _refresh_once(
        self, auth: AuthClient, user_id: str | None, margin_seconds: int
    ) -> StoredSession | None:
        session, needs_refresh, expired = await self._needs_refresh(user_id, margin_seconds)
        if session is None or not needs_refresh:
            return session

        # Refreshes are keyed by the refresh token they spend: it names one
        # session, and the auth service accepts it once.
        key = session.refresh_token
        if key in _spending.get():
            return None if expired else session
        loop = asyncio.get_running_loop()
        task = self._refreshes.get(key)
        if task is None or task.get_loop() is not loop:
            task = loop.create_task(self._perform_refresh(auth, user_id, margin_seconds))
            self._refreshes[key] = task
            task.add_done_callback(lambda done: self._forget_refresh(key, done))
        # Shielded: a cancelled caller must not abandon a refresh the auth
        # service may already have accepted, or the rotated session is lost.
        return await asyncio.shield(task)

    def _forget_refresh(self, key: str, task: asyncio.Task[StoredSession | None]) -> None:
        if self._refreshes.get(key) is task:
            del self._refreshes[key]
        if not task.cancelled():
            # Retrieve the exception so a refresh whose callers were all
            # cancelled does not log "exception was never retrieved".
            task.exception()

    async def _perform_refresh(
        self, auth: AuthClient, user_id: str | None, margin_seconds: int
    ) -> StoredSession | None:
        # Another refresh may have finished since the caller looked.
        session, needs_refresh, expired = await self._needs_refresh(user_id, margin_seconds)
        if session is None or not needs_refresh:
            return session

        _spending.set(_spending.get() | {session.refresh_token})
        try:
            response = await auth.refresh_token(
                body=RefreshTokenRequest(refresh_token=session.refresh_token)
            )
        except (HTTPError, httpx.RequestError) as error:
            if not expired:
                return session
            raise _RefreshRequestFailed(error, session.refresh_token) from error

        await self.set(response.body)
        return await self.get(user_id)

    async def _remove_rejected(
        self, user_id: str | None, refresh_token: str
    ) -> StoredSession | None:
        """Delete the session ``user_id`` selects if it still holds ``refresh_token``.

        Otherwise another process refreshed first, and its newer session is
        returned.
        """
        current = await _store_call("delete", self._store.delete_if(user_id, refresh_token))
        return None if current is None else _canonical(current)


async def _store_call(operation: str, call: Awaitable[T]) -> T:
    try:
        return await call
    except SessionStoreError:
        raise
    except Exception as error:
        raise SessionStoreError(operation, error) from error


def _selects(stored: StoredSession, user_id: str | None) -> bool:
    return user_id is None or stored.user_id == user_id


def _canonical(stored: StoredSession) -> StoredSession:
    # decodedToken is persisted for JS SDK interoperability but may have been
    # edited independently of the access token, so derive it again.
    try:
        derived = to_stored_session(stored)
    except ValueError as error:
        raise SessionStoreError("read", error) from error
    return stored if stored.decoded_token == derived.decoded_token else derived


class _SingleUser:
    """A :class:`SessionStore` seen through the user a request selects."""

    def __init__(self, store: SessionStore) -> None:
        self.store = store

    async def load(self, user_id: str | None) -> StoredSession | None:
        stored = await self.store.load()
        return stored if stored is not None and _selects(stored, user_id) else None

    async def save(self, stored: StoredSession) -> None:
        await self.store.save(stored)

    async def delete(self, user_id: str | None) -> None:
        # Removing a named user's session must not delete another user's.
        if user_id is not None and await self.load(user_id) is None:
            return
        await self.store.delete()

    async def delete_if(self, user_id: str | None, refresh_token: str) -> StoredSession | None:
        conditional = getattr(self.store, "delete_if_refresh_token", None)
        current: StoredSession | None
        if conditional is not None:
            current = await conditional(refresh_token)
        else:
            current = await self.store.load()
            if current is not None and current.refresh_token == refresh_token:
                await self.store.delete()
                current = None
        return current if current is not None and _selects(current, user_id) else None


class _MultiUser:
    """A :class:`MultiUserSessionStore`, which a request naming no user never reaches."""

    def __init__(self, store: MultiUserSessionStore) -> None:
        self.store = store

    async def load(self, user_id: str | None) -> StoredSession | None:
        return None if user_id is None else await self.store.load(user_id)

    async def save(self, stored: StoredSession) -> None:
        # SessionManager.set has checked the session names a user.
        assert stored.user_id is not None
        await self.store.save(stored.user_id, stored)

    async def delete(self, user_id: str | None) -> None:
        if user_id is not None:
            await self.store.delete(user_id)

    async def delete_if(self, user_id: str | None, refresh_token: str) -> StoredSession | None:
        if user_id is None:
            return None
        conditional = getattr(self.store, "delete_if_refresh_token", None)
        if conditional is not None:
            current: StoredSession | None = await conditional(user_id, refresh_token)
            return current
        current = await self.store.load(user_id)
        if current is not None and current.refresh_token == refresh_token:
            await self.store.delete(user_id)
            return None
        return current
