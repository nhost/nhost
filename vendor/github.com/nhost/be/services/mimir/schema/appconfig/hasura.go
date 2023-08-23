package appconfig

import (
	"fmt"

	"github.com/nhost/be/services/mimir/model"
)

const (
	secretHasuraGraphqlDatabaseURL = "databaseUrl"
	secretHasuraHasuraAdminSecret  = "adminSecret"
	secretHasuraJWTSecret          = "jwtSecret"
	secretHasuraWebhookSecret      = "webhookSecret"
)

func HasuraEnv( //nolint:funlen
	config *model.ConfigConfig,
	subdomain,
	region,
	domain,
	hasuraGraphqlDatabaseURL string,
	useTLS bool,
	httpPort uint,
) ([]EnvVar, error) {
	jwtSecret, err := marshalJWT(config.GetHasura().GetJwtSecrets()[0])
	if err != nil {
		return nil, fmt.Errorf("could not marshal JWT secret: %w", err)
	}

	env := []EnvVar{
		{
			Name:       "HASURA_GRAPHQL_DATABASE_URL",
			Value:      hasuraGraphqlDatabaseURL,
			SecretName: secretHasuraGraphqlDatabaseURL,
			IsSecret:   true,
		},
		{
			Name:       "HASURA_GRAPHQL_ADMIN_SECRET",
			Value:      config.GetHasura().GetAdminSecret(),
			SecretName: secretHasuraHasuraAdminSecret,
			IsSecret:   true,
		},
		{
			Name:       "HASURA_GRAPHQL_JWT_SECRET",
			Value:      string(jwtSecret),
			SecretName: secretHasuraJWTSecret,
			IsSecret:   true,
		},
		{
			Name:       "NHOST_ADMIN_SECRET",
			Value:      config.GetHasura().GetAdminSecret(),
			SecretName: secretHasuraHasuraAdminSecret,
			IsSecret:   true,
		},
		{
			Name:       "NHOST_WEBHOOK_SECRET",
			Value:      config.GetHasura().GetWebhookSecret(),
			SecretName: secretHasuraWebhookSecret,
			IsSecret:   true,
		},
		{
			Name:       "NHOST_JWT_SECRET",
			Value:      string(jwtSecret),
			SecretName: secretHasuraJWTSecret,
			IsSecret:   true,
		},
		{
			Name:  "NHOST_BACKEND_URL",
			Value: GetFQDNOldURL(subdomain, domain, useTLS, httpPort),
		},
		{
			Name:  "NHOST_SUBDOMAIN",
			Value: subdomain,
		},
		{
			Name:  "NHOST_REGION",
			Value: region,
		},
		{
			Name:  "NHOST_HASURA_URL",
			Value: GetFQDNURL(subdomain, "hasura", region, domain, useTLS, httpPort),
		},
		{
			Name: "NHOST_GRAPHQL_URL",
			Value: fmt.Sprintf(
				"%s/v1",
				GetFQDNURL(subdomain, "graphql", region, domain, useTLS, httpPort),
			),
		},
		{
			Name: "NHOST_AUTH_URL",
			Value: fmt.Sprintf(
				"%s/v1",
				GetFQDNURL(subdomain, "auth", region, domain, useTLS, httpPort),
			),
		},
		{
			Name: "NHOST_STORAGE_URL",
			Value: fmt.Sprintf(
				"%s/v1",
				GetFQDNURL(subdomain, "storage", region, domain, useTLS, httpPort),
			),
		},
		{
			Name: "NHOST_FUNCTIONS_URL",
			Value: fmt.Sprintf(
				"%s/v1",
				GetFQDNURL(subdomain, "functions", region, domain, useTLS, httpPort),
			),
		},
		{
			Name: "HASURA_GRAPHQL_ENABLE_CONSOLE",
			Value: Stringify(
				*config.GetHasura().GetSettings().EnableConsole,
			),
		},
		{
			Name:  "HASURA_GRAPHQL_CONSOLE_ASSETS_DIR",
			Value: "/srv/console-assets",
		},
		{
			Name:  "HASURA_GRAPHQL_UNAUTHORIZED_ROLE",
			Value: "public",
		},
		{
			Name:  "HASURA_GRAPHQL_CORS_DOMAIN",
			Value: Stringify(config.GetHasura().GetSettings().CorsDomain),
		},
		{
			Name:  "HASURA_GRAPHQL_DISABLE_CORS",
			Value: "false",
		},
		{
			Name:  "HASURA_GRAPHQL_WS_READ_COOKIE",
			Value: "false",
		},
		{
			Name:  "HASURA_GRAPHQL_ENABLE_TELEMETRY",
			Value: "false",
		},
		{
			Name:  "HASURA_GRAPHQL_STRINGIFY_NUMERIC_TYPES",
			Value: "false",
		},
		{
			Name:  "HASURA_GRAPHQL_ENABLED_APIS",
			Value: Stringify(config.GetHasura().GetSettings().EnabledAPIs),
		},
		{
			Name:  "HASURA_GRAPHQL_ENABLED_LOG_TYPES",
			Value: "startup,http-log,webhook-log,websocket-log",
		},
		{
			Name:  "HASURA_GRAPHQL_LOG_LEVEL",
			Value: *config.GetHasura().GetLogs().Level,
		},
		{
			Name:  "HASURA_GRAPHQL_DEV_MODE",
			Value: Stringify(*config.GetHasura().GetSettings().DevMode),
		},
		{
			Name:  "HASURA_GRAPHQL_ADMIN_INTERNAL_ERRORS",
			Value: "true",
		},
		{
			Name:  "HASURA_GRAPHQL_LIVE_QUERIES_MULTIPLEXED_REFETCH_INTERVAL",
			Value: "1000",
		},
		{
			Name:  "HASURA_GRAPHQL_LIVE_QUERIES_MULTIPLEXED_BATCH_SIZE",
			Value: "100",
		},
		{
			Name: "HASURA_GRAPHQL_ENABLE_ALLOWLIST",
			Value: Stringify(
				*config.GetHasura().GetSettings().EnableAllowList,
			),
		},
		{
			Name:  "HASURA_GRAPHQL_ENABLE_REMOTE_SCHEMA_PERMISSIONS",
			Value: "true",
		},
		{
			Name:  "HASURA_GRAPHQL_PG_CONNECTIONS",
			Value: "50",
		},
		{
			Name:  "HASURA_GRAPHQL_PG_TIMEOUT",
			Value: "180",
		},
		{
			Name:  "HASURA_GRAPHQL_USE_PREPARED_STATEMENTS",
			Value: "true",
		},
		{
			Name:  "HASURA_GRAPHQL_TX_ISOLATION",
			Value: "read-committed",
		},
		{
			Name: "HASURA_GRAPHQL_EVENTS_HTTP_POOL_SIZE",
			Value: fmt.Sprintf(
				"%d",
				*config.GetHasura().GetEvents().HttpPoolSize,
			),
		},
	}

	for _, e := range config.GetGlobal().GetEnvironment() {
		env = append(env, EnvVar{ //nolint:exhaustruct
			Name:  e.Name,
			Value: e.Value,
		})
	}
	return env, nil
}
