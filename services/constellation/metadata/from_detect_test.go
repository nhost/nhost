package metadata_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestFromDetect_TOMLBranch(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	tomlPath := filepath.Join(dir, "meta.toml")

	const body = `
[[databases]]
name = "default"
kind = "postgres"

[databases.configuration.connection_info]
database_url = "postgres://localhost/db"
`

	if err := os.WriteFile(tomlPath, []byte(body), 0o600); err != nil {
		t.Fatalf("writing temp file: %v", err)
	}

	meta, err := metadata.FromDetect(t.Context(), tomlPath)
	if err != nil {
		t.Fatalf("FromDetect: %v", err)
	}

	if len(meta.Databases) != 1 || meta.Databases[0].Name != "default" {
		t.Errorf("unexpected metadata: %+v", meta)
	}
}

func TestFromDetect_NonTOMLFallsThroughToHasuraYAML(t *testing.T) {
	t.Parallel()

	// Passing a non-existent .yaml path should attempt the Hasura YAML loader
	// and surface its read error rather than the TOML one.
	_, err := metadata.FromDetect(t.Context(), "/does/not/exist.yaml")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}
