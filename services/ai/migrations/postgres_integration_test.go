//go:build integration

package migrations_test

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"io/fs"
	"log/slog"
	"net/url"
	"os"
	"path"
	"testing"
	"testing/fstest"

	migratedatabase "github.com/golang-migrate/migrate/v4/database"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source"
	"github.com/lib/pq"
	"github.com/nhost/nhost/internal/lib/pgmigrate"
	"github.com/nhost/nhost/services/ai/migrations"
)

const defaultAIMigrationTestDSN = "postgres://postgres:postgres@localhost:5432/local?sslmode=disable"

//nolint:paralleltest // These integration cases intentionally replace the shared AI schema serially.
func TestPostgresMigrationIntegration(t *testing.T) {
	database, dsn := openAIMigrationTestDatabase(t)
	logger := slog.New(slog.DiscardHandler)

	t.Run("service creates schema and applies real bundle", func(t *testing.T) {
		resetAISchema(t, database)

		if err := migrations.ApplyPostgresMigration(t.Context(), dsn, logger); err != nil {
			t.Fatalf("ApplyPostgresMigration() error = %v", err)
		}

		assertAISchemaExists(t, database)
		assertAIMigrationState(t, database, 7)
		assertAICatalogRows(t, database, 7)
		assertExtensionsInstalled(t, database, "vector", "http", "pg_jsonschema")
	})

	t.Run("real bundle releases exact lock after set role", func(t *testing.T) {
		resetAISchema(t, database)
		createAISchema(t, database)

		if err := pgmigrate.Migrate(
			t.Context(),
			logger,
			database,
			os.DirFS("."),
			"postgres",
			"ai",
			7,
		); err != nil {
			t.Fatalf("pgmigrate.Migrate(real AI bundle) error = %v", err)
		}

		assertExactAIMigrationLockAvailable(t, dsn)

		if inUse := database.Stats().InUse; inUse != 0 {
			t.Fatalf("migration pool in-use connections = %d, want 0", inUse)
		}
	})

	t.Run("existing state hydrates catalog without replay", func(t *testing.T) {
		resetAISchema(t, database)

		if err := migrations.ApplyPostgresMigration(t.Context(), dsn, logger); err != nil {
			t.Fatalf("initial ApplyPostgresMigration() error = %v", err)
		}

		executeAIMigrationSQL(t.Context(), t, database, `
INSERT INTO ai.agent_providers (value, comment)
VALUES ('phase-six-hydration-sentinel', 'must survive catalog hydration');
DROP TABLE ai.schema_migration_catalog;
`)

		if err := migrations.ApplyPostgresMigration(t.Context(), dsn, logger); err != nil {
			t.Fatalf("hydrating ApplyPostgresMigration() error = %v", err)
		}

		var sentinelRows int
		if err := database.QueryRowContext(t.Context(), `
SELECT count(*)
FROM ai.agent_providers
WHERE value = 'phase-six-hydration-sentinel'
`).Scan(&sentinelRows); err != nil {
			t.Fatalf("counting hydration sentinel rows: %v", err)
		}

		if sentinelRows != 1 {
			t.Fatalf("hydration sentinel rows = %d, want 1", sentinelRows)
		}

		assertAIMigrationState(t, database, 7)
		assertAICatalogRows(t, database, 7)
	})

	t.Run("service downgrades newer catalog to target", func(t *testing.T) {
		resetAISchema(t, database)

		if err := migrations.ApplyPostgresMigration(t.Context(), dsn, logger); err != nil {
			t.Fatalf("initial ApplyPostgresMigration() error = %v", err)
		}

		futureBundle := realAIMigrationBundleThrough(t, 7)
		futureBundle["postgres/000008_phase_six_future.up.sql"] = &fstest.MapFile{
			Data: []byte("CREATE TABLE ai.phase_six_future_probe (id INTEGER PRIMARY KEY);"),
		}
		futureBundle["postgres/000008_phase_six_future.down.sql"] = &fstest.MapFile{
			Data: []byte("DROP TABLE ai.phase_six_future_probe;"),
		}

		if err := pgmigrate.Migrate(
			t.Context(),
			logger,
			database,
			futureBundle,
			"postgres",
			"ai",
			8,
		); err != nil {
			t.Fatalf("pgmigrate.Migrate(to future version) error = %v", err)
		}

		assertAIMigrationState(t, database, 8)
		assertAIRelationExists(t, database, "ai.phase_six_future_probe", true)

		if err := migrations.ApplyPostgresMigration(t.Context(), dsn, logger); err != nil {
			t.Fatalf("downgrading ApplyPostgresMigration() error = %v", err)
		}

		assertAIMigrationState(t, database, 7)
		assertAICatalogRows(t, database, 8)
		assertAIRelationExists(t, database, "ai.phase_six_future_probe", false)
	})

	t.Run("retention downs execute and older state converges to target", func(t *testing.T) {
		resetAISchema(t, database)

		if err := migrations.ApplyPostgresMigration(t.Context(), dsn, logger); err != nil {
			t.Fatalf("initial ApplyPostgresMigration() error = %v", err)
		}

		if err := pgmigrate.Migrate(
			t.Context(),
			logger,
			database,
			realAIMigrationBundleThrough(t, 4),
			"postgres",
			"ai",
			4,
		); err != nil {
			t.Fatalf("pgmigrate.Migrate(through extension retention down) error = %v", err)
		}

		assertAIMigrationState(t, database, 4)
		assertExtensionsInstalled(t, database, "pg_jsonschema")

		firstRetentionDown, err := os.ReadFile("postgres/000001_extensions.down.sql")
		if err != nil {
			t.Fatalf("reading migration 1 retention down: %v", err)
		}

		executeAIMigrationSQL(t.Context(), t, database, string(firstRetentionDown))

		assertExtensionsInstalled(t, database, "vector", "http", "pg_jsonschema")

		if err := migrations.ApplyPostgresMigration(t.Context(), dsn, logger); err != nil {
			t.Fatalf("upgrading ApplyPostgresMigration() error = %v", err)
		}

		assertAIMigrationState(t, database, 7)
		assertExtensionsInstalled(t, database, "vector", "http", "pg_jsonschema")
	})
}

