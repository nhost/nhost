package queries_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/formatter"
	"github.com/vektah/gqlparser/v2/validator"
	"github.com/vektah/gqlparser/v2/validator/rules"

	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/schema"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

type computedSpatialMembershipCase struct {
	name, declaration, comparison, variables, laterPredicate string
	predicate                                                string
	parameterCount                                           int
	wantIDs                                                  []int
}

func computedSpatialMembershipCases(sqlType string) []computedSpatialMembershipCase {
	comparison := "$cmp:" + sqlType + "_comparison_exp!"
	list := "$points:[" + sqlType + "!]!"

	return []computedSpatialMembershipCase{
		{
			"comparison empty in",
			comparison,
			"$cmp",
			`{"cmp":{"_in":[]}}`,
			"",
			" = ANY(ARRAY[]::",
			1,
			[]int{},
		},
		{
			"comparison empty nin",
			comparison,
			"$cmp",
			`{"cmp":{"_nin":[]}}`,
			"",
			" != ALL(ARRAY[]::",
			1,
			[]int{1, 2, 3},
		},
		{
			"list empty in",
			list,
			"{_in:$points}",
			`{"points":[]}`,
			"",
			" = ANY(ARRAY[]::",
			1,
			[]int{},
		},
		{
			"list empty nin",
			list,
			"{_nin:$points}",
			`{"points":[]}`,
			"",
			" != ALL(ARRAY[]::",
			1,
			[]int{1, 2, 3},
		},
		{
			"comparison later predicate",
			comparison,
			"$cmp",
			`{"cmp":{"_nin":[]}}`,
			",id:{_gte:2}",
			" != ALL(ARRAY[]::",
			2,
			[]int{2, 3},
		},
		{
			"list later predicate",
			list,
			"{_nin:$points}",
			`{"points":[]}`,
			",id:{_gte:2}",
			" != ALL(ARRAY[]::",
			2,
			[]int{2, 3},
		},
		{
			"mixed empty in",
			comparison,
			"$cmp",
			`{"cmp":{"_in":[],"_is_null":false}}`,
			",id:{_gte:2}",
			" = ANY(ARRAY[]::",
			2,
			[]int{},
		},
		{
			"mixed empty nin",
			comparison,
			"$cmp",
			`{"cmp":{"_nin":[],"_is_null":false}}`,
			",id:{_gte:2}",
			" != ALL(ARRAY[]::",
			2,
			[]int{2},
		},
		{
			"comparison nonempty in",
			comparison,
			"$cmp",
			`{"cmp":{"_in":[{"type":"Point","coordinates":[1,2]}]}}`,
			"",
			" = ANY(ARRAY[ST_GeomFromGeoJSON($2)",
			2,
			[]int{1},
		},
		{
			"list nonempty nin",
			list,
			"{_nin:$points}",
			`{"points":[{"type":"Point","coordinates":[1,2]}]}`,
			"",
			" != ALL(ARRAY[ST_GeomFromGeoJSON($2)",
			2,
			[]int{2},
		},
	}
}

func TestComputedSpatialMembershipVariableSQL(t *testing.T) {
	t.Parallel()

	objects := introspection.NewObjects()
	objects.Schemas["public"] = &introspection.Schema{Tables: map[string]*introspection.Table{
		"items": {
			Schema:  "public",
			Name:    "items",
			Columns: []introspection.Column{{Name: "id", Type: "int4"}},
		},
	}}

	objects.ComputedFunctions = map[introspection.ComputedTable]map[string]introspection.ComputedFunctionLookup{
		{Schema: "public", Name: "items"}: {},
	}
	for _, sqlType := range []string{"geometry", "geography"} {
		objects.ComputedFunctions[introspection.ComputedTable{Schema: "public", Name: "items"}]["computed_"+sqlType] = introspection.ComputedFunctionLookup{
			Function: &introspection.ComputedFunction{
				Schema:      "public",
				Name:        "computed_" + sqlType,
				RowArgument: 0,
				Arguments: []introspection.ComputedFunctionArgument{
					{
						Name: "item",
						Mode: "i",
						Type: introspection.PostgreSQLType{
							Schema: "public",
							Name:   "items",
							Kind:   "c",
						},
					},
					{
						Name:     "session",
						Mode:     "i",
						Position: 1,
						Type: introspection.PostgreSQLType{
							Schema: "pg_catalog",
							Name:   "jsonb",
							Kind:   "b",
						},
					},
				},
				ReturnType: introspection.PostgreSQLType{
					Schema: "public",
					Name:   sqlType,
					Kind:   "b",
				},
				Volatility: introspection.VolatilityStable,
			},
		}
	}

	roots, generated := computedSpatialMembershipRoots(
		t,
		objects,
		computedSpatialMembershipMetadata(),
	)

	for _, sqlType := range []string{"geometry", "geography"} {
		for _, tt := range computedSpatialMembershipCases(sqlType) {
			t.Run(sqlType+"/"+tt.name, func(t *testing.T) {
				t.Parallel()

				operation := buildComputedSpatialMembership(t, roots, generated, sqlType, tt)
				assertComputedSpatialMembershipSQL(t, operation, sqlType, tt)
			})
		}
	}
}

