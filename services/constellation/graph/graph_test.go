package graph_test

import (
	"math"
	"testing"

	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
	"github.com/vektah/gqlparser/v2/validator"
)

func TestTypeHelpers(t *testing.T) {
	t.Parallel()

	listElem := graph.NewNamedType("String")
	nonNullListElem := graph.NewNonNullType("ID")

	tests := []struct {
		name        string
		got         *graph.Type
		wantNamed   string
		wantNonNull bool
		wantElem    *graph.Type
	}{
		{
			name:        "NewNamedType",
			got:         graph.NewNamedType("String"),
			wantNamed:   "String",
			wantNonNull: false,
			wantElem:    nil,
		},
		{
			name:        "NewNonNullType",
			got:         graph.NewNonNullType("Int"),
			wantNamed:   "Int",
			wantNonNull: true,
			wantElem:    nil,
		},
		{
			name:        "NewListType",
			got:         graph.NewListType(listElem),
			wantNamed:   "",
			wantNonNull: false,
			wantElem:    listElem,
		},
		{
			name:        "NewNonNullListType",
			got:         graph.NewNonNullListType(nonNullListElem),
			wantNamed:   "",
			wantNonNull: true,
			wantElem:    nonNullListElem,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if tt.got.NamedType != tt.wantNamed {
				t.Errorf("NamedType: got %q, want %q", tt.got.NamedType, tt.wantNamed)
			}

			if tt.got.NonNull != tt.wantNonNull {
				t.Errorf("NonNull: got %v, want %v", tt.got.NonNull, tt.wantNonNull)
			}

			if tt.got.Elem != tt.wantElem {
				t.Errorf("Elem: got %v, want %v", tt.got.Elem, tt.wantElem)
			}
		})
	}
}

func TestToAST_ObjectTypes(t *testing.T) {
	t.Parallel()

	schema := &graph.Schema{
		Types: []*graph.ObjectType{
			{
				Name:        "User",
				Description: "A user in the system",
				Fields: []*graph.Field{
					{
						Name:        "id",
						Description: "Unique identifier",
						Type:        graph.NewNonNullType("ID"),
					},
					{
						Name: "name",
						Type: graph.NewNamedType("String"),
					},
					{
						Name: "friends",
						Type: graph.NewListType(graph.NewNonNullType("User")),
					},
				},
				Interfaces: []string{"Node"},
			},
		},
	}

	doc := schema.ToAST()

	if len(doc.Definitions) != 1 {
		t.Fatalf("expected 1 definition, got %d", len(doc.Definitions))
	}

	def := doc.Definitions[0]

	if def.Kind != ast.Object {
		t.Errorf("expected Object kind, got %s", def.Kind)
	}

	if def.Name != "User" {
		t.Errorf("expected name User, got %s", def.Name)
	}

	if def.Description != "A user in the system" {
		t.Errorf("unexpected description: %s", def.Description)
	}

	if len(def.Fields) != 3 {
		t.Fatalf("expected 3 fields, got %d", len(def.Fields))
	}

	if len(def.Interfaces) != 1 || def.Interfaces[0] != "Node" {
		t.Errorf("expected interface [Node], got %v", def.Interfaces)
	}

	// Check id field
	idField := def.Fields[0]

	if idField.Name != "id" {
		t.Errorf("expected field name id, got %s", idField.Name)
	}

	if idField.Type.NamedType != "ID" || !idField.Type.NonNull {
		t.Errorf("expected ID!, got %v", idField.Type)
	}

	// Check friends field (list type)
	friendsField := def.Fields[2]

	if friendsField.Type.Elem == nil {
		t.Fatal("expected friends to be a list type")
	}

	if friendsField.Type.Elem.NamedType != "User" || !friendsField.Type.Elem.NonNull {
		t.Errorf("expected [User!], got elem=%v", friendsField.Type.Elem)
	}
}

