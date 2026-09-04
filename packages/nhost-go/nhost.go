// Package nhost is the top-level Nhost SDK client. It bundles the auth,
// storage, graphql, and functions clients over a shared session store and
// per-service HTTP middleware.
//
// Use [New] for app clients (automatic refresh + token attachment),
// [NewServerClient] for trusted server contexts with explicit storage, and
// [NewBareClient] for a client with no middleware beyond what you supply via
// [Options].Configure.
package nhost

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"

	"github.com/nhost/nhost/packages/nhost-go/auth"
	"github.com/nhost/nhost/packages/nhost-go/functions"
	"github.com/nhost/nhost/packages/nhost-go/graphql"
	"github.com/nhost/nhost/packages/nhost-go/middleware"
	"github.com/nhost/nhost/packages/nhost-go/session"
	"github.com/nhost/nhost/packages/nhost-go/storage"
	"github.com/nhost/nhost/packages/nhost-go/transport"
)

// DefaultRefreshMarginSeconds is the default refresh margin used by the
// client-side middleware and [Client.RefreshSession].
const DefaultRefreshMarginSeconds = 60

// ErrServerClientStorageRequired is returned by [NewServerClient] when no
// explicit storage backend is provided.
var ErrServerClientStorageRequired = errors.New(
	"NewServerClient requires explicit options.Storage " +
		"(use a per-request/user backend to avoid leaking sessions)",
)

// ServiceType is one of the Nhost services.
type ServiceType string

// The Nhost service types.
const (
	ServiceAuth      ServiceType = "auth"
	ServiceStorage   ServiceType = "storage"
	ServiceGraphQL   ServiceType = "graphql"
	ServiceFunctions ServiceType = "functions"
)

// GenerateServiceURL builds the base URL for an Nhost service. Precedence: an
// explicit customURL wins; otherwise a cloud URL is built from
// subdomain/region; otherwise the local development URL is used. A custom URL
// without a scheme defaults to HTTP for localhost and loopback addresses, and
// HTTPS otherwise.
func GenerateServiceURL(serviceType ServiceType, subdomain, region, customURL string) string {
	if customURL != "" {
		return normalizeCustomURL(customURL)
	}

	if subdomain != "" && region != "" {
		return fmt.Sprintf("https://%s.%s.%s.nhost.run/v1", subdomain, serviceType, region)
	}

	return fmt.Sprintf("https://local.%s.local.nhost.run/v1", serviceType)
}

func normalizeCustomURL(customURL string) string {
	if strings.Contains(customURL, "://") {
		return customURL
	}

	parsed, err := url.Parse("//" + customURL)
	if err != nil || parsed.Host == "" {
		return customURL
	}

	scheme := "https"

	hostname := parsed.Hostname()
	if strings.EqualFold(hostname, "localhost") {
		scheme = "http"
	} else if ip := net.ParseIP(hostname); ip != nil && ip.IsLoopback() {
		scheme = "http"
	}

	return scheme + "://" + customURL
}

// Config accumulates the per-service middleware applied while a client is
// built. Configuration functions ([ConfigureFunc]) mutate it via [Config.UseAuth],
// [Config.UseAll], and [Config.UseDataServices].
type Config struct {
	// RefreshClient is a bare auth client (no middleware) that the
	// session-refresh middleware uses to reach the token endpoint, avoiding a
	// dependency cycle with the auth client under construction.
	RefreshClient *auth.Client
	// SessionStorage is the session store shared across the client's services.
	SessionStorage *session.Storage

	authURL      string
	storageURL   string
	graphqlURL   string
	functionsURL string
	authMW       []transport.Middleware
	storageMW    []transport.Middleware
	graphqlMW    []transport.Middleware
	functionsMW  []transport.Middleware
}

// UseAuth applies middleware to auth only.
func (c *Config) UseAuth(mw ...transport.Middleware) {
	c.authMW = append(c.authMW, mw...)
}

// UseAll applies middleware to every service: auth, storage, graphql, and
// functions.
func (c *Config) UseAll(mw ...transport.Middleware) {
	c.UseAuth(mw...)
	c.UseDataServices(mw...)
}

// UseDataServices applies middleware to storage, graphql, and functions, but
// not auth. It is used for admin credentials, which must never be attached to
// auth requests.
func (c *Config) UseDataServices(mw ...transport.Middleware) {
	c.storageMW = append(c.storageMW, mw...)
	c.graphqlMW = append(c.graphqlMW, mw...)
	c.functionsMW = append(c.functionsMW, mw...)
}

func (c *Config) useEachService(factory func(string) transport.Middleware) {
	c.UseAuth(factory(c.authURL))
	c.storageMW = append(c.storageMW, factory(c.storageURL))
	c.graphqlMW = append(c.graphqlMW, factory(c.graphqlURL))
	c.functionsMW = append(c.functionsMW, factory(c.functionsURL))
}

func (c *Config) useEachDataService(factory func(string) transport.Middleware) {
	c.storageMW = append(c.storageMW, factory(c.storageURL))
	c.graphqlMW = append(c.graphqlMW, factory(c.graphqlURL))
	c.functionsMW = append(c.functionsMW, factory(c.functionsURL))
}

// ConfigureFunc customises a client during construction by adding middleware to
// the [Config].
type ConfigureFunc func(c *Config)

// clientSideSessionMiddleware enables automatic session refresh and token
// attachment on every service, with session capture limited to auth.
func clientSideSessionMiddleware(c *Config) {
	c.UseAll(middleware.SessionRefresh(
		c.RefreshClient,
		c.SessionStorage,
		DefaultRefreshMarginSeconds,
	))
	c.UseAuth(middleware.UpdateSessionFromResponse(c.SessionStorage, c.authURL))
	c.useEachService(func(serviceURL string) transport.Middleware {
		return middleware.AttachAccessToken(c.SessionStorage, serviceURL)
	})
}

