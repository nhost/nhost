package sql_test

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"errors"
	"fmt"
	"log/slog"
	"reflect"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	csql "github.com/nhost/nhost/services/constellation/connector/sql"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/permissions"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func permissionFixture(t *testing.T) (*metadata.DatabaseMetadata, *pgx.Conn) {
	t.Helper()
	fixture := computedTestDB(t)

	meta, err := metadata.FromHasuraJSON(computedFixture(t, "metadata.json"))
	if err != nil {
		t.Fatal(err)
	}

	return &meta.Databases[0], fixture
}

func permissionConnector(
	t *testing.T,
	md *metadata.DatabaseMetadata,
	dsn string,
) (*csql.Connector, *metadata.Inconsistencies) {
	t.Helper()

	pool, err := postgres.Open(t.Context(), dsn)
	if err != nil {
		t.Fatal(err)
	}

	inc := metadata.NewInconsistencies()

	connector, err := csql.NewConnector(
		t.Context(),
		postgres.NewClient(pool),
		md,
		inc,
		slog.Default(),
	)
	if err != nil {
		pool.Close()
		t.Fatalf("source unexpectedly failed: %v", err)
	}

	t.Cleanup(connector.Close)

	return connector, inc
}

func permissionIDs(
	t *testing.T,
	connector *csql.Connector,
	role, query, root string,
	sessions ...map[string]any,
) []int {
	t.Helper()

	var session map[string]any
	if len(sessions) > 0 {
		session = sessions[0]
	}

	doc, err := parser.ParseQuery(&ast.Source{Input: query})
	if err != nil {
		t.Fatal(err)
	}

	result, err := connector.Execute(
		t.Context(),
		doc.Operations[0],
		doc.Fragments,
		nil,
		role,
		session,
		slog.Default(),
	)
	if err != nil {
		t.Fatal(err)
	}

	raw, ok := result[root].(jsontext.Value)
	if !ok {
		t.Fatalf("missing %s: %#v", root, result)
	}

	var rows []struct {
		ID int `json:"id"`
	}
	if err := json.Unmarshal(raw, &rows); err != nil {
		t.Fatal(err)
	}

	ids := make([]int, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.ID)
	}

	return ids
}

func computedGuard(filter map[string]any) metadata.SelectPermission {
	return metadata.SelectPermission{
		Role: "phase9_guard",
		Permission: metadata.SelectPermissionConfig{
			Columns: []string{"id"}, Filter: filter,
		},
	}
}

func verifyComputedPermissionReverseTableOrder(t *testing.T) {
	t.Helper()

	for _, tc := range []struct {
		name    string
		filter  map[string]any
		want    []int
		revoked bool
	}{
		{"object relationship", map[string]any{"item": map[string]any{"item_label": map[string]any{"_eq": "first"}}}, []int{1, 2}, false},
		{"exists", map[string]any{"_exists": map[string]any{"_table": map[string]any{"schema": "cf_select", "name": "items"}, "_where": map[string]any{"item_label": map[string]any{"_eq": "first"}}}}, []int{1, 2, 3}, false},
		{"unsupported scalar aggregate permission", map[string]any{"item_copies_aggregate": map[string]any{"count": map[string]any{"filter": map[string]any{"item_label": map[string]any{"_eq": "first"}}, "predicate": map[string]any{"_gt": 0}}}}, nil, true},
		{"unsupported table aggregate permission", map[string]any{"item_copies_aggregate": map[string]any{"count": map[string]any{"filter": map[string]any{"item_tags": map[string]any{"id": map[string]any{"_eq": 2}}}, "predicate": map[string]any{"_gt": 0}}}}, nil, true},
	} {
		runPermissionCase(t, tc.name, func(t *testing.T) {
			t.Helper()
			md, db := permissionFixture(t)
			md.Tables[1].ObjectRelationships = []metadata.ObjectRelationship{
				{
					Name:  "item",
					Using: metadata.RelationshipUsing{ForeignKeyColumns: []string{"item_id"}},
				},
			}
			md.Tables[1].ArrayRelationships = []metadata.ArrayRelationship{
				{
					Name: "item_copies",
					Using: metadata.RelationshipUsing{
						ManualConfiguration: &metadata.ManualConfiguration{
							RemoteTable:   metadata.TableSource{Schema: "cf_select", Name: "items"},
							ColumnMapping: map[string]string{"item_id": "id"},
						},
					},
				},
			}
			md.Tables[1].SelectPermissions = append(
				md.Tables[1].SelectPermissions,
				computedGuard(tc.filter),
			)
			md.Tables[0], md.Tables[1] = md.Tables[1], md.Tables[0]

			connector, inc := permissionConnector(t, md, db.Config().ConnString())
			if tc.revoked {
				if len(inc.Snapshot()) != 1 ||
					!hasPermissionInconsistency(inc, "cf_select.tags.phase9_guard") {
					t.Fatalf(
						"unsupported computed aggregate must revoke only its permission: %+v",
						inc.Snapshot(),
					)
				}

				return
			}

			if len(inc.Snapshot()) != 0 {
				t.Fatalf("unexpected inconsistencies: %+v", inc.Snapshot())
			}

			got := permissionIDs(
				t,
				connector,
				"phase9_guard",
				`query { cf_select_tags(order_by:{id:asc}) { id } }`,
				"cf_select_tags",
			)
			if !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("filtered tags: %v, want %v", got, tc.want)
			}
		})
	}
}