func TestToAST_Enums(t *testing.T) {
	t.Parallel()

	schema := &graph.Schema{
		Enums: []*graph.EnumType{
			{
				Name:        "Status",
				Description: "Item status",
				Values: []*graph.EnumValue{
					{Name: "ACTIVE", Description: "Active item"},
					{Name: "INACTIVE"},
				},
			},
		},
	}

	doc := schema.ToAST()

	if len(doc.Definitions) != 1 {
		t.Fatalf("expected 1 definition, got %d", len(doc.Definitions))
	}

	def := doc.Definitions[0]

	if def.Kind != ast.Enum {
		t.Errorf("expected Enum kind, got %s", def.Kind)
	}

	if len(def.EnumValues) != 2 {
		t.Fatalf("expected 2 enum values, got %d", len(def.EnumValues))
	}

	if def.EnumValues[0].Name != "ACTIVE" {
		t.Errorf("expected ACTIVE, got %s", def.EnumValues[0].Name)
	}

	if def.EnumValues[0].Description != "Active item" {
		t.Errorf("unexpected description: %s", def.EnumValues[0].Description)
	}
}

func TestToAST_Scalars(t *testing.T) {
	t.Parallel()

	schema := &graph.Schema{
		Scalars: []*graph.ScalarType{
			{Name: "DateTime", Description: "ISO 8601 date-time"},
		},
	}

	doc := schema.ToAST()

	if len(doc.Definitions) != 1 {
		t.Fatalf("expected 1 definition, got %d", len(doc.Definitions))
	}

	if doc.Definitions[0].Kind != ast.Scalar {
		t.Errorf("expected Scalar kind, got %s", doc.Definitions[0].Kind)
	}

	if doc.Definitions[0].Name != "DateTime" {
		t.Errorf("expected DateTime, got %s", doc.Definitions[0].Name)
	}
}

func TestToAST_Interfaces(t *testing.T) {
	t.Parallel()

	schema := &graph.Schema{
		Interfaces: []*graph.InterfaceType{
			{
				Name:        "Node",
				Description: "An object with an ID",
				Fields: []*graph.Field{
					{Name: "id", Type: graph.NewNonNullType("ID")},
				},
				Interfaces: []string{"Entity"},
			},
		},
	}

	doc := schema.ToAST()

	def := doc.Definitions[0]

	if def.Kind != ast.Interface {
		t.Errorf("expected Interface kind, got %s", def.Kind)
	}

	if len(def.Fields) != 1 {
		t.Fatalf("expected 1 field, got %d", len(def.Fields))
	}

	if len(def.Interfaces) != 1 || def.Interfaces[0] != "Entity" {
		t.Errorf("expected interface [Entity], got %v", def.Interfaces)
	}
}

func TestToAST_Unions(t *testing.T) {
	t.Parallel()

	schema := &graph.Schema{
		Unions: []*graph.UnionType{
			{
				Name:        "SearchResult",
				Description: "Search result union",
				Types:       []string{"User", "Post"},
			},
		},
	}

	doc := schema.ToAST()

	def := doc.Definitions[0]

	if def.Kind != ast.Union {
		t.Errorf("expected Union kind, got %s", def.Kind)
	}

	if len(def.Types) != 2 {
		t.Fatalf("expected 2 types, got %d", len(def.Types))
	}

	if def.Types[0] != "User" || def.Types[1] != "Post" {
		t.Errorf("expected [User, Post], got %v", def.Types)
	}
}

