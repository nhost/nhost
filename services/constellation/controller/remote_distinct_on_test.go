package controller_test

import (
	"context"
	"fmt"
	"maps"
	"reflect"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/nhost/nhost/services/constellation/controller"
)

func testRemoteInputNullDistinct(t *testing.T, ctrl *controller.Controller) {
	t.Helper()

	router := newTestRouter(t, ctrl)

	tests := []struct {
		name       string
		definition string
		argument   string
		variables  map[string]any
		distinct   bool
		invalid    bool
	}{
		{"null overrides default", "=[owner]", "$d", map[string]any{"d": nil}, false, false},
		{"default on warm document", "=[owner]", "$d", nil, true, false},
		{"singleton on warm document", "=[owner]", "$d", map[string]any{"d": "owner"}, true, false},
		{
			"list on warm document",
			"=[owner]",
			"$d",
			map[string]any{"d": []any{"owner"}},
			true,
			false,
		},
		{"null on warm document", "=[owner]", "$d", map[string]any{"d": nil}, false, false},
		{"null default", "=null", "$d", nil, false, false},
		{"omitted", "", "$d", nil, false, false},
		{"empty list", "", "$d", map[string]any{"d": []any{}}, false, false},
		{"literal null", "", "null", nil, false, false},
		{"required null", "!", "$d", map[string]any{"d": nil}, false, true},
		{"null element", "", "$d", map[string]any{"d": []any{nil}}, false, true},
	}
	for _, role := range []string{"admin", "reader"} {
		for _, parents := range [][]int{{1}, {1, 2}} {
			for _, field := range []string{
				"optional_input_kids", "optional_input_kids_aggregate",
				"remote_kids", "remote_kids_aggregate",
			} {
				for _, tt := range tests {
					t.Run(
						fmt.Sprintf("%s/%v/%s/%s", role, parents, field, tt.name),
						func(t *testing.T) {
							variables := map[string]any{
								"where": map[string]any{"owner": map[string]any{"_in": parents}},
							}
							maps.Copy(variables, tt.variables)

							response := nullableOrderByResponse(
								t,
								router,
								role,
								controller.GraphQLRequest{
									Query: nullableDistinctOnQuery(
										field,
										parents,
										tt.definition,
										tt.argument,
									),
									Variables: variables,
								},
							)
							checkNullableDistinctOnResponse(
								t,
								response,
								nullableDistinctOnData(
									field,
									parents,
									role,
									tt.distinct,
								),
								tt.invalid,
							)
						},
					)
				}
			}
		}
	}
}

func checkNullableDistinctOnResponse(
	t *testing.T, response *controller.GraphQLResponse, want map[string]any, invalid bool,
) {
	t.Helper()

	if invalid {
		if response.Errors == nil || response.Data != nil {
			t.Fatalf("expected input errors without data, got %+v", response)
		}

		return
	}

	if response.Errors != nil {
		t.Fatalf("response=%+v", response)
	}

	if diff := cmp.Diff(want, response.Data); diff != "" {
		t.Errorf("distinct result (-want +got):\n%s", diff)
	}
}

func nullableDistinctOnQuery(field string, parents []int, definition, argument string) string {
	definitions := "($where:optional_input_kids_bool_exp!"
	if argument == "$d" {
		definitions += ",$d:[optional_input_kids_select_column!]" + definition
	}

	definitions += ")"

	selection := "id"
	if strings.HasSuffix(field, "_aggregate") {
		selection = "aggregate { count } nodes { id }"
	}

	result := fmt.Sprintf(
		"result:%s(where:$where,distinct_on:%s,order_by:[{owner:asc},{id:asc}],limit:10,offset:0) { %s }",
		field,
		argument,
		selection,
	)
	if strings.HasPrefix(field, "remote_") {
		parentList := "[1]"
		if len(parents) == 2 {
			parentList = "[1,2]"
		}

		return fmt.Sprintf(`query Q%s {
 parents:optional_input_parents(where:{id:{_in:%s}},order_by:{id:asc}) { id ...Kids }
} fragment Kids on optional_input_parents { %s }`, definitions, parentList, result)
	}

	return "query Q" + definitions + " { " + result + " }"
}

