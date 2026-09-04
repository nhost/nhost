package migrations

import (
	"context"
	"database/sql"
	"errors"
	"io/fs"
	"log/slog"
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

type migrationCall struct {
	fsys          fs.FS
	migrationPath string
	schema        string
	target        uint
}

func TestEmbeddedPostgresMigrationBundleMatchesTarget(t *testing.T) {
	t.Parallel()

	if err := pgmigrate.ValidateBundle(
		postgresMigrations,
		postgresMigrationPath,
		postgresMigrationTarget,
	); err != nil {
		t.Fatalf("ValidateBundle() error = %v", err)
	}
}

func TestRunPostgresMigrationDelegatesAndCloses(t *testing.T) {
	t.Parallel()

	ctx := t.Context()
	logger := slog.New(slog.DiscardHandler)
	database := &migrationDatabaseStub{}

	var (
		gotCall        migrationCall
		migrationCalls int
		closeCalls     int
	)

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
			gotTarget uint,
		) error {
			migrationCalls++

			if gotContext != ctx {
				t.Errorf("migration context = %v, want supplied context", gotContext)
			}

			if gotLogger != logger {
				t.Errorf("migration logger = %p, want %p", gotLogger, logger)
			}

			if gotDatabase != database {
				t.Errorf("migration database = %v, want supplied database", gotDatabase)
			}

			gotCall = migrationCall{
				fsys:          gotFS,
				migrationPath: gotPath,
				schema:        gotSchema,
				target:        gotTarget,
			}

			return nil
		},
	)
	if err != nil {
		t.Fatalf("runPostgresMigration() error = %v", err)
	}

	if migrationCalls != 1 {
		t.Errorf("migration calls = %d, want 1", migrationCalls)
	}

	if closeCalls != 1 {
		t.Errorf("close calls = %d, want 1", closeCalls)
	}

	body, readErr := fs.ReadFile(
		gotCall.fsys,
		"postgres/000005_add-viruses-table.up.sql",
	)
	if readErr != nil {
		t.Errorf("reading delegated migration filesystem: %v", readErr)
	} else if len(body) == 0 {
		t.Error("delegated migration filesystem contains an empty target migration")
	}

	if gotCall.migrationPath != postgresMigrationPath {
		t.Errorf(
			"migration path = %q, want %q",
			gotCall.migrationPath,
			postgresMigrationPath,
		)
	}

	if gotCall.schema != schemaName {
		t.Errorf("migration schema = %q, want %q", gotCall.schema, schemaName)
	}

	if gotCall.target != postgresMigrationTarget {
		t.Errorf(
			"migration target = %d, want %d",
			gotCall.target,
			postgresMigrationTarget,
		)
	}
}

func TestRunPostgresMigrationReturnsErrors(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		migrationErr error
		closeErr     error
		wantErrors   []error
	}{
		{
			name:         "success",
			migrationErr: nil,
			closeErr:     nil,
			wantErrors:   nil,
		},
		{
			name:         "migration fails",
			migrationErr: errMigrationFailure,
			closeErr:     nil,
			wantErrors:   []error{errMigrationFailure},
		},
		{
			name:         "close fails",
			migrationErr: nil,
			closeErr:     errCloseFailure,
			wantErrors:   []error{errCloseFailure},
		},
		{
			name:         "migration and close fail",
			migrationErr: errMigrationFailure,
			closeErr:     errCloseFailure,
			wantErrors:   []error{errMigrationFailure, errCloseFailure},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			err := runPostgresMigration(
				t.Context(),
				slog.New(slog.DiscardHandler),
				&migrationDatabaseStub{},
				func() error {
					return tt.closeErr
				},
				func(
					context.Context,
					*slog.Logger,
					pgmigrate.Database,
					fs.FS,
					string,
					string,
					uint,
				) error {
					return tt.migrationErr
				},
			)

			if len(tt.wantErrors) == 0 && err != nil {
				t.Fatalf("runPostgresMigration() error = %v", err)
			}

			for _, wantErr := range tt.wantErrors {
				if !errors.Is(err, wantErr) {
					t.Errorf("runPostgresMigration() error = %v, want %v", err, wantErr)
				}
			}
		})
	}
}
