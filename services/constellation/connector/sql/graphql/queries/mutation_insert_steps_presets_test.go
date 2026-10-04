package queries_test

import (
	json "encoding/json/v2"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
)

// TestDependentInsertPresetPrecedence exercises parsed, typed session presets
// through the real PostgreSQL step planner and executor, not a SQL golden.
//
//nolint:tparallel,gocognit // Serial subtests and row/select assertions share one testdb fixture.
func TestDependentInsertPresetPrecedence(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name, query string
		wantCount   string
		wantRows    string
	}{
		{
			name:      "array batch and after-parent object use the preset instead of the new parent",
			query:     `mutation{insert_parent(objects:[{id:1,label:"new",rel_arr_00000:{data:[{id:20},{id:21}]},obj_rel_0000:{data:{id:30}}}]){affected_rows}}`,
			wantCount: `"affected_rows":4`,
			wantRows:  "1/2/1/0",
		},
		{
			name:      "per-object children and before-parent object retain preset priority",
			query:     `mutation{insert_parent(objects:[{id:1,label:"new",obj_rel_0001:{data:{id:10,tag:"new-before"}},rel_arr_00000:{data:[{id:20,obj_rel_0001:{data:{id:11,tag:"child-before"}}},{id:21}]}}]){affected_rows}}`,
			wantCount: `"affected_rows":5`,
			wantRows:  "1/2/0/2",
		},
		{
			name:      "before-parent preset wins but the before object is counted",
			query:     `mutation{insert_parent_one(object:{id:1,label:"new",obj_rel_0001:{data:{id:10,tag:"new-before"}}}){id before_id}}`,
			wantCount: `"before_id":9`,
			wantRows:  "1/0/0/1",
		},
	}

	//nolint:paralleltest // Serial subtests respect the shared testdb connection budget.
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			seed := testdb.NewPostgres(t, dependentInsertDDL)

			pool, err := postgres.Open(t.Context(), seed.Config().ConnConfig.ConnString())
			if err != nil {
				t.Fatal(err)
			}

			t.Cleanup(pool.Close)

			if err := pool.Exec(
				t.Context(),
				`INSERT INTO parent(id,label) VALUES (9,'seed'); INSERT INTO obj_before(id,tag) VALUES (9,'seed')`,
			); err != nil {
				t.Fatal(err)
			}

			md := dependentPermissionMetadata(nil, nil, nil)
			md.Tables[0].InsertPermissions[0].Permission.Set = map[string]any{
				"before_id": "X-Hasura-User-Id",
			}
			md.Tables[2].InsertPermissions[0].Permission.Set = map[string]any{
				"parent_id": "X-Hasura-User-Id",
			}

			md.Tables[3].InsertPermissions[0].Permission.Set = map[string]any{
				"parent_id": "X-Hasura-User-Id",
			}
			if tt.name == tests[0].name {
				md.Tables[3].SelectPermissions[0].Permission.Filter = map[string]any{
					"parent_id": map[string]any{"_eq": 1},
				}
			}

			client := postgres.NewClient(pool)

			result, err := executeDependentRoleResult(t, client, md, tt.query,
				map[string]any{"x-hasura-user-id": "9"})
			if err != nil {
				t.Fatal(err)
			}

			if !strings.Contains(strings.ReplaceAll(string(result), " ", ""), tt.wantCount) {
				t.Fatalf("result %s does not contain %s", result, tt.wantCount)
			}

			var parentID, beforeID, childIDs, afterIDs, beforeCount int

			err = pool.QueryRow(t.Context(), `SELECT (SELECT count(*) FROM parent WHERE id=1),
				(SELECT before_id FROM parent WHERE id=1),
				(SELECT count(*) FROM child WHERE id IN (20,21) AND parent_id=9),
				(SELECT count(*) FROM obj_after WHERE id=30 AND parent_id=9),
				(SELECT count(*) FROM obj_before WHERE id IN (10,11))`).Scan(
				&parentID, &beforeID, &childIDs, &afterIDs, &beforeCount)
			if err != nil {
				t.Fatal(err)
			}

			got := fmt.Sprintf("%d/%d/%d/%d", parentID, childIDs, afterIDs, beforeCount)
			if got != tt.wantRows || beforeID != 9 {
				t.Fatalf("stored rows=%s, before_id=%d, want %s and 9", got, beforeID, tt.wantRows)
			}

			if tt.name == tests[0].name {
				selected, err := executeDependentRoleResult(t, client, md,
					`query{parent_by_pk(id:9){id rel_arr_00000{id}}}`, nil)
				if err != nil {
					t.Fatal(err)
				}

				var row struct {
					ID       int `json:"id"`
					Children []struct {
						ID int `json:"id"`
					} `json:"rel_arr_00000"`
				}
				if err := json.Unmarshal(selected, &row); err != nil {
					t.Fatal(err)
				}

				if row.ID != 9 || len(row.Children) != 0 {
					t.Fatalf(
						"select filter did not hide preset-linked children from parent 9: %s",
						selected,
					)
				}
			}
		})
	}
}

