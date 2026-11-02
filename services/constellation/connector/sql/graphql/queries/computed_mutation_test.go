package queries_test

import (
	"encoding/json"
	"errors"
	"reflect"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/schema"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
)

//nolint:gocognit // The mutation matrix keeps isolated fixture setup and SQL assertions together.
func TestComputedScalarMutationReturning(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name, query string
		want        any
	}{
		{
			name:  "insert one with argument after an anonymous returning row",
			query: `mutation { insert_cf_select_items_one(object:{id:10, owner_id:1, label:"new", amount:4.5, payload:{status:"new"}}) { id item_label item_second(args:{multiplier:3}) item_payload(path:"status") } }`,
			want: map[string]any{
				"id":           float64(10),
				"item_label":   "new",
				"item_second":  float64(13.5),
				"item_payload": "new",
			},
		},
		{
			name:  "insert collection",
			query: `mutation { insert_cf_select_items(objects:[{id:10, owner_id:1, label:"new", amount:4.5, payload:{status:"new"}}]) { affected_rows returning { item_label item_second(args:{multiplier:3}) } } }`,
			want: map[string]any{
				"affected_rows": float64(1),
				"returning": []any{
					map[string]any{"item_label": "new", "item_second": float64(13.5)},
				},
			},
		},
		{
			name:  "insert nested object relationship",
			query: `mutation { insert_cf_select_tags_one(object:{id:10,label:"linked",item:{data:{id:10, owner_id:1, label:"parent", amount:4.5, payload:{}}}}) { item { item_label item_second(args:{multiplier:3}) } } }`,
			want: map[string]any{
				"item": map[string]any{"item_label": "parent", "item_second": float64(13.5)},
			},
		},
		{
			name:  "insert nested array relationship",
			query: `mutation { insert_cf_select_items_one(object:{id:10, owner_id:1, label:"parent", amount:4.5, payload:{}, tags:{data:[{id:10,label:"child"}]}}) { item_label } }`,
			want:  map[string]any{"item_label": "parent"},
		},
		{
			name:  "insert conflict update returning",
			query: `mutation { insert_cf_select_items_one(object:{id:1, owner_id:1, label:"conflict", amount:4.5, payload:{}}, on_conflict:{constraint:items_pkey,update_columns:[label,amount]}) { item_label item_second(args:{multiplier:3}) } }`,
			want:  map[string]any{"item_label": "conflict", "item_second": float64(13.5)},
		},
		{
			name:  "update by pk",
			query: `mutation { update_cf_select_items_by_pk(pk_columns:{id:1}, _set:{label:"updated"}) { item_label item_second(args:{multiplier:3}) } }`,
			want:  map[string]any{"item_label": "updated", "item_second": float64(37.5)},
		},
		{
			name:  "update collection",
			query: `mutation { update_cf_select_items(where:{id:{_eq:1}}, _set:{label:"updated"}) { returning { item_label item_second(args:{multiplier:3}) } } }`,
			want: map[string]any{
				"returning": []any{
					map[string]any{"item_label": "updated", "item_second": float64(37.5)},
				},
			},
		},
		{
			name:  "delete by pk",
			query: `mutation { delete_cf_select_items_by_pk(id:10) { item_label item_second(args:{multiplier:3}) } }`,
			want:  map[string]any{"item_label": "orphan", "item_second": float64(6)},
		},
		{
			name:  "delete collection",
			query: `mutation { delete_cf_select_items(where:{id:{_eq:10}}) { returning { item_label item_second(args:{multiplier:3}) } } }`,
			want: map[string]any{
				"returning": []any{
					map[string]any{"item_label": "orphan", "item_second": float64(6)},
				},
			},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			roots, pool, _, _, _ := computedTestFixture(t)
			if strings.HasPrefix(tc.name, "delete") {
				_, err := pool.Exec(
					t.Context(),
					`INSERT INTO cf_select.items (id, owner_id, label, amount, payload) VALUES (10, 1, 'orphan', 2, '{}')`,
				)
				if err != nil {
					t.Fatal(err)
				}
			}

			doc, err := parser.ParseQuery(&ast.Source{Input: tc.query})
			if err != nil {
				t.Fatal(err)
			}

			ops, err := roots.BuildQuery(doc.Operations[0], doc.Fragments, nil, "admin", nil)
			if err != nil {
				t.Fatal(err)
			}

			if len(ops) != 1 {
				t.Fatalf("operations = %d", len(ops))
			}

			sqlText := ops[0].SQL
			if ops[0].Insert != nil {
				sqlText = ops[0].Insert.FinalSQL
			}

			if !strings.Contains(sqlText, `::"cf_select"."items"`) ||
				!strings.Contains(sqlText, "$1") {
				t.Fatalf("missing typed row cast or bound arguments: %s", sqlText)
			}

			got := computedResult(t, pool, ops[0])
			if !reflect.DeepEqual(got, tc.want) {
				body, _ := json.Marshal(got)
				t.Fatalf("mutation response %s; want %#v", body, tc.want)
			}

			if tc.name == "insert nested array relationship" {
				var count int
				if err := pool.QueryRow(t.Context(), `SELECT count(*) FROM cf_select.tags WHERE id = 10 AND item_id = 10`).
					Scan(&count); err != nil ||
					count != 1 {
					t.Fatalf("nested child count = %d, error = %v", count, err)
				}
			}
		})
	}
}

