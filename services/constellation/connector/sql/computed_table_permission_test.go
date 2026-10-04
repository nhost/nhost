package sql_test

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"errors"
	"log/slog"
	"reflect"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/metadata"
)

//nolint:paralleltest,gocognit // Serial cases protect the testdb budget; each checks permission-granular failure.
func TestComputedTablePermissionInputs(t *testing.T) {
	for _, tc := range []struct {
		name                  string
		filter                map[string]any
		want                  []int
		revoked, customColumn bool
	}{
		{"table predicate without target select grant", map[string]any{"item_tags": map[string]any{
			"label": map[string]any{"_eq": "two"},
		}}, []int{1}, false, false},
		{"nested table predicate", map[string]any{"_exists": map[string]any{
			"_table": map[string]any{"schema": "cf_select", "name": "items"},
			"_where": map[string]any{"item_tags": map[string]any{"id": map[string]any{"_eq": 3}}},
		}}, []int{1, 2}, false, false},
		{"custom column SQL-name control", map[string]any{"item_tags": map[string]any{
			"label": map[string]any{"_eq": "two"},
		}}, []int{1}, false, true},
		{"custom GraphQL column inside identifiable table", map[string]any{"item_tags": map[string]any{
			"tag_label": map[string]any{"_eq": "two"},
		}}, nil, true, true},
		{"valid relationship through table predicate", map[string]any{"item_tags": map[string]any{
			"item": map[string]any{"item_tags": map[string]any{
				"label": map[string]any{"_eq": "two"},
			}},
		}}, []int{1}, false, true},
		{"custom GraphQL column through relationship and table", map[string]any{"item_tags": map[string]any{
			"item": map[string]any{"item_tags": map[string]any{
				"tag_label": map[string]any{"_eq": "two"},
			}},
		}}, nil, true, true},
		{"malformed table predicate", map[string]any{"item_tags": 42}, nil, true, false},
		{"unknown field inside identifiable table", map[string]any{"item_tags": map[string]any{
			"missing_tag": map[string]any{"_eq": 2},
		}}, nil, true, false},
		{"unknown operator inside identifiable table", map[string]any{"item_tags": map[string]any{
			"label": map[string]any{"_unsupported": "two"},
		}}, nil, true, false},
		{"invalid relationship within identifiable table", map[string]any{"item_tags": map[string]any{
			"item": map[string]any{"missing_item": map[string]any{"_eq": 1}},
		}}, nil, true, false},
		{"aggregate relationship within identifiable table", map[string]any{"item_tags": map[string]any{
			"item_copies_aggregate": map[string]any{"count": map[string]any{
				"predicate": map[string]any{"_gt": 0},
			}},
		}}, nil, true, false},
		{"argument-bearing table", map[string]any{"item_tags_with_args": map[string]any{}}, nil, true, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			md, db := permissionFixture(t)
			if tc.customColumn {
				md.Tables[1].Configuration.ColumnConfig = map[string]metadata.ColumnConfig{
					"label": {CustomName: "tag_label"},
				}
			}

			if tc.name == "valid relationship through table predicate" ||
				tc.name == "custom GraphQL column through relationship and table" ||
				tc.name == "invalid relationship within identifiable table" {
				md.Tables[1].ObjectRelationships = []metadata.ObjectRelationship{
					{
						Name:  "item",
						Using: metadata.RelationshipUsing{ForeignKeyColumns: []string{"item_id"}},
					},
				}
			}

			if tc.name == "aggregate relationship within identifiable table" {
				md.Tables[1].ArrayRelationships = []metadata.ArrayRelationship{{
					Name: "item_copies", Using: metadata.RelationshipUsing{
						ManualConfiguration: &metadata.ManualConfiguration{
							RemoteTable:   metadata.TableSource{Schema: "cf_select", Name: "items"},
							ColumnMapping: map[string]string{"item_id": "id"},
						},
					},
				}}
			}

			if tc.name == "argument-bearing table" {
				if _, err := db.Exec(t.Context(), `CREATE FUNCTION cf_select.item_tags_with_args(
					item cf_select.items, needle text DEFAULT '') RETURNS SETOF cf_select.tags
					LANGUAGE sql STABLE AS $$ SELECT t.id, t.item_id, t.label FROM cf_select.tags t
					WHERE t.item_id = item.id AND t.label LIKE needle || '%' $$`); err != nil {
					t.Fatal(err)
				}

				md.Tables[0].ComputedFields = append(
					md.Tables[0].ComputedFields,
					metadata.ComputedField{
						Name: "item_tags_with_args",
						Definition: metadata.ComputedFieldDefinition{
							Function: metadata.FunctionSource{
								Schema: "cf_select",
								Name:   "item_tags_with_args",
							},
						},
					},
				)
			}

			md.Tables[0].SelectPermissions = append(
				md.Tables[0].SelectPermissions,
				metadata.SelectPermission{
					Role: "table_guard",
					Permission: metadata.SelectPermissionConfig{
						Columns: []string{"id"}, Filter: tc.filter,
					},
				},
			)

			conn, inc := permissionConnector(t, md, db.Config().ConnString())
			if tc.revoked {
				if !hasPermissionInconsistency(inc, "cf_select.items.table_guard") {
					t.Fatalf("invalid table permission not revoked: %+v", inc.Snapshot())
				}

				// A malformed identifiable predicate must not discard the source or
				// unrelated permissions on the same table.
				if got := permissionIDs(
					t,
					conn,
					"cf_reader",
					`query { cf_select_items(order_by:{id:asc}) { id } }`,
					"cf_select_items",
				); !reflect.DeepEqual(got, []int{1, 2}) {
					t.Fatalf("unaffected reader rows: %v", got)
				}

				return
			}

			if len(inc.Snapshot()) != 0 {
				t.Fatalf("valid table permission revoked: %+v", inc.Snapshot())
			}

			got := permissionIDs(t, conn, "table_guard",
				`query { cf_select_items(order_by:{id:asc}) { id } }`, "cf_select_items")
			if !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("rows: %v, want %v", got, tc.want)
			}
		})
	}
}