func verifyComputedPermissionObjectAggregateName(t *testing.T) {
	t.Helper()

	md, db := permissionFixture(t)
	if _, err := db.Exec(
		t.Context(),
		`CREATE FUNCTION cf_select.tag_aggregate(tag cf_select.tags) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT tag.item_id = 1 $$`,
	); err != nil {
		t.Fatal(err)
	}

	md.Tables[1].ObjectRelationships = []metadata.ObjectRelationship{
		{Name: "item", Using: metadata.RelationshipUsing{ForeignKeyColumns: []string{"item_id"}}},
	}
	md.Tables[1].ComputedFields = append(
		md.Tables[1].ComputedFields,
		metadata.ComputedField{
			Name: "item_aggregate",
			Definition: metadata.ComputedFieldDefinition{
				Function: metadata.FunctionSource{Schema: "cf_select", Name: "tag_aggregate"},
			},
		},
	)
	md.Tables[1].SelectPermissions = append(
		md.Tables[1].SelectPermissions,
		computedGuard(map[string]any{"item_aggregate": map[string]any{"_eq": true}}),
	)

	connector, inc := permissionConnector(t, md, db.Config().ConnString())
	if len(inc.Snapshot()) != 0 {
		t.Fatalf("unexpected inconsistencies: %+v", inc.Snapshot())
	}

	got := permissionIDs(
		t,
		connector,
		"phase9_guard",
		`query { cf_select_tags(order_by:{id:asc}) { id } }`,
		"cf_select_tags",
	)
	if !reflect.DeepEqual(got, []int{1, 2}) {
		t.Fatalf("computed object-alias predicate returned %v", got)
	}
}

