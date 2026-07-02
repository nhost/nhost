package connector

import (
	"context"
	"fmt"
	"sync"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// CatalogPool is the single, shared PostgreSQL connection pool for Hasura
// catalog-backed runtime state. Today the only consumer is the asynchronous
// action log, but event triggers, cron triggers, and scheduled events are
// meant to reuse the same pool rather than each opening their own.
//
// It is owned by the serving process (created once, closed at shutdown) and
// opened lazily on first use, so the connector rebuild that runs on every
// metadata reload reuses one pool instead of churning a fresh one each time.
// The zero value is not usable; construct it with NewCatalogPool.
type CatalogPool struct {
	explicitURL string
	metadataURL string

	mu   sync.Mutex
	pool *pgxpool.Pool
}

// NewCatalogPool returns a lazily-initialised catalog pool. explicitURL is the
// operator-provided --catalog-database-url (may be empty) and metadataURL is
// the Hasura metadata database URL used as the default. When both are empty the
// pool resolves to the first Postgres source in metadata on the first Get.
func NewCatalogPool(explicitURL, metadataURL string) *CatalogPool {
	return &CatalogPool{ //nolint:exhaustruct
		explicitURL: explicitURL,
		metadataURL: metadataURL,
	}
}

// Get returns the shared pool, opening it on the first successful call and
// caching it for every later call (including after a metadata reload). meta is
// only used for the first-Postgres-source fallback when neither an explicit nor
// a metadata database URL is configured; errors are not cached, so a reload
// that finally provides a usable source can still open the pool.
func (c *CatalogPool) Get(ctx context.Context, meta *metadata.Metadata) (*pgxpool.Pool, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.pool != nil {
		return c.pool, nil
	}

	url, err := resolveCatalogDatabaseURL(c.explicitURL, c.metadataURL, meta)
	if err != nil {
		return nil, err
	}

	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("creating catalog database pool: %w", err)
	}

	c.pool = pool

	return pool, nil
}

// Close releases the shared pool. It is safe to call when the pool was never
// opened and idempotent across repeated calls.
func (c *CatalogPool) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.pool != nil {
		c.pool.Close()
		c.pool = nil
	}
}
