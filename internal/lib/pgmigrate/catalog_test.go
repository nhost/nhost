//nolint:testpackage // PostgreSQL integration tests exercise the package-private catalog boundary.
package pgmigrate

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"slices"
	"strings"
	"sync"
	"testing"

	"github.com/lib/pq"
)

const (
	catalogTestDSNEnvironment              = "PGMIGRATE_TEST_DSN"
	catalogTestDatabaseRequiredEnvironment = "PGMIGRATE_TEST_DATABASE_REQUIRED"
)

var errCatalogTestDatabaseDSNMissing = errors.New(
	"PGMIGRATE_TEST_DATABASE_REQUIRED is set but PGMIGRATE_TEST_DSN is empty",
)

func TestCatalogTestDatabaseDSNRequirement(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name           string
		dsn            string
		requiredMarker string
		wantDSN        string
		wantError      bool
	}{
		{
			name:           "direct test without database skips",
			dsn:            "",
			requiredMarker: "",
			wantDSN:        "",
			wantError:      false,
		},
		{
			name:           "required database without DSN fails",
			dsn:            "",
			requiredMarker: "1",
			wantDSN:        "",
			wantError:      true,
		},
		{
			name:           "required database with DSN runs",
			dsn:            "host=/tmp/postgres dbname=postgres",
			requiredMarker: "1",
			wantDSN:        "host=/tmp/postgres dbname=postgres",
			wantError:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := catalogTestDatabaseDSN(tt.dsn, tt.requiredMarker)
			if (err != nil) != tt.wantError {
				t.Fatalf("catalogTestDatabaseDSN() error = %v, want error %t", err, tt.wantError)
			}

			if got != tt.wantDSN {
				t.Fatalf("catalogTestDatabaseDSN() = %q, want %q", got, tt.wantDSN)
			}
		})
	}
}

