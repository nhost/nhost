package pgmigrate

import (
	"crypto/sha256"
	"errors"
	"io/fs"
	"math"
	"reflect"
	"strconv"
	"strings"
	"testing"
	"testing/fstest"
)

func TestLoadBundleInfersTargetLinksAndFingerprintsExactBodies(t *testing.T) {
	t.Parallel()

	const (
		firstUp   = "CREATE TABLE widgets (id bigint);\n"
		firstDown = "DROP TABLE widgets;\n"
		lastUp    = "ALTER TABLE widgets ADD COLUMN name text;\r\n"
		lastDown  = "ALTER TABLE widgets DROP COLUMN name;\n\n"
	)

	fsys := migrationFS(map[string]string{
		"2_create_widgets.up.sql":    firstUp,
		"2_create_widgets.down.sql":  firstDown,
		"10_add_name.up.sql":         lastUp,
		"10_add_name.down.sql":       lastDown,
		"nested/not_a_migration.txt": "ignored because nested directories are not traversed",
	})

	got, err := loadBundle(fsys, "migrations")
	if err != nil {
		t.Fatalf("loadBundle() error = %v", err)
	}

	want := &bundle{
		migrations: []migration{
			{
				version:         2,
				previousVersion: nil,
				identifier:      "create_widgets",
				upSQL:           []byte(firstUp),
				downSQL:         []byte(firstDown),
				upChecksum:      sha256.Sum256([]byte(firstUp)),
				downChecksum:    sha256.Sum256([]byte(firstDown)),
			},
			{
				version:         10,
				previousVersion: uintPointer(2),
				identifier:      "add_name",
				upSQL:           []byte(lastUp),
				downSQL:         []byte(lastDown),
				upChecksum:      sha256.Sum256([]byte(lastUp)),
				downChecksum:    sha256.Sum256([]byte(lastDown)),
			},
		},
		target: 10,
	}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("loadBundle() mismatch\n got: %#v\nwant: %#v", got, want)
	}

	again, err := loadBundle(fsys, "migrations")
	if err != nil {
		t.Fatalf("second loadBundle() error = %v", err)
	}

	if !reflect.DeepEqual(again, got) {
		t.Fatalf("loadBundle() is not deterministic\nfirst:  %#v\nsecond: %#v", got, again)
	}
}

