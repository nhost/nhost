package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"

	serveutil "github.com/nhost/nhost/internal/lib/serve"
	"github.com/nhost/nhost/services/nhost-engine/internal/runner"
	"github.com/urfave/cli/v3"
)

const (
	// defaultBind is the shared listener address used when neither --bind nor
	// --port is set.
	defaultBind = ":8080"
	// readHeaderTimeout bounds how long the shared server waits for request
	// headers, mirroring the per-service standalone servers.
	readHeaderTimeout = 5 * time.Second
	// shutdownTimeout bounds the graceful shutdown of the shared server once the
	// process context is cancelled.
	shutdownTimeout = 30 * time.Second

	// The shared server's request timeouts default to constellation's values,
	// since it is the service most sensitive to them (long-lived GraphQL
	// responses); auth and storage previously left them unset.
	defaultHTTPReadTimeout  = 30 * time.Second
	defaultHTTPWriteTimeout = 5 * time.Minute
	defaultHTTPIdleTimeout  = 120 * time.Second
)

// errHelpRequested signals that a service invocation only printed help/version
// (its Action never ran) so the engine has nothing to compose for it.
var errHelpRequested = errors.New("help requested")

// sharedConfig holds the engine-level configuration parsed from the shared flag
// region that precedes the first service. Process-level settings (listener,
// logger, HTTP timeouts) configure the engine directly; the cross-cutting
// values (secrets, database URLs, CORS origins) are injected into each service
// that consumes them, filling only the flags the service did not set itself.
type sharedConfig struct {
	bind          string
	debug         bool
	logFormatText bool

	httpReadTimeout  time.Duration
	httpWriteTimeout time.Duration
	httpIdleTimeout  time.Duration

	adminSecret   string
	jwtSecret     string
	databaseURL   string
	migrationsURL string
	corsOrigins   []string
}

// sharedFlags defines the engine-level flag surface. Cross-cutting settings use
// the NHOST_ env prefix; the values they carry are mapped onto each service's
// own flags by sharedOverridesFor.
func sharedFlags() []cli.Flag {
	return []cli.Flag{
		&cli.StringFlag{ //nolint:exhaustruct
			Name:    "bind",
			Usage:   "address the shared listener binds to (wins over --port)",
			Value:   defaultBind,
			Sources: cli.EnvVars("NHOST_BIND"),
		},
		&cli.IntFlag{ //nolint:exhaustruct
			Name:    "port",
			Usage:   "port the shared listener binds to; forms :PORT when --bind is unset",
			Sources: cli.EnvVars("NHOST_PORT"),
		},
		&cli.BoolFlag{ //nolint:exhaustruct
			Name:    "debug",
			Usage:   "enable debug logging",
			Sources: cli.EnvVars("NHOST_DEBUG"),
		},
		&cli.BoolFlag{ //nolint:exhaustruct
			Name:    "log-format-text",
			Usage:   "log in human-friendly text format instead of JSON",
			Sources: cli.EnvVars("NHOST_LOG_FORMAT_TEXT"),
		},
		&cli.DurationFlag{ //nolint:exhaustruct
			Name:    "http-read-timeout",
			Usage:   "shared server read timeout",
			Value:   defaultHTTPReadTimeout,
			Sources: cli.EnvVars("NHOST_HTTP_READ_TIMEOUT"),
		},
		&cli.DurationFlag{ //nolint:exhaustruct
			Name:    "http-write-timeout",
			Usage:   "shared server write timeout",
			Value:   defaultHTTPWriteTimeout,
			Sources: cli.EnvVars("NHOST_HTTP_WRITE_TIMEOUT"),
		},
		&cli.DurationFlag{ //nolint:exhaustruct
			Name:    "http-idle-timeout",
			Usage:   "shared server idle timeout",
			Value:   defaultHTTPIdleTimeout,
			Sources: cli.EnvVars("NHOST_HTTP_IDLE_TIMEOUT"),
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:    "admin-secret",
			Usage:   "Hasura admin secret shared by every service",
			Sources: cli.EnvVars("NHOST_ADMIN_SECRET"),
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:    "jwt-secret",
			Usage:   "Hasura GraphQL JWT secret shared by auth and graphql",
			Sources: cli.EnvVars("NHOST_JWT_SECRET"),
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:    "database-url",
			Usage:   "PostgreSQL connection URL shared by auth and graphql",
			Sources: cli.EnvVars("NHOST_DATABASE_URL"),
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:    "migrations-database-url",
			Usage:   "PostgreSQL migrations connection URL shared by auth and storage",
			Sources: cli.EnvVars("NHOST_MIGRATIONS_DATABASE_URL"),
		},
		&cli.StringSliceFlag{ //nolint:exhaustruct
			Name:    "cors-allowed-origins",
			Usage:   "origins permitted to make cross-origin requests, shared by storage and graphql",
			Sources: cli.EnvVars("NHOST_CORS_ALLOWED_ORIGINS"),
		},
	}
}

