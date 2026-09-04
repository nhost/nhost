package pgmigrate

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"strings"
	"sync"
	"testing"
	"testing/fstest"
	"time"

	"github.com/golang-migrate/migrate/v4"
	migratedatabase "github.com/golang-migrate/migrate/v4/database"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source"
	"github.com/lib/pq"
)

func TestIsOnlyNoChange(t *testing.T) {
	t.Parallel()

	other := sql.ErrConnDone
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{name: "no change", err: migrate.ErrNoChange, want: true},
		{name: "other", err: other, want: false},
		{
			name: "wrapped no change",
			err:  fmt.Errorf("wrapped: %w", migrate.ErrNoChange),
			want: false,
		},
		{
			name: "joined no change and cleanup",
			err:  errors.Join(migrate.ErrNoChange, other),
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := isOnlyNoChange(tt.err); got != tt.want {
				t.Fatalf("isOnlyNoChange(%v) = %t, want %t", tt.err, got, tt.want)
			}
		})
	}
}

func TestMigrationDirection(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		current int
		target  uint
		want    string
	}{
		{name: "fresh", current: migratedatabase.NilVersion, target: 5, want: "up"},
		{name: "upgrade", current: 2, target: 5, want: "up"},
		{name: "same target", current: 5, target: 5, want: "none"},
		{name: "downgrade", current: 10, target: 5, want: "down"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := migrationDirection(tt.current, tt.target); got != tt.want {
				t.Fatalf(
					"migrationDirection(%d, %d) = %q, want %q",
					tt.current,
					tt.target,
					got,
					tt.want,
				)
			}
		})
	}
}

func TestPreflightMigrationPathReadsCompleteDirection(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		current int
		target  uint
		want    []string
	}{
		{
			name:    "fresh",
			current: migratedatabase.NilVersion,
			target:  10,
			want:    []string{"first", "up:2", "next:2", "up:5", "next:5", "up:10"},
		},
		{
			name:    "upgrade",
			current: 2,
			target:  10,
			want:    []string{"up:2", "next:2", "up:5", "next:5", "up:10"},
		},
		{
			name:    "same target",
			current: 10,
			target:  10,
			want:    []string{"up:10"},
		},
		{
			name:    "downgrade",
			current: 10,
			target:  2,
			want: []string{
				"up:10",
				"up:2",
				"prev:10",
				"down:10",
				"prev:5",
				"down:5",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			driver := &recordingMigrationSource{
				versions: []uint{2, 5, 10},
				calls:    nil,
			}
			if err := preflightMigrationPath(driver, tt.current, tt.target); err != nil {
				t.Fatalf("preflightMigrationPath() error = %v", err)
			}

			if fmt.Sprint(driver.calls) != fmt.Sprint(tt.want) {
				t.Fatalf("preflight calls = %v, want %v", driver.calls, tt.want)
			}
		})
	}
}

func TestPreflightSourceServesRunnerWithoutFurtherCatalogCalls(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		current int
		target  uint
	}{
		{name: "fresh", current: migratedatabase.NilVersion, target: 10},
		{name: "upgrade", current: 2, target: 10},
		{name: "same target", current: 10, target: 10},
		{name: "downgrade", current: 10, target: 2},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			upstream := &recordingMigrationSource{versions: []uint{2, 5, 10}}

			prepared := newPreflightSource(upstream)
			if err := preflightMigrationPath(prepared, tt.current, tt.target); err != nil {
				t.Fatalf("first preflightMigrationPath() error = %v", err)
			}

			callsAfterPreflight := len(upstream.calls)

			prepared.seal()

			if err := preflightMigrationPath(prepared, tt.current, tt.target); err != nil {
				t.Fatalf("sealed preflightMigrationPath() error = %v", err)
			}

			if len(upstream.calls) != callsAfterPreflight {
				t.Fatalf(
					"upstream calls after seal = %v, want unchanged count %d",
					upstream.calls,
					callsAfterPreflight,
				)
			}
		})
	}
}

