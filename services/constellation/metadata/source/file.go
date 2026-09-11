package source

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"

	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

// metadataLoader is the minimal filesystem surface FileMetadataSource needs.
// Extracted so tests can substitute a fake (see file_internal_test.go). The
// second return value is the Hasura wire form when the path resolved to a
// Hasura YAML directory layout; nil for TOML paths.
type metadataLoader func(
	ctx context.Context, path string,
) (*metadata.Metadata, *hasura.Metadata, error)

// FileMetadataSource loads metadata from a file path once.
type FileMetadataSource struct {
	path       string
	loader     metadataLoader
	hasuraJSON atomic.Pointer[[]byte]
	ch         chan metadata.Update
	closeOnce  sync.Once
}

// NewFileMetadataSource creates a source that loads metadata from a file.
func NewFileMetadataSource(path string) *FileMetadataSource {
	return newFileMetadataSource(path, metadata.FromDetectWithHasura)
}

// newFileMetadataSource builds the source over an arbitrary metadataLoader.
// Used by tests through a fake loader; not exported because the loader type
// is internal.
func newFileMetadataSource(path string, loader metadataLoader) *FileMetadataSource {
	return &FileMetadataSource{
		path:       path,
		loader:     loader,
		hasuraJSON: atomic.Pointer[[]byte]{},
		ch:         make(chan metadata.Update),
		closeOnce:  sync.Once{},
	}
}

// InitialLoad reads metadata from the configured file path.
func (s *FileMetadataSource) InitialLoad(
	ctx context.Context,
) (*metadata.Metadata, error) {
	meta, h, err := s.loader(ctx, s.path)
	if err != nil {
		return nil, fmt.Errorf("loading metadata from file: %w", err)
	}

	if h != nil {
		raw, err := metadata.MarshalHasura(h)
		if err != nil {
			return nil, fmt.Errorf("serializing metadata for snapshot: %w", err)
		}

		s.hasuraJSON.Store(&raw)
	}

	return meta, nil
}

// Watch returns the channel since file-based metadata has no reloads.
func (s *FileMetadataSource) Watch(_ context.Context) <-chan metadata.Update {
	return s.ch
}

// HasuraSnapshotJSON returns the Hasura wire form (re-marshaled at load time)
// retained from the last InitialLoad. For TOML-sourced paths the snapshot is
// nil. The resource_version is always 0 for file sources since there is no
// hdb_catalog.hdb_metadata-style counter.
//
// Fidelity caveat: the snapshot is a best-effort inspection view, NOT a
// lossless inverse of the source YAML. Top-level keys the in-memory model
// does not capture (e.g. actions, cron_triggers, event_triggers) are
// dropped; `columns: "*"` may round-trip as a list; `,omitempty` on int/bool
// scalars (timeout_seconds, forward_client_headers) is a no-op in json/v2 so
// absent fields export as zero values. Downstream callers needing the
// authored metadata verbatim should read the source file directly — file
// sources do not interoperate with Hasura's metadata API contract beyond
// what is reconstructable from the recognised in-memory fields.
func (s *FileMetadataSource) HasuraSnapshotJSON() ([]byte, int64) {
	if raw := s.hasuraJSON.Load(); raw != nil {
		return *raw, 0
	}

	return nil, 0
}

// Close closes the update channel. Safe to call multiple times.
func (s *FileMetadataSource) Close() {
	s.closeOnce.Do(func() { close(s.ch) })
}
