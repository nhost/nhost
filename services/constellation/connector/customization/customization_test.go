package customization_test

import (
	"slices"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/customization"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// newTestSchema returns a small schema: a Query root with teams/team fields and
// a Team object type, mirroring the integration remote schema in miniature.
func newTestSchema() *graph.Schema {
	queryName := "Query"

	return &graph.Schema{
		Types: []*graph.ObjectType{
			{
				Name:        "Query",
				Description: "",
				Fields: []*graph.Field{
					{
						Name:        "teams",
						Description: "",
						Type:        graph.NewNonNullListType(graph.NewNonNullType("Team")),
						Arguments:   nil,
						Directives:  nil,
					},
					{
						Name:        "team",
						Description: "",
						Type:        graph.NewNamedType("Team"),
						Arguments: []*graph.Argument{
							{
								Name:         "id",
								Description:  "",
								Type:         graph.NewNonNullType("ID"),
								DefaultValue: nil,
								Directives:   nil,
							},
						},
						Directives: nil,
					},
				},
				Interfaces: nil,
				Directives: nil,
			},
			{
				Name:        "Team",
				Description: "",
				Fields: []*graph.Field{
					{
						Name:        "id",
						Description: "",
						Type:        graph.NewNonNullType("ID"),
						Arguments:   nil,
						Directives:  nil,
					},
					{
						Name:        "name",
						Description: "",
						Type:        graph.NewNonNullType("String"),
						Arguments:   nil,
						Directives:  nil,
					},
				},
				Interfaces: nil,
				Directives: nil,
			},
		},
		Scalars:          nil,
		Enums:            nil,
		Interfaces:       nil,
		Unions:           nil,
		Inputs:           nil,
		Directives:       nil,
		QueryType:        &queryName,
		MutationType:     nil,
		SubscriptionType: nil,
	}
}

// newTestSchemaWithRoots returns a schema with Query, Mutation, and
// Subscription root types (each holding one field) so wrapper-naming across all
// three operation kinds can be exercised.
func newTestSchemaWithRoots() *graph.Schema {
	queryName := "Query"
	mutationName := "Mutation"
	subscriptionName := "Subscription"

	return &graph.Schema{
		Types: []*graph.ObjectType{
			{
				Name:        "Query",
				Description: "",
				Fields: []*graph.Field{
					{
						Name:        "teams",
						Description: "",
						Type:        graph.NewNonNullListType(graph.NewNonNullType("Team")),
						Arguments:   nil,
						Directives:  nil,
					},
				},
				Interfaces: nil,
				Directives: nil,
			},
			{
				Name:        "Mutation",
				Description: "",
				Fields: []*graph.Field{
					{
						Name:        "insertTeam",
						Description: "",
						Type:        graph.NewNamedType("Team"),
						Arguments:   nil,
						Directives:  nil,
					},
				},
				Interfaces: nil,
				Directives: nil,
			},
			{
				Name:        "Subscription",
				Description: "",
				Fields: []*graph.Field{
					{
						Name:        "teamAdded",
						Description: "",
						Type:        graph.NewNamedType("Team"),
						Arguments:   nil,
						Directives:  nil,
					},
				},
				Interfaces: nil,
				Directives: nil,
			},
			{
				Name:        "Team",
				Description: "",
				Fields: []*graph.Field{
					{
						Name:        "id",
						Description: "",
						Type:        graph.NewNonNullType("ID"),
						Arguments:   nil,
						Directives:  nil,
					},
				},
				Interfaces: nil,
				Directives: nil,
			},
		},
		Scalars:          nil,
		Enums:            nil,
		Interfaces:       nil,
		Unions:           nil,
		Inputs:           nil,
		Directives:       nil,
		QueryType:        &queryName,
		MutationType:     &mutationName,
		SubscriptionType: &subscriptionName,
	}
}

// newTestSchemaWithSharedTypes returns a Query-only schema that also contains a
// custom scalar, the order_by enum, a *_comparison_exp input, and an ordinary
// input — mirroring the database-source types whose names Hasura leaves
// uncustomized so they dedup across sources.
func newTestSchemaWithSharedTypes() *graph.Schema {
	queryName := "Query"

	return &graph.Schema{
		Types: []*graph.ObjectType{
			{
				Name:        "Query",
				Description: "",
				Fields: []*graph.Field{
					{
						Name:        "teams",
						Description: "",
						Type:        graph.NewNonNullListType(graph.NewNonNullType("Team")),
						Arguments:   nil,
						Directives:  nil,
					},
				},
				Interfaces: nil,
				Directives: nil,
			},
			{
				Name:        "Team",
				Description: "",
				Fields: []*graph.Field{
					{
						Name:        "id",
						Description: "",
						Type:        graph.NewNonNullType("ID"),
						Arguments:   nil,
						Directives:  nil,
					},
				},
				Interfaces: nil,
				Directives: nil,
			},
		},
		Scalars: []*graph.ScalarType{
			{Name: "timestamptz", Description: "", Directives: nil},
		},
		Enums: []*graph.EnumType{
			{
				Name:        "order_by",
				Description: "",
				Values: []*graph.EnumValue{
					{Name: "asc", Description: "", Directives: nil},
				},
				Directives: nil,
			},
			{
				Name:        "team_select_column",
				Description: "",
				Values: []*graph.EnumValue{
					{Name: "id", Description: "", Directives: nil},
				},
				Directives: nil,
			},
		},
		Interfaces: nil,
		Unions:     nil,
		Inputs: []*graph.InputObjectType{
			{
				Name:        "String_comparison_exp",
				Description: "",
				Fields: []*graph.InputField{
					{
						Name:         "_eq",
						Description:  "",
						Type:         graph.NewNamedType("String"),
						DefaultValue: nil,
						Directives:   nil,
					},
				},
				Directives: nil,
			},
			{
				Name:        "team_bool_exp",
				Description: "",
				Fields: []*graph.InputField{
					{
						Name:         "id",
						Description:  "",
						Type:         graph.NewNamedType("String_comparison_exp"),
						DefaultValue: nil,
						Directives:   nil,
					},
				},
				Directives: nil,
			},
		},
		Directives:       nil,
		QueryType:        &queryName,
		MutationType:     nil,
		SubscriptionType: nil,
	}
}

func findType(s *graph.Schema, name string) *graph.ObjectType {
	for _, t := range s.Types {
		if t.Name == name {
			return t
		}
	}

	return nil
}

func findField(t *graph.ObjectType, name string) *graph.Field {
	if t == nil {
		return nil
	}

	for _, f := range t.Fields {
		if f.Name == name {
			return f
		}
	}

	return nil
}

// baseTypeName walks list/non-null wrappers down to the named type.
func baseTypeName(t *graph.Type) string {
	for t != nil {
		if t.Elem == nil {
			return t.NamedType
		}

		t = t.Elem
	}

	return ""
}

func TestApplyZeroIsNoOp(t *testing.T) {
	t.Parallel()

	s := newTestSchema()
	s = customization.New(metadata.Customization{}, customization.FlavorRemoteSchema).
		Apply(s)

	if findType(s, "Team") == nil {
		t.Fatalf("zero customization renamed Team")
	}

	if findField(findType(s, "Query"), "teams") == nil {
		t.Fatalf("zero customization renamed root field teams")
	}
}

func TestApplyRenaming(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		cfg  metadata.Customization
		// check runs the per-case assertions against the applied schema.
		check func(t *testing.T, s *graph.Schema)
	}{
		{
			name: "type prefix and suffix rename the type and its references",
			cfg: metadata.Customization{
				TypeNamesPrefix: "League",
				TypeNamesSuffix: "X",
			},
			check: func(t *testing.T, s *graph.Schema) {
				t.Helper()

				if findType(s, "LeagueTeamX") == nil {
					t.Fatalf("Team was not renamed to LeagueTeamX; types: %v", typeNames(s))
				}

				query := findType(s, "Query")
				if query == nil {
					t.Fatalf("root type Query must keep its name (it is flattened later)")
				}

				if got := baseTypeName(findField(query, "teams").Type); got != "LeagueTeamX" {
					t.Errorf("teams field type = %q, want LeagueTeamX", got)
				}

				team := findField(query, "team")
				if got := baseTypeName(team.Type); got != "LeagueTeamX" {
					t.Errorf("team field type = %q, want LeagueTeamX", got)
				}

				if got := baseTypeName(team.Arguments[0].Type); got != "ID" {
					t.Errorf("builtin scalar ID was renamed to %q", got)
				}
			},
		},
		{
			name: "type mapping wins over prefix",
			cfg: metadata.Customization{
				TypeNamesPrefix:  "League",
				TypeNamesMapping: map[string]string{"Team": "SoccerTeam"},
			},
			check: func(t *testing.T, s *graph.Schema) {
				t.Helper()

				if findType(s, "SoccerTeam") == nil {
					t.Fatalf("mapping did not win; types: %v", typeNames(s))
				}

				got := baseTypeName(findField(findType(s, "Query"), "teams").Type)
				if got != "SoccerTeam" {
					t.Errorf("teams field type = %q, want SoccerTeam", got)
				}
			},
		},
		{
			name: "root-field prefix and suffix only touch root fields",
			cfg: metadata.Customization{
				RootFieldsPrefix: "db_",
				RootFieldsSuffix: "_v1",
			},
			check: func(t *testing.T, s *graph.Schema) {
				t.Helper()

				query := findType(s, "Query")
				if findField(query, "db_teams_v1") == nil {
					t.Errorf("root field teams not renamed; fields: %v", fieldNames(query))
				}

				if findField(findType(s, "Team"), "id") == nil {
					t.Errorf("non-root field id must not get the root prefix/suffix")
				}
			},
		},
		{
			name: "per-type field_names mapping renames a field",
			cfg: metadata.Customization{
				FieldNames: []metadata.FieldNameCustomization{
					{
						ParentType: "Team",
						Prefix:     "",
						Suffix:     "",
						Mapping:    map[string]string{"name": "displayName"},
					},
				},
			},
			check: func(t *testing.T, s *graph.Schema) {
				t.Helper()

				team := findType(s, "Team")
				if findField(team, "displayName") == nil {
					t.Errorf("Team.name not renamed to displayName; fields: %v", fieldNames(team))
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			s := customization.New(tt.cfg, customization.FlavorRemoteSchema).
				Apply(newTestSchema())
			tt.check(t, s)
		})
	}
}

func TestApplyDatabaseFlavorLeavesSharedTypesUncustomized(t *testing.T) {
	t.Parallel()

	// Under the database flavor Hasura leaves scalars, the order_by enum, and
	// every *_comparison_exp input uncustomized so they dedup across sources,
	// while ordinary types still get the prefix.
	s := customization.New(metadata.Customization{
		TypeNamesPrefix: "App",
	}, customization.FlavorDatabase).Apply(newTestSchemaWithSharedTypes())

	for _, name := range []string{"timestamptz", "order_by", "String_comparison_exp"} {
		if !hasTypeName(s, name) {
			t.Errorf("shared type %q must keep its name; names: %v", name, allTypeNames(s))
		}

		if hasTypeName(s, "App"+name) {
			t.Errorf("shared type %q must not be prefixed", name)
		}
	}

	for _, name := range []string{"AppTeam", "Appteam_select_column", "Appteam_bool_exp"} {
		if !hasTypeName(s, name) {
			t.Errorf("ordinary type %q must be prefixed; names: %v", name, allTypeNames(s))
		}
	}
}

func TestApplyDatabaseFlavorWrapperNamesPerOperationKind(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		flavor      customization.Flavor
		rootType    func(s *graph.Schema) *graph.ObjectType
		wantWrapper string
	}{
		{
			name:        "database query wrapper",
			flavor:      customization.FlavorDatabase,
			rootType:    func(s *graph.Schema) *graph.ObjectType { return findType(s, "Query") },
			wantWrapper: "Catalogcatalog_query",
		},
		{
			name:        "database mutation wrapper uses _mutation_frontend",
			flavor:      customization.FlavorDatabase,
			rootType:    func(s *graph.Schema) *graph.ObjectType { return findType(s, "Mutation") },
			wantWrapper: "Catalogcatalog_mutation_frontend",
		},
		{
			name:        "database subscription wrapper uses _subscription",
			flavor:      customization.FlavorDatabase,
			rootType:    func(s *graph.Schema) *graph.ObjectType { return findType(s, "Subscription") },
			wantWrapper: "Catalogcatalog_subscription",
		},
		{
			name:        "remote-schema mutation wrapper appends the kind verbatim",
			flavor:      customization.FlavorRemoteSchema,
			rootType:    func(s *graph.Schema) *graph.ObjectType { return findType(s, "Mutation") },
			wantWrapper: "catalogMutation",
		},
		{
			name:        "remote-schema subscription wrapper appends the kind verbatim",
			flavor:      customization.FlavorRemoteSchema,
			rootType:    func(s *graph.Schema) *graph.ObjectType { return findType(s, "Subscription") },
			wantWrapper: "catalogSubscription",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			s := customization.New(metadata.Customization{
				RootFieldsNamespace: "catalog",
				TypeNamesPrefix:     "Catalog",
			}, tt.flavor).Apply(newTestSchemaWithRoots())

			root := tt.rootType(s)
			if root == nil || len(root.Fields) != 1 || root.Fields[0].Name != "catalog" {
				t.Fatalf("root not wrapped under catalog: %v", fieldNames(root))
			}

			if got := baseTypeName(root.Fields[0].Type); got != tt.wantWrapper {
				t.Errorf("wrapper type = %q, want %q", got, tt.wantWrapper)
			}

			if findType(s, tt.wantWrapper) == nil {
				t.Errorf("wrapper type %q not found; types: %v", tt.wantWrapper, typeNames(s))
			}
		})
	}
}

