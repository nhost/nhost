//go:build integration

package metadata_test

import (
	"context"
	"database/sql"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
	_ "github.com/lib/pq" // Register the PostgreSQL driver for the integration database.
	"github.com/nhost/nhost/services/storage/metadata"
)

const cleanupHasuraURL = "http://localhost:8080/v1/graphql"

func openCleanupDatabase(t *testing.T) *sql.DB {
	t.Helper()

	database, err := sql.Open("postgres", os.Getenv("PGMIGRATE_TEST_DSN"))
	if err != nil {
		t.Fatalf("open PostgreSQL: %v", err)
	}

	t.Cleanup(func() {
		if err := database.Close(); err != nil {
			t.Errorf("close PostgreSQL: %v", err)
		}
	})

	return database
}

func insertCleanupEntry(t *testing.T, database *sql.DB, id string, deletedAt time.Time) {
	t.Helper()

	if _, err := database.ExecContext(t.Context(),
		"INSERT INTO storage.files_to_delete (id, deleted_at) VALUES ($1, $2)", id, deletedAt,
	); err != nil {
		t.Fatalf("insert cleanup entry: %v", err)
	}

	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if _, err := database.ExecContext(ctx,
			"DELETE FROM storage.files_to_delete WHERE id = $1", id,
		); err != nil {
			t.Errorf("remove test entry: %v", err)
		}
	})
}

func cleanupQueueCount(t *testing.T, database *sql.DB, id string) int {
	t.Helper()

	var count int
	if err := database.QueryRowContext(t.Context(),
		"SELECT count(*) FROM storage.files_to_delete WHERE id = $1", id,
	).Scan(&count); err != nil {
		t.Fatalf("read cleanup queue: %v", err)
	}

	return count
}

//nolint:tparallel // The listing group must finish before acknowledgments mutate its rows.
func TestCleanupQueueIntegration(t *testing.T) {
	t.Parallel()

	database := openCleanupDatabase(t)
	ctx := t.Context()
	before := time.Now().UTC().Truncate(time.Microsecond).Add(-24 * time.Hour)

	ids := []string{
		"00000000-0000-0000-0000-000000000000",
		"00000000-0000-0000-0000-000000000001",
		"00000000-0000-0000-0000-000000000002",
	}
	for i, id := range ids {
		insertCleanupEntry(t, database, id, before.Add(time.Duration(i-1)*time.Hour))
	}

	hasura := metadata.NewHasura(cleanupHasuraURL)
	headers := http.Header{"x-hasura-admin-secret": []string{"nhost-admin-secret"}}

	// Complete the read-only subtests before acknowledgments mutate the queue.
	t.Run("listing", func(t *testing.T) {
		tests := []struct {
			name  string
			after string
			limit int
			want  []string
		}{
			{
				name:  "age includes boundary but excludes recent deletions",
				limit: 100,
				want:  ids[:2],
			},
			{
				name:  "bounded first page includes zero UUID",
				limit: 1,
				want:  ids[:1],
			},
			{
				name:  "exclusive cursor",
				after: ids[0],
				limit: 1,
				want:  ids[1:2],
			},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				t.Parallel()

				files, apiErr := hasura.ListFilesToDelete(ctx, before, tt.after, tt.limit, headers)
				if apiErr != nil {
					t.Fatalf("ListFilesToDelete() error = %v", apiErr)
				}

				got := make([]string, len(files))
				for i, file := range files {
					got[i] = file.ID
				}

				if diff := cmp.Diff(tt.want, got); diff != "" {
					t.Errorf("queued IDs mismatch (-want +got):\n%s", diff)
				}
			})
		}
	})

	if apiErr := hasura.RemoveFileFromCleanup(ctx, ids[2], before, headers); apiErr != nil {
		t.Fatalf("acknowledge older deletion: %v", apiErr)
	}

	if cleanupQueueCount(t, database, ids[2]) != 1 {
		t.Error("acknowledging an old deletion removed a newer entry")
	}

	if apiErr := hasura.RemoveFileFromCleanup(ctx, ids[0], before, headers); apiErr != nil {
		t.Fatalf("acknowledge deletion: %v", apiErr)
	}

	if apiErr := hasura.RemoveFileFromCleanup(ctx, ids[0], before, headers); apiErr != nil {
		t.Fatalf("acknowledge already removed deletion: %v", apiErr)
	}

	if cleanupQueueCount(t, database, ids[0]) != 0 {
		t.Error("acknowledged deletion is still queued")
	}

	if _, apiErr := hasura.ListFilesToDelete(ctx, before, "", 100, nil); apiErr == nil {
		t.Error("cleanup queue is readable without admin credentials")
	}

	if apiErr := hasura.RemoveFileFromCleanup(ctx, ids[1], before, nil); apiErr == nil {
		t.Error("cleanup queue is writable without admin credentials")
	}
}

func TestGraphQLDeletionQueuesCleanup(t *testing.T) {
	t.Parallel()

	database := openCleanupDatabase(t)
	hasura := metadata.NewHasura(cleanupHasuraURL)
	headers := http.Header{"x-hasura-admin-secret": []string{"nhost-admin-secret"}}
	id := uuid.NewString()

	if apiErr := hasura.InitializeFile(
		t.Context(), id, "cleanup-test", 1, "default", "text/plain", headers,
	); apiErr != nil {
		t.Fatalf("initialize file: %v", apiErr)
	}

	if apiErr := hasura.DeleteFileByID(t.Context(), id, headers); apiErr != nil {
		t.Fatalf("delete metadata through GraphQL: %v", apiErr)
	}

	if cleanupQueueCount(t, database, id) != 1 {
		t.Error("GraphQL metadata deletion did not enqueue cleanup")
	}

	if apiErr := hasura.RemoveFileFromCleanup(
		t.Context(), id, time.Now().Add(time.Minute), headers,
	); apiErr != nil {
		t.Fatalf("remove test queue entry: %v", apiErr)
	}
}
