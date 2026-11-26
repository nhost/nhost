package sql_test

import (
	"testing"

	"go.uber.org/mock/gomock"

	csql "github.com/nhost/nhost/services/constellation/connector/sql"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/connector/sql/mock"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// TestHasSelectableJoinColumn checks the generated role enum, not just the
// output type: the latter can contain a relationship impersonating a SQL name.
func TestHasSelectableJoinColumn(t *testing.T) {
	t.Parallel()

	for _, backend := range []struct {
		name, kind, schema, identifier string
		dialect                        dialect.Dialect
	}{
		{"postgres", "postgres", "public", "public.kids", dialect.NewPostgresDialect()},
		{"sqlite", "sqlite", "", ".kids", dialect.NewSQLiteDialect()},
	} {
		t.Run(backend.name, func(t *testing.T) {
			t.Parallel()

			objects := introspection.NewObjects()
			objects.Schemas[backend.schema] = &introspection.Schema{
				Tables: map[string]*introspection.Table{
					"kids": {
						Schema: backend.schema, Name: "kids", PrimaryKeys: []string{"id"},
						Columns: []introspection.Column{
							{Name: "id", Type: "integer"},
							{Name: "label", Type: "text"},
							{Name: "lbl", Type: "text"},
						},
					},
				},
			}

			driver := mock.NewMockDriver(gomock.NewController(t))
			driver.EXPECT().Dialect().Return(backend.dialect).AnyTimes()
			driver.EXPECT().Introspect(gomock.Any(), gomock.Any()).Return(objects, nil)
			driver.EXPECT().Close()

			meta := &metadata.DatabaseMetadata{
				Kind: backend.kind,
				Tables: []metadata.TableMetadata{{
					Table: metadata.TableSource{Schema: backend.schema, Name: "kids"},
					Configuration: metadata.TableConfiguration{
						CustomName: "customKids",
						ColumnConfig: map[string]metadata.ColumnConfig{
							"label": {CustomName: "itemLabel"}, "lbl": {CustomName: "otherLabel"},
						},
					},
					ObjectRelationships: []metadata.ObjectRelationship{{
						Name: "lbl", Using: metadata.RelationshipUsing{
							ManualConfiguration: &metadata.ManualConfiguration{
								RemoteTable: metadata.TableSource{
									Schema: backend.schema,
									Name:   "kids",
								},
								ColumnMapping: map[string]string{"id": "id"},
							},
						},
					}},
					SelectPermissions: []metadata.SelectPermission{{
						Role: "reader", Permission: metadata.SelectPermissionConfig{
							Columns: []string{"id", "label"}, Filter: map[string]any{},
						},
					}},
				}},
			}

			conn, err := csql.NewConnector(t.Context(), driver, meta, nil, nil)
			if err != nil {
				t.Fatal(err)
			}

			t.Cleanup(conn.Close)

			for _, tc := range []struct {
				name, identifier, role, column string
				want                           bool
			}{
				{"admin renamed column", backend.identifier, "admin", "otherLabel", true},
				{"reader renamed column", backend.identifier, "reader", "itemLabel", true},
				{"reader id", backend.identifier, "reader", "id", true},
				{"reader denied GraphQL column", backend.identifier, "reader", "otherLabel", false},
				{"relationship impostor admin", backend.identifier, "admin", "lbl", false},
				{"relationship impostor reader", backend.identifier, "reader", "lbl", false},
				{"physical SQL name", backend.identifier, "admin", "label", false},
				{"unknown role", backend.identifier, "stranger", "id", false},
				{"unknown table", backend.schema + ".absent", "admin", "id", false},
				{"malformed identifier", "kids", "admin", "id", false},
			} {
				t.Run(tc.name, func(t *testing.T) {
					if got := conn.HasSelectableJoinColumn(
						tc.identifier,
						tc.role,
						tc.column,
					); got != tc.want {
						t.Errorf("HasSelectableJoinColumn(%q, %q, %q) = %t, want %t",
							tc.identifier, tc.role, tc.column, got, tc.want)
					}
				})
			}
		})
	}
}
