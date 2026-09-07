"""Asynchronous session storage backends for the Nhost Python SDK.

The default backend is in-memory. Implement :class:`SessionStorageBackend` to
persist sessions in Redis, a database, a per-request store, or another async
storage system. Backends operate on :class:`StoredSession`.
"""

from __future__ import annotations

import asyncio
import os
import tempfile
from pathlib import Path
from typing import Protocol, runtime_checkable

from ..fetch import NhostError
from .session import StoredSession

DEFAULT_SESSION_KEY = "nhostSession"


class SessionStorageError(NhostError):
    """Raised when a persistent session backend cannot read or update state."""

    def __init__(self, operation: str, path: Path, error: Exception) -> None:
        self.operation = operation
        self.path = path
        self.error = error
        super().__init__(f"Could not {operation} session storage at {path}: {error}")


@runtime_checkable
class SessionStorageBackend(Protocol):
    """Asynchronous interface for persisting one :class:`StoredSession`.

    Backend instances are weak-mapping keys for in-process refresh locking, so
    implementations must remain hashable, have stable equality semantics, and
    support weak references.
    """

    async def get(self) -> StoredSession | None: ...

    async def set(self, value: StoredSession) -> None: ...

    async def remove(self) -> None: ...


class MemoryStorage:
    """In-memory session storage. The default backend.

    Not shared across processes and cleared when the process exits. Do not
    share one instance between users in a server process; create a scoped
    backend per request or user instead.
    """

    def __init__(self) -> None:
        self._session: StoredSession | None = None

    async def get(self) -> StoredSession | None:
        return self._session

    async def set(self, value: StoredSession) -> None:
        self._session = value

    async def remove(self) -> None:
        self._session = None


class FileStorage:
    """JSON-file session storage for CLIs and local scripts.

    File operations run in worker threads so they do not block the event loop.
    Writes are atomic and use owner-only permissions. ``~`` in ``path`` is
    expanded when the backend is constructed.
    """

    def __init__(self, path: str | Path) -> None:
        self._path = Path(path).expanduser()
        self._lock: tuple[asyncio.AbstractEventLoop, asyncio.Lock] | None = None

    def _lock_for_running_loop(self) -> asyncio.Lock:
        loop = asyncio.get_running_loop()
        if self._lock is None or self._lock[0] is not loop:
            lock = asyncio.Lock()
            self._lock = (loop, lock)
            return lock
        return self._lock[1]

    async def get(self) -> StoredSession | None:
        async with self._lock_for_running_loop():
            try:
                return await asyncio.to_thread(self._read)
            except FileNotFoundError:
                return None
            except (OSError, ValueError) as error:
                raise SessionStorageError("read", self._path, error) from error

    async def set(self, value: StoredSession) -> None:
        async with self._lock_for_running_loop():
            try:
                await asyncio.to_thread(self._write, value)
            except OSError as error:
                raise SessionStorageError("write", self._path, error) from error

    async def remove(self) -> None:
        async with self._lock_for_running_loop():
            try:
                await asyncio.to_thread(self._path.unlink, missing_ok=True)
            except OSError as error:
                raise SessionStorageError("remove", self._path, error) from error

    def _read(self) -> StoredSession:
        raw = self._path.read_text(encoding="utf-8")
        return StoredSession.model_validate_json(raw)

    def _write(self, value: StoredSession) -> None:
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

        # Persist null values: required-but-nullable fields must round-trip.
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


def detect_storage() -> SessionStorageBackend:
    """Return the default storage backend for the current environment."""
    return MemoryStorage()
