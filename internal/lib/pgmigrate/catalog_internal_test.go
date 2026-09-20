package pgmigrate

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"errors"
	"fmt"
	"slices"
	"strings"
	"testing"

	"github.com/lib/pq"
)

func TestNewCatalogValidatesConfiguration(t *testing.T) {
	t.Parallel()

	database := &stubCatalogDatabase{}
	tests := []struct {
		name     string
		ctx      func(*testing.T) context.Context
		database catalogDatabase
		schema   string
		field    string
	}{
		{
			name: "nil context",
			ctx: func(*testing.T) context.Context {
				return nil
			},
			database: database,
			schema:   "app",
			field:    "context",
		},
		{
			name: "nil database",
			ctx: func(t *testing.T) context.Context {
				t.Helper()

				return t.Context()
			},
			database: nil,
			schema:   "app",
			field:    "database",
		},
		{
			name: "blank schema",
			ctx: func(t *testing.T) context.Context {
				t.Helper()

				return t.Context()
			},
			database: database,
			schema:   " \t",
			field:    "schema",
		},
		{
			name: "schema with zero byte",
			ctx: func(t *testing.T) context.Context {
				t.Helper()

				return t.Context()
			},
			database: database,
			schema:   "app\x00other",
			field:    "schema",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			_, err := newCatalog(tt.ctx(t), tt.database, tt.schema)
			if err == nil {
				t.Fatal("newCatalog() error = nil")
			}

			var configurationErr *ConfigurationError
			if !errors.As(err, &configurationErr) {
				t.Fatalf("newCatalog() error = %v (%T), want *ConfigurationError", err, err)
			}

			if configurationErr.Field != tt.field {
				t.Fatalf("newCatalog() error field = %q, want %q", configurationErr.Field, tt.field)
			}
		})
	}
}

func TestCatalogBootstrapQuotesSchemaAndCreatesV1Constraints(t *testing.T) {
	t.Parallel()

	var (
		gotQuery string
		gotArgs  []any
	)

	database := &stubCatalogDatabase{
		execFunc: func(_ context.Context, query string, args ...any) error {
			gotQuery = query
			gotArgs = args

			return nil
		},
	}

	catalog, err := newCatalog(t.Context(), database, `tenant"; SELECT pg_sleep(10); --`)
	if err != nil {
		t.Fatalf("newCatalog() error = %v", err)
	}

	if err := catalog.bootstrap(); err != nil {
		t.Fatalf("bootstrap() error = %v", err)
	}

	if len(gotArgs) != 0 {
		t.Fatalf("bootstrap() arguments = %v, want none", gotArgs)
	}

	quotedRelation := `"tenant""; SELECT pg_sleep(10); --"."schema_migration_catalog"`
	if strings.Count(gotQuery, quotedRelation) != 5 {
		t.Fatalf(
			"bootstrap() query references quoted relation %d times, want 5\n%s",
			strings.Count(gotQuery, quotedRelation),
			gotQuery,
		)
	}

	for _, fragment := range []string{
		"id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
		"previous_id UUID NULL",
		"FOREIGN KEY (previous_id)",
		"REFERENCES " + quotedRelation + " (id) ON DELETE RESTRICT",
		"archived_at TIMESTAMPTZ NULL",
		"archive_batch_id UUID NULL",
		"(archived_at IS NULL) = (archive_batch_id IS NULL)",
		"WHERE archived_at IS NULL;",
		"WHERE archived_at IS NULL AND previous_id IS NOT NULL",
		"WHERE archived_at IS NULL AND previous_id IS NULL",
		"octet_length(up_sql) > 0",
		"octet_length(down_sql) > 0",
		"octet_length(up_sha256) = 32",
		"octet_length(down_sha256) = 32",
		"registered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
	} {
		if !strings.Contains(gotQuery, fragment) {
			t.Errorf("bootstrap() query does not contain %q\n%s", fragment, gotQuery)
		}
	}
}

