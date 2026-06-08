package sqlite_test

import (
	"database/sql"
	"encoding/json/jsontext"
	"errors"
	"log/slog"
	"path/filepath"
	"strings"
	"testing"

	_ "github.com/mattn/go-sqlite3"
	"go.uber.org/mock/gomock"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/sqlite"
	"github.com/nhost/nhost/services/constellation/connector/sql/sqlite/mock"
	sqlsub "github.com/nhost/nhost/services/constellation/connector/sql/subscription"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// Package-level sentinels so the table-driven cases can use errors.Is without
// sharing closure state, and so err113 doesn't flag inline dynamic errors.
var (
	errScanFailed        = errors.New("scan failed")
	errCommitFailed      = errors.New("commit failed")
	errConnectionRefused = errors.New("connection refused")
	errRollbackFailed    = errors.New("rollback failed")
	errQueryFailed       = errors.New("query failed")
	errIteration         = errors.New("iteration error")
)

func discardLogger() *slog.Logger {
	return slog.New(slog.DiscardHandler)
}

func newTestClient(t *testing.T) *sqlite.Client {
	t.Helper()

	dbPath := filepath.Join(t.TempDir(), "test.db")

	sqlDB, err := sqlite.Open(t.Context(), dbPath)
	if err != nil {
		t.Fatalf("failed to open sqlite: %v", err)
	}

	client := sqlite.NewClient(sqlDB)
	t.Cleanup(func() { client.Close() })

	return client
}

func newTestClientWithSchema(t *testing.T, schema string) *sqlite.Client {
	t.Helper()

	dbPath := filepath.Join(t.TempDir(), "test.db")

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}

	if _, err := db.ExecContext(t.Context(), schema); err != nil {
		t.Fatalf("failed to create schema: %v", err)
	}

	db.Close()

	sqlDB, err := sqlite.Open(t.Context(), dbPath)
	if err != nil {
		t.Fatalf("failed to open sqlite: %v", err)
	}

	client := sqlite.NewClient(sqlDB)
	t.Cleanup(func() { client.Close() })

	return client
}

// scanStringInto returns a Row.Scan stub that copies payload into the *string
// destination, so success-path cases produce a real jsontext.Value result.
func scanStringInto(t *testing.T, payload string) func(dest ...any) error {
	t.Helper()

	return func(dest ...any) error {
		ptr, ok := dest[0].(*string)
		if !ok {
			t.Fatal("expected *string dest")
		}

		*ptr = payload

		return nil
	}
}

// expectExecuteErr asserts the result of a client.ExecuteOperations call
// matches the expected error/result shape for one table-driven case.
func expectExecuteErr(
	t *testing.T,
	err error,
	wantErrSubstring string,
	wantErrIs error,
) {
	t.Helper()

	switch {
	case wantErrSubstring != "":
		if err == nil {
			t.Fatal("expected error, got nil")
		}

		if got := err.Error(); got != wantErrSubstring {
			t.Errorf("unexpected error: %s", got)
		}
	case wantErrIs != nil:
		if err == nil {
			t.Fatal("expected error, got nil")
		}

		if !errors.Is(err, wantErrIs) {
			t.Errorf("expected error %v in chain, got: %v", wantErrIs, err)
		}
	default:
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	}
}

func expectJSONTextResult(t *testing.T, result map[string]any, operationName string, want string) {
	t.Helper()

	v, ok := result[operationName]
	if !ok {
		t.Fatalf("expected %s in results", operationName)
	}

	jv, ok := v.(jsontext.Value)
	if !ok {
		t.Fatalf("expected jsontext.Value, got %T", v)
	}

	if got := string(jv); got != want {
		t.Errorf("unexpected result: %s", got)
	}
}

func TestOpen(t *testing.T) {
	t.Parallel()

	t.Run("success", func(t *testing.T) {
		t.Parallel()

		client := newTestClient(t)
		if client == nil {
			t.Fatal("expected non-nil client")
		}
	})

	t.Run("invalid connection string", func(t *testing.T) {
		t.Parallel()

		_, err := sqlite.Open(t.Context(), "/nonexistent/dir/that/does/not/exist/test.db")
		if err == nil {
			t.Fatal("expected error for invalid path")
		}
	})
}

