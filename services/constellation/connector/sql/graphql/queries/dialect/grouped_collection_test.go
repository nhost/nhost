package dialect_test

import (
	"reflect"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
)

func TestCollectionKeyTransport(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name       string
		dial       dialect.Dialect
		wantSQL    string
		wantParams []any
		wantJSON   string
		wantNext   int
	}{
		{
			"postgres", dialect.NewPostgresDialect(),
			`unnest($2::jsonb[], $3::int4[]) AS "keys"("key0", "key1")`,
			[]any{"prefix", []any{`"a"`, `"b"`}, []any{1, 2}},
			`json_build_array("keys"."key0", "keys"."key1")`, 4,
		},
		{
			"sqlite", dialect.NewSQLiteDialect(),
			`(SELECT ? AS "key0", ? AS "key1" UNION ALL SELECT ?, ?) AS "keys"`,
			[]any{"prefix", `"a"`, 1, `"b"`, 2},
			`json_array("keys"."key0", "keys"."key1")`, 6,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var b strings.Builder

			params, next := dialect.WriteCollectionKeysFrom(
				tc.dial, &b, "keys", []string{"key0", "key1"},
				[]string{"jsonb", "int4"}, [][]any{{`"a"`, 1}, {`"b"`, 2}},
				[]any{"prefix"}, 2,
			)
			if b.String() != tc.wantSQL || next != tc.wantNext ||
				!reflect.DeepEqual(params, tc.wantParams) {
				t.Fatalf("SQL=%q next=%d params=%#v", b.String(), next, params)
			}

			if key := dialect.CollectionKeyJSON(
				tc.dial,
				"keys",
				[]string{"key0", "key1"},
			); key != tc.wantJSON {
				t.Fatalf("composite JSON expression=%q", key)
			}

			if name := dialect.CollectionKeyName(0); name != "__cs_array_key_0" {
				t.Fatalf("key alias=%q", name)
			}
		})
	}
}
