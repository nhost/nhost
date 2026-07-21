// Package cmd defines the top-level CLI commands for the constellation
// binary. It wires `urfave/cli/v3` flag definitions to internal subsystems
// (controller, metadata source, JWT authenticator, HTTP server).
package cmd

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	_ "net/http/pprof" //nolint:gosec // pprof is gated behind a CLI flag
	"strings"
	"time"

	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/internal/lib/oapi"
	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	serveutil "github.com/nhost/nhost/internal/lib/serve"
	"github.com/nhost/nhost/services/constellation/api"
	"github.com/nhost/nhost/services/constellation/controller"
	"github.com/nhost/nhost/services/constellation/controller/middleware"
	"github.com/nhost/nhost/services/constellation/internal/hasuraproxy"
	"github.com/nhost/nhost/services/constellation/internal/jwt"
	"github.com/nhost/nhost/services/constellation/internal/jwt/jwtconfig"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/nhost/nhost/services/constellation/metadata/source"
	"github.com/urfave/cli/v3"
)

const (
	flagDebug                        = "debug"
	flagLogFormatTEXT                = "log-format-text"
	flagBindAddress                  = "bind-address"
	flagEnablePlayground             = "enable-playground"
	flagMetadataPath                 = "metadata-path"
	flagAdminSecret                  = "admin-secret"
	flagJWTSecret                    = "jwt-secret"
	flagSubscriptionPollInterval     = "subscription-poll-interval"
	flagMetadataDatabaseURL          = "metadata-database-url"
	flagProfileAddress               = "profile-address"
	flagCORSAllowedOrigins           = "cors-allowed-origins"
	flagDevMode                      = "dev-mode"
	flagGraphQLRequestBodyLimitBytes = "graphql-request-body-limit-bytes"
	flagHTTPReadTimeout              = "http-read-timeout"
	//nolint:gosec // CLI flag name contains "write" but is not a credential.
	flagHTTPWriteTimeout                 = "http-write-timeout"
	flagHTTPIdleTimeout                  = "http-idle-timeout"
	flagHasuraUpstreamURL                = "hasura-upstream-url"
	flagHasuraProxyRequestBodyLimitBytes = "hasura-proxy-request-body-limit-bytes"

	// defaultHasuraUpstreamURL intentionally targets the Nhost Hasura sidecar so
	// compatibility endpoints proxy by default in normal side-by-side deployments.
	// Standalone deployments can pass --hasura-upstream-url "" (or set
	// CONSTELLATION_HASURA_UPSTREAM_URL empty) to disable the fallback.
	defaultHasuraUpstreamURL = "http://hasura-service:8080/"

	// defaultHasuraProxyRequestBodyLimitBytes bounds bodies forwarded to the
	// Hasura upstream via the NoRoute fallback. Generous (100 MiB) so large
	// migrations / bulk run_sql still pass, but not unbounded.
	defaultHasuraProxyRequestBodyLimitBytes int64 = 100 * 1024 * 1024

	defaultHTTPReadTimeout   = 30 * time.Second
	defaultHTTPWriteTimeout  = 5 * time.Minute
	defaultHTTPIdleTimeout   = 120 * time.Second
	maxHTTPReadHeaderTimeout = 5 * time.Second
	shutdownTimeout          = 30 * time.Second
)

var errFlagMustBeGreaterThanZero = errors.New("must be greater than 0")

func generalFlags() []cli.Flag {
	return []cli.Flag{
		&cli.BoolFlag{ //nolint:exhaustruct
			Name:     flagDebug,
			Usage:    "enable debug logging",
			Category: "general",
			Sources:  cli.EnvVars("CONSTELLATION_DEBUG"),
		},
		&cli.BoolFlag{ //nolint:exhaustruct
			Name:     flagLogFormatTEXT,
			Usage:    "format logs in plain text",
			Category: "general",
			Sources:  cli.EnvVars("CONSTELLATION_LOG_FORMAT_TEXT"),
		},
	}
}

