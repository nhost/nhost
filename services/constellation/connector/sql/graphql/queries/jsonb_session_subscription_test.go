package queries_test

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/formatter"
	"github.com/vektah/gqlparser/v2/validator/rules"

	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/multiplexed"
	graphqlschema "github.com/nhost/nhost/services/constellation/connector/sql/graphql/schema"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

//nolint:paralleltest,tparallel // Sequential schema/template builds share one fixture pool.
func TestJSONBPermissionSubscriptionExecution(t *testing.T) {
	t.Parallel()
	seed := testdb.NewPostgres(t, `CREATE TABLE json_items(id int PRIMARY KEY, data jsonb);
INSERT INTO json_items VALUES(1,'{}'),(2,'"x-hasura-json"'),(3,'"hello"');`)

	pool, err := postgres.Open(t.Context(), seed.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatal(err)
	}

	client := postgres.NewClient(pool)
	t.Cleanup(client.Close)

	var objectArray, stringArray string
	if err := pool.QueryRow(t.Context(), `SELECT ARRAY['{}'::jsonb]::text,ARRAY['"hello"'::jsonb]::text`).
		Scan(&objectArray, &stringArray); err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		role, operator string
		operand        any
		sessions       []any
		want           map[string][]int
	}{
		{
			"eq",
			"_eq",
			"X-Hasura-Json",
			[]any{`{}`, `"hello"`},
			map[string][]int{"object": {1}, "string": {3}},
		},
		{
			"contains",
			"_contains",
			"X-Hasura-Json",
			[]any{`{}`, `"hello"`},
			map[string][]int{"object": {1}, "string": {3}},
		},
		{
			"contained_in",
			"_contained_in",
			"X-Hasura-Json",
			[]any{`{}`, `"hello"`},
			map[string][]int{"object": {1}, "string": {3}},
		},
		{
			"in",
			"_in",
			[]any{"X-Hasura-Json"},
			[]any{`{}`, `"hello"`},
			map[string][]int{"object": {1}, "string": {3}},
		},
		{
			"nin",
			"_nin",
			[]any{"X-Hasura-Json"},
			[]any{`{}`, `"hello"`},
			map[string][]int{"object": {2, 3}, "string": {1, 2}},
		},
		{
			"mixed",
			"_in",
			[]any{"X-Hasura-Json", "hello"},
			[]any{`{}`, `"hello"`},
			map[string][]int{"object": {1, 3}, "string": {3}},
		},
		{
			"whole_in",
			"_in",
			"X-Hasura-Json",
			[]any{objectArray, stringArray},
			map[string][]int{"object": {1}, "string": {3}},
		},
		{
			"whole_nin",
			"_nin",
			"X-Hasura-Json",
			[]any{objectArray, stringArray},
			map[string][]int{"object": {2, 3}, "string": {1, 2}},
		},
	}

	table := metadata.TableMetadata{
		Table: metadata.TableSource{Schema: "public", Name: "json_items"},
	}
	for _, tt := range tests {
		table.SelectPermissions = append(table.SelectPermissions, metadata.SelectPermission{
			Role: tt.role,
			Permission: metadata.SelectPermissionConfig{
				Columns: []string{"id", "data"},
				Filter:  map[string]any{"data": map[string]any{tt.operator: tt.operand}},
			},
		})
	}

	md := &metadata.DatabaseMetadata{
		Name:   "default",
		Kind:   "postgres",
		Tables: []metadata.TableMetadata{table},
	}

	objects, err := client.Introspect(t.Context(), md)
	if err != nil {
		t.Fatal(err)
	}

	dial := dialect.NewPostgresDialect()
	caps := graphqlschema.NewCapabilities(graphqlschema.KindPostgres, dial)

	roots, _, err := queries.BuildRoots(objects, md, dial, caps)
	if err != nil {
		t.Fatal(err)
	}

	for _, tt := range tests {
		t.Run(tt.role, func(t *testing.T) {
			role := tt.role

			graph, err := graphqlschema.GenerateForRole(objects, role, md, caps)
			if err != nil {
				t.Fatal(err)
			}

			_, schema, err := schemamerge.BuildValidatedSchema(graph, role)
			if err != nil {
				t.Fatal(err)
			}

			for _, kind := range []string{"live", "stream"} {
				t.Run(kind, func(t *testing.T) {
					testJSONBPermissionSubscription(
						t,
						roots,
						schema,
						client,
						role,
						kind,
						tt.sessions,
						tt.want,
					)
				})
			}
		})
	}
}

func testJSONBPermissionSubscription(
	t *testing.T,
	roots queries.Roots,
	schema *ast.Schema,
	client *postgres.Client,
	role, kind string, sessions []any, want map[string][]int,
) {
	t.Helper()

	query := `subscription{json_items(order_by:{id:asc}){id}}`

	var cursor map[string]any
	if kind == "stream" {
		query = `subscription{json_items_stream(batch_size:10,cursor:[{initial_value:{id:0}}]){id}}`
		cursor = map[string]any{"id": 0}
	}

	document, errs := gqlparser.LoadQueryWithRules(
		schema, query,
		rules.NewDefaultRules(),
	)
	if len(errs) != 0 {
		t.Fatal(errs)
	}

	var before bytes.Buffer
	formatter.NewFormatter(&before).FormatQueryDocument(document)

	session := map[string]any{"x-hasura-json": core.SessionVarValue{Name: "x-hasura-json"}}
	for range 2 {
		ops, err := roots.BuildQuery(
			document.Operations[0],
			document.Fragments,
			nil,
			role,
			session,
		)
		if err != nil {
			t.Fatal(err)
		}

		params := multiplexed.PrepareParams(
			[]string{"object", "string"},
			map[string][]any{"x-hasura-json": sessions},
			cursor,
		)
		params = append(params, ops[0].Parameters...)

		results, err := client.ExecuteMultiplexedOperation(
			t.Context(),
			ops[0].SQL,
			params,
			slog.New(slog.DiscardHandler),
		)
		if err != nil {
			t.Fatal(err)
		}

		got := make(map[string][]int)
		for _, result := range results {
			var data map[string][]struct {
				ID int `json:"id"`
			}
			if err := json.Unmarshal(result.Data, &data); err != nil {
				t.Fatal(err)
			}

			for _, row := range data[ops[0].Name] {
				got[result.SubscriptionID] = append(got[result.SubscriptionID], row.ID)
			}
		}

		if diff := cmp.Diff(
			want, got,
		); diff != "" {
			t.Fatalf("cohort IDs: %s", diff)
		}
	}

	var after bytes.Buffer
	formatter.NewFormatter(&after).FormatQueryDocument(document)

	if before.String() != after.String() {
		t.Fatal("subscription build mutated cached AST")
	}

	if diff := cmp.Diff(
		map[string]any{"x-hasura-json": core.SessionVarValue{Name: "x-hasura-json"}},
		session,
	); diff != "" {
		t.Fatalf("session template mutated: %s", diff)
	}
}
