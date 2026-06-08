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
	"github.com/nhost/nhost/services/constellation/connector"
	"github.com/nhost/nhost/services/constellation/controller"
	"github.com/nhost/nhost/services/constellation/controller/middleware"
	"github.com/nhost/nhost/services/constellation/internal/jwt"
	"github.com/nhost/nhost/services/constellation/internal/jwt/jwtconfig"
	oapicors "github.com/nhost/nhost/services/constellation/internal/lib/oapi/cors"
	oapilogger "github.com/nhost/nhost/services/constellation/internal/lib/oapi/logger"
	oapitracing "github.com/nhost/nhost/services/constellation/internal/lib/oapi/tracing"
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
	flagActionLogDatabaseURL         = "action-log-database-url"
	flagActionLogSchema              = "action-log-schema"
	flagActionLogTable               = "action-log-table"
	flagActionLogCreateTable         = "action-log-create-table"
	flagActionWorkerEnabled          = "action-worker-enabled"
	flagActionLogExclusiveOwner      = "action-log-exclusive-owner"
	flagProfileAddress               = "profile-address"
	flagCORSAllowedOrigins           = "cors-allowed-origins"
	flagDevMode                      = "dev-mode"
	flagGraphQLRequestBodyLimitBytes = "graphql-request-body-limit-bytes"
	flagHTTPReadTimeout              = "http-read-timeout"
	//nolint:gosec // CLI flag name contains "write" but is not a credential.
	flagHTTPWriteTimeout = "http-write-timeout"
	flagHTTPIdleTimeout  = "http-idle-timeout"

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

