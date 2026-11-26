package queries_test

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/formatter"
	"github.com/vektah/gqlparser/v2/validator"
	"github.com/vektah/gqlparser/v2/validator/rules"

	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	graphqlschema "github.com/nhost/nhost/services/constellation/connector/sql/graphql/schema"
)

func TestNullableAggregateCountInputs(t *testing.T) {
	t.Parallel()

	tests := []variableInputCase{
		{
			name:      "null count variable",
			query:     `query($d:order_by){users(order_by:{posts_aggregate:{count:$d}}){id}}`,
			variables: `{"d":null}`,
			wantQuery: `query{users{id}}`, wantVariables: `{}`,
		},
		{
			name:          "null count default",
			query:         `query($d:order_by=null){users(order_by:{posts_aggregate:{count:$d},id:desc}){id}}`,
			variables:     `{}`,
			wantQuery:     `query{users(order_by:{id:desc}){id}}`,
			wantVariables: `{}`,
		},
		{
			name:      "null overrides count default",
			query:     `query($d:order_by=asc){users(order_by:{posts_aggregate:{count:$d}}){id}}`,
			variables: `{"d":null}`,
			wantQuery: `query{users{id}}`, wantVariables: `{}`,
		},
		{
			name:          "non-null count default retained",
			query:         `query($d:order_by=desc){users(order_by:{posts_aggregate:{count:$d}}){id}}`,
			variables:     `{}`,
			wantQuery:     `query{users(order_by:{posts_aggregate:{count:desc}}){id}}`,
			wantVariables: `{}`,
		},
		{
			name:      "whole ordering object",
			query:     `query($o:users_order_by!){users(order_by:[$o]){id}}`,
			variables: `{"o":{"posts_aggregate":{"count":null},"id":"desc"}}`,
			wantQuery: `query{users(order_by:{id:desc}){id}}`, wantVariables: `{}`,
		},
		{
			name:      "whole ordering list",
			query:     `query($o:[users_order_by!]!){users(order_by:$o){id}}`,
			variables: `{"o":[{"posts_aggregate":{"count":null}},{"id":"desc"}]}`,
			wantQuery: `query{users(order_by:{id:desc}){id}}`, wantVariables: `{}`,
		},
		{
			name:      "singleton ordering list",
			query:     `query($o:[users_order_by!]!){users(order_by:$o){id}}`,
			variables: `{"o":{"posts_aggregate":{"count":null},"id":"desc"}}`,
			wantQuery: `query{users(order_by:{id:desc}){id}}`, wantVariables: `{}`,
		},
		{
			name:          "literal null in nested relationship",
			query:         `query{posts(order_by:{author:{posts_aggregate:{count:null},id:asc},id:desc}){id}}`,
			variables:     `{}`,
			wantQuery:     `query{posts(order_by:{author:{id:asc},id:desc}){id}}`,
			wantVariables: `{}`,
		},
		{
			name:          "null count in fragment",
			query:         `query($d:order_by){posts{...Author}} fragment Author on posts{author{posts(order_by:{author:{posts_aggregate:{count:$d},id:asc}}){id}}}`,
			variables:     `{"d":null}`,
			wantQuery:     `query{posts{author{posts(order_by:{author:{id:asc}}){id}}}}`,
			wantVariables: `{}`,
		},
	}
	testVariableInputs(t, tests)
}

//nolint:tparallel // Sequential cases replay cached ASTs and share a PostgreSQL pool within testdb's connection budget.
func TestNullableAggregateOrderByExecution(t *testing.T) {
	t.Parallel()

	_, pool, objects, md, _ := computedTestFixture(t, true, true)
	md.Tables[1].SelectPermissions[0].Permission.Filter = map[string]any{
		"label": map[string]any{"_eq": "x-hasura-tag-label"},
	}
	caps := graphqlschema.NewCapabilities(graphqlschema.KindPostgres, dialect.NewPostgresDialect())

	graph, err := graphqlschema.GenerateForRole(objects, "cf_reader", md, caps)
	if err != nil {
		t.Fatal(err)
	}

	_, schema, err := schemamerge.BuildValidatedSchema(graph, "cf_reader")
	if err != nil {
		t.Fatal(err)
	}

	roots, _, err := queries.BuildRoots(objects, md, dialect.NewPostgresDialect(), caps)
	if err != nil {
		t.Fatal(err)
	}

	// Both computed and relationship aggregates see only tag three: counts
	// (0, 1), rather than the unrestricted (2, 1). A retained count:desc must
	// therefore return item two first, while null must leave the ID sort alone.
	documents := make(map[string]*ast.QueryDocument)
	build := func(t *testing.T, query, provided string) core.SQLOperation {
		t.Helper()

		doc := documents[query]
		if doc == nil {
			parsed, errs := gqlparser.LoadQueryWithRules(schema, query, rules.NewDefaultRules())
			if len(errs) != 0 {
				t.Fatal(errs)
			}

			doc = parsed
			documents[query] = doc
		}

		var variables map[string]any
		if err := json.Unmarshal([]byte(provided), &variables); err != nil {
			t.Fatal(err)
		}

		coerced, err := validator.VariableValues(schema, doc.Operations[0], variables)
		if err != nil {
			t.Fatal(err)
		}

		return buildImmutableAggregateOrder(t, roots, doc, coerced)
	}

	for _, field := range []string{"tags_aggregate", "item_tags_aggregate"} {
		testNullableAggregateOrderTerms(t, pool, field, build)
		testNullableAggregateOrderObjects(t, pool, field, build)

		testInvalidAggregateOrderInputs(t, roots, schema, field)
	}
}

