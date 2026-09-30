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

### `to_stored_session`

```python
def to_stored_session(session: Session) -> StoredSession
```

Enrich an auth `Session`, re-deriving its decoded access token.

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

### `FileStore`

```python
class FileStore:
    def __init__(path: str | Path) -> None
```

Keeps one session in a JSON file, for CLIs and local scripts.

File operations run in worker threads so they do not block the event loop.
Writes are atomic and the file is readable only by its owner. ``~`` in
``path`` is expanded when the store is constructed. Operations from one
process are serialized; processes sharing the file are not coordinated.

#### Properties

##### `path`

```python
@property
def path(self) -> Path
```

The file the session is kept in.

#### Methods

##### `delete`

```python
async def delete(self) -> None
```

##### `delete_if_refresh_token`

```python
async def delete_if_refresh_token(self, refresh_token: str) -> StoredSession | None
```

##### `load`

```python
async def load(self) -> StoredSession | None
```

##### `save`

```python
async def save(self, session: StoredSession) -> None
```

### `MemoryStore`

```python
class MemoryStore:
    def __init__() -> None
```

Keeps one session in memory, for a process acting for one user.

Not shared across processes and gone when the process exits.

#### Methods

##### `delete`

```python
async def delete(self) -> None
```

##### `delete_if_refresh_token`

```python
async def delete_if_refresh_token(self, refresh_token: str) -> StoredSession | None
```

##### `load`

```python
async def load(self) -> StoredSession | None
```

##### `save`

```python
async def save(self, session: StoredSession) -> None
```

### `MultiUserMemoryStore`

```python
class MultiUserMemoryStore:
    def __init__() -> None
```

Keeps many users' sessions in memory, for a server running as one process.

Replicas that share sessions need a `MultiUserSessionStore` over a
shared store instead.

#### Methods

##### `delete`

```python
async def delete(self, user_id: str) -> None
```

##### `delete_if_refresh_token`

```python
async def delete_if_refresh_token(self, user_id: str, refresh_token: str) -> StoredSession | None
```

##### `load`

```python
async def load(self, user_id: str) -> StoredSession | None
```

##### `save`

```python
async def save(self, user_id: str, session: StoredSession) -> None
```

### `MultiUserSessionStore`

```python
class MultiUserSessionStore(Protocol):
    def __init__(*args, **kwargs)
```

Where a server keeps the sessions of the users it acts for, keyed by user ID.

A request names its user with `nhost.Nhost.with_user_id`. The SDK never
asks the store about a request that names none, so such a request sends no
token rather than someone else's. Sessions are saved under the user the auth
service returned them for.

#### Methods

##### `delete`

```python
async def delete(self, user_id: str) -> None
```

Delete ``user_id``'s session. Deleting when there is none succeeds.

##### `load`

```python
async def load(self, user_id: str) -> StoredSession | None
```

Load ``user_id``'s session, or return ``None`` when there is none.

##### `save`

```python
async def save(self, user_id: str, session: StoredSession) -> None
```

Save ``session`` as ``user_id``'s, replacing any stored for them.

### `NoSessionStoreError`

```python
class NoSessionStoreError(NhostError):
    def __init__() -> None
```

Raised when a session method is called on a client without a session store.

### `SessionManager`

```python
class SessionManager:
    def __init__(*, session_store: SessionStore | None = None, multi_user_session_store: MultiUserSessionStore | None = None) -> None
```

Loads, saves and refreshes the sessions in one store.

``Nhost`` builds one from ``session_store=`` or ``multi_user_session_store=``
and shares it with its middleware and every handle made from it
(`nhost.Nhost.session_manager`). Use it directly to store a session
obtained elsewhere, or to read another user's session.

Methods that select a session take a ``user_id``. Without one, they use the
one session of a `SessionStore` and no session of a
`MultiUserSessionStore`. With one, a `SessionStore`'s session
is used only if it is that user's.

#### Methods

##### `get`

```python
async def get(self, user_id: str | None = None) -> StoredSession | None
```

Return the stored session ``user_id`` selects, if any.

The decoded token is derived again from the access token rather than
trusted from storage.

##### `refresh`

```python
async def refresh(self, auth: AuthClient, *, user_id: str | None = None, margin_seconds: int = 60) -> StoredSession | None
```

Refresh the session ``user_id`` selects if it expires within the margin.

Returns the (possibly unchanged) session. ``auth`` must be an auth client
without session middleware, so this is the only thing that stores the
refreshed session.

Concurrent refreshes of one session, from any handle sharing this
manager, collapse into one request that finishes even if every caller
waiting for it is cancelled; different users refresh independently. If
the refresh fails and the session has not expired yet, it is returned
unchanged. An expired session's refresh is retried once; if that fails
too, this returns ``None``, and a ``401`` from the auth service also
deletes the session, unless the store has meanwhile been given a session
with another refresh token (another process refreshed first), which is
returned instead. Store failures raise `SessionStoreError`, and
are never retried.

##### `remove`

```python
async def remove(self, user_id: str | None = None) -> None
```

Delete the stored session ``user_id`` selects, if any.

##### `set`

```python
async def set(self, session: Session) -> None
```

Store an auth `Session` under the user it is for.

With a `MultiUserSessionStore`, a session that names no user
raises `ValueError`.

### `SessionStore`

```python
class SessionStore(Protocol):
    def __init__(*args, **kwargs)
```

Where a client acting for one user keeps its session.

#### Methods

##### `delete`

```python
async def delete(self) -> None
```

Delete the session. Deleting when there is none succeeds.

##### `load`

```python
async def load(self) -> StoredSession | None
```

Load the session, or return ``None`` when there is none.

##### `save`

```python
async def save(self, session: StoredSession) -> None
```

Save ``session``, replacing any session already stored.

### `SessionStoreError`

```python
class SessionStoreError(NhostError):
    def __init__(operation: str, error: Exception) -> None
```

Raised when a session store cannot load, save or delete a session.

The store's own exception is kept as ``error`` and as ``__cause__``.

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

#### Properties

##### `user_id`

```python
@property
def user_id(self) -> str | None
```

The ID of the user this session is for, or ``None`` if it names none.

Read from ``user``, or from the access token's ``sub`` claim when the
auth service omitted the user.
