//nolint:testpackage // PostgreSQL integration tests exercise the package-private source boundary.
package pgmigrate

import (
	"bytes"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
	"testing"

	"github.com/lib/pq"
)

func TestCatalogSourceTraversesAndReadsUncappedFutureRows(t *testing.T) {
	t.Parallel()

	database := openCatalogTestDatabase(t)
	schema := createCatalogTestSchema(t, database, "")

	catalog := sqlCatalogForTest(t, database, schema)
	if err := catalog.bootstrap(); err != nil {
		t.Fatalf("bootstrap() error = %v", err)
	}

	older := testBundle(
		testMigration(1, nil, "first"),
		testMigration(5, uintPointer(1), "fifth"),
	)

	newer := testBundle(
		testMigration(1, nil, "first"),
		testMigration(5, uintPointer(1), "fifth"),
		testMigration(20, uintPointer(5), "future"),
	)
	if err := catalog.publish(newer); err != nil {
		t.Fatalf("publish(newer) error = %v", err)
	}

	if err := catalog.publish(older); err != nil {
		t.Fatalf("publish(older) error = %v", err)
	}

	driver := newCatalogSource(catalog)

	first, err := driver.First()
	if err != nil {
		t.Fatalf("First() error = %v", err)
	}

	if first != 1 {
		t.Fatalf("First() = %d, want 1", first)
	}

	next, err := driver.Next(5)
	if err != nil {
		t.Fatalf("Next(5) error = %v", err)
	}

	if next != 20 {
		t.Fatalf("Next(5) = %d, want uncapped future version 20", next)
	}

	previous, err := driver.Prev(20)
	if err != nil {
		t.Fatalf("Prev(20) error = %v", err)
	}

	if previous != 5 {
		t.Fatalf("Prev(20) = %d, want 5", previous)
	}

	future := newer.migrations[2]

	gotDown, identifier := readCatalogSourceBody(t, driver.ReadDown, 20)
	if !bytes.Equal(gotDown, future.downSQL) {
		t.Fatalf("ReadDown(20) body = %q, want %q", gotDown, future.downSQL)
	}

	if identifier != future.identifier {
		t.Fatalf("ReadDown(20) identifier = %q, want %q", identifier, future.identifier)
	}

	gotUp, identifier := readCatalogSourceBody(t, driver.ReadUp, 20)
	if !bytes.Equal(gotUp, future.upSQL) {
		t.Fatalf("ReadUp(20) body = %q, want %q", gotUp, future.upSQL)
	}

	if identifier != future.identifier {
		t.Fatalf("ReadUp(20) identifier = %q, want %q", identifier, future.identifier)
	}
}

