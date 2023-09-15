package dockercompose //nolint:testpackage

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/be/services/mimir/model"
)

//nolint:lll
func expectedGraphql() *Service {
	return &Service{
		Image:   "nhost/graphql-engine:2.12.0",
		Command: nil,
		DependsOn: map[string]DependsOn{
			"functions": {Condition: "service_healthy"},
			"postgres":  {Condition: "service_healthy"},
		},
		EntryPoint: nil,
		Environment: map[string]string{
			"ENV1":                                                     "VALUE1",
			"ENV2":                                                     "VALUE2",
			"HASURA_GRAPHQL_ADMIN_INTERNAL_ERRORS":                     "true",
			"HASURA_GRAPHQL_ADMIN_SECRET":                              "adminSecret",
			"HASURA_GRAPHQL_CONSOLE_ASSETS_DIR":                        "/srv/console-assets",
			"HASURA_GRAPHQL_CORS_DOMAIN":                               "http://*.localhost",
			"HASURA_GRAPHQL_DATABASE_URL":                              "postgres://nhost_hasura@postgres:5432/local",
			"HASURA_GRAPHQL_DEV_MODE":                                  "false",
			"HASURA_GRAPHQL_DISABLE_CORS":                              "false",
			"HASURA_GRAPHQL_ENABLED_APIS":                              "metadata,graphql,config,pgdump",
			"HASURA_GRAPHQL_ENABLED_LOG_TYPES":                         "startup,http-log,webhook-log,websocket-log",
			"HASURA_GRAPHQL_ENABLE_ALLOWLIST":                          "true",
			"HASURA_GRAPHQL_ENABLE_CONSOLE":                            "false",
			"HASURA_GRAPHQL_ENABLE_REMOTE_SCHEMA_PERMISSIONS":          "true",
			"HASURA_GRAPHQL_ENABLE_TELEMETRY":                          "false",
			"HASURA_GRAPHQL_EVENTS_HTTP_POOL_SIZE":                     "100",
			"HASURA_GRAPHQL_JWT_SECRET":                                `{"claims_map":{"x-hasura-allowed-roles":{"path":"$.roles"},"x-hasura-default-role":"viewer","x-hasura-org-id":{"default":"public","path":"$.org"},"x-hasura-user-id":{"path":"$.sub"}},"key":"jwtSecretKey","type":"HS256"}`,
			"HASURA_GRAPHQL_LIVE_QUERIES_MULTIPLEXED_BATCH_SIZE":       "100",
			"HASURA_GRAPHQL_LIVE_QUERIES_MULTIPLEXED_REFETCH_INTERVAL": "1000",
			"HASURA_GRAPHQL_LOG_LEVEL":                                 "info",
			"HASURA_GRAPHQL_PG_CONNECTIONS":                            "50",
			"HASURA_GRAPHQL_PG_TIMEOUT":                                "180",
			"HASURA_GRAPHQL_STRINGIFY_NUMERIC_TYPES":                   "false",
			"HASURA_GRAPHQL_TX_ISOLATION":                              "read-committed",
			"HASURA_GRAPHQL_UNAUTHORIZED_ROLE":                         "public",
			"HASURA_GRAPHQL_USE_PREPARED_STATEMENTS":                   "true",
			"HASURA_GRAPHQL_WS_READ_COOKIE":                            "false",
			"NHOST_ADMIN_SECRET":                                       "adminSecret",
			"NHOST_AUTH_URL":                                           "http://local.auth.nhost.run:1337/v1",
			"NHOST_BACKEND_URL":                                        "http://local.nhost.run:1337",
			"NHOST_FUNCTIONS_URL":                                      "http://local.functions.nhost.run:1337/v1",
			"NHOST_GRAPHQL_URL":                                        "http://local.graphql.nhost.run:1337/v1",
			"NHOST_HASURA_URL":                                         "http://local.hasura.nhost.run:1337",
			"NHOST_JWT_SECRET":                                         `{"claims_map":{"x-hasura-allowed-roles":{"path":"$.roles"},"x-hasura-default-role":"viewer","x-hasura-org-id":{"default":"public","path":"$.org"},"x-hasura-user-id":{"path":"$.sub"}},"key":"jwtSecretKey","type":"HS256"}`,
			"NHOST_REGION":                                             "",
			"NHOST_STORAGE_URL":                                        "http://local.storage.nhost.run:1337/v1",
			"NHOST_SUBDOMAIN":                                          "local",
			"NHOST_WEBHOOK_SECRET":                                     "webhookSecret",
		},
		ExtraHosts: []string{
			"host.docker.internal:host-gateway", "local.auth.nhost.run:host-gateway",
			"local.db.nhost.run:host-gateway", "local.functions.nhost.run:host-gateway",
			"local.graphql.nhost.run:host-gateway", "local.hasura.nhost.run:host-gateway",
			"local.storage.nhost.run:host-gateway",
		},
		HealthCheck: &HealthCheck{
			Test: []string{
				"CMD-SHELL",
				"curl http://localhost:8080/healthz > /dev/null 2>&1",
			},
			Timeout:     "60s",
			Interval:    "5s",
			StartPeriod: "60s",
		},
		Labels: map[string]string{
			"traefik.enable": "true",
			"traefik.http.middlewares.replace-graphql.replacepathregex.regex":       "/v1(/|$$)(.*)",
			"traefik.http.middlewares.replace-graphql.replacepathregex.replacement": "/v1/graphql$$2",
			"traefik.http.routers.graphql.entrypoints":                              "web",
			"traefik.http.routers.graphql.middlewares":                              "replace-graphql",
			"traefik.http.routers.graphql.rule":                                     "PathPrefix(`/v1`) && Host(`local.graphql.nhost.run`)",
			"traefik.http.routers.graphql.service":                                  "graphql",
			"traefik.http.routers.graphql.tls":                                      "false",
			"traefik.http.routers.hasura.entrypoints":                               "web",
			"traefik.http.routers.hasura.rule":                                      "( PathPrefix(`/v1`) || PathPrefix(`/v2`) || PathPrefix(`/console/assets`) ) && Host(`local.hasura.nhost.run`)",
			"traefik.http.routers.hasura.service":                                   "hasura",
			"traefik.http.routers.hasura.tls":                                       "false",
			"traefik.http.services.graphql.loadbalancer.server.port":                "8080",
			"traefik.http.services.hasura.loadbalancer.server.port":                 "8080",
		},
		Ports:      nil,
		Restart:    "always",
		Volumes:    nil,
		WorkingDir: nil,
	}
}

