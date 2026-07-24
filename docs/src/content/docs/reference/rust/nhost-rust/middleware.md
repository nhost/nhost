---
title: Middleware
---

Fetch chain functions implementing session refresh, access-token
attachment, session capture, and role/header/admin injection. Mirrors
`@nhost/nhost-js`'s fetch middleware set.

## Functions

### `attach_access_token`

```rust
fn attach_access_token(storage: SessionStorage) -> ChainFunction
```

Attaches `Authorization: Bearer <token>` from the stored session, unless the
request already carries one. Should run after the refresh middleware.

### `session_refresh`

```rust
fn session_refresh(auth: Arc<Client>, storage: SessionStorage, margin: i64) -> ChainFunction
```

Refreshes the session before a request when the token is near expiry. Skips
requests that already carry an Authorization header and the token endpoint.

### `update_session_from_response`

```rust
fn update_session_from_response(storage: SessionStorage) -> ChainFunction
```

Persists session data returned by auth endpoints and clears it on sign-out.

### `with_admin_session`

```rust
fn with_admin_session(options: AdminSessionOptions) -> ChainFunction
```

Attaches `x-hasura-admin-secret` and optional role/session variables.

### `with_headers`

```rust
fn with_headers(headers: HashMap<String, String>) -> ChainFunction
```

Attaches default headers, preserving any request-specific values.

### `with_role`

```rust
fn with_role(role: String) -> ChainFunction
```

Sets `x-hasura-role` on requests that don't already specify it.

## Structs

### `AdminSessionOptions`

```rust
struct AdminSessionOptions
```

Admin session configuration.

Security warning: never use in untrusted/client code — the admin secret
grants unrestricted database access.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `admin_secret` | `String` |  |
| `role` | `Option<String>` |  |
| `session_variables` | `HashMap<String, String>` |  |

#### Trait implementations

- `Default`

## Constants

### `DEFAULT_MARGIN_SECONDS`

```rust
const DEFAULT_MARGIN_SECONDS: i64 = session::DEFAULT_MARGIN_SECONDS
```

Default seconds before expiry at which the refresh middleware refreshes.