func TestApplyNamespaceWrapsRootFields(t *testing.T) {
	t.Parallel()

	s := newTestSchema()
	s = customization.New(metadata.Customization{
		RootFieldsNamespace: "league",
		TypeNamesPrefix:     "League",
	}, customization.FlavorRemoteSchema).Apply(s)

	query := findType(s, "Query")
	if query == nil {
		t.Fatalf("root Query type missing")
	}

	if len(query.Fields) != 1 {
		t.Fatalf("root Query must hold exactly the namespace field, got %v", fieldNames(query))
	}

	ns := query.Fields[0]
	if ns.Name != "league" {
		t.Errorf("namespace field = %q, want league", ns.Name)
	}

	// Hasura emits `league: leagueQuery` — the namespace field is nullable.
	if ns.Type.NonNull {
		t.Errorf("namespace field must be nullable, matching Hasura")
	}

	wrapperName := baseTypeName(ns.Type)
	if wrapperName != "leagueQuery" {
		t.Errorf(
			"wrapper type = %q, want leagueQuery (<namespace>+Query, not type-prefixed)",
			wrapperName,
		)
	}

	wrapper := findType(s, wrapperName)
	if wrapper == nil {
		t.Fatalf("namespace wrapper type %q not found; types: %v", wrapperName, typeNames(s))
	}

	if findField(wrapper, "teams") == nil {
		t.Errorf("wrapper missing wrapped root field teams; fields: %v", fieldNames(wrapper))
	}

	if got := baseTypeName(findField(wrapper, "teams").Type); got != "LeagueTeam" {
		t.Errorf("wrapped teams field type = %q, want LeagueTeam", got)
	}
}

