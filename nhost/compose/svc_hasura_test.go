package compose

import (
	"fmt"
	"github.com/nhost/cli/nhost/envvars"
	"github.com/nhost/cli/util"
	"github.com/stretchr/testify/assert"
	"testing"
)

func TestConfig_hasuraServiceEnvs(t *testing.T) {
	t.Parallel()

	assert := assert.New(t)

	c := Config{
		ports:       testPorts(t),
		nhostConfig: resolvedDefaultNhostConfig(t),
	}

	assert.Equal(envvars.Env{
		"HASURA_GRAPHQL_DATABASE_URL":              "postgres://nhost_hasura@local.db.nhost.run:5432/postgres",
		"HASURA_GRAPHQL_JWT_SECRET":                fmt.Sprintf(`{"type":"HS256", "key": "%s"}`, util.JWT_KEY),
		"HASURA_GRAPHQL_ADMIN_SECRET":              "nhost-admin-secret",
		"HASURA_GRAPHQL_UNAUTHORIZED_ROLE":         "public",
		"HASURA_GRAPHQL_DEV_MODE":                  "true",
		"HASURA_GRAPHQL_LOG_LEVEL":                 "warn",
		"HASURA_GRAPHQL_ENABLE_CONSOLE":            "false",
		"HASURA_GRAPHQL_MIGRATIONS_SERVER_TIMEOUT": "20",
		"HASURA_GRAPHQL_EVENTS_HTTP_POOL_SIZE":     "100",
		"HASURA_GRAPHQL_NO_OF_RETRIES":             "20",
		"HASURA_GRAPHQL_ENABLE_TELEMETRY":          "false",
		"NHOST_BACKEND_URL":                        "http://traefik:1337",
		"NHOST_SUBDOMAIN":                          "local",
		"NHOST_REGION":                             "",
		"NHOST_HASURA_URL":                         "https://local.hasura.nhost.run/console",
		"NHOST_GRAPHQL_URL":                        "https://local.graphql.nhost.run/v1",
		"NHOST_AUTH_URL":                           "https://local.auth.nhost.run/v1",
		"NHOST_STORAGE_URL":                        "https://local.storage.nhost.run/v1",
		"NHOST_FUNCTIONS_URL":                      "https://local.functions.nhost.run/v1",
		"NHOST_ADMIN_SECRET":                       "nhost-admin-secret",
		"NHOST_WEBHOOK_SECRET":                     "nhost-webhook-secret",
		"NHOST_JWT_SECRET":                         fmt.Sprintf(`{"type":"HS256", "key": "%s"}`, util.JWT_KEY),
	}, c.hasuraServiceEnvs())
}
