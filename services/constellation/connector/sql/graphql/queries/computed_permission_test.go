package queries_test

import (
	"encoding/json"
	"errors"
	"reflect"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/multiplexed"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/schema"
	"github.com/nhost/nhost/services/constellation/metadata"
)

//nolint:gocognit // Live/stream polls both assert isolation for two subscribers against one testdb.
func TestComputedPermissionSubscriptionCohorts(
	t *testing.T,
) {
	t.Parallel()
	_, pool, objects, md, _ := computedTestFixture(t, true)
	md.Tables[0].SelectPermissions = append(
		md.Tables[0].SelectPermissions,
		metadata.SelectPermission{
			Role: "guard", Permission: metadata.SelectPermissionConfig{
				Columns: []string{"id"},
				Filter: map[string]any{
					"session_label": map[string]any{"_eq": "x-hasura-expected"},
				},
			},
		},
	)

	roots, _, err := queries.BuildRoots(
		objects,
		md,
		dialect.NewPostgresDialect(),
		schema.NewCapabilities(schema.KindPostgres, dialect.NewPostgresDialect()),
	)
	if err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct {
		name, query string
		cursor      map[string]any
	}{
		{"live", `subscription { cf_select_items(order_by:{id:asc}) { id } }`, nil},
		{"stream", `subscription { cf_select_items_stream(batch_size:2,cursor:[{initial_value:{id:0}}]) { id } }`, map[string]any{"id": 0}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			doc, err := parser.ParseQuery(&ast.Source{Input: tc.query})
			if err != nil {
				t.Fatal(err)
			}

			ops, err := roots.BuildQuery(
				doc.Operations[0],
				doc.Fragments,
				nil,
				"guard",
				map[string]any{
					"x-hasura-role": core.SessionVarValue{
						Name: "x-hasura-role",
					},
					"x-hasura-user-id":  core.SessionVarValue{Name: "x-hasura-user-id"},
					"x-hasura-expected": core.SessionVarValue{Name: "x-hasura-expected"},
				},
			)
			if err != nil {
				t.Fatal(err)
			}

			if len(ops) != 1 {
				t.Fatalf("operations: %d", len(ops))
			}

			if strings.Contains(ops[0].SQL, "template") {
				t.Fatalf("session captured in SQL: %s", ops[0].SQL)
			}

			params := multiplexed.PrepareParams([]string{"sub-a", "sub-b"}, map[string][]any{
				"x-hasura-role": {"guard", "guard"}, "x-hasura-user-id": {"user-a", "user-b"},
				"x-hasura-expected": {"first:user-a", "second:user-b"},
			}, tc.cursor)
			params = append(params, ops[0].Parameters...)

			rows, err := pool.Query(t.Context(), ops[0].SQL, params...)
			if err != nil {
				t.Fatalf("poll: %v\n%s", err, ops[0].SQL)
			}
			defer rows.Close()

			got := map[string][]int{}
			for rows.Next() {
				var (
					id  string
					raw []byte
				)
				if err := rows.Scan(&id, &raw); err != nil {
					t.Fatalf(
						"poll row: %v\nSQL: %s\nstatic parameters: %#v",
						err,
						ops[0].SQL,
						ops[0].Parameters,
					)
				}

				var payload map[string][]struct {
					ID int `json:"id"`
				}
				if err := json.Unmarshal(raw, &payload); err != nil {
					t.Fatal(err)
				}

				for _, entry := range payload["cf_select_items"+streamSuffix(tc.name)] {
					got[id] = append(got[id], entry.ID)
				}
			}

			if err := rows.Err(); err != nil {
				t.Fatalf(
					"poll result: %v\nSQL: %s\nstatic: %#v",
					err,
					ops[0].SQL,
					ops[0].Parameters,
				)
			}

			if !reflect.DeepEqual(got["sub-a"], []int{1}) ||
				!reflect.DeepEqual(got["sub-b"], []int{2}) {
				t.Fatalf("permission cohort = %#v; SQL: %s", got, ops[0].SQL)
			}
		})
	}
}

