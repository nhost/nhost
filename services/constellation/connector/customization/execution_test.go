package customization_test

import (
	"bytes"
	"encoding/json/jsontext"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/customization"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2/ast"
)

// namespacedCustomizer returns a Customizer with namespace "league" and type
// prefix "League", primed via Apply so its type maps (LeagueTeam<->Team) are
// populated for the reverse/forward direction.
func namespacedCustomizer() *customization.Customizer {
	c := customization.New(metadata.Customization{
		RootFieldsNamespace: "league",
		TypeNamesPrefix:     "League",
	}, customization.FlavorRemoteSchema)
	c.Apply(newTestSchema())

	return c
}

func field(name string, sels ast.SelectionSet) *ast.Field {
	return &ast.Field{
		Name:         name,
		SelectionSet: sels,
	}
}

func TestReverseOperationUnwrapsNamespaceAndTypeCondition(t *testing.T) {
	t.Parallel()

	// query { league { teams { ... on LeagueTeam { id } } } }
	op := &ast.OperationDefinition{
		Operation: ast.Query,
		SelectionSet: ast.SelectionSet{
			field("league", ast.SelectionSet{
				field("teams", ast.SelectionSet{
					&ast.InlineFragment{
						TypeCondition: "LeagueTeam",
						SelectionSet:  ast.SelectionSet{field("id", nil)},
					},
				}),
			}),
		},
	}

	native, _ := namespacedCustomizer().ReverseOperation(op, nil)

	if len(native.SelectionSet) != 1 {
		t.Fatalf("namespace not unwrapped: got %d root selections", len(native.SelectionSet))
	}

	teams, ok := native.SelectionSet[0].(*ast.Field)
	if !ok || teams.Name != "teams" {
		t.Fatalf("root selection = %#v, want field teams", native.SelectionSet[0])
	}

	frag, ok := teams.SelectionSet[0].(*ast.InlineFragment)
	if !ok {
		t.Fatalf("expected inline fragment under teams, got %#v", teams.SelectionSet[0])
	}

	if frag.TypeCondition != "Team" {
		t.Errorf("type condition = %q, want Team (reversed from LeagueTeam)", frag.TypeCondition)
	}
}

