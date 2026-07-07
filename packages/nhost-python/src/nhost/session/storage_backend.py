"""Session storage backends for the Nhost Python SDK.

Unlike the browser-first JS SDK (localStorage/cookies), the Python SDK targets
servers and scripts, so the default backend is in-memory. Implement
:class:`SessionStorageBackend` to persist sessions elsewhere (a file, Redis, a
per-request store, ...). Backends operate on :class:`StoredSession`.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Protocol, runtime_checkable

from .session import StoredSession

DEFAULT_SESSION_KEY = "nhostSession"


@runtime_checkable
class SessionStorageBackend(Protocol):
    """Interface for persisting a single :class:`StoredSession`."""

    def get(self) -> StoredSession | None: ...

    def set(self, value: StoredSession) -> None: ...

    def remove(self) -> None: ...


class MemoryStorage:
    """In-memory session storage. The default backend.

    Not shared across processes and cleared when the process exits. Because a
    single instance is process-wide, do not share one ``MemoryStorage`` between
    different users in a server context — create a scoped backend per user.
    """

    def __init__(self) -> None:
        self._session: StoredSession | None = None

    def get(self) -> StoredSession | None:
        return self._session

    def set(self, value: StoredSession) -> None:
        self._session = value

    def remove(self) -> None:
        self._session = None


class FileStorage:
    """JSON-file backed session storage, useful for CLIs and local scripts."""

    def __init__(self, path: str | Path) -> None:
        self._path = Path(path)

    def get(self) -> StoredSession | None:
        try:
            raw = self._path.read_text(encoding="utf-8")
        except (FileNotFoundError, OSError):
            return None
        try:
            return StoredSession.model_validate_json(raw)
        except (ValueError, json.JSONDecodeError):
            self.remove()
            return None

    def set(self, value: StoredSession) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(
            value.model_dump_json(by_alias=True, exclude_none=True), encoding="utf-8"
        )

    def remove(self) -> None:
        self._path.unlink(missing_ok=True)


def detect_storage() -> SessionStorageBackend:
    """Return the default storage backend for the current environment."""
    return MemoryStorage()
