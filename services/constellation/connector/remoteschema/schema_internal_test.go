package remoteschema

import (
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/vektah/gqlparser/v2/ast"
)

func TestPruneUnreachableTypes_DirectiveArgumentTypes(t *testing.T) {
	t.Parallel()

	queryType := "Query"
	schema := &graph.Schema{
		Types: []*graph.ObjectType{
			{
				Name: "Query",
				Fields: []*graph.Field{
					{
						Name: "hello",
						Type: graph.NewNamedType("String"),
					},
				},
			},
		},
		Enums: []*graph.EnumType{
			{
				Name: "PolicyEnum",
				Values: []*graph.EnumValue{
					{Name: "ALLOW"},
					{Name: "DENY"},
				},
			},
			{
				Name: "UnusedEnum",
				Values: []*graph.EnumValue{
					{Name: "A"},
				},
			},
		},
		Directives: []*graph.DirectiveDefinition{
			{
				Name: "auth",
				Arguments: []*graph.Argument{
					{
						Name: "policy",
						Type: graph.NewNonNullType("PolicyEnum"),
					},
				},
				Locations: []graph.DirectiveLocation{graph.LocationField},
			},
		},
		QueryType: &queryType,
	}

	pruneUnreachableTypes(schema)

	// PolicyEnum should be retained because it's referenced by @auth directive argument
	foundPolicy := false
	foundUnused := false

	for _, e := range schema.Enums {
		switch e.Name {
		case "PolicyEnum":
			foundPolicy = true
		case "UnusedEnum":
			foundUnused = true
		}
	}

	if !foundPolicy {
		t.Error("PolicyEnum was pruned but should be reachable via directive argument")
	}

	if foundUnused {
		t.Error("UnusedEnum should have been pruned")
	}
}

func TestPruneUnreachableTypes_InterfaceImplementors(t *testing.T) {
	t.Parallel()

	queryType := "Query"
	schema := &graph.Schema{
		Types: []*graph.ObjectType{
			{
				Name: "Query",
				Fields: []*graph.Field{
					{
						Name: "node",
						Type: graph.NewNamedType("Node"),
					},
				},
				Interfaces: nil,
				Directives: nil,
			},
			{
				Name: "User",
				Fields: []*graph.Field{
					{
						Name: "id",
						Type: graph.NewNonNullType("ID"),
					},
				},
				Interfaces: []string{"Node"},
				Directives: nil,
			},
			{
				Name: "Post",
				Fields: []*graph.Field{
					{
						Name: "id",
						Type: graph.NewNonNullType("ID"),
					},
				},
				Interfaces: []string{"Node"},
				Directives: nil,
			},
			{
				Name: "Comment",
				Fields: []*graph.Field{
					{
						Name: "id",
						Type: graph.NewNonNullType("ID"),
					},
				},
				Interfaces: []string{"Resource"},
				Directives: nil,
			},
			{
				Name:       "Orphan",
				Fields:     []*graph.Field{{Name: "id", Type: graph.NewNonNullType("ID")}},
				Interfaces: nil,
				Directives: nil,
			},
		},
		Interfaces: []*graph.InterfaceType{
			{
				Name: "Node",
				Fields: []*graph.Field{
					{
						Name: "id",
						Type: graph.NewNonNullType("ID"),
					},
				},
				Interfaces: nil,
				Directives: nil,
			},
			{
				Name: "Resource",
				Fields: []*graph.Field{
					{
						Name: "id",
						Type: graph.NewNonNullType("ID"),
					},
				},
				Interfaces: []string{"Node"},
				Directives: nil,
			},
		},
		QueryType: &queryType,
	}

	pruneUnreachableTypes(schema)

	typeNames := make(map[string]struct{}, len(schema.Types))
	for _, typ := range schema.Types {
		typeNames[typ.Name] = struct{}{}
	}

	for _, name := range []string{"Query", "User", "Post", "Comment"} {
		if _, ok := typeNames[name]; !ok {
			t.Errorf("expected %s to survive pruning", name)
		}
	}

	if _, ok := typeNames["Orphan"]; ok {
		t.Error("expected Orphan to be pruned")
	}
}