// TestReverseOperationLiftsNamespaceFromRootFragments proves that a namespace
// field reaching ReverseOperation inside a root-level fragment spread or inline
// fragment is unwrapped exactly like a top-level namespace *ast.Field: the
// namespace wrapper is stripped and its children are lifted to the root. This
// is the subscription path's shape (customized_subscription.go reverses the raw
// client operation, which may carry a root fragment), so failing to lift here
// would feed the native connector a `league` root field its schema does not
// have.
func TestReverseOperationLiftsNamespaceFromRootFragments(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		op        *ast.OperationDefinition
		fragments ast.FragmentDefinitionList
	}{
		{
			// subscription { ...leagueFields }
			// fragment leagueFields on Subscription { league { teams { id } } }
			name: "root fragment spread",
			op: &ast.OperationDefinition{
				Operation: ast.Subscription,
				SelectionSet: ast.SelectionSet{
					&ast.FragmentSpread{Name: "leagueFields"},
				},
			},
			fragments: ast.FragmentDefinitionList{
				&ast.FragmentDefinition{
					Name:          "leagueFields",
					TypeCondition: "Subscription",
					SelectionSet: ast.SelectionSet{
						field("league", ast.SelectionSet{
							field("teams", ast.SelectionSet{field("id", nil)}),
						}),
					},
				},
			},
		},
		{
			// subscription { ... on Subscription { league { teams { id } } } }
			name: "root inline fragment",
			op: &ast.OperationDefinition{
				Operation: ast.Subscription,
				SelectionSet: ast.SelectionSet{
					&ast.InlineFragment{
						TypeCondition: "Subscription",
						SelectionSet: ast.SelectionSet{
							field("league", ast.SelectionSet{
								field("teams", ast.SelectionSet{field("id", nil)}),
							}),
						},
					},
				},
			},
			fragments: nil,
		},
		{
			// subscription { ...outer }
			// fragment outer on Subscription { ...inner }
			// fragment inner on Subscription { league { teams { id } } }
			name: "nested root fragment spread",
			op: &ast.OperationDefinition{
				Operation: ast.Subscription,
				SelectionSet: ast.SelectionSet{
					&ast.FragmentSpread{Name: "outer"},
				},
			},
			fragments: ast.FragmentDefinitionList{
				&ast.FragmentDefinition{
					Name:          "outer",
					TypeCondition: "Subscription",
					SelectionSet:  ast.SelectionSet{&ast.FragmentSpread{Name: "inner"}},
				},
				&ast.FragmentDefinition{
					Name:          "inner",
					TypeCondition: "Subscription",
					SelectionSet: ast.SelectionSet{
						field("league", ast.SelectionSet{
							field("teams", ast.SelectionSet{field("id", nil)}),
						}),
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			native, _ := namespacedCustomizer().ReverseOperation(tt.op, tt.fragments)

			// The namespace wrapper must be gone: the only root selection is the
			// lifted `teams` field, so the native connector sees its own schema.
			if len(native.SelectionSet) != 1 {
				t.Fatalf("namespace not lifted: got %d root selections: %#v",
					len(native.SelectionSet), native.SelectionSet)
			}

			teams, ok := native.SelectionSet[0].(*ast.Field)
			if !ok {
				t.Fatalf("root selection = %#v, want lifted field teams", native.SelectionSet[0])
			}

			if teams.Name != "teams" {
				t.Errorf("lifted root field name = %q, want teams", teams.Name)
			}

			// No root field rename is configured, so no alias is injected; the
			// response key stays `teams`, which is the key ForwardResult re-nests
			// under the namespace when reshaping the result.
			if teams.Alias != "" {
				t.Errorf("lifted field alias = %q, want empty (no root-field rename)", teams.Alias)
			}

			if len(teams.SelectionSet) != 1 {
				t.Fatalf("lifted teams lost its selection set: %#v", teams.SelectionSet)
			}
		})
	}
}

// TestReverseOperationRootFragmentResponseKeyRoundTrip proves the alias /
// response-key contract still holds when the namespace field arrives inside a
// root fragment AND the root fields are renamed: the lifted field is aliased to
// the customized name so the native connector returns data under the key
// ForwardResult re-nests, exactly as the top-level field case does.
func TestReverseOperationRootFragmentResponseKeyRoundTrip(t *testing.T) {
	t.Parallel()

	c := customization.New(metadata.Customization{
		RootFieldsNamespace: "league",
		RootFieldsPrefix:    "db_",
	}, customization.FlavorRemoteSchema)
	c.Apply(newTestSchema())

	// subscription { ...leagueFields }
	// fragment leagueFields on Subscription { league { db_teams { id } } }
	op := &ast.OperationDefinition{
		Operation: ast.Subscription,
		SelectionSet: ast.SelectionSet{
			&ast.FragmentSpread{Name: "leagueFields"},
		},
	}
	fragments := ast.FragmentDefinitionList{
		&ast.FragmentDefinition{
			Name:          "leagueFields",
			TypeCondition: "Subscription",
			SelectionSet: ast.SelectionSet{
				field("league", ast.SelectionSet{
					field("db_teams", ast.SelectionSet{field("id", nil)}),
				}),
			},
		},
	}

	native, _ := c.ReverseOperation(op, fragments)

	if len(native.SelectionSet) != 1 {
		t.Fatalf("namespace not lifted: got %d root selections", len(native.SelectionSet))
	}

	teams, ok := native.SelectionSet[0].(*ast.Field)
	if !ok {
		t.Fatalf("root selection = %#v, want lifted field", native.SelectionSet[0])
	}

	if teams.Name != "teams" {
		t.Errorf("lifted native field name = %q, want teams (db_ stripped)", teams.Name)
	}

	if teams.Alias != "db_teams" {
		t.Errorf("lifted field alias = %q, want db_teams (response key preserved)", teams.Alias)
	}
}

// TestReverseOperationStripsAffixInWrapperTypeFragment proves that a named
// fragment whose type condition is the namespace WRAPPER type carries root
// fields, so its affixed root field is reversed (and aliased) when reversed as
// a fragment definition. A client may write
//
//	subscription { league { ...frag } }
//	fragment frag on league_subscription { db_teams { id } }
//
// against the customized schema (league_subscription is a real type minted by
// Apply). The fragment definition is reversed independently of the operation,
// and only the root-operation-type check used to mark it as root — so the
// affixed root field went unstripped and missed against the native connector.
// Treating wrapper types as root closes that gap.
func TestReverseOperationStripsAffixInWrapperTypeFragment(t *testing.T) {
	t.Parallel()

	c := customization.New(metadata.Customization{
		RootFieldsNamespace: "league",
		RootFieldsPrefix:    "db_",
	}, customization.FlavorDatabase)
	c.Apply(newTestSchemaWithRoots())

	// FlavorDatabase names the subscription wrapper "<namespace>_subscription".
	const wrapperType = "league_subscription"

	// subscription { league { ...frag } }
	// fragment frag on league_subscription { db_teamAdded { id } }
	op := &ast.OperationDefinition{
		Operation: ast.Subscription,
		SelectionSet: ast.SelectionSet{
			field("league", ast.SelectionSet{
				&ast.FragmentSpread{Name: "frag"},
			}),
		},
	}
	fragments := ast.FragmentDefinitionList{
		&ast.FragmentDefinition{
			Name:          "frag",
			TypeCondition: wrapperType,
			SelectionSet: ast.SelectionSet{
				field("db_teamAdded", ast.SelectionSet{field("id", nil)}),
			},
		},
	}

	_, nativeFragments := c.ReverseOperation(op, fragments)

	if len(nativeFragments) != 1 {
		t.Fatalf("expected one reversed fragment, got %d", len(nativeFragments))
	}

	if len(nativeFragments[0].SelectionSet) != 1 {
		t.Fatalf("fragment lost its selection set: %#v", nativeFragments[0].SelectionSet)
	}

	added, ok := nativeFragments[0].SelectionSet[0].(*ast.Field)
	if !ok {
		t.Fatalf("fragment selection = %#v, want a field", nativeFragments[0].SelectionSet[0])
	}

	if added.Name != "teamAdded" {
		t.Errorf(
			"wrapper-fragment root field name = %q, want teamAdded (db_ prefix must be stripped)",
			added.Name,
		)
	}

	if added.Alias != "db_teamAdded" {
		t.Errorf(
			"wrapper-fragment root field alias = %q, want db_teamAdded (response key preserved)",
			added.Alias,
		)
	}
}

func TestReverseOperationRootFieldNameRoundTrip(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		cfg  metadata.Customization
		// customized is the field name the client sends (after Apply renamed it).
		customized string
		// wantNative is the native name ReverseOperation must restore.
		wantNative string
		// wantAlias is the alias the reversed field must carry so the connector
		// returns data under the key the caller expects (empty = no alias).
		wantAlias string
	}{
		{
			name:       "prefix and suffix are stripped",
			cfg:        metadata.Customization{RootFieldsPrefix: "db_", RootFieldsSuffix: "_v1"},
			customized: "db_teams_v1",
			wantNative: "teams",
			wantAlias:  "db_teams_v1",
		},
		{
			name:       "prefix only is stripped",
			cfg:        metadata.Customization{RootFieldsPrefix: "db_"},
			customized: "db_teams",
			wantNative: "teams",
			wantAlias:  "db_teams",
		},
		{
			name:       "suffix only is stripped",
			cfg:        metadata.Customization{RootFieldsSuffix: "_v1"},
			customized: "teams_v1",
			wantNative: "teams",
			wantAlias:  "teams_v1",
		},
		{
			name:       "missing prefix leaves the name untouched (early return)",
			cfg:        metadata.Customization{RootFieldsPrefix: "db_", RootFieldsSuffix: "_v1"},
			customized: "teams_v1",
			wantNative: "teams_v1",
			wantAlias:  "",
		},
		{
			name:       "missing suffix leaves the name untouched (early return)",
			cfg:        metadata.Customization{RootFieldsPrefix: "db_", RootFieldsSuffix: "_v1"},
			customized: "db_teams",
			wantNative: "db_teams",
			wantAlias:  "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			c := customization.New(tt.cfg, customization.FlavorRemoteSchema)
			c.Apply(newTestSchema())

			op := &ast.OperationDefinition{
				Operation:    ast.Query,
				SelectionSet: ast.SelectionSet{field(tt.customized, nil)},
			}

			native, _ := c.ReverseOperation(op, nil)
			if len(native.SelectionSet) != 1 {
				t.Fatalf("expected one root selection, got %d", len(native.SelectionSet))
			}

			got, ok := native.SelectionSet[0].(*ast.Field)
			if !ok {
				t.Fatalf("root selection = %#v, want a field", native.SelectionSet[0])
			}

			if got.Name != tt.wantNative {
				t.Errorf("native field name = %q, want %q", got.Name, tt.wantNative)
			}

			if got.Alias != tt.wantAlias {
				t.Errorf("reversed field alias = %q, want %q", got.Alias, tt.wantAlias)
			}
		})
	}
}

