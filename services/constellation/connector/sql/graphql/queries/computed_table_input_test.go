package queries_test

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/multiplexed"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/schema"
)

//nolint:paralleltest,cyclop // Schema and target-permission cases share one serial fixture.
func TestComputedTableInputs(t *testing.T) {
	_, pool, objects, md, _ := computedTestFixture(t, true, true)
	caps := schema.NewCapabilities(schema.KindPostgres, dialect.NewPostgresDialect())
	caps.SupportsComputedTableInput = true

	for _, tc := range []struct {
		role, boolField, orderField string
	}{
		{"admin", "cf_select_tags_bool_exp", "cf_select_tags_aggregate_order_by"},
		{"cf_reader", "cf_select_tags_bool_exp", "cf_select_tags_aggregate_order_by"},
		{"cf_no_grant", "", ""},
	} {
		t.Run(tc.role, func(t *testing.T) {
			s, err := schema.GenerateForRole(objects, tc.role, md, caps)
			if err != nil {
				t.Fatal(err)
			}

			defs := s.ToAST().Definitions
			b := defs.ForName("cf_select_items_bool_exp").Fields.ForName("item_tags")

			o := defs.ForName("cf_select_items_order_by").Fields.ForName("item_tags_aggregate")
			if tc.boolField == "" {
				if b != nil || o != nil {
					t.Fatal("target-denied table inputs visible")
				}

				return
			}

			if b == nil || b.Type.String() != tc.boolField ||
				o == nil || o.Type.String() != tc.orderField ||
				defs.ForName(
					"cf_select_items_bool_exp",
				).Fields.ForName(
					"item_tags_with_args",
				) != nil ||
				defs.ForName(
					"cf_select_items_order_by",
				).Fields.ForName(
					"item_tags_with_args_aggregate",
				) != nil {
				t.Fatalf("table input types: bool=%v order=%v", b, o)
			}
		})
	}

	md.Tables[1].SelectPermissions[0].Permission.AllowAggregations = false

	withoutTargetAggregate, err := schema.GenerateForRole(objects, "cf_reader", md, caps)
	if err != nil {
		t.Fatal(err)
	}

	if withoutTargetAggregate.ToAST().Definitions.ForName("cf_select_items_order_by").Fields.
		ForName("item_tags_aggregate") == nil {
		t.Fatal("table function ordering incorrectly requires target aggregate root access")
	}

	md.Tables[1].SelectPermissions[0].Permission.AllowAggregations = true

	build := func(t *testing.T) queries.Roots {
		t.Helper()

		roots, _, err := queries.BuildRoots(objects, md, dialect.NewPostgresDialect(), caps)
		if err != nil {
			t.Fatal(err)
		}

		return roots
	}

	roots := build(t)
	for _, tc := range []struct {
		name, query, role string
		want              any
	}{
		{"exists", `query { cf_select_items(where:{item_tags:{label:{_eq:"two"}}},order_by:{id:asc}) { id } }`, "admin", []any{map[string]any{"id": float64(1)}}},
		{"not and nested", `query { cf_select_items(where:{_not:{item_tags:{label:{_eq:"two"}}}},order_by:{id:asc}) { id } }`, "admin", []any{map[string]any{"id": float64(2)}}},
		{"aggregate count", `query { cf_select_items(order_by:[{item_tags_aggregate:{count:desc}},{id:asc}]) { id } }`, "admin", []any{map[string]any{"id": float64(1)}, map[string]any{"id": float64(2)}}},
		{"aggregate max", `query { cf_select_items(order_by:[{item_tags_aggregate:{max:{id:desc}}},{id:asc}]) { id } }`, "admin", []any{map[string]any{"id": float64(2)}, map[string]any{"id": float64(1)}}},
		{"nested target", `query { cf_select_items(where:{item_tags:{item:{item_tags:{id:{_eq:2}}}}},order_by:{id:asc}) { id } }`, "admin", []any{map[string]any{"id": float64(1)}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			op := computedTableOperation(t, roots, tc.query, tc.role, nil)
			if !strings.Contains(op.SQL, `"cf_select"."item_tags"`) ||
				!reflect.DeepEqual(computedResult(t, pool, op), tc.want) {
				t.Fatalf("computed input: got %v, want %v; SQL %s; params %v",
					computedResult(t, pool, op), tc.want, op.SQL, op.Parameters)
			}
		})
	}

	sessionOp := computedTableOperation(t, roots,
		`query { cf_select_items(where:{item_tags_for_session:{id:{_eq:3}}}) { id } }`,
		"cf_reader", map[string]any{"x-hasura-tag-label": "three"})
	if got := computedResult(t, pool, sessionOp); !reflect.DeepEqual(got,
		[]any{map[string]any{"id": float64(2)}}) {
		t.Fatalf("session function where: %#v; SQL %s", got, sessionOp.SQL)
	}

	// A target permission is applied inside both the EXISTS and aggregate
	// subqueries; the function must not re-read unrestricted base-table rows.
	md.Tables[1].SelectPermissions[0].Permission.Filter = map[string]any{
		"label": map[string]any{"_eq": "one"},
	}

	roots = build(t)

	op := computedTableOperation(t, roots,
		`query { cf_select_items(where:{item_tags:{label:{_eq:"two"}}}) { id } }`,
		"cf_reader", nil)
	if got := computedResult(t, pool, op); !reflect.DeepEqual(got, []any{}) {
		t.Fatalf("target filter exposes hidden tag: got %#v; SQL %s", got, op.SQL)
	}

	// Unlike the unrestricted counts (2, 1), permitted counts are (0, 1).
	// The tie-breaker keeps this security assertion deterministic.
	md.Tables[1].SelectPermissions[0].Permission.Filter = map[string]any{
		"label": map[string]any{"_eq": "three"},
	}
	roots = build(t)

	order := `query { cf_select_items(order_by:[{item_tags_aggregate:{count:desc}},{id:asc}]) { id } }`
	for _, tc := range []struct {
		role string
		want any
	}{
		{"cf_reader", []any{map[string]any{"id": float64(2)}, map[string]any{"id": float64(1)}}},
		{"admin", []any{map[string]any{"id": float64(1)}, map[string]any{"id": float64(2)}}},
	} {
		op := computedTableOperation(t, roots, order, tc.role, nil)
		if got := computedResult(t, pool, op); !reflect.DeepEqual(got, tc.want) {
			t.Fatalf(
				"%s target-filtered order: got %#v want %#v; SQL %s",
				tc.role,
				got,
				tc.want,
				op.SQL,
			)
		}
	}
}

