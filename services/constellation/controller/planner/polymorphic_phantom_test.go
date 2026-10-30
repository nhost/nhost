package planner_test

import (
	"bytes"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/controller/planner"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/formatter"
	"github.com/vektah/gqlparser/v2/validator/rules"
)

const polymorphicNativeSDL = `
  type Query { search: [Result!]! }
  union Result = A | B
  type A { item: Left! }
  type B { item: Right! }
  type Left { id: Int!, join_id: Int! }
  type Right { id: Int! }
`

const abstractPolymorphicNativeSDL = `
  type Query { search: [Result!]!, items: [Direct!]! }
  union Result = A | B
  union Direct = Left | Right
  type A { item: Node! }
  type B { item: Right! }
  interface Node { id: Int! }
  type Left implements Node { id: Int!, join_id: Int! }
  type Right implements Node { id: Int! }
`

// validatePolymorphicRemote stands in for a validating native endpoint: it
// rejects the entire forwarded document before producing even an A-only result.
func validatePolymorphicRemote(
	t *testing.T,
	schema *ast.Schema,
	query, root string,
) map[string]any {
	t.Helper()

	if _, errs := gqlparser.LoadQueryWithRules(
		schema,
		query,
		rules.NewDefaultRules(),
	); errs != nil {
		t.Fatalf("native remote rejected forwarded operation: %v\n%s", errs, query)
	}

	return map[string]any{root: []any{map[string]any{
		"__typename": "A", "item": map[string]any{"id": 1, "join_id": 2},
	}}}
}

func newPolymorphicPlan(
	t *testing.T, nativeSDL string,
) (*planner.QueryPlanner, *ast.Schema, *ast.Schema) {
	t.Helper()

	native, err := gqlparser.LoadSchema(&ast.Source{Input: nativeSDL})
	if err != nil {
		t.Fatal(err)
	}

	composed, err := gqlparser.LoadSchema(&ast.Source{Input: strings.Replace(
		nativeSDL, "{ id: Int!, join_id: Int! }",
		"{ id: Int!, join_id: Int!, local: Target } type Target { id: Int! }", 1,
	)})
	if err != nil {
		t.Fatal(err)
	}

	p := planner.New(
		map[string]*ast.Schema{"admin": composed},
		map[string]string{
			schemamerge.FieldKey(ast.Query, "search"): "remote",
			schemamerge.FieldKey(ast.Query, "items"):  "remote",
		},
		map[string][]string{
			"Result": {"remote"}, "Direct": {"remote"}, "A": {"remote"}, "Node": {"remote"},
			"B": {"remote"}, "Left": {"remote"}, "Right": {"remote"}, "Target": {"db"},
		},
		map[string][]*planner.RelationshipMetadata{"remote": {{
			Name: "local", SourceType: "Left", TargetConnector: "db",
			TargetTable: "target", TargetTableSchema: "public",
			JoinMapping: map[string]string{"join_id": "id"}, IsRemote: true,
		}}},
	)

	return p, composed, native
}

func TestPlanPolymorphicPhantomsStayOnSourceType(t *testing.T) {
	t.Parallel()

	p, composed, native := newPolymorphicPlan(t, strings.Replace(
		polymorphicNativeSDL,
		"type Right { id: Int! }",
		"type Right { id: Int!, join_id: Int! }",
		1,
	))

	tests := []struct {
		name  string
		query string
	}{
		{
			name: "inline fragments with duplicate compatible source selections",
			query: `query { search {
				... on A { item { id local { id } } }
				... on A { item { id } }
				... on B { item { id } }
			} }`,
		},
		{
			name: "disjoint selected join key reserves alias but cannot satisfy source phantom",
			query: `query { search {
				... on A { item { id local { id } } }
				... on B { item { join_id } }
			} }`,
		},
		{
			name: "unrelated response key remains visible",
			query: `query { search {
				... on A { item { id local { id } } }
				... on B { item { join_id: id } }
			} }`,
		},
		{
			name: "named fragments preserve shared definitions",
			query: `query { search { ...AFields ...BFields } }
				fragment AFields on A { item { id local { id } } }
				fragment BFields on B { item { id } }`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			checkPolymorphicPlan(t, p, composed, native, tt.query)
		})
	}
}