//nolint:paralleltest,tparallel // Constraint subtests intentionally mutate one shared catalog serially.
func TestCatalogBootstrapEnforcesDatabaseInvariants(t *testing.T) {
	t.Parallel()

	database := openCatalogTestDatabase(t)
	schema := createCatalogTestSchema(t, database, "")
	catalog := sqlCatalogForTest(t, database, schema)

	if err := catalog.bootstrap(); err != nil {
		t.Fatalf("bootstrap() error = %v", err)
	}

	if err := catalog.bootstrap(); err != nil {
		t.Fatalf("second bootstrap() error = %v", err)
	}

	relation := catalogTestRelation(schema)
	root := testMigration(1, nil, "root")
	child := testMigration(2, uintPointer(1), "child")

	insertStoredMigration(t, database, relation, storedMigrationFrom(root))
	insertStoredMigration(t, database, relation, storedMigrationFrom(child))

	tests := []struct {
		name       string
		constraint string
		run        func() error
	}{
		{
			name:       "one root",
			constraint: "schema_migration_catalog_one_active_root",
			run: func() error {
				migration := storedMigrationFrom(testMigration(3, nil, "another_root"))
				return insertStoredMigrationError(t.Context(), database, relation, migration)
			},
		},
		{
			name:       "one successor",
			constraint: "schema_migration_catalog_active_successor",
			run: func() error {
				migration := storedMigrationFrom(testMigration(3, uintPointer(1), "another_child"))
				return insertStoredMigrationError(t.Context(), database, relation, migration)
			},
		},
		{
			name:       "one active version",
			constraint: "schema_migration_catalog_active_version",
			run: func() error {
				migration := storedMigrationFrom(
					testMigration(2, uintPointer(2), "duplicate_version"),
				)

				return insertStoredMigrationError(t.Context(), database, relation, migration)
			},
		},
		{
			name:       "existing predecessor",
			constraint: "schema_migration_catalog_previous_id_fkey",
			run: func() error {
				// pi-lens-ignore: go-sql-injection
				_, err := database.ExecContext(
					t.Context(),
					fmt.Sprintf(
						"UPDATE %s SET previous_id = gen_random_uuid() WHERE version = $1",
						relation,
					),
					int64(2),
				)
				if err != nil {
					return fmt.Errorf("assigning nonexistent predecessor: %w", err)
				}

				return nil
			},
		},
		{
			name:       "complete archive metadata",
			constraint: "schema_migration_catalog_archive_metadata_check",
			run: func() error {
				// pi-lens-ignore: go-sql-injection
				_, err := database.ExecContext(
					t.Context(),
					fmt.Sprintf(
						"UPDATE %s SET archived_at = CURRENT_TIMESTAMP WHERE version = $1",
						relation,
					),
					int64(2),
				)
				if err != nil {
					return fmt.Errorf("archiving without a batch identifier: %w", err)
				}

				return nil
			},
		},
		{
			name:       "nonempty up SQL",
			constraint: "schema_migration_catalog_up_sql_nonempty",
			run: func() error {
				// pi-lens-ignore: go-sql-injection
				_, err := database.ExecContext(
					t.Context(),
					fmt.Sprintf("UPDATE %s SET up_sql = $1 WHERE version = $2", relation),
					[]byte{},
					int64(2),
				)
				if err != nil {
					return fmt.Errorf("updating up SQL to empty: %w", err)
				}

				return nil
			},
		},
		{
			name:       "nonempty down SQL",
			constraint: "schema_migration_catalog_down_sql_nonempty",
			run: func() error {
				// pi-lens-ignore: go-sql-injection
				_, err := database.ExecContext(
					t.Context(),
					fmt.Sprintf("UPDATE %s SET down_sql = $1 WHERE version = $2", relation),
					[]byte{},
					int64(2),
				)
				if err != nil {
					return fmt.Errorf("updating down SQL to empty: %w", err)
				}

				return nil
			},
		},
		{
			name:       "up checksum length",
			constraint: "schema_migration_catalog_up_sha256_length",
			run: func() error {
				// pi-lens-ignore: go-sql-injection
				_, err := database.ExecContext(
					t.Context(),
					fmt.Sprintf("UPDATE %s SET up_sha256 = $1 WHERE version = $2", relation),
					[]byte("short"),
					int64(2),
				)
				if err != nil {
					return fmt.Errorf("updating up checksum to invalid length: %w", err)
				}

				return nil
			},
		},
		{
			name:       "down checksum length",
			constraint: "schema_migration_catalog_down_sha256_length",
			run: func() error {
				// pi-lens-ignore: go-sql-injection
				_, err := database.ExecContext(
					t.Context(),
					fmt.Sprintf("UPDATE %s SET down_sha256 = $1 WHERE version = $2", relation),
					[]byte("short"),
					int64(2),
				)
				if err != nil {
					return fmt.Errorf("updating down checksum to invalid length: %w", err)
				}

				return nil
			},
		},
		{
			name:       "restricted predecessor deletion",
			constraint: "schema_migration_catalog_previous_id_fkey",
			run: func() error {
				// pi-lens-ignore: go-sql-injection
				_, err := database.ExecContext(
					t.Context(),
					fmt.Sprintf("DELETE FROM %s WHERE version = $1", relation),
					int64(1),
				)
				if err != nil {
					return fmt.Errorf("deleting referenced predecessor: %w", err)
				}

				return nil
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assertCatalogConstraintError(t, tt.run(), tt.constraint)
		})
	}

	var indexDefinition string

	err := database.QueryRowContext(
		t.Context(),
		`SELECT indexdef FROM pg_indexes WHERE schemaname = $1 AND indexname = $2`,
		schema,
		"schema_migration_catalog_one_active_root",
	).Scan(&indexDefinition)
	if err != nil {
		t.Fatalf("querying root index: %v", err)
	}

	if !strings.Contains(
		indexDefinition,
		"WHERE ((archived_at IS NULL) AND (previous_id IS NULL))",
	) {
		t.Fatalf(
			"root index = %q, want PostgreSQL-13-compatible partial predicate",
			indexDefinition,
		)
	}
}

func assertCatalogConstraintError(t *testing.T, err error, constraint string) {
	t.Helper()

	if err == nil {
		t.Fatal("constraint-violating statement error = nil")
	}

	var postgresError *pq.Error
	if !errors.As(err, &postgresError) {
		t.Fatalf("error = %v (%T), want *pq.Error", err, err)
	}

	if postgresError.Constraint != constraint {
		t.Fatalf("constraint = %q, want %q", postgresError.Constraint, constraint)
	}
}