func TestComputedScalarUpdateManyReturning(t *testing.T) {
	t.Parallel()
	//nolint:dogsled // Only the roots and isolated pool are needed for executing sequential children.
	roots, pool, _, _, _ := computedTestFixture(t)

	doc, err := parser.ParseQuery(&ast.Source{Input: `mutation {
		update_cf_select_items_many(updates:[
			{where:{id:{_eq:1}},_set:{label:"many-first"}},
			{where:{id:{_eq:2}},_set:{label:"many-second"}}
		]) { returning { item_label item_second(args:{multiplier:2}) } }
	}`})
	if err != nil {
		t.Fatal(err)
	}

	ops, err := roots.BuildQuery(doc.Operations[0], doc.Fragments, nil, "admin", nil)
	if err != nil {
		t.Fatal(err)
	}

	if len(ops) != 1 || ops[0].SQL != "" || len(ops[0].Sequential) != 2 {
		t.Fatalf("update_many operations = %#v, want two sequential children", ops)
	}

	for i, want := range []any{
		map[string]any{"returning": []any{map[string]any{"item_label": "many-first", "item_second": float64(25)}}},
		map[string]any{"returning": []any{map[string]any{"item_label": "many-second", "item_second": float64(6.5)}}},
	} {
		child := ops[0].Sequential[i]
		if !strings.Contains(child.SQL, `::"cf_select"."items"`) ||
			!strings.Contains(child.SQL, "$1") {
			t.Fatalf("sequential child %d lost row cast or bound arguments: %s", i, child.SQL)
		}

		if got := computedResult(t, pool, child); !reflect.DeepEqual(got, want) {
			t.Fatalf("sequential child %d returning = %#v, want %#v", i, got, want)
		}
	}
}

func TestComputedScalarInsertReturningWithCheck(t *testing.T) {
	t.Parallel()
	_, pool, objects, md, _ := computedTestFixture(t)
	table := &md.Tables[0]
	table.SelectPermissions = append(table.SelectPermissions, metadata.SelectPermission{
		Role: "restricted", Permission: metadata.SelectPermissionConfig{
			Columns: []string{"id"}, ComputedFields: []string{"item_second"},
			Filter: map[string]any{"owner_id": map[string]any{"_eq": 1}},
		},
	})
	table.InsertPermissions = append(table.InsertPermissions, metadata.InsertPermission{
		Role: "restricted", Permission: metadata.InsertPermissionConfig{
			Columns: []string{"id", "owner_id", "label", "amount", "payload"},
			Check:   map[string]any{"owner_id": map[string]any{"_eq": 1}},
		},
	})

	caps := schema.NewCapabilities(schema.KindPostgres, dialect.NewPostgresDialect())

	generated, err := schema.GenerateForRole(objects, "restricted", md, caps)
	if err != nil {
		t.Fatal(err)
	}

	item := generated.ToAST().Definitions.ForName("cf_select_items")
	if item == nil || item.Fields.ForName("item_second") == nil ||
		item.Fields.ForName("item_label") != nil || item.Fields.ForName("amount") != nil {
		t.Fatal(
			"restricted role must see only the granted computed selection, not ungranted fields or columns",
		)
	}

	roots, _, err := queries.BuildRoots(objects, md, dialect.NewPostgresDialect(), caps)
	if err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct {
		name, query string
		id          int
		allowed     bool
	}{
		{
			name:  "passing insert check",
			query: `mutation { insert_cf_select_items_one(object:{id:11,owner_id:1,label:"allowed",amount:4.5,payload:{}}) { item_second(args:{multiplier:3}) } }`,
			id:    11, allowed: true,
		},
		{
			name:  "denied insert check",
			query: `mutation { insert_cf_select_items_one(object:{id:12,owner_id:2,label:"denied",amount:4.5,payload:{}}) { item_second(args:{multiplier:3}) } }`,
			id:    12,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertComputedInsertCheck(t, pool, roots, tc.query, tc.id, tc.allowed)
		})
	}

	ungranted, err := parser.ParseQuery(&ast.Source{Input: `mutation {
		insert_cf_select_items_one(object:{id:13,owner_id:1,label:"hidden",amount:4.5,payload:{}}) { item_label }
	}`})
	if err != nil {
		t.Fatal(err)
	}

	if _, err := roots.BuildQuery(
		ungranted.Operations[0],
		ungranted.Fragments,
		nil,
		"restricted",
		nil,
	); err == nil {
		t.Fatal("restricted role executed an ungranted computed selection in insert returning")
	}
}

