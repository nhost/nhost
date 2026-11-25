package queries_test

import (
	"bytes"
	"encoding/json"
	"errors"
	"testing"

	"github.com/google/go-cmp/cmp"
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
	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestNullableRelationshipOrderByInputs(t *testing.T) {
	t.Parallel()

	tests := []variableInputCase{
		{
			"null author variable",
			`query($o:users_order_by){posts(order_by:{author:$o}){id}}`,
			`{"o":null}`,
			`query{posts{id}}`, `{}`,
		},
		{
			"omitted author variable",
			`query($o:users_order_by){posts(order_by:{author:$o}){id}}`,
			`{}`,
			`query{posts{id}}`, `{}`,
		},
		{
			"null author default",
			`query($o:users_order_by=null){posts(order_by:{author:$o,id:desc}){id}}`,
			`{}`,
			`query{posts(order_by:{id:desc}){id}}`, `{}`,
		},
		{
			"null overrides author default",
			`query($o:users_order_by={id:asc}){posts(order_by:{author:$o}){id}}`,
			`{"o":null}`,
			`query{posts{id}}`, `{}`,
		},
		{
			"non-null author default retained",
			`query($o:users_order_by={id:asc}){posts(order_by:{author:$o}){id}}`,
			`{}`,
			`query{posts(order_by:{author:{id:asc}}){id}}`, `{}`,
		},
		{
			"whole object variable",
			`query($o:posts_order_by!){posts(order_by:[$o]){id}}`,
			`{"o":{"author":null,"id":"desc"}}`,
			`query{posts(order_by:{id:desc}){id}}`, `{}`,
		},
		{
			"whole list variable",
			`query($o:[posts_order_by!]!){posts(order_by:$o){id}}`,
			`{"o":[{"author":null},{"id":"desc"}]}`,
			`query{posts(order_by:{id:desc}){id}}`, `{}`,
		},
		{
			"singleton list coercion",
			`query($o:[posts_order_by!]!){posts(order_by:$o){id}}`,
			`{"o":{"author":null,"id":"desc"}}`,
			`query{posts(order_by:{id:desc}){id}}`, `{}`,
		},
		{
			"fragment variable",
			`query($o:users_order_by){users{...Sorted}} fragment Sorted on users{posts(order_by:{author:$o,id:desc}){id}}`,
			`{"o":null}`,
			`query{users{posts(order_by:{id:desc}){id}}}`,
			`{}`,
		},
		{
			"null aggregate wrapper",
			`query($o:posts_aggregate_order_by){users(order_by:{posts_aggregate:$o,id:desc}){id}}`,
			`{"o":null}`,
			`query{users(order_by:{id:desc}){id}}`,
			`{}`,
		},
		{
			"nested null aggregate wrapper",
			`query($o:posts_aggregate_order_by){posts(order_by:{author:{posts_aggregate:$o,id:asc},id:desc}){id}}`,
			`{"o":null}`,
			`query{posts(order_by:{author:{id:asc},id:desc}){id}}`,
			`{}`,
		},
		{
			"literal wrappers with ordered siblings",
			`query{posts(order_by:[{author:null,id:desc},{author:{posts_aggregate:null,id:asc}}]){id}}`,
			`{}`,
			`query{posts(order_by:[{id:desc},{author:{id:asc}}]){id}}`,
			`{}`,
		},
	}
	testVariableInputs(t, tests)
}

//nolint:paralleltest // Sequential SQL cases reuse a cached AST and a PostgreSQL pool within testdb's connection budget.
func TestNullableRelationshipOrderByExecution(t *testing.T) {
	t.Parallel()

	_, pool, objects, md, _ := computedTestFixture(t, true, true)
	for i := range md.Tables[0].SelectPermissions {
		if md.Tables[0].SelectPermissions[i].Role == "cf_reader" {
			md.Tables[0].SelectPermissions[i].Permission.Filter = map[string]any{
				"label": map[string]any{"_neq": "first"},
			}
		}
	}

	md.Tables[1].SelectPermissions[0].Permission.Filter = map[string]any{
		"label": map[string]any{"_neq": "two"},
	}
	md.Tables[0].ObjectRelationships = append(md.Tables[0].ObjectRelationships,
		metadata.ObjectRelationship{
			Name: "self",
			Using: metadata.RelationshipUsing{ManualConfiguration: &metadata.ManualConfiguration{
				RemoteTable:   metadata.TableSource{Schema: "cf_select", Name: "items"},
				ColumnMapping: map[string]string{"id": "id"},
			}},
		},
	)

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

	build := nullableRelationshipOrderBuilder(roots, schema)

	tests := []struct {
		name, query, variables, wantQuery string
		wantIDs                           []int
	}{
		{
			name:      "object wrapper alone",
			query:     `query($o:cf_select_items_order_by){cf_select_tags(order_by:{item:$o}){id}}`,
			variables: `{"o":null}`,
			wantQuery: `query{cf_select_tags{id}}`,
		},
		{
			name:      "null wrapper on cached AST",
			query:     `query($o:cf_select_items_order_by){cf_select_tags(order_by:{item:$o,id:desc}){id}}`,
			variables: `{"o":null}`,
			wantQuery: `query{cf_select_tags(order_by:{id:desc}){id}}`,
			wantIDs:   []int{3, 1},
		},
		{
			name:      "non-null wrapper on cached AST",
			query:     `query($o:cf_select_items_order_by){cf_select_tags(order_by:{item:$o,id:desc}){id}}`,
			variables: `{"o":{"id":"asc_nulls_last"}}`,
			wantQuery: `query{cf_select_tags(order_by:{item:{id:asc_nulls_last},id:desc}){id}}`,
			wantIDs:   []int{3, 1},
		},
		{
			name:      "null wrapper replay",
			query:     `query($o:cf_select_items_order_by){cf_select_tags(order_by:{item:$o,id:desc}){id}}`,
			variables: `{"o":null}`,
			wantQuery: `query{cf_select_tags(order_by:{id:desc}){id}}`,
			wantIDs:   []int{3, 1},
		},
		{
			name:      "nested object wrapper",
			query:     `query($o:cf_select_items_order_by){cf_select_tags(order_by:{item:{self:$o,id:asc_nulls_last},id:asc}){id}}`,
			variables: `{"o":null}`,
			wantQuery: `query{cf_select_tags(order_by:{item:{id:asc_nulls_last},id:asc}){id}}`,
			wantIDs:   []int{3, 1},
		},
		{
			name:      "mixed nested object terms",
			query:     `query{cf_select_tags(order_by:[{item:{self:null,item_owner:asc_nulls_last}},{item:{self:{id:asc_nulls_last}}},{id:asc}]){id}}`,
			variables: `{}`,
			wantQuery: `query{cf_select_tags(order_by:[{item:{item_owner:asc_nulls_last}},{item:{self:{id:asc_nulls_last}}},{id:asc}]){id}}`,
			wantIDs:   []int{3, 1},
		},
		{
			name:      "computed sibling after null relationship",
			query:     `query{cf_select_tags(order_by:{item:{self:null,item_tags_aggregate:{count:desc_nulls_last}},id:asc}){id}}`,
			variables: `{}`,
			wantQuery: `query{cf_select_tags(order_by:{item:{item_tags_aggregate:{count:desc_nulls_last}},id:asc}){id}}`,
			wantIDs:   []int{3, 1},
		},
		{
			name:      "fragment null wrapper",
			query:     `query($o:cf_select_items_order_by){cf_select_items{...Sorted}} fragment Sorted on cf_select_items{tags(order_by:{item:$o,id:asc}){id}}`,
			variables: `{"o":null}`,
			wantQuery: `query{cf_select_items{tags(order_by:{id:asc}){id}}}`,
		},
		{
			name:      "relationship aggregate wrapper",
			query:     `query($o:cf_select_tags_aggregate_order_by){cf_select_items(order_by:{tags_aggregate:$o,self:{id:asc}}){id}}`,
			variables: `{"o":null}`,
			wantQuery: `query{cf_select_items(order_by:{self:{id:asc}}){id}}`,
			wantIDs:   []int{2},
		},
		{
			name:      "computed aggregate wrapper",
			query:     `query($o:cf_select_tags_aggregate_order_by){cf_select_items(order_by:{item_tags_aggregate:$o,tags_aggregate:{count:desc}}){id}}`,
			variables: `{"o":null}`,
			wantQuery: `query{cf_select_items(order_by:{tags_aggregate:{count:desc}}){id}}`,
			wantIDs:   []int{2},
		},
		{
			name:      "nested aggregate wrappers",
			query:     `query($o:cf_select_tags_aggregate_order_by){cf_select_tags(order_by:{item:{tags_aggregate:$o,item_tags_aggregate:$o,id:asc_nulls_last},id:asc}){id}}`,
			variables: `{"o":null}`,
			wantQuery: `query{cf_select_tags(order_by:{item:{id:asc_nulls_last},id:asc}){id}}`,
			wantIDs:   []int{3, 1},
		},
		{
			name:      "whole object with mixed wrappers",
			query:     `query($o:cf_select_tags_order_by!){cf_select_tags(order_by:[$o]){id}}`,
			variables: `{"o":{"item":{"self":null,"tags_aggregate":null,"item_tags_aggregate":null,"id":"asc_nulls_last"},"id":"asc"}}`,
			wantQuery: `query{cf_select_tags(order_by:{id:asc,item:{id:asc_nulls_last}}){id}}`,
			wantIDs:   []int{1, 3},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := build(t, tt.query, tt.variables)

			want := build(t, tt.wantQuery, `{}`)
			if diff := cmp.Diff(want, got); diff != "" {
				t.Fatalf("SQL/parameters (-omission +null):\n%s", diff)
			}

			gotData := computedResult(t, pool, got)
			if diff := cmp.Diff(computedResult(t, pool, want), gotData); diff != "" {
				t.Fatalf("result (-omission +null):\n%s", diff)
			}

			if tt.wantIDs != nil {
				wantData := make([]any, 0, len(tt.wantIDs))
				for _, id := range tt.wantIDs {
					wantData = append(wantData, map[string]any{"id": float64(id)})
				}

				if diff := cmp.Diff(wantData, gotData); diff != "" {
					t.Fatalf("permission-filtered order (-want +got):\n%s", diff)
				}
			}
		})
	}

	testInvalidRelationshipOrderInputs(t, roots, schema)
}

