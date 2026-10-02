package queries_test

import (
	"errors"
	"reflect"
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
)

//nolint:gocognit,cyclop // The injection, SQL-error, omission and alias assertions share one isolated database.
func TestComputedScalarBindingAndErrors(t *testing.T) {
	t.Parallel()
	//nolint:dogsled // The fixture returns roots, pool, objects, metadata and grouped ops; each test selects its needed values.
	roots, pool, _, _, _ := computedTestFixture(t)
	injection := `1); DROP TABLE cf_select.items; --`

	cases := []struct {
		name, query string
		variables   map[string]any
		expectError bool
		expected    any
	}{
		{
			"injected-argument",
			`query($multiplier: Int!) { cf_select_items(where:{id:{_eq:1}}) { item_score(args:{multiplier:$multiplier}) } }`,
			map[string]any{"multiplier": injection},
			true,
			nil,
		},
		{
			"injected-path",
			`query($path: String!) { cf_select_items(where:{id:{_eq:1}}) { item_payload(path:$path) } }`,
			map[string]any{"path": injection},
			true,
			nil,
		},
		{
			"function-error",
			`query { cf_select_items(where:{id:{_eq:1}}) { item_raises } }`,
			nil,
			true,
			nil,
		},
	}
	for _, tt := range cases {
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
			if tt.name == "injected-path" {
				var validation *arguments.QueryValidationError
				if !errors.As(err, &validation) {
					t.Fatalf("expected path validation error, got %v", err)
				}

				ext, ok := validation.AsMap()["extensions"].(map[string]any)
				if !ok || ext["code"] != "validation-failed" ||
					ext["path"] != "$.selectionSet.cf_select_items.selectionSet.item_payload.args" {
					t.Fatalf("unexpected path validation: %#v", validation.AsMap())
				}

				return
			}

			if err != nil {
				t.Fatal(err)
			}

			if strings.Contains(ops[0].SQL, injection) {
				t.Fatal("client value interpolated into SQL")
			}

			var raw []byte

			err = pool.QueryRow(t.Context(), ops[0].SQL, ops[0].Parameters...).Scan(&raw)
			if tt.expectError {
				if err == nil {
					t.Fatal("expected function/cast error")
				}

				return
			}

			if err != nil {
				t.Fatal(err)
			}

			if !strings.Contains(string(raw), `"item_payload":null`) {
				t.Fatalf("path result: %s", raw)
			}
		})
	}

	missing, err := parser.ParseQuery(
		&ast.Source{Input: `query { cf_select_items { item_second(args:{}) } }`},
	)
	if err != nil {
		t.Fatal(err)
	}

	_, err = roots.BuildQuery(missing.Operations[0], missing.Fragments, nil, "cf_reader", nil)

	var omission *arguments.ComputedOmissionError
	if !errors.As(err, &omission) || !reflect.DeepEqual(omission.AsMap(), map[string]any{
		"message": "Non default arguments cannot be omitted",
		"extensions": map[string]any{
			"code": "not-supported",
			"path": "$.selectionSet.cf_select_items.selectionSet.item_second.args.args",
		},
	}) {
		t.Fatalf("expected Phase 2 required-argument error, got %v", err)
	}

	aliased, err := parser.ParseQuery(
		&ast.Source{Input: `query { list: cf_select_items { missing: item_second(args:{}) } }`},
	)
	if err != nil {
		t.Fatal(err)
	}

	_, err = roots.BuildQuery(aliased.Operations[0], aliased.Fragments, nil, "cf_reader", nil)
	if !errors.As(err, &omission) || !reflect.DeepEqual(omission.AsMap(), map[string]any{
		"message": "Non default arguments cannot be omitted",
		"extensions": map[string]any{
			"code": "not-supported",
			"path": "$.selectionSet.cf_select_items.selectionSet.item_second.args.args",
		},
	}) {
		t.Fatalf("aliased omission path = %v", err)
	}

	var count int
	if err := pool.QueryRow(t.Context(), `SELECT count(*) FROM cf_select.items`).
		Scan(&count); err != nil ||
		count != 2 {
		t.Fatalf("client input damaged table: count=%d error=%v", count, err)
	}
}
