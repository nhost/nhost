package configserver_test

import (
	"os"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/nhost/be/services/mimir/graph"
	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/cli/cmd/configserver"
)

const rawConfig = `[hasura]
adminSecret = 'hasuraAdminSecret'
webhookSecret = 'webhookSecret'

[[hasura.jwtSecrets]]
type = 'HS256'
key = 'asdasdasdasd'

[observability]
[observability.grafana]
adminPassword = 'asdasd'
`

const rawSecrets = `someSecret = 'asdasd'
`

func ptr[T any](v T) *T {
	return &v
}

func newApp() *graph.App {
	return &graph.App{
		Config: &model.ConfigConfig{
			Global:  nil,
			Graphql: nil,
			Hasura: &model.ConfigHasura{ //nolint:exhaustruct
				AdminSecret:   "hasuraAdminSecret",
				WebhookSecret: "webhookSecret",
				JwtSecrets: []*model.ConfigJWTSecret{
					{
						Type: ptr("HS256"),
						Key:  ptr("asdasdasdasd"),
					},
				},
			},
			Functions: nil,
			Auth:      nil,
			Postgres:  nil,
			Provider:  nil,
			Storage:   nil,
			Ai:        nil,
			Observability: &model.ConfigObservability{
				Grafana: &model.ConfigGrafana{
					AdminPassword: "asdasd",
					Smtp:          nil,
					Alerting:      nil,
					Contacts:      nil,
				},
			},
		},
		SystemConfig: &model.ConfigSystemConfig{ //nolint:exhaustruct
			Postgres: &model.ConfigSystemConfigPostgres{ //nolint:exhaustruct
				MajorVersion: ptr("14"),
				Database:     "local",
				ConnectionString: &model.ConfigSystemConfigPostgresConnectionString{
					Backup:  "a",
					Hasura:  "a",
					Auth:    "a",
					Storage: "a",
				},
			},
		},
		Secrets: []*model.ConfigEnvironmentVariable{
			{
				Name:  "someSecret",
				Value: "asdasd",
			},
		},
		Services: graph.Services{},
		AppID:    "00000000-0000-0000-0000-000000000000",
	}
}

func TestLocalGetApps(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name       string
		configRaw  string
		secretsRaw string
		expected   []*graph.App
	}{
		{
			name:       "works",
			configRaw:  rawConfig,
			secretsRaw: rawSecrets,
			expected:   []*graph.App{newApp()},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			configF, err := os.CreateTemp(t.TempDir(), "TestLocalGetApps")
			if err != nil {
				t.Fatalf("failed to create temp file: %v", err)
			}
			defer os.Remove(configF.Name())

			if _, err := configF.WriteString(tc.configRaw); err != nil {
				t.Fatalf("failed to write to temp file: %v", err)
			}

			secretsF, err := os.CreateTemp(t.TempDir(), "TestLocalGetApps")
			if err != nil {
				t.Fatalf("failed to create temp file: %v", err)
			}
			defer os.Remove(secretsF.Name())

			if _, err := secretsF.WriteString(tc.secretsRaw); err != nil {
				t.Fatalf("failed to write to temp file: %v", err)
			}

			st := configserver.NewLocal(
				configF.Name(),
				secretsF.Name(),
				nil,
			)
			got, err := st.GetApps(configF.Name(), secretsF.Name(), nil)
			if err != nil {
				t.Errorf("GetApps() got error: %v", err)
			}

			cmpOpts := cmpopts.IgnoreUnexported(graph.App{}) //nolint:exhaustruct

			if diff := cmp.Diff(tc.expected, got, cmpOpts); diff != "" {
				t.Errorf("GetApps() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestLocalUpdateConfig(t *testing.T) { //nolint:dupl
	t.Parallel()

	cases := []struct {
		name       string
		configRaw  string
		secretsRaw string
		newApp     *graph.App
		expected   string
	}{
		{
			name:       "works",
			configRaw:  rawConfig,
			secretsRaw: rawSecrets,
			newApp:     newApp(),
			expected:   rawConfig,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			configF, err := os.CreateTemp(t.TempDir(), "TestLocalGetApps")
			if err != nil {
				t.Fatalf("failed to create temp file: %v", err)
			}
			defer os.Remove(configF.Name())

			if _, err := configF.WriteString(tc.configRaw); err != nil {
				t.Fatalf("failed to write to temp file: %v", err)
			}

			secretsF, err := os.CreateTemp(t.TempDir(), "TestLocalGetApps")
			if err != nil {
				t.Fatalf("failed to create temp file: %v", err)
			}
			defer os.Remove(secretsF.Name())

			if _, err := secretsF.WriteString(tc.secretsRaw); err != nil {
				t.Fatalf("failed to write to temp file: %v", err)
			}

			st := configserver.NewLocal(
				configF.Name(),
				secretsF.Name(),
				nil,
			)

			if err := st.UpdateConfig(
				t.Context(),
				nil,
				tc.newApp,
				nil,
			); err != nil {
				t.Errorf("UpdateConfig() got error: %v", err)
			}

			b, err := os.ReadFile(configF.Name())
			if err != nil {
				t.Errorf("failed to read config file: %v", err)
			}

			if diff := cmp.Diff(tc.expected, string(b)); diff != "" {
				t.Errorf("UpdateConfig() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestLocalUpdateSecrets(t *testing.T) { //nolint:dupl
	t.Parallel()

	cases := []struct {
		name       string
		configRaw  string
		secretsRaw string
		newApp     *graph.App
		expected   string
	}{
		{
			name:       "works",
			configRaw:  rawConfig,
			secretsRaw: rawSecrets,
			newApp:     newApp(),
			expected:   rawSecrets,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			configF, err := os.CreateTemp(t.TempDir(), "TestLocalGetApps")
			if err != nil {
				t.Fatalf("failed to create temp file: %v", err)
			}
			defer os.Remove(configF.Name())

			if _, err := configF.WriteString(tc.configRaw); err != nil {
				t.Fatalf("failed to write to temp file: %v", err)
			}

			secretsF, err := os.CreateTemp(t.TempDir(), "TestLocalGetApps")
			if err != nil {
				t.Fatalf("failed to create temp file: %v", err)
			}
			defer os.Remove(secretsF.Name())

			if _, err := secretsF.WriteString(tc.secretsRaw); err != nil {
				t.Fatalf("failed to write to temp file: %v", err)
			}

			st := configserver.NewLocal(
				configF.Name(),
				secretsF.Name(),
				nil,
			)

			if err := st.UpdateSecrets(
				t.Context(),
				nil,
				tc.newApp,
				nil,
			); err != nil {
				t.Errorf("UpdateSecrets() got error: %v", err)
			}

			b, err := os.ReadFile(secretsF.Name())
			if err != nil {
				t.Errorf("failed to read config file: %v", err)
			}

			if diff := cmp.Diff(tc.expected, string(b)); diff != "" {
				t.Errorf("UpdateSecrets() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
