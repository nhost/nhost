---
title: Main
---

Package nhost is the top-level Nhost SDK client. It bundles the auth,
storage, graphql, and functions clients over a shared *http.Client and a
session store.

Use CreateClient for app clients (automatic refresh + token attachment),
CreateServerClient for trusted server contexts with explicit storage, and
CreateNhostClient for a bare client you configure yourself.

## Constants and Variables

```go
const DefaultRefreshMarginSeconds = 60
```

DefaultRefreshMarginSeconds is the default refresh margin used by the
client-side middleware and RefreshSession.

```go
var ErrServerClientStorageRequired = errors.New(
	"CreateServerClient requires explicit options.Storage " +
		"(use a per-request/user backend to avoid leaking sessions)",
)
```

ErrServerClientStorageRequired is returned by CreateServerClient when no
explicit storage backend is provided.

## Functions

### `GenerateServiceURL`

```go
func GenerateServiceURL(serviceType ServiceType, subdomain, region, customURL string) string
```

GenerateServiceURL builds the base URL for an Nhost service. Precedence: an
explicit customURL wins; otherwise a cloud URL is built from
subdomain/region; otherwise the local development URL is used.

### `WithClientSideSessionMiddleware`

```go
func WithClientSideSessionMiddleware(ctx *ConfigureContext)
```

WithClientSideSessionMiddleware enables automatic session refresh, token
attachment, and session capture.

### `WithServerSideSessionMiddleware`

```go
func WithServerSideSessionMiddleware(ctx *ConfigureContext)
```

WithServerSideSessionMiddleware enables token attachment and session capture,
but no automatic refresh.

### `apply`

```go
func apply(ctx *ConfigureContext, chain []fetch.ChainFunction)
```

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

#### `CreateClient`

```go
func CreateClient(options Options) *Client
```

CreateClient creates an app client with automatic refresh + token attachment.

#### `CreateNhostClient`

```go
func CreateNhostClient(options Options) *Client
```

CreateNhostClient creates and configures an Nhost client, applying
options.Configure.

#### `CreateServerClient`

```go
func CreateServerClient(options Options) (*Client, error)
```

CreateServerClient creates a server client with explicit storage and no
automatic refresh. It requires options.Storage — sharing a process-wide
session store between users can leak tokens across requests, so pass a
per-request/user backend.

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

### `ClientConfigurationFn`

```go
type ClientConfigurationFn func(ctx *ConfigureContext)
```

ClientConfigurationFn configures a client during construction.

#### `WithAdminSession`

```go
func WithAdminSession(options middleware.AdminSessionOptions) ClientConfigurationFn
```

WithAdminSession applies admin-secret middleware to storage, graphql, and
functions. Security warning: never use in client-side code.

#### `WithChainFunctions`

```go
func WithChainFunctions(chainFunctions []fetch.ChainFunction) ClientConfigurationFn
```

WithChainFunctions applies arbitrary chain functions to all four clients.

### `ConfigureContext`

```go
type ConfigureContext struct {
	Auth           *auth.Client
	Storage        *storage.Client
	GraphQL        *graphql.Client
	Functions      *functions.Client
	SessionStorage *session.Storage
}
```

ConfigureContext is the set of clients passed to a configuration function.

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
	Configure    []ClientConfigurationFn
}
```

Options configures the creation of an Nhost client.

### `ServiceType`

```go
type ServiceType string
```

ServiceType is one of the Nhost services.

