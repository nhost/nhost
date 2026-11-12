package composer

import (
	"log/slog"
	"slices"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/schema"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func objectFieldNames(s *graph.Schema, name string) []string {
	for _, obj := range s.Types {
		if obj.Name == name {
			names := make([]string, 0, len(obj.Fields))
			for _, field := range obj.Fields {
				names = append(names, field.Name)
			}

			return names
		}
	}

	return nil
}

//nolint:gocognit,gocyclo,cyclop,maintidx // The generator's collision/return/role matrix verifies each aggregate family and surviving root.
func TestComputedCollisionPrunesEmptyAggregateFamilies(t *testing.T) {
	t.Parallel()

	type tc struct {
		name      string
		cols      []introspection.Column
		ret       introspection.PostgreSQLType
		argType   introspection.PostgreSQLType
		collision string // "input" | "scalar" | "none"
	}

	idText := introspection.Column{Name: "id", Type: "text", SupportsMinMax: true}
	amount := introspection.Column{
		Name:           "amount",
		Type:           "numeric",
		IsNullable:     true,
		SupportsMinMax: true,
		SupportsAgg:    true,
	}
	flag := introspection.Column{Name: "flag", Type: "bool"}
	int4 := introspection.PostgreSQLType{OID: 23, Schema: "pg_catalog", Name: "int4", Kind: "b"}
	numeric := introspection.PostgreSQLType{
		OID:    1700,
		Schema: "pg_catalog",
		Name:   "numeric",
		Kind:   "b",
	}
	text := introspection.PostgreSQLType{OID: 25, Schema: "pg_catalog", Name: "text", Kind: "b"}
	mood := introspection.PostgreSQLType{OID: 90001, Schema: "public", Name: "p14_mood", Kind: "e"}

	cases := []tc{
		{
			"numeric-free/int4 return/_args input collision",
			[]introspection.Column{idText},
			int4,
			int4,
			"input",
		},
		{
			"numeric-free/numeric return/_args input collision",
			[]introspection.Column{idText},
			numeric,
			int4,
			"input",
		},
		{
			"numeric-free/int4 return/enum arg scalar-object collision",
			[]introspection.Column{idText},
			int4,
			mood,
			"scalar",
		},
		{
			"comparable-free/text return/_args input collision",
			[]introspection.Column{flag},
			text,
			int4,
			"input",
		},
		{
			"control: numeric column present/_args input collision",
			[]introspection.Column{idText, amount},
			int4,
			int4,
			"input",
		},
		{
			"control: numeric column present/enum scalar-object collision",
			[]introspection.Column{idText, amount},
			int4,
			mood,
			"scalar",
		},
		{"control: numeric-free/no collision", []introspection.Column{idText}, int4, int4, "none"},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			objects := introspection.NewObjects()
			objects.Schemas["cf"] = &introspection.Schema{Tables: map[string]*introspection.Table{
				"items": {
					Schema:       "cf",
					Name:         "items",
					Columns:      tt.cols,
					PrimaryKeys:  []string{tt.cols[0].Name},
					IsInsertable: true,
					IsUpdatable:  true,
				},
			}}
			objects.ComputedFunctions = map[introspection.ComputedTable]map[string]introspection.ComputedFunctionLookup{
				{Schema: "cf", Name: "items"}: {"value": {Function: &introspection.ComputedFunction{
					OID: 10, Schema: "cf", Name: "item_value",
					Arguments: []introspection.ComputedFunctionArgument{
						{
							Type: introspection.PostgreSQLType{
								OID:    1,
								Schema: "cf",
								Name:   "items",
								Kind:   "c",
							},
							Name: "item",
							Mode: "i",
						},
						{Type: tt.argType, Name: "scale", Mode: "i", Position: 1},
					},
					RowArgument: 0,
					ReturnType:  tt.ret,
					Volatility:  introspection.VolatilityStable,
				}}},
			}

			colNames := make([]string, 0, len(tt.cols))
			for _, c := range tt.cols {
				colNames = append(colNames, c.Name)
			}

			md := metadata.DatabaseMetadata{
				Name: "db", Kind: "postgres",
				Tables: []metadata.TableMetadata{{
					Table: metadata.TableSource{Schema: "cf", Name: "items"},
					ComputedFields: []metadata.ComputedField{
						{
							Name: "value",
							Definition: metadata.ComputedFieldDefinition{
								Function: metadata.FunctionSource{Schema: "cf", Name: "item_value"},
							},
						},
					},
					SelectPermissions: []metadata.SelectPermission{
						{
							Role: "granted",
							Permission: metadata.SelectPermissionConfig{
								Columns:           colNames,
								ComputedFields:    []string{"value"},
								Filter:            map[string]any{},
								AllowAggregations: true,
							},
						},
						{
							Role: "ungranted",
							Permission: metadata.SelectPermissionConfig{
								Columns:           colNames,
								Filter:            map[string]any{},
								AllowAggregations: true,
							},
						},
					},
				}},
			}

			caps := schema.NewCapabilities(schema.KindPostgres, dialect.NewPostgresDialect())
			dbSchemas := map[string]*graph.Schema{}

			remoteSchemas := map[string]*graph.Schema{}
			for _, role := range []string{"admin", "granted", "ungranted"} {
				s, err := schema.GenerateForRole(objects, role, &md, caps)
				if err != nil {
					t.Fatal(err)
				}

				dbSchemas[role] = s
				root := "query_root"

				remote := &graph.Schema{QueryType: &root, Types: []*graph.ObjectType{
					{
						Name: root,
						Fields: []*graph.Field{
							{Name: "remoteValue", Type: graph.NewNamedType("Int")},
						},
					},
				}}
				switch tt.collision {
				case "input":
					remote.Inputs = []*graph.InputObjectType{
						{
							Name: "value_cf_items_args",
							Fields: []*graph.InputField{
								{Name: "other", Type: graph.NewNamedType("String")},
							},
						},
					}
					remote.Types[0].Fields = append(
						remote.Types[0].Fields,
						&graph.Field{
							Name: "useArgs",
							Type: graph.NewNamedType("Int"),
							Arguments: []*graph.Argument{
								{Name: "a", Type: graph.NewNamedType("value_cf_items_args")},
							},
						},
					)
				case "scalar":
					remote.Types = append(
						remote.Types,
						&graph.ObjectType{
							Name:   "p14_mood",
							Fields: []*graph.Field{{Name: "id", Type: graph.NewNamedType("Int")}},
						},
					)
					remote.Types[0].Fields = append(
						remote.Types[0].Fields,
						&graph.Field{Name: "mood", Type: graph.NewNamedType("p14_mood")},
					)
				}

				remoteSchemas[role] = remote
			}
			// The provider must retain the original aggregate selections.
			generated := objectFieldNames(dbSchemas["admin"], "cf_items_sum_fields")
			if tt.ret.Name != "text" && !slices.Contains(generated, "value") {
				t.Fatalf("generated sum fields = %v; want value", generated)
			}

			inc := metadata.NewInconsistencies()
			c := New(map[string]SchemaProvider{
				"db":     stubSchemaProvider{schemas: dbSchemas},
				"remote": stubSchemaProvider{schemas: remoteSchemas},
			}, &metadata.Metadata{Databases: []metadata.DatabaseMetadata{md}}, inc)
			result := c.Compose(t.Context(), slog.Default())

			for _, role := range []string{"admin", "granted", "ungranted"} {
				doc := result.ValidatedSchemas[role]
				if doc == nil {
					t.Fatalf("role %s dropped: %+v", role, inc.Snapshot())
				}

				agg := doc.Types["cf_items_aggregate_fields"]
				if agg == nil {
					t.Fatalf("role %s lost aggregate fields", role)
				}

				var got []string
				for _, field := range agg.Fields {
					got = append(got, field.Name)
				}

				slices.Sort(got)

				want := []string{"count", "max", "min"}
				if tt.cols[0].Name == "flag" {
					want = []string{"count"}
				}

				if tt.collision == "none" && role != "ungranted" || len(tt.cols) == 2 {
					want = []string{
						"avg",
						"count",
						"max",
						"min",
						"stddev",
						"stddev_pop",
						"stddev_samp",
						"sum",
						"var_pop",
						"var_samp",
						"variance",
					}
				}

				if !slices.Equal(got, want) {
					t.Errorf("role %s aggregate fields = %v, want %v", role, got, want)
				}

				if doc.Types["cf_items_aggregate"] == nil ||
					doc.Types["cf_items"].Fields.ForName(tt.cols[0].Name) == nil ||
					doc.Types["query_root"].Fields.ForName("remoteValue") == nil {
					t.Errorf("role %s lost nodes, column, or remote root", role)
				}

				for name, typ := range doc.Types {
					if strings.HasPrefix(name, "cf_items_") && strings.HasSuffix(name, "_fields") &&
						len(typ.Fields) == 0 {
						t.Errorf("role %s has empty aggregate object %s", role, name)
					}
				}

				if tt.collision != "none" && role != "ungranted" {
					if doc.Types["cf_items"].Fields.ForName("value") != nil ||
						(doc.Types["cf_items_sum_fields"] != nil && doc.Types["cf_items_sum_fields"].Fields.ForName("value") != nil) {
						t.Errorf("role %s retained conflicting selection", role)
					}
				}
			}

			for _, item := range inc.Snapshot() {
				if item.Kind != metadata.InconsistencyKindComputedField {
					t.Errorf("unexpected inconsistency: %+v", item)
				}
			}
		})
	}
}

