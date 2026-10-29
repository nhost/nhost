package main

import (
	"errors"
	"strings"
	"testing"
)

func TestRunRejectsInvalidConfiguration(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		dsn         string
		wantIssue   string
		wantMissing bool
	}{
		{
			name:        "missing database URL",
			dsn:         "",
			wantIssue:   "set DATABASE_URL",
			wantMissing: true,
		},
		{
			name:        "malformed database URL",
			dsn:         "postgres://%invalid/database",
			wantIssue:   "invalid URL escape",
			wantMissing: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			err := run(t.Context(), tt.dsn)
			if err == nil || !strings.Contains(err.Error(), tt.wantIssue) {
				t.Fatalf("run() error = %v, want issue %q", err, tt.wantIssue)
			}

			if errors.Is(err, errMissingDatabaseURL) != tt.wantMissing {
				t.Fatalf(
					"run() error = %v, missing-URL sentinel match should be %t",
					err,
					tt.wantMissing,
				)
			}
		})
	}
}