func TestCatalogFindsFirstActiveFutureDivergenceAndProtectsAppliedRows(t *testing.T) {
	t.Parallel()

	beta := testBundle(
		testMigration(1, nil, "root"),
		testMigration(2, uintPointer(1), "beta_name"),
		testMigration(3, uintPointer(2), "beta_enabled"),
	)
	additive := testBundle(
		beta.migrations[0],
		beta.migrations[1],
		beta.migrations[2],
		testMigration(4, uintPointer(3), "beta_tail"),
	)
	stable := testBundle(
		testMigration(1, nil, "root"),
		testMigration(2, uintPointer(1), "stable_squashed"),
	)
	higherVersionSquash := testBundle(
		testMigration(1, nil, "root"),
		testMigration(6, uintPointer(1), "stable_squashed"),
	)
	editedBetaVersionTwo := testMigration(2, uintPointer(1), "beta_name")
	editedBetaVersionTwo.upSQL = []byte("SELECT 'edited up 2';")
	editedBetaVersionTwo.upChecksum = sha256.Sum256(editedBetaVersionTwo.upSQL)
	editedBeta := testBundle(beta.migrations[0], editedBetaVersionTwo, beta.migrations[2])
	editedBetaVersionThree := testMigration(3, uintPointer(2), "beta_enabled")
	editedBetaVersionThree.upSQL = []byte("SELECT 'edited up 3';")
	editedBetaVersionThree.upChecksum = sha256.Sum256(editedBetaVersionThree.upSQL)
	partiallyDivergentBeta := testBundle(
		beta.migrations[0],
		beta.migrations[1],
		editedBetaVersionThree,
	)
	rerootedVersionTwo := testBundle(testMigration(2, nil, "beta_name"))
	previousStable := testBundle(testMigration(1, nil, "root"))
	forkedStable := testBundle(
		testMigration(1, nil, "root"),
		testMigration(4, uintPointer(1), "stable_squashed"),
	)

	database := newMemoryCatalogDatabase(
		storedMigrationFrom(beta.migrations[0]),
		storedMigrationFrom(beta.migrations[1]),
		storedMigrationFrom(beta.migrations[2]),
	)

	betaCatalog, err := newCatalog(t.Context(), database, "app")
	if err != nil {
		t.Fatalf("newCatalog() error = %v", err)
	}

	forkedDatabase := newMemoryCatalogDatabase(
		storedMigrationFrom(forkedStable.migrations[0]),
		storedMigrationFrom(forkedStable.migrations[1]),
	)

	forkedCatalog, err := newCatalog(t.Context(), forkedDatabase, "app")
	if err != nil {
		t.Fatalf("newCatalog() for forked lineage error = %v", err)
	}

	tests := []struct {
		name           string
		catalog        *catalog
		local          *bundle
		currentVersion int64
		wantDivergence *uint
		wantError      bool
		wantIssue      string
	}{
		{
			name:           "identical inactive suffix",
			local:          beta,
			currentVersion: 1,
			wantDivergence: nil,
			wantError:      false,
		},
		{
			name:           "additive inactive suffix",
			local:          additive,
			currentVersion: 1,
			wantDivergence: nil,
			wantError:      false,
		},
		{
			name:           "partially divergent inactive suffix",
			local:          partiallyDivergentBeta,
			currentVersion: 1,
			wantDivergence: uintPointer(3),
			wantError:      false,
		},
		{
			name:           "replaceable inactive suffix",
			local:          stable,
			currentVersion: 1,
			wantDivergence: uintPointer(2),
			wantError:      false,
		},
		{
			name:           "different applied lineage",
			local:          stable,
			currentVersion: 2,
			wantDivergence: nil,
			wantError:      true,
			wantIssue: "active catalog version 2 belongs to a different lineage and is still applied; " +
				"downgrade below version 2 with an image whose bundle maximum is <= 1 before deploying this bundle",
		},
		{
			name:           "lower replacement after forked applied version",
			catalog:        forkedCatalog,
			local:          beta,
			currentVersion: 4,
			wantDivergence: nil,
			wantError:      true,
			wantIssue: "active catalog version 4 belongs to a different lineage and is still applied; " +
				"downgrade below version 4 with an image whose bundle maximum is <= 1 before deploying this bundle",
		},
		{
			name:           "higher replacement after omitted applied versions",
			local:          higherVersionSquash,
			currentVersion: 3,
			wantDivergence: nil,
			wantError:      true,
			wantIssue: "active catalog version 2 belongs to a different lineage and is still applied; " +
				"downgrade below version 2 with an image whose bundle maximum is <= 1 before deploying this bundle",
		},
		{
			name:           "higher replacement with stored future suffix",
			local:          higherVersionSquash,
			currentVersion: 2,
			wantDivergence: nil,
			wantError:      true,
			wantIssue: "active catalog version 2 belongs to a different lineage and is still applied; " +
				"downgrade below version 2 with an image whose bundle maximum is <= 1 before deploying this bundle",
		},
		{
			name:           "different applied predecessor without common lineage",
			local:          rerootedVersionTwo,
			currentVersion: 2,
			wantDivergence: nil,
			wantError:      true,
			wantIssue: "active catalog version 2 belongs to a different lineage and is still applied; " +
				"the active and embedded bundles have no common lineage version, so pgmigrate cannot replace " +
				"this lineage in place; keep using a compatible bundle or reinitialize the schema and explicitly " +
				"migrate required data before deploying this bundle",
		},
		{
			name:           "edited applied row",
			local:          editedBeta,
			currentVersion: 2,
			wantDivergence: nil,
			wantError:      true,
			wantIssue:      "stored up SQL does not match embedded migration",
		},
		{
			name:           "newer applied rows needed for downgrade",
			local:          previousStable,
			currentVersion: 3,
			wantDivergence: nil,
			wantError:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			catalogUnderTest := betaCatalog
			if tt.catalog != nil {
				catalogUnderTest = tt.catalog
			}

			divergence, comparisonErr := catalogUnderTest.firstActiveFutureDivergence(
				tt.local,
				tt.currentVersion,
			)
			if (comparisonErr != nil) != tt.wantError {
				t.Fatalf(
					"firstActiveFutureDivergence() error = %v, want error %t",
					comparisonErr,
					tt.wantError,
				)
			}

			if !equalOptionalVersion(divergence, tt.wantDivergence) {
				t.Fatalf(
					"firstActiveFutureDivergence() = %v, want %v",
					divergence,
					tt.wantDivergence,
				)
			}

			if tt.wantIssue != "" {
				var integrityErr *IntegrityError
				if !errors.As(comparisonErr, &integrityErr) {
					t.Fatalf(
						"firstActiveFutureDivergence() error = %v (%T), want *IntegrityError",
						comparisonErr,
						comparisonErr,
					)
				}

				if integrityErr.Issue != tt.wantIssue {
					t.Fatalf(
						"firstActiveFutureDivergence() issue = %q, want %q",
						integrityErr.Issue,
						tt.wantIssue,
					)
				}
			}
		})
	}
}

