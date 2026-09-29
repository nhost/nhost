// Package nhost is the top-level Nhost SDK client. It bundles the auth,
// storage, graphql, and functions clients over an optional session store and
// per-service HTTP middleware.
//
// [New] builds every client, configured with options:
//
//	// no session management: pass a caller's token per request, if any
//	client, err := nhost.New(nhost.WithProject(subdomain, region))
//
//	// automatic session management (sign-in stores, requests refresh and attach)
//	client, err := nhost.New(
//		nhost.WithProject(subdomain, region),
//		nhost.WithSessionStorage(&session.FileStorage{Path: path}),
//	)
//
//	// admin client
//	client, err := nhost.New(
//		nhost.WithProject(subdomain, region),
//		nhost.WithAdminSecret(middleware.AdminSessionOptions{AdminSecret: secret}),
//	)
//
// Which session a request uses comes from its context: [session.WithUserID]
// selects a stored session, and [session.WithAccessToken] supplies a caller's
// own token without touching storage.
package nhost

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"

	"github.com/nhost/nhost/packages/nhost-go/auth"
	"github.com/nhost/nhost/packages/nhost-go/functions"
	"github.com/nhost/nhost/packages/nhost-go/graphql"
	"github.com/nhost/nhost/packages/nhost-go/middleware"
	"github.com/nhost/nhost/packages/nhost-go/session"
	"github.com/nhost/nhost/packages/nhost-go/storage"
	"github.com/nhost/nhost/packages/nhost-go/transport"
)

// DefaultRefreshMarginSeconds is the refresh margin used by the session-refresh
// middleware: a stored session is refreshed before a request once its access
// token expires within this many seconds.
const DefaultRefreshMarginSeconds = 60

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
		return transport.NormalizeServiceURL(customURL)
	}

	if subdomain != "" && region != "" {
		return fmt.Sprintf("https://%s.%s.%s.nhost.run/v1", subdomain, serviceType, region)
	}

	return fmt.Sprintf("https://local.%s.local.nhost.run/v1", serviceType)
}

type options struct {
	subdomain    string
	region       string
	authURL      string
	storageURL   string
	graphqlURL   string
	functionsURL string
	httpClient   *http.Client
	headers      http.Header
	backend      session.Backend
	admin        *middleware.AdminSessionOptions
	middleware   []transport.Middleware
}

// Option configures a client built by [New].
type Option func(o *options) error

// WithProject targets the Nhost cloud project with the given subdomain and
// region. Without it, and without a custom URL for a service, the service's
// local development URL is used.
func WithProject(subdomain, region string) Option {
	return func(o *options) error {
		if subdomain == "" || region == "" {
			return ErrInvalidProject
		}

		o.subdomain = subdomain
		o.region = region

		return nil
	}
}

// WithAuthURL sets the complete base URL of the auth service, overriding
// [WithProject] for auth.
func WithAuthURL(serviceURL string) Option {
	return func(o *options) error {
		o.authURL = serviceURL

		return nil
	}
}

// WithStorageURL sets the complete base URL of the storage service, overriding
// [WithProject] for storage.
func WithStorageURL(serviceURL string) Option {
	return func(o *options) error {
		o.storageURL = serviceURL

		return nil
	}
}

// WithGraphQLURL sets the complete URL of the GraphQL service, overriding
// [WithProject] for GraphQL.
func WithGraphQLURL(serviceURL string) Option {
	return func(o *options) error {
		o.graphqlURL = serviceURL

		return nil
	}
}

// WithFunctionsURL sets the complete base URL of the functions service,
// overriding [WithProject] for functions.
func WithFunctionsURL(serviceURL string) Option {
	return func(o *options) error {
		o.functionsURL = serviceURL

		return nil
	}
}

// WithHTTPClient sets the base HTTP client used by all services. The supplied
// client is never mutated and may be shared; service middleware is installed on
// independent copies. Without it, a default client with no timeout is used;
// per-request deadlines come from the context.Context passed to each method.
func WithHTTPClient(httpClient *http.Client) Option {
	return func(o *options) error {
		o.httpClient = httpClient

		return nil
	}
}