func serverFlags() []cli.Flag { //nolint:funlen // long flag list; splitting harms readability
	return []cli.Flag{
		&cli.BoolFlag{ //nolint:exhaustruct
			Name:     flagEnablePlayground,
			Usage:    "enable graphql playground (under /v1)",
			Category: "server",
			Sources:  cli.EnvVars("CONSTELLATION_ENABLE_PLAYGROUND"),
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:     flagBindAddress,
			Usage:    "bind address for the server",
			Value:    ":8000",
			Category: "server",
			Sources:  cli.EnvVars("CONSTELLATION_BIND_ADDRESS"),
		},
		&cli.DurationFlag{ //nolint:exhaustruct
			Name:     flagSubscriptionPollInterval,
			Usage:    "Polling interval for subscriptions",
			Category: "server",
			Value:    time.Second,
			Sources:  cli.EnvVars("CONSTELLATION_SUBSCRIPTION_POLL_INTERVAL"),
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:     flagProfileAddress,
			Usage:    "Enable CPU/memory profiling server on this address (e.g. :6060)",
			Category: "server",
			Sources:  cli.EnvVars("CONSTELLATION_PROFILE_ADDRESS"),
		},
		&cli.StringSliceFlag{ //nolint:exhaustruct
			Name: flagCORSAllowedOrigins,
			Usage: "Origins permitted to make credentialed cross-origin requests. " +
				"Entries may use \"*\" as a wildcard matching any run of " +
				"characters (e.g. \"https://my-app-*-org.vercel.app\"). " +
				"When empty, cross-origin requests are not granted access. " +
				"A bare \"*\" cannot be combined with credentials and is rejected at startup",
			Category: "server",
			Sources:  cli.EnvVars("CONSTELLATION_CORS_ALLOWED_ORIGINS"),
		},
		&cli.BoolFlag{ //nolint:exhaustruct
			Name: flagDevMode,
			Usage: "return raw connector/database error detail to clients instead " +
				"of the sanitized generic message. For development only — never " +
				"enable in production, as it leaks internal schema and data values",
			Category: "server",
			Sources:  cli.EnvVars("CONSTELLATION_DEV_MODE"),
		},
		&cli.Int64Flag{ //nolint:exhaustruct
			Name: flagGraphQLRequestBodyLimitBytes,
			Usage: "maximum JSON request body size accepted by POST /v1/graphql " +
				"and POST /v1, in bytes",
			Value:    controller.DefaultMaxGraphQLRequestBodyBytes,
			Category: "server",
			Sources:  cli.EnvVars("CONSTELLATION_GRAPHQL_REQUEST_BODY_LIMIT_BYTES"),
		},
		&cli.DurationFlag{ //nolint:exhaustruct
			Name:     flagHTTPReadTimeout,
			Usage:    "maximum time allowed to read an HTTP request, including the body",
			Value:    defaultHTTPReadTimeout,
			Category: "server",
			Sources:  cli.EnvVars("CONSTELLATION_HTTP_READ_TIMEOUT"),
		},
		&cli.DurationFlag{ //nolint:exhaustruct
			Name:     flagHTTPWriteTimeout,
			Usage:    "maximum time allowed to write an HTTP response",
			Value:    defaultHTTPWriteTimeout,
			Category: "server",
			Sources:  cli.EnvVars("CONSTELLATION_HTTP_WRITE_TIMEOUT"),
		},
		&cli.DurationFlag{ //nolint:exhaustruct
			Name:     flagHTTPIdleTimeout,
			Usage:    "maximum time to keep idle HTTP keep-alive connections open",
			Value:    defaultHTTPIdleTimeout,
			Category: "server",
			Sources:  cli.EnvVars("CONSTELLATION_HTTP_IDLE_TIMEOUT"),
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name: flagHasuraUpstreamURL,
			Usage: "absolute URL of a Hasura instance to reverse-proxy requests " +
				"to for endpoints Constellation does not yet serve natively " +
				"(e.g. /v1/metadata, /v2/query, /apis/*). Defaults to " +
				defaultHasuraUpstreamURL + " for Nhost side-by-side deployments. " +
				"Set to an empty string to disable the proxy; when disabled, " +
				"unhandled routes return 404",
			Value:    defaultHasuraUpstreamURL,
			Category: "server",
			Sources:  cli.EnvVars("CONSTELLATION_HASURA_UPSTREAM_URL"),
		},
		&cli.Int64Flag{ //nolint:exhaustruct
			Name: flagHasuraProxyRequestBodyLimitBytes,
			Usage: "maximum request body size, in bytes, forwarded to the Hasura " +
				"upstream by the proxy fallback for routes Constellation does not " +
				"serve natively. 0 disables the limit",
			Value:    defaultHasuraProxyRequestBodyLimitBytes,
			Category: "server",
			Sources: cli.EnvVars(
				"CONSTELLATION_HASURA_PROXY_REQUEST_BODY_LIMIT_BYTES",
			),
			// Reject negative values explicitly. The runtime guard only checks
			// `> 0`, so a negative value would silently disable the cap (same
			// behaviour as 0) but with no operator-visible signal. Surfacing it
			// at startup turns a silent misconfiguration into a loud error.
			Validator: func(v int64) error {
				if v < 0 {
					return fmt.Errorf( //nolint:err113
						"%s must be >= 0 (0 disables the limit), got %d",
						flagHasuraProxyRequestBodyLimitBytes, v,
					)
				}

				return nil
			},
		},
	}
}