func TestPreflightMigrationPathRejectsNonProgressingLinks(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		current int
		target  uint
		driver  *recordingMigrationSource
		issue   string
	}{
		{
			name:    "successor skips target",
			current: 2,
			target:  5,
			driver: &recordingMigrationSource{
				versions: []uint{2, 10},
			},
			issue: "skips past the target",
		},
		{
			name:    "predecessor skips target",
			current: 10,
			target:  5,
			driver: &recordingMigrationSource{
				versions: []uint{2, 5, 10},
				previousOverrides: map[uint]uint{
					10: 2,
				},
			},
			issue: "skips past the target",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			err := preflightMigrationPath(tt.driver, tt.current, tt.target)
			if err == nil {
				t.Fatal("preflightMigrationPath() error = nil")
			}

			var integrityErr *IntegrityError
			if !errors.As(err, &integrityErr) {
				t.Fatalf("preflightMigrationPath() error = %v (%T), want *IntegrityError", err, err)
			}

			if !strings.Contains(integrityErr.Issue, tt.issue) {
				t.Fatalf("preflight issue = %q, want %q", integrityErr.Issue, tt.issue)
			}
		})
	}
}

func TestSlogAdapter(t *testing.T) {
	t.Parallel()

	var output bytes.Buffer

	logger := slog.New(slog.NewTextHandler(&output, &slog.HandlerOptions{
		AddSource:   false,
		Level:       slog.LevelDebug,
		ReplaceAttr: nil,
	}))
	adapter := newSlogAdapter(t.Context(), logger)

	if !adapter.Verbose() {
		t.Fatal("Verbose() = false for debug-enabled logger")
	}

	adapter.Printf("migration %d complete\n", 5)

	if !strings.Contains(output.String(), "migration 5 complete") {
		t.Fatalf("logger output = %q, want migration message", output.String())
	}
}

func TestMigratePreparedSchemaCompatibilityMatrix(t *testing.T) {
	t.Parallel()

	database := openCatalogTestDatabase(t)
	schema := createCatalogTestSchema(t, database, "")
	older := orchestrationBundle(schema, 1)
	newer := orchestrationBundle(schema, 3)

	if err := Migrate(
		t.Context(),
		discardLogger(),
		database,
		older,
		"migrations",
		schema,
	); err != nil {
		t.Fatalf("Migrate(fresh to N) error = %v", err)
	}

	assertMigrationState(t, database, schema, 1, false)
	assertColumnPresence(t, database, schema, "name", false)

	if err := Migrate(
		t.Context(),
		discardLogger(),
		database,
		newer,
		"migrations",
		schema,
	); err != nil {
		t.Fatalf("Migrate(N to N+1) error = %v", err)
	}

	assertMigrationState(t, database, schema, 3, false)
	assertColumnPresence(t, database, schema, "name", true)
	assertColumnPresence(t, database, schema, "enabled", true)

	if err := Migrate(
		t.Context(),
		discardLogger(),
		database,
		older,
		"migrations",
		schema,
	); err != nil {
		t.Fatalf("Migrate(catalog-only N+1 to N) error = %v", err)
	}

	assertMigrationState(t, database, schema, 1, false)
	assertColumnPresence(t, database, schema, "name", false)
	assertColumnPresence(t, database, schema, "enabled", false)

	if err := Migrate(
		t.Context(),
		discardLogger(),
		database,
		older,
		"migrations",
		schema,
	); err != nil {
		t.Fatalf("Migrate(same target) error = %v", err)
	}

	assertMigrationState(t, database, schema, 1, false)
	assertPoolReleased(t, database)
}

func TestMigrateResetsExecutionSessionBeforeReleasingConnection(t *testing.T) {
	t.Parallel()

	database := openCatalogTestDatabase(t)
	database.SetMaxOpenConns(2)
	database.SetMaxIdleConns(2)
	schema := createCatalogTestSchema(t, database, "")

	var initialApplicationName string
	if err := database.QueryRowContext(
		t.Context(),
		"SHOW application_name",
	).Scan(&initialApplicationName); err != nil {
		t.Fatalf("reading initial application_name: %v", err)
	}

	bundle := migrationFS(map[string]string{
		"1_poison_session.up.sql":   "SET application_name TO 'pgmigrate_poisoned';",
		"1_poison_session.down.sql": "SELECT 1;",
	})
	if err := Migrate(
		t.Context(),
		discardLogger(),
		database,
		bundle,
		"migrations",
		schema,
	); err != nil {
		t.Fatalf("Migrate(session-scoped SET) error = %v", err)
	}

	connections := make([]*sql.Conn, 0, 2)
	t.Cleanup(func() {
		for _, connection := range connections {
			if err := connection.Close(); err != nil {
				t.Errorf("closing session reset probe connection: %v", err)
			}
		}
	})

	for range 2 {
		connection, err := database.Conn(t.Context())
		if err != nil {
			t.Fatalf("acquiring session reset probe connection: %v", err)
		}

		connections = append(connections, connection)

		var applicationName string
		if err := connection.QueryRowContext(
			t.Context(),
			"SHOW application_name",
		).Scan(&applicationName); err != nil {
			t.Fatalf("reading released connection application_name: %v", err)
		}

		if applicationName != initialApplicationName {
			t.Fatalf(
				"released connection application_name = %q, want initial value %q",
				applicationName,
				initialApplicationName,
			)
		}
	}
}

