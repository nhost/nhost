package composer

import (
	"log/slog"
	"testing"

	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestOmitConflictingComputedArgsBeforeRoleComposition(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name      string
		table     string
		inputType string
		other     *graph.Schema
		omitted   bool
	}{
		{
			name:  "remote schema input type collision",
			table: "cf.items",
			other: &graph.Schema{Inputs: []*graph.InputObjectType{{
				Name: "value_cf_items_args", Fields: []*graph.InputField{{Name: "different", Type: graph.NewNamedType("String")}},
			}}},
			omitted: true,
		},
		{
			name:    "another source object type collision",
			table:   "items",
			other:   &graph.Schema{Types: []*graph.ObjectType{{Name: "value_cf_items_args"}}},
			omitted: true,
		},
		{
			name:  "conflicting custom scalar input",
			table: "cf.items", inputType: "p14_pair_scalar",
			other: &graph.Schema{Inputs: []*graph.InputObjectType{{
				Name: "value_cf_items_args", Fields: []*graph.InputField{{Name: "scale", Type: graph.NewNamedType("p14_posint")}},
			}}},
			omitted: true,
		},
		{
			name:  "identical custom scalar input is shared",
			table: "cf.items", inputType: "p14_pair_scalar",
			other: &graph.Schema{Inputs: []*graph.InputObjectType{{
				Name: "value_cf_items_args", Fields: []*graph.InputField{{Name: "scale", Type: graph.NewNamedType("p14_pair_scalar")}},
			}}},
			omitted: false,
		},
		{
			name:  "identical input is shared",
			table: "cf.items",
			other: &graph.Schema{Inputs: []*graph.InputObjectType{{
				Name: "value_cf_items_args", Fields: []*graph.InputField{{Name: "scale", Type: graph.NewNamedType("Int")}},
			}}},
			omitted: false,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			inputType := tc.inputType
			if inputType == "" {
				inputType = "Int"
			}

			input := &graph.InputObjectType{
				Name:   "value_cf_items_args",
				Fields: []*graph.InputField{{Name: "scale", Type: graph.NewNamedType(inputType)}},
			}
			field := &graph.Field{
				Name: "value", Type: graph.NewNamedType("Int"),
				Arguments: []*graph.Argument{
					{
						Name:        "args",
						Type:        graph.NewNamedType(input.Name),
						Description: `input parameters for computed field "value" defined on table "` + tc.table + `"`,
					},
				},
			}
			source := &graph.Schema{
				Types:  []*graph.ObjectType{{Name: "cf_items", Fields: []*graph.Field{field}}},
				Inputs: []*graph.InputObjectType{input},
			}
			roles := map[string]map[string]*graph.Schema{
				"db":    {"reader": source},
				"other": {"reader": tc.other},
			}
			inc := metadata.NewInconsistencies()

			table := metadata.TableSource{Schema: "cf", Name: "items"}
			if tc.table == "items" {
				table.Schema = "public"
			}

			c := New(
				nil,
				&metadata.Metadata{Databases: []metadata.DatabaseMetadata{{
					Name: "db", Tables: []metadata.TableMetadata{{Table: table}},
				}}},
				inc,
			)
			c.omitConflictingComputedArgs(t.Context(), slog.Default(), roles)

			got := roles["db"]["reader"]
			if (len(got.Types) == 0) != tc.omitted || (len(got.Inputs) == 0) != tc.omitted {
				t.Fatalf("computed selection/type/input omission = %d/%d; omitted = %t",
					len(got.Types), len(got.Inputs), tc.omitted)
			}

			if len(source.Types[0].Fields) != 1 || len(source.Inputs) != 1 {
				t.Fatal("provider schema mutated during composition")
			}

			if tc.omitted {
				want := tc.table + ".value"
				if tc.table == "items" {
					want = "public.items.value"
				}

				items := inc.Snapshot()
				if len(items) != 1 || items[0].Name != want {
					t.Fatalf("computed inconsistency = %+v, want %q", items, want)
				}
			}
		})
	}
}

