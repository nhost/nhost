package queries_test

import (
	"reflect"
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
)

func TestComputedNestedVariableNullIsBound(t *testing.T) {
	t.Parallel()
	//nolint:dogsled // Only the roots and isolated pool are needed here.
	roots, pool, _, _, _ := computedTestFixture(t)

	tests := []struct {
		name, argument, query string
		variables             map[string]any
		want                  any
	}{
		{
			name:     "optional literal null",
			argument: "item_score",
			query:    `query { cf_select_items(where:{id:{_eq:1}}) { value:item_score(args:{multiplier:null}) } }`,
			want:     []any{map[string]any{"value": nil}},
		},
		{
			name:     "optional unset variable",
			argument: "item_score",
			query:    `query($m:Int){ cf_select_items(where:{id:{_eq:1}}) { value:item_score(args:{multiplier:$m}) } }`,
			want:     []any{map[string]any{"value": nil}},
		},
		{
			name:      "optional null variable",
			argument:  "item_score",
			query:     `query($m:Int){ cf_select_items(where:{id:{_eq:1}}) { value:item_score(args:{multiplier:$m}) } }`,
			variables: map[string]any{"m": nil},
			want:      []any{map[string]any{"value": nil}},
		},
		{
			name:     "optional omitted uses SQL default",
			argument: "item_score",
			query:    `query { cf_select_items(where:{id:{_eq:1}}) { value:item_score(args:{}) } }`,
			want:     []any{map[string]any{"value": float64(12.5)}},
		},
		{
			name:     "required literal null",
			argument: "item_second",
			query:    `query { cf_select_items(where:{id:{_eq:1}}) { value:item_second(args:{multiplier:null}) } }`,
			want:     []any{map[string]any{"value": nil}},
		},
		{
			name:     "required unset variable",
			argument: "item_second",
			query:    `query($m:Int){ cf_select_items(where:{id:{_eq:1}}) { value:item_second(args:{multiplier:$m}) } }`,
			want:     []any{map[string]any{"value": nil}},
		},
		{
			name:      "required null variable",
			argument:  "item_second",
			query:     `query($m:Int){ cf_select_items(where:{id:{_eq:1}}) { value:item_second(args:{multiplier:$m}) } }`,
			variables: map[string]any{"m": nil},
			want:      []any{map[string]any{"value": nil}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			doc, err := parser.ParseQuery(&ast.Source{Input: tt.query})
			if err != nil {
				t.Fatal(err)
			}

			ops, err := roots.BuildQuery(
				doc.Operations[0],
				doc.Fragments,
				tt.variables,
				"cf_reader",
				nil,
			)
			if err != nil {
				t.Fatal(err)
			}

			if tt.variables == nil && strings.Contains(tt.name, "unset variable") {
				if !strings.Contains(ops[0].SQL, `::"pg_catalog"."int4"`) {
					t.Fatalf("unset variable must bind typed NULL: %s", ops[0].SQL)
				}
			}

			got := computedResult(t, pool, ops[0])
			if !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("%s = %#v, want %#v", tt.argument, got, tt.want)
			}
		})
	}
}