func dataFlags() []cli.Flag {
	return []cli.Flag{
		&cli.StringFlag{ //nolint:exhaustruct
			Name:     flagMetadataPath,
			Usage:    "Path to metadata.yaml file",
			Value:    "./metadata/metadata.yaml",
			Category: "metadata",
			Sources:  cli.EnvVars("CONSTELLATION_METADATA_PATH"),
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:     flagMetadataDatabaseURL,
			Usage:    "PostgreSQL URL for reading Hasura metadata from hdb_catalog.hdb_metadata",
			Category: "metadata",
			Sources:  cli.EnvVars("CONSTELLATION_METADATA_DATABASE_URL"),
		},
	}
}

func securityFlags() []cli.Flag {
	return []cli.Flag{
		&cli.StringFlag{ //nolint:exhaustruct
			Name:     flagAdminSecret,
			Usage:    "Admin secret for securing the GraphQL API",
			Category: "security",
			Required: true,
			Sources:  cli.EnvVars("CONSTELLATION_ADMIN_SECRET"),
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:     flagJWTSecret,
			Usage:    "JWT secret configuration (JSON string or JSON array of secrets)",
			Category: "security",
			Required: true,
			Sources:  cli.EnvVars("CONSTELLATION_JWT_SECRET"),
		},
	}
}

func serveFlags() []cli.Flag {
	flags := generalFlags()
	flags = append(flags, serverFlags()...)
	flags = append(flags, dataFlags()...)
	flags = append(flags, securityFlags()...)

	return flags
}

// CommandServe returns the "serve" CLI command, which starts the
// constellation HTTP server.
func CommandServe() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:   "serve",
		Usage:  "Serve the application",
		Flags:  serveFlags(),
		Action: serve,
	}
}

// allowRequestHeader is the AllowHeadersFunc used by the CORS middleware. It
// approves the small fixed set of standard request headers a browser sends
// on a GraphQL call plus the open-ended X-Hasura-* and X-Nhost-* families
// (Hasura session variables and Nhost internal headers like
// x-nhost-webhook-secret). The match is case-insensitive because browsers
// may send Access-Control-Request-Headers entries in any casing.
func allowRequestHeader(name string) bool {
	switch lower := strings.ToLower(name); lower {
	case "origin", "content-type", "accept", "authorization":
		return true
	default:
		return strings.HasPrefix(lower, "x-hasura-") || strings.HasPrefix(lower, "x-nhost-")
	}
}