func TestOpenEnablesCaseSensitiveLikeOnEveryConnection(t *testing.T) {
	t.Parallel()

	dbPath := filepath.Join(t.TempDir(), "case-sensitive-like.db")

	db, err := sqlite.Open(t.Context(), dbPath)
	if err != nil {
		t.Fatalf("failed to open sqlite: %v", err)
	}

	t.Cleanup(func() {
		if err := db.Close(); err != nil {
			t.Errorf("failed to close database: %v", err)
		}
	})

	pool, ok := db.(interface{ SetMaxOpenConns(n int) })
	if !ok {
		t.Fatalf("expected sqlite.Open DB to allow configuring max open conns, got %T", db)
	}

	pool.SetMaxOpenConns(2)

	tx1, err := db.BeginTx(t.Context())
	if err != nil {
		t.Fatalf("failed to begin first transaction: %v", err)
	}

	t.Cleanup(func() {
		if err := tx1.Rollback(); err != nil && !errors.Is(err, sql.ErrTxDone) {
			t.Errorf("first transaction rollback during cleanup: %v", err)
		}
	})

	tx2, err := db.BeginTx(t.Context())
	if err != nil {
		t.Fatalf("failed to begin second transaction: %v", err)
	}

	t.Cleanup(func() {
		if err := tx2.Rollback(); err != nil && !errors.Is(err, sql.ErrTxDone) {
			t.Errorf("second transaction rollback during cleanup: %v", err)
		}
	})

	assertLikeSemantics := func(t *testing.T, tx sqlite.Tx) {
		t.Helper()

		var caseSensitive, lowerRewrite int
		if err := tx.QueryRowContext(
			t.Context(),
			"SELECT 'Foo' LIKE 'foo%', LOWER('Foo') LIKE LOWER('foo%')",
		).Scan(&caseSensitive, &lowerRewrite); err != nil {
			t.Fatalf("failed to query LIKE semantics: %v", err)
		}

		if caseSensitive != 0 {
			t.Fatalf("case-sensitive LIKE matched different case: got %d, want 0", caseSensitive)
		}

		if lowerRewrite != 1 {
			t.Fatalf("LOWER rewrite did not match case-insensitively: got %d, want 1", lowerRewrite)
		}
	}

	assertLikeSemantics(t, tx2)

	if err := tx2.Rollback(); err != nil && !errors.Is(err, sql.ErrTxDone) {
		t.Fatalf("failed to roll back second transaction: %v", err)
	}

	assertLikeSemantics(t, tx1)
}

func TestOpenEnforcesForeignKeysOnEveryConnection(t *testing.T) {
	t.Parallel()

	dbPath := filepath.Join(t.TempDir(), "foreign-keys.db")

	db, err := sqlite.Open(t.Context(), dbPath)
	if err != nil {
		t.Fatalf("failed to open sqlite: %v", err)
	}

	t.Cleanup(func() {
		if err := db.Close(); err != nil {
			t.Errorf("failed to close database: %v", err)
		}
	})

	pool, ok := db.(interface{ SetMaxOpenConns(n int) })
	if !ok {
		t.Fatalf("expected sqlite.Open DB to allow configuring max open conns, got %T", db)
	}

	pool.SetMaxOpenConns(2)

	if err := db.ExecContext(t.Context(), `
		CREATE TABLE parents (id INTEGER PRIMARY KEY);
		CREATE TABLE children (
			id INTEGER PRIMARY KEY,
			parent_id INTEGER NOT NULL REFERENCES parents(id)
		);
	`); err != nil {
		t.Fatalf("failed to create schema: %v", err)
	}

	tx1, err := db.BeginTx(t.Context())
	if err != nil {
		t.Fatalf("failed to begin first transaction: %v", err)
	}

	t.Cleanup(func() {
		if err := tx1.Rollback(); err != nil && !errors.Is(err, sql.ErrTxDone) {
			t.Errorf("first transaction rollback during cleanup: %v", err)
		}
	})

	tx2, err := db.BeginTx(t.Context())
	if err != nil {
		t.Fatalf("failed to begin second transaction: %v", err)
	}

	t.Cleanup(func() {
		if err := tx2.Rollback(); err != nil && !errors.Is(err, sql.ErrTxDone) {
			t.Errorf("second transaction rollback during cleanup: %v", err)
		}
	})

	assertForeignKeyViolation := func(t *testing.T, tx sqlite.Tx, childID int) {
		t.Helper()

		err := tx.ExecContext(
			t.Context(),
			"INSERT INTO children (id, parent_id) VALUES (?, ?)",
			childID,
			999,
		)
		if err == nil {
			t.Fatal("expected foreign-key violation")
		}

		if !strings.Contains(err.Error(), "FOREIGN KEY constraint failed") {
			t.Fatalf("expected foreign-key violation, got %v", err)
		}
	}

	assertForeignKeyViolation(t, tx2, 2)

	if err := tx2.Rollback(); err != nil && !errors.Is(err, sql.ErrTxDone) {
		t.Fatalf("failed to roll back second transaction: %v", err)
	}

	assertForeignKeyViolation(t, tx1, 1)
}

