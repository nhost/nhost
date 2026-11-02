package transform_test

import (
	"bytes"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/controller/planner/transform"
	"github.com/nhost/nhost/services/constellation/internal/jsonpath"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/formatter"
	"github.com/vektah/gqlparser/v2/validator/rules"
)

const phantomNativeSDL = `
 type Query { search: [Result!]!, items: [Direct!]! }
 union Result = A | B
 union Direct = Left | Right
 type A { item: Node! }
 type B { item: Right! }
 interface Node { id: Int! }
 type Left implements Node { id: Int!, join_id: Int! }
 type Right implements Node { id: Int! }
`

func phantomSchema(t *testing.T, sdl string) *ast.Schema {
	t.Helper()

	schema, err := gqlparser.LoadSchema(&ast.Source{Input: sdl})
	if err != nil {
		t.Fatal(err)
	}

	return schema
}

func phantomDocument(t *testing.T, schema *ast.Schema, query string) *ast.QueryDocument {
	t.Helper()

	doc, errs := gqlparser.LoadQueryWithRules(schema, query, rules.NewDefaultRules())
	if errs != nil {
		t.Fatal(errs)
	}

	return doc
}

func formatPhantomDocument(doc *ast.QueryDocument) string {
	var buf bytes.Buffer
	formatter.NewFormatter(&buf).FormatQueryDocument(doc)

	return buf.String()
}

func TestInjectTypedPhantomsAcrossPolymorphicPaths(t *testing.T) {
	t.Parallel()
	schema := phantomSchema(t, phantomNativeSDL)

	tests := []struct {
		name, query string
		path        jsonpath.Path
		want        string
		unmodified  string
	}{
		{
			name: "union siblings share a response path",
			query: `query { search {
				... on A { item { ... on Left { id } ... on Right { id } } }
				... on B { item { id } }
			} }`,
			path: jsonpath.Path{"search", "item"},
			want: "... on Left {\n\t\t\t\t\tjoin_id",
		},
		{
			name:  "abstract terminal restores source type selection",
			query: `query { items { ... on Right { id } } }`,
			path:  jsonpath.Path{"items"},
			want:  "... on Left {\n\t\t\tjoin_id",
		},
		{
			name: "named source fragment is copied at one use site",
			query: `query { first: search { ...AFields ...BFields }
				second: search { ...AFields ...BFields } }
				fragment AFields on A { item { ... on Left { id } ... on Right { id } } }
				fragment BFields on B { item { id } }`,
			path:       jsonpath.Path{"first", "item"},
			want:       "join_id",
			unmodified: "AFields",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			doc := phantomDocument(t, schema, tt.query)
			before := formatPhantomDocument(doc)
			originalFragments := formatPhantomDocument(&ast.QueryDocument{Fragments: doc.Fragments})
			transform.InjectPhantomFields(doc.Operations[0], []transform.PhantomSpec{{
				Path: tt.path, SourceType: "Left", Fields: []string{"join_id"},
			}}, schema, doc.Fragments)

			forwarded := formatPhantomDocument(doc)
			if !strings.Contains(forwarded, tt.want) || strings.Count(forwarded, "join_id") != 1 {
				t.Fatalf("expected one Left-only join key: %s", forwarded)
			}

			if _, errs := gqlparser.LoadQueryWithRules(
				schema,
				forwarded,
				rules.NewDefaultRules(),
			); errs != nil {
				t.Fatalf("forwarded document invalid: %v\n%s", errs, forwarded)
			}

			if tt.unmodified != "" {
				updated := formatPhantomDocument(&ast.QueryDocument{Fragments: doc.Fragments})
				if originalFragments != updated || !strings.Contains(before, tt.unmodified) ||
					strings.Contains(updated, "join_id") {
					t.Fatalf("shared definition changed: %s", updated)
				}
			}
		})
	}
}

func TestTransformPrunesTransitiveRelationshipOnlyFragments(t *testing.T) {
	t.Parallel()
	composed := phantomSchema(t, strings.Replace(
		phantomNativeSDL, "join_id: Int! }", "join_id: Int!, local: Right }", 1,
	))

	tests := []struct {
		name, query string
		absent      []string
		remaining   string
	}{
		{
			name: "inline fragment emptied inside a definition",
			query: `query { search { ...AFields ... on B { item { id } } } }
				fragment AFields on A { item { ... on Left { local { id } } ... on Right { id } } }`,
			absent: []string{"local", "... on Left"}, remaining: "... on Right",
		},
		{
			name: "wrapper listed before relationship-only nested definition",
			query: `query { items { ...Wrapper ... on Right { id } } }
				fragment Wrapper on Left { ...Rel }
				fragment Rel on Left { local { id } }`,
			absent: []string{"Wrapper", "Rel", "local"}, remaining: "... on Right",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			doc := phantomDocument(t, composed, tt.query)
			result := transform.NewTransformer(composed, []transform.RemoteRelationship{{
				SourceType: "Left", Name: "local",
			}}, "remote", nil).Transform(doc.Operations[0], doc.Fragments)

			clean := formatPhantomDocument(&ast.QueryDocument{
				Operations: ast.OperationList{
					result.CleanOperation,
				},
				Fragments: result.CleanFragments,
			})
			if !strings.Contains(clean, tt.remaining) {
				t.Fatalf("lost remaining selection: %s", clean)
			}

			for _, absent := range tt.absent {
				if strings.Contains(clean, absent) {
					t.Fatalf("relationship-only selection %q survived: %s", absent, clean)
				}
			}
		})
	}
}