func TestCatalogArchiveSuffixUsesOneBatchAndRequestedBoundary(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		inclusive  bool
		wantClause string
	}{
		{
			name:       "after version",
			inclusive:  false,
			wantClause: "migration.archived_at IS NULL AND migration.version > $1",
		},
		{
			name:       "from version",
			inclusive:  true,
			wantClause: "migration.archived_at IS NULL AND migration.version >= $1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var (
				gotQuery string
				gotArgs  []any
			)

			database := &stubCatalogDatabase{
				execFunc: func(_ context.Context, query string, args ...any) error {
					gotQuery = query

					gotArgs = append([]any(nil), args...)

					return nil
				},
			}

			catalog, err := newCatalog(t.Context(), database, "app")
			if err != nil {
				t.Fatalf("newCatalog() error = %v", err)
			}

			if tt.inclusive {
				err = catalog.archiveFrom(7)
			} else {
				err = catalog.archiveAfter(t.Context(), 7)
			}

			if err != nil {
				t.Fatalf("archive suffix error = %v", err)
			}

			for _, fragment := range []string{
				"WITH archive_batch AS MATERIALIZED",
				"SELECT gen_random_uuid() AS id, CURRENT_TIMESTAMP AS archived_at",
				"archived_at = archive_batch.archived_at",
				"archive_batch_id = archive_batch.id",
				tt.wantClause,
			} {
				if !strings.Contains(gotQuery, fragment) {
					t.Errorf("archive suffix query does not contain %q\n%s", fragment, gotQuery)
				}
			}

			if len(gotArgs) != 1 || gotArgs[0] != int64(7) {
				t.Fatalf("archive suffix arguments = %v, want [7]", gotArgs)
			}
		})
	}
}

