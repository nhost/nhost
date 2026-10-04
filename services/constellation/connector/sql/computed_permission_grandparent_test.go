package sql_test

import (
	"errors"
	"fmt"
	"log/slog"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/metadata"
)

// Array-child checks must traverse the inserted parent to its in-flight object
// parent. Negating that two-hop predicate must deny and roll back every row.
//
//nolint:gocognit,gocyclo,cyclop,maintidx // This ordered security matrix asserts branch outcomes and physical rollback together.
func verifyNestedArrayGrandparentPermissionCheck(t *testing.T) {
	t.Helper()

	for _, tc := range []struct {
		computed, negated, upsert, partitioned bool
	}{
		{false, false, false, false},
		{false, true, false, false},
		{true, false, false, false},
		{true, true, false, false},
		{false, false, true, false},
		{false, true, true, false},
		{true, false, true, false},
		{true, true, true, false},
		{false, false, false, true},
		{false, true, false, true},
		{true, false, false, true},
		{true, true, false, true},
		{false, false, true, true},
		{false, true, true, true},
		{true, false, true, true},
		{true, true, true, true},
	} {
		name := fmt.Sprintf("computed=%t/negated=%t/upsert=%t/partitioned=%t",
			tc.computed, tc.negated, tc.upsert, tc.partitioned)
		runPermissionCase(t, name, func(t *testing.T) {
			t.Helper()
			md, db := permissionFixture(t)

			_, err := db.Exec(t.Context(), `
CREATE TABLE cf_select.grp (id integer PRIMARY KEY, label text NOT NULL);
ALTER TABLE cf_select.items ADD COLUMN grp_id integer REFERENCES cf_select.grp(id);
CREATE FUNCTION cf_select.grp_label(g cf_select.grp) RETURNS text LANGUAGE sql STABLE AS $$ SELECT g.label $$;
INSERT INTO cf_select.tags(id,item_id,label) VALUES (90091,1,'before');`)
			if err != nil {
				t.Fatal(err)
			}

			grp := metadata.TableSource{Schema: "cf_select", Name: "grp"}
			tag := metadata.TableSource{Schema: "cf_select", Name: "tags"}
			md.Tables = append(md.Tables, metadata.TableMetadata{
				Table: grp,
				ComputedFields: []metadata.ComputedField{{
					Name: "grp_label", Definition: metadata.ComputedFieldDefinition{
						Function: metadata.FunctionSource{Schema: "cf_select", Name: "grp_label"},
					},
				}},
				InsertPermissions: []metadata.InsertPermission{{
					Role: "phase9_guard", Permission: metadata.InsertPermissionConfig{
						Columns: []string{"id", "label"}, Check: map[string]any{},
					},
				}},
				SelectPermissions: []metadata.SelectPermission{{
					Role: "phase9_guard", Permission: metadata.SelectPermissionConfig{
						Columns: []string{"id", "label"},
					},
				}},
			})
			parent := &md.Tables[0]
			child := &md.Tables[1]

			parent.ObjectRelationships = append(
				parent.ObjectRelationships,
				metadata.ObjectRelationship{
					Name:  "grp",
					Using: metadata.RelationshipUsing{ForeignKeyColumns: []string{"grp_id"}},
				},
			)
			parent.ArrayRelationships = append(
				parent.ArrayRelationships,
				metadata.ArrayRelationship{
					Name: "tags",
					Using: metadata.RelationshipUsing{
						ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
							Columns: []string{"item_id"}, Table: tag,
						},
					},
				},
			)
			parent.InsertPermissions = append(parent.InsertPermissions, metadata.InsertPermission{
				Role: "phase9_guard", Permission: metadata.InsertPermissionConfig{
					Columns: []string{"id", "owner_id", "label", "amount", "payload", "grp_id"},
					Check:   map[string]any{},
				},
			})
			parent.SelectPermissions = append(parent.SelectPermissions, metadata.SelectPermission{
				Role: "phase9_guard", Permission: metadata.SelectPermissionConfig{
					Columns: []string{"id", "grp_id"},
				},
			})
			child.ObjectRelationships = append(
				child.ObjectRelationships,
				metadata.ObjectRelationship{
					Name:  "item",
					Using: metadata.RelationshipUsing{ForeignKeyColumns: []string{"item_id"}},
				},
			)
			child.InsertPermissions = append(child.InsertPermissions, metadata.InsertPermission{
				Role: "phase9_guard", Permission: metadata.InsertPermissionConfig{
					Columns: []string{"id", "item_id", "label"}, Check: map[string]any{},
				},
			})
			child.SelectPermissions = append(child.SelectPermissions, metadata.SelectPermission{
				Role: "phase9_guard", Permission: metadata.SelectPermissionConfig{
					Columns: []string{"id", "item_id", "label"},
				},
			})

			field := "label"
			if tc.computed {
				field = "grp_label"
			}

			predicate := map[string]any{"item": map[string]any{
				"grp": map[string]any{field: map[string]any{"_eq": "forbidden"}},
			}}
			if tc.negated {
				predicate = map[string]any{"_not": predicate}
			}

			if tc.upsert {
				child.UpdatePermissions = append(child.UpdatePermissions, metadata.UpdatePermission{
					Role: "phase9_guard", Permission: metadata.UpdatePermissionConfig{
						Columns: []string{
							"label",
							"item_id",
						},
						Filter: map[string]any{},
						Check:  predicate,
					},
				})
			} else {
				child.InsertPermissions[len(child.InsertPermissions)-1].Permission.Check = predicate
			}

			conn, inc := permissionConnector(t, md, db.Config().ConnString())
			if len(inc.Snapshot()) != 0 {
				t.Fatalf("unexpected inconsistencies: %+v", inc.Snapshot())
			}

			tagID := 90092

			conflict := ""
			if tc.upsert {
				tagID = 90091
				conflict = ",on_conflict:{constraint:tags_pkey,update_columns:[label,item_id]}"
			}

			object := fmt.Sprintf(
				`{id:90092,owner_id:1,label:"parent",amount:1,payload:{},grp:{data:{id:90093,label:"forbidden"}},tags:{data:[{id:%d,label:"after"}]%s}}`,
				tagID,
				conflict,
			)

			query := `mutation { insert_cf_select_items_one(object:` + object + `) { id } }`
			if tc.partitioned {
				query = `mutation { insert_cf_select_items(objects:[{id:90094,owner_id:1,label:"sibling",amount:1,payload:{},grp:{data:{id:90095,label:"other"}}},` + object + `]) { affected_rows } }`
			}

			doc, err := parser.ParseQuery(&ast.Source{Input: query})
			if err != nil {
				t.Fatal(err)
			}

			result, err := conn.Execute(t.Context(), doc.Operations[0], doc.Fragments,
				nil, "phase9_guard", nil, slog.Default())
			if tc.negated == (err == nil) {
				t.Fatalf("negated=%t, error=%v, result=%#v", tc.negated, err, result)
			}

			if tc.negated {
				var pgErr *pgconn.PgError
				if !errors.As(err, &pgErr) || pgErr.Code != "ZZ901" {
					t.Fatalf("denial = %v, want ZZ901", err)
				}
			}

			want := 1
			if tc.negated {
				want = 0
			}

			for _, table := range []struct {
				name string
				id   int
			}{{"items", 90092}, {"grp", 90093}, {"items", 90094}, {"grp", 90095}} {
				count := 0
				if table.name == "items" {
					err = db.QueryRow(t.Context(), `SELECT count(*) FROM cf_select.items WHERE id=$1`, table.id).
						Scan(&count)
				} else {
					err = db.QueryRow(t.Context(), `SELECT count(*) FROM cf_select.grp WHERE id=$1`, table.id).
						Scan(&count)
				}

				if err != nil {
					t.Fatal(err)
				}

				expected := want
				if (table.id == 90094 || table.id == 90095) && !tc.partitioned {
					expected = 0
				}

				if count != expected {
					t.Fatalf("%s %d: %d rows, want %d", table.name, table.id, count, expected)
				}
			}

			var count int
			if err := db.QueryRow(t.Context(), `SELECT count(*) FROM cf_select.tags WHERE id=90092`).
				Scan(&count); err != nil {
				t.Fatal(err)
			}

			if !tc.upsert && count != want || tc.upsert && count != 0 {
				t.Fatalf("new tag rows = %d", count)
			}

			var (
				itemID int
				label  string
			)
			if err := db.QueryRow(t.Context(), `SELECT item_id,label FROM cf_select.tags WHERE id=90091`).
				Scan(&itemID, &label); err != nil {
				t.Fatal(err)
			}

			if tc.upsert && !tc.negated {
				if itemID != 90092 || label != "after" {
					t.Fatalf("upserted tag = (%d,%s)", itemID, label)
				}
			} else if itemID != 1 || label != "before" {
				t.Fatalf("preexisting tag = (%d,%s)", itemID, label)
			}

			if !tc.negated {
				var stored string
				if err := db.QueryRow(t.Context(), `SELECT grp.label FROM cf_select.items item JOIN cf_select.grp grp ON grp.id=item.grp_id WHERE item.id=90092`).
					Scan(&stored); err != nil ||
					stored != "forbidden" {
					t.Fatalf("stored grandparent = %q, error=%v", stored, err)
				}
			}
		})
	}
}
