package migrations

import (
	"context"
	"database/sql"
	"errors"
	"io/fs"
	"log/slog"
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

type migrationCall struct {
	fsys          fs.FS
	migrationPath string
	schema        string
	target        uint
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

func TestRunPostgresMigrationCreatesSchemaThenDelegatesAndCloses(t *testing.T) {
	t.Parallel()

	ctx := t.Context()
	logger := slog.New(slog.DiscardHandler)
	database := &migrationDatabaseStub{}

	var (
		gotCall migrationCall
		events  []string
	)

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
				t.Errorf("schema context = %v, want supplied context", gotContext)
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
			gotTarget uint,
		) error {
			events = append(events, "migration")

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

	wantEvents := []string{"schema", "migration", "close"}
	if len(events) != len(wantEvents) {
		t.Fatalf("migration events = %v, want %v", events, wantEvents)
	}

	for index, want := range wantEvents {
		if events[index] != want {
			t.Fatalf("migration events = %v, want %v", events, wantEvents)
		}
	}

	body, readErr := fs.ReadFile(
		gotCall.fsys,
		"postgres/000007_agent_messages_seq.up.sql",
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

func TestRunPostgresMigrationReturnsErrorsAndCloses(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name           string
		schemaErr      error
		migrationErr   error
		closeErr       error
		wantErrors     []error
		wantMigrations int
	}{
		{
			name:           "success",
			schemaErr:      nil,
			migrationErr:   nil,
			closeErr:       nil,
			wantErrors:     nil,
			wantMigrations: 1,
		},
		{
			name:           "schema creation fails",
			schemaErr:      errSchemaCreationFailure,
			migrationErr:   nil,
			closeErr:       nil,
			wantErrors:     []error{errSchemaCreationFailure},
			wantMigrations: 0,
		},
		{
			name:           "migration fails",
			schemaErr:      nil,
			migrationErr:   errMigrationFailure,
			closeErr:       nil,
			wantErrors:     []error{errMigrationFailure},
			wantMigrations: 1,
		},
		{
			name:           "close fails",
			schemaErr:      nil,
			migrationErr:   nil,
			closeErr:       errCloseFailure,
			wantErrors:     []error{errCloseFailure},
			wantMigrations: 1,
		},
		{
			name:           "schema creation and close fail",
			schemaErr:      errSchemaCreationFailure,
			migrationErr:   nil,
			closeErr:       errCloseFailure,
			wantErrors:     []error{errSchemaCreationFailure, errCloseFailure},
			wantMigrations: 0,
		},
		{
			name:           "migration and close fail",
			schemaErr:      nil,
			migrationErr:   errMigrationFailure,
			closeErr:       errCloseFailure,
			wantErrors:     []error{errMigrationFailure, errCloseFailure},
			wantMigrations: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var (
				schemaCalls    int
				migrationCalls int
				closeCalls     int
			)

			err := runPostgresMigration(
				t.Context(),
				slog.New(slog.DiscardHandler),
				&migrationDatabaseStub{},
				func() error {
					closeCalls++

					return tt.closeErr
				},
				func(context.Context) error {
					schemaCalls++

					return tt.schemaErr
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
					migrationCalls++

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

			if schemaCalls != 1 {
				t.Errorf("schema creation calls = %d, want 1", schemaCalls)
			}

			if migrationCalls != tt.wantMigrations {
				t.Errorf(
					"migration calls = %d, want %d",
					migrationCalls,
					tt.wantMigrations,
				)
			}

			if closeCalls != 1 {
				t.Errorf("close calls = %d, want 1", closeCalls)
			}
		})
	}
}
