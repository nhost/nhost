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
	// RefreshClient is the bare auth client used for explicit session refreshes.
	// Its transport intentionally excludes session middleware.
	RefreshClient *auth.Client
	// SessionStorage stores and manages the session shared by all service clients.
	SessionStorage *session.Storage
}
```

Client provides unified access to Nhost auth, storage, graphql, and
functions. A Client, its service clients, and its SessionStorage are safe for
concurrent use when the configured [session.Backend] satisfies the
interface's concurrency requirement.

#### `New`

```go
func New(options Options) *Client
```

New creates an app client with automatic refresh and token attachment. This
is the client most single-user applications and command-line tools want.

New is intended for single-user contexts. Do not share a client created by
New between users in a server: when options.Storage is nil, sessions are kept
in one in-memory store owned by the client, so one user's tokens could be
attached to another user's requests. Automatic refresh can also race across
independent request contexts. Use [NewServerClient] with a per-request or
per-user backend instead.

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

RefreshSession refreshes the session using the stored refresh token. A
marginSeconds value of zero forces a refresh. If refresh fails while the
access token is still valid, both the existing session and the error are
returned.

### `Config`

```go
type Config struct {
	// RefreshClient is a bare auth client (no middleware) that the
	// session-refresh middleware uses to reach the token endpoint, avoiding a
	// dependency cycle with the auth client under construction.
	RefreshClient *auth.Client
	// SessionStorage is the session store shared across the client's services.
	SessionStorage *session.Storage
	// contains filtered or unexported fields
}
```

Config accumulates the per-service middleware applied while a client is
built. Configuration functions ([ConfigureFunc]) mutate it via [Config.UseAuth],
[Config.UseAll], and [Config.UseDataServices].

#### `UseAll`

```go
func (c *Config) UseAll(mw ...transport.Middleware)
```

UseAll applies middleware to every service: auth, storage, graphql, and
functions.

#### `UseAuth`

```go
func (c *Config) UseAuth(mw ...transport.Middleware)
```

UseAuth applies middleware to auth only.

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

WithAdminSession applies host-scoped admin-secret middleware to storage,
graphql, and functions (never auth). Admin credentials are sent only over
HTTPS or to a loopback development server unless options.AllowInsecureHTTP is
explicitly enabled.

Security warning: never use in client-side code — the admin secret grants
unrestricted database access. Prefer HTTPS; AllowInsecureHTTP sends the
secret in cleartext and should be limited to trusted development networks.

#### `WithMiddleware`

```go
func WithMiddleware(mw ...transport.Middleware) ConfigureFunc
```

WithMiddleware applies arbitrary middleware to all four services.

### `Options`

```go
type Options struct {
	// Subdomain is the Nhost project subdomain used to construct cloud service
	// URLs. Subdomain and Region must both be set to target Nhost cloud; if
	// either is empty, services without a custom URL use local development URLs.
	Subdomain string
	// Region is the Nhost project region used to construct cloud service URLs.
	// Region and Subdomain must both be set to target Nhost cloud; if either is
	// empty, services without a custom URL use local development URLs.
	Region string
	// AuthURL is the complete base URL for the auth service. It overrides
	// Subdomain and Region for auth requests.
	AuthURL string
	// StorageURL is the complete base URL for the storage service. It overrides
	// Subdomain and Region for storage requests.
	StorageURL string
	// GraphQLURL is the complete URL for the GraphQL service. It overrides
	// Subdomain and Region for GraphQL requests.
	GraphQLURL string
	// FunctionsURL is the complete base URL for the functions service. It
	// overrides Subdomain and Region for functions requests.
	FunctionsURL string
	// Storage is the backend used to persist sessions. Implementations must be
	// safe for concurrent use by multiple goroutines. If nil,
	// [session.DetectStorage] supplies an in-memory backend.
	Storage session.Backend
	// HTTPClient is the base HTTP client used by all services. The supplied client
	// is never mutated and may be shared; service middleware is installed on
	// independent copies. If nil, a default client with no timeout is used;
	// per-request deadlines come from the context.Context passed to each method.
	HTTPClient *http.Client
	// Configure contains functions applied in order after constructor defaults.
	// Middleware added here is nested inside the default middleware.
	Configure []ConfigureFunc
}
```

Options configures the creation of an Nhost client.

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

