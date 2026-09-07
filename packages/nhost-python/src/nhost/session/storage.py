"""Session storage wrapper adding change subscriptions over a backend."""

from __future__ import annotations

import inspect
import logging
import weakref
from collections.abc import Awaitable, Callable

from ..auth.client import Session
from .session import StoredSession, to_stored_session
from .storage_backend import SessionStorageBackend

logger = logging.getLogger("nhost.session")

SessionChangeCallback = Callable[[StoredSession | None], Awaitable[None] | None]


class SessionStorage:
    """Decode tokens, persist sessions, and notify sync or async subscribers."""

    def __init__(self, storage: SessionStorageBackend) -> None:
        try:
            hash(storage)
        except TypeError as error:
            raise TypeError(
                f"Session storage backend {type(storage).__name__} must be hashable"
            ) from error
        try:
            weakref.ref(storage)
        except TypeError as error:
            raise TypeError(
                f"Session storage backend {type(storage).__name__} must support weak references"
            ) from error

        self._storage = storage
        self._subscribers: dict[int, SessionChangeCallback] = {}
        self._next_subscriber_id = 0

    @property
    def backend(self) -> SessionStorageBackend:
        """Return the backend used as the weak refresh-lock mapping key."""
        return self._storage

    async def get(self) -> StoredSession | None:
        """Return a session with decoded claims re-derived from its access token.

        Persisted ``decoded_token`` data is derived state and is never trusted.
        A malformed access token raises :class:`ValueError`, matching :meth:`set`.
        """
        stored = await self._storage.get()
        if stored is None:
            return None

        derived = to_stored_session(stored)
        if stored.decoded_token == derived.decoded_token:
            return stored
        return derived

    async def set(self, value: Session) -> None:
        """Store an auth :class:`Session`, re-deriving its decoded token."""
        stored = to_stored_session(value)
        await self._storage.set(stored)
        await self._notify(stored)

    async def remove(self) -> None:
        await self._storage.remove()
        await self._notify(None)

    def on_change(self, callback: SessionChangeCallback) -> Callable[[], None]:
        """Subscribe to changes and return an idempotent unsubscribe function.

        Both synchronous and asynchronous callbacks are supported. Registering
        the same callable twice creates two independent subscriptions.
        """
        subscriber_id = self._next_subscriber_id
        self._next_subscriber_id += 1
        self._subscribers[subscriber_id] = callback

        def unsubscribe() -> None:
            self._subscribers.pop(subscriber_id, None)

        return unsubscribe

    async def _notify(self, session: StoredSession | None) -> None:
        for subscriber in list(self._subscribers.values()):
            try:
                result = subscriber(session)
                if inspect.isawaitable(result):
                    await result
            except Exception:  # noqa: BLE001 - subscriber failures are isolated
                logger.exception("Error notifying session subscriber")