func assertComputedSpatialMembershipSQL(
	t *testing.T,
	operation core.SQLOperation,
	sqlType string,
	tt computedSpatialMembershipCase,
) {
	t.Helper()

	if len(operation.Parameters) != tt.parameterCount {
		t.Fatalf(
			"parameter count = %d, want %d",
			len(operation.Parameters),
			tt.parameterCount,
		)
	}

	if !strings.Contains(operation.SQL, tt.predicate) ||
		!strings.Contains(operation.SQL, "::"+sqlType+"[])") {
		t.Fatalf(
			"missing typed spatial membership %q in SQL: %s",
			tt.predicate,
			operation.SQL,
		)
	}

	if strings.Contains(tt.name, "mixed") &&
		strings.Count(operation.SQL, `"public"."computed_`+sqlType+`"(`) != 2 {
		t.Fatalf(
			"mixed operators must retain both uses of the computed call: %s",
			operation.SQL,
		)
	}

	placeholders := regexp.MustCompile(`\$(\d+)`).
		FindAllStringSubmatch(operation.SQL, -1)

	used := make(map[int]bool)
	for _, placeholder := range placeholders {
		index, err := strconv.Atoi(placeholder[1])
		if err != nil {
			t.Fatal(err)
		}

		if index < 1 || index > len(operation.Parameters) {
			t.Fatalf("unbound placeholder %s in SQL: %s", placeholder[0], operation.SQL)
		}

		used[index] = true
	}

	if len(used) != len(operation.Parameters) {
		t.Fatalf(
			"SQL references %d parameters, but binds %d: %s",
			len(used),
			len(operation.Parameters),
			operation.SQL,
		)
	}

	if operation.Parameters[0] != `{"x-hasura-user-id":"spatial-member"}` ||
		strings.Contains(operation.SQL, "spatial-member") {
		t.Fatalf("session must remain parameterized: %s", operation.SQL)
	}
}

//nolint:paralleltest,tparallel // Sequential subtests reuse one pool to respect the testdb connection budget.
func TestComputedSpatialMembershipVariableExecution(t *testing.T) {
	t.Parallel()

	pool := testdb.NewPostgres(t, `CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TABLE public.items(id integer PRIMARY KEY);
INSERT INTO public.items VALUES (1), (2), (3);
CREATE FUNCTION public.computed_geometry(item public.items, session jsonb) RETURNS geometry
LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN item.id <> 3 AND session->>'x-hasura-user-id' = 'spatial-member'
    THEN ST_SetSRID(ST_MakePoint(item.id, 2), 4326) END
$$;
CREATE FUNCTION public.computed_geography(item public.items, session jsonb) RETURNS geography
LANGUAGE sql STABLE AS $$ SELECT public.computed_geometry(item, session)::geography $$;`)

	pgPool, err := postgres.Open(t.Context(), pool.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatal(err)
	}

	client := postgres.NewClient(pgPool)
	t.Cleanup(client.Close)

	md := computedSpatialMembershipMetadata()

	objects, err := client.Introspect(t.Context(), md)
	if err != nil {
		t.Fatal(err)
	}

	roots, generated := computedSpatialMembershipRoots(t, objects, md)

	for _, sqlType := range []string{"geometry", "geography"} {
		for _, tt := range computedSpatialMembershipCases(sqlType) {
			t.Run(sqlType+"/"+tt.name, func(t *testing.T) {
				operation := buildComputedSpatialMembership(t, roots, generated, sqlType, tt)

				var raw []byte
				if err := pool.QueryRow(t.Context(), operation.SQL, operation.Parameters...).
					Scan(&raw); err != nil {
					t.Fatalf("execute spatial membership: %v\nSQL: %s", err, operation.SQL)
				}

				var rows []struct{ ID int }
				if err := json.Unmarshal(raw, &rows); err != nil {
					t.Fatal(err)
				}

				ids := make([]int, len(rows))
				for i, row := range rows {
					ids[i] = row.ID
				}

				if diff := cmp.Diff(tt.wantIDs, ids); diff != "" {
					t.Errorf("spatial membership IDs (-want +got):\n%s", diff)
				}
			})
		}
	}
}