// TestReverseOperationLeavesNestedAffixCollisionsIntact proves that the
// root-field prefix/suffix is reversed only on genuine root fields, not on
// nested fields whose names happen to collide with the affix. A database source
// configured with root_fields.prefix/suffix renames only its root fields; a
// nested column or relationship that starts with the prefix (or ends with the
// suffix) must reach the connector verbatim, otherwise the connector is asked
// for the wrong column (or a non-existent one) and the query returns wrong data
// or fails.
func TestReverseOperationLeavesNestedAffixCollisionsIntact(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		cfg  metadata.Customization
		// rootCustomized is the customized root field name the client sends.
		rootCustomized string
		// wantRootNative is the native name the root field must restore to.
		wantRootNative string
		// wantRootAlias is the alias the reversed root field must carry so the
		// connector returns data under the customized key.
		wantRootAlias string
		// nestedName is a nested field name that collides with the affix; it
		// must reach the connector untouched (no alias, no rename).
		nestedName string
	}{
		{
			name:           "prefix is stripped on root but not on nested column",
			cfg:            metadata.Customization{RootFieldsPrefix: "app_"},
			rootCustomized: "app_users",
			wantRootNative: "users",
			wantRootAlias:  "app_users",
			// app_id collides with the "app_" prefix; the native column is
			// app_id, not id.
			nestedName: "app_id",
		},
		{
			name:           "suffix is stripped on root but not on nested column",
			cfg:            metadata.Customization{RootFieldsSuffix: "_v1"},
			rootCustomized: "users_v1",
			wantRootNative: "users",
			wantRootAlias:  "users_v1",
			// created_v1 collides with the "_v1" suffix; the native column is
			// created_v1, not created.
			nestedName: "created_v1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			c := customization.New(tt.cfg, customization.FlavorDatabase)
			c.Apply(newTestSchema())

			// query { <rootCustomized> { <nestedName> } }
			op := &ast.OperationDefinition{
				Operation: ast.Query,
				SelectionSet: ast.SelectionSet{
					field(tt.rootCustomized, ast.SelectionSet{field(tt.nestedName, nil)}),
				},
			}

			native, _ := c.ReverseOperation(op, nil)
			if len(native.SelectionSet) != 1 {
				t.Fatalf("expected one root selection, got %d", len(native.SelectionSet))
			}

			root, ok := native.SelectionSet[0].(*ast.Field)
			if !ok {
				t.Fatalf("root selection = %#v, want a field", native.SelectionSet[0])
			}

			if root.Name != tt.wantRootNative {
				t.Errorf(
					"root field name = %q, want %q (affix stripped)",
					root.Name,
					tt.wantRootNative,
				)
			}

			if root.Alias != tt.wantRootAlias {
				t.Errorf("root field alias = %q, want %q", root.Alias, tt.wantRootAlias)
			}

			if len(root.SelectionSet) != 1 {
				t.Fatalf("root field lost its selection set: %#v", root.SelectionSet)
			}

			nested, ok := root.SelectionSet[0].(*ast.Field)
			if !ok {
				t.Fatalf("nested selection = %#v, want a field", root.SelectionSet[0])
			}

			if nested.Name != tt.nestedName {
				t.Errorf(
					"nested field name = %q, want %q (affix must NOT be stripped on nested fields)",
					nested.Name,
					tt.nestedName,
				)
			}

			if nested.Alias != "" {
				t.Errorf(
					"nested field alias = %q, want empty (name unchanged, no alias)",
					nested.Alias,
				)
			}
		})
	}
}

