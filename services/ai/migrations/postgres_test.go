package migrations_test

import (
	"os"
	"testing"
)

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
