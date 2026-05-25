package source_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/nhost/nhost/services/constellation/metadata/source"
)

func TestFileMetadataSource_InitialLoad_ReadsToml(t *testing.T) {
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

	src := source.NewFileMetadataSource(tomlPath)
	defer src.Close()

	meta, err := src.InitialLoad(t.Context())
	if err != nil {
		t.Fatalf("InitialLoad: %v", err)
	}

	if len(meta.Databases) != 1 || meta.Databases[0].Name != "default" {
		t.Errorf("unexpected metadata: %+v", meta)
	}
}

func TestFileMetadataSource_InitialLoad_MissingFile(t *testing.T) {
	t.Parallel()

	src := source.NewFileMetadataSource("/does/not/exist.toml")
	defer src.Close()

	if _, err := src.InitialLoad(t.Context()); err == nil {
		t.Fatal("expected error for missing file, got nil")
	}
}

func TestFileMetadataSource_Watch_ChannelClosesOnClose(t *testing.T) {
	t.Parallel()

	src := source.NewFileMetadataSource("/irrelevant")

	ch := src.Watch(t.Context())

	src.Close()

	if _, ok := <-ch; ok {
		t.Error("expected channel to be closed after Close")
	}
}

func TestFileMetadataSource_Close_Idempotent(t *testing.T) {
	t.Parallel()

	src := source.NewFileMetadataSource("/irrelevant")

	src.Close()
	src.Close() // must not panic
}
