package pgmigrate

import (
	"bytes"
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"os"
	"slices"
	"strings"
	"testing"

	"github.com/golang-migrate/migrate/v4/source"
)

func TestCatalogSourceImplementsNonOwningDriver(t *testing.T) {
	t.Parallel()

	var driver source.Driver = newCatalogSource(nil)

	opened, err := driver.Open("catalog://unused")
	if err == nil {
		t.Fatal("Open() error = nil")
	}

	if opened != nil {
		t.Fatalf("Open() driver = %v, want nil", opened)
	}

	if err := driver.Close(); err != nil {
		t.Fatalf("Close() error = %v", err)
	}
}

func TestCatalogSourceTraversesStoredPredecessorChain(t *testing.T) {
	t.Parallel()

	database := newMemoryCatalogDatabase(
		storedMigrationFrom(testMigration(2, nil, "first")),
		storedMigrationFrom(testMigration(10, uintPointer(2), "second")),
		storedMigrationFrom(testMigration(42, uintPointer(10), "third")),
	)
	driver := sourceForTest(t, database)

	first, err := driver.First()
	if err != nil {
		t.Fatalf("First() error = %v", err)
	}

	if first != 2 {
		t.Fatalf("First() = %d, want 2", first)
	}

	previous, err := driver.Prev(10)
	if err != nil {
		t.Fatalf("Prev(10) error = %v", err)
	}

	if previous != 2 {
		t.Fatalf("Prev(10) = %d, want 2", previous)
	}

	next, err := driver.Next(10)
	if err != nil {
		t.Fatalf("Next(10) error = %v", err)
	}

	if next != 42 {
		t.Fatalf("Next(10) = %d, want 42", next)
	}

	if _, err := driver.Prev(2); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("Prev(root) error = %v, want os.ErrNotExist", err)
	}

	if _, err := driver.Next(42); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("Next(tail) error = %v, want os.ErrNotExist", err)
	}
}

func TestCatalogSourceUsesNotExistOnlyForBoundaries(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		database *memoryCatalogDatabase
		call     func(*catalogSource) error
		boundary bool
		issue    string
	}{
		{
			name:     "empty catalog first",
			database: newMemoryCatalogDatabase(),
			call: func(driver *catalogSource) error {
				_, err := driver.First()
				return err
			},
			boundary: true,
			issue:    "",
		},
		{
			name: "unknown previous version",
			database: newMemoryCatalogDatabase(
				storedMigrationFrom(testMigration(1, nil, "first")),
			),
			call: func(driver *catalogSource) error {
				_, err := driver.Prev(99)
				return err
			},
			boundary: false,
			issue:    "catalog row is missing",
		},
		{
			name: "unknown next version",
			database: newMemoryCatalogDatabase(
				storedMigrationFrom(testMigration(1, nil, "first")),
			),
			call: func(driver *catalogSource) error {
				_, err := driver.Next(99)
				return err
			},
			boundary: false,
			issue:    "catalog row is missing",
		},
		{
			name: "missing predecessor",
			database: newMemoryCatalogDatabase(
				storedMigrationFrom(testMigration(2, uintPointer(1), "second")),
			),
			call: func(driver *catalogSource) error {
				_, err := driver.Prev(2)
				return err
			},
			boundary: false,
			issue:    "missing predecessor",
		},
		{
			name: "rows without root",
			database: newMemoryCatalogDatabase(
				storedMigrationFrom(testMigration(1, uintPointer(2), "first")),
				storedMigrationFrom(testMigration(2, uintPointer(1), "second")),
			),
			call: func(driver *catalogSource) error {
				_, err := driver.First()
				return err
			},
			boundary: false,
			issue:    "has no root",
		},
		{
			name: "multiple roots",
			database: newMemoryCatalogDatabase(
				storedMigrationFrom(testMigration(1, nil, "first")),
				storedMigrationFrom(testMigration(2, nil, "second")),
			),
			call: func(driver *catalogSource) error {
				_, err := driver.First()
				return err
			},
			boundary: false,
			issue:    "multiple roots",
		},
		{
			name: "multiple successors",
			database: newMemoryCatalogDatabase(
				storedMigrationFrom(testMigration(1, nil, "first")),
				storedMigrationFrom(testMigration(2, uintPointer(1), "second")),
				storedMigrationFrom(testMigration(3, uintPointer(1), "third")),
			),
			call: func(driver *catalogSource) error {
				_, err := driver.Next(1)
				return err
			},
			boundary: false,
			issue:    "multiple successors",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			err := tt.call(sourceForTest(t, tt.database))
			if err == nil {
				t.Fatal("source operation error = nil")
			}

			if tt.boundary {
				if !errors.Is(err, os.ErrNotExist) {
					t.Fatalf("source operation error = %v, want os.ErrNotExist", err)
				}

				return
			}

			if errors.Is(err, os.ErrNotExist) {
				t.Fatalf("source operation error = %v, must not be os.ErrNotExist", err)
			}

			var integrityErr *IntegrityError
			if !errors.As(err, &integrityErr) {
				t.Fatalf("source operation error = %v (%T), want *IntegrityError", err, err)
			}

			if !strings.Contains(integrityErr.Issue, tt.issue) {
				t.Fatalf("source operation issue = %q, want %q", integrityErr.Issue, tt.issue)
			}
		})
	}
}

