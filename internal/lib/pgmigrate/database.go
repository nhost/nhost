package pgmigrate

import (
	"context"
	"database/sql"
)

// Database is the caller-owned connection pool used by PostgreSQL migrations.
// The package acquires dedicated connections but never closes the pool.
//
//go:generate mockgen -package mock -destination mock/database.go . Database
type Database interface {
	Conn(ctx context.Context) (*sql.Conn, error)
}