// getCorsOptions builds the CORS configuration from the configured
// allowed-origins flag. An empty allow-list is the safe default: no origin
// matches, so no Access-Control-Allow-Origin is emitted and credentialed
// cross-origin reads are denied. A configured allow-all origin combined with
// credentials is rejected rather than silently reflecting arbitrary origins.
func getCorsOptions(
	ctx context.Context,
	cmd *cli.Command,
	logger *slog.Logger,
) (oapimw.CORSOptions, error) {
	allowedOrigins := cmd.StringSlice(flagCORSAllowedOrigins)
	if allowedOrigins == nil {
		// A non-nil, empty slice denies all cross-origin requests; a nil slice
		// would instead reflect every origin, which is not the safe default.
		allowedOrigins = []string{}
	}

	opts := oapimw.CORSOptions{
		AllowOriginFunc: nil,
		AllowedOrigins:  allowedOrigins,
		AllowedMethods: []string{
			"GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS",
		},
		AllowHeadersFunc:                     allowRequestHeader,
		AllowedHeaders:                       nil,
		ExposedHeaders:                       nil,
		AllowCredentials:                     true,
		MaxAge:                               "86400",
		UnsafeAllowAllOriginsWithCredentials: false,
	}

	if err := opts.Validate(); err != nil {
		return oapimw.CORSOptions{}, fmt.Errorf(
			"invalid CORS configuration (set %s to explicit origins): %w",
			flagCORSAllowedOrigins,
			err,
		)
	}

	// Warn once at startup when the resolved allow-list is empty: this is the
	// fail-safe deny-all default, but it silently breaks deployments that
	// relied on the previous permissive "*" CORS, so operators get an
	// actionable signal naming the flag. Only the genuine empty-deny-all case
	// warrants the warning; an AllowOriginFunc would gate origins dynamically
	// and is intentionally left to the caller.
	if opts.AllowOriginFunc == nil && len(opts.AllowedOrigins) == 0 {
		logger.WarnContext(
			ctx,
			"CORS: no allowed origins configured; all cross-origin requests will be denied",
			slog.String("flag", flagCORSAllowedOrigins),
			slog.String("env", "CONSTELLATION_CORS_ALLOWED_ORIGINS"),
		)
	}

	return opts, nil
}

func playgroundHandler(path string) gin.HandlerFunc {
	h := playground.Handler("GraphQL", path)

	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
	}
}

