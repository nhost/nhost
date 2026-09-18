package pgmigrate_test

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/lib/pq"
	"github.com/nhost/nhost/internal/lib/pgmigrate"
	"github.com/nhost/nhost/internal/lib/pgmigrate/mock"
	"go.uber.org/mock/gomock"
)

func TestMigratePreparedSchemaCompatibilityMatrix(t *testing.T) {
	t.Parallel()

	database := openBlackBoxTestDatabase(t)
	schema := createBlackBoxTestSchema(t, database)
	older := blackBoxMigrationBundle(schema, 1)
	newer := blackBoxMigrationBundle(schema, 3)
	logger := slog.New(slog.DiscardHandler)

	if err := pgmigrate.Migrate(
		t.Context(),
		logger,
		database,
		older,
		"migrations",
		schema,
	); err != nil {
		t.Fatalf("Migrate(fresh to version 1) error = %v", err)
	}

	assertBlackBoxMigrationState(t, database, schema, 1)
	assertBlackBoxColumnPresence(t, database, schema, "name", false)

	if err := pgmigrate.Migrate(
		t.Context(),
		logger,
		database,
		newer,
		"migrations",
		schema,
	); err != nil {
		t.Fatalf("Migrate(version 1 to version 3) error = %v", err)
	}

	assertBlackBoxMigrationState(t, database, schema, 3)
	assertBlackBoxColumnPresence(t, database, schema, "name", true)
	assertBlackBoxColumnPresence(t, database, schema, "enabled", true)

	if err := pgmigrate.Migrate(
		t.Context(),
		logger,
		database,
		older,
		"migrations",
		schema,
	); err != nil {
		t.Fatalf("Migrate(version 3 to version 1) error = %v", err)
	}

	assertBlackBoxMigrationState(t, database, schema, 1)
	assertBlackBoxColumnPresence(t, database, schema, "name", false)
	assertBlackBoxColumnPresence(t, database, schema, "enabled", false)

	if err := pgmigrate.Migrate(
		t.Context(),
		logger,
		database,
		older,
		"migrations",
		schema,
	); err != nil {
		t.Fatalf("Migrate(same target) error = %v", err)
	}

	assertBlackBoxMigrationState(t, database, schema, 1)

	if inUse := database.Stats().InUse; inUse != 0 {
		t.Fatalf("database connections in use = %d, want 0", inUse)
	}
}

