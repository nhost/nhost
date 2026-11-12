package connector

import (
	"bytes"
	"context"
	"fmt"
	"log/slog"
	"reflect"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/customization"
	"github.com/nhost/nhost/services/constellation/connector/remoteschema"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/formatter"
	"github.com/vektah/gqlparser/v2/parser"
	"github.com/vektah/gqlparser/v2/validator/rules"
)

const namespaceRemoteSDL = `
 type Query { team(id: ID!): Team }
 type Mutation { reportGame(id: ID!): Team }
 type Team { id: ID! }
`

// validatingNamespaceRemote models the remote server's own field-conflict
// validation before any mutation side effect. A non-validating fake would
// silently accept a merged request and hide dropped operations.
type validatingNamespaceRemote struct {
	fakeConnector

	forwarded          *ast.OperationDefinition
	forwardedFragments ast.FragmentDefinitionList
	writes             int
}

func (f *validatingNamespaceRemote) Execute(
	_ context.Context, op *ast.OperationDefinition, fragments ast.FragmentDefinitionList,
	variables map[string]any, _ string, _ map[string]any, _ *slog.Logger,
) (map[string]any, error) {
	f.forwarded = op
	f.forwardedFragments = fragments

	schema, err := gqlparser.LoadSchema(&ast.Source{Input: namespaceRemoteSDL})
	if err != nil {
		return nil, fmt.Errorf("loading remote test schema: %w", err)
	}

	var output bytes.Buffer
	formatter.NewFormatter(&output).FormatQueryDocument(&ast.QueryDocument{
		Operations: ast.OperationList{op},
		Fragments:  fragments,
	})

	if _, validationErrors := gqlparser.LoadQueryWithRules(
		schema, output.String(), rules.NewDefaultRules(),
	); validationErrors != nil {
		return nil, remoteschema.NewGraphQLError([]remoteschema.RemoteError{{
			Message: validationErrors.Error(),
		}})
	}

	// Model remote field collection: compatible duplicate native fields resolve
	// once; fragment directives are evaluated by the remote, not the decorator.
	roots, err := remoteNamespaceRoots(op.SelectionSet, fragments, variables)
	if err != nil {
		return nil, err
	}

	result := make(map[string]any)
	for _, root := range roots {
		key := root.Name
		if root.Alias != "" {
			key = root.Alias
		}

		if _, seen := result[key]; seen {
			continue
		}

		if op.Operation == ast.Mutation {
			f.writes++
		}

		result[key] = map[string]any{"id": root.Arguments.ForName("id").Value.Raw}
	}

	return result, nil
}

func remoteNamespaceRoots(
	selections ast.SelectionSet, fragments ast.FragmentDefinitionList, variables map[string]any,
) ([]*ast.Field, error) {
	var roots []*ast.Field
	for _, selection := range selections {
		var directives ast.DirectiveList
		switch sel := selection.(type) {
		case *ast.Field:
			directives = sel.Directives
		case *ast.InlineFragment:
			directives = sel.Directives
		case *ast.FragmentSpread:
			directives = sel.Directives
		}

		include, err := remoteNamespaceIncludes(directives, variables)
		if err != nil {
			return nil, err
		}

		if !include {
			continue
		}

		switch sel := selection.(type) {
		case *ast.Field:
			roots = append(roots, sel)
		case *ast.InlineFragment:
			inner, err := remoteNamespaceRoots(sel.SelectionSet, fragments, variables)
			if err != nil {
				return nil, err
			}

			roots = append(roots, inner...)
		case *ast.FragmentSpread:
			inner, err := remoteNamespaceRoots(
				fragments.ForName(sel.Name).SelectionSet,
				fragments,
				variables,
			)
			if err != nil {
				return nil, err
			}

			roots = append(roots, inner...)
		}
	}

	return roots, nil
}

