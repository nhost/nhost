package queries_test

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	groupedagg "github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/groupedaggregate"
)

func TestComputedScalarGroupedAggregateInputs(t *testing.T) {
	t.Parallel()
	//nolint:dogsled // The fixture supplies a grouped operation plus an isolated pool.
	_, pool, _, _, grouped := computedTestFixture(t)

	doc, err := parser.ParseQuery(&ast.Source{Input: `query {
		_root(where:{item_label:{_eq:"first"}},order_by:{item_label:desc},limit:1) {
			aggregate { sum { item_score(args:{multiplier:2}) } }
			nodes { id }
		}
	}`})
	if err != nil {
		t.Fatal(err)
	}

	field, ok := doc.Operations[0].SelectionSet[0].(*ast.Field)
	if !ok {
		t.Fatal("expected grouped field")
	}

	op, err := grouped.BuildGroupedAggregateSQL(groupedagg.BuildInput{
		TableSchema: "cf_select", TableName: "items", Field: field,
		Fragments: doc.Fragments, Role: "cf_reader", JoinColumnSQLName: "id",
		JoinValues: []any{1, 2},
	})
	if err != nil {
		t.Fatal(err)
	}

	var raw []byte
	if err := pool.QueryRow(t.Context(), op.SQL, op.Parameters...).Scan(&raw); err != nil {
		t.Fatalf("grouped SQL: %v\n%s", err, op.SQL)
	}

	var groups []struct {
		Key       int `json:"_join_key"`
		Aggregate struct {
			Sum struct {
				Score *float64 `json:"item_score"`
			} `json:"sum"`
		} `json:"aggregate"`
		Nodes []struct {
			ID int `json:"id"`
		} `json:"nodes"`
	}
	if err := json.Unmarshal(raw, &groups); err != nil {
		t.Fatal(err)
	}

	if len(groups) != 2 || groups[0].Key != 1 || groups[0].Aggregate.Sum.Score == nil ||
		*groups[0].Aggregate.Sum.Score != 25 || len(groups[0].Nodes) != 1 ||
		groups[1].Key != 2 || groups[1].Aggregate.Sum.Score != nil || len(groups[1].Nodes) != 0 {
		t.Fatalf("unexpected grouped computed inputs: %s", raw)
	}
}

func TestComputedScalarGroupedEmptySessionPredicate(t *testing.T) {
	t.Parallel()
	//nolint:dogsled // The grouped builder and isolated pool are the only fixture results needed.
	_, pool, _, _, grouped := computedTestFixture(t, true)

	doc, err := parser.ParseQuery(&ast.Source{Input: `query {
		_root(where:{_and:[{session_label:{}},{id:{_eq:1}}]}) {
			aggregate { count }
		}
	}`})
	if err != nil {
		t.Fatal(err)
	}

	field, ok := doc.Operations[0].SelectionSet[0].(*ast.Field)
	if !ok {
		t.Fatal("expected grouped field")
	}

	op, err := grouped.BuildGroupedAggregateSQL(groupedagg.BuildInput{
		TableSchema: "cf_select", TableName: "items", Field: field,
		Fragments: doc.Fragments, Role: "cf_reader", JoinColumnSQLName: "id",
		JoinValues: []any{1, 2}, SessionVariables: map[string]any{
			"x-hasura-role": "cf_reader", "x-hasura-user-id": "user-a",
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	if strings.Contains(op.SQL, "user-a") {
		t.Fatalf("session interpolated into SQL: %s", op.SQL)
	}

	var raw []byte
	if err := pool.QueryRow(t.Context(), op.SQL, op.Parameters...).Scan(&raw); err != nil {
		t.Fatalf("grouped SQL: %v\n%s", err, op.SQL)
	}

	var groups []struct {
		Key       int `json:"_join_key"`
		Aggregate struct {
			Count int `json:"count"`
		} `json:"aggregate"`
	}
	if err := json.Unmarshal(raw, &groups); err != nil {
		t.Fatal(err)
	}

	if len(groups) != 2 || groups[0].Key != 1 || groups[0].Aggregate.Count != 1 ||
		groups[1].Key != 2 || groups[1].Aggregate.Count != 0 {
		t.Fatalf("grouped counts: %s", raw)
	}
}

func TestComputedScalarGroupedAggregateNodes(t *testing.T) {
	t.Parallel()
	//nolint:dogsled // The fixture returns roots, pool, objects, metadata and grouped ops; each test selects its needed values.
	_, pool, _, _, grouped := computedTestFixture(t)

	doc, err := parser.ParseQuery(
		&ast.Source{
			Input: `query { _root { aggregate { count } nodes { item_label item_second(args:{multiplier:2}) } } }`,
		},
	)
	if err != nil {
		t.Fatal(err)
	}

	field, ok := doc.Operations[0].SelectionSet[0].(*ast.Field)
	if !ok {
		t.Fatal("expected grouped field")
	}

	op, err := grouped.BuildGroupedAggregateSQL(groupedagg.BuildInput{
		TableSchema:       "cf_select",
		TableName:         "items",
		Field:             field,
		Fragments:         doc.Fragments,
		Role:              "cf_reader",
		JoinColumnSQLName: "id",
		JoinValues:        []any{1, 2, 9},
	})
	if err != nil {
		t.Fatal(err)
	}

	var raw []byte
	if err := pool.QueryRow(t.Context(), op.SQL, op.Parameters...).Scan(&raw); err != nil {
		t.Fatalf("grouped SQL: %v\n%s", err, op.SQL)
	}

	var groups []struct {
		Key   int `json:"_join_key"`
		Nodes []struct {
			Label  string  `json:"item_label"`
			Second float64 `json:"item_second"`
		} `json:"nodes"`
	}
	if err := json.Unmarshal(raw, &groups); err != nil {
		t.Fatal(err)
	}

	if len(groups) != 3 {
		t.Fatalf("groups: %s", raw)
	}

	expected := map[int]struct {
		label string
		score float64
	}{1: {label: "first", score: 25}, 2: {label: "second", score: 6.5}}
	for _, group := range groups {
		if want, found := expected[group.Key]; found {
			if len(group.Nodes) != 1 || group.Nodes[0].Label != want.label ||
				group.Nodes[0].Second != want.score {
				t.Fatalf("group: %+v", group)
			}
		} else if len(group.Nodes) != 0 {
			t.Fatalf("empty group: %+v", group)
		}
	}
}