func openAIMigrationTestDatabase(t *testing.T) (*sql.DB, string) {
	t.Helper()

	adminDSN := os.Getenv("POSTGRES_CONNECTION")
	if adminDSN == "" {
		adminDSN = defaultAIMigrationTestDSN
	}

	adminDatabase, err := sql.Open("postgres", adminDSN)
	if err != nil {
		t.Skip("cannot open PostgreSQL integration server")
	}

	if err := adminDatabase.PingContext(t.Context()); err != nil {
		if closeErr := adminDatabase.Close(); closeErr != nil {
			t.Logf("closing unreachable PostgreSQL integration server: %v", closeErr)
		}

		t.Skip("cannot reach PostgreSQL integration server")
	}

	databaseName := randomAIMigrationTestDatabaseName(t)
	testDSN := postgresDSNWithDatabase(t, adminDSN, databaseName)
	quotedDatabase := pq.QuoteIdentifier(databaseName)
	cleanupContext := context.WithoutCancel(t.Context())

	t.Cleanup(func() {
		result, err := adminDatabase.ExecContext(
			cleanupContext,
			"DROP DATABASE IF EXISTS "+quotedDatabase+" WITH (FORCE)",
		)
		if err != nil {
			t.Errorf("dropping PostgreSQL integration database %q: %v", databaseName, err)
		} else if result == nil {
			t.Errorf(
				"dropping PostgreSQL integration database %q returned a nil result",
				databaseName,
			)
		}

		if err := adminDatabase.Close(); err != nil {
			t.Errorf("closing PostgreSQL integration server: %v", err)
		}
	})

	result, err := adminDatabase.ExecContext(
		t.Context(),
		"CREATE DATABASE "+quotedDatabase,
	)
	if err != nil {
		t.Fatalf("creating PostgreSQL integration database %q: %v", databaseName, err)
	}

	if result == nil {
		t.Fatalf("creating PostgreSQL integration database %q returned a nil result", databaseName)
	}

	database, err := sql.Open("postgres", testDSN)
	if err != nil {
		t.Fatalf("opening PostgreSQL integration database %q: %v", databaseName, err)
	}

	database.SetMaxOpenConns(8)

	t.Cleanup(func() {
		if err := database.Close(); err != nil {
			t.Errorf("closing PostgreSQL integration database: %v", err)
		}
	})

	if err := database.PingContext(t.Context()); err != nil {
		t.Fatalf("connecting to PostgreSQL integration database %q: %v", databaseName, err)
	}

	executeAIMigrationSQL(t.Context(), t, database, `
CREATE SCHEMA auth;
CREATE TABLE auth.users (id UUID PRIMARY KEY);
`)

	return database, testDSN
}

