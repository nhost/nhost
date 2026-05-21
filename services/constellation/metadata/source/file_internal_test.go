package source

import (
	"context"
	"errors"
	"testing"

	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestFileMetadataSource_InitialLoad_LoaderErrorPropagates(t *testing.T) {
	t.Parallel()

	sentinel := errors.New("loader boom")

	src := newFileMetadataSource(
		"/irrelevant",
		func(_ context.Context, _ string) (*metadata.Metadata, error) {
			return nil, sentinel
		},
	)
	defer src.Close()

	meta, err := src.InitialLoad(t.Context())
	if meta != nil {
		t.Errorf("expected nil metadata on loader error, got %+v", meta)
	}

	if !errors.Is(err, sentinel) {
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
		func(_ context.Context, path string) (*metadata.Metadata, error) {
			gotCalls++
			gotPath = path

			return want, nil
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
