// Package nhost is the top-level Nhost SDK client. It bundles the auth,
// storage, graphql, and functions clients over a shared *http.Client and a
// session store.
//
// Use CreateClient for app clients (automatic refresh + token attachment),
// CreateServerClient for trusted server contexts with explicit storage, and
// CreateNhostClient for a bare client you configure yourself.
package nhost

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/nhost/nhost/packages/nhost-go/auth"
	"github.com/nhost/nhost/packages/nhost-go/fetch"
	"github.com/nhost/nhost/packages/nhost-go/functions"
	"github.com/nhost/nhost/packages/nhost-go/graphql"
	"github.com/nhost/nhost/packages/nhost-go/middleware"
	"github.com/nhost/nhost/packages/nhost-go/session"
	"github.com/nhost/nhost/packages/nhost-go/storage"
)

// DefaultRefreshMarginSeconds is the default refresh margin used by the
// client-side middleware and RefreshSession.
const DefaultRefreshMarginSeconds = 60

// ErrServerClientStorageRequired is returned by CreateServerClient when no
// explicit storage backend is provided.
var ErrServerClientStorageRequired = errors.New(
	"CreateServerClient requires explicit options.Storage " +
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
// subdomain/region; otherwise the local development URL is used.
func GenerateServiceURL(serviceType ServiceType, subdomain, region, customURL string) string {
	if customURL != "" {
		return customURL
	}

	if subdomain != "" && region != "" {
		return fmt.Sprintf("https://%s.%s.%s.nhost.run/v1", subdomain, serviceType, region)
	}

	return fmt.Sprintf("https://local.%s.local.nhost.run/v1", serviceType)
}

// ConfigureContext is the set of clients passed to a configuration function.
type ConfigureContext struct {
	Auth           *auth.Client
	Storage        *storage.Client
	GraphQL        *graphql.Client
	Functions      *functions.Client
	SessionStorage *session.Storage
}

// ClientConfigurationFn configures a client during construction.
type ClientConfigurationFn func(ctx *ConfigureContext)

func apply(ctx *ConfigureContext, chain []fetch.ChainFunction) {
	for _, mw := range chain {
		ctx.Auth.PushChainFunction(mw)
		ctx.Storage.PushChainFunction(mw)
		ctx.GraphQL.PushChainFunction(mw)
		ctx.Functions.PushChainFunction(mw)
	}
}

// WithClientSideSessionMiddleware enables automatic session refresh, token
// attachment, and session capture.
func WithClientSideSessionMiddleware(ctx *ConfigureContext) {
	apply(ctx, []fetch.ChainFunction{
		middleware.SessionRefresh(ctx.Auth, ctx.SessionStorage, DefaultRefreshMarginSeconds),
		middleware.UpdateSessionFromResponse(ctx.SessionStorage),
		middleware.AttachAccessToken(ctx.SessionStorage),
	})
}

// WithServerSideSessionMiddleware enables token attachment and session capture,
// but no automatic refresh.
func WithServerSideSessionMiddleware(ctx *ConfigureContext) {
	apply(ctx, []fetch.ChainFunction{
		middleware.UpdateSessionFromResponse(ctx.SessionStorage),
		middleware.AttachAccessToken(ctx.SessionStorage),
	})
}

// WithAdminSession applies admin-secret middleware to storage, graphql, and
// functions. Security warning: never use in client-side code.
func WithAdminSession(options middleware.AdminSessionOptions) ClientConfigurationFn {
	return func(ctx *ConfigureContext) {
		mw := middleware.WithAdminSession(options)
		ctx.Storage.PushChainFunction(mw)
		ctx.GraphQL.PushChainFunction(mw)
		ctx.Functions.PushChainFunction(mw)
	}
}

// WithChainFunctions applies arbitrary chain functions to all four clients.
func WithChainFunctions(chainFunctions []fetch.ChainFunction) ClientConfigurationFn {
	return func(ctx *ConfigureContext) {
		apply(ctx, chainFunctions)
	}
}

// Client provides unified access to Nhost auth, storage, graphql, and
// functions.
type Client struct {
	Auth           *auth.Client
	Storage        *storage.Client
	GraphQL        *graphql.Client
	Functions      *functions.Client
	SessionStorage *session.Storage
}

// GetUserSession returns the current session from storage, or (nil, false).
func (c *Client) GetUserSession() (*session.StoredSession, bool) {
	return c.SessionStorage.Get()
}

// RefreshSession refreshes the session using the stored refresh token.
func (c *Client) RefreshSession(
	ctx context.Context,
	marginSeconds int,
) (*session.StoredSession, error) {
	return session.RefreshSession(ctx, c.Auth, c.SessionStorage, marginSeconds) //nolint:wrapcheck
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
	Configure    []ClientConfigurationFn
}

// CreateNhostClient creates and configures an Nhost client, applying
// options.Configure.
func CreateNhostClient(options Options) *Client {
	backend := options.Storage
	if backend == nil {
		backend = session.DetectStorage()
	}

	sessionStorage := session.NewStorage(backend)

	httpClient := options.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{} //nolint:exhaustruct
	}

	authClient := auth.NewClient(
		GenerateServiceURL(ServiceAuth, options.Subdomain, options.Region, options.AuthURL),
		nil, httpClient,
	)
	storageClient := storage.NewClient(
		GenerateServiceURL(ServiceStorage, options.Subdomain, options.Region, options.StorageURL),
		nil, httpClient,
	)
	graphqlClient := graphql.NewClient(
		GenerateServiceURL(ServiceGraphQL, options.Subdomain, options.Region, options.GraphQLURL),
		nil, httpClient,
	)
	functionsClient := functions.NewClient(
		GenerateServiceURL(ServiceFunctions, options.Subdomain, options.Region, options.FunctionsURL),
		nil, httpClient,
	)

	ctx := &ConfigureContext{
		Auth:           authClient,
		Storage:        storageClient,
		GraphQL:        graphqlClient,
		Functions:      functionsClient,
		SessionStorage: sessionStorage,
	}

	for _, configure := range options.Configure {
		configure(ctx)
	}

	return &Client{
		Auth:           authClient,
		Storage:        storageClient,
		GraphQL:        graphqlClient,
		Functions:      functionsClient,
		SessionStorage: sessionStorage,
	}
}

// CreateClient creates an app client with automatic refresh + token attachment.
func CreateClient(options Options) *Client {
	options.Configure = append(
		[]ClientConfigurationFn{WithClientSideSessionMiddleware}, options.Configure...,
	)

	return CreateNhostClient(options)
}

// CreateServerClient creates a server client with explicit storage and no
// automatic refresh. It requires options.Storage — sharing a process-wide
// session store between users can leak tokens across requests, so pass a
// per-request/user backend.
func CreateServerClient(options Options) (*Client, error) {
	if options.Storage == nil {
		return nil, ErrServerClientStorageRequired
	}

	options.Configure = append(
		[]ClientConfigurationFn{WithServerSideSessionMiddleware}, options.Configure...,
	)

	return CreateNhostClient(options), nil
}