func TestMigrateHydratesExistingStateWithoutReplay(t *testing.T) {
	t.Parallel()

	database := openCatalogTestDatabase(t)
	schema := createCatalogTestSchema(t, database, "")
	bundle := orchestrationBundle(schema, 2)
	connection := schemaConnectionForTest(t, database, schema)

	if _, err := connection.ExecContext(t.Context(), `
CREATE TABLE widgets (id INTEGER PRIMARY KEY);
ALTER TABLE widgets ADD COLUMN name TEXT;
CREATE TABLE schema_migrations (version BIGINT NOT NULL PRIMARY KEY, dirty BOOLEAN NOT NULL);
INSERT INTO schema_migrations (version, dirty) VALUES (2, false);
`); err != nil {
		t.Fatalf("preparing existing schema state: %v", err)
	}

	if err := Migrate(
		t.Context(),
		discardLogger(),
		database,
		bundle,
		"migrations",
		schema,
	); err != nil {
		t.Fatalf("Migrate(existing target) error = %v", err)
	}

	var catalogRows int
	if err := connection.QueryRowContext(
		t.Context(),
		"SELECT count(*) FROM schema_migration_catalog",
	).Scan(&catalogRows); err != nil {
		t.Fatalf("counting hydrated catalog: %v", err)
	}

	if catalogRows != 2 {
		t.Fatalf("catalog row count = %d, want 2", catalogRows)
	}

	assertMigrationState(t, database, schema, 2, false)
}

func TestMigrateRejectsDirtyAndUnknownState(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		version     int
		dirty       bool
		wantDirty   bool
		wantCatalog bool
	}{
		{name: "dirty", version: 1, dirty: true, wantDirty: true, wantCatalog: false},
		{name: "unknown", version: 99, dirty: false, wantDirty: false, wantCatalog: true},
		{name: "invalid negative", version: -2, dirty: false, wantDirty: false, wantCatalog: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			database := openCatalogTestDatabase(t)
			schema := createCatalogTestSchema(t, database, "")
			seedMigrationState(t, database, schema, tt.version, tt.dirty)

			err := Migrate(
				t.Context(),
				discardLogger(),
				database,
				orchestrationBundle(schema, 1),
				"migrations",
				schema,
			)
			if err == nil {
				t.Fatal("Migrate() error = nil")
			}

			var dirtyErr migrate.ErrDirty
			if errors.As(err, &dirtyErr) != tt.wantDirty {
				t.Fatalf(
					"Migrate() dirty error = %v, want %t; error = %v",
					errors.As(err, &dirtyErr),
					tt.wantDirty,
					err,
				)
			}

			if tt.wantCatalog {
				assertCatalogRowCount(t, database, schema, 1)
			}

			assertMigrationState(t, database, schema, tt.version, tt.dirty)
			assertOuterLockAvailable(t, database, schema)
			assertPoolReleased(t, database)
		})
	}
}

func TestMigratePreflightsWholeDowngradeBeforeExecuting(t *testing.T) {
	t.Parallel()

	database := openCatalogTestDatabase(t)
	schema := createCatalogTestSchema(t, database, "")

	newer := orchestrationBundle(schema, 3)
	if err := Migrate(
		t.Context(),
		discardLogger(),
		database,
		newer,
		"migrations",
		schema,
	); err != nil {
		t.Fatalf("Migrate(to version 3) error = %v", err)
	}

	relation := catalogTestRelation(schema)
	updateCatalogForTest(t, database, relation, "down_sql", []byte("SELECT 'tampered';"), 2)

	err := Migrate(
		t.Context(),
		discardLogger(),
		database,
		orchestrationBundle(schema, 1),
		"migrations",
		schema,
	)
	if err == nil {
		t.Fatal("Migrate(corrupt downgrade path) error = nil")
	}

	var integrityErr *IntegrityError
	if !errors.As(err, &integrityErr) {
		t.Fatalf("Migrate() error = %v (%T), want *IntegrityError", err, err)
	}

	assertMigrationState(t, database, schema, 3, false)
	assertColumnPresence(t, database, schema, "name", true)
	assertColumnPresence(t, database, schema, "enabled", true)
	assertOuterLockAvailable(t, database, schema)
}

