---
title: Main
---

Package nhost is the top-level Nhost SDK client. It bundles the auth,
storage, graphql, and functions clients over an optional session store and
per-service HTTP middleware.

[New] builds every client, configured with options:

	// no session management: pass a caller's token per request, if any
	client, err := nhost.New(nhost.WithProject(subdomain, region))

	// automatic session management (sign-in stores, requests refresh and attach)
	client, err := nhost.New(
		nhost.WithProject(subdomain, region),
		nhost.WithSessionStorage(&session.FileStorage{Path: path}),
	)

	// admin client
	client, err := nhost.New(
		nhost.WithProject(subdomain, region),
		nhost.WithAdminSecret(middleware.AdminSessionOptions{AdminSecret: secret}),
	)

Which session a request uses comes from its context: [session.WithUserID]
selects a stored session, and [session.WithAccessToken] supplies a caller's
own token without touching storage.

## Constants and Variables

```go
const DefaultRefreshMarginSeconds = 60
```

DefaultRefreshMarginSeconds is the refresh margin used by the session-refresh
middleware: a stored session is refreshed before a request once its access
token expires within this many seconds.

```go
var (
	// ErrInvalidProject is returned by [New] when [WithProject] is given an
	// empty subdomain or region.
	ErrInvalidProject = errors.New("WithProject requires a subdomain and a region")
	// ErrInvalidServiceURL is returned by [New] when a service URL is not an
	// HTTP(S) URL with a host.
	ErrInvalidServiceURL = errors.New("invalid service URL: expected an HTTP(S) URL with a host")
	// ErrNilSessionStorage is returned by [New] when [WithSessionStorage] is
	// given a nil backend.
	ErrNilSessionStorage = errors.New("WithSessionStorage requires a backend")
	// ErrEmptyAdminSecret is returned by [New] when [WithAdminSecret] is given
	// options without an admin secret.
	ErrEmptyAdminSecret = errors.New("WithAdminSecret requires an admin secret")
	// ErrAdminSecretWithSessionStorage is returned by [New] when both
	// [WithAdminSecret] and [WithSessionStorage] are given. The GraphQL engine
	// gives the admin secret precedence over a user's token, so every request
	// would run as admin and silently ignore the user. Use two clients, or act
	// as a user with the admin secret through AdminSessionOptions.Role and
	// SessionVariables.
	ErrAdminSecretWithSessionStorage = errors.New(
		"WithAdminSecret and WithSessionStorage cannot be combined",
	)
	// ErrNoSessionStorage is returned by the [Client] session methods of a
	// client built without [WithSessionStorage].
	ErrNoSessionStorage = errors.New("client has no session storage (see WithSessionStorage)")
)
```

## Functions

### `GenerateServiceURL`

```go
func GenerateServiceURL(serviceType ServiceType, subdomain, region, customURL string) string
```

GenerateServiceURL builds the base URL for an Nhost service. Precedence: an
explicit customURL wins; otherwise a cloud URL is built from
subdomain/region; otherwise the local development URL is used. A custom URL
without a scheme defaults to HTTP for localhost and loopback addresses, and
HTTPS otherwise.

## Types

### `Client`

```go
type Client struct {
	// Auth provides user authentication and account-management operations.
	Auth *auth.Client
	// Storage provides file upload, download, and metadata operations.
	Storage *storage.Client
	// GraphQL executes queries and mutations against the project's GraphQL API.
	GraphQL *graphql.Client
	// Functions invokes serverless functions deployed to the project.
	Functions *functions.Client
	// contains filtered or unexported fields
}
```

Client provides unified access to Nhost auth, storage, graphql, and
functions. A Client and its service clients are safe for concurrent use when
the configured [session.Backend] satisfies the interface's concurrency
requirement.

#### `New`

```go
func New(opts ...Option) (*Client, error)
```

New creates a client configured by opts. It returns an error for an invalid
option or service URL, and for [WithAdminSecret] combined with
[WithSessionStorage].

#### `ClearSession`

```go
func (c *Client) ClearSession(ctx context.Context) error
```

ClearSession removes the stored session ctx selects (client-side sign-out).
It returns an error when the session could not be cleared, so a caller is
never told a user was signed out while their credentials remain stored.

