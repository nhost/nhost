package controller

import (
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
)

// boolDirective builds a @skip/@include directive carrying a literal or
// variable `if` argument for the shouldInclude unit tests.
func boolDirective(name string, value *ast.Value) *ast.Directive {
	return &ast.Directive{
		Name: name,
		Arguments: ast.ArgumentList{
			{Name: "if", Value: value},
		},
	}
}

func litBool(raw string) *ast.Value {
	return &ast.Value{Kind: ast.BooleanValue, Raw: raw}
}

func varRef(name string) *ast.Value {
	return &ast.Value{Kind: ast.Variable, Raw: name}
}

func TestShouldInclude(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name       string
		directives ast.DirectiveList
		vars       map[string]any
		want       bool
	}{
		{name: "no directives", directives: nil, vars: nil, want: true},
		{
			name:       "skip literal true",
			directives: ast.DirectiveList{boolDirective("skip", litBool("true"))},
			want:       false,
		},
		{
			name:       "skip literal false",
			directives: ast.DirectiveList{boolDirective("skip", litBool("false"))},
			want:       true,
		},
		{
			name:       "include literal false",
			directives: ast.DirectiveList{boolDirective("include", litBool("false"))},
			want:       false,
		},
		{
			name:       "include literal true",
			directives: ast.DirectiveList{boolDirective("include", litBool("true"))},
			want:       true,
		},
		{
			name:       "skip variable true",
			directives: ast.DirectiveList{boolDirective("skip", varRef("s"))},
			vars:       map[string]any{"s": true},
			want:       false,
		},
		{
			name:       "include variable false",
			directives: ast.DirectiveList{boolDirective("include", varRef("i"))},
			vars:       map[string]any{"i": false},
			want:       false,
		},
		{
			name: "skip false but include false → excluded",
			directives: ast.DirectiveList{
				boolDirective("skip", litBool("false")),
				boolDirective("include", litBool("false")),
			},
			want: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := shouldInclude(tc.directives, tc.vars); got != tc.want {
				t.Errorf("shouldInclude = %v, want %v", got, tc.want)
			}
		})
	}
}

const wsTestSchemaSDL = `
type query_root { users: [User!]! posts: [Post!]! }
type User { id: ID! name: String }
type Post { id: ID! title: String }
schema { query: query_root }
`

func wsTestSchemas(t *testing.T) map[string]*ast.Schema {
	t.Helper()

	schema, err := gqlparser.LoadSchema(&ast.Source{Name: "ws_test", Input: wsTestSchemaSDL})
	if err != nil {
		t.Fatalf("LoadSchema: %v", err)
	}

	return map[string]*ast.Schema{"admin": schema}
}

// TestParseAndValidateQuery_OperationNameSelection is the WebSocket twin of the
// INCON_LOW_10 fix: a supplied-but-unmatched operationName in a multi-operation
// document is operation-not-found, while an omitted name with several operations
// is the ambiguous multiple-operations error.
func TestParseAndValidateQuery_OperationNameSelection(t *testing.T) {
	t.Parallel()

	schemas := wsTestSchemas(t)
	query := `query A { users { id } } query B { users { name } }`

	t.Run("unmatched name → not found", func(t *testing.T) {
		t.Parallel()

		_, _, _, err := parseAndValidateQuery(schemas, newQueryCache(), query, "C", nil, "admin")
		if err == nil ||
			!strings.Contains(err.Error(), "no such operation found in the document") {
			t.Fatalf("expected Hasura not-found message, got %v", err)
		}
	})

	t.Run("no name with multiple ops → multiple operations", func(t *testing.T) {
		t.Parallel()

		_, _, _, err := parseAndValidateQuery(schemas, newQueryCache(), query, "", nil, "admin")
		if err == nil ||
			!strings.Contains(err.Error(), "exactly one operation has to be present") {
			t.Fatalf("expected Hasura ambiguous-operation message, got %v", err)
		}
	})

	t.Run("matched name selects operation", func(t *testing.T) {
		t.Parallel()

		op, _, _, err := parseAndValidateQuery(schemas, newQueryCache(), query, "B", nil, "admin")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if op == nil || op.Name != "B" {
			t.Fatalf("expected operation B, got %+v", op)
		}
	})
}

// TestParseAndValidateQuery_NormalizesRootSelections confirms the subscription
// path expands a root-level fragment spread into plain fields and evaluates
// @skip on a root field, mirroring the HTTP path.
func TestParseAndValidateQuery_NormalizesRootSelections(t *testing.T) {
	t.Parallel()

	schemas := wsTestSchemas(t)

	t.Run("root fragment spread is flattened", func(t *testing.T) {
		t.Parallel()

		query := `query { ...Roots } fragment Roots on query_root { users { id } }`

		op, _, _, err := parseAndValidateQuery(schemas, newQueryCache(), query, "", nil, "admin")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if len(op.SelectionSet) != 1 {
			t.Fatalf("expected 1 flattened root field, got %d", len(op.SelectionSet))
		}

		field, ok := op.SelectionSet[0].(*ast.Field)
		if !ok || field.Name != "users" {
			t.Fatalf("expected root *ast.Field 'users', got %#v", op.SelectionSet[0])
		}
	})

	t.Run("root @skip(if:true) drops the field", func(t *testing.T) {
		t.Parallel()

		query := `query { users @skip(if: true) { id } posts { id } }`

		op, _, _, err := parseAndValidateQuery(schemas, newQueryCache(), query, "", nil, "admin")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		for _, sel := range op.SelectionSet {
			if field, ok := sel.(*ast.Field); ok && field.Name == "users" {
				t.Fatalf("expected 'users' to be skipped, but it is present")
			}
		}
	})
}

func TestParseAndValidateQuery_MergesRootFragmentFieldsByResponseName(t *testing.T) {
	t.Parallel()

	schemas := wsTestSchemas(t)
	query := `query {
		...UserIDs
		...UserNames
	}
	fragment UserIDs on query_root { users { id } }
	fragment UserNames on query_root { users { name } }`

	op, _, _, err := parseAndValidateQuery(schemas, newQueryCache(), query, "", nil, "admin")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(op.SelectionSet) != 1 {
		t.Fatalf("expected 1 merged root field, got %d", len(op.SelectionSet))
	}

	field, ok := op.SelectionSet[0].(*ast.Field)
	if !ok || field.Name != "users" {
		t.Fatalf("expected merged root *ast.Field 'users', got %#v", op.SelectionSet[0])
	}

	gotSubfields := make([]string, 0, len(field.SelectionSet))
	for _, selection := range field.SelectionSet {
		subfield, ok := selection.(*ast.Field)
		if !ok {
			t.Fatalf("expected merged sub-selection to be *ast.Field, got %#v", selection)
		}

		gotSubfields = append(gotSubfields, responseFieldName(subfield))
	}

	wantSubfields := []string{"id", "name"}
	if strings.Join(gotSubfields, ",") != strings.Join(wantSubfields, ",") {
		t.Fatalf("merged subfields = %v, want %v", gotSubfields, wantSubfields)
	}
}
