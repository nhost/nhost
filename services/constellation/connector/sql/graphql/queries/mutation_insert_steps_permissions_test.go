package queries_test

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"fmt"
	"log/slog"
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func dependentExists(table, column, value string) map[string]any {
	return map[string]any{"_exists": map[string]any{
		"_table": map[string]any{"schema": "public", "name": table},
		"_where": map[string]any{column: map[string]any{"_eq": value}},
	}}
}

func dependentPermissionMetadata(
	parentCheck, childCheck, beforeCheck map[string]any,
) *metadata.DatabaseMetadata {
	md := dependentInsertMetadata()

	checks := []map[string]any{parentCheck, beforeCheck, nil, childCheck, nil}
	for i := range md.Tables {
		check := checks[i]
		if check == nil {
			check = map[string]any{}
		}

		md.Tables[i].InsertPermissions = []metadata.InsertPermission{{
			Role: "writer", Permission: metadata.InsertPermissionConfig{
				Columns: []string{"id", "label", "tag", "before_id"}, Check: check,
			},
		}}
		md.Tables[i].SelectPermissions = []metadata.SelectPermission{{
			Role: "writer", Permission: metadata.SelectPermissionConfig{
				Columns: []string{"id", "label", "tag", "parent_id", "before_id", "child_id"},
				Filter:  map[string]any{},
			},
		}}
	}

	return md
}

func executeDependentRoleQuery(t *testing.T, pool *postgres.Client, md *metadata.DatabaseMetadata,
	query string, session map[string]any,
) error {
	t.Helper()
	_, err := executeDependentRoleResult(t, pool, md, query, session)

	return err
}

func executeDependentRoleResult(t *testing.T, pool *postgres.Client, md *metadata.DatabaseMetadata,
	query string, session map[string]any,
) (jsontext.Value, error) {
	t.Helper()

	objects, err := pool.Introspect(t.Context(), md)
	if err != nil {
		t.Fatalf("Introspect: %v", err)
	}

	roots, _, err := queries.BuildRoots(objects, md, dialect.NewPostgresDialect())
	if err != nil {
		t.Fatalf("BuildRoots: %v", err)
	}

	doc, err := parser.ParseQuery(&ast.Source{Input: query})
	if err != nil {
		t.Fatalf("ParseQuery: %v", err)
	}

	ops, err := roots.BuildQuery(doc.Operations[0], doc.Fragments, nil, "writer", session)
	if err != nil {
		return nil, fmt.Errorf("BuildQuery: %w", err)
	}

	results, err := pool.ExecuteOperations(t.Context(), ops, slog.New(slog.DiscardHandler))
	if err != nil {
		return nil, err //nolint:wrapcheck // Preserve the exact root-wrapper chain for assertions.
	}

	value, ok := results[ops[0].Name].(jsontext.Value)
	if !ok {
		t.Fatalf("result type = %T", results[ops[0].Name])
	}

	return value, nil
}

func assertDependentReturningFilters(t *testing.T, result jsontext.Value, collection bool) {
	t.Helper()

	type row struct {
		ID       int    `json:"id"`
		Label    string `json:"label"`
		Children []struct {
			ID int `json:"id"`
		} `json:"rel_arr_00000"`
	}

	var returned row
	if collection {
		var response struct {
			AffectedRows int   `json:"affected_rows"`
			Returning    []row `json:"returning"`
		}
		if err := json.Unmarshal(result, &response); err != nil {
			t.Fatal(err)
		}

		if response.AffectedRows != 3 || len(response.Returning) != 1 {
			t.Fatalf("collection count/root = %s", result)
		}

		returned = response.Returning[0]
	} else if err := json.Unmarshal(result, &returned); err != nil {
		t.Fatal(err)
	}

	if returned.ID != 1 || returned.Label != "hidden" ||
		len(returned.Children) != 1 || returned.Children[0].ID != 11 {
		t.Fatalf("hidden root and filtered child returning = %s", result)
	}
}