func TestCatalogBootstrapWrapsDatabaseError(t *testing.T) {
	t.Parallel()

	cause := sql.ErrConnDone
	database := &stubCatalogDatabase{
		execFunc: func(context.Context, string, ...any) error {
			return cause
		},
	}

	catalog, err := newCatalog(t.Context(), database, "app")
	if err != nil {
		t.Fatalf("newCatalog() error = %v", err)
	}

	err = catalog.bootstrap()
	if !errors.Is(err, cause) {
		t.Fatalf("bootstrap() error = %v, want wrapped %v", err, cause)
	}

	if !strings.Contains(err.Error(), `schema "app"`) {
		t.Fatalf("bootstrap() error = %q, want schema context", err)
	}
}

func TestCatalogQueryRowsWrapsDatabaseErrors(t *testing.T) {
	t.Parallel()

	cause := sql.ErrConnDone
	tests := []struct {
		name      string
		queryErr  error
		rowsErr   error
		closeErr  error
		wantError string
	}{
		{
			name:      "query",
			queryErr:  cause,
			wantError: `reading migration catalog in schema "app"`,
		},
		{
			name:      "iteration",
			rowsErr:   cause,
			wantError: `iterating migration catalog rows in schema "app"`,
		},
		{
			name:      "close",
			closeErr:  cause,
			wantError: `closing migration catalog rows in schema "app"`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			database := &stubCatalogDatabase{
				queryFunc: func(context.Context, string, ...any) (catalogRows, error) {
					if tt.queryErr != nil {
						return nil, tt.queryErr
					}

					return &stubCatalogRows{
						err:      tt.rowsErr,
						closeErr: tt.closeErr,
					}, nil
				},
			}

			catalog, err := newCatalog(t.Context(), database, "app")
			if err != nil {
				t.Fatalf("newCatalog() error = %v", err)
			}

			err = catalog.queryRows("SELECT 1", nil, func(catalogRows) error {
				return nil
			})
			if !errors.Is(err, cause) {
				t.Fatalf("queryRows() error = %v, want wrapped %v", err, cause)
			}

			if !strings.Contains(err.Error(), tt.wantError) {
				t.Fatalf("queryRows() error = %q, want %q", err, tt.wantError)
			}
		})
	}
}

