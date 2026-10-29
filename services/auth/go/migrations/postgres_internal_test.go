package migrations

import (
	"context"
	"database/sql"
	"errors"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nhost/nhost/internal/lib/pgmigrate"
)

var (
	errMigrationFailure = errors.New("migration failed")
	errCloseFailure     = errors.New("close failed")
)

type migrationDatabaseStub struct{}

func (*migrationDatabaseStub) Conn(context.Context) (*sql.Conn, error) {
	return nil, sql.ErrConnDone
}

func TestPostgresMigrationBundle(t *testing.T) {
	t.Parallel()

	const wantTarget = 27

	tests := []struct {
		name string
		fsys fs.FS
	}{
		{
			name: "embedded bundle",
			fsys: postgresMigrations,
		},
		{
			name: "source directory",
			fsys: os.DirFS("."),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			target, err := pgmigrate.ValidateBundle(tt.fsys, postgresMigrationPath)
			if err != nil {
				t.Fatalf("ValidateBundle() error = %v", err)
			}

			if target != wantTarget {
				t.Fatalf("ValidateBundle() target = %d, want %d", target, wantTarget)
			}
		})
	}
}

func TestPostgresMigrationBundleRejectsInvalidSourceFixtures(t *testing.T) {
	t.Parallel()

	const targetDownMigration = "00027_user_new_phone_number_index.down.sql"

	tests := []struct {
		name      string
		mutate    func(*os.Root) error
		wantIssue string
	}{
		{
			name: "missing down migration",
			mutate: func(root *os.Root) error {
				return root.Remove(targetDownMigration)
			},
			wantIssue: "missing its down migration",
		},
		{
			name: "blank down migration",
			mutate: func(root *os.Root) error {
				return root.WriteFile(targetDownMigration, []byte(" \n\t\r\n"), 0o600)
			},
			wantIssue: "must contain SQL beyond comments and whitespace",
		},
		{
			name: "file excluded by embed glob",
			mutate: func(root *os.Root) error {
				return root.WriteFile("README.txt", []byte("not a migration"), 0o600)
			},
			wantIssue: "filename does not follow golang-migrate semantics",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			fixtureRoot := copyPostgresMigrationSource(t)
			if err := tt.mutate(openPostgresMigrationSource(t, fixtureRoot)); err != nil {
				t.Fatalf("mutate migration fixture: %v", err)
			}

			target, err := pgmigrate.ValidateBundle(os.DirFS(fixtureRoot), postgresMigrationPath)
			if err == nil {
				t.Fatalf("ValidateBundle() = (%d, nil), want error", target)
			}

			if target != 0 {
				t.Errorf("ValidateBundle() target = %d, want 0 on error", target)
			}

			if !strings.Contains(err.Error(), tt.wantIssue) {
				t.Fatalf("ValidateBundle() error = %q, want issue %q", err, tt.wantIssue)
			}
		})
	}
}

func copyPostgresMigrationSource(t *testing.T) string {
	t.Helper()

	fixtureRoot := t.TempDir()
	if err := os.CopyFS(
		filepath.Join(fixtureRoot, postgresMigrationPath),
		os.DirFS(postgresMigrationPath),
	); err != nil {
		t.Fatalf("copy postgres migration source: %v", err)
	}

	return fixtureRoot
}

func openPostgresMigrationSource(t *testing.T, fixtureRoot string) *os.Root {
	t.Helper()

	migrationRoot, err := os.OpenRoot(filepath.Join(fixtureRoot, postgresMigrationPath))
	if err != nil {
		t.Fatalf("open migration fixture root: %v", err)
	}

	t.Cleanup(func() {
		if closeErr := migrationRoot.Close(); closeErr != nil {
			t.Errorf("close migration fixture root: %v", closeErr)
		}
	})

	return migrationRoot
}

func TestPostgresURLWithDefaultSSLMode(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		postgresURL string
		want        string
	}{
		{
			name:        "adds ssl mode",
			postgresURL: "postgres://postgres:postgres@localhost:5432/local",
			want:        "postgres://postgres:postgres@localhost:5432/local?sslmode=disable",
		},
		{
			name:        "adds ssl mode after existing query parameter",
			postgresURL: "postgres://postgres:postgres@localhost:5432/local?connect_timeout=5",
			want: "postgres://postgres:postgres@localhost:5432/local?" +
				"connect_timeout=5&sslmode=disable",
		},
		{
			name:        "preserves explicit ssl mode",
			postgresURL: "postgres://postgres:postgres@localhost:5432/local?sslmode=require",
			want:        "postgres://postgres:postgres@localhost:5432/local?sslmode=require",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := postgresURLWithDefaultSSLMode(tt.postgresURL); got != tt.want {
				t.Errorf("postgresURLWithDefaultSSLMode() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestRunPostgresMigrationDelegatesAndCloses(t *testing.T) {
	t.Parallel()

	ctx := t.Context()
	logger := slog.New(slog.DiscardHandler)
	database := &migrationDatabaseStub{}
	closeCalls := 0
	migrationCalls := 0

	err := runPostgresMigration(
		ctx,
		logger,
		database,
		func() error {
			closeCalls++

			return nil
		},
		func(
			gotContext context.Context,
			gotLogger *slog.Logger,
			gotDatabase pgmigrate.Database,
			gotFS fs.FS,
			gotPath string,
			gotSchema string,
		) error {
			migrationCalls++

			if gotContext != ctx || gotLogger != logger || gotDatabase != database {
				t.Error("migration did not receive the supplied context, logger, and database")
			}

			if gotFS == nil {
				t.Error("migration filesystem is nil")
			}

			if gotPath != postgresMigrationPath || gotSchema != schemaName {
				t.Errorf(
					"migration config = (%q, %q), want (%q, %q)",
					gotPath,
					gotSchema,
					postgresMigrationPath,
					schemaName,
				)
			}

			return nil
		},
	)
	if err != nil {
		t.Fatalf("runPostgresMigration() error = %v", err)
	}

	if migrationCalls != 1 || closeCalls != 1 {
		t.Errorf(
			"calls = (migration: %d, close: %d), want (migration: 1, close: 1)",
			migrationCalls,
			closeCalls,
		)
	}
}

func TestRunPostgresMigrationJoinsMigrationAndCloseErrors(t *testing.T) {
	t.Parallel()

	err := runPostgresMigration(
		t.Context(),
		slog.New(slog.DiscardHandler),
		&migrationDatabaseStub{},
		func() error { return errCloseFailure },
		func(
			context.Context,
			*slog.Logger,
			pgmigrate.Database,
			fs.FS,
			string,
			string,
		) error {
			return errMigrationFailure
		},
	)

	for _, wantErr := range []error{errMigrationFailure, errCloseFailure} {
		if !errors.Is(err, wantErr) {
			t.Errorf("runPostgresMigration() error = %v, want %v", err, wantErr)
		}
	}
}
