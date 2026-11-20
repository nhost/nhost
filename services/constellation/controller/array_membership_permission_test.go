package controller_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/nhost/nhost/services/constellation/controller"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

type arrayPermissionCase struct {
	name, query string
	wantIDs     []int
}

//nolint:paralleltest,tparallel // Sequential mutations reuse one controller and pool within the testdb connection budget.
func TestArrayMembershipPermissionSessionOperand(t *testing.T) {
	t.Parallel()

	pool := testdb.NewPostgres(t, `
CREATE TABLE perm_items (id integer PRIMARY KEY, tags text[], name text);
INSERT INTO perm_items VALUES (1,ARRAY['a'],'original'), (2,ARRAY['b'],'original'),
 (3,ARRAY['a','b'],'original');`)
	md := arrayMembershipPermissionMetadata(pool.Config().ConnConfig.ConnString())

	ctrl, err := newComputedController(t, md, false)
	if err != nil {
		t.Fatal(err)
	}

	if inconsistencies := ctrl.Inconsistencies(); len(inconsistencies) != 0 {
		t.Fatalf("inconsistencies: %+v", inconsistencies)
	}

	router := newTestRouter(t, ctrl)

	tests := []arrayPermissionCase{
		{"select", `{result:perm_items(order_by:{id:asc}){id}}`, nil},
		{"alias_select", `{result:perm_items(order_by:{id:asc}){id}}`, nil},
		{"not_select", `{result:perm_items(order_by:{id:asc}){id}}`, nil},
		{
			"update_filter",
			`mutation{result:update_perm_items(where:{},_set:{name:"changed"}){affected_rows returning{id}}}`,
			nil,
		},
		{
			"delete",
			`mutation{result:delete_perm_items(where:{}){affected_rows returning{id}}}`,
			nil,
		},
		{
			"insert",
			`mutation($tags:[String!]){result:insert_perm_items(objects:{id:4,tags:$tags,name:"changed"}){affected_rows returning{id}}}`,
			[]int{4},
		},
		{
			"update_check",
			`mutation($tags:[String!]){result:update_perm_items(where:{id:{_eq:3}},_set:{tags:$tags,name:"changed"}){affected_rows returning{id}}}`,
			[]int{3},
		},
		{"boolean_select", `{result:perm_items(order_by:{id:asc}){id}}`, []int{1, 2, 3}},
	}
	for _, operator := range []string{"in", "nin"} {
		for _, tt := range tests {
			for _, operand := range []string{"literal", "session"} {
				t.Run(operator+"/"+tt.name+"/"+operand, func(t *testing.T) {
					testArrayMembershipPermissionCase(t, router, pool, operator, operand, tt)
				})
			}
		}
	}

	t.Run("individual candidate session operands", func(t *testing.T) {
		for _, operator := range []string{"in", "nin"} {
			response := arrayPermissionResponse(
				t,
				router,
				"candidate_"+operator,
				controller.GraphQLRequest{
					Query: `{result:perm_items(order_by:{id:asc}){id}}`,
				},
			)

			wantIDs := []int{1, 2}
			if operator == "nin" {
				wantIDs = []int{3}
			}

			assertArrayPermissionIDs(t, response, wantIDs, false)
		}
	})
	t.Run("scalar column session list", func(t *testing.T) {
		response := arrayPermissionResponse(
			t,
			router,
			"scalar_membership",
			controller.GraphQLRequest{
				Query: `{result:perm_items(order_by:{id:asc}){id}}`,
			},
		)
		assertArrayPermissionIDs(t, response, []int{1, 2}, false)
	})
	t.Run("user marker strings remain data", func(t *testing.T) {
		if _, err := pool.Exec(t.Context(), `INSERT INTO perm_items VALUES
 (4,ARRAY['x-hasura-disallowed-tags'],'original')`); err != nil {
			t.Fatal(err)
		}

		for _, role := range []string{"admin", "literal_nin_select"} {
			response := arrayPermissionResponse(t, router, role, controller.GraphQLRequest{
				Query:     `query($xs:[[String!]!]!){result:perm_items(where:{tags:{_in:$xs}},order_by:{id:asc}){id}}`,
				Variables: map[string]any{"xs": "x-hasura-disallowed-tags"},
			})
			assertArrayPermissionIDs(t, response, []int{4}, false)
		}
	})
}

