package migrations

import (
	"context"
	"database/sql"
	"errors"
	"io/fs"
	"log/slog"
	"slices"
	"strings"
	"testing"

	"github.com/nhost/nhost/internal/lib/pgmigrate"
)

var (
	errSchemaCreationFailure = errors.New("schema creation failed")
	errMigrationFailure      = errors.New("migration failed")
	errCloseFailure          = errors.New("close failed")
)

type migrationDatabaseStub struct{}

func (*migrationDatabaseStub) Conn(context.Context) (*sql.Conn, error) {
	return nil, sql.ErrConnDone
}

func TestAgentsMigrationSchema(t *testing.T) {
	t.Parallel()

	up, err := postgresMigrations.ReadFile("postgres/000006_agents.up.sql")
	if err != nil {
		t.Fatalf("read up migration: %v", err)
	}

	upSQL := strings.Join(strings.Fields(string(up)), " ")
	if !strings.Contains(
		upSQL,
		"provider text NOT NULL CHECK (octet_length(provider) BETWEEN 1 AND 63)",
	) {
		t.Errorf("up migration does not bound provider by 1-63 bytes: %q", upSQL)
	}

	for _, forbidden := range []string{"agent_providers", "FOREIGN KEY (provider)"} {
		if strings.Contains(upSQL, forbidden) {
			t.Errorf("up migration unexpectedly contains %q", forbidden)
		}
	}

	down, err := postgresMigrations.ReadFile("postgres/000006_agents.down.sql")
	if err != nil {
		t.Fatalf("read down migration: %v", err)
	}

	if strings.Contains(string(down), "agent_providers") {
		t.Error("down migration unexpectedly drops agent_providers")
	}
}

func TestRunPostgresMigrationCreatesSchemaThenDelegatesAndCloses(t *testing.T) {
	t.Parallel()

	ctx := t.Context()
	logger := slog.New(slog.DiscardHandler)
	database := &migrationDatabaseStub{}
	events := make([]string, 0, 3)

	err := runPostgresMigration(
		ctx,
		logger,
		database,
		func() error {
			events = append(events, "close")

			return nil
		},
		func(gotContext context.Context) error {
			events = append(events, "schema")

			if gotContext != ctx {
				t.Error("schema creation did not receive the supplied context")
			}

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
			events = append(events, "migration")

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

	if want := []string{"schema", "migration", "close"}; !slices.Equal(events, want) {
		t.Errorf("migration events = %v, want %v", events, want)
	}
}

func TestRunPostgresMigrationFailureStillClosesPool(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name           string
		schemaErr      error
		migrationErr   error
		wantMigration  bool
		wantPrimaryErr error
	}{
		{
			name:           "schema creation fails",
			schemaErr:      errSchemaCreationFailure,
			migrationErr:   nil,
			wantMigration:  false,
			wantPrimaryErr: errSchemaCreationFailure,
		},
		{
			name:           "migration fails",
			schemaErr:      nil,
			migrationErr:   errMigrationFailure,
			wantMigration:  true,
			wantPrimaryErr: errMigrationFailure,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			migrationCalls := 0
			closeCalls := 0

			err := runPostgresMigration(
				t.Context(),
				slog.New(slog.DiscardHandler),
				&migrationDatabaseStub{},
				func() error {
					closeCalls++

					return errCloseFailure
				},
				func(context.Context) error { return tt.schemaErr },
				func(
					context.Context,
					*slog.Logger,
					pgmigrate.Database,
					fs.FS,
					string,
					string,
				) error {
					migrationCalls++

					return tt.migrationErr
				},
			)

			for _, wantErr := range []error{tt.wantPrimaryErr, errCloseFailure} {
				if !errors.Is(err, wantErr) {
					t.Errorf("runPostgresMigration() error = %v, want %v", err, wantErr)
				}
			}

			if (migrationCalls == 1) != tt.wantMigration {
				t.Errorf(
					"migration calls = %d, want migration = %t",
					migrationCalls,
					tt.wantMigration,
				)
			}

			if closeCalls != 1 {
				t.Errorf("close calls = %d, want 1", closeCalls)
			}
		})
	}
}