func remoteNamespaceIncludes(directives ast.DirectiveList, variables map[string]any) (bool, error) {
	include := true
	for _, directive := range directives {
		if directive.Name != "include" && directive.Name != "skip" {
			continue
		}

		condition, err := directive.Arguments.ForName("if").Value.Value(variables)
		if err != nil {
			return false, fmt.Errorf("evaluating remote directive: %w", err)
		}

		if directive.Name == "include" && condition != true ||
			directive.Name == "skip" && condition == true {
			include = false
		}
	}

	return include, nil
}

func remoteNamespaceSchema() *graph.Schema {
	query, mutation := "Query", "Mutation"

	return &graph.Schema{
		Types: []*graph.ObjectType{
			{Name: query, Fields: []*graph.Field{
				{Name: "team", Type: graph.NewNamedType("Team")},
			}},
			{Name: mutation, Fields: []*graph.Field{
				{Name: "reportGame", Type: graph.NewNamedType("Team")},
			}},
			{Name: "Team", Fields: []*graph.Field{
				{Name: "id", Type: graph.NewNonNullType("ID")},
			}},
		},
		QueryType:    &query,
		MutationType: &mutation,
	}
}

func TestRemoteNamespacePreservesWrapperFragments(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name       string
		document   string
		variables  map[string]any
		wantField  string
		wantType   string
		wantResult map[string]any
		wantWrites int
	}{
		{
			name:      "inline variable true",
			document:  `query Op($t: Boolean!) { league { ... @include(if: $t) { team(id: "first") { id } } } }`,
			variables: map[string]any{"t": true},
			wantField: "team",
			wantResult: map[string]any{"league": map[string]any{
				"team": map[string]any{"id": "first"},
			}},
		},
		{
			name:       "inline variable false",
			document:   `query Op($t: Boolean!) { league { ... @include(if: $t) { team(id: "first") { id } } } }`,
			variables:  map[string]any{"t": false},
			wantField:  "team",
			wantResult: map[string]any{"league": map[string]any{}},
		},
		{
			name:       "query wrapper spread",
			document:   `{ league { ...A } } fragment A on leagueQuery { team(id: "first") { id } }`,
			wantField:  "team",
			wantType:   "Query",
			wantResult: map[string]any{"league": map[string]any{"team": map[string]any{"id": "first"}}},
		},
		{
			name:       "mutation wrapper spread",
			document:   `mutation M { league { ...A } } fragment A on leagueMutation { reportGame(id: "first") { id } }`,
			wantField:  "reportGame",
			wantType:   "Mutation",
			wantResult: map[string]any{"league": map[string]any{"reportGame": map[string]any{"id": "first"}}},
			wantWrites: 1,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			inner := &validatingNamespaceRemote{schema: remoteNamespaceSchema()}

			conn, err := newCustomizedConnector("remote", inner, metadata.Customization{
				RootFieldsNamespace: "league",
			}, customization.FlavorRemoteSchema)
			if err != nil {
				t.Fatal(err)
			}

			query, err := parser.ParseQuery(&ast.Source{Input: tc.document})
			if err != nil {
				t.Fatalf("parsing client query: %v", err)
			}

			got, err := conn.Execute(t.Context(), query.Operations[0], query.Fragments,
				tc.variables, metadata.RoleAdmin, nil, slog.Default())
			if err != nil || !reflect.DeepEqual(got, tc.wantResult) {
				t.Fatalf("remote fragment: data=%#v error=%v want=%#v", got, err, tc.wantResult)
			}

			if tc.wantType == "" {
				assertRemoteInlineForwarded(t, inner, tc.wantField)
			} else {
				assertRemoteSpreadForwarded(t, inner, tc.wantField, tc.wantType)
			}

			if inner.writes != tc.wantWrites {
				t.Fatalf("remote writes = %d, want %d", inner.writes, tc.wantWrites)
			}
		})
	}
}

