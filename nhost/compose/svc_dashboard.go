package compose

import (
	"github.com/compose-spec/compose-go/types"
)

func (c Config) dashboardServiceEnvs() env {
	e := env{
		"NEXT_PUBLIC_NHOST_AUTH_URL":                  c.PublicAuthConnectionString(),
		"NEXT_PUBLIC_NHOST_FUNCTIONS_URL":             c.PublicFunctionsConnectionString(),
		"NEXT_PUBLIC_NHOST_GRAPHQL_URL":               c.hasuraGraphqlAPIEndpoint(),
		"NEXT_PUBLIC_NHOST_STORAGE_URL":               c.PublicStorageConnectionString(),
		"NEXT_PUBLIC_NHOST_HASURA_CONSOLE_URL":        HasuraConsoleHostname(c.ports.HasuraConsole()),
		"NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL": c.hasuraMigrationsApiURL(),
		"NEXT_PUBLIC_NHOST_HASURA_API_URL":            c.hasuraApiURL(),
	}

	e.mergeWithSlice(c.dotenv)
	return e
}

func (c Config) dashboardService() *types.ServiceConfig {
	labels := makeTraefikServiceLabels(
		SvcDashboard,
		withTLS(),
		withHost(HostLocalDashboardNhostRun),
		withServiceListeningOnPort(3000),
	)

	return &types.ServiceConfig{
		Name:        SvcDashboard,
		Labels:      labels.AsMap(),
		Image:       c.serviceDockerImage(SvcDashboard, svcDashboardDefaultImage),
		Environment: c.dashboardServiceEnvs().dockerServiceConfigEnv(),
	}
}