//nolint:cyclop // One focused contract test checks every generated statement field and argument.
func TestCatalogPublishUsesAscendingParameterizedRows(t *testing.T) {
	t.Parallel()

	local := testBundle(
		testMigration(2, nil, "first"),
		testMigration(10, uintPointer(2), "second"),
	)

	byVersion := make(map[int64]migration, len(local.migrations))
	for _, migration := range local.migrations {
		version, err := catalogVersion(migration.version)
		if err != nil {
			t.Fatalf("catalogVersion() error = %v", err)
		}

		byVersion[version] = migration
	}

	var (
		executedQueries []string
		executedArgs    [][]any
	)

	database := &stubCatalogDatabase{
		execFunc: func(_ context.Context, query string, args ...any) error {
			executedQueries = append(executedQueries, query)
			executedArgs = append(executedArgs, append([]any(nil), args...))

			return nil
		},
		queryFunc: func(_ context.Context, _ string, args ...any) (catalogRows, error) {
			version, ok := args[0].(int64)
			if !ok {
				return nil, fmt.Errorf(
					"unexpected version argument %T: %w",
					args[0],
					errors.ErrUnsupported,
				)
			}

			migration := byVersion[version]

			return rowsForMigration(migration), nil
		},
	}

	catalog, err := newCatalog(t.Context(), database, "app")
	if err != nil {
		t.Fatalf("newCatalog() error = %v", err)
	}

	if err := catalog.publish(local); err != nil {
		t.Fatalf("publish() error = %v", err)
	}

	if len(executedQueries) != 2 {
		t.Fatalf("publish() statement count = %d, want 2", len(executedQueries))
	}

	for _, query := range executedQueries {
		for _, fragment := range []string{
			`INSERT INTO "app"."schema_migration_catalog" (`,
			"version,",
			"previous_id,",
			"identifier,",
			"up_sql,",
			"down_sql,",
			"up_sha256,",
			"down_sha256,",
			"format_version",
			`SELECT id FROM "app"."schema_migration_catalog"`,
			"WHERE version = $2 AND archived_at IS NULL",
			"ON CONFLICT (version) WHERE archived_at IS NULL DO NOTHING",
		} {
			if !strings.Contains(query, fragment) {
				t.Errorf("publish() query does not contain %q\n%s", fragment, query)
			}
		}
	}

	firstVersion, firstOK := executedArgs[0][0].(int64)

	secondVersion, secondOK := executedArgs[1][0].(int64)
	if !firstOK || !secondOK {
		t.Fatalf(
			"publish() version argument types = %T and %T, want int64",
			executedArgs[0][0],
			executedArgs[1][0],
		)
	}

	if firstVersion != 2 || secondVersion != 10 {
		t.Fatalf("publish() versions = [%d %d], want [2 10]", firstVersion, secondVersion)
	}

	if executedArgs[0][1] != nil {
		t.Fatalf("first previous version = %v, want nil", executedArgs[0][1])
	}

	if got := executedArgs[1][1]; got != int64(2) {
		t.Fatalf("second previous version = %v, want 2", got)
	}

	for index, args := range executedArgs {
		if len(args) != 8 {
			t.Fatalf("publish() arguments[%d] length = %d, want 8", index, len(args))
		}

		if args[7] != catalogFormatV1 {
			t.Fatalf(
				"publish() arguments[%d] format = %v, want %d",
				index,
				args[7],
				catalogFormatV1,
			)
		}
	}
}

func TestCompareMigrationRejectsEveryImmutableMismatch(t *testing.T) {
	t.Parallel()

	local := testMigration(10, uintPointer(2), "add_name")
	matching := storedMigrationFrom(local)

	tests := []struct {
		name   string
		mutate func(*storedMigration)
		issue  string
	}{
		{
			name: "version",
			mutate: func(stored *storedMigration) {
				stored.version++
			},
			issue: "version",
		},
		{
			name: "previous version",
			mutate: func(stored *storedMigration) {
				stored.previousVersion = uintPointer(1)
			},
			issue: "previous version",
		},
		{
			name: "identifier",
			mutate: func(stored *storedMigration) {
				stored.identifier = "changed"
			},
			issue: "identifier",
		},
		{
			name: "up SQL",
			mutate: func(stored *storedMigration) {
				stored.upSQL = []byte("SELECT 'changed up';")
			},
			issue: "up SQL",
		},
		{
			name: "down SQL",
			mutate: func(stored *storedMigration) {
				stored.downSQL = []byte("SELECT 'changed down';")
			},
			issue: "down SQL",
		},
		{
			name: "up checksum",
			mutate: func(stored *storedMigration) {
				stored.upChecksum[0]++
			},
			issue: "up checksum",
		},
		{
			name: "down checksum",
			mutate: func(stored *storedMigration) {
				stored.downChecksum[0]++
			},
			issue: "down checksum",
		},
		{
			name: "format version",
			mutate: func(stored *storedMigration) {
				stored.formatVersion++
			},
			issue: "format version",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			stored := cloneStoredMigration(matching)
			tt.mutate(&stored)

			err := compareMigration(local, stored)
			if err == nil {
				t.Fatal("compareMigration() error = nil")
			}

			var integrityErr *IntegrityError
			if !errors.As(err, &integrityErr) {
				t.Fatalf("compareMigration() error = %v (%T), want *IntegrityError", err, err)
			}

			if !strings.Contains(integrityErr.Issue, tt.issue) {
				t.Fatalf("compareMigration() issue = %q, want %q", integrityErr.Issue, tt.issue)
			}
		})
	}
}