func TestReverseOperationReversesVariableTypes(t *testing.T) {
	t.Parallel()

	// query ($where: LeagueTeam, $ids: [LeagueTeam!]!, $name: String) { ... }
	// LeagueTeam reverses to Team; the list/non-null wrappers and the builtin
	// String must be preserved.
	op := &ast.OperationDefinition{
		Operation: ast.Query,
		VariableDefinitions: ast.VariableDefinitionList{
			&ast.VariableDefinition{
				Variable: "where",
				Type:     &ast.Type{NamedType: "LeagueTeam"},
			},
			&ast.VariableDefinition{
				Variable: "ids",
				Type: &ast.Type{
					NonNull: true,
					Elem:    &ast.Type{NamedType: "LeagueTeam", NonNull: true},
				},
			},
			&ast.VariableDefinition{
				Variable: "name",
				Type:     &ast.Type{NamedType: "String"},
			},
		},
		SelectionSet: ast.SelectionSet{
			field("league", ast.SelectionSet{field("teams", ast.SelectionSet{field("id", nil)})}),
		},
	}

	native, _ := namespacedCustomizer().ReverseOperation(op, nil)

	defs := native.VariableDefinitions
	if len(defs) != 3 {
		t.Fatalf("expected 3 variable definitions, got %d", len(defs))
	}

	if got := defs[0].Type.NamedType; got != "Team" {
		t.Errorf("where type = %q, want Team (reversed from LeagueTeam)", got)
	}

	listElem := defs[1].Type.Elem
	if listElem == nil {
		t.Fatalf("ids type lost its list wrapper: %#v", defs[1].Type)
	}

	if !defs[1].Type.NonNull {
		t.Errorf("ids list wrapper must stay non-null")
	}

	if listElem.NamedType != "Team" || !listElem.NonNull {
		t.Errorf("ids element = %q (nonNull=%v), want Team (nonNull=true)",
			listElem.NamedType, listElem.NonNull)
	}

	if got := defs[2].Type.NamedType; got != "String" {
		t.Errorf("name type = %q, want String (builtin left untouched)", got)
	}
}

