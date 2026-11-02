//nolint:revive,nolintlint // package name "sql" shadows database/sql; this package never imports it.
package sql

import (
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// An order key that belongs to a real field must not invalidate an entire role.
//
//nolint:gocognit,cyclop // One matrix verifies every collision and its non-colliding controls across roles.
func TestComputedTableAggregateOrderCollision(t *testing.T) {
	t.Parallel()

	const sibling = "posts_for_user_aggregate"
	for _, tt := range []struct {
		name      string
		configure func(*metadata.TableMetadata, *introspection.Objects)
		collision bool
	}{
		{"column", func(_ *metadata.TableMetadata, objects *introspection.Objects) {
			objects.Schemas["public"].Tables["users"].Columns = append(
				objects.Schemas["public"].Tables["users"].Columns,
				introspection.Column{Name: sibling, Type: "text"},
			)
		}, true},
		{"renamed physical column", func(table *metadata.TableMetadata, objects *introspection.Objects) {
			objects.Schemas["public"].Tables["users"].Columns = append(
				objects.Schemas["public"].Tables["users"].Columns,
				introspection.Column{Name: sibling, Type: "text"},
			)
			table.Configuration.ColumnConfig = map[string]metadata.ColumnConfig{
				sibling: {CustomName: "renamed"},
			}
		}, false},
		{"custom column", func(table *metadata.TableMetadata, _ *introspection.Objects) {
			table.Configuration.ColumnConfig = map[string]metadata.ColumnConfig{
				"name": {CustomName: sibling},
			}
		}, true},
		{"object relationship", func(table *metadata.TableMetadata, _ *introspection.Objects) {
			table.ObjectRelationships = []metadata.ObjectRelationship{{
				Name: sibling, Using: metadata.RelationshipUsing{ManualConfiguration: &metadata.ManualConfiguration{
					RemoteTable:   metadata.TableSource{Schema: "public", Name: "posts"},
					ColumnMapping: map[string]string{"id": "id"},
				}},
			}}
		}, true},
		{"scalar computed field", func(table *metadata.TableMetadata, objects *introspection.Objects) {
			table.SelectPermissions[0].Permission.ComputedFields = []string{sibling}
			table.ComputedFields = append(table.ComputedFields, metadata.ComputedField{
				Name: sibling, Definition: metadata.ComputedFieldDefinition{
					Function: metadata.FunctionSource{Schema: "public", Name: "user_label"},
				},
			})
			objects.ComputedFunctions[introspection.ComputedTable{Schema: "public", Name: "users"}][sibling] = objects.ComputedFunctions[introspection.ComputedTable{Schema: "public", Name: "users"}]["label"]
		}, true},
		{"scalar before table", func(table *metadata.TableMetadata, objects *introspection.Objects) {
			table.SelectPermissions[0].Permission.ComputedFields = []string{sibling}
			table.ComputedFields = append([]metadata.ComputedField{{
				Name: sibling, Definition: metadata.ComputedFieldDefinition{
					Function: metadata.FunctionSource{Schema: "public", Name: "user_label"},
				},
			}}, table.ComputedFields...)
			objects.ComputedFunctions[introspection.ComputedTable{Schema: "public", Name: "users"}][sibling] = objects.ComputedFunctions[introspection.ComputedTable{Schema: "public", Name: "users"}]["label"]
		}, true},
		{"argument-bearing scalar", func(table *metadata.TableMetadata, objects *introspection.Objects) {
			table.SelectPermissions[0].Permission.ComputedFields = []string{sibling}
			table.ComputedFields = append(table.ComputedFields, metadata.ComputedField{
				Name: sibling, Definition: metadata.ComputedFieldDefinition{
					Function: metadata.FunctionSource{Schema: "public", Name: "user_label"},
				},
			})
			functions := objects.ComputedFunctions[introspection.ComputedTable{Schema: "public", Name: "users"}]
			lookup := functions["label"]
			fn := *lookup.Function
			fn.Arguments = append(fn.Arguments, introspection.ComputedFunctionArgument{
				Mode: "i", Type: introspection.PostgreSQLType{Schema: "pg_catalog", Name: "int4", Kind: "b"},
			})
			lookup.Function = &fn
			functions[sibling] = lookup
		}, false},
		{"array relationship exact name", func(table *metadata.TableMetadata, _ *introspection.Objects) {
			table.ArrayRelationships = []metadata.ArrayRelationship{{
				Name: sibling, Using: metadata.RelationshipUsing{ManualConfiguration: &metadata.ManualConfiguration{
					RemoteTable:   metadata.TableSource{Schema: "public", Name: "posts"},
					ColumnMapping: map[string]string{"id": "id"},
				}},
			}}
		}, false},
		{"argument-bearing table field", func(table *metadata.TableMetadata, objects *introspection.Objects) {
			objects.Schemas["public"].Tables["users"].Columns = append(
				objects.Schemas["public"].Tables["users"].Columns,
				introspection.Column{Name: sibling, Type: "text"},
			)
			fn := objects.ComputedFunctions[introspection.ComputedTable{Schema: "public", Name: "users"}]["posts_for_user"].Function
			fn.Arguments = append(fn.Arguments, introspection.ComputedFunctionArgument{
				Mode: "i", Type: introspection.PostgreSQLType{Schema: "pg_catalog", Name: "int4", Kind: "b"},
			})
		}, false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			md, objects := computedReconcileFixture()
			table := &md.Tables[0]
			table.SelectPermissions = []metadata.SelectPermission{{
				Role: "reader", Permission: metadata.SelectPermissionConfig{Columns: []string{"*"}},
			}}
			md.Tables[1].SelectPermissions = []metadata.SelectPermission{{
				Role: "reader", Permission: metadata.SelectPermissionConfig{
					Columns: []string{"id"}, AllowAggregations: true,
				},
			}}

			tt.configure(table, objects)

			inc := metadata.NewInconsistencies()
			effective := reconcileMetadata(t.Context(), nil, inc, md, objects)

			found := false
			for _, item := range inc.Snapshot() {
				if item.Kind == metadata.InconsistencyKindComputedField &&
					item.Name == "public.users.posts_for_user" &&
					strings.Contains(item.Reason, sibling) {
					found = true
				}

				if item.Kind == metadata.InconsistencyKindSelectPermission {
					t.Fatalf("lost unrelated select grant: %+v", item)
				}
			}

			if found != tt.collision {
				t.Fatalf("wrong collision diagnosis: %+v", inc.Snapshot())
			}

			kept := false
			for _, field := range effective.Tables[0].ComputedFields {
				if field.Name == "posts_for_user" {
					kept = true
				}
			}

			if kept == tt.collision {
				t.Fatalf(
					"wrong table computed selection availability: collision=%t, kept=%t",
					tt.collision,
					kept,
				)
			}

			schemas, err := reloadSchema(objects, effective, dialect.NewPostgresDialect())
			if err != nil {
				t.Fatal(err)
			}

			for _, role := range []string{"admin", "reader"} {
				if _, _, err := schemamerge.BuildValidatedSchema(schemas[role], role); err != nil {
					t.Fatalf("%s role lost: %v", role, err)
				}

				defs := schemas[role].ToAST().Definitions
				if defs.ForName("users") == nil || defs.ForName("posts") == nil ||
					defs.ForName("users_order_by") == nil {
					t.Fatalf("%s unrelated roots missing", role)
				}

				var keys, renamedKeys int
				for _, field := range defs.ForName("users_order_by").Fields {
					if field.Name == sibling {
						keys++
					}

					if field.Name == "renamed" {
						renamedKeys++
					}
				}

				if keys != 1 {
					t.Fatalf("%s: wanted one unambiguous order key, got %d", role, keys)
				}

				if tt.name == "renamed physical column" && renamedKeys != 1 {
					t.Fatalf("%s: wanted renamed column order key, got %d", role, renamedKeys)
				}
			}
		})
	}
}