// sharedRequest is a top-level intent parsed from the shared flag segment. A
// help or version request supersedes running any service; requestRun means the
// shared flags were plain configuration and service selection should proceed.
type sharedRequest int

const (
	requestRun sharedRequest = iota
	requestHelp
	requestVersion
)

// helpVersionFlags are the engine's --help/--version flags. They are parsed as
// ordinary bool flags (see parseSharedFlags) so a shared flag *value* can never
// be mistaken for a help or version request.
func helpVersionFlags() []cli.Flag {
	return []cli.Flag{
		&cli.BoolFlag{ //nolint:exhaustruct
			Name:    "help",
			Aliases: []string{"h"},
			Usage:   "show engine help and exit",
		},
		&cli.BoolFlag{ //nolint:exhaustruct
			Name:    "version",
			Aliases: []string{"v"},
			Usage:   "show engine version and exit",
		},
	}
}

// errUnexpectedSharedArg is returned when the shared flag segment carries a
// bare positional argument. This is almost always a mistyped first service
// (e.g. "nhost-engine storag -- auth"): Split, which only knows service names
// and not flag arities, leaves such a leading token in the shared segment, and
// urfave/cli — which does know arities — collects it into cmd.Args() instead of
// consuming it as a flag value. Rejecting it here turns a silent drop (only
// "auth" would run) into a clear error.
var errUnexpectedSharedArg = errors.New("unexpected argument in shared flags")

// parseSharedFlags parses the shared flag region (everything before the first
// service) into the engine-level configuration and reports whether the caller
// asked for engine help or version.
//
// Help and version are owned by the shared cli.Command as ordinary bool flags
// rather than a raw token scan, so detection is arity-aware: a shared flag
// *value* that happens to read like a help/version token (e.g.
// "--admin-secret help") is treated as the value it is, not as a help request.
// Unknown flags are rejected here rather than silently ignored, as is a stray
// bare positional (see errUnexpectedSharedArg). Because urfave is arity-aware, a
// genuine flag value is consumed and never counted as a stray positional.
func parseSharedFlags(
	ctx context.Context, shared []string,
) (sharedConfig, sharedRequest, error) {
	var (
		cfg      sharedConfig
		leftover []string
	)

	app := &cli.Command{ //nolint:exhaustruct
		Name: "nhost-engine",
		// Silence urfave's built-in usage/error output; the engine prints its
		// own usageText on failure so callers see one consistent message.
		Writer:    io.Discard,
		ErrWriter: io.Discard,
		// Own --help/--version as plain bool flags so detection stays
		// arity-aware and works even when main.Version was not set at build time.
		HideHelp:    true,
		HideVersion: true,
		Flags:       append(sharedFlags(), helpVersionFlags()...),
		Action: func(_ context.Context, cmd *cli.Command) error {
			cfg = sharedConfig{
				bind:             resolveBind(cmd),
				debug:            cmd.Bool("debug"),
				logFormatText:    cmd.Bool("log-format-text"),
				httpReadTimeout:  cmd.Duration("http-read-timeout"),
				httpWriteTimeout: cmd.Duration("http-write-timeout"),
				httpIdleTimeout:  cmd.Duration("http-idle-timeout"),
				adminSecret:      cmd.String("admin-secret"),
				jwtSecret:        cmd.String("jwt-secret"),
				databaseURL:      cmd.String("database-url"),
				migrationsURL:    cmd.String("migrations-database-url"),
				corsOrigins:      cmd.StringSlice("cors-allowed-origins"),
			}

			// Any bare positional left after arity-aware flag parsing is a stray
			// token; capture it so the run path below can reject it.
			leftover = cmd.Args().Slice()

			return nil
		},
	}

	if err := app.Run(ctx, append([]string{"nhost-engine"}, shared...)); err != nil {
		return sharedConfig{}, requestRun, fmt.Errorf("parsing shared flags: %w", err)
	}

	// cfg is left zero for --help (urfave skips the Action) and is unused by the
	// caller for both help and version, so it is safe to return as-is here.
	switch {
	case app.Bool("help"):
		return cfg, requestHelp, nil
	case app.Bool("version"):
		return cfg, requestVersion, nil
	case len(leftover) > 0:
		return sharedConfig{}, requestRun, fmt.Errorf(
			"%w: %q; expected a service name, one of %v",
			errUnexpectedSharedArg, leftover, serviceNames(),
		)
	default:
		return cfg, requestRun, nil
	}
}