// WithHTTPHeaders adds default headers to every request of every service,
// keeping any value a request sets itself. They are not scoped to a service's
// origin, so they must not carry credentials; use [WithAdminSecret] or session
// storage for those. Repeated calls merge.
func WithHTTPHeaders(headers http.Header) Option {
	return func(o *options) error {
		if o.headers == nil {
			o.headers = http.Header{}
		}

		for key, values := range headers {
			for _, value := range values {
				o.headers.Add(key, value)
			}
		}

		return nil
	}
}

// WithSessionStorage enables session management over backend: sign-in and
// refresh responses are stored, and each request refreshes and attaches the
// session its context selects (see [session.WithUserID]). backend must be safe
// for concurrent use by multiple goroutines.
//
// Without it the client keeps no sessions. Requests still authenticate with a
// token set by [session.WithAccessToken], and sign-in still returns the session
// to the caller.
func WithSessionStorage(backend session.Backend) Option {
	return func(o *options) error {
		if backend == nil {
			return ErrNilSessionStorage
		}

		o.backend = backend

		return nil
	}
}

// WithAdminSecret authenticates storage, graphql, and functions requests (never
// auth) with the admin secret. Admin credentials are sent only over HTTPS or to
// a loopback development server unless options.AllowInsecureHTTP is enabled. It
// cannot be combined with [WithSessionStorage], and a request made with
// [session.WithAccessToken] fails rather than send both credentials.
//
// Security warning: never use in client-side code — the admin secret grants
// unrestricted database access. Prefer HTTPS; AllowInsecureHTTP sends the
// secret in cleartext and should be limited to trusted development networks.
func WithAdminSecret(adminOptions middleware.AdminSessionOptions) Option {
	return func(o *options) error {
		if adminOptions.AdminSecret == "" {
			return ErrEmptyAdminSecret
		}

		o.admin = &adminOptions

		return nil
	}
}

// WithMiddleware applies middleware to all four services. It runs inside the
// SDK's own middleware, so it sees the Authorization header the SDK attached.
// Repeated calls append; middleware runs in the order given.
func WithMiddleware(mw ...transport.Middleware) Option {
	return func(o *options) error {
		o.middleware = append(o.middleware, mw...)

		return nil
	}
}

// Client provides unified access to Nhost auth, storage, graphql, and
// functions. A Client and its service clients are safe for concurrent use when
// the configured [session.Backend] satisfies the interface's concurrency
// requirement.
type Client struct {
	// Auth provides user authentication and account-management operations.
	Auth *auth.Client
	// Storage provides file upload, download, and metadata operations.
	Storage *storage.Client
	// GraphQL executes queries and mutations against the project's GraphQL API.
	GraphQL *graphql.Client
	// Functions invokes serverless functions deployed to the project.
	Functions *functions.Client

	// refreshClient is a bare auth client (no middleware) that refreshes reach
	// the token endpoint through, so a refresh never recurses into itself.
	refreshClient *auth.Client
	// sessions is nil for a client without session storage.
	sessions *session.Storage
}

// Session returns the stored session ctx selects (see [session.WithUserID]). It
// returns (nil, nil) when that user is not signed in, and an error only when
// the session store could not be read — an unreadable store is not a signed out
// user — or the client has no session storage.
func (c *Client) Session(ctx context.Context) (*session.StoredSession, error) {
	if c.sessions == nil {
		return nil, ErrNoSessionStorage
	}

	return c.sessions.Get(ctx) //nolint:wrapcheck
}

// RefreshSession refreshes the stored session ctx selects using its refresh
// token. A marginSeconds value of zero forces a refresh. If refresh fails while
// the access token is still valid, both the existing session and the error are
// returned. See [session.RefreshSession].
func (c *Client) RefreshSession(
	ctx context.Context,
	marginSeconds int,
) (*session.StoredSession, error) {
	if c.sessions == nil {
		return nil, ErrNoSessionStorage
	}

	return session.RefreshSession( //nolint:wrapcheck
		ctx, c.refreshClient, c.sessions, marginSeconds,
	)
}

