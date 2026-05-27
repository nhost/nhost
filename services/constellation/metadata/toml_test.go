package metadata_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// TestMarshalTOML_RoundTripsThroughFromDetect exercises the public API path:
// marshal to TOML, write to disk, parse back via FromDetect.
func TestMarshalTOML_RoundTripsThroughFromDetect(t *testing.T) {
	t.Parallel()

	original := &metadata.Metadata{
		Databases: []metadata.DatabaseMetadata{
			{
				Name: "default",
				Kind: "postgres",
				Configuration: metadata.DatabaseConfiguration{
					ConnectionInfo: metadata.DatabaseConnectionInfo{
						DatabaseURL: "postgres://localhost/db",
					},
				},
				Tables: []metadata.TableMetadata{
					{
						Table:               metadata.TableSource{Name: "users", Schema: "auth"},
						IsEnum:              false,
						Configuration:       metadata.TableConfiguration{},
						ObjectRelationships: nil,
						ArrayRelationships:  nil,
						RemoteRelationships: nil,
						SelectPermissions:   nil,
						InsertPermissions:   nil,
						UpdatePermissions:   nil,
						DeletePermissions:   nil,
					},
				},
				Functions: nil,
			},
		},
		RemoteSchemas: nil,
	}

	data, err := metadata.MarshalTOML(original)
	if err != nil {
		t.Fatalf("MarshalTOML: %v", err)
	}

	path := filepath.Join(t.TempDir(), "meta.toml")

	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatalf("writing toml: %v", err)
	}

	got, err := metadata.FromDetect(t.Context(), path)
	if err != nil {
		t.Fatalf("FromDetect: %v", err)
	}

	if diff := cmp.Diff(original, got, cmpopts.EquateEmpty()); diff != "" {
		t.Errorf("public round-trip mismatch (-want +got):\n%s", diff)
	}
}
