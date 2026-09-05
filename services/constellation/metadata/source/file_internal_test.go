package source

import (
	"bytes"
	"context"
	"errors"
	"testing"

	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

// errLoaderBoom is a test sentinel used to verify loader error propagation.
var errLoaderBoom = errors.New("loader boom")

func TestFileMetadataSource_InitialLoad_LoaderErrorPropagates(t *testing.T) {
	t.Parallel()

	src := newFileMetadataSource(
		"/irrelevant",
		func(_ context.Context, _ string) (*metadata.Metadata, *hasura.Metadata, error) {
			return nil, nil, errLoaderBoom
		},
	)
	defer src.Close()

	meta, err := src.InitialLoad(t.Context())
	if meta != nil {
		t.Errorf("expected nil metadata on loader error, got %+v", meta)
	}

	if !errors.Is(err, errLoaderBoom) {
		t.Fatalf("expected wrapped sentinel error, got %v", err)
	}
}

func TestFileMetadataSource_InitialLoad_LoaderReturnsMetadataPassthrough(t *testing.T) {
	t.Parallel()

	want := &metadata.Metadata{Databases: nil, RemoteSchemas: nil}

	var (
		gotPath  string
		gotCalls int
	)

	src := newFileMetadataSource(
		"/some/path.toml",
		func(_ context.Context, path string) (*metadata.Metadata, *hasura.Metadata, error) {
			gotCalls++
			gotPath = path

			return want, nil, nil
		},
	)
	defer src.Close()

	got, err := src.InitialLoad(t.Context())
	if err != nil {
		t.Fatalf("InitialLoad: %v", err)
	}

	if got != want {
		t.Errorf("InitialLoad metadata = %p, want %p", got, want)
	}

	if gotPath != "/some/path.toml" {
		t.Errorf("loader path = %q, want %q", gotPath, "/some/path.toml")
	}

	if gotCalls != 1 {
		t.Errorf("loader calls = %d, want 1", gotCalls)
	}
}

// TestFileMetadataSource_HasuraSnapshotJSON_StoresMarshaledBytes verifies the
// snapshot held by the file source matches the MarshalHasura output of the
// loader-returned *hasura.Metadata, with resource_version 0 (the file source
// has no hdb_catalog counter).
func TestFileMetadataSource_HasuraSnapshotJSON_StoresMarshaledBytes(t *testing.T) {
	t.Parallel()

	hasuraMeta := &hasura.Metadata{Databases: nil, RemoteSchemas: nil, Unknown: nil}

	want, err := metadata.MarshalHasura(hasuraMeta)
	if err != nil {
		t.Fatalf("MarshalHasura: %v", err)
	}

	src := newFileMetadataSource(
		"/some/path.yaml",
		func(_ context.Context, _ string) (*metadata.Metadata, *hasura.Metadata, error) {
			return &metadata.Metadata{Databases: nil, RemoteSchemas: nil}, hasuraMeta, nil
		},
	)
	defer src.Close()

	if _, err := src.InitialLoad(t.Context()); err != nil {
		t.Fatalf("InitialLoad: %v", err)
	}

	gotRaw, gotVersion := src.HasuraSnapshotJSON()
	if !bytes.Equal(gotRaw, want) {
		t.Errorf("HasuraSnapshotJSON bytes = %q; want %q", gotRaw, want)
	}

	if gotVersion != 0 {
		t.Errorf("HasuraSnapshotJSON version = %d; want 0", gotVersion)
	}
}

// TestFileMetadataSource_HasuraSnapshotJSON_NilWhenLoaderReturnsNoHasura
// covers the TOML / no-snapshot path: when the loader returns a nil
// *hasura.Metadata the source must not store anything and the getter must
// return (nil, 0).
func TestFileMetadataSource_HasuraSnapshotJSON_NilWhenLoaderReturnsNoHasura(t *testing.T) {
	t.Parallel()

	src := newFileMetadataSource(
		"/some/path.toml",
		func(_ context.Context, _ string) (*metadata.Metadata, *hasura.Metadata, error) {
			return &metadata.Metadata{Databases: nil, RemoteSchemas: nil}, nil, nil
		},
	)
	defer src.Close()

	if _, err := src.InitialLoad(t.Context()); err != nil {
		t.Fatalf("InitialLoad: %v", err)
	}

	gotRaw, gotVersion := src.HasuraSnapshotJSON()
	if gotRaw != nil {
		t.Errorf("HasuraSnapshotJSON bytes = %q; want nil", gotRaw)
	}

	if gotVersion != 0 {
		t.Errorf("HasuraSnapshotJSON version = %d; want 0", gotVersion)
	}
}

// TestFileMetadataSource_HasuraSnapshotJSON_NilBeforeLoad ensures the getter
// returns (nil, 0) when called before InitialLoad runs.
func TestFileMetadataSource_HasuraSnapshotJSON_NilBeforeLoad(t *testing.T) {
	t.Parallel()

	src := newFileMetadataSource(
		"/irrelevant",
		func(_ context.Context, _ string) (*metadata.Metadata, *hasura.Metadata, error) {
			return nil, nil, nil
		},
	)
	defer src.Close()

	gotRaw, gotVersion := src.HasuraSnapshotJSON()
	if gotRaw != nil {
		t.Errorf("HasuraSnapshotJSON bytes = %q; want nil", gotRaw)
	}

	if gotVersion != 0 {
		t.Errorf("HasuraSnapshotJSON version = %d; want 0", gotVersion)
	}
}