func assertComputedInsertCheck(
	t *testing.T, pool *pgxpool.Pool, roots queries.Roots, query string, id int, allowed bool,
) {
	t.Helper()

	doc, err := parser.ParseQuery(&ast.Source{Input: query})
	if err != nil {
		t.Fatal(err)
	}

	ops, err := roots.BuildQuery(doc.Operations[0], doc.Fragments, nil, "restricted", nil)
	if err != nil {
		t.Fatal(err)
	}

	if len(ops) != 1 || !strings.Contains(ops[0].SQL, `::"cf_select"."items"`) {
		t.Fatalf("missing returning row cast: %#v", ops)
	}

	if allowed {
		want := map[string]any{"item_second": float64(13.5)}
		if got := computedResult(t, pool, ops[0]); !reflect.DeepEqual(got, want) {
			t.Fatalf("restricted insert returning = %#v, want %#v", got, want)
		}
	} else {
		var raw []byte

		err = pool.QueryRow(t.Context(), ops[0].SQL, ops[0].Parameters...).Scan(&raw)

		var pgErr *pgconn.PgError
		if !errors.As(err, &pgErr) || pgErr.Code != "ZZ901" {
			t.Fatalf("denied insert error = %v, want ZZ901", err)
		}
	}

	var count int
	if err := pool.QueryRow(t.Context(), `SELECT count(*) FROM cf_select.items WHERE id = $1`, id).
		Scan(&count); err != nil {
		t.Fatal(err)
	}

	wantCount := 0
	if allowed {
		wantCount = 1
	}

	if count != wantCount {
		t.Fatalf("inserted rows = %d, want %d", count, wantCount)
	}
}

func TestComputedMutationReturningUsesFullRowAndGrant(t *testing.T) {
	t.Parallel()
	_, pool, objects, md, _ := computedTestFixture(
		t,
	)
	md.Tables[0].SelectPermissions = append(
		md.Tables[0].SelectPermissions,
		metadata.SelectPermission{
			Role: "restricted", Permission: metadata.SelectPermissionConfig{
				Columns: []string{"id", "label"}, ComputedFields: []string{"item_second"},
				Filter: map[string]any{"owner_id": map[string]any{"_eq": 1}},
			},
		},
	)
	md.Tables[0].UpdatePermissions = append(
		md.Tables[0].UpdatePermissions,
		metadata.UpdatePermission{
			Role: "restricted", Permission: metadata.UpdatePermissionConfig{
				Columns: []string{
					"label",
				},
				Filter: map[string]any{"owner_id": map[string]any{"_eq": 1}},
			},
		},
	)
	caps := schema.NewCapabilities(schema.KindPostgres, dialect.NewPostgresDialect())

	generated, err := schema.GenerateForRole(objects, "restricted", md, caps)
	if err != nil {
		t.Fatal(err)
	}

	item := generated.ToAST().Definitions.ForName("cf_select_items")
	if item == nil || item.Fields.ForName("item_second") == nil ||
		item.Fields.ForName("amount") != nil {
		t.Fatal("restricted mutation role exposed a denied column or lost its computed grant")
	}

	roots, _, err := queries.BuildRoots(objects, md, dialect.NewPostgresDialect(), caps)
	if err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct {
		name, query string
		want        any
	}{
		{"visible", `mutation { update_cf_select_items(where:{id:{_eq:1}}, _set:{label:"updated"}) { returning { item_second(args:{multiplier:2}) } } }`, map[string]any{"returning": []any{map[string]any{"item_second": float64(25)}}}},
		{"filtered", `mutation { update_cf_select_items(where:{id:{_eq:2}}, _set:{label:"updated"}) { returning { item_second(args:{multiplier:2}) } } }`, map[string]any{"returning": []any{}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			doc, err := parser.ParseQuery(&ast.Source{Input: tc.query})
			if err != nil {
				t.Fatal(err)
			}

			ops, err := roots.BuildQuery(doc.Operations[0], doc.Fragments, nil, "restricted", nil)
			if err != nil {
				t.Fatal(err)
			}

			if len(ops) != 1 {
				t.Fatalf("operations = %d", len(ops))
			}

			if got := computedResult(t, pool, ops[0]); !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("restricted returning = %#v, want %#v", got, tc.want)
			}
		})
	}
}
