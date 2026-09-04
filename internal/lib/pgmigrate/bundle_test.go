package pgmigrate_test

import (
	"database/sql"
	"errors"
	"io/fs"
	"os"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/nhost/nhost/internal/lib/pgmigrate"
	"github.com/nhost/nhost/internal/lib/pgmigrate/mock"
	"go.uber.org/mock/gomock"
)

func TestValidateBundle(t *testing.T) {
	t.Parallel()

	if err := pgmigrate.ValidateBundle(os.DirFS("testdata"), "valid"); err != nil {
		t.Fatalf("ValidateBundle() error = %v", err)
	}
}

func TestValidateBundleReturnsTypedErrors(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		fsys fs.FS
		path string
		want any
	}{
		{
			name: "configuration",
			fsys: fstest.MapFS{
				"migrations/1_first.up.sql":   &fstest.MapFile{Data: []byte("SELECT 1;")},
				"migrations/1_first.down.sql": &fstest.MapFile{Data: []byte("SELECT 2;")},
			},
			path: "",
			want: &pgmigrate.ConfigurationError{},
		},
		{
			name: "bundle",
			fsys: fstest.MapFS{
				"migrations/not-valid.sql": &fstest.MapFile{Data: []byte("SELECT 1;")},
			},
			path: "migrations",
			want: &pgmigrate.BundleError{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			err := pgmigrate.ValidateBundle(tt.fsys, tt.path)
			if err == nil {
				t.Fatal("ValidateBundle() error = nil")
			}

			switch want := tt.want.(type) {
			case *pgmigrate.ConfigurationError:
				if !errors.As(err, &want) {
					t.Fatalf("error = %v (%T), want *ConfigurationError", err, err)
				}
			case *pgmigrate.BundleError:
				if !errors.As(err, &want) {
					t.Fatalf("error = %v (%T), want *BundleError", err, err)
				}
			default:
				t.Fatalf("unsupported expected error type %T", want)
			}
		})
	}
}

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
				Version: 12,
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

func TestDatabaseBoundaryAndGeneratedMock(t *testing.T) {
	t.Parallel()

	var _ pgmigrate.Database = (*sql.DB)(nil)

	cause := sql.ErrConnDone
	database := mock.NewMockDatabase(gomock.NewController(t))
	database.EXPECT().Conn(gomock.Any()).Return(nil, cause)

	connection, err := database.Conn(t.Context())
	if connection != nil {
		t.Fatalf("Conn() connection = %v, want nil", connection)
	}

	if !errors.Is(err, cause) {
		t.Fatalf("Conn() error = %v, want %v", err, cause)
	}
}
