//nolint:testpackage // Exercises the package-private embedded migration bundle against PostgreSQL.
package migrations

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"io/fs"
	"log/slog"
	"net/url"
	"os"
	"path"
	"testing"
	"testing/fstest"

	"github.com/golang-migrate/migrate/v4/source"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/lib/pq"
	"github.com/nhost/nhost/internal/lib/pgmigrate"
	authsql "github.com/nhost/nhost/services/auth/go/sql"
)

// pi-lens-ignore: go-hardcoded-secrets
const authMigrationTestEnvironmentPrefix = "AUTH_MIGRATION_TEST_"

func TestPostgresMigrationFiveRollsBack(t *testing.T) {
	t.Parallel()

	database := openAuthMigrationTestDatabase(t)
	logger := slog.New(slog.DiscardHandler)

	executeAuthMigrationSQL(t, database, "CREATE SCHEMA auth")

	if err := pgmigrate.Migrate(
		t.Context(),
		logger,
		database,
		authMigrationBundleThrough(t, 5),
		postgresMigrationPath,
		schemaName,
	); err != nil {
		t.Fatalf("pgmigrate.Migrate(through version 5) error = %v", err)
	}

	assertAuthMigrationState(t, database, 5)
	assertLegacyAuthMigrationTableAbsent(t, database)
	assertAuthSchemaMigrationsComment(t, database, true)

	if err := pgmigrate.Migrate(
		t.Context(),
		logger,
		database,
		authMigrationBundleThrough(t, 4),
		postgresMigrationPath,
		schemaName,
	); err != nil {
		t.Fatalf("pgmigrate.Migrate(rollback to version 4) error = %v", err)
	}

	assertAuthMigrationState(t, database, 4)
	assertAuthSchemaMigrationsComment(t, database, false)
}

func TestPostgresOIDCIssuerBinding(t *testing.T) {
	t.Parallel()

	database := openAuthMigrationTestDatabase(t)
	executeAuthMigrationSQL(t, database, "CREATE SCHEMA auth")

	logger := slog.New(slog.DiscardHandler)
	run := func(bundle fs.FS) error {
		return pgmigrate.Migrate(
			t.Context(),
			logger,
			database,
			bundle,
			postgresMigrationPath,
			schemaName,
		)
	}

	previous := authMigrationBundleThrough(t, 28)
	if err := run(previous); err != nil {
		t.Fatal(err)
	}

	const issuer = "https://idp.example/application/o/test/"

	userID, identity := seedV28Identity(t, database, issuer)
	if err := run(postgresMigrations); err != nil {
		t.Fatal(err)
	}

	var databaseName string
	if err := database.QueryRowContext(t.Context(), "SELECT current_database()").
		Scan(&databaseName); err != nil {
		t.Fatal(err)
	}

	dsn := authMigrationDSNWithDatabase(
		t,
		os.Getenv(authMigrationTestEnvironmentPrefix+"DSN"),
		databaseName,
	)

	conn, err := pgx.Connect(t.Context(), dsn)
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(func() {
		if err := conn.Close(context.WithoutCancel(t.Context())); err != nil {
			t.Error(err)
		}
	})

	queries := authsql.New(conn)

	assertAuthMigrationState(t, database, 29)
	params := assertOIDCRegistration(t, database, queries, issuer)
	assertOIDCIdentityLookup(t, queries, userID, identity)
	assertOIDCIdentityWrites(t, queries, userID, identity)

	for _, version := range []uint{28, 27} {
		if err := run(authMigrationBundleThrough(t, version)); err != nil {
			t.Fatalf("rollback to version %d: %v", version, err)
		}

		assertAuthMigrationState(t, database, int(version))

		if err := run(postgresMigrations); err != nil {
			t.Fatalf("re-upgrade from version %d: %v", version, err)
		}

		assertAuthMigrationState(t, database, 29)
		assertOIDCIdentityLookup(t, queries, userID, identity)

		if err := queries.RegisterOIDCProviders(t.Context(), params); err != nil {
			t.Fatal(err)
		}
	}
}

