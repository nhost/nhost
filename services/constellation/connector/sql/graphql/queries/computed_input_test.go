package queries_test

import (
	"errors"
	"reflect"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/schema"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
)

//nolint:cyclop // One fixture verifies ten aggregate output contracts and min/max type eligibility.
func TestComputedScalarAggregateOutputs(t *testing.T) {
	t.Parallel()
	roots, pool, objects, md, _ := computedTestFixture(t)
	caps := schema.NewCapabilities(schema.KindPostgres, dialect.NewPostgresDialect())
	caps.SupportsComputedScalarInput = true

	s, err := schema.GenerateForRole(objects, "cf_reader", md, caps)
	if err != nil {
		t.Fatal(err)
	}

	for _, op := range []string{"min", "max", "sum", "avg", "stddev", "stddev_pop", "stddev_samp", "var_pop", "var_samp", "variance"} {
		var found bool
		for _, typ := range s.Types {
			if typ.Name != "cf_select_items_"+op+"_fields" {
				continue
			}

			for _, field := range typ.Fields {
				if field.Name == "item_score" {
					found = field.Type.NamedType == "numeric" && len(field.Arguments) == 1 &&
						field.Arguments[0].Name == "args"
				}
			}
		}

		if !found {
			t.Errorf("missing numeric computed field with args and numeric result in %s", op)
		}
	}

	for _, typ := range s.Types {
		if typ.Name != "cf_select_items_min_fields" && typ.Name != "cf_select_items_max_fields" {
			continue
		}

		found := map[string]bool{}
		for _, field := range typ.Fields {
			found[field.Name] = true
		}

		if !found["item_when"] || !found["item_uuid"] || found["item_active"] ||
			found["item_payload"] {
			t.Errorf("incorrect comparable computed fields in %s: %#v", typ.Name, found)
		}
	}

	query := `query { cf_select_items_aggregate { aggregate {
		min { item_label item_score(args:{multiplier:2}) item_when }
		max { item_label item_score(args:{multiplier:2}) item_when }
		sum { item_score(args:{multiplier:2}) }
		avg { item_score(args:{multiplier:2}) }
		stddev { item_score(args:{multiplier:2}) }
		stddev_pop { item_score(args:{multiplier:2}) }
		stddev_samp { item_score(args:{multiplier:2}) }
		var_pop { item_score(args:{multiplier:2}) }
		var_samp { item_score(args:{multiplier:2}) }
		variance { item_score(args:{multiplier:2}) }
	} } }`

	op := computedOperation(t, roots, query, nil)
	if strings.Contains(op.SQL, "multiplier:2") || len(op.Parameters) == 0 {
		t.Fatalf("aggregate args not parameterized: %s, %#v", op.SQL, op.Parameters)
	}

	want := map[string]any{"aggregate": map[string]any{
		"min": map[string]any{
			"item_label": "first",
			"item_score": float64(6.5),
			"item_when":  "2026-01-02",
		},
		"max": map[string]any{
			"item_label": "second",
			"item_score": float64(25),
			"item_when":  "2026-01-03",
		},
		"sum":         map[string]any{"item_score": float64(31.5)},
		"avg":         map[string]any{"item_score": float64(15.75)},
		"stddev":      map[string]any{"item_score": 13.08147545195113},
		"stddev_pop":  map[string]any{"item_score": float64(9.25)},
		"stddev_samp": map[string]any{"item_score": 13.08147545195113},
		"var_pop":     map[string]any{"item_score": float64(85.5625)},
		"var_samp":    map[string]any{"item_score": float64(171.125)},
		"variance":    map[string]any{"item_score": float64(171.125)},
	}}
	if got := computedResult(t, pool, op); !reflect.DeepEqual(got, want) {
		t.Fatalf("aggregate result: %#v, want %#v", got, want)
	}
}

func TestComputedScalarAggregateNullArgsPath(t *testing.T) {
	t.Parallel()
	//nolint:dogsled // Only roots are needed to verify the nested validation path.
	roots, _, _, _, _ := computedTestFixture(t)

	doc, err := parser.ParseQuery(
		&ast.Source{
			Input: `query { cf_select_items_aggregate { aggregate { sum { item_score(args:null) } } } }`,
		},
	)
	if err != nil {
		t.Fatal(err)
	}

	_, err = roots.BuildQuery(doc.Operations[0], doc.Fragments, nil, "cf_reader", nil)

	var invalid *arguments.QueryValidationError
	if !errors.As(err, &invalid) {
		t.Fatalf("null aggregate args error = %v, want validation error", err)
	}

	extensions, ok := invalid.AsMap()["extensions"].(map[string]any)
	if !ok {
		t.Fatalf("missing validation extensions: %#v", invalid.AsMap())
	}

	path := extensions["path"]

	want := "$.selectionSet.cf_select_items_aggregate.selectionSet.aggregate.selectionSet.sum.selectionSet.item_score.args.args"
	if path != want {
		t.Fatalf("aggregate argument path = %v, want %s", path, want)
	}
}

