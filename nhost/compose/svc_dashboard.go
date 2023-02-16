package compose

import (
	"fmt"
	"github.com/compose-spec/compose-go/types"
)

func (c Config) dashboardServiceEnvs() env {
	e := env{
		"NEXT_PUBLIC_NHOST_AUTH_URL":                  c.PublicAuthConnectionString(),
		"NEXT_PUBLIC_NHOST_FUNCTIONS_URL":             c.PublicFunctionsConnectionString(),
		"NEXT_PUBLIC_NHOST_GRAPHQL_URL":               c.PublicHasuraGraphqlEndpoint(),
		"NEXT_PUBLIC_NHOST_STORAGE_URL":               c.PublicStorageConnectionString(),
		"NEXT_PUBLIC_NHOST_HASURA_CONSOLE_URL":        c.PublicHasuraConsoleRedirectURL(),
		"NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL": c.hasuraMigrationsApiURL(),
		"NEXT_PUBLIC_NHOST_HASURA_API_URL":            c.hasuraApiURL(),
	}

	e.mergeWithSlice(c.dotenv)
	return e
}

func (c Config) dashboardService() *types.ServiceConfig {
	return &types.ServiceConfig{
		Name:        SvcDashboard,
		Image:       c.serviceDockerImage(SvcDashboard, svcDashboardDefaultImage),
		Environment: c.dashboardServiceEnvs().dockerServiceConfigEnv(),
		Ports: []types.ServicePortConfig{
			{
				Mode:      "ingress",
				Target:    dashboardPort,
				Published: fmt.Sprint(c.ports.Dashboard()),
				Protocol:  "tcp",
			},
		},
	}
}
