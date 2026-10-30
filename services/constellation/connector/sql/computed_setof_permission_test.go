package sql_test

import (
	"log/slog"
	"testing"

	csql "github.com/nhost/nhost/services/constellation/connector/sql"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/metadata"
)

//nolint:paralleltest,cyclop // One isolated testdb checks every predicate surface and persisted rows sequentially.
func TestComputedSetofRolePredicatesFailClosed(t *testing.T) {
	fixture := computedTestDB(t)
	if _, err := fixture.Exec(
		t.Context(),
		`CREATE FUNCTION cf_select.p14_setof_pred(item cf_select.items)
		RETURNS SETOF int4 LANGUAGE sql STABLE AS $$ SELECT 1 $$`,
	); err != nil {
		t.Fatal(err)
	}

	md, err := metadata.FromHasuraJSON(computedFixture(t, "metadata.json"))
	if err != nil {
		t.Fatal(err)
	}

	items := &md.Databases[0].Tables[0]
	items.ComputedFields = append(items.ComputedFields, metadata.ComputedField{
		Name: "p14_setof_pred",
		Definition: metadata.ComputedFieldDefinition{
			Function: metadata.FunctionSource{Schema: "cf_select", Name: "p14_setof_pred"},
		},
	})
	pred := map[string]any{"p14_setof_pred": map[string]any{"_eq": 1}}
	items.SelectPermissions = append(items.SelectPermissions, metadata.SelectPermission{
		Role: "cf_setof_pred",
		Permission: metadata.SelectPermissionConfig{
			Columns: []string{"id", "label"}, Filter: pred,
		},
	})
	items.SelectPermissions = append(items.SelectPermissions, metadata.SelectPermission{
		Role: "cf_setof_check",
		Permission: metadata.SelectPermissionConfig{
			Columns: []string{
				"id",
				"label",
			},
			Filter: map[string]any{"id": map[string]any{"_eq": 2}},
		},
	})
	items.InsertPermissions = append(items.InsertPermissions, metadata.InsertPermission{
		Role: "cf_setof_pred",
		Permission: metadata.InsertPermissionConfig{
			Columns: []string{"id", "owner_id", "label", "amount", "payload"}, Check: pred,
		},
	})
	items.UpdatePermissions = append(items.UpdatePermissions,
		metadata.UpdatePermission{
			Role: "cf_setof_pred",
			Permission: metadata.UpdatePermissionConfig{
				Columns: []string{"label"}, Filter: pred, Check: pred,
			},
		},
		metadata.UpdatePermission{
			Role: "cf_setof_check",
			Permission: metadata.UpdatePermissionConfig{
				Columns: []string{"label"}, Filter: map[string]any{"id": map[string]any{"_eq": 2}},
				Check: pred,
			},
		},
	)
	items.DeletePermissions = append(items.DeletePermissions, metadata.DeletePermission{
		Role: "cf_setof_pred", Permission: metadata.DeletePermissionConfig{Filter: pred},
	})

	pool, err := postgres.Open(t.Context(), fixture.Config().ConnString())
	if err != nil {
		t.Fatal(err)
	}

	inc := metadata.NewInconsistencies()

	conn, err := csql.NewConnector(
		t.Context(),
		postgres.NewClient(pool),
		&md.Databases[0],
		inc,
		slog.Default(),
	)
	if err != nil {
		pool.Close()
		t.Fatal(err)
	}

	t.Cleanup(conn.Close)

	if got := inc.Snapshot(); len(got) != 0 {
		t.Fatalf("role predicate inconsistency: %+v", got)
	}

	schemas, err := conn.GetSchema()
	if err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct{ role, root, operation string }{
		{"cf_setof_pred", "cf_select_items", "query_root"},
		{"cf_setof_pred", "insert_cf_select_items", "mutation_root"},
		{"cf_setof_pred", "update_cf_select_items", "mutation_root"},
		{"cf_setof_pred", "delete_cf_select_items", "mutation_root"},
		{"cf_setof_check", "update_cf_select_items", "mutation_root"},
	} {
		schema := schemas[tc.role]
		if schema == nil || schema.ToAST().Definitions.ForName(tc.operation) == nil ||
			schema.ToAST().Definitions.ForName(tc.operation).Fields.ForName(tc.root) == nil {
			t.Fatalf("%s lost %s in %s", tc.role, tc.root, tc.operation)
		}
	}

	for _, tc := range []struct{ name, role, query string }{
		{"select filter", "cf_setof_pred", `{cf_select_items{id}}`},
		{"user where", "admin", `{cf_select_items(where:{p14_setof_pred:{_eq:1}}){id}}`},
		{"insert check", "cf_setof_pred", `mutation{insert_cf_select_items_one(object:{id:110,owner_id:1,label:"wrong",amount:1,payload:{}}){id}}`},
		{"update filter", "cf_setof_pred", `mutation{update_cf_select_items(where:{id:{_eq:2}},_set:{label:"wrong"}){affected_rows}}`},
		{"update check", "cf_setof_check", `mutation{update_cf_select_items(where:{id:{_eq:2}},_set:{label:"wrong"}){affected_rows}}`},
		{"delete filter", "cf_setof_pred", `mutation{delete_cf_select_items(where:{id:{_eq:2}}){affected_rows}}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			assertSetofKindError(t, conn, tc.role, tc.query, "0A000")

			var inserted, changed, remaining int
			if err := fixture.QueryRow(t.Context(), `SELECT count(*) FILTER (WHERE id=110),
				count(*) FILTER (WHERE label='wrong'), count(*) FILTER (WHERE id=2)
				FROM cf_select.items`).Scan(&inserted, &changed, &remaining); err != nil {
				t.Fatal(err)
			}

			if inserted != 0 || changed != 0 || remaining != 1 {
				t.Fatalf(
					"failed %s changed rows: inserted=%d changed=%d remaining=%d",
					tc.name,
					inserted,
					changed,
					remaining,
				)
			}
		})
	}
}
