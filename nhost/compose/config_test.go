package compose

import (
	"github.com/compose-spec/compose-go/types"
	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/cli/config"
	"github.com/nhost/cli/internal/ports"
	"github.com/stretchr/testify/assert"
	"testing"
)

func resolvedDefaultNhostConfig(t *testing.T) *model.ConfigConfig {
	t.Helper()
	c, secr, err := config.DefaultConfigAndSecrets()
	if err != nil {
		t.Fatal(err)
	}

	c, err = config.ValidateAndResolve(c, secr)
	if err != nil {
		t.Fatal(err)
	}

	return c
}

func testPorts(t *testing.T) *ports.Ports {
	t.Helper()
	return ports.NewPorts(
		ports.DefaultProxyPort,
		ports.DefaultSSLProxyPort,
		ports.DefaultDBPort,
		ports.DefaultGraphQLPort,
		ports.DefaultHasuraConsolePort,
		ports.DefaultHasuraConsoleAPIPort,
		ports.DefaultSMTPPort,
		ports.DefaultS3MinioPort,
		ports.DefaultDashboardPort,
		ports.DefaultMailhogPort,
	)
}

func TestConfig_PublicHasuraGraphqlEndpoint(t *testing.T) {
	t.Parallel()
	c := &Config{ports: testPorts(t)}
	assert.Equal(t, "https://local.graphql.nhost.run/v1", c.PublicHasuraGraphqlEndpoint())
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

func TestConfig_PublicHasuraConsoleURL(t *testing.T) {
	t.Parallel()
	c := &Config{ports: testPorts(t)}
	assert.Equal(t, "http://localhost:9695", c.PublicHasuraConsoleURL())
}

func TestConfig_PublicHasuraConsoleRedirectURL(t *testing.T) {
	t.Parallel()
	c := &Config{ports: testPorts(t)}
	assert.Equal(t, "https://local.hasura.nhost.run/console", c.PublicHasuraConsoleRedirectURL())
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
		ports:       testPorts(t),
		nhostConfig: resolvedDefaultNhostConfig(t),
	}

	assert.Equal("postgres://postgres:postgres@local.db.nhost.run:5432/postgres", c.PublicPostgresConnectionString())
}

func TestConfig_DashboardURL(t *testing.T) {
	t.Parallel()
	c := &Config{ports: testPorts(t)}
	assert.Equal(t, "http://localhost:3030", c.PublicDashboardURL())
}

func TestConfig_addLocaldevExtraHost(t *testing.T) {
	t.Parallel()
	assert := assert.New(t)
	c := &Config{}
	svc := &types.ServiceConfig{}
	c.addExtraHosts(svc)

	assert.Equal("host-gateway", svc.ExtraHosts["host.docker.internal"])
	assert.Equal("host-gateway", svc.ExtraHosts["local.db.nhost.run"])
	assert.Equal("host-gateway", svc.ExtraHosts["local.hasura.nhost.run"])
	assert.Equal("host-gateway", svc.ExtraHosts["local.graphql.nhost.run"])
	assert.Equal("host-gateway", svc.ExtraHosts["local.auth.nhost.run"])
	assert.Equal("host-gateway", svc.ExtraHosts["local.storage.nhost.run"])
	assert.Equal("host-gateway", svc.ExtraHosts["local.functions.nhost.run"])
}

func TestConfig_hasuraMigrationsApiURL(t *testing.T) {
	t.Parallel()
	c := &Config{ports: testPorts(t)}
	assert.Equal(t, "http://localhost:9693", c.hasuraMigrationsApiURL())
}

func TestConfig_hasuraApiURL(t *testing.T) {
	t.Parallel()
	c := &Config{ports: testPorts(t)}
	assert.Equal(t, "https://local.hasura.nhost.run", c.hasuraApiURL())
}

func TestConfig_envValueNhostHasuraURL(t *testing.T) {
	t.Parallel()
	c := &Config{ports: testPorts(t)}
	assert.Equal(t, "https://local.hasura.nhost.run/console", c.envValueNhostHasuraURL())
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

func TestConfig_postgresConnectionStringForUser(t *testing.T) {
	t.Parallel()
	c := &Config{ports: testPorts(t), nhostConfig: resolvedDefaultNhostConfig(t)}
	assert.Equal(t, "postgres://foo@local.db.nhost.run:5432/postgres", c.postgresConnectionStringForUser("foo"))
}

func TestConfig_PublicMailURL(t *testing.T) {
	t.Parallel()
	c := &Config{ports: testPorts(t)}
	assert.Equal(t, "http://localhost:8025", c.PublicMailhogURL())
}

func TestConfig_smtpSettings(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		conf func(t *testing.T) *model.ConfigConfig
		want *model.ConfigSmtp
	}{
		{
			name: "default",
			conf: func(t *testing.T) *model.ConfigConfig {
				return resolvedDefaultNhostConfig(t)
			},
			want: &model.ConfigSmtp{
				User:     "user",
				Password: "password",
				Sender:   "hasura-auth@example.com",
				Host:     "mailhog",
				Port:     uint16(ports.DefaultSMTPPort),
				Secure:   false,
				Method:   "PLAIN",
			},
		},
		{
			name: "custom",
			conf: func(t *testing.T) *model.ConfigConfig {
				return &model.ConfigConfig{
					Provider: &model.ConfigProvider{Smtp: &model.ConfigSmtp{
						User:     "foo",
						Password: "bar",
						Sender:   "foo@bar.com",
						Host:     "foobar.com",
						Port:     9999,
						Secure:   true,
						Method:   "GSSAPI",
					}},
				}
			},
			want: &model.ConfigSmtp{
				User:     "foo",
				Password: "bar",
				Sender:   "foo@bar.com",
				Host:     "foobar.com",
				Port:     9999,
				Secure:   true,
				Method:   "GSSAPI",
			},
		},
	}
	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			tt := tt
			t.Parallel()

			c := Config{
				nhostConfig: tt.conf(t),
			}
			assert.Equal(t, tt.want, c.smtpSettings())
		})
	}
}
