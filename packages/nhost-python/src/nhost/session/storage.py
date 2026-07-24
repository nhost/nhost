"""Session storage wrapper adding change subscriptions over a backend."""

from __future__ import annotations

import logging
from collections.abc import Callable

from ..auth import Session
from .session import StoredSession, to_stored_session
from .storage_backend import SessionStorageBackend

logger = logging.getLogger("nhost.session")

SessionChangeCallback = Callable[[StoredSession | None], None]


class SessionStorage:
    """Wraps a :class:`SessionStorageBackend`, decoding tokens on ``set`` and
    notifying subscribers on every change."""

    def __init__(self, storage: SessionStorageBackend) -> None:
        self._storage = storage
        self._subscribers: set[SessionChangeCallback] = set()

    def get(self) -> StoredSession | None:
        return self._storage.get()

    def set(self, value: Session) -> None:
        """Store a raw auth :class:`Session`, enriching it into a stored session."""
        stored = to_stored_session(value)
        self._storage.set(stored)
        self._notify(stored)

    def remove(self) -> None:
        self._storage.remove()
        self._notify(None)

    def on_change(self, callback: SessionChangeCallback) -> Callable[[], None]:
        """Subscribe to session changes; returns an unsubscribe callable."""
        self._subscribers.add(callback)

        def unsubscribe() -> None:
            self._subscribers.discard(callback)

        return unsubscribe

    def _notify(self, session: StoredSession | None) -> None:
        for subscriber in self._subscribers:
            try:
                subscriber(session)
            except Exception:  # noqa: BLE001 - subscriber errors must not break storage
                logger.exception("Error notifying session subscriber")