//nolint:funlen // assembles the full HTTP wiring; splitting fragments the topology
func getRouter(
	ctx context.Context,
	cmd *cli.Command,
	ctrl *controller.Controller,
	jwtAuth middleware.JWTAuthenticator,
	hasuraProxy http.Handler,
	logger *slog.Logger,
) (*gin.Engine, error) {
	corsOpts, err := getCorsOptions(ctx, cmd, logger)
	if err != nil {
		return nil, err
	}

	spec, err := api.GetSpec()
	if err != nil {
		return nil, fmt.Errorf("loading embedded OpenAPI spec: %w", err)
	}

	router, validatorMW, err := oapi.NewRouter( //nolint:contextcheck
		spec,
		"",
		controller.NewAuthFunc(),
		corsOpts,
		logger,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create router: %w", err)
	}

	// Session is service-specific middleware that must run after the shared
	// logger/tracing middleware (so it can enrich the request logger) and before
	// per-route OpenAPI validation (so NewAuthFunc can authorize against the
	// resolved session).
	router.Use(middleware.Session(cmd.String(flagAdminSecret), jwtAuth)) //nolint:contextcheck

	proxyBodyLimit := cmd.Int64(flagHasuraProxyRequestBodyLimitBytes)

	handler := api.NewStrictHandler(ctrl, nil)
	api.RegisterHandlersWithOptions(router, handler, api.GinServerOptions{
		BaseURL: "",
		// Order matters: CaptureRawBody rejects unauthenticated metadata
		// requests with 401 first — before reading/allocating the body and
		// before the ContentLength cap — so an unauthenticated caller cannot
		// probe the configured limit (413-vs-401) on this admin-only endpoint.
		// Authenticated requests then get the cheap ContentLength fast-fail and
		// the streaming MaxBytesReader cap for chunked bodies. The cap is the
		// same one the proxy NoRoute path uses so a request that would succeed
		// when routed to /v2/query is not silently rejected when routed to
		// /v1/metadata.
		Middlewares: []api.MiddlewareFunc{
			api.MiddlewareFunc(controller.NewCaptureRawBody(proxyBodyLimit)), //nolint:contextcheck
			api.MiddlewareFunc(validatorMW),
		},
		ErrorHandler: oapi.RecordError,
	})

	if cmd.Bool(flagEnablePlayground) {
		router.GET("/", playgroundHandler("/v1/graphql"))
	}

	maxBodyBytes, err := getMaxGraphQLRequestBodyBytes(cmd)
	if err != nil {
		return nil, err
	}

	//nolint:contextcheck // handler uses per-request contexts; startup ctx must not be captured.
	postHandler := ctrl.HandlerPostWithMaxBodyBytes(maxBodyBytes)
	router.POST("/v1/graphql", postHandler)
	router.GET("/v1/graphql", ctrl.HandlerGet)

	// legacy endpoints for backward compatibility with hasura deployment
	// to be removed when we do the one binary thing
	router.POST("/v1", postHandler)
	router.GET("/v1", ctrl.HandlerGet)

	if hasuraProxy != nil {
		router.NoRoute(func(c *gin.Context) {
			// Unhandled paths (/v2/query, /apis/*) are streamed to the Hasura
			// upstream and are reachable anonymously (Session does not abort
			// the public role), so bound the body to avoid forwarding an
			// unbounded payload. MaxBytesReader enforces the cap when the body
			// is read (not on Content-Length up front); on overflow the proxy's
			// read fails and the reverse proxy's own ErrorHandler
			// (hasuraproxy.handleProxyError) maps *http.MaxBytesError to 413 —
			// not oapi.RecordError, which only runs for the generated api routes.
			// 0 disables the cap.
			if proxyBodyLimit > 0 {
				c.Request.Body = http.MaxBytesReader(
					c.Writer, c.Request.Body, proxyBodyLimit,
				)
			}

			hasuraProxy.ServeHTTP(c.Writer, c.Request)
		})
	}

	return router, nil
}

func getMaxGraphQLRequestBodyBytes(cmd *cli.Command) (int64, error) {
	maxBodyBytes := cmd.Int64(flagGraphQLRequestBodyLimitBytes)
	if maxBodyBytes <= 0 {
		return 0, fmt.Errorf(
			"%s: %w", flagGraphQLRequestBodyLimitBytes, errFlagMustBeGreaterThanZero,
		)
	}

	return maxBodyBytes, nil
}

// initJWTAuth builds a JWT authenticator from the configured secrets. At least
// one JWT secret is required: an empty configuration is a fatal
// misconfiguration, not a request to disable authentication. Starting with
// authentication silently disabled would be an unsafe posture, so this fails
// loudly instead.
func initJWTAuth(
	ctx context.Context, cmd *cli.Command, logger *slog.Logger,
) (*jwt.Authenticator, error) {
	jwtCfg, err := jwtconfig.ParseConfig([]string{cmd.String(flagJWTSecret)})
	if err != nil {
		return nil, fmt.Errorf("failed to parse jwt config: %w", err)
	}

	jwtAuth, err := jwt.NewAuthenticator(ctx, jwtCfg, logger)
	if err != nil {
		if errors.Is(err, jwt.ErrNoSecrets) {
			return nil, fmt.Errorf(
				"at least one jwt secret must be configured via %s: %w", flagJWTSecret, err,
			)
		}

		return nil, fmt.Errorf("failed to create jwt authenticator: %w", err)
	}

	return jwtAuth, nil
}

