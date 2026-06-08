//go:build cgo

package sqlite

import (
	"fmt"

	sqlite3 "github.com/mattn/go-sqlite3"
)

func execConnectionPragma(conn *sqlite3.SQLiteConn, pragma string) error {
	_, err := conn.Exec(pragma, nil)
	if err != nil {
		return fmt.Errorf("executing sqlite connection pragma: %w", err)
	}

	return nil
}
