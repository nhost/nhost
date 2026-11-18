package queries_test

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	graphqlschema "github.com/nhost/nhost/services/constellation/connector/sql/graphql/schema"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

type arrayMembershipCase struct {
	name          string
	definitions   string
	where         string
	variables     string
	wantPredicate string
	wantParams    []any
	wantIDs       []int
}

func arrayMembershipCases() []arrayMembershipCase {
	const tags = `"public"."items"."tags"`

	return []arrayMembershipCase{
		{
			name: "nested in", definitions: "($tags:[String!]!)",
			where: `{tags:{_in:[$tags]}}`, variables: `{"tags":["a","b"]}`,
			wantPredicate: "(" + tags + " = $1::text[])",
			wantParams:    []any{[]any{"a", "b"}}, wantIDs: []int{1},
		},
		{
			name: "nested nin", definitions: "($tags:[String!]!)",
			where: `{tags:{_nin:[$tags]}}`, variables: `{"tags":["a","b"]}`,
			wantPredicate: "(" + tags + " != $1::text[])",
			wantParams:    []any{[]any{"a", "b"}}, wantIDs: []int{2, 3, 4, 6},
		},
		{
			name:          "comparison in unequal lengths",
			definitions:   "($cmp:String_array_comparison_exp!)",
			where:         `{tags:$cmp}`,
			variables:     `{"cmp":{"_in":[["a","b"],["b"]]}}`,
			wantPredicate: "(" + tags + " = $1::text[] OR " + tags + " = $2::text[])",
			wantParams:    []any{[]any{"a", "b"}, []any{"b"}},
			wantIDs:       []int{1, 2},
		},
		{
			name:          "comparison nin unequal lengths",
			definitions:   "($cmp:String_array_comparison_exp!)",
			where:         `{tags:$cmp}`,
			variables:     `{"cmp":{"_nin":[["a","b"],["b"]]}}`,
			wantPredicate: "(" + tags + " != $1::text[] AND " + tags + " != $2::text[])",
			wantParams:    []any{[]any{"a", "b"}, []any{"b"}},
			wantIDs:       []int{3, 4, 6},
		},
		{
			name: "whole where in", definitions: "($where:items_bool_exp!)",
			where: `$where`, variables: `{"where":{"tags":{"_in":[["a","b"],["b"]]}}}`,
			wantPredicate: "(" + tags + " = $1::text[] OR " + tags + " = $2::text[])",
			wantParams:    []any{[]any{"a", "b"}, []any{"b"}}, wantIDs: []int{1, 2},
		},
		{
			name: "whole where nin", definitions: "($where:items_bool_exp!)",
			where: `$where`, variables: `{"where":{"tags":{"_nin":[["a","b"],["b"]]}}}`,
			wantPredicate: "(" + tags + " != $1::text[] AND " + tags + " != $2::text[])",
			wantParams:    []any{[]any{"a", "b"}, []any{"b"}}, wantIDs: []int{3, 4, 6},
		},
		{
			name:        "mixed candidates preserve grouping and parameter order",
			definitions: "($tags:[String!]!)",
			where:       `{id:{_gt:1},tags:{_in:[$tags,["b"],[]]},name:{_neq:"excluded"}}`,
			variables:   `{"tags":["a","b"]}`,
			wantPredicate: `"public"."items"."id" > $1::int4 AND (` + tags + " = $2::text[] OR " +
				tags + " = $3::text[] OR " + tags + ` = $4::text[]) AND "public"."items"."name" != $5::text`,
			wantParams: []any{int64(1), []any{"a", "b"}, []any{"b"}, []any{}, "excluded"},
			wantIDs:    []int{2, 3},
		},
		{
			name:          "empty in",
			definitions:   "($arrays:[[String!]!]!)",
			where:         `{tags:{_in:$arrays}}`,
			variables:     `{"arrays":[]}`,
			wantPredicate: "(" + tags + " IS NULL AND FALSE)",
			wantParams:    []any{},
			wantIDs:       []int{},
		},
		{
			name:          "empty nin includes null column",
			definitions:   "($arrays:[[String!]!]!)",
			where:         `{tags:{_nin:$arrays}}`,
			variables:     `{"arrays":[]}`,
			wantPredicate: "(" + tags + " IS NULL OR TRUE)",
			wantParams:    []any{},
			wantIDs:       []int{1, 2, 3, 4, 5, 6},
		},
		{
			name: "empty candidate in", definitions: "($tags:[String!]!)",
			where: `{tags:{_in:[$tags]}}`, variables: `{"tags":[]}`,
			wantPredicate: "(" + tags + " = $1::text[])",
			wantParams:    []any{[]any{}}, wantIDs: []int{3},
		},
		{
			name: "empty candidate nin", definitions: "($tags:[String!]!)",
			where: `{tags:{_nin:[$tags]}}`, variables: `{"tags":[]}`,
			wantPredicate: "(" + tags + " != $1::text[])",
			wantParams:    []any{[]any{}}, wantIDs: []int{1, 2, 4, 6},
		},
		{
			name: "nested default", definitions: `($tags:[String!]!=["a","b"])`,
			where: `{tags:{_in:[$tags]}}`, variables: `{}`,
			wantPredicate: "(" + tags + " = $1::text[])",
			wantParams:    []any{[]any{"a", "b"}}, wantIDs: []int{1},
		},
		{
			name: "equal control", definitions: "($tags:[String!]!)",
			where: `{tags:{_eq:$tags}}`, variables: `{"tags":["a","b"]}`,
			wantPredicate: tags + " = $1::text[]",
			wantParams:    []any{[]any{"a", "b"}}, wantIDs: []int{1},
		},
		{
			name: "contains control", definitions: "($tags:[String!]!)",
			where: `{tags:{_contains:$tags}}`, variables: `{"tags":["b"]}`,
			wantPredicate: tags + " @> $1::text[]",
			wantParams:    []any{[]any{"b"}}, wantIDs: []int{1, 2, 6},
		},
		{
			name: "scalar in control", definitions: "($ids:[Int!]!)",
			where: `{id:{_in:$ids}}`, variables: `{"ids":[1,2]}`,
			wantPredicate: `"public"."items"."id" = ANY($1::int4[])`,
			wantParams:    []any{[]any{float64(1), float64(2)}}, wantIDs: []int{1, 2},
		},
		{
			name: "scalar nin control", definitions: "($ids:[Int!]!)",
			where: `{id:{_nin:$ids}}`, variables: `{"ids":[1,2]}`,
			wantPredicate: `"public"."items"."id" != ALL($1::int4[])`,
			wantParams:    []any{[]any{float64(1), float64(2)}}, wantIDs: []int{3, 4, 5, 6},
		},
	}
}

