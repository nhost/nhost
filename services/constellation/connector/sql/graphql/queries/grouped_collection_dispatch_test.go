package queries_test

import (
	"reflect"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	groupedaggdispatch "github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/groupedaggregate"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// TestBuildGroupedCollectionSQL checks bounds and column projections at the
// public dispatch boundary; the controller tests execute the generated SQL.
//
//nolint:gocognit // The two dialect SQL-shape matrices share the same assertions.
func TestBuildGroupedCollectionSQL(
	t *testing.T,
) {
	t.Parallel()

	objects := buildObjectsWithUsersTable()
	users := objects.Schemas["public"].Tables["users"]
	users.Columns = append(users.Columns, introspection.Column{Name: "matched", Type: "text"})
	md := &metadata.DatabaseMetadata{Tables: []metadata.TableMetadata{tableMetaFor("users")}}

	md.Tables[0].SelectPermissions = []metadata.SelectPermission{{
		Role: "reader", Permission: metadata.SelectPermissionConfig{
			Columns: []string{"id", "matched"},
			Filter:  map[string]any{"matched": map[string]any{"_eq": "visible"}},
		},
	}}
	for _, tc := range []struct {
		name   string
		dial   dialect.Dialect
		query  string
		want   []string
		forbid []string
	}{
		{
			"postgres", dialect.NewPostgresDialect(),
			`query { users(where:{matched:{_eq:"visible"}},distinct_on:[matched],
				order_by:[{matched:asc},{id:asc}],limit:1,offset:1) { id matched } }`,
			[]string{
				`unnest($1::uuid[], $2::text[])`, `json_build_array(`,
				`WHERE`, `"public"."users"."id" = "__cs_array_keys"."__cs_array_key_0"`,
				`"public"."users"."matched" = "__cs_array_keys"."__cs_array_key_1"`,
				`DISTINCT ON ("matched")`, `LIMIT 1 OFFSET 1`, `"matched" = `,
			},
			[]string{`SELECT 1 AS "matched"`, `ON true WHERE`},
		},
		{
			"sqlite", dialect.NewSQLiteDialect(),
			`query { users(where:{matched:{_eq:"visible"}},order_by:{matched:asc},limit:1,offset:1) { id matched } }`,
			[]string{
				`json_group_array(json_object(`, `json_array(`,
				`SELECT ? AS "__cs_array_key_0", ? AS "__cs_array_key_1" UNION ALL SELECT ?, ?`,
				`LIMIT 1 OFFSET 1`, `"users"."matched" = "__cs_array_keys"."__cs_array_key_1"`,
			},
			[]string{`LATERAL`, `SELECT 1 AS "matched"`},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			roots, ops, err := queries.BuildRoots(objects, md, tc.dial)
			if err != nil {
				t.Fatal(err)
			}

			_, field, fragments := parseSingleField(t, tc.query)

			built, err := ops.BuildGroupedCollectionSQL(groupedaggdispatch.BuildInput{
				TableSchema: "public", TableName: "users", Field: field,
				Fragments: fragments, Role: "reader", JoinColumns: []string{"id", "matched"},
				JoinTuples: [][]any{{"a", "m"}, {"b", "n"}},
			}, roots.Operations[queries.OperationQuery])
			if err != nil {
				t.Fatal(err)
			}

			for _, fragment := range tc.want {
				if !strings.Contains(built.SQL, fragment) {
					t.Errorf("SQL missing %q: %s", fragment, built.SQL)
				}
			}

			for _, fragment := range tc.forbid {
				if strings.Contains(built.SQL, fragment) {
					t.Errorf("SQL contains %q: %s", fragment, built.SQL)
				}
			}

			if strings.Count(built.SQL, "LIMIT 1 OFFSET 1") != 1 {
				t.Errorf(
					"pagination must occur only inside each correlated collection: %s",
					built.SQL,
				)
			}

			if tc.name == "postgres" && !reflect.DeepEqual(built.Parameters[:2], []any{
				[]any{"a", "b"}, []any{"m", "n"},
			}) {
				t.Errorf("typed zipped key params: %#v", built.Parameters)
			}

			if tc.name == "sqlite" && !reflect.DeepEqual(
				built.Parameters[len(built.Parameters)-4:], []any{"a", "m", "b", "n"},
			) {
				t.Errorf("SQLite key params: %#v", built.Parameters)
			}
		})
	}
}