//nolint:paralleltest // Bound testdb pools under default package parallelism.
func TestComputedTableInputVariables(t *testing.T) {
	_, pool, objects, md, _ := computedTestFixture(t)
	caps := schema.NewCapabilities(schema.KindPostgres, dialect.NewPostgresDialect())

	roots, _, err := queries.BuildRoots(objects, md, dialect.NewPostgresDialect(), caps)
	if err != nil {
		t.Fatal(err)
	}

	doc, err := parser.ParseQuery(
		&ast.Source{
			Input: `query($filter:cf_select_items_bool_exp, $sort:[cf_select_items_order_by!]) {
		alias:cf_select_items(where:$filter,order_by:$sort) { id }
	}`,
		},
	)
	if err != nil {
		t.Fatal(err)
	}

	injection := `two') OR TRUE--`

	ops, err := roots.BuildQuery(doc.Operations[0], doc.Fragments, map[string]any{
		"filter": map[string]any{
			"item_tags": map[string]any{"label": map[string]any{"_eq": injection}},
		},
		"sort": []any{map[string]any{"item_tags_aggregate": map[string]any{"count": "desc"}}},
	}, "cf_reader", nil)
	if err != nil {
		t.Fatal(err)
	}

	if len(ops) != 1 || strings.Contains(ops[0].SQL, injection) {
		t.Fatalf("computed input not parameterized: %#v", ops)
	}

	if got := computedResult(t, pool, ops[0]); !reflect.DeepEqual(got, []any{}) {
		t.Fatalf("injection-shaped comparison escaped input: %#v", got)
	}
}