func assertRemoteInlineForwarded(t *testing.T, inner *validatingNamespaceRemote, wantField string) {
	t.Helper()

	if inner.forwarded == nil || len(inner.forwarded.SelectionSet) != 1 ||
		len(inner.forwarded.VariableDefinitions) != 1 ||
		inner.forwarded.VariableDefinitions[0].Variable != "t" {
		t.Fatalf("forwarded variable operation = %#v", inner.forwarded)
	}

	inline, ok := inner.forwarded.SelectionSet[0].(*ast.InlineFragment)
	if !ok || len(inline.Directives) != 1 || len(inline.SelectionSet) != 1 {
		t.Fatalf("forwarded inline fragment = %#v", inner.forwarded.SelectionSet[0])
	}

	assertRemoteWrapperField(t, inline.SelectionSet[0], wantField)
}

func assertRemoteSpreadForwarded(
	t *testing.T, inner *validatingNamespaceRemote, wantField, wantType string,
) {
	t.Helper()

	if inner.forwarded == nil || len(inner.forwarded.SelectionSet) != 1 ||
		len(inner.forwardedFragments) != 1 ||
		inner.forwardedFragments[0].TypeCondition != wantType {
		t.Fatalf("forwarded operation=%#v fragments=%#v, want native %s",
			inner.forwarded, inner.forwardedFragments, wantType)
	}

	spread, ok := inner.forwarded.SelectionSet[0].(*ast.FragmentSpread)
	if !ok || spread.Name != "A" {
		t.Fatalf("forwarded spread = %#v", inner.forwarded.SelectionSet[0])
	}

	assertRemoteWrapperField(t, inner.forwardedFragments[0].SelectionSet[0], wantField)
}

func assertRemoteWrapperField(t *testing.T, child ast.Selection, wantField string) {
	t.Helper()

	field, ok := child.(*ast.Field)
	if !ok || field.Name != wantField || field.Alias != wantField ||
		field.Arguments.ForName("id").Value.Raw != "first" {
		t.Fatalf("forwarded field = %#v, want %s(first)", child, wantField)
	}
}

func TestRemoteNamespaceWrapperSpreadsStillRejectConflictingAliases(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name     string
		document string
	}{
		{
			name: "query",
			document: `{ a: league { ...A } b: league { ...B } }
fragment A on leagueQuery { team(id: "first") { id } }
fragment B on leagueQuery { team(id: "second") { id } }`,
		},
		{
			name: "mutation",
			document: `mutation M { a: league { ...A } b: league { ...B } }
fragment A on leagueMutation { reportGame(id: "first") { id } }
fragment B on leagueMutation { reportGame(id: "second") { id } }`,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			inner := &validatingNamespaceRemote{schema: remoteNamespaceSchema()}

			conn, err := newCustomizedConnector("remote", inner, metadata.Customization{
				RootFieldsNamespace: "league",
			}, customization.FlavorRemoteSchema)
			if err != nil {
				t.Fatal(err)
			}

			query, err := parser.ParseQuery(&ast.Source{Input: tc.document})
			if err != nil {
				t.Fatalf("parsing client query: %v", err)
			}

			data, err := conn.Execute(t.Context(), query.Operations[0], query.Fragments,
				nil, metadata.RoleAdmin, nil, slog.Default())
			if data != nil || err == nil || !strings.Contains(err.Error(), "differing arguments") ||
				strings.Contains(err.Error(), "_constellation_ns_") {
				t.Fatalf("remote spread conflict must fail closed: data=%#v error=%v", data, err)
			}

			if inner.forwarded == nil || len(inner.forwarded.SelectionSet) != 2 ||
				len(inner.forwardedFragments) != 2 || inner.writes != 0 {
				t.Fatalf("forwarded roots=%#v fragments=%#v writes=%d, want two spreads, no writes",
					inner.forwarded, inner.forwardedFragments, inner.writes)
			}
		})
	}
}

