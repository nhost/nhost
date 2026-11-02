package sql_test

import (
	"errors"
	"log/slog"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/metadata"
)

// Nested object parents must be inserted and linked before array-child checks
// run, whether the array has one row or belongs to a partitioned parent.
//
//nolint:gocognit,cyclop,maintidx // This ordered security matrix asserts branch outcomes and physical rollback together.
func verifyNestedPartitionedArrayObjectPermissionCheck(t *testing.T) {
	t.Helper()

	for _, tc := range []struct {
		name        string
		negated     bool
		single      bool
		multi       bool
		singleMulti bool
	}{
		{name: "partitioned_positive"},
		{name: "partitioned_negated", negated: true},
		{name: "single_positive", single: true},
		{name: "single_negated", single: true, negated: true},
		{name: "multiple_nested_objects_positive", multi: true},
		{name: "multiple_nested_objects_negated", multi: true, negated: true},
		{name: "single_parent_multiple_objects_positive", singleMulti: true},
		{name: "single_parent_multiple_objects_negated", singleMulti: true, negated: true},
	} {
		runPermissionCase(t, tc.name, func(t *testing.T) {
			t.Helper()
			md, db := permissionFixture(t)

			_, err := db.Exec(t.Context(), `
CREATE TABLE cf_select.pa (id integer PRIMARY KEY);
CREATE TABLE cf_select.pc (id integer PRIMARY KEY, label text NOT NULL);
CREATE TABLE cf_select.pb (id integer PRIMARY KEY, pa_id integer NOT NULL REFERENCES cf_select.pa(id), pc_id integer REFERENCES cf_select.pc(id));
CREATE TABLE cf_select.pd (id integer PRIMARY KEY, pb_id integer NOT NULL REFERENCES cf_select.pb(id));
CREATE FUNCTION cf_select.pc_label(p cf_select.pc) RETURNS text LANGUAGE sql STABLE AS $$ SELECT p.label $$;`)
			if err != nil {
				t.Fatal(err)
			}

			pa := metadata.TableSource{Schema: "cf_select", Name: "pa"}
			pb := metadata.TableSource{Schema: "cf_select", Name: "pb"}
			pc := metadata.TableSource{Schema: "cf_select", Name: "pc"}
			pd := metadata.TableSource{Schema: "cf_select", Name: "pd"}
			md.Tables = append(md.Tables,
				metadata.TableMetadata{
					Table: pa,
					ArrayRelationships: []metadata.ArrayRelationship{
						{Name: "pbs", Using: metadata.RelationshipUsing{
							ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
								Columns: []string{"pa_id"},
								Table:   pb,
							},
						}},
					},
					InsertPermissions: []metadata.InsertPermission{
						{Role: "phase9_guard", Permission: metadata.InsertPermissionConfig{
							Columns: []string{"id"}, Check: map[string]any{},
						}},
					},
					SelectPermissions: []metadata.SelectPermission{
						{Role: "phase9_guard", Permission: metadata.SelectPermissionConfig{
							Columns: []string{"id"},
						}},
					},
				},
				metadata.TableMetadata{
					Table: pb,
					ObjectRelationships: []metadata.ObjectRelationship{
						{Name: "pc", Using: metadata.RelationshipUsing{
							ForeignKeyColumns: []string{"pc_id"},
						}},
					},
					ArrayRelationships: []metadata.ArrayRelationship{
						{Name: "pds", Using: metadata.RelationshipUsing{
							ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
								Columns: []string{"pb_id"},
								Table:   pd,
							},
						}},
					},
					InsertPermissions: []metadata.InsertPermission{
						{Role: "phase9_guard", Permission: metadata.InsertPermissionConfig{
							Columns: []string{"id", "pa_id", "pc_id"}, Check: map[string]any{},
						}},
					},
					SelectPermissions: []metadata.SelectPermission{
						{Role: "phase9_guard", Permission: metadata.SelectPermissionConfig{
							Columns: []string{"id", "pa_id", "pc_id"},
						}},
					},
				},
				metadata.TableMetadata{
					Table: pc,
					ComputedFields: []metadata.ComputedField{
						{Name: "pc_label", Definition: metadata.ComputedFieldDefinition{
							Function: metadata.FunctionSource{
								Schema: "cf_select",
								Name:   "pc_label",
							},
						}},
					},
					InsertPermissions: []metadata.InsertPermission{
						{Role: "phase9_guard", Permission: metadata.InsertPermissionConfig{
							Columns: []string{"id", "label"}, Check: map[string]any{},
						}},
					},
					SelectPermissions: []metadata.SelectPermission{
						{Role: "phase9_guard", Permission: metadata.SelectPermissionConfig{
							Columns: []string{"id", "label"},
						}},
					},
				},
				metadata.TableMetadata{
					Table: pd,
					ObjectRelationships: []metadata.ObjectRelationship{
						{Name: "pb", Using: metadata.RelationshipUsing{
							ForeignKeyColumns: []string{"pb_id"},
						}},
					},
					InsertPermissions: []metadata.InsertPermission{
						{Role: "phase9_guard", Permission: metadata.InsertPermissionConfig{
							Columns: []string{"id", "pb_id"}, Check: map[string]any{},
						}},
					},
					SelectPermissions: []metadata.SelectPermission{
						{Role: "phase9_guard", Permission: metadata.SelectPermissionConfig{
							Columns: []string{"id", "pb_id"},
						}},
					},
				},
			)

			check := map[string]any{"pb": map[string]any{"pc": map[string]any{
				"pc_label": map[string]any{"_eq": "forbidden"},
			}}}
			if tc.negated {
				check = map[string]any{"_not": check}
			}

			md.Tables[len(md.Tables)-1].InsertPermissions[0].Permission.Check = check

			conn, inc := permissionConnector(t, md, db.Config().ConnString())
			if len(inc.Snapshot()) != 0 {
				t.Fatalf("unexpected inconsistencies: %+v", inc.Snapshot())
			}

			query := `mutation { insert_cf_select_pa(objects:[{id:90091,pbs:{data:[{id:90091,pc:{data:{id:90091,label:"forbidden"}},pds:{data:[{id:90091}]}}]}},{id:90092}]) { affected_rows returning { id pbs { id pc { id label } } } } }`

			wantParents, wantObjects := 2, 1
			switch {
			case tc.single:
				query = `mutation { insert_cf_select_pa(objects:[{id:90091,pbs:{data:[{id:90091,pc:{data:{id:90091,label:"forbidden"}},pds:{data:[{id:90091}]}}]}}]) { affected_rows returning { id pbs { id pc { id label } } } } }`
				wantParents = 1
			case tc.multi:
				query = `mutation { insert_cf_select_pa(objects:[{id:90091,pbs:{data:[{id:90091,pc:{data:{id:90091,label:"forbidden"}},pds:{data:[{id:90091}]}},{id:90092,pc:{data:{id:90092,label:"forbidden"}},pds:{data:[{id:90092}]}}]}},{id:90092,pbs:{data:[{id:90093,pc:{data:{id:90093,label:"forbidden"}},pds:{data:[{id:90093}]}}]}}]) { affected_rows returning { id pbs { id pc { id label } } } } }`
				wantObjects = 3
			case tc.singleMulti:
				query = `mutation { insert_cf_select_pa(objects:[{id:90091,pbs:{data:[{id:90091,pc:{data:{id:90091,label:"forbidden"}},pds:{data:[{id:90091}]}},{id:90092,pc:{data:{id:90092,label:"forbidden"}},pds:{data:[{id:90092}]}}]}}]) { affected_rows returning { id pbs { id pc { id label } } } } }`
				wantParents, wantObjects = 1, 2
			}

			doc, err := parser.ParseQuery(&ast.Source{Input: query})
			if err != nil {
				t.Fatal(err)
			}

			result, err := conn.Execute(t.Context(), doc.Operations[0], doc.Fragments, nil,
				"phase9_guard", nil, slog.Default())
			if tc.negated {
				var pgErr *pgconn.PgError
				if !errors.As(err, &pgErr) || pgErr.Code != "ZZ901" {
					t.Fatalf(
						"negated check accepted or failed incorrectly: result=%v, error=%v; want ZZ901",
						result,
						err,
					)
				}
			} else if err != nil {
				t.Fatalf("positive check: %v (result=%v)", err, result)
			}

			var parents, objects, children, linked, matched int
			if err := db.QueryRow(t.Context(), `SELECT (SELECT count(*) FROM cf_select.pa), (SELECT count(*) FROM cf_select.pc), (SELECT count(*) FROM cf_select.pd), (SELECT count(*) FROM cf_select.pb WHERE pc_id IS NOT NULL), (SELECT count(*) FROM cf_select.pb WHERE pa_id = CASE WHEN id=90093 THEN 90092 ELSE 90091 END AND pc_id=id)`).
				Scan(&parents, &objects, &children, &linked, &matched); err != nil {
				t.Fatal(err)
			}

			if tc.negated {
				if parents != 0 || objects != 0 || children != 0 || linked != 0 || matched != 0 {
					t.Fatalf(
						"denied mutation persisted rows: pa=%d pc=%d pd=%d",
						parents,
						objects,
						children,
					)
				}
			} else if parents != wantParents || objects != wantObjects || children != wantObjects || linked != wantObjects || matched != wantObjects {
				t.Fatalf(
					"positive mutation lost rows or object link: pa=%d pc=%d pd=%d linked=%d",
					parents,
					objects,
					children,
					linked,
				)
			}
		})
	}
}