func serve(ctx context.Context, cmd *cli.Command) error {
	logger := serveutil.NewLogger(cmd.Bool(flagDebug), cmd.Bool(flagLogFormatTEXT))
	logger.InfoContext(ctx, cmd.Root().Name+" v"+cmd.Root().Version)
	serveutil.LogFlags(ctx, logger, cmd)

	svc, err := NewService(ctx, cmd, logger)
	if err != nil {
		return err
	}

	defer svc.Shutdown()

	return runServer(ctx, cmd, svc, logger)
}

// NewService builds constellation's serving surface: the HTTP handler, the
// background controller loop, and the cleanup of the resources it acquires
// (metadata source, JWT authenticator). It is consumed both by the standalone
// serve command and by the nhost-engine unified binary, which mounts the
// handler behind a shared listener and runs the background loop under the
// shared process lifecycle.
func NewService(
	ctx context.Context,
	cmd *cli.Command,
	logger *slog.Logger,
) (*serveutil.Service, error) {
	metadataSource, err := newMetadataSource(ctx, cmd, logger)
	if err != nil {
		return nil, err
	}

	jwtAuth, err := initJWTAuth(ctx, cmd, logger)
	if err != nil {
		metadataSource.Close()

		return nil, fmt.Errorf("initializing JWT auth: %w", err)
	}

	hasuraProxy, err := newHasuraProxy(cmd, logger)
	if err != nil {
		jwtAuth.Close()
		metadataSource.Close()

		return nil, err
	}

	ctrl, err := controller.New(
		ctx,
		cmd.Duration(flagSubscriptionPollInterval),
		cmd.String(flagAdminSecret),
		cmd.Bool(flagDevMode),
		jwtAuth,
		metadataSource,
		logger,
		cmd.Root().Version,
		hasuraProxy,
	)
	if err != nil {
		// The controller did not take ownership, so release what we built.
		jwtAuth.Close()
		metadataSource.Close()

		return nil, fmt.Errorf("failed to create controller: %w", err)
	}

	router, err := getRouter(ctx, cmd, ctrl, jwtAuth, hasuraProxy, logger)
	if err != nil {
		jwtAuth.Close()
		metadataSource.Close()

		return nil, fmt.Errorf("building HTTP router: %w", err)
	}

	return &serveutil.Service{
		Handler: router,
		Background: func(ctx context.Context) error {
			logger.InfoContext(ctx, "starting controller")
			ctrl.Run(ctx, logger)
			logger.WarnContext(ctx, "controller has stopped")

			return nil
		},
		Close: func() {
			jwtAuth.Close()
			metadataSource.Close()
		},
	}, nil
}

// newMetadataSource builds the metadata source from the configured flags: a
// PostgreSQL-backed source when a metadata database URL is set, otherwise the
// file-backed source. The caller owns the returned source and must Close it.
// The interface return is intentional; the concrete implementation varies.
//
//nolint:ireturn // interface return is intentional; see doc comment
func newMetadataSource(
	ctx context.Context,
	cmd *cli.Command,
	logger *slog.Logger,
) (metadata.Source, error) {
	metaDBURL := cmd.String(flagMetadataDatabaseURL)
	if metaDBURL == "" {
		return source.NewFileMetadataSource(cmd.String(flagMetadataPath)), nil
	}

	databaseMetadataSource, err := source.NewDatabaseMetadataSource(
		ctx,
		metaDBURL,
		time.Second,
		logger,
	)
	if err != nil {
		return nil, fmt.Errorf("creating database metadata source: %w", err)
	}

	return databaseMetadataSource, nil
}

// newHasuraProxy builds the Hasura upstream proxy, or returns a nil handler
// when the upstream URL is explicitly empty. The proxy is used both as the
// NoRoute fallback (any path Constellation does not serve natively) and as the
// per-op fallback inside the /v1/metadata dispatcher (any metadata op not yet
// migrated). The default URL targets the Nhost Hasura sidecar so compatibility
// routes proxy in normal side-by-side deployments; a nil proxy makes
// unimplemented routes return 404 and unknown metadata ops return
// `not-supported`.
func newHasuraProxy(cmd *cli.Command, logger *slog.Logger) (http.Handler, error) {
	upstream := cmd.String(flagHasuraUpstreamURL)
	if upstream == "" {
		return nil, nil //nolint:nilnil // nil handler is a valid "proxy disabled" result
	}

	proxy, err := hasuraproxy.New(upstream, logger)
	if err != nil {
		return nil, fmt.Errorf("invalid %s: %w", flagHasuraUpstreamURL, err)
	}

	return proxy, nil
}

