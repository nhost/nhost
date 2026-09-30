"""Where the SDK keeps sessions.

A store only loads, saves and deletes sessions; :class:`SessionManager` decides
which requests get them. A client acting for one user (a CLI, a script, a test)
passes a :class:`SessionStore` to ``Nhost(session_store=...)``; a server acting
for many passes a :class:`MultiUserSessionStore` to
``Nhost(multi_user_session_store=...)``, keyed by user ID.

The methods are async so a store can live in Redis, a database or another
service without blocking the event loop. Raise any exception to report a
failure: the SDK wraps it in :class:`SessionStoreError` and fails the request
rather than sending it without a token.

A store may also define ``delete_if_refresh_token``, which the SDK calls after
the auth service rejected a refresh token. The auth service rotates the refresh
token on every refresh, so another process sharing the store may have refreshed
first and saved a newer session, which must survive. Without the method the SDK
loads, compares and deletes in separate calls, and a session saved between them
is deleted; a store that can do it in one atomic step (a Redis script, a
conditional ``DELETE``) should define it::

    async def delete_if_refresh_token(
        self, user_id: str, refresh_token: str
    ) -> StoredSession | None:
        # Delete user_id's session if it still holds refresh_token and return
        # None; otherwise return the session it holds.
        ...

(A :class:`SessionStore`'s version takes no ``user_id``.)
"""

from __future__ import annotations

import asyncio
import os
import tempfile
from pathlib import Path
from typing import Protocol

from pydantic import ValidationError

from ..fetch import NhostError
from .session import StoredSession


class SessionStoreError(NhostError):
    """Raised when a session store cannot load, save or delete a session.

    The store's own exception is kept as ``error`` and as ``__cause__``.
    """

    def __init__(self, operation: str, error: Exception) -> None:
        self.operation = operation
        self.error = error
        super().__init__(f"Could not {operation} the session: {error}")


class NoSessionStoreError(NhostError):
    """Raised when a session method is called on a client without a session store."""

    def __init__(self) -> None:
        super().__init__(
            "this client has no session store; pass session_store= or "
            "multi_user_session_store= to Nhost"
        )


class SessionStore(Protocol):
    """Where a client acting for one user keeps its session."""

    async def load(self) -> StoredSession | None:
        """Load the session, or return ``None`` when there is none."""
        ...

    async def save(self, session: StoredSession) -> None:
        """Save ``session``, replacing any session already stored."""
        ...

    async def delete(self) -> None:
        """Delete the session. Deleting when there is none succeeds."""
        ...


class MultiUserSessionStore(Protocol):
    """Where a server keeps the sessions of the users it acts for, keyed by user ID.

    A request names its user with :meth:`nhost.Nhost.with_user_id`. The SDK never
    asks the store about a request that names none, so such a request sends no
    token rather than someone else's. Sessions are saved under the user the auth
    service returned them for.
    """

    async def load(self, user_id: str) -> StoredSession | None:
        """Load ``user_id``'s session, or return ``None`` when there is none."""
        ...

    async def save(self, user_id: str, session: StoredSession) -> None:
        """Save ``session`` as ``user_id``'s, replacing any stored for them."""
        ...

    async def delete(self, user_id: str) -> None:
        """Delete ``user_id``'s session. Deleting when there is none succeeds."""
        ...


class MemoryStore:
    """Keeps one session in memory, for a process acting for one user.

    Not shared across processes and gone when the process exits.
    """

    def __init__(self) -> None:
        self._session: StoredSession | None = None

    async def load(self) -> StoredSession | None:
        return self._session

    async def save(self, session: StoredSession) -> None:
        self._session = session

    async def delete(self) -> None:
        self._session = None

    async def delete_if_refresh_token(self, refresh_token: str) -> StoredSession | None:
        if self._session is not None and self._session.refresh_token == refresh_token:
            self._session = None
        return self._session


class MultiUserMemoryStore:
    """Keeps many users' sessions in memory, for a server running as one process.

    Replicas that share sessions need a :class:`MultiUserSessionStore` over a
    shared store instead.
    """

    def __init__(self) -> None:
        self._sessions: dict[str, StoredSession] = {}

    async def load(self, user_id: str) -> StoredSession | None:
        return self._sessions.get(user_id)

    async def save(self, user_id: str, session: StoredSession) -> None:
        self._sessions[user_id] = session

    async def delete(self, user_id: str) -> None:
        self._sessions.pop(user_id, None)

    async def delete_if_refresh_token(
        self, user_id: str, refresh_token: str
    ) -> StoredSession | None:
        current = self._sessions.get(user_id)
        if current is not None and current.refresh_token == refresh_token:
            del self._sessions[user_id]
            return None
        return current


class FileStore:
    """Keeps one session in a JSON file, for CLIs and local scripts.

    File operations run in worker threads so they do not block the event loop.
    Writes are atomic and the file is readable only by its owner. ``~`` in
    ``path`` is expanded when the store is constructed. Operations from one
    process are serialized; processes sharing the file are not coordinated.
    """

    def __init__(self, path: str | Path) -> None:
        self._path = Path(path).expanduser()
        self._lock: tuple[asyncio.AbstractEventLoop, asyncio.Lock] | None = None

    @property
    def path(self) -> Path:
        """The file the session is kept in."""
        return self._path

    def _lock_for_running_loop(self) -> asyncio.Lock:
        loop = asyncio.get_running_loop()
        if self._lock is None or self._lock[0] is not loop:
            lock = asyncio.Lock()
            self._lock = (loop, lock)
            return lock
        return self._lock[1]

    async def load(self) -> StoredSession | None:
        async with self._lock_for_running_loop():
            return await asyncio.to_thread(self._read)

    async def save(self, session: StoredSession) -> None:
        async with self._lock_for_running_loop():
            await asyncio.to_thread(self._write, session)

    async def delete(self) -> None:
        async with self._lock_for_running_loop():
            await asyncio.to_thread(self._path.unlink, missing_ok=True)

    async def delete_if_refresh_token(self, refresh_token: str) -> StoredSession | None:
        async with self._lock_for_running_loop():
            current = await asyncio.to_thread(self._read)
            if current is None or current.refresh_token != refresh_token:
                return current
            await asyncio.to_thread(self._path.unlink, missing_ok=True)
            return None

    def _read(self) -> StoredSession | None:
        try:
            raw = self._path.read_text(encoding="utf-8")
        except FileNotFoundError:
            return None
        try:
            return StoredSession.model_validate_json(raw)
        except ValidationError as error:
            raise ValueError(f"{self._path} does not hold a valid session: {error}") from error

    def _write(self, session: StoredSession) -> None:
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
        payload = session.model_dump_json(by_alias=True)

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