func TestCatalogPublicationIsIdempotentAndAcceptsFutureRows(t *testing.T) {
	t.Parallel()

	database := openCatalogTestDatabase(t)
	schema := createCatalogTestSchema(t, database, `catalog_"quoted`)

	catalog := sqlCatalogForTest(t, database, schema)
	if err := catalog.bootstrap(); err != nil {
		t.Fatalf("bootstrap() error = %v", err)
	}

	older := testBundle(
		testMigration(1, nil, "first"),
		testMigration(5, uintPointer(1), "fifth"),
	)
	if err := catalog.publish(older); err != nil {
		t.Fatalf("publish(older) error = %v", err)
	}

	relation := catalogTestRelation(schema)

	var registeredAt string
	// pi-lens-ignore: go-sql-injection
	if err := database.QueryRowContext(
		t.Context(),
		fmt.Sprintf("SELECT registered_at::text FROM %s WHERE version = $1", relation),
		int64(1),
	).Scan(&registeredAt); err != nil {
		t.Fatalf("querying registration time: %v", err)
	}

	if err := catalog.publish(older); err != nil {
		t.Fatalf("second publish(older) error = %v", err)
	}

	newer := testBundle(
		testMigration(1, nil, "first"),
		testMigration(5, uintPointer(1), "fifth"),
		testMigration(10, uintPointer(5), "future"),
	)
	if err := catalog.publish(newer); err != nil {
		t.Fatalf("publish(newer) error = %v", err)
	}

	// pi-lens-ignore: go-sql-injection
	if _, err := database.ExecContext(
		t.Context(),
		fmt.Sprintf("ALTER TABLE %s ADD COLUMN future_metadata TEXT", relation),
	); err != nil {
		t.Fatalf("adding compatible future column: %v", err)
	}

	if err := catalog.publish(older); err != nil {
		t.Fatalf("publish(older) with future row and column error = %v", err)
	}

	var (
		count             int
		registeredAtAgain string
	)
	if err := database.QueryRowContext(
		t.Context(),
		"SELECT count(*), min(registered_at)::text FROM "+relation,
	).Scan(&count, &registeredAtAgain); err != nil {
		t.Fatalf("querying catalog rows: %v", err)
	}

	if count != 3 {
		t.Fatalf("catalog row count = %d, want 3", count)
	}

	if registeredAtAgain != registeredAt {
		t.Fatalf("root registered_at changed from %q to %q", registeredAt, registeredAtAgain)
	}
}

