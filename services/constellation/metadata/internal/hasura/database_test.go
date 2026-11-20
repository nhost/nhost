package hasura_test

import (
	json "encoding/json/v2"
	"strings"
	"testing"

	"github.com/goccy/go-yaml"
	"github.com/google/go-cmp/cmp"

	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

func TestDatabaseURL_IsFromEnv(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		url  hasura.DatabaseURL
		want bool
	}{
		{
			name: "from env",
			url:  hasura.DatabaseURL{FromEnv: "PG_URL", URL: ""},
			want: true,
		},
		{
			name: "direct url",
			url:  hasura.DatabaseURL{FromEnv: "", URL: "postgres://localhost"},
			want: false,
		},
		{
			name: "empty",
			url:  hasura.DatabaseURL{FromEnv: "", URL: ""},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := tt.url.IsFromEnv(); got != tt.want {
				t.Errorf("IsFromEnv() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestDatabaseConfiguration_ReadReplicas(t *testing.T) {
	t.Parallel()

	wantURLs := []hasura.DatabaseURL{
		{FromEnv: "PG_REPLICA_URL_1", URL: ""},
		{FromEnv: "", URL: "postgres://replica-2/app"},
	}

	tests := []struct {
		name  string
		parse func(t *testing.T) []hasura.DatabaseMetadata
		want  []hasura.DatabaseURL
	}{
		{
			name: "yaml",
			parse: func(t *testing.T) []hasura.DatabaseMetadata {
				t.Helper()

				var databases []hasura.DatabaseMetadata
				if err := yaml.Unmarshal([]byte(`
- name: default
  kind: postgres
  configuration:
    connection_info:
      database_url:
        from_env: PG_DATABASE_URL
    read_replicas:
      - database_url:
          from_env: PG_REPLICA_URL_1
      - database_url: postgres://replica-2/app
`), &databases); err != nil {
					t.Fatalf("unmarshal yaml: %v", err)
				}

				return databases
			},
			want: wantURLs,
		},
		{
			name: "json",
			parse: func(t *testing.T) []hasura.DatabaseMetadata {
				t.Helper()

				m, err := hasura.FromJSON([]byte(`{
					"version": 3,
					"sources": [{
						"name": "default",
						"kind": "postgres",
						"configuration": {
							"connection_info": {"database_url": {"from_env": "PG_DATABASE_URL"}},
							"read_replicas": [
								{"database_url": {"from_env": "PG_REPLICA_URL_1"}},
								{"database_url": "postgres://replica-2/app"}
							]
						},
						"tables": []
					}]
				}`))
				if err != nil {
					t.Fatalf("FromJSON: %v", err)
				}

				return m.Databases
			},
			want: wantURLs,
		},
		{
			name: "no replicas",
			parse: func(t *testing.T) []hasura.DatabaseMetadata {
				t.Helper()

				var databases []hasura.DatabaseMetadata
				if err := yaml.Unmarshal([]byte(`
- name: default
  kind: postgres
  configuration:
    connection_info:
      database_url: postgres://primary/app
`), &databases); err != nil {
					t.Fatalf("unmarshal yaml: %v", err)
				}

				return databases
			},
			want: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			databases := tt.parse(t)
			if len(databases) != 1 {
				t.Fatalf("got %d databases, want 1", len(databases))
			}

			var got []hasura.DatabaseURL
			for _, r := range databases[0].Configuration.ReadReplicas {
				got = append(got, r.DatabaseURL)
			}

			if diff := cmp.Diff(tt.want, got); diff != "" {
				t.Errorf("read replica URLs mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestDatabaseConfiguration_ReadReplicasRoundTripKeepsSettings(t *testing.T) {
	t.Parallel()

	m, err := hasura.FromJSON([]byte(`{
		"version": 3,
		"sources": [{
			"name": "default",
			"kind": "postgres",
			"configuration": {
				"connection_info": {"database_url": "postgres://primary/app"},
				"read_replicas": [{
					"database_url": {"from_env": "PG_REPLICA_URL_1"},
					"pool_settings": {"max_connections": 20}
				}]
			},
			"tables": []
		}]
	}`))
	if err != nil {
		t.Fatalf("FromJSON: %v", err)
	}

	out, err := hasura.ToJSON(m)
	if err != nil {
		t.Fatalf("ToJSON: %v", err)
	}

	var exported struct {
		Sources []struct {
			Configuration struct {
				ReadReplicas []map[string]any `json:"read_replicas"`
			} `json:"configuration"`
		} `json:"sources"`
	}
	if err := json.Unmarshal(out, &exported); err != nil {
		t.Fatalf("unmarshal exported metadata: %v", err)
	}

	replicas := exported.Sources[0].Configuration.ReadReplicas
	if len(replicas) != 1 {
		t.Fatalf("got %d exported replicas, want 1: %s", len(replicas), out)
	}

	want := map[string]any{
		"database_url":  map[string]any{"from_env": "PG_REPLICA_URL_1"},
		"pool_settings": map[string]any{"max_connections": float64(20)},
	}
	if diff := cmp.Diff(want, replicas[0]); diff != "" {
		t.Errorf("exported replica mismatch (-want +got):\n%s", diff)
	}

	if strings.Count(string(out), "read_replicas") != 1 {
		t.Errorf("read_replicas exported more than once: %s", out)
	}
}
