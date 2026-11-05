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

//nolint:paralleltest // Bound the additional testdb pool under default package parallelism.
func TestComputedTableNestedInsertCheck(t *testing.T) {
	md, db := permissionFixture(t)
	md.Tables[0].ArrayRelationships = append(md.Tables[0].ArrayRelationships,
		metadata.ArrayRelationship{Name: "tags", Using: metadata.RelationshipUsing{
			ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
				Table:   metadata.TableSource{Schema: "cf_select", Name: "tags"},
				Columns: []string{"item_id"},
			},
		}})
	md.Tables[0].InsertPermissions = append(md.Tables[0].InsertPermissions,
		metadata.InsertPermission{Role: "table_guard", Permission: metadata.InsertPermissionConfig{
			Columns: []string{"id", "owner_id", "label", "amount", "payload"},
			Check:   map[string]any{"item_tags": map[string]any{}},
		}})
	md.Tables[0].SelectPermissions = append(md.Tables[0].SelectPermissions,
		metadata.SelectPermission{Role: "table_guard", Permission: metadata.SelectPermissionConfig{
			Columns: []string{"id"}, Filter: map[string]any{},
		}})
	md.Tables[1].InsertPermissions = append(md.Tables[1].InsertPermissions,
		metadata.InsertPermission{Role: "table_guard", Permission: metadata.InsertPermissionConfig{
			Columns: []string{"id", "item_id", "label"}, Check: map[string]any{},
		}})
	md.Tables[1].SelectPermissions = append(md.Tables[1].SelectPermissions,
		metadata.SelectPermission{Role: "table_guard", Permission: metadata.SelectPermissionConfig{
			Columns: []string{"id"}, Filter: map[string]any{},
		}})

	conn, inc := permissionConnector(t, md, db.Config().ConnString())
	if len(inc.Snapshot()) != 0 {
		t.Fatalf("nested table check dropped: %+v", inc.Snapshot())
	}

	doc, err := parser.ParseQuery(&ast.Source{Input: `mutation {
		insert_cf_select_items_one(object:{id:91,owner_id:1,label:"parent",amount:1,payload:{},
			tags:{data:[{id:91,label:"child"}]}}) { id }
	}`})
	if err != nil {
		t.Fatal(err)
	}

	_, err = conn.Execute(t.Context(), doc.Operations[0], doc.Fragments, nil,
		"table_guard", nil, slog.Default())

	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "ZZ901" {
		t.Fatalf("parent check must run before own array: %v", err)
	}

	var count int
	if err := db.QueryRow(t.Context(), `SELECT
		(SELECT count(*) FROM cf_select.items WHERE id=91) +
		(SELECT count(*) FROM cf_select.tags WHERE id=91)`).Scan(&count); err != nil || count != 0 {
		t.Fatalf("nested rollback: count=%d err=%v", count, err)
	}
}