func TestReverseOperationLeavesInputUntouchedWithoutCustomization(t *testing.T) {
	t.Parallel()

	c := customization.New(metadata.Customization{}, customization.FlavorRemoteSchema)

	op := &ast.OperationDefinition{
		Operation:    ast.Query,
		SelectionSet: ast.SelectionSet{field("teams", nil)},
	}

	native, _ := c.ReverseOperation(op, nil)
	if native != op {
		t.Errorf("disabled customizer must return the operation unchanged")
	}
}

func TestForwardResultReWrapsNamespace(t *testing.T) {
	t.Parallel()

	// Customized op: query { league { teams { id } } }
	op := &ast.OperationDefinition{
		Operation: ast.Query,
		SelectionSet: ast.SelectionSet{
			field("league", ast.SelectionSet{
				field("teams", ast.SelectionSet{field("id", nil)}),
			}),
		},
	}

	// Native connector returns the lifted root field at the top level.
	native := map[string]any{
		"teams": []any{
			map[string]any{"id": "team-eng"},
		},
	}

	out := namespacedCustomizer().ForwardResult(native, op, nil)

	league, ok := out["league"].(map[string]any)
	if !ok {
		t.Fatalf("result not re-wrapped under league: %#v", out)
	}

	if _, ok := league["teams"].([]any); !ok {
		t.Errorf("teams not nested under league: %#v", league)
	}
}

func TestForwardResultRemapsTypename(t *testing.T) {
	t.Parallel()

	// query { league { teams { __typename } } }
	op := &ast.OperationDefinition{
		Operation: ast.Query,
		SelectionSet: ast.SelectionSet{
			field("league", ast.SelectionSet{
				field("teams", ast.SelectionSet{field("__typename", nil)}),
			}),
		},
	}

	native := map[string]any{
		"teams": []any{
			map[string]any{"__typename": "Team"},
		},
	}

	out := namespacedCustomizer().ForwardResult(native, op, nil)

	league, ok := out["league"].(map[string]any)
	if !ok {
		t.Fatalf("result not re-wrapped under league: %#v", out)
	}

	teams, ok := league["teams"].([]any)
	if !ok || len(teams) == 0 {
		t.Fatalf("teams not a non-empty list: %#v", league["teams"])
	}

	first, ok := teams[0].(map[string]any)
	if !ok {
		t.Fatalf("team element not an object: %#v", teams[0])
	}

	if got := first["__typename"]; got != "LeagueTeam" {
		t.Errorf("__typename = %v, want LeagueTeam (remapped from Team)", got)
	}
}

