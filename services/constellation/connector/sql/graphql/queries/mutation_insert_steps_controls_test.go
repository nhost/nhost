package queries_test

import (
	"encoding/json/jsontext"
	"fmt"
	"log/slog"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
)

func executeDependentCase(
	t *testing.T,
	ddl, seed, query string,
) (*pgxpool.Pool, jsontext.Value, error) {
	t.Helper()
	seedPool := testdb.NewPostgres(t, ddl, seed)

	pool, err := postgres.Open(t.Context(), seedPool.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatalf("Open: %v", err)
	}

	t.Cleanup(pool.Close)

	md := dependentInsertMetadata()

	objects, err := postgres.NewClient(pool).Introspect(t.Context(), md)
	if err != nil {
		t.Fatalf("Introspect: %v", err)
	}

	roots, _, err := queries.BuildRoots(objects, md, dialect.NewPostgresDialect())
	if err != nil {
		t.Fatalf("BuildRoots: %v", err)
	}

	doc, parseErr := parser.ParseQuery(&ast.Source{Input: query})
	if parseErr != nil {
		t.Fatalf("ParseQuery: %v", parseErr)
	}

	ops, err := roots.BuildQuery(doc.Operations[0], doc.Fragments, nil, "admin", nil)
	if err != nil {
		return seedPool, nil, fmt.Errorf("BuildQuery: %w", err)
	}

	if len(ops) != 1 {
		t.Fatalf("expected one operation, got %#v", ops)
	}

	results, err := postgres.NewClient(pool).
		ExecuteOperations(t.Context(), ops, slog.New(slog.DiscardHandler))
	if err != nil {
		return seedPool, nil, fmt.Errorf("executing dependent insert: %w", err)
	}

	if results[ops[0].Name] == nil {
		return seedPool, jsontext.Value("null"), nil
	}

	value, ok := results[ops[0].Name].(jsontext.Value)
	if !ok {
		t.Fatalf("result type = %T", results[ops[0].Name])
	}

	return seedPool, value, nil
}

