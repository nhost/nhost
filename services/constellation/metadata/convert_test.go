package metadata_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/metadata"
)

const validHasuraJSON = `{
	"version": 3,
	"sources": [
		{
			"name": "default",
			"kind": "postgres",
			"configuration": {
				"connection_info": {
					"database_url": {"from_env": "PG_DATABASE_URL"}
				}
			},
			"tables": [
				{
					"table": {"name": "users", "schema": "public"},
					"configuration": {
						"custom_name": "users",
						"column_config": {
							"id": {"custom_name": "id"}
						}
					},
					"select_permissions": [
						{
							"role": "user",
							"permission": {
								"columns": ["id"],
								"filter": {"id": {"_eq": "X-Hasura-User-Id"}}
							}
						}
					]
				}
			]
		}
	],
	"remote_schemas": [
		{
			"name": "rs",
			"definition": {
				"url": "https://remote.example.com/graphql"
			}
		}
	]
}`

func TestFromHasuraJSON(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		data    []byte
		wantErr bool
		check   func(t *testing.T, m *metadata.Metadata)
	}{
		{
			name:    "happy path",
			data:    []byte(validHasuraJSON),
			wantErr: false,
			check:   assertHappyPathJSON,
		},
		{
			name: "select permission all-columns shorthand",
			data: []byte(strings.Replace(
				validHasuraJSON,
				`"columns": ["id"]`,
				`"columns": "*"`,
				1,
			)),
			wantErr: false,
			check:   assertAllColumnsShorthandJSON,
		},
		{
			name:    "malformed JSON",
			data:    []byte(`{not valid json`),
			wantErr: true,
			check:   nil,
		},
		{
			name:    "unsupported version",
			data:    []byte(`{"version": 2, "sources": []}`),
			wantErr: true,
			check:   nil,
		},
		{
			name:    "empty input",
			data:    nil,
			wantErr: true,
			check:   nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			m, err := metadata.FromHasuraJSON(tt.data)
			checkLoaderResult(t, m, err, tt.wantErr, tt.check)
		})
	}
}

func assertAllColumnsShorthandJSON(t *testing.T, m *metadata.Metadata) {
	t.Helper()

	if len(m.Databases) != 1 || len(m.Databases[0].Tables) != 1 {
		t.Fatalf("unexpected metadata shape: %+v", m)
	}

	perms := m.Databases[0].Tables[0].SelectPermissions
	if len(perms) != 1 {
		t.Fatalf("expected one select permission, got %+v", perms)
	}

	got := perms[0].Permission.Columns
	if !cmp.Equal(got, []string{"*"}) {
		t.Fatalf("select permission columns mismatch:\n%s", cmp.Diff([]string{"*"}, got))
	}
}

func assertHappyPathJSON(t *testing.T, m *metadata.Metadata) {
	t.Helper()

	if len(m.Databases) != 1 {
		t.Fatalf("expected 1 database, got %d", len(m.Databases))
	}

	db := m.Databases[0]
	if db.Name != "default" {
		t.Errorf("Name = %q, want %q", db.Name, "default")
	}

	if db.Kind != "postgres" {
		t.Errorf("Kind = %q, want %q", db.Kind, "postgres")
	}

	// from_env should be rendered into the {{...}} envelope.
	wantURL := metadata.EnvString("{{PG_DATABASE_URL}}")
	if got := db.Configuration.ConnectionInfo.DatabaseURL; got != wantURL {
		t.Errorf("DatabaseURL = %q, want %q", got, wantURL)
	}

	if len(db.Tables) != 1 {
		t.Fatalf("expected 1 table, got %d", len(db.Tables))
	}

	table := db.Tables[0]
	if table.Table.Name != "users" || table.Table.Schema != "public" {
		t.Errorf("table source = %+v, want users/public", table.Table)
	}

	if len(table.SelectPermissions) != 1 || table.SelectPermissions[0].Role != "user" {
		t.Errorf("unexpected select permissions: %+v", table.SelectPermissions)
	}

	if len(m.RemoteSchemas) != 1 || m.RemoteSchemas[0].Name != "rs" {
		t.Errorf("unexpected remote schemas: %+v", m.RemoteSchemas)
	}
}

func TestFromDetect_HasuraYAMLBranch(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		setup   func(t *testing.T) string
		wantErr bool
		check   func(t *testing.T, m *metadata.Metadata)
	}{
		{
			name:    "happy path",
			setup:   writeMinimalHasuraYAML,
			wantErr: false,
			check:   assertHappyPathYAML,
		},
		{
			name: "non-existent path",
			setup: func(_ *testing.T) string {
				return "/does/not/exist/metadata.yaml"
			},
			wantErr: true,
			check:   nil,
		},
		{
			name:    "missing databases.yaml",
			setup:   setupMissingDatabasesYAML,
			wantErr: true,
			check:   nil,
		},
		{
			name:    "malformed databases.yaml",
			setup:   setupMalformedDatabasesYAML,
			wantErr: true,
			check:   nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			path := tt.setup(t)

			m, err := metadata.FromDetect(t.Context(), path)
			checkLoaderResult(t, m, err, tt.wantErr, tt.check)
		})
	}
}