// TestForwardResultRawPassthroughNoTypename verifies that, under a type-renaming
// customization, a raw-JSON value whose selection subtree does NOT select
// __typename is passed through unchanged (the connector's raw-bytes fast path is
// preserved instead of being decoded and re-walked).
func TestForwardResultRawPassthroughNoTypename(t *testing.T) {
	t.Parallel()

	// query { league { teams { id name } } } — no __typename anywhere.
	op := &ast.OperationDefinition{
		Operation: ast.Query,
		SelectionSet: ast.SelectionSet{
			field("league", ast.SelectionSet{
				field("teams", ast.SelectionSet{
					field("id", nil),
					field("name", nil),
				}),
			}),
		},
	}

	// SQL connectors return list/object field results as raw jsontext.Value.
	raw := jsontext.Value(`[{"id":"team-eng","name":"Engineering"}]`)
	native := map[string]any{"teams": raw}

	out := namespacedCustomizer().ForwardResult(native, op, nil)

	league, ok := out["league"].(map[string]any)
	if !ok {
		t.Fatalf("result not re-wrapped under league: %#v", out)
	}

	got, ok := league["teams"].(jsontext.Value)
	if !ok {
		t.Fatalf("teams not passed through as raw jsontext.Value: %#v (type %T)",
			league["teams"], league["teams"])
	}

	if !bytes.Equal(got, raw) {
		t.Errorf("raw bytes mutated: got %s, want %s", got, raw)
	}
}

// TestForwardResultRawDecodedTypename verifies that, under a type-renaming
// customization, a raw-JSON value whose selection subtree DOES select __typename
// is decoded, walked, and has its nested __typename remapped.
func TestForwardResultRawDecodedTypename(t *testing.T) {
	t.Parallel()

	// query { league { teams { id __typename } } }
	op := &ast.OperationDefinition{
		Operation: ast.Query,
		SelectionSet: ast.SelectionSet{
			field("league", ast.SelectionSet{
				field("teams", ast.SelectionSet{
					field("id", nil),
					field("__typename", nil),
				}),
			}),
		},
	}

	raw := jsontext.Value(`[{"id":"team-eng","__typename":"Team"}]`)
	native := map[string]any{"teams": raw}

	out := namespacedCustomizer().ForwardResult(native, op, nil)

	league, ok := out["league"].(map[string]any)
	if !ok {
		t.Fatalf("result not re-wrapped under league: %#v", out)
	}

	teams, ok := league["teams"].([]any)
	if !ok || len(teams) == 0 {
		t.Fatalf("teams not decoded into a non-empty list: %#v", league["teams"])
	}

	first, ok := teams[0].(map[string]any)
	if !ok {
		t.Fatalf("team element not an object: %#v", teams[0])
	}

	if got := first["__typename"]; got != "LeagueTeam" {
		t.Errorf("__typename = %v, want LeagueTeam (remapped from Team)", got)
	}
}

// TestForwardResultRawTypenameViaFragmentSpread verifies that __typename
// selected through a fragment spread inside a raw subtree still triggers the
// decode-and-remap path (the fast-path predicate resolves spreads).
func TestForwardResultRawTypenameViaFragmentSpread(t *testing.T) {
	t.Parallel()

	// query { league { teams { ...teamFields } } }
	// fragment teamFields on LeagueTeam { id __typename }
	op := &ast.OperationDefinition{
		Operation: ast.Query,
		SelectionSet: ast.SelectionSet{
			field("league", ast.SelectionSet{
				field("teams", ast.SelectionSet{
					&ast.FragmentSpread{Name: "teamFields"},
				}),
			}),
		},
	}

	fragments := ast.FragmentDefinitionList{
		&ast.FragmentDefinition{
			Name:          "teamFields",
			TypeCondition: "LeagueTeam",
			SelectionSet: ast.SelectionSet{
				field("id", nil),
				field("__typename", nil),
			},
		},
	}

	raw := jsontext.Value(`[{"id":"team-eng","__typename":"Team"}]`)
	native := map[string]any{"teams": raw}

	out := namespacedCustomizer().ForwardResult(native, op, fragments)

	league, ok := out["league"].(map[string]any)
	if !ok {
		t.Fatalf("result not re-wrapped under league: %#v", out)
	}

	teams, ok := league["teams"].([]any)
	if !ok || len(teams) == 0 {
		t.Fatalf("teams not decoded into a non-empty list: %#v", league["teams"])
	}

	first, ok := teams[0].(map[string]any)
	if !ok {
		t.Fatalf("team element not an object: %#v", teams[0])
	}

	if got := first["__typename"]; got != "LeagueTeam" {
		t.Errorf("__typename = %v, want LeagueTeam (remapped via fragment spread)", got)
	}
}
