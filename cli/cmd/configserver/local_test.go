package configserver_test

import (
	"os"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/nhost/be/services/mimir/graph"
	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/cmd/configserver"
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

// placeholderSecretValue mirrors the constant in package configserver; we
// duplicate it here because it is unexported. Tests assert on this exact
// string to verify GetApps redacts real values at load time.
const placeholderSecretValue = "<placeholder-from-local-configserver-substituted-for-real-secret>"

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
						Type: new("HS256"),
						Key:  new("asdasdasdasd"),
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
				MajorVersion: new("14"),
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
				Value: placeholderSecretValue,
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
			name:       "secret values are redacted at load time",
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
				configserver.ZeroUUID,
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

func TestLocalUpdateConfig(t *testing.T) {
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
				configserver.ZeroUUID,
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

func secretsApp(secrets ...*model.ConfigEnvironmentVariable) *graph.App {
	return &graph.App{ //nolint:exhaustruct
		Secrets: secrets,
	}
}

func TestLocalUpdateSecrets(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name       string
		secretsRaw string
		newApp     *graph.App
		expected   string
	}{
		{
			// Placeholder values mean "unchanged" — UpdateSecrets must
			// merge with the on-disk value, never overwriting real
			// secrets with the placeholder sentinel.
			name:       "placeholder preserves on-disk value",
			secretsRaw: "kept = 'real-on-disk-value'\n",
			newApp: secretsApp(&model.ConfigEnvironmentVariable{
				Name:  "kept",
				Value: placeholderSecretValue,
			}),
			expected: "kept = 'real-on-disk-value'\n",
		},
		{
			// A real (non-placeholder) value is a genuine update from
			// the dashboard — write it through.
			name:       "real value writes through",
			secretsRaw: "edited = 'old-value'\n",
			newApp: secretsApp(&model.ConfigEnvironmentVariable{
				Name:  "edited",
				Value: "new-value",
			}),
			expected: "edited = 'new-value'\n",
		},
		{
			// A real value for a name that does not yet exist on disk
			// is a fresh insert.
			name:       "insert of new name writes through",
			secretsRaw: "",
			newApp: secretsApp(&model.ConfigEnvironmentVariable{
				Name:  "fresh",
				Value: "brand-new",
			}),
			expected: "fresh = 'brand-new'\n",
		},
		{
			// A name present on disk but absent from newApp.Secrets is
			// a delete — it must not be carried over.
			name:       "missing name is deleted",
			secretsRaw: "stays = 'real-stays'\ndropped = 'real-dropped'\n",
			newApp: secretsApp(&model.ConfigEnvironmentVariable{
				Name:  "stays",
				Value: placeholderSecretValue,
			}),
			expected: "stays = 'real-stays'\n",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			configF, err := os.CreateTemp(t.TempDir(), "TestLocalUpdateSecrets")
			if err != nil {
				t.Fatalf("failed to create temp file: %v", err)
			}
			defer os.Remove(configF.Name())

			if _, err := configF.WriteString(rawConfig); err != nil {
				t.Fatalf("failed to write to temp file: %v", err)
			}

			secretsF, err := os.CreateTemp(t.TempDir(), "TestLocalUpdateSecrets")
			if err != nil {
				t.Fatalf("failed to create temp file: %v", err)
			}
			defer os.Remove(secretsF.Name())

			if _, err := secretsF.WriteString(tc.secretsRaw); err != nil {
				t.Fatalf("failed to write to temp file: %v", err)
			}

			st := configserver.NewLocal(
				configserver.ZeroUUID,
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
				t.Errorf("failed to read secrets file: %v", err)
			}

			if diff := cmp.Diff(tc.expected, string(b)); diff != "" {
				t.Errorf("UpdateSecrets() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
