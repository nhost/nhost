package connector

import (
	"log/slog"
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"

	"github.com/nhost/nhost/services/constellation/metadata"
)

func replicaInconsistencies(snap []metadata.Inconsistency) []metadata.Inconsistency {
	var out []metadata.Inconsistency

	for _, inc := range snap {
		if inc.Kind == metadata.InconsistencyKindReadReplica {
			out = append(out, inc)
		}
	}

	return out
}

func TestResolveReplicaURLs(t *testing.T) {
	t.Parallel()

	_, missingErr := metadata.EnvString("{{CONSTELLATION_TEST_REPLICA_MISSING}}").Resolve()
	if missingErr == nil {
		t.Fatal("expected CONSTELLATION_TEST_REPLICA_MISSING to be unset")
	}

	tests := []struct {
		name     string
		replicas []metadata.DatabaseConnectionInfo
		wantURLs []string
		wantRecs []metadata.Inconsistency
	}{
		{
			name:     "no replicas",
			replicas: nil,
			wantURLs: []string{},
			wantRecs: nil,
		},
		{
			name: "direct urls",
			replicas: []metadata.DatabaseConnectionInfo{
				{DatabaseURL: "postgres://replica-1/app"},
				{DatabaseURL: "postgres://replica-2/app"},
			},
			wantURLs: []string{"postgres://replica-1/app", "postgres://replica-2/app"},
			wantRecs: nil,
		},
		{
			name: "missing env var and empty url keep their position",
			replicas: []metadata.DatabaseConnectionInfo{
				{DatabaseURL: "{{CONSTELLATION_TEST_REPLICA_MISSING}}"},
				{DatabaseURL: "postgres://replica-2/app"},
				{DatabaseURL: ""},
			},
			wantURLs: []string{"", "postgres://replica-2/app", ""},
			wantRecs: []metadata.Inconsistency{
				{
					Kind:   metadata.InconsistencyKindReadReplica,
					Source: "default",
					Name:   "read_replicas[0]",
					Reason: "resolving database URL: " + missingErr.Error(),
				},
				{
					Kind:   metadata.InconsistencyKindReadReplica,
					Source: "default",
					Name:   "read_replicas[2]",
					Reason: ErrDatabaseURLNotSet.Error(),
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			dbMeta := &metadata.DatabaseMetadata{
				Name: "default",
				Kind: "postgres",
				Configuration: metadata.DatabaseConfiguration{
					ConnectionInfo: metadata.DatabaseConnectionInfo{
						DatabaseURL: "postgres://primary/app",
					},
					ReadReplicas: tt.replicas,
				},
			}

			inc := metadata.NewInconsistencies()

			got := resolveReplicaURLs(t.Context(), dbMeta, inc, slog.New(slog.DiscardHandler))
			if diff := cmp.Diff(tt.wantURLs, got); diff != "" {
				t.Errorf("urls mismatch (-want +got):\n%s", diff)
			}

			if diff := cmp.Diff(
				tt.wantRecs,
				replicaInconsistencies(inc.Snapshot()),
				cmpopts.IgnoreFields(metadata.Inconsistency{}, "At"),
			); diff != "" {
				t.Errorf("inconsistencies mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestNewPostgresConnector_ReadReplicas(t *testing.T) {
	t.Parallel()

	primaryURL := os.Getenv("CONSTELLATION_TEST_READ_REPLICA_PRIMARY_URL")
	replicaURL := os.Getenv("CONSTELLATION_TEST_READ_REPLICA_URL")

	if primaryURL == "" || replicaURL == "" {
		t.Skip("CONSTELLATION_TEST_READ_REPLICA_PRIMARY_URL / _URL are not set")
	}

	dbMeta := &metadata.DatabaseMetadata{
		Name: "default",
		Kind: "postgres",
		Configuration: metadata.DatabaseConfiguration{
			ConnectionInfo: metadata.DatabaseConnectionInfo{
				DatabaseURL: metadata.EnvString(primaryURL),
			},
			ReadReplicas: []metadata.DatabaseConnectionInfo{
				{DatabaseURL: metadata.EnvString(replicaURL)},
				{DatabaseURL: "postgres://postgres:postgres@127.0.0.1:1/app?connect_timeout=1"},
			},
		},
	}

	inc := metadata.NewInconsistencies()

	conn, err := newPostgresConnector(t.Context(), dbMeta, inc, slog.New(slog.DiscardHandler))
	if err != nil {
		t.Fatalf("newPostgresConnector: %v", err)
	}
	defer conn.Close()

	got := replicaInconsistencies(inc.Snapshot())
	if len(got) != 1 || got[0].Name != "read_replicas[1]" {
		t.Errorf("want only read_replicas[1] recorded, got %+v", got)
	}

	for _, entry := range inc.Snapshot() {
		if entry.Kind == metadata.InconsistencyKindDatabase {
			t.Errorf("database source was dropped: %+v", entry)
		}
	}
}

func TestNewSQLiteConnector_RecordsReadReplicas(t *testing.T) {
	t.Parallel()

	dbMeta := &metadata.DatabaseMetadata{
		Name: "lite",
		Kind: "sqlite",
		Configuration: metadata.DatabaseConfiguration{
			ConnectionInfo: metadata.DatabaseConnectionInfo{
				DatabaseURL: metadata.EnvString(filepath.Join(t.TempDir(), "lite.db")),
			},
			ReadReplicas: []metadata.DatabaseConnectionInfo{
				{DatabaseURL: "postgres://replica-1/app"},
				{DatabaseURL: "postgres://replica-2/app"},
			},
		},
	}

	inc := metadata.NewInconsistencies()

	conn, err := newSQLiteConnector(t.Context(), dbMeta, inc, slog.New(slog.DiscardHandler))
	if err != nil {
		t.Fatalf("newSQLiteConnector: %v", err)
	}
	defer conn.Close()

	want := []metadata.Inconsistency{
		{
			Kind:   metadata.InconsistencyKindReadReplica,
			Source: "lite",
			Name:   "read_replicas[0]",
			Reason: errReadReplicasNotSupported.Error(),
		},
		{
			Kind:   metadata.InconsistencyKindReadReplica,
			Source: "lite",
			Name:   "read_replicas[1]",
			Reason: errReadReplicasNotSupported.Error(),
		},
	}

	if diff := cmp.Diff(
		want,
		replicaInconsistencies(inc.Snapshot()),
		cmpopts.IgnoreFields(metadata.Inconsistency{}, "At"),
	); diff != "" {
		t.Errorf("inconsistencies mismatch (-want +got):\n%s", diff)
	}
}