func TestCatalogReconcileArchivesInactiveSuffixAndReusesVersions(t *testing.T) {
	t.Parallel()

	database := openCatalogTestDatabase(t)
	schema := createCatalogTestSchema(t, database, "")
	catalog := sqlCatalogForTest(t, database, schema)

	if err := catalog.bootstrap(); err != nil {
		t.Fatalf("bootstrap() error = %v", err)
	}

	relation := catalogTestRelation(schema)

	beta := testBundle(
		testMigration(1, nil, "root"),
		testMigration(2, uintPointer(1), "beta_name"),
		testMigration(3, uintPointer(2), "beta_enabled"),
	)
	if err := catalog.reconcile(beta, -1); err != nil {
		t.Fatalf("reconcile(beta) error = %v", err)
	}

	reconcileAdditiveCatalogAndAssertReuse(t, database, catalog, relation, beta)

	stable := testBundle(
		testMigration(1, nil, "root"),
		testMigration(2, uintPointer(1), "stable_squashed"),
	)
	if err := catalog.reconcile(stable, 1); err != nil {
		t.Fatalf("reconcile(stable) error = %v", err)
	}

	stored, found, err := catalog.migration(2)
	if err != nil {
		t.Fatalf("migration(2) error = %v", err)
	}

	if !found {
		t.Fatal("migration(2) found = false")
	}

	if err := compareMigration(stable.migrations[1], stored); err != nil {
		t.Fatalf("active migration 2 does not match stable replacement: %v", err)
	}

	var (
		activeRows     int
		archivedRows   int
		archiveBatches int
	)

	query := fmt.Sprintf( //nolint:gosec // relation is identifier-quoted.
		`SELECT
    count(*) FILTER (WHERE archived_at IS NULL),
    count(*) FILTER (WHERE archived_at IS NOT NULL),
    count(DISTINCT archive_batch_id) FILTER (WHERE archived_at IS NOT NULL)
FROM %s
WHERE version >= 2`,
		relation,
	)
	if err := database.QueryRowContext(t.Context(), query).Scan(
		&activeRows,
		&archivedRows,
		&archiveBatches,
	); err != nil {
		t.Fatalf("querying active and archived rows: %v", err)
	}

	if activeRows != 1 || archivedRows != 3 || archiveBatches != 1 {
		t.Fatalf(
			"catalog rows = active %d, archived %d, batches %d; want 1, 3, 1",
			activeRows,
			archivedRows,
			archiveBatches,
		)
	}

	query = fmt.Sprintf(
		`SELECT count(*)
FROM %s AS child
JOIN %s AS predecessor ON predecessor.id = child.previous_id
WHERE child.identifier = 'beta_enabled'
  AND predecessor.identifier = 'beta_name'
  AND child.archived_at IS NOT NULL
  AND predecessor.archived_at IS NOT NULL`,
		relation,
		relation,
	)

	var linkedArchivedRows int
	if err := database.QueryRowContext(t.Context(), query).Scan(&linkedArchivedRows); err != nil {
		t.Fatalf("querying archived lineage: %v", err)
	}

	if linkedArchivedRows != 1 {
		t.Fatalf("linked archived rows = %d, want 1", linkedArchivedRows)
	}
}

func reconcileAdditiveCatalogAndAssertReuse(
	t *testing.T,
	database *sql.DB,
	catalog *catalog,
	relation string,
	beta *bundle,
) {
	t.Helper()

	registrationQuery := fmt.Sprintf( //nolint:gosec // relation is identifier-quoted.
		`SELECT array_agg(registered_at::text ORDER BY version)
FROM %s
WHERE archived_at IS NULL`,
		relation,
	)

	var registeredBeforeAdditive pq.StringArray
	if err := database.QueryRowContext(t.Context(), registrationQuery).Scan(
		&registeredBeforeAdditive,
	); err != nil {
		t.Fatalf("querying registration times before additive reconcile: %v", err)
	}

	additiveMigrations := append(
		slices.Clone(beta.migrations),
		testMigration(4, uintPointer(3), "beta_tail"),
	)
	if err := catalog.reconcile(testBundle(additiveMigrations...), 1); err != nil {
		t.Fatalf("reconcile(additive) error = %v", err)
	}

	additiveStateQuery := `
SELECT
    array_agg(registered_at::text ORDER BY version) FILTER (
        WHERE archived_at IS NULL AND version <= 3
    ),
    count(*) FILTER (WHERE archived_at IS NOT NULL)
FROM ` + relation

	var (
		registeredAfterAdditive pq.StringArray
		additiveArchivedRows    int
	)
	if err := database.QueryRowContext(t.Context(), additiveStateQuery).Scan(
		&registeredAfterAdditive,
		&additiveArchivedRows,
	); err != nil {
		t.Fatalf("querying state after additive reconcile: %v", err)
	}

	if additiveArchivedRows != 0 {
		t.Fatalf("archived rows after additive reconcile = %d, want 0", additiveArchivedRows)
	}

	if !slices.Equal(registeredAfterAdditive, registeredBeforeAdditive) {
		t.Fatalf(
			"pre-existing registered_at values changed from %v to %v",
			registeredBeforeAdditive,
			registeredAfterAdditive,
		)
	}
}