func verifyComputedPermissionOperatorCapabilities(t *testing.T) {
	t.Helper()

	for _, tc := range []struct {
		name    string
		prepare func(*testing.T, *metadata.DatabaseMetadata, *pgx.Conn)
		filter  map[string]any
		want    []int
		revoked bool
	}{
		{"computed shorthand", nil, map[string]any{"item_label": "first"}, []int{1}, false},
		{"plain shorthand", nil, map[string]any{"label": "first"}, []int{1}, false},
		{"computed shorthand list", nil, map[string]any{"item_label": []any{"first"}}, nil, true},
		{"computed shorthand map operand", nil, map[string]any{"item_label": map[string]any{"status": "ready"}}, nil, true},
		{"computed ne", nil, map[string]any{"item_label": map[string]any{"_ne": "first"}}, []int{2}, false},
		{"plain ne", nil, map[string]any{"label": map[string]any{"_ne": "first"}}, []int{2}, false},
		{"computed dollar eq", nil, map[string]any{"item_label": map[string]any{"$eq": "first"}}, []int{1}, false},
		{"plain dollar eq", nil, map[string]any{"label": map[string]any{"$eq": "first"}}, []int{1}, false},
		{"computed dollar ne", nil, map[string]any{"item_label": map[string]any{"$ne": "first"}}, []int{2}, false},
		{"dollar and", nil, map[string]any{"$and": []any{map[string]any{"item_label": map[string]any{"$similar": "f%"}}, map[string]any{"id": map[string]any{"$gt": 0}}}}, []int{1}, false},
		{"dollar or", nil, map[string]any{"$or": []any{map[string]any{"item_label": map[string]any{"$eq": "first"}}, map[string]any{"id": map[string]any{"$eq": 999}}}}, []int{1}, false},
		{"dollar not", nil, map[string]any{"$not": map[string]any{"item_label": map[string]any{"$eq": "first"}}}, []int{2}, false},
		{"dollar exists", nil, map[string]any{"$exists": map[string]any{"_table": map[string]any{"schema": "cf_select", "name": "items"}, "_where": map[string]any{"item_label": map[string]any{"$eq": "first"}}}}, []int{1, 2}, false},
		{"computed dollar regex on jsonb", nil, map[string]any{"item_payload": map[string]any{"$regex": "1"}}, nil, true},
		{"computed similar", nil, map[string]any{"item_label": map[string]any{"_similar": "f%"}}, []int{1}, false},
		{"computed nsimilar", nil, map[string]any{"item_label": map[string]any{"_nsimilar": "f%"}}, []int{2}, false},
		{"plain similar", nil, map[string]any{"label": map[string]any{"_similar": "f%"}}, []int{1}, false},
		{"computed ceq", nil, map[string]any{"item_label": map[string]any{"_ceq": "label"}}, []int{1, 2}, false},
		{"computed root ceq", nil, map[string]any{"item_label": map[string]any{"_ceq": []any{"$", "label"}}}, []int{1, 2}, false},
		{"computed current list ceq", nil, map[string]any{"item_label": map[string]any{"_ceq": []any{"label"}}}, []int{1, 2}, false},
		{"computed dollar cneq", nil, map[string]any{"item_label": map[string]any{"$cneq": []any{"label"}}}, []int{}, false},
		{"computed malformed root", nil, map[string]any{"item_label": map[string]any{"_ceq": []any{"$", "label", "x"}}}, nil, true},
		{"computed malformed rhs", nil, map[string]any{"item_label": map[string]any{"_ceq": map[string]any{"label": "x"}}}, nil, true},
		{"computed cne incompatible", nil, map[string]any{"item_label": map[string]any{"_cne": "id"}}, nil, true},
		{"computed ceq array RHS", func(t *testing.T, _ *metadata.DatabaseMetadata, db *pgx.Conn) {
			t.Helper()

			if _, err := db.Exec(t.Context(), `ALTER TABLE cf_select.items ADD COLUMN labels text[]`); err != nil {
				t.Fatal(err)
			}
		}, map[string]any{"item_label": map[string]any{"_ceq": "labels"}}, nil, true},
		{"computed ceq custom alias RHS", func(_ *testing.T, md *metadata.DatabaseMetadata, _ *pgx.Conn) {
			md.Tables[0].Configuration.ColumnConfig = map[string]metadata.ColumnConfig{
				"label": {CustomName: "display_label"},
			}
		}, map[string]any{"item_label": map[string]any{"_ceq": "display_label"}}, nil, true},
		{"computed ceq SQL name with alias", func(_ *testing.T, md *metadata.DatabaseMetadata, _ *pgx.Conn) {
			md.Tables[0].Configuration.ColumnConfig = map[string]metadata.ColumnConfig{
				"label": {CustomName: "display_label"},
			}
		}, map[string]any{"item_label": map[string]any{"_ceq": "label"}}, []int{1, 2}, false},
		{"plain ceq", nil, map[string]any{"label": map[string]any{"_ceq": "label"}}, []int{1, 2}, false},
		{"computed cne", nil, map[string]any{"item_label": map[string]any{"$cne": "label"}}, []int{}, false},
		{"computed cgt", nil, map[string]any{"item_label": map[string]any{"_cgt": "label"}}, []int{}, false},
		{"computed clt", nil, map[string]any{"item_label": map[string]any{"_clt": "label"}}, []int{}, false},
		{"computed cgte", nil, map[string]any{"item_label": map[string]any{"_cgte": "label"}}, []int{1, 2}, false},
		{"computed clte", nil, map[string]any{"item_label": map[string]any{"_clte": "label"}}, []int{1, 2}, false},
		{"computed cneq alias", nil, map[string]any{"item_label": map[string]any{"_cneq": "label"}}, []int{}, false},
		{"invalid column", nil, map[string]any{"item_label": map[string]any{"_ceq": "missing"}}, nil, true},
		{"incompatible column", nil, map[string]any{"item_label": map[string]any{"_ceq": "id"}}, nil, true},
		{"invalid relationship path", nil, map[string]any{"item_label": map[string]any{"_ceq": []any{"kids", "label"}}}, nil, true},
		{"similar wrong type", nil, map[string]any{"item_payload": map[string]any{"_similar": "f%"}}, nil, true},
		{"ltree ancestor", installPermissionPath, map[string]any{"item_path": map[string]any{"_ancestor": "top.first.child"}}, []int{1}, false},
		{"ltree ancestor any", installPermissionPath, map[string]any{"item_path": map[string]any{"_ancestor_any": []any{"top.first.child"}}}, []int{1}, false},
		{"ltree descendant", installPermissionPath, map[string]any{"item_path": map[string]any{"_descendant": "top"}}, []int{1, 2}, false},
		{"ltree descendant any", installPermissionPath, map[string]any{"item_path": map[string]any{"_descendant_any": []any{"top.first"}}}, []int{1}, false},
		{"ltree matches", installPermissionPath, map[string]any{"item_path": map[string]any{"_matches": "*.first"}}, []int{1}, false},
		{"ltree matches any", installPermissionPath, map[string]any{"item_path": map[string]any{"_matches_any": []any{"*.second"}}}, []int{2}, false},
		{"ltree matches empty", installPermissionPath, map[string]any{"item_path": map[string]any{"_matches_any": []any{}}}, []int{}, false},
		{"ltree matches fulltext", installPermissionPath, map[string]any{"item_path": map[string]any{"_matches_fulltext": "first"}}, []int{1}, false},
		{"ltree wrong type", nil, map[string]any{"item_label": map[string]any{"_ancestor": "top"}}, nil, true},
		{"ltree malformed operand", installPermissionPath, map[string]any{"item_path": map[string]any{"_matches_any": []any{map[string]any{"bad": 1}}}}, nil, true},
		{"argument-bearing field", nil, map[string]any{"item_score": map[string]any{"_eq": 12.5}}, nil, true},
		{"cast on text", nil, map[string]any{"item_label": map[string]any{"_cast": map[string]any{"String": map[string]any{"_eq": "first"}}}}, nil, true},
		{"jsonb cast", nil, map[string]any{"item_payload": map[string]any{"_cast": map[string]any{"String": map[string]any{"_like": `%ready%`}}}}, []int{1}, false},
		{"jsonb cast column comparison", nil, map[string]any{"item_payload": map[string]any{"_cast": map[string]any{"String": map[string]any{"_cne": "label"}}}}, []int{1, 2}, false},
		{"jsonb invalid cast target", nil, map[string]any{"item_payload": map[string]any{"_cast": map[string]any{"geometry": map[string]any{}}}}, nil, true},
		{"malformed text map operand", nil, map[string]any{"item_label": map[string]any{"_eq": map[string]any{"x": 1}}}, nil, true},
		{"malformed text list operand", nil, map[string]any{"item_label": map[string]any{"_eq": []any{"first"}}}, nil, true},
		{"valid text membership list", nil, map[string]any{"item_label": map[string]any{"_in": []any{"first"}}}, []int{1}, false},
		{"valid jsonb object operand", nil, map[string]any{"item_payload": map[string]any{"_contains": map[string]any{"status": "ready"}}}, []int{1}, false},
		{"jsonb operator on text", nil, map[string]any{"item_label": map[string]any{"_has_key": "x"}}, nil, true},
		{"empty comparison", nil, map[string]any{"item_label": map[string]any{}}, []int{1, 2}, false},
		{"empty comparison in or", nil, map[string]any{"_or": []any{map[string]any{"item_label": map[string]any{}}, map[string]any{"id": map[string]any{"_eq": 999}}}}, []int{1, 2}, false},
		{"empty computed comparison", nil, map[string]any{"_not": map[string]any{"_or": []any{map[string]any{"item_label": map[string]any{}}, map[string]any{"id": map[string]any{"_eq": 2}}}}}, []int{}, false},
		{"geometry within", installPermissionPoint, map[string]any{"item_point": map[string]any{"_st_d_within": map[string]any{
			"from": map[string]any{"type": "Point", "coordinates": []any{1, 1}}, "distance": 0.1,
		}}}, []int{1}, false},
		{"geometry cast geography", installPermissionPoint, map[string]any{"item_point": map[string]any{"_cast": map[string]any{
			"geography": map[string]any{"_st_d_within": map[string]any{
				"from": map[string]any{"type": "Point", "coordinates": []any{1, 1}}, "distance": 1000,
			}},
		}}}, []int{1}, false},
		{"malformed geometry operand", installPermissionPoint, map[string]any{"item_point": map[string]any{"_st_d_within": map[string]any{}}}, nil, true},
	} {
		runPermissionCase(t, tc.name, func(t *testing.T) {
			t.Helper()

			md, db := permissionFixture(t)
			if tc.prepare != nil {
				tc.prepare(t, md, db)
			}

			md.Tables[0].SelectPermissions = append(
				md.Tables[0].SelectPermissions,
				computedGuard(tc.filter),
			)
			conn, inc := permissionConnector(t, md, db.Config().ConnString())

			schemas, err := conn.GetSchema()
			if err != nil {
				t.Fatal(err)
			}

			_, exists := schemas["phase9_guard"]
			if exists == tc.revoked {
				t.Fatalf(
					"permission presence = %v, revoked = %v; inconsistencies: %+v",
					exists,
					tc.revoked,
					inc.Snapshot(),
				)
			}

			if schemas["cf_reader"] == nil {
				t.Fatal("unaffected role lost its source")
			}

			if tc.revoked {
				if !hasPermissionInconsistency(inc, "cf_select.items.phase9_guard") {
					t.Fatalf("whole permission not recorded: %+v", inc.Snapshot())
				}

				return
			}

			got := permissionIDs(
				t,
				conn,
				"phase9_guard",
				`query { cf_select_items(order_by:{id:asc}) { id } }`,
				"cf_select_items",
			)
			if !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("enforced rows %v, want %v", got, tc.want)
			}
		})
	}
}

