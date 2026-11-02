package queries_test

import (
	"errors"
	"reflect"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

//nolint:paralleltest,tparallel // The same captured fixture verifies all validation paths without writes.
func TestDependentInsertDeterminedFKValidation(t *testing.T) {
	t.Parallel()
	seed := testdb.NewPostgres(t, dependentInsertDDL)

	pool, err := postgres.Open(t.Context(), seed.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(pool.Close)

	md := dependentInsertMetadata()
	md.Tables[3].ObjectRelationships = append(md.Tables[3].ObjectRelationships,
		metadata.ObjectRelationship{
			Name: "owner", Using: metadata.RelationshipUsing{
				ForeignKeyColumns: []string{"parent_id"},
			},
		})

	objects, err := postgres.NewClient(pool).Introspect(t.Context(), md)
	if err != nil {
		t.Fatal(err)
	}

	roots, _, err := queries.BuildRoots(objects, md, dialect.NewPostgresDialect())
	if err != nil {
		t.Fatal(err)
	}

	tests := []struct{ name, query, message, path string }{
		{
			"array child",
			`mutation{insert_parent(objects:[{id:1,rel_arr_00000:{data:[{id:10,parent_id:3}]}}]){affected_rows}}`,
			`cannot insert "parent_id" columns as their values are already being determined by parent insert`,
			`$.selectionSet.insert_parent.args.objects[0].rel_arr_00000.data[0]`,
		},
		{
			"after-parent object",
			`mutation{insert_parent(objects:[{id:1,obj_rel_0000:{data:{id:30,parent_id:3}}}]){affected_rows}}`,
			`cannot insert "parent_id" columns as their values are already being determined by parent insert`,
			`$.selectionSet.insert_parent.args.objects[0].obj_rel_0000.data[0]`,
		},
		{
			"before-parent object",
			`mutation{insert_parent(objects:[{id:1,before_id:3,obj_rel_0001:{data:{id:10}}}]){affected_rows}}`,
			`cannot insert object relationship "obj_rel_0001" as "before_id" column values are already determined`,
			`$.selectionSet.insert_parent.args.objects[0].obj_rel_0001`,
		},
		{
			"inherited FK overlaps before-parent relationship",
			`mutation{insert_parent(objects:[{id:1,rel_arr_00000:{data:[{id:10,owner:{data:{id:5}}}]}}]){affected_rows}}`,
			`cannot insert object relationship "owner" as "parent_id" column values are already determined`,
			`$.selectionSet.insert_parent.args.objects[0].rel_arr_00000.data[0].owner`,
		},
		{
			"inherited and client FK overlap: parent takes precedence",
			`mutation{insert_parent(objects:[{id:1,rel_arr_00000:{data:[{id:10,parent_id:3,owner:{data:{id:5}}}]}}]){affected_rows}}`,
			`cannot insert "parent_id" columns as their values are already being determined by parent insert`,
			`$.selectionSet.insert_parent.args.objects[0].rel_arr_00000.data[0]`,
		},
		{
			"two before relationships report only first overlapping relationship's column",
			`mutation{insert_child(objects:[{id:10,parent_id:3,before_id:5,owner:{data:{id:1}},obj_rel_0001:{data:{id:11}}}]){affected_rows}}`,
			`cannot insert object relationship "obj_rel_0001" as "before_id" column values are already determined`,
			`$.selectionSet.insert_child.args.objects[0].obj_rel_0001`,
		},
		{
			"second before relationship gets its own column and path",
			`mutation{insert_child(objects:[{id:10,parent_id:3,owner:{data:{id:1}},obj_rel_0001:{data:{id:11}}}]){affected_rows}}`,
			`cannot insert object relationship "owner" as "parent_id" column values are already determined`,
			`$.selectionSet.insert_child.args.objects[0].owner`,
		},
		{
			"insert_one array",
			`mutation{insert_parent_one(object:{id:1,rel_arr_00000:{data:[{id:10,parent_id:3}]}}){id}}`,
			`cannot insert "parent_id" columns as their values are already being determined by parent insert`,
			`$.selectionSet.insert_parent_one.args.object[0].rel_arr_00000.data[0]`,
		},
		{
			"insert_one after-parent object",
			`mutation{insert_parent_one(object:{id:1,obj_rel_0000:{data:{id:30,parent_id:3}}}){id}}`,
			`cannot insert "parent_id" columns as their values are already being determined by parent insert`,
			`$.selectionSet.insert_parent_one.args.object[0].obj_rel_0000.data[0]`,
		},
		{
			"insert_one before-parent object",
			`mutation{insert_parent_one(object:{id:1,before_id:3,obj_rel_0001:{data:{id:10}}}){id}}`,
			`cannot insert object relationship "obj_rel_0001" as "before_id" column values are already determined`,
			`$.selectionSet.insert_parent_one.args.object[0].obj_rel_0001`,
		},
		{
			"insert_one inherited FK overlaps before-parent relationship",
			`mutation{insert_parent_one(object:{id:1,rel_arr_00000:{data:[{id:10,owner:{data:{id:5}}}]}}){id}}`,
			`cannot insert object relationship "owner" as "parent_id" column values are already determined`,
			`$.selectionSet.insert_parent_one.args.object[0].rel_arr_00000.data[0].owner`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			doc, parseErr := parser.ParseQuery(&ast.Source{Input: tt.query})
			if parseErr != nil {
				t.Fatal(parseErr)
			}

			_, err := roots.BuildQuery(doc.Operations[0], doc.Fragments, nil, "admin", nil)

			var validation *arguments.QueryValidationError
			if !errors.As(err, &validation) {
				t.Fatalf("BuildQuery error = %T: %v, want validation", err, err)
			}

			want := map[string]any{"message": tt.message, "extensions": map[string]any{
				"code": "validation-failed", "path": tt.path,
			}}
			if !reflect.DeepEqual(validation.AsMap(), want) {
				t.Fatalf("validation = %#v, want %#v", validation.AsMap(), want)
			}
		})
	}

	var parents, children, before int
	if err := pool.QueryRow(t.Context(), `SELECT (SELECT count(*) FROM parent),
	(SELECT count(*) FROM child),(SELECT count(*) FROM obj_before)`).Scan(&parents, &children, &before); err != nil {
		t.Fatal(err)
	}

	if parents != 0 || children != 0 || before != 0 {
		t.Fatalf("validation wrote parent/child/before = %d/%d/%d", parents, children, before)
	}
}