func TestCatalogPublicationRejectsChangedHistory(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		column string
		value  func(migration) any
		issue  string
	}{
		{
			name:   "identifier",
			column: "identifier",
			value: func(migration) any {
				return "changed"
			},
			issue: "identifier",
		},
		{
			name:   "up SQL",
			column: "up_sql",
			value: func(migration) any {
				return []byte("SELECT 'changed up';")
			},
			issue: "up SQL",
		},
		{
			name:   "down SQL",
			column: "down_sql",
			value: func(migration) any {
				return []byte("SELECT 'changed down';")
			},
			issue: "down SQL",
		},
		{
			name:   "up checksum",
			column: "up_sha256",
			value: func(migration) any {
				return bytesOfLength(sha256.Size, 1)
			},
			issue: "up checksum",
		},
		{
			name:   "down checksum",
			column: "down_sha256",
			value: func(migration) any {
				return bytesOfLength(sha256.Size, 2)
			},
			issue: "down checksum",
		},
		{
			name:   "format version",
			column: "format_version",
			value: func(migration) any {
				return int64(2)
			},
			issue: "format version",
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

			migration := testMigration(1, nil, "first")

			local := testBundle(migration)
			if err := catalog.publish(local); err != nil {
				t.Fatalf("initial publish() error = %v", err)
			}

			// The relation is identifier-quoted and the column comes from the fixed test table above.
			query := fmt.Sprintf( //nolint:gosec // Only quoted, allowlisted identifiers are interpolated.
				"UPDATE %s SET %s = $1 WHERE version = $2",
				catalogTestRelation(schema),
				pq.QuoteIdentifier(tt.column),
			)
			if _, err := database.ExecContext(
				t.Context(),
				query,
				tt.value(migration),
				int64(1),
			); err != nil {
				t.Fatalf("changing stored field: %v", err)
			}

			err := catalog.publish(local)
			if err == nil {
				t.Fatal("publish(changed history) error = nil")
			}

			var integrityErr *IntegrityError
			if !errors.As(err, &integrityErr) {
				t.Fatalf("publish(changed history) error = %v (%T), want *IntegrityError", err, err)
			}

			if !strings.Contains(integrityErr.Issue, tt.issue) {
				t.Fatalf(
					"publish(changed history) issue = %q, want %q",
					integrityErr.Issue,
					tt.issue,
				)
			}
		})
	}
}

func TestCatalogPublicationIsConcurrentSafe(t *testing.T) {
	t.Parallel()

	database := openCatalogTestDatabase(t)
	database.SetMaxOpenConns(16)
	schema := createCatalogTestSchema(t, database, "")

	catalog := sqlCatalogForTest(t, database, schema)
	if err := catalog.bootstrap(); err != nil {
		t.Fatalf("bootstrap() error = %v", err)
	}

	local := testBundle(
		testMigration(1, nil, "first"),
		testMigration(5, uintPointer(1), "fifth"),
		testMigration(10, uintPointer(5), "tenth"),
	)

	const publishers = 8

	errorsChannel := make(chan error, publishers)

	var waitGroup sync.WaitGroup
	for range publishers {
		waitGroup.Go(func() {
			connection, err := database.Conn(t.Context())
			if err != nil {
				errorsChannel <- fmt.Errorf("acquiring publication connection: %w", err)
				return
			}

			defer func() {
				if closeErr := connection.Close(); closeErr != nil {
					errorsChannel <- fmt.Errorf("closing publication connection: %w", closeErr)
				}
			}()

			concurrentCatalog, err := newSQLCatalog(t.Context(), connection, schema)
			if err != nil {
				errorsChannel <- err
				return
			}

			if err := concurrentCatalog.publish(local); err != nil {
				errorsChannel <- err
			}
		})
	}

	waitGroup.Wait()
	close(errorsChannel)

	for err := range errorsChannel {
		if err != nil {
			t.Errorf("concurrent publish() error = %v", err)
		}
	}

	var count int
	if err := database.QueryRowContext(
		t.Context(),
		"SELECT count(*) FROM "+catalogTestRelation(schema),
	).Scan(&count); err != nil {
		t.Fatalf("counting catalog rows: %v", err)
	}

	if count != 3 {
		t.Fatalf("catalog row count = %d, want 3", count)
	}
}

