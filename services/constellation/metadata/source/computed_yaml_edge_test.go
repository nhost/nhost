package source_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/nhost/nhost/services/constellation/metadata/source"
)

func TestComputedYAMLScalarsDoNotStopFileLoad(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		comment string
		want    string
	}{
		{name: "quoted infinity", comment: `".inf"`, want: ".inf"},
		{name: "quoted nan", comment: `".nan"`, want: ".nan"},
		{name: "tab", comment: `"tab\there"`, want: "tab\there"},
		{name: "control", comment: `"a\x01b"`, want: "a\x01b"},
		{name: "CRLF", comment: `"a\r\nb"`, want: "a\r\nb"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			dir := writeComputedYAMLFixture(t, tt.comment, false)
			assertComputedYAMLFile(t, dir, tt.want)
		})
	}
}

func assertComputedYAMLFile(t *testing.T, dir, want string) {
	t.Helper()

	src := source.NewFileMetadataSource(filepath.Join(dir, "metadata.yaml"))
	defer src.Close()

	m, err := src.InitialLoad(t.Context())
	if err != nil {
		t.Fatal(err)
	}

	table := m.Databases[0].Tables[0]
	if len(table.ComputedFields) != 3 || table.ComputedFields[0].Comment != want ||
		table.ComputedFields[0].DecodeError != "" || table.ComputedFields[1].DecodeError == "" ||
		table.ComputedFields[2].Definition.Function.Name != "-.Inf" {
		t.Fatalf("decoded fields: %+v", table.ComputedFields)
	}

	perm := table.SelectPermissions[0].Permission
	if len(perm.ComputedFields) != 3 || len(perm.InvalidComputedFields) != 1 ||
		perm.InvalidComputedFields[0].DecodeError == "" ||
		len(perm.InvalidComputedFields[0].Raw) == 0 ||
		len(table.ComputedFields[1].Raw) == 0 {
		t.Fatalf(
			"decoded grants or invalid raw: %+v / %+v",
			perm,
			table.ComputedFields[1],
		)
	}

	raw, _ := src.HasuraSnapshotJSON()
	assertComputedYAMLSnapshot(t, raw, want)
	assertComputedYAMLReload(t, raw, want)
}

func assertComputedYAMLReload(t *testing.T, raw []byte, want string) {
	t.Helper()

	reloaded, err := metadata.FromHasuraJSON(raw)
	if err != nil {
		t.Fatal(err)
	}

	again := reloaded.Databases[0].Tables[0]
	if len(again.ComputedFields) != 3 || again.ComputedFields[1].DecodeError == "" ||
		again.ComputedFields[0].Comment != want ||
		len(again.SelectPermissions[0].Permission.ComputedFields) != 3 ||
		len(again.SelectPermissions[0].Permission.InvalidComputedFields) != 1 {
		t.Fatalf("snapshot reload changed grants/fields: %+v", again)
	}
}

func writeComputedYAMLFixture(t *testing.T, comment string, inline bool) string {
	t.Helper()

	dir := t.TempDir()
	if err := os.Mkdir(filepath.Join(dir, "databases"), 0o700); err != nil {
		t.Fatal(err)
	}

	body := `- name: db
  kind: postgres
  configuration:
    connection_info:
      database_url: postgres://localhost/db
  tables: "!include tables.yaml"
`
	tables := `- table: {name: items, schema: public}
  future_table: {valid: "tab\there", bad: .inf}
  bad_table: .inf
  computed_fields:
    - name: before
      definition: {function: good}
      comment: ` + comment + `
    - name: bad
      definition: {function: .inf}
    - name: after
      definition: {function: "-.Inf"}
  select_permissions:
    - role: reader
      permission:
        columns: '*'
        filter: {}
        future_permission: {valid: ".inf", bad: .inf}
        bad_permission: .inf
        computed_fields: [before, .nan, "-.Inf", after]`

	if inline {
		body = strings.Replace(
			body,
			`"!include tables.yaml"`,
			"\n    "+strings.ReplaceAll(tables, "\n", "\n    "),
			1,
		)
	}

	if err := os.WriteFile(
		filepath.Join(dir, "databases", "databases.yaml"),
		[]byte(body),
		0o600,
	); err != nil {
		t.Fatal(err)
	}

	if err := os.WriteFile(
		filepath.Join(dir, "databases", "tables.yaml"),
		[]byte(tables),
		0o600,
	); err != nil {
		t.Fatal(err)
	}

	return dir
}