//nolint:paralleltest,tparallel // Both mutation forms reuse the same fixture.
func TestDependentInsertReturningSelectFilters(t *testing.T) {
	t.Parallel()
	seed := testdb.NewPostgres(t, dependentInsertDDL)

	pool, err := postgres.Open(t.Context(), seed.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(pool.Close)

	md := dependentPermissionMetadata(nil, nil, nil)
	md.Tables[0].SelectPermissions[0].Permission.Filter = map[string]any{
		"label": map[string]any{"_eq": "visible"},
	}
	md.Tables[3].SelectPermissions[0].Permission.Filter = map[string]any{
		"id": map[string]any{"_eq": 11},
	}

	tests := []struct {
		name, query string
	}{
		{
			"collection",
			`mutation{insert_parent(objects:[{id:1,label:"hidden",rel_arr_00000:{data:[{id:10},{id:11}]}}]){affected_rows returning{id label rel_arr_00000(order_by:{id:asc}){id}}}}`,
		},
		{
			"insert_one",
			`mutation{insert_parent_one(object:{id:1,label:"hidden",rel_arr_00000:{data:[{id:10},{id:11}]}}){id label rel_arr_00000(order_by:{id:asc}){id}}}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := pool.Exec(
				t.Context(),
				`TRUNCATE event_log,obj_after,grandchild,child,parent,obj_before RESTART IDENTITY CASCADE`,
			); err != nil {
				t.Fatal(err)
			}

			result, err := executeDependentRoleResult(
				t,
				postgres.NewClient(pool),
				md,
				tt.query,
				nil,
			)
			if err != nil {
				t.Fatal(err)
			}

			assertDependentReturningFilters(t, result, tt.name == "collection")
		})
	}
}

// The four regression shapes are checks on future or preceding writes. A
// relationship-free level batches; introducing one relationship splits *all*
// objects in that level. The positive and negative inputs differ only in which
// step made the predicate true before this row's check.
//
//nolint:paralleltest,tparallel // Shared fixture is truncated between cases; concurrent subtests would race.
func TestDependentInsertRolePermissionStatementOrder(
	t *testing.T,
) {
	t.Parallel()
	seed := testdb.NewPostgres(t, dependentInsertDDL+`ALTER TABLE child ADD COLUMN tag text;`)

	pool, err := postgres.Open(t.Context(), seed.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(pool.Close)
	client := postgres.NewClient(pool)
	noChild := map[string]any{"_not": dependentExists("child", "tag", "blocked")}
	noForbiddenRoot := map[string]any{"_not": dependentExists("parent", "label", "forbidden")}

	tests := []struct {
		name, query                string
		parent, child, before      map[string]any
		session                    map[string]any
		deny                       bool
		parents, children, befores int
	}{
		{
			name:     "a child sees preceding magic parent",
			child:    dependentExists("parent", "label", "magic"),
			query:    `mutation{insert_parent(objects:[{id:1,label:"magic",rel_arr_00000:{data:[{id:10}]}},{id:2,label:"ordinary"}]){affected_rows}}`,
			parents:  2,
			children: 1,
		},
		{
			name:  "a child does not see later magic parent",
			child: dependentExists("parent", "label", "magic"),
			query: `mutation{insert_parent(objects:[{id:1,label:"ordinary",rel_arr_00000:{data:[{id:10}]}},{id:2,label:"magic"}]){affected_rows}}`,
			deny:  true,
		},
		{
			name:     "b1 root cannot see own future array",
			parent:   noChild,
			query:    `mutation{insert_parent(objects:[{id:1,rel_arr_00000:{data:[{id:10,tag:"blocked"}]}}]){affected_rows}}`,
			parents:  1,
			children: 1,
		},
		{
			name:   "b1 root sees earlier array",
			parent: noChild,
			query:  `mutation{insert_parent(objects:[{id:1,rel_arr_00000:{data:[{id:10,tag:"blocked"}]}},{id:2}]){affected_rows}}`,
			deny:   true,
		},
		{
			name:    "b2 before-object does not see own future root",
			before:  noForbiddenRoot,
			query:   `mutation{insert_parent(objects:[{id:1,label:"forbidden",obj_rel_0001:{data:{id:10}}}]){affected_rows}}`,
			parents: 1,
			befores: 1,
		},
		{
			name:   "b2 before-object sees earlier root",
			before: noForbiddenRoot,
			query:  `mutation{insert_parent(objects:[{id:1,label:"forbidden"},{id:2,obj_rel_0001:{data:{id:10}}}]){affected_rows}}`,
			deny:   true,
		},
		{
			name:     "b3 sibling children without relationships share snapshot",
			child:    noChild,
			query:    `mutation{insert_parent(objects:[{id:1,rel_arr_00000:{data:[{id:10,tag:"blocked"},{id:11,tag:"ordinary"}]}}]){affected_rows}}`,
			parents:  1,
			children: 2,
		},
		{
			name:  "b3 child sees preceding root's child",
			child: noChild,
			query: `mutation{insert_parent(objects:[{id:1,rel_arr_00000:{data:[{id:10,tag:"blocked"}]}},{id:2,rel_arr_00000:{data:[{id:11,tag:"ordinary"}]}}]){affected_rows}}`,
			deny:  true,
		},
		{
			name:     "session check accepts bound variable",
			child:    map[string]any{"tag": map[string]any{"_eq": "X-Hasura-User-Id"}},
			query:    `mutation{insert_parent(objects:[{id:1,rel_arr_00000:{data:[{id:10,tag:"mine"}]}}]){affected_rows}}`,
			session:  map[string]any{"x-hasura-user-id": "mine"},
			parents:  1,
			children: 1,
		},
		{
			name:    "session check denies mismatched variable",
			child:   map[string]any{"tag": map[string]any{"_eq": "X-Hasura-User-Id"}},
			query:   `mutation{insert_parent(objects:[{id:1,rel_arr_00000:{data:[{id:10,tag:"theirs"}]}}]){affected_rows}}`,
			session: map[string]any{"x-hasura-user-id": "mine"},
			deny:    true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := pool.Exec(
				t.Context(),
				`TRUNCATE event_log,obj_after,grandchild,child,parent,obj_before RESTART IDENTITY CASCADE`,
			); err != nil {
				t.Fatal(err)
			}

			md := dependentPermissionMetadata(tt.parent, tt.child, tt.before)

			err := executeDependentRoleQuery(t, client, md, tt.query, tt.session)
			if tt.deny {
				if err == nil || !strings.Contains(err.Error(), "SQLSTATE ZZ901") ||
					!strings.HasPrefix(
						err.Error(),
						"failed to execute operation insert_parent: failed to scan result row:",
					) {
					t.Fatalf("denial error = %v", err)
				}
			} else if err != nil {
				t.Fatalf("positive case: %v", err)
			}

			var parents, children, befores int
			if err := pool.QueryRow(t.Context(), `SELECT (SELECT count(*) FROM parent),
			(SELECT count(*) FROM child),(SELECT count(*) FROM obj_before)`).Scan(&parents, &children, &befores); err != nil {
				t.Fatal(err)
			}

			if parents != tt.parents || children != tt.children || befores != tt.befores {
				t.Fatalf(
					"stored parent/child/before = %d/%d/%d, want %d/%d/%d",
					parents,
					children,
					befores,
					tt.parents,
					tt.children,
					tt.befores,
				)
			}
		})
	}
}

//nolint:paralleltest,tparallel // Shared fixture is truncated between denial cases.
func TestDependentInsertGrandchildDenialAndLaterRootRollback(t *testing.T) {
	t.Parallel()
	seed := testdb.NewPostgres(t, dependentInsertDDL)

	pool, err := postgres.Open(t.Context(), seed.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(pool.Close)
	client := postgres.NewClient(pool)

	tests := []struct {
		name, query, errorRoot       string
		parentCheck, grandchildCheck map[string]any
	}{
		{
			name:            "grandchild denial keeps root wrapper",
			errorRoot:       "insert_parent",
			query:           `mutation{insert_parent(objects:[{id:1,rel_arr_00000:{data:[{id:10,rel_arr_00000:{data:[{id:20}]}}]}}]){affected_rows}}`,
			grandchildCheck: map[string]any{"id": map[string]any{"_eq": 999}},
		},
		{
			name:        "later root failure rolls back earlier plan",
			errorRoot:   "later",
			query:       `mutation{earlier:insert_parent(objects:[{id:1,label:"good",rel_arr_00000:{data:[{id:10}]}}]){affected_rows} later:insert_parent(objects:[{id:2,label:"bad"}]){affected_rows}}`,
			parentCheck: map[string]any{"label": map[string]any{"_eq": "good"}},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := pool.Exec(
				t.Context(),
				`TRUNCATE event_log,obj_after,grandchild,child,parent,obj_before RESTART IDENTITY CASCADE`,
			); err != nil {
				t.Fatal(err)
			}

			md := dependentPermissionMetadata(tt.parentCheck, nil, nil)

			md.Tables[4].InsertPermissions[0].Permission.Check = tt.grandchildCheck
			if tt.grandchildCheck == nil {
				md.Tables[4].InsertPermissions[0].Permission.Check = map[string]any{}
			}

			err := executeDependentRoleQuery(t, client, md, tt.query, nil)

			wantPrefix := "failed to execute operation " + tt.errorRoot + ": failed to scan result row: ERROR: check constraint of an insert/update permission has failed"
			if err == nil || !strings.HasPrefix(err.Error(), wantPrefix) ||
				!strings.HasSuffix(
					err.Error(),
					"(SQLSTATE ZZ901)",
				) || strings.Contains(err.Error(), "sequential operation") {
				t.Fatalf("error chain = %v, want root ZZ901 wrapper", err)
			}

			var parents, children, grandchildren int
			if err := pool.QueryRow(t.Context(), `SELECT (SELECT count(*) FROM parent),
			(SELECT count(*) FROM child),(SELECT count(*) FROM grandchild)`).
				Scan(&parents, &children, &grandchildren); err != nil {
				t.Fatal(err)
			}

			if parents != 0 || children != 0 || grandchildren != 0 {
				t.Fatalf(
					"rollback left parent/child/grandchild = %d/%d/%d",
					parents,
					children,
					grandchildren,
				)
			}
		})
	}
}

func TestDependentInsertIndexedCheckLargeParent(t *testing.T) {
	t.Parallel()
	seed := testdb.NewPostgres(
		t,
		dependentInsertDDL+`CREATE INDEX parent_label_idx ON parent(label);`,
		`INSERT INTO parent(id,label) SELECT i,'ordinary' FROM generate_series(1,10000) AS i; ANALYZE parent;`,
	)

	pool, err := postgres.Open(t.Context(), seed.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(pool.Close)

	md := dependentPermissionMetadata(nil, dependentExists("parent", "label", "magic"), nil)

	err = executeDependentRoleQuery(
		t,
		postgres.NewClient(pool),
		md,
		`mutation{insert_parent(objects:[{id:20000,label:"magic",rel_arr_00000:{data:[{id:10}]}}]){affected_rows}}`,
		nil,
	)
	if err != nil {
		t.Fatal(err)
	}

	var parents, children int
	if err := pool.QueryRow(t.Context(), `SELECT (SELECT count(*) FROM parent),(SELECT count(*) FROM child)`).
		Scan(&parents, &children); err != nil {
		t.Fatal(err)
	}

	if parents != 10001 || children != 1 {
		t.Fatalf("indexed large-parent check left %d parents, %d children", parents, children)
	}
}