// resolveBind picks the shared listener address: an explicit --bind wins, else
// --port forms ":PORT", else the default.
func resolveBind(cmd *cli.Command) string {
	switch {
	case cmd.IsSet("bind"):
		return cmd.String("bind")
	case cmd.IsSet("port"):
		return fmt.Sprintf(":%d", cmd.Int("port"))
	default:
		return defaultBind
	}
}

// sharedOverride is a shared value destined for one of a service's flags. values
// holds a single element for scalar flags and one element per entry for slice
// flags.
type sharedOverride struct {
	flag   string
	values []string
}

// sharedOverridesFor returns the shared values that should fill the named
// service's flags. Only non-empty shared values are candidates; whether each is
// actually applied (service-wins precedence) is decided by applySharedConfig.
func sharedOverridesFor(service string, cfg sharedConfig) []sharedOverride {
	var out []sharedOverride

	scalar := func(flag, value string) {
		if value != "" {
			out = append(out, sharedOverride{flag: flag, values: []string{value}})
		}
	}

	cors := func(flag string) {
		if len(cfg.corsOrigins) > 0 {
			out = append(out, sharedOverride{flag: flag, values: cfg.corsOrigins})
		}
	}

	switch service {
	case "auth":
		scalar("hasura-admin-secret", cfg.adminSecret)
		scalar("hasura-graphql-jwt-secret", cfg.jwtSecret)
		scalar("postgres", cfg.databaseURL)
		scalar("postgres-migrations", cfg.migrationsURL)
	case "storage":
		scalar("hasura-graphql-admin-secret", cfg.adminSecret)
		scalar("postgres-migrations-source", cfg.migrationsURL)
		cors("cors-allow-origins")
	case "graphql":
		scalar("admin-secret", cfg.adminSecret)
		scalar("jwt-secret", cfg.jwtSecret)
		scalar("metadata-database-url", cfg.databaseURL)
		cors("cors-allowed-origins")
	}

	return out
}

// applySharedConfig injects shared values onto a service's parsed command,
// filling only the flags the service did not set itself (via CLI arg or its own
// env var), so an explicit per-service value always wins.
func applySharedConfig(cmd *cli.Command, service string, cfg sharedConfig) error {
	for _, o := range sharedOverridesFor(service, cfg) {
		if cmd.IsSet(o.flag) {
			continue
		}

		for _, v := range o.values {
			if err := cmd.Set(o.flag, v); err != nil {
				return fmt.Errorf(
					"applying shared config to %s flag %q: %w", service, o.flag, err,
				)
			}
		}
	}

	return nil
}

// mounted pairs a built service with the metadata needed to route, run, and
// shut it down under the shared lifecycle.
type mounted struct {
	name   string
	prefix string
	svc    *serveutil.Service
}

// runServices composes the selected services behind one shared listener and
// runs them under ctx. Each service handler is mounted beneath its path prefix,
// each background loop and the shared HTTP server run as supervised units, and
// every service's resources are released once they all return.
func runServices(
	ctx context.Context,
	cfg sharedConfig,
	invocations []runner.Invocation,
	version string,
) error {
	logger := serveutil.NewLogger(cfg.debug, cfg.logFormatText)

	services := make([]mounted, 0, len(invocations))

	// Shut down everything we built, even on a mid-build failure, in reverse
	// order of construction.
	defer func() {
		for i := len(services) - 1; i >= 0; i-- {
			services[i].svc.Shutdown()
		}
	}()

	for _, inv := range invocations {
		def := serviceRegistry()[inv.Name]

		svc, err := buildService(ctx, def, inv, version, logger, cfg)
		if errors.Is(err, errHelpRequested) {
			continue
		}

		if err != nil {
			return fmt.Errorf("initializing %s: %w", inv.Name, err)
		}

		services = append(
			services, mounted{name: inv.Name, prefix: def.prefix, svc: svc},
		)

		logger.InfoContext(
			ctx, "mounted service",
			slog.String("service", inv.Name),
			slog.String("prefix", def.prefix),
		)
	}

	if len(services) == 0 {
		// Every invocation only printed help/version; nothing to serve.
		return nil
	}

	logger.InfoContext(ctx, "nhost-engine v"+version)

	return superviseShared(ctx, cfg, newMux(services), services, logger)
}