func TestMigrateSerializesConcurrentCallers(t *testing.T) {
	t.Parallel()

	database := openCatalogTestDatabase(t)
	database.SetMaxOpenConns(8)
	schema := createCatalogTestSchema(t, database, "")
	bundle := orchestrationBundle(schema, 3)

	const callers = 4

	errorsChannel := make(chan error, callers)

	var waitGroup sync.WaitGroup
	for range callers {
		waitGroup.Go(func() {
			errorsChannel <- Migrate(
				t.Context(),
				discardLogger(),
				database,
				bundle,
				"migrations",
				schema,
			)
		})
	}

	waitGroup.Wait()
	close(errorsChannel)

	for err := range errorsChannel {
		if err != nil {
			t.Errorf("concurrent Migrate() error = %v", err)
		}
	}

	assertMigrationState(t, database, schema, 3, false)
	assertCatalogRowCount(t, database, schema, 3)
	assertOuterLockAvailable(t, database, schema)
	assertPoolReleased(t, database)
}

func TestMigrateArchivesUnappliedForkedCatalogUnderLock(t *testing.T) {
	t.Parallel()

	database := openCatalogTestDatabase(t)
	schema := createCatalogTestSchema(t, database, "")

	catalog := sqlCatalogForTest(t, database, schema)
	if err := catalog.bootstrap(); err != nil {
		t.Fatalf("bootstrap() error = %v", err)
	}

	insertStoredMigration(
		t,
		database,
		catalogTestRelation(schema),
		storedMigrationFrom(testMigration(2, nil, "forked_root")),
	)

	if err := Migrate(
		t.Context(),
		discardLogger(),
		database,
		orchestrationBundle(schema, 1),
		"migrations",
		schema,
	); err != nil {
		t.Fatalf("Migrate(forked catalog) error = %v", err)
	}

	assertMigrationState(t, database, schema, 1, false)

	var archived bool

	query := fmt.Sprintf( //nolint:gosec // relation is identifier-quoted.
		"SELECT archived_at IS NOT NULL FROM %s WHERE identifier = $1",
		catalogTestRelation(schema),
	)
	if err := database.QueryRowContext(t.Context(), query, "forked_root").
		Scan(&archived); err != nil {
		t.Fatalf("querying forked row archival: %v", err)
	}

	if !archived {
		t.Fatal("forked row archived = false, want true")
	}

	assertOuterLockAvailable(t, database, schema)
}

func TestMigrateDowngradesBetasThenPublishesSquashedStableVersion(t *testing.T) {
	t.Parallel()

	database := openCatalogTestDatabase(t)
	schema := createCatalogTestSchema(t, database, "")

	if err := Migrate(
		t.Context(),
		discardLogger(),
		database,
		orchestrationBundle(schema, 3),
		"migrations",
		schema,
	); err != nil {
		t.Fatalf("Migrate(beta) error = %v", err)
	}

	if err := Migrate(
		t.Context(),
		discardLogger(),
		database,
		orchestrationBundle(schema, 1),
		"migrations",
		schema,
	); err != nil {
		t.Fatalf("Migrate(previous stable downgrade) error = %v", err)
	}

	assertMigrationState(t, database, schema, 1, false)
	assertColumnPresence(t, database, schema, "name", false)
	assertColumnPresence(t, database, schema, "enabled", false)

	if err := Migrate(
		t.Context(),
		discardLogger(),
		database,
		squashedStableBundle(schema),
		"migrations",
		schema,
	); err != nil {
		t.Fatalf("Migrate(squashed stable) error = %v", err)
	}

	assertMigrationState(t, database, schema, 2, false)
	assertColumnPresence(t, database, schema, "name", true)
	assertColumnPresence(t, database, schema, "enabled", true)

	relation := catalogTestRelation(schema)

	var (
		activeVersionTwo     int
		archivedVersionTwo   int
		archivedVersionThree int
	)

	query := "SELECT\n    count(*) FILTER (WHERE version = 2 AND archived_at IS NULL),\n    count(*) FILTER (WHERE version = 2 AND archived_at IS NOT NULL),\n    count(*) FILTER (WHERE version = 3 AND archived_at IS NOT NULL)\nFROM " + relation
	if err := database.QueryRowContext(t.Context(), query).Scan(
		&activeVersionTwo,
		&archivedVersionTwo,
		&archivedVersionThree,
	); err != nil {
		t.Fatalf("querying reused catalog versions: %v", err)
	}

	if activeVersionTwo != 1 || archivedVersionTwo != 1 || archivedVersionThree != 1 {
		t.Fatalf(
			"catalog lineage counts = active v2 %d, archived v2 %d, archived v3 %d; want 1, 1, 1",
			activeVersionTwo,
			archivedVersionTwo,
			archivedVersionThree,
		)
	}
}