//nolint:paralleltest // Keep the additional testdb connector within the default connection budget.
func TestComputedTablePermissionSession(t *testing.T) {
	md, db := permissionFixture(t)
	if _, err := db.Exec(t.Context(), `CREATE FUNCTION cf_select.item_tags_for_session(
		item cf_select.items, session jsonb) RETURNS SETOF cf_select.tags LANGUAGE sql STABLE AS $$
		SELECT t.id, t.item_id, t.label FROM cf_select.tags t
		WHERE t.item_id = item.id AND t.label = session->>'x-hasura-tag-label' $$`); err != nil {
		t.Fatal(err)
	}

	md.Tables[0].ComputedFields = append(md.Tables[0].ComputedFields, metadata.ComputedField{
		Name: "item_tags_for_session", Definition: metadata.ComputedFieldDefinition{
			Function: metadata.FunctionSource{
				Schema: "cf_select",
				Name:   "item_tags_for_session",
			},
			SessionArgument: "session",
		},
	})
	md.Tables[0].SelectPermissions = append(md.Tables[0].SelectPermissions,
		metadata.SelectPermission{Role: "table_guard", Permission: metadata.SelectPermissionConfig{
			Columns: []string{"id"}, Filter: map[string]any{
				"item_tags_for_session": map[string]any{},
			},
		}})

	conn, inc := permissionConnector(t, md, db.Config().ConnString())
	if len(inc.Snapshot()) != 0 {
		t.Fatalf("session table permission dropped: %+v", inc.Snapshot())
	}

	for _, tc := range []struct {
		label string
		want  []int
	}{
		{"one", []int{1}},
		{"three", []int{2}},
		{"missing", []int{}},
	} {
		t.Run(tc.label, func(t *testing.T) {
			got := permissionIDs(
				t,
				conn,
				"table_guard",
				`query { cf_select_items(order_by:{id:asc}) { id } }`,
				"cf_select_items",
				map[string]any{"x-hasura-tag-label": tc.label},
			)
			if !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("session %s: rows %v, want %v", tc.label, got, tc.want)
			}
		})
	}
}

