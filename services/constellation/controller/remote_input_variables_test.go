package controller_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"net/http"
	"net/http/httptest"
	"reflect"
	"slices"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/nhost/nhost/services/constellation/controller"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

//nolint:paralleltest,tparallel // One controller and pool serve sequential cases, including warm cached documents.
func TestRemoteInputVariables(t *testing.T) {
	t.Parallel()

	pool := testdb.NewPostgres(t, `
CREATE SCHEMA optional_input;
CREATE TABLE optional_input.parents (id integer PRIMARY KEY);
CREATE TABLE optional_input.kids (id integer PRIMARY KEY, owner integer, label text, visible boolean);
INSERT INTO optional_input.parents VALUES (1),(2);
INSERT INTO optional_input.kids VALUES
 (101,1,'keep',true),(102,1,'other',true),(103,1,'hidden',false),
 (201,2,'keep',true),(202,2,'other',true),(203,2,'hidden',false);
`)
	parents := metadata.TableMetadata{
		Table: metadata.TableSource{Schema: "optional_input", Name: "parents"},
		SelectPermissions: []metadata.SelectPermission{{
			Role: "reader", Permission: metadata.SelectPermissionConfig{Columns: []string{"id"}},
		}},
		RemoteRelationships: []metadata.RemoteRelationship{{
			Name: "remote_kids", Definition: metadata.RemoteRelationshipDef{
				ToSource: &metadata.ToSourceRelationship{
					Source:           "target",
					Table:            metadata.TableSource{Schema: "optional_input", Name: "kids"},
					RelationshipType: metadata.RelationshipTypeArray,
					FieldMapping:     map[string]string{"id": "owner"},
				},
			},
		}},
	}
	kids := metadata.TableMetadata{
		Table: metadata.TableSource{Schema: "optional_input", Name: "kids"},
		SelectPermissions: []metadata.SelectPermission{{
			Role: "reader", Permission: metadata.SelectPermissionConfig{
				Columns: []string{"id", "owner", "label"}, AllowAggregations: true,
				Filter: map[string]any{"visible": map[string]any{"_eq": true}},
			},
		}},
	}

	md := &metadata.Metadata{Databases: []metadata.DatabaseMetadata{
		{Name: "source", Kind: "postgres", Tables: []metadata.TableMetadata{parents}},
		{Name: "target", Kind: "postgres", Tables: []metadata.TableMetadata{kids}},
	}}
	for i := range md.Databases {
		md.Databases[i].Configuration.ConnectionInfo.DatabaseURL = metadata.EnvString(
			pool.Config().ConnConfig.ConnString(),
		)
	}

	ctrl, err := newComputedController(t, md, false)
	if err != nil {
		t.Fatal(err)
	}

	if inconsistencies := ctrl.Inconsistencies(); len(inconsistencies) != 0 {
		t.Fatalf("inconsistencies: %+v", inconsistencies)
	}

	t.Run("reads", func(t *testing.T) { testRemoteInputReads(t, ctrl) })
	t.Run("nullable ordering", func(t *testing.T) { testRemoteInputNullOrderBy(t, ctrl) })
	t.Run("nullable distinct", func(t *testing.T) { testRemoteInputNullDistinct(t, ctrl) })
	t.Run("nullable distinct mutation", func(t *testing.T) {
		testRemoteInputNullDistinctMutation(t, ctrl, pool)
	})
	t.Run("cached fragments", func(t *testing.T) { testRemoteInputCache(t, ctrl) })
	t.Run("prevalidation", func(t *testing.T) { testRemoteInputPrevalidation(t, ctrl, pool) })
}

