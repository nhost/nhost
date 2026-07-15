package main

import (
	"context"
	"log/slog"

	serveutil "github.com/nhost/nhost/internal/lib/serve"

	authcmd "github.com/nhost/nhost/services/auth/go/cmd"
	constellationcmd "github.com/nhost/nhost/services/constellation/cmd"
	storagecmd "github.com/nhost/nhost/services/storage/cmd"
	"github.com/urfave/cli/v3"
)

// newServiceFunc builds a service's ready-to-serve surface (handler, background
// work, cleanup) from its parsed command. It matches the exported NewService of
// each service's cmd package.
type newServiceFunc func(
	ctx context.Context, cmd *cli.Command, logger *slog.Logger,
) (*serveutil.Service, error)

// serviceDef describes how the engine composes one service: the URL prefix it
// is mounted behind on the shared listener, the command used to parse its
// flags, the constructor that turns those flags into a serve.Service, and which
// of its native flags the engine re-exposes.
type serviceDef struct {
	// prefix is the path namespace the service is mounted under on the shared
	// listener, e.g. "/auth". Requests are stripped of this prefix before they
	// reach the service handler, so the service keeps serving its own native
	// paths (auth's api-prefix, storage's /v1 root, constellation's /v1/*).
	prefix string
	// command builds a fresh serve command whose Flags define the service's
	// per-service configuration surface. A fresh command per invocation keeps
	// concurrently composed services from sharing mutable flag state.
	command func() *cli.Command
	// newService constructs the service from its parsed command.
	newService newServiceFunc
	// skip lists the service's native flag names the engine does not re-expose
	// as prefixed flags: they are either fed by an engine global (shared
	// secrets, database URLs, CORS) or owned by the engine itself (the shared
	// listener address and logging).
	skip map[string]bool
	// hidden lists native flag names still accepted as prefixed passthrough but
	// hidden from help, to keep low-level tuning out of the default surface.
	hidden map[string]bool
}

// serviceRegistry maps the service name to its composition definition, in the
// order services are mounted and started. "graphql" is the constellation
// GraphQL engine; the name matches its URL prefix.
//
// The skip sets encode the consolidation described in the engine README: the
// shared listener, logging, secrets, database URLs, and CORS origins are set
// once as engine globals, so each service's own flags for those values are not
// re-exposed under its prefix.
func serviceRegistry() map[string]serviceDef {
	return map[string]serviceDef{
		"auth": {
			prefix:     "/auth",
			command:    authcmd.CommandServe,
			newService: authcmd.NewService,
			skip: newSet(
				"debug", "log-format-text", "port",
				"hasura-admin-secret", "hasura-graphql-jwt-secret",
				"postgres", "postgres-migrations",
			),
			hidden: newSet(),
		},
		"storage": {
			prefix:     "/storage",
			command:    storagecmd.CommandServe,
			newService: storagecmd.NewService,
			skip: newSet(
				"debug", "log-format-text", "bind",
				"hasura-graphql-admin-secret", "postgres-migrations-source",
				"cors-allow-origins",
			),
			hidden: newSet("pprof-bind"),
		},
		"graphql": {
			prefix:     "/graphql",
			command:    constellationcmd.CommandServe,
			newService: constellationcmd.NewService,
			skip: newSet(
				"debug", "log-format-text", "bind-address",
				"admin-secret", "jwt-secret", "metadata-database-url",
				"cors-allowed-origins",
			),
			hidden: newSet(),
		},
	}
}

// newSet builds a lookup set from the given keys.
func newSet(keys ...string) map[string]bool {
	set := make(map[string]bool, len(keys))
	for _, k := range keys {
		set[k] = true
	}

	return set
}

// serviceOrder returns the service names in a stable mount/start order (auth,
// storage, graphql), independent of map iteration order.
func serviceOrder() []string {
	return []string{"auth", "storage", "graphql"}
}
