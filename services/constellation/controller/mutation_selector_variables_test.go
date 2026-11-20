package controller_test

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/nhost/nhost/services/constellation/controller"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

const mutationSelectorSeed = `TRUNCATE filter_rows;
INSERT INTO filter_rows VALUES (1,1,'original'),(2,1,'original'),(3,1,'original'),(4,2,'original');`

type mutationSelectorHTTPInput struct {
	name, definition, where string
	variables               map[string]any
	matches                 int
	invalid                 bool
}

type mutationSelectorHTTPCase struct {
	role, mutation, field, where string
	input                        mutationSelectorHTTPInput
}

//nolint:paralleltest,tparallel // Sequential mutation matrix shares one controller and pool within the testdb connection budget.
func TestMutationSelectorVariablesHTTP(t *testing.T) {
	t.Parallel()

	pool := testdb.NewPostgres(
		t,
		`CREATE TABLE filter_rows (id integer PRIMARY KEY, owner integer, name text);`,
		mutationSelectorSeed,
	)
	filter := map[string]any{"owner": map[string]any{"_eq": 1}}
	columns := []string{"id", "owner", "name"}
	table := metadata.TableMetadata{
		Table: metadata.TableSource{Schema: "public", Name: "filter_rows"},
		Configuration: metadata.TableConfiguration{CustomRootFields: metadata.CustomRootFields{
			Delete:     "erase_rows",
			Update:     "change_rows",
			UpdateMany: "change_batches",
			Insert:     "merge_rows",
		}},
		SelectPermissions: []metadata.SelectPermission{
			{Role: "owner", Permission: metadata.SelectPermissionConfig{
				Columns: columns, Filter: filter,
			}},
		},
		InsertPermissions: []metadata.InsertPermission{
			{Role: "owner", Permission: metadata.InsertPermissionConfig{
				Columns: columns, Check: filter,
			}},
		},
		UpdatePermissions: []metadata.UpdatePermission{
			{Role: "owner", Permission: metadata.UpdatePermissionConfig{
				Columns: []string{"name"}, Filter: filter, Check: filter,
			}},
		},
		DeletePermissions: []metadata.DeletePermission{
			{Role: "owner", Permission: metadata.DeletePermissionConfig{Filter: filter}},
		},
	}
	md := &metadata.Metadata{Databases: []metadata.DatabaseMetadata{{
		Name: "default", Kind: "postgres", Tables: []metadata.TableMetadata{table},
	}}}
	md.Databases[0].Configuration.ConnectionInfo.DatabaseURL = metadata.EnvString(
		pool.Config().ConnConfig.ConnString(),
	)

	ctrl, err := newComputedController(t, md, false)
	if err != nil {
		t.Fatal(err)
	}

	if inconsistencies := ctrl.Inconsistencies(); len(inconsistencies) != 0 {
		t.Fatalf("inconsistencies: %+v", inconsistencies)
	}

	router := newTestRouter(t, ctrl)
	mutations := []struct{ name, field string }{
		{"delete", "erase_rows(where:%s){affected_rows}"},
		{"update", `change_rows(where:%s,_set:{name:"changed"}){affected_rows}`},
		{
			"update many",
			`change_batches(updates:[{where:%s,_set:{name:"changed"}}]){affected_rows}`,
		},
		{
			"upsert",
			`merge_rows(objects:[{id:1,owner:1,name:"changed"}],on_conflict:{constraint:filter_rows_pkey,update_columns:[name],where:%s}){affected_rows}`,
		},
	}
	selectors := []struct{ name, where string }{
		{"comparison", "{id:{_eq:$id}}"},
		{"or", `{_or:[{id:{_eq:$id}},{name:{_eq:"never"}}]}`},
	}

	inputs := []mutationSelectorHTTPInput{
		{"omitted", "$id:Int", "", nil, 0, true},
		{"explicit null", "$id:Int", "", map[string]any{"id": nil}, 0, false},
		{"provided", "$id:Int", "", map[string]any{"id": 1}, 1, false},
		{"default", "$id:Int=1", "", nil, 1, false},
		{"required omitted", "$id:Int!", "", nil, 0, true},
		{"literal empty filter", "", "{}", nil, 4, false},
		{"literal empty comparison", "", "{id:{}}", nil, 4, false},
	}
	for _, role := range []string{"admin", "owner"} {
		for _, mutation := range mutations {
			for _, selector := range selectors {
				for _, input := range inputs {
					t.Run(
						role+"/"+mutation.name+"/"+selector.name+"/"+input.name,
						func(t *testing.T) {
							checkMutationSelectorHTTP(t, router, pool, mutationSelectorHTTPCase{
								role:     role,
								mutation: mutation.name,
								field:    mutation.field,
								where:    selector.where,
								input:    input,
							})
						},
					)
				}
			}
		}
	}
}

