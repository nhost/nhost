package pgmigrate_test

import (
	"bytes"
	"context"
	"database/sql"
	"embed"
	"errors"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/nhost/nhost/internal/lib/pgmigrate"
)

const demoCleanupTimeout = 5 * time.Second

//go:embed demo/v1/migrations/*.sql demo/v2/migrations/*.sql
var demoMigrations embed.FS

func TestDemoBundles(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		files      fs.FS
		directory  string
		wantTarget uint
	}{
		{
			name:       "v1 embedded",
			files:      demoMigrations,
			directory:  "demo/v1/migrations",
			wantTarget: 1,
		},
		{
			name:       "v1 on disk",
			files:      os.DirFS("."),
			directory:  "demo/v1/migrations",
			wantTarget: 1,
		},
		{
			name:       "v2 embedded",
			files:      demoMigrations,
			directory:  "demo/v2/migrations",
			wantTarget: 2,
		},
		{
			name:       "v2 on disk",
			files:      os.DirFS("."),
			directory:  "demo/v2/migrations",
			wantTarget: 2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			target, err := pgmigrate.ValidateBundle(tt.files, tt.directory)
			if err != nil {
				t.Fatalf("ValidateBundle() error = %v", err)
			}

			if target != tt.wantTarget {
				t.Fatalf("ValidateBundle() target = %d, want %d", target, tt.wantTarget)
			}

			_, err = fs.Stat(tt.files, tt.directory+"/2_add_languages.down.sql")
			if tt.wantTarget == 1 {
				if !errors.Is(err, fs.ErrNotExist) {
					t.Fatalf("v1 contains migration 2 or cannot be inspected: %v", err)
				}
			} else if err != nil {
				t.Fatalf("v2 is missing migration 2: %v", err)
			}
		})
	}
}

func TestDemoSharedMigration(t *testing.T) {
	t.Parallel()

	for _, direction := range []string{"up", "down"} {
		t.Run(direction, func(t *testing.T) {
			t.Parallel()

			filename := "1_create_greetings." + direction + ".sql"

			first, err := demoMigrations.ReadFile("demo/v1/migrations/" + filename)
			if err != nil {
				t.Fatalf("reading v1 migration: %v", err)
			}

			second, err := demoMigrations.ReadFile("demo/v2/migrations/" + filename)
			if err != nil {
				t.Fatalf("reading v2 migration: %v", err)
			}

			if !bytes.Equal(first, second) {
				t.Fatal("migration 1 must remain byte-for-byte identical between builds")
			}
		})
	}
}

type demoState struct {
	version  int
	messages string
	language bool
	archived int
}

//nolint:paralleltest,tparallel // Successive builds deliberately migrate one shared schema in order.
func TestDemoUpgradeAndRollback(t *testing.T) {
	t.Parallel()

	database := openBlackBoxTestDatabase(t)
	if _, err := database.ExecContext(t.Context(), "CREATE SCHEMA hello"); err != nil {
		t.Fatalf(
			"creating demo schema (use a disposable database without an existing hello schema): %v",
			err,
		)
	}

	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.WithoutCancel(t.Context()), demoCleanupTimeout)
		defer cancel()

		if _, err := database.ExecContext(ctx, "DROP SCHEMA hello CASCADE"); err != nil {
			t.Errorf("removing demo schema: %v", err)
		}
	})

	binaries := buildDemoBinaries(t)
	steps := []struct {
		name    string
		version string
		want    demoState
	}{
		{
			name:    "start v1",
			version: "v1",
			want:    demoState{version: 1, messages: "Hello, world!", language: false, archived: 0},
		},
		{
			name:    "upgrade to v2",
			version: "v2",
			want: demoState{
				version:  2,
				messages: "Hello, migrations!|Hola, mundo!",
				language: true,
				archived: 0,
			},
		},
		{
			name:    "roll back to v1",
			version: "v1",
			want:    demoState{version: 1, messages: "Hello, world!", language: false, archived: 1},
		},
		{
			name:    "restart v1 without change",
			version: "v1",
			want:    demoState{version: 1, messages: "Hello, world!", language: false, archived: 1},
		},
		{
			name:    "upgrade again to v2",
			version: "v2",
			want: demoState{
				version:  2,
				messages: "Hello, migrations!|Hola, mundo!",
				language: true,
				archived: 1,
			},
		},
	}

	for _, step := range steps {
		t.Run(step.name, func(t *testing.T) {
			command := exec.CommandContext(t.Context(), filepath.Join(binaries, step.version))
			command.Dir = binaries
			command.Env = append(command.Environ(), "DATABASE_URL="+os.Getenv("PGMIGRATE_TEST_DSN"))

			output, err := command.Output()
			if err != nil {
				t.Fatalf("starting demo %s: %v", step.version, err)
			}

			if strings.TrimSpace(string(output)) != "Hello from "+step.version+"!" {
				t.Fatalf("unexpected demo output: %q", output)
			}

			assertDemoState(t, database, step.want)
		})
	}
}

func buildDemoBinaries(t *testing.T) string {
	t.Helper()

	binaries := t.TempDir()
	for _, version := range []string{"v1", "v2"} {
		command := exec.CommandContext(
			t.Context(),
			"go",
			"build",
			"-o",
			filepath.Join(binaries, version),
			"./demo/"+version,
		)

		if output, err := command.CombinedOutput(); err != nil {
			t.Fatalf("building demo %s: %v\n%s", version, err, output)
		}
	}

	return binaries
}

func assertDemoState(t *testing.T, database *sql.DB, want demoState) {
	t.Helper()

	var (
		got   demoState
		dirty bool
	)

	if err := database.QueryRowContext(t.Context(), `
SELECT
    version,
    dirty,
    (SELECT string_agg(message, '|' ORDER BY id) FROM hello.greetings),
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'hello' AND table_name = 'greetings' AND column_name = 'language'
    ),
    (SELECT count(*) FROM hello.schema_migration_catalog WHERE archived_at IS NOT NULL)
FROM hello.schema_migrations
`).Scan(&got.version, &dirty, &got.messages, &got.language, &got.archived); err != nil {
		t.Fatalf("reading demo state: %v", err)
	}

	if dirty || got != want {
		t.Fatalf("demo state = %+v, dirty = %t; want %+v, clean", got, dirty, want)
	}
}