func nullableRelationshipOrderBuilder(
	roots queries.Roots,
	schema *ast.Schema,
) func(*testing.T, string, string) core.SQLOperation {
	documents := make(map[string]*ast.QueryDocument)

	return func(t *testing.T, query, provided string) core.SQLOperation {
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

		var before, after bytes.Buffer
		formatter.NewFormatter(&before).FormatQueryDocument(doc)

		original, err := json.Marshal(variables)
		if err != nil {
			t.Fatal(err)
		}

		coerced, err := validator.VariableValues(schema, doc.Operations[0], variables)
		if err != nil {
			t.Fatal(err)
		}

		op := buildImmutableAggregateOrder(t, roots, doc, coerced)
		formatter.NewFormatter(&after).FormatQueryDocument(doc)

		remaining, err := json.Marshal(variables)
		if err != nil {
			t.Fatal(err)
		}

		if before.String() != after.String() || !bytes.Equal(original, remaining) {
			t.Fatal("coercion/build mutated the cached AST or provided variables")
		}

		return op
	}
}

func testInvalidRelationshipOrderInputs(t *testing.T, roots queries.Roots, schema *ast.Schema) {
	t.Helper()

	t.Run("invalid inputs remain rejected", func(t *testing.T) {
		t.Parallel()

		query := `query($o:[cf_select_tags_order_by!]){cf_select_tags(order_by:$o){id}}`

		doc, errs := gqlparser.LoadQueryWithRules(schema, query, rules.NewDefaultRules())
		if len(errs) != 0 {
			t.Fatal(errs)
		}

		tests := []struct{ name, provided string }{
			{"invalid enum sibling", `{"o":[{"item":null,"id":"sideways"}]}`},
			{"invalid nested enum", `{"o":[{"item":{"self":null,"id":"sideways"}}]}`},
			{"unknown null field", `{"o":[{"unknown":null}]}`},
			{"unknown nested null field", `{"o":[{"item":{"unknown":null}}]}`},
			{
				"computed wrapper with user arguments",
				`{"o":[{"item":{"item_tags_with_args_aggregate":null}}]}`,
			},
			{"non-orderable array wrapper", `{"o":[{"item_copies":null}]}`},
			{"nested non-orderable array wrapper", `{"o":[{"item":{"tags":null}}]}`},
			{"non-object wrapper", `{"o":[{"item":"asc"}]}`},
			{"non-null list element", `{"o":[null]}`},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				t.Parallel()

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
					t.Fatalf(
						"expected ErrInvalidArgument without operations, got %v / %v",
						ops,
						err,
					)
				}
			})
		}
	})
}
