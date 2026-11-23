package queries_test

import (
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/validator"
	"github.com/vektah/gqlparser/v2/validator/rules"

	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
)

func singletonArrayMembershipCases() []arrayMembershipCase {
	inputs := []struct {
		name        string
		definitions string
		where       string
		variables   string
		wantParams  []any
		wantIDs     []int
	}{
		{
			name: "explicit nested control", definitions: "($xs:[[String!]!]!)",
			where: `{tags:{%s:$xs}}`, variables: `{"xs":[["a"]]}`,
			wantParams: []any{[]any{"a"}}, wantIDs: []int{10},
		},
		{
			name: "explicit nested array looking strings", definitions: "($xs:[[String!]!]!)",
			where: `{tags:{%s:$xs}}`, variables: `{"xs":[["{}"],["{a}"],["{a,b}"]]}`,
			wantParams: []any{[]any{"{}"}, []any{"{a}"}, []any{"{a,b}"}}, wantIDs: []int{7, 8, 9},
		},
		{
			name: "flat list", definitions: "($xs:[[String!]!]!)",
			where: `{tags:{%s:$xs}}`, variables: `{"xs":["a","b"]}`,
			wantParams: []any{[]any{"a"}, []any{"b"}}, wantIDs: []int{2, 10},
		},
		{
			name: "recursive scalar", definitions: "($xs:[[String!]!]!)",
			where: `{tags:{%s:$xs}}`, variables: `{"xs":"a"}`,
			wantParams: []any{[]any{"a"}}, wantIDs: []int{10},
		},
		{
			name: "empty array looking string", definitions: "($xs:[[String!]!]!)",
			where: `{tags:{%s:$xs}}`, variables: `{"xs":["{}"]}`,
			wantParams: []any{[]any{"{}"}}, wantIDs: []int{7},
		},
		{
			name: "singleton array looking string", definitions: "($xs:[[String!]!]!)",
			where: `{tags:{%s:$xs}}`, variables: `{"xs":["{a}"]}`,
			wantParams: []any{[]any{"{a}"}}, wantIDs: []int{8},
		},
		{
			name: "multiple element array looking string", definitions: "($xs:[[String!]!]!)",
			where: `{tags:{%s:$xs}}`, variables: `{"xs":["{a,b}"]}`,
			wantParams: []any{[]any{"{a,b}"}}, wantIDs: []int{9},
		},
		{
			name: "comparison object", definitions: "($cmp:String_array_comparison_exp!)",
			where: `{tags:$cmp}`, variables: `{"cmp":{"%s":["{}",["z"]]}}`,
			wantParams: []any{[]any{"{}"}, []any{"z"}}, wantIDs: []int{4, 7},
		},
		{
			name: "whole where scalar", definitions: "($w:items_bool_exp!)",
			where: `$w`, variables: `{"w":{"tags":{"%s":"{a}"}}}`,
			wantParams: []any{[]any{"{a}"}}, wantIDs: []int{8},
		},
		{
			name: "recursive scalar default", definitions: `($xs:[[String!]!]!= "a")`,
			where: `{tags:{%s:$xs}}`, variables: `{}`,
			wantParams: []any{[]any{"a"}}, wantIDs: []int{10},
		},
		{
			name: "flat default", definitions: `($xs:[[String!]!]!= ["a","b"])`,
			where: `{tags:{%s:$xs}}`, variables: `{}`,
			wantParams: []any{[]any{"a"}, []any{"b"}}, wantIDs: []int{2, 10},
		},
		{
			name:        "comparison default",
			definitions: `($cmp:String_array_comparison_exp!={%s:["{a,b}"]})`,
			where:       `{tags:$cmp}`,
			variables:   `{}`,
			wantParams:  []any{[]any{"{a,b}"}},
			wantIDs:     []int{9},
		},
		{
			name: "mixed literal and variable", definitions: "($tags:[String!]!)",
			where: `{tags:{%s:["{}",$tags,[],"b"]}}`, variables: `{"tags":["a","b"]}`,
			wantParams: []any{[]any{"{}"}, []any{"a", "b"}, []any{}, []any{"b"}},
			wantIDs:    []int{1, 2, 3, 7},
		},
		{
			name: "inline recursive scalar", where: `{tags:{%s:"{a,b}"}}`, variables: `{}`,
			wantParams: []any{[]any{"{a,b}"}}, wantIDs: []int{9},
		},
		{
			name: "nested variable scalar", definitions: "($tags:[String!]!)",
			where: `{tags:{%s:[$tags]}}`, variables: `{"tags":"{a}"}`,
			wantParams: []any{[]any{"{a}"}}, wantIDs: []int{8},
		},
	}

	cases := make([]arrayMembershipCase, 0, 2*len(inputs))
	for _, input := range inputs {
		for _, operator := range []string{"_in", "_nin"} {
			comparison, separator := " = ", " OR "

			ids := input.wantIDs
			if operator == "_nin" {
				comparison, separator = " != ", " AND "
				ids = slices.DeleteFunc([]int{1, 2, 3, 4, 6, 7, 8, 9, 10}, func(id int) bool {
					return slices.Contains(input.wantIDs, id)
				})
			}

			predicates := make([]string, len(input.wantParams))
			for i := range predicates {
				predicates[i] = fmt.Sprintf(`"public"."items"."tags"%s$%d::text[]`, comparison, i+1)
			}

			cases = append(cases, arrayMembershipCase{
				name:          input.name + "/" + operator,
				definitions:   strings.ReplaceAll(input.definitions, "%s", operator),
				where:         strings.ReplaceAll(input.where, "%s", operator),
				variables:     strings.ReplaceAll(input.variables, "%s", operator),
				wantPredicate: "(" + strings.Join(predicates, separator) + ")",
				wantParams:    input.wantParams, wantIDs: ids,
			})
		}
	}

	return cases
}