func randomAIMigrationTestDatabaseName(t *testing.T) string {
	t.Helper()

	var suffix [16]byte

	bytesRead, err := rand.Read(suffix[:])
	if err != nil {
		t.Fatalf("generating random PostgreSQL integration database name: %v", err)
	}

	if bytesRead != len(suffix) {
		t.Fatalf("random database name bytes = %d, want %d", bytesRead, len(suffix))
	}

	return "ai_migrations_phase6_" + hex.EncodeToString(suffix[:])
}

func postgresDSNWithDatabase(t *testing.T, dsn, database string) string {
	t.Helper()

	parsed, err := url.Parse(dsn)
	if err != nil {
		t.Fatalf("parsing PostgreSQL integration DSN: %v", err)
	}

	if parsed.Scheme != "postgres" && parsed.Scheme != "postgresql" {
		t.Fatalf("PostgreSQL integration DSN must be a postgres URL, got scheme %q", parsed.Scheme)
	}

	parsed.Path = "/" + database
	parsed.RawPath = ""

	return parsed.String()
}

func resetAISchema(t *testing.T, database *sql.DB) {
	t.Helper()

	executeAIMigrationSQL(t.Context(), t, database, "DROP SCHEMA IF EXISTS ai CASCADE")
}

func createAISchema(t *testing.T, database *sql.DB) {
	t.Helper()

	executeAIMigrationSQL(t.Context(), t, database, "CREATE SCHEMA ai")
}

func executeAIMigrationSQL(
	ctx context.Context,
	t *testing.T,
	database *sql.DB,
	statement string,
) {
	t.Helper()

	result, err := database.ExecContext(ctx, statement)
	if err != nil {
		t.Fatalf("executing AI integration SQL: %v", err)
	}

	if result == nil {
		t.Fatal("executing AI integration SQL returned a nil result")
	}
}

func assertAISchemaExists(t *testing.T, database *sql.DB) {
	t.Helper()

	var exists bool
	if err := database.QueryRowContext(t.Context(), `
SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'ai')
`).Scan(&exists); err != nil {
		t.Fatalf("checking AI schema existence: %v", err)
	}

	if !exists {
		t.Fatal("AI schema does not exist")
	}
}

func assertAIMigrationState(t *testing.T, database *sql.DB, wantVersion int) {
	t.Helper()

	var (
		version int
		dirty   bool
	)
	if err := database.QueryRowContext(
		t.Context(),
		"SELECT version, dirty FROM ai.schema_migrations",
	).Scan(&version, &dirty); err != nil {
		t.Fatalf("reading AI migration state: %v", err)
	}

	if version != wantVersion || dirty {
		t.Fatalf("AI migration state = (%d, %t), want (%d, false)", version, dirty, wantVersion)
	}
}

func assertAICatalogRows(t *testing.T, database *sql.DB, want int) {
	t.Helper()

	var count int
	if err := database.QueryRowContext(
		t.Context(),
		"SELECT count(*) FROM ai.schema_migration_catalog",
	).Scan(&count); err != nil {
		t.Fatalf("counting AI migration catalog rows: %v", err)
	}

	if count != want {
		t.Fatalf("AI migration catalog rows = %d, want %d", count, want)
	}
}

