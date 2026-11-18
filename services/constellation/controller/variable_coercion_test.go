package controller_test

import (
	"encoding/json"
	"sync"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/validator"
	"github.com/vektah/gqlparser/v2/validator/rules"
)

// Exercise the dependency boundary shared by HTTP, WebSocket and direct SQL callers.
func TestRecursiveVariableCoercion(t *testing.T) {
	t.Parallel()

	schema, err := gqlparser.LoadSchema(&ast.Source{Input: `
scalar JSON
input Filter { xs: [[String!]!]!, children: [Filter!], payload: JSON }
type Query { echo(xs: [[String!]!], nullable: [[String]], input: Filter, payload: JSON): Int }
`})
	if err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name, query, variables, want string
	}{
		{
			"explicit",
			`query($xs:[[String!]!]!){echo(xs:$xs)}`,
			`{"xs":[["a"],["b"]]}`,
			`{"xs":[["a"],["b"]]}`,
		},
		{
			"flat",
			`query($xs:[[String!]!]!){echo(xs:$xs)}`,
			`{"xs":["a","b"]}`,
			`{"xs":[["a"],["b"]]}`,
		},
		{
			"scalar",
			`query($xs:[[String!]!]!){echo(xs:$xs)}`,
			`{"xs":"{a,b}"}`,
			`{"xs":[["{a,b}"]]}`,
		},
		{
			"mixed",
			`query($xs:[[String!]!]!){echo(xs:$xs)}`,
			`{"xs":["a",["b","c"],[]]}`,
			`{"xs":[["a"],["b","c"],[]]}`,
		},
		{"scalar default", `query($xs:[[String!]!]!="a"){echo(xs:$xs)}`, `{}`, `{"xs":[["a"]]}`},
		{
			"flat default",
			`query($xs:[[String!]!]!=["a","b"]){echo(xs:$xs)}`,
			`{}`,
			`{"xs":[["a"],["b"]]}`,
		},
		{
			"null overrides default",
			`query($xs:[[String!]!]=["a"]){echo(xs:$xs)}`,
			`{"xs":null}`,
			`{"xs":null}`,
		},
		{"omitted", `query($xs:[[String!]!]){echo(xs:$xs)}`, `{}`, `{}`},
		{"null default", `query($xs:[[String!]!]=null){echo(xs:$xs)}`, `{}`, `{"xs":null}`},
		{
			"object and child list",
			`query($input:Filter){echo(input:$input)}`,
			`{"input":{"xs":["a"],"children":{"xs":"b"}}}`,
			`{"input":{"xs":[["a"]],"children":[{"xs":[["b"]]}]}}`,
		},
		{
			"object default",
			`query($input:Filter={xs:["a"],children:{xs:"b"}}){echo(input:$input)}`,
			`{}`,
			`{"input":{"xs":[["a"]],"children":[{"xs":[["b"]]}]}}`,
		},
		{
			"opaque scalar",
			`query($payload:JSON){echo(payload:$payload)}`,
			`{"payload":{"xs":["a",null,{"nested":true}]}}`,
			`{"payload":{"xs":["a",null,{"nested":true}]}}`,
		},
		{
			"opaque scalar in object",
			`query($input:Filter){echo(input:$input)}`,
			`{"input":{"xs":"a","payload":["b",{"xs":"c"}]}}`,
			`{"input":{"xs":[["a"]],"payload":["b",{"xs":"c"}]}}`,
		},
		{
			"nullable inner lists",
			`query($xs:[[String]]){echo(nullable:$xs)}`,
			`{"xs":[null,[null],"a"]}`,
			`{"xs":[null,[null],["a"]]}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			document, errs := gqlparser.LoadQueryWithRules(
				schema,
				tt.query,
				rules.NewDefaultRules(),
			)
			if len(errs) != 0 {
				t.Fatal(errs)
			}

			variables := decodeCoercionVariables(t, tt.variables)
			before := decodeCoercionVariables(t, tt.variables)
			want := decodeCoercionVariables(t, tt.want)

			coerced, err := validator.VariableValues(schema, document.Operations[0], variables)
			if err != nil {
				t.Fatal(err)
			}

			if diff := cmp.Diff(want, coerced); diff != "" {
				t.Fatalf("coercion (-want +got):\n%s", diff)
			}

			if diff := cmp.Diff(before, variables); diff != "" {
				t.Fatalf("coercion mutated caller input (-before +after):\n%s", diff)
			}
		})
	}
}

func decodeCoercionVariables(t *testing.T, raw string) map[string]any {
	t.Helper()

	var variables map[string]any
	if err := json.Unmarshal([]byte(raw), &variables); err != nil {
		t.Fatal(err)
	}

	return variables
}

func TestRecursiveVariableCoercionRequiredInputs(t *testing.T) {
	t.Parallel()

	schema := gqlparser.MustLoadSchema(&ast.Source{Input: `
input Filter { xs: [[String!]!]! }
type Query { echo(xs: [[String!]!]!, input: Filter): Int }
`})

	tests := []struct {
		name, query, variables string
	}{
		{"missing", `query($xs:[[String!]!]!){echo(xs:$xs)}`, `{}`},
		{"null operand", `query($xs:[[String!]!]!){echo(xs:$xs)}`, `{"xs":null}`},
		{"null candidate", `query($xs:[[String!]!]!){echo(xs:$xs)}`, `{"xs":[null]}`},
		{"null element", `query($xs:[[String!]!]!){echo(xs:$xs)}`, `{"xs":[[null]]}`},
		{"wrong scalar", `query($xs:[[String!]!]!){echo(xs:$xs)}`, `{"xs":[1]}`},
		{"missing object field", `query($input:Filter){echo(xs:[],input:$input)}`, `{"input":{}}`},
		{
			"null object field",
			`query($input:Filter){echo(xs:[],input:$input)}`,
			`{"input":{"xs":null}}`,
		},
		{
			"unknown object field",
			`query($input:Filter){echo(xs:[],input:$input)}`,
			`{"input":{"xs":"a","unknown":true}}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			document, errs := gqlparser.LoadQueryWithRules(
				schema,
				tt.query,
				rules.NewDefaultRules(),
			)
			if len(errs) != 0 {
				t.Fatal(errs)
			}

			if _, err := validator.VariableValues(
				schema,
				document.Operations[0],
				decodeCoercionVariables(t, tt.variables),
			); err == nil {
				t.Fatal("expected variable validation error")
			}
		})
	}
}

