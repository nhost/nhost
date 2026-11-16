package queries_test

import (
	"errors"
	"reflect"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
)

func TestComputedNullAndAliasedValidationPaths(t *testing.T) {
	t.Parallel()
	//nolint:dogsled // The fixture also exposes its pool and metadata for other test cases.
	roots, _, _, _, _ := computedTestFixture(t)

	tests := []struct {
		name, query, message, path string
		variables                  map[string]any
		omission                   bool
	}{
		{
			name:    "literal args null",
			query:   `query { list: cf_select_items { value: item_score(args:null) } }`,
			message: "expected an object for type 'item_score_cf_select_items_args', but found null",
			path:    "$.selectionSet.cf_select_items.selectionSet.item_score.args.args",
		},
		{
			name:    "unset optional args variable",
			query:   `query($a: item_score_cf_select_items_args) { list: cf_select_items { value: item_score(args:$a) } }`,
			message: "expected an object for type 'item_score_cf_select_items_args', but found null",
			path:    "$.selectionSet.cf_select_items.selectionSet.item_score.args.args",
		},
		{
			name:      "null args variable",
			query:     `query($a: item_score_cf_select_items_args) { list: cf_select_items { value: item_score(args:$a) } }`,
			variables: map[string]any{"a": nil},
			message:   "expected an object for type 'item_score_cf_select_items_args', but found null",
			path:      "$.selectionSet.cf_select_items.selectionSet.item_score.args.args",
		},
		{
			name:    "literal path null",
			query:   `query { list: cf_select_items { value: item_payload(path:null) } }`,
			message: "expected a string for type 'String', but found null",
			path:    "$.selectionSet.cf_select_items.selectionSet.item_payload.args.path",
		},
		{
			name:    "unset optional path variable",
			query:   `query($p:String) { list: cf_select_items { value: item_payload(path:$p) } }`,
			message: "expected a string for type 'String', but found null",
			path:    "$.selectionSet.cf_select_items.selectionSet.item_payload.args.path",
		},
		{
			name:      "null path variable",
			query:     `query($p:String) { list: cf_select_items { value: item_payload(path:$p) } }`,
			variables: map[string]any{"p": nil},
			message:   "expected a string for type 'String', but found null",
			path:      "$.selectionSet.cf_select_items.selectionSet.item_payload.args.path",
		},
		{
			name:     "aliased aggregate nodes",
			query:    `query { a: cf_select_items_aggregate { n: nodes { value: item_second(args:{}) } } }`,
			message:  "Non default arguments cannot be omitted",
			path:     "$.selectionSet.cf_select_items_aggregate.selectionSet.nodes.selectionSet.item_second.args.args",
			omission: true,
		},
		{
			name:     "aliased nested relationship",
			query:    `query { list: cf_select_tags { child: item { value: item_second(args:{}) } } }`,
			message:  "Non default arguments cannot be omitted",
			path:     "$.selectionSet.cf_select_tags.selectionSet.item.selectionSet.item_second.args.args",
			omission: true,
		},
		{
			name:    "column-only root control",
			query:   `query { list: cf_select_items(distinct_on:[label], order_by:{id:asc}) { id } }`,
			message: `"distinct_on" columns must match initial "order_by" columns`,
			path:    "$.selectionSet.cf_select_items.args",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			doc, err := parser.ParseQuery(&ast.Source{Input: tt.query})
			if err != nil {
				t.Fatal(err)
			}

			_, err = roots.BuildQuery(
				doc.Operations[0],
				doc.Fragments,
				tt.variables,
				"cf_reader",
				nil,
			)

			var got map[string]any
			if tt.omission {
				var omission *arguments.ComputedOmissionError
				if !errors.As(err, &omission) {
					t.Fatalf("expected omission: %v", err)
				}

				got = omission.AsMap()
			} else {
				var validation *arguments.QueryValidationError
				if !errors.As(err, &validation) {
					t.Fatalf("expected validation: %v", err)
				}

				got = validation.AsMap()
			}

			code := "validation-failed"
			if tt.omission {
				code = "not-supported"
			}

			want := map[string]any{
				"message":    tt.message,
				"extensions": map[string]any{"code": code, "path": tt.path},
			}
			if !reflect.DeepEqual(got, want) {
				t.Fatalf("error = %#v, want %#v", got, want)
			}
		})
	}
}
