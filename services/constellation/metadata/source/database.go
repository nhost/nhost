// Package source provides runtime implementations of metadata.Source —
// either a one-shot file loader or a poller that watches
// hdb_catalog.hdb_metadata in a PostgreSQL database.
package source

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// metadataStore is the minimal pgx surface DatabaseMetadataSource needs,
// extracted so tests can substitute a fake (see fake_store_test.go) instead
// of standing up a real *pgxpool.Pool.
//
// QueryRow executes a single-row query used to fetch the metadata blob and
// its resource version from hdb_catalog.hdb_metadata; the returned pgx.Row
// must support Scan and surface pgx.ErrNoRows when the row is absent.
// Close releases pool resources and must be safe to call multiple times;
// DatabaseMetadataSource guards its own invocation with sync.Once.
type metadataStore interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Close()
}

// pgxPoolStore adapts *pgxpool.Pool to metadataStore.
type pgxPoolStore struct {
	pool *pgxpool.Pool
}

// QueryRow returns pgx.Row to satisfy the metadataStore interface; the
// ireturn suppressor is required because the interface dictates the return
// type, and nolintlint is paired with it to silence the meta-linter on the
// same line — both directives share the single goal of accepting the
// boundary interface return.
func (s pgxPoolStore) QueryRow( //nolint:ireturn,nolintlint
	ctx context.Context,
	sql string,
	args ...any,
) pgx.Row {
	return s.pool.QueryRow(ctx, sql, args...)
}

func (s pgxPoolStore) Close() {
	s.pool.Close()
}

// DatabaseMetadataSource polls hdb_catalog.hdb_metadata for version changes.
//
// resourceVersion is an atomic because it is written by InitialLoad (caller
// goroutine) and read/written by poll (Watch goroutine); the atomic keeps
// access race-free regardless of call ordering.
type DatabaseMetadataSource struct {
	store           metadataStore
	resourceVersion atomic.Int64
	pollInterval    time.Duration
	logger          *slog.Logger

	done      chan struct{}
	closeOnce sync.Once
}

// NewDatabaseMetadataSource creates a source that reads metadata from a
// PostgreSQL database and polls for version changes at the given interval.
func NewDatabaseMetadataSource(
	ctx context.Context,
	databaseURL string,
	pollInterval time.Duration,
	logger *slog.Logger,
) (*DatabaseMetadataSource, error) {
	pool, err := newMetadataPool(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("creating metadata pool: %w", err)
	}

	return newDatabaseMetadataSource(pgxPoolStore{pool: pool}, pollInterval, logger), nil
}

// newDatabaseMetadataSource builds the source over an arbitrary metadataStore.
// Used by tests through a mock; not exported because the store interface is
// internal.
func newDatabaseMetadataSource(
	store metadataStore,
	pollInterval time.Duration,
	logger *slog.Logger,
) *DatabaseMetadataSource {
	return &DatabaseMetadataSource{
		store:           store,
		resourceVersion: atomic.Int64{},
		pollInterval:    pollInterval,
		logger:          logger,
		done:            make(chan struct{}),
		closeOnce:       sync.Once{},
	}
}

// InitialLoad performs the first synchronous metadata load from the database.
func (s *DatabaseMetadataSource) InitialLoad(
	ctx context.Context,
) (*metadata.Metadata, error) {
	meta, version, err := loadMetadataFromStore(ctx, s.store)
	if err != nil {
		return nil, fmt.Errorf("loading metadata from database: %w", err)
	}

	s.resourceVersion.Store(version)

	return meta, nil
}

// Watch polls for version changes and sends reloads on the returned channel.
// The channel is closed when ctx is cancelled or Close is called.
//
// Watch must be called exactly once, after InitialLoad has established the
// starting resource version. Spawning a second concurrent poller is not a
// supported use; resourceVersion access is atomic so it stays race-free
// regardless, but multiple pollers would emit redundant reloads.
func (s *DatabaseMetadataSource) Watch(ctx context.Context) <-chan metadata.Update {
	ch := make(chan metadata.Update)

	go func() {
		defer close(ch)

		ticker := time.NewTicker(s.pollInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				if update := s.poll(ctx); update != nil {
					select {
					case ch <- *update:
					case <-ctx.Done():
						return
					case <-s.done:
						return
					}
				}
			case <-ctx.Done():
				return
			case <-s.done:
				return
			}
		}
	}()

	return ch
}

// Close cancels any active Watch goroutines and closes the underlying store.
// Safe to call multiple times.
func (s *DatabaseMetadataSource) Close() {
	s.closeOnce.Do(func() {
		close(s.done)
		s.store.Close()
	})
}

func (s *DatabaseMetadataSource) poll(ctx context.Context) *metadata.Update {
	version, err := fetchResourceVersion(ctx, s.store)
	if err != nil {
		s.logger.ErrorContext(
			ctx, "failed to fetch metadata resource version", "error", err,
		)

		return nil
	}

	if version == s.resourceVersion.Load() {
		return nil
	}

	s.logger.InfoContext(ctx, "metadata version changed, reloading",
		slog.Int64("old_version", s.resourceVersion.Load()),
		slog.Int64("new_version", version),
	)

	meta, resourceVersion, err := loadMetadataFromStore(ctx, s.store)
	if err != nil {
		return &metadata.Update{Metadata: nil, Err: err}
	}

	s.resourceVersion.Store(resourceVersion)

	return &metadata.Update{Metadata: meta, Err: nil}
}

// newMetadataPool creates a small persistent connection pool for polling
// hdb_catalog.hdb_metadata. MaxConns is set to 2 so the pool is lightweight.
func newMetadataPool(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parsing metadata database URL: %w", err)
	}

	const maxConns = 2

	cfg.MaxConns = maxConns

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("creating metadata pool: %w", err)
	}

	return pool, nil
}

func fetchResourceVersion(ctx context.Context, store metadataStore) (int64, error) {
	var version int64

	err := store.QueryRow(
		ctx,
		"SELECT resource_version FROM hdb_catalog.hdb_metadata WHERE id = 1",
	).Scan(&version)
	if err != nil {
		return 0, fmt.Errorf("fetching resource_version: %w", err)
	}

	return version, nil
}

func loadMetadataFromStore(
	ctx context.Context, store metadataStore,
) (*metadata.Metadata, int64, error) {
	var (
		metadataJSON []byte
		version      int64
	)

	err := store.QueryRow(
		ctx,
		"SELECT metadata, resource_version FROM hdb_catalog.hdb_metadata WHERE id = 1",
	).Scan(&metadataJSON, &version)
	if err != nil {
		return nil, 0, fmt.Errorf("querying hdb_catalog.hdb_metadata: %w", err)
	}

	meta, err := metadata.FromHasuraJSON(metadataJSON)
	if err != nil {
		return nil, 0, fmt.Errorf("parsing metadata JSON: %w", err)
	}

	return meta, version, nil
}