func TestComputedPermissionNestedAndExists(t *testing.T) {
	t.Parallel()
	_, pool, objects, md, _ := computedTestFixture(t)
	md.Tables[1].SelectPermissions = append(
		md.Tables[1].SelectPermissions,
		metadata.SelectPermission{
			Role: "guard", Permission: metadata.SelectPermissionConfig{
				Columns: []string{"id", "item_id"},
				Filter: map[string]any{"_and": []any{
					map[string]any{
						"item": map[string]any{"item_label": map[string]any{"_eq": "first"}},
					},
					map[string]any{"_exists": map[string]any{
						"_table": map[string]any{"schema": "cf_select", "name": "items"},
						"_where": map[string]any{"item_label": map[string]any{"_eq": "first"}},
					}},
				}},
			},
		},
	)

	roots, _, err := queries.BuildRoots(objects, md, dialect.NewPostgresDialect(),
		schema.NewCapabilities(schema.KindPostgres, dialect.NewPostgresDialect()))
	if err != nil {
		t.Fatal(err)
	}

	doc, err := parser.ParseQuery(
		&ast.Source{Input: `query { cf_select_tags(order_by:{id:asc}) { id } }`},
	)
	if err != nil {
		t.Fatal(err)
	}

	ops, err := roots.BuildQuery(doc.Operations[0], doc.Fragments, nil, "guard", nil)
	if err != nil {
		t.Fatal(err)
	}

	want := []any{map[string]any{"id": float64(1)}, map[string]any{"id": float64(2)}}
	if got := computedResult(t, pool, ops[0]); !reflect.DeepEqual(got, want) {
		t.Fatalf("nested filter rows = %#v, want %#v", got, want)
	}
}

// Each role sees a different physical row despite selecting only id; the
// computed function reads label and the session argument without column grants.
func TestComputedPermissionSelectAndSession(t *testing.T) {
	t.Parallel()
	_, pool, objects, md, _ := computedTestFixture(t, true)
	table := &md.Tables[0]
	table.SelectPermissions = append(table.SelectPermissions, metadata.SelectPermission{
		Role: "guard", Permission: metadata.SelectPermissionConfig{
			Columns: []string{"id"}, Filter: map[string]any{"_and": []any{
				map[string]any{"session_label": map[string]any{"_eq": "x-hasura-expected"}},
				map[string]any{"item_label": map[string]any{"_neq": "blocked"}},
			}},
		},
	})
	caps := schema.NewCapabilities(schema.KindPostgres, dialect.NewPostgresDialect())

	roots, _, err := queries.BuildRoots(objects, md, dialect.NewPostgresDialect(), caps)
	if err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct {
		name, expected string
		want           any
	}{
		{"first", "first:user-a", []any{map[string]any{"id": float64(1)}}},
		{"second", "second:user-b", []any{map[string]any{"id": float64(2)}}},
		{"denied", "missing:user-a", []any{}}, // no physical row has this label
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			session := map[string]any{
				"x-hasura-role":     "guard",
				"x-hasura-expected": tc.expected,
				"x-hasura-user-id":  strings.Split(tc.expected, ":")[1],
			}

			doc, err := parser.ParseQuery(
				&ast.Source{Input: `query { cf_select_items(order_by:{id:asc}) { id } }`},
			)
			if err != nil {
				t.Fatal(err)
			}

			ops, err := roots.BuildQuery(doc.Operations[0], doc.Fragments, nil, "guard", session)
			if err != nil {
				t.Fatal(err)
			}

			if len(ops) != 1 || strings.Contains(ops[0].SQL, tc.expected) {
				t.Fatalf("permission value leaked into SQL: %#v", ops)
			}

			if got := computedResult(t, pool, ops[0]); !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("rows = %#v, want %#v", got, tc.want)
			}
		})
	}
}