func assertOIDCRegistration(
	t *testing.T, database *sql.DB, queries *authsql.Queries, issuer string,
) authsql.RegisterOIDCProvidersParams {
	t.Helper()

	params := authsql.RegisterOIDCProvidersParams{
		ProviderIds: []string{"oidc:test", "oidc:second"},
		Issuers:     []string{issuer, "https://second.example"},
	}
	for range 2 {
		if err := queries.RegisterOIDCProviders(t.Context(), params); err != nil {
			t.Fatal(err)
		}
	}

	var pgErr *pgconn.PgError
	if err := queries.RegisterOIDCProviders(t.Context(), authsql.RegisterOIDCProvidersParams{
		ProviderIds: []string{"oidc:new", "oidc:test"},
		Issuers:     []string{issuer, "https://another.example"},
	}); !errors.As(err, &pgErr) || pgErr.ConstraintName != "user_providers_oidc_issuer_fkey" {
		t.Fatalf("expected issuer change rejection, got %v", err)
	}

	var exists bool
	if err := database.QueryRowContext(t.Context(),
		"SELECT EXISTS(SELECT 1 FROM auth.providers WHERE id = 'oidc:new')",
	).Scan(&exists); err != nil || exists {
		t.Fatalf("registration must be atomic, got exists=%v err=%v", exists, err)
	}

	if err := queries.RegisterOIDCProviders(t.Context(), authsql.RegisterOIDCProvidersParams{
		ProviderIds: []string{"oidc:second"},
		Issuers:     []string{"https://replacement.example"},
	}); err != nil {
		t.Fatalf("an unused slug should accept an issuer change: %v", err)
	}

	return params
}

func seedV28Identity(
	t *testing.T, database *sql.DB, issuer string,
) (uuid.UUID, authsql.GetUserByOIDCIdentityParams) {
	t.Helper()

	userID := uuid.New()
	if _, err := database.ExecContext(t.Context(),
		"INSERT INTO auth.users (id, locale, default_role) VALUES ($1, 'en', 'user')", userID,
	); err != nil {
		t.Fatal(err)
	}

	oldSubject := sha256.Sum256([]byte(issuer + "\x00shared-subject"))

	identity := authsql.GetUserByOIDCIdentityParams{
		ProviderID: "oidc:test",
		Issuer:     authsql.Text(issuer),
		Subject:    hex.EncodeToString(oldSubject[:]),
	}
	if _, err := database.ExecContext(t.Context(),
		"INSERT INTO auth.providers (id, oidc_issuer) VALUES ($1, $2)", identity.ProviderID, issuer,
	); err != nil {
		t.Fatal(err)
	}

	if _, err := database.ExecContext(t.Context(),
		`INSERT INTO auth.user_providers (user_id, provider_id, provider_user_id, access_token)
		 VALUES ($1, $2, $3, 'unset')`,
		userID, identity.ProviderID, identity.Subject,
	); err != nil {
		t.Fatal(err)
	}

	return userID, identity
}

func assertOIDCIdentityLookup(
	t *testing.T,
	queries *authsql.Queries,
	userID uuid.UUID,
	identity authsql.GetUserByOIDCIdentityParams,
) {
	t.Helper()

	if user, err := queries.GetUserByOIDCIdentity(
		t.Context(),
		identity,
	); err != nil ||
		user.ID != userID {
		t.Fatalf("issuer-bound identity lookup failed: %v", err)
	}

	identity.Issuer = authsql.Text("https://another.example")
	if _, err := queries.GetUserByOIDCIdentity(
		t.Context(),
		identity,
	); !errors.Is(
		err,
		pgx.ErrNoRows,
	) {
		t.Fatalf("identity matched across issuers: %v", err)
	}

	if _, err := queries.InsertUserProviderByEmail(
		t.Context(),
		authsql.InsertUserProviderByEmailParams{
			UserID: userID, ProviderID: "google", ProviderUserID: "same-email-different-provider",
		},
	); !errors.Is(
		err,
		pgx.ErrNoRows,
	) {
		t.Fatalf("implicit provider linking was allowed: %v", err)
	}
}