func openCatalogTestDatabase(t *testing.T) *sql.DB {
	t.Helper()

	dsn, err := catalogTestDatabaseDSN(
		os.Getenv(catalogTestDSNEnvironment),
		os.Getenv(catalogTestDatabaseRequiredEnvironment),
	)
	if err != nil {
		t.Fatalf("PostgreSQL integration test setup: %v", err)
	}

	if dsn == "" {
		t.Skipf("set %s to run PostgreSQL integration tests", catalogTestDSNEnvironment)
	}

	database, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatalf("sql.Open() error = %v", err)
	}

	t.Cleanup(func() {
		if closeErr := database.Close(); closeErr != nil {
			t.Errorf("database.Close() error = %v", closeErr)
		}
	})

	if err := database.PingContext(t.Context()); err != nil {
		t.Fatalf("database.PingContext() error = %v", err)
	}

	return database
}

func catalogTestDatabaseDSN(dsn, requiredMarker string) (string, error) {
	if dsn != "" {
		return dsn, nil
	}

	if requiredMarker != "" {
		return "", errCatalogTestDatabaseDSNMissing
	}

	return "", nil
}

func createCatalogTestSchema(t *testing.T, database *sql.DB, requested string) string {
	t.Helper()

	schema := requested
	if schema == "" {
		digest := sha256.Sum256([]byte(t.Name()))
		schema = fmt.Sprintf("pgmigrate_%x", digest[:8])
	}

	quotedSchema := pq.QuoteIdentifier(schema)
	if _, err := database.ExecContext(t.Context(), "CREATE SCHEMA "+quotedSchema); err != nil {
		t.Fatalf("creating test schema %q: %v", schema, err)
	}

	t.Cleanup(func() {
		if _, err := database.ExecContext(
			context.Background(),
			"DROP SCHEMA "+quotedSchema+" CASCADE",
		); err != nil {
			t.Errorf("dropping test schema %q: %v", schema, err)
		}
	})

	return schema
}

func sqlCatalogForTest(t *testing.T, database *sql.DB, schema string) *catalog {
	t.Helper()

	connection, err := database.Conn(t.Context())
	if err != nil {
		t.Fatalf("database.Conn() error = %v", err)
	}

	t.Cleanup(func() {
		if closeErr := connection.Close(); closeErr != nil {
			t.Errorf("connection.Close() error = %v", closeErr)
		}
	})

	catalog, err := newSQLCatalog(t.Context(), connection, schema)
	if err != nil {
		t.Fatalf("newSQLCatalog() error = %v", err)
	}

	return catalog
}

func catalogTestRelation(schema string) string {
	return pq.QuoteIdentifier(schema) + "." + pq.QuoteIdentifier(catalogTableName)
}

func insertStoredMigration(
	t *testing.T,
	database *sql.DB,
	relation string,
	migration storedMigration,
) {
	t.Helper()

	if err := insertStoredMigrationError(t.Context(), database, relation, migration); err != nil {
		t.Fatalf("inserting stored migration %d: %v", migration.version, err)
	}
}

func insertStoredMigrationError(
	ctx context.Context,
	database *sql.DB,
	relation string,
	migration storedMigration,
) error {
	// The relation is assembled exclusively from pq.QuoteIdentifier.
	//nolint:gosec // Only a quoted identifier is interpolated.
	query := fmt.Sprintf(`
INSERT INTO %s (
    version,
    previous_id,
    identifier,
    up_sql,
    down_sql,
    up_sha256,
    down_sha256,
    format_version
) VALUES (
    $1,
    (SELECT id FROM %s WHERE version = $2 AND archived_at IS NULL),
    $3,
    $4,
    $5,
    $6,
    $7,
    $8
)
`, relation, relation)

	databaseVersion, err := catalogVersion(migration.version)
	if err != nil {
		return fmt.Errorf("converting migration version: %w", err)
	}

	var previous any
	if migration.previousVersion != nil {
		previous, err = catalogVersion(*migration.previousVersion)
		if err != nil {
			return fmt.Errorf("converting previous migration version: %w", err)
		}
	}

	_, err = database.ExecContext(
		ctx,
		query,
		databaseVersion,
		previous,
		migration.identifier,
		migration.upSQL,
		migration.downSQL,
		migration.upChecksum,
		migration.downChecksum,
		migration.formatVersion,
	)
	if err != nil {
		return fmt.Errorf("inserting migration %d: %w", migration.version, err)
	}

	return nil
}

func bytesOfLength(length int, value byte) []byte {
	body := make([]byte, length)
	for index := range body {
		body[index] = value
	}

	return body
}
