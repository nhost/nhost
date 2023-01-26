package compose

import (
	"fmt"
	"github.com/compose-spec/compose-go/types"
	"github.com/nhost/cli/internal/ports"
	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/util"
	"github.com/stretchr/testify/assert"
	"testing"
)

func testPorts(t *testing.T) *ports.Ports {
	t.Helper()
	return ports.NewPorts(1337, 443, 5432, 8080, 9695, 9693, 1025, 9000)
}

func TestConfig_dashboardService(t *testing.T) {
	t.Parallel()
	assert := assert.New(t)

	c := &Config{
		nhostConfig: &nhost.Configuration{Services: make(map[string]*nhost.Service)},
		dotenv:      []string{"FOO=BAR", "BAR=BAZ"},
		ports:       testPorts(t),
	}

	svc := c.dashboardService()
	assert.Equal("dashboard", svc.Name)
	assert.Equal(types.NewMappingWithEquals([]string{
		"FOO=BAR",
		"BAR=BAZ",
		"NEXT_PUBLIC_NHOST_AUTH_URL=https://local.auth.nhost.run/v1",
		"NEXT_PUBLIC_NHOST_FUNCTIONS_URL=https://local.functions.nhost.run/v1",
		"NEXT_PUBLIC_NHOST_GRAPHQL_URL=https://local.graphql.nhost.run/v1/graphql",
		"NEXT_PUBLIC_NHOST_HASURA_API_URL=http://localhost:8080",
		"NEXT_PUBLIC_NHOST_HASURA_CONSOLE_URL=http://localhost:9695",
		"NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL=http://localhost:9693",
		"NEXT_PUBLIC_NHOST_STORAGE_URL=https://local.storage.nhost.run/v1",
	}), svc.Environment)
}

func TestConfig_functionsServiceEnvs(t *testing.T) {
	t.Parallel()
	c := &Config{ports: testPorts(t)}

	assert.Equal(t, env{
		"NHOST_BACKEND_URL":    "http://traefik:1337",
		"NHOST_SUBDOMAIN":      "local.nhost.run",
		"NHOST_REGION":         "",
		"NHOST_HASURA_URL":     "http://localhost:9695",
		"NHOST_GRAPHQL_URL":    "https://local.graphql.nhost.run",
		"NHOST_AUTH_URL":       "https://local.auth.nhost.run/v1",
		"NHOST_STORAGE_URL":    "https://local.storage.nhost.run/v1",
		"NHOST_FUNCTIONS_URL":  "https://local.functions.nhost.run/v1",
		"NHOST_ADMIN_SECRET":   "nhost-admin-secret",
		"NHOST_WEBHOOK_SECRET": "nhost-webhook-secret",
		"NHOST_JWT_SECRET":     fmt.Sprintf(`{"type":"HS256", "key": "%s"}`, util.JWT_KEY),
	}, c.functionsServiceEnvs())
}

