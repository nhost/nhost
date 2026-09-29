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

A request carrying a caller's own token
(`Nhost::with_access_token`) fails instead:
the GraphQL engine checks the admin secret before the token, so it would run
as admin and silently ignore the user it was meant for. To act as a user
with the admin secret, set `AdminSessionOptions::role` and
`AdminSessionOptions::session_variables`.

Security warning: never use in client-side code — it grants admin access.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `options` | `AdminSessionOptions` | The admin secret, role and session variables to send. |
| `service_url` | `String` | The base URL of the service this middleware is installed on. Admin headers are written only for requests inside this origin, and only over HTTPS or to a loopback host unless `AdminSessionOptions::allow_insecure_http` is set. |

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
| `allow_insecure_http` | `bool` | Permits sending the admin secret over cleartext HTTP to a non-loopback host. Defaults to `false`; enable only on a trusted development network. |

#### Trait implementations

- `Default`

### `AttachToken`

```rust
struct AttachToken
```

Attaches `Authorization: Bearer <token>` unless the request already carries
one. The token is the caller's own
(`Nhost::with_access_token`), or else that
of the stored session the request selects
(`Nhost::with_user_id`). Runs after
`SessionRefresh`. If the session store cannot be read, the request fails.

The token is written only for requests inside `service_url`'s origin. A
request that has left that origin has that bearer stripped, so a
retargeting middleware cannot forward the user's access token to another
host; an unrelated caller-supplied `Authorization` value is preserved.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `sessions` | `Option<SessionManager>` | The sessions the access token is read from, or `None` for a client without a session store, which attaches only a caller's own token. |
| `service_url` | `String` | The base URL of the service this middleware is installed on. |

### `SessionRefresh`

```rust
struct SessionRefresh
```

Refreshes the session the request selects
(`Nhost::with_user_id`) before the request when
its token is near expiry. Skips requests that already carry an Authorization
header or a caller's own token
(`Nhost::with_access_token`), and this
client's exact auth refresh endpoint. A failed refresh request lets the
request go ahead with the stored token; a session store that cannot be read
or updated fails the request.

Prefer a middleware-free `auth::Client` here: refreshing through a client
that carries this middleware relies on the refresh-endpoint check to avoid
recursing into itself.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `auth` | `Arc<auth::Client>` | The client used to call the refresh endpoint. |
| `sessions` | `SessionManager` | The sessions the refresh token is read from and the new session written to. |
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
| `Session` | A bearer token read from the session store. |
| `Default` | A default configured on `crate::NhostBuilder`. |
| `Admin` | An admin-session role or session variable. |
| `Scoped` | A header configured on a scoped client clone. |

## Constants

### `DEFAULT_MARGIN_SECONDS`

```rust
const DEFAULT_MARGIN_SECONDS: i64 = session::DEFAULT_MARGIN_SECONDS
```

Default seconds before expiry at which the refresh middleware refreshes.
