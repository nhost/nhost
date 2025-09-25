package appconfig

import (
	"fmt"
	"strconv"

	"github.com/nhost/be/services/mimir/model"
)

const (
	secretHasuraGraphqlDatabaseURL = "databaseUrl"
	secretHasuraHasuraAdminSecret  = "adminSecret"
	secretHasuraJWTSecret          = "jwtSecret"
	secretHasuraWebhookSecret      = "webhookSecret"
)

func deptr[T any](x *T) T {
	if x == nil {
		return *new(T)
	}

	return *x
}

func HasuraEnv( //nolint:funlen,maintidx
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
			Name:       "NHOST_SUBDOMAIN",
			Value:      subdomain,
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "NHOST_REGION",
			Value:      region,
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "NHOST_HASURA_URL",
			Value:      GetFQDNURL(subdomain, "hasura", region, domain, useTLS, httpPort),
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "NHOST_GRAPHQL_URL",
			Value:      GetFQDNURL(subdomain, "graphql", region, domain, useTLS, httpPort) + "/v1",
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "NHOST_AUTH_URL",
			Value:      GetFQDNURL(subdomain, "auth", region, domain, useTLS, httpPort) + "/v1",
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "NHOST_STORAGE_URL",
			Value:      GetFQDNURL(subdomain, "storage", region, domain, useTLS, httpPort) + "/v1",
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name: "NHOST_FUNCTIONS_URL",
			Value: GetFQDNURL(
				subdomain,
				"functions",
				region,
				domain,
				useTLS,
				httpPort,
			) + "/v1",
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name: "HASURA_GRAPHQL_ENABLE_CONSOLE",
			Value: Stringify(
				*config.GetHasura().GetSettings().EnableConsole,
			),
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "HASURA_GRAPHQL_CONSOLE_ASSETS_DIR",
			Value:      "/srv/console-assets",
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "HASURA_GRAPHQL_CORS_DOMAIN",
			Value:      Stringify(config.GetHasura().GetSettings().CorsDomain),
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "HASURA_GRAPHQL_DISABLE_CORS",
			Value:      "false",
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "HASURA_GRAPHQL_WS_READ_COOKIE",
			Value:      "false",
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "HASURA_GRAPHQL_ENABLE_TELEMETRY",
			Value:      "false",
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "HASURA_GRAPHQL_ENABLED_APIS",
			Value:      Stringify(config.GetHasura().GetSettings().EnabledAPIs),
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "HASURA_GRAPHQL_ENABLED_LOG_TYPES",
			Value:      "startup,http-log,webhook-log,websocket-log",
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "HASURA_GRAPHQL_LOG_LEVEL",
			Value:      *config.GetHasura().GetLogs().Level,
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "HASURA_GRAPHQL_DEV_MODE",
			Value:      Stringify(*config.GetHasura().GetSettings().DevMode),
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "HASURA_GRAPHQL_ADMIN_INTERNAL_ERRORS",
			Value:      "true",
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name: "HASURA_GRAPHQL_LIVE_QUERIES_MULTIPLEXED_REFETCH_INTERVAL",
			Value: Stringify(
				*config.GetHasura().GetSettings().LiveQueriesMultiplexedRefetchInterval,
			),
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "HASURA_GRAPHQL_LIVE_QUERIES_MULTIPLEXED_BATCH_SIZE",
			Value:      "100",
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name: "HASURA_GRAPHQL_ENABLE_ALLOWLIST",
			Value: Stringify(
				*config.GetHasura().GetSettings().EnableAllowList,
			),
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name: "HASURA_GRAPHQL_ENABLE_REMOTE_SCHEMA_PERMISSIONS",
			Value: Stringify(
				*config.GetHasura().GetSettings().GetEnableRemoteSchemaPermissions(),
			),
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "HASURA_GRAPHQL_PG_CONNECTIONS",
			Value:      "50",
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "HASURA_GRAPHQL_PG_TIMEOUT",
			Value:      "180",
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "HASURA_GRAPHQL_USE_PREPARED_STATEMENTS",
			Value:      "true",
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "HASURA_GRAPHQL_TX_ISOLATION",
			Value:      "read-committed",
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name: "HASURA_GRAPHQL_EVENTS_HTTP_POOL_SIZE",
			Value: strconv.FormatUint(
				uint64(*config.GetHasura().GetEvents().HttpPoolSize), 10,
			),
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "HASURA_GRAPHQL_INFER_FUNCTION_PERMISSIONS",
			Value:      Stringify(*config.GetHasura().GetSettings().GetInferFunctionPermissions()),
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "HASURA_GRAPHQL_STRINGIFY_NUMERIC_TYPES",
			Value:      Stringify(*config.GetHasura().GetSettings().GetStringifyNumericTypes()),
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "GRAPHITE_WEBHOOK_SECRET",
			Value:      config.GetAi().GetWebhookSecret(),
			IsSecret:   false,
			SecretName: "",
		},
	}

	for _, e := range config.GetGlobal().GetEnvironment() {
		for _, v := range env {
			if v.Name == e.Name {
				continue
			}
		}

		env = append(env, EnvVar{ //nolint:exhaustruct
			Name:  e.Name,
			Value: e.Value,
		})
	}

	if config.GetHasura().GetAuthHook() != nil {
		env = append(env,
			EnvVar{
				Name:       "HASURA_GRAPHQL_AUTH_HOOK",
				Value:      config.GetHasura().GetAuthHook().GetUrl(),
				IsSecret:   false,
				SecretName: "",
			},
			EnvVar{
				Name:       "HASURA_GRAPHQL_AUTH_HOOK_MODE",
				Value:      deptr(config.GetHasura().GetAuthHook().GetMode()),
				IsSecret:   false,
				SecretName: "",
			},
			EnvVar{
				Name:       "HASURA_GRAPHQL_AUTH_HOOK_SEND_REQUEST_BODY",
				Value:      Stringify(deptr(config.GetHasura().GetAuthHook().SendRequestBody)),
				IsSecret:   false,
				SecretName: "",
			},
		)
	} else {
		env = append(env,
			EnvVar{
				Name:       "HASURA_GRAPHQL_UNAUTHORIZED_ROLE",
				Value:      "public",
				IsSecret:   false,
				SecretName: "",
			},
			EnvVar{
				Name:       "HASURA_GRAPHQL_JWT_SECRET",
				Value:      string(jwtSecret),
				SecretName: secretHasuraJWTSecret,
				IsSecret:   true,
			},
		)
	}

	return env, nil
}
