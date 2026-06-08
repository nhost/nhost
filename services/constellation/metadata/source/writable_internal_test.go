package source

import (
	"context"
	json "encoding/json/v2"
	"path/filepath"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/nhost/nhost/services/constellation/metadata"
)

type writableFakeStore struct {
	currentJSON []byte
	version     int64
	updatedJSON []byte
	newVersion  int64
}

func TestFileMetadataSourceReplaceMetadataWritesTOML(t *testing.T) {
	t.Parallel()

	path := filepath.Join(t.TempDir(), "metadata.toml")

	src := NewFileMetadataSource(path)
	defer src.Close()

	if err := src.ReplaceMetadata(t.Context(), writableTestMetadata()); err != nil {
		t.Fatalf("ReplaceMetadata: %v", err)
	}

	loaded, err := src.InitialLoad(t.Context())
	if err != nil {
		t.Fatalf("InitialLoad: %v", err)
	}

	if len(loaded.Actions) != 1 || loaded.Actions[0].Name != "hello" {
		t.Fatalf("loaded actions = %+v, want hello", loaded.Actions)
	}
}

func TestDatabaseMetadataSourceReplaceMetadataPatchesActionsOnly(t *testing.T) {
	t.Parallel()

	store := &writableFakeStore{
		currentJSON: []byte(`{
			"version": 3,
			"sources": [{"name":"default","kind":"postgres","tables":[]}],
			"actions": [],
			"custom_types": {}
		}`),
		version:     7,
		updatedJSON: nil,
		newVersion:  0,
	}
	src := newDatabaseMetadataSource(store, time.Second, nil)

	if err := src.ReplaceMetadata(t.Context(), writableTestMetadata()); err != nil {
		t.Fatalf("ReplaceMetadata: %v", err)
	}

	if store.newVersion != 8 {
		t.Fatalf("newVersion = %d, want 8", store.newVersion)
	}

	var updated map[string]any
	if err := json.Unmarshal(store.updatedJSON, &updated); err != nil {
		t.Fatalf("updated JSON is invalid: %v", err)
	}

	if _, ok := updated["sources"].([]any); !ok {
		t.Fatalf("sources not preserved in updated metadata: %+v", updated)
	}

	actions, ok := updated["actions"].([]any)
	if !ok || len(actions) != 1 {
		t.Fatalf("updated actions = %#v, want one action", updated["actions"])
	}

	if got := src.resourceVersion.Load(); got != 8 {
		t.Fatalf("resourceVersion = %d, want 8", got)
	}
}

func (s *writableFakeStore) QueryRow(_ context.Context, _ string, _ ...any) pgx.Row {
	return fakeRow{dest: []any{s.currentJSON, s.version}, err: nil}
}

func (s *writableFakeStore) Exec(
	_ context.Context,
	_ string,
	args ...any,
) (pgconn.CommandTag, error) {
	data, _ := args[0].([]byte)
	s.updatedJSON = append([]byte(nil), data...)
	s.newVersion, _ = args[1].(int64)

	return pgconn.NewCommandTag("UPDATE 1"), nil
}

func (s *writableFakeStore) Close() {}

func writableTestMetadata() *metadata.Metadata {
	return &metadata.Metadata{
		Databases:     nil,
		RemoteSchemas: nil,
		Actions: []metadata.ActionMetadata{
			{
				Name: "hello",
				Definition: metadata.ActionDefinition{
					Kind:                 metadata.ActionKindSynchronous,
					Handler:              "https://actions.example.test/hello",
					ForwardClientHeaders: false,
					Headers:              nil,
					Timeout:              30,
					Type:                 metadata.ActionOperationQuery,
					Arguments:            nil,
					OutputType:           "HelloOutput!",
					RequestTransform:     nil,
					ResponseTransform:    nil,
				},
				Permissions: nil,
				Comment:     "",
			},
		},
		CustomTypes: metadata.CustomTypes{
			InputObjects: nil,
			Objects: []metadata.CustomObjectType{
				{
					Name:        "HelloOutput",
					Description: "",
					Fields: []metadata.CustomTypeField{
						{Name: "message", Type: "String!", Description: ""},
					},
					Relationships: nil,
				},
			},
			Scalars: nil,
			Enums:   nil,
		},
		LoadDiagnostics: nil,
	}
}
