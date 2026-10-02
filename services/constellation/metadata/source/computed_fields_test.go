package source_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/nhost/nhost/services/constellation/metadata/source"
)

func TestComputedFieldsFileSnapshotRetainsMalformedEntries(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	if err := os.Mkdir(filepath.Join(dir, "databases"), 0o700); err != nil {
		t.Fatal(err)
	}

	const yaml = `
- name: cf
  kind: postgres
  configuration:
    connection_info:
      database_url: postgres://localhost/db
  tables:
    - table: {name: items, schema: public}
      computed_fields:
        - name: valid
          definition: {function: calc, table_argument: item}
          comment: retained
          future: {key: yes}
        - name: invalid
          definition: {function: 33}
        - 12
      select_permissions:
        - role: reader
          permission:
            columns: '*'
            filter: {}
            computed_fields: [valid, 12, null]
            future_permission: kept
    - table: {name: absent, schema: public}
    - table: {name: empty, schema: public}
      computed_fields: []
    - table: {name: nil, schema: public}
      computed_fields: null
`
	if err := os.WriteFile(
		filepath.Join(dir, "databases", "databases.yaml"),
		[]byte(yaml),
		0o600,
	); err != nil {
		t.Fatal(err)
	}

	src := source.NewFileMetadataSource(filepath.Join(dir, "metadata.yaml"))
	defer src.Close()

	m, err := src.InitialLoad(t.Context())
	if err != nil {
		t.Fatal(err)
	}

	fields := m.Databases[0].Tables[0].ComputedFields
	if len(fields) != 3 || fields[0].Definition.Function.Name != "calc" ||
		fields[0].DecodeError != "" ||
		fields[1].DecodeError == "" ||
		fields[2].DecodeError == "" {
		t.Fatalf("YAML computed definitions: %+v", fields)
	}

	p := m.Databases[0].Tables[0].SelectPermissions[0].Permission
	if !reflect.DeepEqual(p.Columns, []string{"*"}) ||
		!reflect.DeepEqual(p.ComputedFields, []string{"valid"}) ||
		len(p.InvalidComputedFields) != 2 {
		t.Fatalf("YAML grants: %+v", p)
	}

	raw, _ := src.HasuraSnapshotJSON()
	assertComputedFileSnapshot(t, raw)
}

func assertComputedFileSnapshot(t *testing.T, raw []byte) {
	t.Helper()

	var snapshot struct {
		Sources []struct {
			Tables []map[string]json.RawMessage `json:"tables"`
		} `json:"sources"`
	}
	if err := json.Unmarshal(raw, &snapshot); err != nil {
		t.Fatalf("snapshot JSON: %v", err)
	}

	tables := snapshot.Sources[0].Tables

	var values []json.RawMessage
	if err := json.Unmarshal(
		tables[0]["computed_fields"],
		&values,
	); err != nil ||
		len(values) != 3 {
		t.Fatalf("snapshot computed fields: %s (%v)", tables[0]["computed_fields"], err)
	}

	var valid struct {
		Future json.RawMessage `json:"future"`
	}
	if err := json.Unmarshal(
		values[0],
		&valid,
	); err != nil || len(valid.Future) == 0 ||
		string(values[2]) != "12" {
		t.Fatalf("snapshot computed fields: %s (%v)", tables[0]["computed_fields"], err)
	}

	var perms []struct {
		Permission struct {
			Future string          `json:"future_permission"`
			Grants json.RawMessage `json:"computed_fields"`
		} `json:"permission"`
	}
	if err := json.Unmarshal(tables[0]["select_permissions"], &perms); err != nil {
		t.Fatal(err)
	}

	if perms[0].Permission.Future != "kept" ||
		string(perms[0].Permission.Grants) != `["valid",12,null]` {
		t.Fatalf("snapshot grants: %+v", perms[0].Permission)
	}

	if _, ok := tables[1]["computed_fields"]; ok {
		t.Fatalf("absent key appeared: %s", tables[1]["computed_fields"])
	}

	if string(tables[2]["computed_fields"]) != "[]" ||
		string(tables[3]["computed_fields"]) != "null" {
		t.Fatalf(
			"empty/null lost: %s / %s",
			tables[2]["computed_fields"],
			tables[3]["computed_fields"],
		)
	}
}
