package pgmigrate_test

import (
	"errors"
	"io/fs"
	"strings"
	"testing"

	"github.com/nhost/nhost/internal/lib/pgmigrate"
)

func TestMigrationErrorsExposeContextAndCause(t *testing.T) {
	t.Parallel()

	cause := fs.ErrInvalid
	tests := []struct {
		name    string
		err     error
		context string
	}{
		{
			name: "configuration",
			err: &pgmigrate.ConfigurationError{
				Field: "schema",
				Issue: "must not be empty",
				Cause: cause,
			},
			context: "schema",
		},
		{
			name: "bundle",
			err: &pgmigrate.BundleError{
				Path:  "migrations/1_first.up.sql",
				Issue: "cannot be read",
				Cause: cause,
			},
			context: "1_first.up.sql",
		},
		{
			name: "integrity",
			err: &pgmigrate.IntegrityError{
				Version: new(uint(12)),
				Issue:   "up checksum mismatch",
				Cause:   cause,
			},
			context: "version 12",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if !errors.Is(tt.err, cause) {
				t.Fatalf("errors.Is(%v, cause) = false", tt.err)
			}

			if !strings.Contains(tt.err.Error(), tt.context) {
				t.Fatalf("error = %q, want context %q", tt.err, tt.context)
			}
		})
	}
}

func TestIntegrityErrorDistinguishesZeroFromNoVersion(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		version *uint
		want    string
	}{
		{
			name:    "version zero",
			version: new(uint(0)),
			want:    "migration integrity failure at version 0: invalid migration",
		},
		{
			name:    "no version",
			version: nil,
			want:    "migration integrity failure: invalid migration",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			err := &pgmigrate.IntegrityError{
				Version: tt.version,
				Issue:   "invalid migration",
				Cause:   nil,
			}
			if got := err.Error(); got != tt.want {
				t.Fatalf("Error() = %q, want %q", got, tt.want)
			}
		})
	}
}
