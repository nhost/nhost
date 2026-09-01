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

### `to_stored_session`

```python
def to_stored_session(session: 'Session') -> 'StoredSession'
```

Enrich a raw auth :class:`Session` into a :class:`StoredSession`.

## Classes

### `DecodedToken`

```python
class DecodedToken
```

Decoded JWT access-token payload.

``exp`` and ``iat`` are epoch seconds as encoded in the JWT. Unknown claims
are preserved via ``extra="allow"``.

#### Fields

| Field | Type |
| --- | --- |
| `exp` | `int | None` |
| `iat` | `int | None` |
| `iss` | `str | None` |
| `sub` | `str | None` |
| `hasura_claims` | `dict[str, Any] | None` |

### `FileStorage`

```python
class FileStorage
```

JSON-file backed session storage, useful for CLIs and local scripts.

``get``/``set`` perform synchronous, blocking filesystem I/O. Since these
backends are invoked from inside the async request path (token attachment
and refresh call ``get`` on every request), a shared ``FileStorage`` under
high concurrency will block the event loop for the duration of each disk
read/write. It is intended for CLIs and local scripts; prefer
:class:`MemoryStorage` or a per-request backend in high-concurrency async
servers.

#### Methods

##### `get`

```python
def get(self) -> 'StoredSession | None'
```

##### `remove`

```python
def remove(self) -> 'None'
```

##### `set`

```python
def set(self, value: 'StoredSession') -> 'None'
```

### `MemoryStorage`

```python
class MemoryStorage
```

In-memory session storage. The default backend.

Not shared across processes and cleared when the process exits. Because a
single instance is process-wide, do not share one ``MemoryStorage`` between
different users in a server context — create a scoped backend per user.

#### Methods

##### `get`

```python
def get(self) -> 'StoredSession | None'
```

##### `remove`

```python
def remove(self) -> 'None'
```

##### `set`

```python
def set(self, value: 'StoredSession') -> 'None'
```

### `SessionStorage`

```python
class SessionStorage
```

Wraps a :class:`SessionStorageBackend`, decoding tokens on ``set`` and
notifying subscribers on every change.

#### Methods

##### `get`

```python
def get(self) -> 'StoredSession | None'
```

##### `on_change`

```python
def on_change(self, callback: 'SessionChangeCallback') -> 'Callable[[], None]'
```

Subscribe to session changes; returns an unsubscribe callable.

##### `remove`

```python
def remove(self) -> 'None'
```

##### `set`

```python
def set(self, value: 'Session') -> 'None'
```

Store a raw auth :class:`Session`, enriching it into a stored session.

### `SessionStorageBackend`

```python
class SessionStorageBackend
```

Interface for persisting a single :class:`StoredSession`.

#### Methods

##### `get`

```python
def get(self) -> 'StoredSession | None'
```

##### `remove`

```python
def remove(self) -> 'None'
```

##### `set`

```python
def set(self, value: 'StoredSession') -> 'None'
```

### `StoredSession`

```python
class StoredSession
```

The enriched session persisted by the SDK (raw ``Session`` + decoded token).

#### Fields

| Field | Type |
| --- | --- |
| `access_token` | `str` |
| `access_token_expires_in` | `int` |
| `refresh_token_id` | `str` |
| `refresh_token` | `str` |
| `user` | `User | None` |
| `decoded_token` | `DecodedToken` |