// A valid session operand remains a served permission, but never becomes a
// literal string or an unrestricted filter when the request lacks the claim.
func verifyComputedPermissionMissingSessionVariable(t *testing.T) {
	t.Helper()
	md, db := permissionFixture(t)
	md.Tables[0].SelectPermissions = append(md.Tables[0].SelectPermissions,
		computedGuard(map[string]any{"item_label": map[string]any{"_eq": "x-hasura-missing"}}))

	connector, inc := permissionConnector(t, md, db.Config().ConnString())
	if len(inc.Snapshot()) != 0 {
		t.Fatalf("valid session permission unexpectedly revoked: %+v", inc.Snapshot())
	}

	doc, err := parser.ParseQuery(&ast.Source{Input: `query { cf_select_items { id } }`})
	if err != nil {
		t.Fatal(err)
	}

	_, err = connector.Execute(t.Context(), doc.Operations[0], doc.Fragments,
		nil, "phase9_guard", nil, slog.Default())
	if !errors.Is(err, permissions.ErrSessionVariableNotFound) {
		t.Fatalf("missing claim must fail closed: %v", err)
	}
}

func installPermissionPath(t *testing.T, md *metadata.DatabaseMetadata, db *pgx.Conn) {
	t.Helper()

	if _, err := db.Exec(t.Context(), `CREATE EXTENSION IF NOT EXISTS ltree;
CREATE FUNCTION cf_select.item_path(item cf_select.items) RETURNS ltree LANGUAGE sql STABLE
AS $$ SELECT ('top.' || item.label)::ltree $$`); err != nil {
		t.Fatal(err)
	}

	md.Tables[0].ComputedFields = append(md.Tables[0].ComputedFields, metadata.ComputedField{
		Name: "item_path", Definition: metadata.ComputedFieldDefinition{
			Function: metadata.FunctionSource{Schema: "cf_select", Name: "item_path"},
		},
	})
}

func installPermissionPoint(t *testing.T, md *metadata.DatabaseMetadata, db *pgx.Conn) {
	t.Helper()

	if _, err := db.Exec(t.Context(), `CREATE EXTENSION IF NOT EXISTS postgis;
CREATE FUNCTION cf_select.item_point(item cf_select.items) RETURNS geometry LANGUAGE sql STABLE
AS $$ SELECT ST_SetSRID(ST_MakePoint(item.id, item.id),4326) $$`); err != nil {
		t.Fatal(err)
	}

	md.Tables[0].ComputedFields = append(md.Tables[0].ComputedFields, metadata.ComputedField{
		Name: "item_point", Definition: metadata.ComputedFieldDefinition{
			Function: metadata.FunctionSource{Schema: "cf_select", Name: "item_point"},
		},
	})
}

func hasPermissionInconsistency(inc *metadata.Inconsistencies, name string) bool {
	for _, entry := range inc.Snapshot() {
		if entry.Kind == metadata.InconsistencyKindSelectPermission && entry.Name == name {
			return true
		}
	}

	return false
}

func verifyComputedPermissionNestedObjectInsert(t *testing.T) {
	t.Helper()

	for _, tc := range []struct {
		name, field, parentLabel string
		accepted, hiddenParent   bool
	}{
		{"plain accepted", "label", "parent", true, false},
		{"computed accepted", "item_label", "parent", true, false},
		{"computed accepted despite parent select filter", "item_label", "parent", true, true},
		{"computed denied", "item_label", "other", false, false},
	} {
		runPermissionCase(t, tc.name, func(t *testing.T) {
			t.Helper()
			md, db := permissionFixture(t)
			md.Tables[1].ObjectRelationships = []metadata.ObjectRelationship{
				{
					Name:  "item",
					Using: metadata.RelationshipUsing{ForeignKeyColumns: []string{"item_id"}},
				},
			}

			var parentFilter map[string]any
			if tc.hiddenParent {
				parentFilter = map[string]any{"label": map[string]any{"_eq": "other"}}
			}

			md.Tables[0].SelectPermissions = append(
				md.Tables[0].SelectPermissions,
				metadata.SelectPermission{
					Role: "phase9_guard",
					Permission: metadata.SelectPermissionConfig{
						Columns: []string{"id", "label"}, Filter: parentFilter,
					},
				},
			)
			md.Tables[0].InsertPermissions = append(
				md.Tables[0].InsertPermissions,
				metadata.InsertPermission{
					Role: "phase9_guard",
					Permission: metadata.InsertPermissionConfig{
						Columns: []string{"id", "owner_id", "label", "amount", "payload"},
						Check:   map[string]any{},
					},
				},
			)
			md.Tables[1].SelectPermissions = append(
				md.Tables[1].SelectPermissions,
				computedGuard(nil),
			)
			md.Tables[1].InsertPermissions = append(
				md.Tables[1].InsertPermissions,
				metadata.InsertPermission{
					Role: "phase9_guard",
					Permission: metadata.InsertPermissionConfig{
						Columns: []string{"id", "item_id", "label"},
						Check: map[string]any{
							"item": map[string]any{tc.field: map[string]any{"_eq": "parent"}},
						},
					},
				},
			)

			connector, inc := permissionConnector(t, md, db.Config().ConnString())
			if len(inc.Snapshot()) != 0 {
				t.Fatalf("unexpected inconsistencies: %+v", inc.Snapshot())
			}

			doc, err := parser.ParseQuery(
				&ast.Source{
					Input: `mutation { insert_cf_select_tags_one(object:{id:90091,label:"tag",item:{data:{id:90091,owner_id:1,label:"` + tc.parentLabel + `",amount:1,payload:{}}}}) { id } }`,
				},
			)
			if err != nil {
				t.Fatal(err)
			}

			result, err := connector.Execute(
				t.Context(),
				doc.Operations[0],
				doc.Fragments,
				nil,
				"phase9_guard",
				nil,
				slog.Default(),
			)
			if tc.accepted {
				if err != nil {
					t.Fatalf("Hasura accepted nested object insert; got %v", err)
				}

				if result["insert_cf_select_tags_one"] == nil {
					t.Fatalf("no inserted row: %#v", result)
				}
			} else if err == nil {
				t.Fatalf("nested check accepted forbidden parent: %#v", result)
			}
		})
	}
}

