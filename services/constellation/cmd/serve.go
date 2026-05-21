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
	"time"

	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/gin-gonic/gin"
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
	flagDebug                    = "debug"
	flagLogFormatTEXT            = "log-format-text"
	flagBindAddress              = "bind-address"
	flagEnablePlayground         = "enable-playground"
	flagDatabaseURL              = "database-url"
	flagMetadataPath             = "metadata-path"
	flagAdminSecret              = "admin-secret"
	flagJWTSecret                = "jwt-secret"
	flagSubscriptionPollInterval = "subscription-poll-interval"
	flagMetadataDatabaseURL      = "metadata-database-url"
	flagProfileAddress           = "profile-address"
	flagCORSAllowedOrigins       = "cors-allowed-origins"
	flagDevMode                  = "dev-mode"

	shutdownTimeout = 30 * time.Second
)

func generalFlags() []cli.Flag {
	return []cli.Flag{
		&cli.BoolFlag{ //nolint: exhaustruct
			Name:     flagDebug,
			Usage:    "enable debug logging",
			Category: "general",
			Sources:  cli.EnvVars("DEBUG"),
		},
		&cli.BoolFlag{ //nolint: exhaustruct
			Name:     flagLogFormatTEXT,
			Usage:    "format logs in plain text",
			Category: "general",
			Sources:  cli.EnvVars("LOG_FORMAT_TEXT"),
		},
	}
}

func serverFlags() []cli.Flag {
	return []cli.Flag{
		&cli.BoolFlag{ //nolint: exhaustruct
			Name:     flagEnablePlayground,
			Usage:    "enable graphql playground (under /v1)",
			Category: "server",
			Sources:  cli.EnvVars("ENABLE_PLAYGROUND"),
		},
		&cli.StringFlag{ //nolint: exhaustruct
			Name:     flagBindAddress,
			Usage:    "bind address for the server",
			Value:    ":8000",
			Category: "server",
			Sources:  cli.EnvVars("BIND_ADDRESS"),
		},
		&cli.DurationFlag{ //nolint: exhaustruct
			Name:     flagSubscriptionPollInterval,
			Usage:    "Polling interval for subscriptions",
			Category: "server",
			Value:    time.Second,
			Sources:  cli.EnvVars("SUBSCRIPTION_POLL_INTERVAL"),
		},
		&cli.StringFlag{ //nolint: exhaustruct
			Name:     flagProfileAddress,
			Usage:    "Enable CPU/memory profiling server on this address (e.g. :6060)",
			Category: "server",
			Sources:  cli.EnvVars("PROFILE_ADDRESS"),
		},
		&cli.StringSliceFlag{ //nolint: exhaustruct
			Name: flagCORSAllowedOrigins,
			Usage: "Origins permitted to make credentialed cross-origin requests. " +
				"When empty, cross-origin requests are not granted access. " +
				"\"*\" cannot be combined with credentials and is rejected at startup",
			Category: "server",
			Sources:  cli.EnvVars("CORS_ALLOWED_ORIGINS"),
		},
		&cli.BoolFlag{ //nolint: exhaustruct
			Name: flagDevMode,
			Usage: "return raw connector/database error detail to clients instead " +
				"of the sanitized generic message. For development only — never " +
				"enable in production, as it leaks internal schema and data values",
			Category: "server",
			Sources:  cli.EnvVars("NHOST_DEV_MODE"),
		},
	}
}

func dataFlags() []cli.Flag {
	return []cli.Flag{
		&cli.StringFlag{ //nolint: exhaustruct
			Name:     flagDatabaseURL,
			Usage:    "PostgreSQL database connection URL",
			Value:    "postgres://postgres:postgres@localhost:5432/postgres",
			Category: "database",
			Sources:  cli.EnvVars("DATABASE_URL"),
		},
		&cli.StringFlag{ //nolint: exhaustruct
			Name:     flagMetadataPath,
			Usage:    "Path to metadata.yaml file",
			Value:    "./metadata/metadata.yaml",
			Category: "metadata",
			Sources:  cli.EnvVars("METADATA_PATH"),
		},
		&cli.StringFlag{ //nolint: exhaustruct
			Name:     flagMetadataDatabaseURL,
			Usage:    "PostgreSQL URL for reading Hasura metadata from hdb_catalog.hdb_metadata",
			Category: "metadata",
			Sources:  cli.EnvVars("METADATA_DATABASE_URL"),
		},
	}
}

func securityFlags() []cli.Flag {
	return []cli.Flag{
		&cli.StringFlag{ //nolint: exhaustruct
			Name:     flagAdminSecret,
			Usage:    "Admin secret for securing the GraphQL API",
			Category: "security",
			Required: true,
			Sources: cli.EnvVars(
				"ADMIN_SECRET",
				"NHOST_ADMIN_SECRET",
				"HASURA_GRAPHQL_ADMIN_SECRET",
			),
		},
		&cli.StringFlag{ //nolint: exhaustruct
			Name:     flagJWTSecret,
			Usage:    "JWT secret configuration (JSON string or JSON array of secrets)",
			Category: "security",
			Required: true,
			Sources: cli.EnvVars(
				"HASURA_GRAPHQL_JWT_SECRET",
				"NHOST_JWT_SECRET",
			),
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
	return &cli.Command{ //nolint: exhaustruct
		Name:   "serve",
		Usage:  "Serve the application",
		Flags:  serveFlags(),
		Action: serve,
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
		AllowedHeaders:   []string{"Origin", "Content-Type", "Accept", "Authorization"},
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
			slog.String("env", "CORS_ALLOWED_ORIGINS"),
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

	if cmd.Bool(flagEnablePlayground) {
		router.GET("/", playgroundHandler("/graphql"))
	}

	router.POST("/graphql", ctrl.HandlerPost)
	router.GET("/graphql", ctrl.HandlerGet)

	return router, nil
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

func newMetadataSource( //nolint:ireturn
	ctx context.Context, cmd *cli.Command, logger *slog.Logger,
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

	server := &http.Server{ //nolint:exhaustruct
		Addr:              cmd.String(flagBindAddress),
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second, //nolint:mnd
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
		ReadHeaderTimeout: 5 * time.Second, //nolint:mnd
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
