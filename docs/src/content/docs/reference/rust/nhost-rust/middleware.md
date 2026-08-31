---
title: Middleware
---

Request-side middleware implementing `reqwest_middleware::Middleware`.

All middleware here only mutates the outgoing request (headers) or triggers
a refresh before sending; none reads the response body. Response-side
session capture lives in the auth client (`crate::http::send`) because a
browser `reqwest::Response` cannot be rebuilt from buffered bytes.

# Structs

## `AdminSession`

```rust
struct AdminSession
```

Attaches `x-hasura-admin-secret` (plus optional role and session variables).

Security warning: never use in client-side code — it grants admin access.

### Fields

| Field | Type | Description |
| --- | --- | --- |
| `options` | `AdminSessionOptions` |  |

## `AdminSessionOptions`

```rust
struct AdminSessionOptions
```

Options for the admin-secret middleware.

### Fields

| Field | Type | Description |
| --- | --- | --- |
| `admin_secret` | `String` |  |
| `role` | `Option<String>` |  |
| `session_variables` | `HashMap<String, String>` |  |

### Trait implementations

- `Default`

## `AttachToken`

```rust
struct AttachToken
```

Attaches `Authorization: Bearer <token>` from the stored session, unless the
request already carries one. Runs after `SessionRefresh`.

### Fields

| Field | Type | Description |
| --- | --- | --- |
| `storage` | `SessionStorage` |  |

## `SessionRefresh`

```rust
struct SessionRefresh
```

Refreshes the session before a request when the token is near expiry. Skips
requests that already carry an Authorization header and the token endpoint.

### Fields

| Field | Type | Description |
| --- | --- | --- |
| `auth` | `Arc<Client>` |  |
| `storage` | `SessionStorage` |  |
| `margin` | `i64` |  |

## `SetHeaders`

```rust
struct SetHeaders
```

Sets arbitrary headers on every request.

### Fields

| Field | Type | Description |
| --- | --- | --- |
| `headers` | `HashMap<String, String>` |  |

## `SetRole`

```rust
struct SetRole
```

Sets `x-hasura-role` on every request.

### Fields

| Field | Type | Description |
| --- | --- | --- |
| `role` | `String` |  |

# Constants

## `DEFAULT_MARGIN_SECONDS`

```rust
const DEFAULT_MARGIN_SECONDS: i64 = session::DEFAULT_MARGIN_SECONDS
```

Default seconds before expiry at which the refresh middleware refreshes.
