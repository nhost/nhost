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

```go
var ErrAccessTokenWithAdminSession = errors.New(
	"a request with a per-request access token cannot use an admin session",
)
```

ErrAccessTokenWithAdminSession fails a request made with
[session.WithAccessToken] through the admin-session middleware. The GraphQL
engine gives the admin secret precedence over a token, so sending both would
run the request as admin and silently ignore the user it was meant for. To act
as a user with the admin secret, set AdminSessionOptions.Role and
SessionVariables instead.

## Functions

### `AttachAccessToken`

```go
func AttachAccessToken(storage *session.Storage, serviceURL string) transport.Middleware
```

AttachAccessToken attaches "Authorization: Bearer &lt;access_token&gt;" to requests
for serviceURL. The token is the one set on the request context with
[session.WithAccessToken], or else that of the stored session the context
selects ([session.WithUserID]); storage may be nil when there is no session
storage. It should run after the refresh middleware so the freshest token is
used, and skips requests that already carry an Authorization header. If the
session store cannot be read, the request fails.

### `SessionRefresh`

```go
func SessionRefresh(
	authClient *auth.Client,
	storage *session.Storage,
	marginSeconds int,
) transport.Middleware
```

SessionRefresh refreshes the session the request selects (see
[session.WithUserID]) before the request when its token is near expiry. It
skips requests that already carry an Authorization header or a per-request
token ([session.WithAccessToken]), and the token endpoint itself (to avoid
recursively refreshing during a refresh). If the refresh itself fails
([session.ErrRefreshFailed]) the request goes ahead with the stored token; if
the session store cannot be read or updated, the request fails.

### `UpdateSessionFromResponse`

```go
func UpdateSessionFromResponse(storage *session.Storage, authURL string) transport.Middleware
```

UpdateSessionFromResponse persists session data returned by auth endpoints
under authURL, keyed by the session's user, and on sign-out clears the session
the request selects (see [session.WithUserID]). Requests made with a
per-request token ([session.WithAccessToken]) act for a caller whose session
the client does not hold, so they leave storage alone. It reads and then
restores the response body so downstream decoding still works.

If the backend fails to store or clear the session, the request fails with
that error even though the auth service succeeded. Otherwise a sign-in would
report success while nothing was saved, and the next request would run as
whoever was stored before, or as nobody.

### `WithAdminSession`

```go
func WithAdminSession(options AdminSessionOptions, serviceURL string) transport.Middleware
```

WithAdminSession attaches x-hasura-admin-secret and optional role/session
variables to requests for serviceURL. Admin sessions are only sent over HTTPS
or to a loopback development server unless AllowInsecureHTTP is enabled. A
request carrying a per-request token ([session.WithAccessToken]) fails with
[ErrAccessTokenWithAdminSession] instead of being sent with both.

### `WithHeaders`

```go
func WithHeaders(defaultHeaders http.Header) transport.Middleware
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

