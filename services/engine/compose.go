package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"reflect"
	"time"

	serveutil "github.com/nhost/nhost/internal/lib/serve"
	"github.com/nhost/nhost/services/engine/internal/runner"
	"github.com/urfave/cli/v3"
)

const (
	// defaultBind is the shared listener address used when --bind is not set.
	defaultBind = ":8080"
	// readHeaderTimeout bounds how long the shared server waits for request
	// headers, mirroring the per-service standalone servers.
	readHeaderTimeout = 5 * time.Second
	// shutdownTimeout bounds the graceful shutdown of the shared server once the
	// process context is cancelled.
	shutdownTimeout = 30 * time.Second
)

// serveConfig holds the engine-level configuration parsed from the serve
// command's global flags. Process-level settings (listener, logger, HTTP
// timeouts) configure the engine directly; the cross-cutting values (secrets,
// database URLs, CORS origins) are injected into each service that consumes
// them, filling only the flags the service did not set itself. disabled records
// the services opted out of with --disable-<service>.
type serveConfig struct {
	bind          string
	debug         bool
	logFormatText bool

	adminSecret   string
	jwtSecret     string
	databaseURL   string
	migrationsURL string
	corsOrigins   []string

	disabled map[string]bool
}

// globalFlags defines the engine's shared flag surface. These consolidate the
// settings common to every service: the listener, logging, shared secrets,
// database URLs, and CORS origins, plus the --disable-<service> opt-outs. They
// use bare env vars (BIND, ADMIN_SECRET, ...) because the engine replaces the
// individual service binaries rather than running alongside them.
func globalFlags() []cli.Flag {
	// A plain literal plus a trailing append is deliberately used over a
	// capacity-hinted make(): this runs once at startup, so the presize is not
	// worth a hand-maintained flag count.
	flags := []cli.Flag{ //nolint:prealloc
		&cli.StringFlag{ //nolint:exhaustruct
			Name:    "bind",
			Usage:   "address the shared listener binds to",
			Value:   defaultBind,
			Sources: cli.EnvVars("BIND"),
		},
		&cli.BoolFlag{ //nolint:exhaustruct
			Name:    "debug",
			Usage:   "enable debug logging",
			Sources: cli.EnvVars("DEBUG"),
		},
		&cli.BoolFlag{ //nolint:exhaustruct
			Name:    "log-format-text",
			Usage:   "log in human-friendly text format instead of JSON",
			Sources: cli.EnvVars("LOG_FORMAT_TEXT"),
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:    "admin-secret",
			Usage:   "Hasura admin secret shared by every service",
			Sources: cli.EnvVars("ADMIN_SECRET"),
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:    "jwt-secret",
			Usage:   "Hasura GraphQL JWT secret shared by auth and graphql",
			Sources: cli.EnvVars("JWT_SECRET"),
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:    "database-url",
			Usage:   "PostgreSQL connection URL shared by auth and graphql",
			Sources: cli.EnvVars("DATABASE_URL"),
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:    "migrations-database-url",
			Usage:   "PostgreSQL migrations connection URL shared by auth and storage",
			Sources: cli.EnvVars("MIGRATIONS_DATABASE_URL"),
		},
		&cli.StringSliceFlag{ //nolint:exhaustruct
			Name:    "cors-allowed-origins",
			Usage:   "origins permitted to make cross-origin requests, shared by storage and graphql",
			Sources: cli.EnvVars("CORS_ALLOWED_ORIGINS"),
		},
	}

	// Append one --disable-<service> opt-out per service after the shared
	// globals, keeping the surface "globals, then a disable flag per service".
	for _, name := range serviceOrder() {
		flags = append(flags, &cli.BoolFlag{ //nolint:exhaustruct
			Name:     "disable-" + name,
			Usage:    "do not run the " + name + " service",
			Category: "services",
			Sources:  cli.EnvVars(prefixedEnv("disable", name)),
		})
	}

	return flags
}