func TestToAST_InputObjects(t *testing.T) {
	t.Parallel()

	schema := &graph.Schema{
		Inputs: []*graph.InputObjectType{
			{
				Name:        "CreateUserInput",
				Description: "Input for creating users",
				Fields: []*graph.InputField{
					{
						Name: "name",
						Type: graph.NewNonNullType("String"),
					},
					{
						Name:         "role",
						Type:         graph.NewNamedType("String"),
						DefaultValue: new("user"),
					},
					{
						Name:         "active",
						Type:         graph.NewNamedType("Boolean"),
						DefaultValue: new("true"),
					},
					{
						Name:         "age",
						Type:         graph.NewNamedType("Int"),
						DefaultValue: new("18"),
					},
					{
						Name:         "tags",
						Type:         graph.NewListType(graph.NewNamedType("String")),
						DefaultValue: new("[]"),
					},
				},
			},
		},
	}

	doc := schema.ToAST()

	def := doc.Definitions[0]

	if def.Kind != ast.InputObject {
		t.Errorf("expected InputObject kind, got %s", def.Kind)
	}

	if len(def.Fields) != 5 {
		t.Fatalf("expected 5 fields, got %d", len(def.Fields))
	}

	// Check default value kinds
	roleField := def.Fields[1]
	if roleField.DefaultValue == nil || roleField.DefaultValue.Kind != ast.StringValue {
		t.Error("expected role default to be StringValue")
	}

	activeField := def.Fields[2]
	if activeField.DefaultValue == nil || activeField.DefaultValue.Kind != ast.BooleanValue {
		t.Errorf(
			"expected active default to be BooleanValue, got %v",
			activeField.DefaultValue.Kind,
		)
	}

	ageField := def.Fields[3]
	if ageField.DefaultValue == nil || ageField.DefaultValue.Kind != ast.IntValue {
		t.Errorf("expected age default to be IntValue, got %v", ageField.DefaultValue.Kind)
	}

	tagsField := def.Fields[4]
	if tagsField.DefaultValue == nil || tagsField.DefaultValue.Kind != ast.ListValue {
		t.Errorf("expected tags default to be ListValue, got %v", tagsField.DefaultValue.Kind)
	}
}

func TestToAST_DirectiveDefinitions(t *testing.T) {
	t.Parallel()

	schema := &graph.Schema{
		Directives: []*graph.DirectiveDefinition{
			{
				Name:        "auth",
				Description: "Auth directive",
				Arguments: []*graph.Argument{
					{
						Name: "requires",
						Type: graph.NewNonNullType("String"),
					},
				},
				Locations: []graph.DirectiveLocation{
					graph.LocationFieldDefinition,
					graph.LocationObject,
				},
				Repeatable: true,
			},
		},
	}

	doc := schema.ToAST()

	if len(doc.Directives) != 1 {
		t.Fatalf("expected 1 directive, got %d", len(doc.Directives))
	}

	dir := doc.Directives[0]

	if dir.Name != "auth" {
		t.Errorf("expected auth, got %s", dir.Name)
	}

	if !dir.IsRepeatable {
		t.Error("expected repeatable=true")
	}

	if len(dir.Arguments) != 1 {
		t.Fatalf("expected 1 argument, got %d", len(dir.Arguments))
	}

	if len(dir.Locations) != 2 {
		t.Fatalf("expected 2 locations, got %d", len(dir.Locations))
	}
}

func TestToAST_AppliedDirectives(t *testing.T) {
	t.Parallel()

	schema := &graph.Schema{
		Types: []*graph.ObjectType{
			{
				Name: "Query",
				Fields: []*graph.Field{
					{
						Name: "oldField",
						Type: graph.NewNamedType("String"),
						Directives: []*graph.Directive{
							{
								Name: "deprecated",
								Arguments: []*graph.DirectiveArgument{
									{Name: "reason", Value: "Use newField instead"},
								},
							},
						},
					},
				},
			},
		},
	}

	doc := schema.ToAST()

	field := doc.Definitions[0].Fields[0]

	if len(field.Directives) != 1 {
		t.Fatalf("expected 1 directive, got %d", len(field.Directives))
	}

	dir := field.Directives[0]

	if dir.Name != "deprecated" {
		t.Errorf("expected deprecated, got %s", dir.Name)
	}

	if len(dir.Arguments) != 1 {
		t.Fatalf("expected 1 argument, got %d", len(dir.Arguments))
	}

	if dir.Arguments[0].Value.Raw != "Use newField instead" {
		t.Errorf("unexpected value: %s", dir.Arguments[0].Value.Raw)
	}

	if dir.Arguments[0].Value.Kind != ast.StringValue {
		t.Errorf("expected StringValue, got %v", dir.Arguments[0].Value.Kind)
	}
}