func TestLoadBundleRejectsInvalidBundles(t *testing.T) {
	t.Parallel()

	tooLargeForRunner := strconv.FormatUint(uint64(math.MaxInt)+1, 10)

	tests := []struct {
		name       string
		fsys       fs.FS
		path       string
		wantIssue  string
		wantConfig bool
	}{
		{
			name:       "nil filesystem",
			fsys:       nil,
			path:       "migrations",
			wantIssue:  "must not be nil",
			wantConfig: true,
		},
		{
			name:       "invalid empty path",
			fsys:       migrationFS(validPair()),
			path:       "",
			wantIssue:  "valid io/fs path",
			wantConfig: true,
		},
		{
			name:       "missing path",
			fsys:       migrationFS(validPair()),
			path:       "elsewhere",
			wantIssue:  "cannot read",
			wantConfig: true,
		},
		{
			name: "empty bundle",
			fsys: fstest.MapFS{
				"migrations": &fstest.MapFile{Mode: fs.ModeDir},
			},
			path:      "migrations",
			wantIssue: "contains no migration files",
		},
		{
			name: "malformed filename",
			fsys: migrationFS(map[string]string{
				"migration.sql": "SELECT 1;",
			}),
			path:      "migrations",
			wantIssue: "filename does not follow golang-migrate semantics",
		},
		{
			name: "overflowing version",
			fsys: migrationFS(map[string]string{
				"18446744073709551616_too_large.up.sql": "SELECT 1;",
			}),
			path:      "migrations",
			wantIssue: "filename does not follow golang-migrate semantics",
		},
		{
			name: "version exceeds migration runner range",
			fsys: migrationFS(map[string]string{
				tooLargeForRunner + "_too_large.up.sql":   "SELECT 1;",
				tooLargeForRunner + "_too_large.down.sql": "SELECT 2;",
			}),
			path:      "migrations",
			wantIssue: "exceeds the migration runner's integer version range",
		},
		{
			name: "duplicate up direction",
			fsys: migrationFS(map[string]string{
				"1_first.up.sql":   "SELECT 1;",
				"1_first.down.sql": "SELECT 2;",
				"01_other.up.sql":  "SELECT 3;",
			}),
			path:      "migrations",
			wantIssue: "duplicates the up migration for version 1",
		},
		{
			name: "duplicate down direction",
			fsys: migrationFS(map[string]string{
				"1_first.up.sql":    "SELECT 1;",
				"1_first.down.sql":  "SELECT 2;",
				"01_other.down.sql": "SELECT 3;",
			}),
			path:      "migrations",
			wantIssue: "duplicates the down migration for version 1",
		},
		{
			name: "missing up direction",
			fsys: migrationFS(map[string]string{
				"1_first.down.sql": "SELECT 1;",
			}),
			path:      "migrations",
			wantIssue: "missing its up migration",
		},
		{
			name: "missing down direction",
			fsys: migrationFS(map[string]string{
				"1_first.up.sql": "SELECT 1;",
			}),
			path:      "migrations",
			wantIssue: "missing its down migration",
		},
		{
			name: "mismatched identifiers",
			fsys: migrationFS(map[string]string{
				"1_first.up.sql":       "SELECT 1;",
				"1_different.down.sql": "SELECT 2;",
			}),
			path:      "migrations",
			wantIssue: "mismatched identifiers",
		},
		{
			name: "empty body",
			fsys: migrationFS(map[string]string{
				"1_first.up.sql":   "",
				"1_first.down.sql": "SELECT 1;",
			}),
			path:      "migrations",
			wantIssue: "must contain non-whitespace SQL",
		},
		{
			name: "whitespace-only body",
			fsys: migrationFS(map[string]string{
				"1_first.up.sql":   "SELECT 1;",
				"1_first.down.sql": " \n\t\r\n",
			}),
			path:      "migrations",
			wantIssue: "must contain non-whitespace SQL",
		},
		{
			name: "line-comment-only body",
			fsys: migrationFS(map[string]string{
				"1_first.up.sql":   "-- placeholder\r\n-- still a placeholder",
				"1_first.down.sql": "SELECT 1;",
			}),
			path:      "migrations",
			wantIssue: "must contain non-whitespace SQL",
		},
		{
			name: "block-comment-only body",
			fsys: migrationFS(map[string]string{
				"1_first.up.sql":   "SELECT 1;",
				"1_first.down.sql": "/* outer /* nested */ placeholder */",
			}),
			path:      "migrations",
			wantIssue: "must contain non-whitespace SQL",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			_, err := loadBundle(tt.fsys, tt.path)
			if err == nil {
				t.Fatal("loadBundle() error = nil")
			}

			if !strings.Contains(err.Error(), tt.wantIssue) {
				t.Fatalf("loadBundle() error = %q, want issue %q", err, tt.wantIssue)
			}

			assertErrorCategory(t, err, tt.wantConfig)
		})
	}
}

func assertErrorCategory(t *testing.T, err error, wantConfig bool) {
	t.Helper()

	if wantConfig {
		if _, ok := errors.AsType[*ConfigurationError](err); !ok {
			t.Fatalf("error = %v (%T), want *ConfigurationError", err, err)
		}

		return
	}

	if _, ok := errors.AsType[*BundleError](err); !ok {
		t.Fatalf("error = %v (%T), want *BundleError", err, err)
	}
}

func migrationFS(files map[string]string) fstest.MapFS {
	fsys := make(fstest.MapFS, len(files))
	for name, body := range files {
		fsys[pathForTest(name)] = &fstest.MapFile{Data: []byte(body)}
	}

	return fsys
}

func pathForTest(name string) string {
	return "migrations/" + name
}

func validPair() map[string]string {
	return map[string]string{
		"1_first.up.sql":   "SELECT 1;",
		"1_first.down.sql": "SELECT 2;",
	}
}

func uintPointer(value uint) *uint {
	return new(value)
}
