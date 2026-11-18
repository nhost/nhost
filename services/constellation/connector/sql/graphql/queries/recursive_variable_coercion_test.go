package queries_test

import (
	"encoding/json"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/validator"
	"github.com/vektah/gqlparser/v2/validator/rules"
)

func TestGeneratedSchemaRecursiveVariableCoercion(t *testing.T) {
	t.Parallel()

	roots, schema := arrayMembershipRoots(t)

	tests := []struct {
		name, definitions, where, variables, want string
	}{
		{
			"explicit",
			`($xs:[[String!]!]!)`,
			`{tags:{_in:$xs}}`,
			`{"xs":[["a"],["b"]]}`,
			`{"xs":[["a"],["b"]]}`,
		},
		{
			"flat",
			`($xs:[[String!]!]!)`,
			`{tags:{_in:$xs}}`,
			`{"xs":["a","b"]}`,
			`{"xs":[["a"],["b"]]}`,
		},
		{"scalar", `($xs:[[String!]!]!)`, `{tags:{_in:$xs}}`, `{"xs":"a"}`, `{"xs":[["a"]]}`},
		{
			"default",
			`($xs:[[String!]!]!=["a","b"])`,
			`{tags:{_in:$xs}}`,
			`{}`,
			`{"xs":[["a"],["b"]]}`,
		},
		{
			"comparison object",
			`($cmp:String_array_comparison_exp!)`,
			`{tags:$cmp}`,
			`{"cmp":{"_in":["a","b"]}}`,
			`{"cmp":{"_in":[["a"],["b"]]}}`,
		},
		{
			"whole filter",
			`($w:items_bool_exp!)`,
			`$w`,
			`{"w":{"tags":{"_in":"{a,b}"}}}`,
			`{"w":{"tags":{"_in":[["{a,b}"]]}}}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			doc, errs := gqlparser.LoadQueryWithRules(schema,
				"query"+tt.definitions+"{items(where:"+tt.where+"){id}}", rules.NewDefaultRules())
			if len(errs) != 0 {
				t.Fatal(errs)
			}

			var input, want map[string]any
			if err := json.Unmarshal([]byte(tt.variables), &input); err != nil {
				t.Fatal(err)
			}

			if err := json.Unmarshal([]byte(tt.want), &want); err != nil {
				t.Fatal(err)
			}

			got, err := validator.VariableValues(schema, doc.Operations[0], input)
			if err != nil {
				t.Fatal(err)
			}

			if diff := cmp.Diff(want, got); diff != "" {
				t.Fatalf("request-local variables (-want +got):\n%s", diff)
			}

			actual, err := roots.BuildQuery(doc.Operations[0], doc.Fragments, got, "admin", nil)
			if err != nil {
				t.Fatal(err)
			}

			explicit, err := roots.BuildQuery(doc.Operations[0], doc.Fragments, want, "admin", nil)
			if err != nil {
				t.Fatal(err)
			}

			if diff := cmp.Diff(explicit, actual); diff != "" {
				t.Fatalf("operations and typed parameters (-explicit +coerced):\n%s", diff)
			}
		})
	}
}