func assertComputedYAMLSnapshot(t *testing.T, raw []byte, want string) {
	t.Helper()

	if strings.Contains(string(raw), `"bad_table"`) ||
		strings.Contains(string(raw), `"bad_permission"`) {
		t.Fatalf("non-JSON YAML extensions should be omitted: %s", raw)
	}

	var snapshot struct {
		Sources []struct {
			Tables []struct {
				Future json.RawMessage `json:"future_table"`
				Fields []struct {
					Comment string          `json:"comment"`
					Raw     json.RawMessage `json:"definition"`
				} `json:"computed_fields"`
				Permissions []struct {
					Permission struct {
						Future json.RawMessage `json:"future_permission"`
						Grants []any           `json:"computed_fields"`
					} `json:"permission"`
				} `json:"select_permissions"`
			} `json:"tables"`
		} `json:"sources"`
	}

	if err := json.Unmarshal(raw, &snapshot); err != nil {
		t.Fatalf("file snapshot: %v: %s", err, raw)
	}

	got := snapshot.Sources[0].Tables[0]

	var badField struct {
		Function any `json:"function"`
	}
	if err := json.Unmarshal(got.Fields[1].Raw, &badField); err != nil {
		t.Fatal(err)
	}

	if got.Fields[0].Comment != want || len(got.Fields) != 3 ||
		badField.Function != nil ||
		got.Permissions[0].Permission.Grants[0] != "before" ||
		got.Permissions[0].Permission.Grants[1] != nil ||
		got.Permissions[0].Permission.Grants[2] != "-.Inf" ||
		got.Permissions[0].Permission.Grants[3] != "after" {
		t.Fatalf("snapshot values: %+v", got)
	}

	assertComputedYAMLUnknown(t, got.Future, got.Permissions[0].Permission.Future)
}

func assertComputedYAMLUnknown(t *testing.T, table, permission json.RawMessage) {
	t.Helper()

	var tableUnknown, permissionUnknown map[string]any
	if err := json.Unmarshal(table, &tableUnknown); err != nil {
		t.Fatal(err)
	}

	if err := json.Unmarshal(
		permission,
		&permissionUnknown,
	); err != nil {
		t.Fatal(err)
	}

	if tableUnknown["valid"] != "tab\there" || permissionUnknown["valid"] != ".inf" {
		t.Fatalf("unknown siblings lost: %v / %v", tableUnknown, permissionUnknown)
	}
}

// Inline tables keep the pre-computed-fields two-pass YAML path. A nested
// RawMessage loses hex escape digits and rejects otherwise valid merge keys.
func TestInlineTablesKeepDecodedEscapesAndMergeOverrides(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		tables      string
		wantName    string
		wantFilter  string
		wantColumns []string
	}{
		{
			name:     "unicode table name",
			tables:   `- table: {name: "caf\u00e9", schema: public}`,
			wantName: "café",
		},
		{
			name:     "hex table name",
			tables:   `- table: {name: "caf\x41", schema: public}`,
			wantName: "cafA",
		},
		{
			name:     "wide unicode table name",
			tables:   `- table: {name: "\U0001F600", schema: public}`,
			wantName: "😀",
		},
		{
			name: "unicode permission filter",
			tables: `- table: {name: items, schema: public}
  select_permissions:
    - role: reader
      permission: {columns: [id], filter: {name: {_neq: "\u0041nna"}}}`,
			wantName:    "items",
			wantFilter:  "Anna",
			wantColumns: []string{"id"},
		},
		{
			name: "table and permission merge overrides",
			tables: `- &base
  table: {name: base, schema: public}
  select_permissions:
    - role: base
      permission: &p {columns: [id], filter: {}}
- <<: *base
  table: {name: override, schema: public}
  select_permissions:
    - role: reader
      permission: {<<: *p, columns: [id, name]}`,
			wantName:    "override",
			wantColumns: []string{"id", "name"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			src := source.NewFileMetadataSource(writeInlineComputedTables(t, tt.tables))
			defer src.Close()

			m, err := src.InitialLoad(t.Context())
			if err != nil {
				t.Fatal(err)
			}

			assertInlineMetadata(t, m, tt.wantName, tt.wantFilter, tt.wantColumns)

			raw, _ := src.HasuraSnapshotJSON()

			reloaded, err := metadata.FromHasuraJSON(raw)
			if err != nil {
				t.Fatal(err)
			}

			assertInlineMetadata(t, reloaded, tt.wantName, tt.wantFilter, tt.wantColumns)
		})
	}
}