// serveFlags is the full flag surface of the serve command: the shared globals
// followed by every service's prefixed passthrough flags.
func serveFlags() []cli.Flag {
	flags := globalFlags()

	reg := serviceRegistry()
	for _, name := range serviceOrder() {
		def := reg[name]
		flags = append(
			flags,
			servicePrefixedFlags(name, def.command().Flags, def.skip, def.hidden)...,
		)
	}

	return flags
}

// serveConfigFrom reads the engine-level configuration from the parsed serve
// command.
func serveConfigFrom(cmd *cli.Command) serveConfig {
	disabled := make(map[string]bool, len(serviceOrder()))
	for _, name := range serviceOrder() {
		disabled[name] = cmd.Bool("disable-" + name)
	}

	return serveConfig{
		bind:          cmd.String("bind"),
		debug:         cmd.Bool("debug"),
		logFormatText: cmd.Bool("log-format-text"),
		adminSecret:   cmd.String("admin-secret"),
		jwtSecret:     cmd.String("jwt-secret"),
		databaseURL:   cmd.String("database-url"),
		migrationsURL: cmd.String("migrations-database-url"),
		corsOrigins:   cmd.StringSlice("cors-allowed-origins"),
		disabled:      disabled,
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
func sharedOverridesFor(service string, cfg serveConfig) []sharedOverride {
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
// filling only the flags the service did not set itself (via prefixed flag or
// its own env var), so an explicit per-service value always wins.
func applySharedConfig(cmd *cli.Command, service string, cfg serveConfig) error {
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

// runServe composes the enabled services behind one shared listener and runs
// them under ctx. Each service handler is mounted beneath its path prefix, each
// background loop and the shared HTTP server run as supervised units, and every
// service's resources are released once they all return.
func runServe(ctx context.Context, cmd *cli.Command, version string) error {
	cfg := serveConfigFrom(cmd)
	logger := serveutil.NewLogger(cfg.debug, cfg.logFormatText)

	reg := serviceRegistry()
	services := make([]mounted, 0, len(serviceOrder()))

	// Shut down everything we built, even on a mid-build failure, in reverse
	// order of construction.
	defer func() {
		for i := len(services) - 1; i >= 0; i-- {
			services[i].svc.Shutdown()
		}
	}()

	for _, name := range serviceOrder() {
		if cfg.disabled[name] {
			logger.InfoContext(ctx, "service disabled", slog.String("service", name))

			continue
		}

		def := reg[name]

		svc, err := buildService(ctx, def, name, cmd, version, logger, cfg)
		if err != nil {
			return fmt.Errorf("initializing %s: %w", name, err)
		}

		services = append(
			services, mounted{name: name, prefix: def.prefix, svc: svc},
		)

		logger.InfoContext(
			ctx, "mounted service",
			slog.String("service", name),
			slog.String("prefix", def.prefix),
		)
	}

	if len(services) == 0 {
		return errAllServicesDisabled
	}

	logger.InfoContext(ctx, "engine v"+version)

	return superviseShared(ctx, cfg, newMux(services), services, logger)
}

var (
	// errAllServicesDisabled is returned when every service was turned off with
	// a --disable-<service> flag, leaving the engine with nothing to run.
	errAllServicesDisabled = errors.New("all services disabled; nothing to run")
	// errServiceNotBuilt is returned when a service's command ran without
	// constructing its serve.Service (which should never happen once its action
	// runs), guarding against a nil dereference downstream.
	errServiceNotBuilt = errors.New("service was not constructed")
	// errMissingRequired is returned when a service flag the engine consolidates
	// into a global is required by the service but was filled by neither the
	// global nor the service's own environment.
	errMissingRequired = errors.New("required value not provided")
)

// relaxRequiredForSkipped clears the Required bit on the service's own flags
// that the engine consolidates into globals (those in skip), and returns their
// names. Those values are injected after parsing by applySharedConfig, so
// urfave's parse-time required check would otherwise fail before the engine
// can fill them. buildService re-validates the returned flags once the global
// has been applied, so "must be provided" is still enforced — by the engine
// rather than the sub-CLI. Only skipped flags are touched; a flag the user
// must supply per-service keeps its own required check. The flags come from a
// freshly built command (def.command()), so mutating them is safe.
func relaxRequiredForSkipped(flags []cli.Flag, skip map[string]bool) []string {
	var relaxed []string

	for _, f := range flags {
		if !skip[f.Names()[0]] {
			continue
		}

		rf, ok := f.(cli.RequiredFlag)
		if !ok || !rf.IsRequired() {
			continue
		}

		v := reflect.ValueOf(f)
		if v.Kind() != reflect.Pointer || v.IsNil() {
			continue
		}

		field := v.Elem().FieldByName("Required")
		if field.IsValid() && field.CanSet() && field.Kind() == reflect.Bool {
			field.SetBool(false)

			relaxed = append(relaxed, f.Names()[0])
		}
	}

	return relaxed
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

// buildService parses one service's prefixed flags back through its own CLI (so
// env sources, defaults, and validation behave exactly as standalone), injects
// the shared engine config into any flags the service left unset, and
// constructs its serve.Service.
func buildService(
	ctx context.Context,
	def serviceDef,
	name string,
	cmd *cli.Command,
	version string,
	logger *slog.Logger,
	cfg serveConfig,
) (*serveutil.Service, error) {
	serveCmd := def.command()
	args := servicePassthroughArgs(name, cmd, serveCmd.Flags, def.skip)

	// A service's own flag may be both consolidated into an engine global (in
	// def.skip) and marked Required by the service. urfave enforces Required
	// during parse, before the Action runs, so it would fail before
	// applySharedConfig can inject the global value. Relax Required on those
	// flags for the engine's wrapper command and re-validate below, once the
	// global has been applied — the "must be provided" guarantee is preserved,
	// just enforced by the engine instead of the sub-CLI. Non-skipped Required
	// flags (values the user must supply per-service) keep their parse-time check.
	relaxed := relaxRequiredForSkipped(serveCmd.Flags, def.skip)

	var built *serveutil.Service

	app := &cli.Command{ //nolint:exhaustruct
		Name:    name,
		Version: version,
		Usage:   serveCmd.Usage,
		Flags:   serveCmd.Flags,
		Action: func(ctx context.Context, c *cli.Command) error {
			// Runs after urfave's parse-time required-check, but that check has
			// already been neutralized for these flags by relaxRequiredForSkipped
			// above (it cleared their Required bit before app.Run). So injecting
			// globals here is not "too late": applySharedConfig fills the skipped
			// flags, then the loop below re-enforces "must be provided" — moving
			// the guarantee from the sub-CLI to the engine, post-injection.
			if err := applySharedConfig(c, name, cfg); err != nil {
				return err
			}

			for _, fname := range relaxed {
				if !c.IsSet(fname) {
					return fmt.Errorf(
						"%s: required value %q was not set by a shared global"+
							" or the service's own environment: %w",
						name, fname, errMissingRequired,
					)
				}
			}

			svc, err := def.newService(ctx, c, logger)
			if err != nil {
				return err
			}

			built = svc

			return nil
		},
	}

	if err := app.Run(ctx, append([]string{name}, args...)); err != nil {
		return nil, fmt.Errorf("running %s command: %w", name, err)
	}

	if built == nil {
		return nil, fmt.Errorf("%s: %w", name, errServiceNotBuilt)
	}

	return built, nil
}

// superviseShared runs every service's background loop and the shared HTTP
// server as peers: the moment any returns, the rest are torn down together.
func superviseShared(
	ctx context.Context,
	cfg serveConfig,
	handler http.Handler,
	services []mounted,
	logger *slog.Logger,
) error {
	// The read, write and idle timeouts are intentionally left unbounded: they
	// would abort slow large uploads, truncate long-lived GraphQL responses, or
	// close keep-alive connections; the cloud load balancer owns those limits.
	// Only ReadHeaderTimeout is kept, as a cheap slowloris guard that bounds the
	// header read without limiting upload or response duration.
	server := &http.Server{ //nolint:exhaustruct
		Addr:              cfg.bind,
		Handler:           handler,
		ReadHeaderTimeout: readHeaderTimeout,
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