func verifyComputedPermissionNestedObjectCollection(t *testing.T) {
	t.Helper()

	for _, tc := range []struct {
		name, secondLabel string
		accepted          bool
	}{
		{"both allowed", "parent", true},
		{"second denied atomically", "other", false},
	} {
		runPermissionCase(t, tc.name, func(t *testing.T) {
			t.Helper()
			md, db := permissionFixture(t)
			md.Tables[1].ObjectRelationships = []metadata.ObjectRelationship{
				{
					Name:  "item",
					Using: metadata.RelationshipUsing{ForeignKeyColumns: []string{"item_id"}},
				},
			}
			md.Tables[0].SelectPermissions = append(
				md.Tables[0].SelectPermissions,
				computedGuard(nil),
			)
			md.Tables[0].InsertPermissions = append(
				md.Tables[0].InsertPermissions,
				metadata.InsertPermission{
					Role: "phase9_guard",
					Permission: metadata.InsertPermissionConfig{
						Columns: []string{"id", "owner_id", "label", "amount", "payload"},
						Check:   map[string]any{},
					},
				},
			)
			md.Tables[1].SelectPermissions = append(
				md.Tables[1].SelectPermissions,
				computedGuard(nil),
			)
			md.Tables[1].InsertPermissions = append(
				md.Tables[1].InsertPermissions,
				metadata.InsertPermission{
					Role: "phase9_guard",
					Permission: metadata.InsertPermissionConfig{
						Columns: []string{"id", "item_id", "label"},
						Check: map[string]any{
							"item": map[string]any{"item_label": map[string]any{"_eq": "parent"}},
						},
					},
				},
			)

			connector, inc := permissionConnector(t, md, db.Config().ConnString())
			if len(inc.Snapshot()) != 0 {
				t.Fatalf("unexpected inconsistencies: %+v", inc.Snapshot())
			}

			query := `mutation { insert_cf_select_tags(objects:[
				{id:90091,label:"tag",item:{data:{id:90091,owner_id:1,label:"parent",amount:1,payload:{}}}},
				{id:90092,label:"tag",item:{data:{id:90092,owner_id:1,label:"` + tc.secondLabel + `",amount:1,payload:{}}}}
			]) { affected_rows } }`

			doc, err := parser.ParseQuery(&ast.Source{Input: query})
			if err != nil {
				t.Fatal(err)
			}

			result, err := connector.Execute(
				t.Context(),
				doc.Operations[0],
				doc.Fragments,
				nil,
				"phase9_guard",
				nil,
				slog.Default(),
			)
			if tc.accepted {
				if err != nil {
					t.Fatalf("allowed collection: %v", err)
				}

				if result["insert_cf_select_tags"] == nil {
					t.Fatalf("no inserted rows: %#v", result)
				}
			} else if err == nil {
				t.Fatalf("denied collection was accepted: %#v", result)
			}

			var count int
			if err := db.QueryRow(t.Context(), `SELECT count(*) FROM cf_select.tags WHERE id IN (90091,90092)`).
				Scan(&count); err != nil {
				t.Fatal(err)
			}

			want := 0
			if tc.accepted {
				want = 2
			}

			if count != want {
				t.Fatalf("collection persisted %d rows, want %d", count, want)
			}
		})
	}
}

