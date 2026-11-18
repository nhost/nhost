package queries_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/validator"
	"github.com/vektah/gqlparser/v2/validator/rules"

	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	graphqlschema "github.com/nhost/nhost/services/constellation/connector/sql/graphql/schema"
)

func TestComputedVariableInputs(t *testing.T) {
	t.Parallel()

	roots, pool, objects, md, _ := computedTestFixture(t)
	caps := graphqlschema.NewCapabilities(graphqlschema.KindPostgres, dialect.NewPostgresDialect())
	caps.SupportsComputedScalarSelection = true

	graph, err := graphqlschema.GenerateForRole(objects, "cf_reader", md, caps)
	if err != nil {
		t.Fatalf("GenerateForRole: %v", err)
	}

	_, schema, err := schemamerge.BuildValidatedSchema(graph, "cf_reader")
	if err != nil {
		t.Fatalf("BuildValidatedSchema: %v", err)
	}

	build := func(t *testing.T, query string, provided map[string]any) ([]core.SQLOperation, error) {
		t.Helper()

		document, errs := gqlparser.LoadQueryWithRules(schema, query, rules.NewDefaultRules())
		if len(errs) != 0 {
			t.Fatalf("LoadQueryWithRules: %v", errs)
		}

		variables, err := validator.VariableValues(schema, document.Operations[0], provided)
		if err != nil {
			t.Fatalf("VariableValues: %v", err)
		}

		return roots.BuildQuery(
			document.Operations[0],
			document.Fragments,
			variables,
			"cf_reader",
			nil,
		)
	}

	tests := []struct {
		name      string
		query     string
		variables map[string]any
		wantQuery string
		wantErr   bool
	}{
		{
			name:      "null computed direction",
			query:     `query($d:order_by){cf_select_items(order_by:{item_raises:$d}){id}}`,
			variables: map[string]any{"d": nil},
			wantQuery: `query{cf_select_items{id}}`,
		},
		{
			name:      "null computed direction default",
			query:     `query($d:order_by=null){cf_select_items(order_by:{item_raises:$d,item_owner:desc,id:asc}){id}}`,
			wantQuery: `query{cf_select_items(order_by:{item_owner:desc,id:asc}){id}}`,
		},
		{
			name:      "computed ordering object variable",
			query:     `query($o:cf_select_items_order_by!){cf_select_items(order_by:[$o]){id}}`,
			variables: map[string]any{"o": map[string]any{"item_raises": nil}},
			wantQuery: `query{cf_select_items{id}}`,
		},
		{
			name:      "null column direction through relationship",
			query:     `query($d:order_by){cf_select_tags(order_by:{item:{label:$d,item_owner:desc},id:asc}){id}}`,
			variables: map[string]any{"d": nil},
			wantQuery: `query{cf_select_tags(order_by:{item:{item_owner:desc},id:asc}){id}}`,
		},
		{
			name:      "null computed direction through relationship",
			query:     `query($d:order_by){cf_select_tags(order_by:{item:{item_raises:$d,item_owner:desc},id:asc}){id}}`,
			variables: map[string]any{"d": nil},
			wantQuery: `query{cf_select_tags(order_by:{item:{item_owner:desc},id:asc}){id}}`,
		},
		{
			name:      "computed comparison object",
			query:     `query($comparison:Int_comparison_exp!){cf_select_items(where:{item_owner:$comparison}){id}}`,
			variables: map[string]any{"comparison": map[string]any{"_eq": 1}},
			wantQuery: `query{cf_select_items(where:{item_owner:{_eq:1}}){id}}`,
		},
		{
			name:      "computed comparison list element",
			query:     `query($owner:Int!){cf_select_items(where:{item_owner:{_in:[$owner]}}){id}}`,
			variables: map[string]any{"owner": 1},
			wantQuery: `query{cf_select_items(where:{item_owner:{_in:[1]}}){id}}`,
		},
		{
			name:      "omitted optional SQL argument uses default",
			query:     `query($m:Int){cf_select_items(where:{id:{_eq:1}}){value:item_score(args:{multiplier:$m})}}`,
			wantQuery: `query{cf_select_items(where:{id:{_eq:1}}){value:item_score(args:{})}}`,
		},
		{
			name:      "null optional SQL argument stays null",
			query:     `query($m:Int){cf_select_items(where:{id:{_eq:1}}){value:item_score(args:{multiplier:$m})}}`,
			variables: map[string]any{"m": nil},
			wantQuery: `query{cf_select_items(where:{id:{_eq:1}}){value:item_score(args:{multiplier:null})}}`,
		},
		{
			name:    "omitted required SQL argument is rejected",
			query:   `query($m:Int){cf_select_items(where:{id:{_eq:1}}){value:item_second(args:{multiplier:$m})}}`,
			wantErr: true,
		},
		{
			name:      "null required SQL argument stays null",
			query:     `query($m:Int){cf_select_items(where:{id:{_eq:1}}){value:item_second(args:{multiplier:$m})}}`,
			variables: map[string]any{"m": nil},
			wantQuery: `query{cf_select_items(where:{id:{_eq:1}}){value:item_second(args:{multiplier:null})}}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := build(t, tt.query, tt.variables)
			if tt.wantErr {
				if err == nil || len(got) != 0 {
					t.Fatalf(
						"expected missing SQL argument error without operations, got %v / %v",
						got,
						err,
					)
				}

				return
			}

			if err != nil {
				t.Fatalf("BuildQuery: %v", err)
			}

			want, err := build(t, tt.wantQuery, nil)
			if err != nil {
				t.Fatalf("BuildQuery reference: %v", err)
			}

			normalize(got)
			normalize(want)

			if diff := cmp.Diff(want, got); diff != "" {
				t.Fatalf("computed SQL operations (-literal +variable):\n%s", diff)
			}

			wantData := computedResult(t, pool, want[0])

			gotData := computedResult(t, pool, got[0])
			if diff := cmp.Diff(wantData, gotData); diff != "" {
				t.Errorf("computed result (-literal +variable):\n%s", diff)
			}
		})
	}
}