//nolint:paralleltest,tparallel // Mutations on one isolated testdb must run in order to assert counts and rollback.
func TestComputedPermissionMutationSecurity(t *testing.T) {
	t.Parallel()

	_, pool, objects, md, _ := computedTestFixture(t)
	if _, err := pool.Exec(
		t.Context(),
		`ALTER TABLE cf_select.items ALTER COLUMN amount SET DEFAULT 1, ALTER COLUMN payload SET DEFAULT '{}'::jsonb`,
	); err != nil {
		t.Fatal(err)
	}

	table := &md.Tables[0]
	table.SelectPermissions = append(table.SelectPermissions, metadata.SelectPermission{
		Role: "guard", Permission: metadata.SelectPermissionConfig{
			Columns: []string{"id", "label"},
			Filter:  map[string]any{"item_label": map[string]any{"_eq": "first"}},
		},
	})
	table.InsertPermissions = append(table.InsertPermissions, metadata.InsertPermission{
		Role: "guard", Permission: metadata.InsertPermissionConfig{
			Columns: []string{"id", "owner_id", "label", "amount", "payload"},
			Check:   map[string]any{"item_label": map[string]any{"_eq": "first"}},
		},
	})
	table.UpdatePermissions = append(table.UpdatePermissions, metadata.UpdatePermission{
		Role: "guard", Permission: metadata.UpdatePermissionConfig{
			Columns: []string{"label"},
			Filter:  map[string]any{"item_label": map[string]any{"_eq": "first"}},
			Check:   map[string]any{"item_label": map[string]any{"_eq": "first"}},
		},
	})
	table.DeletePermissions = append(table.DeletePermissions, metadata.DeletePermission{
		Role: "guard", Permission: metadata.DeletePermissionConfig{
			Filter: map[string]any{"item_label": map[string]any{"_eq": "first"}},
		},
	})

	roots, _, err := queries.BuildRoots(
		objects,
		md,
		dialect.NewPostgresDialect(),
		schema.NewCapabilities(schema.KindPostgres, dialect.NewPostgresDialect()),
	)
	if err != nil {
		t.Fatal(err)
	}

	hidden, err := parser.ParseQuery(
		&ast.Source{
			Input: `mutation { insert_cf_select_items_one(object:{id:35,owner_id:1,label:"first",amount:1,payload:{}}) { item_label } }`,
		},
	)
	if err != nil {
		t.Fatal(err)
	}

	if _, err := roots.BuildQuery(
		hidden.Operations[0],
		hidden.Fragments,
		nil,
		"guard",
		nil,
	); err == nil {
		t.Fatal("ungranted computed field leaked through mutation returning")
	}

	cases := []struct {
		name, query string
		want        any
		denied      bool
	}{
		{
			"insert denied",
			`mutation { insert_cf_select_items_one(object:{id:31,owner_id:1,label:"forbidden",amount:1,payload:{}}) { id } }`,
			nil,
			true,
		},
		{
			"insert accepted",
			`mutation { insert_cf_select_items_one(object:{id:32,owner_id:1,label:"first",amount:1,payload:{}}) { id } }`,
			map[string]any{"id": float64(32)},
			false,
		},
		{
			"insert defaulted physical columns",
			`mutation { insert_cf_select_items_one(object:{id:33,owner_id:1,label:"first"}) { id } }`,
			map[string]any{"id": float64(33)},
			false,
		},
		{
			"upsert accepted",
			`mutation { insert_cf_select_items_one(object:{id:32,owner_id:1,label:"first",amount:2,payload:{}}, on_conflict:{constraint:items_pkey,update_columns:[label]}) { id } }`,
			map[string]any{"id": float64(32)},
			false,
		},
		{
			"update filtered",
			`mutation { update_cf_select_items(where:{id:{_eq:2}},_set:{label:"first"}) { affected_rows } }`,
			map[string]any{"affected_rows": float64(0)},
			false,
		},
		{
			"update denied check",
			`mutation { update_cf_select_items(where:{id:{_eq:1}},_set:{label:"changed"}) { affected_rows } }`,
			nil,
			true,
		},
		{
			"delete filtered",
			`mutation { delete_cf_select_items(where:{id:{_eq:2}}) { affected_rows } }`,
			map[string]any{"affected_rows": float64(0)},
			false,
		},
		{
			"delete permitted",
			`mutation { delete_cf_select_items(where:{id:{_eq:32}}) { affected_rows } }`,
			map[string]any{"affected_rows": float64(1)},
			false,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			doc, err := parser.ParseQuery(&ast.Source{Input: tc.query})
			if err != nil {
				t.Fatal(err)
			}

			ops, err := roots.BuildQuery(doc.Operations[0], doc.Fragments, nil, "guard", nil)
			if err != nil {
				t.Fatal(err)
			}

			if tc.denied {
				var raw []byte

				err = pool.QueryRow(t.Context(), ops[0].SQL, ops[0].Parameters...).Scan(&raw)

				var pgErr *pgconn.PgError
				if !errors.As(err, &pgErr) || pgErr.Code != "ZZ901" {
					t.Fatalf("denied check: %v", err)
				}
			} else if got := computedResult(t, pool, ops[0]); !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("result = %#v, want %#v", got, tc.want)
			}
		})
	}
}