func TestCatalogPublishAcceptsMatchingRowAfterConcurrentUniqueConflict(t *testing.T) {
	t.Parallel()

	migration := testMigration(1, nil, "first")
	database := &stubCatalogDatabase{
		execFunc: func(context.Context, string, ...any) error {
			return &pq.Error{Code: pq.ErrorCode("23505")}
		},
		queryFunc: func(context.Context, string, ...any) (catalogRows, error) {
			return rowsForMigration(migration), nil
		},
	}

	catalog, err := newCatalog(t.Context(), database, "app")
	if err != nil {
		t.Fatalf("newCatalog() error = %v", err)
	}

	if err := catalog.publish(testBundle(migration)); err != nil {
		t.Fatalf("publish() error = %v", err)
	}
}

func TestCatalogPublishReturnsIntegrityErrors(t *testing.T) {
	t.Parallel()

	cause := sql.ErrTxDone
	local := testBundle(testMigration(1, nil, "first"))
	tests := []struct {
		name     string
		database *stubCatalogDatabase
		cause    error
		issue    string
	}{
		{
			name: "insert failure",
			database: &stubCatalogDatabase{
				execFunc: func(context.Context, string, ...any) error {
					return cause
				},
			},
			cause: cause,
			issue: "cannot publish",
		},
		{
			name: "missing readback",
			database: &stubCatalogDatabase{
				queryFunc: func(context.Context, string, ...any) (catalogRows, error) {
					return &stubCatalogRows{}, nil
				},
			},
			cause: nil,
			issue: "published row is missing",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			catalog, err := newCatalog(t.Context(), tt.database, "app")
			if err != nil {
				t.Fatalf("newCatalog() error = %v", err)
			}

			err = catalog.publish(local)
			if err == nil {
				t.Fatal("publish() error = nil")
			}

			var integrityErr *IntegrityError
			if !errors.As(err, &integrityErr) {
				t.Fatalf("publish() error = %v (%T), want *IntegrityError", err, err)
			}

			if !strings.Contains(integrityErr.Issue, tt.issue) {
				t.Fatalf("publish() issue = %q, want %q", integrityErr.Issue, tt.issue)
			}

			if tt.cause != nil && !errors.Is(err, tt.cause) {
				t.Fatalf("publish() error = %v, want wrapped %v", err, tt.cause)
			}
		})
	}
}

type memoryCatalogDatabase struct {
	migrations map[uint]storedMigration
}

func newMemoryCatalogDatabase(migrations ...storedMigration) *memoryCatalogDatabase {
	database := &memoryCatalogDatabase{migrations: make(map[uint]storedMigration, len(migrations))}
	for _, migration := range migrations {
		database.migrations[migration.version] = cloneStoredMigration(migration)
	}

	return database
}

func (d *memoryCatalogDatabase) exec(context.Context, string, ...any) error {
	return nil
}

