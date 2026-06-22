package queries_test

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"errors"
	"flag"
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	groupedaggdispatch "github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/groupedaggregate"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/multiplexed"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

var updateGolden = flag.Bool("update", false, "update golden files") //nolint:gochecknoglobals

// testResources holds an isolated Postgres database with roots and pool
// for query building and execution.
type testResources struct {
	roots        queries.Roots
	groupedAggOp *groupedaggdispatch.Ops
	pool         *pgxpool.Pool
}

// setupIsolatedDB creates an isolated Postgres database with the test schema
// and seed data, introspects it, and builds query roots. Each call creates a
// fresh database — no shared state between tests.
func setupIsolatedDB(t *testing.T) *testResources {
	t.Helper()

	ddl, err := os.ReadFile("testdata/pg_schema.sql")
	if err != nil {
		t.Fatalf("failed to read test DDL: %v", err)
	}

	seeds, err := os.ReadFile("testdata/pg_seeds.sql")
	if err != nil {
		t.Fatalf("failed to read test seeds: %v", err)
	}

	pool := testdb.NewPostgres(t, string(ddl), string(seeds))
	testDBURL := pool.Config().ConnConfig.ConnString()

	md, err := metadata.FromDetect(t.Context(), "../../../../integration/nhost/metadata/")
	if err != nil {
		t.Fatalf("failed to load metadata: %v", err)
	}

	pgPool, err := postgres.Open(t.Context(), testDBURL)
	if err != nil {
		t.Fatalf("failed to open postgres pool: %v", err)
	}

	pgClient := postgres.NewClient(pgPool)
	t.Cleanup(func() { pgClient.Close() })

	objects, err := pgClient.Introspect(t.Context(), &md.Databases[0])
	if err != nil {
		t.Fatalf("failed to introspect database: %v", err)
	}

	roots, groupedAggOp, err := queries.BuildRoots(
		objects, &md.Databases[0], &dialect.PostgresDialect{},
	)
	if err != nil {
		t.Fatalf("failed to build roots: %v", err)
	}

	return &testResources{
		roots:        roots,
		groupedAggOp: groupedAggOp,
		pool:         pool,
	}
}

type query struct {
	Query            string
	Variables        map[string]any
	Role             string
	SessionVariables map[string]any
}

type buildQueryTestCase struct {
	name        string
	query       query
	expectError error
}

func normalizeArrayAny(v []string) any {
	vv := make([]any, len(v))
	for i := range v {
		vv[i] = v[i]
	}

	return vv
}

func normalizeValue(v any) any {
	switch val := v.(type) {
	case int:
		return float64(val)
	case int64:
		return float64(val)
	case int32:
		return float64(val)
	case []string:
		return normalizeArrayAny(val)
	case map[string]any:
		// Recursively normalize map values
		for k, mapVal := range val {
			val[k] = normalizeValue(mapVal)
		}

		return val
	case []any:
		// Recursively normalize slice elements
		for i, sliceVal := range val {
			val[i] = normalizeValue(sliceVal)
		}

		return val
	default:
		return v
	}
}

func normalize(ops []core.SQLOperation) {
	for i := range ops {
		normalizeOperation(&ops[i])
	}
}

func normalizeOperation(op *core.SQLOperation) {
	for j := range op.Parameters {
		op.Parameters[j] = normalizeValue(op.Parameters[j])
	}

	for i := range op.Sequential {
		normalizeOperation(&op.Sequential[i])
	}
}

func execureOperation(
	t *testing.T, pool *pgxpool.Pool, operation core.SQLOperation,
) any {
	t.Helper()

	tx, err := pool.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin transaction: %v", err)
	}
	defer tx.Rollback(t.Context()) //nolint:errcheck

	return executeOperationRows(t, tx, operation)
}

func executeOperationRows(t *testing.T, tx pgx.Tx, operation core.SQLOperation) any {
	t.Helper()

	if len(operation.Sequential) > 0 {
		row := make([]any, 0, len(operation.Sequential))
		for _, op := range operation.Sequential {
			child := executeOperationRows(t, tx, op)

			childRows, ok := child.([]any)
			if !ok {
				return child
			}

			if len(childRows) == 0 {
				row = append(row, nil)

				continue
			}

			row = append(row, childRows[0])
		}

		return []any{row}
	}

	r, err := tx.Query(t.Context(), operation.SQL, operation.Parameters...)
	if err != nil {
		t.Fatalf("failed to execute query: %v", err)
	}
	defer r.Close()

	if err := r.Err(); err != nil {
		t.Fatalf("query error: %v", err)
	}

	var data []any
	for r.Next() {
		var rowData any
		if err := r.Scan(&rowData); err != nil {
			data = append(data, err)

			continue
		}

		data = append(data, rowData)
	}

	if err := r.Err(); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			// Convert PgError to a map to ensure proper JSON serialization
			return map[string]any{
				"Severity":            pgErr.Severity,
				"SeverityUnlocalized": pgErr.SeverityUnlocalized,
				"Code":                pgErr.Code,
				"Message":             pgErr.Message,
				"Detail":              pgErr.Detail,
				"Hint":                pgErr.Hint,
				"Position":            pgErr.Position,
				"InternalPosition":    pgErr.InternalPosition,
				"InternalQuery":       pgErr.InternalQuery,
				"Where":               pgErr.Where,
				"SchemaName":          pgErr.SchemaName,
				"TableName":           pgErr.TableName,
				"ColumnName":          pgErr.ColumnName,
				"DataTypeName":        pgErr.DataTypeName,
				"ConstraintName":      pgErr.ConstraintName,
				"File":                pgErr.File,
				"Line":                pgErr.Line,
				"Routine":             pgErr.Routine,
			}
		}

		return err //nolint:wrapcheck
	}

	if len(data) == 0 {
		return nil
	}

	return data
}