func TestDependentInsertZeroRowsAndForeignKeys(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name, seed, query, wantResult, wantError         string
		wantParents, wantBefore, wantChildren, wantAfter int
	}{
		{
			name:        "array descendant rolls back prior before-parent object",
			seed:        `INSERT INTO parent(id,label) VALUES(1,'old');`,
			query:       `mutation { insert_parent(objects:[{id:1,label:"new",obj_rel_0001:{data:{id:11}},rel_arr_00000:{data:[{id:12}]}}],on_conflict:{constraint:parent_pkey,update_columns:[]}) {affected_rows returning{id}} }`,
			wantError:   `cannot proceed to insert array relations`,
			wantParents: 1,
		},
		{
			name:        "insert_one object survives zero-row parent",
			seed:        `INSERT INTO parent(id,label) VALUES(1,'old');`,
			query:       `mutation { insert_parent_one(object:{id:1,label:"new",obj_rel_0001:{data:{id:11}}},on_conflict:{constraint:parent_pkey,update_columns:[]}) {id} }`,
			wantResult:  `null`,
			wantParents: 1,
			wantBefore:  1,
		},
		{
			name:        "insert_one false conflict where keeps before object",
			seed:        `INSERT INTO parent(id,label) VALUES(1,'old');`,
			query:       `mutation { insert_parent_one(object:{id:1,label:"new",obj_rel_0001:{data:{id:11}}},on_conflict:{constraint:parent_pkey,update_columns:[label],where:{label:{_eq:"never"}}}) {id} }`,
			wantResult:  `null`,
			wantParents: 1,
			wantBefore:  1,
		},
		{
			name:        "insert_one array descendant rolls back before object",
			seed:        `INSERT INTO parent(id,label) VALUES(1,'old');`,
			query:       `mutation { insert_parent_one(object:{id:1,label:"new",obj_rel_0001:{data:{id:11}},rel_arr_00000:{data:[{id:12}]}},on_conflict:{constraint:parent_pkey,update_columns:[]}) {id} }`,
			wantError:   `cannot proceed to insert array relations`,
			wantParents: 1,
		},
		{
			name:        "insert_one after-parent descendant rolls back",
			seed:        `INSERT INTO parent(id,label) VALUES(1,'old');`,
			query:       `mutation { insert_parent_one(object:{id:1,label:"new",obj_rel_0000:{data:{id:30}}},on_conflict:{constraint:parent_pkey,update_columns:[]}) {id} }`,
			wantError:   `cannot proceed to insert array relations`,
			wantParents: 1,
		},
		{
			name:        "before-parent object alone survives zero-row parent",
			seed:        `INSERT INTO parent(id,label) VALUES(1,'old');`,
			query:       `mutation { insert_parent(objects:[{id:1,label:"new",obj_rel_0001:{data:{id:11}}}],on_conflict:{constraint:parent_pkey,update_columns:[]}) {affected_rows returning{id}} }`,
			wantResult:  `"affected_rows":1`,
			wantParents: 1,
			wantBefore:  1,
		},
		{
			name:        "implicit after-parent object rejects zero-row parent",
			seed:        `INSERT INTO parent(id,label) VALUES(1,'old');`,
			query:       `mutation { insert_parent(objects:[{id:1,label:"new",obj_rel_0000:{data:{id:30}}}],on_conflict:{constraint:parent_pkey,update_columns:[]}) {affected_rows returning{id}} }`,
			wantError:   `cannot proceed to insert array relations`,
			wantParents: 1,
		},
		{
			name:        "after-parent own DO NOTHING counts zero, not object error",
			seed:        `INSERT INTO parent(id,label) VALUES(99,'old'); INSERT INTO obj_after(id,parent_id) VALUES(30,99);`,
			query:       `mutation { insert_parent(objects:[{id:2,label:"new",obj_rel_0000:{data:{id:30},on_conflict:{constraint:obj_after_pkey,update_columns:[]}}}]) {affected_rows returning{id}} }`,
			wantResult:  `"affected_rows":1`,
			wantParents: 2,
			wantAfter:   1,
		},
		{
			name:       "before-parent own DO NOTHING is an error",
			seed:       `INSERT INTO obj_before(id) VALUES(11);`,
			query:      `mutation { insert_parent(objects:[{id:2,obj_rel_0001:{data:{id:11},on_conflict:{constraint:obj_before_pkey,update_columns:[]}}}]) {affected_rows} }`,
			wantError:  `cannot proceed to insert object relation`,
			wantBefore: 1,
		},
		{
			name:         "upsert changed key feeds child from returned row",
			seed:         `INSERT INTO parent(id,label) VALUES(1,'unique');`,
			query:        `mutation { insert_parent(objects:[{id:2,label:"unique",rel_arr_00000:{data:[{id:10}]}}],on_conflict:{constraint:parent_label_key,update_columns:[id]}) {affected_rows returning{id}} }`,
			wantResult:   `"affected_rows":2`,
			wantParents:  1,
			wantChildren: 1,
		},
		{
			name:         "relationship-free child batch DO NOTHING counts only the inserted child",
			query:        `mutation {insert_parent(objects:[{id:1,rel_arr_00000:{data:[{id:10},{id:10}],on_conflict:{constraint:child_pkey,update_columns:[]}}}]){affected_rows}}`,
			wantResult:   `"affected_rows":2`,
			wantParents:  1,
			wantChildren: 1,
		},
		{
			name:      "relationship-free child batch DO UPDATE cardinality rolls back root",
			query:     `mutation {insert_parent(objects:[{id:1,rel_arr_00000:{data:[{id:10},{id:10}],on_conflict:{constraint:child_pkey,update_columns:[before_id]}}}]){affected_rows}}`,
			wantError: `SQLSTATE 21000`,
		},
		{
			name:      "explicit array FK rejected before any insert",
			query:     `mutation { insert_parent(objects:[{id:1,rel_arr_00000:{data:[{id:10,parent_id:7}]}}]) {affected_rows} }`,
			wantError: `cannot insert "parent_id" columns as their values are already being determined by parent insert`,
		},
		{
			name:      "explicit after-parent FK rejected before any insert",
			query:     `mutation { insert_parent(objects:[{id:1,obj_rel_0000:{data:{id:30,parent_id:7}}}]) {affected_rows} }`,
			wantError: `cannot insert "parent_id" columns as their values are already being determined by parent insert`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			pool, got, err := executeDependentCase(
				t,
				dependentInsertDDL+`ALTER TABLE parent ADD CONSTRAINT parent_label_key UNIQUE(label);`,
				tt.seed,
				tt.query,
			)
			if tt.wantError != "" {
				if err == nil || !strings.Contains(err.Error(), tt.wantError) {
					t.Fatalf("error = %v; want %q", err, tt.wantError)
				}
			} else if err != nil || !strings.Contains(strings.ReplaceAll(string(got), " ", ""), tt.wantResult) {
				t.Fatalf("result = %s, error = %v; want %q", got, err, tt.wantResult)
			}

			var parents, before, children, after int
			if err := pool.QueryRow(t.Context(), `SELECT (SELECT count(*) FROM parent),
			(SELECT count(*) FROM obj_before),(SELECT count(*) FROM child),(SELECT count(*) FROM obj_after)`).
				Scan(&parents, &before, &children, &after); err != nil {
				t.Fatal(err)
			}

			if tt.name == "upsert changed key feeds child from returned row" {
				var parentID int
				if err := pool.QueryRow(t.Context(), `SELECT parent_id FROM child WHERE id=10`).
					Scan(&parentID); err != nil ||
					parentID != 2 {
					t.Errorf("upsert child FK = %d, error = %v; want 2", parentID, err)
				}
			}

			if parents != tt.wantParents || before != tt.wantBefore ||
				children != tt.wantChildren ||
				after != tt.wantAfter {
				t.Errorf(
					"stored parent/before/child/after = %d/%d/%d/%d, want %d/%d/%d/%d",
					parents,
					before,
					children,
					after,
					tt.wantParents,
					tt.wantBefore,
					tt.wantChildren,
					tt.wantAfter,
				)
			}
		})
	}
}