type aggregateOrderBuilder func(t *testing.T, query, provided string) core.SQLOperation

func testNullableAggregateOrderTerms(
	t *testing.T,
	pool *pgxpool.Pool,
	field string,
	build aggregateOrderBuilder,
) {
	t.Helper()

	tests := make([]variableInputCase, 0, 35)

	tests = append(tests,
		variableInputCase{
			name: "null count", query: `{count:$d}`, variables: `{"d":null}`,
			wantQuery: `{}`, wantVariables: `{}`,
		},
		variableInputCase{
			name:          "non-null count on cached AST",
			query:         `{count:$d}`,
			variables:     `{"d":"desc"}`,
			wantQuery:     `{count:desc}`,
			wantVariables: `{}`,
		},
		variableInputCase{
			name: "null count replay", query: `{count:$d}`, variables: `{"d":null}`,
			wantQuery: `{}`, wantVariables: `{}`,
		},
		variableInputCase{
			name: "omitted count", query: `{count:$d}`, variables: `{}`,
			wantQuery: `{}`, wantVariables: `{}`,
		},
		variableInputCase{
			name:          "null count with column sibling",
			query:         `{count:$d,max:{id:desc_nulls_last}}`,
			variables:     `{"d":null}`,
			wantQuery:     `{max:{id:desc_nulls_last}}`,
			wantVariables: `{}`,
		},
	)
	for _, fn := range []string{"avg", "max", "min", "sum", "stddev", "stddev_pop", "stddev_samp", "var_pop", "var_samp", "variance"} {
		tests = append(tests,
			variableInputCase{
				name:          fn + " null object",
				query:         fmt.Sprintf(`{count:desc,%s:null}`, fn),
				variables:     `{}`,
				wantQuery:     `{count:desc}`,
				wantVariables: `{}`,
			},
			variableInputCase{
				name:          fn + " null column",
				query:         fmt.Sprintf(`{count:desc,%s:{id:$d}}`, fn),
				variables:     `{"d":null}`,
				wantQuery:     `{count:desc}`,
				wantVariables: `{}`,
			},
			variableInputCase{
				name:      fn + " mixed columns",
				query:     fmt.Sprintf(`{count:desc,%s:{id:null,item_id:asc_nulls_last}}`, fn),
				variables: `{}`,
				wantQuery: fmt.Sprintf(
					`{count:desc,%s:{item_id:asc_nulls_last}}`,
					fn,
				),
				wantVariables: `{}`,
			},
		)
	}

	for _, tt := range tests {
		t.Run(field+"/"+tt.name, func(t *testing.T) {
			definitions := ""
			if strings.Contains(tt.query, "$d") {
				definitions = "($d:order_by)"
			}

			query := fmt.Sprintf(
				`query%s{cf_select_items(order_by:{%s:%s,id:asc},where:{id:{_gt:0}}){id}}`,
				definitions,
				field,
				tt.query,
			)
			wantQuery := fmt.Sprintf(
				`query{cf_select_items(order_by:{%s:%s,id:asc},where:{id:{_gt:0}}){id}}`,
				field,
				tt.wantQuery,
			)
			got := build(t, query, tt.variables)

			want := build(t, wantQuery, tt.wantVariables)
			if diff := cmp.Diff(want, got); diff != "" {
				t.Fatalf("SQL/parameters (-omission +null):\n%s", diff)
			}

			gotData := computedResult(t, pool, got)
			if diff := cmp.Diff(computedResult(t, pool, want), gotData); diff != "" {
				t.Fatalf("result (-omission +null):\n%s", diff)
			}

			wantOrder := []any{map[string]any{"id": float64(2)}, map[string]any{"id": float64(1)}}
			if tt.wantQuery == `{}` {
				wantOrder[0], wantOrder[1] = wantOrder[1], wantOrder[0]
			}

			if diff := cmp.Diff(wantOrder, gotData); diff != "" {
				t.Fatalf("permission-filtered order (-want +got):\n%s", diff)
			}
		})
	}
}

