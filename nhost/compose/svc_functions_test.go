package compose

import (
	"fmt"
	"github.com/nhost/cli/nhost/envvars"
	"github.com/nhost/cli/util"
	"github.com/stretchr/testify/assert"
	"testing"
)

func TestConfig_functionsServiceEnvs(t *testing.T) {
	t.Parallel()

	c := &Config{nhostConfig: resolvedDefaultNhostConfig(t), ports: testPorts(t)}

	assert.Equal(t, envvars.Env{
		"NHOST_BACKEND_URL":    "http://traefik:1337",
		"NHOST_SUBDOMAIN":      "local",
		"NHOST_REGION":         "",
		"NHOST_HASURA_URL":     "https://local.hasura.nhost.run/console",
		"NHOST_GRAPHQL_URL":    "https://local.graphql.nhost.run/v1",
		"NHOST_AUTH_URL":       "https://local.auth.nhost.run/v1",
		"NHOST_STORAGE_URL":    "https://local.storage.nhost.run/v1",
		"NHOST_FUNCTIONS_URL":  "https://local.functions.nhost.run/v1",
		"NHOST_ADMIN_SECRET":   "nhost-admin-secret",
		"NHOST_WEBHOOK_SECRET": "nhost-webhook-secret",
		"NHOST_JWT_SECRET":     fmt.Sprintf(`{"type":"HS256", "key": "%s"}`, util.JWT_KEY),
	}, c.functionsServiceEnvs())
}