func TestArrayColumnMembershipSQL(t *testing.T) {
	t.Parallel()

	roots, schema := arrayMembershipRoots(t)
	for _, tt := range arrayMembershipCases() {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			query := "query" + tt.definitions + "{items(where:" + tt.where + ",order_by:{id:asc}){id}}"

			operations := buildVariableInput(t, roots, schema, query, tt.variables)
			if len(operations) != 1 {
				t.Fatalf("expected one operation, got %d", len(operations))
			}

			operation := operations[0]
			if !strings.Contains(operation.SQL, tt.wantPredicate) {
				t.Errorf("SQL %s does not contain %s", operation.SQL, tt.wantPredicate)
			}

			if diff := cmp.Diff(tt.wantParams, operation.Parameters); diff != "" {
				t.Errorf("parameters (-want +got):\n%s", diff)
			}
		})
	}
}

//nolint:tparallel // Sequential mutation subtests share one fixture and pool to respect the connection budget.
func TestArrayColumnMembershipExecution(t *testing.T) {
	t.Parallel()

	seed := testdb.NewPostgres(
		t,
		`CREATE TABLE items (id int4 PRIMARY KEY, tags text[], name text);`,
	)

	pool, err := postgres.Open(t.Context(), seed.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatalf("Open: %v", err)
	}

	client := postgres.NewClient(pool)
	t.Cleanup(client.Close)

	testArrayMembershipCases(t, arrayMembershipCases(), pool, client, `TRUNCATE items;
		INSERT INTO items VALUES (1,ARRAY['a','b'],'first'), (2,ARRAY['b'],'second'),
		(3,'{}','empty'), (4,ARRAY['z'],'other'), (5,NULL,'null'), (6,ARRAY['a','b','c'],'longer');`)
}