func TestDialect(t *testing.T) {
	t.Parallel()

	client := newTestClient(t)

	d := client.Dialect()
	if d == nil {
		t.Fatal("expected non-nil dialect")
	}

	if _, ok := d.(*dialect.SQLiteDialect); !ok {
		t.Fatalf("expected *dialect.SQLiteDialect, got %T", d)
	}
}

func TestExecuteOperations(t *testing.T) { //nolint:paralleltest
	schema := `
		CREATE TABLE kv (
			key TEXT NOT NULL PRIMARY KEY,
			value TEXT NOT NULL
		);
	`

	client := newTestClientWithSchema(t, schema)
	logger := slog.New(slog.DiscardHandler)

	t.Run("insert and select", func(t *testing.T) { //nolint:paralleltest
		insertOps := []core.SQLOperation{
			{
				Name:       "insert_kv",
				SQL:        `INSERT INTO kv (key, value) VALUES (?, ?) RETURNING json_object('key', key, 'value', value)`,
				Parameters: []any{"hello", "world"},
			},
		}

		results, err := client.ExecuteOperations(t.Context(), insertOps, logger)
		if err != nil {
			t.Fatalf("insert failed: %v", err)
		}

		if results["insert_kv"] == nil {
			t.Fatal("expected non-nil result for insert_kv")
		}
	})

	t.Run("select returns data", func(t *testing.T) { //nolint:paralleltest
		selectOps := []core.SQLOperation{
			{
				Name:       "select_kv",
				SQL:        `SELECT json_object('key', key, 'value', value) FROM kv WHERE key = ?`,
				Parameters: []any{"hello"},
			},
		}

		results, err := client.ExecuteOperations(t.Context(), selectOps, logger)
		if err != nil {
			t.Fatalf("select failed: %v", err)
		}

		if results["select_kv"] == nil {
			t.Fatal("expected non-nil result for select_kv")
		}
	})

	t.Run("select no rows returns nil", func(t *testing.T) { //nolint:paralleltest
		selectOps := []core.SQLOperation{
			{
				Name:       "select_empty",
				SQL:        `SELECT json_object('key', key) FROM kv WHERE key = ?`,
				Parameters: []any{"nonexistent"},
			},
		}

		results, err := client.ExecuteOperations(t.Context(), selectOps, logger)
		if err != nil {
			t.Fatalf("select failed: %v", err)
		}

		if results["select_empty"] != nil {
			t.Fatalf("expected nil result for nonexistent key, got %v", results["select_empty"])
		}
	})

	t.Run("bad SQL rolls back", func(t *testing.T) { //nolint:paralleltest
		badOps := []core.SQLOperation{
			{
				Name: "bad_op",
				SQL:  `SELECT 1 FROM nonexistent_table`,
			},
		}

		_, err := client.ExecuteOperations(t.Context(), badOps, logger)
		if err == nil {
			t.Fatal("expected error for bad SQL")
		}
	})

	t.Run("multiple operations in transaction", func(t *testing.T) { //nolint:paralleltest
		ops := []core.SQLOperation{
			{
				Name:       "insert_a",
				SQL:        `INSERT INTO kv (key, value) VALUES (?, ?) RETURNING json_object('key', key)`,
				Parameters: []any{"a", "1"},
			},
			{
				Name:       "insert_b",
				SQL:        `INSERT INTO kv (key, value) VALUES (?, ?) RETURNING json_object('key', key)`,
				Parameters: []any{"b", "2"},
			},
		}

		results, err := client.ExecuteOperations(t.Context(), ops, logger)
		if err != nil {
			t.Fatalf("multi-op failed: %v", err)
		}

		if len(results) != 2 {
			t.Fatalf("expected 2 results, got %d", len(results))
		}
	})

	t.Run("second operation fails rolls back first", func(t *testing.T) { //nolint:paralleltest
		ops := []core.SQLOperation{
			{
				Name:       "insert_c",
				SQL:        `INSERT INTO kv (key, value) VALUES (?, ?) RETURNING json_object('key', key)`,
				Parameters: []any{"c_rollback_test", "3"},
			},
			{
				Name: "bad_op",
				SQL:  `SELECT 1 FROM nonexistent_table`,
			},
		}

		_, err := client.ExecuteOperations(t.Context(), ops, logger)
		if err == nil {
			t.Fatal("expected error")
		}

		// Verify first insert was rolled back by checking the key doesn't exist
		verifyOps := []core.SQLOperation{
			{
				Name:       "verify",
				SQL:        `SELECT json_object('key', key) FROM kv WHERE key = ?`,
				Parameters: []any{"c_rollback_test"},
			},
		}

		results, err := client.ExecuteOperations(t.Context(), verifyOps, logger)
		if err != nil {
			t.Fatalf("verify failed: %v", err)
		}

		if results["verify"] != nil {
			t.Fatal("expected rolled-back insert to not be visible")
		}
	})
}

