package dockercompose //nolint:testpackage

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSanitizeMigrations(t *testing.T) {
	t.Parallel()

	const dump = `--
-- PostgreSQL database dump
--

\restrict aB3dEf9hJkLmNoP0

SET statement_timeout = 0;

CREATE TABLE public.todos (
    id uuid NOT NULL,
    title text NOT NULL
);

\unrestrict aB3dEf9hJkLmNoP0
`

	const want = `--
-- PostgreSQL database dump
--


SET statement_timeout = 0;

CREATE TABLE public.todos (
    id uuid NOT NULL,
    title text NOT NULL
);

`

	migrationsDir := filepath.Join(t.TempDir(), "migrations")
	upSQL := filepath.Join(migrationsDir, "default", "1700000000000_init", "up.sql")

	if err := os.MkdirAll(filepath.Dir(upSQL), 0o755); err != nil {
		t.Fatalf("failed to create migration dir: %v", err)
	}

	if err := os.WriteFile(upSQL, []byte(dump), 0o600); err != nil {
		t.Fatalf("failed to write migration: %v", err)
	}

	if err := SanitizeMigrations(migrationsDir); err != nil {
		t.Fatalf("SanitizeMigrations returned error: %v", err)
	}

	got, err := os.ReadFile(upSQL)
	if err != nil {
		t.Fatalf("failed to read sanitized migration: %v", err)
	}

	if string(got) != want {
		t.Errorf("sanitized migration mismatch:\n got: %q\nwant: %q", string(got), want)
	}
}

func TestSanitizeMigrationsMissingDir(t *testing.T) {
	t.Parallel()

	if err := SanitizeMigrations(filepath.Join(t.TempDir(), "does-not-exist")); err != nil {
		t.Fatalf("expected nil error for missing dir, got: %v", err)
	}
}

func TestMigrationsNeedSanitizing(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		sql  string
		want bool
	}{
		{
			name: "restrict present",
			sql:  "\\restrict abc\nCREATE TABLE public.t (id uuid);\n",
			want: true,
		},
		{
			name: "unrestrict present",
			sql:  "CREATE TABLE public.t (id uuid);\n\\unrestrict abc\n",
			want: true,
		},
		{
			name: "plain sql",
			sql:  "CREATE TABLE public.t (id uuid);\n",
			want: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			migrationsDir := filepath.Join(t.TempDir(), "migrations")
			upSQL := filepath.Join(migrationsDir, "default", "1700000000000_init", "up.sql")

			if err := os.MkdirAll(filepath.Dir(upSQL), 0o755); err != nil {
				t.Fatalf("failed to create migration dir: %v", err)
			}

			if err := os.WriteFile(upSQL, []byte(tc.sql), 0o600); err != nil {
				t.Fatalf("failed to write migration: %v", err)
			}

			got, err := MigrationsNeedSanitizing(migrationsDir)
			if err != nil {
				t.Fatalf("MigrationsNeedSanitizing returned error: %v", err)
			}

			if got != tc.want {
				t.Errorf("MigrationsNeedSanitizing = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestMigrationsNeedSanitizingMissingDir(t *testing.T) {
	t.Parallel()

	got, err := MigrationsNeedSanitizing(filepath.Join(t.TempDir(), "does-not-exist"))
	if err != nil {
		t.Fatalf("expected nil error for missing dir, got: %v", err)
	}

	if got {
		t.Errorf("expected false for missing dir, got true")
	}
}

func TestSanitizeAndApplyScript(t *testing.T) {
	t.Parallel()

	script := sanitizeAndApplyScript("http://graphql:8080")

	for _, want := range []string{
		"mktemp -d",
		"cp -a /app/. ",
		`sed -i -E '/^[[:space:]]*\\(un)?restrict([[:space:]]|$)/d'`,
		"hasura-cli migrate apply --endpoint 'http://graphql:8080' --all-databases",
	} {
		if !strings.Contains(script, want) {
			t.Errorf("script missing %q:\n%s", want, script)
		}
	}

	// The host's bind mount must never be the sed target.
	if strings.Contains(script, "sed -i -E '/^[[:space:]]*\\\\(un)?restrict([[:space:]]|$)/d' /app") {
		t.Errorf("script sanitizes the bind-mounted /app in place:\n%s", script)
	}
}

func TestSanitizeMigrationsLeavesPlainSQLUntouched(t *testing.T) {
	t.Parallel()

	const sql = `CREATE TABLE public.notes (id uuid NOT NULL);
`

	migrationsDir := filepath.Join(t.TempDir(), "migrations")
	upSQL := filepath.Join(migrationsDir, "default", "1700000000000_init", "up.sql")

	if err := os.MkdirAll(filepath.Dir(upSQL), 0o755); err != nil {
		t.Fatalf("failed to create migration dir: %v", err)
	}

	if err := os.WriteFile(upSQL, []byte(sql), 0o600); err != nil {
		t.Fatalf("failed to write migration: %v", err)
	}

	if err := SanitizeMigrations(migrationsDir); err != nil {
		t.Fatalf("SanitizeMigrations returned error: %v", err)
	}

	got, err := os.ReadFile(upSQL)
	if err != nil {
		t.Fatalf("failed to read migration: %v", err)
	}

	if string(got) != sql {
		t.Errorf("plain SQL was modified:\n got: %q\nwant: %q", string(got), sql)
	}
}