// ClearSession removes the stored session ctx selects (client-side sign-out).
// It returns an error when the session could not be cleared, so a caller is
// never told a user was signed out while their credentials remain stored.
func (c *Client) ClearSession(ctx context.Context) error {
	if c.sessions == nil {
		return ErrNoSessionStorage
	}

	return c.sessions.Remove(ctx) //nolint:wrapcheck
}

func validateServiceURL(service ServiceType, serviceURL string) error {
	parsed, err := url.Parse(serviceURL)
	if err != nil {
		return fmt.Errorf("%w: %s %q: %w", ErrInvalidServiceURL, service, serviceURL, err)
	}

	if (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return fmt.Errorf("%w: %s %q", ErrInvalidServiceURL, service, serviceURL)
	}

	return nil
}

type serviceURLs struct {
	auth      string
	storage   string
	graphql   string
	functions string
}

func (o *options) serviceURLs() (serviceURLs, error) {
	urls := serviceURLs{
		auth:      GenerateServiceURL(ServiceAuth, o.subdomain, o.region, o.authURL),
		storage:   GenerateServiceURL(ServiceStorage, o.subdomain, o.region, o.storageURL),
		graphql:   GenerateServiceURL(ServiceGraphQL, o.subdomain, o.region, o.graphqlURL),
		functions: GenerateServiceURL(ServiceFunctions, o.subdomain, o.region, o.functionsURL),
	}

	for service, serviceURL := range map[ServiceType]string{
		ServiceAuth:      urls.auth,
		ServiceStorage:   urls.storage,
		ServiceGraphQL:   urls.graphql,
		ServiceFunctions: urls.functions,
	} {
		if err := validateServiceURL(service, serviceURL); err != nil {
			return serviceURLs{}, err
		}
	}

	return urls, nil
}

// pipeline returns the middleware for one service, outermost first: refresh the
// stored session, capture sessions from auth responses, attach the request's
// credential, add default headers, then the caller's middleware.
func (o *options) pipeline(
	serviceURL string,
	isAuth bool,
	refreshClient *auth.Client,
	sessions *session.Storage,
	authURL string,
) []transport.Middleware {
	var mw []transport.Middleware

	if sessions != nil {
		mw = append(
			mw,
			middleware.SessionRefresh(refreshClient, sessions, DefaultRefreshMarginSeconds),
		)

		if isAuth {
			mw = append(mw, middleware.UpdateSessionFromResponse(sessions, authURL))
		}
	}

	// Auth never gets the admin secret, so a caller's token is unambiguous
	// there even on an admin client.
	if o.admin != nil && !isAuth {
		mw = append(mw, middleware.WithAdminSession(*o.admin, serviceURL))
	} else {
		mw = append(mw, middleware.AttachAccessToken(sessions, serviceURL))
	}

	if len(o.headers) > 0 {
		mw = append(mw, middleware.WithHeaders(o.headers))
	}

	return append(mw, o.middleware...)
}

// New creates a client configured by opts. It returns an error for an invalid
// option or service URL, and for [WithAdminSecret] combined with
// [WithSessionStorage].
func New(opts ...Option) (*Client, error) {
	var o options

	for _, opt := range opts {
		if err := opt(&o); err != nil {
			return nil, err
		}
	}

	if o.admin != nil && o.backend != nil {
		return nil, ErrAdminSecretWithSessionStorage
	}

	urls, err := o.serviceURLs()
	if err != nil {
		return nil, err
	}

	var sessions *session.Storage
	if o.backend != nil {
		sessions = session.NewStorage(o.backend)
	}

	refreshClient := auth.NewClient(urls.auth, o.httpClient)
	httpClient := func(serviceURL string, isAuth bool) *http.Client {
		return transport.NewHTTPClient(
			o.httpClient,
			o.pipeline(serviceURL, isAuth, refreshClient, sessions, urls.auth)...,
		)
	}

	return &Client{
		Auth:          auth.NewClient(urls.auth, httpClient(urls.auth, true)),
		Storage:       storage.NewClient(urls.storage, httpClient(urls.storage, false)),
		GraphQL:       graphql.NewClient(urls.graphql, httpClient(urls.graphql, false)),
		Functions:     functions.NewClient(urls.functions, httpClient(urls.functions, false)),
		refreshClient: refreshClient,
		sessions:      sessions,
	}, nil
}