func testRemoteInputReads(t *testing.T, ctrl *controller.Controller) {
	t.Helper()

	tests := []struct {
		name        string
		definitions string
		arguments   string
		literal     string
		variables   map[string]any
	}{
		{"omitted pagination", "$limit:Int,$offset:Int", "limit:$limit,offset:$offset", "", nil},
		{
			"omitted nested filter",
			"$label:String",
			"where:{label:{_eq:$label}}",
			"where:{label:{}}",
			nil,
		},
		{"omitted whole filter", "$where:optional_input_kids_bool_exp", "where:$where", "", nil},
		{"omitted limit in grouped window", "$limit:Int", "limit:$limit,offset:0", "offset:0", nil},
		{
			"omitted offset in grouped window",
			"$offset:Int",
			"limit:1,offset:$offset",
			"limit:1",
			nil,
		},
		{
			"omitted filter in grouped window",
			"$label:String",
			"limit:1,where:{label:{_eq:$label}}",
			"limit:1,where:{label:{}}",
			nil,
		},
		{
			"variable defaults",
			"$limit:Int=1,$label:String=\"keep\"",
			"limit:$limit,where:{label:{_eq:$label}}",
			"limit:1,where:{label:{_eq:\"keep\"}}",
			nil,
		},
		{
			"provided inputs",
			"$limit:Int,$label:String",
			"limit:$limit,where:{label:{_eq:$label}}",
			"limit:1,where:{label:{_eq:\"keep\"}}",
			map[string]any{"limit": 1, "label": "keep"},
		},
		{
			"explicit null pagination",
			"$limit:Int=1,$offset:Int=1",
			"limit:$limit,offset:$offset",
			"limit:null,offset:null",
			map[string]any{"limit": nil, "offset": nil},
		},
	}
	for _, role := range []string{"admin", "reader"} {
		ctx := runSessionMiddleware(t, http.Header{
			"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {role},
		})
		for _, parents := range []string{"[1]", "[1,2]"} {
			for _, field := range []string{"remote_kids", "remote_kids_aggregate"} {
				for _, tt := range tests {
					t.Run(role+"/"+parents+"/"+field+"/"+tt.name, func(t *testing.T) {
						request := controller.GraphQLRequest{
							Query: remoteInputReadQuery(
								tt.definitions,
								parents,
								field,
								tt.arguments,
							),
							Variables: tt.variables,
						}
						literal := remoteInputReadQuery("", parents, field, tt.literal)
						checkRemoteInputEquivalent(ctx, t, ctrl, request, literal)
					})
				}
			}
		}
	}
}

func remoteInputReadQuery(definitions, parents, field, args string) string {
	selection := "id label"
	if field == "remote_kids_aggregate" {
		selection = "aggregate { count } nodes { id label }"
	}

	if definitions != "" {
		definitions = "(" + definitions + ")"
	}

	if args != "" {
		args += ","
	}
	// Reach the remote input through a cached fragment.
	return fmt.Sprintf(`query Q%s {
 optional_input_parents(where:{id:{_in:%s}},order_by:{id:asc}) { id ...Remote }
} fragment Remote on optional_input_parents { %s(%sorder_by:{id:asc}) { %s } }`,
		definitions, parents, field, args, selection)
}

func checkRemoteInputEquivalent(
	ctx context.Context,
	t *testing.T,
	ctrl *controller.Controller,
	request controller.GraphQLRequest,
	literal string,
) {
	t.Helper()

	baseline, err := ctrl.Resolve(ctx, controller.GraphQLRequest{Query: literal})
	if err != nil || baseline.Errors != nil || baseline.Data == nil {
		t.Fatalf("literal response=%+v error=%v", baseline, err)
	}

	response, err := ctrl.Resolve(ctx, request)
	if err != nil || response.Errors != nil {
		t.Fatalf("variable response=%+v error=%v", response, err)
	}

	if !reflect.DeepEqual(response.Data, baseline.Data) {
		t.Fatalf("variable data=%#v, literal data=%#v", response.Data, baseline.Data)
	}
}

func testRemoteInputNullOrderBy(t *testing.T, ctrl *controller.Controller) {
	t.Helper()

	router := newTestRouter(t, ctrl)

	tests := []struct {
		name       string
		definition string
		variables  map[string]any
		direction  string
		invalid    bool
	}{
		{"null overrides default", "=[{id:desc}]", map[string]any{"o": nil}, "", false},
		{"default on warm document", "=[{id:desc}]", nil, "desc", false},
		{
			"provided on warm document",
			"=[{id:desc}]",
			map[string]any{"o": map[string]any{"id": "asc"}},
			"asc",
			false,
		},
		{"null on warm document", "=[{id:desc}]", map[string]any{"o": nil}, "", false},
		{"null default", "=null", nil, "", false},
		{"omitted", "", nil, "", false},
		{"empty object", "", map[string]any{"o": map[string]any{}}, "", false},
		{"empty list", "", map[string]any{"o": []any{}}, "", false},
		{"required null", "!", map[string]any{"o": nil}, "", true},
		{"null element", "", map[string]any{"o": []any{nil}}, "", true},
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
							query := nullableOrderByQuery(field, parents, tt.definition)

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
									Query: query, Variables: variables,
								},
							)
							want := nullableOrderByData(field, parents, role, tt.direction)
							checkNullableOrderByResponse(
								t,
								response,
								want,
								tt.direction,
								tt.invalid,
							)
						},
					)
				}
			}
		}
	}
}

