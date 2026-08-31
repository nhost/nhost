package migrations

import (
	"context"
	"errors"
	"io"
	"io/fs"
	"strings"
	"testing"

	"github.com/golang-migrate/migrate/v4"
)

type stubPostgresMigration struct {
	upErr            error
	sourceCloseErr   error
	databaseCloseErr error
	upCalls          int
	closeCalls       int
}

func (m *stubPostgresMigration) Up() error {
	m.upCalls++

	return m.upErr
}

func (m *stubPostgresMigration) Close() (error, error) {
	m.closeCalls++

	return m.sourceCloseErr, m.databaseCloseErr
}

func TestOpenAICompatibleProviderMigration(t *testing.T) {
	t.Parallel()

	up, err := postgresMigrations.ReadFile(
		"postgres/000008_agent_providers_openai_compatible.up.sql",
	)
	if err != nil {
		t.Fatalf("read up migration: %v", err)
	}

	upSQL := strings.Join(strings.Fields(string(up)), " ")

	const compatibleInsert = "INSERT INTO ai.agent_providers (value, comment) VALUES " +
		"('openai_compatible', 'OpenAI-compatible Chat Completions models');"

	if count := strings.Count(upSQL, compatibleInsert); count != 1 {
		t.Errorf("up migration compatible row inserts = %d, want 1; SQL: %q", count, upSQL)
	}

	if count := strings.Count(strings.ToUpper(upSQL), "INSERT INTO"); count != 1 {
		t.Errorf("up migration INSERT statements = %d, want 1; SQL: %q", count, upSQL)
	}

	for _, forbidden := range []string{
		"ON CONFLICT",
		"ALTER ",
		"CREATE ",
		"DROP ",
		"TRUNCATE ",
		"UPDATE ",
		"DELETE ",
	} {
		if strings.Contains(strings.ToUpper(upSQL), forbidden) {
			t.Errorf("up migration unexpectedly contains %q", forbidden)
		}
	}

	down, err := postgresMigrations.ReadFile(
		"postgres/000008_agent_providers_openai_compatible.down.sql",
	)
	if err != nil {
		t.Fatalf("read down migration: %v", err)
	}

	downSQL := string(down)
	for _, required := range []string{
		"FROM ai.agents",
		"WHERE provider = 'openai_compatible'",
		"RAISE EXCEPTION",
		"DELETE FROM ai.agent_providers",
		"WHERE value = 'openai_compatible'",
	} {
		if !strings.Contains(downSQL, required) {
			t.Errorf("down migration does not contain %q", required)
		}
	}

	for _, forbidden := range []string{
		"DELETE FROM ai.agents",
		"UPDATE ai.agents",
		"ON CONFLICT",
		"CASCADE",
	} {
		if strings.Contains(downSQL, forbidden) {
			t.Errorf("down migration unexpectedly contains %q", forbidden)
		}
	}
}

func TestRunPostgresMigration(t *testing.T) {
	t.Parallel()

	migrationFailure := io.ErrUnexpectedEOF
	sourceCloseFailure := fs.ErrClosed
	databaseCloseFailure := context.DeadlineExceeded

	testCases := []struct {
		name             string
		upErr            error
		sourceCloseErr   error
		databaseCloseErr error
		wantErrors       []error
	}{
		{
			name:             "success",
			upErr:            nil,
			sourceCloseErr:   nil,
			databaseCloseErr: nil,
			wantErrors:       nil,
		},
		{
			name:             "no migrations to apply",
			upErr:            migrate.ErrNoChange,
			sourceCloseErr:   nil,
			databaseCloseErr: nil,
			wantErrors:       nil,
		},
		{
			name:             "migration fails",
			upErr:            migrationFailure,
			sourceCloseErr:   nil,
			databaseCloseErr: nil,
			wantErrors:       []error{migrationFailure},
		},
		{
			name:             "source close fails",
			upErr:            nil,
			sourceCloseErr:   sourceCloseFailure,
			databaseCloseErr: nil,
			wantErrors:       []error{sourceCloseFailure},
		},
		{
			name:             "database close fails",
			upErr:            nil,
			sourceCloseErr:   nil,
			databaseCloseErr: databaseCloseFailure,
			wantErrors:       []error{databaseCloseFailure},
		},
		{
			name:             "migration and close fail",
			upErr:            migrationFailure,
			sourceCloseErr:   sourceCloseFailure,
			databaseCloseErr: databaseCloseFailure,
			wantErrors: []error{
				migrationFailure,
				sourceCloseFailure,
				databaseCloseFailure,
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()

			migration := &stubPostgresMigration{
				upErr:            testCase.upErr,
				sourceCloseErr:   testCase.sourceCloseErr,
				databaseCloseErr: testCase.databaseCloseErr,
				upCalls:          0,
				closeCalls:       0,
			}

			err := runPostgresMigration(migration)
			if len(testCase.wantErrors) == 0 && err != nil {
				t.Fatalf("runPostgresMigration() unexpected error: %v", err)
			}

			for _, wantErr := range testCase.wantErrors {
				if !errors.Is(err, wantErr) {
					t.Errorf("runPostgresMigration() error %v does not wrap %v", err, wantErr)
				}
			}

			if migration.upCalls != 1 {
				t.Errorf("Up() calls = %d, want 1", migration.upCalls)
			}

			if migration.closeCalls != 1 {
				t.Errorf("Close() calls = %d, want 1", migration.closeCalls)
			}
		})
	}
}