func assertOIDCIdentityWrites(
	t *testing.T,
	queries *authsql.Queries,
	userID uuid.UUID,
	identity authsql.GetUserByOIDCIdentityParams,
) {
	t.Helper()

	for _, tt := range []struct {
		issuer     pgtype.Text
		constraint string
	}{
		{issuer: pgtype.Text{}, constraint: "user_providers_oidc_issuer_check"},
		{issuer: authsql.Text("https://another.example"), constraint: "user_providers_oidc_issuer_fkey"},
	} {
		_, err := queries.InsertUserProvider(t.Context(), authsql.InsertUserProviderParams{
			UserID:         userID,
			ProviderID:     identity.ProviderID,
			ProviderUserID: "invalid",
			Issuer:         tt.issuer,
		})

		var pgErr *pgconn.PgError
		if !errors.As(err, &pgErr) || pgErr.ConstraintName != tt.constraint {
			t.Fatalf("expected issuer constraint %q, got %v", tt.constraint, err)
		}
	}

	provider, err := queries.InsertUserProvider(t.Context(), authsql.InsertUserProviderParams{
		UserID:         userID,
		ProviderID:     identity.ProviderID,
		ProviderUserID: "explicit",
		Issuer:         identity.Issuer,
	})
	if err != nil || provider.Issuer != identity.Issuer {
		t.Fatalf("explicit link did not persist the issuer: %v", err)
	}

	builtin, err := queries.InsertUserProvider(t.Context(), authsql.InsertUserProviderParams{
		UserID:         userID,
		ProviderID:     "google",
		ProviderUserID: "builtin-subject",
		Issuer:         pgtype.Text{},
	})
	if err != nil || builtin.Issuer.Valid {
		t.Fatalf("built-in identity did not retain a NULL issuer: %v", err)
	}
}

func openAuthMigrationTestDatabase(t *testing.T) *sql.DB {
	t.Helper()

	dsnEnvironment := authMigrationTestEnvironmentPrefix + "DSN"
	requiredEnvironment := authMigrationTestEnvironmentPrefix + "DATABASE_REQUIRED"

	adminDSN := os.Getenv(dsnEnvironment)
	if adminDSN == "" {
		if os.Getenv(requiredEnvironment) == "1" {
			t.Fatalf("%s must identify a PostgreSQL test database", dsnEnvironment)
		}

		t.Skipf("%s is not set", dsnEnvironment)
	}

	adminDatabase, err := sql.Open("postgres", adminDSN)
	if err != nil {
		t.Fatalf("opening PostgreSQL integration server: %v", err)
	}

	t.Cleanup(func() {
		if err := adminDatabase.Close(); err != nil {
			t.Errorf("closing PostgreSQL integration server: %v", err)
		}
	})

	if err := adminDatabase.PingContext(t.Context()); err != nil {
		t.Fatalf("connecting to PostgreSQL integration server: %v", err)
	}

	databaseName := randomAuthMigrationTestDatabaseName(t)
	quotedDatabase := pq.QuoteIdentifier(databaseName)

	result, err := adminDatabase.ExecContext(
		t.Context(),
		"CREATE DATABASE "+quotedDatabase,
	)
	if err != nil {
		t.Fatalf("creating PostgreSQL integration database %q: %v", databaseName, err)
	}

	if result == nil {
		t.Fatalf("creating PostgreSQL integration database %q returned no result", databaseName)
	}

	testDSN := authMigrationDSNWithDatabase(t, adminDSN, databaseName)

	database, err := sql.Open("postgres", testDSN)
	if err != nil {
		t.Fatalf("opening PostgreSQL integration database %q: %v", databaseName, err)
	}

	database.SetMaxOpenConns(4)

	if err := database.PingContext(t.Context()); err != nil {
		if closeErr := database.Close(); closeErr != nil {
			t.Errorf("closing unreachable PostgreSQL integration database: %v", closeErr)
		}

		t.Fatalf("connecting to PostgreSQL integration database %q: %v", databaseName, err)
	}

	cleanupContext := context.WithoutCancel(t.Context())
	t.Cleanup(func() {
		if err := database.Close(); err != nil {
			t.Errorf("closing PostgreSQL integration database: %v", err)
		}

		result, err := adminDatabase.ExecContext(
			cleanupContext,
			"DROP DATABASE IF EXISTS "+quotedDatabase+" WITH (FORCE)",
		)
		if err != nil {
			t.Errorf("dropping PostgreSQL integration database %q: %v", databaseName, err)
		} else if result == nil {
			t.Errorf("dropping PostgreSQL integration database %q returned no result", databaseName)
		}
	})

	return database
}