func checkNullableOrderByResponse(
	t *testing.T,
	response *controller.GraphQLResponse,
	want map[string]any,
	direction string,
	invalid bool,
) {
	t.Helper()

	if invalid {
		if response.Errors == nil || response.Data != nil {
			t.Fatalf("expected validation errors without data, got %+v", response)
		}

		return
	}

	if response.Errors != nil {
		t.Fatalf("response=%+v", response)
	}

	var options []cmp.Option
	if direction == "" {
		// Unordered collections have no stable row order; IDs still verify
		// filtering, role permissions and per-parent grouping exactly.
		options = append(options, cmpopts.SortSlices(func(a, b any) bool {
			left, leftOK := a.(map[string]any)
			right, rightOK := b.(map[string]any)
			leftID, leftIDOK := left["id"].(float64)
			rightID, rightIDOK := right["id"].(float64)

			return leftOK && rightOK && leftIDOK && rightIDOK && leftID < rightID
		}))
	}

	if diff := cmp.Diff(want, response.Data, options...); diff != "" {
		t.Errorf("ordering result (-want +got):\n%s", diff)
	}
}

func nullableOrderByResponse(
	t *testing.T, router http.Handler, role string, request controller.GraphQLRequest,
) *controller.GraphQLResponse {
	t.Helper()

	payload, err := json.Marshal(request)
	if err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPost, "/graphql", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)
	req.Header.Set("X-Hasura-Role", role)

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("HTTP %d: %s", recorder.Code, recorder.Body.String())
	}

	var response controller.GraphQLResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}

	return &response
}