func TestArrayColumnMembershipSingletonSQL(t *testing.T) {
	t.Parallel()

	roots, schema := arrayMembershipRoots(t)
	for _, tt := range singletonArrayMembershipCases() {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			query := "query" + tt.definitions + "{items(where:" + tt.where + "){id}}"

			built := buildVariableInput(t, roots, schema, query, tt.variables)
			if len(built) != 1 {
				t.Fatalf("expected one operation, got %d", len(built))
			}

			if !strings.Contains(built[0].SQL, tt.wantPredicate) {
				t.Errorf("SQL %s does not contain %s", built[0].SQL, tt.wantPredicate)
			}

			if diff := cmp.Diff(tt.wantParams, built[0].Parameters); diff != "" {
				t.Errorf("parameters (-want +got):\n%s", diff)
			}
		})
	}
}

//nolint:tparallel // Sequential mutation subtests share one fixture and pool to respect the connection budget.
func TestArrayColumnMembershipSingletonExecution(t *testing.T) {
	t.Parallel()

	seed := testdb.NewPostgres(
		t,
		`CREATE TABLE items (id int4 PRIMARY KEY, tags text[], name text);`,
	)

	pool, err := postgres.Open(t.Context(), seed.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatalf("Open: %v", err)
	}

	client := postgres.NewClient(pool)
	t.Cleanup(client.Close)

	testArrayMembershipCases(t, singletonArrayMembershipCases(), pool, client, `TRUNCATE items;
		INSERT INTO items VALUES (1,ARRAY['a','b'],'first'), (2,ARRAY['b'],'second'),
		(3,'{}','empty'), (4,ARRAY['z'],'other'), (5,NULL,'null'), (6,ARRAY['a','b','c'],'longer'),
		(7,ARRAY['{}'],'brace empty'), (8,ARRAY['{a}'],'brace singleton'),
		(9,ARRAY['{a,b}'],'brace pair'), (10,ARRAY['a'],'singleton');`)
	testArrayMembershipPermissions(t, pool, client)
}

func testArrayMembershipPermissions(t *testing.T, pool postgres.Pool, client *postgres.Client) {
	t.Helper()

	operations := []struct {
		name     string
		template string
	}{
		{"read", "query%s{items(where:%s,order_by:{id:asc}){id}}"},
		{
			"update",
			`mutation%s{update_items(where:%s,_set:{name:"updated"}){affected_rows returning{id}}}`,
		},
		{"delete", "mutation%s{delete_items(where:%s){affected_rows returning{id}}}"},
	}

	memberRoots, memberSchema := arrayMembershipRootsForRole(t, "member")
	for _, operator := range []string{"_in", "_nin"} {
		for _, operation := range operations {
			t.Run("permission/"+operator+"/"+operation.name, func(t *testing.T) {
				if err := pool.Exec(t.Context(), `TRUNCATE items;
					INSERT INTO items VALUES (1,ARRAY['{a,b}'],'forbidden'),
					(2,ARRAY['{a,b}'],'allowed'), (3,ARRAY['a','b'],'different');`); err != nil {
					t.Fatalf("reset permission fixture: %v", err)
				}

				query := fmt.Sprintf(
					operation.template,
					"($xs:[[String!]!]!)",
					"{tags:{"+operator+":$xs}}",
				)

				document, errs := gqlparser.LoadQueryWithRules(
					memberSchema,
					query,
					rules.NewDefaultRules(),
				)
				if len(errs) != 0 {
					t.Fatalf("LoadQueryWithRules: %v", errs)
				}

				variables, err := validator.VariableValues(
					memberSchema,
					document.Operations[0],
					map[string]any{
						"xs": []any{"{a,b}"},
					},
				)
				if err != nil {
					t.Fatalf("VariableValues: %v", err)
				}

				built, err := memberRoots.BuildQuery(
					document.Operations[0],
					document.Fragments,
					variables,
					"member",
					nil,
				)
				if err != nil {
					t.Fatalf("BuildQuery: %v", err)
				}

				result, err := client.ExecuteOperations(
					t.Context(),
					built,
					slog.New(slog.DiscardHandler),
				)
				if err != nil {
					t.Fatalf("ExecuteOperations: %v", err)
				}

				wantIDs := []int{2}
				if operator == "_nin" {
					wantIDs = []int{3}
				}

				assertArrayMembershipResult(t, result, wantIDs)
			})
		}
	}
}

func TestArrayColumnMembershipRejectsNullCandidates(t *testing.T) {
	t.Parallel()

	_, schema := arrayMembershipRoots(t)
	query := `query($xs:[[String!]!]!){items(where:{tags:{_in:$xs}}){id}}`

	document, errs := gqlparser.LoadQueryWithRules(schema, query, rules.NewDefaultRules())
	if len(errs) != 0 {
		t.Fatalf("LoadQueryWithRules: %v", errs)
	}

	tests := []struct {
		name  string
		value any
	}{
		{"null operand", nil},
		{"null candidate", []any{nil}},
		{"null element", []any{[]any{nil}}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if _, err := validator.VariableValues(
				schema,
				document.Operations[0],
				map[string]any{"xs": tt.value},
			); err == nil {
				t.Fatal("VariableValues accepted null at a non-null position")
			}
		})
	}
}
