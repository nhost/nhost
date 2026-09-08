---
title: Session
---

Session management for the Nhost Python SDK.

## Functions

### `decode_user_session`

```python
def decode_user_session(access_token: str) -> DecodedToken
```

Decode the payload of a JWT access token into a `DecodedToken`.

Hasura claims encoded as PostgreSQL array literals (e.g. ``{user,me}``) are
converted into Python lists, mirroring the JS SDK.

### `detect_storage`

```python
def detect_storage() -> SessionStorageBackend
```

Return the default storage backend for the current environment.

### `refresh_session`

```python
async def refresh_session(auth: AuthClient, storage: SessionStorage, margin_seconds: int = 60) -> StoredSession | None
```

Refresh the session if it is close to expiry.

Retries once on transient failure; clears the stored session and returns
``None`` if the refresh token is rejected with 401.

Supply a bare auth client without session-refresh middleware. The internal
reentry guard is a deadlock safety net, not a supported reentrancy mechanism.

### `to_stored_session`

```python
def to_stored_session(session: Session) -> StoredSession
```

Enrich an auth `Session`, re-deriving its decoded access token.

## Type aliases

### `SessionChangeCallback`

```python
SessionChangeCallback = Callable[[nhost.session.session.StoredSession | None], Awaitable[None] | None]
```

## Classes

### `DecodedToken`

```python
class DecodedToken(BaseModel):
```

Decoded JWT access-token payload.

``exp`` and ``iat`` are epoch seconds as encoded in the JWT. Unknown claims
are preserved via ``extra="allow"`` and serialized in full, but their values
are replaced with ``<redacted>`` in ``repr``, ``str``, and f-strings. The
declared fields, including processed Hasura claims, remain visible.

#### Fields

| Field | Type |
| --- | --- |
| `exp` | `int \| None` |
| `iat` | `int \| None` |
| `iss` | `str \| None` |
| `sub` | `str \| None` |
| `hasura_claims` | `dict[str, Any] \| None` |

### `FileStorage`

```python
class FileStorage:
    def __init__(path: str | Path) -> None
```

JSON-file session storage for CLIs and local scripts.

File operations run in worker threads so they do not block the event loop.
Writes are atomic and use owner-only permissions. ``~`` in ``path`` is
expanded when the backend is constructed.

#### Methods

##### `get`

```python
async def get(self) -> StoredSession | None
```

##### `remove`

```python
async def remove(self) -> None
```

##### `set`

```python
async def set(self, value: StoredSession) -> None
```

### `MemoryStorage`

```python
class MemoryStorage:
    def __init__() -> None
```

In-memory session storage. The default backend.

Not shared across processes and cleared when the process exits. Do not
share one instance between users in a server process; create a scoped
backend per request or user instead.

#### Methods

##### `get`

```python
async def get(self) -> StoredSession | None
```

##### `remove`

```python
async def remove(self) -> None
```

##### `set`

```python
async def set(self, value: StoredSession) -> None
```

### `SessionStorage`

```python
class SessionStorage:
    def __init__(storage: SessionStorageBackend) -> None
```

Decode tokens, persist sessions, and notify sync or async subscribers.

#### Properties

##### `backend`

```python
@property
def backend(self) -> SessionStorageBackend
```

Return the backend used as the weak refresh-lock mapping key.

#### Methods

##### `get`

```python
async def get(self) -> StoredSession | None
```

Return a session with decoded claims re-derived from its access token.

Persisted ``decoded_token`` data is derived state and is never trusted.
A malformed access token raises `ValueError`, matching `set`.

##### `on_change`

```python
def on_change(self, callback: SessionChangeCallback) -> Callable[[], None]
```

Subscribe to changes and return an idempotent unsubscribe function.

Both synchronous and asynchronous callbacks are supported. Registering
the same callable twice creates two independent subscriptions.

##### `remove`

```python
async def remove(self) -> None
```

##### `set`

```python
async def set(self, value: Session) -> None
```

Store an auth `Session`, re-deriving its decoded token.

### `SessionStorageBackend`

```python
class SessionStorageBackend(Protocol):
    def __init__(*args, **kwargs)
```

Asynchronous interface for persisting one `StoredSession`.

Backend instances are weak-mapping keys for in-process refresh locking, so
implementations must remain hashable, have stable equality semantics, and
support weak references.

#### Methods

##### `get`

```python
async def get(self) -> StoredSession | None
```

##### `remove`

```python
async def remove(self) -> None
```

##### `set`

```python
async def set(self, value: StoredSession) -> None
```

### `SessionStorageError`

```python
class SessionStorageError(NhostError):
    def __init__(operation: str, path: Path, error: Exception) -> None
```

Raised when a persistent session backend cannot read or update state.

### `StoredSession`

```python
class StoredSession(Session):
```

The enriched session persisted by the SDK (raw ``Session`` + decoded token).

``repr``, ``str``, and f-strings omit the access and refresh tokens and mask
undeclared JWT claim values. Processed Hasura claims and caller-controlled
user metadata remain visible. Serialization intentionally emits the complete
session for persistence, so do not serialize a session into logs.
``decoded_token`` is derived state: storage consumers must re-derive it from
``access_token`` rather than trusting persisted claims.

#### Fields

| Field | Type |
| --- | --- |
| `access_token` | `str` |
| `access_token_expires_in` | `int` |
| `refresh_token_id` | `str` |
| `refresh_token` | `str` |
| `user` | `User \| None` |
| `decoded_token` | `DecodedToken` |
