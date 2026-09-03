package pgmigrate_test

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/nhost/nhost/internal/lib/pgmigrate"
	"github.com/nhost/nhost/internal/lib/pgmigrate/mock"
	"go.uber.org/mock/gomock"
)

func TestMigrateValidatesBeforeAcquiringConnections(t *testing.T) {
	t.Parallel()

	database := mock.NewMockDatabase(gomock.NewController(t))
	valid := fstest.MapFS{
		"migrations/1_first.up.sql":   &fstest.MapFile{Data: []byte("SELECT 1;")},
		"migrations/1_first.down.sql": &fstest.MapFile{Data: []byte("SELECT 2;")},
	}

	tests := []struct {
		name   string
		ctx    func(*testing.T) context.Context
		fsys   fstest.MapFS
		path   string
		schema string
		target uint
		field  string
	}{
		{
			name: "invalid bundle",
			ctx: func(t *testing.T) context.Context {
				t.Helper()

				return t.Context()
			},
			fsys: fstest.MapFS{
				"migrations/not-a-migration.sql": &fstest.MapFile{Data: []byte("SELECT 1;")},
			},
			path:   "migrations",
			schema: "app",
			target: 1,
			field:  "",
		},
		{
			name: "nil context",
			ctx: func(*testing.T) context.Context {
				return nil
			},
			fsys:   valid,
			path:   "migrations",
			schema: "app",
			target: 1,
			field:  "context",
		},
		{
			name: "blank schema",
			ctx: func(t *testing.T) context.Context {
				t.Helper()

				return t.Context()
			},
			fsys:   valid,
			path:   "migrations",
			schema: " \t",
			target: 1,
			field:  "schema",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			err := pgmigrate.Migrate(
				tt.ctx(t),
				nil,
				database,
				tt.fsys,
				tt.path,
				tt.schema,
				tt.target,
			)
			if err == nil {
				t.Fatal("Migrate() error = nil")
			}

			if tt.field == "" {
				var bundleErr *pgmigrate.BundleError
				if !errors.As(err, &bundleErr) {
					t.Fatalf("Migrate() error = %v (%T), want *BundleError", err, err)
				}

				return
			}

			var configurationErr *pgmigrate.ConfigurationError
			if !errors.As(err, &configurationErr) {
				t.Fatalf("Migrate() error = %v (%T), want *ConfigurationError", err, err)
			}

			if configurationErr.Field != tt.field {
				t.Fatalf(
					"Migrate() configuration field = %q, want %q",
					configurationErr.Field,
					tt.field,
				)
			}
		})
	}
}

func TestMigrateWrapsInitialConnectionFailure(t *testing.T) {
	t.Parallel()

	cause := sql.ErrConnDone
	database := mock.NewMockDatabase(gomock.NewController(t))
	database.EXPECT().Conn(gomock.Any()).Return(nil, cause)

	err := pgmigrate.Migrate(
		t.Context(),
		nil,
		database,
		fstest.MapFS{
			"migrations/1_first.up.sql":   &fstest.MapFile{Data: []byte("SELECT 1;")},
			"migrations/1_first.down.sql": &fstest.MapFile{Data: []byte("SELECT 2;")},
		},
		"migrations",
		"app",
		1,
	)
	if !errors.Is(err, cause) {
		t.Fatalf("Migrate() error = %v, want wrapped %v", err, cause)
	}

	if !strings.Contains(err.Error(), "execution connection") {
		t.Fatalf("Migrate() error = %q, want execution connection context", err)
	}
}
