package main

import (
	"context"
	"log/slog"
	"sort"
	"strings"

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
// flags, and the constructor that turns those flags into a serve.Service.
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
}

// serviceRegistry maps the service name accepted on the command line to its
// composition definition. "graphql" is the constellation GraphQL engine; the
// name matches its URL prefix.
func serviceRegistry() map[string]serviceDef {
	return map[string]serviceDef{
		"auth": {
			prefix:     "/auth",
			command:    authcmd.CommandServe,
			newService: authcmd.NewService,
		},
		"storage": {
			prefix:     "/storage",
			command:    storagecmd.CommandServe,
			newService: storagecmd.NewService,
		},
		"graphql": {
			prefix:     "/graphql",
			command:    constellationcmd.CommandServe,
			newService: constellationcmd.NewService,
		},
	}
}

// isService reports whether tok names a registered service.
func isService(tok string) bool {
	_, ok := serviceRegistry()[tok]

	return ok
}

// serviceNames returns the registered service names in sorted order, for help
// and error messages.
func serviceNames() []string {
	reg := serviceRegistry()
	names := make([]string, 0, len(reg))

	for name := range reg {
		names = append(names, name)
	}

	sort.Strings(names)

	return names
}

// usageText is the top-level help for the engine, describing the multi-service
// command grammar.
func usageText(version string) string {
	return strings.Join([]string{
		"nhost-engine v" + version,
		"",
		"Run one or more Nhost services in a single process behind one shared",
		"listener, each mounted under its own path prefix (/auth, /storage,",
		"/graphql).",
		"",
		"Usage:",
		"  nhost-engine [shared flags] SERVICE [service flags]" +
			" [-- SERVICE [service flags] ...]",
		"",
		"Shared flags (env NHOST_*):",
		"  --bind / --port         shared listener address / port (default :8080)",
		"  --debug                 enable debug logging",
		"  --log-format-text       human-friendly log output",
		"  --http-{read,write,idle}-timeout   shared server timeouts",
		"  --admin-secret          Hasura admin secret (auth, storage, graphql)",
		"  --jwt-secret            Hasura JWT secret (auth, graphql)",
		"  --database-url          PostgreSQL URL (auth, graphql)",
		"  --migrations-database-url   migrations PostgreSQL URL (auth, storage)",
		"  --cors-allowed-origins  allowed CORS origins (storage, graphql)",
		"",
		"Shared values fill only flags a service did not set itself; an explicit",
		"per-service flag or env var always wins.",
		"",
		"Services:",
		"  " + strings.Join(serviceNames(), ", "),
		"",
		"Examples:",
		"  nhost-engine auth",
		"  nhost-engine --bind :8080 auth -- storage -- graphql",
		"",
		"Each service accepts its own flags; run 'nhost-engine SERVICE --help'" +
			" for that service's options.",
		"",
	}, "\n")
}