//nolint:cyclop // The in-memory test adapter dispatches the finite catalog query set.
func (d *memoryCatalogDatabase) query(
	_ context.Context,
	query string,
	args ...any,
) (catalogRows, error) {
	switch {
	case strings.Contains(query, "predecessor.version,\n    migration.identifier"):
		databaseVersion, ok := args[0].(int64)
		if !ok {
			return nil, fmt.Errorf(
				"unexpected version argument %T: %w",
				args[0],
				errors.ErrUnsupported,
			)
		}

		version, err := sourceVersion(databaseVersion)
		if err != nil {
			return nil, fmt.Errorf("converting queried version: %w", err)
		}

		migration, found := d.migrations[version]
		if !found {
			return &stubCatalogRows{}, nil
		}

		return rowsForStoredMigration(migration), nil
	case strings.Contains(query, "WHERE archived_at IS NULL AND previous_id IS NULL"):
		versions := make([]uint, 0, len(d.migrations))
		for version, migration := range d.migrations {
			if migration.previousVersion == nil {
				versions = append(versions, version)
			}
		}

		return rowsForVersions(versions, maximumChainRows), nil
	case strings.Contains(query, "successor.archived_at IS NULL"):
		databasePrevious, ok := args[0].(int64)
		if !ok {
			return nil, fmt.Errorf(
				"unexpected previous version argument %T: %w",
				args[0],
				errors.ErrUnsupported,
			)
		}

		previous, err := sourceVersion(databasePrevious)
		if err != nil {
			return nil, fmt.Errorf("converting queried previous version: %w", err)
		}

		versions := make([]uint, 0, len(d.migrations))
		for version, migration := range d.migrations {
			if migration.previousVersion != nil && *migration.previousVersion == previous {
				versions = append(versions, version)
			}
		}

		return rowsForVersions(versions, maximumChainRows), nil
	case strings.Contains(query, "WHERE archived_at IS NULL\nORDER BY version\nLIMIT 1"):
		versions := make([]uint, 0, len(d.migrations))
		for version := range d.migrations {
			versions = append(versions, version)
		}

		return rowsForVersions(versions, 1), nil
	case strings.Contains(query, "WHERE archived_at IS NULL\nORDER BY version"):
		versions := make([]uint, 0, len(d.migrations))
		for version := range d.migrations {
			versions = append(versions, version)
		}

		return rowsForVersions(versions, len(versions)), nil
	default:
		return nil, fmt.Errorf("unexpected catalog query: %w", errors.ErrUnsupported)
	}
}

func rowsForStoredMigration(migration storedMigration) *stubCatalogRows {
	var (
		previousID any
		previous   any
	)
	if migration.previousVersion != nil {
		previousID = "00000000-0000-0000-0000-000000000001"

		previous = int64(*migration.previousVersion)
	}

	return &stubCatalogRows{
		rows: [][]any{{
			int64(migration.version),
			previousID,
			previous,
			migration.identifier,
			migration.upSQL,
			migration.downSQL,
			migration.upChecksum,
			migration.downChecksum,
			migration.formatVersion,
		}},
	}
}

func rowsForVersions(versions []uint, limit int) *stubCatalogRows {
	slices.Sort(versions)

	if len(versions) > limit {
		versions = versions[:limit]
	}

	rows := make([][]any, 0, len(versions))
	for _, version := range versions {
		// Test catalog versions are small constants and always fit PostgreSQL BIGINT.
		rows = append(rows, []any{int64(version)})
	}

	return &stubCatalogRows{rows: rows}
}

type stubCatalogDatabase struct {
	execFunc  func(context.Context, string, ...any) error
	queryFunc func(context.Context, string, ...any) (catalogRows, error)
}

func (d *stubCatalogDatabase) exec(ctx context.Context, query string, args ...any) error {
	if d.execFunc == nil {
		return nil
	}

	return d.execFunc(ctx, query, args...)
}

func (d *stubCatalogDatabase) query(
	ctx context.Context,
	query string,
	args ...any,
) (catalogRows, error) {
	if d.queryFunc == nil {
		return nil, fmt.Errorf("unexpected query %q: %w", query, errors.ErrUnsupported)
	}

	return d.queryFunc(ctx, query, args...)
}

type stubCatalogRows struct {
	rows     [][]any
	position int
	err      error
	closeErr error
}

func (r *stubCatalogRows) Next() bool {
	if r.position >= len(r.rows) {
		return false
	}

	r.position++

	return true
}

func (r *stubCatalogRows) Scan(dest ...any) error {
	if r.position == 0 || r.position > len(r.rows) {
		return fmt.Errorf("Scan called without a current row: %w", sql.ErrNoRows)
	}

	values := r.rows[r.position-1]
	if len(values) != len(dest) {
		return fmt.Errorf(
			"got %d destinations for %d values: %w",
			len(dest),
			len(values),
			errors.ErrUnsupported,
		)
	}

	for index := range values {
		if err := assignCatalogValue(dest[index], values[index]); err != nil {
			return fmt.Errorf("column %d: %w", index, err)
		}
	}

	return nil
}