func TestPlanRelationshipOnlySiblingKeepsExplicitJoinKey(t *testing.T) {
	t.Parallel()

	p, composed, native := newPolymorphicPlan(t, polymorphicNativeSDL)
	tests := []struct {
		name  string
		query string
	}{
		{
			name:  "duplicate field",
			query: `query { search { ... on A { item { local { id } } item { join_id } } } }`,
		},
		{
			name: "inline siblings",
			query: `query { search { ... on A { item {
				... on Left { local { id } }
			} item { ... on Left { join_id } } } } }`,
		},
		{
			name: "colocated named fragments",
			query: `query { search { ...AJoin ...AKey } }
				fragment AJoin on A { item { local { id } } }
				fragment AKey on A { item { join_id } }`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			doc, errs := gqlparser.LoadQueryWithRules(composed, tt.query, rules.NewDefaultRules())
			if errs != nil {
				t.Fatalf("composed query invalid: %v", errs)
			}

			plan, err := p.Plan(doc.Operations[0], doc.Fragments, "admin", nil)
			if err != nil {
				t.Fatal(err)
			}

			primary := plan.GetPrimaryQueryForConnector("remote")
			if primary == nil || len(primary.PhantomFields) != 1 {
				t.Fatalf("expected one phantom spec: %#v", primary)
			}

			spec := primary.PhantomFields[0]
			if len(spec.Fields) != 1 || spec.Fields[0] != "join_id" ||
				spec.Aliases["join_id"] == "" {
				t.Fatalf("expected an internal alias for the missing occurrence: %#v", spec)
			}

			if spec.Aliases["join_id"] == "join_id" {
				t.Fatalf("cleanup would remove the user's explicit join_id: %#v", spec)
			}

			forwarded := &ast.QueryDocument{
				Operations: ast.OperationList{primary.CleanOperation},
				Fragments:  pruneUnusedPolymorphicFragments(primary),
			}

			var buf bytes.Buffer
			formatter.NewFormatter(&buf).FormatQueryDocument(forwarded)

			if !strings.Contains(buf.String(), "\tjoin_id\n") {
				t.Fatalf("explicit join_id missing from forwarded document: %s", buf.String())
			}

			validatePolymorphicRemote(t, native, buf.String(), "search")
		})
	}
}

func TestPlanAbstractPolymorphicPhantomsSurviveRelationshipOnlyFragments(t *testing.T) {
	t.Parallel()

	p, composed, native := newPolymorphicPlan(t, abstractPolymorphicNativeSDL)
	tests := []struct {
		name  string
		query string
	}{
		{
			name: "inline relationship-only source fragment",
			query: `query { search {
				... on A { item { ... on Left { local { id } } ... on Right { id } } }
				... on B { item { id } }
			} }`,
		},
		{
			name: "named relationship-only source fragment",
			query: `query { search {
				... on A { item { ...LeftRel ... on Right { id } } }
				... on B { item { id } }
			} }
			fragment LeftRel on Left { local { id } }`,
		},
		{
			name: "nested named wrapper with relationship-only fragment",
			query: `query { search { ...AFields ... on B { item { id } } } }
			fragment AFields on A { item { ...LeftRel ... on Right { id } } }
			fragment LeftRel on Left { local { id } }`,
		},
		{
			name: "union field with inline relationship-only fragment",
			query: `query { items {
				... on Left { local { id } }
				... on Right { id }
			} }`,
		},
		{
			name: "union field with named relationship-only fragment",
			query: `query { items { ...LeftRel ... on Right { id } } }
			fragment LeftRel on Left { local { id } }`,
		},
		{
			name: "source fragment also selects an ordinary field",
			query: `query { search {
				... on A { item { ... on Left { id local { id } } ... on Right { id } } }
				... on B { item { id } }
			} }`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			checkPolymorphicPlan(t, p, composed, native, tt.query)
		})
	}
}