// TestDependentInsertPresetClientOverlapAndRollback verifies that a forged
// client field is not hidden by a same-column preset and that failing checks
// still abort already inserted before-parent objects.
//
//nolint:gocognit,cyclop,tparallel // Each serial denial checks its error shape and zero-write rollback in one fixture.
func TestDependentInsertPresetClientOverlapAndRollback(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name, query, message, path string
		denyCheck                  bool
	}{
		{
			name:    "array client FK",
			query:   `mutation{insert_parent_one(object:{id:1,rel_arr_00000:{data:[{id:20,parent_id:1}]}}){id}}`,
			message: `cannot insert "parent_id" columns as their values are already being determined by parent insert`,
			path:    `$.selectionSet.insert_parent_one.args.object[0].rel_arr_00000.data[0]`,
		},
		{
			name:    "after-parent client FK",
			query:   `mutation{insert_parent_one(object:{id:1,obj_rel_0000:{data:{id:30,parent_id:1}}}){id}}`,
			message: `cannot insert "parent_id" columns as their values are already being determined by parent insert`,
			path:    `$.selectionSet.insert_parent_one.args.object[0].obj_rel_0000.data[0]`,
		},
		{
			name:    "before-parent client FK",
			query:   `mutation{insert_parent_one(object:{id:1,before_id:10,obj_rel_0001:{data:{id:10}}}){id}}`,
			message: `cannot insert object relationship "obj_rel_0001" as "before_id" column values are already determined`,
			path:    `$.selectionSet.insert_parent_one.args.object[0].obj_rel_0001`,
		},
		{
			name:      "permission check sees preset, rolls back earlier before object",
			query:     `mutation{insert_parent_one(object:{id:1,label:"new",obj_rel_0001:{data:{id:10}},rel_arr_00000:{data:[{id:20}]}}){id}}`,
			denyCheck: true,
		},
	}

	//nolint:paralleltest // Serial subtests respect the shared testdb connection budget.
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			seed := testdb.NewPostgres(t, dependentInsertDDL)

			pool, err := postgres.Open(t.Context(), seed.Config().ConnConfig.ConnString())
			if err != nil {
				t.Fatal(err)
			}

			t.Cleanup(pool.Close)

			if err := pool.Exec(
				t.Context(),
				`INSERT INTO parent(id,label) VALUES (9,'seed'); INSERT INTO obj_before(id,tag) VALUES (9,'seed')`,
			); err != nil {
				t.Fatal(err)
			}

			md := dependentPermissionMetadata(nil, nil, nil)
			md.Tables[0].InsertPermissions[0].Permission.Set = map[string]any{
				"before_id": "X-Hasura-User-Id",
			}
			md.Tables[2].InsertPermissions[0].Permission.Set = map[string]any{
				"parent_id": "X-Hasura-User-Id",
			}

			md.Tables[3].InsertPermissions[0].Permission.Set = map[string]any{
				"parent_id": "X-Hasura-User-Id",
			}
			if tt.denyCheck {
				md.Tables[3].InsertPermissions[0].Permission.Check = map[string]any{
					"parent_id": map[string]any{"_eq": 1},
				}
			}

			_, err = executeDependentRoleResult(t, postgres.NewClient(pool), md, tt.query,
				map[string]any{"x-hasura-user-id": "9"})
			if tt.denyCheck {
				if err == nil || !strings.Contains(err.Error(), "SQLSTATE ZZ901") {
					t.Fatalf("check denial = %v, want ZZ901", err)
				}
			} else {
				var validation *arguments.QueryValidationError
				if !errors.As(err, &validation) {
					t.Fatalf("error = %v, want validation", err)
				}

				want := map[string]any{"message": tt.message, "extensions": map[string]any{
					"code": "validation-failed", "path": tt.path,
				}}
				if !reflect.DeepEqual(validation.AsMap(), want) {
					t.Fatalf("validation = %#v, want %#v", validation.AsMap(), want)
				}
			}

			var parent, child, before, after, events int
			if err := pool.QueryRow(t.Context(), `SELECT (SELECT count(*) FROM parent WHERE id=1),
				(SELECT count(*) FROM child), (SELECT count(*) FROM obj_before WHERE id=10),
				(SELECT count(*) FROM obj_after), (SELECT count(*) FROM event_log WHERE tag NOT IN ('parent:9','obj_before:9'))`).Scan(
				&parent, &child, &before, &after, &events); err != nil {
				t.Fatal(err)
			}

			if parent != 0 || child != 0 || before != 0 || after != 0 || events != 0 {
				t.Fatalf(
					"error left rows/events = %d/%d/%d/%d/%d",
					parent,
					child,
					before,
					after,
					events,
				)
			}
		})
	}
}