func TestCatalogSourceRejectsDatabaseBodyCorruption(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		mutate func(*testing.T, *sql.DB, string)
		read   func(*catalogSource, uint) (io.ReadCloser, string, error)
		issue  string
	}{
		{
			name: "blank up body",
			mutate: func(t *testing.T, database *sql.DB, relation string) {
				t.Helper()
				updateCatalogForTest(t, database, relation, "up_sql", []byte(" \n\t"), 5)
			},
			read: func(driver *catalogSource, version uint) (io.ReadCloser, string, error) {
				return driver.ReadUp(version)
			},
			issue: "up migration body is blank",
		},
		{
			name: "blank down body",
			mutate: func(t *testing.T, database *sql.DB, relation string) {
				t.Helper()
				updateCatalogForTest(t, database, relation, "down_sql", []byte(" \r\n"), 5)
			},
			read: func(driver *catalogSource, version uint) (io.ReadCloser, string, error) {
				return driver.ReadDown(version)
			},
			issue: "down migration body is blank",
		},
		{
			name: "changed content",
			mutate: func(t *testing.T, database *sql.DB, relation string) {
				t.Helper()
				updateCatalogForTest(
					t,
					database,
					relation,
					"up_sql",
					[]byte("SELECT 'tampered';"),
					5,
				)
			},
			read: func(driver *catalogSource, version uint) (io.ReadCloser, string, error) {
				return driver.ReadUp(version)
			},
			issue: "up checksum does not match",
		},
		{
			name: "bad hash",
			mutate: func(t *testing.T, database *sql.DB, relation string) {
				t.Helper()
				updateCatalogForTest(t, database, relation, "down_sha256", bytesOfLength(32, 9), 5)
			},
			read: func(driver *catalogSource, version uint) (io.ReadCloser, string, error) {
				return driver.ReadDown(version)
			},
			issue: "down checksum does not match",
		},
		{
			name: "unsupported format",
			mutate: func(t *testing.T, database *sql.DB, relation string) {
				t.Helper()
				updateCatalogForTest(t, database, relation, "format_version", int64(2), 5)
			},
			read: func(driver *catalogSource, version uint) (io.ReadCloser, string, error) {
				return driver.ReadUp(version)
			},
			issue: "unsupported catalog format",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			database := openCatalogTestDatabase(t)
			schema := createCatalogTestSchema(t, database, "")

			catalog := sqlCatalogForTest(t, database, schema)
			if err := catalog.bootstrap(); err != nil {
				t.Fatalf("bootstrap() error = %v", err)
			}

			local := testBundle(
				testMigration(1, nil, "first"),
				testMigration(5, uintPointer(1), "fifth"),
			)
			if err := catalog.publish(local); err != nil {
				t.Fatalf("publish() error = %v", err)
			}

			tt.mutate(t, database, catalogTestRelation(schema))
			reader, identifier, err := tt.read(newCatalogSource(catalog), 5)
			assertHardIntegrityError(t, reader, identifier, err, tt.issue)
		})
	}
}

func TestCatalogSourceRejectsBrokenDatabaseChains(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		mutate func(*testing.T, *sql.DB, string)
		call   func(*catalogSource) error
		issue  string
	}{
		{
			name: "missing predecessor",
			mutate: func(t *testing.T, database *sql.DB, relation string) {
				t.Helper()
				execCatalogDDLForTest(
					t,
					database,
					relation,
					"ALTER TABLE %s DROP CONSTRAINT schema_migration_catalog_previous_version_fkey",
				)
				updateCatalogForTest(t, database, relation, "previous_version", int64(99), 10)
			},
			call: func(driver *catalogSource) error {
				_, err := driver.Prev(10)
				return err
			},
			issue: "missing predecessor",
		},
		{
			name: "multiple roots",
			mutate: func(t *testing.T, database *sql.DB, relation string) {
				t.Helper()

				rootIndex := strings.TrimSuffix(relation, pq.QuoteIdentifier(catalogTableName)) +
					pq.QuoteIdentifier("schema_migration_catalog_one_root")
				execCatalogDDLForTest(t, database, rootIndex, "DROP INDEX %s")
				updateCatalogForTest(t, database, relation, "previous_version", nil, 10)
			},
			call: func(driver *catalogSource) error {
				_, err := driver.First()
				return err
			},
			issue: "multiple roots",
		},
		{
			name: "multiple successors",
			mutate: func(t *testing.T, database *sql.DB, relation string) {
				t.Helper()
				execCatalogDDLForTest(
					t,
					database,
					relation,
					"ALTER TABLE %s DROP CONSTRAINT schema_migration_catalog_previous_version_key",
				)

				additional := storedMigrationFrom(
					testMigration(20, uintPointer(1), "another_successor"),
				)
				insertStoredMigration(t, database, relation, additional)
			},
			call: func(driver *catalogSource) error {
				_, err := driver.Next(1)
				return err
			},
			issue: "multiple successors",
		},
		{
			name: "chain without root",
			mutate: func(t *testing.T, database *sql.DB, relation string) {
				t.Helper()
				updateCatalogForTest(t, database, relation, "previous_version", int64(10), 1)
			},
			call: func(driver *catalogSource) error {
				_, err := driver.First()
				return err
			},
			issue: "has no root",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			database := openCatalogTestDatabase(t)
			schema := createCatalogTestSchema(t, database, "")

			catalog := sqlCatalogForTest(t, database, schema)
			if err := catalog.bootstrap(); err != nil {
				t.Fatalf("bootstrap() error = %v", err)
			}

			local := testBundle(
				testMigration(1, nil, "first"),
				testMigration(10, uintPointer(1), "tenth"),
			)
			if err := catalog.publish(local); err != nil {
				t.Fatalf("publish() error = %v", err)
			}

			tt.mutate(t, database, catalogTestRelation(schema))
			err := tt.call(newCatalogSource(catalog))
			assertHardIntegrityError(t, nil, "", err, tt.issue)
		})
	}
}

