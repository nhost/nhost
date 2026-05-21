package metadata

import "context"

// Update carries either successfully loaded metadata or an error.
type Update struct {
	Metadata *Metadata
	Err      error
}

//go:generate mockgen -package mock -destination mock/source.go . Source

// Source provides metadata to the controller. InitialLoad performs the
// first synchronous load. Watch returns a channel that delivers subsequent
// reloads; the channel is closed when Close is called or ctx is cancelled.
type Source interface {
	InitialLoad(ctx context.Context) (*Metadata, error)
	Watch(ctx context.Context) <-chan Update
	Close()
}
