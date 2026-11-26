package controller_test

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/nhost/nhost/services/constellation/controller"
)

func testRemoteInputNullWhere(t *testing.T, ctrl *controller.Controller) {
	t.Helper()

	router := newTestRouter(t, ctrl)

	tests := []struct {
		name       string
		definition string
		variables  map[string]any
		label      string
		wantError  string
	}{
		{
			"null overrides default", `={label:{_eq:"keep"}}`,
			map[string]any{"where": nil},
			"", "",
		},
		{
			"concrete on warm document", `={label:{_eq:"keep"}}`,
			map[string]any{"where": map[string]any{"label": map[string]any{"_eq": "other"}}},
			"other", "",
		},
		{
			"null on warm document", `={label:{_eq:"keep"}}`,
			map[string]any{"where": nil},
			"", "",
		},
		{"default on warm document", `={label:{_eq:"keep"}}`, nil, "keep", ""},
		{"null default", "=null", nil, "", ""},
		{"omitted", "", nil, "", ""},
		{"required null", "!", map[string]any{"where": nil}, "", "cannot be null"},
		{"required missing", "!", nil, "", "must be defined"},
		{
			"invalid nested null", "",
			map[string]any{"where": map[string]any{"_and": []any{nil}}},
			"", "cannot be null",
		},
	}
	for _, role := range []string{"admin", "reader"} {
		for _, parents := range []int{1, 2} {
			for _, window := range []bool{false, true} {
				for _, tt := range tests {
					t.Run(
						fmt.Sprintf("%s/parents=%d/window=%t/%s", role, parents, window, tt.name),
						func(t *testing.T) {
							// Check literal null first, including exact joined rows and permissions.
							baseline := nullableOrderByResponse(
								t,
								router,
								role,
								controller.GraphQLRequest{
									Query: remoteNullWhereQuery(parents, window, "", "null"),
								},
							)
							checkRemoteNullWhereData(
								t,
								baseline,
								remoteNullWhereData(role, parents, window, ""),
							)

							response := nullableOrderByResponse(
								t,
								router,
								role,
								controller.GraphQLRequest{
									Query: remoteNullWhereQuery(
										parents,
										window,
										"$where:optional_input_kids_bool_exp"+tt.definition,
										"$where",
									),
									Variables: tt.variables,
								},
							)
							if tt.wantError != "" {
								if !strings.Contains(fmt.Sprint(response.Errors), tt.wantError) ||
									response.Data != nil {
									t.Fatalf("expected input error without data, got %+v", response)
								}

								return
							}

							checkRemoteNullWhereData(
								t,
								response,
								remoteNullWhereData(role, parents, window, tt.label),
							)
						},
					)
				}
			}
		}
	}

	t.Run("concurrent cache", func(t *testing.T) { testRemoteNullWhereCache(t, router) })
}

func testRemoteNullWhereCache(t *testing.T, router http.Handler) {
	t.Helper()

	// The same cached query and fragment must also isolate concurrent null and
	// concrete filters. Parallel children complete before this fixture is mutated.
	for i := range 12 {
		t.Run(strconv.Itoa(i), func(t *testing.T) {
			t.Parallel()

			role := "admin"
			if i%2 != 0 {
				role = "reader"
			}

			label := ""

			var where any
			if i%3 == 0 {
				label = "other"
				where = map[string]any{"label": map[string]any{"_eq": label}}
			}

			window := i%4 < 2
			response := nullableOrderByResponse(t, router, role, controller.GraphQLRequest{
				Query: remoteNullWhereQuery(2, window,
					`$where:optional_input_kids_bool_exp={label:{_eq:"keep"}}`, "$where"),
				Variables: map[string]any{"where": where},
			})
			checkRemoteNullWhereData(t, response, remoteNullWhereData(role, 2, window, label))
		})
	}
}

func remoteNullWhereQuery(parents int, window bool, definition, where string) string {
	if definition != "" {
		definition = "(" + definition + ")"
	}

	args := "where:" + where + ",order_by:{id:asc}"
	if window {
		args += ",limit:2,offset:1"
	}

	return fmt.Sprintf(`query Q%s {
 parents:optional_input_parents(where:{id:{_lte:%d}},order_by:{id:asc}) { id ...Kids }
} fragment Kids on optional_input_parents { kids:remote_kids(%s) { id } }`, definition, parents, args)
}

func remoteNullWhereData(role string, parents int, window bool, label string) map[string]any {
	rows := make([]any, 0, parents)
	for parent := 1; parent <= parents; parent++ {
		ids := []int{parent*100 + 1, parent*100 + 2}
		if role == "admin" {
			ids = append(ids, parent*100+3)
		}

		switch label {
		case "keep":
			ids = []int{parent*100 + 1}
		case "other":
			ids = []int{parent*100 + 2}
		}

		if window {
			ids = ids[1:]
		}

		kids := make([]any, 0, len(ids))
		for _, id := range ids {
			kids = append(kids, map[string]any{"id": float64(id)})
		}

		rows = append(rows, map[string]any{"id": float64(parent), "kids": kids})
	}

	return map[string]any{"parents": rows}
}

func checkRemoteNullWhereData(
	t *testing.T,
	response *controller.GraphQLResponse,
	want map[string]any,
) {
	t.Helper()

	if response.Errors != nil {
		t.Fatalf("unexpected errors: %+v", response)
	}

	if diff := cmp.Diff(want, response.Data); diff != "" {
		t.Errorf("remote filter result (-want +got):\n%s", diff)
	}
}
