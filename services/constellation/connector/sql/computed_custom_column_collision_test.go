package sql_test

import (
	"strings"
	"testing"

	"go.uber.org/mock/gomock"

	csql "github.com/nhost/nhost/services/constellation/connector/sql"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/connector/sql/mock"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// A custom GraphQL column name does not make a permission predicate's key a
// physical column. The invalid computed reference must not abort BuildRoots.
func TestNewConnectorComputedCustomColumnPredicateIsolated(t *testing.T) {
	t.Parallel()

	objects := introspection.NewObjects()
	objects.Schemas["public"] = &introspection.Schema{
		Tables: map[string]*introspection.Table{
			"users": {
				Schema: "public", Name: "users",
				Columns:     []introspection.Column{{Name: "id", Type: "int4"}},
				PrimaryKeys: []string{"id"},
			},
			"posts": {
				Schema: "public", Name: "posts",
				Columns:     []introspection.Column{{Name: "id", Type: "int4"}},
				PrimaryKeys: []string{"id"},
			},
		},
	}

	md := &metadata.DatabaseMetadata{
		Name: "default", Kind: "postgres",
		Tables: []metadata.TableMetadata{
			{
				Table: metadata.TableSource{Schema: "public", Name: "users"},
				Configuration: metadata.TableConfiguration{
					ColumnConfig: map[string]metadata.ColumnConfig{
						"id": {CustomName: "label"},
					},
				},
				ComputedFields: []metadata.ComputedField{{
					Name: "label", Definition: metadata.ComputedFieldDefinition{
						Function: metadata.FunctionSource{Schema: "public", Name: "user_label"},
					},
				}},
				SelectPermissions: []metadata.SelectPermission{
					{Role: "affected", Permission: metadata.SelectPermissionConfig{
						Columns: []string{"id"}, Filter: map[string]any{
							"label": map[string]any{"_eq": 1},
						},
					}},
					{Role: "physical", Permission: metadata.SelectPermissionConfig{
						Columns: []string{"id"}, Filter: map[string]any{
							"id": map[string]any{"_eq": 1},
						},
					}},
					{Role: "healthy", Permission: metadata.SelectPermissionConfig{
						Columns: []string{"id"},
					}},
				},
			},
			{
				Table: metadata.TableSource{Schema: "public", Name: "posts"},
				SelectPermissions: []metadata.SelectPermission{
					{
						Role:       "affected",
						Permission: metadata.SelectPermissionConfig{Columns: []string{"id"}},
					},
				},
			},
		},
	}

	driver := mock.NewMockDriver(gomock.NewController(t))
	driver.EXPECT().Dialect().Return(&dialect.PostgresDialect{}).AnyTimes()
	driver.EXPECT().Introspect(gomock.Any(), gomock.Any()).Return(objects, nil).Times(2)
	driver.EXPECT().Close().AnyTimes()

	inc := metadata.NewInconsistencies()

	conn, err := csql.NewConnector(t.Context(), driver, md, inc, nil)
	if err != nil {
		t.Fatalf("NewConnector: %v", err)
	}

	t.Cleanup(conn.Close)

	want := map[string]string{
		metadata.InconsistencyKindComputedField:    "public.users.label",
		metadata.InconsistencyKindSelectPermission: "public.users.affected",
	}
	if entries := inc.Snapshot(); len(entries) != len(want) {
		t.Fatalf("inconsistencies: %+v", entries)
	}

	for _, entry := range inc.Snapshot() {
		if entry.Name != want[entry.Kind] || entry.Source != "default" {
			t.Errorf("unexpected inconsistency: %+v", entry)
		}
	}

	schemas, err := conn.GetSchema()
	if err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct {
		role, root string
		want       bool
	}{
		{"admin", "users", true},
		{"affected", "users", false},
		{"affected", "posts", true},
		{"physical", "users", true},
		{"healthy", "users", true},
	} {
		if got := computedQueryHasField(schemas[tc.role], tc.root); got != tc.want {
			t.Errorf("%s %s root present = %t, want %t", tc.role, tc.root, got, tc.want)
		}
	}

	// The same custom-name predicate without a computed definition is still
	// unknown to the permission parser; it must not silently grant access.
	md.Tables[0].ComputedFields = nil

	_, err = csql.NewConnector(t.Context(), driver, md, nil, nil)
	if err == nil || !strings.Contains(err.Error(), "failed to build GraphQL roots") {
		t.Fatalf("unidentified custom-name predicate changed root failure: %v", err)
	}
}
