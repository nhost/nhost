package migrations_test

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"testing"

	"github.com/nhost/nhost/internal/lib/pgmigrate"
	"github.com/nhost/nhost/services/storage/migrations"
)

func TestPostgresMigrationBundleMatchesTarget(t *testing.T) {
	t.Parallel()

	// Validate the on-disk directory so stray non-SQL files omitted by the embed glob cannot bypass validation.
	if err := pgmigrate.ValidateBundle(os.DirFS("."), "postgres", 5); err != nil {
		t.Fatalf("ValidateBundle() error = %v", err)
	}
}

func TestApplyPostgresMigrationPropagatesContextCancellation(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(t.Context())
	cancel()

	err := migrations.ApplyPostgresMigration(ctx, "", slog.New(slog.DiscardHandler))
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("ApplyPostgresMigration() error = %v, want context.Canceled", err)
	}
}