func runServer(
	ctx context.Context,
	cmd *cli.Command,
	svc *serveutil.Service,
	logger *slog.Logger,
) error {
	server, err := newHTTPServer(cmd, svc.Handler)
	if err != nil {
		return fmt.Errorf("configuring HTTP server: %w", err)
	}

	ctx, cancel := context.WithCancel(ctx)

	profileServer := startProfileServer(ctx, cmd.String(flagProfileAddress), logger)

	go func() {
		defer cancel()

		_ = svc.RunBackground(ctx)
	}()

	go func() {
		defer cancel()

		logger.InfoContext(ctx, "starting server", slog.String("address", server.Addr))

		if err := server.ListenAndServe(); err != nil {
			logger.WarnContext(ctx, err.Error())
		}
	}()

	<-ctx.Done()

	logger.WarnContext(ctx, "shutting down server")

	shutdownCtx, shutdownCancel := context.WithTimeout(
		context.Background(),
		shutdownTimeout,
	)
	defer shutdownCancel()

	if profileServer != nil {
		if err := profileServer.Shutdown( //nolint:contextcheck // parent ctx is cancelled
			shutdownCtx,
		); err != nil {
			return fmt.Errorf("failed to shutdown profiling server: %w", err)
		}
	}

	if err := server.Shutdown( //nolint:contextcheck // parent ctx is cancelled
		shutdownCtx,
	); err != nil {
		return fmt.Errorf("failed to shutdown server: %w", err)
	}

	return nil
}

func newHTTPServer(cmd *cli.Command, handler http.Handler) (*http.Server, error) {
	readTimeout, err := positiveDurationFlag(cmd, flagHTTPReadTimeout)
	if err != nil {
		return nil, err
	}

	writeTimeout, err := positiveDurationFlag(cmd, flagHTTPWriteTimeout)
	if err != nil {
		return nil, err
	}

	idleTimeout, err := positiveDurationFlag(cmd, flagHTTPIdleTimeout)
	if err != nil {
		return nil, err
	}

	return &http.Server{ //nolint:exhaustruct
		Addr:              cmd.String(flagBindAddress),
		Handler:           handler,
		ReadHeaderTimeout: min(readTimeout, maxHTTPReadHeaderTimeout),
		ReadTimeout:       readTimeout,
		WriteTimeout:      writeTimeout,
		IdleTimeout:       idleTimeout,
	}, nil
}

func positiveDurationFlag(cmd *cli.Command, name string) (time.Duration, error) {
	value := cmd.Duration(name)
	if value <= 0 {
		return 0, fmt.Errorf("%s: %w", name, errFlagMustBeGreaterThanZero)
	}

	return value, nil
}

// startProfileServer starts a pprof profiling server if profileAddr is non-empty.
// Note: the _ "net/http/pprof" import registers handlers on http.DefaultServeMux
// at import time. The main server must not use DefaultServeMux to avoid
// exposing pprof endpoints unintentionally.
func startProfileServer(
	ctx context.Context,
	profileAddr string,
	logger *slog.Logger,
) *http.Server {
	if profileAddr == "" {
		return nil
	}

	profileServer := &http.Server{ //nolint:exhaustruct
		Addr:              profileAddr,
		Handler:           http.DefaultServeMux,
		ReadHeaderTimeout: maxHTTPReadHeaderTimeout,
	}

	go func() {
		logger.InfoContext(
			ctx, "starting profiling server", slog.String("address", profileAddr),
		)

		if err := profileServer.ListenAndServe(); err != nil {
			logger.WarnContext(
				ctx, "profiling server stopped", slog.String("error", err.Error()),
			)
		}
	}()

	return profileServer
}