func TestExecuteOperationsSequential(t *testing.T) {
	t.Parallel()

	schema := `
		CREATE TABLE kv (
			key TEXT NOT NULL PRIMARY KEY,
			value TEXT NOT NULL
		);
	`

	tests := []struct {
		name       string
		operations []core.SQLOperation
		assert     func(*testing.T, *sqlite.Client, *slog.Logger, map[string]any, error)
	}{
		{
			name: "success assembles JSON array",
			operations: []core.SQLOperation{
				{
					Name: "sequential_success",
					Sequential: []core.SQLOperation{
						{
							Name:       "child_first",
							SQL:        `SELECT json_object('key', ?, 'value', ?)`,
							Parameters: []any{"seq-a", "1"},
						},
						{
							Name:       "child_second",
							SQL:        `SELECT json_object('key', ?, 'value', ?)`,
							Parameters: []any{"seq-b", "2"},
						},
					},
				},
			},
			assert: assertSequentialSuccess,
		},
		{
			name: "child failure rolls back prior child",
			operations: []core.SQLOperation{
				{
					Name: "sequential_failure",
					Sequential: []core.SQLOperation{
						{
							Name:       "child_insert",
							SQL:        `INSERT INTO kv (key, value) VALUES (?, ?) RETURNING json_object('key', key)`,
							Parameters: []any{"seq_rollback_test", "3"},
						},
						{
							Name: "child_bad",
							SQL:  `SELECT 1 FROM nonexistent_table`,
						},
					},
				},
			},
			assert: assertSequentialRollback,
		},
		{
			name: "no rows and null children assemble nulls",
			operations: []core.SQLOperation{
				{
					Name: "sequential_nulls",
					Sequential: []core.SQLOperation{
						{
							Name:       "child_missing",
							SQL:        `SELECT json_object('key', key) FROM kv WHERE key = ?`,
							Parameters: []any{"missing_sequential_child"},
						},
						{
							Name: "child_null",
							SQL:  `SELECT 'null'`,
						},
					},
				},
			},
			assert: assertSequentialNulls,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			client := newTestClientWithSchema(t, schema)
			logger := discardLogger()

			result, err := client.ExecuteOperations(t.Context(), tt.operations, logger)
			tt.assert(t, client, logger, result, err)
		})
	}
}

func assertSequentialSuccess(
	t *testing.T,
	_ *sqlite.Client,
	_ *slog.Logger,
	result map[string]any,
	err error,
) {
	t.Helper()

	if err != nil {
		t.Fatalf("sequential operations failed: %v", err)
	}

	expectJSONTextResult(
		t,
		result,
		"sequential_success",
		`[{"key":"seq-a","value":"1"},{"key":"seq-b","value":"2"}]`,
	)
}

func assertSequentialRollback(
	t *testing.T,
	client *sqlite.Client,
	logger *slog.Logger,
	_ map[string]any,
	err error,
) {
	t.Helper()

	if err == nil {
		t.Fatal("expected sequential child error")
	}

	for _, want := range []string{
		"failed to execute operation sequential_failure",
		"failed to execute sequential operation child_bad",
	} {
		if !strings.Contains(err.Error(), want) {
			t.Fatalf("expected error to contain %q, got %v", want, err)
		}
	}

	verifyOps := []core.SQLOperation{
		{
			Name:       "verify",
			SQL:        `SELECT json_object('key', key) FROM kv WHERE key = ?`,
			Parameters: []any{"seq_rollback_test"},
		},
	}

	results, err := client.ExecuteOperations(t.Context(), verifyOps, logger)
	if err != nil {
		t.Fatalf("verify failed: %v", err)
	}

	if results["verify"] != nil {
		t.Fatal("expected rolled-back sequential child insert to not be visible")
	}
}

func assertSequentialNulls(
	t *testing.T,
	_ *sqlite.Client,
	_ *slog.Logger,
	result map[string]any,
	err error,
) {
	t.Helper()

	if err != nil {
		t.Fatalf("sequential null operations failed: %v", err)
	}

	expectJSONTextResult(t, result, "sequential_nulls", `[null,null]`)
}