func assertInlineMetadata(
	t *testing.T,
	m *metadata.Metadata,
	name, filter string,
	columns []string,
) {
	t.Helper()

	tables := m.Databases[0].Tables

	table := tables[len(tables)-1]
	if table.Table.Name != name {
		t.Fatalf("table name = %q, want %q", table.Table.Name, name)
	}

	if columns == nil {
		return
	}

	perm := table.SelectPermissions[0].Permission
	if !reflect.DeepEqual(perm.Columns, columns) {
		t.Fatalf("columns = %v, want %v", perm.Columns, columns)
	}

	if filter != "" && !reflect.DeepEqual(perm.Filter, map[string]any{
		"name": map[string]any{"_neq": filter},
	}) {
		t.Fatalf("permission filter changed: %#v", perm.Filter)
	}
}

func writeInlineComputedTables(t *testing.T, tables string) string {
	t.Helper()

	dir := t.TempDir()
	if err := os.Mkdir(filepath.Join(dir, "databases"), 0o700); err != nil {
		t.Fatal(err)
	}

	body := `- name: db
  kind: postgres
  configuration:
    connection_info:
      database_url: postgres://localhost/db
  tables:
    ` + strings.ReplaceAll(tables, "\n", "\n    ") + "\n"
	if err := os.WriteFile(
		filepath.Join(dir, "databases", "databases.yaml"),
		[]byte(body),
		0o600,
	); err != nil {
		t.Fatal(err)
	}

	return filepath.Join(dir, "metadata.yaml")
}

func TestInlineComputedYAMLLossIsFailClosed(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		comment string
		want    string
		invalid bool
	}{
		{name: "quoted infinity", comment: `".inf"`, invalid: true},
		{name: "quoted nan", comment: `".nan"`, invalid: true},
		{name: "tab", comment: `"tab\there"`, want: "tabhere"},
		{name: "CRLF", comment: `"a\r\nb"`, want: "a\nb"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			dir := writeComputedYAMLFixture(t, tt.comment, true)

			src := source.NewFileMetadataSource(filepath.Join(dir, "metadata.yaml"))
			defer src.Close()

			m, err := src.InitialLoad(t.Context())
			if err != nil {
				t.Fatal(err)
			}

			assertLossyInlineFields(t, m, tt.want, tt.invalid)

			raw, _ := src.HasuraSnapshotJSON()

			reloaded, err := metadata.FromHasuraJSON(raw)
			if err != nil {
				t.Fatal(err)
			}

			assertLossyInlineFields(t, reloaded, tt.want, tt.invalid)
		})
	}
}

func assertLossyInlineFields(t *testing.T, m *metadata.Metadata, comment string, invalid bool) {
	t.Helper()

	table := m.Databases[0].Tables[0]

	first := table.ComputedFields[0]
	if (first.DecodeError != "") != invalid || first.Comment != comment {
		t.Fatalf("inline first field: %+v", first)
	}

	// The inline re-marshal also turns the quoted "-.Inf" into a bad
	// function, and its corresponding grant cannot become permission.
	if table.ComputedFields[2].DecodeError == "" ||
		!reflect.DeepEqual(
			table.SelectPermissions[0].Permission.ComputedFields,
			[]string{"before", "after"},
		) ||
		len(table.SelectPermissions[0].Permission.InvalidComputedFields) != 2 {
		t.Fatalf("inline fields/grants: %+v", table)
	}
}

