package queries_test

import (
	"encoding/json"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	groupedagg "github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/groupedaggregate"
)

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