func checkPolymorphicPlan(
	t *testing.T, p *planner.QueryPlanner, composed, native *ast.Schema, query string,
) {
	t.Helper()

	doc, errs := gqlparser.LoadQueryWithRules(composed, query, rules.NewDefaultRules())
	if errs != nil {
		t.Fatalf("composed query invalid: %v", errs)
	}

	plan, err := p.Plan(doc.Operations[0], doc.Fragments, "admin", nil)
	if err != nil {
		t.Fatal(err)
	}

	primary := plan.GetPrimaryQueryForConnector("remote")
	if primary == nil || len(primary.PhantomFields) != 1 ||
		primary.PhantomFields[0].SourceType != "Left" {
		t.Fatalf("expected one Left phantom, got %#v", primary)
	}

	if (strings.Contains(query, "join_id: id") || strings.Contains(query, "on B { item { join_id } }")) &&
		primary.PhantomFields[0].Aliases["join_id"] == "" {
		t.Fatalf("B's join_id response key must not be removed during phantom cleanup: %#v",
			primary.PhantomFields[0])
	}

	if len(plan.RemoteQueries) != 1 || plan.RemoteQueries[0].SourceType != "Left" {
		t.Fatalf("expected one Left relationship, got %#v", plan.RemoteQueries)
	}

	assertPolymorphicNativeDocument(t, primary, doc, native)
}

func assertPolymorphicNativeDocument(
	t *testing.T, primary *planner.PrimaryQuery, doc *ast.QueryDocument, native *ast.Schema,
) {
	t.Helper()

	// Formatting the complete forwarded document (not just the operation)
	// catches invalid fields inside either copied or original fragments.
	forwarded := &ast.QueryDocument{
		Operations: ast.OperationList{primary.CleanOperation},
		Fragments:  pruneUnusedPolymorphicFragments(primary),
	}

	var buf bytes.Buffer
	formatter.NewFormatter(&buf).FormatQueryDocument(forwarded)

	if !strings.Contains(buf.String(), "join_id\n") &&
		!strings.Contains(buf.String(), "join_id: join_id\n") {
		t.Fatalf("Left's join key was not selected: %s", buf.String())
	}

	if native.Types["Node"] != nil && !strings.Contains(buf.String(), "on Left") {
		t.Fatalf("abstract source lacks a type-scoped join key: %s", buf.String())
	}

	rootField, ok := primary.CleanOperation.SelectionSet[0].(*ast.Field)
	if !ok {
		t.Fatalf("expected root field, got %T", primary.CleanOperation.SelectionSet[0])
	}

	result := validatePolymorphicRemote(t, native, buf.String(), rootField.Name)

	rows, ok := result[rootField.Name].([]any)
	if !ok || len(rows) != 1 {
		t.Fatalf("A-only remote response lost: %v", result)
	}

	if strings.Contains(buf.String(), "on B {\n\t\t\titem {\n\t\t\t\tid\n\t\t\t\tjoin_id") {
		t.Fatalf("unrelated type received join field: %s", buf.String())
	}

	if len(doc.Fragments) != 0 {
		var original bytes.Buffer
		formatter.NewFormatter(&original).FormatQueryDocument(&ast.QueryDocument{
			Operations: doc.Operations, Fragments: doc.Fragments,
		})

		if !strings.Contains(original.String(), "local") ||
			strings.Contains(original.String(), "join_id") {
			t.Fatalf("shared input definitions were mutated: %s", original.String())
		}
	}
}

// The controller prunes definitions made unused by path-local expansion before
// passing the operation to the native connector.
func pruneUnusedPolymorphicFragments(primary *planner.PrimaryQuery) ast.FragmentDefinitionList {
	usedNames := make(map[string]struct{})

	var markUsed func(ast.SelectionSet)

	markUsed = func(selections ast.SelectionSet) {
		for _, selection := range selections {
			switch s := selection.(type) {
			case *ast.Field:
				markUsed(s.SelectionSet)
			case *ast.InlineFragment:
				markUsed(s.SelectionSet)
			case *ast.FragmentSpread:
				if _, seen := usedNames[s.Name]; seen {
					continue
				}

				usedNames[s.Name] = struct{}{}
				if fragment := primary.CleanFragments.ForName(s.Name); fragment != nil {
					markUsed(fragment.SelectionSet)
				}
			}
		}
	}
	markUsed(primary.CleanOperation.SelectionSet)

	var usedFragments ast.FragmentDefinitionList
	for _, fragment := range primary.CleanFragments {
		if _, used := usedNames[fragment.Name]; used {
			usedFragments = append(usedFragments, fragment)
		}
	}

	return usedFragments
}
