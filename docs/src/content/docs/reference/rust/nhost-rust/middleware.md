---
title: Middleware
---

Request-side middleware implementing `reqwest_middleware::Middleware`.

All middleware here only mutates the outgoing request (headers) or triggers
a refresh before sending; none reads the response body. Response-side
session capture lives in the auth client (`crate::http::send`) because a
browser `reqwest::Response` cannot be rebuilt from buffered bytes.

## Structs

### `AdminSession`

```rust
struct AdminSession
```

Attaches `x-hasura-admin-secret` (plus optional role and session variables).

Security warning: never use in client-side code — it grants admin access.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `options` | `AdminSessionOptions` | The admin secret, role and session variables to send. |

### `AdminSessionOptions`

```rust
struct AdminSessionOptions
```

Options for the admin-secret middleware.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `admin_secret` | `String` | The project's admin secret, sent as `x-hasura-admin-secret`. |
| `role` | `Option<String>` | Role to impersonate, sent as `x-hasura-role`. |
| `session_variables` | `HashMap<String, String>` | Session variables, each sent as `x-hasura-<key>`. |

#### Trait implementations

- `Default`

### `AttachToken`

```rust
struct AttachToken
```

Attaches `Authorization: Bearer <token>` from the stored session, unless the
request already carries one. Runs after `SessionRefresh`.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `storage` | `SessionStorage` | The store the access token is read from. |

### `SessionRefresh`

```rust
struct SessionRefresh
```

Refreshes the session before a request when the token is near expiry. Skips
requests that already carry an Authorization header and the token endpoint.

Prefer a middleware-free `auth::Client` here: refreshing through a client
that carries this middleware relies on the token-endpoint check to avoid
recursing into itself.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `auth` | `Arc<Client>` | The client used to call the refresh endpoint. |
| `storage` | `SessionStorage` | The store the refresh token is read from and the new session written to. |
| `margin` | `i64` | Seconds before expiry at which to refresh; `0` always refreshes. |

### `SetHeaders`

```rust
struct SetHeaders
```

Sets arbitrary headers on every request.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `headers` | `HashMap<String, String>` | Header names and values, applied verbatim (existing values are replaced). |

### `SetRole`

```rust
struct SetRole
```

Sets `x-hasura-role` on every request.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `role` | `String` | The Hasura role to request. |

## Constants

### `DEFAULT_MARGIN_SECONDS`

```rust
const DEFAULT_MARGIN_SECONDS: i64 = session::DEFAULT_MARGIN_SECONDS
```

Default seconds before expiry at which the refresh middleware refreshes.
