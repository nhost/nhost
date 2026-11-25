// Package livetest provides shared-stack isolation for AI integration tests.
// Tests must not replace live Hasura metadata or reset the shared database.
package livetest

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/gqlgo/gqlgenc/clientv2"
	_ "github.com/lib/pq" // Register PostgreSQL for standalone live-test consumers.
	"github.com/nhost/nhost/services/ai/hasura"
)

const (
	connectionTimeout = 5 * time.Second
	statementTimeout  = 10 * time.Second
)

func environment(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}

	return fallback
}

// Connect opens the shared dev database and Hasura client. Unavailable services
// fail rather than skip when AI_LIVE_TEST_REQUIRED=1.
func Connect(tb testing.TB) (*sql.DB, *hasura.Client) {
	tb.Helper()

	database, err := sql.Open(
		"postgres",
		environment(
			"POSTGRES_CONNECTION",
			"postgres://postgres:postgres@localhost:5432/local?sslmode=disable",
		),
	)
	if err != nil {
		tb.Fatalf("opening live database: %v", err)
	}

	tb.Cleanup(func() {
		if err := database.Close(); err != nil {
			tb.Errorf("closing live database: %v", err)
		}
	})

	ctx, cancel := context.WithTimeout(tb.Context(), connectionTimeout)
	defer cancel()

	if err := database.PingContext(ctx); err != nil {
		if os.Getenv("AI_LIVE_TEST_REQUIRED") == "1" {
			tb.Fatal("required live database unavailable")
		}

		tb.Skip("optional live database unavailable")
	}

	client := hasura.NewClient(
		http.DefaultClient,
		environment("AI_LIVE_TEST_HASURA_URL", "http://localhost:8080/v1/graphql"),
		&clientv2.Options{ParseDataAlongWithErrors: false, EncodeNilSliceAsEmptyArray: false},
		hasura.WithAdminSecret(
			environment("AI_LIVE_TEST_HASURA_ADMIN_SECRET", "nhost-admin-secret"),
		),
	)

	var metadata any
	if err := client.QueryMetadata(
		ctx,
		map[string]any{"type": "export_metadata", "args": map[string]any{}},
		&metadata,
	); err != nil {
		if os.Getenv("AI_LIVE_TEST_REQUIRED") == "1" {
			tb.Fatal("required live Hasura unavailable")
		}

		tb.Skip("optional live Hasura unavailable")
	}

	return database, client
}

// SuppressedExec executes a parameterized insert or cleanup without waking the
// compose service's event triggers. The dev database role must be a superuser.
func SuppressedExec(tb testing.TB, database *sql.DB, statement string, args ...any) {
	tb.Helper()

	ctx, cancel := context.WithTimeout(context.WithoutCancel(tb.Context()), statementTimeout)
	defer cancel()

	transaction, err := database.BeginTx(ctx, nil)
	if err != nil {
		tb.Fatalf("beginning trigger-suppressed transaction: %v", err)
	}

	defer func() {
		if err := transaction.Rollback(); err != nil && !errors.Is(err, sql.ErrTxDone) {
			tb.Errorf("rolling back trigger-suppressed transaction: %v", err)
		}
	}()

	if _, err := transaction.ExecContext(
		ctx,
		"SET LOCAL session_replication_role = replica",
	); err != nil {
		tb.Fatalf("suppressing event triggers: %v", err)
	}

	if _, err := transaction.ExecContext(ctx, statement, args...); err != nil {
		tb.Fatalf("executing trigger-suppressed statement: %v", err)
	}

	if err := transaction.Commit(); err != nil {
		tb.Fatalf("committing trigger-suppressed transaction: %v", err)
	}
}

// Lock serializes live Hasura tests across packages until test cleanup. Acquire
// it before registering row/table cleanup so cleanup runs while still locked.
func Lock(tb testing.TB, database *sql.DB) {
	tb.Helper()

	connection, err := database.Conn(tb.Context())
	if err != nil {
		tb.Fatalf("opening live-test lock connection: %v", err)
	}

	tb.Cleanup(func() {
		if err := connection.Close(); err != nil {
			tb.Errorf("closing live-test lock connection: %v", err)
		}
	})
	// Stable, distinct from service locks; all live-test packages share this key.
	const key int64 = 7138734940065621
	if _, err := connection.ExecContext(
		tb.Context(),
		"SELECT pg_advisory_lock($1)",
		key,
	); err != nil {
		tb.Fatalf("acquiring live-test lock: %v", err)
	}

	tb.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.WithoutCancel(tb.Context()), connectionTimeout)
		defer cancel()

		if _, err := connection.ExecContext(ctx, "SELECT pg_advisory_unlock($1)", key); err != nil {
			tb.Errorf("releasing live-test lock: %v", err)
		}
	})
}