//nolint:paralleltest // Lock timing cases intentionally share one database serially.
func TestMigrateUsesAndReleasesExactUpstreamLock(t *testing.T) {
	// These cases poll pg_stat_activity and therefore intentionally run serially.
	database := openCatalogTestDatabase(t)
	database.SetMaxOpenConns(8)

	tests := []struct {
		name    string
		failure bool
	}{
		{name: "success", failure: false},
		{name: "migration failure", failure: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			schema := createCatalogTestSchema(t, database, "")
			marker := fmt.Sprintf("pgmigrate_lock_%x", sha256.Sum256([]byte(t.Name())))

			statement := fmt.Sprintf("SELECT pg_sleep(1) /* %s */;", marker)
			if tt.failure {
				statement += " SELECT id FROM pgmigrate_missing_relation;"
			} else {
				statement += fmt.Sprintf(
					" CREATE TABLE %s.lock_probe (id INTEGER);",
					pq.QuoteIdentifier(schema),
				)
			}

			bundle := fstest.MapFS{
				"migrations/1_lock.up.sql": &fstest.MapFile{Data: []byte(statement)},
				"migrations/1_lock.down.sql": &fstest.MapFile{Data: fmt.Appendf(
					nil,
					"DROP TABLE IF EXISTS %s.lock_probe;",
					pq.QuoteIdentifier(schema),
				)},
			}

			result := make(chan error, 1)
			go func() {
				result <- Migrate(
					context.Background(),
					discardLogger(),
					database,
					bundle,
					"migrations",
					schema,
				)
			}()

			waitForActiveMigration(t, database, marker)
			assertOuterLockUnavailable(t, database, schema)

			err := <-result
			if (err != nil) != tt.failure {
				t.Fatalf("Migrate() error = %v, want failure %t", err, tt.failure)
			}

			assertOuterLockAvailable(t, database, schema)
			assertPoolReleased(t, database)
		})
	}
}

//nolint:paralleltest // This timeout-sensitive pool test intentionally runs serially.
func TestMigrateBoundsSecondConnectionAcquisition(t *testing.T) {
	database := openCatalogTestDatabase(t)
	database.SetMaxOpenConns(1)
	schema := createCatalogTestSchema(t, database, "")

	started := time.Now()
	err := Migrate(
		t.Context(),
		discardLogger(),
		database,
		orchestrationBundle(schema, 1),
		"migrations",
		schema,
	)
	elapsed := time.Since(started)

	if err == nil {
		t.Fatal("Migrate(MaxOpenConns(1)) error = nil")
	}

	if !strings.Contains(err.Error(), "two dedicated connections") ||
		!strings.Contains(err.Error(), "MaxOpenConns") {
		t.Fatalf("Migrate() error = %q, want actionable two-connection guidance", err)
	}

	if elapsed > sourceConnectionAcquireTimeout+3*time.Second {
		t.Fatalf(
			"Migrate() elapsed = %v, want bounded acquisition near %v",
			elapsed,
			sourceConnectionAcquireTimeout,
		)
	}

	assertPoolReleased(t, database)
}