func TestComputedSelectionPrunesOnlyNewEmptyOutputTypes(t *testing.T) {
	t.Parallel()

	root := "query_root"
	value := &graph.Field{Name: "value", Type: graph.NewNamedType("Int")}
	original := &graph.Schema{
		QueryType: &root,
		Types: []*graph.ObjectType{
			{Name: root, Fields: []*graph.Field{
				{Name: "items", Type: graph.NewNamedType("Items")},
				{Name: "existing", Type: graph.NewNamedType("ExistingEmpty")},
			}},
			{Name: "Items", Fields: []*graph.Field{
				{Name: "aggregate", Type: graph.NewNamedType("Aggregate")},
			}},
			{Name: "Aggregate", Fields: []*graph.Field{
				{Name: "count", Type: graph.NewNamedType("Int")},
				{Name: "sum", Type: graph.NewNamedType("NumericShell")},
			}},
			{
				Name:   "NumericShell",
				Fields: []*graph.Field{{Name: "fields", Type: graph.NewNamedType("NumericFields")}},
			},
			{Name: "NumericFields", Fields: []*graph.Field{value}},
			{Name: "ExistingEmpty"},
		},
		Interfaces: []*graph.InterfaceType{{Name: "AggregateInterface", Fields: []*graph.Field{
			{Name: "sum", Type: graph.NewNamedType("NumericShell")},
			{Name: "count", Type: graph.NewNamedType("Int")},
		}}},
	}

	got := withoutComputedSelections(original, map[*graph.Field]computedArgumentOwner{
		value: {selection: value},
	})
	if len(got.Types) != 4 || len(got.Types[0].Fields) != 2 ||
		len(got.Types[2].Fields) != 1 || got.Types[2].Fields[0].Name != "count" ||
		got.Types[3].Name != "ExistingEmpty" ||
		len(got.Interfaces[0].Fields) != 1 || got.Interfaces[0].Fields[0].Name != "count" {
		t.Fatalf("output pruning removed unrelated types/fields: %+v", got)
	}

	if len(original.Types[2].Fields) != 2 || len(original.Types[3].Fields) != 1 ||
		len(original.Types[4].Fields) != 1 || len(original.Interfaces[0].Fields) != 2 {
		t.Fatal("provider schema mutated")
	}
}