func TestComputedScalarAggregateUUIDError(t *testing.T) {
	t.Parallel()
	//nolint:dogsled // Only roots and pool are needed to check the database error.
	roots, pool, _, _, _ := computedTestFixture(t)
	op := computedOperation(t, roots,
		`query { cf_select_items_aggregate { aggregate { min { item_uuid } } } }`, nil)

	var data []byte

	err := pool.QueryRow(t.Context(), op.SQL, op.Parameters...).Scan(&data)

	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "42883" {
		t.Fatalf("min(uuid) error = %v, want undefined-function 42883", err)
	}
}

func TestComputedScalarMutationPredicates(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name, query string
		want        any
	}{
		{
			"update",
			`mutation { update_cf_select_items(where:{item_label:{_eq:"first"}},_set:{label:"changed"}) { affected_rows } }`,
			map[string]any{"affected_rows": float64(1)},
		},
		{
			"delete",
			`mutation { delete_cf_select_items(where:{item_label:{_eq:"first"}}) { affected_rows } }`,
			map[string]any{"affected_rows": float64(1)},
		},
		{
			"conflict",
			`mutation { insert_cf_select_items_one(object:{id:1,owner_id:1,label:"changed",amount:5,payload:{}},on_conflict:{constraint:items_pkey,update_columns:[label],where:{item_label:{_eq:"first"}}}) { item_label } }`,
			map[string]any{"item_label": "changed"},
		},
		{
			"nested conflict",
			`mutation { insert_cf_select_items_one(object:{id:1,owner_id:1,label:"changed",amount:5,payload:{},tags:{data:[{id:10,label:"nested"}]}},on_conflict:{constraint:items_pkey,update_columns:[label],where:{item_label:{_eq:"first"}}}) { item_label tags(where:{id:{_eq:10}}){id label} } }`,
			map[string]any{
				"item_label": "changed",
				"tags":       []any{map[string]any{"id": float64(10), "label": "nested"}},
			},
		},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			roots, pool, _, _, _ := computedTestFixture(t)
			if tt.name == "delete" {
				if _, err := pool.Exec(
					t.Context(),
					`DELETE FROM cf_select.tags WHERE item_id = 1`,
				); err != nil {
					t.Fatal(err)
				}
			}

			doc, err := parser.ParseQuery(&ast.Source{Input: tt.query})
			if err != nil {
				t.Fatal(err)
			}

			ops, err := roots.BuildQuery(doc.Operations[0], doc.Fragments, nil, "admin", nil)
			if err != nil {
				t.Fatal(err)
			}

			if len(ops) != 1 {
				t.Fatalf("operations = %d", len(ops))
			}

			if got := computedResult(t, pool, ops[0]); !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("result: %#v, want %#v", got, tt.want)
			}
		})
	}
}

// Ungranted roles must not resolve computed fields in user predicates.
func TestComputedScalarUngrantablePredicate(t *testing.T) {
	t.Parallel()
	//nolint:dogsled // Only roots are needed to reject an ungranted computed predicate.
	roots, _, _, _, _ := computedTestFixture(t)

	doc, err := parser.ParseQuery(&ast.Source{Input: `query {
		cf_select_items(where:{item_label:{_eq:"first"}}) { id }
	}`})
	if err != nil {
		t.Fatal(err)
	}

	if _, err := roots.BuildQuery(
		doc.Operations[0],
		doc.Fragments,
		nil,
		"cf_no_grant",
		nil,
	); err == nil ||
		!strings.Contains(err.Error(), "unknown field in where clause: item_label") {
		t.Fatalf("ungranted computed predicate error = %v, want unknown field", err)
	}
}