func TestToAST_DirectiveValueTypes(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		value    any
		wantKind ast.ValueKind
		wantRaw  string
	}{
		{name: "string", value: "hello", wantKind: ast.StringValue, wantRaw: "hello"},
		{name: "int", value: 42, wantKind: ast.IntValue, wantRaw: "42"},
		{name: "int32", value: int32(-7), wantKind: ast.IntValue, wantRaw: "-7"},
		{
			name:     "int64",
			value:    int64(9223372036854775807),
			wantKind: ast.IntValue,
			wantRaw:  "9223372036854775807",
		},
		{name: "uint", value: uint(5), wantKind: ast.IntValue, wantRaw: "5"},
		{name: "uint32", value: uint32(4294967295), wantKind: ast.IntValue, wantRaw: "4294967295"},
		{
			name:     "uint64",
			value:    uint64(18446744073709551615),
			wantKind: ast.IntValue,
			wantRaw:  "18446744073709551615",
		},
		{name: "bool_true", value: true, wantKind: ast.BooleanValue, wantRaw: "true"},
		{name: "bool_false", value: false, wantKind: ast.BooleanValue, wantRaw: "false"},
		{name: "float64_small", value: 3.14, wantKind: ast.FloatValue, wantRaw: "3.14"},
		{
			name:     "float64_pi",
			value:    math.Pi,
			wantKind: ast.FloatValue,
			wantRaw:  "3.141592653589793",
		},
		{name: "float64_tenth", value: 0.1, wantKind: ast.FloatValue, wantRaw: "0.1"},
		{name: "float32_small", value: float32(3.5), wantKind: ast.FloatValue, wantRaw: "3.5"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			schema := &graph.Schema{
				Types: []*graph.ObjectType{
					{
						Name: "Query",
						Fields: []*graph.Field{
							{
								Name: "f",
								Type: graph.NewNamedType("String"),
								Directives: []*graph.Directive{
									{
										Name: "meta",
										Arguments: []*graph.DirectiveArgument{
											{Name: "v", Value: tt.value},
										},
									},
								},
							},
						},
					},
				},
			}

			doc := schema.ToAST()
			got := doc.Definitions[0].Fields[0].Directives[0].Arguments.ForName("v").Value

			if got.Kind != tt.wantKind {
				t.Errorf("kind: got %v, want %v", got.Kind, tt.wantKind)
			}

			if got.Raw != tt.wantRaw {
				t.Errorf("raw: got %q, want %q", got.Raw, tt.wantRaw)
			}
		})
	}
}

func TestToAST_DirectiveValueUnknownType(t *testing.T) {
	t.Parallel()

	schema := &graph.Schema{
		Types: []*graph.ObjectType{
			{
				Name: "Query",
				Fields: []*graph.Field{
					{
						Name: "f",
						Type: graph.NewNamedType("String"),
						Directives: []*graph.Directive{
							{
								Name: "meta",
								Arguments: []*graph.DirectiveArgument{
									{Name: "v", Value: struct{ X int }{X: 1}},
								},
							},
						},
					},
				},
			},
		},
	}

	doc := schema.ToAST()

	arg := doc.Definitions[0].Fields[0].Directives[0].Arguments[0]

	if arg.Value.Kind != ast.StringValue {
		t.Errorf("expected StringValue for unknown type, got %v", arg.Value.Kind)
	}
}