func assertHappyPathYAML(t *testing.T, m *metadata.Metadata) {
	t.Helper()

	if len(m.Databases) != 1 {
		t.Fatalf("expected 1 database, got %d", len(m.Databases))
	}

	db := m.Databases[0]
	if db.Name != "default" {
		t.Errorf("Name = %q, want %q", db.Name, "default")
	}

	if db.Kind != "postgres" {
		t.Errorf("Kind = %q, want %q", db.Kind, "postgres")
	}

	wantURL := metadata.EnvString("{{NHOST_GRAPHQL_DATABASE_URL}}")
	if got := db.Configuration.ConnectionInfo.DatabaseURL; got != wantURL {
		t.Errorf("DatabaseURL = %q, want %q", got, wantURL)
	}

	if len(db.Tables) != 1 {
		t.Fatalf("expected 1 table, got %d", len(db.Tables))
	}

	wantTable := metadata.TableSource{Name: "users", Schema: "public"}
	if got := db.Tables[0].Table; !cmp.Equal(got, wantTable) {
		t.Errorf("table source mismatch:\n%s", cmp.Diff(wantTable, got))
	}
}

// checkLoaderResult routes a (metadata, err) pair through the standard
// error/success assertions used by the FromHasura* table-driven tests.
func checkLoaderResult(
	t *testing.T,
	m *metadata.Metadata,
	err error,
	wantErr bool,
	check func(t *testing.T, m *metadata.Metadata),
) {
	t.Helper()

	if wantErr {
		if err == nil {
			t.Fatalf("expected error, got nil (metadata = %+v)", m)
		}

		if m != nil {
			t.Errorf("expected nil metadata on error, got %+v", m)
		}

		return
	}

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if m == nil {
		t.Fatal("expected non-nil metadata")
	}

	check(t, m)
}

// writeMinimalHasuraYAML creates the Hasura YAML layout that hasura.FromYAML
// expects: a databases/databases.yaml listing one database and that database's
// tables.yaml referencing one table file. It also drops a top-level
// metadata.yaml sentinel so callers can pass "<dir>/metadata.yaml" — hasura.
// FromYAML treats the argument as a directory locator and never reads the
// sentinel itself.
func writeMinimalHasuraYAML(t *testing.T) string {
	t.Helper()

	dir := t.TempDir()

	dbDir := filepath.Join(dir, "databases")
	defaultDir := filepath.Join(dbDir, "default")
	tablesDir := filepath.Join(defaultDir, "tables")

	if err := os.MkdirAll(tablesDir, 0o700); err != nil {
		t.Fatalf("mkdir tables dir: %v", err)
	}

	files := map[string]string{
		filepath.Join(dir, "metadata.yaml"): `databases: "!databases/databases.yaml"
`,
		filepath.Join(dbDir, "databases.yaml"): `- name: default
  kind: postgres
  configuration:
    connection_info:
      database_url:
        from_env: NHOST_GRAPHQL_DATABASE_URL
  tables: "!include default/tables/tables.yaml"
`,
		filepath.Join(tablesDir, "tables.yaml"): `- "!include public_users.yaml"
`,
		filepath.Join(tablesDir, "public_users.yaml"): `table:
  name: users
  schema: public
`,
	}

	for path, content := range files {
		if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
			t.Fatalf("writing %s: %v", path, err)
		}
	}

	return filepath.Join(dir, "metadata.yaml")
}

func setupMissingDatabasesYAML(t *testing.T) string {
	t.Helper()
	// A metadata.yaml sentinel exists so callers can name it, but the real
	// target — databases/databases.yaml under the same directory — does not.
	dir := t.TempDir()

	metaPath := filepath.Join(dir, "metadata.yaml")
	if err := os.WriteFile(metaPath, []byte(""), 0o600); err != nil {
		t.Fatalf("writing metadata.yaml: %v", err)
	}

	return metaPath
}

func TestCustomizationIsZero(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		in   metadata.Customization
		want bool
	}{
		{
			name: "empty",
			in:   metadata.Customization{},
			want: true,
		},
		{
			name: "root fields namespace set",
			in:   metadata.Customization{RootFieldsNamespace: "app"},
			want: false,
		},
		{
			name: "root fields prefix set",
			in:   metadata.Customization{RootFieldsPrefix: "pg_"},
			want: false,
		},
		{
			name: "root fields suffix set",
			in:   metadata.Customization{RootFieldsSuffix: "_v1"},
			want: false,
		},
		{
			name: "type names prefix set",
			in:   metadata.Customization{TypeNamesPrefix: "App_"},
			want: false,
		},
		{
			name: "type names suffix set",
			in:   metadata.Customization{TypeNamesSuffix: "_T"},
			want: false,
		},
		{
			name: "type names mapping entry",
			in:   metadata.Customization{TypeNamesMapping: map[string]string{"a": "b"}},
			want: false,
		},
		{
			name: "field names entry",
			in: metadata.Customization{
				FieldNames: []metadata.FieldNameCustomization{{ParentType: "Query"}},
			},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := tt.in.IsZero(); got != tt.want {
				t.Errorf("IsZero() = %v, want %v", got, tt.want)
			}
		})
	}
}

func setupMalformedDatabasesYAML(t *testing.T) string {
	t.Helper()

	dir := t.TempDir()

	if err := os.MkdirAll(filepath.Join(dir, "databases"), 0o700); err != nil {
		t.Fatalf("mkdir databases: %v", err)
	}

	metaPath := filepath.Join(dir, "metadata.yaml")
	if err := os.WriteFile(metaPath, []byte(""), 0o600); err != nil {
		t.Fatalf("writing metadata.yaml: %v", err)
	}

	dbPath := filepath.Join(dir, "databases", "databases.yaml")
	if err := os.WriteFile(dbPath, []byte("not: [valid"), 0o600); err != nil {
		t.Fatalf("writing databases.yaml: %v", err)
	}

	return metaPath
}