#### `RefreshSession`

```go
func (c *Client) RefreshSession(
	ctx context.Context,
	marginSeconds int,
) (*session.StoredSession, error)
```

RefreshSession refreshes the stored session ctx selects using its refresh
token. A marginSeconds value of zero forces a refresh. If refresh fails while
the access token is still valid, both the existing session and the error are
returned. See [session.RefreshSession].

#### `Session`

```go
func (c *Client) Session(ctx context.Context) (*session.StoredSession, error)
```

Session returns the stored session ctx selects (see [session.WithUserID]). It
returns (nil, nil) when that user is not signed in, and an error only when
the session store could not be read — an unreadable store is not a signed out
user — or the client has no session storage.

### `Option`

```go
type Option func(o *options) error
```

Option configures a client built by [New].

#### `WithAdminSecret`

```go
func WithAdminSecret(adminOptions middleware.AdminSessionOptions) Option
```

WithAdminSecret authenticates storage, graphql, and functions requests (never
auth) with the admin secret. Admin credentials are sent only over HTTPS or to
a loopback development server unless options.AllowInsecureHTTP is enabled. It
cannot be combined with [WithSessionStorage], and a request made with
[session.WithAccessToken] fails rather than send both credentials.

Security warning: never use in client-side code — the admin secret grants
unrestricted database access. Prefer HTTPS; AllowInsecureHTTP sends the
secret in cleartext and should be limited to trusted development networks.

#### `WithAuthURL`

```go
func WithAuthURL(serviceURL string) Option
```

WithAuthURL sets the complete base URL of the auth service, overriding
[WithProject] for auth.

#### `WithFunctionsURL`

```go
func WithFunctionsURL(serviceURL string) Option
```

WithFunctionsURL sets the complete base URL of the functions service,
overriding [WithProject] for functions.

#### `WithGraphQLURL`

```go
func WithGraphQLURL(serviceURL string) Option
```

WithGraphQLURL sets the complete URL of the GraphQL service, overriding
[WithProject] for GraphQL.

#### `WithHTTPClient`

```go
func WithHTTPClient(httpClient *http.Client) Option
```

WithHTTPClient sets the base HTTP client used by all services. The supplied
client is never mutated and may be shared; service middleware is installed on
independent copies. Without it, a default client with no timeout is used;
per-request deadlines come from the context.Context passed to each method.

#### `WithHTTPHeaders`

```go
func WithHTTPHeaders(headers http.Header) Option
```

WithHTTPHeaders adds default headers to every request of every service,
keeping any value a request sets itself. They are not scoped to a service's
origin, so they must not carry credentials; use [WithAdminSecret] or session
storage for those. Repeated calls merge.

#### `WithMiddleware`

```go
func WithMiddleware(mw ...transport.Middleware) Option
```

WithMiddleware applies middleware to all four services. It runs inside the
SDK's own middleware, so it sees the Authorization header the SDK attached.
Repeated calls append; middleware runs in the order given.

#### `WithProject`

```go
func WithProject(subdomain, region string) Option
```

WithProject targets the Nhost cloud project with the given subdomain and
region. Without it, and without a custom URL for a service, the service's
local development URL is used.

#### `WithSessionStorage`

```go
func WithSessionStorage(backend session.Backend) Option
```

WithSessionStorage enables session management over backend: sign-in and
refresh responses are stored, and each request refreshes and attaches the
session its context selects (see [session.WithUserID]). backend must be safe
for concurrent use by multiple goroutines.

Without it the client keeps no sessions. Requests still authenticate with a
token set by [session.WithAccessToken], and sign-in still returns the session
to the caller.

#### `WithStorageURL`

```go
func WithStorageURL(serviceURL string) Option
```

WithStorageURL sets the complete base URL of the storage service, overriding
[WithProject] for storage.

### `ServiceType`

```go
type ServiceType string
```

ServiceType is one of the Nhost services.

```go
const (
	ServiceAuth      ServiceType = "auth"
	ServiceStorage   ServiceType = "storage"
	ServiceGraphQL   ServiceType = "graphql"
	ServiceFunctions ServiceType = "functions"
)
```

The Nhost service types.