func updateGoldenFile(t *testing.T, data any, goldenFile string) {
	t.Helper()

	if err := os.MkdirAll(filepath.Dir(goldenFile), 0o755); err != nil {
		t.Fatalf("failed to create testdata directory: %v", err)
	}

	b, err := json.Marshal(
		data,
		jsontext.WithIndent("  "),
		json.FormatNilSliceAsNull(true),
		json.FormatNilMapAsNull(true),
	)
	if err != nil {
		t.Fatalf("failed to marshal data: %v", err)
	}

	if err := os.WriteFile(goldenFile, b, 0o644); err != nil { //nolint:gosec
		t.Fatalf("failed to write golden file: %v", err)
	}
}

func getData(t *testing.T, path string, res any) {
	t.Helper()

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("failed to read golden file: %v", err)
	}

	if err := json.Unmarshal(data, &res); err != nil {
		t.Fatalf("failed to unmarshal golden file: %v", err)
	}
}

func testBuildQuery( //nolint:cyclop,gocognit
	t *testing.T, cases []buildQueryTestCase, cleanBetweenTests bool,
) {
	t.Helper()

	// Each test function gets its own isolated database — no shared state.
	// The cleanBetweenTests parameter is kept for API compatibility but is
	// no longer needed since each top-level test creates a fresh database.
	_ = cleanBetweenTests

	res := setupIsolatedDB(t)

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			doc, gqlErr := parser.ParseQuery(
				&ast.Source{Input: tc.query.Query},
			)
			if gqlErr != nil {
				t.Fatalf("failed to parse query: %v", gqlErr)
			}

			if len(doc.Operations) == 0 {
				t.Fatal("no operations found in query")
			}

			role := tc.query.Role
			if role == "" {
				role = "admin"
			}

			var (
				diff       string
				operations []core.SQLOperation
				err        error
			)
			// we retry a few times due to flakiness in tests caused by ordering
			for range 30 {
				operations, err = res.roots.BuildQuery(
					doc.Operations[0],
					doc.Fragments,
					tc.query.Variables,
					role,
					tc.query.SessionVariables,
				)
				if !errors.Is(err, tc.expectError) {
					t.Fatalf("expected error %v, got %v", tc.expectError, err)
				}

				goldenFileOp := filepath.Join("testdata", t.Name()+".json")
				if *updateGolden {
					updateGoldenFile(t, operations, goldenFileOp)
				}

				var expected []core.SQLOperation
				getData(t, goldenFileOp, &expected)

				normalize(expected)
				normalize(operations)

				diff = cmp.Diff(
					expected, operations, cmpopts.EquateEmpty(),
				)
				if diff == "" {
					break
				}
			}

			if diff != "" {
				t.Errorf("expected (-want +got):\n%s", diff)
			}

			// we retry a few times due to flakiness in tests caused by ordering
			for range 30 {
				data := make([]any, len(operations))
				for i, operation := range operations {
					data[i] = execureOperation(t, res.pool, operation)
				}

				goldenFileData := filepath.Join(
					"testdata", t.Name()+"_data.json",
				)
				if *updateGolden {
					updateGoldenFile(t, data, goldenFileData)
				}

				var expectedData []any
				getData(t, goldenFileData, &expectedData)

				for i := range expectedData {
					expectedData[i] = normalizeValue(expectedData[i])
				}

				for i := range data {
					data[i] = normalizeValue(data[i])
				}

				diff = cmp.Diff(
					expectedData, data, cmpopts.EquateEmpty(),
				)
				if diff == "" {
					break
				}
			}

			if diff != "" {
				t.Errorf("expected (-want +got):\n%s", diff)
			}
		})
	}
}

