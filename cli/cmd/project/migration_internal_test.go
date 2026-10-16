package project

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

func TestStripPsqlRestrictionCommands(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		input []byte
		want  []byte
	}{
		{
			name: "removes pg_dump restriction commands",
			input: []byte("\\restrict hasura\n" +
				"SET transaction_timeout = 0;\n" +
				"SET check_function_bodies = false;\n" +
				"\\unrestrict hasura\n"),
			want: []byte("SET transaction_timeout = 0;\n" +
				"SET check_function_bodies = false;\n"),
		},
		{
			name:  "preserves CRLF line endings",
			input: []byte("\\restrict hasura\r\nSELECT 1;\r\n\\unrestrict hasura\r\n"),
			want:  []byte("SELECT 1;\r\n"),
		},
		{
			name: "preserves other psql commands and SQL",
			input: []byte(
				"\\restricted hasura\n\\set ON_ERROR_STOP on\nSELECT '\\restrict value';\n",
			),
			want: []byte(
				"\\restricted hasura\n\\set ON_ERROR_STOP on\nSELECT '\\restrict value';\n",
			),
		},
		{
			name:  "preserves a final line without a newline",
			input: []byte("\\restrict hasura\nSELECT 1;"),
			want:  []byte("SELECT 1;"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := stripPsqlRestrictionCommands(tt.input)
			if !bytes.Equal(got, tt.want) {
				t.Errorf("stripPsqlRestrictionCommands() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestFilterInitMigrationPsqlRestrictions(t *testing.T) {
	t.Parallel()

	migrationsDir := t.TempDir()

	upPath := filepath.Join(migrationsDir, "202610141234_init", "up.sql")
	if err := os.MkdirAll(filepath.Dir(upPath), 0o755); err != nil {
		t.Fatalf("create migration directory: %v", err)
	}

	input := []byte("\\restrict hasura\nSELECT 1;\n\\unrestrict hasura\n")
	if err := os.WriteFile(upPath, input, 0o600); err != nil {
		t.Fatalf("write migration: %v", err)
	}

	if err := filterInitMigrationPsqlRestrictions(migrationsDir); err != nil {
		t.Fatalf("filter initial migration: %v", err)
	}

	got, err := os.ReadFile(upPath)
	if err != nil {
		t.Fatalf("read filtered migration: %v", err)
	}

	if want := []byte("SELECT 1;\n"); !bytes.Equal(got, want) {
		t.Errorf("filtered migration = %q, want %q", got, want)
	}
}

func TestFilterInitMigrationPsqlRestrictionsWithoutMigration(t *testing.T) {
	t.Parallel()

	if err := filterInitMigrationPsqlRestrictions(t.TempDir()); err != nil {
		t.Fatalf("filter missing initial migration: %v", err)
	}
}
