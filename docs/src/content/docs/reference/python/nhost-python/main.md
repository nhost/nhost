---
title: Main
---

Top-level Nhost client and factory functions.

## Functions

### `create_client`

```python
def create_client(*, subdomain: 'str | None' = None, region: 'str | None' = None, auth_url: 'str | None' = None, storage_url: 'str | None' = None, graphql_url: 'str | None' = None, functions_url: 'str | None' = None, session_storage: 'SessionStorageBackend | None' = None, http_client: 'httpx.AsyncClient | None' = None, configure: 'Sequence[ClientConfiguration]' = (), timeout: 'httpx.Timeout | float | None' = Timeout(connect=10.0, read=300.0, write=300.0, pool=60.0)) -> 'NhostClient'
```

Create an application client with automatic session management.

```python
>>> import asyncio, uuid
>>> from nhost.auth import SignUpEmailPasswordRequest
>>> async def main() -> str | None:
...     async with create_client(subdomain="local", region="local") as nhost:
...         await nhost.auth.sign_up_email_password(
...             body=SignUpEmailPasswordRequest(
...                 email=f"ada-{uuid.uuid4()}@example.com",
...                 password=str(uuid.uuid4()),
...             )
...         )
...         session = await nhost.get_user_session()
...         return (session.decoded_token.hasura_claims or {}).get(
...             "x-hasura-default-role"
...         )
>>> asyncio.run(main())
'user'
```

### `create_nhost_client`

```python
def create_nhost_client(*, subdomain: 'str | None' = None, region: 'str | None' = None, auth_url: 'str | None' = None, storage_url: 'str | None' = None, graphql_url: 'str | None' = None, functions_url: 'str | None' = None, session_storage: 'SessionStorageBackend | None' = None, http_client: 'httpx.AsyncClient | None' = None, configure: 'Sequence[ClientConfiguration]' = (), timeout: 'httpx.Timeout | float | None' = Timeout(connect=10.0, read=300.0, write=300.0, pool=60.0)) -> 'NhostClient'
```

Create a bare Nhost client from explicit keyword configuration.

### `create_server_client`

```python
def create_server_client(*, session_storage: 'SessionStorageBackend', subdomain: 'str | None' = None, region: 'str | None' = None, auth_url: 'str | None' = None, storage_url: 'str | None' = None, graphql_url: 'str | None' = None, functions_url: 'str | None' = None, http_client: 'httpx.AsyncClient | None' = None, configure: 'Sequence[ClientConfiguration]' = (), timeout: 'httpx.Timeout | float | None' = Timeout(connect=10.0, read=300.0, write=300.0, pool=60.0)) -> 'NhostClient'
```

Create a server client with explicit per-user session storage.

### `generate_service_url`

```python
def generate_service_url(service_type: 'ServiceType', *, subdomain: 'str | None' = None, region: 'str | None' = None, custom_url: 'str | None' = None) -> 'str'
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
```

### `with_admin_session`

```python
def with_admin_session(options: 'AdminSessionOptions') -> 'ClientConfiguration'
```

Apply admin credentials to Storage, GraphQL, and Functions requests.

Never use an admin secret in client-side code.

### `with_chain_functions`

```python
def with_chain_functions(chain_functions: 'Sequence[ChainFunction]') -> 'ClientConfiguration'
```

Apply custom HTTP middleware to every service client.

### `with_client_side_session_middleware`

```python
def with_client_side_session_middleware(ctx: 'ConfigureContext') -> 'None'
```

Enable automatic refresh, token attachment, and session capture.

### `with_server_side_session_middleware`

```python
def with_server_side_session_middleware(ctx: 'ConfigureContext') -> 'None'
```

Enable token attachment and session capture without automatic refresh.

## Classes

### `ConfigureContext`

```python
class ConfigureContext
```

Clients and session storage passed to a configuration callback.

#### Fields

| Field | Type |
| --- | --- |
| `auth` | `auth_module.AuthClient` |
| `storage` | `storage_module.StorageClient` |
| `graphql` | `graphql_module.Client` |
| `functions` | `functions_module.Client` |
| `session_storage` | `SessionStorage` |

### `NhostClient`

```python
class NhostClient
```

Unified asynchronous access to Nhost services and session state.

#### Methods

##### `aclose`

```python
async def aclose(self) -> 'None'
```

Close the internally owned HTTP connection pool, if any.

##### `clear_session`

```python
async def clear_session(self) -> 'None'
```

Remove the current session without making a sign-out request.

##### `get_user_session`

```python
async def get_user_session(self) -> 'StoredSession | None'
```

Return the current session, if one is stored.

##### `refresh_session`

```python
async def refresh_session(self, margin_seconds: 'int' = 60) -> 'StoredSession | None'
```

Refresh the session when it is close to expiry.
