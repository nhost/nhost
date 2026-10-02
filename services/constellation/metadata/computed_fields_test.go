package metadata_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestComputedFieldsFromHasuraInputsAndTOML(t *testing.T) {
	t.Parallel()

	data, err := os.ReadFile(
		filepath.Join("..", "integration", "computedfields", "testdata", "metadata.json"),
	)
	if err != nil {
		t.Fatal(err)
	}

	fromJSON, err := metadata.FromHasuraJSON(data)
	if err != nil {
		t.Fatal(err)
	}

	fromYAML, snapshot, err := metadata.FromDetectWithHasura(
		t.Context(),
		filepath.Join("..", "integration", "nhost", "metadata", "metadata.yaml"),
	)
	if err != nil {
		t.Fatal(err)
	}

	if len(snapshot) == 0 {
		t.Fatal("no YAML snapshot")
	}

	compareComputedModels(t, fromJSON, fromYAML)

	encoded, err := metadata.MarshalTOML(fromJSON)
	if err != nil {
		t.Fatal(err)
	}

	path := filepath.Join(t.TempDir(), "computed.toml")
	if err := os.WriteFile(path, encoded, 0o600); err != nil {
		t.Fatal(err)
	}

	fromTOML, tomlSnapshot, err := metadata.FromDetectWithHasura(t.Context(), path)
	if err != nil {
		t.Fatal(err)
	}

	if tomlSnapshot != nil {
		t.Fatalf("TOML snapshot = %s; want nil", tomlSnapshot)
	}

	compareComputedModels(t, fromJSON, fromTOML)
}

// Compare only computed contracts: unrelated metadata fields (including
// source connection settings) differ between the fixture and YAML tree.
func compareComputedModels(t *testing.T, expected, actual *metadata.Metadata) {
	t.Helper()

	projection := func(m *metadata.Metadata) map[string]any {
		result := make(map[string]any)
		for _, db := range m.Databases {
			if db.Name != "cf_select" && db.Name != "cf_predicates" {
				continue
			}

			for _, table := range db.Tables {
				fields := make([]metadata.ComputedField, len(table.ComputedFields))
				copy(fields, table.ComputedFields)

				for i := range fields {
					fields[i].Raw = nil
				}

				result[db.Name+"."+table.Table.Name+".fields"] = fields
				for _, perm := range table.SelectPermissions {
					result[db.Name+"."+table.Table.Name+"."+perm.Role+".grants"] = perm.Permission.ComputedFields
				}
			}
		}

		return result
	}

	want, got := projection(expected), projection(actual)
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("computed metadata (-want +got):\n%s", diff)
	}

	const fieldCount = 6

	count := 0
	for _, db := range actual.Databases {
		if db.Name == "cf_select" || db.Name == "cf_predicates" {
			for _, table := range db.Tables {
				count += len(table.ComputedFields)
			}
		}
	}

	if count != fieldCount {
		t.Errorf("computed field count = %d, want %d", count, fieldCount)
	}
}

func TestComputedFieldsInvalidTOMLExportFailsClosed(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		body string
		want string
	}{
		{
			name: "field definition",
			body: `"computed_fields":[{"name":"broken","definition":{"function":17}}]`,
			want: "invalid computed field",
		},
		{
			name: "field list",
			body: `"computed_fields":"*"`,
			want: "invalid computed field",
		},
		{
			name: "grant member",
			body: `"select_permissions":[{"role":"reader","permission":{"columns":"*","filter":{},"computed_fields":["valid",19]}}]`,
			want: "invalid computed grants",
		},
		{
			name: "grant list",
			body: `"select_permissions":[{"role":"reader","permission":{"columns":"*","filter":{},"computed_fields":"*"}}]`,
			want: "invalid computed grants",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			body := `{"version":3,"sources":[{"name":"db","kind":"postgres","configuration":{"connection_info":{"database_url":"postgres://localhost/db"}},"tables":[{"table":{"name":"items","schema":"public"},` + tt.body + `}]}]}`

			m, err := metadata.FromHasuraJSON([]byte(body))
			if err != nil {
				t.Fatal(err)
			}

			out, err := metadata.MarshalTOML(m)
			if err == nil || !strings.Contains(err.Error(), tt.want) || out != nil {
				t.Fatalf("TOML export = %q, %v; want %s and no output", out, err, tt.want)
			}
		})
	}
}

func TestComputedFieldsInvalidEntriesStayExplicit(t *testing.T) {
	t.Parallel()

	const body = `{"version":3,"sources":[{"name":"x","kind":"postgres","configuration":{"connection_info":{"database_url":"postgres://localhost/db"}},"tables":[{"table":{"schema":"public","name":"items"},"computed_fields":[{"name":"valid","definition":{"function":"make_valid","table_argument":"row"},"comment":"ok","future":{"keep":true}},{"name":"broken","definition":{"function":17}},null],"select_permissions":[{"role":"reader","permission":{"columns":"*","filter":{},"computed_fields":["valid",19,null],"future":3}}]}]}]}`

	m, err := metadata.FromHasuraJSON([]byte(body))
	if err != nil {
		t.Fatal(err)
	}

	table := m.Databases[0].Tables[0]
	if len(table.ComputedFields) != 3 ||
		table.ComputedFields[0].Definition.Function.Name != "make_valid" ||
		table.ComputedFields[0].Definition.TableArgument != "row" ||
		table.ComputedFields[0].Comment != "ok" ||
		table.ComputedFields[0].DecodeError != "" ||
		table.ComputedFields[1].DecodeError == "" ||
		table.ComputedFields[2].DecodeError == "" {
		t.Fatalf("computed fields: %+v", table.ComputedFields)
	}

	perm := table.SelectPermissions[0].Permission
	if diff := cmp.Diff([]string{"*"}, perm.Columns); diff != "" {
		t.Errorf("columns mismatch: %s", diff)
	}

	if diff := cmp.Diff(
		[]string{"valid"},
		perm.ComputedFields,
	); diff != "" ||
		len(perm.InvalidComputedFields) != 2 {
		t.Fatalf("permission: %+v (%s)", perm, diff)
	}

	var raw map[string]any
	if err := json.Unmarshal(
		table.ComputedFields[0].Raw,
		&raw,
	); err != nil ||
		raw["future"] == nil {
		t.Fatalf("lost original field: %s (%v)", table.ComputedFields[0].Raw, err)
	}

	if string(table.ComputedFields[1].Raw) != `{"name":"broken","definition":{"function":17}}` {
		t.Fatalf("lost invalid raw field: %s", table.ComputedFields[1].Raw)
	}
}