//nolint:paralleltest // Cluster-global role creation and deletion intentionally run serially.
func TestMigrateWithRestrictedSchemaRole(t *testing.T) {
	// Role creation and deletion are cluster-global and intentionally serial.
	database := openCatalogTestDatabase(t)
	schema := createCatalogTestSchema(t, database, "")
	digest := sha256.Sum256([]byte(t.Name()))
	role := fmt.Sprintf("pgmigrate_role_%x", digest[:6])
	quotedRole := pq.QuoteIdentifier(role)

	if _, err := database.ExecContext(
		t.Context(),
		"CREATE ROLE "+quotedRole+" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT",
	); err != nil {
		t.Fatalf("creating restricted role: %v", err)
	}

	var restricted *sql.DB
	defer func() {
		if restricted != nil {
			if err := restricted.Close(); err != nil {
				t.Errorf("closing restricted database: %v", err)
			}
		}

		if _, err := database.ExecContext(
			context.Background(),
			"DROP OWNED BY "+quotedRole+"; DROP ROLE "+quotedRole,
		); err != nil {
			t.Errorf("dropping restricted role: %v", err)
		}
	}()

	if _, err := database.ExecContext(
		t.Context(),
		"GRANT USAGE, CREATE ON SCHEMA "+pq.QuoteIdentifier(schema)+" TO "+quotedRole,
	); err != nil {
		t.Fatalf("granting schema migration permissions: %v", err)
	}

	dsn := os.Getenv(catalogTestDSNEnvironment) + " user=" + role

	var err error

	restricted, err = sql.Open("postgres", dsn)
	if err != nil {
		t.Fatalf("opening restricted database: %v", err)
	}

	if err := restricted.PingContext(t.Context()); err != nil {
		t.Fatalf("pinging restricted database: %v", err)
	}

	if err := Migrate(
		t.Context(),
		discardLogger(),
		restricted,
		orchestrationBundle(schema, 1),
		"migrations",
		schema,
	); err != nil {
		t.Fatalf("Migrate(restricted role) error = %v", err)
	}

	assertMigrationState(t, restricted, schema, 1, false)
}

type recordingMigrationSource struct {
	versions          []uint
	previousOverrides map[uint]uint
	calls             []string
}

func (s *recordingMigrationSource) Open(string) (source.Driver, error) {
	return s, nil
}

func (s *recordingMigrationSource) Close() error {
	return nil
}

func (s *recordingMigrationSource) First() (uint, error) {
	s.calls = append(s.calls, "first")
	if len(s.versions) == 0 {
		return 0, os.ErrNotExist
	}

	return s.versions[0], nil
}

func (s *recordingMigrationSource) Prev(version uint) (uint, error) {
	s.calls = append(s.calls, fmt.Sprintf("prev:%d", version))
	if previous, found := s.previousOverrides[version]; found {
		return previous, nil
	}

	for index, candidate := range s.versions {
		if candidate == version && index > 0 {
			return s.versions[index-1], nil
		}
	}

	return 0, os.ErrNotExist
}

func (s *recordingMigrationSource) Next(version uint) (uint, error) {
	s.calls = append(s.calls, fmt.Sprintf("next:%d", version))
	for index, candidate := range s.versions {
		if candidate == version && index+1 < len(s.versions) {
			return s.versions[index+1], nil
		}
	}

	return 0, os.ErrNotExist
}

func (s *recordingMigrationSource) ReadUp(version uint) (io.ReadCloser, string, error) {
	s.calls = append(s.calls, fmt.Sprintf("up:%d", version))

	return io.NopCloser(strings.NewReader("SELECT 1;")), "migration", nil
}

func (s *recordingMigrationSource) ReadDown(version uint) (io.ReadCloser, string, error) {
	s.calls = append(s.calls, fmt.Sprintf("down:%d", version))

	return io.NopCloser(strings.NewReader("SELECT 1;")), "migration", nil
}

