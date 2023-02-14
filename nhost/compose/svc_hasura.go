package compose

import (
	"fmt"
	"github.com/compose-spec/compose-go/types"
	"github.com/nhost/cli/util"
)

func (c Config) hasuraServiceEnvs() env {
	e := env{
		"HASURA_GRAPHQL_DATABASE_URL":              c.postgresConnectionStringForUser("nhost_hasura"),
		"HASURA_GRAPHQL_JWT_SECRET":                c.envValueHasuraGraphqlJwtSecret(),
		"HASURA_GRAPHQL_ADMIN_SECRET":              util.ADMIN_SECRET,
		"NHOST_ADMIN_SECRET":                       util.ADMIN_SECRET,
		"NHOST_BACKEND_URL":                        c.envValueNhostBackendUrl(),
		"NHOST_SUBDOMAIN":                          SubdomainLocal,
		"NHOST_REGION":                             "",
		"NHOST_HASURA_URL":                         c.envValueNhostHasuraURL(),
		"NHOST_GRAPHQL_URL":                        c.PublicHasuraGraphqlEndpoint(),
		"NHOST_AUTH_URL":                           c.PublicAuthConnectionString(),
		"NHOST_STORAGE_URL":                        c.PublicStorageConnectionString(),
		"NHOST_FUNCTIONS_URL":                      c.PublicFunctionsConnectionString(),
		"HASURA_GRAPHQL_UNAUTHORIZED_ROLE":         "public",
		"HASURA_GRAPHQL_DEV_MODE":                  "true",
		"HASURA_GRAPHQL_LOG_LEVEL":                 "debug",
		"HASURA_GRAPHQL_ENABLE_CONSOLE":            "false",
		"HASURA_GRAPHQL_MIGRATIONS_SERVER_TIMEOUT": "20",
		"HASURA_GRAPHQL_NO_OF_RETRIES":             "20",
		"HASURA_GRAPHQL_ENABLE_TELEMETRY":          "false",
		"NHOST_WEBHOOK_SECRET":                     util.WEBHOOK_SECRET,
	}

	e.merge(c.serviceConfigEnvs(SvcHasura))
	e.mergeWithSlice(c.dotenv)

	return e
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
		Image:       c.serviceDockerImage(SvcHasura, svcHasuraDefaultImage),
		Environment: c.hasuraServiceEnvs().dockerServiceConfigEnv(),
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