//nolint:paralleltest,gocognit,cyclop // Live, stream and permission cohorts share one serial fixture.
func TestComputedTableInputSubscriptionCohorts(t *testing.T) {
	_, pool, objects, md, _ := computedTestFixture(t, true, true)
	caps := schema.NewCapabilities(schema.KindPostgres, dialect.NewPostgresDialect())

	roots, _, err := queries.BuildRoots(objects, md, dialect.NewPostgresDialect(), caps)
	if err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct {
		name, query string
		cursor      map[string]any
	}{
		{"live", `subscription { cf_select_items(where:{item_tags_for_session:{id:{_eq:1}}}) { id } }`, nil},
		{"stream", `subscription { cf_select_items_stream(batch_size:2,cursor:[{initial_value:{id:0}}],where:{item_tags_for_session:{id:{_eq:1}}}) { id } }`, map[string]any{"id": 0}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			op := computedTableOperation(t, roots, tc.query, "cf_reader", map[string]any{
				"x-hasura-role": "cf_reader", "x-hasura-tag-label": "template",
			})
			params := multiplexed.PrepareParams([]string{"a", "b"}, map[string][]any{
				"x-hasura-role":      {"cf_reader", "cf_reader"},
				"x-hasura-tag-label": {"one", "three"},
			}, tc.cursor)

			rows, err := pool.Query(t.Context(), op.SQL, append(params, op.Parameters...)...)
			if err != nil {
				t.Fatalf("cohort query: %v; SQL %s", err, op.SQL)
			}
			defer rows.Close()

			got := map[string][]map[string]any{}
			for rows.Next() {
				var (
					id  string
					raw []byte
				)
				if err := rows.Scan(&id, &raw); err != nil {
					t.Fatal(err)
				}

				var result map[string][]map[string]any
				if err := json.Unmarshal(raw, &result); err != nil {
					t.Fatal(err)
				}

				field := "cf_select_items"
				if tc.name == "stream" {
					field += "_stream"
				}

				got[id] = result[field]
			}

			if err := rows.Err(); err != nil {
				t.Fatal(err)
			}

			if !reflect.DeepEqual(got["a"], []map[string]any{{"id": float64(1)}}) ||
				len(got["b"]) != 0 {
				t.Fatalf("cross-cohort computed input leak: %#v; SQL %s", got, op.SQL)
			}
		})
	}

	// A session-bound table predicate in the role filter must use each
	// subscriber's own session, even though both share one multiplexed SQL poll.
	md.Tables[0].SelectPermissions[1].Permission.Filter = map[string]any{
		"item_tags_for_session": map[string]any{},
	}

	roots, _, err = queries.BuildRoots(objects, md, dialect.NewPostgresDialect(), caps)
	if err != nil {
		t.Fatal(err)
	}

	op := computedTableOperation(t, roots,
		`subscription { cf_select_items(order_by:{id:asc}) { id } }`,
		"cf_reader", map[string]any{"x-hasura-role": "cf_reader", "x-hasura-tag-label": "template"})
	params := multiplexed.PrepareParams([]string{"a", "b"}, map[string][]any{
		"x-hasura-role":      {"cf_reader", "cf_reader"},
		"x-hasura-tag-label": {"one", "three"},
	}, nil)

	rows, err := pool.Query(t.Context(), op.SQL, append(params, op.Parameters...)...)
	if err != nil {
		t.Fatalf("permission-cohort query: %v; SQL %s", err, op.SQL)
	}
	defer rows.Close()

	got := map[string][]map[string]any{}
	for rows.Next() {
		var (
			id  string
			raw []byte
		)
		if err := rows.Scan(&id, &raw); err != nil {
			t.Fatal(err)
		}

		var result map[string][]map[string]any
		if err := json.Unmarshal(raw, &result); err != nil {
			t.Fatal(err)
		}

		got[id] = result["cf_select_items"]
	}

	if err := rows.Err(); err != nil {
		t.Fatalf("permission cohort: %v; SQL %s; params %v", err, op.SQL, op.Parameters)
	}

	if !reflect.DeepEqual(got["a"], []map[string]any{{"id": float64(1)}}) ||
		!reflect.DeepEqual(got["b"], []map[string]any{{"id": float64(2)}}) {
		t.Fatalf("cross-cohort table permission leak: %#v; SQL %s", got, op.SQL)
	}
}