func TestRecursiveVariableCoercionConcurrentReuse(t *testing.T) {
	t.Parallel()

	schema := gqlparser.MustLoadSchema(&ast.Source{Input: `
input Filter { xs: [[String!]!]!, children: [Filter!] }
type Query { echo(input: Filter): Int }
`})

	document, errs := gqlparser.LoadQueryWithRules(schema,
		`query($input:Filter={xs:["default"],children:{xs:"child"}}){echo(input:$input)}`,
		rules.NewDefaultRules())
	if len(errs) != 0 {
		t.Fatal(errs)
	}

	variables := decodeCoercionVariables(t, `{"input":{"xs":["{a,b}"],"children":{"xs":"child"}}}`)
	before := decodeCoercionVariables(t, `{"input":{"xs":["{a,b}"],"children":{"xs":"child"}}}`)
	want := decodeCoercionVariables(
		t,
		`{"input":{"xs":[["{a,b}"]],"children":[{"xs":[["child"]]}]}}`,
	)
	wantDefault := decodeCoercionVariables(
		t,
		`{"input":{"xs":[["default"]],"children":[{"xs":[["child"]]}]}}`,
	)

	var requests sync.WaitGroup
	for range 16 {
		requests.Go(func() {
			for _, input := range []map[string]any{variables, nil} {
				got, err := validator.VariableValues(schema, document.Operations[0], input)
				if err != nil {
					t.Error(err)
					return
				}

				expected := want
				if input == nil {
					expected = wantDefault
				}

				if diff := cmp.Diff(expected, got); diff != "" {
					t.Errorf("coercion (-want +got):\n%s", diff)
				}
			}
		})
	}

	requests.Wait()

	if diff := cmp.Diff(before, variables); diff != "" {
		t.Fatalf("shared inputs changed (-before +after):\n%s", diff)
	}
}
