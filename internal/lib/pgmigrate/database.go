package pgmigrate

import (
	"context"
	"database/sql"
)

// Database is the caller-owned, dedicated connection pool used by PostgreSQL
// migrations. The package acquires and releases connections but never closes
// the pool. Sharing a long-lived application pool is unsupported.
//
//go:generate mockgen -package mock -destination mock/database.go . Database
type Database interface {
	Conn(ctx context.Context) (*sql.Conn, error)
}
