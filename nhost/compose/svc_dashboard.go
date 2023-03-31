package compose

import (
	"fmt"

	"github.com/compose-spec/compose-go/types"
	"github.com/nhost/cli/nhost/envvars"
)

func (c Config) dashboardServiceEnvs() envvars.Env {
	return envvars.Env{
		"NEXT_PUBLIC_NHOST_AUTH_URL":                  c.PublicAuthConnectionString(),
		"NEXT_PUBLIC_NHOST_FUNCTIONS_URL":             c.PublicFunctionsConnectionString(),
		"NEXT_PUBLIC_NHOST_GRAPHQL_URL":               c.PublicHasuraGraphqlEndpoint(),
		"NEXT_PUBLIC_NHOST_STORAGE_URL":               c.PublicStorageConnectionString(),
		"NEXT_PUBLIC_NHOST_HASURA_CONSOLE_URL":        c.PublicHasuraConsoleRedirectURL(),
		"NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL": c.hasuraMigrationsApiURL(),
		"NEXT_PUBLIC_NHOST_HASURA_API_URL":            c.hasuraApiURL(),
		"NEXT_PUBLIC_NHOST_ADMIN_SECRET":              escapeDollarSignForDockerCompose(c.nhostConfig.GetHasura().GetAdminSecret()),
	}.Merge(c.nhostSystemEnvs(), c.globalEnvs)
}

func (c Config) dashboardService() *types.ServiceConfig {
	return &types.ServiceConfig{
		Name:        SvcDashboard,
		Image:       "nhost/dashboard:0.14.1",
		Environment: c.dashboardServiceEnvs().ToDockerServiceConfigEnv(),
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
