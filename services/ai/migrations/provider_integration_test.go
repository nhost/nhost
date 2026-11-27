//go:build integration

package migrations_test

import (
	"log/slog"
	"strings"
	"testing"

	"github.com/nhost/nhost/internal/lib/pgmigrate"
	"github.com/nhost/nhost/services/ai/migrations"
)

//nolint:paralleltest // Cases share one isolated migration database and migration history.
func TestProviderBackfillIntegration(t *testing.T) {
	database, dsn := openAIMigrationTestDatabase(t)
	logger := slog.New(slog.DiscardHandler)
	migrateTo7 := func() {
		t.Helper()

		if err := pgmigrate.Migrate(
			t.Context(), logger, database, realAIMigrationBundleThrough(t, 7), "postgres", "ai",
		); err != nil {
			t.Fatalf("migrating to 7: %v", err)
		}
	}

	executeAIMigrationSQL(t.Context(), t, database, "CREATE SCHEMA ai")
	migrateTo7()
	executeAIMigrationSQL(t.Context(), t, database, `
		CREATE SCHEMA "Quoted's Schema";
		CREATE TABLE public.provider_sized (embedding vector(768));
		CREATE TABLE "Quoted's Schema"."Quoted Table" ("Vector's Column" vector(512));`)

	// dimensions come from the declared column size, else the model's default.
	tests := []struct {
		name, schema, table, column, model string
		dimensions                         int
	}{
		{"sized", "public", "provider_sized", "embedding", "text-embedding-ada-002", 768},
		{
			"quoted names",
			"Quoted's Schema",
			"Quoted Table",
			"Vector's Column",
			"text-embedding-ada-002",
			512,
		},
		{"missing table", "public", "provider_absent", "embedding", "text-embedding-ada-002", 1536},
		{
			"missing table, large model",
			"public",
			"provider_absent_large",
			"embedding",
			"text-embedding-3-large",
			3072,
		},
	}
	for _, tt := range tests {
		if _, err := database.ExecContext(
			t.Context(),
			`INSERT INTO ai.auto_embeddings_configuration (name,schema_name,table_name,column_name,model)
			 VALUES ($1,$2,$3,$4,$5)`,
			tt.name,
			tt.schema,
			tt.table,
			tt.column,
			tt.model,
		); err != nil {
			t.Fatalf("seeding %s: %v", tt.name, err)
		}
	}

	// Up, down and up again: the down migration fully reverses the up migration.
	if err := migrations.ApplyPostgresMigration(t.Context(), dsn, logger); err != nil {
		t.Fatalf("migrating to 8: %v", err)
	}

	migrateTo7()

	var remaining int
	if err := database.QueryRowContext(t.Context(), `SELECT count(*) FROM information_schema.columns
		WHERE table_schema='ai' AND table_name='auto_embeddings_configuration'
		AND column_name IN ('provider','dimensions','last_error')`).Scan(&remaining); err != nil || remaining != 0 {
		t.Fatalf("down migration left %d columns (%v)", remaining, err)
	}

	if err := migrations.ApplyPostgresMigration(t.Context(), dsn, logger); err != nil {
		t.Fatalf("migrating to 8 again: %v", err)
	}

	assertAIMigrationState(t, database, 8)

	for _, tt := range tests {
		var (
			provider   string
			dimensions int
		)
		if err := database.QueryRowContext(
			t.Context(),
			`SELECT provider, dimensions FROM ai.auto_embeddings_configuration WHERE name=$1`,
			tt.name,
		).Scan(&provider, &dimensions); err != nil || provider != "openai" || dimensions != tt.dimensions {
			t.Errorf(
				"%s: backfill = (%q, %d), want (openai, %d)",
				tt.name,
				provider,
				dimensions,
				tt.dimensions,
			)
		}
	}

	// New rows must supply a provider and dimensions within range.
	for _, invalid := range []struct {
		name       string
		provider   any
		dimensions any
	}{
		{"missing provider", nil, 1536},
		{"provider over 63 bytes", strings.Repeat("a", 64), 1536},
		{"zero dimensions", "openai", 0},
	} {
		if _, err := database.ExecContext(
			t.Context(),
			`INSERT INTO ai.auto_embeddings_configuration (name,schema_name,table_name,column_name,provider,dimensions)
			 VALUES ($1,'public',$1,'embedding',$2,$3)`,
			invalid.name,
			invalid.provider,
			invalid.dimensions,
		); err == nil {
			t.Errorf("%s: invalid configuration accepted", invalid.name)
		}
	}
}