// Empty comparisons, including nested casts, must not allocate a session bind
// parameter; nonempty comparisons must keep their placeholder indexes.
func TestComputedScalarEmptySessionPredicates(t *testing.T) {
	t.Parallel()
	//nolint:dogsled // This test needs only roots and the isolated database.
	roots, pool, _, _, _ := computedTestFixture(t, true)
	session := map[string]any{"x-hasura-role": "cf_reader", "x-hasura-user-id": "user-a"}

	cases := []struct {
		name, query string
		want        any
	}{
		{
			"empty", `query { cf_select_items(where:{session_label:{}}) { id } }`,
			[]any{map[string]any{"id": float64(1)}, map[string]any{"id": float64(2)}},
		},
		{"not empty", `query { cf_select_items(where:{_not:{session_label:{}}}) { id } }`, []any{}},
		{
			"and empty",
			`query { cf_select_items(where:{_and:[{session_label:{}},{id:{_eq:1}}]}) { id } }`,
			[]any{map[string]any{"id": float64(1)}},
		},
		{
			"cast empty",
			`query { cf_select_items(where:{session_payload:{_cast:{String:{}}},id:{_eq:1}}) { id } }`,
			[]any{map[string]any{"id": float64(1)}},
		},
		{
			"session predicate",
			`query { cf_select_items(where:{session_label:{_eq:"first:user-a"}}) { id } }`,
			[]any{map[string]any{"id": float64(1)}},
		},
		{
			"session cast predicate",
			`query { cf_select_items(where:{session_payload:{_cast:{String:{_eq:"\"first:user-a\""}}}}) { id } }`,
			[]any{map[string]any{"id": float64(1)}},
		},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			op := computedOperation(t, roots, tt.query, session)
			if strings.Contains(op.SQL, "user-a") {
				t.Fatalf("session interpolated into SQL: %s", op.SQL)
			}

			if got := computedResult(t, pool, op); !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("result = %#v, want %#v; SQL: %s", got, tt.want, op.SQL)
			}
		})
	}
}

