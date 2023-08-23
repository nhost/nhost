package dockercompose //nolint:testpackage

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/be/services/mimir/model"
)

func expectedStorage() *Service {
	return &Service{
		Image: "nhost/hasura-storage:0.2.5",
		DependsOn: map[string]DependsOn{
			"graphql":  {Condition: "service_healthy"},
			"minio":    {Condition: "service_started"},
			"postgres": {Condition: "service_healthy"},
		},
		Command:    []string{"serve"},
		EntryPoint: nil,
		Environment: map[string]string{
			"BIND":                        ":5000",
			"HASURA_ENDPOINT":             "http://graphql:8080/v1",
			"HASURA_GRAPHQL_ADMIN_SECRET": "adminSecret",
			"HASURA_METADATA":             "1",
			"POSTGRES_MIGRATIONS":         "1",
			"POSTGRES_MIGRATIONS_SOURCE":  "postgres://nhost_storage_admin@postgres:5432/local?sslmode=disable",
			"PUBLIC_URL":                  "http://local.storage.nhost.run:444",
			"S3_ACCESS_KEY":               "minioaccesskey123123",
			"S3_BUCKET":                   "nhost",
			"S3_ENDPOINT":                 "http://minio:9000",
			"S3_REGION":                   "",
			"S3_ROOT_FOLDER":              "",
			"S3_SECRET_KEY":               "minioaccesskey123123",
			"CLAMAV_SERVER":               "tcp://run-clamav:3310",
		},
		ExtraHosts: []string{
			"host.docker.internal:host-gateway", "local.auth.nhost.run:host-gateway",
			"local.db.nhost.run:host-gateway", "local.functions.nhost.run:host-gateway",
			"local.graphql.nhost.run:host-gateway", "local.hasura.nhost.run:host-gateway",
			"local.storage.nhost.run:host-gateway",
		},
		HealthCheck: nil,
		Labels: map[string]string{
			"traefik.enable": "true",
			"traefik.http.routers.storage.entrypoints":               "web",
			"traefik.http.routers.storage.rule":                      "PathPrefix(`/v1`) && Host(`local.storage.nhost.run`)",
			"traefik.http.routers.storage.service":                   "storage",
			"traefik.http.routers.storage.tls":                       "false",
			"traefik.http.services.storage.loadbalancer.server.port": "5000",
		},
		Ports:      nil,
		Restart:    "always",
		Volumes:    nil,
		WorkingDir: nil,
	}
}

func TestStorage(t *testing.T) {
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
			expected: expectedStorage,
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			tc := tc

			got, err := storage(tc.cfg(), tc.useTlS, 444, 0)
			if err != nil {
				t.Errorf("got error: %v", err)
			}

			if diff := cmp.Diff(tc.expected(), got); diff != "" {
				t.Error(diff)
			}
		})
	}
}
