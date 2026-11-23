package controller

import (
	"reflect"
	"sync"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/validator/rules"
)

func TestCoerceVariablesTypedInputs(t *testing.T) {
	t.Parallel()

	schema := gqlparser.MustLoadSchema(&ast.Source{Input: `
scalar JSON
input Filter { xs: [[String!]!]!, children: [Filter!], payload: JSON }
type Query { echo(input: Filter): Int }
`})
	document := gqlparser.MustLoadQueryWithRules(schema,
		`query($input:Filter){echo(input:$input)}`, rules.NewDefaultRules())
	matrix := [][]string{{"a"}}
	child := map[string]any{"xs": [][]string{{"b"}}}
	pointerInput := map[string]any{"xs": matrix, "children": []*map[string]any{&child}}

	tests := []struct {
		name  string
		input any
		want  string
	}{
		{
			"typed nested slices",
			map[string]any{"xs": matrix, "children": []map[string]any{child}},
			`{"input":{"xs":[["a"]],"children":[{"xs":[["b"]]}]}}`,
		},
		{
			"typed map requiring list coercion",
			map[string]string{"xs": "a"},
			`{"input":{"xs":[["a"]]}}`,
		},
		{
			"pointer input and pointer list elements",
			&pointerInput,
			`{"input":{"xs":[["a"]],"children":[{"xs":[["b"]]}]}}`,
		},
		{
			"typed map of list pointers",
			map[string]*[][]string{"xs": &matrix},
			`{"input":{"xs":[["a"]]}}`,
		},
		{
			"nil slice stays null",
			map[string]any{"xs": matrix, "children": []map[string]any(nil)},
			`{"input":{"xs":[["a"]],"children":null}}`,
		},
		{
			"opaque scalar in a typed input",
			map[string]any{"xs": matrix, "payload": map[string]any{"xs": "opaque"}},
			`{"input":{"xs":[["a"]],"payload":{"xs":"opaque"}}}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			variables := map[string]any{"input": tt.input}
			before := normalizedCoercionVariables(t, variables)
			want := decodeCoercionVariables(t, tt.want)

			var callers sync.WaitGroup
			for range 8 {
				callers.Go(func() {
					got, err := coerceVariables(schema, document.Operations[0], variables)
					if err != nil {
						t.Error(err)
						return
					}

					if diff := cmp.Diff(want, normalizedCoercionVariables(t, got)); diff != "" {
						t.Errorf("coercion (-want +got):\n%s", diff)
					}
				})
			}

			callers.Wait()

			if diff := cmp.Diff(before, normalizedCoercionVariables(t, variables)); diff != "" {
				t.Fatalf("shared inputs changed (-before +after):\n%s", diff)
			}
		})
	}
}

func TestCopyVariableInputOpaqueScalars(t *testing.T) {
	t.Parallel()

	schema := gqlparser.MustLoadSchema(&ast.Source{Input: `
scalar JSON
type Query { echo(input: JSON): Int }
`})
	payload := map[string]any{"xs": []string{"a"}}

	tests := []struct {
		name  string
		value any
	}{
		{"map", payload},
		{"slice", []string{"a"}},
		{"pointer", &payload},
		{"nil map", map[string]any(nil)},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			original := reflect.ValueOf(tt.value)

			copied := copyVariableInput(schema, ast.NamedType("JSON", nil), original)
			if copied != original {
				t.Fatal("custom scalar payload was traversed or copied")
			}
		})
	}
}