func openBlackBoxTestDatabase(t *testing.T) *sql.DB {
	t.Helper()

	dsn := os.Getenv("PGMIGRATE_TEST_DSN")
	if dsn == "" {
		if os.Getenv("PGMIGRATE_TEST_DATABASE_REQUIRED") != "" {
			t.Fatal("PGMIGRATE_TEST_DATABASE_REQUIRED is set but PGMIGRATE_TEST_DSN is empty")
		}

		t.Skip("set PGMIGRATE_TEST_DSN to run PostgreSQL integration tests")
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

func createBlackBoxTestSchema(t *testing.T, database *sql.DB) string {
	t.Helper()

	digest := sha256.Sum256([]byte(t.Name()))
	schema := fmt.Sprintf("pgmigrate_%x", digest[:8])

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

func blackBoxMigrationBundle(schema string, target uint) fstest.MapFS {
	widgetsRelation := pq.QuoteIdentifier(schema) + "." + pq.QuoteIdentifier("widgets")
	bundle := fstest.MapFS{
		"migrations/1_create_widgets.up.sql": &fstest.MapFile{
			Data: fmt.Appendf(nil, "CREATE TABLE %s (id INTEGER PRIMARY KEY);", widgetsRelation),
		},
		"migrations/1_create_widgets.down.sql": &fstest.MapFile{
			Data: fmt.Appendf(nil, "DROP TABLE %s;", widgetsRelation),
		},
	}

	if target >= 2 {
		bundle["migrations/2_add_name.up.sql"] = &fstest.MapFile{
			Data: fmt.Appendf(nil, "ALTER TABLE %s ADD COLUMN name TEXT;", widgetsRelation),
		}
		bundle["migrations/2_add_name.down.sql"] = &fstest.MapFile{
			Data: fmt.Appendf(nil, "ALTER TABLE %s DROP COLUMN name;", widgetsRelation),
		}
	}

	if target >= 3 {
		bundle["migrations/3_add_enabled.up.sql"] = &fstest.MapFile{
			Data: fmt.Appendf(
				nil,
				"ALTER TABLE %s ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT false;",
				widgetsRelation,
			),
		}
		bundle["migrations/3_add_enabled.down.sql"] = &fstest.MapFile{
			Data: fmt.Appendf(nil, "ALTER TABLE %s DROP COLUMN enabled;", widgetsRelation),
		}
	}

	return bundle
}

func assertBlackBoxMigrationState(
	t *testing.T,
	database *sql.DB,
	schema string,
	wantVersion int,
) {
	t.Helper()

	stateRelation := pq.QuoteIdentifier(schema) + "." + pq.QuoteIdentifier("schema_migrations")

	var (
		version int
		dirty   bool
	)
	if err := database.QueryRowContext(
		t.Context(),
		"SELECT version, dirty FROM "+stateRelation,
	).Scan(&version, &dirty); err != nil {
		t.Fatalf("reading final migration state: %v", err)
	}

	if version != wantVersion || dirty {
		t.Fatalf(
			"final migration state = (%d, %t), want (%d, false)",
			version,
			dirty,
			wantVersion,
		)
	}
}

func assertBlackBoxColumnPresence(
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

func TestMigrateValidatesBeforeAcquiringConnections(t *testing.T) {
	t.Parallel()

	database := mock.NewMockDatabase(gomock.NewController(t))
	valid := fstest.MapFS{
		"migrations/1_first.up.sql":   &fstest.MapFile{Data: []byte("SELECT 1;")},
		"migrations/1_first.down.sql": &fstest.MapFile{Data: []byte("SELECT 2;")},
	}

	tests := []struct {
		name   string
		ctx    func(*testing.T) context.Context
		fsys   fstest.MapFS
		path   string
		schema string
		field  string
	}{
		{
			name: "invalid bundle",
			ctx: func(t *testing.T) context.Context {
				t.Helper()

				return t.Context()
			},
			fsys: fstest.MapFS{
				"migrations/not-a-migration.sql": &fstest.MapFile{Data: []byte("SELECT 1;")},
			},
			path:   "migrations",
			schema: "app",
			field:  "",
		},
		{
			name: "nil context",
			ctx: func(*testing.T) context.Context {
				return nil
			},
			fsys:   valid,
			path:   "migrations",
			schema: "app",
			field:  "context",
		},
		{
			name: "blank schema",
			ctx: func(t *testing.T) context.Context {
				t.Helper()

				return t.Context()
			},
			fsys:   valid,
			path:   "migrations",
			schema: " \t",
			field:  "schema",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			err := pgmigrate.Migrate(
				tt.ctx(t),
				nil,
				database,
				tt.fsys,
				tt.path,
				tt.schema,
			)
			if err == nil {
				t.Fatal("Migrate() error = nil")
			}

			if tt.field == "" {
				if _, ok := errors.AsType[*pgmigrate.BundleError](err); !ok {
					t.Fatalf("Migrate() error = %v (%T), want *BundleError", err, err)
				}

				return
			}

			var configurationErr *pgmigrate.ConfigurationError
			if !errors.As(err, &configurationErr) {
				t.Fatalf("Migrate() error = %v (%T), want *ConfigurationError", err, err)
			}

			if configurationErr.Field != tt.field {
				t.Fatalf(
					"Migrate() configuration field = %q, want %q",
					configurationErr.Field,
					tt.field,
				)
			}
		})
	}
}

func TestMigrateWrapsInitialConnectionFailure(t *testing.T) {
	t.Parallel()

	cause := sql.ErrConnDone
	database := mock.NewMockDatabase(gomock.NewController(t))
	database.EXPECT().Conn(gomock.Any()).Return(nil, cause)

	err := pgmigrate.Migrate(
		t.Context(),
		nil,
		database,
		fstest.MapFS{
			"migrations/1_first.up.sql":   &fstest.MapFile{Data: []byte("SELECT 1;")},
			"migrations/1_first.down.sql": &fstest.MapFile{Data: []byte("SELECT 2;")},
		},
		"migrations",
		"app",
	)
	if !errors.Is(err, cause) {
		t.Fatalf("Migrate() error = %v, want wrapped %v", err, cause)
	}

	if !strings.Contains(err.Error(), "execution connection") {
		t.Fatalf("Migrate() error = %q, want execution connection context", err)
	}
}