func remoteNamespaceOperation(kind ast.Operation, first, second string) *ast.OperationDefinition {
	fieldName := "team"
	if kind == ast.Mutation {
		fieldName = "reportGame"
	}

	selections := make(ast.SelectionSet, 0, 2)
	for _, item := range []struct{ alias, id string }{{"a", first}, {"b", second}} {
		selections = append(selections, &ast.Field{
			Alias: item.alias, Name: "league", SelectionSet: ast.SelectionSet{&ast.Field{
				Name: fieldName,
				Arguments: ast.ArgumentList{&ast.Argument{Name: "id", Value: &ast.Value{
					Kind: ast.StringValue, Raw: item.id,
				}}},
				SelectionSet: ast.SelectionSet{&ast.Field{Name: "id"}},
			}},
		})
	}

	return &ast.OperationDefinition{Operation: kind, SelectionSet: selections}
}

func assertRemoteNamespaceFields(t *testing.T, forwarded *ast.OperationDefinition, ids ...string) {
	t.Helper()

	if forwarded == nil || len(forwarded.SelectionSet) != len(ids) {
		t.Fatalf("forwarded roots = %#v, want %d distinct roots", forwarded, len(ids))
	}

	for i, selection := range forwarded.SelectionSet {
		field, ok := selection.(*ast.Field)
		if !ok || field.Alias != "" || strings.HasPrefix(field.Name, "_constellation_ns_") ||
			len(field.Arguments) != 1 || field.Arguments[0].Value.Raw != ids[i] {
			t.Fatalf("forwarded root %d = %#v, want unaliased id %q", i, selection, ids[i])
		}
	}
}

func TestRemoteNamespaceDifferentArgumentsFailClosed(t *testing.T) {
	t.Parallel()

	for _, kind := range []ast.Operation{ast.Query, ast.Mutation} {
		t.Run(string(kind), func(t *testing.T) {
			t.Parallel()

			inner := &validatingNamespaceRemote{schema: teamSchema()}

			conn, err := newCustomizedConnector(
				"remote",
				inner,
				metadata.Customization{
					RootFieldsNamespace: "league",
				},
				customization.FlavorRemoteSchema,
			)
			if err != nil {
				t.Fatal(err)
			}

			data, err := conn.Execute(
				t.Context(),
				remoteNamespaceOperation(kind, "first", "second"),
				nil,
				nil,
				metadata.RoleAdmin,
				nil,
				slog.Default(),
			)
			assertRemoteNamespaceFields(t, inner.forwarded, "first", "second")

			if data != nil || err == nil || !strings.Contains(err.Error(), "differing arguments") ||
				strings.Contains(err.Error(), "_constellation_ns_") {
				t.Fatalf("remote conflict must fail closed: data=%#v error=%v", data, err)
			}

			if inner.writes != 0 {
				t.Fatalf("rejected mutation executed %d times", inner.writes)
			}
		})
	}
}

func TestRemoteNamespaceIdenticalChildrenKeepResult(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		kind ast.Operation
		name string
	}{
		{ast.Query, "team"}, {ast.Mutation, "reportGame"},
	} {
		t.Run(string(tc.kind), func(t *testing.T) {
			t.Parallel()

			inner := &validatingNamespaceRemote{schema: teamSchema()}

			conn, err := newCustomizedConnector(
				"remote",
				inner,
				metadata.Customization{
					RootFieldsNamespace: "league",
				},
				customization.FlavorRemoteSchema,
			)
			if err != nil {
				t.Fatal(err)
			}

			got, err := conn.Execute(
				t.Context(),
				remoteNamespaceOperation(tc.kind, "first", "first"),
				nil,
				nil,
				metadata.RoleAdmin,
				nil,
				slog.Default(),
			)
			assertRemoteNamespaceFields(t, inner.forwarded, "first", "first")

			want := map[string]any{
				"a": map[string]any{tc.name: map[string]any{"id": "first"}},
				"b": map[string]any{tc.name: map[string]any{"id": "first"}},
			}
			if err != nil || !reflect.DeepEqual(got, want) {
				t.Fatalf("identical remote children: data=%#v error=%v want=%#v", got, err, want)
			}

			writes := 0
			if tc.kind == ast.Mutation {
				writes = 1 // GraphQL collects identical native mutation fields once.
			}

			if inner.writes != writes {
				t.Fatalf("identical native mutation wrote %d times, want %d", inner.writes, writes)
			}
		})
	}
}
