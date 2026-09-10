package dockercompose //nolint:testpackage

import (
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

// TestSanitizeRealPgDumpFixtures runs the sanitizer over real `pg_dump
// --schema-only` output captured from Postgres 14-18 (see
// testdata/pgdump/README.md). It guards that every version's actual dump
// format is handled: the \restrict/\unrestrict psql meta-commands are detected
// and removed, while every other byte is preserved. The pre-Aug-2025 fixture
// (no directives) must be detected as clean and left untouched.
func TestSanitizeRealPgDumpFixtures(t *testing.T) {
	t.Parallel()

	fixtures, err := filepath.Glob(filepath.Join("testdata", "pgdump", "*.sql"))
	if err != nil {
		t.Fatalf("glob fixtures: %v", err)
	}

	if len(fixtures) == 0 {
		t.Fatal("no pg_dump fixtures found under testdata/pgdump")
	}

	for _, fixture := range fixtures {
		t.Run(filepath.Base(fixture), func(t *testing.T) {
			t.Parallel()
			assertFixtureSanitized(t, fixture)
		})
	}
}

// assertFixtureSanitized writes fixture into a migrations tree, sanitizes it,
// and checks that only the \restrict/\unrestrict lines were dropped, that the
// result is directive-free, and that a second pass is a no-op.
func assertFixtureSanitized(t *testing.T, fixture string) {
	t.Helper()

	orig, err := os.ReadFile(fixture)
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}

	migrationsDir := filepath.Join(t.TempDir(), "migrations")
	upSQL := filepath.Join(migrationsDir, "default", "1700000000000_init", "up.sql")

	if err := os.MkdirAll(filepath.Dir(upSQL), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}

	if err := os.WriteFile(upSQL, orig, 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}

	if err := SanitizeMigrations(migrationsDir); err != nil {
		t.Fatalf("SanitizeMigrations: %v", err)
	}

	got, err := os.ReadFile(upSQL)
	if err != nil {
		t.Fatalf("read sanitized: %v", err)
	}

	if hasRestrictDirective(string(got)) {
		t.Errorf("sanitized output still contains restrict directives:\n%s", got)
	}

	// The only permitted change is dropping the directive lines; every other
	// line must survive byte-for-byte and in order.
	if gotLines, want := strings.Split(
		string(got),
		"\n",
	), keepNonDirectiveLines(
		string(orig),
	); !reflect.DeepEqual(
		gotLines,
		want,
	) {
		t.Errorf("non-directive content changed\n got: %q\nwant: %q", gotLines, want)
	}

	// Idempotent: a second pass leaves the already-clean file unchanged.
	if err := SanitizeMigrations(migrationsDir); err != nil {
		t.Fatalf("second SanitizeMigrations: %v", err)
	}

	after, err := os.ReadFile(upSQL)
	if err != nil {
		t.Fatalf("read after second pass: %v", err)
	}

	if !reflect.DeepEqual(after, got) {
		t.Errorf("second sanitize pass changed the already-clean file")
	}
}

func keepNonDirectiveLines(s string) []string {
	var want []string

	for line := range strings.SplitSeq(s, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, `\restrict`) ||
			strings.HasPrefix(trimmed, `\unrestrict`) {
			continue
		}

		want = append(want, line)
	}

	return want
}

func hasRestrictDirective(s string) bool {
	for line := range strings.SplitSeq(s, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, `\restrict`) ||
			strings.HasPrefix(trimmed, `\unrestrict`) {
			return true
		}
	}

	return false
}

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
