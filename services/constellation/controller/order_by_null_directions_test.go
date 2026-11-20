package controller_test

import (
	"fmt"
	"maps"
	"testing"

	"github.com/nhost/nhost/services/constellation/controller"
)

func testRemoteInputNullDirections(t *testing.T, ctrl *controller.Controller) {
	t.Helper()

	router := newTestRouter(t, ctrl)

	tests := []struct {
		name, definitions, orderBy, direction string
		variables                             map[string]any
		wantError                             string
	}{
		{"null leaf", "$d:order_by=desc", "{id:$d}", "", map[string]any{"d": nil}, ""},
		{"default on warm document", "$d:order_by=desc", "{id:$d}", "desc", nil, ""},
		{
			"provided on warm document",
			"$d:order_by=desc",
			"{id:$d}",
			"asc",
			map[string]any{"d": "asc"},
			"",
		},
		{
			"null on warm document",
			"$d:order_by=desc",
			"{id:$d}",
			"",
			map[string]any{"d": nil},
			"",
		},
		{"omitted leaf", "$d:order_by", "{id:$d}", "", nil, ""},
		{"null leaf default", "$d:order_by=null", "{id:$d}", "", nil, ""},
		{
			"mixed directions",
			"$d:order_by",
			"[{label:$d,id:desc},{owner:asc}]",
			"desc",
			map[string]any{"d": nil},
			"",
		},
		{
			"whole object", "$o:optional_input_kids_order_by!", "[$o]", "",
			map[string]any{"o": map[string]any{"id": nil}},
			"",
		},
		{
			"whole list", "$o:[optional_input_kids_order_by!]!", "$o", "desc",
			map[string]any{"o": []any{map[string]any{"label": nil}, map[string]any{"id": "desc"}}},
			"",
		},
		{
			"invalid enum", "$d:order_by", "{id:$d}", "",
			map[string]any{"d": "invalid"},
			"invalid is not a valid order_by",
		},
		{
			"required null leaf", "$d:order_by!", "{id:$d}", "",
			map[string]any{"d": nil},
			"cannot be null",
		},
		{
			"required null overrides default", "$d:order_by!=desc", "{id:$d}", "",
			map[string]any{"d": nil},
			"cannot be null",
		},
		{"required missing leaf", "$d:order_by!", "{id:$d}", "", nil, "must be defined"},
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
								"where": map[string]any{"_and": []any{
									map[string]any{"owner": map[string]any{"_in": parents}},
									map[string]any{"label": map[string]any{"_neq": "other"}},
								}},
								"limit": 10,
							}
							maps.Copy(variables, tt.variables)

							response := nullableOrderByResponse(
								t,
								router,
								role,
								controller.GraphQLRequest{
									Query: nullableOrderingQuery(
										field,
										parents,
										tt.definitions,
										tt.orderBy,
									),
									Variables: variables,
								},
							)
							if tt.wantError != "" {
								assertVariableValidationError(t, map[string]any{
									"data": response.Data, "errors": response.Errors,
								}, tt.wantError, "variable", "d")

								return
							}

							checkNullableOrderByResponse(
								t,
								response,
								nullableOrderByData(
									field,
									parents,
									role,
									tt.direction,
								),
								tt.direction,
								false,
							)
						},
					)
				}
			}
		}
	}
}
