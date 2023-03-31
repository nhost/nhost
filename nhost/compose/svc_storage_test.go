package compose

import (
	"fmt"
	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/cli/internal/ports"
	"github.com/nhost/cli/nhost/envvars"
	"github.com/nhost/cli/util"
	"github.com/stretchr/testify/assert"
	"testing"
)

func TestConfig_storageServiceEnvs(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name          string
		apiRootPrefix string
		nhostConfig   *model.ConfigConfig
		ports         *ports.Ports
		want          envvars.Env
	}{
		{
			name:          "when minio is enabled",
			apiRootPrefix: "/v1",
			nhostConfig:   resolvedDefaultNhostConfig(t),
			ports:         testPorts(t),
			want: envvars.Env{
				"DEBUG":                       "true",
				"BIND":                        ":8576",
				"PUBLIC_URL":                  "https://local.storage.nhost.run",
				"API_ROOT_PREFIX":             "/v1",
				"POSTGRES_MIGRATIONS":         "1",
				"HASURA_METADATA":             "1",
				"HASURA_ENDPOINT":             "http://graphql:8080/v1",
				"HASURA_GRAPHQL_ADMIN_SECRET": "nhost-admin-secret",
				"S3_ACCESS_KEY":               "minioaccesskey123123",
				"S3_SECRET_KEY":               "minioaccesskey123123",
				"S3_ENDPOINT":                 "http://minio:9000",
				"S3_BUCKET":                   "nhost",
				"HASURA_GRAPHQL_JWT_SECRET":   fmt.Sprintf(`{"type":"HS256", "key": "%s"}`, util.JWT_KEY),
				"POSTGRES_MIGRATIONS_SOURCE":  "postgres://nhost_storage_admin@local.db.nhost.run:5432/postgres?sslmode=disable",
				"NHOST_BACKEND_URL":           "http://traefik:1337",
				"NHOST_SUBDOMAIN":             "local",
				"NHOST_REGION":                "",
				"NHOST_HASURA_URL":            "https://local.hasura.nhost.run/console",
				"NHOST_GRAPHQL_URL":           "https://local.graphql.nhost.run/v1",
				"NHOST_AUTH_URL":              "https://local.auth.nhost.run/v1",
				"NHOST_STORAGE_URL":           "https://local.storage.nhost.run/v1",
				"NHOST_FUNCTIONS_URL":         "https://local.functions.nhost.run/v1",
				"NHOST_ADMIN_SECRET":          "nhost-admin-secret",
				"NHOST_WEBHOOK_SECRET":        "nhost-webhook-secret",
				"NHOST_JWT_SECRET":            fmt.Sprintf(`{"type":"HS256", "key": "%s"}`, util.JWT_KEY),
			},
		},
	}
	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			tt := tt
			t.Parallel()
			c := Config{
				nhostConfig: tt.nhostConfig,
				ports:       tt.ports,
			}
			assert.Equalf(t, tt.want, c.storageServiceEnvs(tt.apiRootPrefix), "storageServiceEnvs()")
		})
	}
}