func nullableDistinctOnData(
	field string,
	parents []int,
	role string,
	distinct bool,
) map[string]any {
	result := func(rows []any) any {
		if strings.HasSuffix(field, "_aggregate") {
			return map[string]any{
				"aggregate": map[string]any{"count": float64(len(rows))}, "nodes": rows,
			}
		}

		return rows
	}

	var allRows []any

	parentRows := make([]any, 0, len(parents))
	for _, parent := range parents {
		ids := []int{parent*100 + 1}
		if !distinct {
			ids = append(ids, parent*100+2)
			if role == "admin" {
				ids = append(ids, parent*100+3)
			}
		}

		rows := make([]any, 0, len(ids))
		for _, id := range ids {
			rows = append(rows, map[string]any{"id": float64(id)})
		}

		allRows = append(allRows, rows...)
		parentRows = append(
			parentRows,
			map[string]any{"id": float64(parent), "result": result(rows)},
		)
	}

	if strings.HasPrefix(field, "remote_") {
		return map[string]any{"parents": parentRows}
	}

	return map[string]any{"result": result(allRows)}
}

func testRemoteInputNullDistinctMutation(
	t *testing.T,
	ctrl *controller.Controller,
	pool *pgxpool.Pool,
) {
	t.Helper()

	t.Cleanup(func() {
		if _, err := pool.Exec(context.Background(), `DELETE FROM optional_input.parents WHERE id=9;
DELETE FROM optional_input.kids WHERE owner=9`); err != nil {
			t.Error(err)
		}
	})

	if _, err := pool.Exec(t.Context(), `INSERT INTO optional_input.kids VALUES
 (901,9,'keep',true),(902,9,'other',true),(903,9,'hidden',false)`); err != nil {
		t.Fatal(err)
	}

	router := newTestRouter(t, ctrl)
	for _, field := range []string{"remote_kids", "remote_kids_aggregate"} {
		t.Run(field, func(t *testing.T) {
			if _, err := pool.Exec(
				t.Context(),
				`DELETE FROM optional_input.parents WHERE id=9`,
			); err != nil {
				t.Fatal(err)
			}

			selection := "id"

			var result any = []any{
				map[string]any{"id": float64(901)},
				map[string]any{"id": float64(902)},
				map[string]any{"id": float64(903)},
			}
			if strings.HasSuffix(field, "_aggregate") {
				selection = "aggregate { count } nodes { id }"
				result = map[string]any{
					"aggregate": map[string]any{"count": float64(3)}, "nodes": result,
				}
			}

			response := nullableOrderByResponse(t, router, "admin", controller.GraphQLRequest{
				Query: fmt.Sprintf(`mutation M($d:[optional_input_kids_select_column!]=[owner]) {
 insert_optional_input_parents_one(object:{id:9}) {
  id %s(distinct_on:$d,order_by:[{owner:asc},{id:asc}]) { %s }
 }
}`, field, selection),
				Variables: map[string]any{"d": nil},
			})

			want := map[string]any{"insert_optional_input_parents_one": map[string]any{
				"id": float64(9), field: result,
			}}
			if response.Errors != nil {
				t.Errorf("mutation response=%+v", response)
			} else if diff := cmp.Diff(want, response.Data); diff != "" {
				t.Errorf("mutation response (-want +got):\n%s", diff)
			}

			var ids []int
			if err := pool.QueryRow(t.Context(), `SELECT array_agg(id ORDER BY id) FROM optional_input.parents`).
				Scan(&ids); err != nil {
				t.Fatal(err)
			}

			if !reflect.DeepEqual(ids, []int{1, 2, 9}) {
				t.Fatalf("source rows: %v, want exactly [1 2 9]", ids)
			}
		})
	}
}