// newMux builds the shared request router: each service is mounted beneath its
// path prefix with the prefix stripped before dispatch, so the service handler
// keeps serving its own native paths. A root /healthz reports engine liveness.
func newMux(services []mounted) *http.ServeMux {
	mux := http.NewServeMux()

	for _, m := range services {
		mux.Handle(m.prefix+"/", http.StripPrefix(m.prefix, m.svc.Handler))
	}

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, "ok")
	})

	return mux
}

// buildService parses one service invocation's flags through its own CLI (so
// env sources, defaults, and validation behave exactly as standalone), injects
// the shared engine config into any flags the service left unset, and
// constructs its serve.Service. When the invocation only prints help or
// version, its Action never runs and errHelpRequested is returned.
func buildService(
	ctx context.Context,
	def serviceDef,
	inv runner.Invocation,
	version string,
	logger *slog.Logger,
	cfg sharedConfig,
) (*serveutil.Service, error) {
	serveCmd := def.command()

	var built *serveutil.Service

	app := &cli.Command{ //nolint:exhaustruct
		Name:    inv.Name,
		Version: version,
		Usage:   serveCmd.Usage,
		Flags:   serveCmd.Flags,
		Action: func(ctx context.Context, cmd *cli.Command) error {
			if err := applySharedConfig(cmd, inv.Name, cfg); err != nil {
				return err
			}

			svc, err := def.newService(ctx, cmd, logger)
			if err != nil {
				return err
			}

			built = svc

			return nil
		},
	}

	if err := app.Run(ctx, append([]string{inv.Name}, inv.Args...)); err != nil {
		return nil, fmt.Errorf("running %s command: %w", inv.Name, err)
	}

	if built == nil {
		return nil, errHelpRequested
	}

	return built, nil
}

// superviseShared runs every service's background loop and the shared HTTP
// server as peers: the moment any returns, the rest are torn down together.
func superviseShared(
	ctx context.Context,
	cfg sharedConfig,
	handler http.Handler,
	services []mounted,
	logger *slog.Logger,
) error {
	server := &http.Server{ //nolint:exhaustruct
		Addr:              cfg.bind,
		Handler:           handler,
		ReadHeaderTimeout: readHeaderTimeout,
		ReadTimeout:       cfg.httpReadTimeout,
		WriteTimeout:      cfg.httpWriteTimeout,
		IdleTimeout:       cfg.httpIdleTimeout,
	}

	units := make([]runner.Service, 0, len(services)+1)

	for _, m := range services {
		units = append(units, m.svc.RunBackground)
	}

	units = append(units, httpServerUnit(server, logger))

	if err := runner.Supervise(ctx, units); err != nil {
		return fmt.Errorf("running services: %w", err)
	}

	return nil
}

// httpServerUnit adapts the shared HTTP server into a supervised unit: it
// listens until the server fails or ctx is cancelled, then shuts the server
// down gracefully.
func httpServerUnit(server *http.Server, logger *slog.Logger) runner.Service {
	return func(ctx context.Context) error {
		errc := make(chan error, 1)

		go func() {
			logger.InfoContext(
				ctx, "starting shared server", slog.String("address", server.Addr),
			)

			err := server.ListenAndServe()
			if errors.Is(err, http.ErrServerClosed) {
				err = nil
			}

			errc <- err
		}()

		select {
		case err := <-errc:
			if err != nil {
				return fmt.Errorf("shared server failed: %w", err)
			}

			return nil
		case <-ctx.Done():
			logger.InfoContext(ctx, "shutting down shared server")

			shutdownCtx, cancel := context.WithTimeout(
				context.Background(), shutdownTimeout,
			)
			defer cancel()

			if err := server.Shutdown(shutdownCtx); err != nil { //nolint:contextcheck
				return fmt.Errorf("shutting down shared server: %w", err)
			}

			return nil
		}
	}
}