func TestComputedOwnerTableWithDottedIdentifiers(t *testing.T) {
	t.Parallel()

	c := New(nil, &metadata.Metadata{Databases: []metadata.DatabaseMetadata{{
		Name: "db", Tables: []metadata.TableMetadata{{
			Table: metadata.TableSource{Schema: "cf.with.dot", Name: "items.with.dot"},
		}},
	}}}, nil)

	schema, name := c.computedOwnerTable(computedArgumentOwner{
		connector: "db", table: "cf.with.dot.items.with.dot",
	})
	if schema != "cf.with.dot" || name != "items.with.dot" {
		t.Fatalf("owner table = %q.%q", schema, name)
	}
}

func TestComputedArgsConflictRetainsRole(t *testing.T) {
	t.Parallel()

	root := "query_root"
	computed := &graph.Field{
		Name: "value", Type: graph.NewNamedType("Int"),
		Arguments: []*graph.Argument{{
			Name: "args", Type: graph.NewNamedType("value_cf_items_args"),
			Description: `input parameters for computed field "value" defined on table "cf.items"`,
		}},
	}
	sqlSchema := &graph.Schema{
		QueryType: &root,
		Types: []*graph.ObjectType{
			{
				Name:   root,
				Fields: []*graph.Field{{Name: "items", Type: graph.NewNamedType("cf_items")}},
			},
			{
				Name: "cf_items",
				Fields: []*graph.Field{
					{Name: "id", Type: graph.NewNamedType("Int")},
					{Name: "echo", Type: graph.NewNamedType("p14_pair_scalar")},
					computed,
				},
			},
		},
		Inputs: []*graph.InputObjectType{
			{
				Name: "value_cf_items_args",
				Fields: []*graph.InputField{
					{Name: "scale", Type: graph.NewNamedType("p14_pair_scalar")},
				},
			},
		},
		Scalars: []*graph.ScalarType{{Name: "p14_pair_scalar"}},
	}
	remote := &graph.Schema{
		QueryType: &root,
		Types: []*graph.ObjectType{
			{
				Name:   root,
				Fields: []*graph.Field{{Name: "remoteValue", Type: graph.NewNamedType("Int")}},
			},
		},
		Inputs: []*graph.InputObjectType{
			{
				Name:   "value_cf_items_args",
				Fields: []*graph.InputField{{Name: "other", Type: graph.NewNamedType("String")}},
			},
		},
	}
	inconsistencies := metadata.NewInconsistencies()
	c := New(map[string]SchemaProvider{
		"db":     stubSchemaProvider{schemas: map[string]*graph.Schema{"reader": sqlSchema}},
		"remote": stubSchemaProvider{schemas: map[string]*graph.Schema{"reader": remote}},
	}, &metadata.Metadata{Databases: []metadata.DatabaseMetadata{{Name: "db"}}}, inconsistencies)
	result := c.Compose(t.Context(), slog.Default())

	doc := result.SchemaDocs["reader"]
	if doc == nil || doc.Definitions.ForName("cf_items").Fields.ForName("value") != nil ||
		doc.Definitions.ForName("query_root").Fields.ForName("remoteValue") == nil ||
		doc.Definitions.ForName("query_root").Fields.ForName("items") == nil ||
		doc.Definitions.ForName("cf_items").Fields.ForName("echo") == nil ||
		doc.Definitions.ForName("p14_pair_scalar") == nil {
		t.Fatalf("computed collision removed the role or unrelated roots: %+v", doc)
	}

	input := doc.Definitions.ForName("value_cf_items_args")
	if input == nil || input.Fields.ForName("other") == nil ||
		input.Fields.ForName("scale") != nil {
		t.Fatalf("remote input was not preserved: %+v", input)
	}

	items := inconsistencies.Snapshot()
	if len(items) != 1 || items[0].Kind != metadata.InconsistencyKindComputedField {
		t.Fatalf("collision inconsistency: %+v", items)
	}
}