func TestExecuteMultiplexedOperation(t *testing.T) { //nolint:paralleltest
	schema := `
		CREATE TABLE items (
			id INTEGER NOT NULL PRIMARY KEY,
			name TEXT NOT NULL
		);
		INSERT INTO items (id, name) VALUES (1, 'alpha');
		INSERT INTO items (id, name) VALUES (2, 'beta');
	`

	client := newTestClientWithSchema(t, schema)
	logger := slog.New(slog.DiscardHandler)

	t.Run("returns results", func(t *testing.T) { //nolint:paralleltest
		// Simulate a multiplexed query that returns (subscription_id, data) pairs.
		sqlQuery := `
			SELECT ? as sub_id, json_group_array(json_object('id', id, 'name', name)) as data
			FROM items
		`

		results, err := client.ExecuteMultiplexedOperation(
			t.Context(), sqlQuery, []any{"sub-1"}, logger,
		)
		if err != nil {
			t.Fatalf("multiplexed query failed: %v", err)
		}

		if len(results) != 1 {
			t.Fatalf("expected 1 result, got %d", len(results))
		}

		if results[0].SubscriptionID != "sub-1" {
			t.Errorf("expected sub ID 'sub-1', got %q", results[0].SubscriptionID)
		}

		if len(results[0].Data) == 0 {
			t.Error("expected non-empty data")
		}
	})

	t.Run("bad SQL returns error", func(t *testing.T) { //nolint:paralleltest
		_, err := client.ExecuteMultiplexedOperation(
			t.Context(), "SELECT 1 FROM nonexistent_table", nil, logger,
		)
		if err == nil {
			t.Fatal("expected error for bad SQL")
		}
	})

	t.Run("empty result set", func(t *testing.T) { //nolint:paralleltest
		sqlQuery := `
			SELECT 'sub-1' as sub_id, json_group_array(json_object('id', id, 'name', name)) as data
			FROM items
			WHERE 1 = 0
			GROUP BY sub_id
		`

		results, err := client.ExecuteMultiplexedOperation(
			t.Context(), sqlQuery, nil, logger,
		)
		if err != nil {
			t.Fatalf("multiplexed query failed: %v", err)
		}

		if len(results) != 0 {
			t.Fatalf("expected 0 results, got %d", len(results))
		}
	})
}

func TestIntrospectEmptyDatabase(t *testing.T) {
	t.Parallel()

	client := newTestClient(t)

	got, err := client.Introspect(t.Context(), &metadata.DatabaseMetadata{})
	if err != nil {
		t.Fatalf("failed to introspect empty database: %v", err)
	}

	// With no tracked tables the per-schema walk is skipped entirely — the
	// driver does not synthesise an empty "" schema entry, matching the
	// PostgreSQL backend.
	if len(got.Schemas) != 0 {
		t.Fatalf("expected 0 schemas, got %d", len(got.Schemas))
	}
}

func TestIntrospectTableWithNoPKs(t *testing.T) {
	t.Parallel()

	ddl := `CREATE TABLE no_pk (a TEXT, b INTEGER);`

	client := newTestClientWithSchema(t, ddl)

	got, err := client.Introspect(t.Context(), &metadata.DatabaseMetadata{
		Tables: []metadata.TableMetadata{
			{Table: metadata.TableSource{Name: "no_pk"}},
		},
	})
	if err != nil {
		t.Fatalf("failed to introspect: %v", err)
	}

	table, ok := got.Schemas[""].Tables["no_pk"]
	if !ok {
		t.Fatal("expected table no_pk")
	}

	if len(table.PrimaryKeys) != 0 {
		t.Fatalf("expected 0 primary keys, got %d", len(table.PrimaryKeys))
	}

	if len(table.Columns) != 2 {
		t.Fatalf("expected 2 columns, got %d", len(table.Columns))
	}
}

func TestIntrospectEnumTableMissingIsElided(t *testing.T) {
	t.Parallel()

	// A missing enum table no longer fails Introspect — the entry is
	// silently elided from EnumValues so the outer reconcile pass can
	// record an inconsistency and demote the table.
	client := newTestClient(t)

	md := &metadata.DatabaseMetadata{
		Tables: []metadata.TableMetadata{
			{
				Table:  metadata.TableSource{Schema: "", Name: "nonexistent_enum"},
				IsEnum: true,
			},
		},
	}

	objs, err := client.Introspect(t.Context(), md)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if _, ok := objs.GetEnumValues("", "nonexistent_enum"); ok {
		t.Error("expected the missing enum to be absent from EnumValues")
	}
}

