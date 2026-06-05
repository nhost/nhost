package schemamerge

import (
	"errors"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/vektah/gqlparser/v2/ast"
)

// These tests exercise pure merge primitives directly. The exported entry points
// are covered in the black-box schemamerge_test.go.

func TestTypeToString(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		in   *graph.Type
		want string
	}{
		{"nil", nil, ""},
		{"named", graph.NewNamedType("User"), "User"},
		{"non-null", graph.NewNonNullType("User"), "User!"},
		{"list of named", graph.NewListType(graph.NewNamedType("User")), "[User]"},
		{
			"non-null list of non-null",
			graph.NewNonNullListType(graph.NewNonNullType("User")),
			"[User!]!",
		},
		{
			"deeply nested [[T!]!]!",
			graph.NewNonNullListType(graph.NewNonNullListType(graph.NewNonNullType("T"))),
			"[[T!]!]!",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := typeToString(tc.in); got != tc.want {
				t.Errorf("typeToString(%v) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

func TestEnumsEqual(t *testing.T) {
	t.Parallel()

	mkEnum := func(name string, values ...string) *graph.EnumType {
		vs := make([]*graph.EnumValue, len(values))
		for i, v := range values {
			vs[i] = &graph.EnumValue{Name: v}
		}

		return &graph.EnumType{Name: name, Values: vs}
	}

	tests := []struct {
		name string
		a, b *graph.EnumType
		want bool
	}{
		{"both empty", mkEnum("E"), mkEnum("E"), true},
		{"identical values", mkEnum("E", "A", "B"), mkEnum("E", "A", "B"), true},
		{"same length, disjoint names", mkEnum("E", "A", "B"), mkEnum("E", "C", "D"), false},
		{"different lengths", mkEnum("E", "A", "B"), mkEnum("E", "A"), false},
		{"reordered values are equal", mkEnum("E", "A", "B"), mkEnum("E", "B", "A"), true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := enumsEqual(tc.a, tc.b); got != tc.want {
				t.Errorf("enumsEqual = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestInputsEqual(t *testing.T) {
	t.Parallel()

	mkInput := func(name string, fields ...*graph.InputField) *graph.InputObjectType {
		return &graph.InputObjectType{Name: name, Fields: fields}
	}
	mkField := func(name string, typ *graph.Type) *graph.InputField {
		return &graph.InputField{Name: name, Type: typ}
	}

	tests := []struct {
		name string
		a, b *graph.InputObjectType
		want bool
	}{
		{
			"identical",
			mkInput("I", mkField("x", graph.NewNamedType("String"))),
			mkInput("I", mkField("x", graph.NewNamedType("String"))),
			true,
		},
		{
			"different field count",
			mkInput("I", mkField("x", graph.NewNamedType("String"))),
			mkInput("I"),
			false,
		},
		{
			"shared field name, different types",
			mkInput("I", mkField("x", graph.NewNamedType("String"))),
			mkInput("I", mkField("x", graph.NewNamedType("Int"))),
			false,
		},
		{
			"shared field name, list vs non-list",
			mkInput("I", mkField("x", graph.NewNamedType("String"))),
			mkInput("I", mkField("x", graph.NewListType(graph.NewNamedType("String")))),
			false,
		},
		{
			"shared field name, non-null wrapper mismatch",
			mkInput("I", mkField("x", graph.NewNamedType("String"))),
			mkInput("I", mkField("x", graph.NewNonNullType("String"))),
			false,
		},
		{
			"same field count, disjoint names",
			mkInput("I", mkField("x", graph.NewNamedType("String"))),
			mkInput("I", mkField("y", graph.NewNamedType("String"))),
			false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := inputsEqual(tc.a, tc.b); got != tc.want {
				t.Errorf("inputsEqual = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestNamedElementStructuralEquality(t *testing.T) {
	t.Parallel()

	arg := func(name, typ string) *graph.Argument {
		return &graph.Argument{Name: name, Type: graph.NewNamedType(typ)}
	}
	field := func(name, typ string, args ...*graph.Argument) *graph.Field {
		return &graph.Field{Name: name, Type: graph.NewNamedType(typ), Arguments: args}
	}

	tests := []struct {
		name string
		got  bool
		want bool
	}{
		{
			name: "objects equal with reordered fields and interfaces",
			got: objectsEqual(
				&graph.ObjectType{
					Name:       "User",
					Fields:     []*graph.Field{field("id", "ID"), field("name", "String")},
					Interfaces: []string{"Node", "Named"},
				},
				&graph.ObjectType{
					Name:       "User",
					Fields:     []*graph.Field{field("name", "String"), field("id", "ID")},
					Interfaces: []string{"Named", "Node"},
				},
			),
			want: true,
		},
		{
			name: "objects differ on field argument type",
			got: objectsEqual(
				&graph.ObjectType{Fields: []*graph.Field{field("find", "User", arg("id", "ID"))}},
				&graph.ObjectType{
					Fields: []*graph.Field{field("find", "User", arg("id", "String"))},
				},
			),
			want: false,
		},
		{
			name: "interfaces differ on implemented interface set",
			got: interfacesEqual(
				&graph.InterfaceType{
					Fields:     []*graph.Field{field("id", "ID")},
					Interfaces: []string{"Node"},
				},
				&graph.InterfaceType{Fields: []*graph.Field{field("id", "ID")}},
			),
			want: false,
		},
		{
			name: "unions equal with reordered members",
			got: unionsEqual(
				&graph.UnionType{Types: []string{"User", "Team"}},
				&graph.UnionType{Types: []string{"Team", "User"}},
			),
			want: true,
		},
		{
			name: "directives equal with reordered locations and args",
			got: directivesEqual(
				&graph.DirectiveDefinition{
					Arguments: []*graph.Argument{arg("ttl", "Int"), arg("scope", "String")},
					Locations: []graph.DirectiveLocation{
						graph.LocationFieldDefinition,
						graph.LocationObject,
					},
					Repeatable: true,
				},
				&graph.DirectiveDefinition{
					Arguments: []*graph.Argument{arg("scope", "String"), arg("ttl", "Int")},
					Locations: []graph.DirectiveLocation{
						graph.LocationObject,
						graph.LocationFieldDefinition,
					},
					Repeatable: true,
				},
			),
			want: true,
		},
		{
			name: "directives differ on repeatable",
			got: directivesEqual(
				&graph.DirectiveDefinition{Repeatable: true},
				&graph.DirectiveDefinition{Repeatable: false},
			),
			want: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if tc.got != tc.want {
				t.Errorf("got %v, want %v", tc.got, tc.want)
			}
		})
	}
}

func TestMergeScalars_Dedup(t *testing.T) {
	t.Parallel()

	got := mergeScalars(
		[]*graph.ScalarType{{Name: "A"}, {Name: "B"}},
		[]*graph.ScalarType{{Name: "B"}, {Name: "C"}},
	)
	if len(got) != 3 {
		t.Fatalf("expected 3 scalars after dedup, got %d", len(got))
	}

	names := make(map[string]bool, len(got))
	for _, s := range got {
		names[s.Name] = true
	}

	for _, want := range []string{"A", "B", "C"} {
		if !names[want] {
			t.Errorf("missing scalar %q", want)
		}
	}
}

func TestMergeEnums(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		existing  []*graph.EnumType
		other     []*graph.EnumType
		wantErr   string // substring; "" means no error
		wantCount int
	}{
		{
			name: "conflict returns error mentioning enum name",
			existing: []*graph.EnumType{
				{Name: "Status", Values: []*graph.EnumValue{{Name: "A"}}},
			},
			other: []*graph.EnumType{
				{Name: "Status", Values: []*graph.EnumValue{{Name: "B"}}},
			},
			wantErr: "Status",
		},
		{
			name: "identical reordered enum deduplicated, new enum appended",
			existing: []*graph.EnumType{
				{Name: "Status", Values: []*graph.EnumValue{{Name: "A"}, {Name: "B"}}},
			},
			other: []*graph.EnumType{
				{Name: "Status", Values: []*graph.EnumValue{{Name: "B"}, {Name: "A"}}},
				{Name: "Kind", Values: []*graph.EnumValue{{Name: "X"}}},
			},
			wantCount: 2,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := mergeEnums(tc.existing, tc.other)
			if tc.wantErr != "" {
				if err == nil {
					t.Fatalf("expected error containing %q, got nil", tc.wantErr)
				}

				if !strings.Contains(err.Error(), tc.wantErr) {
					t.Errorf("error %q should contain %q", err.Error(), tc.wantErr)
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if len(got) != tc.wantCount {
				t.Fatalf("expected %d enums, got %d", tc.wantCount, len(got))
			}
		})
	}
}

func TestMergeInputs(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		existing  []*graph.InputObjectType
		other     []*graph.InputObjectType
		wantErr   string
		wantCount int
	}{
		{
			name:     "non-comparison_exp conflict returns error",
			existing: []*graph.InputObjectType{{Name: "filter_args", Fields: nil}},
			other: []*graph.InputObjectType{
				{
					Name:   "filter_args",
					Fields: []*graph.InputField{{Name: "x", Type: graph.NewNamedType("String")}},
				},
			},
			wantErr: "filter_args",
		},
		{
			name: "comparison_exp conflict returns error",
			existing: []*graph.InputObjectType{
				{
					Name:   "String_comparison_exp",
					Fields: []*graph.InputField{{Name: "_eq", Type: graph.NewNamedType("String")}},
				},
			},
			other: []*graph.InputObjectType{
				{
					Name:   "String_comparison_exp",
					Fields: []*graph.InputField{{Name: "_eq", Type: graph.NewNamedType("Int")}},
				},
			},
			wantErr: "String_comparison_exp",
		},
		{
			name: "identical comparison_exp deduplicated",
			existing: []*graph.InputObjectType{
				{
					Name:   "String_comparison_exp",
					Fields: []*graph.InputField{{Name: "_eq", Type: graph.NewNamedType("String")}},
				},
			},
			other: []*graph.InputObjectType{
				{
					Name:   "String_comparison_exp",
					Fields: []*graph.InputField{{Name: "_eq", Type: graph.NewNamedType("String")}},
				},
			},
			wantCount: 1,
		},
		{
			name:      "identical non-comparison_exp deduplicated",
			existing:  []*graph.InputObjectType{{Name: "filter_args", Fields: nil}},
			other:     []*graph.InputObjectType{{Name: "filter_args", Fields: nil}},
			wantCount: 1,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := mergeInputs(tc.existing, tc.other)
			if tc.wantErr != "" {
				if err == nil {
					t.Fatalf("expected error containing %q, got nil", tc.wantErr)
				}

				if !strings.Contains(err.Error(), tc.wantErr) {
					t.Errorf("error %q should contain %q", err.Error(), tc.wantErr)
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if len(got) != tc.wantCount {
				t.Fatalf("expected %d inputs, got %d", tc.wantCount, len(got))
			}
		})
	}
}

func TestMergeRootType(t *testing.T) {
	t.Parallel()

	combinedName := func() *string { s := "query_root"; return &s }

	tests := []struct {
		name     string
		setup    func() (rootType *graph.ObjectType, combinedTypeName *string, combinedSchema *graph.Schema)
		typeName string
		assert   func(t *testing.T, rootType *graph.ObjectType, combinedSchema *graph.Schema, fieldToConnector map[string]string)
	}{
		{
			name: "nil root type is a no-op",
			setup: func() (*graph.ObjectType, *string, *graph.Schema) {
				return nil, nil, &graph.Schema{}
			},
			typeName: "Query",
			assert: func(t *testing.T, _ *graph.ObjectType, combinedSchema *graph.Schema, fieldToConnector map[string]string) {
				t.Helper()

				if len(combinedSchema.Types) != 0 || len(fieldToConnector) != 0 {
					t.Fatalf(
						"nil rootType should be a no-op, got types=%d fields=%d",
						len(combinedSchema.Types),
						len(fieldToConnector),
					)
				}
			},
		},
		{
			name: "renames source root and appends to combined",
			setup: func() (*graph.ObjectType, *string, *graph.Schema) {
				return &graph.ObjectType{
					Name:   "Query",
					Fields: []*graph.Field{{Name: "users"}},
				}, combinedName(), &graph.Schema{}
			},
			typeName: "Query",
			assert: func(t *testing.T, rootType *graph.ObjectType, combinedSchema *graph.Schema, fieldToConnector map[string]string) {
				t.Helper()

				if rootType.Name != "query_root" {
					t.Errorf(
						"expected root type renamed to %q, got %q",
						"query_root",
						rootType.Name,
					)
				}

				if got := fieldToConnector[FieldKey(ast.Query, "users")]; got != "db" {
					t.Errorf("expected field ownership tracked, got %q", got)
				}

				if len(combinedSchema.Types) != 1 || combinedSchema.Types[0] != rootType {
					t.Fatalf("expected rootType appended to combined schema")
				}
			},
		},
		{
			name: "merges into existing combined root and carries description forward",
			setup: func() (*graph.ObjectType, *string, *graph.Schema) {
				existing := &graph.ObjectType{
					Name:        "query_root",
					Description: "",
					Fields:      []*graph.Field{{Name: "first"}},
				}

				return &graph.ObjectType{
					Name:        "Query",
					Description: "carried over",
					Fields:      []*graph.Field{{Name: "second"}},
				}, combinedName(), &graph.Schema{Types: []*graph.ObjectType{existing}}
			},
			typeName: "Query",
			assert: func(t *testing.T, _ *graph.ObjectType, combinedSchema *graph.Schema, fieldToConnector map[string]string) {
				t.Helper()

				if len(combinedSchema.Types) != 1 {
					t.Fatalf(
						"expected merge into existing type, got %d types",
						len(combinedSchema.Types),
					)
				}

				existing := combinedSchema.Types[0]
				if len(existing.Fields) != 2 {
					t.Errorf("expected fields appended, got %d", len(existing.Fields))
				}

				if existing.Description != "carried over" {
					t.Errorf("expected description carry-forward, got %q", existing.Description)
				}

				if got := fieldToConnector[FieldKey(ast.Query, "second")]; got != "db" {
					t.Errorf("expected field ownership tracked, got %q", got)
				}
			},
		},
		{
			name: "existing description is not overwritten",
			setup: func() (*graph.ObjectType, *string, *graph.Schema) {
				existing := &graph.ObjectType{
					Name:        "query_root",
					Description: "original",
				}

				return &graph.ObjectType{Name: "Query", Description: "newer"},
					combinedName(),
					&graph.Schema{Types: []*graph.ObjectType{existing}}
			},
			typeName: "Query",
			assert: func(t *testing.T, _ *graph.ObjectType, combinedSchema *graph.Schema, _ map[string]string) {
				t.Helper()

				if combinedSchema.Types[0].Description != "original" {
					t.Errorf(
						"expected existing description preserved, got %q",
						combinedSchema.Types[0].Description,
					)
				}
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			rootType, combinedTypeName, combinedSchema := tc.setup()
			fieldToConnector := map[string]string{}

			mergeRootType(
				rootType,
				tc.typeName,
				combinedTypeName,
				ast.Query,
				combinedSchema,
				"db",
				fieldToConnector,
			)
			tc.assert(t, rootType, combinedSchema, fieldToConnector)
		})
	}
}

func TestMergeRootType_OperationQualifiedOwnership(t *testing.T) {
	t.Parallel()

	queryRootName := "query_root"
	mutationRootName := "mutation_root"
	combined := &graph.Schema{}
	fieldToConnector := map[string]string{}

	mergeRootType(
		&graph.ObjectType{Name: "Query", Fields: []*graph.Field{{Name: "foo"}}},
		"Query",
		&queryRootName,
		ast.Query,
		combined,
		"db",
		fieldToConnector,
	)
	mergeRootType(
		&graph.ObjectType{Name: "Mutation", Fields: []*graph.Field{{Name: "foo"}}},
		"Mutation",
		&mutationRootName,
		ast.Mutation,
		combined,
		"rs",
		fieldToConnector,
	)

	if got := fieldToConnector[FieldKey(ast.Query, "foo")]; got != "db" {
		t.Errorf("expected query foo owned by db, got %q", got)
	}

	if got := fieldToConnector[FieldKey(ast.Mutation, "foo")]; got != "rs" {
		t.Errorf("expected mutation foo owned by rs, got %q", got)
	}
}

func TestSeparateRootTypes(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		setup  func() (schema, combinedSchema *graph.Schema, typeToConnector map[string]string)
		assert func(t *testing.T, rootTypes []*graph.ObjectType, combinedSchema *graph.Schema, typeToConnector map[string]string)
	}{
		{
			name: "root name collides with regular type → treated as root",
			setup: func() (*graph.Schema, *graph.Schema, map[string]string) {
				queryRoot := &graph.ObjectType{Name: "Query", Fields: []*graph.Field{{Name: "x"}}}
				regular := &graph.ObjectType{Name: "User"}

				return &graph.Schema{Types: []*graph.ObjectType{queryRoot, regular}},
					&graph.Schema{},
					map[string]string{}
			},
			assert: func(t *testing.T, rootTypes []*graph.ObjectType, combinedSchema *graph.Schema, typeToConnector map[string]string) {
				t.Helper()

				if rootTypes[0] == nil || rootTypes[0].Name != "Query" {
					t.Errorf("expected Query treated as root, got %v", rootTypes[0])
				}

				if len(combinedSchema.Types) != 1 || combinedSchema.Types[0].Name != "User" {
					t.Fatalf(
						"expected only the regular type appended, got %v",
						combinedSchema.Types,
					)
				}

				if _, ok := typeToConnector["Query"]; ok {
					t.Errorf("expected root type %q not tracked in typeToConnector", "Query")
				}

				if got := typeToConnector["User"]; got != "db" {
					t.Errorf("expected regular type ownership tracked, got %q", got)
				}
			},
		},
		{
			name: "nil typeToConnector must not panic",
			setup: func() (*graph.Schema, *graph.Schema, map[string]string) {
				return &graph.Schema{Types: []*graph.ObjectType{{Name: "User"}}},
					&graph.Schema{},
					nil
			},
			assert: func(t *testing.T, rootTypes []*graph.ObjectType, combinedSchema *graph.Schema, _ map[string]string) {
				t.Helper()

				if len(rootTypes) != 3 {
					t.Fatalf("expected 3 root-type slots, got %d", len(rootTypes))
				}

				if len(combinedSchema.Types) != 1 {
					t.Errorf(
						"expected the regular type appended, got %d",
						len(combinedSchema.Types),
					)
				}
			},
		},
		{
			name: "custom QueryType name identifies the root",
			setup: func() (*graph.Schema, *graph.Schema, map[string]string) {
				customName := "query_root"
				queryRoot := &graph.ObjectType{Name: customName}
				regularQuery := &graph.ObjectType{Name: "Query"}

				return &graph.Schema{
						QueryType: &customName,
						Types:     []*graph.ObjectType{queryRoot, regularQuery},
					},
					&graph.Schema{},
					map[string]string{}
			},
			assert: func(t *testing.T, rootTypes []*graph.ObjectType, combinedSchema *graph.Schema, _ map[string]string) {
				t.Helper()

				if rootTypes[0] == nil || rootTypes[0].Name != "query_root" {
					t.Errorf(
						"expected custom QueryType name to identify the root, got %v",
						rootTypes[0],
					)
				}

				if len(combinedSchema.Types) != 1 || combinedSchema.Types[0].Name != "Query" {
					t.Fatalf("expected literal 'Query' object treated as a regular type")
				}
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			schema, combinedSchema, typeToConnector := tc.setup()
			roots := defaultRoots(schema, combinedSchema)

			rootTypes, err := separateRootTypes(
				schema,
				roots,
				combinedSchema,
				"db",
				typeToConnector,
			)
			if err != nil {
				t.Fatalf("separateRootTypes returned error: %v", err)
			}

			tc.assert(t, rootTypes, combinedSchema, typeToConnector)
		})
	}
}

func TestSeparateRootTypes_ObjectDedupOrConflict(t *testing.T) {
	t.Parallel()

	queryRoot := "query_root"
	combined := &graph.Schema{
		QueryType: &queryRoot,
		Types: []*graph.ObjectType{
			{
				Name:   "User",
				Fields: []*graph.Field{{Name: "id", Type: graph.NewNamedType("ID")}},
			},
		},
	}
	typeToConnector := map[string]string{"User": "db1"}

	identical := &graph.Schema{
		Types: []*graph.ObjectType{
			{Name: "User", Fields: []*graph.Field{{Name: "id", Type: graph.NewNamedType("ID")}}},
		},
	}

	roots, err := separateRootTypes(
		identical,
		defaultRoots(identical, combined),
		combined,
		"db2",
		typeToConnector,
	)
	if err != nil {
		t.Fatalf("identical object should deduplicate: %v", err)
	}

	if len(roots) != 3 {
		t.Fatalf("expected 3 root slots, got %d", len(roots))
	}

	if len(combined.Types) != 1 {
		t.Fatalf("expected identical object deduped, got %d types", len(combined.Types))
	}

	if got := typeToConnector["User"]; got != "db1" {
		t.Fatalf("expected first-writer type owner preserved, got %q", got)
	}

	conflicting := &graph.Schema{
		Types: []*graph.ObjectType{
			{
				Name:   "User",
				Fields: []*graph.Field{{Name: "name", Type: graph.NewNamedType("String")}},
			},
		},
	}

	_, err = separateRootTypes(
		conflicting,
		defaultRoots(conflicting, combined),
		combined,
		"db2",
		typeToConnector,
	)
	if !errors.Is(err, ErrConflictingObject) {
		t.Fatalf("expected ErrConflictingObject, got %v", err)
	}
}

func TestMergeSchemaElements(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		combined *graph.Schema
		other    *graph.Schema
		wantErr  string
		assert   func(t *testing.T, combined *graph.Schema)
	}{
		{
			name: "propagates enum conflict",
			combined: &graph.Schema{
				Enums: []*graph.EnumType{
					{Name: "Status", Values: []*graph.EnumValue{{Name: "A"}}},
				},
			},
			other: &graph.Schema{
				Enums: []*graph.EnumType{
					{Name: "Status", Values: []*graph.EnumValue{{Name: "B"}}},
				},
			},
			wantErr: "Status",
		},
		{
			name: "propagates input conflict",
			combined: &graph.Schema{
				Inputs: []*graph.InputObjectType{
					{
						Name:   "Int_comparison_exp",
						Fields: []*graph.InputField{{Name: "_eq", Type: graph.NewNamedType("Int")}},
					},
				},
			},
			other: &graph.Schema{
				Inputs: []*graph.InputObjectType{
					{
						Name: "Int_comparison_exp",
						Fields: []*graph.InputField{
							{Name: "_eq", Type: graph.NewNamedType("String")},
						},
					},
				},
			},
			wantErr: "Int_comparison_exp",
		},
		{
			name:     "appends interfaces, unions, and directives",
			combined: &graph.Schema{},
			other: &graph.Schema{
				Interfaces: []*graph.InterfaceType{{Name: "Node"}},
				Unions:     []*graph.UnionType{{Name: "Result"}},
				Directives: []*graph.DirectiveDefinition{{Name: "cached"}},
			},
			assert: func(t *testing.T, combined *graph.Schema) {
				t.Helper()

				if len(combined.Interfaces) != 1 || len(combined.Unions) != 1 ||
					len(combined.Directives) != 1 {
					t.Errorf(
						"expected interfaces/unions/directives appended, got %d/%d/%d",
						len(combined.Interfaces),
						len(combined.Unions),
						len(combined.Directives),
					)
				}
			},
		},
		{
			name: "deduplicates identical interfaces, unions, and directives",
			combined: &graph.Schema{
				Interfaces: []*graph.InterfaceType{
					{
						Name:   "Node",
						Fields: []*graph.Field{{Name: "id", Type: graph.NewNamedType("ID")}},
					},
				},
				Unions: []*graph.UnionType{{Name: "Result", Types: []string{"User", "Team"}}},
				Directives: []*graph.DirectiveDefinition{
					{
						Name: "cached",
						Arguments: []*graph.Argument{
							{Name: "ttl", Type: graph.NewNamedType("Int")},
						},
					},
				},
			},
			other: &graph.Schema{
				Interfaces: []*graph.InterfaceType{
					{
						Name:   "Node",
						Fields: []*graph.Field{{Name: "id", Type: graph.NewNamedType("ID")}},
					},
				},
				Unions: []*graph.UnionType{{Name: "Result", Types: []string{"Team", "User"}}},
				Directives: []*graph.DirectiveDefinition{
					{
						Name: "cached",
						Arguments: []*graph.Argument{
							{Name: "ttl", Type: graph.NewNamedType("Int")},
						},
					},
				},
			},
			assert: func(t *testing.T, combined *graph.Schema) {
				t.Helper()

				if len(combined.Interfaces) != 1 || len(combined.Unions) != 1 ||
					len(combined.Directives) != 1 {
					t.Errorf(
						"expected deduped interface/union/directive counts, got %d/%d/%d",
						len(combined.Interfaces),
						len(combined.Unions),
						len(combined.Directives),
					)
				}
			},
		},
		{
			name: "propagates interface conflict",
			combined: &graph.Schema{Interfaces: []*graph.InterfaceType{
				{
					Name:   "Node",
					Fields: []*graph.Field{{Name: "id", Type: graph.NewNamedType("ID")}},
				},
			}},
			other: &graph.Schema{Interfaces: []*graph.InterfaceType{
				{
					Name:   "Node",
					Fields: []*graph.Field{{Name: "name", Type: graph.NewNamedType("String")}},
				},
			}},
			wantErr: ErrConflictingInterface.Error(),
		},
		{
			name: "propagates union conflict",
			combined: &graph.Schema{Unions: []*graph.UnionType{
				{Name: "Result", Types: []string{"User"}},
			}},
			other: &graph.Schema{Unions: []*graph.UnionType{
				{Name: "Result", Types: []string{"Team"}},
			}},
			wantErr: ErrConflictingUnion.Error(),
		},
		{
			name: "propagates directive conflict",
			combined: &graph.Schema{Directives: []*graph.DirectiveDefinition{
				{Name: "cached", Repeatable: true},
			}},
			other: &graph.Schema{Directives: []*graph.DirectiveDefinition{
				{Name: "cached", Repeatable: false},
			}},
			wantErr: ErrConflictingDirective.Error(),
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			err := mergeSchemaElements(tc.combined, tc.other)
			if tc.wantErr != "" {
				if err == nil {
					t.Fatalf("expected error containing %q, got nil", tc.wantErr)
				}

				if !strings.Contains(err.Error(), tc.wantErr) {
					t.Errorf("error %q should contain %q", err.Error(), tc.wantErr)
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if tc.assert != nil {
				tc.assert(t, tc.combined)
			}
		})
	}
}