func orchestrationBundle(schema string, target uint) fstest.MapFS {
	quotedSchema := pq.QuoteIdentifier(schema)
	files := map[string]string{
		"1_create_widgets.up.sql": fmt.Sprintf(
			"CREATE TABLE %s.widgets (id INTEGER PRIMARY KEY);",
			quotedSchema,
		),
		"1_create_widgets.down.sql": fmt.Sprintf(
			"DROP TABLE %s.widgets;",
			quotedSchema,
		),
	}

	if target >= 2 {
		files["2_add_name.up.sql"] = fmt.Sprintf(
			"ALTER TABLE %s.widgets ADD COLUMN name TEXT;",
			quotedSchema,
		)
		files["2_add_name.down.sql"] = fmt.Sprintf(
			"ALTER TABLE %s.widgets DROP COLUMN name;",
			quotedSchema,
		)
	}

	if target >= 3 {
		files["3_add_enabled.up.sql"] = fmt.Sprintf(
			"ALTER TABLE %s.widgets ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT false;",
			quotedSchema,
		)
		files["3_add_enabled.down.sql"] = fmt.Sprintf(
			"ALTER TABLE %s.widgets DROP COLUMN enabled;",
			quotedSchema,
		)
	}

	return migrationFS(files)
}

func squashedStableBundle(schema string) fstest.MapFS {
	quotedSchema := pq.QuoteIdentifier(schema)

	return migrationFS(map[string]string{
		"1_create_widgets.up.sql": fmt.Sprintf(
			"CREATE TABLE %s.widgets (id INTEGER PRIMARY KEY);",
			quotedSchema,
		),
		"1_create_widgets.down.sql": fmt.Sprintf(
			"DROP TABLE %s.widgets;",
			quotedSchema,
		),
		"2_add_name_and_enabled.up.sql": fmt.Sprintf(
			"ALTER TABLE %s.widgets ADD COLUMN name TEXT, "+
				"ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT false;",
			quotedSchema,
		),
		"2_add_name_and_enabled.down.sql": fmt.Sprintf(
			"ALTER TABLE %s.widgets DROP COLUMN enabled, DROP COLUMN name;",
			quotedSchema,
		),
	})
}

func discardLogger() *slog.Logger {
	return slog.New(slog.DiscardHandler)
}

func schemaConnectionForTest(t *testing.T, database *sql.DB, schema string) *sql.Conn {
	t.Helper()

	connection, err := database.Conn(t.Context())
	if err != nil {
		t.Fatalf("acquiring schema-scoped connection: %v", err)
	}

	t.Cleanup(func() {
		if closeErr := connection.Close(); closeErr != nil {
			t.Errorf("closing schema-scoped connection: %v", closeErr)
		}
	})

	if _, err := connection.ExecContext(
		t.Context(),
		"SELECT set_config('search_path', $1, false)",
		schema,
	); err != nil {
		t.Fatalf("setting test search path: %v", err)
	}

	return connection
}

func seedMigrationState(t *testing.T, database *sql.DB, schema string, version int, dirty bool) {
	t.Helper()

	relation := pq.QuoteIdentifier(
		schema,
	) + "." + pq.QuoteIdentifier(
		postgres.DefaultMigrationsTable,
	)
	if _, err := database.ExecContext(
		t.Context(),
		"CREATE TABLE "+relation+" (version BIGINT NOT NULL PRIMARY KEY, dirty BOOLEAN NOT NULL)",
	); err != nil {
		t.Fatalf("creating migration state: %v", err)
	}

	// relation is assembled exclusively from pq.QuoteIdentifier.
	query := "INSERT INTO " + relation + " (version, dirty) VALUES ($1, $2)" //nolint:gosec // The relation is quoted.
	if _, err := database.ExecContext(t.Context(), query, version, dirty); err != nil {
		t.Fatalf("seeding migration state: %v", err)
	}
}

func assertMigrationState(
	t *testing.T,
	database *sql.DB,
	schema string,
	wantVersion int,
	wantDirty bool,
) {
	t.Helper()

	relation := pq.QuoteIdentifier(
		schema,
	) + "." + pq.QuoteIdentifier(
		postgres.DefaultMigrationsTable,
	)

	var (
		version int
		dirty   bool
	)
	if err := database.QueryRowContext(
		t.Context(),
		"SELECT version, dirty FROM "+relation,
	).Scan(&version, &dirty); err != nil {
		t.Fatalf("reading migration state: %v", err)
	}

	if version != wantVersion || dirty != wantDirty {
		t.Fatalf(
			"migration state = (%d, %t), want (%d, %t)",
			version,
			dirty,
			wantVersion,
			wantDirty,
		)
	}
}

func assertColumnPresence(
	t *testing.T,
	database *sql.DB,
	schema string,
	column string,
	want bool,
) {
	t.Helper()

	var found bool
	if err := database.QueryRowContext(t.Context(), `
SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
)
`, schema, "widgets", column).Scan(&found); err != nil {
		t.Fatalf("checking column %s.widgets.%s: %v", schema, column, err)
	}

	if found != want {
		t.Fatalf("column %s.widgets.%s exists = %t, want %t", schema, column, found, want)
	}
}

