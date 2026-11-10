package composer

import (
	"log/slog"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/schema"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// Exercise the actual SQL schema generator: computed and tracked-function
// inputs with the same name must not turn a field-local conflict into role loss.
//
//nolint:gocognit,gocyclo,cyclop,maintidx // Each case checks generated roles, roots, inputs, aggregate pruning and inconsistencies together.
func TestSameSourceComputedFunctionArgumentCollision(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name        string
		functionArg string
		defaultArg  bool
		numeric     bool
		customName  bool
		tableReturn bool
		omit        bool
	}{
		{name: "different fields", functionArg: "factor", numeric: true, omit: true},
		{name: "custom function base name", functionArg: "factor", customName: true, omit: true},
		{name: "table-returning computed field", functionArg: "factor", tableReturn: true, omit: true},
		{name: "no numeric column", functionArg: "factor", omit: true},
		{name: "same SQL fields but different GraphQL nullability", functionArg: "scale", omit: true},
		{name: "identical GraphQL inputs remain shared", functionArg: "scale", defaultArg: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			cols := []introspection.Column{{Name: "id", Type: "text", SupportsMinMax: true}}
			if tc.numeric {
				cols = append(cols, introspection.Column{
					Name: "amount", Type: "numeric", SupportsMinMax: true, SupportsAgg: true,
				})
			}

			objects := introspection.NewObjects()
			objects.Schemas["public"] = &introspection.Schema{
				Tables: map[string]*introspection.Table{
					"items": {
						Schema: "public", Name: "items", Columns: cols, PrimaryKeys: []string{"id"},
						IsInsertable: true, IsUpdatable: true,
					},
				},
			}
			returnType := introspection.PostgreSQLType{
				OID: 1700, Schema: "pg_catalog", Name: "numeric", Kind: "b",
			}

			returnRelOID := uint32(0)
			if tc.tableReturn {
				returnType = introspection.PostgreSQLType{
					OID: 1, Schema: "public", Name: "items", Kind: "c",
				}
				returnRelOID = 1
			}

			objects.ComputedFunctions = map[introspection.ComputedTable]map[string]introspection.ComputedFunctionLookup{
				{Schema: "public", Name: "items"}: {
					"value": {Function: &introspection.ComputedFunction{
						OID:    10,
						Schema: "public",
						Name:   "item_value",
						Arguments: []introspection.ComputedFunctionArgument{
							{
								Type: introspection.PostgreSQLType{
									OID:    1,
									Schema: "public",
									Name:   "items",
									Kind:   "c",
								},
								Name: "item",
								Mode: "i",
							},
							{
								Type: introspection.PostgreSQLType{
									OID:    23,
									Schema: "pg_catalog",
									Name:   "int4",
									Kind:   "b",
								},
								Name:     "scale",
								Mode:     "i",
								Position: 1,
							},
						},
						RowArgument:  0,
						ReturnType:   returnType,
						ReturnRelOID: returnRelOID,
						Volatility:   introspection.VolatilityStable,
					}},
				},
			}

			functionName := "value_items"
			if tc.customName {
				functionName = "search_items"
			}

			objects.Functions["public."+functionName] = &introspection.Function{
				Arguments: []introspection.FunctionArgument{
					{Name: tc.functionArg, Type: "int4", HasDefault: tc.defaultArg},
				},
				ReturnType: introspection.FunctionReturnType{
					Type:        "items",
					IsSetOf:     true,
					TableSchema: "public",
					TableName:   "items",
				},
				Volatility: introspection.VolatilityStable,
			}

			columns := []string{"id"}
			if tc.numeric {
				columns = append(columns, "amount")
			}

			functionConfig := metadata.FunctionConfiguration{}
			if tc.customName {
				functionConfig.CustomName = "value_items"
			}

			md := metadata.DatabaseMetadata{
				Name: "db", Kind: "postgres",
				Tables: []metadata.TableMetadata{{
					Table: metadata.TableSource{Schema: "public", Name: "items"},
					ComputedFields: []metadata.ComputedField{{
						Name: "value", Definition: metadata.ComputedFieldDefinition{
							Function: metadata.FunctionSource{Schema: "public", Name: "item_value"},
						},
					}},
					SelectPermissions: []metadata.SelectPermission{{
						Role: "granted", Permission: metadata.SelectPermissionConfig{
							Columns: columns, ComputedFields: []string{"value"},
							Filter: map[string]any{}, AllowAggregations: true,
						},
					}},
				}},
				Functions: []metadata.FunctionMetadata{{
					Function:      metadata.FunctionSource{Schema: "public", Name: functionName},
					Configuration: functionConfig,
					Permissions:   []metadata.FunctionPermission{{Role: "granted"}},
				}},
			}

			caps := schema.NewCapabilities(schema.KindPostgres, dialect.NewPostgresDialect())

			schemas := map[string]*graph.Schema{}
			for _, role := range []string{"admin", "granted"} {
				var err error

				schemas[role], err = schema.GenerateForRole(objects, role, &md, caps)
				if err != nil {
					t.Fatal(err)
				}
			}

			inc := metadata.NewInconsistencies()
			c := New(map[string]SchemaProvider{
				"db": stubSchemaProvider{schemas: schemas},
			}, &metadata.Metadata{Databases: []metadata.DatabaseMetadata{md}}, inc)
			result := c.Compose(t.Context(), slog.Default())

			for _, role := range []string{"admin", "granted"} {
				doc := result.SchemaDocs[role]
				if doc == nil {
					t.Fatalf("role %s lost: %+v", role, inc.Snapshot())
				}

				root := doc.Definitions.ForName("query_root")
				item := doc.Definitions.ForName("items")

				input := doc.Definitions.ForName("value_items_args")
				if root == nil || root.Fields.ForName("items") == nil ||
					root.Fields.ForName("value_items") == nil ||
					root.Fields.ForName("value_items_aggregate") == nil ||
					item == nil || item.Fields.ForName("id") == nil || input == nil ||
					input.Fields.ForName(tc.functionArg) == nil ||
					(tc.omit && input.Fields.ForName("scale") != nil && tc.functionArg != "scale") ||
					input.Fields.ForName(tc.functionArg).Type.NonNull != !tc.defaultArg ||
					(item.Fields.ForName("value") == nil) != tc.omit {
					t.Fatalf(
						"role %s lost function/input/table or incorrect computed selection",
						role,
					)
				}

				if tc.omit && !tc.numeric {
					for _, family := range []string{"sum", "avg", "stddev", "var_pop"} {
						if doc.Definitions.ForName("items_"+family+"_fields") != nil {
							t.Fatalf("role %s retained empty aggregate %s", role, family)
						}
					}
				}
			}

			items := inc.Snapshot()
			if tc.omit {
				if len(items) != 2 {
					t.Fatalf("expected one computed inconsistency per role: %+v", items)
				}

				for _, item := range items {
					if item.Kind != metadata.InconsistencyKindComputedField ||
						item.Name != "public.items.value" {
						t.Fatalf("unexpected inconsistency: %+v", item)
					}
				}
			} else if len(items) != 0 {
				t.Fatalf("shared input was rejected: %+v", items)
			}
		})
	}
}
