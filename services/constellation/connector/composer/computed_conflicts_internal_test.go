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

// A remote relationship must not preserve the computed argument scalar that
// collides with its target's object type and thereby invalidate the whole role.
//
//nolint:cyclop // Verify both generated roles, the surviving join and the field-local inconsistency together.
func TestComputedScalarCollisionWithRemoteRelationshipKeepsRoles(t *testing.T) {
	t.Parallel()

	caps := schema.NewCapabilities(schema.KindPostgres, dialect.NewPostgresDialect())
	makeObjects := func(tableSchema, tableName string) *introspection.Objects {
		objects := introspection.NewObjects()
		objects.Schemas[tableSchema] = &introspection.Schema{
			Tables: map[string]*introspection.Table{
				tableName: {
					Schema: tableSchema,
					Name:   tableName,
					Columns: []introspection.Column{
						{Name: "id", Type: "text", SupportsMinMax: true},
					},
					PrimaryKeys:  []string{"id"},
					IsInsertable: true,
					IsUpdatable:  true,
				},
			},
		}

		return objects
	}

	dbObjects := makeObjects("cf", "items")
	dbObjects.ComputedFunctions = map[introspection.ComputedTable]map[string]introspection.ComputedFunctionLookup{
		{Schema: "cf", Name: "items"}: {"mood": {Function: &introspection.ComputedFunction{
			OID:    10,
			Schema: "cf",
			Name:   "item_mood",
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
				{
					Type: introspection.PostgreSQLType{
						OID:    2,
						Schema: "public",
						Name:   "p14_mood",
						Kind:   "e",
					},
					Name:     "m",
					Mode:     "i",
					Position: 1,
				},
			},
			RowArgument: 0,
			ReturnType: introspection.PostgreSQLType{
				OID:    25,
				Schema: "pg_catalog",
				Name:   "text",
				Kind:   "b",
			},
			Volatility: introspection.VolatilityStable,
		}}},
	}

	dbMeta := metadata.DatabaseMetadata{
		Name: "db", Kind: "postgres", Tables: []metadata.TableMetadata{{
			Table: metadata.TableSource{Schema: "cf", Name: "items"},
			ComputedFields: []metadata.ComputedField{{
				Name: "mood", Definition: metadata.ComputedFieldDefinition{
					Function: metadata.FunctionSource{Schema: "cf", Name: "item_mood"},
				},
			}},
			SelectPermissions: []metadata.SelectPermission{{
				Role: "reader", Permission: metadata.SelectPermissionConfig{
					Columns: []string{
						"id",
					},
					ComputedFields: []string{"mood"},
					Filter:         map[string]any{},
				},
			}},
			RemoteRelationships: []metadata.RemoteRelationship{{
				Name: "moodRow", Definition: metadata.RemoteRelationshipDef{
					ToSource: &metadata.ToSourceRelationship{
						RelationshipType: metadata.RelationshipTypeObject,
						Source:           "other",
						Table:            metadata.TableSource{Schema: "public", Name: "p14_mood"},
						FieldMapping:     map[string]string{"id": "id"},
					},
				},
			}},
		}},
	}
	otherMeta := metadata.DatabaseMetadata{
		Name: "other", Kind: "postgres", Tables: []metadata.TableMetadata{{
			Table: metadata.TableSource{Schema: "public", Name: "p14_mood"},
			SelectPermissions: []metadata.SelectPermission{{
				Role: "reader", Permission: metadata.SelectPermissionConfig{
					Columns: []string{"id"}, Filter: map[string]any{},
				},
			}},
		}},
	}

	providers := map[string]SchemaProvider{}
	for _, source := range []struct {
		name    string
		objects *introspection.Objects
		meta    *metadata.DatabaseMetadata
		names   map[string]string
	}{
		{"db", dbObjects, &dbMeta, map[string]string{"cf.items": "cf_items"}},
		{
			"other", makeObjects("public", "p14_mood"), &otherMeta,
			map[string]string{"public.p14_mood": "p14_mood"},
		},
	} {
		roles := make(map[string]*graph.Schema)
		for _, role := range []string{"admin", "reader"} {
			var err error

			roles[role], err = schema.GenerateForRole(source.objects, role, source.meta, caps)
			if err != nil {
				t.Fatalf("generate %s %s schema: %v", source.name, role, err)
			}
		}

		providers[source.name] = stubSchemaProvider{schemas: roles, names: source.names}
	}

	inc := metadata.NewInconsistencies()
	result := New(
		providers,
		&metadata.Metadata{Databases: []metadata.DatabaseMetadata{dbMeta, otherMeta}},
		inc,
	).
		Compose(t.Context(), slog.Default())

	for _, role := range []string{"admin", "reader"} {
		validated := result.ValidatedSchemas[role]
		if validated == nil {
			t.Fatalf("role %s dropped: %+v", role, inc.Snapshot())
		}

		items := validated.Types["cf_items"]
		if items == nil || items.Fields.ForName("id") == nil ||
			items.Fields.ForName("mood") != nil ||
			validated.Types["mood_cf_items_args"] != nil ||
			validated.Types["p14_mood"] == nil ||
			validated.Types["p14_mood"].Kind != "OBJECT" ||
			validated.Types["query_root"].Fields.ForName("cf_items") == nil {
			t.Fatalf("role %s retained colliding computed argument or lost fields", role)
		}

		rel := items.Fields.ForName("moodRow")
		if rel == nil || rel.Type.Name() != "p14_mood" {
			t.Fatalf("role %s relationship type = %+v; want p14_mood", role, rel)
		}
	}

	found := inc.Snapshot()
	if len(found) != 2 {
		t.Fatalf("expected one computed inconsistency per role: %+v", found)
	}

	for _, item := range found {
		if item.Kind != metadata.InconsistencyKindComputedField || item.Name != "cf.items.mood" {
			t.Fatalf("unexpected inconsistency: %+v", item)
		}
	}
}