// TestNestedObjectInsertOtherRoutes keeps the committed table visible to a
// second relationship even while the first relationship inserts a new parent.
// A negated check must not become true merely because the parent CTE exists.
//
//nolint:gocognit,gocyclo,cyclop,maintidx // This ordered security matrix asserts branch outcomes and physical rollback together.
func verifyNestedObjectInsertOtherRoutes(t *testing.T) {
	t.Helper()

	for _, tc := range []struct {
		name, check                                    string
		insertParent, collection, accepted, twoParents bool
	}{
		{"plain negated column", `{"_not":{"item_by_label":{"id":{"_eq":1}}}}`, false, false, false, false},
		{"nested negated column", `{"_not":{"item_by_label":{"id":{"_eq":1}}}}`, true, false, false, false},
		{"plain negated computed", `{"_not":{"item_by_label":{"item_label":{"_eq":"first"}}}}`, false, false, false, false},
		{"nested negated computed", `{"_not":{"item_by_label":{"item_label":{"_eq":"first"}}}}`, true, false, false, false},
		{"nested negated exists", `{"_not":{"_exists":{"_table":{"schema":"cf_select","name":"items"},"_where":{"id":{"_eq":1},"item_label":{"_eq":"first"}}}}}`, true, false, false, false},
		{"plain positive", `{"item_by_label":{"item_label":{"_eq":"first"}}}`, false, false, true, false},
		{"nested positive", `{"item_by_label":{"item_label":{"_eq":"first"}}}`, true, false, true, false},
		{"nested primary and committed secondary", `{"_and":[{"item":{"item_label":{"_eq":"parent"}}},{"item_by_label":{"item_label":{"_eq":"first"}}}]}`, true, false, true, false},
		{"partitioned negated", `{"_not":{"item_by_label":{"item_label":{"_eq":"first"}}}}`, true, true, false, false},
		{"partitioned positive", `{"_and":[{"item":{"item_label":{"_eq":"parent"}}},{"item_by_label":{"item_label":{"_eq":"first"}}}]}`, true, true, true, false},
		{"two object parents negated", `{"_not":{"item_by_label":{"item_label":{"_eq":"first"}}}}`, true, false, false, true},
		{"two object parents positive", `{"_and":[{"item":{"item_label":{"_eq":"parent"}}},{"item_alt":{"item_label":{"_eq":"other"}}},{"item_by_label":{"item_label":{"_eq":"first"}}}]}`, true, false, true, true},
		{"hidden parent still reachable in flight", `{"item":{"item_label":{"_eq":"parent"}}}`, true, false, true, false},
		{"hidden committed parent still checked as admin", `{"item_by_label":{"item_label":{"_eq":"first"}}}`, true, false, true, false},
	} {
		runPermissionCase(t, tc.name, func(t *testing.T) {
			t.Helper()

			md, db := permissionFixture(t)
			if tc.twoParents {
				if _, err := db.Exec(
					t.Context(),
					`ALTER TABLE cf_select.tags ADD COLUMN alt_item_id integer REFERENCES cf_select.items(id)`,
				); err != nil {
					t.Fatal(err)
				}
			}

			md.Tables[1].ObjectRelationships = []metadata.ObjectRelationship{
				{
					Name:  "item",
					Using: metadata.RelationshipUsing{ForeignKeyColumns: []string{"item_id"}},
				},
				{Name: "item_by_label", Using: metadata.RelationshipUsing{
					ManualConfiguration: &metadata.ManualConfiguration{
						RemoteTable:   metadata.TableSource{Schema: "cf_select", Name: "items"},
						ColumnMapping: map[string]string{"label": "label"},
					},
				}},
			}

			md.Tables[1].ArrayRelationships = []metadata.ArrayRelationship{{
				Name: "item_copies", Using: metadata.RelationshipUsing{
					ManualConfiguration: &metadata.ManualConfiguration{
						RemoteTable:   metadata.TableSource{Schema: "cf_select", Name: "items"},
						ColumnMapping: map[string]string{"label": "label"},
					},
				},
			}}
			if tc.twoParents {
				md.Tables[1].ObjectRelationships = append(md.Tables[1].ObjectRelationships,
					metadata.ObjectRelationship{Name: "item_alt", Using: metadata.RelationshipUsing{
						ForeignKeyColumns: []string{"alt_item_id"},
					}},
				)
			}

			var parentFilter map[string]any
			if strings.HasPrefix(tc.name, "hidden ") {
				parentFilter = map[string]any{"label": map[string]any{"_eq": "parent"}}
			}

			md.Tables[0].SelectPermissions = append(
				md.Tables[0].SelectPermissions,
				metadata.SelectPermission{
					Role: "phase9_guard",
					Permission: metadata.SelectPermissionConfig{
						Columns: []string{"id", "label"}, Filter: parentFilter,
					},
				},
			)
			md.Tables[0].InsertPermissions = append(
				md.Tables[0].InsertPermissions,
				metadata.InsertPermission{
					Role: "phase9_guard",
					Permission: metadata.InsertPermissionConfig{
						Columns: []string{"id", "owner_id", "label", "amount", "payload"},
						Check:   map[string]any{},
					},
				},
			)
			md.Tables[1].SelectPermissions = append(
				md.Tables[1].SelectPermissions,
				computedGuard(nil),
			)

			var check map[string]any
			if err := json.Unmarshal([]byte(tc.check), &check); err != nil {
				t.Fatal(err)
			}

			columns := []string{"id", "label", "item_id"}
			if tc.twoParents {
				columns = append(columns, "alt_item_id")
			}

			md.Tables[1].InsertPermissions = append(
				md.Tables[1].InsertPermissions,
				metadata.InsertPermission{
					Role: "phase9_guard",
					Permission: metadata.InsertPermissionConfig{
						Columns: columns, Check: check,
					},
				},
			)

			conn, inc := permissionConnector(t, md, db.Config().ConnString())
			if len(inc.Snapshot()) > 0 {
				t.Fatalf("unexpected inconsistencies: %+v", inc.Snapshot())
			}

			object := func(id int) string {
				if tc.insertParent {
					alt := ""
					if tc.twoParents {
						alt = fmt.Sprintf(
							`,item_alt:{data:{id:%d,owner_id:1,label:"other",amount:1,payload:{}}}`,
							id+10,
						)
					}

					return fmt.Sprintf(
						`{id:%d,label:"first",item:{data:{id:%d,owner_id:1,label:"parent",amount:1,payload:{}}}%s}`,
						id,
						id,
						alt,
					)
				}

				return fmt.Sprintf(`{id:%d,label:"first",item_id:2}`, id)
			}

			query := `mutation { insert_cf_select_tags_one(object:` + object(90091) + `) { id } }`
			if tc.collection {
				query = `mutation { insert_cf_select_tags(objects:[` + object(
					90092,
				) + `,` + object(
					90091,
				) + `]) { affected_rows returning { id item_id } } }`
			}

			doc, err := parser.ParseQuery(&ast.Source{Input: query})
			if err != nil {
				t.Fatal(err)
			}

			result, err := conn.Execute(t.Context(), doc.Operations[0], doc.Fragments,
				nil, "phase9_guard", nil, slog.Default())
			if tc.accepted != (err == nil) {
				t.Fatalf("accepted = %t, error = %v, result = %#v", tc.accepted, err, result)
			}

			var count int
			if err := db.QueryRow(t.Context(), `SELECT count(*) FROM cf_select.tags WHERE id IN (90091,90092)`).
				Scan(&count); err != nil {
				t.Fatal(err)
			}

			want := 0
			if tc.accepted {
				want = 1
				if tc.collection {
					want = 2
				}
			}

			if count != want {
				t.Fatalf(
					"inserted tags = %d, want %d (denial must roll back parents and tags)",
					count,
					want,
				)
			}

			if !tc.accepted && tc.insertParent {
				if err := db.QueryRow(t.Context(), `SELECT count(*) FROM cf_select.items WHERE id IN (90091,90092)`).
					Scan(&count); err != nil {
					t.Fatal(err)
				}

				if count != 0 {
					t.Fatalf("denied nested parents persisted: %d", count)
				}
			}

			if tc.collection && tc.accepted {
				raw, ok := result["insert_cf_select_tags"].(jsontext.Value)
				if !ok {
					t.Fatalf("missing collection result: %#v", result)
				}

				var rows struct {
					Returning []struct {
						ID     int `json:"id"`
						ItemID int `json:"item_id"`
					} `json:"returning"`
				}
				if err := json.Unmarshal(raw, &rows); err != nil {
					t.Fatal(err)
				}

				if len(rows.Returning) != 2 || rows.Returning[0].ID != 90092 ||
					rows.Returning[0].ItemID != 90092 ||
					rows.Returning[1].ID != 90091 ||
					rows.Returning[1].ItemID != 90091 {
					t.Fatalf("partitioned source row order/FK mismatch: %+v", rows.Returning)
				}
			}
		})
	}
}

