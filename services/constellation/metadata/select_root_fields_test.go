package metadata_test

import (
	"os"
	"path/filepath"
	"slices"
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
}