func nullableOrderByQuery(field string, parents []int, orderDefault string) string {
	definitions := "($o:[optional_input_kids_order_by!]" + orderDefault +
		",$where:optional_input_kids_bool_exp!,$limit:Int!)"

	selection := "id"
	if strings.HasSuffix(field, "_aggregate") {
		selection = "aggregate { count } nodes { id }"
	}

	result := fmt.Sprintf(
		"result:%s(where:$where,limit:$limit,offset:0,order_by:$o) { %s }",
		field,
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

func nullableOrderByData(field string, parents []int, role, direction string) map[string]any {
	result := func(ids []int) any {
		if direction == "desc" {
			slices.Reverse(ids)
		}

		rows := make([]any, 0, len(ids))
		for _, id := range ids {
			rows = append(rows, map[string]any{"id": float64(id)})
		}

		if strings.HasSuffix(field, "_aggregate") {
			return map[string]any{
				"aggregate": map[string]any{"count": float64(len(ids))}, "nodes": rows,
			}
		}

		return rows
	}

	var allIDs []int

	parentRows := make([]any, 0, len(parents))
	for _, parent := range parents {
		ids := []int{parent*100 + 1}
		if role == "admin" {
			ids = append(ids, parent*100+3)
		}

		allIDs = append(allIDs, ids...)
		parentRows = append(
			parentRows,
			map[string]any{"id": float64(parent), "result": result(ids)},
		)
	}

	if strings.HasPrefix(field, "remote_") {
		return map[string]any{"parents": parentRows}
	}

	return map[string]any{"result": result(allIDs)}
}

func testRemoteInputCache(t *testing.T, ctrl *controller.Controller) {
	t.Helper()

	ctx := adminSessionContext(t)
	query := `query Optional($limit:Int) { optional_input_parents(order_by:{id:asc}) { ...Remote } }
query Required($limit:Int!) { optional_input_parents(order_by:{id:asc}) { ...Remote } }
fragment Remote on optional_input_parents { remote_kids(limit:$limit,order_by:{id:asc}) { id } }`

	tests := []struct {
		operation string
		variables map[string]any
		wantRows  int
	}{
		{"Required", map[string]any{"limit": 1}, 1},
		{"Optional", nil, 3},
		{"Optional", map[string]any{"limit": 2}, 2},
		{"Optional", nil, 3},
		{"Required", map[string]any{"limit": 1}, 1},
	}
	for _, tt := range tests {
		response, err := ctrl.Resolve(ctx, controller.GraphQLRequest{
			Query: query, OperationName: tt.operation, Variables: tt.variables,
		})
		if err != nil || response.Errors != nil {
			t.Fatalf("response=%+v error=%v", response, err)
		}

		data, ok := response.Data.(map[string]any)
		if !ok {
			t.Fatalf("unexpected data: %#v", response.Data)
		}

		rows, ok := data["optional_input_parents"].([]any)
		if !ok || len(rows) != 2 {
			t.Fatalf("unexpected parent rows: %#v", data)
		}

		for _, row := range rows {
			parent, ok := row.(map[string]any)
			if !ok {
				t.Fatalf("unexpected parent: %#v", row)
			}

			kids, ok := parent["remote_kids"].([]any)
			if !ok || len(kids) != tt.wantRows {
				t.Fatalf("%s: got kids %#v, want %d rows", tt.operation, parent, tt.wantRows)
			}
		}
	}
}

type remoteInputOperationCase struct {
	name    string
	query   string
	path    string
	wantIDs []int
}

func testRemoteInputPrevalidation(t *testing.T, ctrl *controller.Controller, pool *pgxpool.Pool) {
	t.Helper()

	tests := []remoteInputOperationCase{
		{
			"query one",
			`query(%s) { optional_input_parents(where:{id:{_eq:1}}) { %s } }`,
			"optional_input_parents",
			[]int{1, 2},
		},
		{
			"query many",
			`query(%s) { optional_input_parents { %s } }`,
			"optional_input_parents",
			[]int{1, 2},
		},
		{
			"insert one",
			`mutation(%s) { insert_optional_input_parents_one(object:{id:9}) { %s } }`,
			"insert_optional_input_parents_one",
			[]int{1, 2, 9},
		},
		{
			"insert returning",
			`mutation(%s) { insert_optional_input_parents(objects:[{id:9}]) { returning { %s } } }`,
			"insert_optional_input_parents.selectionSet.returning",
			[]int{1, 2, 9},
		},
		{
			"update returning",
			`mutation(%s) { update_optional_input_parents(where:{id:{_eq:1}},_set:{id:9}) { returning { %s } } }`,
			"update_optional_input_parents.selectionSet.returning",
			[]int{2, 9},
		},
		{
			"delete returning",
			`mutation(%s) { delete_optional_input_parents(where:{id:{_eq:1}}) { returning { %s } } }`,
			"delete_optional_input_parents.selectionSet.returning",
			[]int{2},
		},
	}
	for _, field := range []string{"remote_kids", "remote_kids_aggregate"} {
		for _, tt := range tests {
			for _, explicitNull := range []bool{false, true} {
				t.Run(
					fmt.Sprintf("%s/%s/null=%t", field, tt.name, explicitNull),
					func(t *testing.T) {
						checkRemoteInputOperation(t, ctrl, pool, tt, field, explicitNull)
					},
				)
			}
		}
	}
}

func checkRemoteInputOperation(
	t *testing.T,
	ctrl *controller.Controller,
	pool *pgxpool.Pool,
	tt remoteInputOperationCase,
	field string,
	explicitNull bool,
) {
	t.Helper()

	ctx := adminSessionContext(t)
	if _, err := pool.Exec(
		ctx,
		`TRUNCATE optional_input.parents; INSERT INTO optional_input.parents VALUES (1),(2)`,
	); err != nil {
		t.Fatal(err)
	}

	selection := "id"
	if field == "remote_kids_aggregate" {
		selection = "aggregate { count }"
	}

	definitions := "$label:String,$limit:Int"
	remote := fmt.Sprintf(`%s(where:{label:{_eq:$label}},limit:$limit) { %s }`, field, selection)

	var variables map[string]any

	wantIDs := tt.wantIDs
	if explicitNull {
		definitions = `$label:String="keep"`
		remote = fmt.Sprintf(`%s(where:{label:{_in:[$label]}},limit:1) { %s }`, field, selection)
		variables = map[string]any{"label": nil}
		wantIDs = []int{1, 2}
	}

	response, err := ctrl.Resolve(ctx, controller.GraphQLRequest{
		Query: fmt.Sprintf(tt.query, definitions, remote), Variables: variables,
	})
	if err != nil {
		t.Fatal(err)
	}

	if explicitNull {
		path := "$.selectionSet." + tt.path + ".selectionSet." + field + ".args"
		checkRemoteInputError(t, response, path)
	} else if response.Errors != nil || response.Data == nil {
		t.Fatalf("omitted optional inputs: %+v", response)
	}

	var ids []int
	if err := pool.QueryRow(ctx, `SELECT array_agg(id ORDER BY id) FROM optional_input.parents`).
		Scan(&ids); err != nil {
		t.Fatal(err)
	}

	if !reflect.DeepEqual(ids, wantIDs) {
		t.Fatalf("source rows: %v, want %v", ids, wantIDs)
	}
}

func checkRemoteInputError(t *testing.T, response *controller.GraphQLResponse, path string) {
	t.Helper()

	errs, ok := response.Errors.([]map[string]any)
	if !ok || len(errs) != 1 || response.Data != nil {
		t.Fatalf("expected one input error without data, got %+v", response)
	}

	extensions, ok := errs[0]["extensions"].(map[string]any)
	if !ok || extensions["code"] != "validation-failed" || extensions["path"] != path {
		t.Fatalf("input error=%+v, want path %s", errs, path)
	}
}
