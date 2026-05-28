package metadata

import "context"

// Update carries either successfully loaded metadata or an error.
// HasuraJSON and ResourceVersion are populated alongside Metadata when the
// underlying source loaded the data in Hasura form (database source or YAML
// directory layout). For TOML-sourced metadata HasuraJSON is nil and
// ResourceVersion is 0.
type Update struct {
	Metadata        *Metadata
	HasuraJSON      []byte
	ResourceVersion int64
	Err             error
}

//go:generate mockgen -package mock -destination mock/source.go . Source

// Source provides metadata to the controller. InitialLoad performs the
// first synchronous load. Watch returns a channel that delivers subsequent
// reloads; the channel is closed when Close is called or ctx is cancelled.
//
// HasuraSnapshotJSON returns the most recent Hasura wire form serialized as
// the v3 JSON envelope, along with its resource_version. Used by
// /v1/metadata's `export_metadata` op. Implementations that have never
// loaded Hasura-format metadata (e.g. a file source backed by TOML) return
// (nil, 0). The byte slice is intentionally untyped here so callers in
// other parts of the tree do not need to import the internal hasura
// package; the source pre-marshals via the engine's MarshalHasura.
type Source interface {
	InitialLoad(ctx context.Context) (*Metadata, error)
	Watch(ctx context.Context) <-chan Update
	HasuraSnapshotJSON() ([]byte, int64)
	Close()
}