func (r *stubCatalogRows) Err() error {
	return r.err
}

func (r *stubCatalogRows) Close() error {
	return r.closeErr
}

func assignCatalogValue(destination, value any) error {
	switch typed := destination.(type) {
	case *int64:
		got, ok := value.(int64)
		if !ok {
			return fmt.Errorf("cannot assign %T to *int64: %w", value, errors.ErrUnsupported)
		}

		*typed = got
	case *string:
		got, ok := value.(string)
		if !ok {
			return fmt.Errorf("cannot assign %T to *string: %w", value, errors.ErrUnsupported)
		}

		*typed = got
	case *[]byte:
		got, ok := value.([]byte)
		if !ok {
			return fmt.Errorf("cannot assign %T to *[]byte: %w", value, errors.ErrUnsupported)
		}

		*typed = bytes.Clone(got)
	case *sql.NullInt64:
		if value == nil {
			*typed = sql.NullInt64{}
			return nil
		}

		got, ok := value.(int64)
		if !ok {
			return fmt.Errorf(
				"cannot assign %T to *sql.NullInt64: %w",
				value,
				errors.ErrUnsupported,
			)
		}

		*typed = sql.NullInt64{Int64: got, Valid: true}
	case *sql.NullString:
		if value == nil {
			*typed = sql.NullString{}
			return nil
		}

		got, ok := value.(string)
		if !ok {
			return fmt.Errorf(
				"cannot assign %T to *sql.NullString: %w",
				value,
				errors.ErrUnsupported,
			)
		}

		*typed = sql.NullString{String: got, Valid: true}
	default:
		return fmt.Errorf("unsupported destination %T: %w", destination, errors.ErrUnsupported)
	}

	return nil
}

func rowsForMigration(migration migration) *stubCatalogRows {
	var (
		previousID any
		previous   any
	)
	if migration.previousVersion != nil {
		previousID = "00000000-0000-0000-0000-000000000001"

		previous = int64(*migration.previousVersion)
	}

	return &stubCatalogRows{
		rows: [][]any{{
			int64(migration.version),
			previousID,
			previous,
			migration.identifier,
			migration.upSQL,
			migration.downSQL,
			migration.upChecksum[:],
			migration.downChecksum[:],
			catalogFormatV1,
		}},
	}
}

func testMigration(version uint, previous *uint, identifier string) migration {
	upSQL := fmt.Appendf(nil, "SELECT 'up %d';", version)
	downSQL := fmt.Appendf(nil, "SELECT 'down %d';", version)

	return migration{
		version:         version,
		previousVersion: previous,
		identifier:      identifier,
		upSQL:           upSQL,
		downSQL:         downSQL,
		upChecksum:      sha256.Sum256(upSQL),
		downChecksum:    sha256.Sum256(downSQL),
	}
}

func testBundle(migrations ...migration) *bundle {
	return &bundle{
		migrations: migrations,
		target:     migrations[len(migrations)-1].version,
	}
}

func storedMigrationFrom(migration migration) storedMigration {
	return storedMigration{
		version:         migration.version,
		previousVersion: migration.previousVersion,
		identifier:      migration.identifier,
		upSQL:           bytes.Clone(migration.upSQL),
		downSQL:         bytes.Clone(migration.downSQL),
		upChecksum:      bytes.Clone(migration.upChecksum[:]),
		downChecksum:    bytes.Clone(migration.downChecksum[:]),
		formatVersion:   catalogFormatV1,
	}
}

func cloneStoredMigration(migration storedMigration) storedMigration {
	cloned := migration
	if migration.previousVersion != nil {
		cloned.previousVersion = uintPointer(*migration.previousVersion)
	}

	cloned.upSQL = bytes.Clone(migration.upSQL)
	cloned.downSQL = bytes.Clone(migration.downSQL)
	cloned.upChecksum = bytes.Clone(migration.upChecksum)
	cloned.downChecksum = bytes.Clone(migration.downChecksum)

	return cloned
}