func verifyNestedArrayChildOtherParentRoute(t *testing.T) {
	t.Helper()

	for _, tc := range []struct {
		name     string
		check    map[string]any
		accepted bool
	}{
		{"negation cannot hide committed parent", map[string]any{
			"_not": map[string]any{"item_by_label": map[string]any{"item_label": map[string]any{"_eq": "first"}}},
		}, false},
		{"child sees new and committed parents", map[string]any{
			"_and": []any{
				map[string]any{"item": map[string]any{"item_label": map[string]any{"_eq": "parent"}}},
				map[string]any{"item_by_label": map[string]any{"item_label": map[string]any{"_eq": "first"}}},
			},
		}, true},
	} {
		runPermissionCase(t, tc.name, func(t *testing.T) {
			t.Helper()
			md, db := permissionFixture(t)
			md.Tables[0].ArrayRelationships = []metadata.ArrayRelationship{
				{
					Name: "tags",
					Using: metadata.RelationshipUsing{
						ManualConfiguration: &metadata.ManualConfiguration{
							RemoteTable:   metadata.TableSource{Schema: "cf_select", Name: "tags"},
							ColumnMapping: map[string]string{"id": "item_id"},
						},
					},
				},
			}
			md.Tables[1].ObjectRelationships = []metadata.ObjectRelationship{
				{
					Name:  "item",
					Using: metadata.RelationshipUsing{ForeignKeyColumns: []string{"item_id"}},
				},
				{
					Name: "item_by_label",
					Using: metadata.RelationshipUsing{
						ManualConfiguration: &metadata.ManualConfiguration{
							RemoteTable:   metadata.TableSource{Schema: "cf_select", Name: "items"},
							ColumnMapping: map[string]string{"label": "label"},
						},
					},
				},
			}
			md.Tables[0].SelectPermissions = append(
				md.Tables[0].SelectPermissions,
				metadata.SelectPermission{
					Role: "phase9_guard",
					Permission: metadata.SelectPermissionConfig{
						Columns: []string{"id", "label"},
					},
				},
			)
			md.Tables[0].InsertPermissions = append(
				md.Tables[0].InsertPermissions,
				metadata.InsertPermission{
					Role: "phase9_guard",
					Permission: metadata.InsertPermissionConfig{
						Columns: []string{
							"id",
							"owner_id",
							"label",
							"amount",
							"payload",
						},
						Check: map[string]any{},
					},
				},
			)
			md.Tables[1].SelectPermissions = append(
				md.Tables[1].SelectPermissions,
				computedGuard(nil),
			)
			md.Tables[1].InsertPermissions = append(
				md.Tables[1].InsertPermissions,
				metadata.InsertPermission{
					Role: "phase9_guard",
					Permission: metadata.InsertPermissionConfig{
						Columns: []string{"id", "label", "item_id"}, Check: tc.check,
					},
				},
			)

			conn, inc := permissionConnector(t, md, db.Config().ConnString())
			if len(inc.Snapshot()) != 0 {
				t.Fatalf("unexpected inconsistencies: %+v", inc.Snapshot())
			}

			query := `mutation { insert_cf_select_items_one(object:{id:90091,owner_id:1,label:"parent",amount:1,payload:{},tags:{data:[{id:90091,label:"first"},{id:90092,label:"first"}]}}) { id } }`

			doc, err := parser.ParseQuery(&ast.Source{Input: query})
			if err != nil {
				t.Fatal(err)
			}

			result, err := conn.Execute(t.Context(), doc.Operations[0], doc.Fragments,
				nil, "phase9_guard", nil, slog.Default())
			if tc.accepted != (err == nil) {
				t.Fatalf("accepted = %t, error = %v, result = %#v", tc.accepted, err, result)
			}

			var count int
			if err := db.QueryRow(t.Context(), `SELECT count(*) FROM cf_select.tags WHERE id IN (90091,90092)`).
				Scan(&count); err != nil {
				t.Fatal(err)
			}

			want := 0
			if tc.accepted {
				want = 2
			}

			if count != want {
				t.Fatalf("inserted children = %d, want %d", count, want)
			}

			if err := db.QueryRow(t.Context(), `SELECT count(*) FROM cf_select.items WHERE id = 90091`).
				Scan(&count); err != nil {
				t.Fatal(err)
			}

			want = 0
			if tc.accepted {
				want = 1
			}

			if count != want {
				t.Fatalf("inserted parent = %d, want %d", count, want)
			}
		})
	}
}

