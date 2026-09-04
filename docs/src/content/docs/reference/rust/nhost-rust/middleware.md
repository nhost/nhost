---
title: Middleware
---

Request-side middleware implementing `reqwest_middleware::Middleware`.

All middleware here only mutates the outgoing request (headers) or triggers
a refresh before sending; none reads the response body. Response-side
session updates live in the auth client (`crate::http::send`) because a
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

###### Sensitive data

`Debug` redacts `admin_secret`, but it leaves the role and
caller-controlled session-variable map visible. Those variables are sent as
`x-hasura-*` headers; do not log this value when they contain sensitive data.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `admin_secret` | `String` | The project's admin secret, sent as `x-hasura-admin-secret`. |
| `role` | `Option<String>` | Role to impersonate, sent as `x-hasura-role`. |
| `session_variables` | `HashMap<String, String>` | Session variables, each sent as `x-hasura-<key>`. They are applied after `admin_secret` and `role` at the same priority, so `admin-secret` and `role` keys override those dedicated fields. |

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
requests that already carry an Authorization header and this client's exact
auth refresh endpoint.

Prefer a middleware-free `auth::Client` here: refreshing through a client
that carries this middleware relies on the refresh-endpoint check to avoid
recursing into itself.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `auth` | `Arc<auth::Client>` | The client used to call the refresh endpoint. |
| `storage` | `SessionStorage` | The store the refresh token is read from and the new session written to. |
| `margin` | `i64` | Seconds before expiry at which to refresh; `0` always refreshes. Negative or unrepresentably large values fail the request with a configuration error. |

### `SetHeaders`

```rust
struct SetHeaders
```

Sets arbitrary headers on every request at an explicit priority.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `headers` | `HashMap<String, String>` | Header names and values to apply. |
| `priority` | `HeaderPriority` | The precedence assigned to every header in `headers`. |

### `SetRole`

```rust
struct SetRole
```

Sets `x-hasura-role` on every request at an explicit priority.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `role` | `String` | The Hasura role to request. |
| `priority` | `HeaderPriority` | The precedence assigned to the role header. |

## Enums

### `HeaderPriority`

```rust
enum HeaderPriority
```

Precedence assigned to headers written by SDK middleware.

Headers already present on the request but absent from the middleware map
were set while building the request and always win. The declaration order
is semantic because `Ord` determines which middleware value wins: variants
are listed from lowest to highest priority, and new variants must be inserted
at the position matching their intended precedence.

#### Variants

| Variant | Description |
| --- | --- |
| `Session` | A bearer token read from session storage. |
| `Default` | A default configured on `crate::NhostBuilder`. |
| `Admin` | An admin-session role or session variable. |
| `Scoped` | A header configured on a scoped client clone. |

## Constants

### `DEFAULT_MARGIN_SECONDS`

```rust
const DEFAULT_MARGIN_SECONDS: i64 = session::DEFAULT_MARGIN_SECONDS
```

Default seconds before expiry at which the refresh middleware refreshes.
