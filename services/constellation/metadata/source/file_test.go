package source_test

import (
	"encoding/json"
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

func TestFileMetadataSource_HasuraSnapshotJSON_PreservesPreConversionRemoteField(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "databases"), 0o700); err != nil {
		t.Fatalf("creating metadata directory: %v", err)
	}

	const body = `
- name: default
  kind: postgres
  configuration:
    connection_info:
      database_url: postgres://localhost/db
  tables:
    - table:
        name: users
        schema: public
      configuration:
        column_config:
          id:
            custom_name: userId
      remote_relationships:
        - name: profile
          definition:
            to_remote_schema:
              remote_schema: profiles
              lhs_fields:
                - id
              remote_field:
                profile:
                  arguments:
                    id: "$id"
`

	if err := os.WriteFile(
		filepath.Join(dir, "databases", "databases.yaml"),
		[]byte(body),
		0o600,
	); err != nil {
		t.Fatalf("writing databases metadata: %v", err)
	}

	src := source.NewFileMetadataSource(filepath.Join(dir, "metadata.yaml"))
	defer src.Close()

	meta, err := src.InitialLoad(t.Context())
	if err != nil {
		t.Fatalf("InitialLoad: %v", err)
	}

	gotEntry := meta.Databases[0].Tables[0].ObjectRelationships[0].Using.
		ManualConfiguration.RemoteFieldPath[0]
	if got := gotEntry.Arguments["id"]; got != "$userId" {
		t.Fatalf("native remote_field argument = %q, want %q", got, "$userId")
	}

	raw, version := src.HasuraSnapshotJSON()
	if version != 0 {
		t.Fatalf("HasuraSnapshotJSON version = %d, want 0", version)
	}

	type remoteFieldCall struct {
		Arguments map[string]string          `json:"arguments"`
		Field     map[string]remoteFieldCall `json:"field"`
	}

	var snapshot struct {
		Sources []struct {
			Tables []struct {
				RemoteRelationships []struct {
					Definition struct {
						ToRemoteSchema struct {
							LHSFields   []string                   `json:"lhs_fields"`
							RemoteField map[string]remoteFieldCall `json:"remote_field"`
						} `json:"to_remote_schema"`
					} `json:"definition"`
				} `json:"remote_relationships"`
			} `json:"tables"`
		} `json:"sources"`
	}

	if err := json.Unmarshal(raw, &snapshot); err != nil {
		t.Fatalf("unmarshaling snapshot: %v", err)
	}

	toRemoteSchema := snapshot.Sources[0].Tables[0].RemoteRelationships[0].
		Definition.ToRemoteSchema
	if got := toRemoteSchema.LHSFields; len(got) != 1 || got[0] != "id" {
		t.Fatalf("snapshot lhs_fields = %v, want [id]", got)
	}

	if got := toRemoteSchema.RemoteField["profile"].Arguments["id"]; got != "$id" {
		t.Fatalf("snapshot remote_field argument = %q, want %q", got, "$id")
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
