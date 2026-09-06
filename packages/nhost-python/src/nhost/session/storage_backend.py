"""Session storage backends for the Nhost Python SDK.

Unlike the browser-first JS SDK (localStorage/cookies), the Python SDK targets
servers and scripts, so the default backend is in-memory. Implement
:class:`SessionStorageBackend` to persist sessions elsewhere (a file, Redis, a
per-request store, ...). Backends operate on :class:`StoredSession`.
"""

from __future__ import annotations

import json
import os
import tempfile
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
    """JSON-file backed session storage, useful for CLIs and local scripts.

    The file contains a long-lived refresh token that can mint access tokens
    until it is revoked. It is atomically written with owner-only permissions.

    ``get``/``set`` perform synchronous, blocking filesystem I/O. Since these
    backends are invoked from inside the async request path (token attachment
    and refresh call ``get`` on every request), a shared ``FileStorage`` under
    high concurrency will block the event loop for the duration of each disk
    read/write. It is intended for CLIs and local scripts; prefer
    :class:`MemoryStorage` or a per-request backend in high-concurrency async
    servers.
    """

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
        parent = self._path.parent
        try:
            parent.mkdir(parents=True, mode=0o700)
        except FileExistsError:
            if not parent.is_dir():
                raise
        else:
            # A restrictive umask can remove owner bits, so normalize only the
            # directory this call created. Never alter a pre-existing directory.
            parent.chmod(0o700)

        # Persist all fields (no exclude_none): required-but-nullable fields such
        # as User.metadata must round-trip, otherwise reload validation fails and
        # get() would silently delete a valid session file.
        payload = value.model_dump_json(by_alias=True)

        fd: int | None = None
        temporary_path: str | None = None
        try:
            fd, temporary_path = tempfile.mkstemp(dir=parent)
            os.fchmod(fd, 0o600)
            stream = os.fdopen(fd, "w", encoding="utf-8")
            fd = None
            with stream:
                stream.write(payload)
            os.replace(temporary_path, self._path)
            temporary_path = None
        finally:
            if fd is not None:
                os.close(fd)
            if temporary_path is not None:
                Path(temporary_path).unlink(missing_ok=True)

    def remove(self) -> None:
        self._path.unlink(missing_ok=True)


def detect_storage() -> SessionStorageBackend:
    """Return the default storage backend for the current environment."""
    return MemoryStorage()