func TestCatalogSourceMissingBodiesAreNotNoOpMigrations(t *testing.T) {
	t.Parallel()

	database := openCatalogTestDatabase(t)
	schema := createCatalogTestSchema(t, database, "")

	catalog := sqlCatalogForTest(t, database, schema)
	if err := catalog.bootstrap(); err != nil {
		t.Fatalf("bootstrap() error = %v", err)
	}

	driver := newCatalogSource(catalog)
	reader, identifier, err := driver.ReadUp(404)
	assertHardIntegrityError(t, reader, identifier, err, "catalog row is missing")

	reader, identifier, err = driver.ReadDown(404)
	assertHardIntegrityError(t, reader, identifier, err, "catalog row is missing")
}

func readCatalogSourceBody(
	t *testing.T,
	read func(uint) (io.ReadCloser, string, error),
	version uint,
) ([]byte, string) {
	t.Helper()

	reader, identifier, err := read(version)
	if err != nil {
		t.Fatalf("reading migration %d: %v", version, err)
	}

	defer func() {
		if closeErr := reader.Close(); closeErr != nil {
			t.Errorf("reader.Close() error = %v", closeErr)
		}
	}()

	body, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("io.ReadAll() error = %v", err)
	}

	return body, identifier
}

func assertHardIntegrityError(
	t *testing.T,
	reader io.ReadCloser,
	identifier string,
	err error,
	issue string,
) {
	t.Helper()

	if err == nil {
		t.Fatal("source operation error = nil")
	}

	if reader != nil {
		t.Fatalf("source operation reader = %v, want nil", reader)
	}

	if identifier != "" {
		t.Fatalf("source operation identifier = %q, want empty", identifier)
	}

	if errors.Is(err, os.ErrNotExist) {
		t.Fatalf("source operation error = %v, must not be os.ErrNotExist", err)
	}

	var integrityErr *IntegrityError
	if !errors.As(err, &integrityErr) {
		t.Fatalf("source operation error = %v (%T), want *IntegrityError", err, err)
	}

	if !strings.Contains(integrityErr.Issue, issue) {
		t.Fatalf("source operation issue = %q, want %q", integrityErr.Issue, issue)
	}
}

func updateCatalogForTest(
	t *testing.T,
	database *sql.DB,
	relation string,
	column string,
	value any,
	version int64,
) {
	t.Helper()

	allowedColumns := map[string]struct{}{
		"down_sha256":      {},
		"down_sql":         {},
		"format_version":   {},
		"previous_version": {},
		"up_sha256":        {},
		"up_sql":           {},
	}
	if _, allowed := allowedColumns[column]; !allowed {
		t.Fatalf("test attempted to update disallowed catalog column %q", column)
	}

	query := fmt.Sprintf( //nolint:gosec // relation is quoted and column is checked against the allowlist.
		"UPDATE %s SET %s = $1 WHERE version = $2",
		relation,
		pq.QuoteIdentifier(column),
	)
	if _, err := database.ExecContext(t.Context(), query, value, version); err != nil {
		t.Fatalf("updating catalog %s: %v", column, err)
	}
}

func execCatalogDDLForTest(
	t *testing.T,
	database *sql.DB,
	relation string,
	statement string,
) {
	t.Helper()

	if strings.Count(statement, "%s") != 1 {
		t.Fatalf("catalog DDL statement must have one relation placeholder: %q", statement)
	}

	query := fmt.Sprintf(statement, relation)
	if _, err := database.ExecContext(t.Context(), query); err != nil {
		t.Fatalf("executing catalog test DDL: %v", err)
	}
}