func TestNew(t *testing.T) {
	t.Parallel()

	t.Run("success", func(t *testing.T) {
		t.Parallel()

		dbPath := filepath.Join(t.TempDir(), "test.db")

		conn, err := sqlite.New(t.Context(), dbPath, &metadata.DatabaseMetadata{}, nil, nil)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		t.Cleanup(func() { conn.Close() })
	})

	t.Run("invalid connection string", func(t *testing.T) {
		t.Parallel()

		_, err := sqlite.New(
			t.Context(),
			"/nonexistent/dir/that/does/not/exist/test.db",
			&metadata.DatabaseMetadata{},
			nil,
			nil,
		)
		if err == nil {
			t.Fatal("expected error for invalid path")
		}
	})
}

// TestExecuteOperationsMocked is the table-driven cousin of TestExecuteOperations:
// it exercises every error and success branch of Client.ExecuteOperations through
// gomock-driven DB / Tx / Row stubs, so the only difference between cases is which
// step in the transaction lifecycle fails and what the caller observes.
func TestExecuteOperationsMocked(t *testing.T) {
	t.Parallel()

	defaultOperations := []core.SQLOperation{
		{Name: "op1", SQL: "SELECT 1", Parameters: nil, StreamCursors: nil},
	}
	sequentialOperations := []core.SQLOperation{
		{
			Name: "op1",
			Sequential: []core.SQLOperation{
				{Name: "child1", SQL: "SELECT child 1", Parameters: []any{"first"}},
				{Name: "child2", SQL: "SELECT child 2", Parameters: []any{"second"}},
			},
		},
	}

	tests := []struct {
		name             string
		operations       []core.SQLOperation
		setupMocks       func(t *testing.T, db *mock.MockDB, tx *mock.MockTx, row *mock.MockRow)
		wantErrSubstring string
		wantErrIs        error
		wantResult       func(t *testing.T, result map[string]any)
	}{
		{
			name: "begin tx error",
			setupMocks: func(_ *testing.T, db *mock.MockDB, _ *mock.MockTx, _ *mock.MockRow) {
				db.EXPECT().
					BeginTx(gomock.Any()).
					Return(nil, errConnectionRefused)
			},
			wantErrSubstring: "failed to begin transaction: connection refused",
			wantErrIs:        nil,
			wantResult:       nil,
		},
		{
			name:       "sequential success assembles JSON array",
			operations: sequentialOperations,
			setupMocks: func(t *testing.T, db *mock.MockDB, tx *mock.MockTx, row *mock.MockRow) {
				t.Helper()
				gomock.InOrder(
					db.EXPECT().BeginTx(gomock.Any()).Return(tx, nil),
					tx.EXPECT().
						QueryRowContext(gomock.Any(), "SELECT child 1", "first").
						Return(row),
					row.EXPECT().Scan(gomock.Any()).DoAndReturn(scanStringInto(t, `{"id":1}`)),
					tx.EXPECT().
						QueryRowContext(gomock.Any(), "SELECT child 2", "second").
						Return(row),
					row.EXPECT().Scan(gomock.Any()).DoAndReturn(scanStringInto(t, `{"id":2}`)),
					tx.EXPECT().Commit().Return(nil),
				)
			},
			wantErrSubstring: "",
			wantErrIs:        nil,
			wantResult: func(t *testing.T, result map[string]any) {
				t.Helper()
				expectJSONTextResult(t, result, "op1", `[{"id":1},{"id":2}]`)
			},
		},
		{
			name:       "sequential child scan error rolls back",
			operations: sequentialOperations,
			setupMocks: func(t *testing.T, db *mock.MockDB, tx *mock.MockTx, row *mock.MockRow) {
				t.Helper()
				gomock.InOrder(
					db.EXPECT().BeginTx(gomock.Any()).Return(tx, nil),
					tx.EXPECT().
						QueryRowContext(gomock.Any(), "SELECT child 1", "first").
						Return(row),
					row.EXPECT().Scan(gomock.Any()).DoAndReturn(scanStringInto(t, `{"id":1}`)),
					tx.EXPECT().
						QueryRowContext(gomock.Any(), "SELECT child 2", "second").
						Return(row),
					row.EXPECT().Scan(gomock.Any()).Return(errScanFailed),
					tx.EXPECT().Rollback().Return(nil),
				)
			},
			wantErrSubstring: "",
			wantErrIs:        errScanFailed,
			wantResult:       nil,
		},
		{
			name:       "sequential no rows and null children assemble nulls",
			operations: sequentialOperations,
			setupMocks: func(t *testing.T, db *mock.MockDB, tx *mock.MockTx, row *mock.MockRow) {
				t.Helper()
				gomock.InOrder(
					db.EXPECT().BeginTx(gomock.Any()).Return(tx, nil),
					tx.EXPECT().
						QueryRowContext(gomock.Any(), "SELECT child 1", "first").
						Return(row),
					row.EXPECT().Scan(gomock.Any()).Return(sql.ErrNoRows),
					tx.EXPECT().
						QueryRowContext(gomock.Any(), "SELECT child 2", "second").
						Return(row),
					row.EXPECT().Scan(gomock.Any()).DoAndReturn(scanStringInto(t, "null")),
					tx.EXPECT().Commit().Return(nil),
				)
			},
			wantErrSubstring: "",
			wantErrIs:        nil,
			wantResult: func(t *testing.T, result map[string]any) {
				t.Helper()
				expectJSONTextResult(t, result, "op1", `[null,null]`)
			},
		},
		{
			name: "scan error rolls back",
			setupMocks: func(_ *testing.T, db *mock.MockDB, tx *mock.MockTx, row *mock.MockRow) {
				db.EXPECT().BeginTx(gomock.Any()).Return(tx, nil)
				row.EXPECT().Scan(gomock.Any()).Return(errScanFailed)
				tx.EXPECT().QueryRowContext(gomock.Any(), "SELECT 1", gomock.Any()).Return(row)
				tx.EXPECT().Rollback().Return(nil)
			},
			wantErrSubstring: "",
			wantErrIs:        errScanFailed,
			wantResult:       nil,
		},
		{
			name: "rollback error is logged but original error wins",
			setupMocks: func(_ *testing.T, db *mock.MockDB, tx *mock.MockTx, row *mock.MockRow) {
				db.EXPECT().BeginTx(gomock.Any()).Return(tx, nil)
				row.EXPECT().Scan(gomock.Any()).Return(errScanFailed)
				tx.EXPECT().QueryRowContext(gomock.Any(), "SELECT 1", gomock.Any()).Return(row)
				tx.EXPECT().Rollback().Return(errRollbackFailed)
			},
			wantErrSubstring: "",
			wantErrIs:        errScanFailed,
			wantResult:       nil,
		},
		{
			name: "err no rows commits with nil result",
			setupMocks: func(_ *testing.T, db *mock.MockDB, tx *mock.MockTx, row *mock.MockRow) {
				db.EXPECT().BeginTx(gomock.Any()).Return(tx, nil)
				row.EXPECT().Scan(gomock.Any()).Return(sql.ErrNoRows)
				tx.EXPECT().QueryRowContext(gomock.Any(), "SELECT 1", gomock.Any()).Return(row)
				tx.EXPECT().Commit().Return(nil)
			},
			wantErrSubstring: "",
			wantErrIs:        nil,
			wantResult: func(t *testing.T, result map[string]any) {
				t.Helper()

				if v := result["op1"]; v != nil {
					t.Errorf("expected nil result for ErrNoRows, got %v", v)
				}
			},
		},
		{
			name: "commit error rolls back",
			setupMocks: func(t *testing.T, db *mock.MockDB, tx *mock.MockTx, row *mock.MockRow) {
				t.Helper()
				db.EXPECT().BeginTx(gomock.Any()).Return(tx, nil)
				row.EXPECT().Scan(gomock.Any()).DoAndReturn(scanStringInto(t, `{"id": 1}`))
				tx.EXPECT().QueryRowContext(gomock.Any(), "SELECT 1", gomock.Any()).Return(row)
				tx.EXPECT().Commit().Return(errCommitFailed)
				tx.EXPECT().Rollback().Return(nil)
			},
			wantErrSubstring: "",
			wantErrIs:        errCommitFailed,
			wantResult:       nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			db := mock.NewMockDB(ctrl)
			tx := mock.NewMockTx(ctrl)
			row := mock.NewMockRow(ctrl)

			tt.setupMocks(t, db, tx, row)

			operations := tt.operations
			if operations == nil {
				operations = defaultOperations
			}

			client := sqlite.NewClient(db)

			result, err := client.ExecuteOperations(
				t.Context(),
				operations,
				discardLogger(),
			)

			expectExecuteErr(t, err, tt.wantErrSubstring, tt.wantErrIs)

			if tt.wantResult != nil {
				tt.wantResult(t, result)
			}
		})
	}
}

