package migrations

import (
	"context"
	"errors"
	"io"
	"io/fs"
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