func testNullableAggregateOrderObjects(
	t *testing.T,
	pool *pgxpool.Pool,
	field string,
	build aggregateOrderBuilder,
) {
	t.Helper()

	inputTests := []variableInputCase{
		{
			name: "whole aggregate object",
			query: fmt.Sprintf(
				`query($o:cf_select_tags_aggregate_order_by){cf_select_items(order_by:{%s:$o,id:asc}){id}}`,
				field,
			),
			variables: `{"o":{"count":null,"max":null,"sum":{"id":null,"item_id":"desc_nulls_last"}}}`,
			wantQuery: fmt.Sprintf(
				`query{cf_select_items(order_by:{%s:{sum:{item_id:desc_nulls_last}},id:asc}){id}}`,
				field,
			),
		},
		{
			name:  "whole ordering object",
			query: `query($o:cf_select_items_order_by!){cf_select_items(order_by:[$o]){id}}`,
			variables: fmt.Sprintf(
				`{"o":{"%s":{"count":null,"max":null,"sum":{"id":null,"item_id":"desc_nulls_last"}},"id":"asc"}}`,
				field,
			),
			wantQuery: fmt.Sprintf(
				`query{cf_select_items(order_by:{id:asc,%s:{sum:{item_id:desc_nulls_last}}}){id}}`,
				field,
			),
		},
		{
			name:  "whole ordering list",
			query: `query($o:[cf_select_items_order_by!]!){cf_select_items(order_by:$o){id}}`,
			variables: fmt.Sprintf(
				`{"o":[{"%s":{"count":null,"min":{"id":null,"item_id":"asc_nulls_last"}}},{"id":"desc"}]}`,
				field,
			),
			wantQuery: fmt.Sprintf(
				`query{cf_select_items(order_by:[{%s:{min:{item_id:asc_nulls_last}}},{id:desc}]){id}}`,
				field,
			),
		},
		{
			name: "nested object relationship",
			query: fmt.Sprintf(
				`query($d:order_by){cf_select_tags(order_by:{item:{%s:{count:$d,max:null,sum:{id:$d}},id:desc},id:asc}){id}}`,
				field,
			),
			variables: `{"d":null}`,
			wantQuery: `query{cf_select_tags(order_by:{item:{id:desc},id:asc}){id}}`,
		},
	}
	for _, tt := range inputTests {
		t.Run(field+"/"+tt.name, func(t *testing.T) {
			got := build(t, tt.query, tt.variables)

			want := build(t, tt.wantQuery, `{}`)
			if diff := cmp.Diff(want, got); diff != "" {
				t.Fatalf("SQL/parameters (-omission +null):\n%s", diff)
			}

			if diff := cmp.Diff(
				computedResult(t, pool, want),
				computedResult(t, pool, got),
			); diff != "" {
				t.Fatalf("result (-omission +null):\n%s", diff)
			}
		})
	}
}

func buildImmutableAggregateOrder(
	t *testing.T, roots queries.Roots, doc *ast.QueryDocument, variables map[string]any,
) core.SQLOperation {
	t.Helper()

	var before, after bytes.Buffer
	formatter.NewFormatter(&before).FormatQueryDocument(doc)

	original, err := json.Marshal(variables)
	if err != nil {
		t.Fatal(err)
	}

	ops, err := roots.BuildQuery(
		doc.Operations[0],
		doc.Fragments,
		variables,
		"cf_reader",
		map[string]any{"x-hasura-tag-label": "three"},
	)
	if err != nil || len(ops) != 1 {
		t.Fatalf("BuildQuery: operations=%d, error=%v", len(ops), err)
	}

	formatter.NewFormatter(&after).FormatQueryDocument(doc)

	remaining, err := json.Marshal(variables)
	if err != nil {
		t.Fatal(err)
	}

	if before.String() != after.String() || !bytes.Equal(original, remaining) {
		t.Fatal("BuildQuery mutated the cached AST or coerced variables")
	}

	return ops[0]
}

func testInvalidAggregateOrderInputs(
	t *testing.T,
	roots queries.Roots,
	schema *ast.Schema,
	field string,
) {
	t.Helper()

	query := `query($o:[cf_select_items_order_by!]){cf_select_items(order_by:$o){id}}`

	doc, errs := gqlparser.LoadQueryWithRules(schema, query, rules.NewDefaultRules())
	if len(errs) != 0 {
		t.Fatal(errs)
	}

	tests := []struct{ name, provided string }{
		{"invalid count", fmt.Sprintf(`{"o":[{"%s":{"count":"sideways"}}]}`, field)},
		{
			"invalid column direction",
			fmt.Sprintf(`{"o":[{"%s":{"count":null,"max":{"id":"sideways"}}}]}`, field),
		},
		{"unknown null aggregate", fmt.Sprintf(`{"o":[{"%s":{"unknown":null}}]}`, field)},
		{"unknown null column", fmt.Sprintf(`{"o":[{"%s":{"max":{"unknown":null}}}]}`, field)},
		{"null list element", `{"o":[null]}`},
	}
	for _, tt := range tests {
		t.Run(field+"/"+tt.name, func(t *testing.T) {
			var variables map[string]any
			if err := json.Unmarshal([]byte(tt.provided), &variables); err != nil {
				t.Fatal(err)
			}

			if _, err := validator.VariableValues(
				schema,
				doc.Operations[0],
				variables,
			); err == nil {
				t.Fatal("expected schema coercion error")
			}

			ops, err := roots.BuildQuery(
				doc.Operations[0],
				doc.Fragments,
				variables,
				"cf_reader",
				nil,
			)
			if !errors.Is(err, arguments.ErrInvalidArgument) || len(ops) != 0 {
				t.Fatalf("expected ErrInvalidArgument without operations, got %v / %v", ops, err)
			}
		})
	}
}
