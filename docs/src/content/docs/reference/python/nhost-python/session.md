---
title: Session
---

Session management for the Nhost Python SDK.

## Functions

### `decode_user_session`

```python
def decode_user_session(access_token: 'str') -> 'DecodedToken'
```

Decode the payload of a JWT access token into a :class:`DecodedToken`.

Hasura claims encoded as PostgreSQL array literals (e.g. ``{user,me}``) are
converted into Python lists, mirroring the JS SDK.

### `detect_storage`

```python
def detect_storage() -> 'SessionStorageBackend'
```

Return the default storage backend for the current environment.

### `refresh_session`

```python
async def refresh_session(auth: 'AuthClient', storage: 'SessionStorage', margin_seconds: 'int' = 60) -> 'StoredSession | None'
```

Refresh the session if it is close to expiry.

Retries once on transient failure; clears the stored session and returns
``None`` if the refresh token is rejected with 401.

Supply a bare auth client without session-refresh middleware. The internal
reentry guard is a deadlock safety net, not a supported reentrancy mechanism.

### `to_stored_session`

```python
def to_stored_session(session: 'Session') -> 'StoredSession'
```

Enrich an auth :class:`Session`, re-deriving its decoded access token.

## Classes

### `DecodedToken`

```python
class DecodedToken
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
class FileStorage
```

JSON-file session storage for CLIs and local scripts.

File operations run in worker threads so they do not block the event loop.
Writes are atomic and use owner-only permissions. ``~`` in ``path`` is
expanded when the backend is constructed.

#### Methods

##### `get`

```python
async def get(self) -> 'StoredSession | None'
```

##### `remove`

```python
async def remove(self) -> 'None'
```

##### `set`

```python
async def set(self, value: 'StoredSession') -> 'None'
```

### `MemoryStorage`

```python
class MemoryStorage
```

In-memory session storage. The default backend.

Not shared across processes and cleared when the process exits. Do not
share one instance between users in a server process; create a scoped
backend per request or user instead.

#### Methods

##### `get`

```python
async def get(self) -> 'StoredSession | None'
```

##### `remove`

```python
async def remove(self) -> 'None'
```

##### `set`

```python
async def set(self, value: 'StoredSession') -> 'None'
```

### `SessionStorage`

```python
class SessionStorage
```

Decode tokens, persist sessions, and notify sync or async subscribers.

#### Methods

##### `get`

```python
async def get(self) -> 'StoredSession | None'
```

##### `on_change`

```python
def on_change(self, callback: 'SessionChangeCallback') -> 'Callable[[], None]'
```

Subscribe to changes and return an idempotent unsubscribe function.

Both synchronous and asynchronous callbacks are supported. Registering
the same callable twice creates two independent subscriptions.

##### `remove`

```python
async def remove(self) -> 'None'
```

##### `set`

```python
async def set(self, value: 'Session') -> 'None'
```

Store an auth :class:`Session`, re-deriving its decoded token.

### `SessionStorageBackend`

```python
class SessionStorageBackend
```

Asynchronous interface for persisting one :class:`StoredSession`.

#### Methods

##### `get`

```python
async def get(self) -> 'StoredSession | None'
```

##### `remove`

```python
async def remove(self) -> 'None'
```

##### `set`

```python
async def set(self, value: 'StoredSession') -> 'None'
```

### `SessionStorageError`

```python
class SessionStorageError
```

Raised when a persistent session backend cannot read or update state.

### `StoredSession`

```python
class StoredSession
```

The enriched session persisted by the SDK (raw ``Session`` + decoded token).

``repr``, ``str``, and f-strings omit the access and refresh tokens and mask
undeclared JWT claim values. Processed Hasura claims and caller-controlled
user metadata remain visible. Serialization intentionally emits the complete
session for persistence, so do not serialize a session into logs.

#### Fields

| Field | Type |
| --- | --- |
| `access_token` | `str` |
| `access_token_expires_in` | `int` |
| `refresh_token_id` | `str` |
| `refresh_token` | `str` |
| `user` | `User \| None` |
| `decoded_token` | `DecodedToken` |