func TestGraphql(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		cfg      func() *model.ConfigConfig
		useTlS   bool
		expected func() *Service
	}{
		{
			name:     "success",
			cfg:      getConfig,
			expected: expectedGraphql,
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			tc := tc

			got, err := graphql(tc.cfg(), tc.useTlS, 1337, 0)
			if err != nil {
				t.Errorf("got error: %v", err)
			}

			if diff := cmp.Diff(tc.expected(), got); diff != "" {
				t.Error(diff)
			}
		})
	}
}

func expectedConsole() *Service {
	return &Service{
		Image:     "nhost/graphql-engine:v2.25.0.cli-migrations-v3",
		DependsOn: map[string]DependsOn{"graphql": {Condition: "service_healthy"}},
		Command: []string{
			"bash", "-c",
			`
                hasura-cli \
                    console \
                    --no-browser \
                    --endpoint http://graphql:8080 \
                    --address 0.0.0.0 \
                    --console-port 9695 \
                    --api-port 1337 \
                    --api-host http://local.hasura.nhost.run \
                    --console-hge-endpoint http://local.hasura.nhost.run:1337`,
		},
		EntryPoint: nil,
		Environment: map[string]string{
			"ENV1":                                                     "VALUE1",
			"ENV2":                                                     "VALUE2",
			"HASURA_GRAPHQL_ADMIN_INTERNAL_ERRORS":                     "true",
			"HASURA_GRAPHQL_ADMIN_SECRET":                              "adminSecret",
			"HASURA_GRAPHQL_CONSOLE_ASSETS_DIR":                        "/srv/console-assets",
			"HASURA_GRAPHQL_CORS_DOMAIN":                               "http://*.localhost",
			"HASURA_GRAPHQL_DATABASE_URL":                              "postgres://nhost_hasura@postgres:5432/local",
			"HASURA_GRAPHQL_DEV_MODE":                                  "false",
			"HASURA_GRAPHQL_DISABLE_CORS":                              "false",
			"HASURA_GRAPHQL_ENABLED_APIS":                              "metadata,graphql,config,pgdump",
			"HASURA_GRAPHQL_ENABLED_LOG_TYPES":                         "startup,http-log,webhook-log,websocket-log",
			"HASURA_GRAPHQL_ENABLE_ALLOWLIST":                          "true",
			"HASURA_GRAPHQL_ENABLE_CONSOLE":                            "false",
			"HASURA_GRAPHQL_ENABLE_REMOTE_SCHEMA_PERMISSIONS":          "true",
			"HASURA_GRAPHQL_ENABLE_TELEMETRY":                          "false",
			"HASURA_GRAPHQL_EVENTS_HTTP_POOL_SIZE":                     "100",
			"HASURA_GRAPHQL_JWT_SECRET":                                `{"claims_map":{"x-hasura-allowed-roles":{"path":"$.roles"},"x-hasura-default-role":"viewer","x-hasura-org-id":{"default":"public","path":"$.org"},"x-hasura-user-id":{"path":"$.sub"}},"key":"jwtSecretKey","type":"HS256"}`, //nolint:lll
			"HASURA_GRAPHQL_LIVE_QUERIES_MULTIPLEXED_BATCH_SIZE":       "100",
			"HASURA_GRAPHQL_LIVE_QUERIES_MULTIPLEXED_REFETCH_INTERVAL": "1000",
			"HASURA_GRAPHQL_LOG_LEVEL":                                 "info",
			"HASURA_GRAPHQL_PG_CONNECTIONS":                            "50",
			"HASURA_GRAPHQL_PG_TIMEOUT":                                "180",
			"HASURA_GRAPHQL_STRINGIFY_NUMERIC_TYPES":                   "false",
			"HASURA_GRAPHQL_TX_ISOLATION":                              "read-committed",
			"HASURA_GRAPHQL_UNAUTHORIZED_ROLE":                         "public",
			"HASURA_GRAPHQL_USE_PREPARED_STATEMENTS":                   "true",
			"HASURA_GRAPHQL_WS_READ_COOKIE":                            "false",
			"NHOST_ADMIN_SECRET":                                       "adminSecret",
			"NHOST_AUTH_URL":                                           "http://local.auth.nhost.run:1337/v1",
			"NHOST_BACKEND_URL":                                        "http://local.nhost.run:1337",
			"NHOST_FUNCTIONS_URL":                                      "http://local.functions.nhost.run:1337/v1",
			"NHOST_GRAPHQL_URL":                                        "http://local.graphql.nhost.run:1337/v1",
			"NHOST_HASURA_URL":                                         "http://local.hasura.nhost.run:1337",
			"NHOST_JWT_SECRET":                                         `{"claims_map":{"x-hasura-allowed-roles":{"path":"$.roles"},"x-hasura-default-role":"viewer","x-hasura-org-id":{"default":"public","path":"$.org"},"x-hasura-user-id":{"path":"$.sub"}},"key":"jwtSecretKey","type":"HS256"}`, //nolint:lll
			"NHOST_REGION":                                             "",
			"NHOST_STORAGE_URL":                                        "http://local.storage.nhost.run:1337/v1",
			"NHOST_SUBDOMAIN":                                          "local",
			"NHOST_WEBHOOK_SECRET":                                     "webhookSecret",
		},
		ExtraHosts: []string{
			"host.docker.internal:host-gateway", "local.auth.nhost.run:host-gateway",
			"local.db.nhost.run:host-gateway", "local.functions.nhost.run:host-gateway",
			"local.graphql.nhost.run:host-gateway", "local.hasura.nhost.run:0.0.0.0",
			"local.storage.nhost.run:host-gateway",
		},
		HealthCheck: &HealthCheck{
			Test: []string{
				"CMD-SHELL",
				"timeout 1s bash -c ':> /dev/tcp/127.0.0.1/9695' || exit 1",
			},
			Timeout:     "60s",
			Interval:    "5s",
			StartPeriod: "60s",
		},
		Labels: map[string]string{
			"traefik.enable": "true",
			"traefik.http.routers.console.entrypoints":               "web",
			"traefik.http.routers.console.rule":                      "Host(`local.hasura.nhost.run`)",
			"traefik.http.routers.console.service":                   "console",
			"traefik.http.routers.console.tls":                       "false",
			"traefik.http.routers.migrate.entrypoints":               "web",
			"traefik.http.routers.migrate.rule":                      "PathPrefix(`/apis/`) && Host(`local.hasura.nhost.run`)",
			"traefik.http.routers.migrate.service":                   "migrate",
			"traefik.http.routers.migrate.tls":                       "false",
			"traefik.http.services.console.loadbalancer.server.port": "9695",
			"traefik.http.services.migrate.loadbalancer.server.port": "1337",
		},
		Ports:   nil,
		Restart: "always",
		Volumes: []Volume{
			{Type: "bind", Source: "/path/to/nhost", Target: "/app", ReadOnly: ptr(false)},
		},
		WorkingDir: ptr("/app"),
	}
}

func TestConsole(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		cfg      func() *model.ConfigConfig
		useTlS   bool
		expected func() *Service
	}{
		{
			name: "success",
			cfg: func() *model.ConfigConfig {
				cfg := getConfig()
				cfg.Hasura.Version = ptr("v2.25.0")
				return cfg
			},
			expected: expectedConsole,
		},
		// {
		// 	name: "fail",
		// 	cfg:  getConfig,
		// },
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			tc := tc

			got, err := console(tc.cfg(), 1337, tc.useTlS, "/path/to/nhost", 0)
			if err != nil {
				t.Fatalf("got error: %v", err)
			}

			if diff := cmp.Diff(tc.expected(), got); diff != "" {
				t.Error(diff)
			}
		})
	}
}
