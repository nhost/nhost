package metadata_test

import (
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestSelectRootFieldsRoundTrip(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()

	databases := filepath.Join(dir, "databases")
	if err := os.Mkdir(databases, 0o700); err != nil {
		t.Fatal(err)
	}

	const body = `
- name: default
  kind: postgres
  configuration:
    connection_info:
      database_url: postgres://localhost/db
  tables:
    - table: {schema: public, name: files}
      select_permissions:
        - role: public
          permission:
            columns: '*'
            filter: {}
            query_root_fields: [select_by_pk]
            subscription_root_fields: []
        - role: user
          permission:
            columns: '*'
            filter: {}
            query_root_fields: null
        - role: member
          permission:
            columns: '*'
            filter: {}
            subscription_root_fields:
              - select
              - select_stream
`

	if err := os.WriteFile(
		filepath.Join(databases, "databases.yaml"),
		[]byte(body),
		0o600,
	); err != nil {
		t.Fatal(err)
	}

	fromYAML, snapshot, err := metadata.FromDetectWithHasura(
		t.Context(),
		filepath.Join(dir, "metadata.yaml"),
	)
	if err != nil {
		t.Fatal(err)
	}

	fromJSON, err := metadata.FromHasuraJSON(snapshot)
	if err != nil {
		t.Fatal(err)
	}

	toml, err := metadata.MarshalTOML(fromYAML)
	if err != nil {
		t.Fatal(err)
	}

	tomlPath := filepath.Join(dir, "metadata.toml")
	if err := os.WriteFile(tomlPath, toml, 0o600); err != nil {
		t.Fatal(err)
	}

	fromTOML, err := metadata.FromDetect(t.Context(), tomlPath)
	if err != nil {
		t.Fatal(err)
	}

	for _, tt := range []struct {
		name string
		md   *metadata.Metadata
	}{
		{name: "YAML", md: fromYAML},
		{name: "JSON snapshot", md: fromJSON},
		{name: "TOML", md: fromTOML},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			assertSelectRootFields(t, tt.md.Databases[0].Tables[0].SelectPermissions)
		})
	}
}

func assertSelectRootFields(t *testing.T, permissions []metadata.SelectPermission) {
	t.Helper()

	public := permissions[0].Permission
	if public.QueryRootFields == nil ||
		!slices.Equal(*public.QueryRootFields, []string{"select_by_pk"}) {
		t.Errorf("public query_root_fields = %v, want [select_by_pk]", public.QueryRootFields)
	}

	if public.SubscriptionRootFields == nil || len(*public.SubscriptionRootFields) != 0 {
		t.Errorf(
			"public subscription_root_fields = %v, want a non-nil empty list",
			public.SubscriptionRootFields,
		)
	}

	user := permissions[1].Permission
	if user.QueryRootFields != nil || user.SubscriptionRootFields != nil {
		t.Errorf("null or omitted allowlists must stay nil, got %+v", user)
	}

	member := permissions[2].Permission
	if member.SubscriptionRootFields == nil ||
		!slices.Equal(*member.SubscriptionRootFields, []string{"select", "select_stream"}) {
		t.Errorf(
			"member subscription_root_fields = %v, want [select select_stream]",
			member.SubscriptionRootFields,
		)
	}
}

func TestSelectRootFieldsRejectInvalidEntries(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct {
		name       string
		key        string
		value      string
		diagnostic string
	}{
		{"query stream", "query_root_fields", `["select_stream"]`, `query_root_fields[0]: unknown root operation "select_stream"`},
		{"typo", "subscription_root_fields", `["select", "select_by_pkk"]`, `subscription_root_fields[1]: unknown root operation "select_by_pkk"`},
		{"null element", "query_root_fields", `["select", null]`, `query_root_fields[1]: expected an operation name string`},
		{"number", "subscription_root_fields", `[1]`, `subscription_root_fields[0]: expected an operation name string`},
		{"boolean", "query_root_fields", `[true]`, `query_root_fields[0]: expected an operation name string`},
		{"scalar list", "subscription_root_fields", `"select"`, `subscription_root_fields: expected a list`},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			blob := fmt.Sprintf(`{"version":3,"sources":[{"name":"default","tables":[{
				"table":{"schema":"public","name":"files"},
				"select_permissions":[{"role":"reader","permission":{%q:%s}}]
			}]}]}`, tt.key, tt.value)
			_, err := metadata.FromHasuraJSON([]byte(blob))
			assertInvalidRootFieldsError(t, "JSON", err, tt.diagnostic)

			for _, include := range []bool{false, true} {
				path := invalidRootFieldsYAML(t, tt.key, tt.value, include)
				_, _, err := metadata.FromDetectWithHasura(t.Context(), path)
				assertInvalidRootFieldsError(t, path, err, tt.diagnostic)
			}
		})
	}
}

func invalidRootFieldsYAML(t *testing.T, key, value string, include bool) string {
	t.Helper()

	dir := t.TempDir()

	databases := filepath.Join(dir, "databases")
	if err := os.Mkdir(databases, 0o700); err != nil {
		t.Fatal(err)
	}

	const source = "- name: default\n  kind: postgres\n  tables:\n"

	table := fmt.Sprintf(`- table: {schema: public, name: files}
  select_permissions:
    - role: reader
      permission:
        %s: %s
`, key, value)

	var body string
	if include {
		// Include a single table (without the leading sequence item).
		file := strings.ReplaceAll(strings.TrimPrefix(table, "- "), "\n  ", "\n")
		if err := os.WriteFile(
			filepath.Join(databases, "files.yaml"),
			[]byte(file),
			0o600,
		); err != nil {
			t.Fatal(err)
		}

		body = source + "    - '!include files.yaml'\n"
	} else {
		body = source + "    " + strings.ReplaceAll(
			strings.TrimSuffix(table, "\n"),
			"\n",
			"\n    ",
		) + "\n"
	}

	if err := os.WriteFile(
		filepath.Join(databases, "databases.yaml"),
		[]byte(body),
		0o600,
	); err != nil {
		t.Fatal(err)
	}

	return filepath.Join(dir, "metadata.yaml")
}

func TestSelectRootFieldsRejectInvalidTOML(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct {
		key, value, diagnostic string
	}{
		{"query_root_fields", `['select_stream']`, `query_root_fields[0]: unknown root operation "select_stream"`},
		{"subscription_root_fields", `['select_by_pkk']`, `subscription_root_fields[0]: unknown root operation "select_by_pkk"`},
		{"query_root_fields", `[1]`, `toml: cannot decode TOML integer into struct field`},
	} {
		t.Run(tt.key+tt.value, func(t *testing.T) {
			t.Parallel()

			path := filepath.Join(t.TempDir(), "metadata.toml")

			body := fmt.Sprintf(`[[databases]]
name = 'default'
[[databases.tables]]
table = {schema = 'public', name = 'files'}
[[databases.tables.select_permissions]]
role = 'reader'
[databases.tables.select_permissions.permission]
%s = %s
`, tt.key, tt.value)
			if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
				t.Fatal(err)
			}

			_, err := metadata.FromDetect(t.Context(), path)
			assertInvalidRootFieldsError(t, "TOML", err, tt.diagnostic)
		})
	}
}

func assertInvalidRootFieldsError(t *testing.T, format string, err error, diagnostic string) {
	t.Helper()

	if err == nil || !strings.Contains(err.Error(), diagnostic) {
		t.Errorf("%s: got %v, want error containing %q", format, err, diagnostic)
	}
}
