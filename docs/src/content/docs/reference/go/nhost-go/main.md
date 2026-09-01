---
title: Main
---

Package nhost is the top-level Nhost SDK client. It bundles the auth,
storage, graphql, and functions clients over a shared session store and
per-service HTTP middleware.

Use [New] for app clients (automatic refresh + token attachment),
[NewServerClient] for trusted server contexts with explicit storage, and
[NewBareClient] for a client with no middleware beyond what you supply via
[Options].Configure.

## Constants and Variables

```go
const DefaultRefreshMarginSeconds = 60
```

DefaultRefreshMarginSeconds is the default refresh margin used by the
client-side middleware and [Client.RefreshSession].

```go
var ErrServerClientStorageRequired = errors.New(
	"NewServerClient requires explicit options.Storage " +
		"(use a per-request/user backend to avoid leaking sessions)",
)
```

ErrServerClientStorageRequired is returned by [NewServerClient] when no
explicit storage backend is provided.

## Functions

### `GenerateServiceURL`

```go
func GenerateServiceURL(serviceType ServiceType, subdomain, region, customURL string) string
```

GenerateServiceURL builds the base URL for an Nhost service. Precedence: an
explicit customURL wins; otherwise a cloud URL is built from
subdomain/region; otherwise the local development URL is used.

### `clientSideSessionMiddleware`

```go
func clientSideSessionMiddleware(c *Config)
```

clientSideSessionMiddleware enables automatic session refresh, token
attachment, and session capture on every service.

### `serverSideSessionMiddleware`

```go
func serverSideSessionMiddleware(c *Config)
```

serverSideSessionMiddleware enables token attachment and session capture, but
no automatic refresh.

## Types

### `Client`

```go
type Client struct {
	Auth           *auth.Client
	Storage        *storage.Client
	GraphQL        *graphql.Client
	Functions      *functions.Client
	SessionStorage *session.Storage
}
```

Client provides unified access to Nhost auth, storage, graphql, and
functions.

#### `New`

```go
func New(options Options) *Client
```

New creates an app client with automatic refresh + token attachment. This is
the client most applications want.

#### `NewBareClient`

```go
func NewBareClient(options Options) *Client
```

NewBareClient creates a client with no middleware beyond what options.Configure
supplies. Use it when you want full control over the request pipeline.

#### `NewServerClient`

```go
func NewServerClient(options Options) (*Client, error)
```

NewServerClient creates a server client with explicit storage and no
automatic refresh. It requires options.Storage — sharing a process-wide
session store between users can leak tokens across requests, so pass a
per-request/user backend.

#### `build`

```go
func build(options Options, defaults ...ConfigureFunc) *Client
```

build constructs a client, running defaults before the caller's
options.Configure so session middleware wraps user middleware.

#### `ClearSession`

```go
func (c *Client) ClearSession()
```

ClearSession removes the current session from storage (client-side sign-out).

#### `GetUserSession`

```go
func (c *Client) GetUserSession() (*session.StoredSession, bool)
```

GetUserSession returns the current session from storage, or (nil, false).

#### `RefreshSession`

```go
func (c *Client) RefreshSession(
	ctx context.Context,
	marginSeconds int,
) (*session.StoredSession, error)
```

RefreshSession refreshes the session using the stored refresh token.

### `Config`

```go
type Config struct {
	// RefreshClient is a bare auth client (no middleware) that the
	// session-refresh middleware uses to reach the token endpoint, avoiding a
	// dependency cycle with the auth client under construction.
	RefreshClient *auth.Client
	// SessionStorage is the session store shared across the client's services.
	SessionStorage *session.Storage

	authMW      []transport.Middleware
	storageMW   []transport.Middleware
	graphqlMW   []transport.Middleware
	functionsMW []transport.Middleware
}
```

Config accumulates the per-service middleware applied while a client is
built. Configuration functions ([ConfigureFunc]) mutate it via [Config.UseAll]
and [Config.UseDataServices].

#### `UseAll`

```go
func (c *Config) UseAll(mw ...transport.Middleware)
```

UseAll applies middleware to every service: auth, storage, graphql, and
functions.

#### `UseDataServices`

```go
func (c *Config) UseDataServices(mw ...transport.Middleware)
```

UseDataServices applies middleware to storage, graphql, and functions, but
not auth. It is used for admin credentials, which must never be attached to
auth requests.

### `ConfigureFunc`

```go
type ConfigureFunc func(c *Config)
```

ConfigureFunc customises a client during construction by adding middleware to
the [Config].

#### `WithAdminSession`

```go
func WithAdminSession(options middleware.AdminSessionOptions) ConfigureFunc
```

WithAdminSession applies admin-secret middleware to storage, graphql, and
functions (never auth).

Security warning: never use in client-side code — the admin secret grants
unrestricted database access.

#### `WithMiddleware`

```go
func WithMiddleware(mw ...transport.Middleware) ConfigureFunc
```

WithMiddleware applies arbitrary middleware to all four services.

### `Options`

```go
type Options struct {
	Subdomain    string
	Region       string
	AuthURL      string
	StorageURL   string
	GraphQLURL   string
	FunctionsURL string
	Storage      session.Backend
	HTTPClient   *http.Client
	Configure    []ConfigureFunc
}
```

Options configures the creation of an Nhost client.

### `ServiceType`

```go
type ServiceType string
```

ServiceType is one of the Nhost services.

