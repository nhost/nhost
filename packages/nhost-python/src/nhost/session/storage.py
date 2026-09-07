"""Session storage wrapper decoding tokens over a backend."""

from __future__ import annotations

import weakref

from ..auth.client import Session
from .session import StoredSession, to_stored_session
from .storage_backend import SessionStorageBackend


class SessionStorage:
    """Decode access tokens and persist sessions through a backend."""

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
        await self._storage.set(to_stored_session(value))

    async def remove(self) -> None:
        await self._storage.remove()