func computedSpatialMembershipMetadata() *metadata.DatabaseMetadata {
	md := &metadata.DatabaseMetadata{
		Name: "default",
		Kind: "postgres",
		Tables: []metadata.TableMetadata{
			{Table: metadata.TableSource{Schema: "public", Name: "items"}},
		},
	}
	for _, sqlType := range []string{"geometry", "geography"} {
		md.Tables[0].ComputedFields = append(md.Tables[0].ComputedFields, metadata.ComputedField{
			Name: "computed_" + sqlType, Definition: metadata.ComputedFieldDefinition{
				Function: metadata.FunctionSource{
					Schema: "public",
					Name:   "computed_" + sqlType,
				},
				SessionArgument: "session",
			},
		})
	}

	return md
}

func computedSpatialMembershipRoots(
	t *testing.T,
	objects *introspection.Objects,
	md *metadata.DatabaseMetadata,
) (queries.Roots, *ast.Schema) {
	t.Helper()

	dial := dialect.NewPostgresDialect()
	caps := schema.NewCapabilities(schema.KindPostgres, dial)

	generated, err := schema.GenerateForRole(objects, "admin", md, caps)
	if err != nil {
		t.Fatal(err)
	}

	_, validated, err := schemamerge.BuildValidatedSchema(generated, "admin")
	if err != nil {
		t.Fatal(err)
	}

	roots, _, err := queries.BuildRoots(objects, md, dial, caps)
	if err != nil {
		t.Fatal(err)
	}

	return roots, validated
}

func buildComputedSpatialMembership(
	t *testing.T,
	roots queries.Roots,
	generated *ast.Schema,
	sqlType string,
	tc computedSpatialMembershipCase,
) core.SQLOperation {
	t.Helper()

	query := fmt.Sprintf(
		`query(%s){items(where:{computed_%s:%s%s},order_by:{id:asc}){id}}`,
		tc.declaration,
		sqlType,
		tc.comparison,
		tc.laterPredicate,
	)

	document, errs := gqlparser.LoadQueryWithRules(generated, query, rules.NewDefaultRules())
	if len(errs) != 0 {
		t.Fatal(errs)
	}

	var provided map[string]any
	if err := json.Unmarshal([]byte(tc.variables), &provided); err != nil {
		t.Fatal(err)
	}

	variables, err := validator.VariableValues(generated, document.Operations[0], provided)
	if err != nil {
		t.Fatal(err)
	}

	var before bytes.Buffer
	formatter.NewFormatter(&before).FormatQueryDocument(document)

	operations, err := roots.BuildQuery(
		document.Operations[0],
		document.Fragments,
		variables,
		"admin",
		map[string]any{"x-hasura-user-id": "spatial-member"},
	)
	if err != nil {
		t.Fatal(err)
	}

	var after bytes.Buffer
	formatter.NewFormatter(&after).FormatQueryDocument(document)

	if before.String() != after.String() {
		t.Error("BuildQuery mutated the validated document")
	}

	if len(operations) != 1 {
		t.Fatalf("operations = %d, want 1", len(operations))
	}

	return operations[0]
}