func TestPruneUnreachableTypes_ObjectInterfaceEdgeDoesNotReachSiblingImplementors(t *testing.T) {
	t.Parallel()

	queryType := "Query"
	schema := &graph.Schema{
		Types: []*graph.ObjectType{
			{
				Name: "Query",
				Fields: []*graph.Field{
					{
						Name: "user",
						Type: graph.NewNamedType("User"),
					},
				},
			},
			{
				Name: "User",
				Fields: []*graph.Field{
					{
						Name: "id",
						Type: graph.NewNonNullType("ID"),
					},
				},
				Interfaces: []string{"Node"},
			},
			{
				Name: "Post",
				Fields: []*graph.Field{
					{
						Name: "id",
						Type: graph.NewNonNullType("ID"),
					},
				},
				Interfaces: []string{"Node"},
			},
		},
		Interfaces: []*graph.InterfaceType{
			{
				Name: "Node",
				Fields: []*graph.Field{
					{
						Name: "id",
						Type: graph.NewNonNullType("ID"),
					},
				},
			},
		},
		QueryType: &queryType,
	}

	pruneUnreachableTypes(schema)

	typeNames := make(map[string]struct{}, len(schema.Types))
	for _, typ := range schema.Types {
		typeNames[typ.Name] = struct{}{}
	}

	for _, name := range []string{"Query", "User"} {
		if _, ok := typeNames[name]; !ok {
			t.Errorf("expected %s to survive pruning", name)
		}
	}

	if _, ok := typeNames["Post"]; ok {
		t.Error("expected Post to be pruned")
	}

	interfaceNames := make(map[string]struct{}, len(schema.Interfaces))
	for _, iface := range schema.Interfaces {
		interfaceNames[iface.Name] = struct{}{}
	}

	if _, ok := interfaceNames["Node"]; !ok {
		t.Error("expected Node interface to survive pruning")
	}
}

