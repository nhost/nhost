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

	const wrappedSQL = "\\restrict hasura\nSELECT 1;\n\\unrestrict hasura\n"

	tests := []struct {
		name     string
		files    map[string]string
		want     map[string]string
		readOnly bool
	}{
		{
			name: "filters initial up migration",
			files: map[string]string{
				"202610141234_init/up.sql": wrappedSQL,
			},
			want: map[string]string{
				"202610141234_init/up.sql": "SELECT 1;\n",
			},
		},
		{
			name: "empty migrations directory",
		},
		{
			name: "initial migration without up.sql",
			files: map[string]string{
				"202610141234_init/README.md": "No up migration.\n",
			},
			want: map[string]string{
				"202610141234_init/README.md": "No up migration.\n",
			},
		},
		{
			name: "preserves non-init migration",
			files: map[string]string{
				"1700000000000_add_users/up.sql": wrappedSQL,
			},
			want: map[string]string{
				"1700000000000_add_users/up.sql": wrappedSQL,
			},
		},
		{
			name: "requires init suffix",
			files: map[string]string{
				"202610141234_init_extra/up.sql": wrappedSQL,
			},
			want: map[string]string{
				"202610141234_init_extra/up.sql": wrappedSQL,
			},
		},
		{
			name: "preserves initial down migration",
			files: map[string]string{
				"202610141234_init/up.sql":   wrappedSQL,
				"202610141234_init/down.sql": wrappedSQL,
			},
			want: map[string]string{
				"202610141234_init/up.sql":   "SELECT 1;\n",
				"202610141234_init/down.sql": wrappedSQL,
			},
		},
		{
			name: "skips regular file with init suffix",
			files: map[string]string{
				"202610141234_init": wrappedSQL,
			},
			want: map[string]string{
				"202610141234_init": wrappedSQL,
			},
		},
		{
			name: "does not rewrite unchanged read-only migration",
			files: map[string]string{
				"202610141234_init/up.sql": "SELECT 1;\n",
			},
			want: map[string]string{
				"202610141234_init/up.sql": "SELECT 1;\n",
			},
			readOnly: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if tt.readOnly && os.Geteuid() == 0 {
				t.Skip("root can write read-only files")
			}

			migrationsDir := t.TempDir()

			mode := os.FileMode(0o600)
			if tt.readOnly {
				mode = 0o400
			}

			writeMigrationTestFiles(t, migrationsDir, tt.files, mode)

			if err := filterInitMigrationPsqlRestrictions(migrationsDir); err != nil {
				t.Fatalf("filter initial migrations: %v", err)
			}

			for name, want := range tt.want {
				got, err := os.ReadFile(filepath.Join(migrationsDir, name))
				if err != nil {
					t.Fatalf("read migration %q: %v", name, err)
				}

				if string(got) != want {
					t.Errorf("migration %q = %q, want %q", name, got, want)
				}
			}
		})
	}
}

func writeMigrationTestFiles(t *testing.T, dir string, files map[string]string, mode os.FileMode) {
	t.Helper()

	for name, contents := range files {
		path := filepath.Join(dir, name)
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatalf("create migration directory: %v", err)
		}

		if err := os.WriteFile(path, []byte(contents), mode); err != nil {
			t.Fatalf("write migration %q: %v", name, err)
		}
	}
}