//nolint:cyclop,paralleltest // Mutation outcomes and rollback share one serial testdb fixture.
func TestComputedTableMutationPermissions(t *testing.T) {
	md, db := permissionFixture(t)
	filter := map[string]any{"item_tags": map[string]any{"label": map[string]any{"_eq": "two"}}}

	md.Tables[0].SelectPermissions = append(md.Tables[0].SelectPermissions,
		metadata.SelectPermission{Role: "table_guard", Permission: metadata.SelectPermissionConfig{
			Columns: []string{"id", "label"}, Filter: map[string]any{},
		}})
	md.Tables[1].SelectPermissions = append(md.Tables[1].SelectPermissions,
		metadata.SelectPermission{Role: "table_guard", Permission: metadata.SelectPermissionConfig{
			Columns: []string{
				"id",
				"label",
			},
			Filter: map[string]any{"id": map[string]any{"_gte": 2}},
		}})
	md.Tables[0].UpdatePermissions = append(md.Tables[0].UpdatePermissions,
		metadata.UpdatePermission{Role: "table_guard", Permission: metadata.UpdatePermissionConfig{
			Columns: []string{"label"}, Filter: filter, Check: filter,
		}})
	md.Tables[0].DeletePermissions = append(md.Tables[0].DeletePermissions,
		metadata.DeletePermission{Role: "table_guard", Permission: metadata.DeletePermissionConfig{
			Filter: filter,
		}})
	md.Tables[0].InsertPermissions = append(md.Tables[0].InsertPermissions,
		metadata.InsertPermission{Role: "table_guard", Permission: metadata.InsertPermissionConfig{
			Columns: []string{"id", "owner_id", "label", "amount", "payload"}, Check: filter,
		}})

	conn, inc := permissionConnector(t, md, db.Config().ConnString())
	if len(inc.Snapshot()) != 0 {
		t.Fatalf("permissions dropped: %+v", inc.Snapshot())
	}

	for _, tc := range []struct {
		query string
		want  []int
	}{
		{`mutation { update_cf_select_items(where:{item_tags:{label:{_eq:"two"}}},_set:{label:"edited"}) { returning { id } } }`, []int{1}},
		{`mutation { delete_cf_select_items(where:{item_tags:{id:{_eq:3}}}) { returning { id } } }`, []int{}},
	} {
		doc, err := parser.ParseQuery(&ast.Source{Input: tc.query})
		if err != nil {
			t.Fatal(err)
		}

		result, err := conn.Execute(t.Context(), doc.Operations[0], doc.Fragments, nil,
			"table_guard", nil, slog.Default())
		if err != nil {
			t.Fatal(err)
		}

		if len(result) != 1 {
			t.Fatalf("mutation result: %v", result)
		}

		for _, value := range result {
			raw, ok := value.(jsontext.Value)
			if !ok {
				t.Fatalf("mutation result type: %T", value)
			}

			var payload struct {
				Returning []struct {
					ID int `json:"id"`
				} `json:"returning"`
			}
			if err := json.Unmarshal(raw, &payload); err != nil {
				t.Fatal(err)
			}

			ids := make([]int, 0, len(payload.Returning))
			for _, row := range payload.Returning {
				ids = append(ids, row.ID)
			}

			if !reflect.DeepEqual(ids, tc.want) {
				t.Fatalf("mutation rows: %v want %v", ids, tc.want)
			}
		}
	}

	// The check runs after INSERT on the complete physical row, and a newly
	// inserted item has no matching tag. The failed mutation must roll back.
	doc, err := parser.ParseQuery(&ast.Source{Input: `mutation {
		insert_cf_select_items_one(object:{id:91, owner_id:1, label:"denied", amount:1, payload:{}}) { id }
	}`})
	if err != nil {
		t.Fatal(err)
	}

	_, err = conn.Execute(t.Context(), doc.Operations[0], doc.Fragments, nil,
		"table_guard", nil, slog.Default())

	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "ZZ901" {
		t.Fatalf("computed table check must deny insert: %v", err)
	}

	var count int
	if err := db.QueryRow(t.Context(), `SELECT count(*) FROM cf_select.items WHERE id=91`).
		Scan(&count); err != nil ||
		count != 0 {
		t.Fatalf("insert check did not roll back: count=%d err=%v", count, err)
	}
}
