package testdb

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"net/url"
	"os"
	"regexp"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	defaultAdminDBURL = "postgresql://postgres:postgres@localhost:5433/postgres"
	maxDBNameLen      = 50
	randomRange       = 100000
)

// postgresDBURL returns the admin database URL for creating/dropping test databases.
func postgresDBURL() string {
	if url := os.Getenv("DATABASE_URL"); url != "" {
		return url
	}

	return defaultAdminDBURL
}

var sanitizeRe = regexp.MustCompile(`[^a-zA-Z0-9_]`)

// generateDBName builds a unique test-DB name from the test name plus a random
// suffix, sanitised to characters Postgres allows in identifiers.
func generateDBName(testName string) string {
	sanitized := sanitizeRe.ReplaceAllString(testName, "_")
	sanitized = strings.ToLower(sanitized)

	if len(sanitized) > maxDBNameLen {
		sanitized = sanitized[:maxDBNameLen]
	}

	//nolint:gosec // math/rand acceptable for test-DB name disambiguation
	return fmt.Sprintf("test_%s_%d", sanitized, rand.IntN(randomRange))
}

// swapDatabaseURL returns connStr with its database (the URL path) replaced by
// dbName, preserving the userinfo and every query-string parameter (sslmode,
// application_name, search_path, pool_*, etc.). Swapping via net/url rather
// than reconstructing the URL from individual fields keeps those parameters
// intact and correctly percent-encodes credentials containing URL-special
// characters like '@' or '/'.
//
// The returned string is what the caller's pool is built from, so
// pool.Config().ConnConfig.ConnString() reflects the test database — consumers
// that re-open a connection from that string (e.g. via postgres.Open) reach
// the seeded test DB, not the admin database.
func swapDatabaseURL(connStr, dbName string) (string, error) {
	u, err := url.Parse(connStr)
	if err != nil {
		return "", fmt.Errorf("parsing connection string: %w", err)
	}

	u.Path = "/" + dbName

	return u.String(), nil
}

// applyDDLAndSeeds opens a setup connection to the test DB, runs the DDL,
// then runs each seed in order. On any failure it tears the test DB down via
// dropDatabase and reports through t.Fatalf.
func applyDDLAndSeeds(t *testing.T, adminURL, testURL, dbName, ddl string, seeds []string) {
	t.Helper()

	setupConn, err := pgx.Connect(t.Context(), testURL)
	if err != nil {
		dropDatabase(t, adminURL, dbName)
		t.Fatalf("testdb: failed to connect to test db %s: %v", dbName, err)
	}

	defer setupConn.Close(t.Context())

	if _, err := setupConn.Exec(t.Context(), ddl); err != nil {
		dropDatabase(t, adminURL, dbName)
		t.Fatalf("testdb: failed to apply DDL to %s: %v", dbName, err)
	}

	for i, seed := range seeds {
		if _, err := setupConn.Exec(t.Context(), seed); err != nil {
			dropDatabase(t, adminURL, dbName)
			t.Fatalf("testdb: failed to apply seed %d to %s: %v", i, dbName, err)
		}
	}
}

// NewPostgres creates an isolated PostgreSQL database with a unique name,
// applies the given DDL and seed SQL, and returns a *pgxpool.Pool connected
// to the new database. The database is dropped on test cleanup.
//
// The test-DB connection string is derived from the admin DATABASE_URL by
// swapping only the database path via [swapDatabaseURL]; the pool is built
// from that string so pool.Config().ConnConfig.ConnString() returns the test
// database. This preserves query-string parameters and avoids the credential
// corruption that reconstructing the URL with fmt.Sprintf would cause.
func NewPostgres(t *testing.T, ddl string, seeds ...string) *pgxpool.Pool {
	t.Helper()

	adminURL := postgresDBURL()
	dbName := generateDBName(t.Name())

	adminConn, err := pgx.Connect(t.Context(), adminURL)
	if err != nil {
		t.Fatalf("testdb: failed to connect to admin db: %v", err)
	}

	if _, err := adminConn.Exec(t.Context(), "CREATE DATABASE "+dbName); err != nil {
		adminConn.Close(t.Context())
		t.Fatalf("testdb: failed to create database %s: %v", dbName, err)
	}

	adminConn.Close(t.Context())

	testURL, err := swapDatabaseURL(adminURL, dbName)
	if err != nil {
		dropDatabase(t, adminURL, dbName)
		t.Fatalf("testdb: failed to build test db url for %s: %v", dbName, err)
	}

	applyDDLAndSeeds(t, adminURL, testURL, dbName, ddl, seeds)

	pool, err := pgxpool.New(t.Context(), testURL)
	if err != nil {
		dropDatabase(t, adminURL, dbName)
		t.Fatalf("testdb: failed to create pool for %s: %v", dbName, err)
	}

	t.Cleanup(func() {
		pool.Close()
		dropDatabase(t, adminURL, dbName)
	})

	return pool
}

// dropDatabase drops the test database, logging a warning on failure.
//
// Cleanup is best-effort: both pg_terminate_backend and DROP DATABASE errors
// are chained with [errors.Join] and emitted as a single log line so the
// causal chain is preserved (e.g. DROP DATABASE failing because backends
// weren't actually terminated shows both errors in one place).
func dropDatabase(t *testing.T, adminURL, dbName string) {
	t.Helper()

	conn, err := pgx.Connect(context.Background(), adminURL)
	if err != nil {
		t.Logf("testdb: warning: failed to connect for cleanup of %s: %v", dbName, err)

		return
	}

	defer conn.Close(context.Background())

	var cleanupErrs []error

	if _, err := conn.Exec(
		context.Background(),
		"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1",
		dbName,
	); err != nil {
		cleanupErrs = append(cleanupErrs, fmt.Errorf("terminating backends: %w", err))
	}

	if _, err := conn.Exec(context.Background(), "DROP DATABASE IF EXISTS "+dbName); err != nil {
		cleanupErrs = append(cleanupErrs, fmt.Errorf("dropping database: %w", err))
	}

	if joined := errors.Join(cleanupErrs...); joined != nil {
		t.Logf("testdb: warning: cleanup of %s failed: %v", dbName, joined)
	}
}
