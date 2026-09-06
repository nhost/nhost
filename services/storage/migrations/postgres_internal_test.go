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
