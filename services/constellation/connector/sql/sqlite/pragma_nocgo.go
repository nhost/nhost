//go:build !cgo

package sqlite

import sqlite3 "github.com/mattn/go-sqlite3"

func execConnectionPragma(_ *sqlite3.SQLiteConn, _ string) error {
	// The Nhost CLI imports Constellation schema-building code but is built with
	// CGO disabled for static cross-platform artifacts. go-sqlite3's no-CGO stub
	// exposes SQLiteConn without Exec, and SQLite cannot open at runtime in that
	// mode anyway, so this path exists only to keep no-CGO CLI builds compiling.
	return nil
}