func TestToAST_ArgumentDefaultValueKinds(t *testing.T) {
	t.Parallel()

	schema := &graph.Schema{
		Types: []*graph.ObjectType{
			{
				Name: "Query",
				Fields: []*graph.Field{
					{
						Name: "f",
						Type: graph.NewNamedType("String"),
						Arguments: []*graph.Argument{
							{
								Name:         "b",
								Type:         graph.NewNamedType("Boolean"),
								DefaultValue: new("false"),
							},
							{
								Name:         "n",
								Type:         graph.NewNamedType("Int"),
								DefaultValue: new("42"),
							},
							{
								Name:         "fl",
								Type:         graph.NewNamedType("Float"),
								DefaultValue: new("3.14"),
							},
						},
					},
				},
			},
		},
	}

	doc := schema.ToAST()

	args := doc.Definitions[0].Fields[0].Arguments

	if args[0].DefaultValue.Kind != ast.BooleanValue {
		t.Errorf("expected BooleanValue for arg default, got %v", args[0].DefaultValue.Kind)
	}

	if args[1].DefaultValue.Kind != ast.IntValue {
		t.Errorf("expected IntValue for arg default, got %v", args[1].DefaultValue.Kind)
	}

	if args[2].DefaultValue.Kind != ast.FloatValue {
		t.Errorf("expected FloatValue for arg default, got %v", args[2].DefaultValue.Kind)
	}
}

func TestToAST_RootTypes(t *testing.T) {
	t.Parallel()

	t.Run("custom root types", func(t *testing.T) {
		t.Parallel()

		schema := &graph.Schema{
			QueryType:        new("RootQuery"),
			MutationType:     new("RootMutation"),
			SubscriptionType: new("RootSubscription"),
		}

		doc := schema.ToAST()

		if len(doc.Schema) != 1 {
			t.Fatalf("expected 1 schema definition, got %d", len(doc.Schema))
		}

		ops := doc.Schema[0].OperationTypes

		if len(ops) != 3 {
			t.Fatalf("expected 3 operation types, got %d", len(ops))
		}

		found := map[ast.Operation]string{}
		for _, op := range ops {
			found[op.Operation] = op.Type
		}

		if found[ast.Query] != "RootQuery" {
			t.Errorf("expected query=RootQuery, got %s", found[ast.Query])
		}

		if found[ast.Mutation] != "RootMutation" {
			t.Errorf("expected mutation=RootMutation, got %s", found[ast.Mutation])
		}

		if found[ast.Subscription] != "RootSubscription" {
			t.Errorf("expected subscription=RootSubscription, got %s", found[ast.Subscription])
		}
	})

	t.Run("no root types omits schema definition", func(t *testing.T) {
		t.Parallel()

		schema := &graph.Schema{}

		doc := schema.ToAST()

		if len(doc.Schema) != 0 {
			t.Errorf("expected 0 schema definitions, got %d", len(doc.Schema))
		}
	})
}

func TestToAST_FieldArguments(t *testing.T) {
	t.Parallel()

	schema := &graph.Schema{
		Types: []*graph.ObjectType{
			{
				Name: "Query",
				Fields: []*graph.Field{
					{
						Name: "user",
						Type: graph.NewNamedType("User"),
						Arguments: []*graph.Argument{
							{
								Name:         "id",
								Description:  "User ID",
								Type:         graph.NewNonNullType("ID"),
								DefaultValue: nil,
							},
							{
								Name:         "includeDeleted",
								Type:         graph.NewNamedType("Boolean"),
								DefaultValue: new("false"),
							},
						},
					},
				},
			},
		},
	}

	doc := schema.ToAST()

	field := doc.Definitions[0].Fields[0]

	if len(field.Arguments) != 2 {
		t.Fatalf("expected 2 arguments, got %d", len(field.Arguments))
	}

	idArg := field.Arguments[0]

	if idArg.Name != "id" {
		t.Errorf("expected id, got %s", idArg.Name)
	}

	if idArg.DefaultValue != nil {
		t.Error("expected no default value for id")
	}

	includeArg := field.Arguments[1]

	if includeArg.DefaultValue == nil || includeArg.DefaultValue.Raw != "false" {
		t.Error("expected default value false for includeDeleted")
	}
}

