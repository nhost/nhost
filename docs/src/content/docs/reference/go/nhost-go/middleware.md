---
title: Middleware
---

Package middleware provides the HTTP middleware that implements session
refresh, access-token attachment, session capture, and role/header/admin
injection. Each function returns a [transport.Middleware] that decorates an
[http.RoundTripper].

## Constants and Variables

```go
const DefaultMarginSeconds = 60
```

DefaultMarginSeconds is the default number of seconds before expiry at which
the session-refresh middleware refreshes the access token.

## Functions

### `AttachAccessToken`

```go
func AttachAccessToken(storage *session.Storage, serviceURL string) transport.Middleware
```

AttachAccessToken attaches "Authorization: Bearer &lt;access_token&gt;" from the
stored session to requests for serviceURL. It should run after the refresh
middleware so the freshest token is used, and skips requests that already
carry an Authorization header.

### `SessionRefresh`

```go
func SessionRefresh(
	authClient *auth.Client,
	storage *session.Storage,
	marginSeconds int,
) transport.Middleware
```

SessionRefresh refreshes the session before a request when the token is near
expiry. It skips requests that already carry an Authorization header and the
token endpoint itself (to avoid recursively refreshing during a refresh).

### `UpdateSessionFromResponse`

```go
func UpdateSessionFromResponse(storage *session.Storage, authURL string) transport.Middleware
```

UpdateSessionFromResponse persists session data returned by auth endpoints
under authURL and clears it on sign-out. It reads and then restores the
response body so downstream decoding still works.

### `WithAdminSession`

```go
func WithAdminSession(options AdminSessionOptions, serviceURL string) transport.Middleware
```

WithAdminSession attaches x-hasura-admin-secret and optional role/session
variables to requests for serviceURL. Admin sessions are only sent over HTTPS
or to a loopback development server unless AllowInsecureHTTP is enabled.

### `WithHeaders`

```go
func WithHeaders(defaultHeaders map[string]string) transport.Middleware
```

WithHeaders attaches default headers, preserving any request-specific values.
The caller is responsible for not supplying credentials: default headers are
intentionally unscoped and are reapplied when the HTTP client follows a
redirect. Use the scoped access-token or admin-session middleware for secrets.

### `WithRole`

```go
func WithRole(role string) transport.Middleware
```

WithRole sets x-hasura-role on requests that don't already specify it.

## Types

### `AdminSessionOptions`

```go
type AdminSessionOptions struct {
	AdminSecret      string
	Role             string
	SessionVariables map[string]string
	// AllowInsecureHTTP sends admin credentials in cleartext to the configured
	// service origin. Prefer HTTPS; enable this only for a trusted development
	// network when loopback is not usable.
	AllowInsecureHTTP bool
}
```

AdminSessionOptions configures the admin-session middleware.

Security warning: never use in untrusted/client code — the admin secret
grants unrestricted database access.

