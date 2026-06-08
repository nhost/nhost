package source

import (
	"context"
	"fmt"
	"sync"

	"github.com/nhost/nhost/services/constellation/metadata"
)

// metadataLoader is the minimal filesystem surface FileMetadataSource needs.
// Extracted so tests can substitute a fake (see file_internal_test.go).
type metadataLoader func(ctx context.Context, path string) (*metadata.Metadata, error)

// FileMetadataSource loads metadata from a file path once.
type FileMetadataSource struct {
	path      string
	loader    metadataLoader
	ch        chan metadata.Update
	closeOnce sync.Once
	writeMu   sync.Mutex
}

// NewFileMetadataSource creates a source that loads metadata from a file.
func NewFileMetadataSource(path string) *FileMetadataSource {
	return newFileMetadataSource(path, metadata.FromDetect)
}

// newFileMetadataSource builds the source over an arbitrary metadataLoader.
// Used by tests through a fake loader; not exported because the loader type
// is internal.
func newFileMetadataSource(path string, loader metadataLoader) *FileMetadataSource {
	return &FileMetadataSource{
		path:      path,
		loader:    loader,
		ch:        make(chan metadata.Update),
		closeOnce: sync.Once{},
		writeMu:   sync.Mutex{},
	}
}

// InitialLoad reads metadata from the configured file path.
func (s *FileMetadataSource) InitialLoad(
	ctx context.Context,
) (*metadata.Metadata, error) {
	meta, err := s.loader(ctx, s.path)
	if err != nil {
		return nil, fmt.Errorf("loading metadata from file: %w", err)
	}

	return meta, nil
}

// Watch returns the channel since file-based metadata has no reloads.
func (s *FileMetadataSource) Watch(_ context.Context) <-chan metadata.Update {
	return s.ch
}

// Close closes the update channel. Safe to call multiple times.
func (s *FileMetadataSource) Close() {
	s.closeOnce.Do(func() { close(s.ch) })
}