func assertCatalogRowCount(t *testing.T, database *sql.DB, schema string, want int) {
	t.Helper()

	var count int
	if err := database.QueryRowContext(
		t.Context(),
		"SELECT count(*) FROM "+catalogTestRelation(schema),
	).Scan(&count); err != nil {
		t.Fatalf("counting catalog rows: %v", err)
	}

	if count != want {
		t.Fatalf("catalog row count = %d, want %d", count, want)
	}
}

func assertOuterLockUnavailable(t *testing.T, database *sql.DB, schema string) {
	t.Helper()

	connection, err := database.Conn(t.Context())
	if err != nil {
		t.Fatalf("acquiring lock probe connection: %v", err)
	}

	defer func() {
		if closeErr := connection.Close(); closeErr != nil {
			t.Errorf("closing lock probe connection: %v", closeErr)
		}
	}()

	identifier := advisoryLockIdentifierForTest(t, connection, schema)

	var acquired bool
	if err := connection.QueryRowContext(
		t.Context(),
		"SELECT pg_try_advisory_lock($1)",
		identifier,
	).Scan(&acquired); err != nil {
		t.Fatalf("trying held outer lock: %v", err)
	}

	if acquired {
		var unlocked bool
		if err := connection.QueryRowContext(
			t.Context(),
			"SELECT pg_advisory_unlock($1)",
			identifier,
		).Scan(&unlocked); err != nil {
			t.Fatalf("releasing unexpectedly acquired outer lock: %v", err)
		}

		t.Fatal("outer lock was available during migration")
	}
}

func assertOuterLockAvailable(t *testing.T, database *sql.DB, schema string) {
	t.Helper()

	connection, err := database.Conn(t.Context())
	if err != nil {
		t.Fatalf("acquiring lock probe connection: %v", err)
	}

	defer func() {
		if closeErr := connection.Close(); closeErr != nil {
			t.Errorf("closing lock probe connection: %v", closeErr)
		}
	}()

	identifier := advisoryLockIdentifierForTest(t, connection, schema)

	var acquired bool
	if err := connection.QueryRowContext(
		t.Context(),
		"SELECT pg_try_advisory_lock($1)",
		identifier,
	).Scan(&acquired); err != nil {
		t.Fatalf("trying released outer lock: %v", err)
	}

	if !acquired {
		t.Fatal("outer lock remained held after migration")
	}

	var unlocked bool
	if err := connection.QueryRowContext(
		t.Context(),
		"SELECT pg_advisory_unlock($1)",
		identifier,
	).Scan(&unlocked); err != nil {
		t.Fatalf("releasing lock probe: %v", err)
	}

	if !unlocked {
		t.Fatal("lock probe did not hold acquired lock")
	}
}

func advisoryLockIdentifierForTest(t *testing.T, connection *sql.Conn, schema string) string {
	t.Helper()

	name, err := currentDatabase(t.Context(), connection)
	if err != nil {
		t.Fatalf("currentDatabase() error = %v", err)
	}

	identifier, err := migratedatabase.GenerateAdvisoryLockId(
		name,
		schema,
		postgres.DefaultMigrationsTable,
	)
	if err != nil {
		t.Fatalf("GenerateAdvisoryLockId() error = %v", err)
	}

	return identifier
}

func waitForActiveMigration(t *testing.T, database *sql.DB, marker string) {
	t.Helper()

	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		var active bool
		if err := database.QueryRowContext(t.Context(), `
SELECT EXISTS (
    SELECT 1
    FROM pg_stat_activity
    WHERE state = 'active' AND query LIKE $1
)
`, "%"+marker+"%").Scan(&active); err != nil {
			t.Fatalf("checking active migration: %v", err)
		}

		if active {
			return
		}

		time.Sleep(10 * time.Millisecond)
	}

	t.Fatalf("migration query marker %q did not become active", marker)
}

func assertPoolReleased(t *testing.T, database *sql.DB) {
	t.Helper()

	if inUse := database.Stats().InUse; inUse != 0 {
		t.Fatalf("database connections in use = %d, want 0", inUse)
	}
}