// executeSubscriptionOperation executes a subscription operation with multiplexed parameters.
// Subscription SQL expects $1=subscriptionIDs, $2=sessionVarsJSON, $3+=staticParams.
func executeSubscriptionOperation(
	t *testing.T, pool *pgxpool.Pool, operation core.SQLOperation,
	sessionVariables map[string]any,
) any {
	t.Helper()

	tx, err := pool.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin transaction: %v", err)
	}
	defer tx.Rollback(t.Context()) //nolint:errcheck

	subscriptionIDs := []string{"test-sub-1"}

	sessionVarArrays := make(map[string][]any)
	for varName, varValue := range sessionVariables {
		sessionVarArrays[varName] = []any{varValue}
	}

	cursorValues := multiplexed.ExtractInitialCursorValues(
		operation.StreamCursors,
	)

	params := multiplexed.PrepareParams(
		subscriptionIDs,
		sessionVarArrays,
		cursorValues,
	)

	params = append(params, operation.Parameters...)

	r, err := tx.Query(t.Context(), operation.SQL, params...)
	if err != nil {
		t.Fatalf("failed to execute query: %v", err)
	}
	defer r.Close()

	if err := r.Err(); err != nil {
		t.Fatalf("query error: %v", err)
	}

	var results []any
	for r.Next() {
		var (
			resultID   string
			resultData any
		)

		if err := r.Scan(&resultID, &resultData); err != nil {
			t.Fatalf("failed to scan row: %v", err)
		}

		results = append(results, resultData)
	}

	if err := r.Err(); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			return map[string]any{
				"Severity":            pgErr.Severity,
				"SeverityUnlocalized": pgErr.SeverityUnlocalized,
				"Code":                pgErr.Code,
				"Message":             pgErr.Message,
				"Detail":              pgErr.Detail,
				"Hint":                pgErr.Hint,
				"Position":            pgErr.Position,
				"InternalPosition":    pgErr.InternalPosition,
				"InternalQuery":       pgErr.InternalQuery,
				"Where":               pgErr.Where,
				"SchemaName":          pgErr.SchemaName,
				"TableName":           pgErr.TableName,
				"ColumnName":          pgErr.ColumnName,
				"DataTypeName":        pgErr.DataTypeName,
				"ConstraintName":      pgErr.ConstraintName,
				"File":                pgErr.File,
				"Line":                pgErr.Line,
				"Routine":             pgErr.Routine,
			}
		}

		return err //nolint:wrapcheck
	}

	if len(results) == 0 {
		return nil
	}

	if len(results) == 1 {
		return []any{results[0]}
	}

	return results
}

func testBuildSubscription( //nolint:cyclop,gocognit
	t *testing.T, cases []buildQueryTestCase, cleanBetweenTests bool, //nolint:unparam
) {
	t.Helper()

	_ = cleanBetweenTests

	res := setupIsolatedDB(t)

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			doc, gqlErr := parser.ParseQuery(
				&ast.Source{Input: tc.query.Query},
			)
			if gqlErr != nil {
				t.Fatalf("failed to parse query: %v", gqlErr)
			}

			if len(doc.Operations) == 0 {
				t.Fatal("no operations found in query")
			}

			role := tc.query.Role
			if role == "" {
				role = "admin"
			}

			var (
				diff       string
				operations []core.SQLOperation
				err        error
			)
			// we retry a few times due to flakiness in tests caused by ordering
			for range 30 {
				operations, err = res.roots.BuildQuery(
					doc.Operations[0],
					doc.Fragments,
					tc.query.Variables,
					role,
					tc.query.SessionVariables,
				)
				if !errors.Is(err, tc.expectError) {
					t.Fatalf("expected error %v, got %v", tc.expectError, err)
				}

				goldenFileOp := filepath.Join("testdata", t.Name()+".json")
				if *updateGolden {
					updateGoldenFile(t, operations, goldenFileOp)
				}

				var expected []core.SQLOperation
				getData(t, goldenFileOp, &expected)

				normalize(expected)
				normalize(operations)

				diff = cmp.Diff(
					expected, operations, cmpopts.EquateEmpty(),
				)
				if diff == "" {
					break
				}
			}

			if diff != "" {
				t.Errorf("expected (-want +got):\n%s", diff)
			}

			if tc.expectError != nil {
				return
			}

			// we retry a few times due to flakiness in tests caused by ordering
			for range 30 {
				data := make([]any, len(operations))
				for i, operation := range operations {
					data[i] = executeSubscriptionOperation(
						t,
						res.pool,
						operation,
						tc.query.SessionVariables,
					)
				}

				goldenFileData := filepath.Join(
					"testdata", t.Name()+"_data.json",
				)
				if *updateGolden {
					updateGoldenFile(t, data, goldenFileData)
				}

				var expectedData []any
				getData(t, goldenFileData, &expectedData)

				for i := range expectedData {
					expectedData[i] = normalizeValue(expectedData[i])
				}

				for i := range data {
					data[i] = normalizeValue(data[i])
				}

				diff = cmp.Diff(
					expectedData, data, cmpopts.EquateEmpty(),
				)
				if diff == "" {
					break
				}
			}

			if diff != "" {
				t.Errorf("expected (-want +got):\n%s", diff)
			}
		})
	}
}
