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
		name    string
		table   string
		other   *graph.Schema
		omitted bool
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

			input := &graph.InputObjectType{
				Name:   "value_cf_items_args",
				Fields: []*graph.InputField{{Name: "scale", Type: graph.NewNamedType("Int")}},
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
			if (len(got.Types[0].Fields) == 0) != tc.omitted ||
				(len(got.Inputs) == 0) != tc.omitted {
				t.Fatalf(
					"computed selection/input omission = %t/%t; want %t",
					len(got.Types[0].Fields) == 0,
					len(got.Inputs) == 0,
					tc.omitted,
				)
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
				Name:   "cf_items",
				Fields: []*graph.Field{{Name: "id", Type: graph.NewNamedType("Int")}, computed},
			},
		},
		Inputs: []*graph.InputObjectType{
			{
				Name:   "value_cf_items_args",
				Fields: []*graph.InputField{{Name: "scale", Type: graph.NewNamedType("Int")}},
			},
		},
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
		doc.Definitions.ForName("query_root").Fields.ForName("items") == nil {
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