func TestToAST_CompleteSchema_Validates(t *testing.T) {
	t.Parallel()

	schema := &graph.Schema{
		Types: []*graph.ObjectType{
			{
				Name: "Query",
				Fields: []*graph.Field{
					{
						Name: "users",
						Type: graph.NewNonNullListType(graph.NewNonNullType("User")),
						Arguments: []*graph.Argument{
							{
								Name: "limit",
								Type: graph.NewNamedType("Int"),
							},
						},
					},
					{
						Name: "user",
						Type: graph.NewNamedType("User"),
						Arguments: []*graph.Argument{
							{
								Name: "id",
								Type: graph.NewNonNullType("ID"),
							},
						},
					},
				},
			},
			{
				Name: "User",
				Fields: []*graph.Field{
					{Name: "id", Type: graph.NewNonNullType("ID")},
					{Name: "name", Type: graph.NewNonNullType("String")},
					{Name: "email", Type: graph.NewNamedType("String")},
					{Name: "status", Type: graph.NewNamedType("UserStatus")},
					{Name: "createdAt", Type: graph.NewNamedType("DateTime")},
				},
			},
			{
				Name: "Mutation",
				Fields: []*graph.Field{
					{
						Name: "createUser",
						Type: graph.NewNamedType("User"),
						Arguments: []*graph.Argument{
							{
								Name: "input",
								Type: graph.NewNonNullType("CreateUserInput"),
							},
						},
					},
				},
			},
		},
		Scalars: []*graph.ScalarType{
			{Name: "DateTime"},
		},
		Enums: []*graph.EnumType{
			{
				Name: "UserStatus",
				Values: []*graph.EnumValue{
					{Name: "ACTIVE"},
					{Name: "INACTIVE"},
					{Name: "BANNED"},
				},
			},
		},
		Inputs: []*graph.InputObjectType{
			{
				Name: "CreateUserInput",
				Fields: []*graph.InputField{
					{Name: "name", Type: graph.NewNonNullType("String")},
					{Name: "email", Type: graph.NewNamedType("String")},
				},
			},
		},
		QueryType:    new("Query"),
		MutationType: new("Mutation"),
	}

	schemaDoc := schema.ToAST()

	prelude, parseErr := parser.ParseSchema(validator.Prelude)
	if parseErr != nil {
		t.Fatalf("failed to parse prelude: %v", parseErr)
	}

	merged := &ast.SchemaDocument{
		Definitions: append(prelude.Definitions, schemaDoc.Definitions...),
		Directives:  append(prelude.Directives, schemaDoc.Directives...),
		Schema:      schemaDoc.Schema,
	}

	_, validationErr := validator.ValidateSchemaDocument(merged)
	if validationErr != nil {
		t.Errorf("schema validation failed: %v", validationErr)
	}
}

func TestToAST_EmptySchema(t *testing.T) {
	t.Parallel()

	schema := &graph.Schema{}

	doc := schema.ToAST()

	if len(doc.Definitions) != 0 {
		t.Errorf("expected 0 definitions, got %d", len(doc.Definitions))
	}

	if len(doc.Directives) != 0 {
		t.Errorf("expected 0 directives, got %d", len(doc.Directives))
	}
}

func TestToAST_NilType(t *testing.T) {
	t.Parallel()

	// Schema with a field that has a nil type - tests convertType(nil)
	schema := &graph.Schema{
		Types: []*graph.ObjectType{
			{
				Name: "Query",
				Fields: []*graph.Field{
					{
						Name: "test",
						Type: nil,
					},
				},
			},
		},
	}

	doc := schema.ToAST()

	field := doc.Definitions[0].Fields[0]

	if field.Type != nil {
		t.Error("expected nil type to produce nil AST type")
	}
}
