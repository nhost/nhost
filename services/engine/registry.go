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
	// reach the service handler, so the service keeps serving its expected paths
	// (the engine-owned auth /v1 default, storage's /v1 root, and constellation's
	// /v1/*). The routing rewrite also covers root-relative redirects on
	// configured mount-prefix hosts, but not absolute URLs generated from service
	// settings. Base URLs include this mount only when it is externally visible;
	// separate-origin deployments may prepend it in an edge rewrite instead.
	prefix string
	// command builds a fresh serve command for each use. serveFlags obtains one
	// command's Flags to derive the engine surface; buildService parses a separate
	// instance so parse state stays local and relaxRequiredForSkipped can safely
	// mutate Required.
	command func() *cli.Command
	// newService constructs the service from its parsed command.
	newService newServiceFunc
	// skip lists the service's native flag names the engine does not re-expose
	// as prefixed flags. They are fed by an engine global (shared secrets,
	// database URLs, and CORS) or are engine-owned composition settings (auth's
	// route prefix, the shared listener and logger, HTTP timeouts, and profiling
	// listeners).
	skip map[string]bool
	// hidden lists native flag names still accepted as prefixed passthrough but
	// hidden from help, to keep low-level tuning out of the default surface.
	hidden map[string]bool
}

// registeredService couples a service's stable name and composition definition,
// keeping membership and order in one source of truth.
type registeredService struct {
	name string
	def  serviceDef
}

// serviceDefinitions returns every service in stable mount/start order.
// "graphql" is the constellation GraphQL engine; the name matches its URL
// prefix. The skip sets encode the consolidation described in the engine README:
// shared listener, logging, secrets, database URLs, and CORS origins are set once
// as engine globals, so native flags for those values are not re-exposed.
func serviceDefinitions() []registeredService {
	return []registeredService{
		{
			name: "auth",
			def: serviceDef{
				prefix:     "/auth",
				command:    authcmd.CommandServe,
				newService: authcmd.NewService,
				skip: newSet(
					"debug", "log-format-text", "port", "api-prefix",
					"hasura-admin-secret", "hasura-graphql-jwt-secret",
					"postgres", "postgres-migrations",
				),
				hidden: newSet(),
			},
		},
		{
			name: "storage",
			def: serviceDef{
				prefix:     "/storage",
				command:    storagecmd.CommandServe,
				newService: storagecmd.NewService,
				skip: newSet(
					"debug", "log-format-text", "bind", "pprof-bind",
					"hasura-graphql-admin-secret", "postgres-migrations-source",
					"cors-allow-origins",
				),
				hidden: newSet(),
			},
		},
		{
			name: "graphql",
			def: serviceDef{
				prefix:     "/graphql",
				command:    constellationcmd.CommandServe,
				newService: constellationcmd.NewService,
				skip: newSet(
					"debug", "log-format-text", "bind-address",
					"http-read-timeout", "http-write-timeout", "http-idle-timeout",
					"profile-address", "admin-secret", "jwt-secret", "metadata-database-url",
					"cors-allowed-origins",
				),
				hidden: newSet(),
			},
		},
	}
}

// serviceRegistry indexes the stable service definitions by their engine-facing
// names for callers that need lookup rather than ordered traversal.
func serviceRegistry() map[string]serviceDef {
	definitions := serviceDefinitions()

	registry := make(map[string]serviceDef, len(definitions))
	for _, service := range definitions {
		registry[service.name] = service.def
	}

	return registry
}

// newSet builds a lookup set from the given keys.
func newSet(keys ...string) map[string]bool {
	set := make(map[string]bool, len(keys))
	for _, k := range keys {
		set[k] = true
	}

	return set
}

// serviceOrder derives the stable mount/start order from serviceDefinitions.
func serviceOrder() []string {
	definitions := serviceDefinitions()

	order := make([]string, 0, len(definitions))
	for _, service := range definitions {
		order = append(order, service.name)
	}

	return order
}