func serverFlags() []cli.Flag {
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

func actionFlags() []cli.Flag {
	return []cli.Flag{
		&cli.StringFlag{ //nolint:exhaustruct
			Name:     flagActionLogDatabaseURL,
			Usage:    "PostgreSQL URL for asynchronous action logs; defaults to metadata DB or first Postgres source",
			Category: "actions",
			Sources:  cli.EnvVars("CONSTELLATION_ACTION_LOG_DATABASE_URL"),
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:     flagActionLogSchema,
			Usage:    "PostgreSQL schema containing the asynchronous action log table",
			Value:    "hdb_catalog",
			Category: "actions",
			Sources:  cli.EnvVars("CONSTELLATION_ACTION_LOG_SCHEMA"),
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:     flagActionLogTable,
			Usage:    "PostgreSQL table containing asynchronous action logs",
			Value:    "hdb_action_log",
			Category: "actions",
			Sources:  cli.EnvVars("CONSTELLATION_ACTION_LOG_TABLE"),
		},
		&cli.BoolFlag{ //nolint:exhaustruct
			Name:     flagActionLogCreateTable,
			Usage:    "create the asynchronous action log schema/table when missing",
			Category: "actions",
			Sources:  cli.EnvVars("CONSTELLATION_ACTION_LOG_CREATE_TABLE"),
		},
		&cli.BoolFlag{ //nolint:exhaustruct
			Name:     flagActionWorkerEnabled,
			Usage:    "enable Constellation's asynchronous action worker",
			Category: "actions",
			Sources:  cli.EnvVars("CONSTELLATION_ACTION_WORKER_ENABLED"),
		},
		&cli.BoolFlag{ //nolint:exhaustruct
			Name:     flagActionLogExclusiveOwner,
			Usage:    "assert this process exclusively owns the configured action log table while the worker is enabled",
			Category: "actions",
			Sources:  cli.EnvVars("CONSTELLATION_ACTION_LOG_EXCLUSIVE_OWNER"),
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
	flags = append(flags, actionFlags()...)
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
// cross-origin reads are denied. A configured "*" combined with credentials is
// rejected (see oapicors.Options.Validate) rather than silently
// reflecting arbitrary origins.
func getCorsOptions(
	ctx context.Context,
	cmd *cli.Command,
	logger *slog.Logger,
) (oapicors.Options, error) {
	allowedOrigins := cmd.StringSlice(flagCORSAllowedOrigins)
	if allowedOrigins == nil {
		// A non-nil, empty slice denies all cross-origin requests; a nil slice
		// would instead reflect every origin, which is not the safe default.
		allowedOrigins = []string{}
	}

	opts := oapicors.Options{
		AllowOriginFunc:  nil,
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowHeadersFunc: allowRequestHeader,
		AllowedHeaders:   nil,
		ExposedHeaders:   nil,
		AllowCredentials: true,
		MaxAge:           "86400",
	}

	if err := opts.Validate(); err != nil {
		return oapicors.Options{}, fmt.Errorf(
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

func getRouter(
	ctx context.Context,
	cmd *cli.Command,
	ctrl *controller.Controller,
	jwtAuth middleware.JWTAuthenticator,
	logger *slog.Logger,
) (*gin.Engine, error) {
	corsOpts, err := getCorsOptions(ctx, cmd, logger)
	if err != nil {
		return nil, err
	}

	corsHandler, err := oapicors.CORS(corsOpts)
	if err != nil {
		return nil, fmt.Errorf("building CORS middleware: %w", err)
	}

	router := gin.New()

	router.Use(
		gin.Recovery(),
		oapitracing.Tracing(),
		oapilogger.Logger(logger),
		corsHandler,
		//nolint:contextcheck // middleware runs per-request with the request's
		// own context; the startup ctx must not be propagated here.
		middleware.Session(cmd.String(flagAdminSecret), jwtAuth),
	)

	router.GET("/healthz", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})
	router.HEAD("/healthz", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	router.GET("/v1/version", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"version": cmd.Root().Version})
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

//nolint:ireturn // Selected concrete sources intentionally share metadata.Source.
func newMetadataSource(
	ctx context.Context,
	cmd *cli.Command,
	logger *slog.Logger,
) (metadata.Source, error) {
	if metaDBURL := cmd.String(flagMetadataDatabaseURL); metaDBURL != "" {
		source, err := source.NewDatabaseMetadataSource(
			ctx,
			metaDBURL,
			time.Second,
			logger,
		)
		if err != nil {
			return nil, fmt.Errorf("creating database metadata source: %w", err)
		}

		return source, nil
	}

	return source.NewFileMetadataSource(cmd.String(flagMetadataPath)), nil
}

func actionLogConfigFromFlags(cmd *cli.Command) connector.ActionLogConfig {
	return connector.ActionLogConfig{
		Store:               nil,
		DatabaseURL:         cmd.String(flagActionLogDatabaseURL),
		MetadataDatabaseURL: cmd.String(flagMetadataDatabaseURL),
		Schema:              cmd.String(flagActionLogSchema),
		Table:               cmd.String(flagActionLogTable),
		CreateIfNotExists:   cmd.Bool(flagActionLogCreateTable),
		WorkerEnabled:       cmd.Bool(flagActionWorkerEnabled),
		ExclusiveOwner:      cmd.Bool(flagActionLogExclusiveOwner),
		PollInterval:        0,
		BatchSize:           0,
		MaxConcurrency:      0,
		ShutdownTimeout:     0,
	}
}

func serve(ctx context.Context, cmd *cli.Command) error {
	logger := getLogger(cmd.Bool(flagDebug), cmd.Bool(flagLogFormatTEXT))
	logger.InfoContext(ctx, cmd.Root().Name+" v"+cmd.Root().Version)
	logFlags(ctx, logger, cmd)

	source, err := newMetadataSource(ctx, cmd, logger)
	if err != nil {
		return fmt.Errorf("failed to create metadata source: %w", err)
	}

	defer source.Close()

	jwtAuth, err := initJWTAuth(ctx, cmd, logger)
	if err != nil {
		return fmt.Errorf("initializing JWT auth: %w", err)
	}

	defer jwtAuth.Close()

	ctrl, err := controller.New(
		ctx,
		cmd.Duration(flagSubscriptionPollInterval),
		cmd.String(flagAdminSecret),
		cmd.Bool(flagDevMode),
		jwtAuth,
		source,
		logger,
		controller.WithConnectorOptions(
			connector.WithActionLogConfig(actionLogConfigFromFlags(cmd)),
		),
	)
	if err != nil {
		return fmt.Errorf("failed to create controller: %w", err)
	}

	return runServer(ctx, cmd, ctrl, jwtAuth, logger)
}

func runServer(
	ctx context.Context,
	cmd *cli.Command,
	ctrl *controller.Controller,
	jwtAuth middleware.JWTAuthenticator,
	logger *slog.Logger,
) error {
	router, err := getRouter(ctx, cmd, ctrl, jwtAuth, logger)
	if err != nil {
		return fmt.Errorf("building HTTP router: %w", err)
	}

	server, err := newHTTPServer(cmd, router)
	if err != nil {
		return fmt.Errorf("configuring HTTP server: %w", err)
	}

	ctx, cancel := context.WithCancel(ctx)

	profileServer := startProfileServer(ctx, cmd.String(flagProfileAddress), logger)

	go func() {
		defer cancel()

		logger.InfoContext(ctx, "starting controller")
		ctrl.Run(ctx, logger)
		logger.WarnContext(ctx, "controller has stopped")
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
