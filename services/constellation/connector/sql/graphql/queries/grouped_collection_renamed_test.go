package queries_test

import (
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	groupedaggdispatch "github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/groupedaggregate"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// TestBuildGroupedCollectionRenamedKeys pins physical correlation and the
// resolved JSON type under both dialects, including a GraphQL/SQL collision.
//
//nolint:gocognit // Dialect SQL shape and both compatibility name forms share one fixture.
func TestBuildGroupedCollectionRenamedKeys(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name      string
		dial      dialect.Dialect
		jsonType  string
		want      []string
		forbidden []string
	}{
		{"postgres", dialect.NewPostgresDialect(), "jsonb", []string{
			`unnest($1::text[], $2::jsonb[])`,
			`"public"."users"."label" = "__cs_array_keys"."__cs_array_key_0"`,
			`"public"."users"."j" = "__cs_array_keys"."__cs_array_key_1"`,
		}, []string{`"public"."users"."lbl" = "__cs_array_keys"`}},
		{"sqlite", dialect.NewSQLiteDialect(), "JSON", []string{
			`json("__cs_array_keys"."__cs_array_key_1")`,
			`"users"."label" = "__cs_array_keys"."__cs_array_key_0"`,
			`"users"."j" = "__cs_array_keys"."__cs_array_key_1"`,
		}, []string{`"users"."lbl" = "__cs_array_keys"`}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			objects := buildObjectsWithUsersTable()
			users := objects.Schemas["public"].Tables["users"]
			users.Columns = append(users.Columns,
				introspection.Column{Name: "label", Type: "text"},
				introspection.Column{Name: "lbl", Type: "text"},
				introspection.Column{Name: "j", Type: tc.jsonType},
			)
			md := &metadata.DatabaseMetadata{
				Tables: []metadata.TableMetadata{tableMetaFor("users")},
			}
			md.Tables[0].Configuration.ColumnConfig = map[string]metadata.ColumnConfig{
				"label": {CustomName: "lbl"}, "lbl": {CustomName: "otherLabel"},
				"j": {CustomName: "jsonKey"},
			}
			_, field, fragments := parseSingleField(t, `query {
				users(order_by:{id:asc},limit:1,offset:1) { id }
			}`)

			roots, ops, err := queries.BuildRoots(objects, md, tc.dial)
			if err != nil {
				t.Fatal(err)
			}

			input := groupedaggdispatch.BuildInput{
				TableSchema: "public", TableName: "users", Field: field,
				Fragments: fragments, Role: "admin", JoinColumns: []string{"lbl", "jsonKey"},
				JoinTuples: [][]any{{"first", `"first"`}, {"second", `"second"`}},
			}

			built, err := ops.BuildGroupedCollectionSQL(
				input,
				roots.Operations[queries.OperationQuery],
			)
			if err != nil {
				t.Fatal(err)
			}

			if input.JoinColumns[0] != "lbl" || input.JoinColumns[1] != "jsonKey" {
				t.Fatalf("builder mutated caller's GraphQL join columns: %#v", input.JoinColumns)
			}

			for _, fragment := range tc.want {
				if !strings.Contains(built.SQL, fragment) {
					t.Errorf("SQL missing %q: %s", fragment, built.SQL)
				}
			}

			for _, fragment := range tc.forbidden {
				if strings.Contains(built.SQL, fragment) {
					t.Errorf("SQL contains %q: %s", fragment, built.SQL)
				}
			}

			// Direct callers can still provide unambiguous physical SQL names.
			input.JoinColumns = []string{"label", "j"}
			if _, err := ops.BuildGroupedCollectionSQL(
				input,
				roots.Operations[queries.OperationQuery],
			); err != nil {
				t.Fatalf("SQL-name fallback: %v", err)
			}

			input.JoinColumns, input.JoinTuples = nil, nil
			input.JoinColumnSQLName = "j"

			input.JoinValues = []any{`"first"`, `"second"`}
			if _, err := ops.BuildGroupedCollectionSQL(
				input,
				roots.Operations[queries.OperationQuery],
			); err != nil {
				t.Fatalf("single-column SQL-name fallback: %v", err)
			}
		})
	}
}
