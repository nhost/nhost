package queries_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	groupedaggdispatch "github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/groupedaggregate"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// TestGroupedAggregateJoinNameAmbiguity rejects a collision before either
// dialect renders or executes SQL, even if the GraphQL column is role-hidden.
//
//nolint:gocognit // The two dialects and unambiguous controls share one introspection fixture.
func TestGroupedAggregateJoinNameAmbiguity(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name string
		dial dialect.Dialect
	}{
		{"postgres", dialect.NewPostgresDialect()},
		{"sqlite", dialect.NewSQLiteDialect()},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			objects := buildObjectsWithUsersTable()
			users := objects.Schemas["public"].Tables["users"]
			users.Columns = append(users.Columns,
				introspection.Column{Name: "label", Type: "text"},
				introspection.Column{Name: "lbl", Type: "text"},
			)
			md := &metadata.DatabaseMetadata{
				Tables: []metadata.TableMetadata{tableMetaFor("users")},
			}
			md.Tables[0].Configuration.ColumnConfig = map[string]metadata.ColumnConfig{
				"label": {CustomName: "lbl"}, "lbl": {CustomName: "otherLabel"},
			}
			_, field, fragments := parseSingleField(t, `query {
				users_aggregate { aggregate { count } nodes { id } }
			}`)

			_, ops, err := queries.BuildRoots(objects, md, tc.dial)
			if err != nil {
				t.Fatal(err)
			}

			input := groupedaggdispatch.BuildInput{
				TableSchema: "public", TableName: "users", Field: field,
				Fragments: fragments, Role: "reader", JoinColumnSQLName: "lbl",
				JoinValues: []any{"first"},
			}
			// The builder uses the full target column set for resolution. A
			// missing role select grant for otherLabel cannot hide this collision.
			got, err := ops.BuildGroupedAggregateSQL(input)
			if !errors.Is(err, queries.ErrAmbiguousGroupedAggregateJoinColumn) {
				t.Fatalf("expected typed ambiguity, got op=%+v err=%v", got, err)
			}

			if got.SQL != "" || len(got.Parameters) != 0 {
				t.Fatalf("ambiguous join generated SQL: %+v", got)
			}

			if !strings.Contains(err.Error(), `"lbl"`) ||
				strings.Contains(err.Error(), "otherLabel") {
				t.Fatalf("unexpected ambiguity error: %v", err)
			}

			// A physical SQL name with no competing GraphQL column and a
			// default name that resolves to the same physical column keep their
			// legacy SQL-name semantics on PostgreSQL.
			if tc.name == "postgres" {
				for _, name := range []string{"label", "id"} {
					t.Run(name, func(t *testing.T) {
						input.JoinColumnSQLName = name
						input.Role = "admin"

						op, err := ops.BuildGroupedAggregateSQL(input)
						if err != nil {
							t.Fatal(err)
						}

						if !strings.Contains(op.SQL, `"public"."users"."`+name+`" = `) {
							t.Fatalf("wrong SQL join for %q: %s", name, op.SQL)
						}
					})
				}
			}
		})
	}
}