func TestCatalogSourceReadsExactValidatedBodies(t *testing.T) {
	t.Parallel()

	stored := storedMigrationFrom(testMigration(7, nil, "create_widgets"))
	driver := sourceForTest(t, newMemoryCatalogDatabase(stored))

	tests := []struct {
		name     string
		read     func(uint) (io.ReadCloser, string, error)
		wantBody []byte
	}{
		{
			name:     "up",
			read:     driver.ReadUp,
			wantBody: stored.upSQL,
		},
		{
			name:     "down",
			read:     driver.ReadDown,
			wantBody: stored.downSQL,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			reader, identifier, err := tt.read(7)
			if err != nil {
				t.Fatalf("read(7) error = %v", err)
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

			if !bytes.Equal(body, tt.wantBody) {
				t.Fatalf("read(7) body = %q, want %q", body, tt.wantBody)
			}

			if identifier != "create_widgets" {
				t.Fatalf("read(7) identifier = %q, want create_widgets", identifier)
			}
		})
	}
}

func TestCatalogSourceRejectsUnusableBodiesAsIntegrityErrors(t *testing.T) {
	t.Parallel()

	valid := storedMigrationFrom(testMigration(7, nil, "create_widgets"))
	tests := []struct {
		name   string
		stored *storedMigration
		read   func(*catalogSource, uint) (io.ReadCloser, string, error)
		issue  string
	}{
		{
			name:   "missing up row",
			stored: nil,
			read: func(driver *catalogSource, version uint) (io.ReadCloser, string, error) {
				return driver.ReadUp(version)
			},
			issue: "catalog row is missing",
		},
		{
			name: "unsupported format",
			stored: mutateStored(valid, func(stored *storedMigration) {
				stored.formatVersion = 2
			}),
			read: func(driver *catalogSource, version uint) (io.ReadCloser, string, error) {
				return driver.ReadUp(version)
			},
			issue: "unsupported catalog format",
		},
		{
			name: "blank identifier",
			stored: mutateStored(valid, func(stored *storedMigration) {
				stored.identifier = " \t"
			}),
			read: func(driver *catalogSource, version uint) (io.ReadCloser, string, error) {
				return driver.ReadUp(version)
			},
			issue: "identifier is blank",
		},
		{
			name: "blank up body",
			stored: mutateStored(valid, func(stored *storedMigration) {
				stored.upSQL = []byte(" \n\t")
				checksum := sha256.Sum256(stored.upSQL)
				stored.upChecksum = checksum[:]
			}),
			read: func(driver *catalogSource, version uint) (io.ReadCloser, string, error) {
				return driver.ReadUp(version)
			},
			issue: "up migration body is blank",
		},
		{
			name: "blank down body",
			stored: mutateStored(valid, func(stored *storedMigration) {
				stored.downSQL = []byte(" \r\n")
				checksum := sha256.Sum256(stored.downSQL)
				stored.downChecksum = checksum[:]
			}),
			read: func(driver *catalogSource, version uint) (io.ReadCloser, string, error) {
				return driver.ReadDown(version)
			},
			issue: "down migration body is blank",
		},
		{
			name: "short up checksum",
			stored: mutateStored(valid, func(stored *storedMigration) {
				stored.upChecksum = []byte("short")
			}),
			read: func(driver *catalogSource, version uint) (io.ReadCloser, string, error) {
				return driver.ReadUp(version)
			},
			issue: "up checksum has invalid length",
		},
		{
			name: "changed up body",
			stored: mutateStored(valid, func(stored *storedMigration) {
				stored.upSQL = []byte("SELECT 'changed';")
			}),
			read: func(driver *catalogSource, version uint) (io.ReadCloser, string, error) {
				return driver.ReadUp(version)
			},
			issue: "up checksum does not match",
		},
		{
			name: "changed down body",
			stored: mutateStored(valid, func(stored *storedMigration) {
				stored.downSQL = []byte("SELECT 'changed';")
			}),
			read: func(driver *catalogSource, version uint) (io.ReadCloser, string, error) {
				return driver.ReadDown(version)
			},
			issue: "down checksum does not match",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			database := newMemoryCatalogDatabase()
			if tt.stored != nil {
				database.migrations[tt.stored.version] = cloneStoredMigration(*tt.stored)
			}

			driver := sourceForTest(t, database)

			reader, identifier, err := tt.read(driver, 7)
			if err == nil {
				t.Fatal("read(7) error = nil")
			}

			if reader != nil {
				t.Fatalf("read(7) reader = %v, want nil", reader)
			}

			if identifier != "" {
				t.Fatalf("read(7) identifier = %q, want empty", identifier)
			}

			if errors.Is(err, os.ErrNotExist) {
				t.Fatalf("read(7) error = %v, must not be os.ErrNotExist", err)
			}

			var integrityErr *IntegrityError
			if !errors.As(err, &integrityErr) {
				t.Fatalf("read(7) error = %v (%T), want *IntegrityError", err, err)
			}

			if !strings.Contains(integrityErr.Issue, tt.issue) {
				t.Fatalf("read(7) issue = %q, want %q", integrityErr.Issue, tt.issue)
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
	case strings.Contains(query, "previous_version,\n    identifier"):
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
	case strings.Contains(query, "WHERE previous_version IS NULL"):
		versions := make([]uint, 0, len(d.migrations))
		for version, migration := range d.migrations {
			if migration.previousVersion == nil {
				versions = append(versions, version)
			}
		}

		return rowsForVersions(versions, maximumChainRows), nil
	case strings.Contains(query, "WHERE previous_version = $1"):
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
	case strings.Contains(query, "ORDER BY version\nLIMIT 1"):
		versions := make([]uint, 0, len(d.migrations))
		for version := range d.migrations {
			versions = append(versions, version)
		}

		return rowsForVersions(versions, 1), nil
	default:
		return nil, fmt.Errorf("unexpected catalog query: %w", errors.ErrUnsupported)
	}
}

func sourceForTest(t *testing.T, database catalogDatabase) *catalogSource {
	t.Helper()

	catalog, err := newCatalog(t.Context(), database, "app")
	if err != nil {
		t.Fatalf("newCatalog() error = %v", err)
	}

	return newCatalogSource(catalog)
}

func rowsForStoredMigration(migration storedMigration) *stubCatalogRows {
	var previous any
	if migration.previousVersion != nil {
		//nolint:gosec // Test migrations use small constants.
		previous = int64(*migration.previousVersion)
	}

	return &stubCatalogRows{
		rows: [][]any{{
			int64(migration.version), //nolint:gosec // Test migrations use small constants.
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
		rows = append(rows, []any{int64(version)}) //nolint:gosec // See comment above.
	}

	return &stubCatalogRows{rows: rows}
}

func mutateStored(
	original storedMigration,
	mutate func(*storedMigration),
) *storedMigration {
	stored := cloneStoredMigration(original)
	mutate(&stored)

	return &stored
}
