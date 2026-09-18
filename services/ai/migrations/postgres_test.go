package migrations_test

import (
	"errors"
	"os"
	"testing"
)

const defaultAIMigrationTestDSN = "postgres://postgres:postgres@localhost:5432/local?sslmode=disable"

var errAIMigrationTestDSNRequired = errors.New(
	"AI_MIGRATION_TEST_DATABASE_REQUIRED is set but POSTGRES_CONNECTION is empty",
)

func TestAIMigrationTestDatabaseConfiguration(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name           string
		dsn            string
		requiredMarker string
		wantDSN        string
		wantCanSkip    bool
		wantError      bool
	}{
		{
			name:           "unset local dependency is optional",
			dsn:            "",
			requiredMarker: "",
			wantDSN:        defaultAIMigrationTestDSN,
			wantCanSkip:    true,
			wantError:      false,
		},
		{
			name:           "explicit connection is required",
			dsn:            "postgres://postgres@database:5432/local",
			requiredMarker: "",
			wantDSN:        "postgres://postgres@database:5432/local",
			wantCanSkip:    false,
			wantError:      false,
		},
		{
			name:           "required database without connection fails",
			dsn:            "",
			requiredMarker: "1",
			wantDSN:        "",
			wantCanSkip:    false,
			wantError:      true,
		},
		{
			name:           "required database with connection runs",
			dsn:            "postgres://postgres@database:5432/local",
			requiredMarker: "1",
			wantDSN:        "postgres://postgres@database:5432/local",
			wantCanSkip:    false,
			wantError:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			gotDSN, gotCanSkip, err := aiMigrationTestDatabaseConfiguration(
				tt.dsn,
				tt.requiredMarker,
			)
			if (err != nil) != tt.wantError {
				t.Fatalf(
					"aiMigrationTestDatabaseConfiguration() error = %v, want error %t",
					err,
					tt.wantError,
				)
			}

			if gotDSN != tt.wantDSN {
				t.Errorf(
					"aiMigrationTestDatabaseConfiguration() DSN = %q, want %q",
					gotDSN,
					tt.wantDSN,
				)
			}

			if gotCanSkip != tt.wantCanSkip {
				t.Errorf(
					"aiMigrationTestDatabaseConfiguration() can skip = %t, want %t",
					gotCanSkip,
					tt.wantCanSkip,
				)
			}
		})
	}
}

func aiMigrationTestDatabaseConfiguration(
	configuredDSN string,
	requiredMarker string,
) (string, bool, error) {
	if configuredDSN != "" {
		return configuredDSN, false, nil
	}

	if requiredMarker != "" {
		return "", false, errAIMigrationTestDSNRequired
	}

	return defaultAIMigrationTestDSN, true, nil
}

func TestLegacyExtensionDownMigrationsRemainFrozen(t *testing.T) {
	t.Parallel()

	tests := []struct {
		path string
		want string
	}{
		{
			path: "postgres/000001_extensions.down.sql",
			want: `-- These extensions are database-global and are intentionally retained on AI schema downgrade.
DO $$
BEGIN
  RAISE NOTICE 'retaining database-global extensions vector and http during AI schema downgrade';
END
$$;
`,
		},
		{
			path: "postgres/000005_extensions.down.sql",
			want: `-- This extension is database-global and is intentionally retained on AI schema downgrade.
DO $$
BEGIN
  RAISE NOTICE 'retaining database-global extension pg_jsonschema during AI schema downgrade';
END
$$;
`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			t.Parallel()

			body, err := os.ReadFile(tt.path)
			if err != nil {
				t.Fatalf("os.ReadFile(%q) error = %v", tt.path, err)
			}

			if string(body) != tt.want {
				t.Fatalf("retention migration %q changed", tt.path)
			}
		})
	}
}
