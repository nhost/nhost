---
title: Main
---

The Nhost client.

## Functions

### `generate_service_url`

```python
def generate_service_url(service_type: ServiceType, *, subdomain: str | None = None, region: str | None = None, custom_url: str | None = None) -> str
```

Build a normalized service URL.

An explicit ``custom_url`` takes precedence. Otherwise ``subdomain`` and
``region`` must be supplied together; omitting both selects the local Nhost
development URL.

```python
>>> generate_service_url("auth", subdomain="demo", region="eu-central-1")
'https://demo.auth.eu-central-1.nhost.run/v1'
>>> generate_service_url("graphql")
'https://local.graphql.local.nhost.run/v1'
>>> generate_service_url("functions", custom_url="http://localhost:1337/v1/")
'http://localhost:1337/v1'
```

## Type aliases

### `ServiceType`

```python
ServiceType = Literal['auth', 'storage', 'graphql', 'functions']
```

## Classes

### `Nhost`

```python
class Nhost:
    def __init__(*, subdomain: str | None = None, region: str | None = None, auth_url: str | None = None, storage_url: str | None = None, graphql_url: str | None = None, functions_url: str | None = None, session_store: SessionStore | None = None, multi_user_session_store: MultiUserSessionStore | None = None, admin: AdminSessionOptions | None = None, middleware: Sequence[Middleware] = (), http_client: httpx.AsyncClient | None = None, timeout: httpx.Timeout | float | None = Timeout(connect=10.0, read=300.0, write=300.0, pool=60.0)) -> None
```

Asynchronous access to Nhost's Auth, Storage, GraphQL and Functions services.

Every argument is a keyword. Services are addressed by ``subdomain`` and
``region`` (together), by an explicit ``*_url`` per service, or, with
neither, by the local development environment.

A client manages sessions only when given a store: ``session_store`` for a
client acting for one user (a CLI, a script, a test), or
``multi_user_session_store`` for a server acting for many, which says which
user each request is for with `with_user_id`. Its requests then get the
stored access token, refreshed before it expires, and sign-in and sign-out
responses update the store. Without a store, requests carry no user token
unless the caller supplies one with `with_access_token`.

``admin`` sends an admin secret to Storage, GraphQL and Functions. It cannot
be combined with a session store or a caller's token, because the GraphQL
engine lets the admin secret override the user's token; use a separate
client for each, or set a role and session variables in
`AdminSessionOptions`. Never use an admin secret in client-side code.

``middleware`` runs on every service request before the SDK's own, in list
order. ``timeout`` applies to each SDK-built request, including when
``http_client`` is supplied; a timeout set explicitly for one request takes
precedence. A supplied ``http_client`` is left open by `aclose`.

```python
>>> import asyncio, uuid
>>> from nhost.auth import SignUpEmailPasswordRequest
>>> from nhost.session import MemoryStore
>>> async def main() -> str | None:
...     async with Nhost(
...         subdomain="local", region="local", session_store=MemoryStore()
...     ) as nhost:
...         await nhost.auth.sign_up_email_password(
...             body=SignUpEmailPasswordRequest(
...                 email=f"ada-{uuid.uuid4()}@example.com",
...                 password=str(uuid.uuid4()),
...             )
...         )
...         session = await nhost.get_session()
...         return (session.decoded_token.hasura_claims or {}).get(
...             "x-hasura-default-role"
...         )
>>> asyncio.run(main())
'user'
```

#### Fields

| Field | Type |
| --- | --- |
| `auth` | `nhost.auth.AuthClient` |
| `storage` | `nhost.storage.StorageClient` |
| `graphql` | `nhost.graphql.Client` |
| `functions` | `nhost.functions.Client` |

#### Properties

##### `session_manager`

```python
@property
def session_manager(self) -> SessionManager | None
```

The sessions this client and its middleware share, if it has a store.

#### Methods

##### `aclose`

```python
async def aclose(self) -> None
```

Close the internally owned HTTP connection pool, if any.

A handle from `with_user_id` or `with_access_token` owns
nothing, so closing one does nothing.

##### `clear_session`

```python
async def clear_session(self) -> None
```

Remove the session this handle selects, without a sign-out request.

##### `get_session`

```python
async def get_session(self) -> StoredSession | None
```

Return the stored session this handle selects, if any.

Raises `NoSessionStoreError` on a client without
a session store, and `SessionStoreError` if the
store cannot be read.

##### `refresh_session`

```python
async def refresh_session(self, margin_seconds: int = 60) -> StoredSession | None
```

Refresh the session this handle selects if it expires within the margin.

See `refresh`.

##### `with_access_token`

```python
def with_access_token(self, access_token: str) -> Nhost
```

Return a handle whose requests authenticate with ``access_token``.

For a server acting on behalf of a caller that sent its own token. The
token is attached as-is: it is never stored, refreshed or replaced by a
session from a response, and the client's session store is left alone.
The handle shares this client's connection pool and configuration;
closing it closes nothing.

Raises `ValueError` on a client with an admin secret, because
the GraphQL engine would let the admin secret override the token.

##### `with_user_id`

```python
def with_user_id(self, user_id: str) -> Nhost
```

Return a handle whose requests use the stored session of ``user_id``.

It is how a server built with ``multi_user_session_store`` says which
user a request is for. The handle shares this client's connection pool,
configuration and sessions; closing it closes nothing.

``user_id`` must come from something the caller has already verified,
such as its own authenticated cookie session. Never take it from an
access token a client sent: the SDK does not verify its claims, so a
forged token could select another user's stored session.

Without a user ID, a request uses the one session of a
`SessionStore` and no session of a
`MultiUserSessionStore`. With one, a
`SessionStore`'s session is used only if it is
that user's.
