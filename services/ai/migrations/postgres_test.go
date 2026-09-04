package migrations_test

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"strings"
	"testing"

	"github.com/nhost/nhost/internal/lib/pgmigrate"
	"github.com/nhost/nhost/services/ai/migrations"
)

const (
	frozenVectorHTTPRetentionDown = `-- These extensions are database-global and are intentionally retained on AI schema downgrade.
DO $$
BEGIN
  RAISE NOTICE 'retaining database-global extensions vector and http during AI schema downgrade';
END
$$;
`
	frozenJSONSchemaRetentionDown = `-- This extension is database-global and is intentionally retained on AI schema downgrade.
DO $$
BEGIN
  RAISE NOTICE 'retaining database-global extension pg_jsonschema during AI schema downgrade';
END
$$;
`
)

func TestPostgresMigrationBundleMatchesTarget(t *testing.T) {
	t.Parallel()

	// Validate the on-disk directory so stray non-SQL files omitted by the embed glob cannot bypass validation.
	if err := pgmigrate.ValidateBundle(os.DirFS("."), "postgres", 7); err != nil {
		t.Fatalf("ValidateBundle() error = %v", err)
	}
}

func TestLegacyExtensionDownMigrationsRemainExecutableRetentionStatements(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		path       string
		expected   string
		extensions []string
	}{
		{
			name:       "vector and http",
			path:       "postgres/000001_extensions.down.sql",
			expected:   frozenVectorHTTPRetentionDown,
			extensions: []string{"vector", "http"},
		},
		{
			name:       "pg_jsonschema",
			path:       "postgres/000005_extensions.down.sql",
			expected:   frozenJSONSchemaRetentionDown,
			extensions: []string{"pg_jsonschema"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			body, err := os.ReadFile(tt.path)
			if err != nil {
				t.Fatalf("os.ReadFile(%q) error = %v", tt.path, err)
			}

			if issue := frozenRetentionMigrationIssue(
				string(body),
				tt.expected,
				tt.extensions,
			); issue != "" {
				t.Fatalf("retention migration %q: %s", tt.path, issue)
			}
		})
	}
}

func TestFrozenRetentionMigrationRejectsUnsafeReplacements(t *testing.T) {
	t.Parallel()

	genericExceptionBody := strings.ReplaceAll(
		frozenVectorHTTPRetentionDown,
		"END\n$$;",
		"EXCEPTION\n  WHEN OTHERS THEN NULL;\nEND\n$$;",
	)
	destructiveBody := `DO $$
BEGIN
  RAISE NOTICE 'removing vector';
  DROP EXTENSION vector CASCADE;
END
$$;
`

	tests := []struct {
		name       string
		body       string
		expected   string
		extensions []string
	}{
		{
			name:       "block-commented retention body",
			body:       "/*\n" + frozenVectorHTTPRetentionDown + "*/\n",
			expected:   frozenVectorHTTPRetentionDown,
			extensions: []string{"vector", "http"},
		},
		{
			name:       "destructive replacement",
			body:       destructiveBody,
			expected:   destructiveBody,
			extensions: []string{"vector"},
		},
		{
			name:       "generic exception handler",
			body:       genericExceptionBody,
			expected:   genericExceptionBody,
			extensions: []string{"vector", "http"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if issue := frozenRetentionMigrationIssue(
				tt.body,
				tt.expected,
				tt.extensions,
			); issue == "" {
				t.Fatal("frozenRetentionMigrationIssue() issue is empty")
			}
		})
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

func frozenRetentionMigrationIssue(
	body string,
	expected string,
	extensions []string,
) string {
	if body != expected {
		return "body differs from the frozen executable SQL"
	}

	upperBody := strings.ToUpper(body)
	for _, required := range []string{"DO $$", "RAISE NOTICE"} {
		if !strings.Contains(upperBody, required) {
			return "body does not contain required " + required
		}
	}

	for _, extension := range extensions {
		if !strings.Contains(body, extension) {
			return "body does not name extension " + extension
		}
	}

	for _, forbidden := range []string{
		"DROP EXTENSION",
		"CASCADE",
		"SET ROLE",
		"EXCEPTION",
	} {
		if strings.Contains(upperBody, forbidden) {
			return "body contains forbidden " + forbidden
		}
	}

	return ""
}