// The custom argument scalar must not turn an unrelated source's non-scalar
// definition into a whole-role failure (including the implicit admin role).
//
//nolint:cyclop // The role and type-kind matrix shares one adversarial composed schema shape.
func TestComputedScalarCollisionKeepsRolesAndOtherSources(t *testing.T) {
	t.Parallel()

	for _, kind := range []string{"object", "enum", "input", "same-source object"} {
		t.Run(kind, func(t *testing.T) {
			t.Parallel()

			root := "query_root"

			const scalar = "p14_mood"

			makeSQL := func() *graph.Schema {
				return &graph.Schema{
					QueryType: &root,
					Types: []*graph.ObjectType{
						{
							Name: root,
							Fields: []*graph.Field{
								{Name: "items", Type: graph.NewNamedType("cf_items")},
							},
						},
						{Name: "cf_items", Fields: []*graph.Field{
							{Name: "id", Type: graph.NewNamedType("Int")},
							{
								Name: "mood",
								Type: graph.NewNamedType("String"),
								Arguments: []*graph.Argument{
									{
										Name:        "args",
										Type:        graph.NewNamedType("mood_cf_items_args"),
										Description: `input parameters for computed field "mood" defined on table "cf.items"`,
									},
								},
							},
						}},
					},
					Inputs: []*graph.InputObjectType{
						{
							Name: "mood_cf_items_args",
							Fields: []*graph.InputField{
								{Name: "m", Type: graph.NewNamedType(scalar)},
							},
						},
					},
					Scalars: []*graph.ScalarType{{Name: scalar}},
				}
			}

			other := &graph.Schema{QueryType: &root, Types: []*graph.ObjectType{
				{
					Name:   root,
					Fields: []*graph.Field{{Name: "otherRoot", Type: graph.NewNamedType("String")}},
				},
			}}
			switch kind {
			case "object":
				other.Types = append(
					other.Types,
					&graph.ObjectType{
						Name:   scalar,
						Fields: []*graph.Field{{Name: "id", Type: graph.NewNamedType("Int")}},
					},
				)
			case "enum":
				other.Enums = []*graph.EnumType{
					{Name: scalar, Values: []*graph.EnumValue{{Name: "OK"}}},
				}
			case "input":
				other.Inputs = []*graph.InputObjectType{
					{
						Name:   scalar,
						Fields: []*graph.InputField{{Name: "id", Type: graph.NewNamedType("Int")}},
					},
				}
			case "same-source object":
				// The same connector can emit a non-scalar with the name of an
				// independently generated computed argument scalar.
			}

			providers := map[string]SchemaProvider{}

			dbSchemas := map[string]*graph.Schema{"admin": makeSQL(), "reader": makeSQL()}
			if kind == "same-source object" {
				for _, schema := range dbSchemas {
					schema.Types = append(
						schema.Types,
						&graph.ObjectType{
							Name:   scalar,
							Fields: []*graph.Field{{Name: "id", Type: graph.NewNamedType("Int")}},
						},
					)
				}
			}

			providers["db"] = stubSchemaProvider{schemas: dbSchemas}
			providers["other"] = stubSchemaProvider{
				schemas: map[string]*graph.Schema{"admin": other, "reader": other},
			}
			inc := metadata.NewInconsistencies()
			c := New(providers, &metadata.Metadata{Databases: []metadata.DatabaseMetadata{
				{
					Name: "db",
					Tables: []metadata.TableMetadata{
						{Table: metadata.TableSource{Schema: "cf", Name: "items"}},
					},
				},
				{Name: "other"},
			}}, inc)

			result := c.Compose(t.Context(), slog.Default())
			for _, role := range []string{"admin", "reader"} {
				doc := result.SchemaDocs[role]
				if doc == nil || doc.Definitions.ForName(root).Fields.ForName("items") == nil ||
					doc.Definitions.ForName(root).Fields.ForName("otherRoot") == nil ||
					doc.Definitions.ForName("cf_items").Fields.ForName("mood") != nil ||
					doc.Definitions.ForName("cf_items").Fields.ForName("id") == nil ||
					doc.Definitions.ForName("mood_cf_items_args") != nil ||
					doc.Definitions.ForName(scalar) == nil {
					t.Fatalf(
						"role %s lost unrelated fields or retained invalid argument: %+v",
						role,
						doc,
					)
				}
			}

			items := inc.Snapshot()
			if len(items) != 2 {
				t.Fatalf("expected one computed inconsistency per role: %+v", items)
			}

			for _, item := range items {
				if item.Kind != metadata.InconsistencyKindComputedField ||
					item.Name != "cf.items.mood" {
					t.Fatalf("unexpected inconsistency: %+v", item)
				}
			}
		})
	}
}