func assertExtensionsInstalled(t *testing.T, database *sql.DB, extensions ...string) {
	t.Helper()

	var installed bool
	if err := database.QueryRowContext(t.Context(), `
SELECT count(*) = cardinality($1::text[])
FROM pg_extension
WHERE extname = ANY($1)
`, pq.Array(extensions)).Scan(&installed); err != nil {
		t.Fatalf("checking extensions %v: %v", extensions, err)
	}

	if !installed {
		t.Errorf("not all expected extensions are installed: %v", extensions)
	}
}

func assertAIRelationExists(
	t *testing.T,
	database *sql.DB,
	relation string,
	want bool,
) {
	t.Helper()

	var exists bool
	if err := database.QueryRowContext(
		t.Context(),
		"SELECT to_regclass($1) IS NOT NULL",
		relation,
	).Scan(&exists); err != nil {
		t.Fatalf("checking relation %q: %v", relation, err)
	}

	if exists != want {
		t.Fatalf("relation %q exists = %t, want %t", relation, exists, want)
	}
}

func realAIMigrationBundleThrough(t *testing.T, maximum uint) fstest.MapFS {
	t.Helper()

	entries, err := os.ReadDir("postgres")
	if err != nil {
		t.Fatalf("reading real AI migration directory: %v", err)
	}

	bundle := make(fstest.MapFS)
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		parsed, parseErr := source.Parse(entry.Name())
		if parseErr != nil {
			t.Fatalf("parsing real AI migration %q: %v", entry.Name(), parseErr)
		}

		if parsed.Version > maximum {
			continue
		}

		migrationPath := path.Join("postgres", entry.Name())

		body, readErr := fs.ReadFile(os.DirFS("."), migrationPath)
		if readErr != nil {
			t.Fatalf("reading real AI migration %q: %v", migrationPath, readErr)
		}

		bundle[migrationPath] = &fstest.MapFile{Data: body}
	}

	return bundle
}

func assertExactAIMigrationLockAvailable(t *testing.T, dsn string) {
	t.Helper()

	probeDatabase, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatalf("opening lock probe database: %v", err)
	}

	probeDatabase.SetMaxOpenConns(1)

	defer func() {
		if closeErr := probeDatabase.Close(); closeErr != nil {
			t.Errorf("closing lock probe database: %v", closeErr)
		}
	}()

	connection, err := probeDatabase.Conn(t.Context())
	if err != nil {
		t.Fatalf("acquiring lock probe connection: %v", err)
	}

	defer func() {
		if closeErr := connection.Close(); closeErr != nil {
			t.Errorf("closing lock probe connection: %v", closeErr)
		}
	}()

	var databaseName string
	if err := connection.QueryRowContext(t.Context(), "SELECT current_database()").
		Scan(&databaseName); err != nil {
		t.Fatalf("reading lock probe database name: %v", err)
	}

	identifier, err := migratedatabase.GenerateAdvisoryLockId(
		databaseName,
		"ai",
		postgres.DefaultMigrationsTable,
	)
	if err != nil {
		t.Fatalf("GenerateAdvisoryLockId() error = %v", err)
	}

	var acquired bool
	if err := connection.QueryRowContext(
		t.Context(),
		"SELECT pg_try_advisory_lock($1)",
		identifier,
	).Scan(&acquired); err != nil {
		t.Fatalf("trying exact AI migration lock: %v", err)
	}

	if !acquired {
		t.Fatal("exact AI migration lock remained held after migration")
	}

	var unlocked bool
	if err := connection.QueryRowContext(
		t.Context(),
		"SELECT pg_advisory_unlock($1)",
		identifier,
	).Scan(&unlocked); err != nil {
		t.Fatalf("releasing exact AI migration lock probe: %v", err)
	}

	if !unlocked {
		t.Fatal("lock probe did not hold the exact AI migration lock")
	}
}
