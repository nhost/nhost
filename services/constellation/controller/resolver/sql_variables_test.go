package resolver_test

import (
	"context"
	"fmt"
	"log/slog"
	"maps"
	"reflect"
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/formatter"
	"github.com/vektah/gqlparser/v2/validator"

	"github.com/nhost/nhost/services/constellation/connector"
	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	csql "github.com/nhost/nhost/services/constellation/connector/sql"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/controller/planner"
	"github.com/nhost/nhost/services/constellation/controller/resolver"
	"github.com/nhost/nhost/services/constellation/internal/jsonpath"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// Recording at the driver boundary compares the actual SQL and bound parameters,
// while delegating execution to PostgreSQL rather than returning canned rows.
type remoteVariableDriver struct {
	csql.Driver

	operations []core.SQLOperation
}

func (d *remoteVariableDriver) ExecuteOperations(
	ctx context.Context, operations []core.SQLOperation, logger *slog.Logger,
) (map[string]any, error) {
	d.operations = append(d.operations, operations...)

	result, err := d.Driver.ExecuteOperations(ctx, operations, logger)
	if err != nil {
		return nil, fmt.Errorf("executing recorded remote operation: %w", err)
	}

	return result, nil
}

type remoteEnumCase struct {
	name, definitions, arguments, literal, nested, nestedLiteral string
	variables                                                    map[string]any
}

//nolint:paralleltest,tparallel // Sequential requests reuse one pool and exercise warm ASTs within the testdb connection budget.
func TestSQLRemoteEnumVariables(t *testing.T) {
	t.Parallel()

	pool := testdb.NewPostgres(t, `
CREATE TABLE users (id integer PRIMARY KEY, owner integer, label text, visible boolean);
INSERT INTO users VALUES
 (101,1,'keep',true),(102,1,'keep',true),(103,1,'other',true),(104,1,'hidden',false),
 (105,1,'excluded',true),
 (201,2,'keep',true),(202,2,'keep',true),(203,2,'other',true),(204,2,'hidden',false),
 (205,2,'excluded',true);
`)

	pgPool, err := postgres.Open(t.Context(), pool.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(pgPool.Close)
	driver := &remoteVariableDriver{Driver: postgres.NewClient(pgPool), operations: nil}
	logger := slog.New(slog.DiscardHandler)

	conn, err := csql.NewConnector(t.Context(), driver, &metadata.DatabaseMetadata{
		Name: "target", Kind: "postgres", Tables: []metadata.TableMetadata{{
			Table: metadata.TableSource{Schema: "public", Name: "users"},
			SelectPermissions: []metadata.SelectPermission{{
				Role: "reader", Permission: metadata.SelectPermissionConfig{
					Columns: []string{"id", "owner", "label"},
					Filter:  map[string]any{"visible": map[string]any{"_eq": true}},
				},
			}},
			ArrayRelationships: []metadata.ArrayRelationship{{
				Name: "siblings", Using: metadata.RelationshipUsing{
					ManualConfiguration: &metadata.ManualConfiguration{
						RemoteTable:   metadata.TableSource{Schema: "public", Name: "users"},
						ColumnMapping: map[string]string{"owner": "owner"},
					},
				},
			}},
		}},
	}, nil, logger)
	if err != nil {
		t.Fatal(err)
	}

	schemas, err := conn.GetSchema()
	if err != nil {
		t.Fatal(err)
	}

	r := resolver.New(map[string]connector.Connector{"target": conn})

	tests := []remoteEnumCase{
		{
			name: "direction", definitions: "$direction:order_by!",
			arguments: "order_by:{id:$direction}", literal: "order_by:{id:asc}",
			variables: map[string]any{"direction": "asc"},
		},
		{
			name: "nullable direction", definitions: "$direction:order_by",
			arguments: "order_by:[{label:$direction},{id:asc}]", literal: "order_by:[{id:asc}]",
			variables: map[string]any{"direction": nil},
		},
		{
			name: "nullable direction default", definitions: "$direction:order_by=null",
			arguments: "order_by:{label:$direction,id:desc}", literal: "order_by:{id:desc}",
		},
		{
			name: "null overrides direction default", definitions: "$direction:order_by=asc",
			arguments: "order_by:{label:$direction,id:desc}", literal: "order_by:{id:desc}",
			variables: map[string]any{"direction": nil},
		},
		{
			name: "nullable direction in ordering list", definitions: "$order:[users_order_by!]!",
			arguments: "order_by:$order", literal: "order_by:[{id:desc}]",
			variables: map[string]any{"order": []any{
				map[string]any{"label": nil}, map[string]any{"id": "desc"},
			}},
		},
		{
			name: "nullable direction in nested fragment", definitions: "$direction:order_by",
			arguments: "order_by:{id:asc}", literal: "order_by:{id:asc}",
			nested:        `siblings(order_by:{label:$direction,id:desc}) { id }`,
			nestedLiteral: `siblings(order_by:{id:desc}) { id }`,
			variables:     map[string]any{"direction": nil},
		},
		{
			name: "ordering object", definitions: "$order:users_order_by!",
			arguments: "order_by:[$order]", literal: "order_by:[{id:desc}]",
			variables: map[string]any{"order": map[string]any{"id": "desc"}},
		},
		{
			name: "ordering list", definitions: "$order:[users_order_by!]!",
			arguments: "order_by:$order", literal: "order_by:[{label:asc},{id:desc}]",
			variables: map[string]any{"order": []any{
				map[string]any{"label": "asc"}, map[string]any{"id": "desc"},
			}},
		},
		{
			name: "ordering singleton coercion", definitions: "$order:[users_order_by!]!",
			arguments: "order_by:$order", literal: "order_by:[{id:asc}]",
			variables: map[string]any{"order": map[string]any{"id": "asc"}},
		},
		{
			name: "distinct column", definitions: "$column:users_select_column!",
			arguments: "distinct_on:[$column],order_by:[{label:asc},{id:desc}]",
			literal:   "distinct_on:[label],order_by:[{label:asc},{id:desc}]",
			variables: map[string]any{"column": "label"},
		},
		{
			name: "distinct list", definitions: "$columns:[users_select_column!]!",
			arguments: "distinct_on:$columns,order_by:[{label:asc},{id:desc}]",
			literal:   "distinct_on:[label],order_by:[{label:asc},{id:desc}]",
			variables: map[string]any{"columns": []any{"label"}},
		},
		{
			name: "distinct singleton coercion", definitions: "$columns:[users_select_column!]!",
			arguments: "distinct_on:$columns,order_by:{id:asc}",
			literal:   "distinct_on:[id],order_by:{id:asc}",
			variables: map[string]any{"columns": "id"},
		},
		{
			name: "enum default", definitions: "$direction:order_by!=desc",
			arguments: "order_by:{id:$direction}", literal: "order_by:{id:desc}",
		},
		{
			name:          "nested fragment",
			definitions:   "$direction:order_by!,$column:users_select_column!",
			arguments:     "order_by:{id:asc}",
			literal:       "order_by:{id:asc}",
			nested:        `siblings(order_by:{id:$direction},distinct_on:[$column]) { id }`,
			nestedLiteral: `siblings(order_by:{id:desc},distinct_on:[id]) { id }`,
			variables:     map[string]any{"direction": "desc", "column": "id"},
		},
	}
	for _, role := range []string{"admin", "reader"} {
		_, schema, err := schemamerge.BuildValidatedSchema(schemas[role], role)
		if err != nil {
			t.Fatal(err)
		}

		for _, parents := range []int{1, 2} {
			for _, window := range []string{"", ",limit:2"} {
				for _, tt := range tests {
					t.Run(
						fmt.Sprintf("%s/parents=%d/%s/%s", role, parents, window, tt.name),
						func(t *testing.T) {
							testSQLRemoteEnumCase(t, schema, r, driver, role, parents, window, tt)
						},
					)
				}
			}
		}

		t.Run(role+"/invalid enums", func(t *testing.T) {
			testInvalidRemoteEnums(t, schema, r, driver, role)
		})
	}
}

func testSQLRemoteEnumCase(
	t *testing.T, schema *ast.Schema, r *resolver.RemoteRelationshipResolver,
	driver *remoteVariableDriver, role string, parents int, window string, tt remoteEnumCase,
) {
	t.Helper()

	variables := map[string]any{"exclude": "excluded"}
	maps.Copy(variables, tt.variables)
	query := remoteEnumQuery(
		tt.definitions+",$exclude:String!",
		tt.arguments+window,
		"$exclude",
		tt.nested,
	)
	doc := parseRemoteEnumQuery(t, schema, query)

	// Replay the same validated document with different bound strings as well as
	// enums, checking both request isolation and SQL parameterization.
	for _, exclude := range []string{"excluded", "other", "excluded"} {
		literal := parseRemoteEnumQuery(t, schema,
			remoteEnumQuery("", tt.literal+window, fmt.Sprintf("%q", exclude), tt.nestedLiteral))

		baseline, err := resolveEnumSelection(t, r, driver, literal, nil, role, parents)
		if err != nil {
			t.Fatal(err)
		}

		wantSQL := driver.operations
		if len(wantSQL) != 1 {
			t.Fatalf("expected one batched target statement, got %d", len(wantSQL))
		}

		if role == "reader" && strings.Contains(fmt.Sprint(baseline), "hidden") {
			t.Fatalf("target row permission was not applied: %#v", baseline)
		}

		variables["exclude"] = exclude

		coerced, err := validator.VariableValues(schema, doc.Operations[0], variables)
		if err != nil {
			t.Fatal(err)
		}

		got, err := resolveEnumSelection(t, r, driver, doc, coerced, role, parents)
		if err != nil {
			t.Fatal(err)
		}

		if !reflect.DeepEqual(got, baseline) {
			t.Fatalf("variable result=%#v, literal result=%#v", got, baseline)
		}

		if !reflect.DeepEqual(driver.operations, wantSQL) {
			t.Fatalf(
				"variable SQL/parameters=%+v, literal SQL/parameters=%+v",
				driver.operations,
				wantSQL,
			)
		}
	}
}

func parseRemoteEnumQuery(t *testing.T, schema *ast.Schema, query string) *ast.QueryDocument {
	t.Helper()

	doc, errs := gqlparser.LoadQueryWithRules(schema, query, nil)
	if errs != nil {
		t.Fatal(errs)
	}

	return doc
}

func remoteEnumQuery(definitions, arguments, exclude, nested string) string {
	if definitions != "" {
		definitions = "(" + definitions + ")"
	}

	return fmt.Sprintf(`query Q%s { users(%s,where:{label:{_neq:%s}}) { ...Fields } }
fragment Fields on users { id label ... on users { ...Nested } }
fragment Nested on users { owner %s }`, definitions, arguments, exclude, nested)
}

func resolveEnumSelection(
	t *testing.T, r *resolver.RemoteRelationshipResolver, driver *remoteVariableDriver,
	doc *ast.QueryDocument, variables map[string]any, role string, parents int,
) (map[string]any, error) {
	t.Helper()

	var before strings.Builder
	formatter.NewFormatter(&before).FormatQueryDocument(doc)

	rows := make([]any, parents)
	for i := range rows {
		rows[i] = map[string]any{"id": i + 1}
	}

	results := map[string]any{"parents": rows}

	field, ok := doc.Operations[0].SelectionSet[0].(*ast.Field)
	if !ok {
		t.Fatal("expected target field")
	}

	plan := &planner.QueryPlan{RemoteQueries: []*planner.RemoteQueryPlan{
		{
			Name:              "remote_users",
			SourceConnector:   "source",
			SourcePath:        jsonpath.Parse("parents"),
			SourceNamePath:    jsonpath.Parse("parents"),
			TargetConnector:   "target",
			TargetTable:       "users",
			TargetTableSchema: "public",
			JoinMapping:       map[string]string{"id": "owner"},
			IsArray:           true,
			OutputField:       "remote_users",
			ResolverType:      planner.ResolverKindDatabase,
			Selection:         field,
		},
	}}
	driver.operations = nil

	err := r.ResolvePlanned(
		t.Context(),
		results,
		plan,
		doc.Fragments,
		func(_, _ string) string { return "users" },
		variables,
		role,
		nil,
		slog.New(slog.DiscardHandler),
	)

	var after strings.Builder
	formatter.NewFormatter(&after).FormatQueryDocument(doc)

	if before.String() != after.String() {
		t.Fatalf("validated document mutated: before=%s after=%s", before.String(), after.String())
	}

	if err != nil {
		return nil, fmt.Errorf("resolving remote enum selection: %w", err)
	}

	return results, nil
}

func testInvalidRemoteEnums(
	t *testing.T, schema *ast.Schema, r *resolver.RemoteRelationshipResolver,
	driver *remoteVariableDriver, role string,
) {
	t.Helper()

	doc := parseRemoteEnumQuery(t, schema,
		`query($direction:order_by!,$column:users_select_column!) {
 users(order_by:{id:$direction},distinct_on:[$column]) { id }
}`)

	// Requiredness is checked against the original operation, before remote
	// operations discard its variable definitions. The target direction field
	// itself is nullable, so its SQL parser cannot enforce order_by! here.
	t.Run("required null", func(t *testing.T) {
		_, err := validator.VariableValues(schema, doc.Operations[0], map[string]any{
			"direction": nil, "column": "id",
		})
		if err == nil || !strings.Contains(err.Error(), "cannot be null") {
			t.Fatalf("expected required-null variable validation error, got %v", err)
		}
	})

	for _, tt := range []struct {
		name      string
		variables map[string]any
	}{
		{"invalid direction", map[string]any{"direction": "sideways", "column": "id"}},
		{"invalid column", map[string]any{"direction": "asc", "column": "missing"}},
		{"required missing", map[string]any{"column": "id"}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := validator.VariableValues(
				schema,
				doc.Operations[0],
				tt.variables,
			); err == nil {
				t.Fatal("expected variable coercion to reject invalid enum input")
			}

			// SQL parsers also reject unknown enums and unresolved references
			// when a direct caller bypasses variable coercion.
			for _, parents := range []int{1, 2} {
				if _, err := resolveEnumSelection(
					t,
					r,
					driver,
					doc,
					tt.variables,
					role,
					parents,
				); err == nil {
					t.Fatal("expected SQL builder to reject invalid enum input")
				}

				if len(driver.operations) != 0 {
					t.Fatal("invalid enum input reached SQL execution")
				}
			}
		})
	}
}