func testArrayMembershipPermissionCase(t *testing.T, router http.Handler,
	pool *pgxpool.Pool, operator, operand string, tt arrayPermissionCase,
) {
	t.Helper()
	t.Cleanup(func() {
		_, err := pool.Exec(context.WithoutCancel(t.Context()), `TRUNCATE perm_items;
INSERT INTO perm_items VALUES (1,ARRAY['a'],'original'), (2,ARRAY['b'],'original'),
 (3,ARRAY['a','b'],'original');`)
		if err != nil {
			t.Errorf("restoring permission fixture: %v", err)
		}
	})

	tags := []string{"a"}
	if operator == "nin" {
		tags = []string{"a", "b"}
	}

	response := arrayPermissionResponse(t, router, operand+"_"+operator+"_"+tt.name,
		controller.GraphQLRequest{Query: tt.query, Variables: map[string]any{"tags": tags}})
	if operand == "session" {
		if response["errors"] == nil || response["data"] != nil {
			t.Fatalf("unsupported session operand must fail the whole request: %+v", response)
		}

		var unchanged bool
		if err := pool.QueryRow(t.Context(), `SELECT count(*) = 3 AND bool_and(name = 'original')
 AND bool_and(tags = CASE id WHEN 1 THEN ARRAY['a'] WHEN 2 THEN ARRAY['b'] ELSE ARRAY['a','b'] END)
 FROM perm_items`).Scan(&unchanged); err != nil {
			t.Fatal(err)
		}

		if !unchanged {
			t.Fatal("rejected request changed rows")
		}

		return
	}

	wantIDs := tt.wantIDs
	if wantIDs == nil {
		wantIDs = []int{1, 2}
		if (operator == "nin") != (tt.name == "not_select") {
			wantIDs = []int{3}
		}
	}

	assertArrayPermissionIDs(t, response, wantIDs, tt.name == "insert" ||
		tt.name == "update_filter" || tt.name == "update_check" || tt.name == "delete")
}

func arrayMembershipPermissionMetadata(databaseURL string) *metadata.Metadata {
	table := metadata.TableMetadata{
		Table: metadata.TableSource{Schema: "public", Name: "perm_items"},
	}

	columns := []string{"id", "tags", "name"}
	for _, operator := range []string{"in", "nin"} {
		for _, kind := range []string{"select", "alias_select", "not_select", "update_filter", "update_check", "insert", "delete", "boolean_select"} {
			for _, operand := range []string{"literal", "session"} {
				role := operand + "_" + operator + "_" + kind

				var value any = []any{[]any{"a"}, []any{"b"}}
				if operand == "session" {
					value = "X-Hasura-Disallowed-Tags"
				}

				filter := map[string]any{"tags": map[string]any{"_" + operator: value}}
				switch kind {
				case "boolean_select":
					// Even an otherwise-true OR branch must not suppress the unsupported operand.
					filter = map[string]any{"_or": []any{map[string]any{}, filter}}
				case "not_select":
					filter = map[string]any{"_not": filter}
				case "alias_select":
					filter = map[string]any{"tags": map[string]any{"$" + operator: value}}
				}

				addArrayMembershipPermission(&table, columns, role, kind, filter)
			}
		}
	}

	for _, operator := range []string{"in", "nin"} {
		table.SelectPermissions = append(table.SelectPermissions, metadata.SelectPermission{
			Role: "candidate_" + operator, Permission: metadata.SelectPermissionConfig{
				Columns: columns,
				Filter: map[string]any{"tags": map[string]any{
					"_" + operator: []any{"x-hasura-candidate", []any{"b"}},
				}},
			},
		})
	}

	table.SelectPermissions = append(table.SelectPermissions, metadata.SelectPermission{
		Role: "scalar_membership", Permission: metadata.SelectPermissionConfig{
			Columns: columns, Filter: map[string]any{"id": map[string]any{"_in": "x-hasura-ids"}},
		},
	})

	md := &metadata.Metadata{Databases: []metadata.DatabaseMetadata{{
		Name: "default", Kind: "postgres", Tables: []metadata.TableMetadata{table},
	}}}
	md.Databases[0].Configuration.ConnectionInfo.DatabaseURL = metadata.EnvString(databaseURL)

	return md
}

