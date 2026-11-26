package controller_test

import (
	"bytes"
	"encoding/json"
	"fmt"
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

const jsonbSessionFixture = `TRUNCATE json_items;
INSERT INTO json_items VALUES (1,'{}','original'),(2,'"x-hasura-json"','original'),
 (3,'"{}"','original'),(4,'"hello"','original'),(5,NULL,'original');`

//nolint:paralleltest,tparallel // Sequential requests share cached role schemas, permission templates and one pool.
func TestJSONBPermissionSessionsHTTP(t *testing.T) {
	t.Parallel()
	pool := testdb.NewPostgres(
		t,
		`CREATE TABLE json_items(id int PRIMARY KEY, data jsonb, name text);`,
		jsonbSessionFixture,
	)

	ctrl, err := newComputedController(
		t,
		jsonbSessionMetadata(pool.Config().ConnConfig.ConnString()),
		false,
	)
	if err != nil {
		t.Fatal(err)
	}

	if got := ctrl.Inconsistencies(); len(got) != 0 {
		t.Fatalf("inconsistencies: %+v", got)
	}

	router := newTestRouter(t, ctrl)

	tests := []struct{ name, query string }{
		{"select", `{result:json_items(order_by:{id:asc}){id}}`},
		{
			"update_filter",
			`mutation{result:update_json_items(where:{},_set:{name:"changed"}){affected_rows returning{id}}}`,
		},
		{"delete", `mutation{result:delete_json_items(where:{}){affected_rows returning{id}}}`},
	}
	for _, op := range []string{"eq", "contains", "contained_in", "in", "nin"} {
		for _, tt := range tests {
			t.Run(op+"/"+tt.name, func(t *testing.T) {
				testJSONBPermissionFilter(t, pool, router, op, tt.name, tt.query)
			})
		}

		for _, kind := range []string{"insert", "update_check"} {
			t.Run(op+"/"+kind, func(t *testing.T) {
				testJSONBPermissionCheck(t, pool, router, op, kind)
			})
		}
	}

	t.Run("user marker strings are data", func(t *testing.T) {
		testJSONBUserSessionStrings(t, pool, router)
	})
	t.Run("whole-list session wire arrays", func(t *testing.T) {
		resetJSONBSessionRows(t, pool)

		var wire string
		if err := pool.QueryRow(t.Context(), `SELECT ARRAY['{}'::jsonb,'"hello"'::jsonb]::text`).
			Scan(&wire); err != nil {
			t.Fatal(err)
		}

		for _, op := range []string{"in", "nin"} {
			wantIDs := []int{1, 4}
			if op == "nin" {
				wantIDs = []int{2, 3}
			}

			request := controller.GraphQLRequest{
				Query: `{result:json_items(order_by:{id:asc}){id}}`,
			}
			response := jsonbSessionResponse(t, router, "whole_"+op, &wire, request)
			assertArrayPermissionIDs(t, response, wantIDs, false)
			assertJSONBSessionError(t, jsonbSessionResponse(t, router, "whole_"+op, nil, request))
		}
	})
}

func testJSONBPermissionFilter(
	t *testing.T,
	pool *pgxpool.Pool,
	router http.Handler,
	op, kind, query string,
) {
	t.Helper()

	for _, session := range []*string{new(`{}`), nil, new(`"hello"`), new(`{}`)} {
		resetJSONBSessionRows(t, pool)
		before := jsonbSessionRows(t, pool)

		response := jsonbSessionResponse(
			t,
			router,
			op+"_"+kind,
			session,
			controller.GraphQLRequest{Query: query},
		)
		if session == nil {
			assertJSONBSessionError(t, response)

			if diff := cmp.Diff(before, jsonbSessionRows(t, pool)); diff != "" {
				t.Fatalf("missing session changed rows: %s", diff)
			}

			continue
		}

		wantIDs := []int{1}
		if *session == `"hello"` {
			wantIDs = []int{4}
		}

		if op == "nin" {
			wantIDs = []int{2, 3, 4}
			if *session == `"hello"` {
				wantIDs = []int{1, 2, 3}
			}
		}

		assertArrayPermissionIDs(t, response, wantIDs, kind != "select")

		wantStored := make([]map[string]any, 0, len(before))
		for _, row := range before {
			id, ok := row["id"].(float64)
			if !ok {
				t.Fatalf("unexpected stored id: %v", row["id"])
			}

			selected := slices.Contains(wantIDs, int(id))
			if selected && kind == "delete" {
				continue
			}

			if selected && kind == "update_filter" {
				row["name"] = "changed"
			}

			wantStored = append(wantStored, row)
		}

		if diff := cmp.Diff(wantStored, jsonbSessionRows(t, pool)); diff != "" {
			t.Fatalf("persisted rows (-want +got): %s", diff)
		}
	}
}

func testJSONBPermissionCheck(
	t *testing.T,
	pool *pgxpool.Pool,
	router http.Handler,
	op, kind string,
) {
	t.Helper()

	for _, allowed := range []bool{true, false} {
		resetJSONBSessionRows(t, pool)
		before := jsonbSessionRows(t, pool)

		var value any = map[string]any{}
		if allowed == (op == "nin") {
			value = "x-hasura-json"
		}

		query := `mutation($v:jsonb){result:insert_json_items(objects:{id:6,data:$v,name:"new"}){affected_rows returning{id}}}`

		wantIDs := []int{6}
		if kind == "update_check" {
			query = `mutation($v:jsonb){result:update_json_items(where:{id:{_eq:1}},_set:{data:$v}){affected_rows returning{id}}}`
			wantIDs = []int{1}
		}

		response := jsonbSessionResponse(
			t,
			router,
			op+"_"+kind,
			new(`{}`),
			controller.GraphQLRequest{
				Query:     query,
				Variables: map[string]any{"v": value},
			},
		)
		if !allowed {
			assertJSONBSessionError(t, response)

			if diff := cmp.Diff(before, jsonbSessionRows(t, pool)); diff != "" {
				t.Fatalf("failed check changed rows: %s", diff)
			}

			continue
		}

		assertArrayPermissionIDs(t, response, wantIDs, true)

		if kind == "insert" {
			before = append(
				before,
				map[string]any{
					"id":       float64(6),
					"data":     value,
					"name":     "new",
					"sql_null": false,
				},
			)
		} else {
			before[0]["data"] = value
		}

		if diff := cmp.Diff(before, jsonbSessionRows(t, pool)); diff != "" {
			t.Fatalf("persisted check result: %s", diff)
		}
	}

	resetJSONBSessionRows(t, pool)
	before := jsonbSessionRows(t, pool)

	query := `mutation{result:insert_json_items(objects:{id:6,data:{}}){affected_rows returning{id}}}`
	if kind == "update_check" {
		query = `mutation{result:update_json_items(where:{id:{_eq:1}},_set:{data:{}}){affected_rows returning{id}}}`
	}

	assertJSONBSessionError(
		t,
		jsonbSessionResponse(
			t,
			router,
			op+"_"+kind,
			nil,
			controller.GraphQLRequest{Query: query},
		),
	)

	if diff := cmp.Diff(before, jsonbSessionRows(t, pool)); diff != "" {
		t.Fatalf("missing session check changed rows: %s", diff)
	}
}

func testJSONBUserSessionStrings(t *testing.T, pool *pgxpool.Pool, router http.Handler) {
	t.Helper()
	resetJSONBSessionRows(t, pool)

	for _, role := range []string{"admin", "preset", "eq_select"} {
		for _, value := range []string{"x-hasura-json", "{}", "hello"} {
			wantIDs := []int{map[string]int{"x-hasura-json": 2, "{}": 3, "hello": 4}[value]}

			var session *string
			if role == "eq_select" {
				session = new(`{}`)
				wantIDs = []int{}
			}

			for _, op := range []string{"_eq", "_in"} {
				var operand any = value
				if op == "_in" {
					operand = []any{value}
				}

				response := jsonbSessionResponse(
					t,
					router,
					role,
					session,
					controller.GraphQLRequest{
						Query:     `query($cmp:jsonb_comparison_exp!){result:json_items(where:{data:$cmp}){id}}`,
						Variables: map[string]any{"cmp": map[string]any{op: operand}},
					},
				)
				assertArrayPermissionIDs(t, response, wantIDs, false)
			}
		}
	}
}

//nolint:paralleltest,tparallel // Preset matrices share one controller and pool to respect the database connection budget.
func TestJSONBSessionPresetsHTTP(t *testing.T) {
	t.Parallel()
	pool := testdb.NewPostgres(
		t,
		`CREATE TABLE json_items(id int PRIMARY KEY, data jsonb, name text);`,
		jsonbSessionFixture,
	)

	ctrl, err := newComputedController(
		t,
		jsonbSessionMetadata(pool.Config().ConnConfig.ConnString()),
		false,
	)
	if err != nil {
		t.Fatal(err)
	}

	router := newTestRouter(t, ctrl)

	tests := []struct{ name, wire string }{
		{"object", `{}`},
		{"array", `["hello",{"nested":[null,42,true]}]`},
		{"number", `42`},
		{"boolean", `true`},
		{"JSON null", `null`},
		{"ordinary string", `"hello"`},
		{"object-looking string", `"{}"`},
		{"marker-looking string", `"x-hasura-json"`},
	}
	for _, kind := range []string{"insert", "update"} {
		query := `mutation{result:insert_json_items(objects:{id:6,name:"preset"}){affected_rows returning{id data}}}`

		id := 6
		if kind == "update" {
			query = `mutation{result:update_json_items(where:{id:{_eq:1}},_set:{name:"preset"}){affected_rows returning{id data}}}`
			id = 1
		}

		for _, tt := range tests {
			t.Run(kind+"/"+tt.name, func(t *testing.T) {
				resetJSONBSessionRows(t, pool)
				before := jsonbSessionRows(t, pool)
				response := jsonbSessionResponse(
					t,
					router,
					"preset",
					&tt.wire,
					controller.GraphQLRequest{Query: query},
				)
				assertArrayPermissionIDs(t, response, []int{id}, true)

				var want any
				if err := json.Unmarshal([]byte(tt.wire), &want); err != nil {
					t.Fatal(err)
				}

				returned := jsonbSessionReturnedData(t, response)
				if diff := cmp.Diff(want, returned); diff != "" {
					t.Fatalf("returned preset: %s", diff)
				}

				if kind == "insert" {
					before = append(
						before,
						map[string]any{
							"id":       float64(id),
							"data":     want,
							"name":     "preset",
							"sql_null": false,
						},
					)
				} else {
					before[0]["data"] = want
					before[0]["name"] = "preset"
				}

				if diff := cmp.Diff(before, jsonbSessionRows(t, pool)); diff != "" {
					t.Fatalf("persisted preset: %s", diff)
				}
			})
		}

		t.Run(kind+"/missing and invalid wire", func(t *testing.T) {
			for _, session := range []*string{nil, new("not JSON")} {
				resetJSONBSessionRows(t, pool)
				before := jsonbSessionRows(t, pool)
				assertJSONBSessionError(
					t,
					jsonbSessionResponse(
						t,
						router,
						"preset",
						session,
						controller.GraphQLRequest{Query: query},
					),
				)

				if diff := cmp.Diff(before, jsonbSessionRows(t, pool)); diff != "" {
					t.Fatalf("rejected preset changed rows: %s", diff)
				}
			}
		})
	}
}

func jsonbSessionMetadata(databaseURL string) *metadata.Metadata {
	table := metadata.TableMetadata{
		Table: metadata.TableSource{Schema: "public", Name: "json_items"},
	}

	columns := []string{"id", "data", "name"}
	for _, op := range []string{"eq", "contains", "contained_in", "in", "nin"} {
		var operand any = "X-Hasura-Json"
		if op == "in" || op == "nin" {
			operand = []any{operand}
		}

		filter := map[string]any{"data": map[string]any{"_" + op: operand}}
		for _, kind := range []string{"select", "update_filter", "delete", "insert", "update_check"} {
			addArrayMembershipPermission(&table, columns, op+"_"+kind, kind, filter)
		}
	}

	for _, op := range []string{"in", "nin"} {
		table.SelectPermissions = append(table.SelectPermissions, metadata.SelectPermission{
			Role: "whole_" + op, Permission: metadata.SelectPermissionConfig{
				Columns: columns,
				Filter:  map[string]any{"data": map[string]any{"_" + op: "X-Hasura-Json"}},
			},
		})
	}

	table.SelectPermissions = append(
		table.SelectPermissions,
		metadata.SelectPermission{
			Role:       "preset",
			Permission: metadata.SelectPermissionConfig{Columns: columns},
		},
	)
	table.InsertPermissions = append(
		table.InsertPermissions,
		metadata.InsertPermission{
			Role: "preset",
			Permission: metadata.InsertPermissionConfig{
				Columns: []string{"id", "name"},
				Set:     map[string]any{"data": "X-Hasura-Json"},
			},
		},
	)
	table.UpdatePermissions = append(
		table.UpdatePermissions,
		metadata.UpdatePermission{
			Role: "preset",
			Permission: metadata.UpdatePermissionConfig{
				Columns: []string{"name"},
				Set:     map[string]any{"data": "X-Hasura-Json"},
			},
		},
	)
	md := &metadata.Metadata{
		Databases: []metadata.DatabaseMetadata{
			{Name: "default", Kind: "postgres", Tables: []metadata.TableMetadata{table}},
		},
	}
	md.Databases[0].Configuration.ConnectionInfo.DatabaseURL = metadata.EnvString(databaseURL)

	return md
}

func jsonbSessionResponse(
	t *testing.T,
	router http.Handler,
	role string,
	session *string,
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

	if session != nil {
		req.Header.Set("X-Hasura-Json", *session)
	}

	response := httptest.NewRecorder()
	router.ServeHTTP(response, req)

	if response.Code != http.StatusOK {
		t.Fatalf("HTTP %d: %s", response.Code, response.Body.String())
	}

	return readJSONBody(t, response)
}

//go:fix inline

func assertJSONBSessionError(t *testing.T, response map[string]any) {
	t.Helper()

	if response["errors"] == nil || response["data"] != nil {
		t.Fatalf("expected request rejection: %+v", response)
	}
}

func resetJSONBSessionRows(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()

	if _, err := pool.Exec(t.Context(), jsonbSessionFixture); err != nil {
		t.Fatal(err)
	}
}

func jsonbSessionRows(t *testing.T, pool *pgxpool.Pool) []map[string]any {
	t.Helper()

	var raw []byte
	if err := pool.QueryRow(t.Context(), `SELECT coalesce(json_agg(r ORDER BY id),'[]') FROM (SELECT id,data,name,data IS NULL AS sql_null FROM json_items) r`).
		Scan(&raw); err != nil {
		t.Fatal(err)
	}

	var rows []map[string]any
	if err := json.Unmarshal(raw, &rows); err != nil {
		t.Fatal(fmt.Errorf("decode stored rows: %w", err))
	}

	return rows
}

func jsonbSessionReturnedData(t *testing.T, response map[string]any) any {
	t.Helper()

	raw, err := json.Marshal(response)
	if err != nil {
		t.Fatal(err)
	}

	var payload struct {
		Data struct {
			Result struct {
				Returning []struct {
					Data any `json:"data"`
				} `json:"returning"`
			} `json:"result"`
		} `json:"data"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		t.Fatal(err)
	}

	if len(payload.Data.Result.Returning) != 1 {
		t.Fatalf("expected one returning row: %s", raw)
	}

	return payload.Data.Result.Returning[0].Data
}