func TestConfig_storageServiceEnvs(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name          string
		apiRootPrefix string
		nhostConfig   *nhost.Configuration
		ports         *ports.Ports
		want          env
	}{
		{
			name:          "when minio is enabled",
			apiRootPrefix: "/v1",
			nhostConfig: &nhost.Configuration{
				Services: map[string]*nhost.Service{
					SvcMinio: {
						NoContainer: false,
					},
				},
			},
			ports: testPorts(t),
			want: env{
				"DEBUG":                       "true",
				"BIND":                        ":8576",
				"PUBLIC_URL":                  "https://local.storage.nhost.run",
				"API_ROOT_PREFIX":             "/v1",
				"POSTGRES_MIGRATIONS":         "1",
				"HASURA_METADATA":             "1",
				"HASURA_ENDPOINT":             "https://local.graphql.nhost.run/v1",
				"HASURA_GRAPHQL_ADMIN_SECRET": "nhost-admin-secret",
				"S3_ACCESS_KEY":               "minioaccesskey123123",
				"S3_SECRET_KEY":               "minioaccesskey123123",
				"S3_ENDPOINT":                 "http://minio:9000",
				"S3_BUCKET":                   "nhost",
				"HASURA_GRAPHQL_JWT_SECRET":   fmt.Sprintf(`{"type":"HS256", "key": "%s"}`, util.JWT_KEY),
				"NHOST_JWT_SECRET":            fmt.Sprintf(`{"type":"HS256", "key": "%s"}`, util.JWT_KEY),
				"NHOST_ADMIN_SECRET":          "nhost-admin-secret",
				"NHOST_WEBHOOK_SECRET":        "nhost-webhook-secret",
				"POSTGRES_MIGRATIONS_SOURCE":  "postgres://nhost_storage_admin@local.nhost.run:5432/postgres?sslmode=disable",
			},
		},
		{
			name:          "when minio is set to custom address",
			apiRootPrefix: "/v1",
			nhostConfig: &nhost.Configuration{
				Services: map[string]*nhost.Service{
					SvcMinio: {
						NoContainer: true,
						Address:     "http://foo.bar",
					},
				},
			},
			ports: testPorts(t),
			want: env{
				"DEBUG":                       "true",
				"BIND":                        ":8576",
				"PUBLIC_URL":                  "https://local.storage.nhost.run",
				"API_ROOT_PREFIX":             "/v1",
				"POSTGRES_MIGRATIONS":         "1",
				"HASURA_METADATA":             "1",
				"HASURA_ENDPOINT":             "https://local.graphql.nhost.run/v1",
				"HASURA_GRAPHQL_ADMIN_SECRET": "nhost-admin-secret",
				"S3_ACCESS_KEY":               "minioaccesskey123123",
				"S3_SECRET_KEY":               "minioaccesskey123123",
				"S3_ENDPOINT":                 "http://foo.bar",
				"S3_BUCKET":                   "nhost",
				"HASURA_GRAPHQL_JWT_SECRET":   fmt.Sprintf(`{"type":"HS256", "key": "%s"}`, util.JWT_KEY),
				"NHOST_JWT_SECRET":            fmt.Sprintf(`{"type":"HS256", "key": "%s"}`, util.JWT_KEY),
				"NHOST_ADMIN_SECRET":          "nhost-admin-secret",
				"NHOST_WEBHOOK_SECRET":        "nhost-webhook-secret",
				"POSTGRES_MIGRATIONS_SOURCE":  "postgres://nhost_storage_admin@local.nhost.run:5432/postgres?sslmode=disable",
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

func TestConfig_hasuraServiceEnvs(t *testing.T) {
	t.Parallel()
	assert := assert.New(t)

	c := Config{
		ports: testPorts(t),
		nhostConfig: &nhost.Configuration{
			Services: map[string]*nhost.Service{
				SvcPostgres: {},
			},
		},
	}

	assert.Equal(env{
		"HASURA_GRAPHQL_DATABASE_URL":              "postgres://nhost_hasura@local.nhost.run:5432/postgres",
		"HASURA_GRAPHQL_JWT_SECRET":                fmt.Sprintf(`{"type":"HS256", "key": "%s"}`, util.JWT_KEY),
		"HASURA_GRAPHQL_ADMIN_SECRET":              "nhost-admin-secret",
		"NHOST_ADMIN_SECRET":                       "nhost-admin-secret",
		"NHOST_BACKEND_URL":                        "http://traefik:1337",
		"NHOST_SUBDOMAIN":                          "localhost",
		"NHOST_REGION":                             "",
		"NHOST_HASURA_URL":                         "http://localhost:9695",
		"NHOST_GRAPHQL_URL":                        "https://local.graphql.nhost.run",
		"NHOST_AUTH_URL":                           "https://local.auth.nhost.run/v1",
		"NHOST_STORAGE_URL":                        "https://local.storage.nhost.run/v1",
		"NHOST_FUNCTIONS_URL":                      "https://local.functions.nhost.run/v1",
		"HASURA_GRAPHQL_UNAUTHORIZED_ROLE":         "public",
		"HASURA_GRAPHQL_DEV_MODE":                  "true",
		"HASURA_GRAPHQL_LOG_LEVEL":                 "debug",
		"HASURA_GRAPHQL_ENABLE_CONSOLE":            "false",
		"HASURA_GRAPHQL_MIGRATIONS_SERVER_TIMEOUT": "20",
		"HASURA_GRAPHQL_NO_OF_RETRIES":             "20",
		"HASURA_GRAPHQL_ENABLE_TELEMETRY":          "false",
		"NHOST_WEBHOOK_SECRET":                     "nhost-webhook-secret",
	}, c.hasuraServiceEnvs())
}

func TestConfig_authServiceEnvs(t *testing.T) {
	t.Parallel()
	assert := assert.New(t)

	c := &Config{
		ports: testPorts(t),
		nhostConfig: &nhost.Configuration{
			Services: map[string]*nhost.Service{
				SvcPostgres: {
					Environment: map[string]interface{}{
						"POSTGRES_DB": "foo",
					},
				},
			},
		},
	}

	assert.Equal(env{
		"AUTH_HOST":                   "0.0.0.0",
		"HASURA_GRAPHQL_DATABASE_URL": "postgres://nhost_auth_admin@local.nhost.run:5432/foo",
		"HASURA_GRAPHQL_GRAPHQL_URL":  "https://local.graphql.nhost.run/v1/graphql",
		"AUTH_SERVER_URL":             "https://local.auth.nhost.run/v1",
		"HASURA_GRAPHQL_JWT_SECRET":   fmt.Sprintf(`{"type":"HS256", "key": "%s"}`, util.JWT_KEY),
		"HASURA_GRAPHQL_ADMIN_SECRET": "nhost-admin-secret",
		"NHOST_ADMIN_SECRET":          "nhost-admin-secret",
		"NHOST_WEBHOOK_SECRET":        "nhost-webhook-secret",
	}, c.authServiceEnvs())
}

func TestConfig_PublicHasuraGraphqlEndpoint(t *testing.T) {
	t.Parallel()
	c := &Config{ports: testPorts(t)}
	assert.Equal(t, "https://local.graphql.nhost.run", c.PublicHasuraGraphqlEndpoint())
}

func TestConfig_PublicAuthConnectionString(t *testing.T) {
	t.Parallel()
	c := &Config{ports: testPorts(t)}
	assert.Equal(t, "https://local.auth.nhost.run/v1", c.PublicAuthConnectionString())
}

func TestConfig_PublicStorageConnectionString(t *testing.T) {
	t.Parallel()
	c := &Config{ports: testPorts(t)}
	assert.Equal(t, "https://local.storage.nhost.run/v1", c.PublicStorageConnectionString())
}

func TestConfig_PublicFunctionsConnectionString(t *testing.T) {
	t.Parallel()
	c := &Config{ports: testPorts(t)}
	assert.Equal(t, "https://local.functions.nhost.run/v1", c.PublicFunctionsConnectionString())
}

func TestConfig_PublicPostgresConnectionString(t *testing.T) {
	t.Parallel()
	assert := assert.New(t)

	c := &Config{
		ports: testPorts(t),
		nhostConfig: &nhost.Configuration{
			Services: map[string]*nhost.Service{
				SvcPostgres: {
					Environment: map[string]interface{}{
						"POSTGRES_USER":     "my_user",
						"POSTGRES_PASSWORD": "my_password",
						"POSTGRES_DB":       "my_db",
					},
				},
			},
		},
	}

	assert.Equal("postgres://my_user:my_password@local.nhost.run:5432/my_db", c.PublicPostgresConnectionString())
}

func TestConfig_DashboardURL(t *testing.T) {
	t.Parallel()
	c := &Config{ports: testPorts(t)}
	assert.Equal(t, "https://local.nhost.run", c.DashboardURL())
}

func TestConfig_addLocaldevExtraHost(t *testing.T) {
	t.Parallel()
	assert := assert.New(t)
	c := &Config{}
	svc := &types.ServiceConfig{}
	c.addExtraHosts(svc)

	assert.Equal("host-gateway", svc.ExtraHosts["host.docker.internal"])
	assert.Equal("host-gateway", svc.ExtraHosts["local.nhost.run"])
	assert.Equal("host-gateway", svc.ExtraHosts["local.graphql.nhost.run"])
	assert.Equal("host-gateway", svc.ExtraHosts["local.auth.nhost.run"])
	assert.Equal("host-gateway", svc.ExtraHosts["local.storage.nhost.run"])
	assert.Equal("host-gateway", svc.ExtraHosts["local.functions.nhost.run"])
	assert.Equal("host-gateway", svc.ExtraHosts["local.mail.nhost.run"])
}

func TestConfig_hasuraMigrationsApiURL(t *testing.T) {
	t.Parallel()
	c := &Config{ports: testPorts(t)}
	assert.Equal(t, "http://localhost:9693", c.hasuraMigrationsApiURL())
}

func TestConfig_hasuraApiURL(t *testing.T) {
	t.Parallel()
	c := &Config{ports: testPorts(t)}
	assert.Equal(t, "http://localhost:8080", c.hasuraApiURL())
}

func TestConfig_envValueNhostHasuraURL(t *testing.T) {
	t.Parallel()
	c := &Config{ports: testPorts(t)}
	assert.Equal(t, "http://localhost:9695", c.envValueNhostHasuraURL())
}

func TestConfig_envValueNhostBackendUrl(t *testing.T) {
	t.Parallel()
	c := &Config{ports: testPorts(t)}
	assert.Equal(t, "http://traefik:1337", c.envValueNhostBackendUrl())
}

func TestConfig_storageEnvPublicURL(t *testing.T) {
	t.Parallel()
	c := &Config{ports: testPorts(t)}
	assert.Equal(t, "https://local.storage.nhost.run", c.storageEnvPublicURL())
}

func TestConfig_hasuraGraphqlAPIEndpoint(t *testing.T) {
	t.Parallel()
	c := &Config{ports: testPorts(t)}
	assert.Equal(t, "https://local.graphql.nhost.run/v1/graphql", c.hasuraGraphqlAPIEndpoint())
}

func TestConfig_postgresConnectionStringForUser(t *testing.T) {
	t.Parallel()
	c := &Config{ports: testPorts(t), nhostConfig: &nhost.Configuration{}}
	assert.Equal(t, "postgres://foo@local.nhost.run:5432/postgres", c.postgresConnectionStringForUser("foo"))
}

func TestConfig_PublicMailURL(t *testing.T) {
	t.Parallel()
	c := &Config{ports: testPorts(t)}
	assert.Equal(t, "https://local.mail.nhost.run", c.PublicMailURL())
}