func addArrayMembershipPermission(table *metadata.TableMetadata, columns []string,
	role, kind string, filter map[string]any,
) {
	selectFilter := map[string]any{}
	switch kind {
	case "update_filter":
		table.UpdatePermissions = append(table.UpdatePermissions, metadata.UpdatePermission{
			Role:       role,
			Permission: metadata.UpdatePermissionConfig{Columns: columns, Filter: filter},
		})
	case "update_check":
		table.UpdatePermissions = append(table.UpdatePermissions, metadata.UpdatePermission{
			Role:       role,
			Permission: metadata.UpdatePermissionConfig{Columns: columns, Check: filter},
		})
	case "insert":
		table.InsertPermissions = append(table.InsertPermissions, metadata.InsertPermission{
			Role:       role,
			Permission: metadata.InsertPermissionConfig{Columns: columns, Check: filter},
		})
	case "delete":
		table.DeletePermissions = append(table.DeletePermissions, metadata.DeletePermission{
			Role: role, Permission: metadata.DeletePermissionConfig{Filter: filter},
		})
	default:
		selectFilter = filter
	}

	table.SelectPermissions = append(table.SelectPermissions, metadata.SelectPermission{
		Role:       role,
		Permission: metadata.SelectPermissionConfig{Columns: columns, Filter: selectFilter},
	})
}

func arrayPermissionResponse(t *testing.T, router http.Handler, role string,
	request controller.GraphQLRequest,
) map[string]any {
	t.Helper()

	payload, err := json.Marshal(request)
	if err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPost, "/graphql", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)
	req.Header.Set("X-Hasura-Role", role)
	req.Header.Set("X-Hasura-Disallowed-Tags", "{{a},{b}}")
	req.Header.Set("X-Hasura-Candidate", "{a}")
	req.Header.Set("X-Hasura-Ids", "{1,2}")

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("HTTP %d: %s", recorder.Code, recorder.Body.String())
	}

	return readJSONBody(t, recorder)
}

func assertArrayPermissionIDs(t *testing.T, response map[string]any, wantIDs []int, mutation bool) {
	t.Helper()

	if response["errors"] != nil || response["data"] == nil {
		t.Fatalf("request failed: %+v", response)
	}

	data, ok := response["data"].(map[string]any)
	if !ok {
		t.Fatalf("invalid data: %+v", response)
	}

	result := data["result"]
	if mutation {
		value, ok := result.(map[string]any)
		if !ok || value["affected_rows"] != float64(len(wantIDs)) {
			t.Fatalf("incorrect mutation result: %+v", result)
		}

		result = value["returning"]
	}

	rows, ok := result.([]any)
	if !ok {
		t.Fatalf("invalid rows: %+v", result)
	}

	ids := make([]int, 0, len(rows))
	for _, row := range rows {
		value, ok := row.(map[string]any)
		if !ok {
			t.Fatalf("invalid row: %+v", row)
		}

		id, ok := value["id"].(float64)
		if !ok {
			t.Fatalf("invalid id: %+v", value)
		}

		ids = append(ids, int(id))
	}

	slices.Sort(ids)

	if diff := cmp.Diff(wantIDs, ids); diff != "" {
		t.Errorf("IDs (-want +got):\n%s", diff)
	}
}