func checkMutationSelectorHTTP(
	t *testing.T,
	router http.Handler,
	pool *pgxpool.Pool,
	tt mutationSelectorHTTPCase,
) {
	t.Helper()
	t.Cleanup(func() {
		if _, err := pool.Exec(
			context.WithoutCancel(t.Context()),
			mutationSelectorSeed,
		); err != nil {
			t.Errorf("restoring filter rows: %v", err)
		}
	})

	where := tt.where
	if tt.input.where != "" {
		where = tt.input.where
	}

	definitions := ""
	if tt.input.definition != "" {
		definitions = "(" + tt.input.definition + ")"
	}

	// A bad selector must fail before any mutation root executes, including an
	// otherwise-valid earlier root in the same request.
	first := ""
	if tt.input.invalid {
		first = `first:insert_filter_rows_one(object:{id:9,owner:1,name:"sentinel"}){id}`
	}

	query := "mutation" + definitions + "{" + first + "result:" + fmt.Sprintf(tt.field, where) + "}"
	response := nullableOrderByResponse(t, router, tt.role, controller.GraphQLRequest{
		Query: query, Variables: tt.input.variables,
	})

	matches := tt.input.matches
	if tt.role == "owner" {
		matches = min(matches, 3)
	}

	if tt.mutation == "upsert" {
		matches = min(matches, 1)
	}

	if tt.input.invalid {
		if response.Errors == nil || response.Data != nil {
			t.Fatalf("expected rejection without data, got %+v", response)
		}
	} else {
		assertSelectorAffectedRows(t, response, tt.mutation == "update many", matches)
	}

	if tt.input.name == "omitted" {
		rootName, _, _ := strings.Cut(tt.field, "(")
		assertOmittedSelectorHTTPError(t, response, rootName)
	}

	assertMutationSelectorRows(t, pool, tt.mutation, matches)
}

func assertMutationSelectorRows(t *testing.T, pool *pgxpool.Pool, mutation string, matches int) {
	t.Helper()

	wantRows, wantChanged, wantOutside := 4, matches, 1
	if matches == 4 {
		wantOutside = 0
	}

	if mutation == "delete" {
		wantRows -= matches
		wantChanged = 0
	}

	var rows, changed, sentinels, outside int
	if err := pool.QueryRow(t.Context(), `SELECT count(*), count(*) FILTER (WHERE name='changed'),
 count(*) FILTER (WHERE id=9), count(*) FILTER (WHERE owner=2 AND name='original') FROM filter_rows`).
		Scan(&rows, &changed, &sentinels, &outside); err != nil {
		t.Fatal(err)
	}

	if rows != wantRows || changed != wantChanged || sentinels != 0 || outside != wantOutside {
		t.Fatalf(
			"persisted rows=%d changed=%d sentinels=%d outside=%d; want rows=%d changed=%d outside=%d",
			rows,
			changed,
			sentinels,
			outside,
			wantRows,
			wantChanged,
			wantOutside,
		)
	}
}

func assertOmittedSelectorHTTPError(
	t *testing.T,
	response *controller.GraphQLResponse,
	rootName string,
) {
	t.Helper()

	errs, ok := response.Errors.([]any)
	if !ok || len(errs) != 1 {
		t.Fatalf("expected one error: %+v", response)
	}

	err, ok := errs[0].(map[string]any)
	if !ok || err["message"] != "a variable used in a mutation where input must be provided" {
		t.Fatalf("unexpected omission error: %+v", errs)
	}

	extensions, ok := err["extensions"].(map[string]any)
	if !ok || extensions["code"] != "validation-failed" ||
		extensions["path"] != "$.selectionSet."+rootName+".args" {
		t.Fatalf("unexpected error extensions: %+v", err)
	}
}

func assertSelectorAffectedRows(
	t *testing.T,
	response *controller.GraphQLResponse,
	many bool,
	want int,
) {
	t.Helper()

	data, ok := response.Data.(map[string]any)
	if !ok || response.Errors != nil {
		t.Fatalf("mutation failed: %+v", response)
	}

	result := data["result"]
	if many {
		list, ok := result.([]any)
		if !ok || len(list) != 1 {
			t.Fatalf("invalid update-many response: %+v", response)
		}

		result = list[0]
	}

	value, ok := result.(map[string]any)
	if !ok || value["affected_rows"] != float64(want) {
		t.Fatalf("expected %d affected rows, got %+v", want, response)
	}
}