func TestApplyNamespaceDatabaseFlavorWrapperNaming(t *testing.T) {
	t.Parallel()

	// Database sources name the query wrapper <prefix><namespace>_query, with
	// the type prefix applied — unlike remote schemas (<namespace>Query).
	s := customization.New(metadata.Customization{
		RootFieldsNamespace: "catalog",
		TypeNamesPrefix:     "Catalog",
	}, customization.FlavorDatabase).Apply(newTestSchema())

	query := findType(s, "Query")
	if query == nil || len(query.Fields) != 1 || query.Fields[0].Name != "catalog" {
		t.Fatalf("root not wrapped under catalog: %v", fieldNames(query))
	}

	wrapperName := baseTypeName(query.Fields[0].Type)
	if wrapperName != "Catalogcatalog_query" {
		t.Errorf("database wrapper = %q, want Catalogcatalog_query", wrapperName)
	}

	if findType(s, wrapperName) == nil {
		t.Errorf("wrapper type %q not found; types: %v", wrapperName, typeNames(s))
	}

	if findType(s, "CatalogTeam") == nil {
		t.Errorf("Team not prefixed to CatalogTeam; types: %v", typeNames(s))
	}
}

func typeNames(s *graph.Schema) []string {
	names := make([]string, len(s.Types))
	for i, t := range s.Types {
		names[i] = t.Name
	}

	return names
}

// allTypeNames returns every named type in the schema across all kinds
// (objects, scalars, enums, interfaces, unions, inputs).
func allTypeNames(s *graph.Schema) []string {
	names := make(
		[]string,
		0,
		len(s.Types)+len(s.Scalars)+len(s.Enums)+len(s.Interfaces)+len(s.Unions)+len(s.Inputs),
	)

	for _, t := range s.Types {
		names = append(names, t.Name)
	}

	for _, t := range s.Scalars {
		names = append(names, t.Name)
	}

	for _, t := range s.Enums {
		names = append(names, t.Name)
	}

	for _, t := range s.Interfaces {
		names = append(names, t.Name)
	}

	for _, t := range s.Unions {
		names = append(names, t.Name)
	}

	for _, t := range s.Inputs {
		names = append(names, t.Name)
	}

	return names
}

func hasTypeName(s *graph.Schema, name string) bool {
	return slices.Contains(allTypeNames(s), name)
}

func fieldNames(t *graph.ObjectType) []string {
	if t == nil {
		return nil
	}

	names := make([]string, len(t.Fields))
	for i, f := range t.Fields {
		names[i] = f.Name
	}

	return names
}