func randomAuthMigrationTestDatabaseName(t *testing.T) string {
	t.Helper()

	suffix, err := uuid.NewRandom()
	if err != nil {
		t.Fatalf("generating random PostgreSQL integration database name: %v", err)
	}

	return "auth_migration_test_" + hex.EncodeToString(suffix[:])
}

func authMigrationDSNWithDatabase(t *testing.T, dsn, database string) string {
	t.Helper()

	parsed, err := url.Parse(dsn)
	if err != nil {
		t.Fatalf("parsing PostgreSQL integration DSN: %v", err)
	}

	if parsed.Scheme != "postgres" && parsed.Scheme != "postgresql" {
		t.Fatalf("PostgreSQL integration DSN must be a URL, got scheme %q", parsed.Scheme)
	}

	parsed.Path = "/" + database
	parsed.RawPath = ""

	return parsed.String()
}

func authMigrationBundleThrough(t *testing.T, maximum uint) fstest.MapFS {
	t.Helper()

	entries, err := fs.ReadDir(postgresMigrations, postgresMigrationPath)
	if err != nil {
		t.Fatalf("reading embedded Auth migration directory: %v", err)
	}

	bundle := make(fstest.MapFS)
	for _, entry := range entries {
		parsed, parseErr := source.Parse(entry.Name())
		if parseErr != nil {
			t.Fatalf("parsing Auth migration %q: %v", entry.Name(), parseErr)
		}

		if parsed.Version > maximum {
			continue
		}

		migrationPath := path.Join(postgresMigrationPath, entry.Name())

		body, readErr := fs.ReadFile(postgresMigrations, migrationPath)
		if readErr != nil {
			t.Fatalf("reading embedded Auth migration %q: %v", migrationPath, readErr)
		}

		bundle[migrationPath] = &fstest.MapFile{Data: body}
	}

	return bundle
}

func executeAuthMigrationSQL(t *testing.T, database *sql.DB, statement string) {
	t.Helper()

	result, err := database.ExecContext(t.Context(), statement)
	if err != nil {
		t.Fatalf("executing Auth integration SQL: %v", err)
	}

	if result == nil {
		t.Fatal("executing Auth integration SQL returned no result")
	}
}

func assertAuthMigrationState(t *testing.T, database *sql.DB, wantVersion int) {
	t.Helper()

	var (
		version int
		dirty   bool
	)
	if err := database.QueryRowContext(
		t.Context(),
		"SELECT version, dirty FROM auth.schema_migrations",
	).Scan(&version, &dirty); err != nil {
		t.Fatalf("reading Auth migration state: %v", err)
	}

	if version != wantVersion || dirty {
		t.Fatalf("Auth migration state = (%d, %t), want (%d, false)", version, dirty, wantVersion)
	}
}

func assertLegacyAuthMigrationTableAbsent(t *testing.T, database *sql.DB) {
	t.Helper()

	var exists bool
	if err := database.QueryRowContext(
		t.Context(),
		"SELECT to_regclass('auth.migrations') IS NOT NULL",
	).Scan(&exists); err != nil {
		t.Fatalf("checking for legacy Auth migration table: %v", err)
	}

	if exists {
		t.Fatal("legacy auth.migrations table unexpectedly exists")
	}
}

func assertAuthSchemaMigrationsComment(t *testing.T, database *sql.DB, wantComment bool) {
	t.Helper()

	var comment sql.NullString
	if err := database.QueryRowContext(
		t.Context(),
		"SELECT obj_description('auth.schema_migrations'::regclass, 'pg_class')",
	).Scan(&comment); err != nil {
		t.Fatalf("reading auth.schema_migrations comment: %v", err)
	}

	if comment.Valid != wantComment {
		t.Fatalf("auth.schema_migrations comment present = %t, want %t", comment.Valid, wantComment)
	}
}