func TestParseSDL(t *testing.T) { //nolint:gocognit,cyclop,gocyclo,maintidx
	t.Parallel()

	t.Run("basic schema", func(t *testing.T) {
		t.Parallel()

		sdl := `
			type Query {
				users: [User!]!
			}
			type User {
				id: ID!
				name: String!
			}
		`

		schema, presets, err := parseSDL(sdl)
		if err != nil {
			t.Fatalf("parseSDL error: %v", err)
		}

		if schema.QueryType == nil || *schema.QueryType != "Query" {
			t.Error("expected QueryType to be 'Query'")
		}

		if len(presets) != 0 {
			t.Errorf("expected no presets, got %d", len(presets))
		}

		// Should have Query and User types
		typeNames := make(map[string]struct{})
		for _, typ := range schema.Types {
			typeNames[typ.Name] = struct{}{}
		}

		if _, ok := typeNames["Query"]; !ok {
			t.Error("expected Query type")
		}

		if _, ok := typeNames["User"]; !ok {
			t.Error("expected User type")
		}
	})

	t.Run("extracts presets", func(t *testing.T) {
		t.Parallel()

		sdl := `
			type Query {
				user(id: ID! @preset(value: "x-hasura-user-id")): User
			}
			type User {
				id: ID!
				name: String!
			}
		`

		schema, presets, err := parseSDL(sdl)
		if err != nil {
			t.Fatalf("parseSDL error: %v", err)
		}

		if schema == nil {
			t.Fatal("expected non-nil schema")
		}

		// Should have a preset for Query.user
		queryUserPresets, ok := presets["Query.user"]
		if !ok {
			t.Fatal("expected preset for Query.user")
		}

		if len(queryUserPresets) != 1 {
			t.Fatalf("expected 1 preset, got %d", len(queryUserPresets))
		}

		if queryUserPresets[0].ArgumentName != "id" {
			t.Errorf("expected argument name 'id', got %s", queryUserPresets[0].ArgumentName)
		}

		if queryUserPresets[0].Value.Raw != "x-hasura-user-id" {
			t.Errorf("expected value 'x-hasura-user-id', got %s", queryUserPresets[0].Value.Raw)
		}

		if queryUserPresets[0].SessionVariable != "x-hasura-user-id" {
			t.Errorf(
				"expected session variable 'x-hasura-user-id', got %s",
				queryUserPresets[0].SessionVariable,
			)
		}

		// Preset argument should be hidden from the schema
		for _, typ := range schema.Types {
			if typ.Name == "Query" {
				for _, f := range typ.Fields {
					if f.Name == "user" {
						if len(f.Arguments) != 0 {
							t.Errorf(
								"preset argument should be hidden, got %d args",
								len(f.Arguments),
							)
						}
					}
				}
			}
		}
	})

	t.Run("extracts block string session variable presets", func(t *testing.T) {
		t.Parallel()

		sdl := `
			type Query {
				user(id: ID! @preset(value: """x-hasura-user-id""")): User
			}
			type User {
				id: ID!
			}
		`

		_, presets, err := parseSDL(sdl)
		if err != nil {
			t.Fatalf("parseSDL error: %v", err)
		}

		queryUserPresets, ok := presets["Query.user"]
		if !ok {
			t.Fatal("expected preset for Query.user")
		}

		if len(queryUserPresets) != 1 {
			t.Fatalf("expected 1 preset, got %d", len(queryUserPresets))
		}

		preset := queryUserPresets[0]
		if preset.Value.Kind != ast.BlockValue {
			t.Errorf("expected block value, got %v", preset.Value.Kind)
		}

		if preset.SessionVariable != "x-hasura-user-id" {
			t.Errorf("expected session variable, got %q", preset.SessionVariable)
		}

		op := &ast.OperationDefinition{
			Operation: ast.Query,
			SelectionSet: ast.SelectionSet{
				&ast.Field{Name: "user"},
			},
		}

		result, _ := applyPresetsToDocument(
			op,
			nil,
			presets,
			map[string]any{"x-hasura-user-id": "session-user-123"},
			"Query",
		)

		field, ok := result.SelectionSet[0].(*ast.Field)
		if !ok {
			t.Fatal("expected *ast.Field")
		}

		if len(field.Arguments) != 1 {
			t.Fatalf("expected 1 argument, got %d", len(field.Arguments))
		}

		if field.Arguments[0].Value.Raw != "session-user-123" {
			t.Errorf(
				"expected session value to be injected, got %q",
				field.Arguments[0].Value.Raw,
			)
		}
	})

	t.Run("extracts typed presets", func(t *testing.T) {
		t.Parallel()

		sdl := `
			type Query {
				games(
					limit: Int! @preset(value: 5)
					rating: Float! @preset(value: 4.5)
					isHome: Boolean! @preset(value: true)
					region: Region! @preset(value: AMERICAS)
					ids: [Int!]! @preset(value: [1, 2])
					filter: GameFilter @preset(value: {active: true})
				): [Game!]!
			}
			type Game {
				id: ID!
			}
			enum Region {
				AMERICAS
				EMEA
			}
			input GameFilter {
				active: Boolean
			}
		`

		schema, presets, err := parseSDL(sdl)
		if err != nil {
			t.Fatalf("parseSDL error: %v", err)
		}

		for _, scalar := range schema.Scalars {
			if scalar.Name == presetValueScalarNamePrefix {
				t.Fatalf("internal preset scalar leaked into schema: %+v", schema.Scalars)
			}
		}

		gamesPresets := presets["Query.games"]
		if len(gamesPresets) != 6 {
			t.Fatalf("expected 6 presets for Query.games, got %d", len(gamesPresets))
		}

		byName := make(map[string]presetArg, len(gamesPresets))
		for _, preset := range gamesPresets {
			byName[preset.ArgumentName] = preset
		}

		tests := []struct {
			name       string
			valueKind  ast.ValueKind
			targetKind ast.DefinitionKind
		}{
			{name: "limit", valueKind: ast.IntValue, targetKind: ast.Scalar},
			{name: "rating", valueKind: ast.FloatValue, targetKind: ast.Scalar},
			{name: "isHome", valueKind: ast.BooleanValue, targetKind: ast.Scalar},
			{name: "region", valueKind: ast.EnumValue, targetKind: ast.Enum},
			{name: "ids", valueKind: ast.ListValue, targetKind: ast.Scalar},
			{name: "filter", valueKind: ast.ObjectValue, targetKind: ast.InputObject},
		}

		for _, tt := range tests {
			preset, ok := byName[tt.name]
			if !ok {
				t.Fatalf("missing preset for %s", tt.name)
			}

			if preset.Value.Kind != tt.valueKind {
				t.Errorf("%s kind: got %v, want %v", tt.name, preset.Value.Kind, tt.valueKind)
			}

			if preset.TargetKind != tt.targetKind {
				t.Errorf(
					"%s target kind: got %v, want %v",
					tt.name,
					preset.TargetKind,
					tt.targetKind,
				)
			}
		}

		if len(byName["ids"].Value.Children) != 2 {
			t.Errorf(
				"expected list children to be preserved, got %d",
				len(byName["ids"].Value.Children),
			)
		}

		if len(byName["filter"].Value.Children) != 1 {
			t.Errorf(
				"expected object children to be preserved, got %d",
				len(byName["filter"].Value.Children),
			)
		}
	})

	t.Run("prunes unreachable types", func(t *testing.T) {
		t.Parallel()

		sdl := `
			type Query {
				hello: String
			}
			type Orphan {
				id: ID!
			}
		`

		schema, _, err := parseSDL(sdl)
		if err != nil {
			t.Fatalf("parseSDL error: %v", err)
		}

		for _, typ := range schema.Types {
			if typ.Name == "Orphan" {
				t.Error("Orphan type should have been pruned")
			}
		}
	})

	t.Run("invalid SDL returns error", func(t *testing.T) {
		t.Parallel()

		_, _, err := parseSDL("this is not valid { graphql }")
		if err == nil {
			t.Fatal("expected error for invalid SDL")
		}
	})

	t.Run("handles enums and input types", func(t *testing.T) {
		t.Parallel()

		sdl := `
			type Query {
				users(filter: UserFilter): [User!]!
			}
			type User {
				id: ID!
				status: Status!
			}
			enum Status {
				ACTIVE
				INACTIVE
			}
			input UserFilter {
				status: Status
			}
		`

		schema, _, err := parseSDL(sdl)
		if err != nil {
			t.Fatalf("parseSDL error: %v", err)
		}

		if len(schema.Enums) == 0 {
			t.Error("expected at least one enum")
		}

		if len(schema.Inputs) == 0 {
			t.Error("expected at least one input type")
		}

		var foundStatus bool
		for _, e := range schema.Enums {
			if e.Name == "Status" {
				foundStatus = true

				if len(e.Values) != 2 {
					t.Errorf("expected 2 enum values, got %d", len(e.Values))
				}
			}
		}

		if !foundStatus {
			t.Error("expected Status enum")
		}
	})

	t.Run("handles mutation and subscription", func(t *testing.T) {
		t.Parallel()

		sdl := `
			type Query {
				users: [User!]!
			}
			type Mutation {
				createUser(name: String!): User!
			}
			type Subscription {
				userCreated: User!
			}
			type User {
				id: ID!
				name: String!
			}
		`

		schema, _, err := parseSDL(sdl)
		if err != nil {
			t.Fatalf("parseSDL error: %v", err)
		}

		if schema.MutationType == nil || *schema.MutationType != "Mutation" {
			t.Error("expected MutationType to be 'Mutation'")
		}

		if schema.SubscriptionType == nil || *schema.SubscriptionType != "Subscription" {
			t.Error("expected SubscriptionType to be 'Subscription'")
		}
	})

	t.Run("handles interfaces and unions", func(t *testing.T) {
		t.Parallel()

		sdl := `
			type Query {
				node(id: ID!): Node
				search: [SearchResult!]!
			}
			interface Node {
				id: ID!
			}
			type User implements Node {
				id: ID!
				name: String!
			}
			type Post implements Node {
				id: ID!
				title: String!
			}
			union SearchResult = User | Post
		`

		schema, _, err := parseSDL(sdl)
		if err != nil {
			t.Fatalf("parseSDL error: %v", err)
		}

		if len(schema.Interfaces) == 0 {
			t.Error("expected at least one interface")
		}

		if len(schema.Unions) == 0 {
			t.Error("expected at least one union")
		}

		var foundUnion bool
		for _, u := range schema.Unions {
			if u.Name == "SearchResult" {
				foundUnion = true

				if len(u.Types) != 2 {
					t.Errorf("expected 2 union members, got %d", len(u.Types))
				}
			}
		}

		if !foundUnion {
			t.Error("expected SearchResult union")
		}
	})

	t.Run("keeps implementors reachable only through interface", func(t *testing.T) {
		t.Parallel()

		sdl := `
			type Query {
				node(id: ID!): Node
			}
			interface Node {
				id: ID!
			}
			type User implements Node {
				id: ID!
				name: String!
			}
			type Post implements Node {
				id: ID!
				title: String!
			}
			type Orphan {
				id: ID!
			}
		`

		schema, _, err := parseSDL(sdl)
		if err != nil {
			t.Fatalf("parseSDL error: %v", err)
		}

		typeNames := make(map[string]struct{}, len(schema.Types))
		for _, typ := range schema.Types {
			typeNames[typ.Name] = struct{}{}
		}

		for _, name := range []string{"Query", "User", "Post"} {
			if _, ok := typeNames[name]; !ok {
				t.Errorf("expected %s to survive pruning", name)
			}
		}

		if _, ok := typeNames["Orphan"]; ok {
			t.Error("expected Orphan to be pruned")
		}
	})

	t.Run("handles custom scalars", func(t *testing.T) {
		t.Parallel()

		sdl := `
			scalar DateTime
			type Query {
				now: DateTime!
			}
		`

		schema, _, err := parseSDL(sdl)
		if err != nil {
			t.Fatalf("parseSDL error: %v", err)
		}

		var foundScalar bool
		for _, s := range schema.Scalars {
			if s.Name == "DateTime" {
				foundScalar = true
			}
		}

		if !foundScalar {
			t.Error("expected DateTime scalar")
		}
	})

	t.Run("allows user scalars that collide with preset helper candidates", func(t *testing.T) {
		t.Parallel()

		sdl := `
			scalar NhostPresetValue
			scalar NhostPresetValue1
			type Query {
				preset: NhostPresetValue!
				presetWithSuffix: NhostPresetValue1!
			}
		`

		schema, presets, err := parseSDL(sdl)
		if err != nil {
			t.Fatalf("parseSDL error: %v", err)
		}

		if len(presets) != 0 {
			t.Errorf("expected no presets, got %d", len(presets))
		}

		expectedScalars := map[string]struct{}{
			presetValueScalarNamePrefix:       {},
			presetValueScalarNamePrefix + "1": {},
		}
		for _, scalar := range schema.Scalars {
			delete(expectedScalars, scalar.Name)
		}

		for scalarName := range expectedScalars {
			t.Errorf("expected scalar %s", scalarName)
		}
	})

	t.Run("does not satisfy user type references with preset helper scalar", func(t *testing.T) {
		t.Parallel()

		sdl := `
			type Query {
				preset: NhostPresetValue
			}
		`

		_, _, err := parseSDL(sdl)
		if err == nil {
			t.Fatal("expected undefined NhostPresetValue reference to fail")
		}
	})

	t.Run("filters builtin types", func(t *testing.T) {
		t.Parallel()

		sdl := `
			type Query {
				hello: String
			}
		`

		schema, _, err := parseSDL(sdl)
		if err != nil {
			t.Fatalf("parseSDL error: %v", err)
		}

		for _, typ := range schema.Types {
			if strings.HasPrefix(typ.Name, "__") || typ.Name == "String" {
				t.Errorf("builtin type %s should be filtered", typ.Name)
			}
		}
	})
}