func testArrayMembershipCases(
	t *testing.T,
	cases []arrayMembershipCase,
	pool postgres.Pool,
	client *postgres.Client,
	resetSQL string,
) {
	t.Helper()

	roots, schema := arrayMembershipRoots(t)

	operations := []struct {
		name     string
		template string
	}{
		{"read", "query%s{items(where:%s,order_by:{id:asc}){id}}"},
		{
			"update",
			`mutation%s{update_items(where:%s,_set:{name:"updated"}){affected_rows returning{id}}}`,
		},
		{"delete", "mutation%s{delete_items(where:%s){affected_rows returning{id}}}"},
		{
			"insert conflict",
			`mutation%s{insert_items(objects:[{id:1,name:"upserted"}],on_conflict:{constraint:items_pkey,update_columns:[name],where:%s}){affected_rows returning{id}}}`,
		},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			for _, operation := range operations {
				t.Run(operation.name, func(t *testing.T) {
					if err := pool.Exec(t.Context(), resetSQL); err != nil {
						t.Fatalf("reset fixture: %v", err)
					}

					query := fmt.Sprintf(operation.template, tt.definitions, tt.where)
					built := buildVariableInput(t, roots, schema, query, tt.variables)

					result, err := client.ExecuteOperations(
						t.Context(),
						built,
						slog.New(slog.DiscardHandler),
					)
					if err != nil {
						t.Fatalf("ExecuteOperations: %v", err)
					}

					wantIDs := tt.wantIDs
					if operation.name == "insert conflict" {
						wantIDs = []int{}
						if slices.Contains(tt.wantIDs, 1) {
							wantIDs = []int{1}
						}
					}

					assertArrayMembershipResult(t, result, wantIDs)
				})
			}
		})
	}
}

func assertArrayMembershipResult(t *testing.T, result map[string]any, wantIDs []int) {
	t.Helper()

	encoded, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("Marshal result: %v", err)
	}

	var rawResult map[string]json.RawMessage
	if err := json.Unmarshal(encoded, &rawResult); err != nil {
		t.Fatalf("Unmarshal result: %v", err)
	}

	type row struct {
		ID int `json:"id"`
	}

	var rows []row
	if raw, ok := rawResult["items"]; ok {
		if err := json.Unmarshal(raw, &rows); err != nil {
			t.Fatalf("Unmarshal read: %v", err)
		}
	} else {
		for _, raw := range rawResult {
			var mutation struct {
				AffectedRows int   `json:"affected_rows"`
				Returning    []row `json:"returning"`
			}
			if err := json.Unmarshal(raw, &mutation); err != nil {
				t.Fatalf("Unmarshal mutation: %v", err)
			}

			if mutation.AffectedRows != len(wantIDs) {
				t.Errorf("affected_rows = %d, want %d", mutation.AffectedRows, len(wantIDs))
			}

			rows = mutation.Returning
		}
	}

	ids := make([]int, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.ID)
	}

	slices.Sort(ids)

	if diff := cmp.Diff(wantIDs, ids); diff != "" {
		t.Errorf("matched IDs (-want +got):\n%s", diff)
	}
}

func arrayMembershipRoots(t *testing.T) (queries.Roots, *ast.Schema) {
	t.Helper()

	return arrayMembershipRootsForRole(t, "admin")
}

func arrayMembershipRootsForRole(t *testing.T, role string) (queries.Roots, *ast.Schema) {
	t.Helper()

	objects := introspection.NewObjects()
	objects.Schemas["public"] = &introspection.Schema{Tables: map[string]*introspection.Table{
		"items": {
			Schema: "public", Name: "items", PrimaryKeys: []string{"id"},
			IsInsertable: true, IsUpdatable: true, PrimaryKeyConstraintName: "items_pkey",
			Columns: []introspection.Column{
				{Name: "id", Type: "int4"},
				{Name: "tags", Type: "text", IsArray: true},
				{Name: "name", Type: "text"},
			},
		},
	}}
	filter := map[string]any{"id": map[string]any{"_gt": 1}}
	md := &metadata.DatabaseMetadata{
		Name: "default",
		Kind: "postgres",
		Tables: []metadata.TableMetadata{{
			Table: metadata.TableSource{Schema: "public", Name: "items"},
			SelectPermissions: []metadata.SelectPermission{{
				Role: "member", Permission: metadata.SelectPermissionConfig{
					Columns: []string{"id", "tags", "name"}, Filter: filter,
				},
			}},
			UpdatePermissions: []metadata.UpdatePermission{{
				Role: "member", Permission: metadata.UpdatePermissionConfig{
					Columns: []string{"name"}, Filter: filter,
				},
			}},
			DeletePermissions: []metadata.DeletePermission{{
				Role: "member", Permission: metadata.DeletePermissionConfig{Filter: filter},
			}},
		}},
	}
	d := dialect.NewPostgresDialect()
	caps := graphqlschema.NewCapabilities(graphqlschema.KindPostgres, d)

	graph, err := graphqlschema.GenerateForRole(objects, role, md, caps)
	if err != nil {
		t.Fatalf("GenerateForRole: %v", err)
	}

	_, schema, err := schemamerge.BuildValidatedSchema(graph, role)
	if err != nil {
		t.Fatalf("BuildValidatedSchema: %v", err)
	}

	roots, _, err := queries.BuildRoots(objects, md, d, caps)
	if err != nil {
		t.Fatalf("BuildRoots: %v", err)
	}

	return roots, schema
}
