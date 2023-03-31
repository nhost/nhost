package compose

import (
	"fmt"
	"github.com/compose-spec/compose-go/types"
	"github.com/nhost/cli/util"
	"github.com/stretchr/testify/assert"
	"testing"
)

func TestConfig_dashboardService(t *testing.T) {
	t.Parallel()
	assert := assert.New(t)

	c := &Config{
		nhostConfig: resolvedDefaultNhostConfig(t),
		ports:       testPorts(t),
	}

	svc := c.dashboardService()
	assert.Equal("dashboard", svc.Name)
	assert.Equal(types.NewMappingWithEquals([]string{
		"NEXT_PUBLIC_NHOST_AUTH_URL=https://local.auth.nhost.run/v1",
		"NEXT_PUBLIC_NHOST_FUNCTIONS_URL=https://local.functions.nhost.run/v1",
		"NEXT_PUBLIC_NHOST_GRAPHQL_URL=https://local.graphql.nhost.run/v1",
		"NEXT_PUBLIC_NHOST_HASURA_API_URL=https://local.hasura.nhost.run",
		"NEXT_PUBLIC_NHOST_HASURA_CONSOLE_URL=https://local.hasura.nhost.run/console",
		"NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL=http://localhost:9693",
		"NEXT_PUBLIC_NHOST_STORAGE_URL=https://local.storage.nhost.run/v1",
		"NEXT_PUBLIC_NHOST_STORAGE_URL=https://local.storage.nhost.run/v1",
		"NEXT_PUBLIC_NHOST_ADMIN_SECRET=nhost-admin-secret",
		"NHOST_ADMIN_SECRET=nhost-admin-secret",
		"NHOST_AUTH_URL=https://local.auth.nhost.run/v1",
		"NHOST_BACKEND_URL=http://traefik:1337",
		"NHOST_FUNCTIONS_URL=https://local.functions.nhost.run/v1",
		"NHOST_GRAPHQL_URL=https://local.graphql.nhost.run/v1",
		"NHOST_HASURA_URL=https://local.hasura.nhost.run/console",
		fmt.Sprintf(`NHOST_JWT_SECRET={"type":"HS256", "key": "%s"}`, util.JWT_KEY),
		"NHOST_REGION=",
		"NHOST_STORAGE_URL=https://local.storage.nhost.run/v1",
		"NHOST_SUBDOMAIN=local",
		"NHOST_WEBHOOK_SECRET=nhost-webhook-secret",
	}), svc.Environment)
}
