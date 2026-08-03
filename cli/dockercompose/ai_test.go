package dockercompose //nolint:testpackage

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/be/services/mimir/model"
)

func expectedAI(storageURL, backendService string) *Service {
	return &Service{
		Image: "nhost/graphite:0.2.5",
		DependsOn: map[string]DependsOn{
			backendService: {Condition: "service_healthy"},
			"graphql":      {Condition: "service_healthy"},
			"postgres":     {Condition: "service_healthy"},
		},
		EntryPoint: nil,
		Command:    []string{"serve"},
		Environment: map[string]string{
			"ENV1":                        "VALUE1",
			"ENV2":                        "VALUE2",
			"GRAPHITE_BASE_URL":           "http://ai:8090",
			"GRAPHITE_WEBHOOK_SECRET":     "webhookSecret",
			"HASURA_GRAPHQL_ADMIN_SECRET": "adminSecret",
			"NHOST_STORAGE_URL":           storageURL,
			"LICENSE":                     "",
			"NHOST_GRAPHQL_URL":           "http://graphql:8080/v1/graphql",
			"OPENAI_API_KEY":              "openaiApiKey",
			"OPENAI_ORG":                  "my-org",
			"POSTGRES_CONNECTION":         "postgres://postgres@postgres:5432/local?sslmode=disable",
			"SYNCH_PERIOD":                "10m",
		},
		ExtraHosts: []string{
			"host.docker.internal:host-gateway",
		},
		HealthCheck: &HealthCheck{
			Test:        []string{"CMD", "graphite", "healthcheck"},
			Timeout:     "60s",
			Interval:    "5s",
			StartPeriod: "10s",
		},
		Labels:     nil,
		Networks:   nil,
		Ports:      nil,
		Restart:    "always",
		Volumes:    nil,
		WorkingDir: nil,
	}
}

func TestAI(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name           string
		cfg            func() *model.ConfigConfig
		storageURL     string
		backendService string
	}{
		{
			name:           "standalone",
			cfg:            getConfig,
			storageURL:     "http://storage:5000/v1",
			backendService: "auth",
		},
		{
			name:           "engine",
			cfg:            getConfig,
			storageURL:     "http://engine:8080/storage/v1",
			backendService: "engine",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := ai(tc.cfg(), tc.storageURL, tc.backendService)
			if diff := cmp.Diff(
				expectedAI(tc.storageURL, tc.backendService), got,
			); diff != "" {
				t.Error(diff)
			}
		})
	}
}
