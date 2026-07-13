---
title: Main
---

Top-level Nhost client and factory functions.

``NhostClient`` bundles the auth, storage, graphql, and functions clients over a
shared :class:`httpx.AsyncClient` and a :class:`SessionStorage`. Use
:func:`create_client` for app clients (automatic refresh + token attachment),
:func:`create_server_client` for trusted server contexts with explicit storage,
and :func:`create_nhost_client` for a bare client you configure yourself.

## Functions

### `create_client`

```python
def create_client(options: 'NhostClientOptions | None' = None) -> 'NhostClient'
```

Create an app client with automatic refresh + token attachment.

This example runs against a local Nhost backend (``./dev-env.sh up``); it is
skipped unless ``NHOST_LOCAL_BACKEND=1``. It signs a new user up, then reads
the default role from the decoded access token.

```python
>>> import asyncio, uuid
>>> from nhost.auth import SignUpEmailPasswordRequest
>>>
>>> async def main() -> str | None:
...     async with create_client(
...         NhostClientOptions(subdomain="local", region="local")
...     ) as nhost:
...         email = f"ada-{uuid.uuid4()}@example.com"
...         await nhost.auth.sign_up_email_password(
...             SignUpEmailPasswordRequest(email=email, password=str(uuid.uuid4()))
...         )
...         stored = nhost.get_user_session()
...         claims = stored.decoded_token.hasura_claims or {}
...         return claims.get("x-hasura-default-role")
>>>
>>> asyncio.run(main())
'user'
```

### `create_nhost_client`

```python
def create_nhost_client(options: 'NhostClientOptions | None' = None) -> 'NhostClient'
```

Create and configure an Nhost client, applying ``options.configure``.

### `create_server_client`

```python
def create_server_client(options: 'NhostClientOptions') -> 'NhostClient'
```

Create a server client with explicit storage and no automatic refresh.

Requires ``options.storage`` — sharing a process-wide session store between
users can leak tokens across requests, so pass a per-request/user backend.

### `generate_service_url`

```python
def generate_service_url(service_type: 'ServiceType', subdomain: 'str | None' = None, region: 'str | None' = None, custom_url: 'str | None' = None) -> 'str'
```

Build the base URL for an Nhost service.

Precedence: an explicit ``custom_url`` wins; otherwise a cloud URL is built
from ``subdomain``/``region``; otherwise the local development URL is used.

```python
>>> generate_service_url("auth", subdomain="demo", region="eu-central-1")
'https://demo.auth.eu-central-1.nhost.run/v1'
>>> generate_service_url("graphql")
'https://local.graphql.local.nhost.run/v1'
>>> generate_service_url("storage", custom_url="http://localhost:1337/v1/storage")
'http://localhost:1337/v1/storage'
```

### `with_admin_session`

```python
def with_admin_session(options: 'AdminSessionOptions') -> 'ClientConfigurationFn'
```

Apply admin-secret middleware to storage, graphql, and functions.

**Security warning:** never use in client-side code.

### `with_chain_functions`

```python
def with_chain_functions(chain_functions: 'list[ChainFunction]') -> 'ClientConfigurationFn'
```

Apply arbitrary chain functions to all four clients.

### `with_client_side_session_middleware`

```python
def with_client_side_session_middleware(ctx: 'ConfigureContext') -> 'None'
```

Automatic session refresh, token attachment, and session capture.

### `with_server_side_session_middleware`

```python
def with_server_side_session_middleware(ctx: 'ConfigureContext') -> 'None'
```

Token attachment and session capture, but no automatic refresh.

## Classes

### `ConfigureContext`

```python
class ConfigureContext
```

The set of clients passed to a configuration function.

### `NhostClient`

```python
class NhostClient
```

Unified access to Nhost auth, storage, graphql, and functions.

#### Methods

##### `aclose`

```python
async def aclose(self) -> 'None'
```

Close the shared HTTP client and its connection pool.

A caller-supplied ``http_client`` (via ``NhostClientOptions``) is left
open — the SDK only closes the client it created itself.

##### `clear_session`

```python
def clear_session(self) -> 'None'
```

Remove the current session from storage (client-side sign-out).

##### `get_user_session`

```python
def get_user_session(self) -> 'StoredSession | None'
```

Return the current session from storage, or ``None``.

##### `refresh_session`

```python
async def refresh_session(self, margin_seconds: 'int' = 60) -> 'StoredSession | None'
```

Refresh the session using the stored refresh token.

### `NhostClientOptions`

```python
class NhostClientOptions
```

Configuration for creating an Nhost client.