func TestNonJSONComputedYAMLListsKeepInvalidMarker(t *testing.T) {
	t.Parallel()

	for _, inline := range []bool{false, true} {
		layout := "included"
		if inline {
			layout = "inline"
		}

		t.Run(layout, func(t *testing.T) {
			t.Parallel()

			const tables = `- table: {name: items, schema: public}
  computed_fields: .inf
  select_permissions:
    - role: reader
      permission: {columns: '*', filter: {}, computed_fields: .nan}`

			dir := writeComputedTablesFixture(t, tables, inline)

			src := source.NewFileMetadataSource(filepath.Join(dir, "metadata.yaml"))
			defer src.Close()

			m, err := src.InitialLoad(t.Context())
			if err != nil {
				t.Fatal(err)
			}

			raw, _ := src.HasuraSnapshotJSON()
			if !strings.Contains(string(raw), `"computed_fields":[null]`) {
				t.Fatalf("unrepresentable list was erased in snapshot: %s", raw)
			}

			reloaded, err := metadata.FromHasuraJSON(raw)
			if err != nil {
				t.Fatal(err)
			}

			for _, doc := range []*metadata.Metadata{m, reloaded} {
				table := doc.Databases[0].Tables[0]
				if len(table.ComputedFields) != 1 || table.ComputedFields[0].DecodeError == "" ||
					len(table.SelectPermissions[0].Permission.InvalidComputedFields) != 1 ||
					table.SelectPermissions[0].Permission.InvalidComputedFields[0].DecodeError == "" {
					t.Fatalf("lost invalid list marker: %+v", table)
				}
			}
		})
	}
}

func TestNonJSONComputedYAMLOptionalKeysStayInvalidOnReload(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct {
		name string
		key  string
		bad  string
	}{
		{name: "session argument", key: "session_argument", bad: ".inf"},
		{name: "table argument", key: "table_argument", bad: ".nan"},
		{name: "comment", key: "comment", bad: ".inf"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			field := "definition: {function: valid}"
			if tt.key == "comment" {
				field += "\n      comment: " + tt.bad
			} else {
				field = "definition: {function: valid, " + tt.key + ": " + tt.bad + "}"
			}

			tables := `- table: {name: items, schema: public}
  computed_fields:
    - name: invalid
      ` + field + `
    - name: valid
      definition: {function: valid}`

			dir := writeComputedTablesFixture(t, tables, false)

			src := source.NewFileMetadataSource(filepath.Join(dir, "metadata.yaml"))
			defer src.Close()

			m, err := src.InitialLoad(t.Context())
			if err != nil {
				t.Fatal(err)
			}

			raw, _ := src.HasuraSnapshotJSON()
			if !strings.Contains(string(raw), `"computed_fields":[null,`) {
				t.Fatalf("optional invalid key reloaded as valid: %s", raw)
			}

			reloaded, err := metadata.FromHasuraJSON(raw)
			if err != nil {
				t.Fatal(err)
			}

			for _, doc := range []*metadata.Metadata{m, reloaded} {
				fields := doc.Databases[0].Tables[0].ComputedFields
				if len(fields) != 2 || fields[0].DecodeError == "" ||
					fields[1].DecodeError != "" || fields[1].Name != "valid" {
					t.Fatalf("optional invalid key changed fields: %+v", fields)
				}
			}
		})
	}
}

func writeComputedTablesFixture(t *testing.T, tables string, inline bool) string {
	t.Helper()

	if inline {
		return filepath.Dir(writeInlineComputedTables(t, tables))
	}

	dir := writeComputedYAMLFixture(t, `"valid"`, false)
	if err := os.WriteFile(
		filepath.Join(dir, "databases", "tables.yaml"),
		[]byte(tables),
		0o600,
	); err != nil {
		t.Fatal(err)
	}

	return dir
}
