package compose

import (
	"fmt"
	"github.com/compose-spec/compose-go/types"
	"github.com/nhost/cli/internal/generichelper"
	"github.com/nhost/cli/nhost/envvars"
)

func (c Config) hasuraServiceEnvs() envvars.Env {
	hasuraConf := c.nhostConfig.GetHasura()

	return envvars.Env{
		"HASURA_GRAPHQL_DATABASE_URL":              c.postgresConnectionStringForUser("nhost_hasura"),
		"HASURA_GRAPHQL_JWT_SECRET":                escapeDollarSignForDockerCompose(c.graphqlJwtSecret()),
		"HASURA_GRAPHQL_ADMIN_SECRET":              escapeDollarSignForDockerCompose(hasuraConf.GetAdminSecret()),
		"HASURA_GRAPHQL_UNAUTHORIZED_ROLE":         "public",
		"HASURA_GRAPHQL_DEV_MODE":                  "true",
		"HASURA_GRAPHQL_LOG_LEVEL":                 generichelper.DerefPtr(hasuraConf.GetLogs().GetLevel()),
		"HASURA_GRAPHQL_EVENTS_HTTP_POOL_SIZE":     fmt.Sprint(generichelper.DerefPtr(hasuraConf.GetEvents().GetHttpPoolSize())),
		"HASURA_GRAPHQL_ENABLE_CONSOLE":            "false",
		"HASURA_GRAPHQL_MIGRATIONS_SERVER_TIMEOUT": "20",
		"HASURA_GRAPHQL_NO_OF_RETRIES":             "20",
		"HASURA_GRAPHQL_ENABLE_TELEMETRY":          "false",
	}.Merge(c.nhostSystemEnvs(), c.globalEnvs)
}

func (c Config) hasuraService() *types.ServiceConfig {
	redirectRootLabels := makeTraefikServiceLabels(
		"root-redirect-"+SvcHasura,
		graphqlPort,
		withTLS(),
		withHost(HostLocalHasuraNhostRun),
		withMethod("GET"),
		withPath("/"),
		withRedirect(c.PublicHasuraConsoleURL()),
	)

	redirectConsoleLabels := makeTraefikServiceLabels(
		"console-redirect-"+SvcHasura,
		graphqlPort,
		withTLS(),
		withHost(HostLocalHasuraNhostRun),
		withMethod("GET"),
		withPath("/console"),
		withRedirect(c.PublicHasuraConsoleURL()),
	)

	sslLabels := makeTraefikServiceLabels(
		SvcGraphql,
		graphqlPort,
		withTLS(),
		withPathPrefix("/v1"),
		withReplacePath("/v1/graphql"),
		withHost(HostLocalGraphqlNhostRun),
	)

	// deprecated endpoints
	httpLabels := makeTraefikServiceLabels(
		"http-"+SvcGraphql,
		graphqlPort,
		withPathPrefix("/v1/graphql", "/v2/query", "/v1/metadata", "/v1/config"),
	)

	hasuraLabels := makeTraefikServiceLabels(
		SvcHasura,
		graphqlPort,
		withTLS(),
		withHost(HostLocalHasuraNhostRun),
	)

	return &types.ServiceConfig{
		Name:        SvcGraphql,
		Image:       "hasura/graphql-engine:" + generichelper.DerefPtr(c.nhostConfig.GetHasura().GetVersion()),
		Environment: c.hasuraServiceEnvs().ToDockerServiceConfigEnv(),
		Labels: mergeTraefikServiceLabels(
			redirectRootLabels,
			redirectConsoleLabels,
			sslLabels,
			httpLabels,
			hasuraLabels).AsMap(),
		Ports: []types.ServicePortConfig{
			{
				Mode:      "ingress",
				Target:    graphqlPort,
				Published: fmt.Sprint(c.ports.GraphQL()),
				Protocol:  "tcp",
			},
		},
		DependsOn: map[string]types.ServiceDependency{
			SvcPostgres: {
				Condition: types.ServiceConditionHealthy,
			},
		},
		Restart: types.RestartPolicyAlways,
	}
}
