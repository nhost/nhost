package migrations

import (
	"database/sql"
	"log/slog"
	"testing"
	"time"

	"github.com/nhost/nhost/internal/lib/pgmigrate"
)

func TestFileCleanupTrigger(t *testing.T) {
	t.Parallel()

	const fileID = "00000000-0000-0000-0000-000000000001"

	tests := []struct {
		name      string
		statement string
		wantRows  int
	}{
		{
			name:      "direct deletion",
			statement: "DELETE FROM storage.files WHERE id = $1",
			wantRows:  1,
		},
		{
			name:      "bucket cascade",
			statement: "DELETE FROM storage.buckets WHERE id = 'cleanup-test' AND $1::uuid IS NOT NULL",
			wantRows:  1,
		},
		{
			name:      "rollback does not enqueue deletion",
			statement: "DELETE FROM storage.files WHERE id = $1",
			wantRows:  0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			database := prepareCleanupTestDatabase(t)
			if _, err := database.ExecContext(t.Context(), `
INSERT INTO storage.buckets (id) VALUES ('cleanup-test');
INSERT INTO storage.files (id, bucket_id) VALUES ('`+fileID+`', 'cleanup-test');
`); err != nil {
				t.Fatalf("insert file: %v", err)
			}

			transaction, err := database.BeginTx(t.Context(), nil)
			if err != nil {
				t.Fatalf("begin deletion: %v", err)
			}

			if _, err := transaction.ExecContext(t.Context(), tt.statement, fileID); err != nil {
				if rollbackErr := transaction.Rollback(); rollbackErr != nil {
					t.Errorf("rollback deletion: %v", rollbackErr)
				}

				t.Fatalf("delete file: %v", err)
			}

			if tt.wantRows == 0 {
				if err := transaction.Rollback(); err != nil {
					t.Fatalf("rollback deletion: %v", err)
				}
			} else if err := transaction.Commit(); err != nil {
				t.Fatalf("commit deletion: %v", err)
			}

			var count int
			if err := database.QueryRowContext(t.Context(),
				"SELECT count(*) FROM storage.files_to_delete WHERE id = $1", fileID,
			).Scan(&count); err != nil {
				t.Fatalf("read cleanup queue: %v", err)
			}

			if count != tt.wantRows {
				t.Errorf("queued deletions = %d, want %d", count, tt.wantRows)
			}
		})
	}
}

func TestFileCleanupTriggerRefreshesExistingEntry(t *testing.T) {
	t.Parallel()

	database := prepareCleanupTestDatabase(t)

	const fileID = "00000000-0000-0000-0000-000000000002"
	if _, err := database.ExecContext(t.Context(), `
INSERT INTO storage.files_to_delete (id, deleted_at) VALUES ($1, now() - interval '2 days')
`, fileID); err != nil {
		t.Fatalf("insert old cleanup entry: %v", err)
	}

	if _, err := database.ExecContext(
		t.Context(),
		"INSERT INTO storage.files (id) VALUES ($1)",
		fileID,
	); err != nil {
		t.Fatalf("recreate file metadata: %v", err)
	}

	if _, err := database.ExecContext(
		t.Context(),
		"DELETE FROM storage.files WHERE id = $1",
		fileID,
	); err != nil {
		t.Fatalf("delete file again: %v", err)
	}

	var deletedAt time.Time
	if err := database.QueryRowContext(t.Context(),
		"SELECT deleted_at FROM storage.files_to_delete WHERE id = $1", fileID,
	).Scan(&deletedAt); err != nil {
		t.Fatalf("read refreshed cleanup entry: %v", err)
	}

	if deletedAt.Before(time.Now().Add(-time.Minute)) {
		t.Errorf("refreshed deletion timestamp = %v, want current time", deletedAt)
	}
}

func prepareCleanupTestDatabase(t *testing.T) *sql.DB {
	t.Helper()

	database := openPostgresMigrationTestDatabase(t)
	if _, err := database.ExecContext(
		t.Context(),
		"CREATE SCHEMA storage; CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public",
	); err != nil {
		t.Fatalf("create storage schema: %v", err)
	}

	if err := pgmigrate.Migrate(t.Context(), slog.New(slog.DiscardHandler), database,
		postgresMigrations, postgresMigrationPath, schemaName,
	); err != nil {
		t.Fatalf("apply storage migrations: %v", err)
	}

	return database
}
