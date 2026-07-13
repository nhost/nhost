---
title: Middleware
---

Package middleware provides the fetch chain functions that implement session
refresh, access-token attachment, session capture, and role/header/admin
injection. It mirrors @nhost/nhost-js's fetch middleware set.

## Constants and Variables

```go
const DefaultMarginSeconds = 60
```

DefaultMarginSeconds is the default number of seconds before expiry at which
the session-refresh middleware refreshes the access token.

## Functions

### `AttachAccessToken`

```go
func AttachAccessToken(storage *session.Storage) fetch.ChainFunction
```

AttachAccessToken attaches "Authorization: Bearer &lt;access_token&gt;" from the
stored session. It should run after the refresh middleware so the freshest
token is used, and skips requests that already carry an Authorization header.

### `SessionRefresh`

```go
func SessionRefresh(
	authClient *auth.Client,
	storage *session.Storage,
	marginSeconds int,
) fetch.ChainFunction
```

SessionRefresh refreshes the session before a request when the token is near
expiry. It skips requests that already carry an Authorization header and the
token endpoint itself (to avoid recursively refreshing during a refresh).

### `UpdateSessionFromResponse`

```go
func UpdateSessionFromResponse(storage *session.Storage) fetch.ChainFunction
```

UpdateSessionFromResponse persists session data returned by auth endpoints
and clears it on sign-out. It reads and then restores the response body so
downstream decoding still works.

### `WithAdminSession`

```go
func WithAdminSession(options AdminSessionOptions) fetch.ChainFunction
```

WithAdminSession attaches x-hasura-admin-secret and optional role/session
variables.

### `WithHeaders`

```go
func WithHeaders(defaultHeaders map[string]string) fetch.ChainFunction
```

WithHeaders attaches default headers, preserving any request-specific values.

### `WithRole`

```go
func WithRole(role string) fetch.ChainFunction
```

WithRole sets x-hasura-role on requests that don't already specify it.

### `extractSession`

```go
func extractSession(data []byte) *auth.Session
```

## Types

### `AdminSessionOptions`

```go
type AdminSessionOptions struct {
	AdminSecret      string
	Role             string
	SessionVariables map[string]string
}
```

AdminSessionOptions configures the admin-session middleware.

Security warning: never use in untrusted/client code — the admin secret
grants unrestricted database access.