// multiplexedSuccessMocks wires the rows iterator for the successful path of
// ExecuteMultiplexedOperation: two real subscription/data rows and a final
// Next()=false sentinel.
func multiplexedSuccessMocks(t *testing.T, db *mock.MockDB, rows *mock.MockRows) {
	t.Helper()

	db.EXPECT().
		QueryContext(gomock.Any(), "SELECT sub_id, data", gomock.Any()).
		Return(rows, nil)

	call := 0
	rows.EXPECT().
		Next().
		DoAndReturn(func() bool {
			call++
			return call <= 2
		}).
		Times(3)

	rows.EXPECT().
		Scan(gomock.Any(), gomock.Any()).
		DoAndReturn(func(dest ...any) error {
			strPtr, ok := dest[0].(*string)
			if !ok {
				t.Fatal("expected *string dest[0]")
			}

			dataPtr, ok := dest[1].(*[]byte)
			if !ok {
				t.Fatal("expected *[]byte dest[1]")
			}

			switch call {
			case 1:
				*strPtr = "sub-1"
				*dataPtr = []byte(`{"a":1}`)
			case 2:
				*strPtr = "sub-2"
				*dataPtr = []byte(`{"a":2}`)
			}

			return nil
		}).
		Times(2)

	rows.EXPECT().Err().Return(nil)
	rows.EXPECT().Close().Return(nil)
}