//nolint:gocognit,cyclop // Independent role-schema and data assertions share one isolated testdb fixture.
func TestComputedScalarUserInputs(t *testing.T) {
	t.Parallel()
	roots, pool, objects, md, _ := computedTestFixture(t)

	cases := []struct {
		name, query string
		expected    any
	}{
		{
			"root where",
			`query { cf_select_items(where:{item_label:{_eq:"first"}}) { id } }`,
			[]any{map[string]any{"id": float64(1)}},
		},
		{
			"root order",
			`query { cf_select_items(order_by:{item_label:desc}) { id } }`,
			[]any{map[string]any{"id": float64(2)}, map[string]any{"id": float64(1)}},
		},
		{
			"root in",
			`query { cf_select_items(where:{item_label:{_in:["second"]}}) { id } }`,
			[]any{map[string]any{"id": float64(2)}},
		},
		{
			"numeric predicate",
			`query { cf_select_items(where:{item_total:{_gt:10}}) { id } }`,
			[]any{map[string]any{"id": float64(1)}},
		},
		{
			"numeric order",
			`query { cf_select_items(order_by:{item_total:asc}) { id } }`,
			[]any{map[string]any{"id": float64(2)}, map[string]any{"id": float64(1)}},
		},
		{
			"boolean predicate",
			`query { cf_select_items(where:{item_active:{_eq:true}}) { id } }`,
			[]any{map[string]any{"id": float64(1)}},
		},
		{
			"root ilike",
			`query { cf_select_items(where:{item_label:{_ilike:"F%"}}) { id } }`,
			[]any{map[string]any{"id": float64(1)}},
		},
		{
			"jsonb predicate",
			`query { cf_select_items(where:{item_payload:{_has_key:"status"}}) { id } }`,
			[]any{map[string]any{"id": float64(1)}, map[string]any{"id": float64(2)}},
		},
		{
			"jsonb computed cast",
			`query { cf_select_items(where:{item_payload:{_cast:{String:{_like:"%ready%"}}}}) { id } }`,
			[]any{map[string]any{"id": float64(1)}},
		},
		{
			"jsonb column cast control",
			`query { cf_select_items(where:{payload:{_cast:{String:{_like:"%ready%"}}}}) { id } }`,
			[]any{map[string]any{"id": float64(1)}},
		},
		{
			"relationship where",
			`query { cf_select_tags(where:{item:{item_label:{_eq:"first"}}}) { id } }`,
			[]any{map[string]any{"id": float64(1)}, map[string]any{"id": float64(2)}},
		},
		{
			"relationship order",
			`query { cf_select_tags(order_by:{item:{item_label:desc}}) { id } }`,
			[]any{
				map[string]any{"id": float64(3)},
				map[string]any{"id": float64(1)},
				map[string]any{"id": float64(2)},
			},
		},
		{
			"function where",
			`query { items_from_function(where:{item_label:{_eq:"second"}}) { id } }`,
			[]any{map[string]any{"id": float64(2)}},
		},
		{
			"aggregate filter",
			`query { cf_select_items_aggregate(where:{item_label:{_eq:"first"}}) { aggregate { count } } }`,
			map[string]any{"aggregate": map[string]any{"count": float64(1)}},
		},
		{
			"aggregate predicate filter",
			`query { cf_select_tags(where:{item_copies_aggregate:{count:{filter:{item_label:{_eq:"first"}},predicate:{_gte:1}}}}) { id } }`,
			[]any{map[string]any{"id": float64(1)}, map[string]any{"id": float64(2)}},
		},
		{
			"injection value",
			`query { cf_select_items(where:{item_label:{_eq:"first' OR true --"}}) { id } }`,
			[]any{},
		},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			op := computedOperation(t, roots, tt.query, nil)
			if tt.name == "injection value" && strings.Contains(op.SQL, "first' OR true --") {
				t.Fatalf("user input interpolated into SQL: %s", op.SQL)
			}

			if got := computedResult(t, pool, op); !reflect.DeepEqual(got, tt.expected) {
				t.Fatalf("result: %#v, want %#v", got, tt.expected)
			}
		})
	}

	caps := schema.NewCapabilities(schema.KindPostgres, dialect.NewPostgresDialect())

	caps.SupportsComputedScalarInput = true
	for _, tt := range []struct {
		role string
		want bool
	}{
		{"cf_reader", true}, {"cf_no_grant", false},
	} {
		t.Run("schema "+tt.role, func(t *testing.T) {
			s, err := schema.GenerateForRole(objects, tt.role, md, caps)
			if err != nil {
				t.Fatal(err)
			}

			for _, name := range []string{"cf_select_items_bool_exp", "cf_select_items_order_by"} {
				var input *graph.InputObjectType
				for _, candidate := range s.Inputs {
					if candidate.Name == name {
						input = candidate
						break
					}
				}

				if input == nil {
					t.Fatalf("missing %s", name)
				}

				found := false
				for _, field := range input.Fields {
					if field.Name == "item_label" {
						found = true

						if field.Description != "" {
							t.Errorf(
								"%s.item_label description = %q, want none",
								name,
								field.Description,
							)
						}
					}

					if field.Name == "item_score" || field.Name == "item_second" {
						t.Fatalf(
							"Hasura does not advertise argument-bearing computed input %s in %s",
							field.Name,
							name,
						)
					}
				}

				if found != tt.want {
					t.Errorf("item_label in %s = %v, want %v", name, found, tt.want)
				}
			}

			if tt.role == "cf_reader" {
				assertComputedScalarAggregateOrderInputs(t, s, md)
			}
		})
	}
}

func assertComputedScalarAggregateOrderInputs(
	t *testing.T,
	s *graph.Schema,
	md *metadata.DatabaseMetadata,
) {
	t.Helper()

	inputs := make(map[string]*graph.InputObjectType, len(s.Inputs))
	for _, input := range s.Inputs {
		inputs[input.Name] = input
	}

	computedNames := make(map[string]bool, len(md.Tables[0].ComputedFields))
	for _, computed := range md.Tables[0].ComputedFields {
		computedNames[computed.Name] = true
	}

	// Aggregate order inputs are column-only even when aggregate outputs
	// contain computed scalars. The outer aggregate_order_by contains only op names.
	for _, op := range []struct {
		name, column string
	}{
		{"min", "label"},
		{"max", "label"},
		{"sum", "amount"},
		{"avg", "amount"},
		{"stddev", "amount"},
		{"stddev_pop", "amount"},
		{"stddev_samp", "amount"},
		{"var_pop", "amount"},
		{"var_samp", "amount"},
		{"variance", "amount"},
	} {
		name := "cf_select_items_" + op.name + "_order_by"

		input := inputs[name]
		if input == nil {
			t.Errorf("missing %s", name)
			continue
		}

		var foundColumn bool
		for _, field := range input.Fields {
			if field.Name == op.column {
				foundColumn = true
			}

			if computedNames[field.Name] {
				t.Errorf("computed field %s in Hasura-ineligible %s", field.Name, name)
			}
		}

		if !foundColumn {
			t.Errorf("missing column %s in %s", op.column, name)
		}
	}
}