func verifyNestedObjectUpsertReplacesCommittedVersion(t *testing.T) {
	t.Helper()

	for _, tc := range []struct {
		name     string
		check    map[string]any
		accepted bool
	}{
		{"old computed row no longer satisfies positive check", map[string]any{
			"item_by_label": map[string]any{"item_label": map[string]any{"_eq": "first"}},
		}, false},
		{"old computed row no longer defeats negative check", map[string]any{
			"_not": map[string]any{"item_by_label": map[string]any{"item_label": map[string]any{"_eq": "first"}}},
		}, true},
	} {
		runPermissionCase(t, tc.name, func(t *testing.T) {
			t.Helper()
			md, db := permissionFixture(t)
			md.Tables[1].ObjectRelationships = []metadata.ObjectRelationship{
				{
					Name:  "item",
					Using: metadata.RelationshipUsing{ForeignKeyColumns: []string{"item_id"}},
				},
				{
					Name: "item_by_label",
					Using: metadata.RelationshipUsing{
						ManualConfiguration: &metadata.ManualConfiguration{
							RemoteTable:   metadata.TableSource{Schema: "cf_select", Name: "items"},
							ColumnMapping: map[string]string{"label": "label"},
						},
					},
				},
			}
			md.Tables[0].SelectPermissions = append(
				md.Tables[0].SelectPermissions,
				metadata.SelectPermission{
					Role: "phase9_guard",
					Permission: metadata.SelectPermissionConfig{
						Columns: []string{"id", "label"},
					},
				},
			)
			md.Tables[0].InsertPermissions = append(
				md.Tables[0].InsertPermissions,
				metadata.InsertPermission{
					Role: "phase9_guard",
					Permission: metadata.InsertPermissionConfig{
						Columns: []string{
							"id",
							"owner_id",
							"label",
							"amount",
							"payload",
						},
						Check: map[string]any{},
					},
				},
			)
			md.Tables[0].UpdatePermissions = append(
				md.Tables[0].UpdatePermissions,
				metadata.UpdatePermission{
					Role: "phase9_guard",
					Permission: metadata.UpdatePermissionConfig{
						Columns: []string{
							"label",
						},
						Filter: map[string]any{},
						Check: map[string]any{
							"item_label": map[string]any{"_eq": "replaced"},
						},
					},
				},
			)
			md.Tables[1].SelectPermissions = append(
				md.Tables[1].SelectPermissions,
				computedGuard(nil),
			)
			md.Tables[1].InsertPermissions = append(
				md.Tables[1].InsertPermissions,
				metadata.InsertPermission{
					Role: "phase9_guard",
					Permission: metadata.InsertPermissionConfig{
						Columns: []string{"id", "label", "item_id"}, Check: tc.check,
					},
				},
			)

			conn, inc := permissionConnector(t, md, db.Config().ConnString())
			if len(inc.Snapshot()) != 0 {
				t.Fatalf("unexpected inconsistencies: %+v", inc.Snapshot())
			}

			query := `mutation { insert_cf_select_tags_one(object:{id:90091,label:"first",item:{data:{id:1,owner_id:1,label:"replaced",amount:1,payload:{}},on_conflict:{constraint:items_pkey,update_columns:[label]}}}) { id } }`

			doc, err := parser.ParseQuery(&ast.Source{Input: query})
			if err != nil {
				t.Fatal(err)
			}

			result, err := conn.Execute(t.Context(), doc.Operations[0], doc.Fragments,
				nil, "phase9_guard", nil, slog.Default())
			if tc.accepted != (err == nil) {
				t.Fatalf("accepted = %t, error = %v, result = %#v", tc.accepted, err, result)
			}

			var label string
			if err := db.QueryRow(t.Context(), `SELECT label FROM cf_select.items WHERE id = 1`).
				Scan(&label); err != nil {
				t.Fatal(err)
			}

			wantLabel := "first"
			if tc.accepted {
				wantLabel = "replaced"
			}

			if label != wantLabel {
				t.Fatalf("upsert label = %s, want %s", label, wantLabel)
			}

			var count int
			if err := db.QueryRow(t.Context(), `SELECT count(*) FROM cf_select.tags WHERE id = 90091`).
				Scan(&count); err != nil {
				t.Fatal(err)
			}

			want := 0
			if tc.accepted {
				want = 1
			}

			if count != want {
				t.Fatalf("inserted tag count %d, want %d", count, want)
			}
		})
	}
}

func verifyComputedInvalidPermissionKindsKeepSource(t *testing.T) {
	t.Helper()
	md, db := permissionFixture(t)
	invalid := map[string]any{"item_label": map[string]any{"_ceq": "missing_column"}}
	md.Tables[0].SelectPermissions = append(md.Tables[0].SelectPermissions, computedGuard(invalid))
	md.Tables[0].InsertPermissions = append(
		md.Tables[0].InsertPermissions,
		metadata.InsertPermission{
			Role: "phase9_guard", Permission: metadata.InsertPermissionConfig{
				Columns: []string{"id", "label", "owner_id", "amount", "payload"}, Check: invalid,
			},
		},
	)
	md.Tables[0].UpdatePermissions = append(
		md.Tables[0].UpdatePermissions,
		metadata.UpdatePermission{
			Role: "phase9_guard", Permission: metadata.UpdatePermissionConfig{
				Columns: []string{"label"}, Filter: map[string]any{"id": map[string]any{"_eq": 1}},
				Check: invalid,
			},
		},
	)
	md.Tables[0].DeletePermissions = append(
		md.Tables[0].DeletePermissions,
		metadata.DeletePermission{
			Role: "phase9_guard", Permission: metadata.DeletePermissionConfig{Filter: invalid},
		},
	)

	connector, inc := permissionConnector(t, md, db.Config().ConnString())
	for _, kind := range []string{
		metadata.InconsistencyKindSelectPermission, metadata.InconsistencyKindInsertPermission,
		metadata.InconsistencyKindUpdatePermission, metadata.InconsistencyKindDeletePermission,
	} {
		found := false
		for _, entry := range inc.Snapshot() {
			if entry.Kind == kind && entry.Name == "cf_select.items.phase9_guard" {
				found = true
			}
		}

		if !found {
			t.Errorf("whole %s not revoked: %+v", kind, inc.Snapshot())
		}
	}

	if got := permissionIDs(
		t,
		connector,
		"cf_reader",
		`query { cf_select_items(order_by:{id:asc}) { id } }`,
		"cf_select_items",
	); !reflect.DeepEqual(
		got,
		[]int{1, 2},
	) {
		t.Fatalf("unaffected role rows: %v", got)
	}
}