// assertMultiplexedResults compares the actual results against the expected
// slice, reporting any divergence with a row index to keep table-driven
// failures readable.
func assertMultiplexedResults(
	t *testing.T,
	got []sqlsub.MultiplexedResult,
	want []sqlsub.MultiplexedResult,
) {
	t.Helper()

	if len(got) != len(want) {
		t.Fatalf("expected %d results, got %d", len(want), len(got))
	}

	for i, w := range want {
		if got[i].SubscriptionID != w.SubscriptionID ||
			string(got[i].Data) != string(w.Data) {
			t.Errorf("result[%d] = %+v, want %+v", i, got[i], w)
		}
	}
}

// TestExecuteMultiplexedOperationMocked is the table-driven cousin of
// TestExecuteMultiplexedOperation: every case differs only in which mocked
// step in the rows iterator fails (or the happy path).
func TestExecuteMultiplexedOperationMocked(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name             string
		sql              string
		setupMocks       func(t *testing.T, db *mock.MockDB, rows *mock.MockRows)
		wantErrSubstring string
		wantErrIs        error
		wantResults      []sqlsub.MultiplexedResult
	}{
		{
			name:             "success",
			sql:              "SELECT sub_id, data",
			setupMocks:       multiplexedSuccessMocks,
			wantErrSubstring: "",
			wantErrIs:        nil,
			wantResults: []sqlsub.MultiplexedResult{
				{SubscriptionID: "sub-1", Data: []byte(`{"a":1}`)},
				{SubscriptionID: "sub-2", Data: []byte(`{"a":2}`)},
			},
		},
		{
			name: "query error",
			sql:  "SELECT 1",
			setupMocks: func(_ *testing.T, db *mock.MockDB, _ *mock.MockRows) {
				db.EXPECT().
					QueryContext(gomock.Any(), gomock.Any(), gomock.Any()).
					Return(nil, errQueryFailed)
			},
			wantErrSubstring: "failed to execute multiplexed query: query failed",
			wantErrIs:        nil,
			wantResults:      nil,
		},
		{
			name: "rows iteration error",
			sql:  "SELECT 1",
			setupMocks: func(_ *testing.T, db *mock.MockDB, rows *mock.MockRows) {
				db.EXPECT().
					QueryContext(gomock.Any(), gomock.Any(), gomock.Any()).
					Return(rows, nil)
				rows.EXPECT().Next().Return(false)
				rows.EXPECT().Err().Return(errIteration)
				rows.EXPECT().Close().Return(nil)
			},
			wantErrSubstring: "error iterating multiplexed results: iteration error",
			wantErrIs:        nil,
			wantResults:      nil,
		},
		{
			name: "scan error",
			sql:  "SELECT 1",
			setupMocks: func(_ *testing.T, db *mock.MockDB, rows *mock.MockRows) {
				db.EXPECT().
					QueryContext(gomock.Any(), gomock.Any(), gomock.Any()).
					Return(rows, nil)
				rows.EXPECT().Next().Return(true)
				rows.EXPECT().Scan(gomock.Any(), gomock.Any()).Return(errScanFailed)
				rows.EXPECT().Close().Return(nil)
			},
			wantErrSubstring: "",
			wantErrIs:        errScanFailed,
			wantResults:      nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			db := mock.NewMockDB(ctrl)
			rows := mock.NewMockRows(ctrl)

			tt.setupMocks(t, db, rows)

			client := sqlite.NewClient(db)

			results, err := client.ExecuteMultiplexedOperation(
				t.Context(), tt.sql, []any{"arg1"}, discardLogger(),
			)

			expectExecuteErr(t, err, tt.wantErrSubstring, tt.wantErrIs)

			if tt.wantErrSubstring == "" && tt.wantErrIs == nil {
				assertMultiplexedResults(t, results, tt.wantResults)
			}
		})
	}
}