// serverSideSessionMiddleware enables token attachment on every service and
// session capture on auth, but no automatic refresh.
func serverSideSessionMiddleware(c *Config) {
	c.UseAuth(middleware.UpdateSessionFromResponse(c.SessionStorage, c.authURL))
	c.useEachService(func(serviceURL string) transport.Middleware {
		return middleware.AttachAccessToken(c.SessionStorage, serviceURL)
	})
}

// WithAdminSession applies host-scoped admin-secret middleware to storage,
// graphql, and functions (never auth). Admin credentials are sent only over
// HTTPS or to a loopback development server unless options.AllowInsecureHTTP is
// explicitly enabled.
//
// Security warning: never use in client-side code — the admin secret grants
// unrestricted database access. Prefer HTTPS; AllowInsecureHTTP sends the
// secret in cleartext and should be limited to trusted development networks.
func WithAdminSession(options middleware.AdminSessionOptions) ConfigureFunc {
	return func(c *Config) {
		c.useEachDataService(func(serviceURL string) transport.Middleware {
			return middleware.WithAdminSession(options, serviceURL)
		})
	}
}

// WithMiddleware applies arbitrary middleware to all four services.
func WithMiddleware(mw ...transport.Middleware) ConfigureFunc {
	return func(c *Config) {
		c.UseAll(mw...)
	}
}

// Client provides unified access to Nhost auth, storage, graphql, and
// functions.
type Client struct {
	Auth      *auth.Client
	Storage   *storage.Client
	GraphQL   *graphql.Client
	Functions *functions.Client
	// RefreshClient is the bare auth client used for explicit session refreshes.
	RefreshClient  *auth.Client
	SessionStorage *session.Storage
}

// GetUserSession returns the current session from storage, or (nil, false).
func (c *Client) GetUserSession() (*session.StoredSession, bool) {
	return c.SessionStorage.Get()
}

// RefreshSession refreshes the session using the stored refresh token. A
// marginSeconds value of zero forces a refresh. If refresh fails while the
// access token is still valid, both the existing session and the error are
// returned.
func (c *Client) RefreshSession(
	ctx context.Context,
	marginSeconds int,
) (*session.StoredSession, error) {
	return session.RefreshSession( //nolint:wrapcheck
		ctx, c.RefreshClient, c.SessionStorage, marginSeconds,
	)
}

// ClearSession removes the current session from storage (client-side sign-out).
func (c *Client) ClearSession() {
	c.SessionStorage.Remove()
}

// Options configures the creation of an Nhost client.
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

// build constructs a client, running defaults before the caller's
// options.Configure so session middleware wraps user middleware.
func build(options Options, defaults ...ConfigureFunc) *Client {
	backend := options.Storage
	if backend == nil {
		backend = session.DetectStorage()
	}

	sessionStorage := session.NewStorage(backend)

	authURL := GenerateServiceURL(ServiceAuth, options.Subdomain, options.Region, options.AuthURL)
	storageURL := GenerateServiceURL(
		ServiceStorage,
		options.Subdomain,
		options.Region,
		options.StorageURL,
	)
	graphqlURL := GenerateServiceURL(
		ServiceGraphQL,
		options.Subdomain,
		options.Region,
		options.GraphQLURL,
	)
	functionsURL := GenerateServiceURL(
		ServiceFunctions,
		options.Subdomain,
		options.Region,
		options.FunctionsURL,
	)

	cfg := &Config{ //nolint:exhaustruct
		RefreshClient:  auth.NewClient(authURL, options.HTTPClient),
		SessionStorage: sessionStorage,
		authURL:        authURL,
		storageURL:     storageURL,
		graphqlURL:     graphqlURL,
		functionsURL:   functionsURL,
	}

	for _, configure := range append(defaults, options.Configure...) {
		configure(cfg)
	}

	if cfg.RefreshClient == nil {
		cfg.RefreshClient = auth.NewClient(authURL, options.HTTPClient)
	}

	return &Client{
		Auth: auth.NewClient(authURL, transport.NewHTTPClient(options.HTTPClient, cfg.authMW...)),
		Storage: storage.NewClient(
			storageURL,
			transport.NewHTTPClient(options.HTTPClient, cfg.storageMW...),
		),
		GraphQL: graphql.NewClient(
			graphqlURL,
			transport.NewHTTPClient(options.HTTPClient, cfg.graphqlMW...),
		),
		Functions: functions.NewClient(
			functionsURL,
			transport.NewHTTPClient(options.HTTPClient, cfg.functionsMW...),
		),
		RefreshClient:  cfg.RefreshClient,
		SessionStorage: sessionStorage,
	}
}

// New creates an app client with automatic refresh + token attachment. This is
// the client most applications want.
func New(options Options) *Client {
	return build(options, clientSideSessionMiddleware)
}

// NewServerClient creates a server client with explicit storage and no
// automatic refresh. It requires options.Storage — sharing a process-wide
// session store between users can leak tokens across requests, so pass a
// per-request/user backend.
func NewServerClient(options Options) (*Client, error) {
	if options.Storage == nil {
		return nil, ErrServerClientStorageRequired
	}

	return build(options, serverSideSessionMiddleware), nil
}

// NewBareClient creates a client with no middleware beyond what options.Configure
// supplies. Use it when you want full control over the request pipeline.
func NewBareClient(options Options) *Client {
	return build(options)
}
